# 在DSH对话中读取Redis

本说明适用于当前 `0.1.2` 版本及 DSH `0.2.2-rc.1`，不表示旧版 `v0.1.0` Release 已包含这些能力。接入方式为 DSH 原生插件工具，不是 Redis MCP Server；本文主要说明读取、连接/切库、界面动作及本地资料保存。默认关闭的 AI 写入功能及边界见 [README](../README.zh.md#数据与边界)。实现路径、Typert RPC 与 MCP 的区别见[源码仓库中的 AI 读取架构说明](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/AI_READ_ARCHITECTURE.md)。

写入使用 `redis_viewer_prepare_write` 生成完整提案、`redis_viewer_execute_write` 按 DSH 权限执行、`redis_viewer_write_status` 查询当前会话的临时操作记录。须先在侧栏插件信息中开启 AI 写入。当前支持已有 String 或已有 Hash 字段的完整值替换。完整提案会出现在准备工具结果和执行工具入参中，DSH 会话历史可以保留其中的 Key、可选字段、原值和新值的 Base64。

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
- “查看 `flags:today` 从第 6 位开始的 8 个 Bitmap 位。”
- “读取 RedisJSON Key `order:1001` 的 `$.status` 路径。”
- “查看时间序列 `sensor:temperature` 在指定起止毫秒时间戳之间的样本。”
- “查看地理索引 `places` 中 `station-a` 的坐标。”
- “查询地理索引 `places` 中 `station-a` 到 `station-b` 的距离，单位千米。”
- “解释一下我在侧栏选中的当前这个值。”
- “刷新当前侧栏中选中的 Key。”
- “把当前选中值以 JSON 格式显示。”
- “把保存的订单筛选预设应用到当前 Redis 面板。”
- “采样当前 Redis 的内存概况并保存本地报告。”
- “明确切到DB1，再查询 `order:1001`。”

普通查询保持当前DB。没有连接或没有有效选择时，工具会返回对应错误，不能猜测其他服务器或旧选择。切库之后，侧栏跟随Host的实际DB；旧选择与旧自动刷新随代次失效。

名称搜索和 Hash 条件筛选首次执行前会显示 DSH 原生范围确认，列出服务器、DB、MATCH 及筛选条件。AI 应用已保存的 MATCH 预设时也会先确认，显示预设和实际 MATCH。若宿主策略也要求询问，同一条提示会显示宿主理由。接受后可在现有读取预算内续读同一查询；条件改变、重新发起首批查询或连接变化时须重新确认。拒绝、取消或缺少可用确认界面时不开始扫描。确认不占 Redis 查询超时；等待期间切库或重连会使原请求失效。已知 Key 的直接读取无需这项扫描确认。

拒绝后停止本次查询，不自动重复提问或换工具绕过；“确认服务不可用”应检查 DSH 交互通道，不能当成已获同意。普通读取仍受 DSH 会话工具策略限制。

## 核对结果与继续读取

展开本轮的工具调用，可以查看“Redis 读取记录”。状态、基础读取、筛选、专业数据及诊断记录直接展示工具返回的连接/DB、实际值或样本、采样时间和完整性；“原始结果”保留完整工具 JSON，连接 ID 和代次放在“连接详情”。记录属于那次调用，打开它不会重新读取 Redis。连接与界面动作等其他工具保留 DSH 的原始调用结果。

必要的查找、读取及其他请求完成后，模型可无参数调用一次 `redis_viewer_answer`。Host 自动汇总本轮当前连接和 DB 的已完成记录，直接在聊天正文展示中文事实、原值与范围说明；随后模型继续用自然语言回答用户的具体问题，不会因卡片生成而提前结束回合。普通读取仍可继续分页、读字段或比较。仅打开、定位、刷新或切换格式的回合也可以汇总实际界面回执，不额外读取值，不把动作回执当成数据采样。卡片不接受模型填写数值、结论或内部调用 ID，旧轮次和旧连接记录不参与。原值过大时保留全部摘要，原值仍在各读取卡片中，卡片明确提示该情况。

同一筛选的连续页按实际游标关联，最终答案累计各分类的检查次数，并按完整 Key 身份去重已返回的匹配名称；重新发起的查询分别汇总。缺少起始页时只说明已记录批次，不称完整迭代。累计次数可能含重复检查，去重结果也不是一致性快照。

插件负责工具可调用、返回数据及必要范围信息准确、结果正确交给模型，并如实显示原生卡片。模型收到结果后的解释、推断、措辞和输出格式不属于插件验收条件；卡片不校验自由文本。若工具本身返回错误数据、遗漏必要元信息或没有把结果交给模型，仍属于需要排查的插件问题。缺失与空值、被拒绝与确认不可用、未读取与截断分别显示；TTL 不能证明历史原因。后续请求仍受原有权限、范围和预算约束。

读取额度按会话累计：经预算入口的工具每个周期最多准入 32 次，累计 JSON 最多 1 MiB，单次最多 64 KiB；预留不足时会提前停止准入。它不会随新消息、切库或重连自动重置。耗尽时打开 Redis 侧栏右上角“插件信息”，如仍有请求结束中先刷新状态，再点“继续读取”。这只恢复额度，不重新执行旧请求，也不扩大已确认的查询条件；续读仍须使用有效游标。

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
| `redis_viewer_answer` | 无 | 根据本轮当前连接/DB 的实际读取记录与界面回执生成证据卡片；不新读 Redis，不结束本轮，模型随后继续回答具体问题 |
| `redis_viewer_keys` | 必填 `match`；可选 `cursor` | 当前 DB 的 SCAN 批次；根据用户线索明确范围，只有用户要求浏览整个当前 DB 才使用 `*`。`returnedCount` 为本次返回的 Key 数，不是全库总数；续读必须携带相同 MATCH，空页不一定结束 |
| `redis_viewer_key_metadata` | 必填 `key` 或 `keyBase64` 中一个 | 只读明确 Key 的类型及 TTL，不读取值；采样时间为 UTC，`ttlMs = -1` 只表示采样时无过期时间 |
| `redis_viewer_value` | `key`或`keyBase64`可省略；精确 Hash 字段用`field`或`fieldBase64`，Set/ZSet 成员用`member`或`memberBase64`；按类型提供范围/游标 | 六类型结果、TTL、读取时间、完整性和续读信息；精确字段或成员需明确 Key，不能混用分页参数 |
| `redis_viewer_filter_hash` | 必填`match`、`field`、`equals`，续读用`cursor` | 每批最多检查 10 个候选；返回精确匹配的 Key 和本批各状态计数，不返回未匹配的值；续读条件必须一致 |
| `redis_viewer_memory` | 必填 `key` 或 `keyBase64` 中一个 | `MEMORY USAGE` 请求 `SAMPLES 5`；实际采样数和误差未知，返回单 Key 字节数与时间。估算包含该 Key 及值的分配和管理开销，可能包含内部碎片；区分不存在、命令不可用、无权限与失败 |
| `redis_viewer_compare_strings` | 左侧 `left` / `leftBase64` 和右侧 `right` / `rightBase64` 各选一个 | 比较当前 DB 两个 String 的前 4096 字节，不返回值。只有两侧完整且相同才返回 `equal`，相同截断前缀返回 `undetermined`，两次采样不是原子快照 |
| `redis_viewer_slowlog` | 可选 `count`，范围 1–10，默认 10 | 返回服务器范围的慢日志原始 Unix 秒、事件 UTC 时间、耗时和命令名；超出日期范围时 UTC 时间为 `null`，原始秒数仍保留。不返回命令参数及客户端信息；空列表不代表历史从无慢查询 |
| `redis_viewer_overview` | 必填 `section`：`server`、`memory`、`clients` 或 `stats` | 返回该服务器类别的固定白名单指标；数值为字符串，缺失字段用 `partial` 标明，不返回 INFO 原文 |
| `redis_viewer_clients` | 无 | 只读服务器客户端列表，最多展示 20 条 ID、连接及空闲秒数、DB 和标志；不返回客户端地址、名称、用户名或命令。当前连接视图仍包含目标服务器地址 |
| `redis_viewer_stream_groups` | 必填 `key` 或 `keyBase64` 中一个 | 只读消费组数、`pending` 与 `lag`，最多返回 20 组；`lagStatus` 区分未知和服务器未报告，`complete` 标明是否全部返回 |
| `redis_viewer_bitmap` | 必填 `key` 或 `keyBase64`、从零开始的位 `offset` 和位数 `count` | 最多读取 1024 位，只返回请求的位；超出 String 长度的位为零，缺失 Key 与读取失败单独报告 |
| `redis_viewer_json_path` | 必填 `key` 或 `keyBase64`、以 `$` 开头的 `path` | 一个明确的 RedisJSON 路径；`matchesJson` 保留 Redis 返回的 JSON 数组原文，`[]` 是无匹配，`[null]` 是匹配到 null。模块缺失、类型不符、权限和路径错误分别报告 |
| `redis_viewer_timeseries` | 必填 `key` 或 `keyBase64`、十进制 Unix 毫秒 `from` / `to`；可选 `count`（1–100）和 `cursor` | 单个 TimeSeries Key 的有界样本；时间范围包含两端，值保留 Redis 文本。仅 `state: value` 且 `cursor` 非空时可续读，并保持 Key、起止时间和数量不变；失败没有续读游标，批次之间不是快照 |
| `redis_viewer_geo` | 必填 `key` / `keyBase64` 和 `member` / `memberBase64`；距离查询另给 `other` / `otherBase64`，可选 `unit` | 精确读取一个成员的坐标，或两个成员的距离；距离单位为 `m`、`km`、`ft`、`mi`，默认米。ZSet 类型不能证明它是地理索引，坐标和距离存在 Redis 的编码及球形地球近似误差 |
| `redis_viewer_profiles` / `redis_viewer_connect_profile` | 先列出资料，再提供同一会话返回的 `id` 与 `snapshotToken` | 用户明确选择已有资料时尝试连接；资料或令牌变化会拒绝，失败保留原连接，密码须在本地表单填写 |
| `redis_viewer_disconnect` | `id` 和 `generation` 均来自当前状态 | 用户明确要求时断开当前会话；连接身份已变化则拒绝，取消或回执丢失后须查询状态 |
| `redis_viewer_show` | 无 | 明确要求时打开本对话的 Redis 面板，只有界面确认可见才返回 `applied`；不建立 Redis 连接 |
| `redis_viewer_locate_key` | `key` 或 `keyBase64` 中一个 | 在当前连接及唯一可见面板中定位明确 Key；工具以 TYPE 定点检查，界面选中后会加载内容，不能把定位等同于整个插件不读值 |
| `redis_viewer_locate_hash_field` | `field` 或 `fieldBase64` 中一个 | 定位当前已选 Hash 的字段，通过 HGET 采样并等待界面确认，不跨 Key |
| `redis_viewer_locate_list_index` | 非负十进制字符串 `index` | 定位当前已选 List 的位置；并发插入/删除可能改变该位置对应的元素 |
| `redis_viewer_locate_set_member` | `member` 或 `memberBase64` 中一个 | 定位当前已选 Set 的成员，通过 SISMEMBER 定点采样并等待界面确认，不扫描成员 |
| `redis_viewer_refresh` | 无 | 用户明确要求时读取当前唯一可见面板选中 Key 的当前查看范围并更新预览；只有本次读取完成渲染且同一选择重新同步后才报告 `applied`，不自动开启周期刷新。工具回执不返回读到的值，不等于没有读取值。`disconnected` 指界面动作通道，不能据此判断 Redis 连接状态；失败或回执丢失不能证明读取未发生或命令已撤回 |
| `redis_viewer_format` | 必填 `format`：`text`、`json`、`hex` 或 `base64` | 用户明确要求时切换当前可见值预览；成功须确认对应格式已渲染。无效或不完整 JSON 返回失败，字段名预览不会随值格式动作改变 |
| `redis_viewer_match_presets` / `redis_viewer_save_match_preset` / `redis_viewer_apply_match_preset` | 列出预设；保存时提供名称和 MATCH；应用时提供已列出的 `id` | 预设存于本地 profile，仅用户明确要求时保存或应用。通过范围确认后，应用会清除当前 Key 选择、设置界面筛选并启动扫描。`applied` 表示侧栏确认已应用，扫描进度以面板为准 |
| `redis_viewer_save_diagnostic_report` | 保存时提供同一会话诊断结果中的 `reportSampleId` | 明确要求时将已有采样保存到 DSH profile 的 `data/dsh-redis/reports`，不会重新读取 Redis。支持概况、慢日志、客户端、Key 内存、String 比较及消费组；Key 和组名以 SHA-256 身份记录，慢日志报告不含命令名称或参数。不接收自由文本、路径或 Redis 值；只在会话内暂存最近 16 项，保存中断时检查目录。结果过大时可能不提供报告标识 |
| `redis_viewer_select_db` | 必填整数`db` | 同一连接的实际切库结果；仅明确要求切库时使用 |

Key、字段和成员的文本与 Base64 身份各自只能传一个；无法无损编码的文本必须改用规范 Base64 身份，MATCH 条件则须修正为有效文本。侧栏选中具体字段或行时不能传分页、范围参数；要按范围读取请明确指定 Key。指定 Hash 字段或集合成员时的 `selection-missing` 表示采样时该项不存在；Key 不存在则是 `missing`，类型不匹配或中途变化会分别给出状态。Set 返回成员存在性，ZSet 同时返回采样时的分数字符串。位置及 Stream ID 使用字符串以保持整数精度。值工具支持 String 的 `offset/bytes`、List 及 ZSet 排名的 `offset/count`、Hash/Set/ZSet 扫描的 `match/cursor`、Stream 的 `start/end/direction/count/cursor`；不适用于实际类型的参数会明确拒绝，续读也遵循相同规则。

Hash 字段、Set/ZSet 成员和 List 页或选中行的 `sampledAt` 对应相应值或成员读取的响应时间；同一结果中的类型、长度和 TTL 可能在其他时刻检查，不是同一时刻的事务快照。

明确要求定位当前 ZSet Key 的成员时，可使用 `redis_viewer_locate_zset_member`，通过 `member` 文本或 `memberBase64` 规范二进制身份指定成员，二者只能提供一个，空成员也有效。工具以 `ZSCORE` 做定点采样；分数保留 Redis 返回的字符串，代表采样时结果。界面为确认定位会再次采样，期间分数可能变化；筛选或排名页外的临时结果不表示其排名，不改变分页游标。只有面板确认后才报告 `applied`，结果未知时应检查当前面板。

明确要求定位当前 Stream Key 的消息字段时，可使用 `redis_viewer_locate_stream_field`，提供完整消息 `id` 和从 0 开始的 `fieldIndex`。该位置指消息中所有字段对的顺序，不是同名字段的出现次数；工具保留原始字段字节并使用 `XRANGE` 按消息 ID 只读采样，不推进消费组。界面单独再次采样并核对位置与字段身份，页外消息作为临时样本显示，不改变分页游标。两次读取不是事务快照，消息可能变化；只有两张表确认显示后才报告 `applied`。

AI与UI独立持有游标，复用所属会话的同一连接；AI内部也遵循每类型一次扫描的现有所有权约束。对话单结果上限64KiB，集合值默认前4096字节，String默认4096字节。字段/成员身份不截断；超预算明确失败，不能跳过本批尾部后继续游标。`scanComplete`说明扫描结束，`complete`说明本次结果是否完整，二者不同。

Key 名称搜索和 Hash 条件筛选均使用 Redis `SCAN MATCH`：MATCH 过滤返回的 Key 名称，不保证服务器只遍历匹配前缀；持续扫描至结束可能遍历当前 DB 的整个键空间。`COUNT 100` 是工作量提示，不是扫描数量或返回数量的硬上限。工具结果的 `scanScope` 明确给出这些边界；用户禁止遍历整个键空间时，不应声称设置 MATCH 就能满足要求。详见 [Redis SCAN 官方文档](https://redis.io/docs/latest/commands/scan/)。

范围筛选的字段和目标值按 UTF-8 原始字节精确比较，字段最多 1,024 字节、目标值最多 4,096 字节。每次调用最多检查 10 个候选，并受同一会话的连续调用预算限制；每个 Redis RESP 响应受 1 MiB 解析上限约束，但一次筛选会依次发出扫描、类型、字段和 TTL 等多个命令，因此不能把 64 KiB 模型输出上限误认为 Redis 总接收量。结果的 `counts` 仅描述本批，`sampledAt` 是扫描时间，`readStartedAt` 和 `readFinishedAt` 是本批读取时间范围。跨批可能遇到重复 Key，扫描结束也不是一致性快照；缺失、首次检查时非 Hash（`notHash`）、读取期间观察到类型变化（`typeChanged`）和读取失败均单独计数；首次类型不匹配不证明发生过变化，不能把部分结果当作完整统计。

筛选结果每批记录 `condition.field` 和 `condition.equals`，分别是实际检查的字段与用户给出的精确比较值；空结果与权限失败也保留条件。原生卡片直接展示该记录，空文本及控制字符以 JSON 形式区分。这些是查询条件，不是从 Redis 读到的字段值；未匹配的值仍不返回。

AI 的 String 查询严格读取请求的字节范围，不返回界面预览使用的边界字节。二进制值保留Base64和字节长度，不能当作损坏文本；UTF-8前缀不完整时文本可能为空。未读取字节、其他分页及过滤掉的字段都不应被模型当作已知。

## 只读及运行边界

工具不接收 sessionId、任意连接地址、密码或自由命令；连接仅在用户明确要求并确定已保存资料时进行。内存估计按明确 Key 单独调用，慢日志仅提供有界、去除参数的服务器记录。DB 切换只影响所属连接的逻辑 DB，不修改 Redis 业务数据。连接断开、代次变化、会话或插件释放会清理 AI 选择及游标。

JSON、TimeSeries、GEO 和 Stream 消费组正常读取会通过 `TYPE` 检查 Key 类型；这些检查与主要查询是独立命令，单次结果不是原子快照。

消费组查询不读取或确认消息。`pending` 是已投递但尚未确认的数量，`lag` 是尚未投递的数量，后者可能不可计算；一次采样不能证明积压原因或变化趋势。Redis `XINFO GROUPS` 没有服务端分页，实际响应仍需完整接收并受 RESP 限额约束，超限会明确失败。

客户端列表同样没有服务端分页，Redis 需遍历连接并返回完整响应，受 RESP 大小限制；`complete: false` 表示只展示前 20 条，权限不足和超限不是空列表。

RedisJSON 的 `JSON.GET` 没有服务端分页，复杂路径或根路径可能遍历并返回整个子树；必须由用户明确指定范围。工具不截断 JSON：响应受 1 MiB RESP 上限和 64 KiB 单次 AI 结果上限约束，超限会失败；应缩小路径重试。返回的数组是单次采样，不是事务快照。参见 [Redis JSON.GET 文档](https://redis.io/docs/latest/commands/json.get/)。

TimeSeries 按明确的闭区间读取最多 100 条，并额外读取一条判断是否还有数据；时间戳和数值均作为字符串保留。`timestampUtc` 是由毫秒值确定性换算的 UTC 时间，超出日期表示范围时为 `null`，原始毫秒仍保留。续读返回非 `value` 状态时旧游标失效，须从原时间范围重新查询；取消或未收到结果时不能确定游标状态。多批之间可能发生并发变化，`complete` 仅指 TS.RANGE 当次可见结果已读完，不代表历史快照。目标 Key 可能是压缩序列，默认查询省略最新未闭合桶，而已关闭桶也可能包含结束时间之后的原始样本；结果不能自动等同原始测量。参见 [Redis TS.RANGE 文档](https://redis.io/docs/latest/commands/ts.range/)。

实现以当前项目锁定的 DSH 工具契约为准；[rc.2 历史契约](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/cookbook/adding-a-tool.md)仅对应旧版本。当前安装与工具链路证据见[交付状态](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/DELIVERY_STATUS.md)，历史接线见[实施记录](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/AI_READ_IMPLEMENTATION.md)。自动化检查不代替真实 DSH 调用与结果传递验证，模型如何组织最终回答不作为插件验收门槛。

2026-10-19曾完成[真实模型与真实数据联调](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/verification/ai-read-real-data-2026-10-19.md)：真实 Hash 检索/读取、当前选中字段、明确切库与侧栏同步、跨会话隔离通过。该记录只适用于当时构建；实际库只有 Hash，其他五类不标为真实数据验证通过。
