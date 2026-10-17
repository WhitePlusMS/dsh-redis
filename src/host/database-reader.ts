import { MAX_INFO_BYTES, type DatabasesReadRequest, type DatabasesReadResult } from '../domain.ts'
import { parseDatabaseKeyspace } from '../redis-databases.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

/** Three fixed reads share one owner/DB guard and one absolute deadline.
 * ACL/disabled metadata is optional; transport and invalid replies are failures.
 */
export class RedisDatabases {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: DatabasesReadRequest, signal: AbortSignal): Promise<DatabasesReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const optional = async (command: 'DBSIZE' | 'INFO' | 'CONFIG', args: readonly string[]): Promise<RedisReply | undefined> => {
      try { return await context.command(command, args) }
      catch (error) {
        if (error instanceof RedisReplyError && /^(?:NOPERM|ERR unknown command|ERR unknown subcommand)/iu.test(error.message)) return undefined
        throw error
      }
    }
    try {
      const size = await optional('DBSIZE', [])
      if (size !== undefined && (typeof size !== 'bigint' || size < 0n || size > (1n << 63n) - 1n)) throw new RedisFrameError('protocol')
      const info = await optional('INFO', ['keyspace'])
      let keyspace: NonNullable<DatabasesReadResult['catalog']>['keyspace'] = null
      if (info !== undefined) {
        if (!Buffer.isBuffer(info)) throw new RedisFrameError('protocol')
        if (info.length > MAX_INFO_BYTES) throw new RedisFrameError('oversize')
        try { keyspace = parseDatabaseKeyspace(new TextDecoder('utf-8', { fatal: true }).decode(info)) }
        catch (error) { throw new RedisFrameError(error instanceof RangeError ? 'oversize' : 'protocol') }
      }
      const config = await optional('CONFIG', ['GET', 'databases'])
      let databaseCount: number | null = null
      if (config !== undefined) {
        if (!Array.isArray(config) || config.length !== 2 || !Buffer.isBuffer(config[0]) || !config[0].equals(Buffer.from('databases')) || !Buffer.isBuffer(config[1]) || !/^[1-9]\d{0,4}$/u.test(config[1].toString('utf8'))) throw new RedisFrameError('protocol')
        databaseCount = Number(config[1].toString('utf8'))
        if (databaseCount > 65536 || request.target.db >= databaseCount || keyspace?.some(item => item.db >= databaseCount!)) throw new RedisFrameError('protocol')
      }
      context.signal.throwIfAborted()
      return { state: 'value', error: null, catalog: { databaseCount, keyspace, currentKeys: size === undefined ? null : String(size) }, sampledAt: new Date().toISOString() }
    } catch (error) {
      return { state: 'failed', error: context.error(error), catalog: null, sampledAt: new Date().toISOString() }
    } finally { context.dispose() }
  }
}
