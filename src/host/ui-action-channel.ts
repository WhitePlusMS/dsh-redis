import { UiActionCoordinator } from './ui-action-coordinator.ts'
import type { SelectionAck, SetSelectionRequest, UiAction, UiActionAck, UiChannelInput, UiChannelMessage } from '../domain.ts'
import { uiChannelInputSchema } from '../typert.shared.ts'

/** One bounded downlink per mounted client; the uplink belongs to that same client. */
export async function* openUiActionChannel(coordinator: UiActionCoordinator<UiAction>, sessionId: string, signal: AbortSignal, uplink: AsyncIterable<UiChannelInput>, publish: (request: SetSelectionRequest, source: 'manual' | 'action') => SelectionAck): AsyncGenerator<UiChannelMessage> {
  const queue: UiChannelMessage[] = []
  let wake: (() => void) | null = null, closed = false
  let selection: { revision: number; synchronized: boolean } | null = null
  let notifyClosed!: () => void
  const closedSignal = new Promise<null>(resolve => { notifyClosed = () => resolve(null) })
  const state: { pending: { request: import('../domain.ts').UiActionRequest<UiAction>; signal: AbortSignal; resolve: (ack: UiActionAck) => void; reject: () => void; cleanup: () => void; prepared: import('../domain.ts').SetSelectionRequest | null; publishedRevision: number | null } | null } = { pending: null }
  const iterator = uplink[Symbol.asyncIterator]()
  const notify = () => { const waiting = wake; wake = null; waiting?.() }
  const close = () => {
    if (closed) return
    closed = true; queue.length = 0; unregister(); signal.removeEventListener('abort', close)
    const current = state.pending; state.pending = null; current?.cleanup(); current?.reject(); notify(); notifyClosed()
    if (iterator.return !== undefined) void Promise.resolve().then(() => iterator.return?.()).catch(() => undefined)
  }
  const enqueue = (message: UiChannelMessage) => {
    if (closed) return
    // A slow or abandoned client must not accumulate actions indefinitely.
    if (queue.length >= 2) { close(); return }
    queue.push(message); notify()
  }
  const receive = (request: import('../domain.ts').UiActionRequest<UiAction>, actionSignal: AbortSignal) => new Promise<UiActionAck>((resolve, reject) => {
    if (closed || state.pending !== null || actionSignal.aborted) { reject(new Error('界面通道不可用。')); return }
    if (request.target !== null && (selection === null || !selection.synchronized || selection.revision !== request.selectionRevision)) {
      resolve({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'stale' }); return
    }
    const cancelled = () => {
      const current = state.pending
      if (current === null || current.request.requestId !== request.requestId) return
      state.pending = null; current.cleanup()
      const index = queue.findIndex(item => item.kind === 'action' && item.request.requestId === request.requestId)
      if (index >= 0) queue.splice(index, 1)
      else enqueue({ kind: 'cancel', requestId: request.requestId })
      reject(new Error('界面动作已取消。'))
    }
    state.pending = { request, signal: actionSignal, resolve, reject: () => reject(new Error('界面通道已关闭。')), cleanup: () => actionSignal.removeEventListener('abort', cancelled), prepared: null, publishedRevision: null }
    actionSignal.addEventListener('abort', cancelled, { once: true })
    if (actionSignal.aborted) { cancelled(); return }
    enqueue({ kind: 'action', request })
  })
  const unregister = coordinator.register(sessionId, receive)
  signal.addEventListener('abort', close, { once: true })
  if (signal.aborted) close()
  void (async () => {
    try {
      while (!closed) {
        const result = await Promise.race([iterator.next(), closedSignal])
        if (result === null || result.done) break
        const input = uiChannelInputSchema.parse(result.value)
        if ('kind' in input) {
          if (input.kind === 'commitSelection') {
            const current = state.pending, request = current?.request
            const latestSelection = selection as { revision: number; synchronized: boolean } | null
            const isSelectionAction = request?.action.kind === 'selectKey' || request?.action.kind === 'selectHashField' || request?.action.kind === 'selectListIndex' || request?.action.kind === 'selectSetMember' || request?.action.kind === 'selectZSetMember' || request?.action.kind === 'selectStreamField'
            const valid = current !== null && request !== undefined && isSelectionAction && request.target !== null && request.requestId === input.requestId && request.selectionRevision === input.revision && latestSelection !== null && latestSelection.revision === input.revision && latestSelection.synchronized && input.nextRevision === input.revision + 1 && !current.signal.aborted && coordinator.canCommit(sessionId, receive, request) && (request.action.kind === 'selectKey' || coordinator.pointSucceeded(sessionId, request))
            const selected = request?.action.kind === 'selectKey' ? { keyBase64: request.action.key.base64, item: null } : request?.action.kind === 'selectHashField' ? { keyBase64: request.action.keyBase64, item: { kind: 'hash' as const, fieldBase64: request.action.field.base64 } } : request?.action.kind === 'selectListIndex' ? { keyBase64: request.action.keyBase64, item: { kind: 'list' as const, index: request.action.index } } : request?.action.kind === 'selectSetMember' || request?.action.kind === 'selectZSetMember' ? { keyBase64: request.action.keyBase64, item: { kind: request.action.kind === 'selectSetMember' ? 'set' as const : 'zset' as const, memberBase64: request.action.member.base64 } } : request?.action.kind === 'selectStreamField' ? { keyBase64: request.action.keyBase64, item: { kind: 'stream' as const, id: request.action.id, fieldIndex: request.action.fieldIndex, fieldBase64: request.action.fieldBase64 } } : null
            // Prepare only. The visible client publishes the matching identity after rendering.
            const accepted = valid && selected !== null && request.target !== null
            if (accepted) {
              selection = { revision: input.nextRevision, synchronized: false }
              coordinator.setSelectionState(sessionId, receive, input.nextRevision, false)
              current.prepared = { target: request.target, selection: selected }
              coordinator.markPrepared(sessionId, receive, request)
            } else if (current !== null && request !== undefined && isSelectionAction && request.requestId === input.requestId) {
              // A matching refusal is terminal even if no further client frame arrives.
              if (latestSelection !== null && latestSelection.revision === request.selectionRevision && request.selectionRevision < Number.MAX_SAFE_INTEGER) {
                selection = { revision: request.selectionRevision + 1, synchronized: false }
                coordinator.setSelectionState(sessionId, receive, selection.revision, false)
              }
              state.pending = null; current.cleanup()
              current.resolve({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'stale' })
            }
            enqueue({ kind: 'selectionResult', requestId: input.requestId, accepted })
            continue
          }
          if (input.kind === 'publishSelection') {
            const current = state.pending
            const prepared = current?.prepared
            const validPublication = selection !== null && selection.revision === input.revision && coordinator.isUniqueReceiver(sessionId, receive)
            const matchingAction = current !== null && prepared !== null && prepared !== undefined && current.publishedRevision === null && validPublication && input.actionRequestId === current.request.requestId && JSON.stringify(prepared) === JSON.stringify(input.request) && !current.signal.aborted && coordinator.canCommit(sessionId, receive, current.request)
            // An expired or forged action token can never become a manual selection.
            if (input.actionRequestId !== undefined && !matchingAction) { enqueue({ kind: 'selectionResult', requestId: input.requestId, accepted: false }); continue }
            if (prepared !== null && prepared !== undefined && !matchingAction) coordinator.invalidateSession(sessionId)
            const accepted = validPublication && publish(input.request, matchingAction ? 'action' : 'manual').accepted
            if (matchingAction && current !== null && accepted) current.publishedRevision = input.revision
            enqueue({ kind: 'selectionResult', requestId: input.requestId, accepted })
            if (matchingAction && current !== null && !accepted) {
              state.pending = null; current.cleanup()
              current.resolve({ requestId: current.request.requestId, target: current.request.target, selectionRevision: current.request.selectionRevision, outcome: 'stale' })
            }
            continue
          }
          if (selection !== null && (input.revision < selection.revision || (input.revision === selection.revision && selection.synchronized && !input.synchronized))) throw new Error('选择版本回退。')
          const current = state.pending
          if (current?.prepared !== null && current?.prepared !== undefined) {
            if (current.publishedRevision !== null && current.publishedRevision !== input.revision) {
              coordinator.invalidateSession(sessionId)
              if (input.synchronized) throw new Error('新的界面选择尚未发布。')
            }
            else if (input.synchronized && current.publishedRevision === null) throw new Error('界面动作尚未确认。')
          } else if (selection !== null && (input.revision !== selection.revision || !input.synchronized)) coordinator.invalidateSession(sessionId)
          selection = input
          coordinator.setSelectionState(sessionId, receive, input.revision, input.synchronized)
          if (current?.prepared !== null && current?.prepared !== undefined && current.publishedRevision === input.revision && input.synchronized && !current.signal.aborted && coordinator.canCommit(sessionId, receive, current.request)) {
            state.pending = null; current.cleanup()
            current.resolve({ requestId: current.request.requestId, target: current.request.target, selectionRevision: current.request.selectionRevision, outcome: 'applied' })
          }
          continue
        }
        const current = state.pending
        if (current !== null && input.requestId === current.request.requestId) {
          state.pending = null; current.cleanup()
          current.resolve((current.request.action.kind === 'selectKey' || current.request.action.kind === 'selectHashField' || current.request.action.kind === 'selectListIndex' || current.request.action.kind === 'selectSetMember' || current.request.action.kind === 'selectZSetMember' || current.request.action.kind === 'selectStreamField') && input.outcome === 'applied' ? { ...input, outcome: 'failed' } : input)
        }
      }
    } catch { /* A broken uplink closes the receiver below. */ }
    finally { close() }
  })()
  try {
    while (!closed) {
      const message = queue.shift()
      if (message !== undefined) { yield message; continue }
      await new Promise<void>(resolve => { wake = resolve; if (closed || queue.length > 0) notify() })
    }
  } finally { close() }
}
