import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { AutoRefreshClock, AUTO_REFRESH_INTERVALS, type RefreshSample, type RefreshSnapshot, type RefreshStopReason } from './auto-refresh.ts'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'

/** DSH owns Session/tab visibility and record lifetime; the plugin never infers it from DOM shape. */
export const RefreshVisibility = createContext<{ readonly visible: boolean; readonly signal: AbortSignal } | null>(null)
const RefreshClock = createContext<{ readonly clock: AutoRefreshClock; readonly detailsOpen: boolean; readonly toggleDetails: () => void } | null>(null)

/** Raw Key identity owns this boundary; the browser above owns connection/DB generation. */
export function KeyAutoRefresh({ children }: { readonly children: ReactNode }) {
  const tab = useContext(RefreshVisibility), currentTab = useRef(tab)
  const [detailsOpen, setDetailsOpen] = useState(false)
  currentTab.current = tab
  const [clock] = useState(() => new AutoRefreshClock((run, milliseconds) => {
    const timer = window.setTimeout(run, milliseconds)
    return () => window.clearTimeout(timer)
  }, () => currentTab.current !== null && currentTab.current.visible && !currentTab.current.signal.aborted && document.visibilityState === 'visible'))
  useLayoutEffect(() => { clock.visibilityChanged() }, [clock, tab?.visible])
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
  readonly cancel: () => void
}
/** Readers keep committed queries and cancellation. Only the active view owns the source. */
export function useAutoRefreshReader(options: ReaderOptions): { readonly begin: () => boolean; readonly reset: (reason?: RefreshStopReason) => void } {
  const clock = useContext(RefreshClock)?.clock ?? null, owner = useRef(Symbol('Redis reader')).current, latest = useRef(options)
  latest.current = options
  const active = options.active !== false
  useLayoutEffect(() => {
    if (clock === null || !active) return
    return clock.attach(owner, { refresh: () => latest.current.refresh(), cancel: () => latest.current.cancel() })
  }, [clock, owner, active])
  useLayoutEffect(() => { if (active) clock?.report(owner, options.busy, options.result, options.failed) })
  return {
    begin: () => !active || clock === null ? true : clock.begin(owner),
    reset: reason => { if (active) clock?.reset(owner, reason) },
  }
}
