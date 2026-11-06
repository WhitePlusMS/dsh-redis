import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { UiAction } from '../domain.ts'
import type { UiActionCoordinator } from './ui-action-coordinator.ts'
import type { RedisAiReader } from './ai-reader.ts'
import { ConnectionFailure } from './connection-service.ts'
import { PREVIEW_FORMATS, type PreviewFormat } from '../domain.ts'

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
    name: 'redis_viewer_refresh', description: '仅在用户明确要求刷新当前 Redis 面板选中的 Key 时调用。刷新会从 Redis 读取当前查看范围并更新预览，不修改数据、不自动开启周期刷新；本工具结果只返回界面回执，不返回读到的值，不能据此声称没有读取值。只有对应读取结果渲染且选择重新同步后才返回 applied。disconnected 表示界面动作通道断开，不能据此判断 Redis 连接已断开；其他未确认结果也不能证明读取未发生或命令已撤回。按实际回执说明，不能推测超时或失败的根因。',
    parameters: {}, output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] }, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).length !== 0) throw new Error('Redis 工具包含不支持的参数。')
      const session = exec.agent.session.id
      return reader.withBudget(session, exec.signal, async () => {
        const prepared = await reader.prepareUiSelection(session, exec.signal).catch((error: unknown) => { if (error instanceof ConnectionFailure && error.code === 'stale') return null; throw error })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请检查面板。' }
        const outcome = await actions.dispatch(session, { kind: 'refresh', target: prepared.target, keyBase64: prepared.keyBase64 }, null, prepared.revision, prepared.current, exec.signal)
        // A UI receipt is not a Redis connection-status sample or proof that no read was sent.
        const message = outcome === 'applied'
          ? '已确认当前面板完成当前查看范围的一次 Redis 只读读取并显示结果；本工具回执不包含读到的值。'
          : `${outcome === 'disconnected' ? '界面动作通道已断开；此回执不代表 Redis 连接状态。' : ''}未能确认刷新结果；读取可能已经发出，不能断言未读取值或命令已撤回。请检查当前面板。`
        return { outcome, message }
      })
    },
  }))
}

/** A format action changes only the currently visible value preview. */
export function registerRedisFormatTool(ctx: Context, reader: RedisAiReader, actions: UiActionCoordinator<UiAction>): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_format', description: '仅在用户明确要求改变当前 Redis 面板已选中值的预览格式时调用。format 为 text、json、hex 或 base64；只改变界面，不修改 Redis 数据。只有目标预览已显示对应格式且格式化成功才返回 applied；当前没有可见值、JSON 无效或被截断、界面/选择变化时不能声称成功。',
    parameters: { format: { type: 'string', required: true } }, output: { schema: { type: 'json' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }] }, timeoutMs: 15000,
    async execute(args, exec) {
      exec.signal.throwIfAborted()
      if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
      if (Object.keys(args).some(key => key !== 'format') || !PREVIEW_FORMATS.some(value => value === args.format)) throw new Error('预览格式仅支持 text、json、hex 或 base64。')
      const session = exec.agent.session.id, format = args.format as PreviewFormat
      return reader.withBudget(session, exec.signal, async () => {
        const prepared = await reader.prepareUiSelection(session, exec.signal).catch((error: unknown) => { if (error instanceof ConnectionFailure && error.code === 'stale') return null; throw error })
        if (prepared === null) return { outcome: 'stale', message: '连接或界面选择已变化，请检查面板。' }
        const outcome = await actions.dispatch(session, { kind: 'setFormat', keyBase64: prepared.keyBase64, format }, prepared.target, prepared.revision, prepared.sameRevision, exec.signal)
        return { outcome, format, message: outcome === 'applied' ? '已确认当前值按指定格式显示。' : '未能确认指定格式显示，请检查当前面板和值。' }
      })
    },
  }))
}
