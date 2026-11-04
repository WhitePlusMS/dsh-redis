import { useCollectionScan } from './use-collection-scan.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_LIST_ITEMS, type ActionPointReadRequest, type ActionPointReadResult, type DatabaseTarget, type ListEntry, type ListReadRequest, type ListReadResult, type RedisKey } from '../domain.ts'
import { listReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { prefixWindow, cellLabel } from './collection-value.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCurrentItem, useSelectionAction } from './CurrentSelection.tsx'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { KeyActionResult, ListActionHandler, ListActionRequest } from './ui-pane-presence.ts'

export interface ListActions { readonly readList: (request: ListReadRequest, signal: AbortSignal) => Promise<RemoteResult<ListReadResult>>; readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>; readonly registerListHandler: (handler: ListActionHandler) => () => void }
type Props = ListActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type LocatedRow = ListEntry & { readonly sampledAt: string }
interface PendingRow { readonly request: ListActionRequest; readonly signal: AbortSignal; readonly row: LocatedRow; readonly previousPaused: boolean; readonly resolve: (result: KeyActionResult) => void; resolved: boolean; userScrolled: boolean; pagingChanged: boolean; previousTop: number | null; abort: () => void; accepted: () => void; rejected: () => void }

/** Scroll appends bounded live ranges, retaining original list positions. */
export function ListView(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility), publication = useSelectionAction()
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [request, setRequest] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 })
  const [rangeError, setRangeError] = useState(false), [selected, setSelected] = useState<string | null>(null), [format, setFormat, setActionFormat] = useBrowsingFormat('list')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [point, setPoint] = useState<LocatedRow | null>(null), [candidate, setCandidate] = useState<PendingRow | null>(null), [pagingPaused, setPagingPaused] = useState(false)
  const [restoreScroll, setRestoreScroll] = useState<{ readonly top: number } | undefined>()
  const pending = useRef<PendingRow | null>(null), latest = useRef({ visibility, publication, pagingPaused, busy: false })
  const pointer = useRef(false), mounted = useRef(false), deferredReject = useRef<(() => void) | null>(null), pointerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scanSignal = useRef<{ readonly signal: AbortSignal; readonly replace: boolean } | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (pointerTimer.current !== undefined) clearTimeout(pointerTimer.current); deferredReject.current = null } }, [])
  latest.current = { ...latest.current, visibility, publication, pagingPaused }
  const page = useCollectionScan<RowCache<ListEntry>, ListReadResult & { readonly cursor: string | null }>({
    target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify(request), empty: emptyRowCache,
    append: (previous, value) => appendRows(previous, value.entries, row => row.index),
    load: async (cursor, signal) => {
      if (scanSignal.current?.signal !== signal) { if (scanSignal.current !== null && latest.current.publication?.active) epoch?.invalidate(); scanSignal.current = { signal, replace: cursor === null } }
      const response = await props.readList({ target: props.target, keyBase64: props.selected.base64, offset: cursor ?? request.offset, count: request.count }, signal)
      return response.ok ? { ...response, value: { ...response.value, cursor: response.value.nextOffset } } : response
    },
  })
  const { cache, result, busy, error, cursor, progress } = page
  latest.current.busy = busy
  const previousResult = useRef(result)
  useLayoutEffect(() => {
    if (previousResult.current !== result) {
      previousResult.current = result
      setPoint(current => current === null || scanSignal.current?.replace !== false || result?.state !== 'page' || result.entries.some(row => row.index === current.index) ? null : current)
    }
  }, [result])
  const located = candidate?.row ?? point
  const rows = located === null ? cache.rows : [located, ...cache.rows.filter(entry => entry.index !== located.index)]
  const row = point?.index === selected ? point : cache.rows.find(entry => entry.index === selected)
  const shown = candidate?.row ?? row
  useCurrentItem(row === undefined ? null : { kind: 'list', index: row.index })
  const window = useMemo(() => shown === undefined ? null : prefixWindow(shown.value), [shown])
  useLayoutEffect(() => {
    if (epoch === null || publication === null || visibility?.visible === false || visibility?.signal.aborted) return
    const handler: ListActionHandler = async (actionRequest, signal) => {
      const sameTarget = actionRequest.target !== null && actionRequest.target.id === props.target.id && actionRequest.target.generation === props.target.generation && actionRequest.target.db === props.target.db && actionRequest.action.keyBase64 === props.selected.base64
      if (!sameTarget || latest.current.busy || pending.current !== null || signal.aborted || Date.now() >= actionRequest.expiresAt || !epoch.current(actionRequest.selectionRevision) || document.visibilityState !== 'visible') return 'stale'
      let response: RemoteResult<ActionPointReadResult>
      try { response = await props.readActionPoint({ requestId: actionRequest.requestId }, signal) } catch { return signal.aborted ? 'stale' : 'failed' }
      if (signal.aborted || Date.now() >= actionRequest.expiresAt || !epoch.current(actionRequest.selectionRevision) || latest.current.visibility?.visible === false || latest.current.visibility?.signal.aborted || document.visibilityState !== 'visible') return 'stale'
      if (!response.ok || response.value.state !== 'value' || response.value.cell === null) return 'failed'
      return new Promise(resolve => {
        const action: PendingRow = { request: actionRequest, signal, row: { index: actionRequest.action.index, value: response.value.cell!, sampledAt: response.value.sampledAt }, previousPaused: latest.current.pagingPaused, resolve, resolved: false, userScrolled: false, pagingChanged: false, previousTop: null, abort: () => undefined, accepted: () => undefined, rejected: () => undefined }
        const retire = () => { signal.removeEventListener('abort', action.abort); if (pending.current === action) pending.current = null; latest.current.publication?.release(actionRequest.requestId) }
        action.rejected = () => {
          retire()
          const finish = () => { if (!action.pagingChanged) setPagingPaused(action.previousPaused); if (!action.userScrolled && action.previousTop !== null) setRestoreScroll({ top: action.previousTop }); setCandidate(current => current === action ? null : current) }
          // Keep the row under the pointer stable until its click has completed.
          if (pointer.current) { action.userScrolled = true; deferredReject.current = finish } else finish()
          if (!action.resolved) { action.resolved = true; resolve('stale') }
        }
        action.accepted = () => { retire(); setPoint(action.row); setSelected(action.row.index); setCandidate(current => current === action ? null : current) }
        action.abort = action.rejected
        pending.current = action; latest.current.publication?.hold(actionRequest.requestId); setRestoreScroll(undefined); setPagingPaused(true); setCandidate(action)
        signal.addEventListener('abort', action.abort, { once: true })
        if (signal.aborted) action.abort()
      })
    }
    const unregister = props.registerListHandler(handler)
    return () => { unregister(); pending.current?.abort() }
  }, [props.registerListHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
  function pointerInteraction(active: boolean): void {
    pointer.current = active
    if (active || !mounted.current || deferredReject.current === null) return
    pointerTimer.current = setTimeout(() => { pointerTimer.current = undefined; if (!pointer.current) { const finish = deferredReject.current; deferredReject.current = null; finish?.() } }, 0)
  }
  const columns: readonly CollectionColumn<ListEntry>[] = [
    { id: 'index', title: t('list.index'), render: entry => <span>{entry.index}{located?.index === entry.index && <small data-located-list-index title={`${t('hash.sampledAt')}: ${located.sampledAt} · ${t('list.positionWarning')}`}> · {t(candidate?.row.index === entry.index ? 'hash.locating' : 'list.located')} · <time dateTime={located.sampledAt}>{new Date(located.sampledAt).toLocaleString()}</time></small>}</span> },
    { id: 'value', title: t('hash.value'), render: entry => <span data-list-index={entry.index} title={cellLabel(entry.value)}>{entry.value.fullByteLength === 0 ? t('hash.emptyValue') : cellLabel(entry.value)}</span> },
  ]
  return <section className="redis-details redis-collection-workbench" aria-label={t('list.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('list.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} refresh={() => { void page.scan(false) }} cancel={page.cancel}><QueryToggle label={t('read.range')} open={optionsOpen} active={request.offset !== '0'} toggle={() => setOptionsOpen(!optionsOpen)} /></ReadActions></div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => {
      event.preventDefault()
      try { listReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); epoch?.userSelect(); setSelected(null); setPoint(null); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('list.start')}<input name="listOffset" required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="listCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {rangeError && <p role="alert" className="redis-error">{t('list.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('list.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'list.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    <div className="redis-collection-summary" data-list-coverage><ScanProgress t={t} busy={busy} progress={progress} /><span title={t('list.returned')}><b data-list-count>{cache.rows.length}</b>{request.offset === '0' ? ' / ' + (result?.metadata?.length ?? '—') : ' ' + t('read.items')}</span><span title={t('list.index')}>#<b data-list-start>{request.offset}</b>{cache.rows.length > 0 ? '–' + cache.rows[cache.rows.length - 1]!.index : ''}</span>{cursor !== null && !cache.limited && error === null && <button type="button" disabled={busy || candidate !== null} onClick={() => { epoch?.userSelect(); setPagingPaused(false); void page.scan(true) }}>{t('stream.more')}</button>}</div>
    <div className="redis-collection-body">
      <CollectionTable rows={rows} identity={entry => entry.index} columns={columns} label={t('list.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'list.empty')} selection={{ id: shown?.index ?? null, disabled: entry => candidate?.row.index === entry.index, onSelect: entry => { setPoint(current => current?.index === entry.index ? current : null); setSelected(entry.index) } }} reveal={candidate === null ? undefined : { id: candidate.row.index, remember: top => { candidate.previousTop ??= top }, ready: () => { if (pending.current !== candidate || candidate.resolved) return; if (candidate.signal.aborted || Date.now() >= candidate.request.expiresAt || !epoch?.current(candidate.request.selectionRevision) || document.visibilityState !== 'visible') { candidate.abort(); return } candidate.resolved = true; candidate.resolve({ kind: 'commitListIndex', accepted: candidate.accepted, rejected: candidate.rejected }) } }} restoreScroll={candidate === null ? restoreScroll : undefined} onPointerInteraction={pointerInteraction} onUserScroll={() => { const action = pending.current ?? candidate; if (action !== null) { action.userScrolled = true; action.pagingChanged = true } setPagingPaused(false) }} onEnd={pagingPaused || cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />
      <section className="redis-collection-preview" aria-label={t('hash.value')}>
        {shown !== undefined && window !== null ? <BytePreview key={shown.index} heading={{ label: t('hash.value'), description: `${t('list.index')} ${shown.index} · ${shown.value.byteLength}/${shown.value.fullByteLength} ${t('keys.bytes')}${window.complete ? '' : ' · ' + t('value.partial')}${located?.index === shown.index ? ' · ' + t('list.positionWarning') : ''}` }} value={window} t={t} format={format} onFormatChange={setFormat} onActionFormatChange={setActionFormat} actionTarget /> : <><strong>{t('hash.value')}</strong><p>{t(selected === null ? 'collection.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
    </div>
  </section>
}
