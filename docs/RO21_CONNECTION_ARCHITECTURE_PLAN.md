# Redis 连接扩展技术方案草稿

状态：只读调研草稿，供审阅；不代表连接扩展已经实现或通过拓扑验收。该专题由实际连接环境需求触发，不作为直接查询、普通诊断或基础交付的统一前置。现行优先级、依赖及状态以[只读实施方案](DSH_AI_READONLY_IMPLEMENTATION_PLAN.md)和[任务清单](DSH_AI_READONLY_TASKS.md)为准。

## 目标与选型

每个可信 DSH 会话拥有一个由用户明确选择的 Redis 连接目标。建议在现有 `RedisTransport` 和 `RespDecoder` 上增加有界节点管理，并保持它们是唯一数据访问路径，不保留两套静默兜底。当前生产实现对单次请求限制为 128 KiB、响应 1 MiB、RESP 节点 8192 个、嵌套 32 层、队列 16 项；连接期限 8 秒，读操作总期限 10 秒。任何替代方案必须证明这些限制仍然有效。

项目锁定的 `redis@6.2.1` 使用 MIT 许可；当前源码中的生产连接仍使用自建传输，`createClient` 仅用于隔离测试夹具。现有依赖的存在不证明已经支持 Cluster 或 Sentinel。固定版 `@redis/client` 的本机解码器会按服务器声明创建数组并对接收块执行 `Buffer.concat`；目前未找到官方支持的解码前响应字节上限。其默认 RESP3 和普通整数 JavaScript `number` 也与当前 RESP2、64 位 `bigint`、二进制 `Buffer` 契约不同。因此不能直接替换传输层后，用解码完成后的结果截断来宣称保留当前防护；如以后采用该客户端，须先证明解析前限额、显式协议和类型映射、取消及结果语义均满足现有约束。

依据：[redis 6.2.1 包与许可证](https://github.com/redis/node-redis/blob/redis%406.2.1/packages/redis/package.json)、[固定版本命令选项](https://github.com/redis/node-redis/blob/redis%406.2.1/docs/command-options.md)。

## 连接模型与接口影响

- `ConnectionRequest`、`ConnectionSettings` 和 `ConnectionView` 拟使用严格的连接模式联合：单机、Sentinel（种子地址和主服务名）、Cluster（种子节点及可选地址映射）。TLS/mTLS 和 SSH 作为明确配置的传输组合，不能靠猜测自动识别。
- 同步修改共享 RPC schema、资料存储、连接表单、状态展示、`RedisLink`、`RedisConnections`、读器目标校验、AI 状态和连接相关测试。资料格式变更前应明确列出受影响字段、保存范围和回退方式；不静默覆盖历史资料。若新 schema 拒绝旧格式，应如实报告并保留原文件，不静默兼容或删除。
- Redis、Sentinel 和 SSH 认证分别处理。密码、私钥和口令不进入已保存连接资料、AI 工具参数、日志或状态输出；相关引用在连接结束、取消或失败后释放。不将 JavaScript 中释放引用表述为保证内存立即清零。
- 连接状态向界面和 AI 返回模式、会话状态、代次和适用的覆盖信息。节点和环境信息按实际需要最小化，不输出原始认证配置、未经选择的数据或服务器错误原文。

## 公共安全与生命周期契约

每个会话维护连接代次和拓扑代次。显式换目标、重连、发现主节点变化或无法安全续接的拓扑变化时，使旧选择、UI/AI 游标和在途动作失效。排队前、实际发送前和响应返回后复核会话、目标及代次，丢弃迟到结果。

取消保证调用方停止等待和尚未发送的命令不再发送；已发出的命令需要有界排空响应或在期限到达时关闭所属连接，不能声称 Redis 已停止执行。并发队列、单次响应、总耗时、节点数、重定向次数与 AI 预算同时受限；达到上限、节点失败或拓扑变化时，必须返回明确的失败、失效或部分覆盖，不能冒充完整结果。

现有命令枚举是第一层约束，后续还应集中校验允许的命令及各参数。拓扑发现、`ROLE` 和 `ASKING` 仅能由内部固定流程按需要执行，不暴露给模型作为任意命令入口。用户明确暂缓的 Redis 值、TTL、删除及消息消费状态修改仍不进入范围。对外错误使用固定类别，不透传原始服务端错误或凭据。

## mTLS

复用 Node `tls.connect` 的证书、私钥、CA 和口令能力，始终启用服务端证书链和目标身份验证。SNI 使用主机名；对于 IP 目标需核验相应 IP SAN。经 SSH 回环转发时，仍须验证原 Redis 目标身份，不能将回环地址误当成原服务器身份。发现的新节点和重定向连接也必须继承认证、TLS 策略与目标身份校验。

依据：[Node.js 22.22.1 TLS 文档](https://nodejs.org/download/release/v22.22.1/docs/api/tls.html)。

## SSH 隧道

候选依赖为 `ssh2@1.17.0`（MIT）；其安装脚本和可选原生依赖需要先做 Windows 成品、无原生编译环境和许可证清单验证，才能确定采用。必须显式配置 `hostVerifier` 验证用户已确认的 host key：该库未配置时默认自动接受，不能使用这一默认值。

按用户指定的远端 Redis 地址，通过 `forwardOut` 建立本地回环隧道；SSH 与 Redis 认证分开。隧道监听器、转发流、连接、定时器及相关 socket 归当前会话所有，取消、认证失败、断开和卸载均只释放该会话所属资源。Cluster 多节点与 SSH 组合需要明确各节点的转发和地址映射，未经隔离拓扑实测不声明支持。

依据：[ssh2 1.17.0 文档](https://github.com/mscdex/ssh2/blob/v1.17.0/README.md)、[固定版本包信息](https://github.com/mscdex/ssh2/blob/v1.17.0/package.json)。

## Sentinel

在固定的种子数、节点数、总期限及命令预算内，依次通过独立 Sentinel 连接执行 `SENTINEL GET-MASTER-ADDR-BY-NAME`，并对发现的目标执行 `ROLE` 校验。区分全部 Sentinel 不可达、主服务名未知、认证失败、角色不匹配和读取失败；不发送管理或 failover 命令。

每次重新连接前重新发现目标；主节点变化使旧游标和选择失效，不把旧主节点的 SCAN 游标带到新主节点。Sentinel 与 Redis 的认证和 TLS 配置分别保存其允许持久化的非秘密部分。

依据：[Redis Sentinel 客户端规范](https://redis.io/docs/latest/develop/reference/sentinel-clients/)、[node-redis 6.2.1 Sentinel 文档](https://github.com/redis/node-redis/blob/redis%406.2.1/docs/sentinel.md)。

## Cluster

Cluster 模式只提供 DB 0，不发送 `SELECT`。在经校验且数量受限的节点和 slot 拓扑内路由单 Key 读取，设置明确的 MOVED/ASK 次数和总期限；发现或重定向得到的地址必须受拓扑及显式地址映射约束，并继承对应认证、TLS 和目标身份校验。

ASK 必须在同一个目标 socket 的独占队列租约内连续发送 `ASKING` 和对应的原只读命令，不能使用两个可能被其他请求插入的独立排队操作。连接中断、取消和超时后的状态应按所属连接安全处理。

全库 `SCAN` 维护各主节点独立游标及节点完成/失败记录，按原始 Key 字节去重。节点未访问、预算耗尽、迁移和拓扑变化须明确标为部分覆盖或游标失效；即使各节点游标完成，也只说明各次扫描的覆盖，不能称为原子快照或证明迁移期间没有遗漏。

依据：[Redis Cluster 规范](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)、[ASKING](https://redis.io/docs/latest/commands/asking/)、[SCAN](https://redis.io/docs/latest/commands/scan/)。

## 成熟客户端对照

固定版 node-redis 的 Cluster `rootNodes` 设置只用于发现，不自动继承到新发现节点；认证、TLS 和期限需放入节点默认配置。`sendCommand` 的 `isReadOnly` 及客户端 `readonly` 是路由或副本模式选项，不能防止应用发送写命令。默认重连、离线排队、`CLIENT SETINFO`、重定向次数和拓扑扫描均需显式约束，不能直接沿用默认值。它的取消和命令超时文档只保证尚未写入 socket 的命令可撤销。Sentinel 迭代器在主节点切换时会按条件中断，避免旧节点游标被发送到新节点。

依据：[固定版本 Cluster](https://github.com/redis/node-redis/blob/redis%406.2.1/docs/clustering.md)、[Sentinel](https://github.com/redis/node-redis/blob/redis%406.2.1/docs/sentinel.md)、[连接配置](https://github.com/redis/node-redis/blob/redis%406.2.1/docs/client-configuration.md)、[命令选项](https://github.com/redis/node-redis/blob/redis%406.2.1/docs/command-options.md)、[Redis READONLY](https://redis.io/docs/latest/commands/readonly/)。

## 建议实施顺序和验证矩阵

下列模式按实际环境需求独立选择、排期与验收，不要求按条目顺序全部实施；未使用或未验收的模式不得作为已支持内容，也不阻塞已完成的单机只读能力。某种模式成为实际连接前置时可提前实施。

1. 先明确连接模型、现有资料影响、命令门禁、代次、取消和预算契约，再实现公共改动。将节点、重定向和读取上限固定为可测常量，超限时明确返回部分状态。
2. 单机/TLS 回归六基础类型、二进制、64 位整数、取消、队列、错误、资源释放和 AI 预算。mTLS 覆盖有效证书、缺证书、错误 CA、错误主机名/证书及取消释放。
3. SSH 覆盖正确和错误 host key、认证失败、目标不可达、取消、连接释放、无孤儿及 TLS 组合；检查实际成品依赖加载和许可证。
4. Sentinel 覆盖两级不同凭据、部分及全部节点不可达、服务名未知、角色不匹配、主节点变化及旧游标失效。
5. Cluster 覆盖各主节点扫描、去重、MOVED/ASK、重定向上限、节点离线、拓扑变化、超大帧、二进制、64 位、取消和跨会话隔离。测试中确认 `ASKING` 与目标读取不能被其他命令插入。
6. 每项仅在隔离合成数据上进行真实 DSH 和模型验证；记录平台、实际运行方式、覆盖与未测组合。所有测试设施按所有权清理，不对用户 Redis 写入，也不停止日常 DSH 或 Redis。

## 尚待核验

- 自建 Sentinel/Cluster 路由在故障、迁移和复杂拓扑中的正确性，尤其是节点地址校验、拓扑变更观察、全局预算和 ASK 队列租约，须通过官方资料与隔离拓扑测试证明。
- 上述模式联合及资料格式的具体字段、旧资料保留方式、连接模式组合和错误 DTO 仍需结合实施时的实际代码定稿；本草稿不构成已发布的兼容或功能承诺。
- SSH 的可选依赖、打包和目标平台支持、mTLS 凭据生命周期，以及实际模型调用仍需逐项验收。
