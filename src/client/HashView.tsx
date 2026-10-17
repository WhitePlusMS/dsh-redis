import { HelpDetails } from './HelpDetails.tsx'
import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, HashEntry, RedisKey, ScanHashRequest, ScanHashResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendHashEntries, emptyHashCache, type HashCache } from './hash-cache.ts'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { prefixWindow, cellLabel, displayLabel } from './collection-value.ts'
import { NS } from './locales.ts'
import { useCollectionScan } from './use-collection-scan.ts'

export interface HashActions { readonly scanHash: (request: ScanHashRequest, signal: AbortSignal) => Promise<RemoteResult<ScanHashResult>> }
type Props = HashActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }


/** One page per visible table end; the shared hook owns cancellation and bounds. */
export function HashView(props: Props) {
  const { t } = props
  const [pattern, setPattern] = useState('*')
  const [cell, setCell] = useState<{ field: string; column: 'field' | 'value' } | null>(null)
  const [format, setFormat] = useBrowsingFormat('hash')
  const scanState = useCollectionScan<HashCache, ScanHashResult>({ target: props.target, keyBase64: props.selected.base64, empty: emptyHashCache,
    append: (previous, page) => appendHashEntries(previous, page.entries),
    load: (cursor, signal) => props.scanHash({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  const selected = cell === null ? undefined : cache.rows.find(row => row.field.base64 === cell.field)
  const window = useMemo(() => selected === undefined || cell === null ? null : cell.column === 'value' ? prefixWindow(selected.value) : { base64: selected.field.base64, prefix: '', suffix: '', offset: '0', complete: true }, [selected, cell])
  const selectCell = (row: HashEntry, column: 'field' | 'value') => { setCell({ field: row.field.base64, column }) }

  function clear(): void {
    scanState.clear(); setCell(null)
  }
  function scan(more: boolean): void {
    if (!more) setCell(null)
    void scanState.scan(more)
  }

  const columns: readonly CollectionColumn<HashEntry>[] = [
    { id: 'field', title: t('hash.field'), render: row => <button type="button" data-hash-field={row.field.base64} onClick={() => selectCell(row, 'field')}>{displayLabel(row.field.label)}</button> },
    { id: 'value', title: t('hash.value'), render: row => <button type="button" data-hash-value={row.field.base64} onClick={() => selectCell(row, 'value')}>{cellLabel(row.value)}</button> },
  ]
  return <section className="redis-details" aria-label={t('hash.title')}>
    <h2>{t('hash.title')} · <span>{props.selected.label}</span></h2>
    <form onSubmit={event => { event.preventDefault(); void scan(false) }}>
      <label>{t('hash.pattern')}<input name="hashPattern" maxLength={256} value={pattern} onChange={event => { clear(); setPattern(event.target.value) }} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('keys.scan')}</button>
        {busy && <button type="button" onClick={scanState.cancel}>{t('keys.cancel')}</button>}
      </div>
    </form>

    <p role="status">{t('hash.loaded')}: <span data-loaded-fields>{cache.rows.length}</span> / {result?.metadata?.length ?? '?'} · {t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</p>
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('hash.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'hash.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {cache.rows.length === 0 && cursor === null ? <p>{t('hash.empty')}</p> : <CollectionTable rows={cache.rows} identity={row => row.field.base64} columns={columns} label={t('hash.title')} loading={busy} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />}
    {window !== null && selected !== undefined && cell !== null && <div className="redis-cell-preview">
      <h2>{t(cell.column === 'field' ? 'hash.field' : 'hash.value')} · {selected.field.label}</h2>
      <p role="status" data-cell-coverage>{t(window.complete ? 'value.complete' : 'value.partial')} · {cell.column === 'field' ? selected.field.byteLength : `${selected.value.byteLength}/${selected.value.fullByteLength}`} {t('keys.bytes')}</p>
      <label>{t('hash.identity')}<textarea readOnly rows={2} value={selected.field.base64} spellCheck={false} /></label>
      <BytePreview value={window} t={t} format={format} onFormatChange={setFormat} />
    </div>}
    <HelpDetails label={t('ui.help')}><p>{t('hash.hint')}</p><p>{t('hash.budget')}</p><p>{t('value.live')}</p></HelpDetails>
  </section>
}
