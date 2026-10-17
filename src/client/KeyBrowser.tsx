import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, ConnectionView, DatabaseCatalog, DatabasesReadRequest, DatabasesReadResult, DatabaseTarget, ScanKeysRequest, ScanKeysResult, RedisKey } from '../domain.ts'
import { useBrowsingState } from './BrowsingSession.tsx'
import { displayLabel, prefixLabel } from './collection-value.ts'
import { emptyKeyLoad, keyLoadPercent, loadKeysAutomatically } from './key-loading.ts'
import { NS } from './locales.ts'
import { KeyDetails, type StringActions } from './KeyDetails.tsx'
import { Icon } from './Icon.tsx'
import { KeyAutoRefresh, RefreshVisibility } from './AutoRefresh.tsx'
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
  readonly readDatabases: (request: DatabasesReadRequest, signal: AbortSignal) => Promise<RemoteResult<DatabasesReadResult>>
}
type Props = KeyActions & { readonly connection: ConnectionView; readonly acceptConnection: (value: ConnectionView) => void; readonly t: TranslateNS<typeof NS>; readonly configure: () => void }

/** An already-connected session owns one sequential scan. DB/session/unmount abort it. */
export function KeyBrowser(props: Props) {
  const { t, connection } = props, browsing = useBrowsingState(), visibility = useContext(RefreshVisibility)
  const [pattern, setPattern] = useState(browsing.state.pattern), [draft, setDraft] = useState(pattern)
  const [dbDraft, setDbDraft] = useState(String(connection.db)), [filters, setFilters] = useState(false)
  const [load, setLoad] = useState(emptyKeyLoad), [databases, setDatabases] = useState<DatabaseCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const [selectingDb, setSelectingDb] = useState(false)
  const [selected, setSelected] = useState<RedisKey | null>(() => {
    const base64 = browsing.state.keyBase64
    if (base64 === null || browsing.state.db !== connection.db) return null
    const byteLength = atob(base64).length
    return { base64, byteLength, label: prefixLabel({ base64, byteLength, fullByteLength: byteLength, suffix: '' }) }
  })
  const [opened, setOpened] = useState(false), [detailTab, setDetailTab] = useState<'data' | 'metadata'>('data'), [focused, setFocused] = useState(false)
  const catalog = useRef<HTMLDivElement>(null), detail = useRef<HTMLDivElement>(null)
  const catalogPosition = useRef(0), returnToCatalog = useRef(false), sequence = useRef(0), active = useRef<AbortController | null>(null)
  const target = (): DatabaseTarget => {
    if (connection.id === null) throw new Error('Missing connection')
    return { id: connection.id, generation: connection.generation, db: connection.db }
  }
  function cancel(): void {
    ++sequence.current; active.current?.abort(); setSelectingDb(false)
    setLoad(previous => previous.phase === 'loading' ? { ...previous, phase: 'cancelled' } : previous)
  }
  async function scan(query: string, clearSelection: boolean): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    active.current = controller; setLoad(emptyKeyLoad()); setCatalogError(null); setDatabases(null)
    if (clearSelection) { setSelected(null); setOpened(false); setDetailTab('data'); browsing.update({ db: connection.db, pattern: query, keyBase64: null }) }
    try {
      const result = await props.readDatabases({ target: target() }, controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!result.ok) setCatalogError('rpc')
      else if (result.value.state === 'value') setDatabases(result.value.catalog)
      else setCatalogError(result.value.error)
    } catch { if (!controller.signal.aborted && current === sequence.current) setCatalogError('rpc') }
    if (controller.signal.aborted || current !== sequence.current) return
    await loadKeysAutomatically({ signal: controller.signal, scan: (cursor, signal) => props.scanKeys({ target: target(), pattern: query, cursor }, signal), publish: value => {
      if (!controller.signal.aborted && current === sequence.current) setLoad(value)
    } })
  }
  async function selectDb(db: number): Promise<void> {
    cancel(); const controller = new AbortController(), current = ++sequence.current
    active.current = controller; setSelectingDb(true); setCatalogError(null)
    try {
      const result = await props.selectDatabase({ ...target(), db }, controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!result.ok) setCatalogError('rpc')
      else {
        if (result.value.state === 'connected' && result.value.db === db) browsing.update({ db, keyBase64: null })
        props.acceptConnection(result.value)
      }
    } catch { if (!controller.signal.aborted && current === sequence.current) setCatalogError('rpc') }
    finally { if (current === sequence.current) setSelectingDb(false) }
  }
  useEffect(() => {
    if (visibility?.visible !== false && !visibility?.signal.aborted && document.visibilityState === 'visible') void scan(pattern, false)
    else cancel()
    const hidden = (): void => { if (document.visibilityState !== 'visible') cancel() }
    document.addEventListener('visibilitychange', hidden)
    const signal = visibility?.signal
    signal?.addEventListener('abort', cancel)
    return () => { ++sequence.current; active.current?.abort(); signal?.removeEventListener('abort', cancel); document.removeEventListener('visibilitychange', hidden) }
  }, [visibility?.visible, visibility?.signal])
  useLayoutEffect(() => {
    if (focused) (detail.current?.querySelector<HTMLElement>(':is(.redis-hash-value,.redis-stream-value) [data-value-preview]') ?? detail.current?.querySelector<HTMLElement>('[data-value-preview]') ?? detail.current)?.focus({ preventScroll: true })
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
  const total = databases?.currentKeys ?? databases?.keyspace?.find(row => row.db === connection.db)?.keys ?? (databases?.keyspace === null || databases === null ? null : '0')
  const percent = keyLoadPercent(load.cache.keys.length, total, pattern, load.phase), busy = load.phase === 'loading'
  return <section className="redis-keys" data-focused={focused} aria-label={t('keys.title')} onKeyDown={event => {
    if (event.key === 'Escape' && focused && !event.defaultPrevented) { event.preventDefault(); setFocused(false) }
  }}>
    <div ref={catalog} className="redis-key-catalog">
      <div className="redis-tree-connection"><Icon name="database" /><strong title={connection.target?.host}>{connection.target?.host}:{connection.target?.port}</strong><button type="button" className="redis-icon-button" title={t('connection.settings')} aria-label={t('connection.settings')} onClick={props.configure}><Icon name="settings" /></button></div>
      <div className="redis-catalog-actions">
        <button type="button" className="redis-icon-button" aria-label={t('workbench.filter')} title={t('workbench.filter')} aria-pressed={filters} onClick={() => setFilters(!filters)}><Icon name="search" /></button>
        <button type="button" className="redis-icon-button" aria-label={t('keys.scan')} title={t('keys.scan')} disabled={selectingDb} onClick={() => { void scan(pattern, false) }}><Icon name="refresh" /></button>
        {busy && <button type="button" className="redis-icon-button" aria-label={t('keys.cancel')} title={t('keys.cancel')} onClick={cancel}><Icon name="close" /></button>}
        <span className="redis-db-summary">DB {connection.db}</span>
      </div>
      {filters && <div className="redis-catalog-filters">
        <form onSubmit={event => { event.preventDefault(); setPattern(draft); browsing.update({ pattern: draft }); void scan(draft, true) }}>
          <label>{t('keys.pattern')}<input name="pattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
          <button type="submit" disabled={selectingDb}>{t('workbench.apply')}</button>
        </form>
        {databases?.databaseCount == null && <form onSubmit={event => { event.preventDefault(); void selectDb(Number(dbDraft)) }}><label>{t('workbench.openDb')}<input name="db" type="number" min={0} max={65535} required value={dbDraft} onChange={event => setDbDraft(event.target.value)} /></label><button type="submit" disabled={selectingDb}>{t('keys.selectDatabase')}</button></form>}
      </div>}
      <KeyCatalog keys={load.cache.keys} selected={selected} t={t} databases={databases} db={connection.db} selectingDb={selectingDb} selectDb={db => { void selectDb(db) }} select={key => {
        browsing.update({ db: connection.db, keyBase64: key.base64, ...(selected?.base64 === key.base64 ? {} : { stringOffset: '0', stringCount: 65536 }) })
        setSelected(key); setOpened(true); setDetailTab('data')
      }} />
      <div className="redis-load-status" role="status" data-key-load-phase={load.phase} data-db-total={total ?? ''}>
        <span>{t('workbench.total')}: {total ?? t('workbench.unknown')} · {t('keys.loaded')}: <b data-loaded-keys>{load.cache.keys.length}</b>{percent === null ? '' : ' · ' + percent + '%'}</span>
        {busy && <progress aria-label={t('workbench.progress')} max={100} value={percent ?? undefined} />}
        <small>{t(`workbench.${load.phase}`)}{pattern === '*' ? '' : ' · MATCH ' + pattern}</small>
      </div>
      {(load.error !== null || catalogError !== null) && <p role="alert" className="redis-error">{t(`connection.error.${load.error ?? catalogError!}`)}</p>}
    </div>
    <div ref={detail} className="redis-key-detail" tabIndex={-1}>
      {selected !== null ? <>
        <div className="redis-inspector-heading"><Icon name="key" /><strong title={displayLabel(selected.label)}>{displayLabel(selected.label)}</strong><button type="button" className="redis-icon-button redis-focus-button" aria-label={t(focused ? 'content.restore' : 'content.focus')} title={t(focused ? 'content.restore' : 'content.focus')} onClick={toggleFocus}><Icon name={focused ? 'restore' : 'focus'} /></button></div>
        <div className="redis-inspector-tabs" role="tablist" aria-label={t('value.title')}>
          <button type="button" role="tab" aria-selected={detailTab === 'data'} onClick={() => setDetailTab('data')}>{t('ui.data')}</button>
          <button type="button" role="tab" aria-selected={detailTab === 'metadata'} onClick={() => setDetailTab('metadata')}>{t('ui.metadata')}</button>
        </div>
        {!opened && <><p>{t('session.restored')}</p><button type="button" disabled={selectingDb} onClick={() => setOpened(true)}>{t('session.readKey')}</button></>}
        <div className="redis-inspector" data-view={detailTab} role="tabpanel" aria-label={t(detailTab === 'data' ? 'ui.data' : 'ui.metadata')}>
          <label className="redis-key-identity" hidden={detailTab !== 'metadata'}>{t('keys.selected')}<textarea readOnly rows={3} value={selected.base64} spellCheck={false} /></label>
          {opened && <KeyAutoRefresh key={selected.base64} t={t}><KeyDetails {...props} target={target()} selected={selected} /></KeyAutoRefresh>}
        </div>
      </> : <div className="redis-welcome"><Icon name="database" /><strong>Redis</strong><p>{t('layout.selectKey')}</p></div>}
    </div>
  </section>
}
