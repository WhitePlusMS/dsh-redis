import { useContext, useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionErrorCode, ConnectionRequest, ConnectionSettings, ConnectionTarget, ConnectionView } from '../domain.ts'
import { ProfileChooser, type ProfileActions } from './ProfileChooser.tsx'
import { KeyBrowser, type KeyActions } from './KeyBrowser.tsx'
import { ReadTime } from './ReadControls.tsx'
import { Icon } from './Icon.tsx'
import { NS } from './locales.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'
import { ConnectionSync } from './connection-sync.ts'
import { SelectionEpochContext } from './SelectionEpochContext.ts'

export interface ConnectionActions extends ProfileActions, KeyActions {
  readonly connect: (request: ConnectionRequest, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly disconnect: (request: ConnectionTarget, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly connectionStatus: (signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
}
type Props = ConnectionActions & { readonly t: TranslateNS<typeof NS> }

/** Editable profile settings never replace the Host-owned connection identity.
 * Only explicit profile selection fills a draft; saving preserves its password.
 */
export function ConnectionForm(props: Props) {
  const { t } = props
  const epoch = useContext(SelectionEpochContext)
  const [host, setHost] = useState('127.0.0.1'), [port, setPort] = useState('6379')
  const [username, setUsername] = useState(''), [password, setPassword] = useState('')
  const [environment, setEnvironment] = useState('')
  const [tls, setTls] = useState(false), [caPem, setCaPem] = useState('')
  const [connection, setConnection] = useState<ConnectionView | null>(null)
  const [sampledAt, setSampledAt] = useState<string | null>(null)
  const [error, setError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const [operation, setOperation] = useState<'connect' | 'disconnect' | 'status' | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const sequence = useRef(0), active = useRef<AbortController | null>(null)
  const busy = operation !== null, connected = connection?.state === 'connected'
  const visibility = useContext(RefreshVisibility), latest = useRef({ connection, busy })
  const syncFailed = useRef(false)
  latest.current = { connection, busy }
  function select(settings: ConnectionSettings | null): void {
    setHost(settings?.host ?? '127.0.0.1'); setPort(String(settings?.port ?? 6379)); setUsername(settings?.username ?? '')
    setEnvironment(settings?.environment ?? '')
    setTls(settings?.tls != null); setCaPem(settings?.tls?.caPem ?? ''); setPassword(''); setError(null)
  }
  function acceptConnection(value: ConnectionView): void {
    const previous = latest.current.connection
    if (previous?.id !== value.id || previous?.generation !== value.generation || previous?.db !== value.db || previous?.state !== value.state) epoch?.invalidate()
    latest.current.connection = value
    setConnection(value); setSampledAt(new Date().toISOString()); setError(value.error)
  }
  function cancelPending(): void {
    ++sequence.current; active.current?.abort(); active.current = null; setOperation(null)
  }
  function closeSettings(): void {
    // Closing setup cancels in-flight authentication, never an established socket.
    if (operation === 'connect') cancelPending()
    setSettingsOpen(false); setPassword(''); setError(null)
  }
  async function run(action: 'connect' | 'disconnect' | 'status', execute: (signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>, initialize = false): Promise<void> {
    active.current?.abort()
    const controller = new AbortController(), current = ++sequence.current
    const endBoundary = action === 'status' ? undefined : epoch?.beginBoundary(controller.signal)
    active.current = controller; setOperation(action); setError(null)
    try {
      const response = await execute(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (!response.ok) { setError('rpc'); return }
      acceptConnection(response.value)
      if (initialize && response.value.target !== null) {
        const target = response.value.target
        setHost(target.host); setPort(String(target.port)); setUsername(target.username); setEnvironment(target.environment ?? ''); setTls(target.tls)
      }
      if (action === 'connect' && response.value.state === 'connected') { setPassword(''); setSettingsOpen(false) }
    } catch { if (!controller.signal.aborted && current === sequence.current) setError('rpc') }
    finally { endBoundary?.(); if (!controller.signal.aborted && current === sequence.current) { active.current = null; setOperation(null) } }
  }
  useEffect(() => {
    void run('status', signal => props.connectionStatus(signal), true)
    return () => { ++sequence.current; active.current?.abort() }
  }, [props.connectionStatus])
  useEffect(() => {
    const sync = new ConnectionSync({
      read: props.connectionStatus, current: () => latest.current.connection,
      busy: () => latest.current.busy || active.current !== null,
      visible: () => visibility?.visible !== false && !visibility?.signal.aborted && document.visibilityState === 'visible',
      apply: acceptConnection, failed: () => { syncFailed.current = true; setError('rpc') },
      healthy: () => { if (syncFailed.current) { syncFailed.current = false; setError(previous => previous === 'rpc' ? null : previous) } },
    })
    const changed = () => sync.visibilityChanged()
    changed(); document.addEventListener('visibilitychange', changed); visibility?.signal.addEventListener('abort', changed)
    return () => { sync.dispose(); document.removeEventListener('visibilitychange', changed); visibility?.signal.removeEventListener('abort', changed) }
  }, [props.connectionStatus, visibility?.visible, visibility?.signal])
  const settings = (): ConnectionSettings => ({ host: host.trim(), port: Number(port), username, ...(environment.trim() ? { environment: environment.trim() } : {}), tls: tls ? { caPem: caPem.trim() } : null })
  function disconnectCurrent(): void {
    if (connection?.id == null) return
    const target = { id: connection.id, generation: connection.generation }
    void run('disconnect', signal => props.disconnect(target, signal))
  }
  return <div className="redis-connection" data-connected={connected}>
    <div className="redis-compact-connection" hidden={connected}><button type="button" onClick={() => setSettingsOpen(true)}><Icon name="database" /><span>{host}:{port}</span></button><button type="button" className="redis-icon-button" title={t('connection.settings')} aria-label={t('connection.settings')} onClick={() => setSettingsOpen(true)}><Icon name="settings" /></button></div>
    <ProfileChooser {...props} disabled={busy} settings={settings} select={select} open={settingsOpen} onClose={closeSettings}>
      {connected && <div className="redis-connection-notice"><strong>{connection.target?.host}:{connection.target?.port}{connection.target?.tls && ' · TLS'} · {connection.target?.environment ?? t('connection.environmentUnknown')}</strong><p>{t('connection.editHint')}</p><button type="button" disabled={busy} onClick={disconnectCurrent}><Icon name="disconnect" />{t('connection.disconnect')}</button></div>}
      <form className="redis-connect-form" autoComplete="off" onSubmit={event => {
        event.preventDefault()
        if (connected || busy) return
        const request = { ...settings(), password }
        void run('connect', signal => props.connect(request, signal))
      }}>
        <fieldset disabled={busy}>
          <div className="redis-form-section"><h3>{t('connection.serverSection')}</h3><div className="redis-address">
            <label>{t('connection.host')}<input name="host" required maxLength={253} value={host} onChange={event => setHost(event.target.value)} spellCheck={false} /></label>
            <label>{t('connection.port')}<input name="port" type="number" required min={1} max={65535} step={1} value={port} onChange={event => setPort(event.target.value)} /></label>
          </div><label>{t('connection.environment')}<input name="environment" maxLength={80} value={environment} onChange={event => setEnvironment(event.target.value)} autoComplete="off" /></label></div>
          <div className="redis-form-section"><h3>{t('connection.authSection')}</h3>
            <label>{t('connection.username')}<input name="username" maxLength={256} value={username} placeholder={t('connection.userPlaceholder')} onChange={event => setUsername(event.target.value)} autoComplete="off" spellCheck={false} /></label>
            <label>{t('connection.password')}<input name="password" type="password" maxLength={4096} value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" /><small>{t('connection.privacy')}</small></label>
          </div>
          <details className="redis-tls-section"><summary>TLS</summary><label className="redis-checkbox"><input name="tls" type="checkbox" checked={tls} onChange={event => setTls(event.target.checked)} />{t('connection.tls')}</label>
            {tls && <label>{t('connection.ca')}<textarea name="caPem" rows={4} maxLength={65536} value={caPem} onChange={event => setCaPem(event.target.value)} spellCheck={false} /><small>{t('connection.tlsVerification')}</small></label>}
          </details>
          <div className="redis-actions redis-connect-actions"><button type="submit" disabled={connected} className={'redis-primary-button' + (operation === 'connect' ? ' redis-spinning' : '')} aria-busy={operation === 'connect'}><Icon name={operation === 'connect' ? 'refresh' : 'database'} />{t('connection.connect')}</button></div>
        </fieldset>
        {operation === 'connect' && <button type="button" onClick={() => { cancelPending(); setError('cancelled') }}>{t('ui.cancel')}</button>}
      </form>
      {error !== null && <p className="redis-error" role="alert">{t(`connection.error.${error}`)}</p>}
    </ProfileChooser>
    {connected ? <KeyBrowser key={connection.id + ':' + connection.generation + ':' + connection.db} {...props} configure={() => setSettingsOpen(true)} connection={connection} acceptConnection={acceptConnection} /> : <div className="redis-connect-empty"><Icon name="database" /><h2>{t('empty.title')}</h2><p>{t('empty.description')}</p><button type="button" className="redis-primary-button" onClick={() => setSettingsOpen(true)}><Icon name="add" />{t('ui.chooseConnection')}</button></div>}
    <div className="redis-connection-status">
      <span className={'redis-connection-indicator' + (connected ? ' redis-connected' : '')} role="status" title={(connected ? t('connection.connected') : t('ui.disconnected')) + ' · ' + (connection?.target?.host ?? host) + ':' + (connection?.target?.port ?? port)}><Icon name={connected ? 'check' : 'disconnect'} /><span className={connected ? 'redis-sr-only' : ''}>{connected ? t('connection.connected') : t('ui.disconnected')}</span>{connected && <span className="redis-chip redis-environment" title={connection.target?.environment ?? t('connection.environmentUnknown')}>{connection.target?.environment ?? t('connection.environmentUnknown')}</span>}{connected && connection.target?.tls && <span className="redis-chip">TLS</span>}</span>
      <span className="redis-status-spacer" />
      {sampledAt !== null && <ReadTime sampledAt={sampledAt} label={t('connection.sampledAt')} />}
      <button type="button" className={'redis-icon-button' + (operation === 'status' ? ' redis-spinning' : '')} disabled={busy} aria-busy={operation === 'status'} title={t('connection.refresh')} aria-label={t('connection.refresh')} onClick={() => { void run('status', signal => props.connectionStatus(signal)) }}><Icon name="refresh" /></button>
      {connected && <button type="button" className="redis-icon-button" disabled={busy} title={t('connection.disconnect')} aria-label={t('connection.disconnect')} onClick={disconnectCurrent}><Icon name="disconnect" /></button>}
      {error !== null && !settingsOpen && <p className="redis-error" role="alert">{t(`connection.error.${error}`)}</p>}
    </div>
  </div>
}
