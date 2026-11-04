import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { AutoRefreshClock, AUTO_REFRESH_INTERVALS, type RefreshSample, type RefreshSnapshot, type RefreshStopReason } from './auto-refresh.ts'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'
import type { DatabaseTarget } from '../domain.ts'
import type { RefreshActionHandler } from './ui-pane-presence.ts'
import { SelectionEpochContext } from './SelectionEpochContext.ts'

/** DSH owns Session/tab visibility and record lifetime; the plugin never infers it from DOM shape. */
export const RefreshVisibility = createContext<{ readonly visible: boolean; readonly signal: AbortSignal } | null>(null)
const RefreshClock = createContext<{ readonly clock: AutoRefreshClock; readonly detailsOpen: boolean; readonly toggleDetails: () => void } | null>(null)

/** Raw Key identity owns this boundary; the browser above owns connection/DB generation. */
export function KeyAutoRefresh({ children, action }: { readonly children: ReactNode; readonly action?: { readonly register: (handler: RefreshActionHandler) => () => void; readonly target: DatabaseTarget; readonly keyBase64: string } }) {
  const tab = useContext(RefreshVisibility), currentTab = useRef(tab)
  const epoch = useContext(SelectionEpochContext)
  const [detailsOpen, setDetailsOpen] = useState(false)
  currentTab.current = tab
  const [clock] = useState(() => new AutoRefreshClock((run, milliseconds) => {
    const timer = window.setTimeout(run, milliseconds)
    return () => window.clearTimeout(timer)
  }, () => currentTab.current !== null && currentTab.current.visible && !currentTab.current.signal.aborted && document.visibilityState === 'visible'))
  useLayoutEffect(() => { clock.visibilityChanged() }, [clock, tab?.visible])
  useLayoutEffect(() => {
    if (action === undefined || epoch === null || tab?.visible === false || tab?.signal.aborted) return
    return action.register(async (request, signal) => {
      const target = request.action.target, controller = new AbortController()
      const combined = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(Math.max(1, request.expiresAt - Date.now())), ...(tab === null ? [] : [tab.signal])])
      const validTarget = () => !combined.aborted && document.visibilityState === 'visible' && tab?.visible !== false && target.id === action.target.id && target.generation === action.target.generation && target.db === action.target.db && request.action.keyBase64 === action.keyBase64
      if (!validTarget() || !epoch.current(request.selectionRevision)) return 'stale'
      let starting = true, revision = request.selectionRevision
      const unsubscribe = epoch.subscribe(snapshot => { if (!starting && snapshot.revision !== revision) controller.abort() })
      try {
        const pending = clock.refreshOnce(combined)
        revision = epoch.snapshot().revision; starting = false
        const outcome = await pending
        if (outcome !== 'applied' || !validTarget()) return outcome === 'failed' ? 'failed' : 'stale'
        // A collection read invalidates its old selection before dispatch; wait
        // for that exact revision to be published after the new result renders.
        if (!epoch.current(revision)) await new Promise<void>(resolve => {
          const done = () => { stop(); combined.removeEventListener('abort', done); resolve() }
          const stop = epoch.subscribe(snapshot => { if (snapshot.revision !== revision || snapshot.synchronized) done() })
          combined.addEventListener('abort', done, { once: true })
          if (combined.aborted || epoch.current(revision)) done()
        })
        return validTarget() && epoch.current(revision) ? 'applied' : 'stale'
      } finally { unsubscribe(); controller.abort() }
    })
  }, [action?.register, action?.target.id, action?.target.generation, action?.target.db, action?.keyBase64, clock, epoch, tab?.visible, tab?.signal])
  useLayoutEffect(() => {
    const changed = () => clock.visibilityChanged()
    document.addEventListener('visibilitychange', changed)
    tab?.signal.addEventListener('abort', changed)
    return () => {
      document.removeEventListener('visibilitychange', changed)
      tab?.signal.removeEventListener('abort', changed)
      clock.stop('changed')
    }
  }, [clock, tab?.signal])
  return <RefreshClock.Provider value={{ clock, detailsOpen, toggleDetails: () => setDetailsOpen(value => !value) }}>{children}</RefreshClock.Provider>
}
function statusKey(state: RefreshSnapshot) {
  // A stop reason is historical after a successful manual read, not a new failure.
  return state.busy ? 'read.busy' : state.enabled ? 'auto.waiting' : state.reason === 'hidden' ? 'auto.hidden' : !state.ready && state.reason === 'failed' ? 'auto.failed' : !state.ready && state.reason === 'cancelled' ? 'auto.cancelled' : 'auto.off'
}
export function RefreshControls({ t }: { readonly t: TranslateNS<typeof NS> }) {
  const context = useContext(RefreshClock)
  if (context === null) throw new Error('Missing Key refresh boundary')
  const { clock } = context, state = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot)
  const status = statusKey(state), label = `${t('auto.title')} · ${state.intervalMs / 1000}s · ${t(status)}`
  const failed = !state.ready && !state.busy && state.reason === 'failed'
  return <div className="redis-reader-tools">
    <div className="redis-auto-refresh" role="group" aria-label={t('auto.interval')} data-auto-refresh={state.enabled ? 'on' : 'off'} data-auto-reason={state.reason} data-busy={state.enabled && state.busy}>
      <button type="button" aria-label={t('auto.title')} title={label} aria-pressed={state.enabled} disabled={!state.enabled && (!state.ready || state.busy)} onClick={() => state.enabled ? clock.stop() : clock.enable()}><Icon name={failed ? 'warning' : !state.enabled && (state.reason === 'hidden' || state.reason === 'cancelled') ? 'pause' : 'clock'} /></button>
      <select name="autoRefreshInterval" aria-label={t('auto.interval')} value={state.intervalMs} onChange={event => clock.setInterval(Number(event.target.value))}>{AUTO_REFRESH_INTERVALS.map(milliseconds => <option key={milliseconds} value={milliseconds}>{milliseconds / 1000}s</option>)}</select>
      <span className="redis-sr-only" data-auto-status>{t(status)}</span>
    </div>
    <button type="button" className="redis-icon-button" aria-label={t('read.details')} aria-expanded={context.detailsOpen} title={`${t('read.details')} · ${state.sampledAt === null ? t('read.none') : new Date(state.sampledAt).toLocaleString()}`} onClick={context.toggleDetails}><Icon name="history" /></button>
  </div>
}
export function RefreshReadInfo({ t }: { readonly t: TranslateNS<typeof NS> }) {
  const context = useContext(RefreshClock)
  if (context === null) throw new Error('Missing Key refresh boundary')
  const { clock } = context, state = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot)
  if (!context.detailsOpen) return null
  return <div className="redis-read-info"><strong>{t('read.details')}</strong>{state.sampledAt === null ? <span>{t('read.none')}</span> : <time dateTime={state.sampledAt}>{new Date(state.sampledAt).toLocaleString()}</time>}<span>{t(statusKey(state))} · {state.intervalMs / 1000}s</span><button type="button" className="redis-icon-button" title={t('ui.close')} aria-label={t('ui.close')} onClick={context.toggleDetails}><Icon name="close" /></button></div>
}
interface ReaderOptions {
  readonly active?: boolean
  readonly busy: boolean
  readonly result: RefreshSample | null
  readonly failed: boolean
  readonly refresh: () => void
  readonly refreshOnce: (signal: AbortSignal) => Promise<'applied' | 'failed' | 'stale'>
  readonly cancel: () => void
}
/** Readers keep committed queries and cancellation. Only the active view owns the source. */
export function useAutoRefreshReader(options: ReaderOptions): { readonly begin: () => boolean; readonly reset: (reason?: RefreshStopReason) => void } {
  const clock = useContext(RefreshClock)?.clock ?? null, owner = useRef(Symbol('Redis reader')).current, latest = useRef(options)
  latest.current = options
  const active = options.active !== false
  useLayoutEffect(() => {
    if (clock === null || !active) return
    return clock.attach(owner, { refresh: () => latest.current.refresh(), cancel: () => latest.current.cancel(), refreshOnce: signal => latest.current.refreshOnce(signal) })
  }, [clock, owner, active])
  useLayoutEffect(() => { if (active) clock?.report(owner, options.busy, options.result, options.failed) })
  return {
    begin: () => !active || clock === null ? true : clock.begin(owner),
    reset: reason => { if (active) clock?.reset(owner, reason) },
  }
}
