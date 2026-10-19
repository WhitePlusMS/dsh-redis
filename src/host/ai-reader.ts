import { z } from 'zod'
import { byteIdentity } from './byte-identity.ts'
import type { RedisConnections } from './connection-service.ts'
import { RedisKeys } from './key-reader.ts'
import { RedisStrings } from './string-reader.ts'
import { RedisHashes } from './hash-reader.ts'
import { RedisLists } from './list-reader.ts'
import { RedisSets } from './set-reader.ts'
import { RedisZSets } from './zset-reader.ts'
import { RedisStreams } from './stream-reader.ts'
import { RedisSelectedReader } from './selected-reader.ts'
import type { BytePrefix, DatabaseTarget, RedisSelection, SetSelectionRequest, SelectionAck } from '../domain.ts'
import { scanKeysRequestSchema, stringReadRequestSchema, scanHashRequestSchema, listReadRequestSchema, scanSetRequestSchema, zsetReadRequestSchema, streamReadRequestSchema } from '../typert.shared.ts'

/** Keep model results useful without silently dropping a scan page's tail. */
export const MAX_AI_RESULT_BYTES = 64 * 1024
const MAX_AI_VALUE_BYTES = 4096
const json = z.json()
export type AiJson = z.infer<typeof json>
export interface AiValueRequest {
  readonly key?: string
  readonly keyBase64?: string
  readonly cursor?: string
  readonly offset?: string
  readonly count?: number
  readonly bytes?: number
  readonly match?: string
  readonly start?: string
  readonly end?: string
  readonly direction?: string
}

function text(bytes: Buffer): string | null {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
  catch { return null }
}

/** Values may be prefixes; complete byte identities (keys/members) never are. */
function value(bytes: BytePrefix) {
  const raw = Buffer.from(bytes.base64, 'base64').subarray(0, MAX_AI_VALUE_BYTES)
  return { base64: raw.toString('base64'), text: text(raw), byteLength: raw.length, fullByteLength: bytes.fullByteLength, complete: raw.length === bytes.fullByteLength }
}

/** A separate reader bank shares the real connection, never the UI's cursors. */
export class RedisAiReader {
  private readonly keys: RedisKeys
  private readonly strings: RedisStrings
  private readonly hashes: RedisHashes
  private readonly lists: RedisLists
  private readonly sets: RedisSets
  private readonly zsets: RedisZSets
  private readonly streams: RedisStreams
  private readonly selections = new Map<string, { readonly target: DatabaseTarget; readonly selection: RedisSelection; readonly sampledAt: string }>()
  constructor(private readonly connections: RedisConnections) {
    this.keys = new RedisKeys(connections); this.strings = new RedisStrings(connections)
    this.hashes = new RedisHashes(connections); this.lists = new RedisLists(connections)
    this.sets = new RedisSets(connections); this.zsets = new RedisZSets(connections); this.streams = new RedisStreams(connections)
  }
  private target(sessionId: string): DatabaseTarget {
    const current = this.connections.status(sessionId)
    if (current.state !== 'connected' || current.id === null) throw new Error('当前对话尚未连接 Redis，请先在侧栏手动连接。')
    return { id: current.id, generation: current.generation, db: current.db }
  }
  private project(sessionId: string, data: unknown): AiJson {
    const result = json.parse(data)
    if (Buffer.byteLength(JSON.stringify(result)) > MAX_AI_RESULT_BYTES) {
      this.disposeCursors(sessionId)
      throw new Error('本批结果超过对话读取预算，未将其作为完整结果返回。请缩小 MATCH 或读取范围后重试。')
    }
    return result
  }
  status(sessionId: string): AiJson {
    return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), currentSelection: this.selection(sessionId) })
  }
  private selection(sessionId: string) {
    const record = this.selections.get(sessionId)
    if (record === undefined) return null
    try { this.connections.assertTarget(sessionId, record.target); return record }
    catch { this.selections.delete(sessionId); return null }
  }
  setSelection(sessionId: string, request: SetSelectionRequest): SelectionAck {
    try { this.connections.assertTarget(sessionId, request.target) } catch { return { accepted: false } }
    if (request.selection === null) this.selections.delete(sessionId)
    else if (JSON.stringify(this.selection(sessionId)?.selection) !== JSON.stringify(request.selection)) this.selections.set(sessionId, { target: request.target, selection: request.selection, sampledAt: new Date().toISOString() })
    return { accepted: true }
  }
  async scan(sessionId: string, args: { readonly match?: string; readonly cursor?: string }, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    const target = this.target(sessionId)
    const request = scanKeysRequestSchema.parse({ target, pattern: args.match ?? '*', cursor: args.cursor ?? null })
    const page = await this.keys.scan(sessionId, request, signal)
    this.connections.assertTarget(sessionId, target)
    return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), ...page, scanComplete: page.state === 'page' && page.cursor === null })
  }
  async read(sessionId: string, args: AiValueRequest, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    const target = this.target(sessionId)
    const selected = args.key === undefined && args.keyBase64 === undefined ? this.selection(sessionId) : null
    if (selected !== null && selected.selection.item !== null) {
      const read = await new RedisSelectedReader(this.connections).read(sessionId, target, selected.selection.keyBase64, selected.selection.item, signal)
      this.connections.assertTarget(sessionId, target)
      if (this.selection(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), selected, value: { ...read, cell: read.cell === null ? null : value(read.cell) } })
    }
    if (args.key === undefined && args.keyBase64 === undefined && selected === null) throw new Error('当前没有有效的侧栏选择，请选择 Key 或明确指定 key。')
    if (args.key !== undefined && args.keyBase64 !== undefined) throw new Error('key 与 keyBase64 只能指定其中一个。')
    const keyBase64 = selected?.selection.keyBase64 ?? args.keyBase64 ?? Buffer.from(args.key ?? '', 'utf8').toString('base64')
    const common = { target, keyBase64 }, pattern = args.match ?? '*', cursor = args.cursor ?? null
    const offset = args.offset ?? '0', count = args.count ?? 25
    // Reuse the same bounded type discovery used by the sidebar. Readers check
    // the type/target again, so a concurrent change never becomes a false value.
    const probe = await this.strings.read(sessionId, stringReadRequestSchema.parse({ ...common, offset, count: args.bytes ?? MAX_AI_VALUE_BYTES }), signal)
    let data: unknown = probe
    if (probe.state === 'unsupported') {
      switch (probe.metadata?.type) {
        case 'hash': {
          const page = await this.hashes.scan(sessionId, scanHashRequestSchema.parse({ ...common, pattern, cursor }), signal)
          const entries = page.entries.map(entry => ({ field: entry.field, value: value(entry.value) }))
          data = { ...page, entries, scanComplete: page.state === 'page' && page.cursor === null, complete: page.state === 'page' && args.cursor === undefined && pattern === '*' && page.cursor === null && String(entries.length) === page.metadata?.length && entries.every(entry => entry.value.complete) }
          break
        }
        case 'list': {
          const page = await this.lists.read(sessionId, listReadRequestSchema.parse({ ...common, offset, count }), signal)
          const entries = page.entries.map(entry => ({ index: entry.index, value: value(entry.value) }))
          data = { ...page, entries, complete: page.state === 'page' && offset === '0' && page.nextOffset === null && entries.every(entry => entry.value.complete) }
          break
        }
        case 'set': {
          const page = await this.sets.scan(sessionId, scanSetRequestSchema.parse({ ...common, pattern, cursor }), signal)
          data = { ...page, scanComplete: page.state === 'page' && page.cursor === null, complete: page.state === 'page' && args.cursor === undefined && pattern === '*' && page.cursor === null && String(page.members.length) === page.metadata?.length }
          break
        }
        case 'zset': {
          const query = args.match !== undefined || args.cursor !== undefined ? { ...common, mode: 'scan', pattern, cursor } : { ...common, mode: 'range', offset, count }
          const page = await this.zsets.read(sessionId, zsetReadRequestSchema.parse(query), signal)
          data = { ...page, scanComplete: page.mode === 'scan' && page.state === 'page' && page.cursor === null, complete: page.state === 'page' && (page.mode === 'scan' ? args.cursor === undefined && pattern === '*' && page.cursor === null && String(page.entries.length) === page.metadata?.length : offset === '0' && page.nextOffset === null) }
          break
        }
        case 'stream': {
          const page = await this.streams.read(sessionId, streamReadRequestSchema.parse({ ...common, direction: args.direction ?? 'forward', start: args.start ?? '-', end: args.end ?? '+', count, cursor }), signal)
          const messages = page.messages.map(message => ({ id: message.id, fields: message.fields.map((pair, index) => ({ index, field: pair.field, value: value(pair.value) })) }))
          data = { ...page, messages, scanComplete: page.state === 'page' && page.cursor === null, complete: page.state === 'page' && args.cursor === undefined && (args.start ?? '-') === '-' && (args.end ?? '+') === '+' && page.cursor === null && String(messages.length) === page.metadata?.length && messages.every(message => message.fields.every(pair => pair.value.complete)) }
          break
        }
      }
    } else if (probe.state === 'value') data = { ...probe, text: text(Buffer.from(probe.base64, 'base64')) }
    this.connections.assertTarget(sessionId, target)
    if (selected !== null && this.selection(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
    return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key: byteIdentity(Buffer.from(keyBase64, 'base64')), value: data })
  }
  disposeSession(sessionId: string): void {
    this.selections.delete(sessionId)
    this.disposeCursors(sessionId)
  }
  private disposeCursors(sessionId: string): void {
    this.keys.disposeSession(sessionId); this.hashes.disposeSession(sessionId); this.sets.disposeSession(sessionId); this.zsets.disposeSession(sessionId); this.streams.disposeSession(sessionId)
  }
  dispose(): void { this.selections.clear(); this.keys.dispose(); this.hashes.dispose(); this.sets.dispose(); this.zsets.dispose(); this.streams.dispose() }
}
