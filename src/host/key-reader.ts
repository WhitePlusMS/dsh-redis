import { MAX_KEY_BYTES, MAX_SCAN_JSON_BYTES, MAX_SCAN_KEYS, type ScanKeysRequest, type ScanKeysResult, type RedisKey } from '../domain.ts'
import { connectionErrorCode, type RedisConnections } from './connection-service.ts'
import { RedisFrameError } from './resp.ts'
import { RedisScanCursors, scanReply, type ScanState } from './scan-cursors.ts'
import { byteIdentity } from './byte-identity.ts'

/** MATCH filters returned names; COUNT is a Redis work hint, not a hard limit. */
export const KEY_SCAN_SCOPE = Object.freeze({ command: 'SCAN', traversal: 'current_db_keyspace', match: 'key_names', countHint: 100, countIsLimit: false, fullIterationMayTraverseEntireKeyspace: true } as const)

/** Exactly one SCAN per explicit action; cursor tokens cannot be replayed or moved. */
export class RedisKeys {
  private readonly scans = new RedisScanCursors()
  constructor(private readonly connections: RedisConnections) {}
  disposeSession(sessionId: string): void { this.scans.disposeSession(sessionId) }
  dispose(): void { this.scans.dispose() }

  async scan(sessionId: string, request: ScanKeysRequest, signal: AbortSignal): Promise<ScanKeysResult> {
    let scan: ScanState | undefined
    try {
      signal.throwIfAborted()
      this.connections.assertTarget(sessionId, request.target)
      scan = this.scans.begin(sessionId, JSON.stringify([request.target.id, request.target.generation, request.target.db, request.pattern]), request.cursor)
      const current = scan
      const guard = () => { this.scans.validate(sessionId, current) }
      const reply = await this.connections.read(sessionId, request.target, 'SCAN', [current.cursor, 'MATCH', request.pattern, 'COUNT', String(KEY_SCAN_SCOPE.countHint)], signal, guard)
      const { cursor, values } = scanReply(reply)
      if (values.length > MAX_SCAN_KEYS) throw new RedisFrameError('oversize')
      const unique = new Map<string, RedisKey>()
      for (const raw of values) {
        if (!Buffer.isBuffer(raw)) throw new RedisFrameError('protocol')
        if (raw.length > MAX_KEY_BYTES) throw new RedisFrameError('oversize')
        const base64 = raw.toString('base64')
        unique.set(base64, byteIdentity(raw))
      }
      guard(); signal.throwIfAborted()
      const token = this.scans.advance(sessionId, current, cursor)
      const result: ScanKeysResult = { state: 'page', error: null, keys: [...unique.values()], cursor: token, sampledAt: new Date().toISOString() }
      // Base64/JSON amplification is budgeted as well; never advance after dropping keys.
      if (Buffer.byteLength(JSON.stringify(result)) > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      return result
    } catch (error) {
      if (scan !== undefined) {
        // SCAN has no server-side cursor state; only restore if this remains
        // the same connection and no newer scan has replaced this state.
        let restored = false
        if (signal.aborted) {
          try { this.connections.assertTarget(sessionId, request.target); restored = this.scans.restore(sessionId, scan, request.cursor) } catch { /* target changed */ }
        }
        if (!restored) this.scans.discard(sessionId, scan)
      }
      return { state: 'failed', error: signal.aborted ? 'cancelled' : connectionErrorCode(error), keys: [], cursor: null, sampledAt: new Date().toISOString() }
    }
  }
}
