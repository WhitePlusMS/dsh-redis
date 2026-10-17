import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_LIST_ITEMS, type DatabaseTarget, type RedisKey, type ZSetEntry, type ZSetReadRequest, type ZSetReadResult } from '../domain.ts'
import { zsetReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { displayLabel } from './collection-value.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { appendZSetRows, emptyZSetCache, type ZSetCache } from './zset-cache.ts'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'
import { GeoView, type GeoActions } from './GeoView.tsx'

export interface ZSetActions extends GeoActions { readonly readZSet: (request: ZSetReadRequest, signal: AbortSignal) => Promise<RemoteResult<ZSetReadResult>> }
type Props = ZSetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Each mode owns its pagination. A ZSCAN token is never a rank offset. */
export function ZSetView(props: Props) {
  const { t } = props
  const [geo, setGeo] = useState(false)
  const [mode, setMode] = useState<'range' | 'scan'>('range'), [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [range, setRange] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 }), [pattern, setPattern] = useState('*')
  const [draft, setDraft] = useState('*')
  const [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('zset'), [rangeError, setRangeError] = useState(false)
  const scanState = useCollectionScan<ZSetCache, ZSetReadResult>({ active: !geo, target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify([mode, range, pattern]), empty: emptyZSetCache,
    append: (previous, page) => appendZSetRows(previous, page.entries),
    load: async (cursor, signal) => {
      const response = await props.readZSet(mode === 'range' ? { target: props.target, keyBase64: props.selected.base64, mode, offset: cursor ?? range.offset, count: range.count } : { target: props.target, keyBase64: props.selected.base64, mode, pattern, cursor }, signal)
      // Rank offsets remain local; only SCAN cursors are sent to the SCAN endpoint.
      return response.ok && response.value.mode === 'range' ? { ...response, value: { ...response.value, cursor: response.value.nextOffset } } : response
    },
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  const row = cache.rows.find(entry => entry.member.base64 === selected)
  const window = useMemo(() => row === undefined ? null : { base64: row.member.base64, offset: '0', prefix: '', suffix: '', complete: true }, [row])
  const columns: readonly CollectionColumn<ZSetEntry>[] = [
    ...(mode === 'range' ? [{ id: 'rank', title: t('zset.rank'), render: (entry: ZSetEntry) => entry.rank }] : []),
    { id: 'member', title: t('set.member'), render: entry => <span data-zset-member={entry.member.base64} title={displayLabel(entry.member.label)}>{entry.member.byteLength === 0 ? t('collection.emptyMember') : displayLabel(entry.member.label)}</span> },
    { id: 'score', title: t('zset.score'), render: entry => <span data-zset-score={entry.member.base64}>{entry.score}</span> },
  ]
  if (geo) return <>
    <button type="button" onClick={() => { setGeo(false); setRange({ ...range, attempt: range.attempt + 1 }) }}>{t('geo.back')}</button>
    <GeoView {...props} />
  </>
  return <section className="redis-details redis-collection-workbench" aria-label={t('zset.title')}>
    <h2>{t('zset.title')} · <span>{props.selected.label}</span></h2>
    <form className="redis-collection-controls" onSubmit={event => {
      event.preventDefault()
      if (mode === 'scan') { setSelected(null); if (draft === pattern) void scanState.scan(false); else setPattern(draft); return }
      try { zsetReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, mode, offset, count }); setSelected(null); setRangeError(false); setRange({ offset, count, attempt: range.attempt + 1 }) }
      catch { setRangeError(true) }
    }}>
      <label>{t('zset.mode')}<select name="zsetMode" value={mode} onChange={event => { setSelected(null); setRangeError(false); setMode(event.target.value === 'scan' ? 'scan' : 'range') }}><option value="range">{t('zset.range')}</option><option value="scan">{t('zset.scan')}</option></select></label>
      {mode === 'range' ? <div className="redis-address">
        <label>{t('zset.start')}<input name="zsetOffset" required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="zsetCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div> : <label>{t('set.pattern')}<input name="zsetPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>}
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t(mode === 'range' ? 'value.refresh' : 'keys.scan')}</button>
        <button type="button" disabled={busy} onClick={() => { scanState.cancel(); setSelected(null); setGeo(true) }}>{t('geo.open')}</button>
        {busy && <button type="button" onClick={scanState.cancel}>{t('keys.cancel')}</button>}
      </div>
    </form>
    {rangeError && <p role="alert" className="redis-error">{t('zset.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>
      <small className="redis-collection-time">{t('hash.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd><dt>{t('zset.total')}</dt><dd>{result.metadata.length}</dd></dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'zset.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    <div className="redis-collection-summary" role="status"><span>{t('zset.loaded')}: <b data-loaded-zset>{cache.rows.length}</b></span><span>{t('zset.total')}: {result?.metadata?.length ?? t('workbench.unknown')}</span>{mode === 'range' && <span>{t('zset.start')}: <b data-zset-start>{range.offset}</b></span>}{result?.metadata && <span>TTL: {result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs + ' ms'}</span>}<span>{busy ? t('connection.busy') : t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</span>{mode === 'scan' && pattern !== '*' && <span>MATCH {pattern}</span>}</div>
    <div className="redis-collection-body">
      <CollectionTable rows={cache.rows} identity={entry => entry.member.base64} columns={columns} label={t('zset.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'zset.empty')} selection={{ id: row?.member.base64 ?? null, onSelect: entry => setSelected(entry.member.base64) }} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      <section className="redis-collection-preview" aria-label={t('set.member')}>
        {row !== undefined && window !== null ? <BytePreview key={row.member.base64} heading={{ label: t('set.member'), description: `${row.member.byteLength} ${t('keys.bytes')} · ${t('zset.score')}: ${row.score}` }} value={window} t={t} format={format} onFormatChange={setFormat} /> : <><strong>{t('set.member')}</strong><p>{t('collection.selectRow')}</p></>}
      </section>
    </div>
  </section>
}
