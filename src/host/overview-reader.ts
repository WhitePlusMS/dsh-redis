import { MAX_INFO_BYTES, type OverviewReadRequest, type OverviewReadResult } from '../domain.ts'
import { parseRedisInfo } from '../redis-info.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

/** One fixed diagnostic command, with the same owner/generation/deadline guards
 * as key readers. Raw INFO never enters client state or public error messages.
 */
export class RedisOverview {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: OverviewReadRequest, signal: AbortSignal): Promise<OverviewReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    try {
      const reply = await context.command('INFO', [])
      if (!Buffer.isBuffer(reply)) throw new RedisFrameError('protocol')
      if (reply.length > MAX_INFO_BYTES) throw new RedisFrameError('oversize')
      let fields: OverviewReadResult['fields']
      try { fields = parseRedisInfo(new TextDecoder('utf-8', { fatal: true }).decode(reply)) }
      catch { throw new RedisFrameError('protocol') }
      context.signal.throwIfAborted()
      return { state: 'value', error: null, fields, sampledAt: new Date().toISOString() }
    } catch (error) {
      return { state: 'failed', error: context.error(error), fields: null, sampledAt: new Date().toISOString() }
    } finally { context.dispose() }
  }
}
