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
const connectionViewMeaning = 'connection.generation 是插件连接与 DB 视图的版本，切换 DB 时可能递增；不能仅凭版本变化推断物理连接重建或 Redis 服务器重启。'

/** Official registry registrations are owned and unwound by this plugin fiber. */
export function registerRedisTools(ctx: Context, reader: RedisAiReader): void {
  ctx.tools.register(defineTool({
    name: 'redis_viewer_status', description: '查看当前 DSH 对话已连接的 Redis、当前 DB 和侧栏选择同步状态。selectionSync 为 unavailable 时无法确认侧栏选择，currentSelection 为 null 不代表用户没有选择；仅 synchronized 时才返回当前已同步的 Key/字段/行标识。顶层 sampledAt 是本次状态时间，currentSelection.sampledAt 是该选择在 Host 的记录时间。' + connectionViewMeaning + '不会连接其他服务器。查询前先检查状态；解释当前选中值时，不传key调用redis_viewer_value。所有Redis数据操作只读。',
    parameters: {}, output,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, () => { strict(args, []); return reader.status(session) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_keys', description: '使用 SCAN 在当前对话连接的当前 DB 按 MATCH 检索 Key，结果 pattern 是实际使用的条件。cursor 是不透明续读令牌，续读保持相同 match；一个 Redis 批次可分为多个结果，空页带 cursor 不等于没有匹配项。只返回本批，不冒充全库。',
    parameters: { match: { type: 'string' }, cursor: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, stage => { strict(args, ['match', 'cursor']); return reader.scan(session, args, exec.signal, stage) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_value', description: '只读查看当前 DB 中一个 Key，自动识别 String/Hash/List/Set/ZSet/Stream。不传key/keyBase64时读取侧栏当前Key或选中字段/行；需要当前对话中唯一的 Redis 面板可见且选择已同步，界面不可用或选择变化会明确报错。source 区分显式目标和侧栏选择。key是文本名，二进制Key用keyBase64，两者只传一个。String用offset/bytes，List/ZSet排名用offset/count；Hash/Set/ZSet扫描用match/cursor，续读保留条件；ZSet扫描不能同时传offset/count；Stream用start/end/direction/count/cursor，续读保留方向和范围，按完整消息分批。整数位置和ID用字符串。值可能只是前缀，检查complete/byteLength/fullByteLength与续读信息，不将部分数据当作完整快照。',
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' }, cursor: { type: 'string' }, offset: { type: 'string' }, count: { type: 'integer' }, bytes: { type: 'integer' }, match: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, direction: { type: 'string' } },
    output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, stage => { strict(args, ['key', 'keyBase64', 'cursor', 'offset', 'count', 'bytes', 'match', 'start', 'end', 'direction']); return reader.read(session, args, exec.signal, stage) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_select_db', description: '仅在用户明确要求切换DB时使用：切换当前对话已连接Redis的数据库，并让侧栏同步。结果的 requestedDb 是请求目标，connection 是实际状态，sampledAt 是本次状态时间。' + connectionViewMeaning + '普通查询必须沿用当前DB，不能为了搜索自行切库；不会连接其他服务器或写入Redis数据。',
    parameters: { db: { type: 'integer', required: true, description: '用户明确要求的DB编号，0到65535。' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, () => { strict(args, ['db']); return reader.selectDatabase(session, args.db, exec.signal) }) },
  }))
}
