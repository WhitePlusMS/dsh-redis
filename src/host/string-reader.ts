import { MAX_VALUE_BYTES, type StringReadRequest, type StringReadResult, type KeyMetadata } from '../domain.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisFrameError } from './resp.ts'
import { RedisReadContext } from './read-context.ts'

const MAX_INTEGER = (1n << 63n) - 1n

/** Only fixed metadata and GETRANGE operations; never fetch a full value then truncate. */
export class RedisStrings {
  constructor(private readonly connections: RedisConnections) {}

  async read(sessionId: string, request: StringReadRequest, signal: AbortSignal): Promise<StringReadResult> {
    const context = new RedisReadContext(this.connections, sessionId, request.target, signal)
    const result = (state: StringReadResult['state'], error: StringReadResult['error'] = null, metadata: KeyMetadata | null = null): StringReadResult => ({
      state, error, metadata, offset: request.offset, base64: '', byteLength: 0, prefix: '', suffix: '', complete: false, nextOffset: null, sampledAt: new Date().toISOString(),
    })
    try {
      const key = Buffer.from(request.keyBase64, 'base64')
      const firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      const firstTtl = await context.ttl(key)
      if (firstTtl === -2n) return result('missing')
      if (firstType !== 'string') return result('unsupported', null, { type: firstType, ttlMs: String(firstTtl), length: null })
      const firstLength = await context.integer('STRLEN', [key]), offset = BigInt(request.offset)
      const start = offset > 3n ? offset - 3n : 0n
      const wantedEnd = offset + BigInt(request.count) + 2n
      const end = wantedEnd > MAX_INTEGER ? MAX_INTEGER : wantedEnd
      const reply = await context.command('GETRANGE', [key, String(start), String(end)])
      if (!Buffer.isBuffer(reply)) throw new RedisFrameError('protocol')
      if (reply.length > MAX_VALUE_BYTES + 6 || reply.length > request.count + Number(offset - start) + 3) throw new RedisFrameError('oversize')
      const secondType = await context.type(key)
      if (secondType === 'none') return result('missing')
      if (secondType !== firstType) return result('changed')
      const secondLength = await context.integer('STRLEN', [key]), secondTtl = await context.ttl(key)
      if (secondTtl === -2n) return result('missing')
      if (firstLength !== secondLength) return result('changed')
      const available = firstLength > start ? firstLength - start : 0n
      const expected = available < end - start + 1n ? available : end - start + 1n
      if (BigInt(reply.length) !== expected) return result('changed')
      const skip = Math.min(Number(offset - start), reply.length)
      const bytes = reply.subarray(skip, skip + request.count)
      // Three context bytes either side complete any crossing UTF-8 scalar.
      const prefix = reply.subarray(0, skip), suffix = reply.subarray(skip + request.count)
      const next = offset + BigInt(bytes.length)
      return {
        ...result('value', null, { type: firstType, ttlMs: String(secondTtl), length: String(secondLength) }),
        base64: bytes.toString('base64'), byteLength: bytes.length, prefix: prefix.toString('base64'), suffix: suffix.toString('base64'),
        complete: offset === 0n && BigInt(bytes.length) === secondLength,
        nextOffset: bytes.length > 0 && next < secondLength ? String(next) : null,
      }
    } catch (error) {
      const code = context.error(error)
      return code === 'type-changed' ? result('changed') : result('failed', code)
    } finally { context.dispose() }
  }
}
