import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { BloomReadRequest, BloomReadResult, DatabaseTarget, RedisKey } from '../domain.ts'
import { bloomReadRequestSchema } from '../typert.shared.ts'
import { bloomItemBase64 } from './bloom-query.ts'
import { NS } from './locales.ts'

export interface BloomActions { readonly readBloom: (request: BloomReadRequest, signal: AbortSignal) => Promise<RemoteResult<BloomReadResult>> }
type Props = BloomActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Single explicit item checks never enumerate the filter or mutate its bits. */
export function BloomView(props: Props) {
  const { t } = props
  const [mode, setMode] = useState<'text' | 'base64'>('text'), [draft, setDraft] = useState('')
  const [request, setRequest] = useState<{ readonly itemBase64: string | null; readonly attempt: number }>({ itemBase64: null, attempt: 0 })
  const [result, setResult] = useState<BloomReadResult | null>(null), [busy, setBusy] = useState(false)
  const [rpcError, setRpcError] = useState(false), [inputError, setInputError] = useState(false), [cancelled, setCancelled] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setRpcError(false); setCancelled(false)
    void props.readBloom({ target: props.target, keyBase64: props.selected.base64, itemBase64: request.itemBase64 }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) setResult(response.value)
      else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readBloom, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  return <section className="redis-details" aria-label={t('bloom.title')}>
    <h2>{t('bloom.title')} · <span>{props.selected.label}</span></h2>
    <button type="button" disabled={busy} onClick={() => { setInputError(false); setRequest({ itemBase64: null, attempt: request.attempt + 1 }) }}>{t('bloom.refresh')}</button>
    <form onSubmit={event => {
      event.preventDefault()
      try {
        const value = bloomReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, itemBase64: bloomItemBase64(mode, draft) })
        setInputError(false); setRequest({ itemBase64: value.itemBase64, attempt: request.attempt + 1 })
      } catch { setInputError(true) }
    }}>
      <label>{t('bloom.format')}<select name="bloomFormat" value={mode} onChange={event => setMode(event.target.value === 'base64' ? 'base64' : 'text')}><option value="text">Text (UTF-8)</option><option value="base64">Base64</option></select></label>
      <label>{t('bloom.item')}<textarea name="bloomItem" maxLength={5464} rows={3} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
      <div className="redis-actions"><button type="submit" disabled={busy}>{t('bloom.query')}</button>{busy && <button type="button" onClick={() => { active.current?.abort(); setBusy(false); setCancelled(true); setResult(null) }}>{t('keys.cancel')}</button>}</div>
    </form>
    {busy && <p role="status">{t('connection.busy')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {inputError && <p role="alert" className="redis-error">{t('bloom.inputError')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd></dl>}
      {result.infoState !== null && result.infoState !== 'available' && <p role="status" data-bloom-info-status={result.infoState}>{t(`bloom.info.${result.infoState}`)}</p>}
      {result.info !== null && <dl className="redis-metadata">
        <dt>{t('bloom.capacity')}</dt><dd data-bloom-capacity>{result.info.capacity}</dd><dt>{t('bloom.size')}</dt><dd>{result.info.size}</dd><dt>{t('bloom.filters')}</dt><dd>{result.info.filters}</dd><dt>{t('bloom.inserted')}</dt><dd>{result.info.inserted}</dd><dt>{t('bloom.expansion')}</dt><dd data-bloom-expansion>{result.info.expansion ?? t('bloom.nonscaling')}</dd>
      </dl>}
      {result.membership !== null && <p role="status" data-bloom-membership={result.membership}>{t(`bloom.${result.membership}`)}</p>}
      {result.itemBase64 !== null && <label>{t('bloom.submitted')}<textarea readOnly rows={2} value={result.itemBase64} spellCheck={false} /></label>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : result.state !== 'value' && <p role="status">{t(result.state === 'unavailable' || result.state === 'unsupported' ? `bloom.${result.state}` : `value.state.${result.state}`)}</p>}
    </>}
    <p>{t('bloom.hint')}</p><p>{t('bloom.budget')}</p><p>{t('value.live')}</p>
  </section>
}
