import { selectionForAction } from '../ui-action-selection.ts'
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol'
import type { SetSelectionRequest, UiAction, UiActionRequest, UiChannelInput, UiChannelMessage } from '../domain.ts'
import { uiChannelMessageSchema } from '../typert.shared.ts'
import { SelectionEpoch } from './selection-epoch.ts'
import type { KeyActionResult } from './ui-pane-presence.ts'

/** Read cancellation frames while an action is waiting for the UI to commit. */
export async function consumeUiActions(open: (signal: AbortSignal) => Promise<RemoteStreamHandle<UiChannelMessage, UiChannelInput>>, signal: AbortSignal, apply: (request: UiActionRequest<UiAction>, signal: AbortSignal) => Promise<KeyActionResult>, epoch: SelectionEpoch): Promise<void> {
  const stream = await open(signal)
  let closed = false
  let unbind: () => void = () => undefined
  let active: { readonly id: string; readonly controller: AbortController; readonly request: UiActionRequest<UiAction> } | null = null
  const state: { committing: { readonly id: string; readonly revision: number; readonly expected: SetSelectionRequest; readonly accepted: () => void; readonly rejected: () => void } | null } = { committing: null }
  let skipSelection = false
  const close = () => { if (!closed) { closed = true; active?.controller.abort(); active = null; const pending = state.committing; state.committing = null; pending?.rejected(); unbind(); stream.dispose() } }
  const send = (input: UiChannelInput): boolean => { try { stream.send(input); return true } catch { close(); return false } }
  if (signal.aborted) { close(); return }
  signal.addEventListener('abort', close, { once: true })
  const unsubscribe = epoch.subscribe(snapshot => {
    if (closed) return
    if (state.committing !== null && snapshot.revision !== state.committing.revision) {
      const pending = state.committing; state.committing = null; pending.rejected()
    }
    const current = active
    if (current !== null && current.request.target !== null && !epoch.current(current.request.selectionRevision)) {
      active = null; current.controller.abort()
      send({ requestId: current.id, target: current.request.target, selectionRevision: current.request.selectionRevision, outcome: 'stale' })
    }
    if (!closed && !skipSelection) send({ kind: 'selection', ...snapshot })
  })
  unbind = epoch.bindPublisher(input => { if (closed) throw new Error('Redis UI stream closed'); stream.send(input) })
  if (closed) unbind()
  try {
    for await (const raw of stream) {
      if (signal.aborted) break
      // The rc.2 stream transport does not apply the unary result decoder.
      const message = uiChannelMessageSchema.parse(raw)
      if (message.kind === 'selectionResult') {
        if (state.committing?.id === message.requestId) {
          const pending = state.committing; state.committing = null
          if (message.accepted) { epoch.confirmAction(pending.id, pending.expected); pending.accepted() }
          else pending.rejected()
        } else epoch.finishPublication(message.requestId, message.accepted)
        continue
      }
      if (message.kind === 'cancel') {
        if (active?.id === message.requestId) { active.controller.abort(); active = null }
        if (state.committing?.id === message.requestId) { const pending = state.committing; state.committing = null; pending.rejected() }
        continue
      }
      const request = message.request
      if (active !== null) throw new Error('Redis UI action already in progress')
      const current = { id: request.requestId, controller: new AbortController(), request }
      active = current
      void Promise.resolve().then(() => {
        if (closed || signal.aborted || current.controller.signal.aborted || active !== current) return undefined
        return Date.now() >= request.expiresAt || (request.target !== null && !epoch.current(request.selectionRevision)) ? 'stale' as const : apply(request, current.controller.signal)
      }).then(outcome => {
        if (outcome === undefined || closed || signal.aborted || current.controller.signal.aborted || active !== current) return
        if (typeof outcome !== 'string') {
          const selection = selectionForAction(request.action)
          if (selection === null || request.target === null || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || request.selectionRevision === Number.MAX_SAFE_INTEGER) {
            active = null; outcome.rejected(); send({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'stale' }); return
          }
          active = null
          if (!send({ kind: 'commitSelection', requestId: request.requestId, revision: request.selectionRevision, nextRevision: request.selectionRevision + 1 })) { outcome.rejected(); return }
          skipSelection = true
          let revision: number
          try { revision = epoch.advanceAction(request.selectionRevision) } finally { skipSelection = false }
          state.committing = { id: request.requestId, revision, expected: { target: request.target, selection }, accepted: outcome.accepted, rejected: outcome.rejected }
          return
        }
        active = null
        send({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: Date.now() >= request.expiresAt || (request.target !== null && !epoch.current(request.selectionRevision)) ? 'stale' : outcome })
      }).catch(() => {
        if (closed || signal.aborted || current.controller.signal.aborted || active !== current) return
        active = null
        send({ requestId: request.requestId, target: request.target, selectionRevision: request.selectionRevision, outcome: 'failed' })
      })
    }
  } finally { unsubscribe(); signal.removeEventListener('abort', close); close() }
}
