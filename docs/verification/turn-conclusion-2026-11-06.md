# 工具结果与回合结束接口核对

日期：2026-11-06。项目核对基线 `58eb689`；本次没有修改应用代码、模型配置或日常安装包。

## 用户要求与结论

用户明确希望同时保留可靠的结果卡片和 AI 自然语言解释。现有 `RedisToolEvidence.tsx` 根据当前工具记录展示结果，`tool-evidence.ts` 不读取当前界面状态或模型正文；这条事实展示路径保留。AI 继续组织解释和多步调用，生成文字的准确性仍需单独核对。

已安装 DSH `0.2.1-rc.5` 提供 `ToolRunContext.concludeTurn()`，但它是回合控制接口，不是事实校验器。**不把它自动加到普通 Redis 读取上。** 查询类型后仍可能需要读取字段、继续分页、保存用户要求的报告或解释结果；插件无法仅凭某个工具正常返回判断整个问题已经解决。

## 实际验证

临时目录：`C:\Users\admin\AppData\Local\Temp\dsh-redis-turn-conclusion-20261106`。

- `probe.mjs`：直接加载日常 DSH 安装目录下的 Cordis、SystemPrompt 和 ToolRuntime，注册合成工具并调用；不依赖工作区的模拟执行器。
- `verification.json`：记录实际 SDK 版本、各结果的 `isError` 与 `concludesTurn`。
- `RESEARCH_LOG.md`：记录修改原因、执行范围、结果与清理。
- 脚本 SHA-256：`03f48877ced1eca3c2c84544de666f86d5ad107ba61b1b0cf4ab56caffc3d5c8`。

`node --check probe.mjs` 与 `node probe.mjs` 均退出 0；下列 5 项断言通过。

| 合成调用 | SDK isError | concludesTurn 为 true | 含义 |
| --- | --- | --- | --- |
| 普通正常返回 | false | 否 | 不主动结束回合 |
| 调用 concludeTurn 后正常返回 | false | 是 | 成功结果携带结束标记 |
| 调用 concludeTurn 后抛出异常 | true | 否 | 没有成功结束标记 |
| 调用 concludeTurn 后正常返回 `{ state: 'failed' }` | false | 是 | SDK 不判断插件业务状态是否成功 |
| 调用 concludeTurn 后取消并检查 signal | true | 否 | 取消不携带成功结束标记 |

本次仅执行 ToolRuntime，不执行完整 AgentLoop、浏览器、Redis 或模型请求；不能把这些断言写成真实对话已停止或模型准确性已通过。Context 在 `finally` 中释放，没有创建后台服务。

## 已核对的安装源码

根目录：`C:\Users\admin\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai`。下列路径相对此目录，版本均为 `0.2.1-rc.5`。

- `dsh-tools/lib/types/index.d.ts:314`：接口只标记成功结果为本轮终结；失败结果没有该标记。
- `dsh-tools/lib/types/index.js:808`、`:1223`：记录执行身份，并在正常结果投影时携带 `concludesTurn`。
- `dsh-agent-loop/lib/index.js:570`、`:1166`：提交工具结果并汇总结束标记，随后将本步返回为 completed；已计划的同批工具并非因为某项有标记就全部取消。
- `dsh-agent/lib/types/runtime-types.d.ts:370`：已进入 next-step 的附加上下文或新 steering 不被结束标记直接丢弃。这一并发语义本轮只检查契约，未动态验证。
- `dsh-llm/lib/types/index.d.ts:34`：有 `llm/stream` waterfall，但并非 Redis 专属的答案事实校验接口。存在流式扩展点不能证明可以可靠校验任意自由文本，也不构成修改全局模型输出的依据。

## 后续工作边界

维持“工具记录可核对 + AI 解释”的现有产品方向，继续按任务清单核对具体用户场景。保留缺失 Key、TTL、内存采样、选区来源等已发现的生成文字错误，不因本次接口调查而改为通过。正文中的 `<think>` 与 Redis 数据准确性分别追踪；本轮不删除模型文本、不改服务配置，也不添加另一套聊天或结果存储机制。
