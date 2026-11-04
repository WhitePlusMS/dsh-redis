import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_STREAM_MESSAGES, type ActionPointReadRequest, type ActionPointReadResult, type DatabaseTarget, type PreviewFormat, type RedisKey, type StreamField, type StreamMessage, type StreamReadRequest, type StreamReadResult } from '../domain.ts'
import { streamReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { cellLabel, displayLabel, prefixWindow } from './collection-value.ts'
import { appendStreamMessages, emptyStreamCache, type StreamCache } from './stream-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCurrentItem, useSelectionAction } from './CurrentSelection.tsx'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import type { KeyActionResult, StreamActionHandler, StreamActionRequest } from './ui-pane-presence.ts'

export interface StreamActions { readonly readStream: (request: StreamReadRequest, signal: AbortSignal) => Promise<RemoteResult<StreamReadResult>>; readonly readActionPoint: (request: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>; readonly registerStreamHandler: (handler: StreamActionHandler) => () => void }
type Props = StreamActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type FieldRow = StreamField & { readonly index: number }
type LocatedMessage = StreamMessage & { readonly sampledAt: string }
interface PendingField { readonly request: StreamActionRequest; readonly signal: AbortSignal; readonly message: LocatedMessage; readonly previousPaused: boolean; readonly previousGuard: boolean; readonly resolve: (result: KeyActionResult) => void; resolved: boolean; messageVisible: boolean; fieldVisible: boolean; userScrolled: boolean; userInteracted: boolean; previousMessageTop: number | null; previousFieldTop: number | null; abort: () => void; accepted: () => void; rejected: () => void }

/** Messages, ordered field pairs and both byte previews remain visible together.
 * Message ID + occurrence identifies a preview, including repeated field names.
 */
export function StreamView(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility), publication = useSelectionAction()
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')
  const [start, setStart] = useState('-'), [end, setEnd] = useState('+'), [count, setCount] = useState(MAX_STREAM_MESSAGES)
  const [range, setRange] = useState({ start: '-', end: '+', count: MAX_STREAM_MESSAGES, attempt: 0 }), [rangeError, setRangeError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [pairIndex, setPairIndex] = useState(0)
  const [optionsOpen, setOptionsOpen] = useState(false), [fieldFormat, setFieldFormat] = useState<PreviewFormat>('text')
  const [format, setFormat] = useBrowsingFormat('stream')
  const [point, setPoint] = useState<LocatedMessage | null>(null), [candidate, setCandidate] = useState<PendingField | null>(null)
  const [pagingPaused, setPagingPaused] = useState(false), [pagingGuard, setPagingGuard] = useState(false)
  const [restoreMessageScroll, setRestoreMessageScroll] = useState<{ readonly top: number } | undefined>(), [restoreFieldScroll, setRestoreFieldScroll] = useState<{ readonly top: number } | undefined>()
  const pending = useRef<PendingField | null>(null), latest = useRef({ visibility, publication, pagingPaused, pagingGuard, busy: false })
  const pointer = useRef(false), mounted = useRef(false), deferredReject = useRef<{ readonly action: PendingField; readonly finish: () => void } | null>(null), pointerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (pointerTimer.current !== undefined) clearTimeout(pointerTimer.current); deferredReject.current = null } }, [])
  latest.current = { ...latest.current, visibility, publication, pagingPaused, pagingGuard }
  const scanSignal = useRef<{ readonly signal: AbortSignal; readonly replace: boolean } | null>(null)
  const page = useCollectionScan<StreamCache, StreamReadResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify([direction, range]), empty: emptyStreamCache,
    append: (previous, response) => appendStreamMessages(previous, response.messages),
    load: (cursor, signal) => {
      if (scanSignal.current?.signal !== signal) { if (scanSignal.current !== null && latest.current.publication?.active) epoch?.invalidate(); scanSignal.current = { signal, replace: cursor === null } }
      return props.readStream({ target: props.target, keyBase64: props.selected.base64, direction, start: range.start, end: range.end, count: range.count, cursor }, signal)
    },
  })
  const { cache, result, cursor, busy, error, progress } = page
  latest.current.busy = busy
  const previousResult = useRef(result)
  useLayoutEffect(() => {
    if (previousResult.current !== result) {
      previousResult.current = result
      setPoint(current => current === null || scanSignal.current?.replace !== false || result?.state !== 'page' || result.messages.some(item => item.id === current.id) ? null : current)
    }
  }, [result])
  const located = candidate?.message ?? point
  const messages = located === null ? cache.messages : [located, ...cache.messages.filter(item => item.id !== located.id)]
  const message = point?.id === selected ? point : cache.messages.find(item => item.id === selected), pair = message?.fields[pairIndex]
  useCurrentItem(message === undefined || pair === undefined ? null : { kind: 'stream', id: message.id, fieldIndex: pairIndex, fieldBase64: pair.field.base64 })
  const shown = candidate?.message ?? message, shownIndex = candidate?.request.action.fieldIndex ?? pairIndex, shownPair = shown?.fields[shownIndex]
  const rows = useMemo(() => shown?.fields.map((field, index) => ({ ...field, index })) ?? [], [shown])
  const windows = useMemo(() => shownPair === undefined ? null : { field: { base64: shownPair.field.base64, offset: '0', prefix: '', suffix: '', complete: true }, value: prefixWindow(shownPair.value) }, [shownPair])
  useLayoutEffect(() => {
    if (epoch === null || publication === null || visibility?.visible === false || visibility?.signal.aborted) return
    const handler: StreamActionHandler = async (request, signal) => {
      const sameTarget = request.target !== null && request.target.id === props.target.id && request.target.generation === props.target.generation && request.target.db === props.target.db && request.action.keyBase64 === props.selected.base64
      if (!sameTarget || latest.current.busy || pending.current !== null || signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || document.visibilityState !== 'visible') return 'stale'
      let response: RemoteResult<ActionPointReadResult>
      try { response = await props.readActionPoint({ requestId: request.requestId }, signal) } catch { return signal.aborted ? 'stale' : 'failed' }
      if (signal.aborted || Date.now() >= request.expiresAt || !epoch.current(request.selectionRevision) || latest.current.visibility?.visible === false || latest.current.visibility?.signal.aborted || document.visibilityState !== 'visible') return 'stale'
      if (!response.ok || response.value.state !== 'value' || response.value.cell === null || response.value.streamMessage === null) return 'failed'
      const item = response.value.streamMessage, field = item.fields[request.action.fieldIndex]
      if (item.id !== request.action.id || field === undefined || field.field.base64 !== request.action.fieldBase64 || JSON.stringify(field.value) !== JSON.stringify(response.value.cell)) return 'failed'
      return new Promise(resolve => {
        const action: PendingField = { request, signal, message: { ...item, sampledAt: response.value.sampledAt }, previousPaused: latest.current.pagingPaused, previousGuard: latest.current.pagingGuard, resolve, resolved: false, messageVisible: false, fieldVisible: false, userScrolled: false, userInteracted: false, previousMessageTop: null, previousFieldTop: null, abort: () => undefined, accepted: () => undefined, rejected: () => undefined }
        const retire = () => { signal.removeEventListener('abort', action.abort); if (pending.current === action) pending.current = null; latest.current.publication?.release(request.requestId) }
        action.rejected = () => {
          retire()
          const finish = () => { if (!action.userScrolled) { setPagingPaused(action.previousPaused); setPagingGuard(action.previousGuard) } if (!action.userScrolled && !action.userInteracted) { if (action.previousMessageTop !== null) setRestoreMessageScroll({ top: action.previousMessageTop }); if (action.previousFieldTop !== null) setRestoreFieldScroll({ top: action.previousFieldTop }) } setCandidate(current => current === action ? null : current) }
          if (pointer.current) { action.userInteracted = true; deferredReject.current = { action, finish } } else finish()
          if (!action.resolved) { action.resolved = true; resolve('stale') }
        }
        action.accepted = () => { retire(); setPoint(action.message); setSelected(action.message.id); setPairIndex(action.request.action.fieldIndex); setCandidate(current => current === action ? null : current) }
        action.abort = action.rejected
        pending.current = action; latest.current.publication?.hold(request.requestId); setRestoreMessageScroll(undefined); setRestoreFieldScroll(undefined); setPagingPaused(true); setPagingGuard(true); setCandidate(action)
        signal.addEventListener('abort', action.abort, { once: true })
        if (signal.aborted) action.abort()
      })
    }
    const unregister = props.registerStreamHandler(handler)
    return () => { unregister(); pending.current?.abort() }
  }, [props.registerStreamHandler, props.readActionPoint, props.target.id, props.target.generation, props.target.db, props.selected.base64, epoch, visibility?.visible, visibility?.signal, publication === null])
  function pointerInteraction(active: boolean): void {
    pointer.current = active
    if (active || !mounted.current || deferredReject.current === null) return
    pointerTimer.current = setTimeout(() => { pointerTimer.current = undefined; if (!pointer.current) { const deferred = deferredReject.current; deferredReject.current = null; deferred?.finish() } }, 0)
  }
  function userScroll(): void { const action = pending.current ?? deferredReject.current?.action; if (action !== undefined && action !== null) action.userScrolled = true; setPagingGuard(false); setPagingPaused(false) }
  function ready(action: PendingField, table: 'message' | 'field'): void {
    if (pending.current !== action || action.resolved) return
    if (action.signal.aborted || Date.now() >= action.request.expiresAt || !epoch?.current(action.request.selectionRevision) || document.visibilityState !== 'visible') { action.abort(); return }
    if (table === 'message') action.messageVisible = true
    else action.fieldVisible = true
    if (action.messageVisible && action.fieldVisible) { action.resolved = true; action.resolve({ kind: 'commitStreamField', accepted: action.accepted, rejected: action.rejected }) }
  }
  function clearPoint(): void { epoch?.userSelect(); setSelected(null); setPairIndex(0); setPoint(null); setPagingPaused(false); setPagingGuard(false) }
  function refresh(): void { epoch?.userSelect(); void page.scan(false) }
  const columns: readonly CollectionColumn<StreamMessage>[] = [
    { id: 'id', title: t('stream.id'), render: item => <span data-stream-id={item.id}>{item.id}{located?.id === item.id && <small data-located-stream-message title={`${t('hash.sampledAt')}: ${located.sampledAt}`}> · {t(candidate?.message.id === item.id ? 'hash.locating' : 'hash.located')} · <time dateTime={located.sampledAt}>{new Date(located.sampledAt).toLocaleString()}</time></small>}</span> },
    { id: 'fields', title: t('stream.fields'), render: item => item.fields.length },
  ]
  const fields: readonly CollectionColumn<FieldRow>[] = [
    { id: 'index', title: t('stream.occurrence'), render: row => row.index },
    { id: 'field', title: t('hash.field'), render: row => <span data-stream-field={row.index} title={displayLabel(row.field.label)}>{row.field.byteLength === 0 ? t('hash.emptyField') : displayLabel(row.field.label)}</span> },
    { id: 'value', title: t('hash.value'), render: row => <span data-stream-value={row.index} title={cellLabel(row.value)}>{row.value.fullByteLength === 0 ? t('hash.emptyValue') : cellLabel(row.value)}</span> },
  ]
  return <section className="redis-details redis-collection-workbench redis-stream-workbench" aria-label={t('stream.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('stream.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-stream-controls">
      <label><span className="redis-sr-only">{t('stream.direction')}</span><select name="streamDirection" title={t('stream.direction')} value={direction} onChange={event => { clearPoint(); setDirection(event.target.value === 'reverse' ? 'reverse' : 'forward') }}><option value="forward">{t('stream.forward')}</option><option value="reverse">{t('stream.reverse')}</option></select></label>
      <ReadActions t={t} busy={busy} label={t('stream.refresh')} refresh={refresh} cancel={page.cancel}><QueryToggle label={t('stream.range')} open={optionsOpen} active={range.start !== '-' || range.end !== '+'} toggle={() => { epoch?.userSelect(); setOptionsOpen(!optionsOpen) }} /></ReadActions>
    </div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => {
      event.preventDefault()
      try { streamReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, direction, start, end, count, cursor: null }); clearPoint(); setRangeError(false); setRange({ start, end, count, attempt: range.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address redis-bounds">
        <label>{t('stream.start')}<input name="streamStart" required maxLength={41} value={start} onChange={event => { epoch?.userSelect(); setStart(event.target.value) }} /></label>
        <label>{t('stream.end')}<input name="streamEnd" required maxLength={41} value={end} onChange={event => { epoch?.userSelect(); setEnd(event.target.value) }} /></label>
      </div>
      <label>{t('stream.count')}<select name="streamCount" value={count} onChange={event => { epoch?.userSelect(); setCount(Number(event.target.value)) }}>{[1, 10, 25, MAX_STREAM_MESSAGES].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {rangeError && <p role="alert" className="redis-error">{t('stream.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('stream.total')}</dt><dd>{result.metadata.length}</dd></dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'stream.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    <div className="redis-collection-summary"><ScanProgress t={t} busy={busy} progress={progress} /><span title={`${t('stream.loaded')} · ${t('stream.total')}`}><b data-loaded-messages>{cache.messages.length}</b>{range.start === '-' && range.end === '+' ? ' / ' : ' · ' + t('stream.total') + ' '}{result?.metadata?.length ?? '—'}</span>{(range.start !== '-' || range.end !== '+') && <button type="button" className="redis-chip" title={t('stream.bounds')} onClick={() => setOptionsOpen(true)}>{range.start} … {range.end}</button>}</div>
    <div className="redis-collection-body redis-stream-body">
      <CollectionTable rows={messages} identity={item => item.id} columns={columns} label={t('stream.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'stream.empty')} selection={{ id: shown?.id ?? null, disabled: item => candidate?.message.id === item.id, onSelect: item => { setPoint(current => current?.id === item.id ? current : null); setSelected(item.id); setPairIndex(0) } }} reveal={candidate === null ? undefined : { id: candidate.message.id, remember: top => { candidate.previousMessageTop ??= top }, ready: () => ready(candidate, 'message') }} restoreScroll={candidate === null ? restoreMessageScroll : undefined} onPointerInteraction={pointerInteraction} onUserScroll={userScroll} onEnd={pagingPaused || pagingGuard || cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />
      {pagingGuard && cursor !== null && !cache.limited && error === null && <button type="button" disabled={busy || candidate !== null} onClick={() => { epoch?.userSelect(); setPagingPaused(false); setPagingGuard(false); void page.scan(true) }}>{t('keys.more')}</button>}
      <section className="redis-stream-pairs" aria-label={t('stream.fields')}>
        <strong>{shown === undefined ? t('stream.fields') : `${t('stream.id')} ${shown.id}`}</strong>
        <CollectionTable rows={rows} identity={row => String(row.index)} columns={fields} label={t('stream.fields')} emptyMessage={t(shown === undefined ? selected === null ? 'stream.selectMessage' : 'collection.selectionAbsent' : 'stream.noFields')} selection={{ id: shownPair === undefined ? null : String(shownIndex), disabled: row => candidate !== null && row.index === candidate.request.action.fieldIndex, onSelect: row => { if (candidate !== null) { setPoint(candidate.message); setSelected(candidate.message.id) } setPairIndex(row.index) } }} reveal={candidate === null ? undefined : { id: String(candidate.request.action.fieldIndex), remember: top => { candidate.previousFieldTop ??= top }, ready: () => ready(candidate, 'field') }} restoreScroll={candidate === null ? restoreFieldScroll : undefined} onPointerInteraction={pointerInteraction} onUserScroll={userScroll} />
      </section>
      <section className="redis-collection-preview redis-stream-field" aria-label={t('hash.field')}>
        {shownPair !== undefined && shown !== undefined && windows !== null ? <BytePreview key={`${shown.id}:${shownIndex}`} heading={{ label: t('hash.field'), description: `#${shownIndex} · ${shownPair.field.byteLength} ${t('keys.bytes')}` }} value={windows.field} t={t} format={fieldFormat} onFormatChange={setFieldFormat} /> : <strong>{t('hash.field')}</strong>}
      </section>
      <section className="redis-collection-preview redis-stream-value" aria-label={t('hash.value')}>
        {shownPair !== undefined && shown !== undefined && windows !== null ? <BytePreview key={`${shown.id}:${shownIndex}`} heading={{ label: t('hash.value'), description: `${shownPair.value.byteLength}/${shownPair.value.fullByteLength} ${t('keys.bytes')}${windows.value.complete ? '' : ' · ' + t('value.partial')}` }} value={windows.value} t={t} format={format} onFormatChange={setFormat} /> : <strong>{t('hash.value')}</strong>}
      </section>
    </div>
  </section>
}
