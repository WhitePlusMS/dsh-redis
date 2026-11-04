import { MAX_KEY_BYTES, MAX_SCAN_KEYS, MAX_SCAN_JSON_BYTES, type KeyMetadata, type StreamMessage, type StreamReadRequest, type StreamReadResult } from '../domain.ts'
import { compareStreamIds, isStreamId, MAX_STREAM_ID, withinStreamRange } from '../stream-id.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisScanCursors, type ScanState } from './scan-cursors.ts'
import { byteIdentity } from './byte-identity.ts'
import { valuePrefix } from './value-prefix.ts'

/** XRANGE/XREVRANGE do not advance consumer groups, add Pending entries or ACK. */
export class RedisStreams {
  private readonly pages = new RedisScanCursors()
  constructor(private readonly connections: RedisConnections, private readonly retryCancelled = false) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose() }

  async read(sessionId: string, request: StreamReadRequest, signal: AbortSignal, validate: () => void = () => undefined): Promise<StreamReadResult> {
    let pageState: ScanState | undefined
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal, () => { validate(); if (pageState !== undefined) this.pages.validate(sessionId, pageState) })
    const result = (state: StreamReadResult['state'], error: StreamReadResult['error'] = null, metadata: KeyMetadata | null = null): StreamReadResult => ({ state, error, metadata, direction: request.direction, start: request.start, end: request.end, messages: [], cursor: null, sampledAt: new Date().toISOString() })
    try {
      signal.throwIfAborted(); this.connections.assertTarget(sessionId, request.target)
      pageState = this.pages.begin(sessionId, JSON.stringify([request.target.id, request.target.generation, request.target.db, request.keyBase64, request.direction, request.start, request.end]), request.cursor)
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'stream') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('XLEN', [key]), forward = request.direction === 'forward'
      // '0' is the cursor store's fresh-page sentinel, never a Stream message ID.
      const boundary = pageState.cursor === '0' ? (forward ? request.start : request.end) : '(' + pageState.cursor
      const reply = await context.command(forward ? 'XRANGE' : 'XREVRANGE', [key, boundary, forward ? request.end : request.start, 'COUNT', String(request.count)])
      if (!Array.isArray(reply) || reply.length > request.count) throw new RedisFrameError('protocol')
      let previous = pageState.cursor === '0' ? null : pageState.cursor, fields = 0
      const messages: StreamMessage[] = reply.map(raw => {
        if (!Array.isArray(raw) || raw.length !== 2 || !Buffer.isBuffer(raw[0]) || !Array.isArray(raw[1]) || raw[1].length === 0 || raw[1].length % 2 !== 0) throw new RedisFrameError('protocol')
        const id = raw[0].toString('utf8')
        if (!isStreamId(id) || id === '0-0' || !withinStreamRange(id, request.start, request.end) || (previous !== null && (forward ? compareStreamIds(id, previous) <= 0 : compareStreamIds(id, previous) >= 0))) throw new RedisFrameError('protocol')
        previous = id; fields += raw[1].length / 2
        if (fields > MAX_SCAN_KEYS) throw new RedisFrameError('oversize')
        const pairs = []
        for (let index = 0; index < raw[1].length; index += 2) {
          const field = raw[1][index], value = raw[1][index + 1]
          if (!Buffer.isBuffer(field) || !Buffer.isBuffer(value)) throw new RedisFrameError('protocol')
          if (field.length > MAX_KEY_BYTES) throw new RedisFrameError('oversize')
          pairs.push({ field: byteIdentity(field), value: valuePrefix(value) })
        }
        return { id, fields: pairs }
      })
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'stream') return result('changed')
      const secondLength = await context.integer('XLEN', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      // Appends need not invalidate an ID-based page; trimming/deletion may do so.
      // An equal-length replacement still cannot be detected as an atomic snapshot.
      if (secondLength < length || BigInt(messages.length) > secondLength) return result('changed')
      context.signal.throwIfAborted()
      const page: StreamReadResult = { ...result('page', null, { type: 'stream', ttlMs: String(ttl), length: String(secondLength) }), messages }
      if (Buffer.byteLength(JSON.stringify(page)) + 36 > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      const last = messages.at(-1)?.id
      const done = messages.length < request.count || last === (forward ? request.end : request.start) || (forward ? last === MAX_STREAM_ID : last === '0-1')
      const token = this.pages.advance(sessionId, pageState, done || last === undefined ? '0' : last)
      pageState = undefined
      return { ...page, cursor: token }
    } catch (error) {
      const code = context.error(error)
      // AI continuation may retry a cancelled range while the target is current.
      if (this.retryCancelled && signal.aborted && pageState !== undefined) {
        try { this.connections.assertTarget(sessionId, request.target); if (this.pages.restore(sessionId, pageState, request.cursor)) pageState = undefined } catch { /* target changed */ }
      }
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally {
      if (pageState !== undefined) this.pages.discard(sessionId, pageState)
      context.dispose()
    }
  }
}
