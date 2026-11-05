# 开发包检查：2026-11-04

本记录对应 2026-11-04 的 `90acc2c` 开发包。2026-11-05 的后续源码、安装与真实模型验收见[新记录](user-questions-real-model-2026-11-05.md)。

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
- 当前源码通过独立 Redis `8.2.6` 与真实 ToolRuntime 验证四类服务器概况及慢日志、客户端、Key 内存、String 比较和 Stream 消费组报告；回读概况报告时核对原采样字段和时间，并检查合成敏感值及身份未进入报告，所核对的测试 Key 未变化。脚本为 `scripts/smoke-ai-report.mjs`。
- 当前源码通过独立 Redis `8.2.6` 与真实 ToolRuntime 验证明确定义 MATCH 的名称查询和有界 Hash 精确筛选，覆盖多批结果、缺字段、类型不符以及不返回其他字段值；抽查测试 Key 及写命令计数未变化。脚本为 `scripts/smoke-ai-hash-filter.mjs`。
- 当前源码通过独立 Redis `8.2.6` 与真实 ToolRuntime 验证显式 Hash 字段、二进制 Key/字段、非法文本拒绝及无损文本身份；所核对的测试 Key 和绝对过期时间未变化。脚本为 `scripts/smoke-ai-explicit-hash.mjs`。上述独立实例均已停止，均不等同真实模型对话。
- 使用当前代码的真实 ToolRuntime 和独立 Redis `8.2.6`，在没有侧栏选择的情况下直接读取六种基础类型，并验证 String 截断、缺失 Key、Stream 重复字段、数据与 TTL 不变及写命令计数不增长；不适用的 String MATCH 在 GETRANGE 前被拒绝。独立实例已停止。脚本为 `scripts/smoke-ai-six-types.mjs`，不等同真实模型对话。
- 使用独立 Redis `8.2.6` 的临时 ACL 账号及真实 ToolRuntime，核验允许的 String 读取和被拒绝的 HGET、SCAN；权限拒绝未伪装成空结果，结果未包含原始拒绝信息或临时密码，测试数据与 TTL 未变化，独立实例已停止。脚本为 `scripts/smoke-ai-permissions.mjs`，不等同真实模型对话。
- 使用真实 ToolRuntime 和独立 Redis `8.2.6` 验证切 DB 后同名 Key 的读取及会话隔离；无效 DB 和 SELECT 权限拒绝保留原 DB，测试数据与 TTL 未变化，独立实例已停止。脚本为 `scripts/smoke-ai-database.mjs`，不等同真实模型或实际侧栏验收。

## 仍待完成

截至本记录时用户要求暂不重启日常 DSH，该包尚未安装到日常 profile，也未在实际 Host/Client 和用户模型中逐项验证。后续用户授权启动 DSH 并使用真实 Redis 的结果见[2026-11-05 记录](user-questions-real-model-2026-11-05.md)；更早模型验收见[此前记录](user-questions-real-model-2026-11-04.md)。

SSH、mTLS、Sentinel、Cluster 和 Redis 扩展模块仍按实际环境需求单独设计验证，不以此处结果声称支持。Redis 写入、TTL 变更、删除和消费推进仍暂缓。
