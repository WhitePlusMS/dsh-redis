import { PreviewFormats } from './PreviewFormats.tsx'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { AiBudgetResume, AiBudgetStatus, RedisHostStatus } from '../domain.ts'
import type { RedisWriteModeRequest, RedisWriteModeStatus } from '../domain.ts'
import type { RedisWriteLookupRequest, RedisWriteLookupResult } from '../domain.ts'
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
  readonly writeModeStatus: (signal: AbortSignal) => Promise<RemoteResult<RedisWriteModeStatus>>
  readonly setWriteMode: (request: RedisWriteModeRequest, signal: AbortSignal) => Promise<RemoteResult<RedisWriteModeStatus>>
  readonly writeLookup: (request: RedisWriteLookupRequest, signal: AbortSignal) => Promise<RemoteResult<RedisWriteLookupResult>>
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
    {infoOpen && <div className="redis-plugin-info" tabIndex={0} aria-label={t('ui.pluginInfo')}><span>{t('baseline')}</span><span>{t(phase === 'ready' ? 'status.ready' : phase === 'loading' ? 'status.loading' : 'status.error')}</span>{phase === 'ready' && <><AiBudgetRecovery key={props.sessionKey} {...props} /><AiWriteMode key={`write-${props.sessionKey}`} {...props} /><AiWriteLookup key={`lookup-${props.sessionKey}`} {...props} /></>}</div>}
    {phase === 'ready' && selectionFailed && <div className="redis-plugin-info" role="status"><span>{t('selection.syncFailed')}</span><button type="button" onClick={props.retrySelection}>{t('selection.retry')}</button></div>}
    {phase === 'ready' ? <SelectionEpochContext.Provider value={props.selectionEpoch}><RefreshVisibility.Provider value={tab}><PreviewFormats key={props.sessionKey}><ConnectionForm {...props} /></PreviewFormats></RefreshVisibility.Provider></SelectionEpochContext.Provider> : <div className="redis-empty">
      <h2>{t('empty.title')}</h2><p>{t('empty.description')}</p>
      {phase === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t('action.retry')}</button>}
    </div>}
    {phase !== 'ready' && <footer className={`redis-status${phase === 'error' ? ' redis-error' : ''}`} role="status" aria-live="polite">{t(phase === 'loading' ? 'status.loading' : 'status.error')}</footer>}
  </section>
}

/** Operation history is a bounded session-local lookup, not a durable audit log. */
function AiWriteLookup(props: Props) {
  const [id, setId] = useState(''), [result, setResult] = useState<RedisWriteLookupResult | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState(false)
  const active = useRef<AbortController | null>(null), t = props.t
  useEffect(() => () => { active.current?.abort(); active.current = null }, [])
  async function lookup(): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(); active.current = controller; setPending(true); setError(false); setResult(null)
    const timeout = setTimeout(() => { if (active.current === controller) { active.current = null; controller.abort(); setPending(false); setError(true) } }, 5000)
    controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true })
    try {
      const response = await props.writeLookup({ id: id.trim() }, controller.signal)
      if (!controller.signal.aborted && active.current === controller) { if (response.ok) setResult(response.value); else setError(true) }
    } catch { if (!controller.signal.aborted && active.current === controller) setError(true) }
    finally { clearTimeout(timeout); if (active.current === controller) { active.current = null; if (!controller.signal.aborted) setPending(false) } }
  }
  return <div>
    <label>{t('write.lookup')} <input aria-label={t('write.lookup')} value={id} maxLength={36} onChange={event => { active.current?.abort(); active.current = null; setPending(false); setResult(null); setError(false); setId(event.target.value) }} /></label>{' '}
    <button type="button" disabled={pending || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u.test(id.trim())} onClick={() => { void lookup() }}>{t('write.query')}</button>
    {result !== null && <div role="status">{result.record === null ? t('write.unavailable') : <>
      <p>{t(`write.state.${result.record.state}`)} · DB {result.record.target.db} · {result.record.updatedAt}</p>
      <p>{t('write.connectionId')}: <code>{result.record.target.id} / {result.record.target.generation}</code></p>
      <p>{result.record.identity.type} · Key Base64: <code>{JSON.stringify(result.record.identity.keyBase64)}</code></p>
      {result.record.identity.fieldBase64 !== null && <p>Field Base64: <code>{JSON.stringify(result.record.identity.fieldBase64)}</code></p>}
    </>}</div>}
    {error && <p role="alert">{t('write.lookupError')}</p>}
    <p>{t('write.historyNote')}</p>
  </div>
}

/** The server rechecks the exact connection before changing its write mode. */
function AiWriteMode(props: Props) {
  const [mode, setMode] = useState<RedisWriteModeStatus | null>(null)
  const [pending, setPending] = useState(false), [error, setError] = useState(false)
  const active = useRef<AbortController | null>(null), t = props.t
  const currentMode = useRef<RedisWriteModeStatus | null>(null)
  useEffect(() => {
    let revision = props.selectionEpoch.snapshot().revision
    const refresh = () => { if (document.visibilityState === 'visible') void run(false) }
    const changed = () => {
      if (document.visibilityState !== 'visible') { active.current?.abort(); active.current = null; currentMode.current = null; setMode(null); setPending(false) }
      else refresh()
    }
    const unsubscribe = props.selectionEpoch.subscribe(snapshot => {
      if (snapshot.revision === revision) return
      revision = snapshot.revision
      active.current?.abort(); active.current = null; currentMode.current = null; setMode(null); setPending(false)
      refresh()
    })
    refresh()
    const timer = setInterval(refresh, 3000)
    document.addEventListener('visibilitychange', changed)
    return () => { clearInterval(timer); unsubscribe(); document.removeEventListener('visibilitychange', changed); active.current?.abort(); active.current = null }
  }, [props.selectionEpoch])
  async function run(toggle: boolean): Promise<void> {
    if (active.current !== null) return
    const current = currentMode.current, controller = new AbortController()
    active.current = controller; currentMode.current = null; setMode(null); setPending(true); setError(false)
    // A lost response must not leave an old authorization state on screen forever.
    const timeout = setTimeout(() => {
      if (active.current !== controller) return
      active.current = null; controller.abort(); setPending(false); setError(true)
    }, 5000)
    controller.signal.addEventListener('abort', () => clearTimeout(timeout), { once: true })
    try {
      const connection = current?.connection
      const response = toggle && current !== null && connection?.id !== null && connection?.id !== undefined
        ? await props.setWriteMode({ target: { id: connection.id, generation: connection.generation, db: connection.db }, enabled: !current.enabled }, controller.signal)
        : await props.writeModeStatus(controller.signal)
      if (!controller.signal.aborted && active.current === controller) { if (response.ok) { currentMode.current = response.value; setMode(response.value) } else setError(true) }
    } catch { if (!controller.signal.aborted && active.current === controller) setError(true) }
    finally { clearTimeout(timeout); if (active.current === controller) { active.current = null; if (!controller.signal.aborted) setPending(false) } }
  }
  const connection = mode?.connection
  return <div aria-live="polite">
    <p>{t(mode === null ? 'write.unknown' : mode.enabled ? 'write.enabled' : 'write.disabled')}{connection?.state === 'connected' && connection.target !== null ? ` (${connection.target.host}:${connection.target.port}, DB ${connection.db})` : ''}</p>
    <p>{t('write.policy')}</p>
    <button type="button" disabled={pending || connection?.state !== 'connected' || connection.id === null} onClick={() => { void run(true) }}>{t(mode?.enabled ? 'write.disable' : 'write.enable')}</button>{' '}
    <button type="button" disabled={pending} onClick={() => { void run(false) }}>{t('connection.refresh')}</button>
    {error && <p role="alert">{t('write.error')}</p>}
  </div>
}

/** Only inspect on opening plugin info; resuming remains an explicit user action. */
function AiBudgetRecovery(props: Props) {
  const [pending, setPending] = useState(false), [error, setError] = useState(false)
  const [status, setStatus] = useState<AiBudgetStatus | null>(null)
  const active = useRef<AbortController | null>(null), t = props.t
  useEffect(() => { void run(false); return () => { active.current?.abort(); active.current = null } }, [])
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
  if (!error && !status?.stopped) return null
  return <div aria-live="polite">
    {status?.stopped && <><p>{t(status.inFlight > 0 ? 'budget.pending' : 'budget.stopped')}</p><button type="button" disabled={pending || status.inFlight > 0} onClick={() => { void run(true) }}>{t('budget.resume')}</button></>}
    {(error || (status?.stopped && status.inFlight > 0)) && <button type="button" disabled={pending} onClick={() => { void run(false) }}>{t('connection.refresh')}</button>}
    {error && <p role="alert">{t('budget.error')}</p>}
  </div>
}
