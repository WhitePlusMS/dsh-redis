# 当前开发包检查：2026-11-04

## 对象与范围

- 打包源码提交 `90acc2c`；包版本 `dsh-redis@0.1.1`，声明目标 DSH `0.2.1-rc.5`。
- 本机归档：`.scratch/readonly-pack-90acc2c-20261104/dsh-redis-0.1.1.tgz`。
- SHA-256：`7c1cd9d90e38cd7234571ad06878b4556f917571383734ae1879d03ef747251c`。
- 这是一份本地开发包，并非发布、推送或日常 profile 已安装的证明。

## 已完成的检查

- `pnpm check` 对当前源码完成类型检查、构建和一次完整测试：79 个测试文件、617 项全部通过。此前首次完整检查有两项旧测试仍假定忽略无效参数，修正测试输入后重新执行完整检查通过；这些检查不等同用户模型对话。打包时使用 `--config.ignore-scripts=true`，未重复执行 prepack；完整检查后重新核对归档与源码/构建一致。
- 归档包含 135 个文件。除 `package.json` 的打包转换外，与对应源码或构建文件逐字节一致；随包 Markdown 的本地文件链接检查无缺项。AI 使用说明已包含在包内。
- 对 135 个文件检查私钥头、常见 `sk-` token 和带密码的 Redis URI 模式，没有候选。模式检查不等于对所有可能的秘密或业务数据作出穷尽保证。
- 单独创建空的 `.scratch/readonly-install-90acc2c-20261104` 作为 `DSH_HOME`，不复制日常配置或模型凭据、不启动服务。DSH CLI 能安装包，组合配置包含 `ui-redis`；已安装的 135 个文件与归档逐字节一致。卸载后包路径消失且组合配置不含 `ui-redis`。
- 空 profile 的 pnpm 报告 DSH/React peer 缺失；从本机 CLI 的解析入口核对到 12 个 Host 相关依赖与声明一致（Cordis `4.0.5`、其余 `0.2.1-rc.5`）。`dsh-client-ui-slots` 在源码中仅作类型引用；React 由浏览器运行时提供，实际运行身份尚待日常 DSH 验证。依赖可解析和组合配置存在不等于插件已加载运行。
- 较早源码 `4eafb8d` 曾通过独立 Redis `8.2.6` 六类诊断报告、明确名称查询范围及无损文本专项；这些证据不自动代表当前源码重新实测。
- 使用当前代码的真实 ToolRuntime 和独立 Redis `8.2.6`，在没有侧栏选择的情况下直接读取六种基础类型，并验证 String 截断、缺失 Key、Stream 重复字段、数据与 TTL 不变及写命令计数不增长；不适用的 String MATCH 在 GETRANGE 前被拒绝。独立实例已停止。脚本为 `scripts/smoke-ai-six-types.mjs`，不等同真实模型对话。
- 使用独立 Redis `8.2.6` 的临时 ACL 账号及真实 ToolRuntime，核验允许的 String 读取和被拒绝的 HGET、SCAN；权限拒绝未伪装成空结果，结果未包含原始拒绝信息或临时密码，测试数据与 TTL 未变化，独立实例已停止。脚本为 `scripts/smoke-ai-permissions.mjs`，不等同真实模型对话。
- 使用真实 ToolRuntime 和独立 Redis `8.2.6` 验证切 DB 后同名 Key 的读取及会话隔离；无效 DB 和 SELECT 权限拒绝保留原 DB，测试数据与 TTL 未变化，独立实例已停止。脚本为 `scripts/smoke-ai-database.mjs`，不等同真实模型或实际侧栏验收。

## 仍待完成

用户明确要求暂不重启日常 DSH。当前包尚未安装到该 profile，也未在其实际 Host/Client 和用户模型中逐项验证。需等用户通知后按原方式处理日常 DSH，再使用隔离合成数据检查当前包加载、动作通道、预算、连接、直接读取、筛选、诊断、报告以及失败和取消等约定场景。历史模型验收只证明对应的旧构建；见 [此前记录](user-questions-real-model-2026-11-04.md)。

SSH、mTLS、Sentinel、Cluster 和 Redis 扩展模块仍按实际环境需求单独设计验证，不以此处结果声称支持。Redis 写入、TTL 变更、删除和消费推进仍暂缓。
