import { MAX_KEY_BYTES, MAX_SCAN_KEYS, MAX_SCAN_JSON_BYTES, type RedisKey, type KeyMetadata, type ScanSetRequest, type ScanSetResult } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisScanCursors, scanReply, type ScanState } from './scan-cursors.ts'
import { byteIdentity } from './byte-identity.ts'

/** One SSCAN per action. A full member, not a display prefix, is its identity. */
export class RedisSets {
  private readonly scans = new RedisScanCursors()
  constructor(private readonly connections: RedisConnections, private readonly retryCancelled = false) {}
  disposeSession(sessionId: string): void { this.scans.disposeSession(sessionId) }
  dispose(): void { this.scans.dispose() }

  async scan(sessionId: string, request: ScanSetRequest, signal: AbortSignal): Promise<ScanSetResult> {
    let scan: ScanState | undefined
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal, () => { if (scan !== undefined) this.scans.validate(sessionId, scan) })
    const result = (state: ScanSetResult['state'], error: ScanSetResult['error'] = null, metadata: KeyMetadata | null = null): ScanSetResult => ({ state, error, metadata, members: [], cursor: null, sampledAt: new Date().toISOString() })
    try {
      signal.throwIfAborted(); this.connections.assertTarget(sessionId, request.target)
      scan = this.scans.begin(sessionId, JSON.stringify([request.target.id, request.target.generation, request.target.db, request.keyBase64, request.pattern]), request.cursor)
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'set') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('SCARD', [key])
      const { cursor, values } = scanReply(await context.command('SSCAN', [key, scan.cursor, 'MATCH', request.pattern, 'COUNT', '100']))
      if (values.length > MAX_SCAN_KEYS) throw new RedisFrameError('oversize')
      const members = new Map<string, RedisKey>()
      for (const raw of values) {
        if (!Buffer.isBuffer(raw)) throw new RedisFrameError('protocol')
        if (raw.length > MAX_KEY_BYTES) throw new RedisFrameError('oversize')
        const member = byteIdentity(raw); members.set(member.base64, member)
      }
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'set') return result('changed')
      const secondLength = await context.integer('SCARD', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      if (length !== secondLength || BigInt(members.size) > secondLength) return result('changed')
      context.signal.throwIfAborted()
      const page: ScanSetResult = { ...result('page', null, { type: 'set', ttlMs: String(ttl), length: String(secondLength) }), members: [...members.values()] }
      if (Buffer.byteLength(JSON.stringify(page)) + 36 > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      const token = this.scans.advance(sessionId, scan, cursor)
      scan = undefined
      return { ...page, cursor: token }
    } catch (error) {
      const code = context.error(error)
      // Only the AI reader retries a cancelled stateless cursor, and only
      // while the same target and reader state remain current.
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
