import type { DatabaseTarget, ZSetEntry, ZSetReadResult } from '../domain.ts'
import { connectionErrorMessages, keyStateMessages } from '../connection-errors.ts'
import type { RedisConnections } from './connection-service.ts'
import { byteIdentity } from './byte-identity.ts'
import type { RedisZSets } from './zset-reader.ts'
import { AiPageStore, type PreparedAiPage } from './ai-page-store.ts'

export const isAiZSetCursor = (cursor: string | null): boolean => cursor?.startsWith('z:') === true

/** ZSCAN retains full member bytes and original score text; it never assigns ranks. */
export class RedisAiZSetPages {
  private readonly pages = new AiPageStore<ZSetReadResult, ZSetEntry>('z:')
  constructor(private readonly connections: RedisConnections, private readonly zsets: RedisZSets) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId); this.zsets.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose(); this.zsets.dispose() }

  prepare(sessionId: string, target: DatabaseTarget, keyBase64: string, pattern: string, cursor: string | null, selected: object | null, assertSelection: () => void, signal: AbortSignal): Promise<PreparedAiPage> {
    signal.throwIfAborted(); this.connections.assertTarget(sessionId, target); assertSelection()
    const identity = byteIdentity(Buffer.from(keyBase64, 'base64'))
    return this.pages.prepare({
      sessionId, binding: JSON.stringify([target.id, target.generation, target.db, keyBase64, 'scan', pattern, selected !== null]), selection: selected, cursor, signal,
      fetch: async next => {
        const read = await this.zsets.read(sessionId, { target, keyBase64, mode: 'scan', pattern, cursor: next }, signal)
        // Discovery saw ZSet; a different type in the reader means it changed.
        return read.state === 'unsupported' && read.metadata?.type !== 'zset' ? { ...read, state: 'changed', metadata: null } : read
      },
      rows: page => page.entries,
      output: (page, entries, next, first) => {
        const errorMessage = page.error !== null ? connectionErrorMessages[page.error].zh : page.state === 'missing' || page.state === 'changed' ? keyStateMessages[page.state].zh : null
        return { readOnly: true, connection: this.connections.status(sessionId), source: selected === null ? 'explicit' : 'selection', key: identity, errorMessage,
          value: { ...page, entries, cursor: next, scanComplete: page.state === 'page' && next === null,
            complete: page.state === 'page' && first && pattern === '*' && next === null && String(entries.length) === page.metadata?.length } }
      },
      validate: error => { assertSelection(); this.connections.assertReadResult(sessionId, target, error) },
      discard: () => this.zsets.disposeSession(sessionId),
      oversize: '单个 ZSet 成员或其必要元信息超过 AI 单次结果预算，无法完整返回；请缩小匹配范围。',
    })
  }
}
