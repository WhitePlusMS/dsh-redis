import { useBrowsingFormat } from './PreviewFormats.tsx'
import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { ReadConfirmation } from './read-confirmation.ts'

export interface StringActions { readonly readString: (request: StringReadRequest, signal: AbortSignal) => Promise<RemoteResult<StringReadResult>> }
type Props = StringActions & HashActions & ListActions & SetActions & ZSetActions & StreamActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Selection is an explicit read. Offset/count/retry owns a cancellable request;
 * stale replies cannot replace the selected key or any newer byte window.
 */
export function KeyDetails(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_VALUE_BYTES)
  const [request, setRequest] = useState<{ offset: string; count: number; attempt: number; identity: symbol | null }>({ offset: '0', count: MAX_VALUE_BYTES, attempt: 0, identity: null })
  // The formatter survives the loading state between byte windows.
  const [format, setFormat, setActionFormat] = useBrowsingFormat('string')
  const [result, setResult] = useState<StringReadResult | null>(null)
  const [confirmation] = useState(() => new ReadConfirmation<StringReadResult>())
  const [completion, setCompletion] = useState<{ readonly id: symbol; readonly result: StringReadResult | null; readonly failed: boolean } | null>(null)
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false)
  const [rangeError, setRangeError] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const active = useRef<AbortController | null>(null)
  const activeIdentity = useRef<symbol | null>(null), latestResult = useRef(result)
  latestResult.current = result
  const currentWindow = useRef('0:' + MAX_VALUE_BYTES)
  const auto = useAutoRefreshReader({ active: result?.state !== 'unsupported', busy, result, failed: rpcError, refresh: () => { confirmation.invalidate(); setRequest(value => ({ ...value, attempt: value.attempt + 1, identity: null })) }, refreshOnce, cancel: cancelRead })
  function cancelRead(): void { confirmation.invalidate(); auto.reset('cancelled'); active.current?.abort(); setBusy(false); setCancelled(true) }
  function refreshOnce(signal: AbortSignal): Promise<'applied' | 'failed' | 'stale'> {
    if (active.current !== null) return Promise.resolve('stale')
    const pending = confirmation.start(signal)
    if (pending === null) return Promise.resolve('stale')
    // An interrupted AI read must not add a status row under the user's pointer.
    const abort = () => { if (activeIdentity.current === pending.id) { confirmation.invalidate(); auto.reset('cancelled'); active.current?.abort(); setBusy(false) } }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    setRequest(value => ({ ...value, attempt: value.attempt + 1, identity: pending.id }))
    return pending.outcome.finally(() => signal.removeEventListener('abort', abort))
  }
  useLayoutEffect(() => {
    if (completion === null) return
    confirmation.settle(completion.id, completion.result, completion.failed)
    confirmation.rendered(result, busy, rpcError || (result !== null && result.state !== 'value'))
  }, [confirmation, completion, result, busy, rpcError])
  useEffect(() => {
    if (request.identity !== null && !confirmation.active(request.identity)) return
    if (!auto.begin()) { if (request.identity !== null) confirmation.invalidate(); return }
    const controller = new AbortController(); active.current = controller
    activeIdentity.current = request.identity
    const windowKey = request.offset + ':' + request.count
    // A refresh keeps this preview mounted; an explicit byte-window change resets it.
    if (currentWindow.current !== windowKey) { currentWindow.current = windowKey; setResult(null) }
    setBusy(true); setRpcError(false); setCancelled(false)
    void props.readString({ target: props.target, keyBase64: props.selected.base64, offset: request.offset, count: request.count }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) { setResult(response.value); if (request.identity !== null) setCompletion({ id: request.identity, result: response.value, failed: response.value.state !== 'value' }) }
      else { setRpcError(true); if (request.identity !== null) setCompletion({ id: request.identity, result: latestResult.current, failed: true }) }
    }).catch(() => { if (!controller.signal.aborted) { setRpcError(true); if (request.identity !== null) setCompletion({ id: request.identity, result: latestResult.current, failed: true }) } })
      .finally(() => { if (active.current === controller) { active.current = null; activeIdentity.current = null } if (!controller.signal.aborted) setBusy(false) })
    return () => { controller.abort(); if (request.identity !== null && confirmation.active(request.identity)) confirmation.invalidate(); if (active.current === controller) { active.current = null; activeIdentity.current = null } }
  }, [props.readString, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  if (result?.state === 'unsupported' && result.metadata?.type === 'hash') return <HashView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'list') return <ListView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'set') return <SetView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'zset') return <ZSetView {...props} />
  if (result?.state === 'unsupported' && result.metadata?.type === 'stream') return <StreamView {...props} />
  return <section className="redis-details" aria-label={t('value.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('value.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} refresh={() => { confirmation.invalidate(); setRequest(value => ({ ...value, attempt: value.attempt + 1, identity: null })) }} cancel={cancelRead}>
      <button type="button" className="redis-icon-button" title={t('value.next')} aria-label={t('value.next')} disabled={busy || result?.nextOffset === null || result?.nextOffset === undefined} onClick={() => {
        if (result?.nextOffset === null || result?.nextOffset === undefined) return
        confirmation.invalidate(); setOffset(result.nextOffset); setCount(request.count); setRequest({ offset: result.nextOffset, count: request.count, attempt: request.attempt + 1, identity: null })
      }}><Icon name="right" /></button>
      <QueryToggle label={t('read.range')} open={optionsOpen} active={request.offset !== '0'} toggle={() => setOptionsOpen(value => !value)} />
    </ReadActions></div>
    {optionsOpen && <form onSubmit={event => {
      event.preventDefault()
      try { stringReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); confirmation.invalidate(); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1, identity: null }); setOptionsOpen(false) }
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
        <BytePreview value={result} t={t} format={format} onFormatChange={setFormat} onActionFormatChange={setActionFormat} actionTarget />
      </>}
    </>}
  </section>
}
