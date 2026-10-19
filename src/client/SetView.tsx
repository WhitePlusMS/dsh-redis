import { useMemo, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, RedisKey, ScanSetRequest, ScanSetResult } from '../domain.ts'
import { BytePreview } from './BytePreview.tsx'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { appendKeys, emptyKeyCache, type KeyCache } from './key-cache.ts'
import { useCollectionScan } from './use-collection-scan.ts'
import { useBrowsingFormat } from './PreviewFormats.tsx'
import { displayLabel } from './collection-value.ts'
import { NS } from './locales.ts'
import { Icon } from './Icon.tsx'
import { PresentKeyMetadata } from './KeyPresentation.tsx'
import { ReadActions, QueryToggle, ScanProgress } from './ReadControls.tsx'
import { useCurrentItem } from './CurrentSelection.tsx'

export interface SetActions { readonly scanSet: (request: ScanSetRequest, signal: AbortSignal) => Promise<RemoteResult<ScanSetResult>> }
type Props = SetActions & { readonly target: DatabaseTarget; readonly selected: RedisKey; readonly t: TranslateNS<typeof NS> }

/** Set members share complete byte identities and the existing bounded identity cache. */
export function SetView(props: Props) {
  const { t } = props
  const [pattern, setPattern] = useState('*'), [selected, setSelected] = useState<string | null>(null), [format, setFormat] = useBrowsingFormat('set')
  const [draft, setDraft] = useState('*')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const scanState = useCollectionScan<KeyCache, ScanSetResult>({ target: props.target, keyBase64: props.selected.base64, queryKey: pattern, empty: emptyKeyCache,
    append: (previous, page) => appendKeys(previous, page.members),
    load: (cursor, signal) => props.scanSet({ target: props.target, keyBase64: props.selected.base64, pattern, cursor }, signal),
  })
  const { cache, result, cursor, busy, error, progress } = scanState
  const member = cache.keys.find(value => value.base64 === selected)
  useCurrentItem(member === undefined ? null : { kind: 'set', memberBase64: member.base64 })
  const window = useMemo(() => member === undefined ? null : { base64: member.base64, offset: '0', prefix: '', suffix: '', complete: true }, [member])
  const columns: readonly CollectionColumn<RedisKey>[] = [
    { id: 'number', title: '#', render: (_value, index) => index + 1 },
    { id: 'member', title: t('set.member'), render: value => <span data-set-member={value.base64} title={displayLabel(value.label)}>{value.byteLength === 0 ? t('collection.emptyMember') : displayLabel(value.label)}</span> },
  ]
  return <section className="redis-details redis-collection-workbench" aria-label={t('set.title')}>
    <PresentKeyMetadata value={result?.metadata ?? null} />
    <h2>{t('set.title')} · <span>{props.selected.label}</span></h2>
    <div className="redis-view-tools"><ReadActions t={t} busy={busy} label={t('keys.scan')} refresh={() => { void scanState.scan(false) }} cancel={scanState.cancel}><QueryToggle icon="filter" label={t('set.pattern')} open={optionsOpen} active={pattern !== '*'} toggle={() => setOptionsOpen(!optionsOpen)} /></ReadActions></div>
    {optionsOpen && <form className="redis-collection-controls" onSubmit={event => { event.preventDefault(); setSelected(null); setOptionsOpen(false); if (draft === pattern) void scanState.scan(false); else setPattern(draft) }}>
      <label>{t('set.pattern')}<input name="setPattern" maxLength={256} value={draft} spellCheck={false} onChange={event => setDraft(event.target.value)} /></label>
      <div className="redis-actions">
        <button type="submit" disabled={busy}>{t('workbench.apply')}</button>
      </div>
    </form>}

    {result !== null && <>

      {result.metadata !== null && <dl className="redis-metadata redis-key-metadata"><dt>TYPE</dt><dd>{result.metadata.type}</dd><dt>TTL (ms)</dt><dd>{result.metadata.ttlMs === '-1' ? t('value.persistent') : result.metadata.ttlMs}</dd>{result.metadata.length !== null && <><dt>{t('set.total')}</dt><dd>{result.metadata.length}</dd></>}</dl>}
      {result.state !== 'page' && result.state !== 'failed' && <p role="status">{t(result.state === 'unsupported' ? 'set.unsupported' : `value.state.${result.state}`)}</p>}
    </>}
    {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
    <div className="redis-collection-summary"><ScanProgress t={t} busy={busy} progress={progress} /><span title={`${t('set.loaded')} / ${t('set.total')}`}><b data-loaded-members>{cache.keys.length}</b>{pattern === '*' ? ' / ' : ' · ' + t('set.total') + ' '}{result?.metadata?.length ?? '—'}</span>{pattern !== '*' && <span className="redis-filter-chip"><button type="button" title={t('set.pattern')} onClick={() => setOptionsOpen(true)}><Icon name="filter" /><span>{pattern}</span></button><button type="button" className="redis-icon-button" title={t('read.clearFilter')} aria-label={t('read.clearFilter')} onClick={() => { setSelected(null); setDraft('*'); setPattern('*') }}><Icon name="close" /></button></span>}</div>
    <div className="redis-collection-body">
      <CollectionTable rows={cache.keys} identity={value => value.base64} columns={columns} label={t('set.title')} loading={busy} emptyMessage={t(busy ? 'connection.busy' : 'set.empty')} selection={{ id: member?.base64 ?? null, onSelect: value => setSelected(value.base64) }} onEnd={cursor === null || cache.limited || error !== null ? undefined : () => scanState.scan(true)} />
      <section className="redis-collection-preview" aria-label={t('set.member')}>
        {member !== undefined && window !== null ? <BytePreview key={member.base64} heading={{ label: t('set.member'), description: `${member.byteLength} ${t('keys.bytes')}` }} value={window} t={t} format={format} onFormatChange={setFormat} /> : <><strong>{t('set.member')}</strong><p>{t(selected === null ? 'collection.selectRow' : 'collection.selectionAbsent')}</p></>}
      </section>
    </div>
  </section>
}
