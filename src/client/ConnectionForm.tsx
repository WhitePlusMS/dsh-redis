import { ClientListView, type ClientListActions } from './ClientListView.tsx'
import { SlowLogView, type SlowLogActions } from './SlowLogView.tsx'
import { ServerOverview, type OverviewActions } from './ServerOverview.tsx'
import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionErrorCode, ConnectionRequest, ConnectionSettings, ConnectionTarget, ConnectionTestResult, ConnectionView } from '../domain.ts'
import { ProfileChooser, type ProfileActions } from './ProfileChooser.tsx'
import { KeyBrowser, type KeyActions } from './KeyBrowser.tsx'
import { NS } from './locales.ts'
import { HelpDetails } from './HelpDetails.tsx'
import { Icon } from './Icon.tsx'
import { useBrowsingState } from './BrowsingSession.tsx'

export interface ConnectionActions extends ProfileActions, KeyActions, OverviewActions, SlowLogActions, ClientListActions {
  readonly testConnection: (request: ConnectionRequest, signal: AbortSignal) => Promise<RemoteResult<ConnectionTestResult>>
  readonly connect: (request: ConnectionRequest, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly disconnect: (request: ConnectionTarget, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly connectionStatus: (signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
}
type Props = ConnectionActions & { readonly t: TranslateNS<typeof NS> }

/** Form credentials are never persisted; successful authentication clears the password input. */
export function ConnectionForm(props: Props) {
  const { t } = props
  const browsing = useBrowsingState()
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState('6379')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tls, setTls] = useState(false)
  const [caPem, setCaPem] = useState('')
  const [connection, setConnection] = useState<ConnectionView | null>(null)
  const [sampledAt, setSampledAt] = useState<Date | null>(null)
  const [tested, setTested] = useState(false)
  const [error, setError] = useState<ConnectionErrorCode | 'rpc' | null>(null)
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  const active = useRef<AbortController | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function acceptConnection(value: ConnectionView): void {
    setConnection(value)
    setSampledAt(new Date())
    setError(value.error)
    if (value.target !== null) { setHost(value.target.host); setPort(String(value.target.port)); setUsername(value.target.username) }
    if (value.target !== null) setTls(value.target.tls)
    if (value.state === 'connected') { setPassword(''); setSettingsOpen(false) }
  }
  async function run<T>(operation: (signal: AbortSignal) => Promise<RemoteResult<T>>, accept: (value: T) => void): Promise<void> {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    const current = ++sequence.current
    setBusy(true); setError(null); setTested(false)
    try {
      const result = await operation(controller.signal)
      if (controller.signal.aborted || current !== sequence.current) return
      if (result.ok) accept(result.value)
      else setError('rpc')
    } catch { if (!controller.signal.aborted && current === sequence.current) setError('rpc') }
    finally { if (current === sequence.current && !controller.signal.aborted) setBusy(false) }
  }
  useEffect(() => {
    void run(signal => props.connectionStatus(signal), acceptConnection)
    return () => { ++sequence.current; active.current?.abort() }
  }, [props.connectionStatus])

  const connected = connection?.state === 'connected'
  const settings = (): ConnectionSettings => ({ host: host.trim(), port: Number(port), username, tls: tls ? { caPem: caPem.trim() } : null })
  const request = (): ConnectionRequest => ({ ...settings(), password })
  function disconnectCurrent(): void {
    if (connection?.id == null) return
    const target = { id: connection.id, generation: connection.generation }
    void run(signal => props.disconnect(target, signal), acceptConnection)
  }
  return <div className="redis-connection" data-connected={connected}>
    <div className="redis-compact-connection" hidden={connected}><button type="button" onClick={() => setSettingsOpen(true)}><Icon name="database" /><span>{connection?.target?.host ?? host}:{connection?.target?.port ?? port}</span></button><button type="button" className="redis-icon-button" title={t('connection.settings')} aria-label={t('connection.settings')} onClick={() => setSettingsOpen(true)}><Icon name="settings" /></button></div>
    <ProfileChooser {...props} disabled={busy || connected} settings={settings} open={settingsOpen} onClose={() => { setSettingsOpen(false); setPassword('') }} applyUri={({ request, db }) => {
        setHost(request.host); setPort(String(request.port)); setUsername(request.username); setPassword(request.password)
        setTls(request.tls !== null); setCaPem(request.tls?.caPem ?? '')
        setError(null); setTested(false)
        // DB remains a preference draft until the existing explicit Select DB action.
        browsing.update({ db, keyBase64: null })
      }} select={value => {
        setHost(value?.host ?? '127.0.0.1'); setPort(String(value?.port ?? 6379)); setUsername(value?.username ?? '')
        setTls(value?.tls !== null && value?.tls !== undefined); setCaPem(value?.tls?.caPem ?? '')
        setPassword(''); setError(null); setTested(false)
      }}>
    {connected && <div className="redis-connection-notice"><strong>{t('connection.connected')}</strong><p>{t('connection.editHint')}</p><button type="button" disabled={busy} onClick={disconnectCurrent}><Icon name="disconnect" />{t('connection.disconnect')}</button></div>}
    <form className="redis-connect-form" autoComplete="off" onSubmit={event => { event.preventDefault(); void run(signal => props.connect(request(), signal), acceptConnection) }}>
      <fieldset disabled={busy || connected}>
        <div className="redis-form-section"><h3>{t('connection.serverSection')}</h3>
        <div className="redis-address">
          <label>{t('connection.host')}<input name="host" required maxLength={253} value={host} onChange={event => setHost(event.target.value)} spellCheck={false} /></label>
          <label>{t('connection.port')}<input name="port" type="number" required min={1} max={65535} step={1} value={port} onChange={event => setPort(event.target.value)} /></label>
        </div>
        </div>
        <div className="redis-form-section"><h3>{t('connection.authSection')}</h3>
        <label>{t('connection.username')}<input name="username" maxLength={256} value={username} placeholder={t('connection.userPlaceholder')} onChange={event => setUsername(event.target.value)} autoComplete="off" spellCheck={false} /></label>
        <label>{t('connection.password')}<input name="password" type="password" maxLength={4096} value={password} placeholder={t('connection.passwordPlaceholder')} onChange={event => setPassword(event.target.value)} autoComplete="off" /></label>
        </div>
        <div className="redis-form-section redis-tls-section"><label className="redis-checkbox"><input name="tls" type="checkbox" checked={tls} onChange={event => setTls(event.target.checked)} />{t('connection.tls')}</label>
        {tls && <label>{t('connection.ca')}<textarea name="caPem" rows={5} maxLength={65536} value={caPem} onChange={event => setCaPem(event.target.value)} spellCheck={false} /></label>}
        </div>
        <div className="redis-actions redis-connect-actions">
          <button type="button" onClick={event => {
            if (!event.currentTarget.form?.reportValidity()) return
            void run(signal => props.testConnection(request(), signal), value => { setTested(value.outcome === 'passed'); setError(value.error) })
          }}>{t('connection.test')}</button>
          <button type="submit" className="redis-primary-button"><Icon name="database" />{t('connection.connect')}</button>
        </div>
      </fieldset>
    </form>
    {busy && <p role="status">{t('connection.busy')}</p>}
    {tested && <p role="status">{t('connection.testPassed')}</p>}
    {error !== null && <p className="redis-error" role="alert">{t(`connection.error.${error}`)}</p>}
    <HelpDetails label={t('ui.help')}><p>{t('connection.privacy')}</p>{tls && <p>{t('connection.tlsVerification')}</p>}</HelpDetails>
    </ProfileChooser>
    {connected ? <KeyBrowser key={`${connection.id}:${connection.generation}:${connection.db}`} {...props} configure={() => setSettingsOpen(true)} connection={connection} acceptConnection={acceptConnection} /> : <div className="redis-connect-empty"><Icon name="database" /><h2>{t('empty.title')}</h2><p>{t('empty.description')}</p><button type="button" className="redis-primary-button" onClick={() => setSettingsOpen(true)}><Icon name="add" />{t('ui.chooseConnection')}</button></div>}
    <div className="redis-connection-status">
      <span className={connected ? 'redis-connected' : ''} role="status">{connected ? t('connection.connected') : t('ui.disconnected')}{connected && <span className="redis-target"> · {connection.target?.host}:{connection.target?.port}{connection.target?.tls ? ' · TLS' : ''}</span>}</span>
      <span className="redis-status-spacer" />
      {connected && connection.id !== null && <ClientListView key={`clients:${connection.id}:${connection.generation}:${connection.db}`} t={t} readClients={props.readClients} target={{ id: connection.id, generation: connection.generation, db: connection.db }} />}
      {connected && connection.id !== null && <SlowLogView key={`slowlog:${connection.id}:${connection.generation}:${connection.db}`} t={t} readSlowLog={props.readSlowLog} target={{ id: connection.id, generation: connection.generation, db: connection.db }} />}
      {connected && connection.id !== null && <ServerOverview key={`${connection.id}:${connection.generation}:${connection.db}`} t={t} readOverview={props.readOverview} target={{ id: connection.id, generation: connection.generation, db: connection.db }} />}
      {sampledAt !== null && <time title={t('connection.sampledAt')} dateTime={sampledAt.toISOString()}>{sampledAt.toLocaleTimeString()}</time>}
      <button type="button" className="redis-icon-button" disabled={busy} title={t('connection.refresh')} aria-label={t('connection.refresh')} onClick={() => { void run(signal => props.connectionStatus(signal), acceptConnection) }}><Icon name="refresh" /></button>
      {connected && <button type="button" className="redis-icon-button" disabled={busy} title={t('connection.disconnect')} aria-label={t('connection.disconnect')} onClick={disconnectCurrent}><Icon name="disconnect" /></button>}
      {busy && <span role="status">{t('connection.busy')}</span>}
      {tested && !settingsOpen && <span role="status">{t('connection.testPassed')}</span>}
      {error !== null && !settingsOpen && <p className="redis-error" role="alert">{t(`connection.error.${error}`)}</p>}
    </div>
  </div>
}
