# 在DSH对话中读取Redis

接入方式为 DSH 原生插件工具，不是 Redis MCP Server；当前开放读取和明确切 DB，未开放业务数据写入。实现路径、Typert RPC 与 MCP 的区别见[源码仓库中的 AI 读取架构说明](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/AI_READ_ARCHITECTURE.md)。

## 使用顺序

1. 在目标 DSH 会话的 Redis 侧栏手动连接服务器，或明确要求 AI 连接已保存资料；需要密码时在本地表单填写。连接仅属于这个会话；保存的资料不代表已连接。
2. 在同一会话输入问题；已知 Key 名称时可直接提问，已知 Hash 字段时可同时指定 Key 和字段，无需先在面板选中。模型服务及该会话的工具策略必须可用。
3. 如果希望询问界面上看到的“当前这一项”，先在侧栏选中对应 Key 或行，再回到同一会话提问；Stream 可选择消息中的具体字段对。

可使用这些自然语言请求；它们是操作示例，不是本次真实模型验收记录：

- “当前Redis连接到了哪里，当前DB是多少？”
- “检索当前DB里符合 `order:*` 的Key，先告诉我本批结果。”
- “在 `order:*` 中查找 `status` 等于 `failed` 的 Hash，先检查一批。”
- “读取 `order:1001`，解释其中的字段。”
- “读取 `order:1001` 的 `status` 字段。”
- “检查 `active:users` 中是否包含 `user:123`。”
- “估计 `order:1001` 占用多少内存。”
- “比较两个明确的 String Key 是否相同。”
- “看看最近有哪些慢查询。”
- “看看 Redis 当前内存和连接数。”
- “查看当前客户端连接的空闲时间。”
- “查看 `events:orders` 的消费组积压情况。”
- “解释一下我在侧栏选中的当前这个值。”
- “刷新当前侧栏中选中的 Key。”
- “把当前选中值以 JSON 格式显示。”
- “把保存的订单筛选预设应用到当前 Redis 面板。”
- “采样当前 Redis 的内存概况并保存本地报告。”
- “明确切到DB1，再查询 `order:1001`。”

普通查询保持当前DB。没有连接或没有有效选择时，工具会返回对应错误，不能猜测其他服务器或旧选择。切库之后，侧栏跟随Host的实际DB；旧选择与旧自动刷新随代次失效。

## 当前选择如何解释

| 侧栏选择 | 不传Key的值工具读取 |
|---|---|
| String或仅Key | 当前Key的默认有界读取 |
| Hash字段行 | 精确字段的当前值 |
| List行 | 原始下标对应的当前元素；List可变，下标不代表不可变记录ID |
| Set成员 | 检查该原始成员仍存在后返回成员 |
| ZSet成员 | 该原始成员和当前原始分数字符串 |
| Stream字段对 | 消息ID、字段出现序号和原始字段身份对应的当前值；重复字段不合并 |

选择同步只发送标识，不发送值。状态工具的 `selectionSync` 为 `synchronized` 时，`currentSelection` 才是已同步的选择；为 `unavailable` 时返回空选择表示当前无法确认，并不代表用户没有选择。选择中的 `sampledAt` 是 Host 记录该选择的时间，不是最终同步时间。按当前选中项读取时，当前对话须有唯一可见的 Redis 面板，工具在读取前后确认选择版本；面板隐藏、多个界面或选择正在变化时会拒绝读取并提示重试。读取时重新访问 Redis，并核对会话、连接代次和读取期间的选择变化。工具提供读取时的数据，不是事务快照。显式传 Key 的查询不依赖侧栏当前选行或面板可见性。

## 基础读取工具

| 工具 | 主要参数 | 返回与限制 |
|---|---|---|
| `redis_viewer_status` | 无 | 当前公开连接视图、DB、选择同步状态和已同步选择 |
| `redis_viewer_keys` | 必填 `match`；可选 `cursor` | 当前 DB 的 SCAN 批次；根据用户线索明确范围，只有用户要求浏览整个当前 DB 才使用 `*`。`returnedCount` 为本次返回的 Key 数，不是全库总数；续读必须携带相同 MATCH，空页不一定结束 |
| `redis_viewer_value` | `key`或`keyBase64`可省略；精确 Hash 字段用`field`或`fieldBase64`，Set/ZSet 成员用`member`或`memberBase64`；按类型提供范围/游标 | 六类型结果、TTL、读取时间、完整性和续读信息；精确字段或成员需明确 Key，不能混用分页参数 |
| `redis_viewer_filter_hash` | 必填`match`、`field`、`equals`，续读用`cursor` | 每批最多检查 10 个候选；返回精确匹配的 Key 和本批各状态计数，不返回未匹配的值；续读条件必须一致 |
| `redis_viewer_memory` | 必填 `key` 或 `keyBase64` 中一个 | `MEMORY USAGE` 使用固定 5 个样本；返回字节数、时间，聚合数据是估计；区分不存在、无权限与失败 |
| `redis_viewer_compare_strings` | 左侧 `left` / `leftBase64` 和右侧 `right` / `rightBase64` 各选一个 | 比较当前 DB 两个 String 的前 4096 字节，底层可能额外读取 3 个边界字节；不返回值。只有两侧完整且相同才返回 `equal`，相同截断前缀返回 `undetermined`，两次采样不是原子快照 |
| `redis_viewer_slowlog` | 可选 `count`，范围 1–10，默认 10 | 返回服务器范围的慢日志时间、耗时和命令名，不返回命令参数及客户端信息；空列表不代表历史从无慢查询 |
| `redis_viewer_overview` | 必填 `section`：`server`、`memory`、`clients` 或 `stats` | 返回该服务器类别的固定白名单指标；数值为字符串，缺失字段用 `partial` 标明，不返回 INFO 原文 |
| `redis_viewer_clients` | 无 | 只读服务器客户端列表，最多展示 20 条 ID、连接及空闲秒数、DB 和标志；不返回客户端地址、名称、用户名或命令。当前连接视图仍包含目标服务器地址 |
| `redis_viewer_stream_groups` | 必填 `key` 或 `keyBase64` 中一个 | 只读消费组数、`pending` 与 `lag`，最多返回 20 组；`lagStatus` 区分未知和服务器未报告，`complete` 标明是否全部返回 |
| `redis_viewer_profiles` / `redis_viewer_connect_profile` | 先列出资料，再提供同一会话返回的 `id` 与 `snapshotToken` | 用户明确选择已有资料时尝试连接；资料或令牌变化会拒绝，失败保留原连接，密码须在本地表单填写 |
| `redis_viewer_disconnect` | `id` 和 `generation` 均来自当前状态 | 用户明确要求时断开当前会话；连接身份已变化则拒绝，取消或回执丢失后须查询状态 |
| `redis_viewer_refresh` | 无 | 用户明确要求时刷新当前唯一可见面板的选中 Key；只有本次读取完成渲染且同一选择重新同步后才报告 `applied`，不自动开启周期刷新。失败或回执丢失后检查面板，不能断言刷新没有发生 |
| `redis_viewer_format` | 必填 `format`：`text`、`json`、`hex` 或 `base64` | 用户明确要求时切换当前可见值预览；成功须确认对应格式已渲染。无效或不完整 JSON 返回失败，字段名预览不会随值格式动作改变 |
| `redis_viewer_match_presets` / `redis_viewer_save_match_preset` / `redis_viewer_apply_match_preset` | 列出预设；保存时提供名称和 MATCH；应用时提供已列出的 `id` | 预设存于本地 profile；仅用户明确要求时保存或应用。应用会清除当前 Key 选择、设置界面筛选并启动扫描；`applied` 不表示扫描已经完成 |
| `redis_viewer_save_diagnostic_report` | 保存时提供同一会话诊断结果中的 `reportSampleId` | 明确要求时将已有采样保存到 DSH profile 的 `data/dsh-redis/reports`，不会重新读取 Redis。支持概况、慢日志、客户端、Key 内存、String 比较及消费组；Key 和组名以 SHA-256 身份记录，慢日志报告不含命令名称或参数。不接收自由文本、路径或 Redis 值；只在会话内暂存最近 16 项，保存中断时检查目录。结果过大时可能不提供报告标识 |
| `redis_viewer_select_db` | 必填整数`db` | 同一连接的实际切库结果；仅明确要求切库时使用 |

Key、字段和成员的文本与 Base64 身份各自只能传一个；无法无损编码的文本必须改用规范 Base64 身份，MATCH 条件则须修正为有效文本。侧栏选中具体字段或行时不能传分页、范围参数；要按范围读取请明确指定 Key。指定 Hash 字段或集合成员时的 `selection-missing` 表示采样时该项不存在；Key 不存在则是 `missing`，类型不匹配或中途变化会分别给出状态。Set 返回成员存在性，ZSet 同时返回采样时的分数字符串。位置及 Stream ID 使用字符串以保持整数精度。值工具支持 String 的 `offset/bytes`、List 及 ZSet 排名的 `offset/count`、Hash/Set/ZSet 扫描的 `match/cursor`、Stream 的 `start/end/direction/count/cursor`；参数仍由各类型严格校验。

明确要求定位当前 ZSet Key 的成员时，可使用 `redis_viewer_locate_zset_member`，通过 `member` 文本或 `memberBase64` 规范二进制身份指定成员，二者只能提供一个，空成员也有效。工具以 `ZSCORE` 做定点采样；分数保留 Redis 返回的字符串，代表采样时结果。界面为确认定位会再次采样，期间分数可能变化；筛选或排名页外的临时结果不表示其排名，不改变分页游标。只有面板确认后才报告 `applied`，结果未知时应检查当前面板。

明确要求定位当前 Stream Key 的消息字段时，可使用 `redis_viewer_locate_stream_field`，提供完整消息 `id` 和从 0 开始的 `fieldIndex`。该位置指消息中所有字段对的顺序，不是同名字段的出现次数；工具保留原始字段字节并使用 `XRANGE` 按消息 ID 只读采样，不推进消费组。界面单独再次采样并核对位置与字段身份，页外消息作为临时样本显示，不改变分页游标。两次读取不是事务快照，消息可能变化；只有两张表确认显示后才报告 `applied`。

AI与UI独立持有游标，复用所属会话的同一连接；AI内部也遵循每类型一次扫描的现有所有权约束。对话单结果上限64KiB，集合值默认前4096字节，String默认4096字节。字段/成员身份不截断；超预算明确失败，不能跳过本批尾部后继续游标。`scanComplete`说明扫描结束，`complete`说明本次结果是否完整，二者不同。

范围筛选的字段和目标值按 UTF-8 原始字节精确比较，字段最多 1,024 字节、目标值最多 4,096 字节。每次调用最多检查 10 个候选，并受同一会话的连续调用预算限制；每个 Redis RESP 响应受 1 MiB 解析上限约束，但一次筛选会依次发出扫描、类型、字段和 TTL 等多个命令，因此不能把 64 KiB 模型输出上限误认为 Redis 总接收量。结果的 `counts` 仅描述本批，`sampledAt` 是扫描时间，`readStartedAt` 和 `readFinishedAt` 是本批读取时间范围。跨批可能遇到重复 Key，扫描结束也不是一致性快照；缺失、类型变化和读取失败均单独计数，不能把部分结果当作完整统计。

二进制值保留Base64和字节长度，不能当作损坏文本；UTF-8前缀不完整时文本可能为空。未读取字节、其他分页及过滤掉的字段都不应被模型当作已知。

## 只读及运行边界

工具不接收 sessionId、任意连接地址、密码或自由命令；连接仅在用户明确要求并确定已保存资料时进行。内存估计按明确 Key 单独调用，慢日志仅提供有界、去除参数的服务器记录。DB 切换只影响所属连接的逻辑 DB，不修改 Redis 业务数据。连接断开、代次变化、会话或插件释放会清理 AI 选择及游标。

消费组查询不读取或确认消息。`pending` 是已投递但尚未确认的数量，`lag` 是尚未投递的数量，后者可能不可计算；一次采样不能证明积压原因或变化趋势。Redis `XINFO GROUPS` 没有服务端分页，实际响应仍需完整接收并受 RESP 限额约束，超限会明确失败。

客户端列表同样没有服务端分页，Redis 需遍历连接并返回完整响应，受 RESP 大小限制；`complete: false` 表示只展示前 20 条，权限不足和超限不是空列表。

实现以当前项目锁定的 DSH 工具契约为准；[rc.2 历史契约](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/cookbook/adding-a-tool.md)仅对应旧版本。实际检查、模型服务故障与日常安装状态见[源码仓库中的实施记录](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/AI_READ_IMPLEMENTATION.md)；自动化或脚本模型通过不等于真实模型自然语言验收通过。

2026-10-19曾完成[真实模型与真实数据联调](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/verification/ai-read-real-data-2026-10-19.md)：真实 Hash 检索/读取、当前选中字段、明确切库与侧栏同步、跨会话隔离通过。该记录只适用于当时构建；实际库只有 Hash，其他五类不标为真实数据验证通过。
