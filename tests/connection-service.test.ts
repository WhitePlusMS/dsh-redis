import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionFailure, RedisConnections, connectionErrorCode, type RedisLink, type RedisOpener } from '../src/host/connection-service.ts'
import type { ConnectionRequest, ConnectionView, ConnectionErrorCode } from '../src/domain.ts'
import { renderLogs } from './log-output.ts'
import { RedisReplyError } from '../src/host/resp.ts'

const settings: ConnectionRequest = { host: '127.0.0.1', port: 6379, username: 'reader', password: 'never-return-this-secret', tls: null }
const signal = () => new AbortController().signal
function target(view: ConnectionView) {
  if (view.id === null) throw new Error('Expected a connection identity')
  return { id: view.id, generation: view.generation }
}
function link() {
  const listeners = new Set<(code: ConnectionErrorCode) => void>()
  const close = vi.fn()
  const transport: RedisLink = { close, execute: async () => null, onFailure: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } }
  return { transport, close, fail: (code: ConnectionErrorCode) => { for (const listener of listeners) listener(code) } }
}
function deferred() {
  let resolve!: (value: RedisLink) => void
  const promise = new Promise<RedisLink>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
afterEach(() => { vi.restoreAllMocks() })

describe('connection ownership and lifecycle', () => {
  it('detects secrets in Error messages and nested causes as Node console would', () => {
    const marker = 'ro04-synthetic-error-marker', failure = new Error(marker)
    expect(JSON.stringify(failure)).not.toContain(marker)
    expect(renderLogs([[failure]])).toContain(marker)
    expect(renderLogs([[new Error('outer', { cause: failure })]])).toContain(marker)
  })
  it('distinguishes certificate trust and hostname errors without exposing server messages', () => {
    expect(connectionErrorCode(Object.assign(new Error('private details'), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }))).toBe('tls-hostname')
    expect(connectionErrorCode(Object.assign(new Error('private details'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }))).toBe('tls-certificate')
    expect(connectionErrorCode(Object.assign(new Error('private details'), { code: 'CERT_HAS_EXPIRED' }))).toBe('tls-certificate')
    expect(connectionErrorCode(Object.assign(new Error('private details'), { code: 'ECONNRESET' }))).toBe('network')
  })
  it('classifies Redis authentication by error prefix, not echoed arguments', () => {
    for (const message of ['NOAUTH Authentication required.', 'WRONGPASS invalid username-password pair', 'ERR AUTH called without any password configured']) expect(connectionErrorCode(new RedisReplyError(message))).toBe('auth')
    for (const message of ["ERR unknown command 'MEMORY', with args beginning with: 'USAGE' 'author'", 'ERR invalid password field', 'ERR synthetic-auth-data']) expect(connectionErrorCode(new RedisReplyError(message))).not.toBe('auth')
  })
  it('reduces authentication failures to a fixed code without returning credentials', async () => {
    const service = new RedisConnections(async () => { throw new Error('WRONGPASS ' + settings.password) })
    const connected = await service.connect('a', settings, signal())
    expect(connected).toMatchObject({ state: 'error', error: 'auth' })
    expect(JSON.stringify(connected)).not.toContain(settings.password)
    service.dispose()
  })
  it('does not log injected credentials on connection success, failure or disconnect', async () => {
    const password = 'ro04-fake-password-marker', certificate = 'ro04-fake-certificate-marker'
    const request: ConnectionRequest = { ...settings, password, tls: { caPem: certificate } }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = link(), service = new RedisConnections(async () => client.transport)
    const failures: readonly [string, Error, ConnectionErrorCode][] = [
      ['auth', new Error('WRONGPASS ' + password + ' ' + certificate), 'auth'],
      ['hostname', Object.assign(new Error(password + ' ' + certificate), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }), 'tls-hostname'],
      ['certificate', Object.assign(new Error(password + ' ' + certificate), { code: 'CERT_HAS_EXPIRED' }), 'tls-certificate'],
    ]
    try {
      const connected = await service.connect('a', request, signal())
      expect(connected.state).toBe('connected')
      client.fail('network')
      const replacement = await service.connect('a', request, signal())
      service.disconnect('a', target(replacement))
      for (const [session, failure, code] of failures) {
        const failing = new RedisConnections(async () => { throw failure })
        try {
          const result = await failing.connect(session, request, signal())
          expect(result).toMatchObject({ state: 'error', error: code })
          expect(JSON.stringify(result)).not.toContain(password)
          expect(JSON.stringify(result)).not.toContain(certificate)
        } finally { failing.dispose() }
      }
      expect(vi.mocked(console.info).mock.calls.length).toBeGreaterThan(0)
      const captured = renderLogs([...vi.mocked(console.info).mock.calls, ...warn.mock.calls, ...error.mock.calls])
      expect(captured).not.toContain(password); expect(captured).not.toContain(certificate)
    } finally { service.dispose() }
  })
  it('keeps the connected environment as a snapshot of the submitted settings', async () => {
    const client = link(), service = new RedisConnections(async () => client.transport)
    try {
      const draft = { ...settings, environment: '测试' }
      const connected = await service.connect('a', draft, signal())
      draft.environment = '生产'
      expect(connected.target?.environment).toBe('测试')
      expect(service.status('a').target?.environment).toBe('测试')
      expect(JSON.stringify(connected)).not.toContain(settings.password)
    } finally { service.dispose() }
  })
  it('keeps a stable identity but advances generation; an old disconnect cannot close a replacement', async () => {
    const first = link(), second = link()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(first.transport).mockResolvedValueOnce(second.transport)
    const service = new RedisConnections(open)
    const a = await service.connect('a', settings, signal())
    const b = await service.connect('a', settings, signal())
    expect(a.id).toBe(b.id)
    expect(b.generation).toBeGreaterThan(a.generation)
    expect(first.close).toHaveBeenCalledTimes(1)
    expect(service.disconnect('a', target(a))).toMatchObject({ state: 'connected', error: 'stale' })
    expect(second.close).not.toHaveBeenCalled()
    expect(service.disconnect('a', target(b)).state).toBe('disconnected')
    expect(second.close).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(2)
  })
  it('destroys a late superseded socket without replacing the current connection', async () => {
    const pending = deferred(), old = link(), current = link()
    const open = vi.fn<RedisOpener>().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(current.transport)
    const service = new RedisConnections(open)
    const first = service.connect('a', settings, signal())
    const second = await service.connect('a', settings, signal())
    pending.resolve(old.transport)
    expect(await first).toMatchObject({ state: 'error', error: 'stale' })
    expect(old.close).toHaveBeenCalledTimes(1)
    expect(service.status('a')).toEqual(second)
    service.dispose()
    expect(current.close).toHaveBeenCalledTimes(1)
  })
  it('closes a successful socket arriving after cancellation and does not report success', async () => {
    const pending = deferred(), client = link(), controller = new AbortController()
    const service = new RedisConnections(() => pending.promise)
    const result = service.connect('a', settings, controller.signal)
    controller.abort()
    pending.resolve(client.transport)
    expect(await result).toMatchObject({ state: 'error', error: 'cancelled' })
    expect(client.close).toHaveBeenCalledTimes(1)
    expect(service.status('a').state).toBe('error')
  })
  it('disposes only the owning session, including a setup still in flight', async () => {
    const pending = deferred(), late = link(), other = link()
    let setupSignal: AbortSignal | undefined
    const open: RedisOpener = (_settings, requestSignal) => {
      if (setupSignal === undefined) { setupSignal = requestSignal; return pending.promise }
      return Promise.resolve(other.transport)
    }
    const service = new RedisConnections(open)
    const creating = service.connect('a', settings, signal())
    const b = await service.connect('b', settings, signal())
    expect(service.disconnect('a', target(b)).error).toBe('stale')
    service.disposeSession('a')
    expect(setupSignal?.aborted).toBe(true)
    pending.resolve(late.transport)
    expect((await creating).error).toBe('stale')
    expect(late.close).toHaveBeenCalledTimes(1)
    expect(service.status('b')).toEqual(b)
    expect(other.close).not.toHaveBeenCalled()
    service.dispose()
    expect(other.close).toHaveBeenCalledTimes(1)
  })
  it('publishes a failed live connection and closes it without reconnecting', async () => {
    const client = link()
    const open = vi.fn<RedisOpener>().mockResolvedValue(client.transport)
    const service = new RedisConnections(open)
    await service.connect('a', settings, signal())
    client.fail('network')
    expect(service.status('a')).toMatchObject({ state: 'error', error: 'network' })
    expect(client.close).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledTimes(1)
    service.dispose()
    expect(client.close).toHaveBeenCalledTimes(1)
  })
  it('preserves a transport failure reported while SELECT is in flight', async () => {
    const client = link()
    let reject!: (error: Error) => void
    const pending = new Promise<null>((_resolve, fail) => { reject = fail })
    const transport: RedisLink = { ...client.transport, execute: async () => pending }
    const service = new RedisConnections(async () => transport)
    try {
      const connected = await service.connect('a', settings, signal())
      const operation = service.selectDatabase('a', { ...target(connected), db: 2 }, signal())
      client.fail('network')
      reject(new ConnectionFailure('network'))
      expect(await operation).toMatchObject({ state: 'error', error: 'network', db: 0 })
      expect(service.status('a')).toMatchObject({ state: 'error', error: 'network' })
      expect(client.close).toHaveBeenCalledTimes(1)
    } finally { service.dispose() }
  })
  it('preserves explicit timeout failures and never opens an already cancelled request', async () => {
    const open = vi.fn<RedisOpener>().mockRejectedValue(new ConnectionFailure('timeout'))
    const service = new RedisConnections(open)
    expect((await service.connect('a', settings, signal())).error).toBe('timeout')
    const controller = new AbortController(); controller.abort()
    await expect(service.connect('a', settings, controller.signal)).rejects.toThrow()
    expect(open).toHaveBeenCalledTimes(1)
    expect(service.status('b').state).toBe('disconnected')
  })
})
