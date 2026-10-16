import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseTarget, JsonReadRequest, JsonReadResult, RedisKey } from '../domain.ts'
import { jsonReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import type { PreviewFormat } from './value-preview.ts'
import { NS } from './locales.ts'

export interface JsonActions { readonly readJson: (request: JsonReadRequest, signal: AbortSignal) => Promise<RemoteResult<JsonReadResult>> }
type Props = JsonActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Draft paths never query automatically. Each submitted path owns cancellation;
 * retaining raw JSON match-array bytes avoids numeric rewriting or fake paging.
 */
export function JsonView(props: Props) {
  const { t } = props
  const [path, setPath] = useState('$'), [request, setRequest] = useState({ path: '$', attempt: 0 })
  const [result, setResult] = useState<JsonReadResult | null>(null), [format, setFormat] = useState<PreviewFormat>('json')
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false), [pathError, setPathError] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setRpcError(false); setCancelled(false)
    void props.readJson({ target: props.target, keyBase64: props.selected.base64, path: request.path }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) setResult(response.value)
      else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readJson, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  return <section className="redis-details" aria-label={t('json.title')}>
    <h2>{t('json.title')} · <span>{props.selected.label}</span></h2>
    <form onSubmit={event => {
      event.preventDefault()
      try { jsonReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, path }); setPathError(false); setRequest({ path, attempt: request.attempt + 1 }) }
      catch { setPathError(true) }
    }}>
      <label>{t('json.path')}<input name="jsonPath" required maxLength={1024} value={path} onChange={event => setPath(event.target.value)} /></label>
      <div className="redis-actions">
        <button type="submit">{t('value.refresh')}</button>
        {busy && <button type="button" onClick={() => { active.current?.abort(); setBusy(false); setCancelled(true); setResult(null) }}>{t('keys.cancel')}</button>}
      </div>
    </form>
    <p>{t('json.hint')}</p>
    {pathError && <p role="alert" className="redis-error">{t('json.pathError')}</p>}
    {busy && <p role="status">{t('json.loading')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      <p>{t('json.submittedPath')}: <code data-json-path>{result.path}</code></p>
      {result.metadata !== null && <dl className="redis-metadata">
        <dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>
      </dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(result.error === 'oversize' ? 'json.oversize' : `connection.error.${result.error}`)}</p> : result.state !== 'value' && <p role="status">{t(`json.state.${result.state}`)}</p>}
      {result.state === 'value' && <>
        <p role="status" data-json-matches>{t('json.matches')}: {result.matchTypes.length} · {t('json.bytes')}: {result.byteLength}</p>
        <p>{t('json.types')}: {[...new Set(result.matchTypes)].join(', ')}</p>
        <BytePreview value={{ base64: result.base64, prefix: '', suffix: '', offset: '0', complete: true }} t={t} format={format} onFormatChange={setFormat} />
      </>}
    </>}
    <p>{t('json.budget')}</p><p>{t('value.live')}</p>
  </section>
}
