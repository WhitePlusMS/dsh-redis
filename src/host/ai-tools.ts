import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { AiJson, RedisAiReader } from './ai-reader.ts'
import type { ReportKind } from './ai-report-samples.ts'

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
const reportable = ' 返回的 reportSampleId 标识本次采样；用户明确要求保存该结果时，将它传给 redis_viewer_save_diagnostic_report，不必重新查询。标识只在本会话保留最近 16 个；若未返回该字段则本次结果不可保存报告。'

/** Official registry registrations are owned and unwound by this plugin fiber. */
export function registerRedisTools(ctx: Context, reader: RedisAiReader): void {
  const diagnostic = (session: string, signal: AbortSignal, kind: ReportKind, read: () => Promise<AiJson>) => reader.withBudget(session, signal, async stage => {
    const result = await read(), prepared = reader.reportSamples.prepare(session, kind, result, signal)
    stage(prepared)
    return prepared.result
  })
  ctx.tools.register(defineTool({
    name: 'redis_viewer_status', description: '查看当前 DSH 对话已连接的 Redis、当前 DB 和侧栏选择同步状态。selectionSync 为 unavailable 时无法确认侧栏选择，currentSelection 为 null 不代表用户没有选择；仅 synchronized 时才返回当前已同步的 Key/字段/行标识。顶层 sampledAt 是本次状态时间，currentSelection.sampledAt 是该选择在 Host 的记录时间。' + connectionViewMeaning + '不会连接其他服务器。查询前先检查状态；解释当前选中值时，不传key调用redis_viewer_value。所有Redis数据操作只读。',
    parameters: {}, output,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, () => { strict(args, []); return reader.status(session) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_keys', description: '使用 SCAN 在当前对话连接的当前 DB 按明确 MATCH 检索 Key。MATCH 过滤返回的名称，并不保证 Redis 只遍历匹配前缀；完成迭代可能遍历整个当前 DB 的键空间，COUNT 100 是工作量提示而非硬上限。用户禁止扫描整个键空间时不能承诺匹配条件能避免遍历。每次调用都必须提供 match，包括续读；根据用户给出的名称线索确定范围，线索不足时请用户补充，只有用户明确要求浏览整个当前 DB 才使用 *。结果 pattern 是实际使用的条件。cursor 是不透明续读令牌，续读保持相同 match；一个 Redis 批次可分为多个结果，空页带 cursor 不等于没有匹配项。只返回本批，不冒充全库。即使 scanComplete 为 true，SCAN 也不是一致性快照，并发变化时不能断言某时刻的完整或唯一集合，跨批可能重复。',
    parameters: { match: { type: 'string', required: true }, cursor: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, stage => { strict(args, ['match', 'cursor']); return reader.scan(session, args, exec.signal, stage) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_key_metadata', description: '用户只问明确 Key 是否存在、类型或过期时间时优先使用本工具，不读取字段或值。提供 key 或 keyBase64 中恰好一个，无需侧栏选择。ttlMs 为 -1 表示采样时没有设置过期时间，不代表过去从未设置或将来不会过期；非负数为采样时剩余毫秒。sampledAt 是 UTC 的 ISO 8601 时间（Z 表示 UTC），不是本地时间。多命令采样不是原子快照，不能推断业务含义或提出未经用户请求的写入操作。',
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, () => { strict(args, ['key', 'keyBase64']); return reader.keyMetadata(session, args, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_value', description: '只读查看当前 DB 中一个 Key，自动识别 String/Hash/List/Set/ZSet/Stream。明确查询 Hash 字段时同时提供 key/keyBase64 和 field/fieldBase64；检查 Set 或 ZSet 成员时同时提供 key/keyBase64 和 member/memberBase64，工具自动识别类型并返回存在性或分数。这些精确查询无需面板选择，不能混用字段、成员、分页或范围参数。不传key/keyBase64时读取侧栏当前Key或选中字段/行；选中具体字段或行时不能传分页或范围参数，需要读取范围请明确指定 Key。需要当前对话中唯一的 Redis 面板可见且选择已同步，界面不可用或选择变化会明确报错。source 区分显式目标和侧栏选择。文本身份与各自的 Base64 身份每组只能传一个。String用offset/bytes，List/ZSet排名用offset/count；Hash/Set/ZSet扫描用match/cursor，续读保留条件；ZSet扫描不能同时传offset/count；Stream用start/end/direction/count/cursor，续读保留方向和范围，按完整消息分批。整数位置和ID用字符串。metadata.ttlMs 为 -1 表示采样时没有设置过期时间，不能据此推断过去从未设置或将来不会过期；非负数是采样时剩余毫秒。值可能只是前缀，检查complete/byteLength/fullByteLength与续读信息，不将部分数据当作完整快照。',
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' }, field: { type: 'string' }, fieldBase64: { type: 'string' }, member: { type: 'string' }, memberBase64: { type: 'string' }, cursor: { type: 'string' }, offset: { type: 'string' }, count: { type: 'integer' }, bytes: { type: 'integer' }, match: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, direction: { type: 'string' } },
    output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, stage => { strict(args, ['key', 'keyBase64', 'field', 'fieldBase64', 'member', 'memberBase64', 'cursor', 'offset', 'count', 'bytes', 'match', 'start', 'end', 'direction']); return reader.read(session, args, exec.signal, stage) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_filter_hash', description: '仅在用户明确指定当前 DB 的 Key MATCH 范围、Hash 字段和目标值时调用。MATCH 过滤候选名称，不保证 Redis 避免遍历整个当前 DB 的键空间；COUNT 是工作量提示而非硬上限。每次最多检查 10 个候选，只返回字段值与目标值按 UTF-8 字节完全相等的 Key，不返回其他值；结果包含本批各状态数量、错误及不透明 cursor。继续时保持 match、field 和 equals 不变。scanComplete 只表示扫描结束；跨批可能重复，SCAN 和逐项读取不是一致性快照。不得据部分结果声称全库统计，不跨 DB 或连接。',
    parameters: { match: { type: 'string', required: true }, field: { type: 'string', required: true }, equals: { type: 'string', required: true }, cursor: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, stage => { strict(args, ['match', 'field', 'equals', 'cursor']); return reader.filterHash(session, args, exec.signal, stage) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_memory', description: '只读估计当前对话连接、当前 DB 中一个明确 Key 的内存占用。提供 key 或 keyBase64 中恰好一个；不需要侧栏选择。使用 MEMORY USAGE 和固定 SAMPLES 5，聚合类型为采样估计而非精确总量；bytes 为十进制字符串。Key 不存在、权限不足和读取失败分别报告，不读取值、不跨库。' + reportable,
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return diagnostic(session, exec.signal, 'memory', () => { strict(args, ['key', 'keyBase64']); return reader.memoryUsage(session, args, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_compare_strings', description: '仅在用户明确给出当前 DB 的两个 String Key 并要求比较时使用。左侧 left/leftBase64 与右侧 right/rightBase64 各选一个，Base64 用于二进制 Key。每侧比较前 4096 字节，底层读取器还可能读取 3 个文本边界字节；不返回原始值。comparison 为 equal、different、undetermined 或 unavailable。长度或前缀不同可判断不同；前缀相同但有截断只能说无法判定。两次采样有各自时间，并非原子快照；不存在、类型不符、权限失败分别在两侧报告。' + reportable,
    parameters: { left: { type: 'string' }, leftBase64: { type: 'string' }, right: { type: 'string' }, rightBase64: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return diagnostic(session, exec.signal, 'compare_strings', () => { strict(args, ['left', 'leftBase64', 'right', 'rightBase64']); return reader.compareStrings(session, args, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_slowlog', description: '在用户询问慢查询时，只读取得当前连接的 Redis 服务器最近慢日志，count 范围 1 到 10，默认 10。返回记录 ID、Unix 秒、由插件计算的事件 UTC 时间 timestampUtc、执行耗时微秒和安全的命令名；timestampUtc 为 null 表示原始秒数超出日期可表示范围，sampledAt 是查询时间而非事件时间。不返回命令参数、客户端地址或名称。慢日志是服务器范围而非当前 DB，执行耗时不含网络，空结果不代表历史或当前绝无慢查询；权限不足和读取失败会明确报告。' + reportable,
    parameters: { count: { type: 'integer' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return diagnostic(session, exec.signal, 'slowlog', () => { strict(args, ['count']); return reader.slowLog(session, args.count ?? 10, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_overview', description: '按用户问题只读查看当前 Redis 服务器一个概况类别：server（版本和运行时长）、memory（内存）、clients（连接数量）、stats（命令与命中等计数）。section 必须明确为其中一种，数值保留字符串精度；只返回固定白名单字段，不返回 INFO 原文。scope 为服务器范围，缺少字段用 partial 和 missing 表示，不能以单次采样推断变化趋势或故障原因。' + reportable,
    parameters: { section: { type: 'string', required: true } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return diagnostic(session, exec.signal, 'overview', () => { strict(args, ['section']); return reader.overview(session, args.section, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_clients', description: '仅在用户询问连接明细时只读采样当前 Redis 服务器客户端。最多返回 20 个连接的 ID、连接时长、空闲秒数、DB 和标志，不返回客户端地址、名称、用户名或命令；当前服务器连接信息仍包含在 connection 中。totalCount 是收到的总数，complete 为 false 表示只展示部分。CLIENT LIST 是服务器范围且无服务端分页，会遍历所有连接；超大响应和权限不足明确报错。单次采样不能代表趋势或断言故障原因。' + reportable,
    parameters: {}, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return diagnostic(session, exec.signal, 'clients', () => { strict(args, []); return reader.clients(session, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_stream_groups', description: '用户询问 Stream 消费组或消息积压时，按明确 key 或 keyBase64 只读 XINFO GROUPS。返回每组 pending（已投递未确认）和 lag（未投递，可能未知），以及消费人数和最后投递 ID；不读取消息，不确认或推进消费。最多输出 20 个组，complete 为 false 表示只返回部分；Redis 不能服务端分页，超大响应会明确失败。采样不是一致性快照，不能单凭一次计数推断积压原因或趋势。' + reportable,
    parameters: { key: { type: 'string' }, keyBase64: { type: 'string' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return diagnostic(session, exec.signal, 'stream_groups', () => { strict(args, ['key', 'keyBase64']); return reader.streamGroups(session, args, exec.signal) }) },
  }))
  ctx.tools.register(defineTool({
    name: 'redis_viewer_select_db', description: '仅在用户明确要求切换DB时使用：切换当前对话已连接Redis的数据库，并让侧栏同步。结果的 requestedDb 是请求目标，connection 是实际状态，sampledAt 是本次状态时间。' + connectionViewMeaning + '普通查询必须沿用当前DB，不能为了搜索自行切库；不会连接其他服务器或写入Redis数据。',
    parameters: { db: { type: 'integer', required: true, description: '用户明确要求的DB编号，0到65535。' } }, output, timeoutMs: 15000,
    async execute(args, exec) { const session = owner(exec); return reader.withBudget(session, exec.signal, () => { strict(args, ['db']); return reader.selectDatabase(session, args.db, exec.signal) }) },
  }))
}
