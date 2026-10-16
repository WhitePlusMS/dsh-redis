import { HelpDetails } from './HelpDetails.tsx'
import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, RedisKey, ScanSetRequest, ScanSetResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendKeys, emptyKeyCache, type KeyCache } from './key-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { NS } from './locales.ts'

export interface SetActions { readonly scanSet: (request: ScanSetRequest, signal: AbortSignal) => Promise<RemoteResult<ScanSetResult>> }
type Props = SetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Set members share complete byte identities and the existing bounded identity cache. */
export function SetView(props: Props) {
  const { t } = props
  const [pattern, setPattern] = useState('*'), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('set')
  const scanState = useCollectionScan<KeyCache, ScanSetResult>({ target: props.target, keyBase64: props.selected.base64, empty: emptyKeyCache,
    append: (previous, page) => appendKeys(previous, page.members),
    load: (cursor, signal) => props.scanSet({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  const member = cache.keys.find(value => value.base64 === selected)
  const window = useMemo(() => member === undefined ? null : { base64: member.base64, offset: '0', prefix: '', suffix: '', complete: true }, [member])
  const columns: readonly CollectionColumn<RedisKey>[] = [
    { id: 'member', title: t('set.member'), render: value => <button type="button" data-set-member={value.base64} onClick={() => { setSelected(value.base64) }}>{value.label}<small>{value.byteLength} {t('keys.bytes')}</small></button> },
  ]
  return <section className="redis-details" aria-label={t('set.title')}>
    <h2>{t('set.title')} · <span>{props.selected.label}</span></h2>
    <form onSubmit={event => { event.preventDefault(); setSelected(null); void scanState.scan(false) }}>
      <label>{t('set.pattern')}<input name="setPattern" maxLength={256} value={pattern} onChange={event => { scanState.clear(); setSelected(null); setPattern(event.target.value) }} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('keys.scan')}</button>
        <button type="button" disabled={busy || cursor === null || cache.limited} onClick={() => { void scanState.scan(true) }}>{t('keys.more')}</button>
        {busy && <button type="button" onClick={scanState.cancel}>{t('keys.cancel')}</button>}
      </div>
    </form>

    <p role="status">{t('set.loaded')}: <span data-loaded-members>{cache.keys.length}</span> · {t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</p>
    {result !== null && <>
      <small>{t('connection.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('set.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'set.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {busy && <p role="status">{t('connection.busy')}</p>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    {cache.keys.length === 0 ? <p>{t('set.empty')}</p> : <CollectionTable rows={cache.keys} identity={value => value.base64} columns={columns} label={t('set.title')} />}
    {member !== undefined && window !== null && <div className="redis-cell-preview">
      <h2>{t('set.member')} · {member.label}</h2>
      <p role="status" data-cell-coverage>{t('value.complete')} · {member.byteLength} {t('keys.bytes')}</p>
      <label>{t('set.identity')}<textarea readOnly rows={2} value={member.base64} spellCheck={false} /></label>
      <BytePreview value={window} t={t} format={format} onFormatChange={setFormat} />
    </div>}
    <HelpDetails label={t('ui.help')}><p>{t('set.hint')}</p><p>{t('set.budget')}</p><p>{t('value.live')}</p></HelpDetails>
  </section>
}
