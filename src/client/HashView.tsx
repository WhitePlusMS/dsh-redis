import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ActionPointReadRequest, ActionPointReadResult, DatabaseTarget, HashEntry, PreviewFormat, RedisKey, ScanHashRequest, ScanHashResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendHashEntries, emptyHashCache, type HashCache } from './hash-cache.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { prefixWindow, cellLabel, displayLabel } from './collection-value.ts'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCollectionScan } from './use-collection-scan.ts'
import { previewValue } from './value-preview.ts'
import { Icon } from './Icon.tsx'
import { useCurrentItem, useSelectionAction } from './CurrentSelection.tsx'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import { readCollectionPoint, useCollectionPoint, type CollectionPoint } from './collection-point.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { HashActionHandler, HashActionRequest } from './ui-pane-presence.ts'

export interface HashActions {
  readonly scanHash: (request: ScanHashRequest, signal: AbortSignal) => Promise<RemoteResult<ScanHashResult>>
  readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>
  readonly registerHashHandler: (handler: HashActionHandler) => () => void
}
type Props = HashActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type LocatedField = HashEntry & { readonly sampledAt: string }
interface PendingFieldData { readonly request: HashActionRequest; readonly signal: AbortSignal; readonly row: LocatedField; readonly previousPaused: boolean; readonly previousGuard: boolean; previousTop: number | null }
type PendingField = PendingFieldData & CollectionPoint

const fieldWindow = (row: HashEntry) => ({ base64: row.field.base64, prefix: '', suffix: '', offset: '0', complete: true })

/** RESP-style row selection changes only local previews. The shared reader owns
 * cancellation, raw field identities and one continuation per visible table end.
 */
export function HashView(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility), publication = useSelectionAction()
  const [pattern, setPattern] = useState('*')
  const [draft, setDraft] = useState('*'), [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState(''), [selectedField, setSelectedField] = useState<string | null>(null)
  const [point, setPoint] = useState<LocatedField | null>(null), [candidate, setCandidate] = useState<PendingField | null>(null), [pagingPaused, setPagingPaused] = useState(false)
  const [pagingGuard, setPagingGuard] = useState(false)
  const [restoreScroll, setRestoreScroll] = useState<{ readonly top: number } | undefined>()
  const locate = useCollectionPoint<PendingFieldData>()
  const latest = useRef({ visibility, publication, pagingPaused, pagingGuard, busy: false })
  latest.current = { ...latest.current, visibility, publication, pagingPaused, pagingGuard }
  const scanSignal = useRef<{ readonly signal: AbortSignal; readonly replace: boolean } | null>(null)
  const [fieldFormat, setFieldFormat] = useState<PreviewFormat>('text')
  const [format, setFormat, setActionFormat] = useBrowsingFormat('hash')
  const scanState = useCollectionScan<HashCache, ScanHashResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: pattern, empty: emptyHashCache,
    append: (previous, page) => appendHashEntries(previous, page.entries),
    load: (cursor, signal) => {
      if (scanSignal.current?.signal !== signal) { if (scanSignal.current !== null && latest.current.publication?.active) epoch?.invalidate(); scanSignal.current = { signal, replace: cursor === null } }
      return props.scanHash({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal)
    },
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  latest.current.busy = busy
  const previousResult = useRef(result)
  useLayoutEffect(() => {
    if (previousResult.current !== result) {
      previousResult.current = result
      // A replacement discards the old sample; an appended page only replaces a field it actually contains.
      setPoint(current => current === null || scanSignal.current?.replace !== false || result?.state !== 'page' || result.entries.some(row => row.field.base64 === current.field.base64) ? null : current)
    }
  }, [result])
  // Search only cached bytes, including values beyond the abbreviated table label.
  // While searching locally, the bottom observer must not start more Redis reads.
  function matches(row: HashEntry, query: string): boolean {
    const needle = query.trim().toLocaleLowerCase()
    if (needle === '') return true
    const field = previewValue(fieldWindow(row), 'text'), value = previewValue(prefixWindow(row.value), 'text')
    return [field.error === null ? field.text : row.field.base64, value.error === null ? value.text : row.value.base64].some(text => text.toLocaleLowerCase().includes(needle))
  }
  const filtered = useMemo(() => cache.rows.filter(row => matches(row, search)), [cache.rows, search])
  const located = candidate?.row ?? point
  const rows = located === null ? filtered : [located, ...filtered.filter(row => row.field.base64 !== located.field.base64)]
  const selected = point?.field.base64 === selectedField ? point : filtered.find(row => row.field.base64 === selectedField)
  const shown = candidate?.row ?? selected
  useCurrentItem(selected === undefined ? null : { kind: 'hash', fieldBase64: selected.field.base64 })
  const windows = useMemo(() => shown === undefined ? null : { field: fieldWindow(shown), value: prefixWindow(shown.value) }, [shown])
  useLayoutEffect(() => {
    if (epoch === null || publication === null || visibility?.visible === false || visibility?.signal.aborted) return
    const handler: HashActionHandler = async (request, signal) => {
      if (latest.current.busy || locate.current() !== null) return 'stale'
      const response = await readCollectionPoint(request, signal, epoch, props.target, props.selected.base64, props.readActionPoint,
        () => latest.current.visibility?.visible !== false && latest.current.visibility?.signal.aborted !== true)
      if (typeof response === 'string') return response
      if (response.cell === null) return 'failed'
      const clearCandidate = (action: PendingField) => setCandidate(current => current === action ? null : current)
      return locate.begin({ request, signal, row: { field: request.action.field, value: response.cell, sampledAt: response.sampledAt }, previousPaused: latest.current.pagingPaused, previousGuard: latest.current.pagingGuard, previousTop: null }, publication,
        action => { setRestoreScroll(undefined); setPagingPaused(true); setPagingGuard(true); setCandidate(action) },
        action => { setPoint(action.row); setSelectedField(action.row.field.base64); clearCandidate(action) },
        action => {
          if (!action.userScrolled) { setPagingPaused(action.previousPaused); setPagingGuard(action.previousGuard) }
          if (!action.userScrolled && !action.userInteracted && action.previousTop !== null) setRestoreScroll({ top: action.previousTop })
          clearCandidate(action)
        })
    }
    const unregister = props.registerHashHandler(handler)
    return () => { unregister(); locate.abort() }
  }, [props.registerHashHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
  function refresh(): void { void scanState.scan(false) }
  function applyPattern(value: string): void {
    epoch?.userSelect()
    setSelectedField(null); setPoint(null); setSearch(''); setFilterOpen(false)
    if (value === pattern) refresh()
    else setPattern(value)
  }
  function changeSearch(value: string): void {
    if (value !== search) epoch?.userSelect()
    setSearch(value)
  }
  const columns: readonly CollectionColumn<HashEntry>[] = [
    { id: 'number', title: '#', render: (_row, index) => index + 1 },
    { id: 'field', title: t('hash.field'), render: row => <span data-hash-field={row.field.base64} title={displayLabel(row.field.label)}>{row.field.byteLength === 0 ? t('hash.emptyField') : displayLabel(row.field.label)}{located?.field.base64 === row.field.base64 && <small data-located-hash-field title={`${t('hash.sampledAt')}: ${located.sampledAt}`}> · {t(candidate?.row.field.base64 === row.field.base64 ? 'hash.locating' : 'hash.located')} · <time dateTime={located.sampledAt}>{new Date(located.sampledAt).toLocaleString()}</time></small>}</span> },
    { id: 'value', title: t('hash.value'), render: row => <span data-hash-value={row.field.base64} title={cellLabel(row.value)}>{row.value.fullByteLength === 0 ? t('hash.emptyValue') : cellLabel(row.value)}</span> },
  ]
  const searching = search.trim() !== ''
  const empty = t(busy ? 'connection.busy' : error !== null ? 'hash.noRead' : searching ? 'hash.noMatches' : 'hash.empty')
  return <section className="redis-details redis-hash-workbench" aria-label={t('hash.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('hash.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-hash-controls">
      <input name="hashSearch" maxLength={256} aria-label={t('hash.search')} placeholder={t('hash.search')} value={search} spellCheck={false} onChange={event => changeSearch(event.target.value)} />
      {search !== '' && <button type="button" className="redis-icon-button" title={t('hash.clearSearch')} aria-label={t('hash.clearSearch')} onClick={() => changeSearch('')}><Icon name="close" /></button>}
      <ReadActions t={t} busy={busy} refresh={refresh} cancel={scanState.cancel} label={t('hash.refresh')}><QueryToggle icon="filter" label={t('hash.filter')} open={filterOpen} active={pattern !== '*'} toggle={() => setFilterOpen(!filterOpen)} /></ReadActions>
    </div>
    {filterOpen && <form className="redis-hash-filter" onSubmit={event => { event.preventDefault(); applyPattern(draft) }}>
      <label>{t('hash.pattern')}<input name="hashPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
      <div className="redis-actions"><button type="submit" disabled={busy}>{t('workbench.apply')}</button><button type="button" disabled={busy} onClick={() => { setDraft('*'); applyPattern('*') }}>{t('hash.resetFilter')}</button></div>
    </form>}
    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('hash.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'hash.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    <div className="redis-hash-summary"><ScanProgress t={t} busy={busy} progress={progress} /><span title={`${t('hash.loaded')}: ${cache.rows.length} · ${t('hash.total')}: ${result?.metadata?.length ?? t('workbench.unknown')}`}><b data-loaded-fields>{cache.rows.length}</b>{pattern === '*' ? ' / ' : ' · ' + t('hash.total') + ' '}{result?.metadata?.length ?? '—'}</span>{searching && <span className="redis-chip" title={t('hash.localSearch')}>{t('read.local')} {filtered.length}</span>}{pattern !== '*' && <span className="redis-filter-chip"><button type="button" title={t('hash.pattern')} onClick={() => setFilterOpen(true)}><Icon name="filter" /><span>{pattern}</span></button><button type="button" className="redis-icon-button" title={t('read.clearFilter')} aria-label={t('read.clearFilter')} onClick={() => { setDraft('*'); applyPattern('*') }}><Icon name="close" /></button></span>}</div>
    <div className="redis-hash-body">
      <CollectionTable rows={rows} identity={row => row.field.base64} columns={columns} label={t('hash.title')} loading={busy} emptyMessage={empty} selection={{ id: shown?.field.base64 ?? null, disabled: row => candidate?.row.field.base64 === row.field.base64, onSelect: row => { setPoint(current => current?.field.base64 === row.field.base64 ? current : null); setSelectedField(row.field.base64) } }} reveal={candidate === null ? undefined : { id: candidate.row.field.base64, remember: top => { candidate.previousTop ??= top }, ready: () => locate.reveal(candidate, 'commitHashField', epoch) }} restoreScroll={candidate === null ? restoreScroll : undefined} onPointerInteraction={locate.pointerInteraction} onUserScroll={() => { const action = locate.current(); if (action !== null) action.userScrolled = true; setPagingGuard(false); setPagingPaused(false) }} onEnd={pagingPaused || pagingGuard || searching || cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      {pagingGuard && cursor !== null && !cache.limited && error === null && <button type="button" disabled={busy || candidate !== null} onClick={() => { epoch?.userSelect(); setPagingPaused(false); setPagingGuard(false); void scanState.scan(true) }}>{t('keys.more')}</button>}
      <section className="redis-hash-preview redis-hash-field" aria-label={t('hash.field')}>
        {windows !== null && shown !== undefined ? <BytePreview key={shown.field.base64} heading={{ label: t('hash.field'), description: `${shown.field.byteLength} ${t('keys.bytes')}` }} value={windows.field} t={t} format={fieldFormat} onFormatChange={setFieldFormat} /> : <><strong>{t('hash.field')}</strong><p>{t(selectedField === null ? 'hash.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
      <section className="redis-hash-preview redis-hash-value" aria-label={t('hash.value')}>
        {windows !== null && shown !== undefined ? <BytePreview key={shown.field.base64} heading={{ label: t('hash.value'), description: windows.value.complete ? `${shown.value.fullByteLength} ${t('keys.bytes')}` : `${shown.value.byteLength}/${shown.value.fullByteLength} ${t('keys.bytes')} · ${t('value.partial')}` }} value={windows.value} t={t} format={format} onFormatChange={setFormat} onActionFormatChange={setActionFormat} actionTarget /> : <strong>{t('hash.value')}</strong>}
      </section>
    </div>
  </section>
}
