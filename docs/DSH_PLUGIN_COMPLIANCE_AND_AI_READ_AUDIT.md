# DSH 官方插件规范与 Redis 对话读取审查

日期：2026-10-19。应用源码基线：`f20ba515e857a820e790659b886c4864f472d72e`。本轮只读检查官方文档、源码及已安装文件，编写审查说明；没有修改应用、依赖、配置或安装包，没有启动服务、查询业务 Redis 或发送 DSH 对话。

> 本文保留审查时的历史事实。用户随后确认实施，A/B/C已完成代码及205项回归；后续接线、真实模型与安装状态以[实施记录](AI_READ_IMPLEMENTATION.md)为准，不能将本文的“尚未实现”当作最新状态。

> 后续真实模型已在日常DSH完成真实Hash、当前字段、DB往返同步与会话隔离联调；[真实数据专项](verification/ai-read-real-data-2026-10-19.md)明确列出数据覆盖和单次样式观察的限制。以下审查结论仍对应当时源码基线。

## 1. 结论及证据边界

当前插件已经接入 DSH 的包加载、Client 模块、原生侧栏和 Typert 远程服务；在本轮核对的这些接入点上，与官方提供的路径相符。**但它没有注册模型工具，因此尚不能通过本插件，让 DSH 对话直接检索和读取 Redis。** 侧栏读取完成不代表对话读取完成，也不能据此声称已经全面通过官方规范或 AI 联调验收。

这不是要求重新开发整个界面。现有连接和六类 reader 可以继续使用，需要补齐官方工具入口、当前选择上下文，以及 UI 与 AI 同时读取时的状态隔离。单纯在提示词中写“可以访问 Redis”不能代替工具实现。

本轮分开核对三类证据：

- 官方契约：以用户已选用的 `DSH 0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84` 为准；最新主线仅用于对照，不把新 API 倒灌成旧版要求。
- 项目源码：Host/Client 入口、RPC、连接代次、游标、侧栏选择状态和旧方案；不把静态检查写成运行验收。
- 日常安装：`C:/Users/admin/.dsh/profiles/web` 引用精简版 SHA 包，`dsh.profile.bundles` 包含 `dsh-redis`。安装的 `lib/runtime.js`、`lib/remote-service.js` 与项目产物逐字节一致。本轮观察 7198 没有监听，因此未做当前运行实例的工具列表或真实对话验证。

## 2. 官方依据

以下链接固定到同一官方提交，第三方教程和 Database 参考项目不充当规范来源。

| 编号 | 官方资料 | 本轮使用范围 |
| --- | --- | --- |
| O1 | [工具编写契约](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/cookbook/adding-a-tool.md) | `defineTool`、输入/输出、执行与取消、展示分工 |
| O2 | [dsh-tools 说明](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/core/tools/README.md) | 工具发现、作用域、策略及 Native/PTC 调用 |
| O3 | [工具子系统](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/subsystems/tools.md) | 输出与执行类型、并发和生命周期 |
| O4 | [插件打包与安装](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/user/develop/basic/publish.md) | bundle、patch、profile 与宿主 peer |
| O5 | [Client 模块](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/modules/README.md) | `dsh.client`、`./client`、浏览器 bundle |

官方模型工具的核心路径是：依赖 `tools` 服务，在插件作用域内 `ctx.tools.register(defineTool(...))`。定义包含参数、`output.schema`、`output.render` 和 `execute`；注册后的 schema 才会进入模型的可见能力集合。注册仍受会话工具限制及宿主策略约束，不能保证模型在每个问题里都主动调用。依据：O1、O2。

本机已安装的官方 `dsh-tools@0.2.0-rc.2` 声明文件也核实了：`execute` 接收执行上下文及 `signal`，`agent` 在类型上可缺省；并发字段准确名称是 `isConcurrencySafe`，不能臆造 `parallelSafe` 或 `permissions` 字段。实现应校验可信调用身份并传递取消信号；不能让模型提交任意 `sessionId` 来选择其他会话。依据：O3 与本机官方 `lib/types/index.d.ts:105、172、229、241`。

## 3. 当前实现逐项核对

“接入相符”只评价表内的接口路径，不表示所有异常、权限和交互均已重新实测。

| 核对项 | 当前证据 | 判断及影响 |
| --- | --- | --- |
| 包与 Host 入口 | [package.json](E:/项目demo/dsh-redis/package.json)、[patch](E:/项目demo/dsh-redis/cordis.patch.yml)、[index.ts](E:/项目demo/dsh-redis/src/index.ts:1) | bundle/patch、ESM 入口和宿主 peer 接入相符；基线仍是已确认的 RC 版 |
| 原生 Client 与侧栏 | [Client 入口](E:/项目demo/dsh-redis/src/client/index.ts:13) | 使用原生 tab、slot、locale 和 effect；浏览器模块存在不代表模型获得工具 |
| Client → Host 读取 | [Remote 接口](E:/项目demo/dsh-redis/src/typert.remote-client.ts:15)、[Host 服务](E:/项目demo/dsh-redis/src/remote-service.ts:28) | 已有 16 项 RPC，服务于界面；这些不是模型工具注册 |
| 会话、连接与 DB | [连接服务](E:/项目demo/dsh-redis/src/host/connection-service.ts:54) | Host 按可信 session 持有连接，检查 ID/代次/DB；可作为对话复用的基础 |
| 卸载与释放 | [Host 清理](E:/项目demo/dsh-redis/src/remote-service.ts:43) | 插件与 session 释放会清连接/游标；侧栏隐藏不主动断开已建立连接 |
| 密码与返回值 | [连接 DTO](E:/项目demo/dsh-redis/src/domain.ts:14) | 输入含密码，公开连接视图不含密码；未来工具应继续使用明确投影，不能返回内部对象 |
| 官方模型工具入口 | [runtime.ts](E:/项目demo/dsh-redis/src/runtime.ts:4) | **缺失**：只创建 RemoteService，注释也明确不添加模型工具 |
| “当前这个 Key/字段” | [Key 本地选择](E:/项目demo/dsh-redis/src/client/KeyBrowser.tsx:34)、[Hash 字段本地选择](E:/项目demo/dsh-redis/src/client/HashView.tsx:29) | 当前选择在 React 状态中；Host 连接状态没有这项信息，模型不能自行看到它 |
| 对话结果与完整性说明 | [现有数据 DTO](E:/项目demo/dsh-redis/src/domain.ts:44) | 已有分页/字节/错误字段可复用，但还没有对话工具的 schema、投影与返回流程 |
| 对话切换 DB 与侧栏同步 | [SELECT 实现](E:/项目demo/dsh-redis/src/host/connection-service.ts:147) | 手动 SELECT 已有代次校验；AI 工具入口与外部变更后的 Client 同步尚未实现 |
| UI/AI 同时扫描 | [游标存储](E:/项目demo/dsh-redis/src/host/scan-cursors.ts:15) | 当前每个 reader 对同一 session 只有一个扫描槽；未来不能直接共用这一槽 |
| 对话端到端验收 | 本轮没有可调用的 Redis 工具，也未发起 DSH 对话 | **未完成**；既有侧栏、187 项回归或历史真实 Redis 检查不替代这项验收 |

### 3.1 缺口的来源

[原开发方案](E:/项目demo/dsh-redis/docs/DSH_Redis_开发路线与实施方案.md:71)把首版定义为侧栏查看器，将“显式 AI 只读工具”放在 P2。没有注册工具并不是六类型精简时删坏了工具入口，也不是官方禁止模型访问 Redis。按用户本轮明确的“DSH 对话可以直接访问 Redis”目标，应将此能力提升为 P0。

最初的第三方 Database 参考项目已经使用 `ctx.tools.register(defineTool(...))` 提供 `redis_status`、`redis_keys`、`redis_value`，并另外包含受其自身环境策略约束的 `redis_execute`。其实际代码见[redis-ai-tools.ts](C:/Users/admin/Documents/Codex/2026-10-15/dsh-plc/work/dsh-database-review/src/host/redis-ai-tools.ts:56)。可以参考前三者的接入方式；当前项目的六类型只读目标不需要引入自由文本命令执行或整个多数据源工作台。

### 3.2 不能仅给现有 RPC 套一层工具名

现有 `RedisScanCursors` 使用 `Map<sessionId, ScanState>`。一方以空游标开始新扫描，会覆盖该 reader 的同会话旧扫描槽；另一方的引用或续页 token 随后会被判为 `stale`。即使两次查询属于不同 Key，session 单槽仍会被替换。Key、Hash、Set、ZSet、Stream 均有相关扫描状态；ZSet 的 range 读取还会清当前 ZSCAN 槽。

这是依据现有源码推演的**未来共用风险**，不是声称当前不存在的 AI 调用已经导致故障。最小方案是复用同一连接和 reader 类，使 UI 与 AI 分别持有游标状态，保持真实 session 归属校验；不要通过伪造第二个 session 或额外建 Redis 连接规避问题。新状态也必须随断开、换代、会话/插件释放清理。

## 4. 本轮已确认的使用边界

| 决策 | 用户确认 |
| --- | --- |
| Q1 连接来源 | 复用当前 DSH 会话中用户已手动连接的 Redis；未连接提示先连接，不自行选择其他服务器 |
| Q2 当前选择 | 能识别侧栏当前选中的 Key 或字段；用户可直接说“解释当前这个值”，按需读取，不要求复制 Key 名或生成快照 |
| Q3 切换 DB | 用户明确要求时允许对话切换同一连接的 DB，并同步侧栏；普通查询沿用当前 DB |
| 既有约束 | 六种基础类型、严格只读、个人使用、单机及 TLS；保留当前青紫橘导航和 Lucide 控件 |

当前选择上下文只需要标识：连接代次、DB、Key 原始字节身份，以及相应字段/成员/下标/Stream 消息和字段序号。不能只传会丢失二进制或重复字段身份的显示文本，也不需要在每次选行时把值自动写入对话。会话中的当前选择与以前删除的浏览偏好持久化是不同需求。

## 5. 建议实施顺序（尚未执行）

### P0-A：注册官方只读工具，打通明确 Key 的读取

- 为目标 RC 版声明 `dsh-tools` 依赖与注入，按官方契约注册工具；复用当前 Host 持有的连接，校验 `exec.agent`，向 reader 传 `exec.signal`。
- 建议使用项目独有前缀，例如 `redis_viewer_status`、`redis_viewer_keys`、`redis_viewer_value`，避免与参考 Database 的全局工具名冲突。名称是拟议值，不是已有 API。
- 状态返回当前连接/DB；检索走现有 SCAN；值读取覆盖 String、Hash、List、Set、ZSet、Stream，按类型转入现有 reader。UI/AI 的扫描状态分别持有。
- 规范输出包含类型、TTL、读取时间、结果/错误状态、覆盖范围、续读信息和部分标识；二进制及整数/分数保持原始身份或文本精度。模型可读呈现与结构化结果由同一数据投影生成。
- 不增加任意命令参数，不依赖截图或 DOM 抓取，不将 UI 已缓存的 5000 条当作全库事实。工具输出另做适合对话的预算，不能把整个 DB 自动灌入提示词。

验收：在真实组装的隔离 DSH 中发现工具；对话能按明确名称读取六类型；未连接、权限不足、空页带游标、部分字节、类型变化、取消与换代均如实返回。工具被宿主策略限制时也应能诊断原因。

### P0-B：让“当前这个值”有可靠指代

- Client 将当前选择的原始标识同步到同会话 Host；工具读取该标识后按需取值，保留客户端来源与代次校验。
- 选择变化、换 Key/DB/连接、会话切换和释放时处理失效；缺少有效选择就明确请求指定，不猜上次的业务值。
- 覆盖 Hash 字段、List 下标、Set/ZSet 成员，以及 Stream 消息/重复字段序号；普通明确 Key 查询不依赖侧栏是否可见。

验收：点击不同 Key/字段后连续提问，目标一致；快速切换时旧回复不串到新选择；另一会话不能读取本会话连接或选择。

### P0-C：对话明确切 DB，并同步现有侧栏

- 增加专门的 DB 切换工具，复用既有 `selectDatabase` 和实际 `ConnectionView`；不以模型参数里的任意会话 ID 选连接。
- 普通查询不切 DB；明确切换后把新代次/DB 同步到侧栏，清理失效选择和游标，停止旧目标的自动刷新。
- 最小路径复用现有 `connectionStatus`：侧栏可见时轻量核对 Host 内存中的连接/代次/DB，只有实际变化才应用新状态；隐藏时停止同步检查。这项检查不发送 Redis 读取命令、不重连，也不自行启动 Key 内容自动刷新。
- 官方 rc2 虽有 `ctx.remote.$on`，但可订阅事件受应用的显式转发白名单约束；不能假定独立插件随意新增事件就能转发，也不为此修改官方宿主白名单。资料见[官方 API Remotes 说明](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/api/remotes/README.md)及[转发声明](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/api/remotes/src/remote-events.ts)。更复杂的推送不是本阶段前置。

验收：DB0/非零 DB 往返；与 UI SELECT/自动刷新交错操作；非法 DB/权限不足/取消后双方显示同一真实状态，不将旧 DB 数据呈现为新 DB 数据。

### P0-D：完整联调、说明与日常安装

- 检查严格类型、参数/输出 schema、扫描隔离、释放、实际对话调用和 Native/PTC 中实际启用的模式；工具卡片优先使用宿主已有呈现，专用美化可后续进行。
- 用自建 Redis 和独立 profile 验证读取命令及业务数据不被写入，覆盖 UI 与 AI 交错续页；不以 mock 或工具函数直接调用替代最终自然语言对话验收。
- 更新功能清单/README/更新说明，核对最终包后安装到用户日常 DSH；每个完成的小目标本地提交，不推送。

以上四步属于待整体确认的实施方案。本轮只完成审查文档，没有添加工具、恢复已删除的低频功能或升级 DSH。

## 6. 本轮检查与交付记录

- 核对固定提交官方文档及本机官方工具声明；GPT6 LUNA 负责大量源码事实定位，主模型复核并形成判断。
- 源码与日常安装的 Host 入口均没有模型工具注册；两份相关构建文件 SHA256 分别一致：runtime 为 `D384DD8171845850CAC93B3C0D5C65FF9810524F3915C3594E3090F03CB39AE2`，remote-service 为 `0ADF08A23E9A2FED2DD2CFB58B07DEB1F822BCA57464D7FE2626328D65248A28`。这不是本轮重新核对全部发布文件。
- 未启动或停止服务，未修改用户连接资料，未读取密码或业务值，未发送对话、安装依赖、升级宿主或重装插件。
- 变更仅为本文件与 `UPDATE_LOG.md`；文档链接和差异检查完成后本地提交。没有应用代码变更，因此不把历史编译/187 项回归写成本轮执行结果。
