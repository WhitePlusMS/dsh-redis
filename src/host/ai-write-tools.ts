import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { z } from 'zod'
import type { RedisAiReader } from './ai-reader.ts'
import type { RedisAiWriter } from './ai-writer.ts'
import type { RedisWriteRecord } from '../domain.ts'

const MAX_BASE64 = Math.ceil(4096 / 3) * 4
const nullableString = { oneOf: [{ type: 'string' }, { type: 'null' }] } as const
const proposalParameter = { type: 'object', required: true, additionalProperties: false, properties: {
  id: { type: 'string', required: true }, expiresAt: { type: 'string', required: true },
  target: { type: 'object', required: true, additionalProperties: false, properties: { id: { type: 'string', required: true }, generation: { type: 'integer', required: true }, db: { type: 'integer', required: true } } },
  host: { type: 'string', required: true }, port: { type: 'integer', required: true }, type: { type: 'string', enum: ['string', 'hash'], required: true },
  keyTtl: { type: 'string', enum: ['none'], required: true }, fieldTtl: { ...nullableString, required: true },
  keyBase64: { type: 'string', required: true }, fieldBase64: { ...nullableString, required: true },
  beforeBase64: { type: 'string', required: true }, afterBase64: { type: 'string', required: true },
} } as const

const proposalSchema = z.object({
  id: z.string().uuid(), expiresAt: z.string().max(24),
  target: z.object({ id: z.string().min(1).max(128), generation: z.number().int().positive().safe(), db: z.number().int().min(0).max(65535) }).strict(),
  host: z.string().min(1).max(1024), port: z.number().int().min(1).max(65535), type: z.enum(['string', 'hash']),
  keyTtl: z.literal('none'), fieldTtl: z.literal('none').nullable(), keyBase64: z.string().max(MAX_BASE64), fieldBase64: z.string().max(MAX_BASE64).nullable(),
  beforeBase64: z.string().max(MAX_BASE64), afterBase64: z.string().max(MAX_BASE64),
}).strict()
const output = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }] }
const wireRecord = (record: RedisWriteRecord) => ({ ...record, target: { ...record.target }, identity: { ...record.identity } })

function identity(text: string | undefined, encoded: string | undefined): string {
  if ((text === undefined) === (encoded === undefined)) throw new Error('文本和 Base64 必须且只能指定一种。')
  if (text !== undefined) {
    if (text.length > 4096) throw new Error('文本无法无损编码或超过限制。')
    const bytes = Buffer.from(text, 'utf8')
    if (bytes.length > 4096 || bytes.toString('utf8') !== text) throw new Error('文本无法无损编码或超过限制。')
    return bytes.toString('base64')
  }
  const value = encoded ?? ''
  if (value.length > MAX_BASE64) throw new Error('Base64 不规范或超过限制。')
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length > 4096 || bytes.toString('base64') !== value) throw new Error('Base64 不规范或超过限制。')
  return value
}

/** Use committed native Session events, never a model-supplied session or turn. */
export function registerRedisWriteTools(ctx: Context, reader: RedisAiReader, writer: RedisAiWriter): void {
  const turns = new Map<string, { readonly session: Session; readonly turn: number }>()
  ctx.on('session/event', (session, event) => {
    if (event.type === 'turn/start') turns.set(session.id, { session, turn: event.data.turn })
    else if (event.type === 'turn/end') {
      const active = turns.get(session.id)
      if (active?.session === session && active.turn === event.data.turn) { turns.delete(session.id); writer.endTurn(session.id, String(active.turn)) }
    }
  })
  ctx.on('session/disposed', session => { if (turns.get(session.id)?.session === session) turns.delete(session.id) })
  ctx.effect(() => () => turns.clear(), 'redis write turns')
  const owner = (exec: ToolRunContext) => {
    exec.signal.throwIfAborted()
    const session = exec.agent?.session
    if (session === undefined) throw new Error('Redis 写入缺少有效的 DSH 对话身份。')
    const turn = turns.get(session.id)
    if (turn === undefined || turn.session !== session) throw new Error('Redis 写入需要当前已开始的 DSH 轮次。')
    return { session: session.id, turn: String(turn.turn), current: () => turns.get(session.id) === turn }
  }

  ctx.tools.register(defineTool({
    name: 'redis_viewer_prepare_write',
    description: '仅在用户明确要求修改当前连接的已有 String 或已有 Hash 字段时使用。先在 Redis 面板由用户启用 AI 写入；指定精确 Key、Hash 字段和完整新值，各项文本或规范 Base64 二选一。仅采样不写入，返回含连接、DB、旧值、新值和过期时间的完整 proposal；值超过 4096 字节、有 TTL、目标缺失或采样冲突会拒绝。必须将 proposal 原样交给执行工具，不能自行改写。',
    parameters: { type: { type: 'string', enum: ['string', 'hash'], required: true }, key: { type: 'string' }, keyBase64: { type: 'string' }, field: { type: 'string' }, fieldBase64: { type: 'string' }, value: { type: 'string' }, valueBase64: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) {
      if (Object.keys(args).some(key => !['type', 'key', 'keyBase64', 'field', 'fieldBase64', 'value', 'valueBase64'].includes(key))) throw new Error('Redis 写入提案包含不支持的参数。')
      const context = owner(exec)
      const keyBase64 = identity(args.key, args.keyBase64), afterBase64 = identity(args.value, args.valueBase64)
      const fieldBase64 = args.type === 'hash' ? identity(args.field, args.fieldBase64) : null
      if (args.type === 'string' && (args.field !== undefined || args.fieldBase64 !== undefined)) throw new Error('String 目标不能指定 Hash 字段。')
      const proposal = await writer.prepare(context.session, reader.currentTarget(context.session), context.turn, context.current, { type: args.type, keyBase64, fieldBase64, afterBase64 }, exec.signal)
      return { proposal: { ...proposal, target: { ...proposal.target } }, note: '前态经 WATCH 验证；不代表已经写入。执行时还会再次检查。' }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_execute_write',
    description: '仅执行本轮刚生成且未过期的完整 proposal；必须原样复制全部字段，不能改变目标或数值。该工具遵守 DSH 当前工具权限策略。结果区分未执行、冲突、明确拒绝、已写入并核对、回读未确认、不一致及结果未知；未知时不要自动重试。',
    parameters: { proposal: proposalParameter }, output, timeoutMs: 15000,
    async execute(args, exec) {
      if (Object.keys(args).some(key => key !== 'proposal')) throw new Error('Redis 写入执行包含不支持的参数。')
      const context = owner(exec)
      return wireRecord(await writer.execute(context.session, context.turn, context.current, proposalSchema.parse(args.proposal), exec.signal))
    },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_write_status',
    description: '按操作 ID 查看本会话内仍保留的 Redis 写入状态；记录不可用不代表成功或失败。结果未知时不要自动重试，应先检查目标当前状态。',
    parameters: { id: { type: 'string', required: true } }, output,
    async execute(args, exec) {
      if (Object.keys(args).some(key => key !== 'id') || args.id.length > 36) throw new Error('Redis 操作 ID 无效。')
      const session = exec.agent?.session
      if (session === undefined) throw new Error('Redis 写入缺少有效的 DSH 对话身份。')
      exec.signal.throwIfAborted()
      const record = writer.status(session.id, args.id)
      return record === null ? { id: args.id, state: 'unavailable', note: '记录不存在或已过期，不能推断写入结果。' } : wireRecord(record)
    },
  }))
}
