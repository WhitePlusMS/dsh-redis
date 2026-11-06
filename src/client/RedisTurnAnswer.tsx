import type { Context } from '@deepseek-ai/cordis'
import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { useSyncExternalStore } from 'react'
import { parseRedisAnswer, type RedisAnswerSection } from '../redis-answer.ts'
import { RedisAnswerContent } from './RedisToolEvidence.tsx'
import { EVIDENCE_NS } from './tool-evidence-locales.ts'

interface TurnAnswer {
  readonly turn: number
  readonly callId: string | null
  readonly answers: readonly RedisAnswerSection[] | null
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap { 'redis-answer': TurnAnswer }
}

/** Project the persisted answer call into its owning turn. DSH owns history,
 * session isolation and replay; this does not create an assistant message or
 * retain a separate answer cache. Ordinary tools cannot populate this slot.
 */
export const redisAnswerDefinition: ConversationNodeDefinition<TurnAnswer> = {
  kind: 'redis-answer',
  match(event) {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call' && event.data.name === 'redis_viewer_answer') return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result') return { id: String(event.data.turn), role: 'update' }
    return null
  },
  start(_context, { event }) {
    if (event.type !== 'turn/start') throw new Error('Redis answer requires its recorded turn start')
    return { turn: event.data.turn, callId: null, answers: null }
  },
  update({ state }, { event }) {
    if (event.type === 'tool/call') return { turn: event.data.turn, callId: event.data.callId, answers: null }
    if (event.type !== 'tool/result' || event.data.message.toolCallId !== state.callId) return state
    const { message } = event.data, content = message.content
    const answers = !message.isError && content.length === 1 && content[0]?.type === 'text' ? parseRedisAnswer(content[0].text) : null
    return { ...state, answers }
  },
  buildLocationData({ state }, scope) {
    return scope === 'turn' && state?.answers != null ? { kind: 'turn', turn: state.turn, key: 'redis-answer', value: state } : null
  },
}

type Props = PropsRuntime<'conversation.chat.turnTail'> & PropsLocale<typeof EVIDENCE_NS>

export function RedisTurnAnswer({ turn, t }: Props) {
  const source = turn.data.source('redis-answer')
  const answer = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
  if (answer?.answers == null) return null
  return <section data-redis-turn-answer={turn.turn} data-call-id={answer.callId} aria-label={t('answer')}>
    <RedisAnswerContent answers={answer.answers} />
  </section>
}

export function registerRedisTurnAnswer(ctx: Context): void {
  ctx.effect(() => ctx.uiConversation.events.register(redisAnswerDefinition), 'redis answer turn projection')
  ctx.effect(() => ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
    name: 'conversation.chat.turnTail', id: 'dsh-redis.answer', locale: EVIDENCE_NS,
  }, RedisTurnAnswer)), 'redis answer in conversation')
}
