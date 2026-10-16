import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, DatabaseTarget } from '../domain.ts'

interface ScanPage {
  readonly state: 'unavailable' | 'page' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly cursor: string | null
}
interface Options<Cache, Page> {
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
  function stop(): void { ++sequence.current; active.current?.abort() }
  function clear(): void {
    stop(); setBusy(false); setCache(options.empty()); setResult(null); setCursor(null); setError(null); setProgress('idle')
  }
  function cancel(): void { stop(); setBusy(false); setError('cancelled'); setCursor(null); setProgress('idle') }
  async function scan(more: boolean): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current, previous = more ? cache : options.empty()
    active.current = controller; setBusy(true); setError(null)
    if (!more) { setCache(previous); setResult(null); setCursor(null); setProgress('idle') }
    try {
      const response = await options.load(more ? cursor : null, controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!response.ok) throw new Error('RPC failed')
      const page = response.value; setResult(page)
      if (page.state !== 'page') { setCache(options.empty()); setCursor(null); setProgress('idle'); setError(page.error); return }
      const next = options.append(previous, page)
      setCache(next); setCursor(next.limited ? null : page.cursor)
      setProgress(next.limited ? 'limited' : page.cursor === null ? 'complete' : 'more')
    } catch {
      if (!controller.signal.aborted && current === sequence.current) { setError('rpc'); setCache(options.empty()); setResult(null); setCursor(null); setProgress('idle') }
    } finally { if (!controller.signal.aborted && current === sequence.current) setBusy(false) }
  }
  useEffect(() => {
    clear(); void scan(false)
    return stop
  }, [options.target.id, options.target.generation, options.target.db, options.keyBase64, options.queryKey])
  return { cache, result, cursor, busy, error, progress, clear, scan, cancel }
}
