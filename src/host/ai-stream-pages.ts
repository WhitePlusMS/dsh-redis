import type { StreamMessage, StreamReadRequest, StreamReadResult } from '../domain.ts'
import { connectionErrorMessages, keyStateMessages } from '../connection-errors.ts'
import type { RedisConnections } from './connection-service.ts'
import { byteIdentity } from './byte-identity.ts'
import { aiValue } from './ai-value.ts'
import type { RedisStreams } from './stream-reader.ts'
import { AiPageStore, type PreparedAiPage } from './ai-page-store.ts'

export const isAiStreamCursor = (cursor: string | null): boolean => cursor?.startsWith('x:') === true

/** Stream fields remain ordered occurrences; a message is never split. */
export class RedisAiStreamPages {
  private readonly pages = new AiPageStore<StreamReadResult, StreamMessage>('x:')
  constructor(private readonly connections: RedisConnections, private readonly streams: RedisStreams) {}
  disposeSession(sessionId: string): void { this.pages.disposeSession(sessionId); this.streams.disposeSession(sessionId) }
  dispose(): void { this.pages.dispose(); this.streams.dispose() }

  prepare(sessionId: string, request: StreamReadRequest, cursor: string | null, selected: object | null, assertSelection: () => void, signal: AbortSignal): Promise<PreparedAiPage> {
    signal.throwIfAborted(); this.connections.assertTarget(sessionId, request.target); assertSelection()
    const { target, keyBase64, direction, start, end, count } = request
    const identity = byteIdentity(Buffer.from(keyBase64, 'base64'))
    return this.pages.prepare({
      sessionId, binding: JSON.stringify([target.id, target.generation, target.db, keyBase64, direction, start, end, selected !== null]), selection: selected, cursor, signal, maxRows: count,
      fetch: async next => {
        const read = await this.streams.read(sessionId, { target, keyBase64, direction, start, end, count, cursor: next }, signal)
        return read.state === 'unsupported' && read.metadata?.type !== 'stream' ? { ...read, state: 'changed', metadata: null } : read
      },
      rows: page => page.messages,
      output: (page, rows, next, first) => {
        const messages = rows.map(message => ({ id: message.id, fields: message.fields.map((pair, index) => ({ index, field: pair.field, value: aiValue(pair.value) })) }))
        const errorMessage = page.error !== null ? connectionErrorMessages[page.error].zh : page.state === 'missing' || page.state === 'changed' ? keyStateMessages[page.state].zh : null
        return { readOnly: true, connection: this.connections.status(sessionId), source: selected === null ? 'explicit' : 'selection', key: identity, errorMessage,
          value: { ...page, messages, cursor: next, scanComplete: page.state === 'page' && next === null,
            complete: page.state === 'page' && first && start === '-' && end === '+' && next === null && String(messages.length) === page.metadata?.length && messages.every(message => message.fields.every(pair => pair.value.complete)) } }
      },
      validate: error => { assertSelection(); this.connections.assertReadResult(sessionId, target, error) },
      discard: () => this.streams.disposeSession(sessionId),
      oversize: '单条 Stream 消息或其必要元信息超过 AI 单次结果上限，无法完整返回；请缩小读取范围。',
    })
  }
}
