import { useCollectionScan } from './use-collection-scan.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { readCollectionPoint, useCollectionPoint, type CollectionPoint } from './collection-point.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { ListActionHandler, ListActionRequest } from './ui-pane-presence.ts'

export interface ListActions { readonly readList: (request: ListReadRequest, signal: AbortSignal) => Promise<RemoteResult<ListReadResult>>; readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>; readonly registerListHandler: (handler: ListActionHandler) => () => void }
type Props = ListActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type LocatedRow = ListEntry & { readonly sampledAt: string }
interface PendingRowData { readonly request: ListActionRequest; readonly signal: AbortSignal; readonly row: LocatedRow; readonly previousPaused: boolean; pagingChanged: boolean; previousTop: number | null }
type PendingRow = PendingRowData & CollectionPoint

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
  const locate = useCollectionPoint<PendingRowData>()
  const latest = useRef({ visibility, publication, pagingPaused, busy: false })
  const scanSignal = useRef<{ readonly signal: AbortSignal; readonly replace: boolean } | null>(null)
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
      if (latest.current.busy || locate.current() !== null) return 'stale'
      const response = await readCollectionPoint(actionRequest, signal, epoch, props.target, props.selected.base64, props.readActionPoint,
        () => latest.current.visibility?.visible !== false && latest.current.visibility?.signal.aborted !== true)
      if (typeof response === 'string') return response
      if (response.cell === null) return 'failed'
      const clearCandidate = (action: PendingRow) => setCandidate(current => current === action ? null : current)
      return locate.begin({ request: actionRequest, signal, row: { index: actionRequest.action.index, value: response.cell, sampledAt: response.sampledAt }, previousPaused: latest.current.pagingPaused, pagingChanged: false, previousTop: null }, publication,
        action => { setRestoreScroll(undefined); setPagingPaused(true); setCandidate(action) },
        action => { setPoint(action.row); setSelected(action.row.index); clearCandidate(action) },
        action => {
          if (!action.pagingChanged) setPagingPaused(action.previousPaused)
          if (!action.userScrolled && !action.userInteracted && action.previousTop !== null) setRestoreScroll({ top: action.previousTop })
          clearCandidate(action)
        })
    }
    const unregister = props.registerListHandler(handler)
    return () => { unregister(); locate.abort() }
  }, [props.registerListHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
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
      <CollectionTable rows={rows} identity={entry => entry.index} columns={columns} label={t('list.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'list.empty')} selection={{ id: shown?.index ?? null, disabled: entry => candidate?.row.index === entry.index, onSelect: entry => { setPoint(current => current?.index === entry.index ? current : null); setSelected(entry.index) } }} reveal={candidate === null ? undefined : { id: candidate.row.index, remember: top => { candidate.previousTop ??= top }, ready: () => locate.reveal(candidate, 'commitListIndex', epoch) }} restoreScroll={candidate === null ? restoreScroll : undefined} onPointerInteraction={locate.pointerInteraction} onUserScroll={() => { const action = locate.current(); if (action !== null) { action.userScrolled = true; action.pagingChanged = true } setPagingPaused(false) }} onEnd={pagingPaused || cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />
      <section className="redis-collection-preview" aria-label={t('hash.value')}>
        {shown !== undefined && window !== null ? <BytePreview key={shown.index} heading={{ label: t('hash.value'), description: `${t('list.index')} ${shown.index} · ${shown.value.byteLength}/${shown.value.fullByteLength} ${t('keys.bytes')}${window.complete ? '' : ' · ' + t('value.partial')}${located?.index === shown.index ? ' · ' + t('list.positionWarning') : ''}` }} value={window} t={t} format={format} onFormatChange={setFormat} onActionFormatChange={setActionFormat} actionTarget /> : <><strong>{t('hash.value')}</strong><p>{t(selected === null ? 'collection.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
    </div>
  </section>
}
