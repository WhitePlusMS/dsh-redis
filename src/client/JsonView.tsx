import { useAutoRefreshReader } from './AutoRefresh.tsx'
import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseTarget, JsonReadRequest, JsonReadResult, RedisKey } from '../domain.ts'
import { jsonReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle } from './ReadControls.tsx'

export interface JsonActions { readonly readJson: (request: JsonReadRequest, signal: AbortSignal) => Promise<RemoteResult<JsonReadResult>> }
type Props = JsonActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Draft paths never query automatically. Each submitted path owns cancellation;
 * retaining raw JSON match-array bytes avoids numeric rewriting or fake paging.
 */
export function JsonView(props: Props) {
  const { t } = props
  const [path, setPath] = useState('$'), [request, setRequest] = useState({ path: '$', attempt: 0 })
  const [result, setResult] = useState<JsonReadResult | null>(null), [format, setFormat] = useBrowsingFormat('json')
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false), [pathError, setPathError] = useState(false)
  const active = useRef<AbortController | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const auto = useAutoRefreshReader({ active: true, busy, result, failed: rpcError, refresh: () => setRequest(value => ({ ...value, attempt: value.attempt + 1 })), cancel: cancelRead })
  function cancelRead(): void { auto.reset('cancelled'); active.current?.abort(); setBusy(false); setCancelled(true); setResult(null) }
  useEffect(() => {
    if (!auto.begin()) return
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
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('json.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} refresh={() => setRequest(value => ({ ...value, attempt: value.attempt + 1 }))} cancel={cancelRead}>
      <QueryToggle label={t('json.path')} open={optionsOpen} active={request.path !== '$'} toggle={() => setOptionsOpen(value => !value)} />
    </ReadActions><button type="button" className="redis-chip" title={t('json.submittedPath')} onClick={() => setOptionsOpen(true)}><code data-json-path>{request.path}</code></button></div>
    {optionsOpen && <form onSubmit={event => {
      event.preventDefault()
      try { jsonReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, path }); setPathError(false); setRequest({ path, attempt: request.attempt + 1 }); setOptionsOpen(false) }
      catch { setPathError(true) }
    }}>
      <label>{t('json.path')}<input name="jsonPath" required maxLength={1024} value={path} onChange={event => setPath(event.target.value)} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {pathError && <p role="alert" className="redis-error">{t('json.pathError')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata">
        <dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>
      </dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(result.error === 'oversize' ? 'json.oversize' : `connection.error.${result.error}`)}</p> : result.state !== 'value' && <p role="status">{t(`json.state.${result.state}`)}</p>}
      {result.state === 'value' && <>
        <div className="redis-collection-state" data-json-matches><b>{result.matchTypes.length}</b> {t('json.matches')} · {result.byteLength} {t('keys.bytes')}</div>
        <dl className="redis-metadata redis-secondary-metadata"><dt>{t('json.types')}</dt><dd>{[...new Set(result.matchTypes)].join(', ')}</dd><dt>{t('json.submittedPath')}</dt><dd>{result.path}</dd></dl>
        <BytePreview value={{ base64: result.base64, prefix: '', suffix: '', offset: '0', complete: true }} t={t} format={format} onFormatChange={setFormat} />
      </>}
    </>}
  </section>
}
