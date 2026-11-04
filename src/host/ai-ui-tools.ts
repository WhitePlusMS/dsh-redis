import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { UiAction } from '../domain.ts'
import type { UiActionCoordinator } from './ui-action-coordinator.ts'

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
