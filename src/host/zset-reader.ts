import { MAX_SCAN_KEYS, MAX_SCAN_JSON_BYTES, type KeyMetadata, type ZSetReadRequest, type ZSetReadResult } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisScanCursors, scanReply, type ScanState } from './scan-cursors.ts'
import { zsetEntries } from './zset-values.ts'

const MAX_INTEGER = (1n << 63n) - 1n

/** Fixed ascending ZRANGE WITHSCORES or one unordered ZSCAN, never a write path. */
export class RedisZSets {
  private readonly scans = new RedisScanCursors()
  constructor(private readonly connections: RedisConnections) {}
  disposeSession(sessionId: string): void { this.scans.disposeSession(sessionId) }
  dispose(): void { this.scans.dispose() }

  async read(sessionId: string, request: ZSetReadRequest, signal: AbortSignal): Promise<ZSetReadResult> {
    let scan: ScanState | undefined
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal, () => { if (scan !== undefined) this.scans.validate(sessionId, scan) })
    const result = (state: ZSetReadResult['state'], error: ZSetReadResult['error'] = null, metadata: KeyMetadata | null = null): ZSetReadResult => ({ state, error, metadata, mode: request.mode, entries: [], offset: request.mode === 'range' ? request.offset : null, nextOffset: null, cursor: null, sampledAt: new Date().toISOString() })
    try {
      signal.throwIfAborted(); this.connections.assertTarget(sessionId, request.target)
      if (request.mode === 'scan') scan = this.scans.begin(sessionId, JSON.stringify([request.target.id, request.target.generation, request.target.db, request.keyBase64, request.pattern]), request.cursor)
      else this.scans.disposeSession(sessionId)
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'zset') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('ZCARD', [key])
      let values: readonly RedisReply[], cursor = '0'
      if (request.mode === 'range') {
        const wantedEnd = BigInt(request.offset) + BigInt(request.count) - 1n
        const reply = await context.command('ZRANGE', [key, request.offset, String(wantedEnd > MAX_INTEGER ? MAX_INTEGER : wantedEnd), 'WITHSCORES'])
        if (!Array.isArray(reply)) throw new RedisFrameError('protocol')
        values = reply
      } else {
        if (scan === undefined) throw new RedisFrameError('protocol')
        const page = scanReply(await context.command('ZSCAN', [key, scan.cursor, 'MATCH', request.pattern, 'COUNT', '100']))
        values = page.values; cursor = page.cursor
      }
      const rows = zsetEntries(values, request.mode === 'range' ? request.offset : null, request.mode === 'range' ? request.count : MAX_SCAN_KEYS)
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'zset') return result('changed')
      const secondLength = await context.integer('ZCARD', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      if (length !== secondLength || BigInt(rows.length) > length) return result('changed')
      let nextOffset: string | null = null
      if (request.mode === 'range') {
        const available = length > BigInt(request.offset) ? length - BigInt(request.offset) : 0n
        if (BigInt(rows.length) !== (available < BigInt(request.count) ? available : BigInt(request.count))) return result('changed')
        const next = BigInt(request.offset) + BigInt(rows.length)
        nextOffset = rows.length > 0 && next < length ? String(next) : null
      }
      context.signal.throwIfAborted()
      const page: ZSetReadResult = { ...result('page', null, { type: 'zset', ttlMs: String(ttl), length: String(secondLength) }), entries: rows, nextOffset }
      if (Buffer.byteLength(JSON.stringify(page)) + 36 > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      if (scan !== undefined) { const token = this.scans.advance(sessionId, scan, cursor); scan = undefined; return { ...page, cursor: token } }
      return page
    } catch (error) {
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally {
      if (scan !== undefined) this.scans.discard(sessionId, scan)
      context.dispose()
    }
  }
}
