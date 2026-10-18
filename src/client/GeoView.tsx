import { useCollectionScan } from './use-collection-scan.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'
import { useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MAX_LIST_ITEMS, type DatabaseTarget, type GeoEntry, type GeoReadRequest, type GeoReadResult, type RedisKey } from '../domain.ts'
import { geoReadRequestSchema } from '../typert.shared.ts'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { BytePreview } from './BytePreview.tsx'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'

export interface GeoActions { readonly readGeo: (request: GeoReadRequest, signal: AbortSignal) => Promise<RemoteResult<GeoReadResult>> }
type Props = GeoActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Scroll reads bounded coordinate ranges with original rank and byte identity. */
export function GeoView(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [request, setRequest] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 })
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [rangeError, setRangeError] = useState(false), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('geo')
  const page = useCollectionScan<RowCache<GeoEntry>, GeoReadResult & { readonly cursor: string | null }>({
    target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify(request), empty: emptyRowCache,
    append: (previous, value) => appendRows(previous, value.entries, row => row.member.base64),
    load: async (cursor, signal) => {
      const response = await props.readGeo({ target: props.target, keyBase64: props.selected.base64, offset: cursor ?? request.offset, count: request.count }, signal)
      return response.ok ? { ...response, value: { ...response.value, cursor: response.value.nextOffset } } : response
    },
  })
  const { cache, result, busy, error, cursor, progress } = page
  const row = cache.rows.find(entry => entry.member.base64 === selected)
  const columns: readonly CollectionColumn<GeoEntry>[] = [
    { id: 'rank', title: t('zset.rank'), render: entry => entry.rank },
    { id: 'member', title: t('set.member'), render: entry => <button type="button" data-geo-member={entry.member.base64} onClick={() => { setSelected(entry.member.base64) }}>{entry.member.label}<small>{entry.member.byteLength} {t('keys.bytes')}</small></button> },
    { id: 'score', title: t('zset.score'), render: entry => <span data-geo-score={entry.member.base64}>{entry.score}</span> },
    { id: 'longitude', title: t('geo.longitude'), render: entry => <span data-geo-longitude={entry.member.base64}>{entry.position?.longitude ?? t('geo.noPosition')}</span> },
    { id: 'latitude', title: t('geo.latitude'), render: entry => <span data-geo-latitude={entry.member.base64}>{entry.position?.latitude ?? t('geo.noPosition')}</span> },
  ]
  return <section className="redis-details" aria-label={t('geo.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('geo.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><span className="redis-chip" title={t('geo.interpretation')}>GEO · {t('geo.quantized')}</span><ReadActions t={t} busy={busy} refresh={() => { setSelected(null); page.scan(false) }} cancel={page.cancel}><QueryToggle label={t('read.range')} open={optionsOpen} active={request.offset !== '0'} toggle={() => setOptionsOpen(value => !value)} /></ReadActions></div>
    <p>{t('geo.interpretation')}</p>
    {optionsOpen && <form onSubmit={event => {
      event.preventDefault()
      try { geoReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setSelected(null); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('zset.start')}<input name="geoOffset" required inputMode="numeric" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="geoCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {rangeError && <p role="alert" className="redis-error">{t('zset.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(error === 'oversize' ? 'geo.oversize' : `connection.error.${error}`)}</p>}
    {result !== null && <>
      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('zset.total')}</dt><dd>{result.metadata.length}</dd></dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unavailable' ? 'geo.unavailable' : result.state === 'unsupported' ? 'geo.unsupported' : `value.state.${result.state}`)}</p>}
      {result.state === 'page' && <>
        <div className="redis-collection-state"><ScanProgress t={t} busy={busy} progress={progress} /><b data-loaded-geo>{cache.rows.length}</b> {t('read.items')}<span className="redis-chip">#<span data-geo-start>{request.offset}</span></span></div>
        {cache.rows.length === 0 && cursor === null ? <p>{t('geo.empty')}</p> : <CollectionTable rows={cache.rows} identity={entry => entry.member.base64} columns={columns} label={t('geo.title')} loading={busy} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />}
      </>}
    </>}
    {row !== undefined && <div className="redis-cell-preview">
      <h2>{t('set.member')} · {row.member.label}</h2><p>{t('zset.score')}: {row.score}</p>
      <details className="redis-byte-identity"><summary>{t('set.identity')}</summary><textarea aria-label={t('set.identity')} readOnly rows={2} value={row.member.base64} spellCheck={false} /></details>
      <BytePreview value={{ base64: row.member.base64, offset: '0', prefix: '', suffix: '', complete: true }} t={t} format={format} onFormatChange={setFormat} />
    </div>}
  </section>
}
