import { useEffect, useRef, useState } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConnectionErrorCode, ConnectionRequest, ConnectionSettings, ConnectionTarget, ConnectionTestResult, ConnectionView } from '../domain.ts'
import { ProfileChooser, type ProfileActions } from './ProfileChooser.tsx'
import { KeyBrowser, type KeyActions } from './KeyBrowser.tsx'
import { NS } from './locales.ts'

export interface ConnectionActions extends ProfileActions, KeyActions {
  readonly testConnection: (request: ConnectionRequest, signal: AbortSignal) => Promise<RemoteResult<ConnectionTestResult>>
  readonly connect: (request: ConnectionRequest, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly disconnect: (request: ConnectionTarget, signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
  readonly connectionStatus: (signal: AbortSignal) => Promise<RemoteResult<ConnectionView>>
}
type Props = ConnectionActions & { readonly t: TranslateNS<typeof NS> }

/** Form credentials are never persisted; successful authentication clears the password input. */
export function ConnectionForm(props: Props) {
  const { t } = props
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

  function acceptConnection(value: ConnectionView): void {
    setConnection(value)
    setSampledAt(new Date())
    setError(value.error)
    if (value.target !== null) { setHost(value.target.host); setPort(String(value.target.port)); setUsername(value.target.username) }
    if (value.target !== null) setTls(value.target.tls)
    if (value.state === 'connected') setPassword('')
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
  return <div className="redis-connection" data-connected={connected}>
    <h2>{t('connection.title')}</h2>
    <details className="redis-connection-settings" open={!connected}>
      <summary>{t('connection.settings')}</summary>
      <ProfileChooser {...props} disabled={busy || connected} settings={settings} select={value => {
        setHost(value?.host ?? '127.0.0.1'); setPort(String(value?.port ?? 6379)); setUsername(value?.username ?? '')
        setTls(value?.tls !== null && value?.tls !== undefined); setCaPem(value?.tls?.caPem ?? '')
        setPassword(''); setError(null); setTested(false)
      }} />
    </details>
    {connected ? <>
      <p className="redis-connected" role="status">{t('connection.connected')} · {connection.target?.host}:{connection.target?.port}{connection.target?.tls ? ' · TLS' : ''}</p>
      <button type="button" disabled={busy} onClick={() => {
        const id = connection.id
        if (id === null) return
        const target = { id, generation: connection.generation }
        void run(signal => props.disconnect(target, signal), acceptConnection)
      }}>{t('connection.disconnect')}</button>
    </> : <form autoComplete="off" onSubmit={event => { event.preventDefault(); void run(signal => props.connect(request(), signal), acceptConnection) }}>
      <fieldset disabled={busy}>
        <div className="redis-address">
          <label>{t('connection.host')}<input name="host" required maxLength={253} value={host} onChange={event => setHost(event.target.value)} spellCheck={false} /></label>
          <label>{t('connection.port')}<input name="port" type="number" required min={1} max={65535} step={1} value={port} onChange={event => setPort(event.target.value)} /></label>
        </div>
        <label>{t('connection.username')}<input name="username" maxLength={256} value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" spellCheck={false} /></label>
        <label>{t('connection.password')}<input name="password" type="password" maxLength={4096} value={password} onChange={event => setPassword(event.target.value)} autoComplete="off" /></label>
        <label className="redis-checkbox"><input name="tls" type="checkbox" checked={tls} onChange={event => setTls(event.target.checked)} />{t('connection.tls')}</label>
        {tls && <label>{t('connection.ca')}<textarea name="caPem" rows={5} maxLength={65536} value={caPem} onChange={event => setCaPem(event.target.value)} spellCheck={false} /></label>}
        {tls && <p>{t('connection.tlsVerification')}</p>}
        <div className="redis-actions">
          <button type="button" onClick={event => {
            if (!event.currentTarget.form?.reportValidity()) return
            void run(signal => props.testConnection(request(), signal), value => { setTested(value.outcome === 'passed'); setError(value.error) })
          }}>{t('connection.test')}</button>
          <button type="submit">{t('connection.connect')}</button>
        </div>
      </fieldset>
    </form>}
    <div className="redis-actions">
      <button type="button" disabled={busy} onClick={() => { void run(signal => props.connectionStatus(signal), acceptConnection) }}>{t('connection.refresh')}</button>
      {sampledAt !== null && <small>{t('connection.sampledAt')} <time dateTime={sampledAt.toISOString()}>{sampledAt.toLocaleTimeString()}</time></small>}
    </div>
    {busy && <p role="status">{t('connection.busy')}</p>}
    {tested && <p role="status">{t('connection.testPassed')}</p>}
    {error !== null && <p className="redis-error" role="alert">{t(`connection.error.${error}`)}</p>}
    <p>{t('connection.privacy')}</p>
    {connected && <KeyBrowser key={`${connection.id}:${connection.generation}:${connection.db}`} {...props} connection={connection} acceptConnection={acceptConnection} />}
  </div>
}
