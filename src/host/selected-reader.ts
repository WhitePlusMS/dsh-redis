import type { BytePrefix, ConnectionErrorCode, DatabaseTarget, KeyMetadata, RedisSelectionItem, StreamMessage } from '../domain.ts'
import { isRedisScore } from '../redis-score.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisFrameError } from './resp.ts'
import { RedisLists } from './list-reader.ts'
import { RedisStreams } from './stream-reader.ts'
import { valuePrefix } from './value-prefix.ts'

export interface SelectedResult {
  readonly state: 'value' | 'selection-missing' | 'selection-changed' | 'missing' | 'unsupported' | 'changed' | 'failed'
  readonly error: ConnectionErrorCode | null
  readonly metadata: KeyMetadata | null
  readonly cell: BytePrefix | null
  readonly score: string | null
  readonly sampledAt: string
}
export interface StreamSelectedResult { readonly selected: SelectedResult; readonly message: StreamMessage | null }

/** Fixed read commands address exact raw identities; never rescan to find a row. */
export class RedisSelectedReader {
  constructor(private readonly connections: RedisConnections) {}
  async read(sessionId: string, target: DatabaseTarget, keyBase64: string, item: RedisSelectionItem, signal: AbortSignal, validate: () => void = () => undefined, firstMismatch: 'changed' | 'unsupported' = 'changed'): Promise<SelectedResult> {
    const result = (state: SelectedResult['state'], metadata: KeyMetadata | null = null, cell: BytePrefix | null = null, score: string | null = null, error: ConnectionErrorCode | null = null, sampledAt = new Date().toISOString()): SelectedResult => ({ state, error, metadata, cell, score, sampledAt })
    if (item.kind === 'list') {
      const page = await new RedisLists(this.connections).read(sessionId, { target, keyBase64, offset: item.index, count: 1 }, signal, validate)
      return result(page.state === 'page' ? page.entries.length === 0 ? 'selection-missing' : 'value' : page.state === 'unsupported' ? 'changed' : page.state, page.metadata, page.entries[0]?.value ?? null, null, page.error, page.sampledAt)
    }
    if (item.kind === 'stream') {
      return (await this.readStream(sessionId, target, keyBase64, item.id, item.fieldIndex, item.fieldBase64, signal, validate)).selected
    }
    const context = new RedisReadContext(this.connections, sessionId, target, signal, validate)
    try {
      const key = Buffer.from(keyBase64, 'base64'), firstType = await context.type(key)
      if (firstType === 'none') return result('missing')
      // A previously selected row implies a change; an explicit query only establishes a mismatch.
      if (firstType !== item.kind) return result(firstMismatch)
      const raw = item.kind === 'hash'
        ? await context.command('HGET', [key, Buffer.from(item.fieldBase64, 'base64')])
        : await context.command(item.kind === 'set' ? 'SISMEMBER' : 'ZSCORE', [key, Buffer.from(item.memberBase64, 'base64')])
      // Later type and TTL checks may wait in the connection queue.
      const sampledAt = new Date().toISOString()
      const lastType = await context.type(key), ttl = await context.ttl(key)
      if (lastType === 'none' || ttl === -2n) return result('missing')
      if (lastType !== firstType) return result('changed')
      const metadata = { type: lastType, ttlMs: String(ttl), length: null }
      if (item.kind === 'set') {
        if (raw !== 0n && raw !== 1n) throw new RedisFrameError('protocol')
        return result(raw === 0n ? 'selection-missing' : 'value', metadata, raw === 0n ? null : valuePrefix(Buffer.from(item.memberBase64, 'base64')), null, null, sampledAt)
      }
      if (raw === null) return result('selection-missing', metadata, null, null, null, sampledAt)
      if (!Buffer.isBuffer(raw)) throw new RedisFrameError('protocol')
      if (item.kind === 'hash') return result('value', metadata, valuePrefix(raw), null, null, sampledAt)
      const score = raw.toString('utf8')
      if (!isRedisScore(score)) throw new RedisFrameError('protocol')
      return result('value', metadata, valuePrefix(Buffer.from(item.memberBase64, 'base64')), score, null, sampledAt)
    } catch (error) {
      const code = context.error(error)
      return result(code === 'type-changed' ? 'changed' : 'failed', null, null, null, code === 'type-changed' ? null : code)
    } finally { context.dispose() }
  }

  /** Keep a bounded full message internal; ordinary selected-value replies expose only the chosen cell. */
  async readStream(sessionId: string, target: DatabaseTarget, keyBase64: string, id: string, fieldIndex: number, expectedFieldBase64: string | null, signal: AbortSignal, validate: () => void = () => undefined): Promise<StreamSelectedResult> {
    const reader = new RedisStreams(this.connections)
    try {
      const page = await reader.read(sessionId, { target, keyBase64, direction: 'forward', start: id, end: id, count: 1, cursor: null }, signal, validate)
      const make = (state: SelectedResult['state'], cell: BytePrefix | null = null, message: StreamMessage | null = null): StreamSelectedResult => ({ selected: { state, error: page.error, metadata: page.metadata, cell, score: null, sampledAt: page.sampledAt }, message })
      if (page.state !== 'page') return make(page.state === 'unsupported' ? 'changed' : page.state)
      const message = page.messages[0], pair = message?.fields[fieldIndex]
      if (pair === undefined || message === undefined) return make('selection-missing')
      if (expectedFieldBase64 !== null && pair.field.base64 !== expectedFieldBase64) return make('selection-changed')
      return make('value', pair.value, message)
    } finally { reader.dispose() }
  }
}
