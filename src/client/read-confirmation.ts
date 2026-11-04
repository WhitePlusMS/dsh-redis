/** A single UI read owns its own identity until its result is rendered. */
export class ReadConfirmation<T> {
  private current: { readonly id: symbol; readonly resolve: (outcome: 'applied' | 'failed' | 'stale') => void; readonly cleanup: () => void; result: T | null; failed: boolean; settled: boolean } | null = null

  start(signal: AbortSignal): { readonly id: symbol; readonly outcome: Promise<'applied' | 'failed' | 'stale'> } | null {
    if (signal.aborted || this.current !== null) return null
    const id = Symbol('Redis read')
    let resolve!: (outcome: 'applied' | 'failed' | 'stale') => void
    const outcome = new Promise<'applied' | 'failed' | 'stale'>(done => { resolve = done })
    const abort = () => { if (this.current?.id === id) this.finish('stale') }
    this.current = { id, resolve, cleanup: () => signal.removeEventListener('abort', abort), result: null, failed: false, settled: false }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    return { id, outcome }
  }

  active(id: symbol): boolean { return this.current?.id === id }
  settle(id: symbol, result: T | null, failed: boolean): void {
    const pending = this.current
    if (pending === null || pending.id !== id) return
    pending.result = result; pending.failed = failed; pending.settled = true
  }
  /** A result must be the exact committed object, not an earlier render. */
  rendered(result: T | null, busy: boolean, failed: boolean): void {
    const pending = this.current
    if (pending === null || !pending.settled || busy || pending.result !== result || pending.failed !== failed) return
    this.finish(failed ? 'failed' : 'applied')
  }
  invalidate(): void { this.finish('stale') }
  private finish(outcome: 'applied' | 'failed' | 'stale'): void {
    const pending = this.current
    if (pending === null) return
    this.current = null; pending.cleanup(); pending.resolve(outcome)
  }
}
