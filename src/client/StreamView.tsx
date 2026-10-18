import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_STREAM_MESSAGES, type DatabaseTarget, type PreviewFormat, type RedisKey, type StreamField, type StreamMessage, type StreamReadRequest, type StreamReadResult } from '../domain.ts'
import { streamReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { cellLabel, displayLabel, prefixWindow } from './collection-value.ts'
import { appendStreamMessages, emptyStreamCache, type StreamCache } from './stream-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'

export interface StreamActions { readonly readStream: (request: StreamReadRequest, signal: AbortSignal) => Promise<RemoteResult<StreamReadResult>> }
type Props = StreamActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type FieldRow = StreamField & { readonly index: number }

/** Messages, ordered field pairs and both byte previews remain visible together.
 * Message ID + occurrence identifies a preview, including repeated field names.
 */
export function StreamView(props: Props) {
  const { t } = props
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')
  const [start, setStart] = useState('-'), [end, setEnd] = useState('+'), [count, setCount] = useState(MAX_STREAM_MESSAGES)
  const [range, setRange] = useState({ start: '-', end: '+', count: MAX_STREAM_MESSAGES, attempt: 0 }), [rangeError, setRangeError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [pairIndex, setPairIndex] = useState(0)
  const [optionsOpen, setOptionsOpen] = useState(false), [fieldFormat, setFieldFormat] = useState<PreviewFormat>('text')
  const [format, setFormat] = useBrowsingFormat('stream')
  const page = useCollectionScan<StreamCache, StreamReadResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify([direction, range]), empty: emptyStreamCache,
    append: (previous, response) => appendStreamMessages(previous, response.messages),
    load: (cursor, signal) => props.readStream({ target: props.target, keyBase64: props.selected.base64, direction, start: range.start, end: range.end, count: range.count, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = page
  const message = cache.messages.find(item => item.id === selected), pair = message?.fields[pairIndex]
  const rows = useMemo(() => message?.fields.map((field, index) => ({ ...field, index })) ?? [], [message])
  const windows = useMemo(() => pair === undefined ? null : { field: { base64: pair.field.base64, offset: '0', prefix: '', suffix: '', complete: true }, value: prefixWindow(pair.value) }, [pair])
  function refresh(): void { setSelected(null); setPairIndex(0); void page.scan(false) }
  const columns: readonly CollectionColumn<StreamMessage>[] = [
    { id: 'id', title: t('stream.id'), render: item => <span data-stream-id={item.id}>{item.id}</span> },
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
      <label><span className="redis-sr-only">{t('stream.direction')}</span><select name="streamDirection" title={t('stream.direction')} value={direction} onChange={event => { setSelected(null); setPairIndex(0); setDirection(event.target.value === 'reverse' ? 'reverse' : 'forward') }}><option value="forward">{t('stream.forward')}</option><option value="reverse">{t('stream.reverse')}</option></select></label>
      <ReadActions t={t} busy={busy} label={t('stream.refresh')} refresh={refresh} cancel={page.cancel}><QueryToggle label={t('stream.range')} open={optionsOpen} active={range.start !== '-' || range.end !== '+'} toggle={() => setOptionsOpen(!optionsOpen)} /></ReadActions>
    </div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => {
      event.preventDefault()
      try { streamReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, direction, start, end, count, cursor: null }); setRangeError(false); setSelected(null); setPairIndex(0); setRange({ start, end, count, attempt: range.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address redis-bounds">
        <label>{t('stream.start')}<input name="streamStart" required maxLength={41} value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>{t('stream.end')}<input name="streamEnd" required maxLength={41} value={end} onChange={event => setEnd(event.target.value)} /></label>
      </div>
      <label>{t('stream.count')}<select name="streamCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_STREAM_MESSAGES].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
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
      <CollectionTable rows={cache.messages} identity={item => item.id} columns={columns} label={t('stream.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'stream.empty')} selection={{ id: message?.id ?? null, onSelect: item => { setSelected(item.id); setPairIndex(0) } }} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />
      <section className="redis-stream-pairs" aria-label={t('stream.fields')}>
        <strong>{message === undefined ? t('stream.fields') : `${t('stream.id')} ${message.id}`}</strong>
        <CollectionTable rows={rows} identity={row => String(row.index)} columns={fields} label={t('stream.fields')} emptyMessage={t(message === undefined ? 'stream.selectMessage' : 'stream.noFields')} selection={{ id: pair === undefined ? null : String(pairIndex), onSelect: row => setPairIndex(row.index) }} />
      </section>
      <section className="redis-collection-preview redis-stream-field" aria-label={t('hash.field')}>
        {pair !== undefined && message !== undefined && windows !== null ? <BytePreview key={`${message.id}:${pairIndex}`} heading={{ label: t('hash.field'), description: `#${pairIndex} · ${pair.field.byteLength} ${t('keys.bytes')}` }} value={windows.field} t={t} format={fieldFormat} onFormatChange={setFieldFormat} /> : <strong>{t('hash.field')}</strong>}
      </section>
      <section className="redis-collection-preview redis-stream-value" aria-label={t('hash.value')}>
        {pair !== undefined && message !== undefined && windows !== null ? <BytePreview key={`${message.id}:${pairIndex}`} heading={{ label: t('hash.value'), description: `${pair.value.byteLength}/${pair.value.fullByteLength} ${t('keys.bytes')}${windows.value.complete ? '' : ' · ' + t('value.partial')}` }} value={windows.value} t={t} format={format} onFormatChange={setFormat} /> : <strong>{t('hash.value')}</strong>}
      </section>
    </div>
  </section>
}
