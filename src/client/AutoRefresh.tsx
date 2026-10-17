import { createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { AutoRefreshClock, AUTO_REFRESH_INTERVALS, type RefreshSample, type RefreshStopReason } from './auto-refresh.ts'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'

/** DSH owns Session/tab visibility and record lifetime; the plugin never infers it from DOM shape. */
export const RefreshVisibility = createContext<{ readonly visible: boolean; readonly signal: AbortSignal } | null>(null)
const RefreshClock = createContext<AutoRefreshClock | null>(null)

/** Raw Key identity owns this boundary; the browser above owns connection/DB generation. */
export function KeyAutoRefresh({ t, children }: { readonly t: TranslateNS<typeof NS>; readonly children: ReactNode }) {
  const tab = useContext(RefreshVisibility), currentTab = useRef(tab)
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
  return <RefreshClock.Provider value={clock}><RefreshControls clock={clock} t={t} />{children}</RefreshClock.Provider>
}
function RefreshControls({ clock, t }: { readonly clock: AutoRefreshClock; readonly t: TranslateNS<typeof NS> }) {
  const state = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot)
  const status = state.enabled ? state.busy ? 'auto.reading' : 'auto.waiting' : state.reason === 'hidden' ? 'auto.hidden' : state.reason === 'failed' ? 'auto.failed' : 'auto.cancelled'
  return <div className="redis-auto-refresh" data-auto-refresh={state.enabled ? 'on' : 'off'} data-auto-reason={state.reason}>
    <button type="button" aria-label={t('auto.title')} title={t('auto.title')} aria-pressed={state.enabled} disabled={!state.enabled && (!state.ready || state.busy)} onClick={() => state.enabled ? clock.stop() : clock.enable()}><Icon name="refresh" /><span>{t('auto.title')}</span></button>
    <select name="autoRefreshInterval" aria-label={t('auto.interval')} value={state.intervalMs} onChange={event => clock.setInterval(Number(event.target.value))}>{AUTO_REFRESH_INTERVALS.map(milliseconds => <option key={milliseconds} value={milliseconds}>{milliseconds / 1000} {t('overview.seconds')}</option>)}</select>
    {(state.enabled || state.reason === 'hidden' || state.reason === 'failed' || state.reason === 'cancelled') && <small role="status" data-auto-status>{t(status)}</small>}
    {state.sampledAt !== null && (state.enabled || state.reason === 'failed' || state.reason === 'hidden' || state.reason === 'cancelled') && <small className="redis-auto-time">{t('auto.last')} <time dateTime={state.sampledAt}>{new Date(state.sampledAt).toLocaleTimeString()}</time></small>}
  </div>
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
  const clock = useContext(RefreshClock), owner = useRef(Symbol('Redis reader')).current, latest = useRef(options)
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
