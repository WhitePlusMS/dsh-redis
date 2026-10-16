import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, ConnectionView, DatabaseTarget, ScanKeysRequest, ScanKeysResult, RedisKey } from '../domain.ts'
import { useBrowsingState } from './BrowsingSession.tsx'
import { prefixLabel } from './collection-value.ts'
import { appendKeys, emptyKeyCache } from './key-cache.ts'
import { NS } from './locales.ts'
import { KeyDetails, type StringActions } from './KeyDetails.tsx'
import { Icon } from './Icon.tsx'
import { KeyCatalog } from './KeyCatalog.tsx'
import type { HashActions } from './HashView.tsx'
import type { ListActions } from './ListView.tsx'
import type { SetActions } from './SetView.tsx'
import type { ZSetActions } from './ZSetView.tsx'
import type { StreamActions } from './StreamView.tsx'
import type { JsonActions } from './JsonView.tsx'
import type { BloomActions } from './BloomView.tsx'
import type { TimeSeriesActions } from './TimeSeriesView.tsx'
import type { HllActions } from './HllView.tsx'

export interface KeyActions extends BloomActions, TimeSeriesActions, StringActions, HllActions, HashActions, ListActions, SetActions, ZSetActions, StreamActions, JsonActions {
  readonly selectDatabase: (request: DatabaseTarget, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly scanKeys: (request: ScanKeysRequest, signal: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
}
type Props = KeyActions & { readonly connection: ConnectionView; readonly acceptConnection: (value: ConnectionView) => void; readonly t: TranslateNS<typeof NS>; readonly databaseInput: RefObject<HTMLInputElement> }

/** Nothing scans on mount, session restore or input change; each page is explicit. */
export function KeyBrowser(props: Props) {
  const { t, connection } = props
  const browsing = useBrowsingState()
  const [db, setDb] = useState(String(browsing.state.db))
  const [pattern, setPattern] = useState(browsing.state.pattern)
  const [cache, setCache] = useState(emptyKeyCache)
  const [cursor, setCursor] = useState<string | null>(null)
  const [progress, setProgress] = useState<'idle' | 'more' | 'complete' | 'limited'>('idle')
  const [selected, setSelected] = useState<RedisKey | null>(() => {
    const base64 = browsing.state.keyBase64
    if (base64 === null) return null
    const byteLength = atob(base64).length
    return { base64, byteLength, label: prefixLabel({ base64, byteLength, fullByteLength: byteLength, suffix: '' }) }
  })
  const [opened, setOpened] = useState(false)
  const [detailTab, setDetailTab] = useState<'data' | 'metadata'>('data')
  const [focused, setFocused] = useState(false)
  const catalog = useRef<HTMLDivElement>(null), detail = useRef<HTMLDivElement>(null)
  const catalogPosition = useRef(0), returnToCatalog = useRef(false)
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
    setDetailTab('data')
    setFocused(false)
    setCache(emptyKeyCache()); setCursor(null); setProgress('idle'); setSelected(null); setOpened(false); setError(null); setSampledAt(null)
  }
  useEffect(() => () => { ++sequence.current; active.current?.abort() }, [])
  useLayoutEffect(() => {
    if (focused) (detail.current?.querySelector<HTMLElement>('[data-value-preview]') ?? detail.current)?.focus({ preventScroll: true })
    else if (returnToCatalog.current) {
      const list = catalog.current?.querySelector<HTMLElement>('.redis-key-list')
      if (list !== null && list !== undefined) { list.scrollTop = catalogPosition.current; list.focus({ preventScroll: true }) }
      returnToCatalog.current = false
    }
  }, [focused])
  function toggleFocus(): void {
    if (!focused) { catalogPosition.current = catalog.current?.querySelector('.redis-key-list')?.scrollTop ?? 0; returnToCatalog.current = true }
    setFocused(!focused)
  }
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
    if (!more) { browsing.update({ db: connection.db, keyBase64: null }); setDetailTab('data'); setCache(previous); setSelected(null); setOpened(false); setProgress('idle'); setSampledAt(null) }
    void run(signal => props.scanKeys({ target: target(), pattern, cursor: more ? cursor : null }, signal), value => {
      setSampledAt(value.sampledAt)
      if (value.state === 'failed') { setError(value.error); setCursor(null); setProgress('idle'); return }
      const next = appendKeys(previous, value.keys)
      setCache(next); setCursor(next.limited ? null : value.cursor)
      setProgress(next.limited ? 'limited' : value.cursor === null ? 'complete' : 'more')
    })
  }
  return <section className="redis-keys" data-focused={focused} aria-label={t('keys.title')} onKeyDown={event => {
    if (event.key === 'Escape' && focused && !event.defaultPrevented) { event.preventDefault(); setFocused(false) }
  }}>
    <div ref={catalog} className="redis-key-catalog">
      <h2>{t('keys.title')} · DB {connection.db}</h2>
      <form className="redis-db" onSubmit={event => {
        event.preventDefault(); clear()
        const requested = Number(db)
        void run(signal => props.selectDatabase({ ...target(), db: requested }, signal), value => {
          if (value.state === 'connected' && value.db === requested) browsing.update({ db: requested, keyBase64: requested === browsing.state.db ? browsing.state.keyBase64 : null })
          props.acceptConnection(value)
        })
      }}>
        <label>{t('keys.database')}<input ref={props.databaseInput} name="db" type="number" required min={0} max={65535} step={1} value={db} disabled={busy} onChange={event => setDb(event.target.value)} /></label>
        <button type="submit" disabled={busy}>{t('keys.selectDatabase')}</button>
      </form>
      <form onSubmit={event => { event.preventDefault(); scan(false) }}>
        <label>{t('keys.pattern')}<input name="pattern" maxLength={256} value={pattern} spellCheck={false} onChange={event => { clear(); setPattern(event.target.value); browsing.update({ pattern: event.target.value, keyBase64: null }) }} /></label>
        <div className="redis-actions">
          <button type="submit" disabled={busy}>{t('keys.scan')}</button>
          <button type="button" disabled={busy || cursor === null || cache.limited} onClick={() => scan(true)}>{t('keys.more')}</button>
          {busy && <button type="button" onClick={() => { ++sequence.current; active.current?.abort(); setBusy(false); setError('cancelled'); setCursor(null); setProgress('idle') }}>{t('keys.cancel')}</button>}
        </div>
      </form>
      <p role="status">{t('keys.loaded')}: <span data-loaded-keys>{cache.keys.length}</span> · {t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</p>
      {sampledAt !== null && <small>{t('connection.sampledAt')} <time dateTime={sampledAt}>{new Date(sampledAt).toLocaleTimeString()}</time></small>}
      {busy && <p role="status">{t('connection.busy')}</p>}
      {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
      <KeyCatalog keys={cache.keys} selected={selected} t={t} select={key => {
        browsing.update({ db: connection.db, keyBase64: key.base64, ...(selected?.base64 === key.base64 ? {} : { stringOffset: '0', stringCount: 65536 }) })
        setSelected(key); setOpened(true); setDetailTab('data')
      }} />
    </div>
    <div ref={detail} className="redis-key-detail" tabIndex={-1}>
      {selected !== null ? <>
        <div className="redis-inspector-heading"><Icon name="key" /><strong title={selected.label}>{selected.label}</strong><button type="button" className="redis-icon-button redis-focus-button" aria-label={t(focused ? 'content.restore' : 'content.focus')} title={t(focused ? 'content.restore' : 'content.focus')} onClick={toggleFocus}><Icon name={focused ? 'restore' : 'focus'} /></button></div>
        <div className="redis-inspector-tabs" role="tablist" aria-label={t('value.title')}>
          <button type="button" role="tab" aria-selected={detailTab === 'data'} onClick={() => setDetailTab('data')}>{t('ui.data')}</button>
          <button type="button" role="tab" aria-selected={detailTab === 'metadata'} onClick={() => setDetailTab('metadata')}>{t('ui.metadata')}</button>
        </div>
        {!opened && <>
          <p>{t('session.restored')}</p>
          {connection.db !== browsing.state.db && <p role="status">{t('session.selectDb')}</p>}
          <button type="button" disabled={busy || connection.db !== browsing.state.db} onClick={() => setOpened(true)}>{t('session.readKey')}</button>
        </>}
        <div className="redis-inspector" data-view={detailTab} role="tabpanel" aria-label={t(detailTab === 'data' ? 'ui.data' : 'ui.metadata')}>
          <label className="redis-key-identity" hidden={detailTab !== 'metadata'}>{t('keys.selected')}<textarea readOnly rows={3} value={selected.base64} spellCheck={false} /></label>
          {opened && <KeyDetails key={selected.base64} {...props} target={target()} selected={selected} />}
        </div>
      </> : <p className="redis-empty">{t('layout.selectKey')}</p>}
    </div>
  </section>
}
