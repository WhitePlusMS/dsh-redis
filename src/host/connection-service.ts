/** Standalone connection lifecycle adapted from Database's Redis open/close paths. */
import { randomUUID } from 'node:crypto'
import { RedisTransport, RedisTransportError, type RedisReadCommand } from './redis-transport.ts'
import { RedisFrameError, RedisReplyError, type RedisArgument, type RedisReply } from './resp.ts'
import type { ConnectionErrorCode, ConnectionRequest, ConnectionTarget, ConnectionView, DatabaseTarget, SavedConnection } from '../domain.ts'
import { profileCollectionSchema } from '../typert.shared.ts'
import type { RedisProfiles } from './profile-store.ts'

/** Small Host-owned transport surface; no Redis command strings cross the RPC. */
export interface RedisLink {
  close(): void
  execute(command: RedisReadCommand, arguments_: readonly RedisArgument[], signal: AbortSignal, beforeDispatch: () => void, deadline?: number): Promise<RedisReply>
  onFailure(listener: (code: ConnectionErrorCode) => void): () => void
}
export type RedisOpener = (settings: ConnectionRequest, signal: AbortSignal) => Promise<RedisLink>
export type CandidateConnectionResult = { readonly state: 'connected' | 'changed'; readonly view: ConnectionView; readonly previousRelease: 'closed' | 'uncertain' } | { readonly state: 'failed'; readonly error: ConnectionErrorCode }
type CandidateCommitGate = (signal: AbortSignal, commit: () => undefined) => Promise<boolean>

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
  if (error instanceof Error && /^(?:(?:WRONGPASS|NOAUTH)(?: |$)|ERR AUTH(?: |$))/u.test(error.message)) return 'auth'
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

interface ConnectionResources {
  link?: RedisLink
  unsubscribe?: () => void
}

interface LiveConnection extends ConnectionResources {
  readonly id: string
  generation: number
  db: number
  readonly target: NonNullable<ConnectionView['target']>
  readonly cancellation: AbortController
  state: ConnectionView['state']
  error: ConnectionErrorCode | null
}

/** Abort waiting even if an injected operation ignores its signal; dispose late results. */
function waitFor<T>(operation: Promise<T>, signal: AbortSignal, onLate?: (value: T) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const abort = () => { if (!settled) { settled = true; reject(new ConnectionFailure('cancelled')) } }
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
    operation.then(value => {
      if (settled) { onLate?.(value); return }
      settled = true; signal.removeEventListener('abort', abort); resolve(value)
    }, error => {
      if (settled) return
      settled = true; signal.removeEventListener('abort', abort); reject(error)
    })
  })
}

/** One current connection per trusted session; hiding/reopening a pane does not open another. */
export class RedisConnections {
  private readonly sessions = new Map<string, LiveConnection>()
  private readonly candidates = new Map<string, AbortController>()
  private readonly unreleased = new Set<ConnectionResources>()
  private generation = 0
  constructor(private readonly open: RedisOpener = openRedis) {}

  private view(record: LiveConnection): ConnectionView {
    return { id: record.id, generation: record.generation, db: record.db, state: record.state, error: record.error, target: record.target }
  }
  private release(record: ConnectionResources): 'closed' | 'uncertain' {
    // Each operation is independent: a broken listener must not prevent socket closure.
    const unsubscribe = record.unsubscribe
    delete record.unsubscribe
    if (unsubscribe !== undefined) {
      try { unsubscribe() } catch { record.unsubscribe = unsubscribe }
    }
    const link = record.link
    delete record.link
    if (link !== undefined) {
      try { link.close() } catch { record.link = link }
    }
    if (record.unsubscribe !== undefined || record.link !== undefined) {
      this.unreleased.add(record)
      console.warn('[dsh-redis] Redis connection release uncertain')
      return 'uncertain'
    }
    this.unreleased.delete(record)
    return 'closed'
  }
  private close(record: LiveConnection): 'closed' | 'uncertain' {
    record.cancellation.abort()
    const released = this.release(record)
    record.state = 'disconnected'
    record.error = null
    return released
  }
  private cancelCandidate(sessionId: string): void {
    const candidate = this.candidates.get(sessionId)
    if (candidate !== undefined) { this.candidates.delete(sessionId); candidate.abort() }
  }

  /** Internal preparation only: the gate owns authorization and must call commit synchronously. */
  async connectCandidate(sessionId: string, settings: ConnectionRequest, signal: AbortSignal, gate: CandidateCommitGate, preflight: (signal: AbortSignal) => boolean | Promise<boolean>, beforeExchange: () => void = () => undefined): Promise<CandidateConnectionResult> {
    signal.throwIfAborted()
    if (this.status(sessionId).state === 'connecting') return { state: 'failed', error: 'stale' }
    this.cancelCandidate(sessionId)
    const controller = new AbortController()
    this.candidates.set(sessionId, controller)
    const combined = AbortSignal.any([signal, controller.signal])
    const previous = this.sessions.get(sessionId)
    const previousView = this.status(sessionId)
    const snapshot: ConnectionRequest = { ...settings, tls: settings.tls === null ? null : { ...settings.tls } }
    const resources: ConnectionResources = {}
    let failure: ConnectionErrorCode | undefined
    let promoted: LiveConnection | undefined
    let committed: CandidateConnectionResult | undefined
    let gateActive = true
    const cleanup = () => { this.release(resources) }
    const committedResult = (): CandidateConnectionResult | undefined => {
      if (committed === undefined || committed.state === 'failed') return undefined
      // Exchange and later connection failure/replacement are separate facts.
      return this.isCurrentView(sessionId, committed.view) ? committed : { ...committed, state: 'changed', view: this.status(sessionId) }
    }
    combined.addEventListener('abort', cleanup, { once: true })
    try {
      // Register this candidate before an asynchronous preflight so newer user
      // actions can cancel it; a preflight mismatch prevents opening the socket.
      const check = preflight(combined)
      const permitted = typeof check === 'boolean' ? check : await waitFor(check, combined)
      if (!permitted || combined.aborted) return { state: 'failed', error: signal.aborted ? 'cancelled' : failure ?? 'stale' }
      resources.link = await waitFor(this.open(snapshot, combined), combined, link => {
        // A late opener may finish after dispose has already retried its known resources.
        // Give this newly arrived socket its own bounded retry, retaining failures.
        const late: ConnectionResources = { link }
        if (this.release(late) === 'uncertain') this.release(late)
      })
      // An opener can ignore cancellation and return a late socket.
      if (combined.aborted) return { state: 'failed', error: signal.aborted ? 'cancelled' : failure ?? 'stale' }
      resources.unsubscribe = resources.link.onFailure(code => {
        if (promoted !== undefined) {
          if (this.sessions.get(sessionId) !== promoted || promoted.cancellation.signal.aborted) return
          this.release(promoted); promoted.state = 'error'; promoted.error = code
          console.info('[dsh-redis] Redis connection lost')
        } else { failure = code; controller.abort() }
      })
      if (combined.aborted) return { state: 'failed', error: signal.aborted ? 'cancelled' : failure ?? 'stale' }
      await waitFor(gate(combined, () => {
        if (!gateActive || committed !== undefined || combined.aborted || resources.link === undefined) return undefined
        const current = this.status(sessionId)
        if (current.state === 'connecting' || this.candidates.get(sessionId) !== controller || this.sessions.get(sessionId) !== previous || current.id !== previousView.id || current.generation !== previousView.generation || current.db !== previousView.db || current.state !== previousView.state || current.error !== previousView.error) return undefined

        // The gate's synchronous callback contains both the final CAS and exchange.
        const record: LiveConnection = {
          id: previous?.id ?? randomUUID(), generation: ++this.generation, db: 0,
          target: { host: snapshot.host, port: snapshot.port, username: snapshot.username, ...(snapshot.environment === undefined ? {} : { environment: snapshot.environment }), tls: snapshot.tls !== null },
          cancellation: new AbortController(), state: 'connected', error: null, link: resources.link,
          ...(resources.unsubscribe === undefined ? {} : { unsubscribe: resources.unsubscribe }),
        }
        // Clear the old target's owned state in the same synchronous exchange;
        // if cleanup fails, the old connection stays in place.
        beforeExchange()
        promoted = record
        this.sessions.set(sessionId, record)
        delete resources.link; delete resources.unsubscribe
        this.candidates.delete(sessionId)
        // Report the actual exchange even if later resource release fails unexpectedly.
        committed = { state: 'connected', view: this.view(record), previousRelease: 'uncertain' }
        const previousRelease = previous === undefined ? 'closed' : this.close(previous)
        committed = { state: 'connected', view: this.view(record), previousRelease }
        console.info('[dsh-redis] Redis connected')
        return undefined
      }), combined)
      return committedResult() ?? { state: 'failed', error: signal.aborted ? 'cancelled' : failure ?? 'stale' }
    } catch (error) {
      return committedResult() ?? { state: 'failed', error: signal.aborted ? 'cancelled' : failure ?? (controller.signal.aborted ? 'stale' : connectionErrorCode(error)) }
    } finally {
      gateActive = false
      combined.removeEventListener('abort', cleanup)
      cleanup()
      if (this.candidates.get(sessionId) === controller) this.candidates.delete(sessionId)
    }
  }

  /** Bind candidate settings to the same normalized profile verified at commit. */
  connectProfileCandidate(sessionId: string, profile: SavedConnection, password: string, signal: AbortSignal, profiles: RedisProfiles, beforeExchange: () => void = () => undefined): Promise<CandidateConnectionResult> {
    const expected = profileCollectionSchema.parse({ profiles: [profile], selectedId: null }).profiles[0]!
    return this.connectCandidate(sessionId, { ...expected.settings, password }, signal, (candidateSignal, commit) => profiles.withVerifiedProfile(expected, candidateSignal, commit), candidateSignal => profiles.withVerifiedProfile(expected, candidateSignal, () => undefined), beforeExchange)
  }

  async connect(sessionId: string, settings: ConnectionRequest, signal: AbortSignal): Promise<ConnectionView> {
    signal.throwIfAborted()
    this.cancelCandidate(sessionId)
    const previous = this.sessions.get(sessionId)
    if (previous !== undefined) this.close(previous)
    const record: LiveConnection = {
      id: previous?.id ?? randomUUID(), generation: ++this.generation, db: 0,
      target: { host: settings.host, port: settings.port, username: settings.username, ...(settings.environment === undefined ? {} : { environment: settings.environment }), tls: settings.tls !== null },
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
  /** A completed operation may have been superseded before its caller resumes. */
  isCurrentView(sessionId: string, view: ConnectionView): boolean {
    const current = this.status(sessionId)
    return view.error !== 'stale' && current.id === view.id && current.generation === view.generation && current.db === view.db && current.state === view.state && current.error === view.error
  }
  private require(sessionId: string, target: ConnectionTarget): LiveConnection & { link: RedisLink } {
    const record = this.sessions.get(sessionId)
    if (record === undefined || record.id !== target.id || record.generation !== target.generation || record.state !== 'connected' || record.link === undefined) throw new ConnectionFailure('stale')
    return record as LiveConnection & { link: RedisLink }
  }
  assertTarget(sessionId: string, target: DatabaseTarget): void {
    if (this.require(sessionId, target).db !== target.db) throw new ConnectionFailure('stale')
  }
  /** A failed read may still describe this exact connection after it has failed. */
  isFailedTarget(sessionId: string, target: DatabaseTarget, error?: ConnectionErrorCode): boolean {
    const current = this.status(sessionId)
    return current.state === 'error' && current.id === target.id && current.generation === target.generation && current.db === target.db && (error === undefined || current.error === error)
  }
  assertReadResult(sessionId: string, target: DatabaseTarget, error: ConnectionErrorCode | null): void {
    if (error !== null && error !== 'stale' && this.isFailedTarget(sessionId, target, error)) return
    this.assertTarget(sessionId, target)
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
      // SELECT must advance the session generation through selectDatabase,
      // even if an untyped caller bypasses the compile-time command union.
      if ((command as string) === 'SELECT') throw new ConnectionFailure('protocol')
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

  async selectDatabase(sessionId: string, target: DatabaseTarget, signal: AbortSignal, onInvalidate: () => void = () => undefined): Promise<ConnectionView> {
    let record: LiveConnection | undefined
    let operationGeneration: number | undefined
    try {
      signal.throwIfAborted()
      const connected = this.require(sessionId, target)
      this.cancelCandidate(sessionId)
      record = connected
      if (record.db === target.db) { record.error = null; return this.view(record) }
      // Invalidate queued/current reads before SELECT; only this session owns the socket.
      const generation = ++this.generation
      record.generation = generation; record.state = 'connecting'; record.error = null
      operationGeneration = generation
      // Clear old per-session state before another selection can be accepted.
      onInvalidate()
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
      if (record === undefined) return { ...this.status(sessionId), error: code }
      // A late result cannot change a replacement or a manually disconnected
      // connection; preserve a transport failure already recorded by onFailure.
      if (this.sessions.get(sessionId) !== record || record.generation !== operationGeneration) return { ...this.status(sessionId), error: 'stale' }
      if (record.state === 'error' && record.error !== null) return this.view(record)
      if (record.state !== 'connecting') return { ...this.status(sessionId), error: 'stale' }
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
    if (record === undefined) {
      // A first connection can be in flight before a live record exists.
      this.cancelCandidate(sessionId)
      return this.status(sessionId)
    }
    if (record.id !== target.id || record.generation !== target.generation) return { ...this.view(record), error: 'stale' }
    this.cancelCandidate(sessionId)
    this.close(record)
    console.info('[dsh-redis] Redis disconnected')
    return this.view(record)
  }
  disposeSession(sessionId: string): void {
    this.cancelCandidate(sessionId)
    const record = this.sessions.get(sessionId)
    this.sessions.delete(sessionId)
    if (record !== undefined) this.close(record)
  }
  dispose(): void {
    for (const sessionId of new Set([...this.sessions.keys(), ...this.candidates.keys()])) this.disposeSession(sessionId)
    // Retry only resources retained after a failed release; never touch other sessions.
    for (const record of [...this.unreleased]) this.release(record)
  }
}
