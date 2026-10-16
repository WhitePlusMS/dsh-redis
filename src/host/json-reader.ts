import { JSON_VALUE_TYPES, MAX_SCAN_KEYS, MAX_SCAN_JSON_BYTES, MAX_VALUE_BYTES, type JsonValueType, type JsonReadRequest, type JsonReadResult, type KeyMetadata } from '../domain.ts'
import { isRedisJsonType, jsonMatchCount } from '../redis-json.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

function matchTypes(reply: RedisReply): readonly JsonValueType[] | null {
  if (reply === null) return null
  if (!Array.isArray(reply)) throw new RedisFrameError('protocol')
  if (reply.length > MAX_SCAN_KEYS) throw new RedisFrameError('oversize')
  return reply.map(item => {
    if (!Buffer.isBuffer(item)) throw new RedisFrameError('protocol')
    const type = JSON_VALUE_TYPES.find(value => item.equals(Buffer.from(value)))
    if (type === undefined) throw new RedisFrameError('protocol')
    return type
  })
}

/** JSON has no generic pagination. Refuse a whole oversized match and let the
 * user narrow its path. The transport bounds wire bytes before allocation.
 */
export class RedisJson {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: JsonReadRequest, signal: AbortSignal): Promise<JsonReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: JsonReadResult['state'], error: JsonReadResult['error'] = null, metadata: KeyMetadata | null = null): JsonReadResult => ({
      state, error, metadata, path: request.path, matchTypes: [], base64: '', byteLength: 0, sampledAt: new Date().toISOString(),
    })
    try {
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (!isRedisJsonType(firstType)) return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const types = matchTypes(await context.command('JSON.TYPE', [key, request.path]))
      if (types === null) return result('missing')
      const bytes = types.length === 0 ? null : await context.command('JSON.GET', [key, request.path])
      if (types.length > 0 && bytes === null) return result('missing')
      if (bytes !== null && !Buffer.isBuffer(bytes)) throw new RedisFrameError('protocol')
      if (bytes !== null && bytes.length > MAX_VALUE_BYTES) throw new RedisFrameError('oversize')
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== firstType) return result('changed')
      const secondTypes = matchTypes(await context.command('JSON.TYPE', [key, request.path])), ttl = await context.ttl(key)
      if (secondTypes === null || ttl === -2n) return result('missing')
      if (types.length !== secondTypes.length || types.some((type, index) => type !== secondTypes[index])) return result('changed')
      const metadata = { type: firstType, ttlMs: String(ttl), length: null }
      if (bytes === null) return result('path-missing', null, metadata)
      try { if (jsonMatchCount(bytes) !== types.length) return result('changed') }
      catch { throw new RedisFrameError('protocol') }
      const value: JsonReadResult = { ...result('value', null, metadata), matchTypes: types, base64: bytes.toString('base64'), byteLength: bytes.length }
      if (Buffer.byteLength(JSON.stringify(value)) > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      return value
    } catch (error) {
      // Fixed signatures observed on RedisJSON 80209. Raw parser errors may
      // include a private path/key, so never return their text to the client.
      if (!context.signal.aborted && error instanceof RedisReplyError) {
        if (/^ERR unknown command(?: |$)/iu.test(error.message)) return result('unavailable')
        if (/^(?:ERR )?Error occurred at position \d+, Error at position \d+:/u.test(error.message)) return result('invalid-path')
        if (/^(?:WRONGTYPE )?Existing key has wrong Redis type$/u.test(error.message)) return result('changed')
      }
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally { context.dispose() }
  }
}
