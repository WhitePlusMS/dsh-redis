import { z } from 'zod'
import type { DatabaseTarget, RedisKey, ScanKeysResult } from '../domain.ts'
import { scanKeysResultSchema } from '../typert.shared.ts'
import { connectionErrorMessages } from '../connection-errors.ts'
import { MAX_AI_RESULT_BYTES } from './ai-budget.ts'
import { AiPageStore, type PreparedAiPage } from './ai-page-store.ts'
import type { RedisConnections } from './connection-service.ts'
import { KEY_SCAN_SCOPE, RedisKeys } from './key-reader.ts'
import { RedisSelectedReader } from './selected-reader.ts'

/** The per-call limit applies to actual candidate reads, not Redis SCAN's COUNT hint. */
const MAX_CANDIDATES_PER_CALL = 10
const RESULT_RESERVE = ' '.repeat(4096)

/** Independent scan state keeps filters from consuming the normal AI or UI cursor. */
export class RedisAiHashFilter {
  private readonly keys: RedisKeys
  private readonly pages = new AiPageStore<ScanKeysResult, RedisKey>('f:')
  constructor(private readonly connections: RedisConnections) { this.keys = new RedisKeys(connections) }

  async prepare(sessionId: string, target: DatabaseTarget, pattern: string, fieldBase64: string, expectedBase64: string, cursor: string | null, signal: AbortSignal): Promise<PreparedAiPage> {
    // Both texts were validated losslessly at the reader boundary. Keep the full
    // predicate in every recorded page, including empty and failed results.
    const condition = { field: Buffer.from(fieldBase64, 'base64').toString('utf8'), equals: Buffer.from(expectedBase64, 'base64').toString('utf8') }
    const page = await this.pages.prepare({
      sessionId, binding: JSON.stringify([target.id, target.generation, target.db, pattern, fieldBase64, expectedBase64]), selection: null, cursor, signal,
      fetch: next => this.keys.scan(sessionId, { target, pattern, cursor: next }, signal),
      rows: result => result.keys,
      // Measure the actual condition too: JSON escaping can expand control text.
      // The reserve covers counts and connection metadata, not the predicate.
      output: (result, keys, next) => ({ ...result, condition, keys, cursor: next, reserve: RESULT_RESERVE }),
      validate: error => this.connections.assertReadResult(sessionId, target, error),
      discard: () => this.keys.disposeSession(sessionId),
      maxRows: MAX_CANDIDATES_PER_CALL,
      oversize: '单个 Key 身份超过筛选结果预算，请缩小范围。',
    })
    try {
      const raw = page.result
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('筛选页格式无效。')
      // The AI continuation has an f: prefix; only the underlying Redis scan
      // cursor uses the shared UUID-only RPC schema.
      const cursor = raw.cursor === null ? null : z.string().regex(/^f:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u).parse(raw.cursor)
      const data = scanKeysResultSchema.parse({ state: raw.state, error: raw.error, keys: raw.keys, cursor: null, sampledAt: raw.sampledAt })
      if (data.state === 'failed' && cursor !== null) throw new Error('筛选失败结果包含无效游标。')
      const expected = Buffer.from(expectedBase64, 'base64'), matches: RedisKey[] = []
      const counts = { checked: 0, matched: 0, different: 0, missingField: 0, missingKey: 0, notHash: 0, typeChanged: 0, failed: 0 }
      const errors = new Set<string>()
      const readStartedAt = new Date().toISOString()
      if (data.state === 'page') for (const key of data.keys) {
        signal.throwIfAborted()
        const sample = await new RedisSelectedReader(this.connections).read(sessionId, target, key.base64, { kind: 'hash', fieldBase64 }, signal, undefined, 'unsupported')
        signal.throwIfAborted()
        this.connections.assertReadResult(sessionId, target, sample.error)
        counts.checked++
        if (sample.state === 'value' && sample.cell !== null) {
          // The expected value is bounded and only exact complete bytes can match.
          if (sample.cell.fullByteLength === expected.length && Buffer.from(sample.cell.base64, 'base64').equals(expected)) { counts.matched++; matches.push(key) }
          else counts.different++
        } else if (sample.state === 'selection-missing') counts.missingField++
        else if (sample.state === 'missing') counts.missingKey++
        else if (sample.state === 'unsupported') counts.notHash++
        else if (sample.state === 'changed') counts.typeChanged++
        else { counts.failed++; if (sample.error !== null) errors.add(sample.error) }
      }
      signal.throwIfAborted()
      this.connections.assertReadResult(sessionId, target, data.error)
      const result = z.json().parse({ readOnly: true, connection: this.connections.status(sessionId), pattern, condition, scanScope: KEY_SCAN_SCOPE, state: data.state, error: data.error,
        errorMessage: data.error === null ? null : connectionErrorMessages[data.error].zh, matches, counts, errors: [...errors], cursor,
        scanComplete: data.state === 'page' && cursor === null, sampledAt: data.sampledAt, readStartedAt, readFinishedAt: new Date().toISOString(),
        coverage: '本批候选；跨批可能重复，SCAN 与逐项读取不是同一时刻的快照。' })
      if (Buffer.byteLength(JSON.stringify(result)) > MAX_AI_RESULT_BYTES) throw new Error('筛选结果超过单次预算，请缩小范围。')
      return { ...page, result }
    } catch (error) { page.rollback(); throw error }
  }

  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId); this.keys.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose(); this.keys.dispose() }
}
