import { MAX_SCAN_JSON_BYTES, type KeyMetadata, type TimeSeriesInfo, type TimeSeriesReadRequest, type TimeSeriesReadResult } from '../domain.ts'
import { isTimeSeriesType, isTimeSeriesTimestamp, isTimeSeriesValue, MAX_TIMESERIES_TIMESTAMP, withinTimeSeriesRange } from '../redis-timeseries.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError, type RedisReply } from './resp.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisScanCursors, type ScanState } from './scan-cursors.ts'

const unavailable = (error: unknown): boolean => error instanceof RedisReplyError && /^ERR (?:unknown command|wrong number of arguments)(?: |$)/iu.test(error.message)
function infoAt(reply: RedisReply): TimeSeriesInfo {
  if (!Array.isArray(reply) || reply.length % 2 !== 0) throw new RedisFrameError('protocol')
  const fields = new Map<string, RedisReply>()
  for (let index = 0; index < reply.length; index += 2) {
    const name = reply[index], value = reply[index + 1]
    if (typeof name !== 'string' || value === undefined || fields.has(name)) throw new RedisFrameError('protocol')
    fields.set(name, value)
  }
  const integer = (name: string): string => {
    const value = fields.get(name)
    if (typeof value !== 'bigint' || value < 0n || value > BigInt(MAX_TIMESERIES_TIMESTAMP)) throw new RedisFrameError('protocol')
    return String(value)
  }
  const result = { totalSamples: integer('totalSamples'), firstTimestamp: integer('firstTimestamp'), lastTimestamp: integer('lastTimestamp'), retentionTime: integer('retentionTime') }
  if (BigInt(result.firstTimestamp) > BigInt(result.lastTimestamp) || (result.totalSamples === '0' && (result.firstTimestamp !== '0' || result.lastTimestamp !== '0'))) throw new RedisFrameError('protocol')
  return result
}

/** RANGE bounds remain low/high in both directions. The opaque cursor stores
 * last+1 forward or last-1 reverse; zero is reserved for a finished cursor.
 * At timestamp zero reverse stops before subtracting, so it cannot underflow.
 */
export class RedisTimeSeries {
  private readonly pages = new RedisScanCursors()
  constructor(private readonly connections: RedisConnections) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose() }
  async read(sessionId: string, request: TimeSeriesReadRequest, signal: AbortSignal): Promise<TimeSeriesReadResult> {
    let pageState: ScanState | undefined
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal, () => { if (pageState !== undefined) this.pages.validate(sessionId, pageState) })
    const result = (state: TimeSeriesReadResult['state'], error: TimeSeriesReadResult['error'] = null, metadata: KeyMetadata | null = null): TimeSeriesReadResult => ({ state, error, metadata, direction: request.direction, start: request.start, end: request.end, samples: [], info: null, infoState: null, cursor: null, sampledAt: new Date().toISOString() })
    try {
      signal.throwIfAborted(); this.connections.assertTarget(sessionId, request.target)
      pageState = this.pages.begin(sessionId, JSON.stringify([request.target.id, request.target.generation, request.target.db, request.keyBase64, request.direction, request.start, request.end, request.count]), request.cursor)
      const key = Buffer.from(request.keyBase64, 'base64'), type = await context.type(key)
      if (type === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (!isTimeSeriesType(type)) return result('unsupported', null, { type, ttlMs: String(firstTtl), length: null })
      let info: TimeSeriesInfo | null = null, infoState: TimeSeriesReadResult['infoState'] = 'available'
      try { info = infoAt(await context.command('TS.INFO', [key])) }
      catch (error) {
        if (context.signal.aborted) throw error
        if (error instanceof RedisReplyError && /^(?:NOPERM|DENIED)(?: |$)/u.test(error.message)) infoState = 'permission'
        else if (unavailable(error)) infoState = 'unavailable'
        else throw error
      }
      const forward = request.direction === 'forward', fresh = pageState.cursor === '0'
      // Prefixing the stored decimal distinguishes a real timestamp 0 from the
      // cursor helper's terminal sentinel, without exposing it to the client.
      const boundary = fresh ? null : pageState.cursor.slice(1)
      const start = forward ? boundary ?? request.start : request.start, end = forward ? request.end : boundary ?? request.end
      const reply = await context.command(forward ? 'TS.RANGE' : 'TS.REVRANGE', [key, start, end, 'COUNT', String(request.count)])
      if (!Array.isArray(reply) || reply.length > request.count) throw new RedisFrameError('protocol')
      let previous: bigint | null = null
      const samples = reply.map(raw => {
        if (!Array.isArray(raw) || raw.length !== 2 || typeof raw[0] !== 'bigint' || typeof raw[1] !== 'string') throw new RedisFrameError('protocol')
        const timestamp = String(raw[0]), value = raw[1]
        if (!isTimeSeriesTimestamp(timestamp) || !withinTimeSeriesRange(timestamp, start, end) || !isTimeSeriesValue(value) || (previous !== null && (forward ? raw[0] <= previous : raw[0] >= previous))) throw new RedisFrameError('protocol')
        previous = raw[0]
        return { timestamp, value }
      })
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== type) return result('changed')
      const ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      context.signal.throwIfAborted()
      const page: TimeSeriesReadResult = { ...result('page', null, { type, ttlMs: String(ttl), length: null }), info, infoState, samples }
      if (Buffer.byteLength(JSON.stringify(page)) + 36 > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
      const last = samples.at(-1)?.timestamp
      const done = last === undefined || samples.length < request.count || last === (forward ? request.end : request.start) || last === (forward ? MAX_TIMESERIES_TIMESTAMP : '0')
      const token = this.pages.advance(sessionId, pageState, done || last === undefined ? '0' : 't' + String(BigInt(last) + (forward ? 1n : -1n)))
      pageState = undefined
      return { ...page, cursor: token }
    } catch (error) {
      if (!context.signal.aborted && unavailable(error)) return result('unavailable')
      // TSDB errors do not use Redis WRONGTYPE. Recheck only this fixed error
      // family to distinguish deletion/type races from a malformed server reply.
      if (!context.signal.aborted && error instanceof RedisReplyError && /^ERR (?:TSDB:|WRONGTYPE(?: |$))/u.test(error.message)) {
        try {
          const type = await context.type(Buffer.from(request.keyBase64, 'base64'))
          if (type === 'none') return result('missing')
          if (!isTimeSeriesType(type)) return result('changed')
          return result('failed', 'protocol')
        } catch (guardError) { return result('failed', context.error(guardError)) }
      }
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally {
      if (pageState !== undefined) this.pages.discard(sessionId, pageState)
      context.dispose()
    }
  }
}
