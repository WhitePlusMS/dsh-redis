import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ConnectionErrorCode, ConnectionView, DatabaseCatalog, DatabasesReadRequest, DatabasesReadResult, DatabaseTarget, ScanKeysRequest, ScanKeysResult, RedisKey } from '../domain.ts'
import { displayLabel } from './collection-value.ts'
import { canResumeKeyLoad, cancelKeyLoad, emptyKeyLoad, keyLoadPercent, loadKeysAutomatically, type KeyLoadUpdate } from './key-loading.ts'
import { NS } from './locales.ts'
import { KeyDetails, type StringActions } from './KeyDetails.tsx'
import { Icon } from './Icon.tsx'
import { KeyAutoRefresh, RefreshControls, RefreshReadInfo, RefreshVisibility } from './AutoRefresh.tsx'
import { KeyCatalog } from './KeyCatalog.tsx'
import { KeyPresentation, KeyMetadataSummary } from './KeyPresentation.tsx'
import type { HashActions } from './HashView.tsx'
import type { ListActions } from './ListView.tsx'
import type { SetActions } from './SetView.tsx'
import type { ZSetActions } from './ZSetView.tsx'
import type { StreamActions } from './StreamView.tsx'
import { CurrentSelection, type SetCurrentSelection } from './CurrentSelection.tsx'
import { SelectionEpochContext, useSelectionRevision } from './SelectionEpochContext.ts'
import type { FormatActionHandler, KeyActionHandler, KeyActionRequest, KeyActionResult, MatchActionHandler, RefreshActionHandler } from './ui-pane-presence.ts'
import { FormatActionContext } from './FormatActionContext.ts'

export interface KeyActions extends StringActions, HashActions, ListActions, SetActions, ZSetActions, StreamActions {
  readonly registerKeyHandler: (handler: KeyActionHandler) => () => void
  readonly registerRefreshHandler: (handler: RefreshActionHandler) => () => void
  readonly registerFormatHandler: (handler: FormatActionHandler) => () => void
  readonly registerMatchHandler: (handler: MatchActionHandler) => () => void
  readonly setSelection: SetCurrentSelection
  readonly selectDatabase: (request: DatabaseTarget, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly scanKeys: (request: ScanKeysRequest, signal: AbortSignal) => Promise<RemoteResult<ScanKeysResult>>
  readonly readDatabases: (request: DatabasesReadRequest, signal: AbortSignal) => Promise<RemoteResult<DatabasesReadResult>>
}
type Props = KeyActions & { readonly connection: ConnectionView; readonly acceptConnection: (value: ConnectionView) => void; readonly t: TranslateNS<typeof NS>; readonly configure: () => void }
type KeySelection = { readonly key: RedisKey | null; readonly token: string | null; readonly serial: number; readonly located: boolean }
interface PendingKeyAction { readonly request: KeyActionRequest; readonly signal: AbortSignal; readonly previous: KeySelection; readonly resolve: (result: KeyActionResult) => void; resolved: boolean; abort: () => void; accepted: () => void; rejected: () => void }

/** An already-connected session owns one sequential scan. DB/session/unmount abort it. */
export function KeyBrowser(props: Props) {
  const { t, connection } = props, visibility = useContext(RefreshVisibility)
  const epoch = useContext(SelectionEpochContext)
  const epochRevision = useSelectionRevision()
  const [pattern, setPattern] = useState('*'), [draft, setDraft] = useState(pattern)
  const [dbDraft, setDbDraft] = useState(String(connection.db)), [filters, setFilters] = useState(false)
  const [load, setLoad] = useState(emptyKeyLoad), [databases, setDatabases] = useState<DatabaseCatalog | null>(null)
  const [catalogError, setCatalogError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const [selectingDb, setSelectingDb] = useState(false)
  const [selection, setSelection] = useState<KeySelection>({ key: null, token: null, serial: 0, located: false })
  const [locatedReady, setLocatedReady] = useState<string | null>(null)
  const selectionRef = useRef(selection), pendingKey = useRef<PendingKeyAction | null>(null)
  const pendingMatch = useRef<{ pattern: string; check: () => void; finish: () => void } | null>(null)
  const [, renderMatch] = useState(0)
  const rollbackKey = useRef<PendingKeyAction | null>(null)
  const hiddenSignal = useRef(new AbortController().signal).current
  const onLocated = useCallback((token: string) => setLocatedReady(token), [])
  const selected = selection.key
  const applySelection = (value: KeySelection) => { selectionRef.current = value; setSelection(value) }
  const [detailTab, setDetailTab] = useState<'data' | 'metadata'>('data'), [focused, setFocused] = useState(false)
  const focusRef = useRef({ focused: false, version: 0 })
  const detailRef = useRef<{ tab: 'data' | 'metadata'; version: number }>({ tab: 'data', version: 0 })
  const applyDetailTab = (tab: 'data' | 'metadata') => { detailRef.current = { ...detailRef.current, tab }; setDetailTab(tab) }
  const userDetailTab = (tab: 'data' | 'metadata') => { detailRef.current = { tab, version: detailRef.current.version + 1 }; epoch?.userSelect(); setDetailTab(tab) }
  const catalog = useRef<HTMLDivElement>(null), detail = useRef<HTMLDivElement>(null)
  const catalogPosition = useRef(0), returnToCatalog = useRef(false), sequence = useRef(0), active = useRef<AbortController | null>(null)
  const resumed = useRef(new WeakSet<KeyLoadUpdate>())
  const target = (): DatabaseTarget => {
    if (connection.id === null) throw new Error('Missing connection')
    return { id: connection.id, generation: connection.generation, db: connection.db }
  }
  function cancel(): void {
    ++sequence.current; active.current?.abort(); active.current = null; setSelectingDb(false)
    setLoad(cancelKeyLoad)
  }
  async function scan(query: string, clearSelection: boolean, resume?: KeyLoadUpdate): Promise<void> {
    if (resume !== undefined && (!canResumeKeyLoad(resume) || active.current !== null || resumed.current.has(resume))) return
    if (resume !== undefined) resumed.current.add(resume)
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    const scanTarget = target()
    active.current = controller
    if (resume === undefined) { setLoad(emptyKeyLoad()); setCatalogError(null); setDatabases(null) }
    else setLoad({ ...resume, phase: 'loading', cursor: null })
    if (clearSelection) { epoch?.invalidate(); applySelection({ key: null, token: null, serial: selectionRef.current.serial + 1, located: false }); applyDetailTab('data'); }
    try {
      if (resume === undefined) {
        try {
          const result = await props.readDatabases({ target: scanTarget }, controller.signal)
          if (controller.signal.aborted || current !== sequence.current) return
          if (!result.ok) setCatalogError('rpc')
          else if (result.value.state === 'value') setDatabases(result.value.catalog)
          else setCatalogError(result.value.error)
        } catch { if (!controller.signal.aborted && current === sequence.current) setCatalogError('rpc') }
      }
      if (controller.signal.aborted || current !== sequence.current) return
      await loadKeysAutomatically({ signal: controller.signal, ...(resume === undefined ? {} : { resume }), scan: (cursor, signal) => props.scanKeys({ target: scanTarget, pattern: query, cursor }, signal), publish: value => {
        if (!controller.signal.aborted && current === sequence.current) setLoad(value)
      } })
    } finally { if (active.current === controller) active.current = null }
  }
  async function selectDb(db: number): Promise<void> {
    cancel(); const controller = new AbortController(), current = ++sequence.current
    const endBoundary = epoch?.beginBoundary(controller.signal)
    active.current = controller; setSelectingDb(true); setCatalogError(null)
    try {
      const result = await props.selectDatabase({ ...target(), db }, controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!result.ok) setCatalogError('rpc')
      else props.acceptConnection(result.value)
    } catch { if (!controller.signal.aborted && current === sequence.current) setCatalogError('rpc') }
    finally { endBoundary?.(); if (active.current === controller) active.current = null; if (current === sequence.current) setSelectingDb(false) }
  }
  useEffect(() => {
    if (selected !== null || connection.id === null || selectingDb || epoch === null || visibility?.visible === false || visibility?.signal.aborted || document.visibilityState !== 'visible') return
    const revision = epoch.snapshot().revision
    let active = true
    void props.setSelection({ target: { id: connection.id, generation: connection.generation, db: connection.db }, selection: null }, AbortSignal.timeout(5000)).then(result => {
      if (active && !visibility?.signal.aborted && result.ok && result.value.accepted) epoch.synchronize(revision)
      else if (active) epoch.fail(revision)
    }).catch(() => { if (active) epoch.fail(revision) })
    return () => { active = false }
  }, [selected, connection.id, connection.generation, connection.db, selectingDb, props.setSelection, epoch, epochRevision, visibility?.visible, visibility?.signal])
  useLayoutEffect(() => {
    if (epoch === null || visibility?.visible === false || visibility?.signal.aborted) return
    const handler: KeyActionHandler = (request, signal) => new Promise(resolve => {
      const currentTarget = target()
      if (pendingKey.current !== null || signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || request.target === null || request.target.id !== currentTarget.id || request.target.generation !== currentTarget.generation || request.target.db !== currentTarget.db) { resolve('stale'); return }
      const previous = selectionRef.current
      const previousFocus = focusRef.current
      const previousDetail = detailRef.current
      const action: PendingKeyAction = { request, signal, previous, resolve, resolved: false, abort: () => undefined, accepted: () => undefined, rejected: () => undefined }
      const retire = () => { signal.removeEventListener('abort', action.abort); if (pendingKey.current === action) pendingKey.current = null }
      const rejected = () => {
        signal.removeEventListener('abort', action.abort)
        // The old component must commit before the external-store notification.
        if (selectionRef.current.token === request.requestId) {
          rollbackKey.current = action; applySelection(previous)
          if (focusRef.current.version === previousFocus.version) { focusRef.current = previousFocus; setFocused(previousFocus.focused) }
          if (detailRef.current.version === previousDetail.version) { detailRef.current = previousDetail; setDetailTab(previousDetail.tab) }
        }
        else if (pendingKey.current === action) pendingKey.current = null
        if (!action.resolved) { action.resolved = true; resolve('stale') }
      }
      const accepted = () => {
        retire()
        const current = selectionRef.current
        if (current.token === request.requestId) applySelection({ ...current, token: null })
      }
      action.abort = rejected; action.accepted = accepted; action.rejected = rejected
      pendingKey.current = action
      signal.addEventListener('abort', rejected, { once: true })
      if (signal.aborted) { rejected(); return }
      focusRef.current = { ...focusRef.current, focused: false }; setFocused(false)
      applySelection({ key: request.action.key, token: request.requestId, serial: previous.serial + 1, located: true })
      applyDetailTab('data')
    })
    return props.registerKeyHandler(handler)
  }, [props.registerKeyHandler, epoch, visibility?.visible, visibility?.signal, connection.id, connection.generation, connection.db])
  useLayoutEffect(() => {
    const action = rollbackKey.current
    if (action === null || selection.token === action.request.requestId) return
    rollbackKey.current = null
    if (pendingKey.current === action) pendingKey.current = null
    if (selectionRef.current === action.previous) epoch?.invalidate()
  }, [selection, epoch])
  useLayoutEffect(() => {
    const action = pendingKey.current
    if (action === null || action.resolved || locatedReady !== action.request.requestId || selection.token !== action.request.requestId) return
    const request = action.request, currentTarget = target()
    if (action.signal.aborted || Date.now() >= request.expiresAt || focused || visibility?.visible === false || visibility?.signal.aborted || document.visibilityState !== 'visible' || epoch === null || !epoch.current(request.selectionRevision) || request.target === null || request.target.id !== currentTarget.id || request.target.generation !== currentTarget.generation || request.target.db !== currentTarget.db) { action.abort(); return }
    action.resolved = true
    action.resolve({ kind: 'commitKey', accepted: action.accepted, rejected: action.rejected })
  }, [selection, locatedReady, focused, epoch, visibility?.visible, visibility?.signal, connection.id, connection.generation, connection.db])
  useLayoutEffect(() => {
    if (epoch === null || visibility?.visible === false || visibility?.signal.aborted || connection.id === null || selectingDb) return
    const handler: MatchActionHandler = (request, signal) => new Promise(resolve => {
      const expectedTarget = request.action.target, currentTarget = target()
      if (pendingMatch.current !== null || signal.aborted || Date.now() >= request.expiresAt || document.visibilityState !== 'visible' || !epoch.current(request.selectionRevision) || expectedTarget.id !== currentTarget.id || expectedTarget.generation !== currentTarget.generation || expectedTarget.db !== currentTarget.db) { resolve('stale'); return }
      let finished = false, starting = true, revision = request.selectionRevision, rendered = false
      const finish = (outcome: 'applied' | 'stale') => {
        if (finished) return
        finished = true; clearTimeout(timer); unsubscribe(); signal.removeEventListener('abort', cancelled); visibility?.signal.removeEventListener('abort', cancelled); document.removeEventListener('visibilitychange', hidden)
        if (pendingMatch.current === pending) pendingMatch.current = null
        resolve(outcome)
      }
      const check = () => {
        if (starting || finished) return
        if (signal.aborted || Date.now() >= request.expiresAt || document.visibilityState !== 'visible' || epoch.snapshot().revision !== revision) { finish('stale'); return }
        if (rendered && epoch.current(revision)) finish('applied')
      }
      const cancelled = () => finish('stale')
      const hidden = () => { if (document.visibilityState !== 'visible') cancelled() }
      const pending = { pattern: request.action.pattern, check: () => { rendered = true; check() }, finish: cancelled }
      const unsubscribe = epoch.subscribe(check)
      const timer = setTimeout(cancelled, Math.max(0, request.expiresAt - Date.now()))
      pendingMatch.current = pending
      signal.addEventListener('abort', cancelled, { once: true })
      visibility?.signal.addEventListener('abort', cancelled, { once: true })
      document.addEventListener('visibilitychange', hidden)
      if (signal.aborted || visibility?.signal.aborted) { cancelled(); return }
      // The filter must be visible even when the user previously focused details.
      focusRef.current = { ...focusRef.current, focused: false }; setFocused(false)
      applyFilter(request.action.pattern)
      revision = epoch.snapshot().revision; starting = false
      renderMatch(value => value + 1)
      check()
    })
    const unregister = props.registerMatchHandler(handler)
    return () => { unregister(); pendingMatch.current?.finish() }
  }, [props.registerMatchHandler, epoch, visibility?.visible, visibility?.signal, connection.id, connection.generation, connection.db, selectingDb])
  // A layout effect runs only after React commits the requested filter to the pane.
  useLayoutEffect(() => { if (pendingMatch.current?.pattern === pattern && selected === null && !focused) pendingMatch.current.check() })
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
    // A user focus change also supersedes a lookup not yet delivered to this pane.
    const next = !focusRef.current.focused
    focusRef.current = { focused: next, version: focusRef.current.version + 1 }
    epoch?.invalidate()
    if (next) { catalogPosition.current = catalog.current?.querySelector('.redis-key-list')?.scrollTop ?? 0; returnToCatalog.current = true }
    setFocused(next)
  }
  const total = databases?.currentKeys ?? databases?.keyspace?.find(row => row.db === connection.db)?.keys ?? (databases?.keyspace === null || databases === null ? null : '0')
  const percent = keyLoadPercent(load.cache.keys.length, total, pattern, load.phase), busy = load.phase === 'loading'
  function applyFilter(value: string): void { setPattern(value); setDraft(value); setFilters(false); void scan(value, true) }
  return <section className="redis-keys" data-focused={focused} aria-label={t('keys.title')} onKeyDown={event => {
    if (event.key === 'Escape' && focused && !event.defaultPrevented) { event.preventDefault(); toggleFocus() }
  }}>
    <div ref={catalog} className="redis-key-catalog">
      <div className="redis-tree-connection"><Icon name="database" /><strong title={connection.target?.host}>{connection.target?.host}:{connection.target?.port}</strong><button type="button" className="redis-icon-button" title={t('connection.settings')} aria-label={t('connection.settings')} onClick={props.configure}><Icon name="settings" /></button></div>
      <div className="redis-catalog-actions">
        <button type="button" className="redis-icon-button" aria-label={t('workbench.filter')} title={t('workbench.filter')} aria-expanded={filters} aria-pressed={pattern !== '*'} onClick={() => setFilters(!filters)}><Icon name="filter" /></button>
        <button type="button" className={`redis-icon-button${busy ? ' redis-spinning' : ''}`} aria-label={t('keys.scan')} title={t('keys.scan')} aria-busy={busy} disabled={selectingDb} onClick={() => { void scan(pattern, false) }}><Icon name="refresh" /></button>
        {busy && <button type="button" className="redis-icon-button" aria-label={t('keys.cancel')} title={t('keys.cancel')} onClick={cancel}><Icon name="close" /></button>}
      </div>
      {filters && <div className="redis-catalog-filters">
        <form onSubmit={event => { event.preventDefault(); applyFilter(draft) }}>
          <label>{t('keys.pattern')}<input name="pattern" maxLength={256} value={draft} spellCheck={false} onChange={event => { epoch?.userSelect(); setDraft(event.target.value) }} /></label>
          <button type="submit" disabled={selectingDb}>{t('workbench.apply')}</button>
        </form>
        {databases?.databaseCount == null && <form onSubmit={event => { event.preventDefault(); void selectDb(Number(dbDraft)) }}><label>{t('workbench.openDb')}<input name="db" type="number" min={0} max={65535} required value={dbDraft} onChange={event => setDbDraft(event.target.value)} /></label><button type="submit" disabled={selectingDb}>{t('keys.selectDatabase')}</button></form>}
      </div>}
      <KeyCatalog keys={load.cache.keys} selected={selected} located={selection.located} locateToken={selection.token} onLocated={onLocated} t={t} databases={databases} db={connection.db} selectingDb={selectingDb} selectDb={db => { void selectDb(db) }} select={key => {
        epoch?.userSelect()
        const current = selectionRef.current
        applySelection({ key, token: null, serial: current.serial + (key.base64 === current.key?.base64 ? 0 : 1), located: false }); applyDetailTab('data')
      }} />
      <div className="redis-load-status" role="status" data-key-load-phase={load.phase} data-db-total={total ?? ''}>
        <div className="redis-load-count" title={`${t('keys.loaded')}: ${load.cache.keys.length} · ${t('workbench.total')}: ${total ?? t('workbench.unknown')} · ${t(`workbench.${load.phase}`)}`}>
          <span role="img" aria-label={t(`workbench.${load.phase}`)}><Icon name={busy ? 'refresh' : load.phase === 'complete' ? 'check' : load.phase === 'cancelled' ? 'pause' : 'warning'} /></span>
          <span><b data-loaded-keys>{load.cache.keys.length}</b>{pattern === '*' && total !== null ? ` / ${total}` : ` ${t('read.loaded')}`}</span>
          {percent !== null && busy && <span>{percent}%</span>}
          {canResumeKeyLoad(load) && <button type="button" className="redis-chip redis-warning" title={t('workbench.paused')} disabled={selectingDb} onClick={() => { void scan(pattern, false, load) }}>{t('keys.more')}</button>}
          {(load.phase === 'limited' || (load.phase === 'paused' && load.cursor === null)) && <button type="button" className="redis-chip redis-warning" title={t(`workbench.${load.phase}`)} onClick={() => setFilters(true)}>{t('read.partial')}<Icon name="filter" /></button>}
          {load.phase === 'cancelled' && <span>{t('read.stopped')}</span>}
        </div>
        {busy && <progress aria-label={t('workbench.progress')} max={100} value={percent ?? undefined} />}
        {pattern !== '*' && <span className="redis-filter-chip"><button type="button" title={`${t('keys.pattern')}: ${pattern}`} onClick={() => setFilters(true)}><Icon name="filter" /><span>{pattern}</span></button><button type="button" className="redis-icon-button" title={t('read.clearFilter')} aria-label={t('read.clearFilter')} onClick={() => applyFilter('*')}><Icon name="close" /></button></span>}
      </div>
      {(load.error !== null || catalogError !== null) && <p role="alert" className="redis-error">{load.error === 'stale' ? t('keys.scanStale') : t(`connection.error.${load.error ?? catalogError!}`)}</p>}
    </div>
    <div ref={detail} className="redis-key-detail" tabIndex={-1}>
      {selected !== null ? [ ...(selection.token !== null && pendingKey.current?.previous.key !== null && pendingKey.current?.previous !== undefined ? [pendingKey.current.previous] : []), selection ].map(view => {
        const key = view.key
        if (key === null) return null
        const visible = view.serial === selection.serial
        return <div key={key.base64 + ':' + view.serial} className="redis-key-view" hidden={!visible}><RefreshVisibility.Provider value={visible ? visibility : { visible: false, signal: visibility?.signal ?? hiddenSignal }}><CurrentSelection target={target()} keyBase64={key.base64} publish={props.setSelection} revision={epochRevision} suspended={!visible || view.token !== null}><KeyPresentation><KeyAutoRefresh action={{ register: props.registerRefreshHandler, target: target(), keyBase64: key.base64 }}>
        {view.token !== null && <p role="status" data-locating-key>{t('keys.locating')}</p>}
        <div className="redis-key-view" data-pending-key-content={view.token !== null} ref={element => { if (element !== null) element.inert = view.token !== null }}>
        <div className="redis-inspector-heading"><Icon name="key" />{focused && <span className="redis-chip">db{connection.db}</span>}<strong title={displayLabel(key.label)}>{displayLabel(key.label)}</strong><KeyMetadataSummary t={t} inspect={() => userDetailTab('metadata')} /><button type="button" className="redis-icon-button redis-focus-button" aria-label={t(focused ? 'content.restore' : 'content.focus')} title={t(focused ? 'content.restore' : 'content.focus')} onClick={toggleFocus}><Icon name={focused ? 'restore' : 'focus'} /></button></div>
        <div className="redis-inspector-toolbar"><div className="redis-inspector-tabs" role="tablist" aria-label={t('value.title')}>
          <button type="button" role="tab" aria-selected={detailTab === 'data'} onClick={() => userDetailTab('data')}>{t('ui.data')}</button>
          <button type="button" role="tab" aria-selected={detailTab === 'metadata'} onClick={() => userDetailTab('metadata')}>{t('ui.metadata')}</button>
        </div><RefreshControls t={t} /></div>
        <RefreshReadInfo t={t} />
        <div className="redis-inspector" data-view={detailTab} role="tabpanel" aria-label={t(detailTab === 'data' ? 'ui.data' : 'ui.metadata')}>
          <label className="redis-key-identity" hidden={detailTab !== 'metadata'}>{t('keys.selected')}<textarea readOnly rows={3} value={key.base64} spellCheck={false} /></label>
          <FormatActionContext.Provider value={{ register: props.registerFormatHandler, target: target(), keyBase64: key.base64 }}><KeyDetails {...props} target={target()} selected={key} /></FormatActionContext.Provider>
        </div>
        </div></KeyAutoRefresh></KeyPresentation></CurrentSelection></RefreshVisibility.Provider></div>
      }) : <div className="redis-welcome"><Icon name="database" /><strong>Redis</strong><p>{t('layout.selectKey')}</p></div>}
    </div>
  </section>
}
