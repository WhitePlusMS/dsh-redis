import { useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseTarget, SlowLogEntry, SlowLogReadRequest, SlowLogReadResult } from '../domain.ts'
import { CollectionTable, type CollectionColumn } from './CollectionTable.tsx'
import { SnapshotDialog } from './SnapshotDialog.tsx'
import { NS } from './locales.ts'
export interface SlowLogActions { readonly readSlowLog: (request: SlowLogReadRequest, signal: AbortSignal) => Promise<RemoteResult<SlowLogReadResult>> }
type Props = SlowLogActions & { readonly target: DatabaseTarget; readonly t: TranslateNS<typeof NS> }
/** A date is only a secondary view; the exact Unix-second text is always shown. */
function localTime(seconds: string): string | null {
  const milliseconds = BigInt(seconds) * 1000n
  return milliseconds <= 8640000000000000n ? new Date(Number(milliseconds)).toLocaleString() : null
}
export function SlowLogView({ target, t, readSlowLog }: Props) {
  const [count, setCount] = useState(10)
  const columns: readonly CollectionColumn<SlowLogEntry>[] = [
    { id: 'id', title: t('slowlog.id'), render: row => <span data-slowlog-id={row.id}>{row.id}</span> },
    { id: 'time', title: t('slowlog.time'), render: row => <><span>{row.timestampSeconds} s</span><br /><small>{localTime(row.timestampSeconds) ?? t('overview.unreported')}</small></> },
    { id: 'duration', title: t('slowlog.duration'), render: row => <span data-slowlog-duration>{row.durationUs} μs</span> },
    { id: 'command', title: t('slowlog.command'), render: row => row.command ?? t('overview.unreported') },
    { id: 'arguments', title: t('slowlog.arguments'), render: row => <><span>{row.loggedArgumentCount} {t('slowlog.loggedCount')}</span><br /><small>{row.argumentBytes.length === 0 ? t('slowlog.noArguments') : row.argumentBytes.map((bytes, index) => '#' + String(index + 1) + ': ' + String(bytes) + ' B').join(' · ')}{row.loggedArgumentCount > row.argumentBytes.length + 1 && ' · …'}</small>{row.originalArgumentCount !== null && <><br /><small>{t('slowlog.originalCount')}: {row.originalArgumentCount}</small></>}</> },
  ]
  return <SnapshotDialog t={t} title={t('slowlog.title')} className="redis-slowlog-dialog" icon="history" hint={t('slowlog.hint')} readSnapshot={signal => readSlowLog({ target, count }, signal)} controls={busy => <label>{t('slowlog.limit')}<select name="slowlogCount" disabled={busy} value={count} onChange={event => setCount(Number(event.target.value))}>{[1, 10, 25, 50, 100].map(value => <option key={value} value={value}>{value}</option>)}</select></label>}>{snapshot => snapshot.state !== 'page' ? <p role="status">{t('slowlog.unavailable')}</p> : <>
    <p role="status" data-slowlog-coverage>{snapshot.entries.length} / {snapshot.count} · {t(snapshot.more ? 'slowlog.more' : 'slowlog.complete')}</p>
    <p>{t('slowlog.timezone')} {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    {snapshot.entries.length === 0 ? <p>{t('slowlog.empty')}</p> : <CollectionTable rows={snapshot.entries} identity={row => row.id} columns={columns} label={t('slowlog.title')} />}
  </>}</SnapshotDialog>
}
