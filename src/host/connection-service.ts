/** Standalone connection lifecycle adapted from Database's Redis open/close paths. */
import { randomUUID } from 'node:crypto'
import { RedisTransport, RedisTransportError, type RedisReadCommand } from './redis-transport.ts'
import { RedisFrameError, RedisReplyError, type RedisArgument, type RedisReply } from './resp.ts'
import type { ConnectionErrorCode, ConnectionRequest, ConnectionTarget, ConnectionView, DatabaseTarget } from '../domain.ts'

/** Small Host-owned transport surface; no Redis command strings cross the RPC. */
export interface RedisLink {
  close(): void
  execute(command: RedisReadCommand, arguments_: readonly RedisArgument[], signal: AbortSignal, beforeDispatch: () => void, deadline?: number): Promise<RedisReply>
  onFailure(listener: (code: ConnectionErrorCode) => void): () => void
}
export type RedisOpener = (settings: ConnectionRequest, signal: AbortSignal) => Promise<RedisLink>

export class ConnectionFailure extends Error {
  constructor(readonly code: ConnectionErrorCode) { super(code) }
}

/** Map server messages to fixed public codes, never echoing host, URI or secrets. */
export function connectionErrorCode(error: unknown): ConnectionErrorCode {
  if (error instanceof ConnectionFailure || error instanceof RedisTransportError || error instanceof RedisFrameError) return error.code
  if (error instanceof Error && /^(NOPERM|DENIED)(?: |$)/u.test(error.message)) return 'permission'
  if (error instanceof RedisReplyError && /^WRONGTYPE(?: |$)/u.test(error.message)) return 'type-changed'
  if (error instanceof RedisReplyError && /^ERR DB index is out of range/u.test(error.message)) return 'database'
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : ''
  if (code === 'ERR_TLS_CERT_ALTNAME_INVALID') return 'tls-hostname'
  if (/^(ERR_TLS_|ERR_SSL_|ERR_OSSL_)|CERT_|SELF_SIGNED|UNABLE_TO_(GET_ISSUER|VERIFY_LEAF)/u.test(code)) return 'tls-certificate'
  if (error instanceof Error && /WRONGPASS|NOAUTH|AUTH|invalid username-password|invalid password/i.test(error.message)) return 'auth'
  return 'network'
}

/** Authentication, TLS and bounded replies share one owned socket; no reconnect. */
export const openRedis: RedisOpener = async (settings, signal) => {
  const transport = await RedisTransport.open(settings, signal)
  return {
    close: () => { transport.close() },
    execute: (command, arguments_, requestSignal, beforeDispatch, deadline) => transport.execute(command, arguments_, requestSignal, beforeDispatch, deadline),
    onFailure: listener => transport.onFailure(error => { listener(connectionErrorCode(error)) }),
  }
}

interface LiveConnection {
  readonly id: string
  generation: number
  db: number
  readonly target: NonNullable<ConnectionView['target']>
  readonly cancellation: AbortController
  state: ConnectionView['state']
  error: ConnectionErrorCode | null
  link?: RedisLink
  unsubscribe?: () => void
}

/** One current connection per trusted session; hiding/reopening a pane does not open another. */
export class RedisConnections {
  private readonly sessions = new Map<string, LiveConnection>()
  private generation = 0
  constructor(private readonly open: RedisOpener = openRedis) {}

  private view(record: LiveConnection): ConnectionView {
    return { id: record.id, generation: record.generation, db: record.db, state: record.state, error: record.error, target: record.target }
  }
  private release(record: LiveConnection): void {
    record.unsubscribe?.()
    delete record.unsubscribe
    record.link?.close()
    delete record.link
  }
  private close(record: LiveConnection): void {
    record.cancellation.abort()
    this.release(record)
    record.state = 'disconnected'
    record.error = null
  }

  async connect(sessionId: string, settings: ConnectionRequest, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    const previous = this.sessions.get(sessionId)
    if (previous !== undefined) this.close(previous)
    const record: LiveConnection = {
      id: previous?.id ?? randomUUID(), generation: ++this.generation, db: 0,
      target: { host: settings.host, port: settings.port, username: settings.username, tls: settings.tls !== null },
      cancellation: new AbortController(), state: 'connecting', error: null,
    }
    this.sessions.set(sessionId, record)
    const current = () => this.sessions.get(sessionId) === record && !record.cancellation.signal.aborted
    try {
      const link = await this.open(settings, AbortSignal.any([signal, record.cancellation.signal]))
      if (!current()) { link.close(); return { ...this.view(record), state: 'error', error: 'stale' } }
      if (signal.aborted) {
        link.close(); record.state = 'error'; record.error = 'cancelled'
        return this.view(record)
      }
      record.link = link
      record.state = 'connected'
      record.unsubscribe = link.onFailure(code => {
        if (!current()) return
        this.release(record)
        record.state = 'error'
        record.error = code
        console.info('[dsh-redis] Redis connection lost')
      })
      console.info('[dsh-redis] Redis connected')
    } catch (error) {
      if (!current()) return { ...this.view(record), state: 'error', error: 'stale' }
      record.state = 'error'
      record.error = signal.aborted ? 'cancelled' : connectionErrorCode(error)
    }
    return this.view(record)
  }

  status(sessionId: string): ConnectionView {
    const record = this.sessions.get(sessionId)
    return record === undefined ? { id: null, generation: 0, db: 0, state: 'disconnected', error: null, target: null } : this.view(record)
  }
  private require(sessionId: string, target: ConnectionTarget): LiveConnection & { link: RedisLink } {
    const record = this.sessions.get(sessionId)
    if (record === undefined || record.id !== target.id || record.generation !== target.generation || record.state !== 'connected' || record.link === undefined) throw new ConnectionFailure('stale')
    return record as LiveConnection & { link: RedisLink }
  }
  assertTarget(sessionId: string, target: DatabaseTarget): void {
    if (this.require(sessionId, target).db !== target.db) throw new ConnectionFailure('stale')
  }

  /** Validate again after queueing and after receipt: SELECT cannot mix old DB results. */
  async read(sessionId: string, target: DatabaseTarget, command: Exclude<RedisReadCommand, 'SELECT'>, arguments_: readonly RedisArgument[], signal: AbortSignal, validate: () => void = () => undefined, deadline?: number): Promise<RedisReply> {
    const guard = () => {
      signal.throwIfAborted()
      const record = this.require(sessionId, target)
      if (record.db !== target.db) throw new ConnectionFailure('stale')
      validate()
      return record
    }
    try {
      const record = guard()
      const value = await record.link.execute(command, arguments_, signal, guard, deadline)
      guard()
      return value
    } catch (error) {
      // Readers classify command-specific refusals before mapping them to fixed
      // DTO states. Preserve them only inside Host, after rechecking ownership.
      if (!signal.aborted && error instanceof RedisReplyError) { guard(); throw error }
      throw new ConnectionFailure(signal.aborted ? 'cancelled' : connectionErrorCode(error))
    }
  }

  async selectDatabase(sessionId: string, target: DatabaseTarget, signal: AbortSignal): Promise<ConnectionView> {
    let record: LiveConnection | undefined
    try {
      signal.throwIfAborted()
      const connected = this.require(sessionId, target)
      record = connected
      if (record.db === target.db) { record.error = null; return this.view(record) }
      // Invalidate queued/current reads before SELECT; only this session owns the socket.
      const generation = ++this.generation
      record.generation = generation; record.state = 'connecting'; record.error = null
      const guard = () => {
        signal.throwIfAborted()
        if (this.sessions.get(sessionId) !== connected || connected.generation !== generation || connected.state !== 'connecting') throw new ConnectionFailure('stale')
      }
      const reply = await connected.link.execute('SELECT', [String(target.db)], signal, guard)
      guard()
      if (reply !== 'OK') throw new RedisFrameError('protocol')
      connected.db = target.db; connected.state = 'connected'
      return this.view(connected)
    } catch (error) {
      const code = signal.aborted ? 'cancelled' : connectionErrorCode(error)
      if (record === undefined || this.sessions.get(sessionId) !== record) return { ...this.status(sessionId), error: code }
      if (error instanceof RedisReplyError && (code === 'permission' || code === 'database')) {
        // A fully framed Redis refusal leaves the prior selected database unchanged.
        record.state = 'connected'; record.error = code
      } else {
        // Cancellation after SELECT dispatch makes DB state uncertain; discard our socket.
        record.cancellation.abort(); this.release(record)
        record.state = 'error'; record.error = code
      }
      return this.view(record)
    }
  }
  disconnect(sessionId: string, target: ConnectionTarget): ConnectionView {
    const record = this.sessions.get(sessionId)
    if (record === undefined) return this.status(sessionId)
    if (record.id !== target.id || record.generation !== target.generation) return { ...this.view(record), error: 'stale' }
    this.close(record)
    console.info('[dsh-redis] Redis disconnected')
    return this.view(record)
  }
  disposeSession(sessionId: string): void {
    const record = this.sessions.get(sessionId)
    this.sessions.delete(sessionId)
    if (record !== undefined) this.close(record)
  }
  dispose(): void { for (const sessionId of this.sessions.keys()) this.disposeSession(sessionId) }
}
