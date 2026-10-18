import { useCollectionScan } from './use-collection-scan.ts'
import { appendRows, emptyRowCache, type RowCache } from './row-cache.ts'
import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { MAX_LIST_ITEMS, type DatabaseTarget, type ListEntry, type ListReadRequest, type ListReadResult, type RedisKey } from '../domain.ts'
import { listReadRequestSchema } from '../typert.shared.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { prefixWindow, cellLabel } from './collection-value.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'

export interface ListActions { readonly readList: (request: ListReadRequest, signal: AbortSignal) => Promise<RemoteResult<ListReadResult>> }
type Props = ListActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Scroll appends bounded live ranges, retaining original list positions. */
export function ListView(props: Props) {
  const { t } = props
  const [offset, setOffset] = useState('0'), [count, setCount] = useState(MAX_LIST_ITEMS)
  const [request, setRequest] = useState({ offset: '0', count: MAX_LIST_ITEMS, attempt: 0 })
  const [rangeError, setRangeError] = useState(false), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('list')
  const [optionsOpen, setOptionsOpen] = useState(false)
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
    { id: 'value', title: t('hash.value'), render: entry => <span data-list-index={entry.index} title={cellLabel(entry.value)}>{entry.value.fullByteLength === 0 ? t('hash.emptyValue') : cellLabel(entry.value)}</span> },
  ]
  return <section className="redis-details redis-collection-workbench" aria-label={t('list.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('list.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} refresh={() => { setSelected(null); void page.scan(false) }} cancel={page.cancel}><QueryToggle label={t('read.range')} open={optionsOpen} active={request.offset !== '0'} toggle={() => setOptionsOpen(!optionsOpen)} /></ReadActions></div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => {
      event.preventDefault()
      try { listReadRequestSchema.parse({ target: props.target, keyBase64: props.selected.base64, offset, count }); setSelected(null); setRangeError(false); setRequest({ offset, count, attempt: request.attempt + 1 }); setOptionsOpen(false) }
      catch { setRangeError(true) }
    }}>
      <div className="redis-address">
        <label>{t('list.start')}<input name="listOffset" required inputMode="numeric" pattern="(?:0|[1-9][0-9]{0,18})" maxLength={19} value={offset} onChange={event => setOffset(event.target.value)} /></label>
        <label>{t('list.count')}<select name="listCount" value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, MAX_LIST_ITEMS].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {rangeError && <p role="alert" className="redis-error">{t('list.rangeError')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('list.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'list.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    <div className="redis-collection-summary" data-list-coverage><ScanProgress t={t} busy={busy} progress={progress} /><span title={t('list.returned')}><b data-list-count>{cache.rows.length}</b>{request.offset === '0' ? ' / ' + (result?.metadata?.length ?? '—') : ' ' + t('read.items')}</span><span title={t('list.index')}>#<b data-list-start>{request.offset}</b>{cache.rows.length > 0 ? '–' + cache.rows[cache.rows.length - 1]!.index : ''}</span></div>
    <div className="redis-collection-body">
      <CollectionTable rows={cache.rows} identity={entry => entry.index} columns={columns} label={t('list.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'list.empty')} selection={{ id: row?.index ?? null, onSelect: entry => setSelected(entry.index) }} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => page.scan(true)} />
      <section className="redis-collection-preview" aria-label={t('hash.value')}>
        {row !== undefined && window !== null ? <BytePreview key={row.index} heading={{ label: t('hash.value'), description: `${t('list.index')} ${row.index} · ${row.value.byteLength}/${row.value.fullByteLength} ${t('keys.bytes')}${window.complete ? '' : ' · ' + t('value.partial')}` }} value={window} t={t} format={format} onFormatChange={setFormat} /> : <><strong>{t('hash.value')}</strong><p>{t('collection.selectRow')}</p></>}
      </section>
    </div>
  </section>
}
