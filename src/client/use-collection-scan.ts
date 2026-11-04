import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, DatabaseTarget } from '../domain.ts'
import { ReadConfirmation } from './read-confirmation.ts'

interface ScanPage {
  readonly sampledAt: string
  readonly state: 'unavailable' | 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly cursor: string | null
}
interface Options<Cache, Page> {
  readonly active?: boolean
  readonly target: DatabaseTarget
  readonly keyBase64: string
  readonly queryKey?: string
  readonly empty: () => Cache
  readonly append: (previous: Cache, page: Page) => Cache
  readonly load: (cursor: string | null, signal: AbortSignal) => Promise<RemoteResult<Page>>
}

/** Collection readers share continuation, cancellation and stale-reply rules.
 * Draft inputs do not query; a selected target or submitted queryKey starts a read.
 */
export function useCollectionScan<Cache extends { readonly limited: boolean }, Page extends ScanPage>(options: Options<Cache, Page>) {
  const [cache, setCache] = useState(options.empty), [result, setResult] = useState<Page | null>(null)
  const [cursor, setCursor] = useState<string | null>(null), [busy, setBusy] = useState(false)
  const [error, setError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const [progress, setProgress] = useState<'idle' | 'more' | 'complete' | 'limited'>('idle')
  const active = useRef<AbortController | null>(null), sequence = useRef(0)
  const reading = useRef(false), pages = useRef(0)
  const [confirmation] = useState(() => new ReadConfirmation<Page>())
  const [completion, setCompletion] = useState<{ readonly id: symbol; readonly result: Page | null; readonly failed: boolean } | null>(null)
  const auto = useAutoRefreshReader({ active: options.active !== false, busy, result, failed: error !== null && error !== 'cancelled', refresh: () => { void scan(false) }, refreshOnce, cancel })
  function stop(): void { ++sequence.current; active.current?.abort(); reading.current = false }
  function clear(): void {
    confirmation.invalidate(); auto.reset(); stop(); pages.current = 0; setBusy(false); setCache(options.empty()); setResult(null); setCursor(null); setError(null); setProgress('idle')
  }
  function cancel(): void { confirmation.invalidate(); auto.reset('cancelled'); stop(); setBusy(false); setError('cancelled'); setCursor(null); setProgress('idle') }
  async function scan(more: boolean, identity?: symbol): Promise<void> {
    // Reject duplicate work synchronously, before React renders the busy state.
    if (reading.current || (more && (cursor === null || cache.limited || progress !== 'more'))) return
    if (more && pages.current >= 1000) { setCursor(null); setProgress('limited'); return }
    if (!auto.begin()) { if (identity !== undefined) confirmation.invalidate(); return }
    if (identity === undefined) confirmation.invalidate()
    reading.current = true
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    const batches = more ? 1 : Math.max(1, pages.current)
    let next = more ? cache : options.empty(), nextCursor = more ? cursor : null, loaded = more ? pages.current : 0
    let committed: Page | null = null, failed = false
    active.current = controller; setBusy(true); setError(null)
    try {
      // Keep the committed table/preview mounted while replacing the same query.
      // Replay only its already loaded batches, under the existing page/cache caps.
      for (let index = 0; index < batches; ++index) {
        const response = await options.load(nextCursor, controller.signal)
        if (controller.signal.aborted || current !== sequence.current) return
        if (!response.ok) throw new Error('RPC failed')
        const page = response.value
        if (page.state !== 'page') { committed = page; failed = true; pages.current = 0; setResult(page); setCache(options.empty()); setCursor(null); setProgress('idle'); setError(page.error); return }
        ++loaded; next = options.append(next, page); nextCursor = next.limited ? null : page.cursor
        if (nextCursor === null || index === batches - 1) {
          committed = page; pages.current = loaded; setResult(page); setCache(next); setCursor(nextCursor)
          setProgress(next.limited ? 'limited' : nextCursor === null ? 'complete' : 'more')
          break
        }
      }
    } catch {
      if (!controller.signal.aborted && current === sequence.current) { failed = true; setError('rpc'); setCache(options.empty()); setResult(null); setCursor(null); setProgress('idle') }
    } finally {
      if (current === sequence.current) {
        reading.current = false
        if (!controller.signal.aborted) {
          setBusy(false)
          if (identity !== undefined && confirmation.active(identity)) setCompletion({ id: identity, result: committed, failed })
        }
      }
    }
  }
  /** Confirm only the specific page/error object committed by this read. */
  useLayoutEffect(() => {
    if (completion === null) return
    confirmation.settle(completion.id, completion.result, completion.failed)
    confirmation.rendered(result, busy, error !== null && error !== 'cancelled' || (result !== null && result.state !== 'page'))
  }, [confirmation, completion, result, busy, error])
  function refreshOnce(signal: AbortSignal): Promise<'applied' | 'failed' | 'stale'> {
    if (reading.current) return Promise.resolve('stale')
    const request = confirmation.start(signal)
    if (request === null) return Promise.resolve('stale')
    void scan(false, request.id).catch(() => confirmation.invalidate())
    const owned = active.current
    // An AI action can be interrupted by a pointer-down on a row. Keep the
    // existing table and its layout stable until the user's click completes.
    const abort = () => { if (owned !== null && active.current === owned) { confirmation.invalidate(); auto.reset('cancelled'); stop(); setBusy(false) } }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    return request.outcome.finally(() => signal.removeEventListener('abort', abort))
  }
  useEffect(() => {
    clear(); void scan(false)
    return () => { confirmation.invalidate(); stop() }
  }, [options.target.id, options.target.generation, options.target.db, options.keyBase64, options.queryKey])
  return { cache, result, cursor, busy, error, progress, clear, scan, cancel, refreshOnce }
}
