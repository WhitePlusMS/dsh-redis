import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseTarget, HllReadRequest, HllReadResult, RedisKey } from '../domain.ts'
import { NS } from './locales.ts'

export interface HllActions { readonly readHll: (request: HllReadRequest, signal: AbortSignal) => Promise<RemoteResult<HllReadResult>> }
type Props = HllActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Manual interpretation owns one bounded, cancellable count. No member listing
 * or automatic source-cache repair is offered by this readonly view.
 */
export function HllView(props: Props) {
  const { t } = props
  const [attempt, setAttempt] = useState(0), [result, setResult] = useState<HllReadResult | null>(null)
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setRpcError(false); setCancelled(false)
    void props.readHll({ target: props.target, keyBase64: props.selected.base64 }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) setResult(response.value)
      else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readHll, props.target.id, props.target.generation, props.target.db, props.selected.base64, attempt])
  return <section className="redis-details" aria-label={t('hll.title')}>
    <h2>{t('hll.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-actions">
      <button type="button" disabled={busy} onClick={() => setAttempt(attempt + 1)}>{t('value.refresh')}</button>
      {busy && <button type="button" onClick={() => { active.current?.abort(); setBusy(false); setCancelled(true); setResult(null) }}>{t('keys.cancel')}</button>}
    </div>
    {busy && <p role="status">{t('connection.busy')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('value.length')}</dt><dd>{result.metadata.length} {t('keys.bytes')}</dd></dl>}
      {result.state === 'value' ? <dl className="redis-metadata">
        <dt>{t('hll.estimate')}</dt><dd data-hll-estimate>{result.estimate}</dd>
        <dt>{t('hll.encoding')}</dt><dd data-hll-encoding>{t(result.encoding === 'dense' ? 'hll.dense' : 'hll.sparse')}</dd>
        <dt>{t('hll.cache')}</dt><dd data-hll-cache>{t(result.cacheValid ? 'hll.valid' : 'hll.invalidCache')}</dd>
      </dl> : result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : <p role="status">{t(result.state === 'invalid' ? 'hll.invalid' : result.state === 'unavailable' ? 'hll.unavailable' : result.state === 'unsupported' ? 'hll.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    <p>{t('hll.hint')}</p><p>{t('value.live')}</p>
  </section>
}
