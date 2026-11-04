import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { RedisAiReader } from './ai-reader.ts'
import { MatchPresetError, type RedisMatchPresets } from './match-preset-store.ts'

/** The DSH profile owns these immutable names and patterns, not Redis. */
export function registerRedisMatchTools(ctx: Context, reader: RedisAiReader, presets: RedisMatchPresets): void {
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
