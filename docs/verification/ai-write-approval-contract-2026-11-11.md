# AI 写入 MVP：DSH 确认契约核查

日期：2026-11-11。范围：项目安装的 DSH 0.2.1-rc.5 宿主与 Web 客户端包、进程内合成探针、独立 DSH Web 通道实验及隔离 Redis 8.2.6 夹具。未连接业务 Redis，也没有把自动化模拟说成人工确认验收。用户后续已明确不要求每次人工点击，当前权限要求以更新后的 [MVP 计划](../DSH_AI_REDIS_WRITE_PLAN.md) 为准；以下保留实验事实。

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

该探针是进程内合成验证，不是完整 DSH profile、浏览器 UI、真实模型或真人点击测试；不能据此声称标准 UI 无法使用。当前仍需验证真实部署的宿主策略、提案绑定、单次消费及实际展示；通用审批结果不区分人工和机器来源。

## 隔离 DSH Web 通道实验

使用本机 DSH `0.2.1-rc.5`，将 `DSH_HOME` 指向独立临时目录，基于官方 Web 模板创建 `write-probe` profile，通过 `--patch` 加载仅用于实验的临时 Host 插件。插件按官方 `ctx.tools.register(defineTool(...))` 注册工具，以 `ctx.approval.request` 展示固定的合成 Key、DB、前后值，并明确声明不可执行；未连接 Redis。为触发审批，实验插件通过 `ctx.agents.create()` 创建合成 Agent，并在测试会话中人为追加打开的 turn；没有调用模型。

在该临时 Web 实例中，用自动化浏览器选择测试会话，观察到官方审批界面完整显示合成预览与“拒绝/允许一次”按钮；浏览器自动化点击“允许一次”后，Host 的实际工具结果为 `outcome: allowed-once`、`executable: false`。该点击来自程序，不是真人，因此是程序化 UI 往返证据，不是人工确认来源证明，也不是可执行 Redis 写入测试。

测试会话界面同时显示 `session/not-found` 的历史加载错误；合成 Agent 和手动追加 turn 的构造不代表真实会话生命周期。不能把本实验作为插件已安装、完整产品流程、真实模型或人工验收通过。测试结束后关闭独立 DSH 进程，确认临时监听端口已释放；未改变日常 DSH profile。

## 隔离 Redis 基础探针

使用项目自有 WSL 镜像夹具及随机实例，执行 `REDIS_TEST_BACKEND=wsl-image` 下的 `node scripts/probe-redis-write-mvp.mjs`：Redis 8.2.6 中，String 的 WATCH/MULTI/SET/EXEC 成功并通过另一个客户端回读，Key 无 TTL；Hash 字段无字段 TTL，同一 Hash 的其他字段在 WATCH 后变化时 EXEC 返回冲突且目标字段不变；已有字段的 HSET 事务回执为 0，并经另一个客户端回读成功。夹具报告进程停止且目录清理完成。

追加验证：其他字段在 WATCH 前变化而目标字段未变时，事务仍可提交，证明这种变化不能由目标字段比较发现；为目标 Hash 字段设置 TTL 后，普通 HSET 覆盖使字段 TTL 清除。这两项均使用合成 Key。

这只是 Redis 服务端基础语义探针：不覆盖插件连接独占、授权、断线、取消或真实 DSH/模型链路，不代表 MVP 已实现或通过验收。

## 当前处理

按更新后的 [MVP 计划](../DSH_AI_REDIS_WRITE_PLAN.md)，实施时遵循 DSH 原生工具权限策略，不再将证明人工应答作为前置条件；仍不得改变或绕过宿主拒绝策略，也不能把机器应答当作人工批准。现阶段写入尚未实现或开放，需完成真实宿主和隔离 Redis 验收。
