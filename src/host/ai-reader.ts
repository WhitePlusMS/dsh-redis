import { z } from 'zod'
import { byteIdentity } from './byte-identity.ts'
import { ConnectionFailure, type RedisConnections } from './connection-service.ts'
import { RedisKeys } from './key-reader.ts'
import { RedisStrings } from './string-reader.ts'
import { RedisHashes } from './hash-reader.ts'
import { RedisLists } from './list-reader.ts'
import { RedisSets } from './set-reader.ts'
import { RedisZSets } from './zset-reader.ts'
import { RedisStreams } from './stream-reader.ts'
import { RedisSelectedReader } from './selected-reader.ts'
import { RedisReadContext } from './read-context.ts'
import { RedisFrameError, RedisReplyError } from './resp.ts'
import { projectStreamGroups } from './stream-groups.ts'
import { projectClients } from './client-list.ts'
import { MAX_AI_RESULT_BYTES, RedisAiBudget } from './ai-budget.ts'
import { RedisAiKeyPages } from './ai-key-pages.ts'
import type { PreparedAiPage } from './ai-page-store.ts'
import { AiPageCoordinator } from './ai-page-coordinator.ts'
import { RedisAiHashPages, isAiHashCursor } from './ai-hash-pages.ts'
import { RedisAiSetPages, isAiSetCursor } from './ai-set-pages.ts'
import { RedisAiZSetPages, isAiZSetCursor } from './ai-zset-pages.ts'
import { RedisAiStreamPages, isAiStreamCursor } from './ai-stream-pages.ts'
import { RedisAiHashFilter } from './ai-hash-filter.ts'
import { aiText, aiValue, MAX_AI_VALUE_BYTES } from './ai-value.ts'
import { connectionErrorMessages, keyStateMessages } from '../connection-errors.ts'
import type { ConnectionErrorCode, DatabaseTarget, RedisSelection, RedisSelectionItem, SetSelectionRequest, SelectionAck } from '../domain.ts'
import { databaseTargetSchema, scanKeysRequestSchema, stringReadRequestSchema, hashFieldReadRequestSchema, scanHashRequestSchema, listReadRequestSchema, scanSetRequestSchema, setMemberReadRequestSchema, zsetReadRequestSchema, streamReadRequestSchema } from '../typert.shared.ts'

const json = z.json()
const explain = (error: ConnectionErrorCode | null): string | null => error === null ? null : connectionErrorMessages[error].zh
const overviewFields = {
  server: ['redis_version', 'uptime_in_seconds'],
  memory: ['used_memory', 'used_memory_rss', 'maxmemory', 'mem_fragmentation_ratio'],
  clients: ['connected_clients', 'blocked_clients'],
  stats: ['total_connections_received', 'total_commands_processed', 'instantaneous_ops_per_sec', 'rejected_connections', 'evicted_keys', 'expired_keys', 'keyspace_hits', 'keyspace_misses'],
} as const
type OverviewSection = keyof typeof overviewFields
/** Text identities must round-trip exactly; arbitrary bytes use canonical Base64. */
function encodeIdentity(value: string): string {
  const bytes = Buffer.from(value, 'utf8')
  if (bytes.toString('utf8') !== value) throw new Error('文本包含无法无损编码的字符，请使用规范 Base64 身份。')
  return bytes.toString('base64')
}
/** Missing and changed are read states, not transport errors. */
const explainValue = (error: ConnectionErrorCode | null, data: unknown): string | null => {
  if (error !== null) return explain(error)
  if (typeof data === 'object' && data !== null && 'state' in data && (data.state === 'missing' || data.state === 'changed')) return keyStateMessages[data.state].zh
  return null
}
export type AiJson = z.infer<typeof json>
export interface AiValueRequest {
  readonly key?: string
  readonly keyBase64?: string
  readonly field?: string
  readonly fieldBase64?: string
  readonly member?: string
  readonly memberBase64?: string
  readonly cursor?: string
  readonly offset?: string
  readonly count?: number
  readonly bytes?: number
  readonly match?: string
  readonly start?: string
  readonly end?: string
  readonly direction?: string
}

/** A separate reader bank shares the real connection, never the UI's cursors. */
export class RedisAiReader {
  private readonly budget = new RedisAiBudget()
  private readonly keys: RedisKeys
  private readonly keyPages: RedisAiKeyPages
  private readonly hashFilter: RedisAiHashFilter
  private readonly strings: RedisStrings
  private readonly hashes: RedisHashes
  private readonly hashPages: AiPageCoordinator<RedisAiHashPages>
  private readonly lists: RedisLists
  private readonly sets: RedisSets
  private readonly setPages: AiPageCoordinator<RedisAiSetPages>
  private readonly zsets: RedisZSets
  private readonly zsetRanks: RedisZSets
  private readonly zsetPages: AiPageCoordinator<RedisAiZSetPages>
  private readonly streams: RedisStreams
  private readonly streamPages: AiPageCoordinator<RedisAiStreamPages>
  private readonly selections = new Map<string, { readonly target: DatabaseTarget; readonly selection: RedisSelection; readonly sampledAt: string }>()
  constructor(private readonly connections: RedisConnections, private readonly invalidateUiActions: (sessionId: string) => void, private readonly confirmSelection: (sessionId: string, target: DatabaseTarget, expected: number | null, signal: AbortSignal) => Promise<number>, private readonly isSelectionCurrent: (sessionId: string, revision: number | null) => boolean) {
    this.keys = new RedisKeys(connections); this.strings = new RedisStrings(connections)
    this.keyPages = new RedisAiKeyPages(connections, this.keys)
    this.hashFilter = new RedisAiHashFilter(connections)
    this.hashes = new RedisHashes(connections, true); this.hashPages = new AiPageCoordinator([new RedisAiHashPages(connections, this.hashes), new RedisAiHashPages(connections, new RedisHashes(connections, true))]); this.lists = new RedisLists(connections)
    this.sets = new RedisSets(connections, true); this.setPages = new AiPageCoordinator([new RedisAiSetPages(connections, this.sets), new RedisAiSetPages(connections, new RedisSets(connections, true))])
    this.zsets = new RedisZSets(connections, true); this.zsetRanks = new RedisZSets(connections); this.zsetPages = new AiPageCoordinator([new RedisAiZSetPages(connections, this.zsets), new RedisAiZSetPages(connections, new RedisZSets(connections, true))])
    this.streams = new RedisStreams(connections, true); this.streamPages = new AiPageCoordinator([new RedisAiStreamPages(connections, this.streams), new RedisAiStreamPages(connections, new RedisStreams(connections, true))])
  }
  /** All registered tools share a budget tied to the trusted DSH session. */
  async withBudget(sessionId: string, signal: AbortSignal, operation: (stage: (page: PreparedAiPage) => void) => AiJson | Promise<AiJson>): Promise<AiJson> {
    const admission = this.budget.begin(sessionId)
    if (!admission.ok) throw new Error(admission.reason === 'busy' ? '当前对话有读取正在执行，请等待后重试。' : '当前对话的 AI 读取预算已用完。请在 Redis 侧栏展开“AI 读取预算”，点击“刷新状态”，等待读取结束后点击“继续读取”。')
    let finished = false, committed = false
    const staged: { page?: PreparedAiPage } = {}
    try {
      signal.throwIfAborted()
      const result = await operation(page => { staged.page = page })
      signal.throwIfAborted()
      finished = this.budget.finish(admission.lease, Buffer.byteLength(JSON.stringify(result)), () => staged.page?.commit())
      if (!finished) throw new Error('会话已结束，请重新打开 Redis 侧栏。')
      committed = true
      return result
    } finally { if (!finished) this.budget.finish(admission.lease, 0); if (!committed) staged.page?.rollback() }
  }
  budgetStatus(sessionId: string) { return this.budget.status(sessionId) }
  resumeBudget(sessionId: string) {
    const accepted = this.budget.resume(sessionId)
    return { accepted, status: this.budget.status(sessionId) }
  }
  private target(sessionId: string): DatabaseTarget {
    const current = this.connections.status(sessionId)
    if (current.state !== 'connected' || current.id === null) {
      if (current.error !== null) throw new Error(connectionErrorMessages[current.error].zh)
      throw new Error('当前对话尚未连接 Redis，请先在侧栏手动连接。')
    }
    return { id: current.id, generation: current.generation, db: current.db }
  }
  currentTarget(sessionId: string): DatabaseTarget { return this.target(sessionId) }
  isCurrentTarget(sessionId: string, target: DatabaseTarget): boolean {
    try { this.connections.assertTarget(sessionId, target); return true } catch { return false }
  }
  /** Capture the confirmed current Key, and guard every command against intervening selection. */
  async prepareHashField(sessionId: string, fieldBase64: string, signal: AbortSignal) {
    return this.prepareSelectedItem(sessionId, { kind: 'hash', fieldBase64 }, signal)
  }
  async prepareListIndex(sessionId: string, index: string, signal: AbortSignal) {
    return this.prepareSelectedItem(sessionId, { kind: 'list', index }, signal)
  }
  async prepareSetMember(sessionId: string, memberBase64: string, signal: AbortSignal) {
    return this.prepareSelectedItem(sessionId, { kind: 'set', memberBase64 }, signal)
  }
  async prepareZSetMember(sessionId: string, memberBase64: string, signal: AbortSignal) {
    return this.prepareSelectedItem(sessionId, { kind: 'zset', memberBase64 }, signal)
  }
  async prepareStreamField(sessionId: string, id: string, fieldIndex: number, signal: AbortSignal) {
    return this.prepareSelection(sessionId, signal, async (target, keyBase64, validate) => {
      const sample = await new RedisSelectedReader(this.connections).readStream(sessionId, target, keyBase64, id, fieldIndex, null, signal, validate)
      return { ...sample.selected, message: sample.message }
    })
  }
  private async prepareSelectedItem(sessionId: string, item: RedisSelectionItem, signal: AbortSignal) {
    return this.prepareSelection(sessionId, signal, (target, keyBase64, validate) => new RedisSelectedReader(this.connections).read(sessionId, target, keyBase64, item, signal, validate))
  }
  private async prepareSelection<T extends { readonly error: ConnectionErrorCode | null }>(sessionId: string, signal: AbortSignal, read: (target: DatabaseTarget, keyBase64: string, validate: () => void) => Promise<T>) {
    const selected = this.selection(sessionId)
    if (selected === null) throw new Error('请先在当前 Redis 面板选择 Key。')
    const revision = await this.confirmSelection(sessionId, selected.target, null, signal)
    const validate = () => {
      signal.throwIfAborted()
      if (this.selections.get(sessionId) !== selected || !this.isSelectionCurrent(sessionId, revision) || !this.isCurrentTarget(sessionId, selected.target)) throw new ConnectionFailure('stale')
    }
    validate()
    const sample = await read(selected.target, selected.selection.keyBase64, validate)
    signal.throwIfAborted()
    if (this.selections.get(sessionId) !== selected || !this.isSelectionCurrent(sessionId, revision)) throw new ConnectionFailure('stale')
    // Preserve the exact read error if this same connection failed; a replaced target is stale.
    this.connections.assertReadResult(sessionId, selected.target, sample.error)
    return { target: selected.target, keyBase64: selected.selection.keyBase64, revision, sample, currentKey: () => this.isCurrentTarget(sessionId, selected.target) && this.selection(sessionId)?.selection.keyBase64 === selected.selection.keyBase64 }
  }
  /** A single TYPE lookup checks existence without scanning or fetching a value. */
  async probeKey(sessionId: string, target: DatabaseTarget, keyBase64: string, signal: AbortSignal, validate: () => void): Promise<{ readonly state: 'found' | 'missing' | 'failed'; readonly error: ConnectionErrorCode | null; readonly sampledAt: string }> {
    const context = new RedisReadContext(this.connections, sessionId, target, signal, validate)
    try {
      const type = await context.type(Buffer.from(keyBase64, 'base64'))
      return { state: type === 'none' ? 'missing' : 'found', error: null, sampledAt: new Date().toISOString() }
    } catch (error) { return { state: 'failed', error: context.error(error), sampledAt: new Date().toISOString() } }
    finally { context.dispose() }
  }
  private project(_sessionId: string, data: unknown): AiJson {
    const result = json.parse(data)
    if (Buffer.byteLength(JSON.stringify(result)) > MAX_AI_RESULT_BYTES) {
      throw new Error('本批结果超过对话读取预算，未将其作为完整结果返回。请缩小 MATCH 或读取范围后重试。')
    }
    return result
  }
  status(sessionId: string): AiJson {
    const connection = this.connections.status(sessionId)
    // A stored action may not have reached the client, or its stream may have closed.
    const synchronized = this.isSelectionCurrent(sessionId, null)
    return this.project(sessionId, { readOnly: true, connection, errorMessage: explain(connection.error), selectionSync: synchronized ? 'synchronized' : 'unavailable', currentSelection: synchronized ? this.selection(sessionId) : null, sampledAt: new Date().toISOString() })
  }
  private selection(sessionId: string) {
    const record = this.selections.get(sessionId)
    if (record === undefined) return null
    try { this.connections.assertTarget(sessionId, record.target); return record }
    catch {
      // Keep the identity privately while an in-flight read reports its own
      // failure; reconnect/disconnect still clears or invalidates it.
      if (!this.connections.isFailedTarget(sessionId, record.target)) this.selections.delete(sessionId)
      return null
    }
  }
  setSelection(sessionId: string, request: SetSelectionRequest): SelectionAck { return this.saveSelection(sessionId, request, true) }
  /** Only the checked UI action commit may update selection without cancelling itself. */
  commitSelection(sessionId: string, request: SetSelectionRequest): SelectionAck { return this.saveSelection(sessionId, request, false) }
  private saveSelection(sessionId: string, request: SetSelectionRequest, invalidate: boolean): SelectionAck {
    try { this.connections.assertTarget(sessionId, request.target) } catch { return { accepted: false } }
    if (request.selection === null) {
      if (this.selections.delete(sessionId) && invalidate) this.invalidateUiActions(sessionId)
    } else if (JSON.stringify(this.selection(sessionId)?.selection) !== JSON.stringify(request.selection)) {
      this.selections.set(sessionId, { target: request.target, selection: request.selection, sampledAt: new Date().toISOString() })
      if (invalidate) this.invalidateUiActions(sessionId)
    }
    return { accepted: true }
  }
  async scan(sessionId: string, args: { readonly match?: string; readonly cursor?: string }, signal: AbortSignal, stage?: (page: PreparedAiPage) => void): Promise<AiJson> {
    signal.throwIfAborted()
    const target = this.target(sessionId)
    const request = scanKeysRequestSchema.parse({ target, pattern: args.match ?? '*', cursor: args.cursor ?? null })
    const page = await this.keyPages.prepare(sessionId, target, request.pattern, request.cursor, signal)
    if (stage === undefined) { try { page.commit() } catch (error) { page.rollback(); throw error } }
    else stage(page)
    return page.result
  }
  /** Filter one bounded batch without returning unrelated Hash values to the model. */
  async filterHash(sessionId: string, args: { readonly match: string; readonly field: string; readonly equals: string; readonly cursor?: string }, signal: AbortSignal, stage: (page: PreparedAiPage) => void): Promise<AiJson> {
    signal.throwIfAborted()
    const target = this.target(sessionId)
    encodeIdentity(args.match)
    const request = scanKeysRequestSchema.parse({ target, pattern: args.match, cursor: null })
    const fieldBase64 = encodeIdentity(args.field), expectedBase64 = encodeIdentity(args.equals)
    if (Buffer.byteLength(args.field, 'utf8') > 1024 || Buffer.byteLength(args.equals, 'utf8') > MAX_AI_VALUE_BYTES) throw new Error('筛选字段或目标值超过允许的字节数。')
    hashFieldReadRequestSchema.parse({ target, keyBase64: '', fieldBase64 })
    const page = await this.hashFilter.prepare(sessionId, target, request.pattern, fieldBase64, expectedBase64, args.cursor ?? null, signal)
    try { stage(page); return page.result } catch (error) { page.rollback(); throw error }
  }
  /** MEMORY USAGE is a bounded estimate for one explicit Key, not a value read. */
  async memoryUsage(sessionId: string, args: { readonly key?: string; readonly keyBase64?: string }, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    if ((args.key === undefined) === (args.keyBase64 === undefined)) throw new Error('请明确指定一个 Key 或规范 Base64 Key。')
    const target = this.target(sessionId)
    const request = stringReadRequestSchema.parse({ target, keyBase64: args.key === undefined ? args.keyBase64 : encodeIdentity(args.key), offset: '0', count: 1 })
    const key = byteIdentity(Buffer.from(request.keyBase64, 'base64'))
    const context = new RedisReadContext(this.connections, sessionId, target, signal)
    try {
      const reply = await context.command('MEMORY', ['USAGE', Buffer.from(request.keyBase64, 'base64'), 'SAMPLES', '5'])
      signal.throwIfAborted()
      if (reply !== null && (typeof reply !== 'bigint' || reply < 0n)) throw new RedisFrameError('protocol')
      this.connections.assertTarget(sessionId, target)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: reply === null ? 'missing' : 'value', bytes: reply === null ? null : reply.toString(), samples: 5, sampledAt: new Date().toISOString(), error: null, errorMessage: reply === null ? keyStateMessages.missing.zh : null })
    } catch (error) {
      signal.throwIfAborted()
      const code = context.error(error)
      this.connections.assertReadResult(sessionId, target, code)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: 'failed', bytes: null, samples: 5, sampledAt: new Date().toISOString(), error: code, errorMessage: explain(code) })
    } finally { context.dispose() }
  }
  /** Slow log is server-wide: return only bounded metadata, never argument bytes. */
  async slowLog(sessionId: string, count: number, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('慢日志条数必须在 1 到 10 之间。')
    const target = this.target(sessionId)
    const context = new RedisReadContext(this.connections, sessionId, target, signal)
    try {
      const reply = await context.command('SLOWLOG', ['GET', String(count)])
      signal.throwIfAborted()
      if (!Array.isArray(reply) || reply.length > count) throw new RedisFrameError('protocol')
      const entries = reply.map(row => {
        if (!Array.isArray(row) || row.length < 4 || typeof row[0] !== 'bigint' || row[0] < 0n || typeof row[1] !== 'bigint' || row[1] < 0n || typeof row[2] !== 'bigint' || row[2] < 0n || !Array.isArray(row[3]) || !Buffer.isBuffer(row[3][0])) throw new RedisFrameError('protocol')
        const rawName = row[3][0].toString('ascii').toUpperCase()
        const command = /^[A-Z][A-Z0-9._-]{0,63}$/u.test(rawName) && Buffer.from(rawName.toLowerCase(), 'ascii').equals(row[3][0].map(byte => byte >= 65 && byte <= 90 ? byte + 32 : byte)) ? rawName : null
        return { id: row[0].toString(), timestampSeconds: row[1].toString(), durationMicroseconds: row[2].toString(), command }
      })
      this.connections.assertTarget(sessionId, target)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), scope: 'server', state: 'value', requestedCount: count, returnedCount: entries.length, entries, sampledAt: new Date().toISOString(), error: null, errorMessage: null })
    } catch (error) {
      signal.throwIfAborted()
      const code = context.error(error)
      this.connections.assertReadResult(sessionId, target, code)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), scope: 'server', state: 'failed', requestedCount: count, returnedCount: 0, entries: [], sampledAt: new Date().toISOString(), error: code, errorMessage: explain(code) })
    } finally { context.dispose() }
  }
  /** Only a short allowlist of server metrics is returned to the model. */
  async overview(sessionId: string, section: string, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    if (!Object.hasOwn(overviewFields, section)) throw new Error('概况类别仅支持 server、memory、clients 或 stats。')
    const selected = section as OverviewSection, expected: readonly string[] = overviewFields[selected]
    const target = this.target(sessionId), context = new RedisReadContext(this.connections, sessionId, target, signal)
    try {
      const reply = await context.command('INFO', [selected])
      signal.throwIfAborted()
      if (!Buffer.isBuffer(reply)) throw new RedisFrameError('protocol')
      let raw: string
      try { raw = new TextDecoder('utf-8', { fatal: true }).decode(reply) } catch { throw new RedisFrameError('protocol') }
      const fields: Record<string, string> = {}
      for (const line of raw.split(/\r?\n/u)) {
        const separator = line.indexOf(':')
        if (separator < 1) continue
        const name = line.slice(0, separator), value = line.slice(separator + 1)
        if (!expected.includes(name)) continue
        if (Object.hasOwn(fields, name)) throw new RedisFrameError('protocol')
        const valid = name === 'redis_version' ? /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:[-+][A-Za-z0-9.-]{1,32})?$/u.test(value) : name === 'mem_fragmentation_ratio' ? /^\d{1,12}(?:\.\d{1,12})?$/u.test(value) : /^\d{1,20}$/u.test(value)
        if (valid) fields[name] = value
      }
      this.connections.assertTarget(sessionId, target)
      const missing = expected.filter(name => !Object.hasOwn(fields, name))
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), scope: 'server', section: selected, state: missing.length === 0 ? 'value' : 'partial', fields, missing, sampledAt: new Date().toISOString(), error: null, errorMessage: null })
    } catch (error) {
      signal.throwIfAborted()
      const code = context.error(error)
      this.connections.assertReadResult(sessionId, target, code)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), scope: 'server', section: selected, state: 'failed', fields: {}, missing: expected, sampledAt: new Date().toISOString(), error: code, errorMessage: explain(code) })
    } finally { context.dispose() }
  }
  /** CLIENT LIST is server-wide and may exceed the bounded RESP frame. */
  async clients(sessionId: string, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    const target = this.target(sessionId), context = new RedisReadContext(this.connections, sessionId, target, signal)
    try {
      const result = projectClients(await context.command('CLIENT', ['LIST']))
      signal.throwIfAborted(); this.connections.assertTarget(sessionId, target)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), scope: 'server', state: 'value', ...result, sampledAt: new Date().toISOString(), error: null, errorMessage: null })
    } catch (error) {
      signal.throwIfAborted()
      const code = context.error(error)
      this.connections.assertReadResult(sessionId, target, code)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), scope: 'server', state: 'failed', clients: [], totalCount: null, complete: false, sampledAt: new Date().toISOString(), error: code, errorMessage: explain(code) })
    } finally { context.dispose() }
  }
  /** Sample group counters without fetching messages or advancing consumption. */
  async streamGroups(sessionId: string, args: { readonly key?: string; readonly keyBase64?: string }, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    if ((args.key === undefined) === (args.keyBase64 === undefined)) throw new Error('请明确指定一个 Stream Key 或规范 Base64 Key。')
    const target = this.target(sessionId)
    const request = stringReadRequestSchema.parse({ target, keyBase64: args.key === undefined ? args.keyBase64 : encodeIdentity(args.key), offset: '0', count: 1 })
    const keyBytes = Buffer.from(request.keyBase64, 'base64'), key = byteIdentity(keyBytes)
    const context = new RedisReadContext(this.connections, sessionId, target, signal)
    try {
      const firstType = await context.type(keyBytes)
      if (firstType === 'none' || firstType !== 'stream') {
        this.connections.assertTarget(sessionId, target)
        return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: firstType === 'none' ? 'missing' : 'unsupported', type: firstType, groups: [], totalCount: null, complete: false, sampledAt: new Date().toISOString(), error: null, errorMessage: firstType === 'none' ? keyStateMessages.missing.zh : '指定 Key 不是 Stream。' })
      }
      const result = projectStreamGroups(await context.command('XINFO', ['GROUPS', keyBytes]))
      const lastType = await context.type(keyBytes)
      signal.throwIfAborted(); this.connections.assertTarget(sessionId, target)
      if (lastType !== 'stream') return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: lastType === 'none' ? 'missing' : 'changed', type: lastType, groups: [], totalCount: null, complete: false, sampledAt: new Date().toISOString(), error: null, errorMessage: lastType === 'none' ? keyStateMessages.missing.zh : keyStateMessages.changed.zh })
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: 'value', type: 'stream', ...result, sampledAt: new Date().toISOString(), error: null, errorMessage: null })
    } catch (error) {
      signal.throwIfAborted()
      // Redis can remove the Stream between TYPE and XINFO; do not report it as a network failure.
      if (error instanceof RedisReplyError && error.message === 'ERR no such key') {
        this.connections.assertTarget(sessionId, target)
        return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: 'missing', type: 'none', groups: [], totalCount: null, complete: false, sampledAt: new Date().toISOString(), error: null, errorMessage: keyStateMessages.missing.zh })
      }
      const code = context.error(error)
      this.connections.assertReadResult(sessionId, target, code)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), key, state: code === 'type-changed' ? 'changed' : 'failed', type: null, groups: [], totalCount: null, complete: false, sampledAt: new Date().toISOString(), error: code, errorMessage: explain(code) })
    } finally { context.dispose() }
  }
  async selectDatabase(sessionId: string, db: number, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    const previous = this.target(sessionId), target = databaseTargetSchema.parse({ ...previous, db })
    const connection = await this.connections.selectDatabase(sessionId, target, signal, () => this.clearTarget(sessionId))
    // Never let an older switch clear a replacement connection's selection.
    if (!this.connections.isCurrentView(sessionId, connection)) throw new Error('连接或数据库已变化，请重新检查当前状态。')
    return this.project(sessionId, { readOnly: true, connection, errorMessage: explain(connection.error), requestedDb: db, sampledAt: new Date().toISOString() })
  }
  async read(sessionId: string, args: AiValueRequest, signal: AbortSignal, stage?: (page: PreparedAiPage) => void): Promise<AiJson> {
    if ((args.field !== undefined || args.fieldBase64 !== undefined) && (args.member !== undefined || args.memberBase64 !== undefined)) throw new Error('字段和成员身份不能同时指定。')
    if (args.field !== undefined || args.fieldBase64 !== undefined) return this.readExplicitHashField(sessionId, args, signal)
    if (args.member !== undefined || args.memberBase64 !== undefined) return this.readExplicitMember(sessionId, args, signal)
    if (args.key !== undefined || args.keyBase64 !== undefined) return this.readValue(sessionId, args, signal, stage)
    const selected = this.selection(sessionId)
    if (selected === null) return this.readValue(sessionId, args, signal, stage)
    const revision = await this.confirmSelection(sessionId, selected.target, null, signal)
    const validate = (allowFailed = false) => {
      signal.throwIfAborted()
      if (this.selections.get(sessionId) !== selected || !this.isSelectionCurrent(sessionId, revision)) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      if (!allowFailed || !this.connections.isFailedTarget(sessionId, selected.target)) this.connections.assertTarget(sessionId, selected.target)
    }
    validate()
    let prepared: PreparedAiPage | undefined
    try {
      const result = await this.readValue(sessionId, args, signal, page => { prepared = page }, validate)
      const value = typeof result === 'object' && result !== null && !Array.isArray(result) ? result.value : null
      const error = typeof value === 'object' && value !== null && !Array.isArray(value) ? value.error : null
      const connection = this.connections.status(sessionId)
      const sameFailure = connection.error !== null && error === connection.error && this.connections.isFailedTarget(sessionId, selected.target, connection.error)
      await this.confirmSelection(sessionId, selected.target, revision, signal)
      validate(sameFailure)
      if (prepared !== undefined) {
        const page = prepared
        if (stage === undefined) page.commit()
        else stage({ result: page.result, commit: () => { validate(sameFailure); page.commit() }, rollback: () => page.rollback() })
      }
      return result
    } catch (error) { prepared?.rollback(); throw error }
  }
  /** A named Hash field is read directly; it must never depend on a sidebar selection. */
  private async readExplicitHashField(sessionId: string, args: AiValueRequest, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    if ((args.key === undefined) === (args.keyBase64 === undefined) || (args.field === undefined) === (args.fieldBase64 === undefined)) throw new Error('精确字段读取需要分别指定一个 Key 和一个字段身份。')
    if (args.cursor !== undefined || args.offset !== undefined || args.count !== undefined || args.bytes !== undefined || args.match !== undefined || args.start !== undefined || args.end !== undefined || args.direction !== undefined) throw new Error('精确字段读取不能同时使用分页或范围参数。')
    const target = this.target(sessionId)
    const request = hashFieldReadRequestSchema.parse({ target, keyBase64: args.key === undefined ? args.keyBase64 : encodeIdentity(args.key), fieldBase64: args.field === undefined ? args.fieldBase64 : encodeIdentity(args.field) })
    const sample = await new RedisSelectedReader(this.connections).read(sessionId, target, request.keyBase64, { kind: 'hash', fieldBase64: request.fieldBase64 }, signal)
    signal.throwIfAborted()
    this.connections.assertReadResult(sessionId, target, sample.error)
    return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), source: 'explicit', key: byteIdentity(Buffer.from(request.keyBase64, 'base64')), field: byteIdentity(Buffer.from(request.fieldBase64, 'base64')), errorMessage: sample.state === 'selection-missing' ? '采样时指定的 Hash 字段不存在。' : explainValue(sample.error, sample), value: { ...sample, cell: sample.cell === null ? null : aiValue(sample.cell) } })
  }
  /** Discover Set versus ZSet, then reuse the exact member reader without UI state. */
  private async readExplicitMember(sessionId: string, args: AiValueRequest, signal: AbortSignal): Promise<AiJson> {
    signal.throwIfAborted()
    if ((args.key === undefined) === (args.keyBase64 === undefined) || (args.member === undefined) === (args.memberBase64 === undefined)) throw new Error('精确成员读取需要分别指定一个 Key 和一个成员身份。')
    if (args.cursor !== undefined || args.offset !== undefined || args.count !== undefined || args.bytes !== undefined || args.match !== undefined || args.start !== undefined || args.end !== undefined || args.direction !== undefined) throw new Error('精确成员读取不能同时使用分页或范围参数。')
    const target = this.target(sessionId)
    const request = setMemberReadRequestSchema.parse({ target, keyBase64: args.key === undefined ? args.keyBase64 : encodeIdentity(args.key), memberBase64: args.member === undefined ? args.memberBase64 : encodeIdentity(args.member) })
    const key = byteIdentity(Buffer.from(request.keyBase64, 'base64')), member = byteIdentity(Buffer.from(request.memberBase64, 'base64'))
    const context = new RedisReadContext(this.connections, sessionId, target, signal)
    let type: string
    try { type = await context.type(Buffer.from(request.keyBase64, 'base64')) }
    catch (error) {
      const code = context.error(error)
      this.connections.assertReadResult(sessionId, target, code)
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), source: 'explicit', key, member, value: { state: 'failed', error: code, sampledAt: new Date().toISOString() }, errorMessage: explain(code) })
    } finally { context.dispose() }
    signal.throwIfAborted()
    this.connections.assertTarget(sessionId, target)
    if (type !== 'set' && type !== 'zset') return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), source: 'explicit', key, member, value: { state: type === 'none' ? 'missing' : 'unsupported', type, sampledAt: new Date().toISOString() }, errorMessage: type === 'none' ? keyStateMessages.missing.zh : '指定 Key 不是 Set 或 ZSet。' })
    const sample = await new RedisSelectedReader(this.connections).read(sessionId, target, request.keyBase64, { kind: type, memberBase64: request.memberBase64 }, signal)
    signal.throwIfAborted()
    this.connections.assertReadResult(sessionId, target, sample.error)
    return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), source: 'explicit', key, member, errorMessage: sample.state === 'selection-missing' ? '采样时指定的成员不存在。' : explainValue(sample.error, sample), value: { ...sample, cell: sample.cell === null ? null : aiValue(sample.cell) } })
  }
  private async readValue(sessionId: string, args: AiValueRequest, signal: AbortSignal, stage?: (page: PreparedAiPage) => void, validateSelection?: (allowFailed?: boolean) => void): Promise<AiJson> {
    signal.throwIfAborted()
    const target = this.target(sessionId)
    const hashSnapshot = this.hashPages.snapshot(sessionId)
    const setSnapshot = this.setPages.snapshot(sessionId)
    const zsetSnapshot = this.zsetPages.snapshot(sessionId)
    const streamSnapshot = this.streamPages.snapshot(sessionId)
    const selected = args.key === undefined && args.keyBase64 === undefined ? this.selection(sessionId) : null
    if (selected !== null && selected.selection.item !== null) {
      if (isAiHashCursor(args.cursor ?? null) || isAiSetCursor(args.cursor ?? null) || isAiZSetCursor(args.cursor ?? null) || isAiStreamCursor(args.cursor ?? null)) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      // Recheck before dispatch and after receipt, even if the UI has not yet
      // published its replacement selection to the Host.
      const read = await new RedisSelectedReader(this.connections).read(sessionId, target, selected.selection.keyBase64, selected.selection.item, signal, () => validateSelection?.())
      validateSelection?.(true)
      this.connections.assertReadResult(sessionId, target, read.error)
      if (this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), source: 'selection', selected, errorMessage: explainValue(read.error, read), value: { ...read, cell: read.cell === null ? null : aiValue(read.cell) } })
    }
    if (args.key === undefined && args.keyBase64 === undefined && selected === null) throw new Error('当前没有有效的侧栏选择，请选择 Key 或明确指定 key。')
    if (args.key !== undefined && args.keyBase64 !== undefined) throw new Error('key 与 keyBase64 只能指定其中一个。')
    const keyBase64 = selected?.selection.keyBase64 ?? args.keyBase64 ?? Buffer.from(args.key ?? '', 'utf8').toString('base64')
    const common = { target, keyBase64 }, pattern = args.match ?? '*', cursor = args.cursor ?? null
    const offset = args.offset ?? '0', count = args.count ?? 25
    // The wrapped continuation bypasses type discovery, but must retain the
    // same input validation as a first read before it can consume a token.
    const probeRequest = stringReadRequestSchema.parse({ ...common, offset, count: args.bytes ?? MAX_AI_VALUE_BYTES })
    const readHash = async (): Promise<AiJson> => {
      const request = scanHashRequestSchema.parse({ ...common, pattern, cursor: null })
      const page = await this.hashPages.prepare(sessionId, cursor, hashSnapshot, slot => slot.prepare(sessionId, request.target, request.keyBase64, request.pattern, cursor, selected, () => {
        if (selected !== null && this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      }, signal))
      if (stage === undefined) { try { page.commit() } catch (error) { page.rollback(); throw error } }
      else stage(page)
      return page.result
    }
    const readSet = async (): Promise<AiJson> => {
      const request = scanSetRequestSchema.parse({ ...common, pattern, cursor: null })
      const page = await this.setPages.prepare(sessionId, cursor, setSnapshot, slot => slot.prepare(sessionId, request.target, request.keyBase64, request.pattern, cursor, selected, () => {
        if (selected !== null && this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      }, signal))
      if (stage === undefined) { try { page.commit() } catch (error) { page.rollback(); throw error } }
      else stage(page)
      return page.result
    }
    const readZSetScan = async (): Promise<AiJson> => {
      if (args.offset !== undefined || args.count !== undefined) throw new Error('ZSet 扫描模式不能同时使用 offset 或 count。')
      const request = zsetReadRequestSchema.parse({ ...common, mode: 'scan', pattern, cursor: null })
      if (request.mode !== 'scan') throw new Error('Invalid ZSet scan mode')
      const page = await this.zsetPages.prepare(sessionId, cursor, zsetSnapshot, slot => slot.prepare(sessionId, request.target, request.keyBase64, request.pattern, cursor, selected, () => {
        if (selected !== null && this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      }, signal))
      if (stage === undefined) { try { page.commit() } catch (error) { page.rollback(); throw error } }
      else stage(page)
      return page.result
    }
    const readStream = async (): Promise<AiJson> => {
      const request = streamReadRequestSchema.parse({ ...common, direction: args.direction ?? 'forward', start: args.start ?? '-', end: args.end ?? '+', count, cursor: null })
      const page = await this.streamPages.prepare(sessionId, cursor, streamSnapshot, slot => slot.prepare(sessionId, request, cursor, selected, () => {
        if (selected !== null && this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
      }, signal))
      if (stage === undefined) { try { page.commit() } catch (error) { page.rollback(); throw error } }
      else stage(page)
      return page.result
    }
    // Wrapped tokens are identified before type discovery, never sent to Redis readers.
    if (isAiHashCursor(cursor)) return readHash()
    if (isAiSetCursor(cursor)) return readSet()
    if (isAiZSetCursor(cursor)) return readZSetScan()
    if (isAiStreamCursor(cursor)) return readStream()
    // Reuse the same bounded type discovery used by the sidebar. Readers check
    // the type/target again, so a concurrent change never becomes a false value.
    const probe = await this.strings.read(sessionId, probeRequest, signal)
    let data: unknown = probe, readError = probe.error
    if (probe.state === 'unsupported') {
      switch (probe.metadata?.type) {
        case 'hash': {
          return readHash()
        }
        case 'list': {
          const page = await this.lists.read(sessionId, listReadRequestSchema.parse({ ...common, offset, count }), signal)
          readError = page.error
          const entries = page.entries.map(entry => ({ index: entry.index, value: aiValue(entry.value) }))
          data = { ...page, entries, complete: page.state === 'page' && offset === '0' && page.nextOffset === null && entries.every(entry => entry.value.complete) }
          break
        }
        case 'set': {
          return readSet()
        }
        case 'zset': {
          if (args.match !== undefined || args.cursor !== undefined) return readZSetScan()
          // Validate first: an invalid rank request must not consume a scan.
          const request = zsetReadRequestSchema.parse({ ...common, mode: 'range', offset, count })
          signal.throwIfAborted(); this.connections.assertReadResult(sessionId, target, probe.error)
          if (selected !== null && this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
          // Ranking has its own reader so it cannot invalidate a ZSCAN cursor.
          const page = await this.zsetRanks.read(sessionId, request, signal)
          signal.throwIfAborted(); this.connections.assertReadResult(sessionId, target, page.error)
          readError = page.error
          data = { ...page, scanComplete: page.mode === 'scan' && page.state === 'page' && page.cursor === null, complete: page.state === 'page' && (page.mode === 'scan' ? args.cursor === undefined && pattern === '*' && page.cursor === null && String(page.entries.length) === page.metadata?.length : offset === '0' && page.nextOffset === null) }
          break
        }
        case 'stream': {
          return readStream()
        }
      }
      // The type can change between discovery and the type-specific reader.
      // A supported replacement type is a change, not an unsupported key.
      if (typeof data === 'object' && data !== null && 'state' in data && data.state === 'unsupported' && 'metadata' in data && typeof data.metadata === 'object' && data.metadata !== null && 'type' in data.metadata && data.metadata.type !== probe.metadata?.type) data = { ...data, state: 'changed' }
    } else if (probe.state === 'value') data = { ...probe, text: aiText(Buffer.from(probe.base64, 'base64')) }
    this.connections.assertReadResult(sessionId, target, readError)
    if (selected !== null && this.selections.get(sessionId) !== selected) throw new Error('侧栏选择已变化，请读取新的当前选择。')
    return this.project(sessionId, { readOnly: true, connection: this.connections.status(sessionId), source: selected === null ? 'explicit' : 'selection', key: byteIdentity(Buffer.from(keyBase64, 'base64')), errorMessage: explainValue(readError, data), value: data })
  }
  clearTarget(sessionId: string): void {
    this.invalidateUiActions(sessionId)
    this.selections.delete(sessionId)
    this.keyPages.disposeSession(sessionId)
    this.hashFilter.disposeSession(sessionId)
    this.hashPages.disposeSession(sessionId)
    this.setPages.disposeSession(sessionId)
    this.zsetPages.disposeSession(sessionId)
    this.streamPages.disposeSession(sessionId)
    this.disposeCursors(sessionId)
  }
  disposeSession(sessionId: string): void { this.clearTarget(sessionId); this.budget.disposeSession(sessionId) }
  private disposeCursors(sessionId: string): void {
    this.keys.disposeSession(sessionId); this.hashes.disposeSession(sessionId); this.sets.disposeSession(sessionId); this.zsets.disposeSession(sessionId); this.zsetRanks.disposeSession(sessionId); this.streams.disposeSession(sessionId)
  }
  dispose(): void { this.selections.clear(); this.budget.dispose(); this.keyPages.dispose(); this.hashFilter.dispose(); this.hashPages.dispose(); this.setPages.dispose(); this.zsetPages.dispose(); this.streamPages.dispose(); this.keys.dispose(); this.hashes.dispose(); this.sets.dispose(); this.zsets.dispose(); this.zsetRanks.dispose(); this.streams.dispose() }
}
