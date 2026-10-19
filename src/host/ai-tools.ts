import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { RedisAiReader } from './ai-reader.ts'

/** Identity is supplied by DSH execution, never accepted as model arguments. */
function owner(exec: ToolRunContext): string {
  exec.signal.throwIfAborted()
  if (exec.agent === undefined) throw new Error('Redis 工具调用缺少有效的 DSH 对话身份。')
  return exec.agent.session.id
}
function strict(args: object, allowed: readonly string[]): void {
  if (Object.keys(args).some(key => !allowed.includes(key))) throw new Error('Redis 工具包含不支持的参数。')
}
const output = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }] }

/** Official registry registrations are owned and unwound by this plugin fiber. */
export function registerRedisTools(ctx: Context, reader: RedisAiReader): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_status', description: '查看当前 DSH 对话已手动连接的 Redis 和当前 DB。不会连接其他服务器。查询前先检查状态；所有 Redis 数据操作只读。',
    parameters: {}, output,
    async execute(args, exec) { strict(args, []); return reader.status(owner(exec)) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_keys', description: '使用 SCAN 在当前对话连接的当前 DB 按 MATCH 检索 Key。cursor 是不透明续读令牌，续读保持相同 match；空页带 cursor 不等于没有匹配项。只返回本批，不冒充全库。',
    parameters: { match: { type: 'string' }, cursor: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { strict(args, ['match', 'cursor']); return reader.scan(owner(exec), args, exec.signal) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_value', description: '只读查看当前 DB 中一个 Key，自动识别 String/Hash/List/Set/ZSet/Stream。key 是文本名，二进制 Key 用 keyBase64，两者只传一个。String 用 offset/bytes，List/ZSet 排名用 offset/count；Hash/Set/ZSet 扫描用 match/cursor，续读保留条件；Stream 用 start/end/direction/count/cursor。整数位置和 ID 用字符串。值可能只是前缀，检查 complete/byteLength/fullByteLength 与续读信息，不将部分数据当作完整快照。',
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' }, cursor: { type: 'string' }, offset: { type: 'string' }, count: { type: 'integer' }, bytes: { type: 'integer' }, match: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, direction: { type: 'string' } },
    output, timeoutMs: 15000,
    async execute(args, exec) { strict(args, ['key', 'keyBase64', 'cursor', 'offset', 'count', 'bytes', 'match', 'start', 'end', 'direction']); return reader.read(owner(exec), args, exec.signal) },
  }))
}
