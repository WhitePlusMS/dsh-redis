import { useCollectionScan } from './use-collection-scan.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'
import { HelpDetails } from './HelpDetails.tsx'
import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_LIST_ITEMS, type DatabaseTarget, type ListEntry, type ListReadRequest, type ListReadResult, type RedisKey } from '../domain.ts'
import { listReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { DetailPage } from './DetailPage.tsx'
import { prefixWindow, cellLabel } from './collection-value.ts'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'

export interface ListActions { readonly readList: (request: ListReadRequest, signal: AbortSignal) => Promise<RemoteResult<ListReadResult>> }
type Props = ListActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Scroll appends bounded live ranges, retaining original list positions. */
export function ListView(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [request, setRequest] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 })
  const [rangeError, setRangeError] = useState(false), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('list')
  const page = useCollectionScan<RowCache<ListEntry>, ListReadResult & { readonly cursor: string | null }>({
    target: props.target, keyBase64: props.selected.base64, queryKey: JSON.stringify(request), empty: emptyRowCache,
    append: (previous, value) => appendRows(previous, value.entries, row => row.index),
    load: async (cursor, signal) => {
      const response = await props.readList({ target: props.target, keyBase64: props.selected.base64, offset: cursor ?? request.offset, count: request.count }, signal)
      return response.ok ? { ...response, value: { ...response.value, cursor: response.value.nextOffset } } : response
    },
  })
  const { cache, result, busy, error, cursor, progress } = page
  const row = cache.rows.find(entry => entry.index === selected)
  const window = useMemo(() => row === undefined ? null : prefixWindow(row.value), [row])
  const columns: readonly CollectionColumn<ListEntry>[] = [
    { id: 'index', title: t('list.index'), render: entry => entry.index },
    { id: 'value', title: t('hash.value'), render: entry => <button type="button" data-list-index={entry.index} onClick={() => { setSelected(entry.index) }}>{cellLabel(entry.value)}<small>{entry.value.byteLength}/{entry.value.fullByteLength} {t('keys.bytes')}</small></button> },
  ]
  return <section className="redis-details" aria-label={t('list.title')} data-cell-open={window !== null}>
    <h2>{t('list.title')} · <span>{props.selected.label}</span></h2>
    <form onSubmit={event => {
      event.preventDefault()
      try { setSelected(null); listReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('list.start')}<input name="listOffset" required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="listCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="redis-actions">
        <button type="submit">{t('value.refresh')}</button>
        {busy && <button type="button" onClick={page.cancel}>{t('keys.cancel')}</button>}
      </div>
    </form>

    <p role="status">{t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</p>
    {rangeError && <p role="alert" className="redis-error">{t('list.rangeError')}</p>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('list.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state === 'failed' && result.error !== null ? <p role="alert" className="redis-error">{t(`connection.error.${result.error}`)}</p> : result.state !== 'page' && <p role="status">{t(result.state === 'unsupported' ? 'list.unsupported' : `value.state.${result.state}`)}</p>}
      {result.state === 'page' && <>
        <p role="status" data-list-coverage>{t('list.start')}: <span data-list-start>{request.offset}</span> · {t('list.returned')}: <span data-list-count>{cache.rows.length}</span></p>
        {cache.rows.length === 0 && cursor === null ? <p>{t('list.empty')}</p> : <CollectionTable rows={cache.rows} identity={entry => entry.index} columns={columns} label={t('list.title')} loading={busy} paused={window !== null} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />}
      </>}
    </>}
    {row !== undefined && window !== null && <DetailPage title={`${t('list.index')} ${row.index}`} backLabel={t('detail.back')} onBack={() => setSelected(null)}>
      <p role="status" data-cell-coverage>{t(window.complete ? 'value.complete' : 'value.partial')} · {row.value.byteLength}/{row.value.fullByteLength} {t('keys.bytes')}</p>
      <BytePreview value={window} t={t} format={format} onFormatChange={setFormat} />
    </DetailPage>}
    <HelpDetails label={t('ui.help')}><p>{t('list.hint')}</p><p>{t('list.budget')}</p><p>{t('value.live')}</p></HelpDetails>
  </section>
}
