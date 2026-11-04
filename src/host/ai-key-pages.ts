import type { DatabaseTarget, RedisKey, ScanKeysResult } from '../domain.ts'
import { connectionErrorMessages } from '../connection-errors.ts'
import type { RedisConnections } from './connection-service.ts'
import type { RedisKeys } from './key-reader.ts'
import { AiPageStore, type PreparedAiPage } from './ai-page-store.ts'

/** Key results keep their own store and the existing opaque UUID format. */
export class RedisAiKeyPages {
  private readonly pages = new AiPageStore<ScanKeysResult, RedisKey>('')
  constructor(private readonly connections: RedisConnections, private readonly keys: RedisKeys) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose() }

  prepare(sessionId: string, target: DatabaseTarget, pattern: string, cursor: string | null, signal: AbortSignal): Promise<PreparedAiPage> {
    return this.pages.prepare({
      sessionId, binding: JSON.stringify([target.id, target.generation, target.db, pattern]), selection: null, cursor, signal,
      fetch: next => this.keys.scan(sessionId, { target, pattern, cursor: next }, signal),
      rows: page => page.keys,
      output: (page, keys, next) => ({ readOnly: true, connection: this.connections.status(sessionId), pattern, ...page, keys, returnedCount: keys.length, cursor: next,
        errorMessage: page.error === null ? null : connectionErrorMessages[page.error].zh, scanComplete: page.state === 'page' && next === null }),
      validate: error => this.connections.assertReadResult(sessionId, target, error),
      discard: () => this.keys.disposeSession(sessionId),
      oversize: '单个 Key 或其必要元信息超过 AI 单次结果上限，无法完整返回；请缩小匹配范围。',
    })
  }
}
