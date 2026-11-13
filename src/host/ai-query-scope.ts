import type { Context } from '@deepseek-ai/cordis'
import { ToolArgsError, validateArgs, type InferArgs, type ParameterSchemaSpec, type ToolExecution, type ToolExecutionToken } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-user-approval'
import type { DatabaseTarget } from '../domain.ts'
import { scanKeysRequestSchema } from '../typert.shared.ts'
import type { RedisAiReader } from './ai-reader.ts'
import { MAX_AI_VALUE_BYTES } from './ai-value.ts'

export const keySearchParameters = { match: { type: 'string', required: true }, cursor: { type: 'string' } } as const satisfies ParameterSchemaSpec
export const hashFilterParameters = { ...keySearchParameters, field: { type: 'string', required: true }, equals: { type: 'string', required: true } } as const satisfies ParameterSchemaSpec

/** Use the tool's own schema before presenting arguments for confirmation. */
export function parseQueryArgs<S extends ParameterSchemaSpec>(schema: S, value: unknown): InferArgs<S> {
  const errors = validateArgs(schema, value)
  if (errors.length > 0) throw new ToolArgsError(errors)
  const args = value as InferArgs<S>
  if (Object.keys(args).some(key => !Object.hasOwn(schema, key))) throw new Error('Redis 工具包含不支持的参数。')
  return args
}

interface QueryScope<T> {
  readonly target: DatabaseTarget
  readonly conditions: Readonly<Record<string, string>> | null
  readonly data: T
  readonly sidebar?: true
}

/** DSH owns policy and presentation; the plugin binds consent to this call and DB. */
export function registerQueryScope<T>(ctx: Context, reader: RedisAiReader, owns: (name: string) => boolean, prepare: (exec: ToolExecution, sessionId: string, signal: AbortSignal) => QueryScope<T> | Promise<QueryScope<T>>) {
  const admitted = new Map<ToolExecutionToken, QueryScope<T>>()
  const lifetime = new AbortController()
  ctx.effect(() => () => { lifetime.abort(); admitted.clear() }, 'redis query confirmations')
  ctx.on('tools/result', exec => { admitted.delete(exec.token) })
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!owns(exec.name)) return next()
    const signal = AbortSignal.any([exec.signal, lifetime.signal])
    signal.throwIfAborted()
    const agent = exec.agent
    if (agent === undefined) return { kind: 'deny', reason: 'Redis 工具调用缺少有效的 DSH 对话身份。' }
    const before = reader.currentTarget(agent.session.id)
    const decision = await next()
    if (decision.kind === 'deny' || decision.kind === 'cancel') return decision
    signal.throwIfAborted()
    if (!reader.isCurrentTarget(agent.session.id, before)) return { kind: 'deny', reason: 'Redis 连接或 DB 已变化，请重新确认查询范围。' }
    const scope = await prepare(exec, agent.session.id, signal)
    const { target } = scope
    if (target.id !== before.id || target.generation !== before.generation || target.db !== before.db) return { kind: 'deny', reason: 'Redis 连接或 DB 已变化，请重新确认查询范围。' }
    let gate = decision
    if (scope.conditions !== null) {
      const approval = ctx.get('approval')
      if (approval === undefined) return { kind: 'deny', reason: '无法确认 Redis 查询范围，请在可交互的 DSH 对话中重试。' }
      const address = reader.connectionSnapshot(agent.session.id).target
      if (!reader.isCurrentTarget(agent.session.id, target) || address === null) return { kind: 'deny', reason: 'Redis 连接或 DB 已变化，请重新确认查询范围。' }
      const endpoint = JSON.stringify(address.host) + ':' + address.port + ' / DB ' + target.db
      const conditions = JSON.stringify(scope.conditions)
      const en = scope.sidebar ? `Confirm Redis sidebar query scope: ${endpoint}\n${conditions}\nApplying this preset starts a sidebar SCAN that may traverse the entire current DB keyspace.` : `Confirm Redis query scope: ${endpoint}\n${conditions}\nSCAN may traverse the entire current DB keyspace. This authorizes this query and its matching continuation pages within the existing read budget; it is not a snapshot.`
      const zh = scope.sidebar ? `确认 Redis 侧栏查询范围：${endpoint}\n${conditions}\n应用该预设会启动侧栏 SCAN，可能遍历当前 DB 的整个键空间。` : `确认 Redis 查询范围：${endpoint}\n${conditions}\nSCAN 可能遍历当前 DB 的整个键空间。本次确认适用于该查询及条件不变的续页，仍受现有读取预算限制；结果不是快照。`
      const previous = decision.kind === 'ask' ? decision.displayReason : undefined
      const fallback = decision.kind === 'ask' ? previous?.en ?? decision.reason : undefined
      const include = (policy: string | undefined, scope: string) => policy === undefined ? scope : policy + '\n\n' + scope
      const displayReason = {
        ...Object.fromEntries(Object.entries(previous ?? {}).map(([locale, policy]) => [locale, include(policy, en)])),
        en: include(fallback, en), zh: include(previous?.zh ?? fallback, zh),
      }
      if (decision.kind === 'ask') {
        // Let DSH resolve the final Host decision after all policy wrappers.
        gate = { ...decision, displayReason }
      } else {
        const outcome = await approval.request({ agent, toolName: exec.name, callId: exec.callId, reason: 'Confirm Redis query scope', displayReason, signal })
        if (outcome === 'cancelled') return { kind: 'cancel' }
        if (outcome === 'rejected') return { kind: 'deny', reason: 'Redis 查询已被拒绝；未开始扫描。停止本次查询；仅在用户主动重新发起查询时再处理，不要重复请求确认或换工具绕过。' }
        if (outcome !== 'allowed-once') return { kind: 'deny', reason: 'Redis 查询确认服务不可用；未开始扫描。请检查 DSH 的交互确认通道，不要自动重试或改用其他工具。' }
      }
    }
    signal.throwIfAborted()
    if (!reader.isCurrentTarget(agent.session.id, target)) return { kind: 'deny', reason: 'Redis 连接或 DB 已变化，请重新确认查询范围。' }
    admitted.set(exec.token, scope)
    return gate
  })
  return (exec: ToolExecution): T => {
    exec.signal.throwIfAborted()
    const scope = admitted.get(exec.token)
    // Run synchronously in the body too: an around-dispatch policy may await
    // after pre-dispatch. A replaced connection must never inherit permission.
    if (lifetime.signal.aborted || exec.agent === undefined || scope === undefined || !reader.isCurrentTarget(exec.agent.session.id, scope.target)) throw new Error('Redis 查询范围未确认或连接已变化，请重新发起查询。')
    return scope.data
  }
}

export function registerRedisQueryScope(ctx: Context, reader: RedisAiReader): (exec: ToolExecution) => void {
  return registerQueryScope(ctx, reader, name => name === 'redis_viewer_keys' || name === 'redis_viewer_filter_hash', (exec, sessionId) => {
    const filter = exec.name === 'redis_viewer_filter_hash' ? parseQueryArgs(hashFilterParameters, exec.arguments) : null
    const args = filter ?? parseQueryArgs(keySearchParameters, exec.arguments)
    const target = reader.currentTarget(sessionId)
    scanKeysRequestSchema.parse({ target, pattern: args.match, cursor: null })
    const texts = filter === null ? [args.match] : [filter.match, filter.field, filter.equals]
    if (texts.some(value => Buffer.from(value, 'utf8').toString('utf8') !== value)) throw new Error('查询条件包含无法无损编码的字符，请修正条件。')
    if (filter !== null && (Buffer.byteLength(filter.field) > 1024 || Buffer.byteLength(filter.equals) > MAX_AI_VALUE_BYTES)) throw new Error('筛选字段或目标值超过允许的字节数。')
    const conditions: Record<string, string> | null = args.cursor !== undefined ? null : filter === null ? { match: args.match } : { match: filter.match, field: filter.field, equals: filter.equals }
    return { target, conditions, data: undefined }
  })
}
