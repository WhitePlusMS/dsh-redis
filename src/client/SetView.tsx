import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ActionPointReadRequest, ActionPointReadResult, DatabaseTarget, RedisKey, ScanSetRequest, ScanSetResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendKeys, emptyKeyCache, type KeyCache } from './key-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { displayLabel } from './collection-value.ts'
import { NS } from './locales.ts'
import { Icon } from './Icon.tsx'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCurrentItem, useSelectionAction } from './CurrentSelection.tsx'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { KeyActionResult, SetActionHandler, SetActionRequest } from './ui-pane-presence.ts'

export interface SetActions {
  readonly scanSet: (request: ScanSetRequest, signal: AbortSignal) => Promise<RemoteResult<ScanSetResult>>
  readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>
  readonly registerSetHandler: (handler: SetActionHandler) => () => void
}
type Props = SetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type LocatedMember = RedisKey & { readonly sampledAt: string }
interface PendingMember { readonly request: SetActionRequest; readonly signal: AbortSignal; readonly row: LocatedMember; readonly previousPaused: boolean; readonly previousGuard: boolean; readonly resolve: (result: KeyActionResult) => void; resolved: boolean; userScrolled: boolean; userInteracted: boolean; previousTop: number | null; abort: () => void; accepted: () => void; rejected: () => void }

/** Set members share complete byte identities and the existing bounded identity cache. */
export function SetView(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility), publication = useSelectionAction()
  const [pattern, setPattern] = useState('*'), [selected, setSelected] = useState<string | null>(null), [format, setFormat, setActionFormat] = useBrowsingFormat('set')
  const [draft, setDraft] = useState('*')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [point, setPoint] = useState<LocatedMember | null>(null), [candidate, setCandidate] = useState<PendingMember | null>(null)
  const [pagingPaused, setPagingPaused] = useState(false), [pagingGuard, setPagingGuard] = useState(false)
  const [restoreScroll, setRestoreScroll] = useState<{ readonly top: number } | undefined>()
  const pending = useRef<PendingMember | null>(null), latest = useRef({ visibility, publication, pagingPaused, pagingGuard, busy: false })
  const pointer = useRef(false), mounted = useRef(false), deferredReject = useRef<{ readonly action: PendingMember; readonly finish: () => void } | null>(null), pointerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (pointerTimer.current !== undefined) clearTimeout(pointerTimer.current); deferredReject.current = null } }, [])
  latest.current = { ...latest.current, visibility, publication, pagingPaused, pagingGuard }
  const scanSignal = useRef<{ readonly signal: AbortSignal; readonly replace: boolean } | null>(null)
  const scanState = useCollectionScan<KeyCache, ScanSetResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: pattern, empty: emptyKeyCache,
    append: (previous, page) => appendKeys(previous, page.members),
    load: (cursor, signal) => {
      if (scanSignal.current?.signal !== signal) { if (scanSignal.current !== null && latest.current.publication?.active) epoch?.invalidate(); scanSignal.current = { signal, replace: cursor === null } }
      return props.scanSet({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal)
    },
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  latest.current.busy = busy
  const previousResult = useRef(result)
  useLayoutEffect(() => {
    if (previousResult.current !== result) {
      previousResult.current = result
      // A replacement invalidates the point sample; an appended matching page supersedes it.
      setPoint(current => current === null || scanSignal.current?.replace !== false || result?.state !== 'page' || result.members.some(row => row.base64 === current.base64) ? null : current)
    }
  }, [result])
  const located = candidate?.row ?? point
  const rows = located === null ? cache.keys : [located, ...cache.keys.filter(value => value.base64 !== located.base64)]
  const member = point?.base64 === selected ? point : cache.keys.find(value => value.base64 === selected)
  const shown = candidate?.row ?? member
  useCurrentItem(member === undefined ? null : { kind: 'set', memberBase64: member.base64 })
  const window = useMemo(() => shown === undefined ? null : { base64: shown.base64, offset: '0', prefix: '', suffix: '', complete: true }, [shown])
  useLayoutEffect(() => {
    if (epoch === null || publication === null || visibility?.visible === false || visibility?.signal.aborted) return
    const handler: SetActionHandler = async (request, signal) => {
      const sameTarget = request.target !== null && request.target.id === props.target.id && request.target.generation === props.target.generation && request.target.db === props.target.db && request.action.keyBase64 === props.selected.base64
      if (!sameTarget || latest.current.busy || pending.current !== null || signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || document.visibilityState !== 'visible') return 'stale'
      let response: RemoteResult<ActionPointReadResult>
      try { response = await props.readActionPoint({ requestId: request.requestId }, signal) } catch { return signal.aborted ? 'stale' : 'failed' }
      if (signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || latest.current.visibility?.visible === false || latest.current.visibility?.signal.aborted || document.visibilityState !== 'visible') return 'stale'
      if (!response.ok || response.value.state !== 'value') return 'failed'
      return new Promise(resolve => {
        const action: PendingMember = { request, signal, row: { ...request.action.member, sampledAt: response.value.sampledAt }, previousPaused: latest.current.pagingPaused, previousGuard: latest.current.pagingGuard, resolve, resolved: false, userScrolled: false, userInteracted: false, previousTop: null, abort: () => undefined, accepted: () => undefined, rejected: () => undefined }
        const retire = () => { signal.removeEventListener('abort', action.abort); if (pending.current === action) pending.current = null; latest.current.publication?.release(request.requestId) }
        action.rejected = () => {
          retire()
          const finish = () => { if (!action.userScrolled) { setPagingPaused(action.previousPaused); setPagingGuard(action.previousGuard) } if (!action.userScrolled && !action.userInteracted && action.previousTop !== null) setRestoreScroll({ top: action.previousTop }); setCandidate(current => current === action ? null : current) }
          // Preserve the pressed row until its click follows pointerup.
          if (pointer.current) { action.userInteracted = true; deferredReject.current = { action, finish } } else finish()
          if (!action.resolved) { action.resolved = true; resolve('stale') }
        }
        action.accepted = () => { retire(); setPoint(action.row); setSelected(action.row.base64); setCandidate(current => current === action ? null : current) }
        action.abort = action.rejected
        pending.current = action; latest.current.publication?.hold(request.requestId); setRestoreScroll(undefined); setPagingPaused(true); setPagingGuard(true); setCandidate(action)
        signal.addEventListener('abort', action.abort, { once: true })
        if (signal.aborted) action.abort()
      })
    }
    const unregister = props.registerSetHandler(handler)
    return () => { unregister(); pending.current?.abort() }
  }, [props.registerSetHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
  function pointerInteraction(active: boolean): void {
    pointer.current = active
    if (active || !mounted.current || deferredReject.current === null) return
    pointerTimer.current = setTimeout(() => { pointerTimer.current = undefined; if (!pointer.current) { const deferred = deferredReject.current; deferredReject.current = null; deferred?.finish() } }, 0)
  }
  function applyPattern(value: string): void {
    epoch?.userSelect(); setSelected(null); setPoint(null); setPagingPaused(false); setPagingGuard(false); setOptionsOpen(false)
    if (value === pattern) void scanState.scan(false)
    else setPattern(value)
  }
  const columns: readonly CollectionColumn<RedisKey>[] = [
    { id: 'number', title: '#', render: (_value, index) => index + 1 },
    { id: 'member', title: t('set.member'), render: value => <span data-set-member={value.base64} title={displayLabel(value.label)}>{value.byteLength === 0 ? t('collection.emptyMember') : displayLabel(value.label)}{located?.base64 === value.base64 && <small data-located-set-member title={`${t('hash.sampledAt')}: ${located.sampledAt}`}> · {t(candidate?.row.base64 === value.base64 ? 'hash.locating' : 'hash.located')} · <time dateTime={located.sampledAt}>{new Date(located.sampledAt).toLocaleString()}</time></small>}</span> },
  ]
  return <section className="redis-details redis-collection-workbench" aria-label={t('set.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('set.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} label={t('keys.scan')} refresh={() => { void scanState.scan(false) }} cancel={scanState.cancel}><QueryToggle icon="filter" label={t('set.pattern')} open={optionsOpen} active={pattern !== '*'} toggle={() => setOptionsOpen(!optionsOpen)} /></ReadActions></div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => { event.preventDefault(); applyPattern(draft) }}>
      <label>{t('set.pattern')}<input name="setPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('set.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'set.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    <div className="redis-collection-summary"><ScanProgress t={t} busy={busy} progress={progress} /><span title={`${t('set.loaded')} / ${t('set.total')}`}><b data-loaded-members>{cache.keys.length}</b>{pattern === '*' ? ' / ' : ' · ' + t('set.total') + ' '}{result?.metadata?.length ?? '—'}</span>{pattern !== '*' && <span className="redis-filter-chip"><button type="button" title={t('set.pattern')} onClick={() => setOptionsOpen(true)}><Icon name="filter" /><span>{pattern}</span></button><button type="button" className="redis-icon-button" title={t('read.clearFilter')} aria-label={t('read.clearFilter')} onClick={() => { setDraft('*'); applyPattern('*') }}><Icon name="close" /></button></span>}</div>
    <div className="redis-collection-body">
      <CollectionTable rows={rows} identity={value => value.base64} columns={columns} label={t('set.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'set.empty')} selection={{ id: shown?.base64 ?? null, disabled: value => candidate?.row.base64 === value.base64, onSelect: value => { setPoint(current => current?.base64 === value.base64 ? current : null); setSelected(value.base64) } }} reveal={candidate === null ? undefined : { id: candidate.row.base64, remember: top => { candidate.previousTop ??= top }, ready: () => { if (pending.current !== candidate || candidate.resolved) return; if (candidate.signal.aborted || Date.now() >= candidate.request.expiresAt || !epoch?.current(candidate.request.selectionRevision) || document.visibilityState !== 'visible') { candidate.abort(); return } candidate.resolved = true; candidate.resolve({ kind: 'commitSetMember', accepted: candidate.accepted, rejected: candidate.rejected }) } }} restoreScroll={candidate === null ? restoreScroll : undefined} onPointerInteraction={pointerInteraction} onUserScroll={() => { const action = pending.current ?? deferredReject.current?.action; if (action !== undefined && action !== null) action.userScrolled = true; setPagingGuard(false); setPagingPaused(false) }} onEnd={pagingPaused || pagingGuard || cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      {pagingGuard && cursor !== null && !cache.limited && error === null && <button type="button" disabled={busy || candidate !== null} onClick={() => { epoch?.userSelect(); setPagingPaused(false); setPagingGuard(false); void scanState.scan(true) }}>{t('keys.more')}</button>}
      <section className="redis-collection-preview" aria-label={t('set.member')}>
        {shown !== undefined && window !== null ? <BytePreview key={shown.base64} heading={{ label: t('set.member'), description: `${shown.byteLength} ${t('keys.bytes')}` }} value={window} t={t} format={format} onFormatChange={setFormat} onActionFormatChange={setActionFormat} actionTarget /> : <><strong>{t('set.member')}</strong><p>{t(selected === null ? 'collection.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
    </div>
  </section>
}
