import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionErrorCode } from '../domain.ts'
import { HelpDetails } from './HelpDetails.tsx'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'
interface Snapshot { readonly state: string; readonly error: ConnectionErrorCode | null; readonly sampledAt: string }
interface Props<T extends Snapshot> {
  readonly t: TranslateNS<typeof NS>; readonly title: string; readonly className: string; readonly icon: ComponentProps<typeof Icon>['name']; readonly hint: string
  readonly readSnapshot: (signal: AbortSignal) => Promise<RemoteResult<T>>
  readonly controls?: (busy: boolean) => ReactNode
  readonly children: (snapshot: T) => ReactNode
}
/** All diagnostics share one explicit-read lifecycle. Parent identity keys isolate
 * connection generations; no effect opens a connection or starts a read.
 */
export function SnapshotDialog<T extends Snapshot>({ t, title, className, icon, hint, readSnapshot, controls, children }: Props<T>) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [snapshot, setSnapshot] = useState<T | null>(null), [error, setError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const dialog = useRef<HTMLDialogElement | null>(null), active = useRef<AbortController | null>(null), sequence = useRef(0)
  function cancel(): void { ++sequence.current; active.current?.abort(); active.current = null; setBusy(false); setSnapshot(null); setError(null) }
  function close(): void { cancel(); setOpen(false) }
  async function read(): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    active.current = controller; setBusy(true); setSnapshot(null); setError(null)
    try {
      const result = await readSnapshot(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!result.ok) setError('rpc')
      else if (result.value.state === 'failed') setError(result.value.error)
      else setSnapshot(result.value)
    } catch { if (!controller.signal.aborted && current === sequence.current) setError('rpc') }
    finally { if (!controller.signal.aborted && current === sequence.current) { setBusy(false); active.current = null } }
  }
  useEffect(() => { const element = dialog.current; if (open && !element?.open) element?.showModal(); else if (!open && element?.open) element.close() }, [open])
  useEffect(() => () => { ++sequence.current; active.current?.abort() }, [])
  return <>
    <button type="button" className="redis-icon-button" title={title} aria-label={title} onClick={() => { setOpen(true); void read() }}><Icon name={icon} /></button>
    <dialog ref={dialog} className={`redis-snapshot-dialog ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); close() }} onClose={close}>
      <header className="redis-dialog-heading"><h2>{title}</h2><button type="button" className="redis-icon-button" title={t('ui.close')} aria-label={t('ui.close')} onClick={close}><Icon name="close" /></button></header>
      <div className="redis-dialog-content">
        {controls?.(busy)}
        <div className="redis-actions"><button type="button" disabled={busy} onClick={() => { void read() }}><Icon name="refresh" />{t('diagnostic.refresh')}</button>{busy && <button type="button" onClick={cancel}>{t('keys.cancel')}</button>}<HelpDetails label={t('ui.help')}><p>{hint}</p></HelpDetails></div>
        {busy && <p role="status">{t('diagnostic.loading')}</p>}
        {error !== null && <p role="alert" className="redis-error">{t(`connection.error.${error}`)}</p>}
        {snapshot !== null && <><time className="redis-snapshot-time" dateTime={snapshot.sampledAt}>{t('connection.sampledAt')} · {new Date(snapshot.sampledAt).toLocaleTimeString()}</time>{children(snapshot)}</>}
      </div>
    </dialog>
  </>
}
