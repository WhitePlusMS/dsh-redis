import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_LIST_ITEMS, type DatabaseTarget, type ListEntry, type ListReadRequest, type ListReadResult, type RedisKey } from '../domain.ts'
import { listReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { prefixWindow, prefixLabel } from './collection-value.ts'
import type { PreviewFormat } from './value-preview.ts'
import { NS } from './locales.ts'

export interface ListActions { readonly readList: (request: ListReadRequest, signal: AbortSignal) => Promise<RemoteResult<ListReadResult>> }
type Props = ListActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Keep one bounded interval, not an accumulated pseudo-snapshot of list positions. */
export function ListView(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [request, setRequest] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 })
  const [result, setResult] = useState<ListReadResult | null>(null), [busy, setBusy] = useState(false)
  const [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false), [rangeError, setRangeError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useState<PreviewFormat>('text')
  const active = useRef<AbortController | null>(null)
  const row = result?.entries.find(entry => entry.index === selected)
  const window = useMemo(() => row === undefined ? null : prefixWindow(row.value), [row])
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setSelected(null); setRpcError(false); setCancelled(false)
    void props.readList({ target: props.target, keyBase64: props.selected.base64, offset: request.offset, count: request.count }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) setResult(response.value)
      else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readList, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  const columns: readonly CollectionColumn<ListEntry>[] = [
    { id: 'index', title: t('list.index'), render: entry => entry.index },
    { id: 'value', title: t('hash.value'), render: entry => <button type="button" data-list-index={entry.index} onClick={() => { setSelected(entry.index); setFormat('text') }}>{prefixLabel(entry.value)}<small>{entry.value.byteLength}/{entry.value.fullByteLength} {t('keys.bytes')}</small></button> },
  ]
  return <section className="redis-details" aria-label={t('list.title')}>
    <h2>{t('list.title')} · <span>{props.selected.label}</span></h2>
    <form onSubmit={event => {
      event.preventDefault()
      try { listReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('list.start')}<input name="listOffset" required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="listCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="redis-actions">
        <button type="submit">{t('value.refresh')}</button>
        <button type="button" disabled={busy || result?.nextOffset === null || result?.nextOffset === undefined} onClick={() => {
          if (result?.nextOffset === null || result?.nextOffset === undefined) return
          setOffset(result.nextOffset); setRequest({ offset: result.nextOffset, count, attempt: request.attempt + 1 })
        }}>{t('list.next')}</button>
        {busy && <button type="button" onClick={() => { active.current?.abort(); setBusy(false); setCancelled(true); setResult(null); setSelected(null) }}>{t('keys.cancel')}</button>}
      </div>
    </form>
    <p>{t('list.hint')}</p>
    {rangeError && <p role="alert" className="redis-error">{t('list.rangeError')}</p>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('list.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : result.state !== 'page' && <p role="status">{t(result.state === 'unsupported' ? 'list.unsupported' : `value.state.${result.state}`)}</p>}
      {result.state === 'page' && <>
        <p role="status" data-list-coverage>{t('list.start')}: <span data-list-start>{result.offset}</span> · {t('list.returned')}: <span data-list-count>{result.entries.length}</span></p>
        {result.entries.length === 0 ? <p>{t('list.empty')}</p> : <CollectionTable rows={result.entries} identity={entry => entry.index} columns={columns} label={t('list.title')} />}
      </>}
    </>}
    {row !== undefined && window !== null && <div className="redis-cell-preview">
      <h2>{t('list.index')} {row.index}</h2>
      <p role="status" data-cell-coverage>{t(window.complete ? 'value.complete' : 'value.partial')} · {row.value.byteLength}/{row.value.fullByteLength} {t('keys.bytes')}</p>
      <BytePreview value={window} t={t} format={format} onFormatChange={setFormat} />
    </div>}
    <p>{t('list.budget')}</p><p>{t('value.live')}</p>
  </section>
}
