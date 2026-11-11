# AI 写入 MVP：DSH 确认契约核查

日期：2026-11-11。范围：项目安装的 DSH 0.2.1-rc.5 宿主包、已安装 Web 客户端包及可复现的进程内合成探针。没有调用真实 Redis，也没有把自动化模拟说成人工确认验收。

## 已核实

- 项目现有 AI 工具使用 `ctx.tools.register(defineTool(...))`，会话身份取自 `exec.agent.session.id`。保持 DSH 原生工具和 Typert Host/Client 路径，不另造 MCP 服务或以模型参数充当会话身份。
- 已安装的 `@deepseek-ai/dsh-user-approval` 的 `request()` 返回 `allowed-once`、`rejected`、`cancelled` 或 `unavailable`；`approval/decided` 审计只有请求 ID 和结果，没有应答者身份。请求经 `approval/request` waterfall，可由人或机器应答。参见 [DSH 官方审批服务](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/user-approval/README.md)。
- 已安装的 `@deepseek-ai/dsh-client-ui-approval` 文档说明浏览器界面通过同一 Agent-scoped Remote Event 回答。已安装的 `@deepseek-ai/dsh-acp` 是面向程序的自动化接口，其实际安装包将 ACP 的 `allow-once` 映射为同一个 `allowed-once`。因此不能把通用返回值本身当成人工来源证明。
- `@deepseek-ai/dsh-api-remote-access` 说明参与回答转发的 waterfall 限 owner Peer；但 owner 是访问权限身份，文档并未把它定义为真人证明，不能仅凭 owner 断言人工确认。
- 已安装的 `@deepseek-ai/dsh-user-questions` 是另一条标准提问接口：`ask()` 对带 Agent 的请求校验当前活动根 Agent，但通过 `user-questions/request` waterfall 接收结构化答案；`plan-review` intent 只改变展示。进程内合成探针注册根 Agent 替身和程序应答者后，接口返回选中的 `allow`，答案不含来源字段。因此仅换成提问接口或根 Agent 检查也不能证明回答者是真人。参见 [官方提问服务](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.1-rc.5/packages/interaction/user-questions/README.md)。
- 进一步核查标准对话消息：已安装的 `dsh-api-session-controller` 将 `session/prompt` 请求写为 `source.kind = 'user'` 并附 `rpcId`；其类型说明 `requestId` 由客户端生成。已安装的实验性 auto-review 将该组合视作 shipped-Web human instruction，但普通 Remote 调用也可由获得相应访问权限的程序发起；这里的 `rpcId` 本身是请求关联标识，不是人工身份或用户实际审阅提案的证明。可以继续研究以此绑定一次明确输入，但不能将其直接当作本计划的已验证人工确认凭证。
- 当前 `dsh --version` 为 `0.2.1-rc.5`；`dsh web --dump-config` 显示当前配置包含审批服务与 Web 审批界面，并记录默认权限预设。配置清单不证明某次实际应答来自谁，也不等于已完成实机交互验证。

## 可复现探针

在项目根目录运行 `node scripts/probe-dsh-approval-provenance.mjs`。该探针加载实际安装的 DSH ApprovalService，使用两个独立的合成会话与程序化应答者，比较返回结果及去除随机 ID 后的审计字段。两者均返回 `allowed-once`，`approval/decided` 的非 ID 字段只有 `outcome`。

该探针是进程内合成验证，不是完整 DSH profile、浏览器 UI、真实模型或真人点击测试；不能据此声称标准 UI 无法使用。现阶段仍需证明：真实部署下有效确认入口的调用边界、所展示的完整提案、来源与 Host 单次消费如何绑定。单靠通用审批结果或现有 UI 操作回执都不足以完成该证明。

## 隔离 Redis 基础探针

使用项目自有 WSL 镜像夹具及随机实例，执行 `REDIS_TEST_BACKEND=wsl-image` 下的 `node scripts/probe-redis-write-mvp.mjs`：Redis 8.2.6 中，String 的 WATCH/MULTI/SET/EXEC 成功并通过另一个客户端回读，Key 无 TTL；Hash 字段无字段 TTL，同一 Hash 的其他字段在 WATCH 后变化时 EXEC 返回冲突且目标字段不变；已有字段的 HSET 事务回执为 0，并经另一个客户端回读成功。夹具报告进程停止且目录清理完成。

追加验证：其他字段在 WATCH 前变化而目标字段未变时，事务仍可提交，证明这种变化不能由目标字段比较发现；为目标 Hash 字段设置 TTL 后，普通 HSET 覆盖使字段 TTL 清除。这两项均使用合成 Key。

这只是 Redis 服务端基础语义探针：不覆盖插件连接独占、授权、断线、取消或真实 DSH/模型链路，不代表 MVP 已实现或通过验收。

## 当前处理

按 [MVP 计划](../DSH_AI_REDIS_WRITE_PLAN.md)，在可验证的人工确认链路及真实宿主验收完成前保持写入关闭。继续审查 DSH 标准 UI/Remote 接口及现有插件链路；不改变宿主审批策略、不把机器应答当人工批准。
