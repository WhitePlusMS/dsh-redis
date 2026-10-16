import type { HllReadRequest, HllReadResult, KeyMetadata } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError, RedisReplyError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

/** A header is only a candidate. Sparse opcodes are validated by the server's
 * multi-input merge, never by treating the HYLL signature as proof.
 */
function encodingAt(header: Buffer, length: bigint): 'dense' | 'sparse' | null {
  if (header.length !== 16 || !header.subarray(0, 4).equals(Buffer.from('HYLL'))) return null
  if (header[4] === 0 && length === 12304n) return 'dense'
  return header[4] === 1 ? 'sparse' : null
}

/** Duplicate inputs force PFCOUNT's temporary-union branch. The single-input
 * branch can update the source's cached cardinality and must never be used.
 */
export class RedisHll {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, request: HllReadRequest, signal: AbortSignal): Promise<HllReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: HllReadResult['state'], error: HllReadResult['error'] = null, metadata: KeyMetadata | null = null): HllReadResult => ({ state, error, metadata, estimate: null, encoding: null, cacheValid: null, sampledAt: new Date().toISOString() })
    const headerAt = async (key: Buffer): Promise<Buffer> => {
      const header = await context.command('GETRANGE', [key, '0', '15'])
      if (!Buffer.isBuffer(header) || header.length > 16) throw new RedisFrameError('protocol')
      return header
    }
    try {
      const key = Buffer.from(request.keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'string') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const length = await context.integer('STRLEN', [key]), header = await headerAt(key), encoding = encodingAt(header, length)
      let estimate: string | null = null
      if (encoding !== null) {
        try { estimate = String(await context.integer('PFCOUNT', [key, key])) }
        catch (error) {
          // A malformed HLL is still viewable as raw String bytes. Generic
          // WRONGTYPE is a concurrent type change and follows the normal guard.
          if (context.signal.aborted || !(error instanceof RedisReplyError) || !/^(?:INVALIDOBJ |WRONGTYPE Key is not a valid HyperLogLog string value\.$)/iu.test(error.message)) throw error
        }
      }
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== 'string') return result('changed')
      const secondLength = await context.integer('STRLEN', [key]), ttl = await context.ttl(key)
      if (ttl === -2n) return result('missing')
      if (length !== secondLength || !header.equals(await headerAt(key))) return result('changed')
      if (BigInt(header.length) !== (length < 16n ? length : 16n)) throw new RedisFrameError('protocol')
      const metadata = { type: 'string', ttlMs: String(ttl), length: String(length) }
      if (encoding === null || estimate === null) return result('invalid', null, metadata)
      return { ...result('value', null, metadata), estimate, encoding, cacheValid: ((header[15] ?? 0) & 128) === 0 }
    } catch (error) {
      if (!context.signal.aborted && error instanceof RedisReplyError && /^ERR (?:unknown command|wrong number of arguments)(?: |$)/iu.test(error.message)) return result('unavailable')
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally { context.dispose() }
  }
}
