# 当前交付与工具验收边界

更新：2026-11-06。按用户确认，**本轮以“工具正常调用、准确返回信息、正确交给模型”为标准收尾。** 模型收到结果后的自由回答、推断和措辞不作为插件缺陷或交付阻塞。当前标准见[工具验收清单](DSH_AI_READONLY_TASKS.md)。

## 当前日常安装

- 应用源码：`69c63d824f500466e79d34a2c1ea8b602f95c851`，日常 `web` profile 已安装。
- 包：`.scratch/artifacts/explanation-20261106/dsh-redis-0.1.1-b4e9a2af74f5e4dfbbfc587d62b5b40d15f94446004c54951be9eaf5996498ee.tgz`；SHA-256 为文件名中的完整哈希。
- 默认打包通过严格类型、构建和 **84 个测试文件 / 698 项测试**；143 个安装文件与归档一致，118 个运行文件、15 个 Host peer、3 个依赖校验通过。
- 交付时日常 DSH 为 `127.0.0.1:3080` / PID43120，会话“仅可查看”。本次仅改源码仓库文档，不重打包、不替换已安装归档、不重启服务。没有推送或公开发布。
- 原生卡片和 AI 解释继续保留；`redis_viewer_answer` 汇总实际记录，不重新查询，不调用 `concludeTurn()`。插件负责记录与传递，后续回答由 DSH/模型完成。

## 已有工具链路证据

当前包在真实 DSH / bzkj-LLM / 隔离 Redis 8.2.6 中完成：

- 广告值、TTL、缺失 Key、服务器概况及慢日志读取，原始结果、正文卡片和后续模型交互同时存在。
- 候选资料认证失败返回 failed/auth；失败前后原连接 ID 不变，随后成功读取 `fixture:string`。
- Hash 筛选两批完成，累计检查 18 次、匹配 4 次、匹配名称去重后 4 个，非 Hash/缺字段各 1、失败 0；计数及范围来自工具记录。

本机证据目录：`C:/Users/admin/AppData/Local/Temp/dsh-redis-model-contract-20261106/`。`explanation-pack.log`、`explanation-artifact.json`、`explanation-install-verification.json` 对应本包；`diagnostics-after-explanation.txt`、`auth-after-explanation.txt`、`filter-after-explanation.txt` 保存实际网页联调结果。模型回复仅辅助说明链路已运行，不作为数值正确性或解释质量的验收依据。

此前构建的六类型、JSON/TimeSeries/GEO/Bitmap/消费组、权限拒绝、定位刷新及连接竞态证据保留原版本边界，不能冒充当前包重新执行的结果：

| 工具范围 | 既有记录 | 保留的覆盖限制 |
| --- | --- | --- |
| 基础读取与查找 | [基础记录](verification/user-questions-real-model-2026-11-05.md)、[范围与拒绝](verification/intent-and-rejection-2026-11-06.md) | 未形成全部 ACL、取消及目标变化组合的当前包真实证据 |
| 筛选与汇总 | [混合筛选](verification/mixed-filter-permissions-2026-11-06.md)、[条件记录](verification/filter-condition-2026-11-06.md) | 取消、超限及并发组合未全部覆盖 |
| 诊断与报告 | [诊断边界](verification/diagnostic-evidence-boundaries-2026-11-06.md)、[诊断采样](verification/diagnostics-specialized-2026-11-06.md) | 仅覆盖已有采样及权限场景，不声称有跨系统或网络根因诊断能力 |
| 界面回执 | [刷新回执](verification/refresh-receipt-2026-11-06.md)、[用户中断](verification/refresh-user-interruption-2026-11-06.md)、[多页面](verification/multiple-pages-2026-11-06.md) | 真实后台 hidden、渲染后成功回执丢失尚无完整真实证据；不等于已证明产品失败 |
| 连接与环境 | [连接事务](verification/connection-transactions-2026-11-06.md)、[取消](verification/cancellation-error-2026-11-06.md)、[切库竞态](verification/connection-db-race-2026-11-06.md) | 未穷举缺凭据及并发组合；mTLS、SSH、Sentinel、Cluster 不在现有支持范围 |
| 专业数据 | [专业边界](verification/diagnostics-specialized-2026-11-06.md) | 模块缺失、上限、取消及并发的全部原生组合未覆盖 |
| 成品生命周期 | [独立安装与资料保留](verification/current-package-2026-11-06.md)、[案例来源](verification/enterprise-cases-research-2026-11-05.md) | 原生界面安装、运行中卸载、其他平台及整个 profile 的 peers 检查不能由已有 CLI 证据推定通过 |

这些限制如实保留，按用户决定留待实际需求另行处理，不继续扩展本轮验收。模型未复述元信息、虚构额外解释或回答不够好，不列入上表的插件待办。

## 问题归属

- 工具调用失败、数据或元信息错误、权限/范围越界、分页错误、卡片显示错误、结果未交给模型：检查并修复插件负责的环节。
- 正确结果已交给模型，模型仍误述数值、历史、命令或故障原因：属于模型使用效果，不作为插件交付阻塞，也不为此反复调整插件提示词或重跑同一问题。
- 宿主认证、模型服务、审查服务或推理文本格式问题单独定位；不能把它们直接记成 Redis 数据读取缺陷。此前 bzkj Off 配置与 think 观察仅保留为本机联调环境记录，不是插件保证所有模型输出格式的承诺。

## 收尾状态

临时 Redis 已退出，合成数据和消费组状态未变、无消费命令；自建无密码连接资料已删除，日常安装及服务保留。后台窗口人工配合请求已取消，不再自动重试。

旧安装快照及旧验收口径可在 Git `79f3cd3` 与 `docs/verification/` 查询。历史记录不改写；其中因“完整模型回答未通过”得出的未完成结论，不再决定当前插件验收状态。调整口径也不把未测工具场景改成已通过。
