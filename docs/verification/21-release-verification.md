# 21 从独立安装包完成 P0 只读首版验收

> 历史包记录：用户后续要求Database/RESP工作台，20/21曾重开并已完成新版复验。本文仅保留bb2b83e包的原证据；当前界面见[20新版](20-database-workbench.md)，当前509aa7b0包完整门禁见[21新版](21-workbench-release.md)。

2026-10-16，使用用户指定的 DSH `0.2.0-rc.2` 原生 Web 右侧栏验收。该版本为 RC 预发布版本。本票通过不表示原 29 票全部完成，后续 8 张 P1 仍按原依赖执行。

## 最终交付身份

| 对象 | 本次实际核对 |
| --- | --- |
| 插件 | `dsh-redis@0.1.0`，独立项目 `E:\项目demo\dsh-redis` |
| 最终 tgz SHA-256 | `bb2b83e51c1a83abc18c9f638484bded2e53451931ffa2d534f5c06d9584a1ea` |
| CLI / 11 个 DSH Host peer | `0.2.0-rc.2`，沿实际 CLI realpath 的 Node 解析路径核对 manifest |
| Cordis / 浏览器 React | `4.0.4` / `18.3.1`；实际插件 require 得到的 React 与真实模块系统 seed 是同一个对象 |
| Node / pnpm / Chrome | `22.22.1` / `11.22.0` / `155.0.8059.80` |
| 生产依赖 | 安装包实际解析 `redis@6.2.1`、`zod@4.4.3`，与 manifest/锁文件一致 |
| 宿主源码 | 官方 `dsh-v0.2.0-rc.2`，`639ed015397290b3745d163aafe02ffee4aa3f84`；本地 tag 与 HEAD 一致，提交日期 `2026-09-29T17:21:31+08:00` |
| Redis | 自建 `8.2.6`，官方 `redis:8.2.6-alpine@sha256:ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e`；amd64 manifest `f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e` |
| 实际模块 | RedisJSON `80209`、TimeSeries `80210`、Bloom `80212`；真实命令/类型及权限恢复均由原生检查执行 |
| 安装闭包 | tarball 79 个常规文件逐字节匹配安装目录；lib 的完整 70 文件集合/字节匹配本次构建，许可/README/patch/icon 同步 |

完整源码输入、测试/脚本输入与锁文件 SHA、70 个构建物和 79 个包文件的哈希、真实依赖路径见 [release-manifest.json](artifacts/21-release/release-manifest.json)。其 sourceParentCommit 为修改前的 `7e4ef6d`；待本票本地提交后，以同一提交中的 sourceInputs 哈希定位具体文件，不将父提交冒充本次源码。

`pnpm pack` 实际移除 `packageManager` 和 `scripts.prepack` 开发字段，其余 manifest 与源码一致；安装 manifest 与 tarball 完全一致。临时核对脚本曾因全局 peer 直链路径、pack 字段裁剪和 REPL 跨 realm 对象比较中断，改为普通 Node 的 `scripts/verify-release-package.mjs` 后通过；没有为此改动产品依赖或放宽版本匹配。

隔离 profile 的 `pnpm peers check` 仍会按该 profile 自身锁文件报告共享 peer 缺项。固定 rc.2 官方 profile 使用 `hoisted`、`autoInstallPeers:false`，Host 通过安装目录 runtime resolution 提供共享包；本次沿实际 CLI 解析出 12 个 Host peer 的正确版本，另在真实浏览器观察 React 引用同一性。该提醒保留为工具输出，不用复制第二套 Host/React 消除提醒。

## 来源和复制范围

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/tree/639ed015397290b3745d163aafe02ffee4aa3f84) 仅用于核对 Host/Client、模块加载、Typert 与构建 API；宿主作为外部运行时，未复制整个应用或修改全局安装源码。
- [Git Graph](https://github.com/WhitePlusMS/dsh-git-graph/tree/33b3e67a39a429a0ff570d82d7264aab735fc1fd)，提交日期 `2026-10-11T09:28:08+08:00`：裁剪原生侧栏、Host/Client 注册、Typert 和构建骨架，不包含 Git 业务。
- [DSH Database](https://github.com/zhuoxiaoshuai/dsh-database/tree/5d2b900b0317200b1866275c7cf48814fe84b52d)，提交日期 `2026-10-09T21:51:03+08:00`：保留 Redis 连接/读取源码作参考，独立实现预算、只读路由及错误语义；没有带入写入口、其他数据库或整套工作台。
- 以上为本次 2026-10-16 核对的固定副本/提交日期，不声称未来仍为最新。原样 checkout 位于 `.scratch/upstream/`，不随包分发；MIT 来源及全文许可随包保留，见 `THIRD_PARTY_NOTICES.md`、`licenses/`。依赖目录、私人配置、旧产物和参考项目 Git 元数据未复制进产品。

## 本次执行结果

| 检查 | 最终包结果与原始证据 |
| --- | --- |
| 严格类型/构建/回归 | `pnpm pack --pack-destination .scratch/artifacts` 的 prepack 执行三层 tsc、构建及 20 个测试文件；226 项通过 |
| 全 12 类 + 双会话 + 浏览器接收边界 | [native-release-smoke.json](artifacts/21-release/native-release-smoke.json)，87 组，通过 |
| TLS、普通/TLS 配置增改删、错误 CA、密码不落盘 | [native-profiles-save-smoke.json](artifacts/21-release/native-profiles-save-smoke.json)，17 组，通过 |
| 冷启动恢复 TLS 配置、手动选择/连接和删除自建配置 | [native-profiles-reopen-smoke.json](artifacts/21-release/native-profiles-reopen-smoke.json)，17 组，通过 |
| 用户选择 A、12 类窄栏、原生宽度/主题操作 | [native-layout-smoke.json](artifacts/21-release/native-layout-smoke.json)，22 组，通过；300/340/900px、Dark/Light、键盘/局部滚动和返回位置 345px 一致 |
| active/queued 取消、生产 10 秒截止、真实 TCP EOF、手动恢复 | [native-recovery-smoke.json](artifacts/21-release/native-recovery-smoke.json)，18 组，通过；取消约 33ms，实际截止约 10077ms，另一可信会话继续可读 |
| tarball/安装资源与共享版本 | `scripts/verify-release-package.mjs` 通过；全部数据见 release-manifest |

以上五轮均针对同一最终包 SHA，独立 profile 安装后实际运行。日志与截图位于同目录。已查看宽明亮、窄深色数据截图；完整数字需要时由表格内部横滚查看。每轮 pageerror/console error 均为空；全类型会话延迟有 1 条、恢复取消有 2 条预期 `readString ERR_ABORTED`，报告原样保留，不伪称网络失败记录全为空。

更早的 `boundary-*` 记录针对 `0a23cbfb…` 包，只证明首次 SDK/React 专项。该包之后仅补 README，再以最终 `bb2b83e…` 包重跑上述全部门禁；早期结果不替代最终包通过。

## 23 项 RPC 的浏览器校验

固定 rc.2 `protocol/types.ts` 定义 strict codec 的 `create` 与可选 `decode`；`api/gateway/src/client/index.ts` unary invoke 成功分支只调用 `decode`。官方 generator 和 gateway 测试已有 `decode: value => schema().parse(value)`。本票在唯一 `createRedisInvocation` 中采用这一已有接口，Host/Client 共用原严格 schema，避免 23 处重复包装。删除 TimeSeries、Bloom 和浏览偏好返回值的重复 parse；本地表单及偏好 patch 输入校验保留。

编译 bundle 测试检查实际 `lib/client.js` 的 23 个 decoder。原生 RELEASE 探针原样调用真正 loader/factory/apply，捕获实际插件 Context 和 React；不创建新 module system。通过真实 SDK 对 23 项方法分别注入 `ok:true,value:null`，均得到 `gateway/internal`；矛盾连接测试和额外秘密字段也拒绝，正常 status 在前后均可调用。该专项 route 直接返回 HTTP envelope，零 Host 派发，不能算作这些方法的真实 Redis 功能验收；后者由上述连接/数据/会话轮完成。

所有正式界面在响应进入状态/缓存前经过 decoder。Host 仍严格校验输入与输出；Client 的失败分支和取消语义沿用 SDK，没有新增通用命令、自动重试或结果兼容层。原生 TimeSeries 越界时间戳、Bloom 伪造确定存在等异常响应也在完整轮中再次拒绝并恢复。

## P0 证据索引

| 任务 | 专项实现及历史证据 | 本次最终包覆盖 |
| --- | --- | --- |
| 01 侧栏与 RPC | [01](01-native-sidebar.md) | 全部原生轮启动、引导入口、真实 Host 状态与错误请求拒绝 |
| 02 单机连接 | [02](02-standalone-connection.md) | 测试/认证失败/连接/手动状态/断开/密码清空 |
| 03 TLS | [03](03-tls-connection.md) | 真实 TLS、错误 CA 拒绝、修正后连接、释放 socket |
| 04 连接资料 | [04](04-saved-profiles.md) | 普通/TLS 保存更新删除、冷启动、秘密字段拒绝 |
| 05 DB/Key | [05](05-db-key-browser.md) | 230 Key 增量、原字节、空 MATCH、DB1、非法 DB、手动恢复 |
| 06 String | [06](06-string-preview.md) | 文本/精度保留 JSON/二进制、UTF-8 边界、大值窗口和删除/类型变化 |
| 07 Hash | [07](07-hash-view.md) | 235 项、二进制/空字段、MATCH、长值前缀和刷新清旧结果 |
| 08 List | [08](08-list-view.md) | 原始索引、重复值、100/100/后续范围、大项截断和并发插入刷新 |
| 09 Set | [09](09-set-view.md) | 235 完整原字节成员、MATCH、无全局排序承诺、删除/转换 |
| 10 ZSet | [10](10-zset-view.md) | rank 与 scan、无穷/高精度 score、分页/EOF、超大成员拒绝及恢复 |
| 11 Stream | [11](11-stream-view.md) | 235 ID、重复字段顺序、双 uint64、前后向、Pending/group 未推进 |
| 12 RedisJSON | [12](12-redis-json.md) | 真模块根/路径/匹配数组、无匹配与 null、超预算拒绝/缩路径恢复 |
| 13 Bitmap | [13](13-bitmap-view.md) | String 手动解释、2MiB 原值有界位窗口、位序、末尾/越界 |
| 14 GEO | [14](14-geo-view.md) | ZSet 手动解释、坐标/rank/原成员、ACL 拒绝、组合请求预算 |
| 15 HLL | [15](15-hll-count.md) | sparse/dense/空/坏格式、缓存有效性、权限与恢复、原值不变 |
| 16 TimeSeries | [16](16-timeseries-view.md) | 真模块 235 样本、int64、时间区间/反向、INFO 部分权限及范围拒绝 |
| 17 Bloom | [17](17-bloom-view.md) | 真模块 INFO/EXISTS、4KiB/二进制、真实假阳性、非缩放、Cuckoo 区分 |
| 18 会话状态 | [18](18-session-browsing-state.md) | 两 workspace/会话共享资料独立状态、延迟 A 不覆盖 B、无自动 Redis、手动 DB 恢复 |
| 19 取消恢复 | [19](19-read-cancellation-recovery.md) | 同包真实代理/Host signal、取消排空、超时/EOF、B 独立及手动新 generation |
| 20 布局主题 | [20](20-sidebar-layout-themes.md) | 同包 12 类共享容器、实际拖柄、主题、返回位置、数字单行 |
| 21 发布 | 本文 | 当前包严格契约、实际运行闭包、五轮安装版门禁及操作说明 |

## 实际数据与预算边界

| 范围 | 当前硬边界与行为 |
| --- | --- |
| RESP | 单回复 1MiB、单请求编码 128KiB、行头 4096B；超限拒绝，不能把 UI 截短说成驱动内存无限安全 |
| Key / 扫描 | 原始 Key 最多 64KiB；单页最多 4096 项、结果 JSON 最多 1MiB；Key 缓存最多 5000 项/2MiB DTO 编码大小；分批/去重不代表静态全库快照 |
| String / Hash 等值预览 | 单值窗口或前缀最多 64KiB；UTF-8 边界带有限上下文。Hash/List/Stream 大项先受完整 RESP 回复预算约束，不是服务器流式字节分页 |
| List / ZSet rank / GEO | 每页最多 100；GEO Key+成员原字节总和最多 96KiB。完整成员身份超限拒绝，不静默截短请求 |
| Stream | 每页最多 100 消息、字段 occurrences 合计最多 4096、结果 JSON 1MiB；不消费 consumer group |
| RedisJSON | 当前路径匹配结果最多 64KiB，匹配类型最多 4096；完整 JSONPath 匹配数组，超限拒绝后缩路径，无伪造字节分页 |
| Bitmap | 复用 String 有界字节读取，按 bit 偏移解释；大 bitmap 不整体读取，末尾/无数据不伪造零 |
| HLL | 显式只读估算，不枚举成员；采用重复同 Key 的 PFCOUNT union 路径避免单 Key 缓存写回；结果为近似数量 |
| TimeSeries | 每页最多 100 样本，结果 JSON 1MiB，缓存 5000 行/2MiB；时间戳和值保留文本。样本和 INFO 非原子快照 |
| Bloom | 单个待查项最多 4096 原始字节；返回不存在/可能存在，实际假阳性已验，不能宣称确定存在或枚举成员 |
| 请求生命周期 | 连接 8 秒、每次读取共享 10 秒截止、每连接最多 16 项队列；取消旧回复排空可能暂占队列，手动重试，不自动重连/重放 |

最终包真实轮覆盖 131073B String/集合长值、2MiB Bitmap、JSON 超预算根缩路径、GEO 超组合预算及 int64/uint64 边界。更多恶意 RESP/请求编码/缓存/目标代次的专项见版本管理中的 tests；当前不是无限大数据吞吐或完整 Redis 跨版本认证。

## 只读、清理和未覆盖范围

正式 transport 只允许 SELECT/SCAN/TYPE/PTTL 及各类型的显式读取命令，连接仅认证/PING；无任意命令入口。测试中的 SET、ACL、删除、转换、断线和模块样本写入仅来自自建管理员夹具。相关原生断言比较源 DUMP/JSON、绝对过期时间、Stream group/Pending；布局轮对 12 个源逐一比较，恢复轮核对原二进制 Key/value/expiry。读取不是跨命令原子快照，业务并发变化需刷新。

五轮自建 DSH/Chrome、Redis、证书、UUID 目录全部退出/回收；Host socket 均回管理员基线，恢复代理停止。没有启停用户服务、访问业务库、清理 C 盘或修改日常 DSH profile。早期 16 Git 快照及 18 两对异常目录的清理曾被自动审批拒绝，仍按已有记录保留；本票未重试删除或声称历史目录全清。

已验证环境限上述 rc.2 CLI/Web 与 Redis 8.2.6 指定模块。DSH 桌面外壳核心、其他宿主/Redis/模块版本、TLS 慢链路取消、Cluster/Sentinel/SSH 不属于本次实测。Cuckoo、Redis 扩展的其他命令/写入、自动刷新、控制台等未实现能力不能由本票推出。P1 仍有 8 票，按原图继续。

## 复现入口

随包 README 有安装和逐步使用说明。开发环境先设置 TEMP/TMP 到 E 盘测试目录、`NODE_OPTIONS=--max-old-space-size=512 --max-semi-space-size=4`，使用 `pnpm check` / `pnpm pack --pack-destination .scratch/artifacts`。为避免同版本包缓存，复制 tgz 为 SHA 文件名，再用固定 CLI 的 `plugin --profile web add <SHA绝对路径> --ignore-scripts --cache-dir <E盘缓存>`，仅设置独立 `DSH_HOME=.scratch/runtime/dsh-home`。

真实脚本公共环境：`REDIS_TEST_BACKEND=wsl-image`、`REDIS_TEST_PYTHON=<现有Python绝对路径>`、`DSH_CLI_ENTRY=<指定rc.2的lib/bin.js绝对路径>`、`REDIS_BROWSER_EXECUTABLE=<Chrome绝对路径>`；不安装 Docker 或启停已有服务。运行 `node scripts/smoke-dsh.mjs` 时显式开启 CONNECTIONS/KEYS，再按下列模式选择环境变量（均前缀 `REDIS_SMOKE_`，值 `1`；未列模式关闭）：

- 全类型会话：RELEASE、SESSIONS、STRINGS、HASHES、LISTS、SETS、ZSETS、STREAMS、JSON、BITMAP、GEO、HLL、TIMESERIES、BLOOM。
- TLS 资料双阶段：TLS、PROFILES。脚本自动保存/关闭自建 Host/重启/恢复/删除自建资料。
- 布局：LAYOUT；恢复：RECOVERY，分别串行运行，各有自己的独占夹具与报告。
- 资源核对：`node scripts/verify-release-package.mjs`，读取当前 tgz、隔离安装目录和实际 CLI peer，不启动服务。

脚本和测试均受版本管理；原生 RPC route 故障注入只作用于测试浏览器并在 finally 恢复，不混称为 Redis 服务器实际卸载模块或停止计算。每轮报告保留自己的 SHA、时间、owner、检查列表、错误和清理状态。
