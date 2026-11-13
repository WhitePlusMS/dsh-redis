import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import type { RedisAiReader } from './ai-reader.ts'
import { MatchPresetError, type RedisMatchPresets } from './match-preset-store.ts'
import type { DatabaseTarget, UiAction } from '../domain.ts'
import type { UiActionCoordinator } from './ui-action-coordinator.ts'
import { scanKeysRequestSchema } from '../typert.shared.ts'
import { parseQueryArgs, registerQueryScope } from './ai-query-scope.ts'

const applyName = 'redis_viewer_apply_match_preset'
const applyParameters = { id: { type: 'string', required: true } } as const satisfies ParameterSchemaSpec

type PreparedPreset = { readonly outcome: 'stale' } | { readonly outcome: 'missing' } | {
  readonly outcome: 'ready'
  readonly target: DatabaseTarget
  readonly revision: number
  readonly preset: NonNullable<Awaited<ReturnType<RedisMatchPresets['get']>>>
  readonly pattern: string
}

/** The DSH profile owns these immutable names and patterns, not Redis. */
export function registerRedisMatchTools(ctx: Context, reader: RedisAiReader, presets: RedisMatchPresets, actions: UiActionCoordinator<UiAction>): void {
  const approvedPreset = registerQueryScope<PreparedPreset>(ctx, reader, name => name === applyName, async (exec, sessionId, signal) => {
    const { id } = parseQueryArgs(applyParameters, exec.arguments)
    const target = reader.currentTarget(sessionId), revision = actions.selectionRevision(sessionId)
    if (revision === null) return { target, conditions: null, data: { outcome: 'stale' as const } }
    let preset: Awaited<ReturnType<RedisMatchPresets['get']>>
    try { preset = await presets.get(id, signal) }
    catch (error) { if (error instanceof MatchPresetError && error.code === 'cancelled') throw error; throw new Error('无法读取该筛选预设，请检查本地资料。') }
    if (preset === null) return { target, conditions: null, data: { outcome: 'missing' as const } }
    const pattern = scanKeysRequestSchema.parse({ target, pattern: preset.pattern, cursor: null }).pattern
    return { target, conditions: { match: pattern, preset: preset.name }, sidebar: true, data: { outcome: 'ready' as const, target, revision, preset, pattern } }
  })
  ctx.tools.register(defineTool({
    name: 'redis_viewer_match_presets',
    description: '仅在用户明确要求查看已保存的 Redis MATCH 筛选预设时调用。返回名称、ID 和条件，每页最多 10 条；条件按用户保存原样返回，可能包含敏感文本。每页重新读取，分页不是快照；不连接 Redis。',
    parameters: { cursor: { type: 'string', description: '续页使用上次返回的 nextCursor；首次省略。' } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'cursor')) throw new Error('Redis 工具包含不支持的参数。')
      const cursor = args.cursor ?? null
      if (cursor !== null && (!/^(?:0|[1-9]\d{0,2})$/u.test(cursor) || Number(cursor) >= 256)) throw new Error('筛选预设游标无效。')
      return reader.withBudget(exec.agent.session.id, exec.signal, async () => {
        try {
          const page = await presets.list(cursor, exec.signal)
          return { ...page, presets: page.presets.map(preset => ({ ...preset })) }
        }
        catch (error) {
          if (error instanceof MatchPresetError && error.code === 'cancelled') throw error
          throw new Error('无法读取筛选预设，请检查本地资料。')
        }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: applyName,
    description: '仅在用户明确要求将唯一确定的已保存 MATCH 预设应用到当前 Redis 面板时调用。先列出预设并提供 id；范围确认通过后会清除当前 Key 选择并启动该条件的有界扫描。只有界面确认筛选已设置才返回 applied，扫描可能仍在进行或不完整；取消或回执丢失后检查面板，不能假定操作没有发生。',
    parameters: applyParameters, output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] }, timeoutMs: 15000,
    async execute(_args, exec) {
      const prepared = approvedPreset(exec)
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        if (prepared.outcome === 'stale') return { outcome: 'stale', message: '请打开唯一 Redis 面板并等待选择同步。' }
        if (prepared.outcome === 'missing') return { outcome: 'missing', message: '该筛选预设不存在。' }
        const { target, revision, preset, pattern } = prepared
        if (!reader.isCurrentTarget(session, target) || actions.selectionRevision(session) !== revision) return { outcome: 'stale', message: '连接或界面选择已变化，请检查面板。' }
        const result = await actions.dispatch(session, { kind: 'applyMatch', target, pattern }, null, revision, () => reader.isCurrentTarget(session, target), exec.signal)
        const outcome = result === 'applied' && actions.selectionRevision(session) !== revision + 1 ? 'stale' : result
        return { outcome, preset: { id: preset.id, name: preset.name, pattern }, message: outcome === 'applied' ? '已确认设置筛选并启动扫描；扫描进度和结果完整性请查看面板。' : '未能确认筛选设置，请检查当前面板。' }
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'redis_viewer_save_match_preset',
    description: '仅在用户明确要求保存筛选预设且提供名称和完整 Redis MATCH 条件时调用。保存到当前 DSH 本地 profile，不连接或修改 Redis；名称冲突不覆盖。不可猜测当前界面条件；中断后保存结果可能未知，应重新列出核对。',
    parameters: { name: { type: 'string', required: true }, pattern: { type: 'string', required: true } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'name' && key !== 'pattern')) throw new Error('Redis 工具包含不支持的参数。')
      let started = false
      try {
        return await reader.withBudget(exec.agent.session.id, exec.signal, async () => {
          started = true
          try { return { outcome: 'saved', preset: { ...await presets.save({ name: args.name, pattern: args.pattern }, exec.signal) } } }
          catch (error) {
            if (error instanceof MatchPresetError && (error.code === 'invalid' || error.code === 'conflict' || error.code === 'full')) return { outcome: error.code }
            throw error
          }
        })
      } catch (error) {
        // Once save starts, even a lost response or interrupted budget commit
        // cannot prove that the immutable filesystem link was not created.
        if (started) throw new Error('保存结果未知，请重新列出筛选预设核对后再操作。')
        throw error
      }
    },
  }))
}
