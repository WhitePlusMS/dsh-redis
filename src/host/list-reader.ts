import { MAX_SCAN_JSON_BYTES, type KeyMetadata, type ListReadRequest, type ListReadResult } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisFrameError } from './resp.ts'
import { valuePrefix } from './value-prefix.ts'

const MAX_INTEGER = (1n << 63n) - 1n

/** Fixed nonnegative LRANGE interval, preserving repeated values and positions. */
export class RedisLists {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: ListReadRequest, signal: AbortSignal, validate: () => void = () => undefined): Promise<ListReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal, validate)
    const result = (state: ListReadResult['state'], error: ListReadResult['error'] = null, metadata: KeyMetadata | null = null): ListReadResult => ({ state, error, metadata, entries: [], offset: request.offset, nextOffset: null, sampledAt: new Date().toISOString() })
    try {
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'list') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('LLEN', [key]), offset = BigInt(request.offset)
      const wantedEnd = offset + BigInt(request.count) - 1n, end = wantedEnd > MAX_INTEGER ? MAX_INTEGER : wantedEnd
      const reply = await context.command('LRANGE', [key, String(offset), String(end)])
      if (!Array.isArray(reply) || reply.length > request.count) throw new RedisFrameError('protocol')
      const entries = reply.map((raw, index) => {
        if (!Buffer.isBuffer(raw)) throw new RedisFrameError('protocol')
        return { index: String(offset + BigInt(index)), value: valuePrefix(raw) }
      })
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'list') return result('changed')
      const secondLength = await context.integer('LLEN', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      const available = length > offset ? length - offset : 0n, expected = available < BigInt(request.count) ? available : BigInt(request.count)
      if (length !== secondLength || BigInt(entries.length) !== expected) return result('changed')
      const next = offset + BigInt(entries.length)
      const page: ListReadResult = { ...result('page', null, { type: 'list', ttlMs: String(ttl), length: String(secondLength) }), entries, nextOffset: entries.length > 0 && next < secondLength ? String(next) : null }
      if (Buffer.byteLength(JSON.stringify(page)) > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      return page
    } catch (error) {
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally { context.dispose() }
  }
}
