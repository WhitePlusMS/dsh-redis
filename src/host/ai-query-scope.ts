import type { Context } from '@deepseek-ai/cordis'
import { ToolArgsError, validateArgs, type InferArgs, type ParameterSchemaSpec, type ToolExecution, type ToolExecutionToken } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-approval'
import type { DatabaseTarget } from '../domain.ts'
import { connectionViewSchema, scanKeysRequestSchema } from '../typert.shared.ts'
import type { RedisAiReader } from './ai-reader.ts'
import { MAX_AI_VALUE_BYTES } from './ai-value.ts'

export const keySearchParameters = { match: { type: 'string', required: true }, cursor: { type: 'string' } } as const satisfies ParameterSchemaSpec
export const hashFilterParameters = { ...keySearchParameters, field: { type: 'string', required: true }, equals: { type: 'string', required: true } } as const satisfies ParameterSchemaSpec

/** Use the tool's own schema before presenting arguments for confirmation. */
function parse<S extends ParameterSchemaSpec>(schema: S, value: unknown): InferArgs<S> {
  const errors = validateArgs(schema, value)
  if (errors.length > 0) throw new ToolArgsError(errors)
  const args = value as InferArgs<S>
  if (Object.keys(args).some(key => !Object.hasOwn(schema, key))) throw new Error('Redis 工具包含不支持的参数。')
  return args
}

/** Scope confirmation is part of pre-dispatch, outside the Redis read deadline.
 * Only registry-owned call tokens are admitted; existing page stores validate
 * continuations against the session, connection generation, DB and conditions.
 */
export function registerRedisQueryScope(ctx: Context, reader: RedisAiReader): (exec: ToolExecution) => void {
  const admitted = new Map<ToolExecutionToken, DatabaseTarget>()
  const lifetime = new AbortController()
  const scoped = (name: string) => name === 'redis_viewer_keys' || name === 'redis_viewer_filter_hash'
  ctx.effect(() => () => { lifetime.abort(); admitted.clear() }, 'redis query confirmations')
  ctx.on('tools/result', exec => { admitted.delete(exec.token) })
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!scoped(exec.name)) return next()
    const signal = AbortSignal.any([exec.signal, lifetime.signal])
    signal.throwIfAborted()
    const agent = exec.agent
    if (agent === undefined) return { kind: 'deny', reason: 'Redis 工具调用缺少有效的 DSH 对话身份。' }
    const filter = exec.name === 'redis_viewer_filter_hash' ? parse(hashFilterParameters, exec.arguments) : null
    const args = filter ?? parse(keySearchParameters, exec.arguments)
    const target = reader.currentTarget(agent.session.id)
    // The shared RPC schema owns MATCH length. Reject lossy or oversized filter
    // text before asking; the reader keeps its own validation at the data edge.
    scanKeysRequestSchema.parse({ target, pattern: args.match, cursor: null })
    const texts = filter === null ? [args.match] : [filter.match, filter.field, filter.equals]
    if (texts.some(value => Buffer.from(value, 'utf8').toString('utf8') !== value)) throw new Error('查询条件包含无法无损编码的字符，请修正条件。')
    if (filter !== null && (Buffer.byteLength(filter.field) > 1024 || Buffer.byteLength(filter.equals) > MAX_AI_VALUE_BYTES)) throw new Error('筛选字段或目标值超过允许的字节数。')
    const decision = await next()
    if (decision.kind === 'deny' || decision.kind === 'cancel') return decision
    signal.throwIfAborted()
    if (args.cursor === undefined) {
      const approval = ctx.get('approval')
      if (approval === undefined) return { kind: 'deny', reason: '无法确认 Redis 查询范围，请在可交互的 DSH 对话中重试。' }
      const status = reader.status(agent.session.id)
      if (status === null || typeof status !== 'object' || Array.isArray(status)) throw new Error('Redis 状态无效。')
      const address = connectionViewSchema.parse(status.connection).target
      if (!reader.isCurrentTarget(agent.session.id, target) || address === null) return { kind: 'deny', reason: 'Redis 连接或 DB 已变化，请重新确认查询范围。' }
      const endpoint = JSON.stringify(address.host) + ':' + address.port + ' / DB ' + target.db
      const conditions = JSON.stringify(filter === null ? { match: args.match } : { match: filter.match, field: filter.field, equals: filter.equals })
      const en = `Confirm Redis query scope: ${endpoint}\n${conditions}\nSCAN may traverse the entire current DB keyspace. This authorizes this query and its matching continuation pages within the existing read budget; it is not a snapshot.`
      const zh = `确认 Redis 查询范围：${endpoint}\n${conditions}\nSCAN 可能遍历当前 DB 的整个键空间。本次确认适用于该查询及条件不变的续页，仍受现有读取预算限制；结果不是快照。`
      const outcome = await approval.request({ agent, toolName: exec.name, callId: exec.callId, reason: 'Confirm Redis query scope', displayReason: { en, zh }, signal })
      if (outcome === 'cancelled') return { kind: 'cancel' }
      if (outcome !== 'allowed-once') return { kind: 'deny', reason: 'Redis 查询范围未获确认；未开始扫描。请按用户要求澄清范围，不要自动重试。' }
    }
    signal.throwIfAborted()
    if (!reader.isCurrentTarget(agent.session.id, target)) return { kind: 'deny', reason: 'Redis 连接或 DB 已变化，请重新确认查询范围。' }
    admitted.set(exec.token, target)
    // Preserve another policy's ask: this confirmation cannot override it.
    return decision
  })
  return exec => {
    exec.signal.throwIfAborted()
    const target = admitted.get(exec.token)
    // Run synchronously in the body too: an around-dispatch policy may await
    // after pre-dispatch. A replaced connection must never inherit permission.
    if (lifetime.signal.aborted || exec.agent === undefined || target === undefined || !reader.isCurrentTarget(exec.agent.session.id, target)) throw new Error('Redis 查询范围未确认或连接已变化，请重新发起查询。')
  }
}
