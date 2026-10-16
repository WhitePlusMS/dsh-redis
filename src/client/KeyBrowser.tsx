import { useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, ConnectionView, DatabaseTarget, ScanKeysRequest, ScanKeysResult, RedisKey } from '../domain.ts'
import { appendKeys, emptyKeyCache } from './key-cache.ts'
import { NS } from './locales.ts'
import { KeyDetails, type StringActions } from './KeyDetails.tsx'
import type { HashActions } from './HashView.tsx'
import type { ListActions } from './ListView.tsx'
import type { SetActions } from './SetView.tsx'
import type { ZSetActions } from './ZSetView.tsx'
import type { StreamActions } from './StreamView.tsx'
import type { JsonActions } from './JsonView.tsx'
import type { TimeSeriesActions } from './TimeSeriesView.tsx'
import type { HllActions } from './HllView.tsx'

export interface KeyActions extends TimeSeriesActions, StringActions, HllActions, HashActions, ListActions, SetActions, ZSetActions, StreamActions, JsonActions {
  readonly selectDatabase: (request: DatabaseTarget, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly scanKeys: (request: ScanKeysRequest, signal: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
}
type Props = KeyActions & { readonly connection: ConnectionView; readonly acceptConnection: (value: ConnectionView) => void; readonly t: TranslateNS<typeof NS> }

/** Nothing scans on mount, session restore or input change; each page is explicit. */
export function KeyBrowser(props: Props) {
  const { t, connection } = props
  const [db, setDb] = useState(String(connection.db))
  const [pattern, setPattern] = useState('*')
  const [cache, setCache] = useState(emptyKeyCache)
  const [cursor, setCursor] = useState<string | null>(null)
  const [progress, setProgress] = useState<'idle' | 'more' | 'complete' | 'limited'>('idle')
  const [selected, setSelected] = useState<RedisKey | null>(null)
  const [sampledAt, setSampledAt] = useState<string | null>(null)
  const [error, setError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  const active = useRef<AbortController | null>(null)
  const target = (): DatabaseTarget => {
    if (connection.id === null) throw new Error('Missing connection')
    return { id: connection.id, generation: connection.generation, db: connection.db }
  }
  function clear(): void {
    ++sequence.current; active.current?.abort(); setBusy(false)
    setCache(emptyKeyCache()); setCursor(null); setProgress('idle'); setSelected(null); setError(null); setSampledAt(null)
  }
  useEffect(() => {
    clear(); setDb(String(connection.db))
    return () => { ++sequence.current; active.current?.abort() }
  }, [connection.id, connection.generation, connection.db])

  async function run<T>(operation: (signal: AbortSignal) => Promise<RemoteResult<T>>, accept: (value: T) => void): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    active.current = controller; setBusy(true); setError(null)
    try {
      const result = await operation(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (result.ok) accept(result.value)
      else { setError('rpc'); setCursor(null); setProgress('idle') }
    } catch { if (!controller.signal.aborted && current === sequence.current) { setError('rpc'); setCursor(null); setProgress('idle') } }
    finally { if (current === sequence.current && !controller.signal.aborted) setBusy(false) }
  }
  function scan(more: boolean): void {
    const previous = more ? cache : emptyKeyCache()
    if (!more) { setCache(previous); setSelected(null); setProgress('idle'); setSampledAt(null) }
    void run(signal => props.scanKeys({ target: target(), pattern, cursor: more ? cursor : null }, signal), value => {
      setSampledAt(value.sampledAt)
      if (value.state === 'failed') { setError(value.error); setCursor(null); setProgress('idle'); return }
      const next = appendKeys(previous, value.keys)
      setCache(next); setCursor(next.limited ? null : value.cursor)
      setProgress(next.limited ? 'limited' : value.cursor === null ? 'complete' : 'more')
    })
  }
  return <section className="redis-keys" aria-label={t('keys.title')}>
    <h2>{t('keys.title')} · DB {connection.db}</h2>
    <form className="redis-db" onSubmit={event => {
      event.preventDefault(); clear()
      void run(signal => props.selectDatabase({ ...target(), db: Number(db) }, signal), props.acceptConnection)
    }}>
      <label>{t('keys.database')}<input name="db" type="number" required min={0} max={65535} step={1} value={db} disabled={busy} onChange={event => setDb(event.target.value)} /></label>
      <button type="submit" disabled={busy}>{t('keys.selectDatabase')}</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); scan(false) }}>
      <label>{t('keys.pattern')}<input name="pattern" maxLength={256} value={pattern} spellCheck={false} onChange={event => { clear(); setPattern(event.target.value) }} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('keys.scan')}</button>
        <button type="button" disabled={busy || cursor === null || cache.limited} onClick={() => scan(true)}>{t('keys.more')}</button>
        {busy && <button type="button" onClick={() => { ++sequence.current; active.current?.abort(); setBusy(false); setError('cancelled'); setCursor(null); setProgress('idle') }}>{t('keys.cancel')}</button>}
      </div>
    </form>
    <p>{t('keys.hint')}</p>
    <p role="status">{t('keys.loaded')}: <span data-loaded-keys>{cache.keys.length}</span> · {t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</p>
    {sampledAt !== null && <small>{t('connection.sampledAt')} <time dateTime={sampledAt}>{new Date(sampledAt).toLocaleTimeString()}</time></small>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    <div className="redis-key-list" aria-label="Keys">
      {cache.keys.length === 0 ? <p>{t('keys.empty')}</p> : cache.keys.map(key => <button type="button" key={key.base64} data-key-base64={key.base64} aria-pressed={selected?.base64 === key.base64} onClick={() => setSelected(key)}>
        <span>{key.label}</span><small>{key.byteLength} {t('keys.bytes')}</small>
      </button>)}
    </div>
    {selected !== null && <label>{t('keys.selected')}<textarea readOnly rows={3} value={selected.base64} spellCheck={false} /></label>}
    {selected !== null && <KeyDetails key={selected.base64} {...props} target={target()} selected={selected} />}
  </section>
}
