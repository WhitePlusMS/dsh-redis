import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { MAX_PROFILES, type ProfileCollection } from '../domain.ts'
import type { RedisAiReader } from './ai-reader.ts'
import type { RedisProfileSnapshots } from './profile-snapshots.ts'

const PAGE_SIZE = 10

/** Profile names are shared by the DSH profile; connection settings stay local. */
export function registerRedisProfileTools(ctx: Context, reader: RedisAiReader, snapshots: RedisProfileSnapshots, list: (agent: Agent, signal: AbortSignal) => Promise<ProfileCollection>): void {
  ctx.effect(() => () => { snapshots.dispose() }, 'redis profile snapshots')
  ctx.on('session/disposed', session => { snapshots.disposeSession(session.id) })
  ctx.tools.register(defineTool({
    name: 'redis_viewer_profiles',
    description: '仅在用户要求查看已有 Redis 连接资料时列出名称、分组、唯一 ID 和同一对话内有效的短期 snapshotToken。令牌有效期最多五分钟，同一资料重新列出后旧令牌失效；为 null 表示容量不足，稍后重试。每页最多 10 条，不返回连接设置中的地址、用户名、证书或凭据；名称和分组按用户保存的内容返回。不会连接 Redis。每页重新读取资料，翻页期间资料可能变化，不能把各页当作同一时刻的快照。',
    parameters: { offset: { type: 'integer', description: '从 0 开始的资料位置；续页使用上次返回的 nextOffset。' } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const agent = exec.agent
      if (agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'offset')) throw new Error('Redis 工具包含不支持的参数。')
      const offset = args.offset ?? 0
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_PROFILES) throw new Error('连接资料位置无效。')
      return reader.withBudget(agent.session.id, exec.signal, async stage => {
        const { profiles } = await list(agent, exec.signal)
        exec.signal.throwIfAborted()
        const selected = profiles.slice(offset, offset + PAGE_SIZE)
        const prepared = snapshots.prepare(agent.session.id, selected)
        let staged = false
        try {
          const page = selected.map((profile, index) => ({ id: profile.id, name: profile.name, ...(profile.group === undefined ? {} : { group: profile.group }), snapshotToken: prepared.tokens[index] ?? null }))
          const result = { profiles: page, total: profiles.length, nextOffset: offset + page.length < profiles.length ? offset + page.length : null, sampledAt: new Date().toISOString(), snapshot: false }
          stage({ result, commit: prepared.commit, rollback: prepared.rollback })
          staged = true
          return result
        } finally { if (!staged) prepared.rollback() }
      })
    },
  }))
}
