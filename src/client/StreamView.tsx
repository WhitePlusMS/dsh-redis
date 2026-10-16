import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_STREAM_MESSAGES, type DatabaseTarget, type RedisKey, type StreamField, type StreamMessage, type StreamReadRequest, type StreamReadResult } from '../domain.ts'
import { streamReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { prefixLabel, prefixWindow } from './collection-value.ts'
import { appendStreamMessages, emptyStreamCache, type StreamCache } from './stream-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import type { PreviewFormat } from './value-preview.ts'
import { NS } from './locales.ts'

export interface StreamActions { readonly readStream: (request: StreamReadRequest, signal: AbortSignal) => Promise<RemoteResult<StreamReadResult>> }
type Props = StreamActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }
type FieldRow = StreamField & { readonly index: number }

/** Message selection and pair occurrence, never field text, identify a preview. */
export function StreamView(props: Props) {
  const { t } = props
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')
  const [start, setStart] = useState('-'), [end, setEnd] = useState('+'), [count, setCount] = useState(MAX_STREAM_MESSAGES)
  const [range, setRange] = useState({ start: '-', end: '+', count: MAX_STREAM_MESSAGES, attempt: 0 }), [rangeError, setRangeError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [cell, setCell] = useState<{ readonly index: number; readonly part: 'field' | 'value' } | null>(null)
  const [format, setFormat] = useState<PreviewFormat>('text')
  const page = useCollectionScan<StreamCache, StreamReadResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify([direction, range]), empty: emptyStreamCache,
    append: (previous, response) => appendStreamMessages(previous, response.messages),
    load: (cursor, signal) => props.readStream({ target: props.target, keyBase64: props.selected.base64, direction, start: range.start, end: range.end, count: range.count, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = page
  const message = cache.messages.find(item => item.id === selected), pair = cell === null ? undefined : message?.fields[cell.index]
  const window = useMemo(() => pair === undefined || cell === null ? null : cell.part === 'value' ? prefixWindow(pair.value) : { base64: pair.field.base64, offset: '0', prefix: '', suffix: '', complete: true }, [pair, cell])
  const columns: readonly CollectionColumn<StreamMessage>[] = [
    { id: 'id', title: t('stream.id'), render: item => <button type="button" data-stream-id={item.id} onClick={() => { setSelected(item.id); setCell(null) }}>{item.id}</button> },
    { id: 'fields', title: t('stream.fields'), render: item => item.fields.length },
  ]
  const fields: readonly CollectionColumn<FieldRow>[] = [
    { id: 'index', title: t('stream.occurrence'), render: row => row.index },
    { id: 'field', title: t('hash.field'), render: row => <button type="button" data-stream-field={row.index} onClick={() => { setCell({ index: row.index, part: 'field' }); setFormat('text') }}>{row.field.label}<small>{row.field.byteLength} {t('keys.bytes')}</small></button> },
    { id: 'value', title: t('hash.value'), render: row => <button type="button" data-stream-value={row.index} onClick={() => { setCell({ index: row.index, part: 'value' }); setFormat('text') }}>{prefixLabel(row.value)}<small>{row.value.byteLength}/{row.value.fullByteLength} {t('keys.bytes')}</small></button> },
  ]
  return <section className="redis-details" aria-label={t('stream.title')}>
    <h2>{t('stream.title')} · <span>{props.selected.label}</span></h2>
    <label>{t('stream.direction')}<select name="streamDirection" value={direction} onChange={event => { page.clear(); setSelected(null); setCell(null); setDirection(event.target.value === 'reverse' ? 'reverse' : 'forward') }}><option value="forward">{t('stream.forward')}</option><option value="reverse">{t('stream.reverse')}</option></select></label>
    <form onSubmit={event => {
      event.preventDefault()
      try { streamReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, direction, start, end, count, cursor: null }); setRangeError(false); setSelected(null); setCell(null); setRange({ start, end, count, attempt: range.attempt + 1 }) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('stream.start')}<input name="streamStart" required maxLength={41} value={start} onChange={event => setStart(event.target.value)} /></label>
        <label>{t('stream.end')}<input name="streamEnd" required maxLength={41} value={end} onChange={event => setEnd(event.target.value)} /></label>
      </div>
      <label>{t('stream.count')}<select name="streamCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_STREAM_MESSAGES].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('value.refresh')}</button>
        <button type="button" disabled={busy || cursor === null || cache.limited} onClick={() => { void page.scan(true) }}>{t('stream.more')}</button>
        {busy && <button type="button" onClick={page.cancel}>{t('keys.cancel')}</button>}
      </div>
    </form>
    <p>{t('stream.hint')}</p>
    <p role="status">{t('stream.loaded')}: <span data-loaded-messages>{cache.messages.length}</span> · {t(`stream.${progress === 'more' ? 'moreState' : progress}`)}</p>
    {rangeError && <p role="alert" className="redis-error">{t('stream.rangeError')}</p>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      <p>{t('stream.bounds')}: {result.start} … {result.end}</p>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('stream.total')}</dt><dd>{result.metadata.length}</dd></dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'stream.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {cache.messages.length === 0 ? <p>{t('stream.empty')}</p> : <CollectionTable rows={cache.messages} identity={item => item.id} columns={columns} label={t('stream.title')} />}
    {message !== undefined && <div className="redis-stream-fields"><h2>{t('stream.id')} {message.id}</h2><p>{t('stream.pairsHint')}</p><CollectionTable rows={message.fields.map((pair, index) => ({ ...pair, index }))} identity={row => String(row.index)} columns={fields} label={t('stream.fields')} /></div>}
    {pair !== undefined && cell !== null && window !== null && <div className="redis-cell-preview">
      <h2>{t(cell.part === 'field' ? 'hash.field' : 'hash.value')} · {t('stream.occurrence')} {cell.index}</h2>
      <p role="status" data-cell-coverage>{t(window.complete ? 'value.complete' : 'value.partial')}{cell.part === 'value' && <> · {pair.value.byteLength}/{pair.value.fullByteLength} {t('keys.bytes')}</>}</p>
      {cell.part === 'field' && <label>{t('hash.identity')}<textarea readOnly rows={2} value={pair.field.base64} spellCheck={false} /></label>}
      <BytePreview value={window} t={t} format={format} onFormatChange={setFormat} />
    </div>}
    <p>{t('stream.budget')}</p><p>{t('value.live')}</p>
  </section>
}
