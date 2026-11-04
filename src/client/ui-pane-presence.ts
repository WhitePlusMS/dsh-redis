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
  registerFormatHandler(sessionId: string, handler: FormatActionHandler): () => void {
    let handlers = this.formatHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.formatHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.formatHandlers.get(sessionId) === owner) this.formatHandlers.delete(sessionId) }
  }
  setFormat(sessionId: string, request: FormatActionRequest, signal: AbortSignal): Promise<UiActionAck['outcome']> {
    const count = this.count(sessionId), handlers = this.formatHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  registerRefreshHandler(sessionId: string, handler: RefreshActionHandler): () => void {
    let handlers = this.refreshHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.refreshHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.refreshHandlers.get(sessionId) === owner) this.refreshHandlers.delete(sessionId) }
  }
  refresh(sessionId: string, request: RefreshActionRequest, signal: AbortSignal): Promise<UiActionAck['outcome']> {
    const count = this.count(sessionId), handlers = this.refreshHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  registerKeyHandler(sessionId: string, handler: KeyActionHandler): () => void {
    let handlers = this.keyHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.keyHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.keyHandlers.get(sessionId) === owner) this.keyHandlers.delete(sessionId) }
  }
  selectKey(sessionId: string, request: KeyActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    const count = this.count(sessionId), handlers = this.keyHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  registerHashHandler(sessionId: string, handler: HashActionHandler): () => void {
    let handlers = this.hashHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.hashHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.hashHandlers.get(sessionId) === owner) this.hashHandlers.delete(sessionId) }
  }
  selectHashField(sessionId: string, request: HashActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    const count = this.count(sessionId), handlers = this.hashHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  registerListHandler(sessionId: string, handler: ListActionHandler): () => void {
    let handlers = this.listHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.listHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.listHandlers.get(sessionId) === owner) this.listHandlers.delete(sessionId) }
  }
  selectListIndex(sessionId: string, request: ListActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    const count = this.count(sessionId), handlers = this.listHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  registerSetHandler(sessionId: string, handler: SetActionHandler): () => void {
    let handlers = this.setHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.setHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.setHandlers.get(sessionId) === owner) this.setHandlers.delete(sessionId) }
  }
  registerZSetHandler(sessionId: string, handler: ZSetActionHandler): () => void {
    let handlers = this.zsetHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.zsetHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.zsetHandlers.get(sessionId) === owner) this.zsetHandlers.delete(sessionId) }
  }
  selectZSetMember(sessionId: string, request: ZSetActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    const count = this.count(sessionId), handlers = this.zsetHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  registerStreamHandler(sessionId: string, handler: StreamActionHandler): () => void {
    let handlers = this.streamHandlers.get(sessionId)
    if (handlers === undefined) { handlers = new Set(); this.streamHandlers.set(sessionId, handlers) }
    const owner = handlers; owner.add(handler)
    return () => { owner.delete(handler); if (owner.size === 0 && this.streamHandlers.get(sessionId) === owner) this.streamHandlers.delete(sessionId) }
  }
  selectStreamField(sessionId: string, request: StreamActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    const count = this.count(sessionId), handlers = this.streamHandlers.get(sessionId)
    if (count > 1 || (handlers?.size ?? 0) > 1) return Promise.resolve('ambiguous')
    const handler = handlers?.values().next().value
    if (signal.aborted || count !== 1 || handler === undefined) return Promise.resolve('stale')
    return handler(request, signal)
  }
  selectSetMember(sessionId: string, request: SetActionRequest, signal: AbortSignal): Promise<KeyActionResult> {
    const count = this.count(sessionId), handlers = this.setHandlers.get(sessionId)
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
