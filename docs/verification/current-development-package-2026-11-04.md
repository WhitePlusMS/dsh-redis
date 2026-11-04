# 当前开发包检查：2026-11-04

## 对象与范围

- 此记录对应较早的源码提交 `4eafb8d`，不包含后续的读取参数校验修复；当前源码需要重新打包。包版本 `dsh-redis@0.1.1`，声明目标 DSH `0.2.1-rc.5`。
- 本机归档：`.scratch/readonly-pack-4eafb8d-20261104/dsh-redis-0.1.1.tgz`。
- SHA-256：`4135363b94a45f49a73f1ebc794fab02352a3d6d5be9e0df43a37eb0ec90418f`。
- 这是一份本地开发包，并非发布、推送或日常 profile 已安装的证明。

## 已完成的检查

- `pnpm pack` 执行 `prepack`：类型检查、构建、79 个测试文件和 610 项测试全部通过；包含真实浏览器、真实 DSH ToolRuntime/宿主流和合成数据测试，不等同用户模型对话。
- 归档包含 135 个文件。除 `package.json` 的打包转换外，与对应源码或构建文件逐字节一致；随包 Markdown 的本地文件链接检查无缺项。AI 使用说明已包含在包内。
- 对 135 个文件检查私钥头、常见 `sk-` token 和带密码的 Redis URI 模式，没有候选。模式检查不等于对所有可能的秘密或业务数据作出穷尽保证。
- 单独创建空的 `.scratch/readonly-install-4eafb8d-20261104` 作为 `DSH_HOME`，不复制日常配置或模型凭据、不启动服务。DSH CLI `0.2.1-rc.5` 能安装包，组合配置包含 `ui-redis`；已安装的 135 个文件与归档逐字节一致。卸载后包路径消失且组合配置不含 `ui-redis`。
- 空 profile 的 pnpm 报告 DSH/React peer 缺失；从本机 CLI 的解析入口核对到 12 个 Host 相关依赖与声明一致（Cordis `4.0.5`、其余 `0.2.1-rc.5`）。`dsh-client-ui-slots` 在源码中仅作类型引用；React 由浏览器运行时提供，实际运行身份尚待日常 DSH 验证。依赖可解析和组合配置存在不等于插件已加载运行。
- 在本任务独立的 Redis `8.2.6` WSL 镜像上，通过真实 ToolRuntime 采样并回读服务器概况、慢日志、客户端、Key 内存、String 比较和 Stream 消费组报告；报告排除测试凭据及合成值，测试 Key 未变化，独立 Redis 已停止。专项还验证两次采样后保存第一次结果不会重新读取 Redis，取消不会留下可保存的采样。
- 同样使用独立 Redis `8.2.6` 验证缺少 MATCH 时不发送 SCAN、明确前缀可查询，非法 Key/MATCH 文本不触发 TYPE，而合法替换字符和二进制 Key 可准确读取；测试数据及到期时间未变化，独立实例已停止。
- 使用当前代码的真实 ToolRuntime 和独立 Redis `8.2.6`，在没有侧栏选择的情况下直接读取六种基础类型，并验证 String 截断、缺失 Key、Stream 重复字段、数据与 TTL 不变及写命令计数不增长；独立实例已停止。脚本为 `scripts/smoke-ai-six-types.mjs`，不等同真实模型对话。
- 使用独立 Redis `8.2.6` 的临时 ACL 账号及真实 ToolRuntime，核验允许的 String 读取和被拒绝的 HGET、SCAN；权限拒绝未伪装成空结果，结果未包含原始拒绝信息或临时密码，测试数据与 TTL 未变化，独立实例已停止。脚本为 `scripts/smoke-ai-permissions.mjs`，不等同真实模型对话。
- 使用真实 ToolRuntime 和独立 Redis `8.2.6` 验证切 DB 后同名 Key 的读取及会话隔离；无效 DB 和 SELECT 权限拒绝保留原 DB，测试数据与 TTL 未变化，独立实例已停止。脚本为 `scripts/smoke-ai-database.mjs`，不等同真实模型或实际侧栏验收。

## 仍待完成

用户明确要求暂不重启日常 DSH。当前包尚未安装到该 profile，也未在其实际 Host/Client 和用户模型中逐项验证。需等用户通知后按原方式处理日常 DSH，再使用隔离合成数据检查当前包加载、动作通道、预算、连接、直接读取、筛选、诊断、报告以及失败和取消等约定场景。历史模型验收只证明对应的旧构建；见 [此前记录](user-questions-real-model-2026-11-04.md)。

SSH、mTLS、Sentinel、Cluster 和 Redis 扩展模块仍按实际环境需求单独设计验证，不以此处结果声称支持。Redis 写入、TTL 变更、删除和消费推进仍暂缓。
