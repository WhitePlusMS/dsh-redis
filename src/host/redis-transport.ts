/** One bounded RESP2 command at a time on an owned TCP/TLS connection. */
import { createConnection, isIP, type Socket } from 'node:net'
import { connect as connectTls } from 'node:tls'
import type { ConnectionRequest } from '../domain.ts'
import { encodeCommand, RedisFrameError, RedisReplyError, RespDecoder, type RedisArgument, type RedisReply } from './resp.ts'

export type RedisReadCommand = 'SELECT' | 'SCAN' | 'TYPE' | 'PTTL' | 'STRLEN' | 'GETRANGE' | 'HLEN' | 'HSCAN' | 'LLEN' | 'LRANGE' | 'SCARD' | 'SSCAN' | 'ZCARD' | 'ZRANGE' | 'ZSCAN' | 'XLEN' | 'XRANGE' | 'XREVRANGE' | 'JSON.TYPE' | 'JSON.GET' | 'GEOPOS' | 'PFCOUNT' | 'TS.INFO' | 'TS.RANGE' | 'TS.REVRANGE' | 'BF.INFO' | 'BF.EXISTS'
const READ_COMMANDS: ReadonlySet<string> = new Set<RedisReadCommand>(['SELECT', 'SCAN', 'TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'HLEN', 'HSCAN', 'LLEN', 'LRANGE', 'SCARD', 'SSCAN', 'ZCARD', 'ZRANGE', 'ZSCAN', 'XLEN', 'XRANGE', 'XREVRANGE', 'JSON.TYPE', 'JSON.GET', 'GEOPOS', 'PFCOUNT', 'TS.INFO', 'TS.RANGE', 'TS.REVRANGE', 'BF.INFO', 'BF.EXISTS'])
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
    if (!READ_COMMANDS.has(command)) return Promise.reject(new RedisFrameError('protocol'))
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
