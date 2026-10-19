import type { BytePrefix, ConnectionErrorCode, DatabaseTarget, KeyMetadata, RedisSelectionItem } from '../domain.ts'
import { isRedisScore } from '../redis-score.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisFrameError } from './resp.ts'
import { RedisLists } from './list-reader.ts'
import { RedisStreams } from './stream-reader.ts'
import { valuePrefix } from './value-prefix.ts'

interface SelectedResult {
  readonly state: 'value' | 'selection-missing' | 'selection-changed' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly cell: BytePrefix | null
  readonly score: string | null
  readonly sampledAt: string
}

/** Fixed read commands address exact raw identities; never rescan to find a row. */
export class RedisSelectedReader {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, target: DatabaseTarget, keyBase64: string, item: RedisSelectionItem, signal: AbortSignal): Promise<SelectedResult> {
    const result = (state: SelectedResult['state'], metadata: KeyMetadata | null = null, cell: BytePrefix | null = null, score: string | null = null, error: ConnectionErrorCode | null = null): SelectedResult => ({ state, error, metadata, cell, score, sampledAt: new Date().toISOString() })
    if (item.kind === 'list') {
      const page = await new RedisLists(this.connections).read(sessionId, { target, keyBase64, offset: item.index, count: 1 }, signal)
      return result(page.state === 'page' ? page.entries.length === 0 ? 'selection-missing' : 'value' : page.state, page.metadata, page.entries[0]?.value ?? null, null, page.error)
    }
    if (item.kind === 'stream') {
      const reader = new RedisStreams(this.connections)
      try {
        const page = await reader.read(sessionId, { target, keyBase64, direction: 'forward', start: item.id, end: item.id, count: 1, cursor: null }, signal)
        if (page.state !== 'page') return result(page.state, page.metadata, null, null, page.error)
        const pair = page.messages[0]?.fields[item.fieldIndex]
        if (pair === undefined) return result('selection-missing', page.metadata)
        if (pair.field.base64 !== item.fieldBase64) return result('selection-changed', page.metadata)
        return result('value', page.metadata, pair.value)
      } finally { reader.dispose() }
    }
    const context = new RedisReadContext(this.connections, sessionId, target, signal)
    try {
      const key = Buffer.from(keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      if (firstType !== item.kind) return result('changed')
      const raw = item.kind === 'hash'
        ? await context.command('HGET', [key, Buffer.from(item.fieldBase64, 'base64')])
        : await context.command(item.kind === 'set' ? 'SISMEMBER' : 'ZSCORE', [key, Buffer.from(item.memberBase64, 'base64')])
      const lastType = await context.type(key), ttl = await context.ttl(key)
      if (lastType === 'none' || ttl === -2n) return result('missing')
      if (lastType !== firstType) return result('changed')
      const metadata = { type: lastType, ttlMs: String(ttl), length: null }
      if (item.kind === 'set') {
        if (raw !== 0n && raw !== 1n) throw new RedisFrameError('protocol')
        return result(raw === 0n ? 'selection-missing' : 'value', metadata, raw === 0n ? null : valuePrefix(Buffer.from(item.memberBase64, 'base64')))
      }
      if (raw === null) return result('selection-missing', metadata)
      if (!Buffer.isBuffer(raw)) throw new RedisFrameError('protocol')
      if (item.kind === 'hash') return result('value', metadata, valuePrefix(raw))
      const score = raw.toString('utf8')
      if (!isRedisScore(score)) throw new RedisFrameError('protocol')
      return result('value', metadata, valuePrefix(Buffer.from(item.memberBase64, 'base64')), score)
    } catch (error) {
      const code = context.error(error)
      return result(code === 'type-changed' ? 'changed' : 'failed', null, null, null, code === 'type-changed' ? null : code)
    } finally { context.dispose() }
  }
}
