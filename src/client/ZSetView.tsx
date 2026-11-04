import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { KeyActionResult, ZSetActionHandler, ZSetActionRequest } from './ui-pane-presence.ts'

export interface ZSetActions { readonly readZSet: (request: ZSetReadRequest, signal: AbortSignal) => Promise<RemoteResult<ZSetReadResult>>; readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>; readonly registerZSetHandler: (handler: ZSetActionHandler) => () => void }
type Props = ZSetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type LocatedMember = ZSetEntry & { readonly sampledAt: string }
interface PendingMember { readonly request: ZSetActionRequest; readonly signal: AbortSignal; readonly row: LocatedMember; readonly previousPaused: boolean; readonly previousGuard: boolean; readonly resolve: (result: KeyActionResult) => void; resolved: boolean; userScrolled: boolean; userInteracted: boolean; previousTop: number | null; abort: () => void; accepted: () => void; rejected: () => void }

/** Each mode owns its pagination. A ZSCAN token is never a rank offset. */
export function ZSetView(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility), publication = useSelectionAction()
  const [mode, setMode] = useState<'range' | 'scan'>('range'), [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [range, setRange] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 }), [pattern, setPattern] = useState('*')
  const [draft, setDraft] = useState('*')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('zset'), [rangeError, setRangeError] = useState(false)
  const [point, setPoint] = useState<LocatedMember | null>(null), [candidate, setCandidate] = useState<PendingMember | null>(null)
  const [pagingPaused, setPagingPaused] = useState(false), [pagingGuard, setPagingGuard] = useState(false)
  const [restoreScroll, setRestoreScroll] = useState<{ readonly top: number } | undefined>()
  const pending = useRef<PendingMember | null>(null), latest = useRef({ visibility, publication, pagingPaused, pagingGuard, busy: false })
  const pointer = useRef(false), mounted = useRef(false), deferredReject = useRef<{ readonly action: PendingMember; readonly finish: () => void } | null>(null), pointerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (pointerTimer.current !== undefined) clearTimeout(pointerTimer.current); deferredReject.current = null } }, [])
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
      const sameTarget = request.target !== null && request.target.id === props.target.id && request.target.generation === props.target.generation && request.target.db === props.target.db && request.action.keyBase64 === props.selected.base64
      if (!sameTarget || latest.current.busy || pending.current !== null || signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || document.visibilityState !== 'visible') return 'stale'
      let response: RemoteResult<ActionPointReadResult>
      try { response = await props.readActionPoint({ requestId: request.requestId }, signal) } catch { return signal.aborted ? 'stale' : 'failed' }
      if (signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || latest.current.visibility?.visible === false || latest.current.visibility?.signal.aborted || document.visibilityState !== 'visible') return 'stale'
      if (!response.ok || response.value.state !== 'value' || response.value.score === null) return 'failed'
      return new Promise(resolve => {
        const action: PendingMember = { request, signal, row: { member: request.action.member, score: response.value.score as string, rank: null, sampledAt: response.value.sampledAt }, previousPaused: latest.current.pagingPaused, previousGuard: latest.current.pagingGuard, resolve, resolved: false, userScrolled: false, userInteracted: false, previousTop: null, abort: () => undefined, accepted: () => undefined, rejected: () => undefined }
        const retire = () => { signal.removeEventListener('abort', action.abort); if (pending.current === action) pending.current = null; latest.current.publication?.release(request.requestId) }
        action.rejected = () => {
          retire()
          const finish = () => { if (!action.userScrolled) { setPagingPaused(action.previousPaused); setPagingGuard(action.previousGuard) } if (!action.userScrolled && !action.userInteracted && action.previousTop !== null) setRestoreScroll({ top: action.previousTop }); setCandidate(current => current === action ? null : current) }
          if (pointer.current) { action.userInteracted = true; deferredReject.current = { action, finish } } else finish()
          if (!action.resolved) { action.resolved = true; resolve('stale') }
        }
        action.accepted = () => { retire(); setPoint(action.row); setSelected(action.row.member.base64); setCandidate(current => current === action ? null : current) }
        action.abort = action.rejected
        pending.current = action; latest.current.publication?.hold(request.requestId); setRestoreScroll(undefined); setPagingPaused(true); setPagingGuard(true); setCandidate(action)
        signal.addEventListener('abort', action.abort, { once: true })
        if (signal.aborted) action.abort()
      })
    }
    const unregister = props.registerZSetHandler(handler)
    return () => { unregister(); pending.current?.abort() }
  }, [props.registerZSetHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
  function pointerInteraction(active: boolean): void {
    pointer.current = active
    if (active || !mounted.current || deferredReject.current === null) return
    pointerTimer.current = setTimeout(() => { pointerTimer.current = undefined; if (!pointer.current) { const deferred = deferredReject.current; deferredReject.current = null; deferred?.finish() } }, 0)
  }
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
      <CollectionTable rows={rows} identity={entry => entry.member.base64} columns={columns} label={t('zset.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'zset.empty')} selection={{ id: shown?.member.base64 ?? null, disabled: entry => candidate?.row.member.base64 === entry.member.base64, onSelect: entry => { setPoint(current => current?.member.base64 === entry.member.base64 ? current : null); setSelected(entry.member.base64) } }} reveal={candidate === null ? undefined : { id: candidate.row.member.base64, remember: top => { candidate.previousTop ??= top }, ready: () => { if (pending.current !== candidate || candidate.resolved) return; if (candidate.signal.aborted || Date.now() >= candidate.request.expiresAt || !epoch?.current(candidate.request.selectionRevision) || document.visibilityState !== 'visible') { candidate.abort(); return } candidate.resolved = true; candidate.resolve({ kind: 'commitZSetMember', accepted: candidate.accepted, rejected: candidate.rejected }) } }} restoreScroll={candidate === null ? restoreScroll : undefined} onPointerInteraction={pointerInteraction} onUserScroll={() => { const action = pending.current ?? deferredReject.current?.action; if (action !== undefined && action !== null) action.userScrolled = true; setPagingGuard(false); setPagingPaused(false) }} onEnd={pagingPaused || pagingGuard || cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      {pagingGuard && cursor !== null && !cache.limited && error === null && <button type="button" disabled={busy || candidate !== null} onClick={() => { epoch?.userSelect(); setPagingPaused(false); setPagingGuard(false); void scanState.scan(true) }}>{t('keys.more')}</button>}
      <section className="redis-collection-preview" aria-label={t('set.member')}>
        {shown !== undefined && window !== null ? <BytePreview key={shown.member.base64} heading={{ label: t('set.member'), description: `${shown.member.byteLength} ${t('keys.bytes')} · ${t('zset.score')}: ${shown.score}` }} value={window} t={t} format={format} onFormatChange={setFormat} /> : <><strong>{t('set.member')}</strong><p>{t(selected === null ? 'collection.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
    </div>
  </section>
}
