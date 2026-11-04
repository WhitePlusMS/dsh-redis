import { randomUUID } from 'node:crypto'
import type { DatabaseTarget, UiActionAck, UiActionOutcome, UiActionRequest } from '../domain.ts'
type Receiver<Action> = (request: UiActionRequest<Action>, signal: AbortSignal) => Promise<UiActionAck>
interface Pending<Action> { readonly request: UiActionRequest<Action>; readonly receiver: Receiver<Action>; readonly current: () => boolean; prepared: boolean; pointClaimed: boolean; pointSucceeded: boolean; finish(outcome: UiActionOutcome): void }
interface Session<Action> { readonly receivers: Set<Receiver<Action>>; readonly selections: Map<Receiver<Action>, { readonly revision: number; readonly synchronized: boolean }>; pending: Pending<Action> | null }

function sameTarget(left: DatabaseTarget | null, right: DatabaseTarget | null): boolean {
  return left === null ? right === null : right !== null && left.id === right.id && left.generation === right.generation && left.db === right.db
}

/** Actions are plain JSON identities. Freeze the cloned graph shared with the receiver. */
function freezeSnapshot<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value)) freezeSnapshot(nested)
  }
  return value
}

/** Coordinates one bounded action per trusted session; actual UI work belongs to the receiver. */
export class UiActionCoordinator<Action> {
  private readonly sessions = new Map<string, Session<Action>>()

  register(sessionId: string, receive: Receiver<Action>): () => void {
    let session = this.sessions.get(sessionId)
    if (session === undefined) { session = { receivers: new Set(), selections: new Map(), pending: null }; this.sessions.set(sessionId, session) }
    if (session.receivers.has(receive)) throw new Error('界面接收者已注册。')
    const owner = session
    owner.receivers.add(receive)
    // A newly opened second view makes the destination ambiguous even while waiting for an ack.
    if (owner.receivers.size > 1) owner.pending?.finish('ambiguous')
    return () => {
      if (this.sessions.get(sessionId) !== owner || !owner.receivers.delete(receive)) return
      owner.selections.delete(receive)
      owner.pending?.finish('disconnected')
      if (owner.receivers.size === 0 && owner.pending === null) this.sessions.delete(sessionId)
    }
  }

  /** State belongs to a particular registered stream, never to a model argument. */
  setSelectionState(sessionId: string, receive: Receiver<Action>, revision: number, synchronized: boolean): void {
    const session = this.sessions.get(sessionId)
    if (session === undefined || !session.receivers.has(receive)) return
    session.selections.set(receive, { revision, synchronized })
  }

  selectionRevision(sessionId: string): number | null {
    const session = this.sessions.get(sessionId)
    if (session === undefined || session.receivers.size !== 1) return null
    const receiver = session.receivers.values().next().value
    const selection = receiver === undefined ? undefined : session.selections.get(receiver)
    return selection?.synchronized === true ? selection.revision : null
  }

  isUniqueReceiver(sessionId: string, receive: Receiver<Action>): boolean {
    const session = this.sessions.get(sessionId)
    return session !== undefined && session.receivers.size === 1 && session.receivers.has(receive)
  }

  /** A commit is valid only for the still-pending request on its unique stream. */
  canCommit(sessionId: string, receive: Receiver<Action>, request: UiActionRequest<Action>): boolean {
    const session = this.sessions.get(sessionId), pending = session?.pending
    return session !== undefined && session.receivers.size === 1 && session.receivers.has(receive) && pending?.receiver === receive && pending.request === request && Date.now() < request.expiresAt && pending.current()
  }

  /** Resolve an unprepared action only while its original selection remains current. */
  activeRequest(sessionId: string, requestId: string): UiActionRequest<Action> | null {
    const pending = this.sessions.get(sessionId)?.pending
    if (pending === null || pending === undefined || pending.prepared || pending.request.requestId !== requestId || pending.request.target === null || this.selectionRevision(sessionId) !== pending.request.selectionRevision || !this.canCommit(sessionId, pending.receiver, pending.request)) return null
    return pending.request
  }

  /** A UI action may sample its point once, even if that sample is cancelled. */
  claimPoint(sessionId: string, request: UiActionRequest<Action>): boolean {
    const pending = this.sessions.get(sessionId)?.pending
    if (pending === null || pending === undefined || pending.pointClaimed || this.activeRequest(sessionId, request.requestId) !== request) return false
    pending.pointClaimed = true
    return true
  }

  /** The Host marks the bound point sample only after a successful, current read. */
  markPointSucceeded(sessionId: string, request: UiActionRequest<Action>): boolean {
    const pending = this.sessions.get(sessionId)?.pending
    if (pending === null || pending === undefined || !pending.pointClaimed || this.activeRequest(sessionId, request.requestId) !== request) return false
    pending.pointSucceeded = true
    return true
  }

  pointSucceeded(sessionId: string, request: UiActionRequest<Action>): boolean {
    const pending = this.sessions.get(sessionId)?.pending
    return pending !== null && pending !== undefined && pending.request === request && pending.pointSucceeded
  }

  /** Once Host has prepared an action, interruptions cannot prove UI application either way. */
  markPrepared(sessionId: string, receive: Receiver<Action>, request: UiActionRequest<Action>): void {
    const pending = this.sessions.get(sessionId)?.pending
    if (pending?.receiver === receive && pending.request === request) pending.prepared = true
  }

  async dispatch(sessionId: string, action: Action, target: DatabaseTarget | null, selectionRevision: number, isCurrent: () => boolean, signal: AbortSignal, timeoutMs = 10000): Promise<UiActionOutcome> {
    if (!Number.isSafeInteger(selectionRevision) || selectionRevision < 0 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new RangeError('界面动作期限或选择版本无效。')
    if (signal.aborted) return 'cancelled'
    const session = this.sessions.get(sessionId)
    if (session === undefined || session.receivers.size === 0) return 'no_receiver'
    if (session.receivers.size !== 1) return 'ambiguous'
    if (session.pending !== null) return 'busy'
    if (!isCurrent()) return 'stale'
    const receive = session.receivers.values().next().value
    if (receive === undefined) return 'no_receiver'
    const request: UiActionRequest<Action> = freezeSnapshot({ requestId: randomUUID(), action: structuredClone(action), target: target === null ? null : { ...target }, selectionRevision, expiresAt: Date.now() + timeoutMs })
    const controller = new AbortController()
    return new Promise<UiActionOutcome>(resolve => {
      let finished = false
      const finish = (outcome: UiActionOutcome) => {
        if (finished) return
        finished = true; clearTimeout(timer); signal.removeEventListener('abort', cancelled)
        if (session.pending === pending) session.pending = null
        const result = pending.prepared && outcome !== 'applied' ? 'unknown' : outcome
        if (result !== 'applied') controller.abort()
        if (this.sessions.get(sessionId) === session && session.receivers.size === 0) this.sessions.delete(sessionId)
        resolve(result)
      }
      const pending: Pending<Action> = { finish, request, receiver: receive, current: isCurrent, prepared: false, pointClaimed: false, pointSucceeded: false }, cancelled = () => finish('cancelled')
      const timer = setTimeout(() => finish('timeout'), timeoutMs)
      session.pending = pending
      signal.addEventListener('abort', cancelled, { once: true })
      if (signal.aborted) { finish('cancelled'); return }
      void Promise.resolve().then(() => {
        if (finished) return
        return receive(request, controller.signal)
      }).then(ack => {
        if (finished || ack === undefined) return
        if (Date.now() >= request.expiresAt) { finish('timeout'); return }
        if (!isCurrent()) { finish('stale'); return }
        if (session.receivers.size !== 1 || !session.receivers.has(receive)) { finish('ambiguous'); return }
        if (ack.requestId !== request.requestId || !sameTarget(ack.target, request.target) || ack.selectionRevision !== request.selectionRevision) { finish('stale'); return }
        if (ack.outcome !== 'applied' && ack.outcome !== 'unsupported' && ack.outcome !== 'failed' && ack.outcome !== 'stale' && ack.outcome !== 'ambiguous') { finish('failed'); return }
        finish(ack.outcome)
      }).catch(() => finish('failed'))
    })
  }

  /** Selection or target changes cannot invalidate an action without a target, such as showing the pane. */
  invalidateSession(sessionId: string): void {
    const pending = this.sessions.get(sessionId)?.pending
    if (pending !== undefined && pending !== null && pending.request.target !== null) pending.finish('stale')
  }
  disposeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session === undefined) return
    this.sessions.delete(sessionId); session.pending?.finish('disconnected'); session.receivers.clear(); session.selections.clear()
  }
  dispose(): void { for (const sessionId of this.sessions.keys()) this.disposeSession(sessionId) }
}
