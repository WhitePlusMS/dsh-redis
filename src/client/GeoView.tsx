import { HelpDetails } from './HelpDetails.tsx'
import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_LIST_ITEMS, type DatabaseTarget, type GeoEntry, type GeoReadRequest, type GeoReadResult, type RedisKey } from '../domain.ts'
import { geoReadRequestSchema } from '../typert.shared.ts'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { BytePreview } from './BytePreview.tsx'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'

export interface GeoActions { readonly readGeo: (request: GeoReadRequest, signal: AbortSignal) => Promise<RemoteResult<GeoReadResult>> }
type Props = GeoActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** A bounded coordinate interval with the original rank, score and byte identity.
 * Each explicit range owns its cancellation; no global Geo classification occurs.
 */
export function GeoView(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [request, setRequest] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 })
  const [result, setResult] = useState<GeoReadResult | null>(null), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('geo')
  const [busy, setBusy] = useState(false), [rpcError, setRpcError] = useState(false), [cancelled, setCancelled] = useState(false), [rangeError, setRangeError] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController(); active.current = controller
    setBusy(true); setResult(null); setSelected(null); setRpcError(false); setCancelled(false)
    void props.readGeo({ target: props.target, keyBase64: props.selected.base64, offset: request.offset, count: request.count }, controller.signal).then(response => {
      if (controller.signal.aborted) return
      if (response.ok) setResult(response.value)
      else setRpcError(true)
    }).catch(() => { if (!controller.signal.aborted) setRpcError(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [props.readGeo, props.target.id, props.target.generation, props.target.db, props.selected.base64, request])
  const row = result?.entries.find(entry => entry.member.base64 === selected)
  const columns: readonly CollectionColumn<GeoEntry>[] = [
    { id: 'rank', title: t('zset.rank'), render: entry => entry.rank },
    { id: 'member', title: t('set.member'), render: entry => <button type="button" data-geo-member={entry.member.base64} onClick={() => { setSelected(entry.member.base64) }}>{entry.member.label}<small>{entry.member.byteLength} {t('keys.bytes')}</small></button> },
    { id: 'score', title: t('zset.score'), render: entry => <span data-geo-score={entry.member.base64}>{entry.score}</span> },
    { id: 'longitude', title: t('geo.longitude'), render: entry => <span data-geo-longitude={entry.member.base64}>{entry.position?.longitude ?? t('geo.noPosition')}</span> },
    { id: 'latitude', title: t('geo.latitude'), render: entry => <span data-geo-latitude={entry.member.base64}>{entry.position?.latitude ?? t('geo.noPosition')}</span> },
  ]
  return <section className="redis-details" aria-label={t('geo.title')}>
    <h2>{t('geo.title')} · <span>{props.selected.label}</span></h2>
    <form onSubmit={event => {
      event.preventDefault()
      try { geoReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('zset.start')}<input name="geoOffset" required inputMode="numeric" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="geoCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
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

    {rangeError && <p role="alert" className="redis-error">{t('zset.rangeError')}</p>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {rpcError && <p role="alert" className="redis-error">{t('connection.error.rpc')}</p>}
    {cancelled && <p role="status">{t('connection.error.cancelled')}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('zset.total')}</dt><dd>{result.metadata.length}</dd></dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(result.error === 'oversize' ? 'geo.oversize' : `connection.error.${result.error}`)}</p> : result.state !== 'page' && <p role="status">{t(result.state === 'unavailable' ? 'geo.unavailable' : result.state === 'unsupported' ? 'geo.unsupported' : `value.state.${result.state}`)}</p>}
      {result.state === 'page' && <>
        <p role="status">{t('zset.start')}: <span data-geo-start>{result.offset}</span> · {t('zset.loaded')}: <span data-loaded-geo>{result.entries.length}</span></p>
        {result.entries.length === 0 ? <p>{t('geo.empty')}</p> : <CollectionTable rows={result.entries} identity={entry => entry.member.base64} columns={columns} label={t('geo.title')} />}
      </>}
    </>}
    {row !== undefined && <div className="redis-cell-preview">
      <h2>{t('set.member')} · {row.member.label}</h2><p>{t('zset.score')}: {row.score}</p>
      <label>{t('set.identity')}<textarea readOnly rows={2} value={row.member.base64} spellCheck={false} /></label>
      <BytePreview value={{ base64: row.member.base64, offset: '0', prefix: '', suffix: '', complete: true }} t={t} format={format} onFormatChange={setFormat} />
    </div>}
    <HelpDetails label={t('ui.help')}><p>{t('geo.hint')}</p><p>{t('geo.budget')}</p><p>{t('value.live')}</p></HelpDetails>
  </section>
}
