import { Fragment, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionErrorCode, DatabaseTarget, OverviewField, OverviewReadRequest, OverviewReadResult } from '../domain.ts'
import { HelpDetails } from './HelpDetails.tsx'
import { Icon } from './Icon.tsx'
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
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [snapshot, setSnapshot] = useState<OverviewReadResult | null>(null)
  const [error, setError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const dialog = useRef<HTMLDialogElement | null>(null), active = useRef<AbortController | null>(null), sequence = useRef(0)
  function cancel(): void { ++sequence.current; active.current?.abort(); active.current = null; setBusy(false); setSnapshot(null); setError(null) }
  function close(): void { cancel(); setOpen(false) }
  async function read(): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    active.current = controller; setBusy(true); setSnapshot(null); setError(null)
    try {
      const result = await readOverview({ target }, controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!result.ok) setError('rpc')
      else if (result.value.state === 'failed') setError(result.value.error)
      else setSnapshot(result.value)
    } catch { if (!controller.signal.aborted && current === sequence.current) setError('rpc') }
    finally { if (!controller.signal.aborted && current === sequence.current) { setBusy(false); active.current = null } }
  }
  useEffect(() => { const element = dialog.current; if (open && !element?.open) element?.showModal(); else if (!open && element?.open) element.close() }, [open])
  useEffect(() => () => { ++sequence.current; active.current?.abort() }, [])
  function unit(field: OverviewField): string {
    if (field === 'redis_version' || field === 'redis_mode') return ''
    if (field === 'uptime_in_seconds') return t('overview.seconds')
    if (field === 'maxmemory' || field.startsWith('used_memory')) return 'B'
    if (field === 'connected_clients' || field === 'blocked_clients' || field === 'total_connections_received') return t('overview.connections')
    if (field === 'expired_keys' || field === 'evicted_keys') return t('overview.keys')
    return t(field === 'instantaneous_ops_per_sec' ? 'overview.ops' : 'overview.count')
  }
  return <>
    <button type="button" className="redis-icon-button" title={t('overview.title')} aria-label={t('overview.title')} onClick={() => { setOpen(true); void read() }}><Icon name="info" /></button>
    <dialog ref={dialog} className="redis-overview-dialog" aria-label={t('overview.title')} onCancel={event => { event.preventDefault(); close() }} onClose={close}>
      <header className="redis-dialog-heading"><h2>{t('overview.title')}</h2><button type="button" className="redis-icon-button" title={t('ui.close')} aria-label={t('ui.close')} onClick={close}><Icon name="close" /></button></header>
      <div className="redis-dialog-content">
        <div className="redis-actions"><button type="button" disabled={busy} onClick={() => { void read() }}><Icon name="refresh" />{t('overview.refresh')}</button>{busy && <button type="button" onClick={cancel}>{t('keys.cancel')}</button>}<HelpDetails label={t('ui.help')}><p>{t('overview.hint')}</p></HelpDetails></div>
        {busy && <p role="status">{t('overview.loading')}</p>}
        {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
        {snapshot?.fields !== null && snapshot?.fields !== undefined && <>
          <time className="redis-overview-time" dateTime={snapshot.sampledAt}>{t('connection.sampledAt')} · {new Date(snapshot.sampledAt).toLocaleTimeString()}</time>
          <div className="redis-overview-grid">{groups.map(group => <section className="redis-overview-card" key={group.name} aria-label={t(`overview.${group.name}`)}><h2>{t(`overview.${group.name}`)}</h2><dl>{group.fields.map(field => <Fragment key={field}><dt title={field}>{t(`overview.field.${field}`)}</dt><dd data-info-field={field}>{snapshot.fields?.[field] === null ? t('overview.unreported') : <>{snapshot.fields?.[field]} <small>{unit(field)}</small></>}</dd></Fragment>)}</dl></section>)}</div>
        </>}
      </div>
    </dialog>
  </>
}
