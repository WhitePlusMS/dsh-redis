import type { DatabaseTarget, RedisKey, ScanSetResult } from '../domain.ts'
import { connectionErrorMessages, keyStateMessages } from '../connection-errors.ts'
import type { RedisConnections } from './connection-service.ts'
import { byteIdentity } from './byte-identity.ts'
import type { RedisSets } from './set-reader.ts'
import { AiPageStore, type PreparedAiPage } from './ai-page-store.ts'

export const isAiSetCursor = (cursor: string | null): boolean => cursor?.startsWith('s:') === true

/** Set results preserve their own continuation and whole-member identity. */
export class RedisAiSetPages {
  private readonly pages = new AiPageStore<ScanSetResult, RedisKey>('s:')
  constructor(private readonly connections: RedisConnections, private readonly sets: RedisSets) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId); this.sets.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose(); this.sets.dispose() }

  prepare(sessionId: string, target: DatabaseTarget, keyBase64: string, pattern: string, cursor: string | null, selected: object | null, assertSelection: () => void, signal: AbortSignal): Promise<PreparedAiPage> {
    signal.throwIfAborted(); this.connections.assertTarget(sessionId, target); assertSelection()
    const identity = byteIdentity(Buffer.from(keyBase64, 'base64'))
    return this.pages.prepare({
      sessionId, binding: JSON.stringify([target.id, target.generation, target.db, keyBase64, pattern, selected !== null]), selection: selected, cursor, signal,
      fetch: async next => {
        const read = await this.sets.scan(sessionId, { target, keyBase64, pattern, cursor: next }, signal)
        // Discovery saw Set; a different type in the reader means it changed.
        return read.state === 'unsupported' && read.metadata?.type !== 'set' ? { ...read, state: 'changed', metadata: null } : read
      },
      rows: page => page.members,
      output: (page, members, next, first) => {
        const errorMessage = page.error !== null ? connectionErrorMessages[page.error].zh : page.state === 'missing' || page.state === 'changed' ? keyStateMessages[page.state].zh : null
        return { readOnly: true, connection: this.connections.status(sessionId), source: selected === null ? 'explicit' : 'selection', key: identity, errorMessage,
          value: { ...page, members, cursor: next, scanComplete: page.state === 'page' && next === null,
            complete: page.state === 'page' && first && pattern === '*' && next === null && String(members.length) === page.metadata?.length } }
      },
      validate: error => { assertSelection(); this.connections.assertReadResult(sessionId, target, error) },
      discard: () => this.sets.disposeSession(sessionId),
      oversize: '单个 Set 成员或其必要元信息超过 AI 单次结果预算，无法完整返回；请缩小匹配范围。',
    })
  }
}
