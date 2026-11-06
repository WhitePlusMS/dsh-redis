import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { RedisAiReader } from './ai-reader.ts'
import { MAX_AI_RESULT_BYTES, MAX_AI_SESSION_CALLS } from './ai-budget.ts'
import { evidenceTools } from '../redis-read-tools.ts'
import { describeRedisResult, summarizeRedisFilters } from '../redis-answer.ts'
import { connectionViewSchema } from '../typert.shared.ts'
import type { ConnectionView } from '../domain.ts'

interface ReadRecord { readonly tool: string; readonly connection: ConnectionView; readonly inputCursor: string | null | undefined; result?: Record<string, unknown> }
interface TurnReads { readonly turn: number; readonly calls: Map<string, ReadRecord>; omittedCalls: number }
const uiReceiptTools = new Set(['redis_viewer_show', 'redis_viewer_refresh', 'redis_viewer_format', 'redis_viewer_locate_key', 'redis_viewer_locate_hash_field', 'redis_viewer_locate_list_index', 'redis_viewer_locate_set_member', 'redis_viewer_locate_zset_member', 'redis_viewer_locate_stream_field'])

/** Consume committed session events, never model-supplied copies of Redis data.
 * This bounded, turn-local index holds no cursor or query state. The final answer
 * is persisted by DSH like any other tool result, so replay needs no live cache.
 */
export function registerRedisAnswerTool(ctx: Context, reader: RedisAiReader): void {
  const sessions = new Map<string, TurnReads>()
  const readable = new Set<string>([...evidenceTools, ...uiReceiptTools])
  const currentConnection = (sessionId: string) => {
    const status = reader.status(sessionId)
    if (status === null || typeof status !== 'object' || Array.isArray(status)) throw new Error('Redis 状态无效。')
    return connectionViewSchema.parse(status.connection)
  }
  const observe = (sessionId: string, event: SessionEvent) => {
    if (event.type === 'turn/start') {
      sessions.set(sessionId, { turn: event.data.turn, calls: new Map(), omittedCalls: 0 }); return
    }
    if (event.type === 'turn/end') { sessions.delete(sessionId); return }
    const current = sessions.get(sessionId)
    if (current === undefined) return
    // Newly admitted input must not inherit an earlier answer's observations.
    if (event.type === 'user/message' && event.data.source.kind === 'user') { current.calls.clear(); current.omittedCalls = 0; return }
    if (event.type === 'tool/call' && event.data.turn === current.turn && readable.has(event.data.name)) {
      if (current.calls.size >= MAX_AI_SESSION_CALLS) { current.calls.delete(current.calls.keys().next().value ?? ''); current.omittedCalls++ }
      // Keep only the continuation identity needed for summaries, not arbitrary
      // model arguments. Malformed inputs never become an iteration start.
      let inputCursor: string | null | undefined
      if (event.data.name === 'redis_viewer_filter_hash') try {
        const args: unknown = JSON.parse(event.data.arguments)
        if (typeof args === 'object' && args !== null && !Array.isArray(args)) inputCursor = !('cursor' in args) ? null : typeof args.cursor === 'string' ? args.cursor : undefined
      } catch { /* The tool owns argument validation. */ }
      current.calls.set(event.data.callId, { tool: event.data.name, connection: currentConnection(sessionId), inputCursor }); return
    }
    if (event.type !== 'tool/result' || event.data.turn !== current.turn) return
    const message = event.data.message, entry = current.calls.get(message.toolCallId)
    if (entry === undefined) return
    // Rejections/cancellation are evidence too. They refer to the connection at
    // dispatch and must not be mistaken for a successful Redis observation.
    const failed = (reason: string) => { entry.result = { readOnly: true, connection: entry.connection, state: 'failed', errorMessage: reason } }
    failed('读取未取得可用的结构化结果，请查看对应调用记录。')
    if (message.content.length !== 1 || message.content[0]?.type !== 'text') return
    const text = message.content[0].text
    if (Buffer.byteLength(text) > MAX_AI_RESULT_BYTES) return
    if (message.isError) { failed(text); return }
    try {
      const value: unknown = JSON.parse(text)
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return
      if ('readOnly' in value && value.readOnly === true) entry.result = value as Record<string, unknown>
      // UI tools return receipts rather than read envelopes. Keep the exact
      // receipt and dispatch connection; never turn it into a value sample.
      else if (uiReceiptTools.has(entry.tool) && 'outcome' in value && typeof value.outcome === 'string' && 'message' in value && typeof value.message === 'string') entry.result = { readOnly: true, connection: entry.connection, kind: 'ui-receipt', receipt: value }
    } catch { /* Failed or foreign outputs are never promoted into evidence. */ }
  }
  ctx.on('session/event', (session, event) => observe(session.id, event))
  ctx.on('session/disposed', session => { sessions.delete(session.id) })
  ctx.effect(() => () => sessions.clear(), 'redis answer evidence')
  ctx.tools.register(defineTool({
    name: 'redis_viewer_answer',
    description: '完成 Redis 查询或界面操作的最后一步：在完成必要的查找、读取、分页及用户要求的其他操作之后，无参数调用本工具。Host 自动引用本轮当前连接和 DB 的已完成读取记录及界面回执，生成中文答案、原值及范围解释，原生卡片显示答案，然后结束本轮。仅打开、定位、刷新或切换显示格式也使用本工具收束，不必额外读取值。不要传调用 ID、Key 或自由文本。普通读取不会提前结束。只有名称线索时先 status → keys，按真实候选读取，候选不唯一且用户未要求全部时先请用户澄清；明确 Key/字段直接 value，只问类型或 TTL 用 key_metadata。保留原查询范围，不用旧选择或历史值代替当前结果。若尚有必要查询或其他任务未完成，不调用本工具。',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).length !== 0) throw new Error('完成回答不接受参数；本轮读取记录由 Host 自动引用。')
      const sessionId = exec.agent.session.id, current = sessions.get(sessionId)
      const target = currentConnection(sessionId)
      if ([...(current?.calls.values() ?? [])].some(record => record.result === undefined)) throw new Error('本轮还有读取未结束，请等待结果后再回答。')
      const records = [...(current?.calls ?? [])].filter(([, record]) => {
        const connection = record.result?.connection
        return typeof connection === 'object' && connection !== null && 'id' in connection && 'generation' in connection && 'db' in connection && connection.id === target.id && connection.generation === target.generation && connection.db === target.db
      })
      if (records.length === 0) throw new Error('本轮当前连接和 DB 尚无已完成的读取，请先查询再回答。')
      const hasData = records.some(([, record]) => record.tool !== 'redis_viewer_status' && record.tool !== 'redis_viewer_select_db')
      const answers = records.filter(([, record]) => !hasData || (record.tool !== 'redis_viewer_status' && record.tool !== 'redis_viewer_select_db')).map(([callId, record]) => ({ callId, tool: record.tool, ...describeRedisResult(record.tool, record.result ?? {}) }))
      const summaries = summarizeRedisFilters(records.filter(([, record]) => record.tool === 'redis_viewer_filter_hash').map(([callId, record]) => ({ callId, inputCursor: record.inputCursor, result: record.result ?? {} })))
      for (const answer of answers) {
        const summary = summaries.get(answer.callId)
        if (summary !== undefined) { answer.paragraphs.push(...summary.paragraphs); answer.values.push(...summary.values) }
      }
      const omittedCalls = current?.omittedCalls ?? 0
      if (omittedCalls > 0) answers[0]?.paragraphs.unshift(`本轮较早的 ${omittedCalls} 次调用已超出摘要保留上限；这里仅汇总最近记录，不是完整查询汇总，早期结果请查看原调用。`)
      const result = { readOnly: true, state: 'answered', omittedCalls, answers }
      if (Buffer.byteLength(JSON.stringify(result)) > MAX_AI_RESULT_BYTES) {
        // Do not truncate a JSON value or silently discard an earlier page.
        // The original call cards already own every value; keep all summaries.
        for (const answer of answers) {
          answer.values = []
          answer.paragraphs.push('本轮原值较大，答案只汇总状态与范围；原值请展开对应读取卡片查看。')
        }
      }
      if (Buffer.byteLength(JSON.stringify(result)) > MAX_AI_RESULT_BYTES) throw new Error('本轮摘要超过答案预算，请查看对应读取卡片。')
      exec.signal.throwIfAborted()
      // Only this successful, fully prepared answer ends the turn. A read,
      // validation error or missing reference must leave further work possible.
      exec.concludeTurn()
      return result
    },
  }))
}
