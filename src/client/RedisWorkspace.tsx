import { PreviewFormats } from './PreviewFormats.tsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { AiBudgetResume, AiBudgetStatus, RedisHostStatus } from '../domain.ts'
import { ConnectionForm, type ConnectionActions } from './ConnectionForm.tsx'
import { NS } from './locales.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import { Icon } from './Icon.tsx'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import type { SelectionEpoch } from './selection-epoch.ts'

export interface RedisWorkspaceInjected extends ConnectionActions {
  readonly sessionKey: string
  readonly status: (signal: AbortSignal) => Promise<RemoteResult<RedisHostStatus>>
  readonly aiBudgetStatus: (signal: AbortSignal) => Promise<RemoteResult<AiBudgetStatus>>
  readonly resumeAiBudget: (signal: AbortSignal) => Promise<RemoteResult<AiBudgetResume>>
  readonly registerVisiblePane: () => () => void
  readonly selectionEpoch: SelectionEpoch
  readonly retrySelection: () => void
}
type Props = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<typeof NS> & RedisWorkspaceInjected

/** Another pane may already have resumed the same session before this reply. */
export function budgetResumeError(result: AiBudgetResume): boolean { return !result.accepted && result.status.stopped }

/** One request belongs to one mount/retry; late results cannot change a newer view. */
export function RedisWorkspace(props: Props) {
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [infoOpen, setInfoOpen] = useState(false)
  const t = props.t
  const subscribeFailure = useCallback((notify: () => void) => props.selectionEpoch.subscribe(notify), [props.selectionEpoch])
  const readFailure = useCallback(() => props.selectionEpoch.hasFailure(), [props.selectionEpoch])
  const selectionFailed = useSyncExternalStore(subscribeFailure, readFailure, readFailure)
  const { tab } = props.useTabInfo()
  useEffect(() => {
    const controller = new AbortController()
    setPhase('loading')
    void props.status(controller.signal).then(result => {
      if (!controller.signal.aborted) setPhase(result.ok ? 'ready' : 'error')
    }).catch(() => { if (!controller.signal.aborted) setPhase('error') })
    return () => controller.abort()
  }, [props.status, attempt])
  useLayoutEffect(() => {
    if (phase !== 'ready' || !tab.visible || tab.signal.aborted) return
    let release: (() => void) | undefined
    const detach = () => { if (release !== undefined) { const close = release; release = undefined; props.selectionEpoch.invalidate(); close() } }
    const visibilityChanged = () => {
      if (tab.signal.aborted || document.visibilityState !== 'visible') { detach(); return }
      if (release === undefined) { props.selectionEpoch.invalidate(); release = props.registerVisiblePane() }
    }
    document.addEventListener('visibilitychange', visibilityChanged)
    tab.signal.addEventListener('abort', detach, { once: true })
    visibilityChanged()
    return () => { document.removeEventListener('visibilitychange', visibilityChanged); tab.signal.removeEventListener('abort', detach); detach() }
  }, [props.registerVisiblePane, props.selectionEpoch, phase, tab.visible, tab.signal])
  return <section className="dsh-redis" aria-label={t('view.title')}>
    <header className="redis-workspace-heading"><h2>{t('view.title')}</h2><span className="redis-readonly" title={t('badge.readOnly')} role="img" aria-label={t('badge.readOnly')}><Icon name="lock" /></span><button type="button" className="redis-icon-button redis-plugin-info-toggle" title={t('ui.pluginInfo')} aria-label={t('ui.pluginInfo')} aria-expanded={infoOpen} onClick={() => setInfoOpen(value => !value)}><Icon name="info" /></button></header>
    {infoOpen && <div className="redis-plugin-info"><span>{t('baseline')}</span><span>{t(phase === 'ready' ? 'status.ready' : phase === 'loading' ? 'status.loading' : 'status.error')}</span></div>}
    {phase === 'ready' && selectionFailed && <div className="redis-plugin-info" role="status"><span>{t('selection.syncFailed')}</span><button type="button" onClick={props.retrySelection}>{t('selection.retry')}</button></div>}
    {phase === 'ready' && <AiBudget key={props.sessionKey} {...props} />}
    {phase === 'ready' ? <SelectionEpochContext.Provider value={props.selectionEpoch}><RefreshVisibility.Provider value={tab}><PreviewFormats key={props.sessionKey}><ConnectionForm {...props} /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider> : <div className="redis-empty">
      <h2>{t('empty.title')}</h2><p>{t('empty.description')}</p>
      {phase === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('action.retry')}</button>}
    </div>}
    {phase !== 'ready' && <footer className={`redis-status${phase === 'error' ? ' redis-error' : ''}`} role="status" aria-live="polite">{t(phase === 'loading' ? 'status.loading' : 'status.error')}</footer>}
  </section>
}

/** Fetch on explicit inspection; only a user click may restore an exhausted budget. */
function AiBudget(props: Props) {
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState(false)
  const [status, setStatus] = useState<AiBudgetStatus | null>(null)
  const active = useRef<AbortController | null>(null), t = props.t
  useEffect(() => () => { active.current?.abort() }, [])
  async function run(resume: boolean): Promise<void> {
    if (active.current !== null) return
    const controller = new AbortController(); active.current = controller; setPending(true); setError(false)
    try {
      if (resume) {
        const response = await props.resumeAiBudget(controller.signal)
        if (!controller.signal.aborted) { if (response.ok) { setStatus(response.value.status); setError(budgetResumeError(response.value)) } else setError(true) }
      } else {
        const response = await props.aiBudgetStatus(controller.signal)
        if (!controller.signal.aborted) { if (response.ok) setStatus(response.value); else setError(true) }
      }
    } catch { if (!controller.signal.aborted) setError(true) }
    finally { if (active.current === controller) { active.current = null; if (!controller.signal.aborted) setPending(false) } }
  }
  return <div className="redis-plugin-info">
    <button type="button" aria-expanded={open} onClick={() => { const next = !open; setOpen(next); if (next) void run(false) }}>{t('budget.title')}</button>
    {open && <div aria-live="polite">
      {status !== null && <><span>{t('budget.calls')}: {status.callsUsed}/{status.maxCalls} · {t('budget.bytes')}: {status.bytesUsed}/{status.maxBytes}</span>{status.stopped && <p>{t(status.inFlight > 0 ? 'budget.pending' : 'budget.stopped')}</p>}{status.stopped && <button type="button" disabled={pending || status.inFlight > 0} onClick={() => { void run(true) }}>{t('budget.resume')}</button>}</>}
      <button type="button" disabled={pending} onClick={() => { void run(false) }}>{t('connection.refresh')}</button>
      {error && <p role="alert">{t('budget.error')}</p>}
    </div>}
  </div>
}
