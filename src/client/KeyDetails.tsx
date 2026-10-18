import { useBrowsingFormat } from './PreviewFormats.tsx'
import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_VALUE_BYTES, type DatabaseTarget, type RedisKey, type StringReadRequest, type StringReadResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { HashView, type HashActions } from './HashView.tsx'
import { ListView, type ListActions } from './ListView.tsx'
import { SetView, type SetActions } from './SetView.tsx'
import { ZSetView, type ZSetActions } from './ZSetView.tsx'
import { StreamView, type StreamActions } from './StreamView.tsx'
import { NS } from './locales.ts'
import { stringReadRequestSchema } from '../typert.shared.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle } from './ReadControls.tsx'
import { Icon } from './Icon.tsx'

export interface StringActions { readonly readString: (request: StringReadRequest, signal: AbortSignal) => Promise<RemoteResult<StringReadResult>> }
type Props = StringActions & HashActions & ListActions & SetActions & ZSetActions & StreamActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Selection is an explicit read. Offset/count/retry owns a cancellable request;
 * stale replies cannot replace the selected key or any newer byte window.
 */
export function KeyDetails(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_VALUE_BYTES)
  const [request, setRequest] = useState({ offset: '0', count: MAX_VALUE_BYTES, attempt: 0 })
  // The formatter survives the loading state between byte windows.
  const [format, setFormat] = useBrowsingFormat('string')
  const [result, setResult] = useState<StringReadResult | null>(null)
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false)
  const [rangeError, setRangeError] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const active = useRef<AbortController | null>(null)
  const currentWindow = useRef('0:' + MAX_VALUE_BYTES)
  const auto = useAutoRefreshReader({ active: result?.state !== 'unsupported', busy, result, failed: rpcError, refresh: () => setRequest(value => ({ ...value, attempt: value.attempt + 1 })), cancel: cancelRead })
  function cancelRead(): void { auto.reset('cancelled'); active.current?.abort(); setBusy(false); setCancelled(true) }
  useEffect(() => {
    if (!auto.begin()) return
    const controller = new AbortController(); active.current = controller
    const windowKey = request.offset + ':' + request.count
    // A refresh keeps this preview mounted; an explicit byte-window change resets it.
    if (currentWindow.current !== windowKey) { currentWindow.current = windowKey; setResult(null) }
    setBusy(true); setRpcError(false); setCancelled(false)
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
  return <section className="redis-details" aria-label={t('value.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('value.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} refresh={() => setRequest(value => ({ ...value, attempt: value.attempt + 1 }))} cancel={cancelRead}>
      <button type="button" className="redis-icon-button" title={t('value.next')} aria-label={t('value.next')} disabled={busy || result?.nextOffset === null || result?.nextOffset === undefined} onClick={() => {
        if (result?.nextOffset === null || result?.nextOffset === undefined) return
        setOffset(result.nextOffset); setCount(request.count); setRequest({ offset: result.nextOffset, count: request.count, attempt: request.attempt + 1 })
      }}><Icon name="right" /></button>
      <QueryToggle label={t('read.range')} open={optionsOpen} active={request.offset !== '0'} toggle={() => setOptionsOpen(value => !value)} />
    </ReadActions></div>
    {optionsOpen && <form onSubmit={event => {
      event.preventDefault()
      try { stringReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('value.offset')}<input name="byteOffset" inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" required maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('value.window')}<select name="byteCount" value={count} onChange={event => setCount(Number(event.target.value))}>
          {[256, 4096, 16384, MAX_VALUE_BYTES].map(size => <option key={size} value={size}>{size}</option>)}
        </select></label>
      </div>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}
    {rangeError && <p role="alert" className="redis-error">{t('value.error.range')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata">
        <dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>
        {result.metadata.length !== null && <><dt>{t('value.length')}</dt><dd>{result.metadata.length} {t('keys.bytes')}</dd></>}
      </dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : result.state !== 'value' && <p role="status">{t(`value.state.${result.state}`)}</p>}
      {result.state === 'value' && <>
        <div className="redis-collection-state" data-value-coverage title={`${t(result.complete ? 'value.complete' : 'value.partial')} · ${t('value.offset')} ${result.offset} · ${result.byteLength} ${t('keys.bytes')}`}><span className={result.complete ? '' : 'redis-warning'}><Icon name={result.complete ? 'check' : 'warning'} />{!result.complete && t('read.partial')}</span><span>#{result.offset} · {result.byteLength}{result.metadata?.length === null || result.metadata?.length === undefined ? '' : ` / ${result.metadata.length}`} {t('keys.bytes')}</span></div>
        <BytePreview value={result} t={t} format={format} onFormatChange={setFormat} />
      </>}
    </>}
  </section>
}
