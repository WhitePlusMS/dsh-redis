/** One selected reader owns one one-shot timer. No DOM, connection or data cache lives here. */
export const AUTO_REFRESH_INTERVALS = [1000, 5000, 10000, 30000] as const
export type RefreshStopReason = 'off' | 'hidden' | 'changed' | 'failed' | 'cancelled'
export interface RefreshSample { readonly state: string; readonly sampledAt: string }
export interface RefreshSnapshot {
  readonly enabled: boolean
  readonly busy: boolean
  readonly ready: boolean
  readonly intervalMs: number
  readonly sampledAt: string | null
  readonly reason: RefreshStopReason
}
interface Reader { readonly refresh: () => void; readonly cancel: () => void }
export type RefreshDelay = (run: () => void, milliseconds: number) => () => void

export class AutoRefreshClock {
  private snapshot: RefreshSnapshot = { enabled: false, busy: false, ready: false, intervalMs: 5000, sampledAt: null, reason: 'off' }
  private readonly listeners = new Set<() => void>()
  private owner: symbol | null = null
  private reader: Reader | null = null
  private cancelTimer: (() => void) | null = null
  // A React state update may render the old result before the read effect starts.
  // Keep that old report from rearming a timer between a tick and begin().
  private pendingOwner: symbol | null = null
  private lastResult: RefreshSample | null = null
  private lastFailed = false
  constructor(private readonly delay: RefreshDelay, private readonly visible: () => boolean) {}
  readonly getSnapshot = (): RefreshSnapshot => this.snapshot
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private change(patch: Partial<RefreshSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if ((Object.keys(next) as (keyof RefreshSnapshot)[]).every(key => next[key] === this.snapshot[key])) return
    this.snapshot = next
    for (const listener of this.listeners) listener()
  }
  private clearTimer(): void { this.cancelTimer?.(); this.cancelTimer = null }
  private schedule(): void {
    if (this.cancelTimer !== null || !this.snapshot.enabled || this.snapshot.busy || !this.snapshot.ready || this.reader === null) return
    this.cancelTimer = this.delay(() => {
      this.cancelTimer = null
      if (!this.visible()) { this.stop('hidden'); return }
      if (!this.snapshot.enabled || this.snapshot.busy || !this.snapshot.ready || this.reader === null) return
      this.pendingOwner = this.owner
      this.change({ busy: true, ready: false })
      this.reader.refresh()
    }, this.snapshot.intervalMs)
  }
  attach(owner: symbol, reader: Reader): () => void {
    this.clearTimer(); this.owner = owner; this.reader = reader; this.pendingOwner = null
    this.lastResult = null; this.lastFailed = false
    this.change({ enabled: false, busy: false, ready: false, sampledAt: null, reason: 'changed' })
    return () => {
      if (this.owner !== owner) return
      this.clearTimer(); this.owner = null; this.reader = null; this.pendingOwner = null
      this.change({ enabled: false, busy: false, ready: false, sampledAt: null, reason: 'changed' })
    }
  }
  begin(owner: symbol): boolean {
    if (this.owner !== owner) return false
    const automatic = this.pendingOwner === owner
    this.pendingOwner = null
    // An Off/hide action can commit before the queued React read effect.
    if (automatic && !this.snapshot.enabled) return false
    if (automatic && !this.visible()) { this.stop('hidden'); return false }
    this.clearTimer(); this.change({ busy: true, ready: false })
    return true
  }
  report(owner: symbol, busy: boolean, result: RefreshSample | null, failed: boolean): void {
    if (this.owner !== owner || this.pendingOwner === owner) return
    const changed = this.lastResult !== result || this.lastFailed !== failed || this.snapshot.busy !== busy
    if (!changed) return
    this.lastResult = result; this.lastFailed = failed; this.clearTimer()
    const ready = !busy && !failed && (result?.state === 'value' || result?.state === 'page')
    const stopped = !busy && (failed || (result !== null && !ready))
    this.change({ busy, ready, enabled: this.snapshot.enabled && (busy || ready),
      sampledAt: ready ? result.sampledAt : this.snapshot.sampledAt,
      ...(stopped ? { reason: 'failed' as const } : {}),
    })
    this.schedule()
  }
  reset(owner: symbol, reason: RefreshStopReason = 'changed'): void {
    if (this.owner !== owner) return
    const active = this.snapshot.enabled || this.snapshot.busy
    this.clearTimer()
    this.change({ enabled: false, busy: false, ready: false, ...(active ? { reason } : {}) })
  }
  enable(): void {
    if (this.reader === null || this.snapshot.busy || !this.snapshot.ready || !this.visible()) return
    this.change({ enabled: true, reason: 'off' }); this.schedule()
  }
  stop(reason: RefreshStopReason = 'off'): void {
    this.clearTimer()
    const cancel = this.snapshot.busy
    this.change({ enabled: false, ...(cancel ? { busy: false, ready: false } : {}), reason })
    if (cancel) this.reader?.cancel()
  }
  setInterval(milliseconds: number): void {
    if (!AUTO_REFRESH_INTERVALS.some(value => value === milliseconds)) return
    this.clearTimer(); this.change({ intervalMs: milliseconds }); this.schedule()
  }
  visibilityChanged(): void { if (this.snapshot.enabled && !this.visible()) this.stop('hidden') }
}
