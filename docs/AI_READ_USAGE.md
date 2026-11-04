# 在DSH对话中读取Redis

接入方式为 DSH 原生插件工具，不是 Redis MCP Server；当前开放读取和明确切 DB，未开放业务数据写入。实现路径、Typert RPC 与 MCP 的区别见[AI 读取架构说明](AI_READ_ARCHITECTURE.md)。

## 使用顺序

1. 打开目标DSH会话的Redis侧栏，手动连接服务器。连接仅属于这个会话；保存的资料不代表已连接。
2. 在同一会话输入问题；已知 Key 名称时可直接提问，已知 Hash 字段时可同时指定 Key 和字段，无需先在面板选中。模型服务及该会话的工具策略必须可用。
3. 如果希望询问界面上看到的“当前这一项”，先在侧栏选中对应 Key 或行，再回到同一会话提问；Stream 可选择消息中的具体字段对。

可使用这些自然语言请求；它们是操作示例，不是本次真实模型验收记录：

- “当前Redis连接到了哪里，当前DB是多少？”
- “检索当前DB里符合 `order:*` 的Key，先告诉我本批结果。”
- “在 `order:*` 中查找 `status` 等于 `failed` 的 Hash，先检查一批。”
- “读取 `order:1001`，解释其中的字段。”
- “读取 `order:1001` 的 `status` 字段。”
- “检查 `active:users` 中是否包含 `user:123`。”
- “解释一下我在侧栏选中的当前这个值。”
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
| `redis_viewer_keys` | 可选`match`、`cursor` | 当前DB的SCAN批次；`returnedCount`为本次返回的Key数，不是全库总数；续读保持同一MATCH，空页不一定结束 |
| `redis_viewer_value` | `key`或`keyBase64`可省略；精确 Hash 字段用`field`或`fieldBase64`，Set/ZSet 成员用`member`或`memberBase64`；按类型提供范围/游标 | 六类型结果、TTL、读取时间、完整性和续读信息；精确字段或成员需明确 Key，不能混用分页参数 |
| `redis_viewer_filter_hash` | 必填`match`、`field`、`equals`，续读用`cursor` | 每批最多检查 10 个候选；返回精确匹配的 Key 和本批各状态计数，不返回未匹配的值；续读条件必须一致 |
| `redis_viewer_select_db` | 必填整数`db` | 同一连接的实际切库结果；仅明确要求切库时使用 |

Key、字段和成员的文本与 Base64 身份各自只能传一个。指定 Hash 字段或集合成员时的 `selection-missing` 表示采样时该项不存在；Key 不存在则是 `missing`，类型不匹配或中途变化会分别给出状态。Set 返回成员存在性，ZSet 同时返回采样时的分数字符串。位置及 Stream ID 使用字符串以保持整数精度。值工具支持 String 的 `offset/bytes`、List 及 ZSet 排名的 `offset/count`、Hash/Set/ZSet 扫描的 `match/cursor`、Stream 的 `start/end/direction/count/cursor`；参数仍由各类型严格校验。

明确要求定位当前 ZSet Key 的成员时，可使用 `redis_viewer_locate_zset_member`，通过 `member` 文本或 `memberBase64` 规范二进制身份指定成员，二者只能提供一个，空成员也有效。工具以 `ZSCORE` 做定点采样；分数保留 Redis 返回的字符串，代表采样时结果。界面为确认定位会再次采样，期间分数可能变化；筛选或排名页外的临时结果不表示其排名，不改变分页游标。只有面板确认后才报告 `applied`，结果未知时应检查当前面板。

明确要求定位当前 Stream Key 的消息字段时，可使用 `redis_viewer_locate_stream_field`，提供完整消息 `id` 和从 0 开始的 `fieldIndex`。该位置指消息中所有字段对的顺序，不是同名字段的出现次数；工具保留原始字段字节并使用 `XRANGE` 按消息 ID 只读采样，不推进消费组。界面单独再次采样并核对位置与字段身份，页外消息作为临时样本显示，不改变分页游标。两次读取不是事务快照，消息可能变化；只有两张表确认显示后才报告 `applied`。

AI与UI独立持有游标，复用所属会话的同一连接；AI内部也遵循每类型一次扫描的现有所有权约束。对话单结果上限64KiB，集合值默认前4096字节，String默认4096字节。字段/成员身份不截断；超预算明确失败，不能跳过本批尾部后继续游标。`scanComplete`说明扫描结束，`complete`说明本次结果是否完整，二者不同。

范围筛选的字段和目标值按 UTF-8 原始字节精确比较，字段最多 1,024 字节、目标值最多 4,096 字节。每次调用最多检查 10 个候选，并受同一会话的连续调用预算限制；每个 Redis RESP 响应受 1 MiB 解析上限约束，但一次筛选会依次发出扫描、类型、字段和 TTL 等多个命令，因此不能把 64 KiB 模型输出上限误认为 Redis 总接收量。结果的 `counts` 仅描述本批，`sampledAt` 是扫描时间，`readStartedAt` 和 `readFinishedAt` 是本批读取时间范围。跨批可能遇到重复 Key，扫描结束也不是一致性快照；缺失、类型变化和读取失败均单独计数，不能把部分结果当作完整统计。

二进制值保留Base64和字节长度，不能当作损坏文本；UTF-8前缀不完整时文本可能为空。未读取字节、其他分页及过滤掉的字段都不应被模型当作已知。

## 只读及运行边界

工具不接收sessionId或自由命令，不自动建立连接，不返回密码，也不新增快照、诊断或特殊类型。DB切换只影响所属连接的逻辑DB，不修改Redis业务数据。连接断开、代次变化、会话或插件释放会清理AI选择及游标。

实现以当前项目锁定的 DSH 工具契约为准；[rc.2 历史契约](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/cookbook/adding-a-tool.md)仅对应旧版本。实际检查、模型服务故障与日常安装状态见[实施记录](AI_READ_IMPLEMENTATION.md)；自动化或脚本模型通过不等于真实模型自然语言验收通过。

2026-10-19已完成[真实模型与真实数据联调](verification/ai-read-real-data-2026-10-19.md)：真实Hash检索/读取、当前选中字段、明确切库与侧栏同步、跨会话隔离通过。实际库只有Hash，其他五类不标为真实数据验证通过。
