import type { DatabaseTarget, HashEntry, ScanHashResult } from '../domain.ts'
import { connectionErrorMessages, keyStateMessages } from '../connection-errors.ts'
import type { RedisConnections } from './connection-service.ts'
import { byteIdentity } from './byte-identity.ts'
import { aiValue } from './ai-value.ts'
import type { RedisHashes } from './hash-reader.ts'
import { AiPageStore, type PreparedAiPage } from './ai-page-store.ts'

export const isAiHashCursor = (cursor: string | null): boolean => cursor?.startsWith('h:') === true

/** Hash values preserve their own continuation and whole-field identity. */
export class RedisAiHashPages {
  private readonly pages = new AiPageStore<ScanHashResult, HashEntry>('h:')
  constructor(private readonly connections: RedisConnections, private readonly hashes: RedisHashes) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId); this.hashes.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose(); this.hashes.dispose() }

  prepare(sessionId: string, target: DatabaseTarget, keyBase64: string, pattern: string, cursor: string | null, selected: object | null, assertSelection: () => void, signal: AbortSignal): Promise<PreparedAiPage> {
    signal.throwIfAborted(); this.connections.assertTarget(sessionId, target); assertSelection()
    const identity = byteIdentity(Buffer.from(keyBase64, 'base64'))
    return this.pages.prepare({
      sessionId, binding: JSON.stringify([target.id, target.generation, target.db, keyBase64, pattern, selected !== null]), selection: selected, cursor, signal,
      fetch: async next => {
        const read = await this.hashes.scan(sessionId, { target, keyBase64, pattern, cursor: next }, signal)
        // Discovery saw Hash; a different type in the reader means it changed.
        return read.state === 'unsupported' && read.metadata?.type !== 'hash' ? { ...read, state: 'changed', metadata: null } : read
      },
      rows: page => page.entries,
      output: (page, rows, next, first) => {
        const entries = rows.map(entry => ({ field: entry.field, value: aiValue(entry.value) }))
        const errorMessage = page.error !== null ? connectionErrorMessages[page.error].zh : page.state === 'missing' || page.state === 'changed' ? keyStateMessages[page.state].zh : null
        return { readOnly: true, connection: this.connections.status(sessionId), source: selected === null ? 'explicit' : 'selection', key: identity, errorMessage,
          value: { ...page, entries, cursor: next, scanComplete: page.state === 'page' && next === null,
            complete: page.state === 'page' && first && pattern === '*' && next === null && String(entries.length) === page.metadata?.length && entries.every(entry => entry.value.complete) } }
      },
      validate: error => { assertSelection(); this.connections.assertReadResult(sessionId, target, error) },
      discard: () => this.hashes.disposeSession(sessionId),
      oversize: '单个 Hash 字段或其必要元信息超过 AI 单次结果上限，无法完整返回；请缩小匹配范围。',
    })
  }
}
