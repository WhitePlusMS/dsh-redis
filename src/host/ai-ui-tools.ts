import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { UiAction } from '../domain.ts'
import type { UiActionCoordinator } from './ui-action-coordinator.ts'
import type { RedisAiReader } from './ai-reader.ts'
import { ConnectionFailure } from './connection-service.ts'

/** The session comes from DSH, never from model arguments. */
export function registerRedisUiTools(ctx: Context, actions: UiActionCoordinator<UiAction>): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_show',
    description: '仅在用户要求显示 Redis 面板时调用：请求在当前对话打开 Redis 侧栏；只有界面确认可见后才返回 applied。没有可用客户端或无法确认时，请用户手动打开。',
    parameters: {},
    output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] },
    timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).length !== 0) throw new Error('Redis 工具包含不支持的参数。')
      const outcome = await actions.dispatch(exec.agent.session.id, { kind: 'show' }, null, 0, () => true, exec.signal)
      return { outcome, message: outcome === 'applied' ? '当前对话的 Redis 面板已确认可见。' : outcome === 'no_receiver' ? '请在当前对话手动打开 Redis 侧栏后重试。' : outcome === 'ambiguous' ? '当前对话有多个可接收的界面，请只保留一个后重试。' : '无法确认 Redis 面板可见，请检查当前侧栏后重试。' }
    },
  }))
}

/** Refresh a confirmed current selection once; never enable periodic refresh. */
export function registerRedisRefreshTool(ctx: Context, reader: RedisAiReader, actions: UiActionCoordinator<UiAction>): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_refresh', description: '仅在用户明确要求刷新当前 Redis 面板选中的 Key 时调用。只发起一次当前查看范围的只读刷新，不开启自动刷新；只有对应读取结果渲染且选择重新同步后才返回 applied。连接或选择变化、隐藏、失败、取消和回执丢失时检查界面，不能假定刷新没有发生。',
    parameters: {}, output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] }, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).length !== 0) throw new Error('Redis 工具包含不支持的参数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const prepared = await reader.prepareRefresh(session, exec.signal).catch((error: unknown) => { if (error instanceof ConnectionFailure && error.code === 'stale') return null; throw error })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请检查面板。' }
        const outcome = await actions.dispatch(session, { kind: 'refresh', target: prepared.target, keyBase64: prepared.keyBase64 }, null, prepared.revision, prepared.current, exec.signal)
        return { outcome, message: outcome === 'applied' ? '已确认当前面板完成一次只读刷新。' : '未能确认刷新结果，请检查当前面板。' }
      })
    },
  }))
}
