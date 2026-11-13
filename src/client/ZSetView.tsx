import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_LIST_ITEMS, type ActionPointReadRequest, type ActionPointReadResult, type DatabaseTarget, type RedisKey, type ZSetEntry, type ZSetReadRequest, type ZSetReadResult } from '../domain.ts'
import { zsetReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { displayLabel } from './collection-value.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { appendZSetRows, emptyZSetCache, type ZSetCache } from './zset-cache.ts'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCurrentItem, useSelectionAction } from './CurrentSelection.tsx'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import { readCollectionPoint, useCollectionPoint, type CollectionPoint } from './collection-point.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { ZSetActionHandler, ZSetActionRequest } from './ui-pane-presence.ts'

export interface ZSetActions { readonly readZSet: (request: ZSetReadRequest, signal: AbortSignal) => Promise<RemoteResult<ZSetReadResult>>; readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>; readonly registerZSetHandler: (handler: ZSetActionHandler) => () => void }
type Props = ZSetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type LocatedMember = ZSetEntry & { readonly sampledAt: string }
interface PendingMemberData { readonly request: ZSetActionRequest; readonly signal: AbortSignal; readonly row: LocatedMember; readonly previousPaused: boolean; readonly previousGuard: boolean; previousTop: number | null }
type PendingMember = PendingMemberData & CollectionPoint

/** Each mode owns its pagination. A ZSCAN token is never a rank offset. */
export function ZSetView(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility), publication = useSelectionAction()
  const [mode, setMode] = useState<'range' | 'scan'>('range'), [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [range, setRange] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 }), [pattern, setPattern] = useState('*')
  const [draft, setDraft] = useState('*')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [format, setFormat, setActionFormat] = useBrowsingFormat('zset'), [rangeError, setRangeError] = useState(false)
  const [point, setPoint] = useState<LocatedMember | null>(null), [candidate, setCandidate] = useState<PendingMember | null>(null)
  const [pagingPaused, setPagingPaused] = useState(false), [pagingGuard, setPagingGuard] = useState(false)
  const [restoreScroll, setRestoreScroll] = useState<{ readonly top: number } | undefined>()
  const locate = useCollectionPoint<PendingMemberData>()
  const latest = useRef({ visibility, publication, pagingPaused, pagingGuard, busy: false })
  latest.current = { ...latest.current, visibility, publication, pagingPaused, pagingGuard }
  const scanSignal = useRef<{ readonly signal: AbortSignal; readonly replace: boolean } | null>(null)
  const scanState = useCollectionScan<ZSetCache, ZSetReadResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify([mode, range, pattern]), empty: emptyZSetCache,
    append: (previous, page) => appendZSetRows(previous, page.entries),
    load: async (cursor, signal) => {
      if (scanSignal.current?.signal !== signal) { if (scanSignal.current !== null && latest.current.publication?.active) epoch?.invalidate(); scanSignal.current = { signal, replace: cursor === null } }
      const response = await props.readZSet(mode === 'range' ? { target: props.target, keyBase64: props.selected.base64, mode, offset: cursor ?? range.offset, count: range.count } : { target: props.target, keyBase64: props.selected.base64, mode, pattern, cursor }, signal)
      // Rank offsets remain local; only SCAN cursors are sent to the SCAN endpoint.
      return response.ok && response.value.mode === 'range' ? { ...response, value: { ...response.value, cursor: response.value.nextOffset } } : response
    },
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  latest.current.busy = busy
  const previousResult = useRef(result)
  useLayoutEffect(() => {
    if (previousResult.current !== result) {
      previousResult.current = result
      setPoint(current => current === null || scanSignal.current?.replace !== false || result?.state !== 'page' || result.entries.some(entry => entry.member.base64 === current.member.base64) ? null : current)
    }
  }, [result])
  const located = candidate?.row ?? point
  const rows = located === null ? cache.rows : [located, ...cache.rows.filter(entry => entry.member.base64 !== located.member.base64)]
  const row = point?.member.base64 === selected ? point : cache.rows.find(entry => entry.member.base64 === selected)
  const shown = candidate?.row ?? row
  useCurrentItem(row === undefined ? null : { kind: 'zset', memberBase64: row.member.base64 })
  const window = useMemo(() => shown === undefined ? null : { base64: shown.member.base64, offset: '0', prefix: '', suffix: '', complete: true }, [shown])
  useLayoutEffect(() => {
    if (epoch === null || publication === null || visibility?.visible === false || visibility?.signal.aborted) return
    const handler: ZSetActionHandler = async (request, signal) => {
      if (latest.current.busy || locate.current() !== null) return 'stale'
      const response = await readCollectionPoint(request, signal, epoch, props.target, props.selected.base64, props.readActionPoint,
        () => latest.current.visibility?.visible !== false && latest.current.visibility?.signal.aborted !== true)
      if (typeof response === 'string') return response
      if (response.score === null) return 'failed'
      const clearCandidate = (action: PendingMember) => setCandidate(current => current === action ? null : current)
      return locate.begin({ request, signal, row: { member: request.action.member, score: response.score, rank: null, sampledAt: response.sampledAt }, previousPaused: latest.current.pagingPaused, previousGuard: latest.current.pagingGuard, previousTop: null }, publication,
        action => { setRestoreScroll(undefined); setPagingPaused(true); setPagingGuard(true); setCandidate(action) },
        action => { setPoint(action.row); setSelected(action.row.member.base64); clearCandidate(action) },
        action => {
          if (!action.userScrolled) { setPagingPaused(action.previousPaused); setPagingGuard(action.previousGuard) }
          if (!action.userScrolled && !action.userInteracted && action.previousTop !== null) setRestoreScroll({ top: action.previousTop })
          clearCandidate(action)
        })
    }
    const unregister = props.registerZSetHandler(handler)
    return () => { unregister(); locate.abort() }
  }, [props.registerZSetHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
  function clearPoint(): void { epoch?.userSelect(); setSelected(null); setPoint(null); setPagingPaused(false); setPagingGuard(false) }
  const columns: readonly CollectionColumn<ZSetEntry>[] = [
    ...(mode === 'range' ? [{ id: 'rank', title: t('zset.rank'), render: (entry: ZSetEntry) => entry.rank }] : []),
    { id: 'member', title: t('set.member'), render: entry => <span data-zset-member={entry.member.base64} title={displayLabel(entry.member.label)}>{entry.member.byteLength === 0 ? t('collection.emptyMember') : displayLabel(entry.member.label)}{located?.member.base64 === entry.member.base64 && <small data-located-zset-member title={`${t('hash.sampledAt')}: ${located.sampledAt}`}> · {t(candidate?.row.member.base64 === entry.member.base64 ? 'hash.locating' : 'hash.located')} · <time dateTime={located.sampledAt}>{new Date(located.sampledAt).toLocaleString()}</time></small>}</span> },
    { id: 'score', title: t('zset.score'), render: entry => <span data-zset-score={entry.member.base64}>{entry.score}</span> },
  ]
  return <section className="redis-details redis-collection-workbench" aria-label={t('zset.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('zset.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><label><span className="redis-sr-only">{t('zset.mode')}</span><select name="zsetMode" title={t('zset.mode')} value={mode} onChange={event => { clearPoint(); setRangeError(false); setMode(event.target.value === 'scan' ? 'scan' : 'range') }}><option value="range">{t('zset.range')}</option><option value="scan">{t('zset.scan')}</option></select></label><ReadActions t={t} busy={busy} refresh={() => { void scanState.scan(false) }} cancel={scanState.cancel}><QueryToggle icon={mode === 'scan' ? 'filter' : 'range'} label={t('read.range')} open={optionsOpen} active={mode === 'scan' ? pattern !== '*' : range.offset !== '0'} toggle={() => setOptionsOpen(!optionsOpen)} /></ReadActions></div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => {
      event.preventDefault()
      if (mode === 'scan') { clearPoint(); setOptionsOpen(false); if (draft === pattern) void scanState.scan(false); else setPattern(draft); return }
      try { zsetReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, mode, offset, count }); clearPoint(); setRangeError(false); setRange({ offset, count, attempt: range.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      {mode === 'range' ? <div className="redis-address">
        <label>{t('zset.start')}<input name="zsetOffset" required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="zsetCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div> : <label>{t('set.pattern')}<input name="zsetPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>}
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}
    {rangeError && <p role="alert" className="redis-error">{t('zset.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('zset.total')}</dt><dd>{result.metadata.length}</dd></dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'zset.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    <div className="redis-collection-summary"><ScanProgress t={t} busy={busy} progress={progress} /><span title={`${t('zset.loaded')} · ${t('zset.total')}`}><b data-loaded-zset>{cache.rows.length}</b>{mode === 'range' && range.offset === '0' ? ' / ' : ' · ' + t('zset.total') + ' '}{result?.metadata?.length ?? '—'}</span>{mode === 'range' && <span title={t('zset.start')}>#<b data-zset-start>{range.offset}</b></span>}{mode === 'scan' && pattern !== '*' && <button type="button" className="redis-chip" title={t('set.pattern')} onClick={() => setOptionsOpen(true)}>{pattern}</button>}</div>
    <div className="redis-collection-body">
      <CollectionTable rows={rows} identity={entry => entry.member.base64} columns={columns} label={t('zset.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'zset.empty')} selection={{ id: shown?.member.base64 ?? null, disabled: entry => candidate?.row.member.base64 === entry.member.base64, onSelect: entry => { setPoint(current => current?.member.base64 === entry.member.base64 ? current : null); setSelected(entry.member.base64) } }} reveal={candidate === null ? undefined : { id: candidate.row.member.base64, remember: top => { candidate.previousTop ??= top }, ready: () => locate.reveal(candidate, 'commitZSetMember', epoch) }} restoreScroll={candidate === null ? restoreScroll : undefined} onPointerInteraction={locate.pointerInteraction} onUserScroll={() => { const action = locate.current(); if (action !== null) action.userScrolled = true; setPagingGuard(false); setPagingPaused(false) }} onEnd={pagingPaused || pagingGuard || cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      {pagingGuard && cursor !== null && !cache.limited && error === null && <button type="button" disabled={busy || candidate !== null} onClick={() => { epoch?.userSelect(); setPagingPaused(false); setPagingGuard(false); void scanState.scan(true) }}>{t('keys.more')}</button>}
      <section className="redis-collection-preview" aria-label={t('set.member')}>
        {shown !== undefined && window !== null ? <BytePreview key={shown.member.base64} heading={{ label: t('set.member'), description: `${shown.member.byteLength} ${t('keys.bytes')} · ${t('zset.score')}: ${shown.score}` }} value={window} t={t} format={format} onFormatChange={setFormat} onActionFormatChange={setActionFormat} actionTarget /> : <><strong>{t('set.member')}</strong><p>{t(selected === null ? 'collection.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
    </div>
  </section>
}
