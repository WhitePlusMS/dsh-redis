import type { UiAction, UiActionAck, UiActionRequest } from '../domain.ts'

export type KeyActionRequest = UiActionRequest<Extract<UiAction, { kind: 'selectKey' }>>
export type HashActionRequest = UiActionRequest<Extract<UiAction, { kind: 'selectHashField' }>>
export type ListActionRequest = UiActionRequest<Extract<UiAction, { kind: 'selectListIndex' }>>
export type SetActionRequest = UiActionRequest<Extract<UiAction, { kind: 'selectSetMember' }>>
export type ZSetActionRequest = UiActionRequest<Extract<UiAction, { kind: 'selectZSetMember' }>>
export type StreamActionRequest = UiActionRequest<Extract<UiAction, { kind: 'selectStreamField' }>>
export type RefreshActionRequest = UiActionRequest<Extract<UiAction, { kind: 'refresh' }>>
export type RefreshActionHandler = (request: RefreshActionRequest, signal: AbortSignal) => Promise<UiActionAck['outcome']>
export type FormatActionRequest = UiActionRequest<Extract<UiAction, { kind: 'setFormat' }>>
export type FormatActionHandler = (request: FormatActionRequest, signal: AbortSignal) => Promise<UiActionAck['outcome']>
export type MatchActionRequest = UiActionRequest<Extract<UiAction, { kind: 'applyMatch' }>>
export type MatchActionHandler = (request: MatchActionRequest, signal: AbortSignal) => Promise<UiActionAck['outcome']>
export type KeyActionResult = UiActionAck['outcome'] | { readonly kind: 'commitKey' | 'commitHashField' | 'commitListIndex' | 'commitSetMember' | 'commitZSetMember' | 'commitStreamField'; readonly accepted: () => void; readonly rejected: () => void }
export type KeyActionHandler = (request: KeyActionRequest, signal: AbortSignal) => Promise<KeyActionResult>
export type HashActionHandler = (request: HashActionRequest, signal: AbortSignal) => Promise<KeyActionResult>
export type ListActionHandler = (request: ListActionRequest, signal: AbortSignal) => Promise<KeyActionResult>
export type SetActionHandler = (request: SetActionRequest, signal: AbortSignal) => Promise<KeyActionResult>
export type ZSetActionHandler = (request: ZSetActionRequest, signal: AbortSignal) => Promise<KeyActionResult>
export type StreamActionHandler = (request: StreamActionRequest, signal: AbortSignal) => Promise<KeyActionResult>

/** Tracks actual visible Redis pane bodies in one browser client. */
export class UiPanePresence {
  private readonly panes = new Map<string, Set<symbol>>()
  private readonly keyHandlers = new Map<string, Set<KeyActionHandler>>()
  private readonly hashHandlers = new Map<string, Set<HashActionHandler>>()
  private readonly listHandlers = new Map<string, Set<ListActionHandler>>()
  private readonly setHandlers = new Map<string, Set<SetActionHandler>>()
  private readonly zsetHandlers = new Map<string, Set<ZSetActionHandler>>()
  private readonly streamHandlers = new Map<string, Set<StreamActionHandler>>()
  private readonly refreshHandlers = new Map<string, Set<RefreshActionHandler>>()
  private readonly formatHandlers = new Map<string, Set<FormatActionHandler>>()
  private readonly matchHandlers = new Map<string, Set<MatchActionHandler>>()
  private readonly listeners = new Set<() => void>()

  attach(sessionId: string): () => void {
    const token = Symbol('redis pane')
    let panes = this.panes.get(sessionId)
    if (panes === undefined) { panes = new Set(); this.panes.set(sessionId, panes) }
    const owner = panes
    owner.add(token); this.notify()
    return () => {
      if (!owner.delete(token)) return
      if (owner.size === 0 && this.panes.get(sessionId) === owner) this.panes.delete(sessionId)
      this.notify()
    }
  }

  count(sessionId: string): number { return this.panes.get(sessionId)?.size ?? 0 }
  registerMatchHandler(sessionId: string, handler: MatchActionHandler): () => void {
    return this.register(this.matchHandlers, sessionId, handler)
  }
  applyMatch(sessionId: string, request: MatchActionRequest, signal: AbortSignal): Promise<UiActionAck['outcome']> {
    return this.dispatch(this.matchHandlers, sessionId, request, signal)
  }
  registerFormatHandler(sessionId: string, handler: FormatActionHandler): () => void {
    return this.register(this.formatHandlers, sessionId, handler)
  }
  setFormat(sessionId: string, request: FormatActionRequest, signal: AbortSignal): Promise<UiActionAck['outcome']> {
    return this.dispatch(this.formatHandlers, sessionId, request, signal)
  }
  registerRefreshHandler(sessionId: string, handler: RefreshActionHandler): () => void {
    return this.register(this.refreshHandlers, sessionId, handler)
  }
  refresh(sessionId: string, request: RefreshActionRequest, signal: AbortSignal): Promise<UiActionAck['outcome']> {
    return this.dispatch(this.refreshHandlers, sessionId, request, signal)
  }
  registerKeyHandler(sessionId: string, handler: KeyActionHandler): () => void {
    return this.register(this.keyHandlers, sessionId, handler)
  }
  selectKey(sessionId: string, request: KeyActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    return this.dispatch(this.keyHandlers, sessionId, request, signal)
  }
  registerHashHandler(sessionId: string, handler: HashActionHandler): () => void {
    return this.register(this.hashHandlers, sessionId, handler)
  }
  selectHashField(sessionId: string, request: HashActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    return this.dispatch(this.hashHandlers, sessionId, request, signal)
  }
  registerListHandler(sessionId: string, handler: ListActionHandler): () => void {
    return this.register(this.listHandlers, sessionId, handler)
  }
  selectListIndex(sessionId: string, request: ListActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    return this.dispatch(this.listHandlers, sessionId, request, signal)
  }
  registerSetHandler(sessionId: string, handler: SetActionHandler): () => void {
    return this.register(this.setHandlers, sessionId, handler)
  }
  registerZSetHandler(sessionId: string, handler: ZSetActionHandler): () => void {
    return this.register(this.zsetHandlers, sessionId, handler)
  }
  selectZSetMember(sessionId: string, request: ZSetActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    return this.dispatch(this.zsetHandlers, sessionId, request, signal)
  }
  registerStreamHandler(sessionId: string, handler: StreamActionHandler): () => void {
    return this.register(this.streamHandlers, sessionId, handler)
  }
  selectStreamField(sessionId: string, request: StreamActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    return this.dispatch(this.streamHandlers, sessionId, request, signal)
  }
  selectSetMember(sessionId: string, request: SetActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    return this.dispatch(this.setHandlers, sessionId, request, signal)
  }
  private register<Handler>(registry: Map<string, Set<Handler>>, sessionId: string, handler: Handler): () => void {
    let handlers = registry.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); registry.set(sessionId, handlers) }
    const owner = handlers
    owner.add(handler)
    return () => {
      owner.delete(handler)
      if (owner.size === 0 && registry.get(sessionId) === owner) registry.delete(sessionId)
    }
  }
  private dispatch<Request, Result>(registry: Map<string, Set<(request: Request, signal: AbortSignal) => Promise<Result>>>, sessionId: string, request: Request, signal: AbortSignal): Promise<Result | 'ambiguous' | 'stale'> {
    const count = this.count(sessionId), handlers = registry.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private notify(): void { for (const listener of this.listeners) listener() }
}

/** Opening is not success until the corresponding mounted body reports visibility. */
export function showRedisPane(presence: UiPanePresence, sessionId: string, isCurrent: () => boolean, open: () => void, expiresAt: number, signal: AbortSignal): Promise<'applied' | 'stale' | 'failed' | 'ambiguous'> {
  return new Promise(resolve => {
    let finished = false, scheduled = false
    const finish = (outcome: 'applied' | 'stale' | 'failed' | 'ambiguous') => {
      if (finished) return
      finished = true; clearTimeout(timer); unsubscribe(); signal.removeEventListener('abort', cancelled); resolve(outcome)
    }
    const check = () => {
      if (signal.aborted || !isCurrent() || Date.now() >= expiresAt) { finish('stale'); return }
      const count = presence.count(sessionId)
      if (count === 1) finish('applied')
      else if (count > 1) finish('ambiguous')
    }
    // Several pane bodies can commit in one turn; judge their combined state.
    const schedule = () => {
      if (finished || scheduled) return
      scheduled = true
      queueMicrotask(() => { scheduled = false; if (!finished) check() })
    }
    const cancelled = () => finish('stale')
    const unsubscribe = presence.subscribe(schedule)
    const timer = setTimeout(() => finish('stale'), Math.max(0, expiresAt - Date.now()))
    signal.addEventListener('abort', cancelled, { once: true })
    if (signal.aborted || !isCurrent() || Date.now() >= expiresAt) { finish('stale'); return }
    if (presence.count(sessionId) > 0) { schedule(); return }
    try { open(); schedule() } catch { finish('failed') }
  })
}
