import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, ScanKeysResult } from '../domain.ts'
import { appendKeys, emptyKeyCache, type KeyCache } from './key-cache.ts'

export type KeyLoadPhase = 'loading' | 'complete' | 'cancelled' | 'limited' | 'paused' | 'failed'
export interface KeyLoadUpdate {
  readonly cache: KeyCache
  readonly phase: KeyLoadPhase
  readonly pages: number
  readonly cursor: string | null
  readonly sampledAt: string | null
  readonly error: ConnectionErrorCode | 'rpc' | null
}
export const MAX_AUTO_KEY_PAGES = 1000
export const AUTO_KEY_SCAN_MS = 60000
export const emptyKeyLoad = (): KeyLoadUpdate => ({ cache: emptyKeyCache(), phase: 'loading', pages: 0, cursor: null, sampledAt: null, error: null })
export const canResumeKeyLoad = (value: KeyLoadUpdate): boolean => value.phase === 'paused' && value.cursor !== null && !value.cache.limited
export const cancelKeyLoad = (value: KeyLoadUpdate): KeyLoadUpdate => value.phase === 'loading' || value.phase === 'paused' ? { ...value, phase: 'cancelled', cursor: null } : value

/** One sequential cursor chain. Cancellation never publishes a late page; the owner
 * decides whether to retain partial rows or clear them when its DB/connection changes.
 */
export async function loadKeysAutomatically(options: {
  readonly scan: (cursor: string | null, signal: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
  readonly publish: (value: KeyLoadUpdate) => void
  readonly signal: AbortSignal
  readonly resume?: KeyLoadUpdate
  readonly now?: () => number
}): Promise<KeyLoadUpdate> {
  const now = options.now ?? Date.now, started = now(), resume = options.resume
  if (resume !== undefined && !canResumeKeyLoad(resume)) throw new Error('Invalid Key scan continuation')
  let state = resume === undefined ? emptyKeyLoad() : { ...resume, phase: 'loading' as const, cursor: null, error: null }
  let cursor = resume?.cursor ?? null, runPages = 0
  const finish = (phase: KeyLoadPhase, error: KeyLoadUpdate['error'] = null): KeyLoadUpdate => {
    state = { ...state, phase, error, cursor: phase === 'paused' ? cursor : null }
    if (!options.signal.aborted) options.publish(state)
    return state
  }
  if (options.signal.aborted) return { ...state, phase: 'cancelled' }
  options.publish(state)
  while (!options.signal.aborted) {
    // Row/byte limits are enforced by the shared cache. These two bounds also
    // stop very large filtered databases or a non-terminating cursor source.
    if (runPages >= MAX_AUTO_KEY_PAGES || now() - started >= AUTO_KEY_SCAN_MS) return finish('paused')
    try {
      const response = await options.scan(cursor, options.signal)
      if (options.signal.aborted) return { ...state, phase: 'cancelled' }
      if (!response.ok) return finish('failed', 'rpc')
      const value = response.value
      if (value.state === 'failed') return finish('failed', value.error ?? 'protocol')
      state = { ...state, cache: appendKeys(state.cache, value.keys), pages: state.pages + 1, sampledAt: value.sampledAt }
      runPages++
      cursor = value.cursor
      if (state.cache.limited) return finish('limited')
      if (cursor === null) return finish('complete')
      options.publish(state)
    } catch {
      if (options.signal.aborted) return { ...state, phase: 'cancelled' }
      return finish('failed', 'rpc')
    }
  }
  return { ...state, phase: 'cancelled' }
}

/** A DB total is a snapshot, and MATCH counts are not the DB's denominator.
 * Never announce completion before the cursor ends or invent 100% after live changes.
 */
export function keyLoadPercent(loaded: number, total: string | null, pattern: string, phase: KeyLoadPhase): number | null {
  if (total === null || pattern !== '*') return null
  const count = BigInt(total)
  if (phase === 'complete') return BigInt(loaded) === count ? 100 : null
  if (count === 0n) return 0
  return Math.min(99, Number(BigInt(loaded) * 100n / count))
}
