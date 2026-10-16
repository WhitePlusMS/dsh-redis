import { Fragment } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseTarget, OverviewField, OverviewReadRequest, OverviewReadResult } from '../domain.ts'
import { SnapshotDialog } from './SnapshotDialog.tsx'
import { NS } from './locales.ts'

export interface OverviewActions { readonly readOverview: (request: OverviewReadRequest, signal: AbortSignal) => Promise<RemoteResult<OverviewReadResult>> }
type Props = OverviewActions & { readonly target: DatabaseTarget; readonly t: TranslateNS<typeof NS> }
const groups = [
  { name: 'server', fields: ['redis_version', 'redis_mode', 'uptime_in_seconds'] },
  { name: 'memory', fields: ['used_memory', 'used_memory_rss', 'used_memory_peak', 'maxmemory'] },
  { name: 'clients', fields: ['connected_clients', 'blocked_clients'] },
  { name: 'stats', fields: ['total_connections_received', 'total_commands_processed', 'instantaneous_ops_per_sec', 'keyspace_hits', 'keyspace_misses', 'expired_keys', 'evicted_keys'] },
] as const

/** The parent keys this component by connection generation/DB. Only a user's
 * explicit Open/Refresh reads; closing/unmounting clears data and cancels work.
 */
export function ServerOverview({ target, t, readOverview }: Props) {
  function unit(field: OverviewField): string {
    if (field === 'redis_version' || field === 'redis_mode') return ''
    if (field === 'uptime_in_seconds') return t('overview.seconds')
    if (field === 'maxmemory' || field.startsWith('used_memory')) return 'B'
    if (field === 'connected_clients' || field === 'blocked_clients' || field === 'total_connections_received') return t('overview.connections')
    if (field === 'expired_keys' || field === 'evicted_keys') return t('overview.keys')
    return t(field === 'instantaneous_ops_per_sec' ? 'overview.ops' : 'overview.count')
  }
  return <SnapshotDialog t={t} title={t('overview.title')} className="redis-overview-dialog" icon="info" hint={t('overview.hint')} readSnapshot={signal => readOverview({ target }, signal)}>{snapshot => snapshot.fields === null ? null :
    <div className="redis-overview-grid">{groups.map(group => <section className="redis-overview-card" key={group.name} aria-label={t(`overview.${group.name}`)}><h2>{t(`overview.${group.name}`)}</h2><dl>{group.fields.map(field => <Fragment key={field}><dt title={field}>{t(`overview.field.${field}`)}</dt><dd data-info-field={field}>{snapshot.fields?.[field] === null ? t('overview.unreported') : <>{snapshot.fields?.[field]} <small>{unit(field)}</small></>}</dd></Fragment>)}</dl></section>)}</div>
  }</SnapshotDialog>
}
