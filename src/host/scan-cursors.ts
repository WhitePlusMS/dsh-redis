import { randomUUID } from 'node:crypto'
import { ConnectionFailure } from './connection-service.ts'
import { RedisFrameError, type RedisReply } from './resp.ts'

export interface ScanState { readonly binding: string; cursor: string; token: string | null }

/** All SCAN-family cursors are unsigned-64-bit bulk strings, not JS numbers. */
export function scanReply(reply: RedisReply): { readonly cursor: string; readonly values: readonly RedisReply[] } {
  if (!Array.isArray(reply) || reply.length !== 2 || !Buffer.isBuffer(reply[0]) || !Array.isArray(reply[1])) throw new RedisFrameError('protocol')
  const cursor = reply[0].toString('utf8')
  if (!/^(?:0|[1-9]\d{0,19})$/u.test(cursor) || BigInt(cursor) > (1n << 64n) - 1n) throw new RedisFrameError('protocol')
  return { cursor, values: reply[1] }
}

/** One in-flight scan per owner, with a consumed token and a reader-defined binding.
 * Each reader owns a store, so different collection views do not invalidate one another.
 */
export class RedisScanCursors {
  private readonly sessions = new Map<string, ScanState>()
  begin(sessionId: string, binding: string, token: string | null): ScanState {
    if (token === null) {
      const state: ScanState = { binding, cursor: '0', token: null }
      this.sessions.set(sessionId, state); return state
    }
    const state = this.sessions.get(sessionId)
    if (state === undefined || state.binding !== binding || state.token !== token) throw new ConnectionFailure('stale')
    state.token = null
    return state
  }
  validate(sessionId: string, state: ScanState): void {
    if (this.sessions.get(sessionId) !== state) throw new ConnectionFailure('stale')
  }
  advance(sessionId: string, state: ScanState, cursor: string): string | null {
    this.validate(sessionId, state)
    const token = cursor === '0' ? null : randomUUID()
    if (token === null) this.sessions.delete(sessionId)
    else { state.cursor = cursor; state.token = token }
    return token
  }
  discard(sessionId: string, state: ScanState): void { if (this.sessions.get(sessionId) === state) this.sessions.delete(sessionId) }
  disposeSession(sessionId: string): void { this.sessions.delete(sessionId) }
  dispose(): void { this.sessions.clear() }
}
