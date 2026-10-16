import type { ConnectionErrorCode, DatabaseTarget } from '../domain.ts'
import { connectionErrorCode, type RedisConnections } from './connection-service.ts'
import { RedisFrameError, type RedisArgument, type RedisReply } from './resp.ts'
import type { RedisReadCommand } from './redis-transport.ts'

/** One operation owns one absolute deadline across metadata and value commands. */
export class RedisReadContext {
  private readonly timeout = new AbortController()
  private readonly deadline = Date.now() + 10000
  private readonly timer = setTimeout(() => this.timeout.abort(), 10000)
  readonly signal: AbortSignal
  constructor(private readonly connections: RedisConnections, private readonly sessionId: string, private readonly target: DatabaseTarget, private readonly caller: AbortSignal, private readonly validate: () => void = () => undefined) {
    this.timer.unref()
    this.signal = AbortSignal.any([caller, this.timeout.signal])
  }
  command(command: Exclude<RedisReadCommand, 'SELECT'>, arguments_: readonly RedisArgument[]): Promise<RedisReply> {
    return this.connections.read(this.sessionId, this.target, command, arguments_, this.signal, this.validate, this.deadline)
  }
  async type(key: Buffer): Promise<string> {
    const reply = await this.command('TYPE', [key])
    if (typeof reply !== 'string' || !/^[\w-]{1,128}$/u.test(reply)) throw new RedisFrameError('protocol')
    return reply
  }
  async integer(command: Exclude<RedisReadCommand, 'SELECT'>, args: readonly RedisArgument[], minimum = 0n): Promise<bigint> {
    const reply = await this.command(command, args)
    if (typeof reply !== 'bigint' || reply < minimum) throw new RedisFrameError('protocol')
    return reply
  }
  ttl(key: Buffer): Promise<bigint> { return this.integer('PTTL', [key], -2n) }
  error(error: unknown): ConnectionErrorCode { return this.caller.aborted ? 'cancelled' : this.timeout.signal.aborted ? 'timeout' : connectionErrorCode(error) }
  dispose(): void { clearTimeout(this.timer) }
}
