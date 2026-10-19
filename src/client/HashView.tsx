import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, HashEntry, PreviewFormat, RedisKey, ScanHashRequest, ScanHashResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendHashEntries, emptyHashCache, type HashCache } from './hash-cache.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { prefixWindow, cellLabel, displayLabel } from './collection-value.ts'
import { NS } from './locales.ts'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCollectionScan } from './use-collection-scan.ts'
import { previewValue } from './value-preview.ts'
import { Icon } from './Icon.tsx'
import { useCurrentItem } from './CurrentSelection.tsx'

export interface HashActions { readonly scanHash: (request: ScanHashRequest, signal: AbortSignal) => Promise<RemoteResult<ScanHashResult>> }
type Props = HashActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

const fieldWindow = (row: HashEntry) => ({ base64: row.field.base64, prefix: '', suffix: '', offset: '0', complete: true })

/** RESP-style row selection changes only local previews. The shared reader owns
 * cancellation, raw field identities and one continuation per visible table end.
 */
export function HashView(props: Props) {
  const { t } = props
  const [pattern, setPattern] = useState('*')
  const [draft, setDraft] = useState('*'), [filterOpen, setFilterOpen] = useState(false)
  const [search, setSearch] = useState(''), [selectedField, setSelectedField] = useState<string | null>(null)
  const [fieldFormat, setFieldFormat] = useState<PreviewFormat>('text')
  const [format, setFormat] = useBrowsingFormat('hash')
  const scanState = useCollectionScan<HashCache, ScanHashResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: pattern, empty: emptyHashCache,
    append: (previous, page) => appendHashEntries(previous, page.entries),
    load: (cursor, signal) => props.scanHash({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  // Search only cached bytes, including values beyond the abbreviated table label.
  // While searching locally, the bottom observer must not start more Redis reads.
  const rows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    return needle === '' ? cache.rows : cache.rows.filter(row => {
      const field = previewValue(fieldWindow(row), 'text'), value = previewValue(prefixWindow(row.value), 'text')
      return [field.error === null ? field.text : row.field.base64, value.error === null ? value.text : row.value.base64].some(text => text.toLocaleLowerCase().includes(needle))
    })
  }, [cache.rows, search])
  const selected = rows.find(row => row.field.base64 === selectedField)
  useCurrentItem(selected === undefined ? null : { kind: 'hash', fieldBase64: selected.field.base64 })
  const windows = useMemo(() => selected === undefined ? null : { field: fieldWindow(selected), value: prefixWindow(selected.value) }, [selected])
  function refresh(): void { void scanState.scan(false) }
  function applyPattern(value: string): void {
    setSelectedField(null); setSearch(''); setFilterOpen(false)
    if (value === pattern) refresh()
    else setPattern(value)
  }
  const columns: readonly CollectionColumn<HashEntry>[] = [
    { id: 'number', title: '#', render: (_row, index) => index + 1 },
    { id: 'field', title: t('hash.field'), render: row => <span data-hash-field={row.field.base64} title={displayLabel(row.field.label)}>{row.field.byteLength === 0 ? t('hash.emptyField') : displayLabel(row.field.label)}</span> },
    { id: 'value', title: t('hash.value'), render: row => <span data-hash-value={row.field.base64} title={cellLabel(row.value)}>{row.value.fullByteLength === 0 ? t('hash.emptyValue') : cellLabel(row.value)}</span> },
  ]
  const searching = search.trim() !== ''
  const empty = t(busy ? 'connection.busy' : error !== null ? 'hash.noRead' : searching ? 'hash.noMatches' : 'hash.empty')
  return <section className="redis-details redis-hash-workbench" aria-label={t('hash.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('hash.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-hash-controls">
      <input name="hashSearch" maxLength={256} aria-label={t('hash.search')} placeholder={t('hash.search')} value={search} spellCheck={false} onChange={event => setSearch(event.target.value)} />
      {search !== '' && <button type="button" className="redis-icon-button" title={t('hash.clearSearch')} aria-label={t('hash.clearSearch')} onClick={() => setSearch('')}><Icon name="close" /></button>}
      <ReadActions t={t} busy={busy} refresh={refresh} cancel={scanState.cancel} label={t('hash.refresh')}><QueryToggle icon="filter" label={t('hash.filter')} open={filterOpen} active={pattern !== '*'} toggle={() => setFilterOpen(!filterOpen)} /></ReadActions>
    </div>
    {filterOpen && <form className="redis-hash-filter" onSubmit={event => { event.preventDefault(); applyPattern(draft) }}>
      <label>{t('hash.pattern')}<input name="hashPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
      <div className="redis-actions"><button type="submit" disabled={busy}>{t('workbench.apply')}</button><button type="button" disabled={busy} onClick={() => { setDraft('*'); applyPattern('*') }}>{t('hash.resetFilter')}</button></div>
    </form>}
    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('hash.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'hash.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    <div className="redis-hash-summary"><ScanProgress t={t} busy={busy} progress={progress} /><span title={`${t('hash.loaded')}: ${cache.rows.length} · ${t('hash.total')}: ${result?.metadata?.length ?? t('workbench.unknown')}`}><b data-loaded-fields>{cache.rows.length}</b>{pattern === '*' ? ' / ' : ' · ' + t('hash.total') + ' '}{result?.metadata?.length ?? '—'}</span>{searching && <span className="redis-chip" title={t('hash.localSearch')}>{t('read.local')} {rows.length}</span>}{pattern !== '*' && <span className="redis-filter-chip"><button type="button" title={t('hash.pattern')} onClick={() => setFilterOpen(true)}><Icon name="filter" /><span>{pattern}</span></button><button type="button" className="redis-icon-button" title={t('read.clearFilter')} aria-label={t('read.clearFilter')} onClick={() => { setDraft('*'); applyPattern('*') }}><Icon name="close" /></button></span>}</div>
    <div className="redis-hash-body">
      <CollectionTable rows={rows} identity={row => row.field.base64} columns={columns} label={t('hash.title')} loading={busy} emptyMessage={empty} selection={{ id: selected?.field.base64 ?? null, onSelect: row => setSelectedField(row.field.base64) }} onEnd={searching || cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      <section className="redis-hash-preview redis-hash-field" aria-label={t('hash.field')}>
        {windows !== null && selected !== undefined ? <BytePreview key={selected.field.base64} heading={{ label: t('hash.field'), description: `${selected.field.byteLength} ${t('keys.bytes')}` }} value={windows.field} t={t} format={fieldFormat} onFormatChange={setFieldFormat} /> : <><strong>{t('hash.field')}</strong><p>{t(selectedField === null ? 'hash.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
      <section className="redis-hash-preview redis-hash-value" aria-label={t('hash.value')}>
        {windows !== null && selected !== undefined ? <BytePreview key={selected.field.base64} heading={{ label: t('hash.value'), description: windows.value.complete ? `${selected.value.fullByteLength} ${t('keys.bytes')}` : `${selected.value.byteLength}/${selected.value.fullByteLength} ${t('keys.bytes')} · ${t('value.partial')}` }} value={windows.value} t={t} format={format} onFormatChange={setFormat} /> : <strong>{t('hash.value')}</strong>}
      </section>
    </div>
  </section>
}
