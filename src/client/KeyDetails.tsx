import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_VALUE_BYTES, type DatabaseTarget, type RedisKey, type StringReadRequest, type StringReadResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { useBrowsingFormat, useBrowsingState } from './BrowsingSession.tsx'
import { HashView, type HashActions } from './HashView.tsx'
import { ListView, type ListActions } from './ListView.tsx'
import { SetView, type SetActions } from './SetView.tsx'
import { ZSetView, type ZSetActions } from './ZSetView.tsx'
import { StreamView, type StreamActions } from './StreamView.tsx'
import { JsonView, type JsonActions } from './JsonView.tsx'
import { isRedisJsonType } from '../redis-json.ts'
import { BitmapView } from './BitmapView.tsx'
import { BloomView, type BloomActions } from './BloomView.tsx'
import { TimeSeriesView, type TimeSeriesActions } from './TimeSeriesView.tsx'
import { isTimeSeriesType } from '../redis-timeseries.ts'
import { HllView, type HllActions } from './HllView.tsx'
import { NS } from './locales.ts'
import { stringReadRequestSchema } from '../typert.shared.ts'

export interface StringActions { readonly readString: (request: StringReadRequest, signal: AbortSignal) => Promise<RemoteResult<StringReadResult>> }
type Props = BloomActions & TimeSeriesActions & StringActions & HllActions & HashActions & ListActions & SetActions & ZSetActions & StreamActions & JsonActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Selection is an explicit read. Offset/count/retry owns a cancellable request;
 * stale replies cannot replace the selected key or any newer byte window.
 */
export function KeyDetails(props: Props) {
  const { t } = props
  const browsing = useBrowsingState()
  const [offset, setOffset] = useState(browsing.state.stringOffset), [count, setCount] = useState(browsing.state.stringCount)
  const [request, setRequest] = useState({ offset: browsing.state.stringOffset, count: browsing.state.stringCount, attempt: 0 })
  // The formatter survives the loading state between byte windows.
  const [format, setFormat] = useBrowsingFormat('string')
  const [result, setResult] = useState<StringReadResult | null>(null)
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false)
  const [rangeError, setRangeError] = useState(false)
  const [view, setView] = useState<'string' | 'bitmap' | 'hll'>('string')
  const active = useRef<AbortController | null>(null)
  const auto = useAutoRefreshReader({ active: view === 'string' && result?.state !== 'unsupported', busy, result, failed: rpcError, refresh: () => setRequest(value => ({ ...value, attempt: value.attempt + 1 })), cancel: cancelRead })
  function cancelRead(): void { auto.reset('cancelled'); active.current?.abort(); setBusy(false); setCancelled(true); setResult(null) }
  useEffect(() => {
    if (!auto.begin()) return
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setRpcError(false); setCancelled(false)
    void props.readString({ target: props.target, keyBase64: props.selected.base64, offset: request.offset, count: request.count }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) setResult(response.value)
      else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readString, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  if (result?.state === 'unsupported' && result.metadata?.type === 'hash') return <HashView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'list') return <ListView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'set') return <SetView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'zset') return <ZSetView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'stream') return <StreamView {...props} />
  if (result?.state === 'unsupported' && result.metadata !== null && isRedisJsonType(result.metadata.type)) return <JsonView {...props} />
  if (result?.state === 'unsupported' && result.metadata !== null && isTimeSeriesType(result.metadata.type)) return <TimeSeriesView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'MBbloom--') return <BloomView {...props} />
  if (view === 'hll') return <>
    <button type="button" onClick={() => { setView('string'); setResult(null); setRequest({ ...request, attempt: request.attempt + 1 }) }}>{t('bitmap.back')}</button>
    <HllView {...props} />
  </>
  if (view === 'bitmap') return <>
    <button type="button" onClick={() => { setView('string'); setResult(null); setRequest({ ...request, attempt: request.attempt + 1 }) }}>{t('bitmap.back')}</button>
    <BitmapView {...props} />
  </>
  return <section className="redis-details" aria-label={t('value.title')}>
    <h2>{t('value.title')} · <span>{props.selected.label}</span></h2>
    {result?.state === 'value' && <div className="redis-actions">
      <button type="button" onClick={() => setView('bitmap')}>{t('bitmap.open')}</button>
      <button type="button" onClick={() => setView('hll')}>{t('hll.open')}</button>
    </div>}
    <form onSubmit={event => {
      event.preventDefault()
      try { stringReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setRangeError(false); browsing.update({ stringOffset: offset, stringCount: count }); setRequest({ offset, count, attempt: request.attempt + 1 }) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('value.offset')}<input name="byteOffset" inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" required maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('value.window')}<select name="byteCount" value={count} onChange={event => setCount(Number(event.target.value))}>
          {[256, 4096, 16384, MAX_VALUE_BYTES].map(size => <option key={size} value={size}>{size}</option>)}
        </select></label>
      </div>
      <div className="redis-actions">
        <button type="submit">{t('value.refresh')}</button>
        <button type="button" disabled={busy || result?.nextOffset === null || result?.nextOffset === undefined} onClick={() => {
          if (result?.nextOffset === null || result?.nextOffset === undefined) return
          setOffset(result.nextOffset); browsing.update({ stringOffset: result.nextOffset, stringCount: count }); setRequest({ offset: result.nextOffset, count, attempt: request.attempt + 1 })
        }}>{t('value.next')}</button>
        {busy && <button type="button" onClick={cancelRead}>{t('keys.cancel')}</button>}
      </div>
    </form>
    {rangeError && <p role="alert" className="redis-error">{t('value.error.range')}</p>}
    {busy && <p role="status">{t('value.loading')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata">
        <dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>
        {result.metadata.length !== null && <><dt>{t('value.length')}</dt><dd>{result.metadata.length} {t('keys.bytes')}</dd></>}
      </dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : result.state !== 'value' && <p role="status">{t(`value.state.${result.state}`)}</p>}
      {result.state === 'value' && <>
        <p role="status" data-value-coverage>{t(result.complete ? 'value.complete' : 'value.partial')} · {t('value.offset')} {result.offset} · {result.byteLength} {t('keys.bytes')}</p>
        <BytePreview value={result} t={t} format={format} onFormatChange={setFormat} />
      </>}
    </>}
  </section>
}
