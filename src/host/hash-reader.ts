import { MAX_KEY_BYTES, MAX_SCAN_KEYS, MAX_SCAN_JSON_BYTES, type HashEntry, type KeyMetadata, type ScanHashRequest, type ScanHashResult } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisScanCursors, scanReply, type ScanState } from './scan-cursors.ts'
import { byteIdentity } from './byte-identity.ts'
import { valuePrefix } from './value-prefix.ts'

/** One HSCAN per explicit action. COUNT is a hint, never a memory guarantee. */
export class RedisHashes {
  private readonly scans = new RedisScanCursors()
  constructor(private readonly connections: RedisConnections, private readonly retryCancelled = false) {}
  disposeSession(sessionId: string): void { this.scans.disposeSession(sessionId) }
  dispose(): void { this.scans.dispose() }

  async scan(sessionId: string, request: ScanHashRequest, signal: AbortSignal): Promise<ScanHashResult> {
    let scan: ScanState | undefined
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal, () => { if (scan !== undefined) this.scans.validate(sessionId, scan) })
    const result = (state: ScanHashResult['state'], error: ScanHashResult['error'] = null, metadata: KeyMetadata | null = null): ScanHashResult => ({ state, error, metadata, entries: [], cursor: null, sampledAt: new Date().toISOString() })
    try {
      signal.throwIfAborted()
      this.connections.assertTarget(sessionId, request.target)
      scan = this.scans.begin(sessionId, JSON.stringify([request.target.id, request.target.generation, request.target.db, request.keyBase64, request.pattern]), request.cursor)
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'hash') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('HLEN', [key])
      const reply = await context.command('HSCAN', [key, scan.cursor, 'MATCH', request.pattern, 'COUNT', '100'])
      const { cursor, values } = scanReply(reply)
      if (values.length % 2 !== 0) throw new RedisFrameError('protocol')
      if (values.length / 2 > MAX_SCAN_KEYS) throw new RedisFrameError('oversize')
      const entries = new Map<string, HashEntry>()
      for (let index = 0; index < values.length; index += 2) {
        const field = values[index], value = values[index + 1]
        if (!Buffer.isBuffer(field) || !Buffer.isBuffer(value)) throw new RedisFrameError('protocol')
        if (field.length > MAX_KEY_BYTES) throw new RedisFrameError('oversize')
        const identity = byteIdentity(field)
        entries.set(identity.base64, { field: identity, value: valuePrefix(value) })
      }
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'hash') return result('changed')
      const secondLength = await context.integer('HLEN', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      if (length !== secondLength || BigInt(entries.size) > secondLength) return result('changed')
      context.signal.throwIfAborted()
      // Budget before issuing a new token; do not drop a tail while advancing.
      const page: ScanHashResult = { ...result('page', null, { type: 'hash', ttlMs: String(ttl), length: String(secondLength) }), entries: [...entries.values()] }
      if (Buffer.byteLength(JSON.stringify(page)) + 36 > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      const token = this.scans.advance(sessionId, scan, cursor)
      scan = undefined // The returned token owns the continuation now.
      return { ...page, cursor: token }
    } catch (error) {
      const code = context.error(error)
      // Only the AI reader opts in; an explicit cancellation may retry its
      // original stateless cursor if this session and scan are still current.
      if (this.retryCancelled && signal.aborted && scan !== undefined) {
        try { this.connections.assertTarget(sessionId, request.target); if (this.scans.restore(sessionId, scan, request.cursor)) scan = undefined } catch { /* target changed */ }
      }
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally {
      if (scan !== undefined) this.scans.discard(sessionId, scan)
      context.dispose()
    }
  }
}
