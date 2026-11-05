/** One bounded RESP2 command at a time on an owned TCP/TLS connection. */
import { createConnection, isIP, type Socket } from 'node:net'
import { connect as connectTls } from 'node:tls'
import type { ConnectionRequest } from '../domain.ts'
import { encodeCommand, RedisFrameError, RedisReplyError, RespDecoder, type RedisArgument, type RedisReply } from './resp.ts'

export type RedisReadCommand = 'DBSIZE' | 'CONFIG' | 'INFO' | 'MEMORY' | 'SLOWLOG' | 'XINFO' | 'CLIENT' | 'SELECT' | 'SCAN' | 'TYPE' | 'PTTL' | 'STRLEN' | 'GETRANGE' | 'HLEN' | 'HSCAN' | 'HGET' | 'LLEN' | 'LRANGE' | 'SCARD' | 'SSCAN' | 'SISMEMBER' | 'ZCARD' | 'ZRANGE' | 'ZSCAN' | 'ZSCORE' | 'XLEN' | 'XRANGE' | 'XREVRANGE' | 'GEOPOS' | 'GEODIST' | 'JSON.GET' | 'TS.RANGE'
const READ_COMMANDS: ReadonlySet<string> = new Set<RedisReadCommand>(['DBSIZE', 'CONFIG', 'INFO', 'MEMORY', 'SLOWLOG', 'XINFO', 'CLIENT', 'SELECT', 'SCAN', 'TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'HLEN', 'HSCAN', 'HGET', 'LLEN', 'LRANGE', 'SCARD', 'SSCAN', 'SISMEMBER', 'ZCARD', 'ZRANGE', 'ZSCAN', 'ZSCORE', 'XLEN', 'XRANGE', 'XREVRANGE', 'GEOPOS', 'GEODIST', 'JSON.GET', 'TS.RANGE'])
const CONNECT_TIMEOUT = 8000
const READ_TIMEOUT = 10000
const MAX_QUEUE = 16

export class RedisTransportError extends Error {
  constructor(readonly code: 'network' | 'timeout' | 'cancelled' | 'busy') { super(code) }
}
interface PendingFrame {
  readonly decoder: RespDecoder
  resolve(value: RedisReply): void
  reject(error: Error): void
}

export class RedisTransport {
  private readonly socket: Socket
  private readonly tls: boolean
  private failure: Error | null = null
  private active: PendingFrame | null = null
  private readonly failures = new Set<(error: Error) => void>()
  private pending = Promise.resolve()
  private queued = 0

  private constructor(settings: ConnectionRequest) {
    this.tls = settings.tls !== null
    const address = { host: settings.host, port: settings.port }
    this.socket = settings.tls === null ? createConnection(address) : connectTls({
      ...address, rejectUnauthorized: true,
      ...(isIP(settings.host) === 0 ? { servername: settings.host } : {}),
      ...(settings.tls.caPem === '' ? {} : { ca: settings.tls.caPem }),
    })
    this.socket.setNoDelay(true)
    this.socket.setKeepAlive(true, 5000)
    this.socket.on('error', (error: Error) => { this.fail(error) })
    this.socket.on('close', () => { this.fail(new RedisTransportError('network')) })
    this.socket.on('data', (chunk: Buffer) => {
      const active = this.active
      if (active === null) { this.fail(new RedisFrameError('protocol')); return }
      try {
        const result = active.decoder.write(chunk)
        if (!result.done) return
        if (result.value instanceof RedisReplyError) active.reject(result.value)
        else active.resolve(result.value)
      } catch (error) { this.fail(error instanceof Error ? error : new RedisFrameError('protocol')) }
    })
  }
  static async open(settings: ConnectionRequest, signal: AbortSignal): Promise<RedisTransport> {
    if (signal.aborted) throw new RedisTransportError('cancelled')
    const deadline = Date.now() + CONNECT_TIMEOUT
    const transport = new RedisTransport(settings)
    try {
      await transport.ready(deadline, signal)
      if (settings.username !== '' || settings.password !== '') {
        const auth = settings.username === '' ? ['AUTH', settings.password] : ['AUTH', settings.username, settings.password]
        const reply = await transport.request(auth, signal, deadline, () => undefined)
        if (reply !== 'OK') throw new RedisFrameError('protocol')
      }
      if (await transport.request(['PING'], signal, deadline, () => undefined) !== 'PONG') throw new RedisFrameError('protocol')
      if (signal.aborted) throw new RedisTransportError('cancelled')
      if (transport.failure !== null) throw transport.failure
      return transport
    } catch (error) { transport.close(); throw error }
  }
  private ready(deadline: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const event = this.tls ? 'secureConnect' : 'connect'
      const finish = (error: Error | null) => {
        if (settled) return
        settled = true; clearTimeout(timer)
        this.socket.off(event, connected); this.socket.off('error', failed); this.socket.off('close', closed)
        signal.removeEventListener('abort', cancelled)
        if (error === null) resolve()
        else reject(error)
      }
      const connected = () => { finish(null) }
      const failed = (error: Error) => { finish(error) }
      const closed = () => { finish(this.failure ?? new RedisTransportError('network')) }
      const cancelled = () => { finish(new RedisTransportError('cancelled')) }
      const timer = setTimeout(() => { finish(new RedisTransportError('timeout')) }, Math.max(0, deadline - Date.now()))
      timer.unref()
      this.socket.once(event, connected); this.socket.once('error', failed); this.socket.once('close', closed)
      signal.addEventListener('abort', cancelled, { once: true })
      if (signal.aborted) cancelled()
    })
  }
  private fail(error: Error, notify = true): void {
    if (this.failure !== null) return
    this.failure = error
    this.active?.reject(error)
    this.socket.destroy()
    if (notify) for (const listener of this.failures) listener(error)
  }
  close(): void { this.fail(new RedisTransportError('cancelled'), false) }
  onFailure(listener: (error: Error) => void): () => void {
    this.failures.add(listener)
    const failure = this.failure
    if (failure !== null) queueMicrotask(() => { if (this.failures.has(listener)) listener(failure) })
    return () => { this.failures.delete(listener) }
  }
  execute(command: RedisReadCommand, arguments_: readonly RedisArgument[], signal: AbortSignal, beforeDispatch: () => void, deadline = Date.now() + READ_TIMEOUT): Promise<RedisReply> {
    // Only an explicit finite time window and bounded raw sample count are allowed.
    if (command === 'TS.RANGE' && !(arguments_.length === 5 && Buffer.isBuffer(arguments_[0]) && typeof arguments_[1] === 'string' && typeof arguments_[2] === 'string' && /^(?:0|[1-9]\d{0,18})$/u.test(arguments_[1]) && /^(?:0|[1-9]\d{0,18})$/u.test(arguments_[2]) && BigInt(arguments_[1]) <= BigInt(arguments_[2]) && BigInt(arguments_[2]) <= 9223372036854775807n && arguments_[3] === 'COUNT' && typeof arguments_[4] === 'string' && /^(?:[1-9]\d?|10[01])$/u.test(arguments_[4]))) return Promise.reject(new RedisFrameError('protocol'))
    // One explicit JSONPath only; reject formatting options and additional paths.
    if (command === 'JSON.GET' && !(arguments_.length === 2 && Buffer.isBuffer(arguments_[0]) && typeof arguments_[1] === 'string' && arguments_[1].startsWith('$') && Buffer.byteLength(arguments_[1]) <= 1024 && Buffer.from(arguments_[1], 'utf8').toString('utf8') === arguments_[1])) return Promise.reject(new RedisFrameError('protocol'))
    // CLIENT contains administrative subcommands: permit only its read-only LIST form.
    if (command === 'CLIENT' && !(arguments_.length === 1 && arguments_[0] === 'LIST')) return Promise.reject(new RedisFrameError('protocol'))
    // GEO reads accept only one member or one fixed member pair, never an open search.
    if (command === 'GEOPOS' && !(arguments_.length === 2 && arguments_.every(Buffer.isBuffer))) return Promise.reject(new RedisFrameError('protocol'))
    if (command === 'GEODIST' && !(arguments_.length === 4 && arguments_.slice(0, 3).every(Buffer.isBuffer) && typeof arguments_[3] === 'string' && ['m', 'km', 'ft', 'mi'].includes(arguments_[3]))) return Promise.reject(new RedisFrameError('protocol'))
    if (!READ_COMMANDS.has(command) || (command === 'DBSIZE' && arguments_.length !== 0) || (command === 'CONFIG' && (arguments_.length !== 2 || arguments_[0] !== 'GET' || arguments_[1] !== 'databases')) || (command === 'INFO' && !(arguments_.length === 1 && typeof arguments_[0] === 'string' && ['keyspace', 'server', 'memory', 'clients', 'stats'].includes(arguments_[0]))) || (command === 'MEMORY' && !(arguments_.length === 4 && arguments_[0] === 'USAGE' && Buffer.isBuffer(arguments_[1]) && arguments_[2] === 'SAMPLES' && arguments_[3] === '5')) || (command === 'SLOWLOG' && !(arguments_.length === 2 && arguments_[0] === 'GET' && typeof arguments_[1] === 'string' && /^(?:[1-9]|10)$/u.test(arguments_[1]))) || (command === 'XINFO' && !(arguments_.length === 2 && arguments_[0] === 'GROUPS' && Buffer.isBuffer(arguments_[1])))) return Promise.reject(new RedisFrameError('protocol'))
    return this.request([command, ...arguments_], signal, Math.min(deadline, Date.now() + READ_TIMEOUT), beforeDispatch)
  }

  /** Cancellation rejects the caller promptly, but drains an active bounded reply.
   * The queue still waits for that frame; a hard deadline closes a stalled socket.
   * Thus cancelling a view cannot cause the next command to consume its old reply.
   */
  private request(arguments_: readonly RedisArgument[], signal: AbortSignal, deadline: number, beforeDispatch: () => void): Promise<RedisReply> {
    if (signal.aborted) return Promise.reject(new RedisTransportError('cancelled'))
    if (this.queued >= MAX_QUEUE) return Promise.reject(new RedisTransportError('busy'))
    const frame = encodeCommand(arguments_)
    this.queued++
    const operation = this.pending.then(() => {
      if (signal.aborted) throw new RedisTransportError('cancelled')
      if (Date.now() >= deadline) throw new RedisTransportError('timeout')
      if (this.failure !== null) throw this.failure
      beforeDispatch()
      return new Promise<RedisReply>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const finish = () => { if (timer !== undefined) clearTimeout(timer); if (this.active === active) this.active = null }
        const active: PendingFrame = {
          decoder: new RespDecoder(),
          resolve: value => { finish(); resolve(value) },
          reject: error => { finish(); reject(error) },
        }
        this.active = active
        timer = setTimeout(() => { this.fail(new RedisTransportError('timeout')) }, Math.max(0, deadline - Date.now()))
        timer.unref()
        this.socket.write(frame, error => { if (error !== null && error !== undefined) this.fail(error) })
      })
    }).finally(() => { this.queued-- })
    this.pending = operation.then(() => undefined, () => undefined)
    let abort = () => undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const interrupted = new Promise<never>((_resolve, reject) => {
      abort = () => { reject(new RedisTransportError('cancelled')) }
      signal.addEventListener('abort', abort, { once: true })
      timer = setTimeout(() => { reject(new RedisTransportError('timeout')) }, Math.max(0, deadline - Date.now()))
      timer.unref()
      if (signal.aborted) abort()
    })
    return Promise.race([operation, interrupted]).finally(() => {
      signal.removeEventListener('abort', abort)
      if (timer !== undefined) clearTimeout(timer)
    })
  }
}
