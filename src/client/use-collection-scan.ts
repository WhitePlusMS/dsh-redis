import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, DatabaseTarget } from '../domain.ts'

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
  const auto = useAutoRefreshReader({ active: options.active !== false, busy, result, failed: error !== null && error !== 'cancelled', refresh: () => { void scan(false) }, cancel })
  function stop(): void { ++sequence.current; active.current?.abort(); reading.current = false }
  function clear(): void {
    auto.reset(); stop(); pages.current = 0; setBusy(false); setCache(options.empty()); setResult(null); setCursor(null); setError(null); setProgress('idle')
  }
  function cancel(): void { auto.reset('cancelled'); stop(); setBusy(false); setError('cancelled'); setCursor(null); setProgress('idle') }
  async function scan(more: boolean): Promise<void> {
    // Scroll events may arrive twice before busy is rendered. Never consume a cursor twice.
    if (more && (reading.current || cursor === null || cache.limited || progress !== 'more')) return
    if (more && pages.current >= 1000) { setCursor(null); setProgress('limited'); return }
    if (!auto.begin()) return
    reading.current = true
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    const batches = more ? 1 : Math.max(1, pages.current)
    let next = more ? cache : options.empty(), nextCursor = more ? cursor : null, loaded = more ? pages.current : 0
    active.current = controller; setBusy(true); setError(null)
    try {
      // Keep the committed table/preview mounted while replacing the same query.
      // Replay only its already loaded batches, under the existing page/cache caps.
      for (let index = 0; index < batches; ++index) {
        const response = await options.load(nextCursor, controller.signal)
        if (controller.signal.aborted || current !== sequence.current) return
        if (!response.ok) throw new Error('RPC failed')
        const page = response.value
        if (page.state !== 'page') { pages.current = 0; setResult(page); setCache(options.empty()); setCursor(null); setProgress('idle'); setError(page.error); return }
        ++loaded; next = options.append(next, page); nextCursor = next.limited ? null : page.cursor
        if (nextCursor === null || index === batches - 1) {
          pages.current = loaded; setResult(page); setCache(next); setCursor(nextCursor)
          setProgress(next.limited ? 'limited' : nextCursor === null ? 'complete' : 'more')
          break
        }
      }
    } catch {
      if (!controller.signal.aborted && current === sequence.current) { setError('rpc'); setCache(options.empty()); setResult(null); setCursor(null); setProgress('idle') }
    } finally { if (current === sequence.current) { reading.current = false; if (!controller.signal.aborted) setBusy(false) } }
  }
  useEffect(() => {
    clear(); void scan(false)
    return stop
  }, [options.target.id, options.target.generation, options.target.db, options.keyBase64, options.queryKey])
  return { cache, result, cursor, busy, error, progress, clear, scan, cancel }
}
