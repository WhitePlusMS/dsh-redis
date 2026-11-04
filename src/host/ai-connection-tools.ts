import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { SavedConnection } from '../domain.ts'
import type { RedisAiReader } from './ai-reader.ts'
import type { CandidateConnectionResult } from './connection-service.ts'
import type { RedisProfileSnapshots } from './profile-snapshots.ts'

/** A model can refer only to a recently listed, unchanged local connection profile. */
export function registerRedisConnectionTools(ctx: Context, reader: RedisAiReader, snapshots: RedisProfileSnapshots, connect: (agent: Agent, profile: SavedConnection, signal: AbortSignal, isCurrent: () => boolean) => Promise<CandidateConnectionResult>): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_connect_profile',
    description: '仅在用户明确要求连接或切换到某个已保存 Redis 资料，且名称已唯一确定时使用。先调用 redis_viewer_profiles，传入同一会话最近列出的 id 和 snapshotToken；资料变化、令牌过期或会话不匹配会拒绝。不会接收地址、密码或凭据；若需要密码，请用户在 Redis 本地连接表单填写。失败保留旧连接；成功从 DB 0 开始。取消或回执丢失后连接结果可能未知，先查看状态，不盲目重试。',
    parameters: { id: { type: 'string', required: true }, snapshotToken: { type: 'string', required: true } },
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] }, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      const agent = exec.agent
      if (agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'id' && key !== 'snapshotToken')) throw new Error('Redis 工具包含不支持的参数。')
      if (args.id.length === 0 || args.id.length > 128 || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/u.test(args.snapshotToken)) throw new Error('连接资料或令牌无效，请重新列出。')
      return reader.withBudget(agent.session.id, exec.signal, async () => {
        const profile = snapshots.resolve(agent.session.id, args.id, args.snapshotToken)
        if (profile === undefined) throw new Error('连接资料令牌已失效或不属于当前对话，请重新列出。')
        const isCurrent = () => JSON.stringify(snapshots.resolve(agent.session.id, args.id, args.snapshotToken)) === JSON.stringify(profile)
        const result = await connect(agent, profile, exec.signal, isCurrent)
        const view = result.state === 'failed' ? null : result.view
        return { state: result.state, error: result.state === 'failed' ? result.error : view?.error ?? null, previousRelease: result.state === 'failed' ? null : result.previousRelease, connection: view === null ? null : { id: view.id, generation: view.generation, db: view.db, state: view.state }, message: result.state === 'failed' && result.error === 'auth' ? '需要认证，请在 Redis 本地连接表单输入凭据。' : result.state === 'failed' && result.error === 'stale' ? '连接资料或当前目标已变化，请查看状态并重新选择。' : result.state === 'changed' ? '连接交换后状态已变化，请查看当前状态。' : null, sampledAt: new Date().toISOString() }
      })
    },
  }))
}
