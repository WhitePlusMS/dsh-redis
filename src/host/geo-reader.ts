import { MAX_GEO_ARGUMENT_BYTES, MAX_SCAN_JSON_BYTES, type GeoPosition, type GeoReadRequest, type GeoReadResult, type KeyMetadata } from '../domain.ts'
import { isGeoPosition } from '../redis-geo.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'
import { zsetEntries } from './zset-values.ts'

function positionAt(reply: RedisReply | undefined): GeoPosition | null {
  if (reply === null) return null
  if (!Array.isArray(reply) || reply.length !== 2 || !Buffer.isBuffer(reply[0]) || !Buffer.isBuffer(reply[1])) throw new RedisFrameError('protocol')
  const position = { longitude: reply[0].toString('utf8'), latitude: reply[1].toString('utf8') }
  if (!isGeoPosition(position)) throw new RedisFrameError('protocol')
  return position
}

/** One bounded rank interval plus GEOPOS, with a single operation deadline.
 * Ordinary ZSet scores may decode too: positions are an explicit interpretation.
 */
export class RedisGeo {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: GeoReadRequest, signal: AbortSignal): Promise<GeoReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: GeoReadResult['state'], error: GeoReadResult['error'] = null, metadata: KeyMetadata | null = null): GeoReadResult => ({ state, error, metadata, entries: [], offset: request.offset, nextOffset: null, sampledAt: new Date().toISOString() })
    try {
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'zset') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('ZCARD', [key]), offset = BigInt(request.offset), maximum = (1n << 63n) - 1n
      const end = offset + BigInt(request.count) - 1n
      const reply = await context.command('ZRANGE', [key, request.offset, String(end > maximum ? maximum : end), 'WITHSCORES'])
      if (!Array.isArray(reply)) throw new RedisFrameError('protocol')
      const rows = zsetEntries(reply, request.offset, request.count)
      // Leave room for RESP command/argument headers under the transport's
      // 128 KiB request limit, before decoding Base64 or constructing arguments.
      if (key.length + rows.reduce((sum, entry) => sum + entry.member.byteLength, 0) > MAX_GEO_ARGUMENT_BYTES) throw new RedisFrameError('oversize')
      const positions = rows.length === 0 ? [] : await context.command('GEOPOS', [key, ...rows.map(entry => Buffer.from(entry.member.base64, 'base64'))])
      if (!Array.isArray(positions) || positions.length !== rows.length) throw new RedisFrameError('protocol')
      const entries = rows.map((entry, index) => {
        if (entry.rank === null) throw new RedisFrameError('protocol')
        return { ...entry, rank: entry.rank, position: positionAt(positions[index]) }
      })
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'zset') return result('changed')
      const secondLength = await context.integer('ZCARD', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      const available = length > offset ? length - offset : 0n
      if (length !== secondLength || BigInt(rows.length) !== (available < BigInt(request.count) ? available : BigInt(request.count))) return result('changed')
      const next = offset + BigInt(rows.length)
      const page: GeoReadResult = { ...result('page', null, { type: 'zset', ttlMs: String(ttl), length: String(length) }), entries, nextOffset: rows.length > 0 && next < length ? String(next) : null }
      if (Buffer.byteLength(JSON.stringify(page)) > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      return page
    } catch (error) {
      if (!context.signal.aborted && error instanceof RedisReplyError && /^ERR unknown command(?: |$)/iu.test(error.message)) return result('unavailable')
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally { context.dispose() }
  }
}
