import type { BloomInfo, BloomReadRequest, BloomReadResult, KeyMetadata } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

const unavailable = (error: unknown): boolean => error instanceof RedisReplyError && /^ERR (?:unknown command|wrong number of arguments)(?: |$)/iu.test(error.message)
function infoAt(reply: RedisReply): BloomInfo {
  if (!Array.isArray(reply) || reply.length !== 10) throw new RedisFrameError('protocol')
  const fields = new Map<string, RedisReply>()
  for (let index = 0; index < reply.length; index += 2) {
    const name = reply[index], value = reply[index + 1]
    if (typeof name !== 'string' || value === undefined || fields.has(name)) throw new RedisFrameError('protocol')
    fields.set(name, value)
  }
  const integer = (name: string): string => {
    const value = fields.get(name)
    if (typeof value !== 'bigint' || value < 0n || value > (1n << 63n) - 1n) throw new RedisFrameError('protocol')
    return String(value)
  }
  return { capacity: integer('Capacity'), size: integer('Size'), filters: integer('Number of filters'), inserted: integer('Number of items inserted'), expansion: fields.get('Expansion rate') === null ? null : integer('Expansion rate') }
}

/** MBbloomCF is a distinct type. A raw EXISTS zero also covers missing/wrong
 * types, so it is never published without the surrounding TYPE/TTL guards.
 */
export class RedisBloom {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: BloomReadRequest, signal: AbortSignal): Promise<BloomReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: BloomReadResult['state'], error: BloomReadResult['error'] = null, metadata: KeyMetadata | null = null): BloomReadResult => ({ state, error, metadata, info: null, infoState: null, itemBase64: request.itemBase64, membership: null, sampledAt: new Date().toISOString() })
    try {
      const key = Buffer.from(request.keyBase64, 'base64'), type = await context.type(key)
      if (type === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (type !== 'MBbloom--') return result('unsupported', null, { type, ttlMs: String(firstTtl), length: null })
      let info: BloomInfo | null = null, infoState: BloomReadResult['infoState'] = 'available'
      try { info = infoAt(await context.command('BF.INFO', [key])) }
      catch (error) {
        if (context.signal.aborted) throw error
        if (error instanceof RedisReplyError && /^(?:NOPERM|DENIED)(?: |$)/u.test(error.message)) infoState = 'permission'
        else if (unavailable(error)) infoState = 'unavailable'
        else throw error
      }
      let membership: BloomReadResult['membership'] = null
      if (request.itemBase64 !== null) {
        const flag = await context.command('BF.EXISTS', [key, Buffer.from(request.itemBase64, 'base64')])
        if (flag !== 0n && flag !== 1n) throw new RedisFrameError('protocol')
        membership = flag === 0n ? 'absent' : 'maybe-present'
      }
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== type) return result('changed')
      const ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      context.signal.throwIfAborted()
      return { ...result('value', null, { type, ttlMs: String(ttl), length: null }), info, infoState, membership }
    } catch (error) {
      if (!context.signal.aborted && unavailable(error)) return result('unavailable')
      if (!context.signal.aborted && error instanceof RedisReplyError && /^ERR not found$/u.test(error.message)) {
        try {
          const type = await context.type(Buffer.from(request.keyBase64, 'base64'))
          return type === 'none' ? result('missing') : type !== 'MBbloom--' ? result('changed') : result('failed', 'protocol')
        } catch (guardError) { return result('failed', context.error(guardError)) }
      }
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally { context.dispose() }
  }
}
