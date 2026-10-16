import { Fragment, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientListEntry, ClientListField, ClientListReadRequest, ClientListReadResult, DatabaseTarget } from '../domain.ts'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { SnapshotDialog } from './SnapshotDialog.tsx'
import { NS } from './locales.ts'
export interface ClientListActions { readonly readClients: (request: ClientListReadRequest, signal: AbortSignal) => Promise<RemoteResult<ClientListReadResult>> }
type Props = ClientListActions & { readonly target: DatabaseTarget; readonly t: TranslateNS<typeof NS> }
const detailFields = ['user', 'flags', 'qbuf', 'omem', 'sub', 'psub', 'ssub'] as const
interface Row { readonly index: number; readonly entry: ClientListEntry }
/** Selection is local to this one snapshot; inspecting a row never reads Redis. */
function ClientTable({ snapshot, t }: { readonly snapshot: ClientListReadResult; readonly t: TranslateNS<typeof NS> }) {
  const [selected, setSelected] = useState<number | null>(null)
  const rows = snapshot.entries.map((entry, index) => ({ entry, index }))
  function value(entry: ClientListEntry, field: ClientListField): string {
    const text = entry[field]
    if (text === null) return t('overview.unreported')
    if (text === '') return t('clients.unset')
    const unit = field === 'age' || field === 'idle' ? ' s' : field === 'qbuf' || field === 'omem' ? ' B' : field === 'sub' || field === 'psub' || field === 'ssub' ? ' ' + t('clients.subscriptions') : ''
    return text + unit
  }
  const columns: readonly CollectionColumn<Row>[] = [
    { id: 'id', title: t('clients.field.id'), render: row => <span data-client-id={row.entry.id ?? undefined}>{value(row.entry, 'id')}</span> },
    { id: 'address', title: t('clients.field.addr'), render: row => <button type="button" data-client-index={row.index} aria-pressed={selected === row.index} aria-label={t('clients.inspect') + ' ' + (row.entry.id ?? String(row.index + 1))} onClick={() => setSelected(row.index)}>{value(row.entry, 'addr')}</button> },
    ...(['name', 'db', 'age', 'idle', 'cmd'] as const).map(field => ({ id: field, title: t(`clients.field.${field}`), render: (row: Row) => value(row.entry, field) })),
  ]
  const entry = selected === null ? null : snapshot.entries[selected]
  return <>
    <p role="status" data-client-coverage>{snapshot.entries.length} / {snapshot.total} {t('clients.returned')} · {t(snapshot.limited ? 'clients.limited' : 'clients.complete')}</p>
    {snapshot.entries.length === 0 ? <p>{t('clients.empty')}</p> : <CollectionTable rows={rows} identity={row => String(row.index)} columns={columns} label={t('clients.title')} />}
    {entry !== null && entry !== undefined && <section className="redis-client-details" aria-label={t('clients.details')}><h2>{t('clients.details')} · {value(entry, 'id')}</h2><dl className="redis-metadata">{detailFields.map(field => <Fragment key={field}><dt>{t(`clients.field.${field}`)}</dt><dd data-client-field={field}>{value(entry, field)}</dd></Fragment>)}</dl></section>}
  </>
}
export function ClientListView({ target, t, readClients }: Props) {
  return <SnapshotDialog t={t} title={t('clients.title')} className="redis-clients-dialog" icon="clients" hint={t('clients.hint')} readSnapshot={signal => readClients({ target }, signal)}>{snapshot => snapshot.state !== 'page' ? <p role="status">{t('clients.unavailable')}</p> : <ClientTable key={snapshot.sampledAt} snapshot={snapshot} t={t} />}</SnapshotDialog>
}
