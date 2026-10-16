import { MAX_CLIENT_LIST_BYTES, type ClientListReadRequest, type ClientListReadResult } from '../domain.ts'
import { parseClientList } from '../redis-client-list.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

/** A fixed LIST subcommand cannot kill, pause or configure clients. Addresses
 * appear only in this bounded DTO, never in routine logs or raw error messages.
 */
export class RedisClientList {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: ClientListReadRequest, signal: AbortSignal): Promise<ClientListReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: ClientListReadResult['state'], error: ClientListReadResult['error'] = null): ClientListReadResult => ({ state, error, entries: [], total: 0, limited: false, sampledAt: new Date().toISOString() })
    try {
      const reply = await context.command('CLIENT', ['LIST'])
      if (!Buffer.isBuffer(reply)) throw new RedisFrameError('protocol')
      if (reply.length > MAX_CLIENT_LIST_BYTES) throw new RedisFrameError('oversize')
      let parsed: Pick<ClientListReadResult, 'entries' | 'total' | 'limited'>
      try { parsed = parseClientList(new TextDecoder('utf-8', { fatal: true }).decode(reply)) }
      catch { throw new RedisFrameError('protocol') }
      context.signal.throwIfAborted()
      return { ...result('page'), ...parsed }
    } catch (error) {
      if (!context.signal.aborted && error instanceof RedisReplyError && /^ERR (?:unknown command|unknown subcommand|wrong number of arguments)(?: |$)/iu.test(error.message)) return result('unavailable')
      return result('failed', context.error(error))
    } finally { context.dispose() }
  }
}
