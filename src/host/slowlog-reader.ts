import { MAX_SLOWLOG_ARGUMENTS, MAX_SLOWLOG_SUMMARY_ARGS, type SlowLogEntry, type SlowLogReadRequest, type SlowLogReadResult } from '../domain.ts'
import { isSlowLogCommand } from '../redis-slowlog.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

function integerAt(value: RedisReply | undefined): string {
  if (typeof value !== 'bigint' || value < 0n || value > 9223372036854775807n) throw new RedisFrameError('protocol')
  return String(value)
}
function entryAt(value: RedisReply): SlowLogEntry {
  if (!Array.isArray(value) || ![4, 6, 7].includes(value.length)) throw new RedisFrameError('protocol')
  const args = value[3]
  if (!Array.isArray(args) || args.length < 1 || !args.every(Buffer.isBuffer)) throw new RedisFrameError('protocol')
  if (args.length > MAX_SLOWLOG_ARGUMENTS) throw new RedisFrameError('oversize')
  if (value.length >= 6 && (!Buffer.isBuffer(value[4]) || !Buffer.isBuffer(value[5]))) throw new RedisFrameError('protocol')
  const originalArgumentCount = value.length === 7 ? integerAt(value[6]) : null
  if (originalArgumentCount !== null && BigInt(originalArgumentCount) < BigInt(args.length)) throw new RedisFrameError('protocol')
  const rawName = args[0]
  // A bounded ASCII conversion cannot substitute damaged byte sequences. All
  // remaining arguments stay opaque: only lengths of logged fragments leave Host.
  const name = Buffer.isBuffer(rawName) && rawName.length <= 64 && rawName.every(byte => byte < 128) ? rawName.toString('ascii') : null
  return { id: integerAt(value[0]), timestampSeconds: integerAt(value[1]), durationUs: integerAt(value[2]), command: isSlowLogCommand(name) ? name : null, loggedArgumentCount: args.length, argumentBytes: args.slice(1, 1 + MAX_SLOWLOG_SUMMARY_ARGS).map(argument => { if (!Buffer.isBuffer(argument)) throw new RedisFrameError('protocol'); return argument.length }), originalArgumentCount }
}

/** Count+1 reports whether this bounded newest-first slice has another entry.
 * It never reads all entries or resets the server's log/configuration.
 */
export class RedisSlowLog {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: SlowLogReadRequest, signal: AbortSignal): Promise<SlowLogReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: SlowLogReadResult['state'], error: SlowLogReadResult['error'] = null): SlowLogReadResult => ({ state, error, entries: [], count: request.count, more: false, sampledAt: new Date().toISOString() })
    try {
      const reply = await context.command('SLOWLOG', ['GET', String(request.count + 1)])
      if (!Array.isArray(reply) || reply.length > request.count + 1) throw new RedisFrameError('protocol')
      const entries = reply.map(entryAt)
      if (entries.some((entry, index) => index > 0 && BigInt(entry.id) >= BigInt(entries[index - 1]?.id ?? '0'))) throw new RedisFrameError('protocol')
      context.signal.throwIfAborted()
      return { ...result('page'), entries: entries.slice(0, request.count), more: entries.length > request.count }
    } catch (error) {
      if (!context.signal.aborted && error instanceof RedisReplyError && /^ERR (?:unknown command|unknown subcommand|wrong number of arguments)(?: |$)/iu.test(error.message)) return result('unavailable')
      return result('failed', context.error(error))
    } finally { context.dispose() }
  }
}
