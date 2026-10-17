import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, RedisKey, ScanSetRequest, ScanSetResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendKeys, emptyKeyCache, type KeyCache } from './key-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { useBrowsingFormat } from './BrowsingSession.tsx'
import { displayLabel } from './collection-value.ts'
import { NS } from './locales.ts'

export interface SetActions { readonly scanSet: (request: ScanSetRequest, signal: AbortSignal) => Promise<RemoteResult<ScanSetResult>> }
type Props = SetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Set members share complete byte identities and the existing bounded identity cache. */
export function SetView(props: Props) {
  const { t } = props
  const [pattern, setPattern] = useState('*'), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('set')
  const [draft, setDraft] = useState('*')
  const scanState = useCollectionScan<KeyCache, ScanSetResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: pattern, empty: emptyKeyCache,
    append: (previous, page) => appendKeys(previous, page.members),
    load: (cursor, signal) => props.scanSet({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  const member = cache.keys.find(value => value.base64 === selected)
  const window = useMemo(() => member === undefined ? null : { base64: member.base64, offset: '0', prefix: '', suffix: '', complete: true }, [member])
  const columns: readonly CollectionColumn<RedisKey>[] = [
    { id: 'number', title: '#', render: (_value, index) => index + 1 },
    { id: 'member', title: t('set.member'), render: value => <span data-set-member={value.base64} title={displayLabel(value.label)}>{value.byteLength === 0 ? t('collection.emptyMember') : displayLabel(value.label)}</span> },
  ]
  return <section className="redis-details redis-collection-workbench" aria-label={t('set.title')}>
    <h2>{t('set.title')} · <span>{props.selected.label}</span></h2>
    <form className="redis-collection-controls" onSubmit={event => { event.preventDefault(); setSelected(null); if (draft === pattern) void scanState.scan(false); else setPattern(draft) }}>
      <label>{t('set.pattern')}<input name="setPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('keys.scan')}</button>
        {busy && <button type="button" onClick={scanState.cancel}>{t('keys.cancel')}</button>}
      </div>
    </form>

    {result !== null && <>
      <small className="redis-collection-time">{t('hash.sampledAt')} <time dateTime={result.sampledAt}>{new Date(result.sampledAt).toLocaleTimeString()}</time></small>
      {result.metadata !== null && <dl className="redis-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('set.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'set.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    <div className="redis-collection-summary" role="status"><span>{t('set.loaded')}: <b data-loaded-members>{cache.keys.length}</b></span><span>{t('set.total')}: {result?.metadata?.length ?? t('workbench.unknown')}</span>{result?.metadata && <span>TTL: {result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs + ' ms'}</span>}<span>{busy ? t('connection.busy') : t(`keys.${progress === 'more' ? 'moreState' : progress}`)}</span>{pattern !== '*' && <span>MATCH {pattern}</span>}</div>
    <div className="redis-collection-body">
      <CollectionTable rows={cache.keys} identity={value => value.base64} columns={columns} label={t('set.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'set.empty')} selection={{ id: member?.base64 ?? null, onSelect: value => setSelected(value.base64) }} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      <section className="redis-collection-preview" aria-label={t('set.member')}>
        {member !== undefined && window !== null ? <BytePreview key={member.base64} heading={{ label: t('set.member'), description: `${member.byteLength} ${t('keys.bytes')}` }} value={window} t={t} format={format} onFormatChange={setFormat} /> : <><strong>{t('set.member')}</strong><p>{t('collection.selectRow')}</p></>}
      </section>
    </div>
  </section>
}
