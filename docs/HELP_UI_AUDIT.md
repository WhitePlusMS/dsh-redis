# 界面帮助与提示审查（2026-10-17）

本轮交付为审查和可交互样例，尚未删除正式界面的任何控件。用户先比较图标与 Hash 布局，再实施选定方案。当前 `main` 基线为 `649e118`。

## 审查结论

当前的主要问题是帮助入口过密、正文重复，且把命令、内存预算、生命周期和防御细节直接写进了日常浏览界面。建议取消下面列出的 **19 个场景的通用圆圈帮助入口**，把有效信息放到它真正影响理解的位置。不要把整篇帮助改成常驻文字。

具体处理：

- 删除重复讲解按钮、扫描过程、只读实现和内部预算的界面文字；需要维护的机制说明保留在技术文档。
- 把会影响数据理解的信息压缩到字段名、结果标签或一行就地说明，例如“估算基数”“可能存在”“仅已加载样本”。
- 只在实际发生时显示连接失败、权限不足、部分读取、值被截断等状态，并附最短的下一步操作。
- 保留图标按钮的操作名称、`title`、`aria-label`，以及必须的输入校验。它们与成段帮助承担不同职责。

这项调整只精简呈现。读取上限、取消、原始字节身份、TLS 验证和只读命令约束继续由原实现负责。

## 范围与计数

检查 `src/client` 的 `HelpDetails` 调用、中文和英文 locale、原生 `title`/无障碍名称，以及与其并存的状态显示。

| 项目 | 核查结果 |
|---|---|
| 源码级 `HelpDetails` JSX 位置 | 17 个 |
| 功能场景 | 19 个；共享 `SnapshotDialog` 对应客户端、慢日志、服务器概览三种场景 |
| 不重复的正文 locale key | 34 个 |
| 最多同时适用的正文段落实例 | 44 个，包含重复 `value.live`；TLS 关闭时少一段，ZSet 模式二选一 |
| 当前帮助方式 | 原生 `details/summary`；统一为 `info` 图标和“使用帮助”名称 |
| 可能遮挡内容的帮助 | 工作区标题、自动刷新区域使用绝对定位正文 |

这里的 19 是功能场景数，并非同一屏同时出现 19 个问号。普通复制、查找、关闭等按钮的名称不计入这个数。

## 19 个场景的处理清单

以下“删除”均指正式实施时的界面文案/入口调整，本轮仅提出可审阅方案。

| # | 场景和文件 | 当前正文 key | 决定及替代呈现 |
|---|---|---|---|
| 1 | 工作区 `RedisWorkspace.tsx` | `keys.hint`、`session.scope` | 删除入口和两篇正文。自动加载直接由进度条、加载数量、取消/刷新体现。恢复选择时仅显示一次“已恢复浏览位置，请连接”。会话隔离机制放文档。 |
| 2 | Key 树 `KeyCatalog.tsx` | `namespace.hint` | 删除入口。“已加载”放在统计标题；分隔符输入保留标签和必要校验。16 层、排序、按键、分组不读 Redis 的机制说明移到文档；方向键和 Enter 继续可用。 |
| 3 | 自动刷新 `AutoRefresh.tsx` | `auto.hint` | 删除整篇机制正文及浮层。控件保留开关、间隔、上次更新时间。失败/隐藏而暂停时，就地显示“已暂停”及具体原因。页面看得见即可理解启停。 |
| 4 | 连接设置 `ConnectionForm.tsx` | `connection.privacy`、`connection.tlsVerification` | 删除通用帮助。密码字段下保留一句“仅用于本次连接”；TLS 的 CA 字段下保留“留空使用系统信任库”。证书错误显示在连接结果位置。避免与资料侧栏重复。 |
| 5 | Key 详情 `KeyDetails.tsx` | `value.live` | 删除每个 Key 都重复的“非原子快照”帮助；保留读取时间和刷新。并发一致性的技术边界写在文档。 |
| 6 | Hash `HashView.tsx` | `hash.hint`、`hash.budget`、`value.live` | 删除帮助入口。表格标题用“字段 / 值”，状态明确“已加载字段 N”“全部字段 M”；启用 MATCH 时不把 M 称作匹配总数。选中行联动两个预览区；只有发生截断才标注已显示/实际字节。 |
| 7 | List `ListView.tsx` | `list.hint`、`list.budget`、`value.live` | 删除入口。列标题使用“索引（从 0 开始）”，保留范围和已加载状态。重复项依然按索引区分。预算、并发位置变化的长说明移出主界面。 |
| 8 | Set `SetView.tsx` | `set.hint`、`set.budget`、`value.live` | 删除入口。显示“已加载成员 N”“全部成员 M”；筛选时不暗示分母为匹配总数。保留自动续读、完整成员身份和错误；不增加常驻去重/帧预算说明。 |
| 9 | ZSet `ZSetView.tsx` | `zset.rangeHint`、`zset.scanHint`、`zset.budget`、`value.live` | 删除入口。模式名直接区分“按分数浏览 / 按成员筛选”；仅范围模式显示排名（从 0 开始），扫描模式不伪造排名。保留分数和数量，预算移文档。 |
| 10 | Stream `StreamView.tsx` | `stream.hint`、`stream.pairsHint`、`stream.budget`、`value.live` | 删除入口。保留完整消息 ID、字段序号，重复字段继续独立。已有范围/方向控件表达查询行为；不常驻解释 ACK、消费组、整帧上限等未提供操作。 |
| 11 | Bitmap `BitmapView.tsx` | `bitmap.hint`、`bitmap.budget`、`value.live` | 改为一行上下文：“按 Bitmap 解释 · 位偏移从 0 开始”。它是 String 的解释方式，不能把普通 String 自动认定为 Bitmap。窗口和位序在表格标头中表达，详细算法移文档。 |
| 12 | HyperLogLog `HllView.tsx` | `hll.hint`、`value.live` | 删除入口，把主数字命名为“估算基数”，旁边短注“标准误差约 0.81%”；实际校验失败就地报错。PFCOUNT 双输入、缓存分支等实现说明移文档；不虚构可枚举成员。 |
| 13 | GEO `GeoView.tsx` | `geo.hint`、`geo.budget`、`value.live` | 改为标题旁短标签“按 GEO 解释 ZSet”，保留经纬度、原分数和成员。没有坐标显示“无可用坐标”；不把一次无坐标认定成整个 Key 类型错误。预算/量化算法移文档。 |
| 14 | Bloom `BloomView.tsx` | `bloom.hint`、`bloom.budget`、`value.live` | 删除入口。查询结果继续直写“可能存在 / 不存在”；统计名避免宣称精确去重成员数。按钮已表达显式查询，无需再讲草稿和命令预算；不增加成员枚举。 |
| 15 | RedisJSON `JsonView.tsx` | `json.hint`、`json.budget`、`value.live` | 删除入口。JSONPath 输入保留 `$` 示例；空结果写“路径无匹配”，匹配到 `null` 正常显示 `null`。只在实际结果过大时提示缩小路径/数组切片。 |
| 16 | TimeSeries `TimeSeriesView.tsx` | `timeseries.hint`、`timeseries.budget`、`chart.hint`、`value.live` | 删除入口。范围标签与方向控件表达查询；曲线边上保留“仅已加载样本”和点数。仅绘制部分已加载数据时明确 N/M。压缩桶、512 点上限、坐标近似等维护细节放文档。 |
| 17 | 客户端 `SnapshotDialog.tsx` → Client List | `clients.hint` | 删除通用帮助。标题“客户端快照”，展示读取时间、实际行数、截断状态、未报告字段即可。地址不进常规日志等机制留在技术文档。 |
| 18 | 慢日志 `SnapshotDialog.tsx` → Slow Log | `slowlog.hint` | 删除入口。耗时列名带单位；参数区直接标明“参数内容已隐藏”。存在原始参数字节数不确定性时，不把它显示为精确正文长度。命令执行耗时的定义可放列标题。 |
| 19 | 服务器概览 `SnapshotDialog.tsx` → Overview | `overview.hint` | 删除入口。保留采集时间、单位、未报告状态；maxmemory 为 0 时直接显示“未设置内存上限”。累计指标在指标名中表达，无需常驻讲解查询影响统计。 |

### 正文 key 的完整覆盖

上表已覆盖全部 34 个不重复的正文 key：`keys.hint`、`session.scope`、`namespace.hint`、`auto.hint`、`connection.privacy`、`connection.tlsVerification`、`value.live`、`hash.hint`、`hash.budget`、`list.hint`、`list.budget`、`set.hint`、`set.budget`、`zset.rangeHint`、`zset.scanHint`、`zset.budget`、`stream.hint`、`stream.pairsHint`、`stream.budget`、`bitmap.hint`、`bitmap.budget`、`hll.hint`、`geo.hint`、`geo.budget`、`bloom.hint`、`bloom.budget`、`json.hint`、`json.budget`、`timeseries.hint`、`timeseries.budget`、`chart.hint`、`clients.hint`、`slowlog.hint`、`overview.hint`。

## 不在圆圈帮助里的文字

| 文字/控件 | 处理 |
|---|---|
| `profile.privacy` | 删除资料列表底部长篇重复说明。保存动作旁仅保留“资料不含密码”，与密码字段“仅用于本次连接”对应。 |
| `connection.uriHint` | 精简为“解析后填入连接信息”，默认在展开 URI 导入后出现。解析动作不连接；真实按钮名明确“解析 URI”，无需展示变量清理实现。 |
| `content.scope` | 保留“搜索已加载内容”；大小写选项通过控件或清楚标签表达，勿暗示搜索全库/完整未读值。 |
| `chart.scope` | 保留“仅已加载样本”，与曲线点数放一起，删除重复 chart 长文。 |
| “严格只读” | 保留一个工作区状态标识，不在每个集合重复讲解写命令缺失。 |
| 图标按钮的原生 `title` 和 `aria-label` | 保留。采用具体动作名“刷新”“复制值”“查找”等，不统一写“使用帮助”。 |
| 长 Key / 字段的 `title` | 保留作为省略内容的补充，完整内容也必须能在预览区访问。 |
| 输入标签、无效地址/端口/范围提示 | 保留；错误尽量贴近对应输入，且不同时堆出几条同义提示。 |

## 实际状态的呈现准则

| 触发条件 | 推荐表现 | 不再常驻的内容 |
|---|---|---|
| 正常扫描 | `已加载 N`、可用时显示 DB/集合总数、进度/完成状态 | 中间空页、COUNT 提示、帧预算原理 |
| MATCH 筛选 | `匹配已加载 N · 全部字段 M`；未知 M 不伪造百分比 | “HLEN/SCARD 不是匹配数量”的段落 |
| 真实截断 | `已显示前 N 字节 / 共 M 字节`，可提供现有范围查看 | 每个完整小值都展示“最多 64 KiB” |
| 缓存/扫描达到上限 | 保留“部分结果”，提供“缩小筛选后刷新”；不显示 100% 全量完成 | 每次进入都列所有预算数字 |
| 无总数权限 | 总数显示“未知”，Key 扫描继续；必要时一条短状态 | 工作区统一长文讲权限降级 |
| 连接/TLS/读取失败 | 显示实际原因、重试/调整相关输入；错误不吞掉 | 正常界面预先列所有可能失败 |
| 自动刷新暂停 | 当前开关附近短状态，保留手动恢复入口 | 全量状态机和命令范围说明 |
| 完整空结果 | 独立空态，区别于未读取、正在加载、失败、部分结果 | 含糊的“暂无数据”覆盖所有状态 |

## 选定样式后的实施顺序

- [ ] 与用户选定的图标、Hash 布局一起确认呈现方式。
- [ ] 逐组件移除帮助调用，中文/英文 locale 同步删除无引用 key。34 个正文 key 不可只删一半语言。
- [ ] 先补必要的短标签、条件状态和操作名称，再移除旧文字；不复制另一份提示组件。
- [ ] 仅当所有调用清零时删除 `HelpDetails.tsx` 和对应样式；原有错误、DTO、读取限制继续复用。
- [ ] 每一组修改后立即跑严格 TypeScript 检查；按受影响行为验证空/部分/失败、窄栏、浅深主题和键盘操作。
- [ ] 本地提交每个小目标，验证安装另记；本轮审查不代表以上已实施。

## 核查依据

直接核对 `HelpDetails.tsx`、`RedisWorkspace.tsx`、`KeyCatalog.tsx`、`AutoRefresh.tsx`、`ConnectionForm.tsx`、`ProfileChooser.tsx`、`KeyDetails.tsx`、各类型视图、`SnapshotDialog.tsx`、`BytePreview.tsx`、`TimeSeriesChart.tsx`、`locales.ts`、`styles.ts` 的调用和实际状态结构。由 GPT6 LUNA 提供逐文件事实清单，主模型复核边界并作出上述处理决定。

没有执行网页端 GPT 审查，没有改动 Host、Redis 数据或当前安装包。

## 2026-10-18 实施进度

本轮已实施工作区、Key 树、自动刷新、String 详情、Hash 共五个场景的帮助清理，删除六组无调用中英文长正文。当前还保留 12 个源码级 HelpDetails / 14 个功能场景，其余专用类型和连接/诊断帮助没有冒称全部完成。`value.live`、`hash.identity` 仍有其他真实调用，继续保留。

Hash 以已加载/全部字段、实际部分覆盖、读取时间、错误代替帮助；服务器 MATCH 和本地搜索作用域分别标明。具体改动及验证见 [本轮跟进](E:/项目demo/dsh-redis/docs/RESP_OPERATION_REFINEMENT.md)。

随后用户要求统一 List / Set / ZSet / Stream，四页已删除帮助入口及十组无调用中英文长正文，以范围/方向、已加载/全部数量、原始分数、读取时间、实际部分覆盖和错误表达状态。当前保留 8 个源码级 HelpDetails / 10 个功能场景；其他特殊类型、连接与诊断尚未全量清理。`set.identity` 仍由 GEO 使用，`value.live` 仍有专用类型调用，继续保留；已无调用的 `hash.identity` 与详情返回文案删除。见 [集合统一跟进](E:/项目demo/dsh-redis/docs/COLLECTION_INLINE_PLAN.md)。
