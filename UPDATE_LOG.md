## 2026-11-06：交付状态收口，停止重复验证

- 文件：`docs/DELIVERY_STATUS.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。用户指出验证过度并询问交付时间，按最简和证据原则集中列出当前可用包、七项原任务、具体失败及未覆盖项，不删减任务或把开发包升级为全部通过。
- 核对：沿用已完成的 83 文件/684 项、12 项包校验和非空资料保留结果；提交绑定记录确认 7c79011 的 239 个源输入、136 个非 manifest 成品及 manifest 转换一致，日常运行产物无需替换。本次只做文档与链接检查，不重复完整测试。
- 真实界面限制：本轮通过合法 CDP 读取两个验收页的原生 visibilityState，切换后均为 visible，未取得后台 hidden 证据；后续标签列表已无这两个页面，没有重开或改写页面状态。模型解释、正文 think、真实后台和回执丢失及其他未覆盖项继续如实保留。
- 影响：仅整理交付入口及后续执行边界；没有改应用、模型配置或日常服务，不将收口文档视为原目标完成。后续仅对明确变更/失败或缺失场景做有针对性的验证，不继续循环相同模型提问。

## 2026-11-06：修正当前交付包校验入口

- 文件：`scripts/verify-release-package.mjs`、`docs/DEVELOPMENT.md`、`UPDATE_LOG.md`。旧脚本写死 0.1.0 归档、报告路径与 Cordis 4.0.4，不能验证当前包。遵循最简原则修正既有入口，要求显式归档、安装目录和新报告路径，不维护旧参数兼容。
- 修改与影响：检查归档条目类型、路径、重复项，以及相对成品白名单的完整文件集合和字节；SDK 按项目锁定的测试版本核对，不再特判旧 Cordis。报告以独占新建方式写入并记录 tracked 工作区状态，避免覆盖历史证据或把未提交源码伪装为固定提交。仅维护验证工具与开发说明，不改 Redis 应用功能、模型配置或日常安装。
- 实际核对中确认 `dsh-client-ui-slots` 是本插件的类型依赖，CLI 不提供它的运行时解析；单独核对构建版本，并检查输出 JS 中没有该包引用，不把跳过 Node 解析当作运行时版本通过。其他 Host peer 的缺失或版本不符仍失败，React 浏览器身份仍须原生验收。
- 验证：脚本语法、严格类型及默认打包检查通过，83 文件 / 684 项测试；实际独立安装包 137 文件匹配，13 个 Host peer、1 个类型依赖与 3 个直接依赖版本符合约定。正常包和 11 项失败场景共 12 检查通过，包含缺文件、额外文件、重复项、越界路径、符号链接、内容/manifest 改动、缺参数、报告覆盖及 SDK 错版。
- 交付边界：新增 `docs/verification/current-package-2026-11-06.md`，同步 `docs/DSH_AI_READONLY_TASKS.md`。独立 profile 的合成非空连接资料、MATCH 预设与诊断报告在卸载/重装/再次卸载后 3 个文件字节不变并回读一致；包已从该 profile 移除，没有启动 Host 或读取 Redis。新包仅开发说明变化，112 个运行文件与日常包一致，日常安装 137 文件仍匹配旧包；未重启日常服务，未把包校验当作模型或真实 UI 验收。

## 2026-11-06：保留结果卡片与自然语言解释，核对回合结束接口

- 文件：`docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md`、`docs/DSH_AI_READONLY_TASKS.md`、`docs/verification/turn-conclusion-2026-11-06.md`、`UPDATE_LOG.md`。根据用户“都有吧”的确认保留卡片与解释，遵循最简和单一职责原则，不新增聊天或存储机制，不给普通读取强制结束回合。
- 依据：已安装 DSH 0.2.1-rc.5 的 ToolRuntime 隔离验证共 5 项通过；尤其确认正常返回业务 failed 仍可携带结束标记，因此该接口不能代替业务完成判断或事实校验。AgentLoop 对标记的处理仅以源码核对，不声称真实模型回合已验证。
- 影响与验证：只更新方案和证据文档，产品、模型配置及日常包不变；临时脚本语法检查及运行均退出 0，Context 已释放，无新服务、Redis 查询或模型调用。`pnpm typecheck` 与 `git diff --check` 通过；此前回答错误与未验收项继续保留。

## 2026-11-06：缺失 Key 与 TTL 历史边界实测

- 文件：`docs/verification/diagnostic-evidence-boundaries-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。记录当前日常安装的新对话证据，遵循事实可核验和最简原则，不改应用、认证、模型或包。区分定点工具事实、引导后的回答、模型额外解释及尚未通过的真实回执注入。
- 验证：真实 DSH / bzkj-LLM 在无选中 Key、侧栏收起时读取缺失 Key 和 String TTL，工具结果与原始 JSON 一致；命令增量 TYPE/TYPE/PTTL/TYPE，无值读取、扫描或切库。模型正确区分 null 与 -1、当前与历史，仍有未经证实的历史断言和 SET 参数解释错误；依据官方文档逐项记录，不计为完整准确性通过。
- 临时验证：HTTP 代理因端口绑定认证拒绝而撤回，CDP 注入不受工具支持且未执行；未绕过。最终验收使用原始授权地址。原始结果/命令提取断言通过，初次临时依赖定位、证据目录及 DOM 缩进问题和恢复过程保留在本机记录。
- 影响与清理：22 条合成数据、绝对过期时间和数量一致；所有所属代理/夹具退出 0，测试页面关闭，相关端口释放，日常 DSH 3080 / PID20528 保留。只跑文档 diff 检查，不将未变产品的旧测试重复计为本轮通过。

## 2026-11-06：刷新渲染后的成功回执丢失回归

- 文件：`tests/ui-action-confirmation-browser.test.ts`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。现有丢回执测试覆盖定位动作，未覆盖刷新完成后的上行成功回执。遵循最简原则复用真实 Chromium、现有 React List 组件、Host 通道和 ToolRuntime，增加回执丢失后超时与断流两种场景，不修改产品或模型配置。任务清单记录局部覆盖及真实验收仍待完成的边界。
- 检查内容：刷新前后返回不同合成值，先确认预览实际显示新值，再等待超时或主动关闭 Host 通道；断言工具未误报 applied、保留读取可能发生的说明，且没有自动再次派发刷新或读取。Redis 读取使用合成函数，不是日常 DSH、真实 Redis 或模型验收。
- 验证：`pnpm typecheck` 通过；`pnpm exec vitest run tests/ui-action-confirmation-browser.test.ts` 共 15 项通过，45.29 秒测试耗时。新增两项分别返回 timeout / disconnected，刷新后的 fresh 仍显示，均只派发一次刷新且仅增加一次合成读取；工具保留未确认说明。测试自行关闭浏览器及 Host 上下文，本轮没有启动开发服务或替换日常安装包，真实 DSH 回执丢失与整体模型准确性仍待完成。

## 2026-11-06：刷新中用户取消、换 Key 与收起侧栏验收

- 文件：`docs/verification/refresh-user-interruption-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。补齐当前安装 ba1a4da 的三种真实交错，澄清取消立即停止等待、已发送响应仍需接收的既有约定；遵循最简与证据原则，不修改产品、SDK、模型配置或安装包。
- 验证：真实 DSH / bzkj-LLM 三轮均返回 stale，没有误报成功；换 Key 后显示新 List，迟到 String 未覆盖；取消和隐藏后不追加旧读取命令，原连接可手动刷新。重新展开会加载 DB/Key 元数据，不称完全无请求。此前等待器未识别的一轮只计超时。
- 隔离证据：已安装 SDK HTTP 载体与现有 String 读取器约 3.78 毫秒返回 cancelled，迟到响应接收及后续命令对齐通过；首次脚本清理 API 修正后退出 0。4 项现有传输专项通过，不冒充完整浏览器链路或整套回归。临时脚本、DOM、代理与截图分别存 user-actions/drain 两个临时目录，不随包。
- 影响与清理：仅扩充验收记录，不增加运行行为。22 条合成数据和绝对过期时间未变，代理与夹具退出 0、3386/11997 释放，日常 DSH 3080 / PID20528 保留。后台 hidden、渲染后回执丢失及整体模型准确性仍未完成。

## 2026-11-06：刷新回执修复安装与真实模型复验

- 文件：`docs/verification/refresh-receipt-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。记录源码 ba1a4da 的成品与三轮真实复验，并将旧安装基线标为当时状态；遵循证据分层与最简原则，不追加产品修改。
- 验证：完整打包 83 文件 / 682 项通过，137 个归档及安装文件匹配，69 个包内本地链接存在；SHA-256 为 `2571501b42abb699f6ca832377173e3e411debfb323610f82bd087e02d9c1386`。三轮成功、执行中页面断开、超时均按新回执解释读取事实，未再断言刷新未读取值；正文 think 和其他模型问题仍保留，完整节点未完成。
- 影响与清理：备份五份 profile 配置/锁文件后替换插件并重启同一 DSH Web，3080 新 PID20528，模型配置未变，peer 警告保留。22 条合成数据及绝对过期时间未变；8316 代理和 8624 夹具退出 0，端口释放。临时控制器、归档校验器及证据仅在 `dsh-redis-refresh-ba1a4da`，不随包或提交。两路源码审查已完成，唯一日志问题在 90d1752 修正。

## 2026-11-06：澄清刷新读取与界面断开回执

- 文件：`src/host/ai-ui-tools.ts`、`docs/AI_READ_USAGE.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。真实刷新验收中模型把“回执没有值”误述为“没有读取值”，并混淆界面通道与 Redis 连接。遵循最简和单一职责原则，仅补充现有工具描述及返回说明，不改读取、连接、预算、权限或回执状态机制。
- 修改与影响：成功回执明确已读取当前查看范围并显示；未确认回执说明读取可能已发出，不能声称未读取或撤回；disconnected 仅说明界面动作通道中断，不代表 Redis 连接状态。使用说明和任务状态同步；不能凭文字修改判定模型问题已解决。
- 源码验证：严格类型、构建及 4 文件 / 111 项相关回归通过，包含真实浏览器中的刷新、延迟、用户换选区、隐藏和显示格式确认。随后完整打包、安装及三轮真实模型复验见上方记录；不代表整体模型问题均已解决。

## 2026-11-06：刷新超时、执行中页面断开与恢复验收

- 文件：`docs/verification/refresh-interruption-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。补充真实刷新期间的交错证据；遵循最简原则，复用现有合成夹具和延迟代理，不改产品、模型配置或安装包。临时目录增加控制器和命令时间记录，用于确认读请求已发生后才关闭页面。
- 验证：三次 refresh 分别返回 timeout、disconnected、applied；关闭前保留旧值且明确读取中，恢复后完整 String 预览和自动刷新关闭。第一轮未成功执行关闭，按超时记录；第二轮确认暂扣后约 125 毫秒关闭，Redis 连接保持，释放响应后可继续使用，不误称套接字立即取消或 unknown 已通过。模型“未读取任何值”等无证据表述保留为缺口，完整节点不标为完成。
- 影响与清理：22 条合成数据、绝对过期时间和数量未变；人工断开，代理/夹具均退出 0，7733/8929 释放，日常 DSH 3080 / PID10476 保留。证据在 `dsh-redis-refresh-interruption-20261106`；控制器语法检查及文档 diff 检查，不重复未变产品的整套构建测试。

## 2026-11-06：多页面接收端与无接收端验收

- 文件：`docs/verification/multiple-pages-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。补齐双面板记录未覆盖的独立页面接收场景；遵循最简原则，复用现有通道，不改产品、安装包、模型配置或网络设置。
- 真实验证：两个可见页面承载同一会话时 show 返回 ambiguous，关闭第二页恢复 applied；发送后关闭唯一页面，实际 no_receiver；重新进入后的新请求 applied。四轮各一次 show，没有 Redis 连接/读取或自动重试。保存原始回执、两页 DOM 和 visibilityState，明确同引擎多页面不等于不同浏览器兼容性，全关闭发生在派发前不等于丢失回执，完整节点仍未完成。
- 影响与清理：只保留最终验收页；无自建服务需要清理，日常 DSH 3080 / PID10476 保留。临时证据位于 `dsh-redis-multiple-pages-20261106`。本轮执行文档 diff 检查，不把上一节点的 20 项回归重复计作新增测试，也不重复未变代码的编译/打包。

## 2026-11-06：双面板歧义、恢复与隐藏刷新验收

- 文件：`docs/verification/double-pane-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。补充当前安装 `622dce6` 的真实界面交错证据；遵循最简原则，复用已有面板判断和夹具，不修改产品代码、包、依赖或模型配置。
- 验证与影响：同一浏览器分栏双面板时，选区读取和刷新明确拒绝，show 返回 ambiguous；恢复唯一面板后读取完整 22 字节合成值，单次刷新 applied、自动刷新关闭；收起侧栏后刷新拒绝且未自动展开。相关 3 文件 / 20 项回归通过。未覆盖跨浏览器多接收端、断流和丢失回执，完整节点不标为完成；模型正文和标题显示问题保留。
- 清理：手动断开，22 个 Key 的 DUMP、绝对过期时间和数量未变；所属夹具退出 0，1908 释放，日常 DSH 3080 / PID10476 保留。临时视口已恢复，证据保存在 `dsh-redis-double-pane-20261106`。文档执行 diff 检查，不重复未变化代码的完整编译和打包。

## 2026-11-06：文档同步包与独立安装生命周期验收

- 文件：`docs/verification/delivery-package-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。记录源码 15efd5c 的实际归档、独立安装/卸载/重装和清理；复用官方 CLI，遵循最简原则，不改固定旧路径的验证脚本或日常 profile。
- 验证：默认 prepack 严格类型、构建及 83 文件 / 682 项通过，测试阶段 199.01 秒。137 个包文件按白名单核验，136 个源码/产物内容匹配；112 个运行文件与 622dce6 归档相同，69 个包内本地链接存在。新包 SHA-256 为 `43b11d18ebd1e9b0814b19ff52c9ff4e783ed2ad79974d5d262865154110ddf9`，包与校验文件保留在忽略的 artifacts 子目录。
- 影响与边界：独立 profile 两次安装的 137 文件均匹配，卸载移除依赖/bundle/包链接，空连接资料两次卸载及重装后均保持；只 dump 配置，未启动 Host、读取 Redis 或模型。最终测试包已卸载，没有凭据存储；日常 DSH 3080 / PID10476 保留原包。安装器仍有 peer 警告，不称其检查通过；新包原生加载、非空资料和完整场景未借此验收。
- 证据：临时目录 `dsh-redis-delivery-docs-20261106` 保存清单、逐字节校验和生命周期回执；本次记录不随包，不要求重复打包。文档执行 diff 检查，上一文档节点两路独立审查均 0 项。

## 2026-11-06：交付文档与现行能力同步

- 文件：`README.md`、`README.zh.md`、`CHANGELOG.md`、`docs/AI_READ_USAGE.md`、`docs/DEVELOPMENT.md`、`docs/INSTALLATION.md`、`docs/INSTALLATION.zh.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因与原则：交付说明仍有四工具、协议 14、旧检查数量以及当前包应使用旧 DSH 的过时表述。遵循最简原则，依据注册代码、预算入口、结果视图和既有包证据修正文档；不改运行代码、配置、依赖或历史 Release 记录。
- 修改与影响：补齐全部工具目录、扫描范围确认、原始读取记录、专业数据、额度恢复入口及模型解释边界；区分界面实际回执与人工范围确认、额度周期与消息轮次；开发说明同步协议 15 / 20 RPC / 32 工具。中英文安装说明区分旧 Release 与当前 0.1.1 的 DSH 0.2.1-rc.5 要求，README 引用 622dce6 的限定验收结果并保留 peer 警告和未完成项。
- 验证：七份随包文档的工具目录与源码 32/32 一致、无缺漏或虚构名称；16 个读取视图、20 个 RPC 及协议 15 核对一致。62 个本地链接目标在工作区及既有包目录布局内，12 个 main 源码链接目标在工作区存在；不代表远端链接可访问或已发布。结果存临时目录 `dsh-redis-delivery-docs-20261106/checks.json`，diff 检查通过。
- 范围：仅文档，未重跑不变产品代码的完整测试，未重新打包或替换已安装归档，未启动/停止服务；最终成品交付和完整模型/UI 异常验收仍未完成。

## 2026-11-06：候选连接等待期间手动切库验收

- 文件：`docs/verification/connection-db-race-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。新增当前安装 `622dce6` 的真实切库交错证据；复用现有候选事务与代理，遵循最简原则，产品代码、模型配置和包未变。
- 验证与影响：候选等待中切 DB1 后返回 stale，约 7.41 秒时关闭，原连接 ID 保留、代次递增；释放延迟后仍为 DB1，精确读取缺失；手动切回 DB0 后完整读回 22 字节合成值。模型没有重试，但“没有触碰连接”解释与代理 PING 证据冲突，完整节点未通过。
- 清理：22 条合成数据、绝对过期时间与数量未变，唯一临时资料已删，代理/夹具退出 0，5729/12524 已释放；日常 DSH 3080 / PID10476 保留。证据仅存 Windows 临时目录，文档执行 diff 检查，不重复未变代码的完整测试。
- 模型接口检查：模型列表 HTTP 200 且目标存在，未取得可用 OpenAPI 定义；不将此解释成服务故障或不支持推理字段。真实模型仍可调用，未猜参数修改配置。

## 2026-11-06：拒绝原因修复安装与模型响应字段核对

- 文件：`docs/verification/intent-and-rejection-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。补充 `622dce6` 的包哈希、安装一致性和真实拒绝记录，更新当前安装基线，产品代码未再变更。
- 验证：完整打包 83 文件 / 682 项通过，137 个安装文件与归档一致。新包原生 3* 查询被拒绝后明确显示拒绝、没有重复提问或扫描，模型仍混称拒绝/取消。此前 2* 查询在点击拒绝前已成功，不计为拒绝验收且不推测批准来源。新夹具22条数据及绝对过期时间未变、退出0，测试端口已释放，日常 DSH 3080 / PID10476 保留。源码两路独立审查均0项。
- 诊断：同一已配置 bzkj-LLM 的一次无业务数据流式请求返回 content 内 think 标签，没有独立 reasoning 内容；仅保存字段/计数/布尔摘要。服务地址、凭据、推理原文未写入结果，未改模型配置或宿主；此证据不能证明格式修复会消除事实错误。按职责边界将后续定位转到模型服务/适配层，不在 Redis reader 添加文本清理补丁。
- 范围：确认不可用仍只有运行器专项；一般语义准确性、完整节点和整体交付仍未通过。文档执行 diff 检查，不重复未变化的完整测试。

## 2026-11-06：查询拒绝与确认不可用分开报告

- 文件：`src/host/ai-query-scope.ts`、`tests/ai-query-scope.test.ts`、`docs/verification/intent-and-rejection-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：真实拒绝返回“未获确认”导致丢失拒绝含义，模型继续询问；源码将 rejected/unavailable 合并。遵循单一职责和最简原则，仅在现有确认入口区分结果，不新增权限或重试机制，不将策略拒绝一律说成用户拒绝。
- 修改与影响：拒绝明确停止本次查询，不可用提示确认通道问题，原取消/允许逻辑不变；真实运行器回归锁定原因区分及两路径零 Redis 命令、零预算准入。新测试先失败，修复后严格类型及 3 文件 / 105 项相关回归通过；新源码尚未安装。
- 真实证据：原安装 `315a6a5` 的未知词、否定、歧义和单字段读取按范围执行，原生拒绝也阻断扫描；模型仍有模式外 Key 推断和停止后重复提问，完整回答未通过。22 条合成数据、绝对过期时间及数量未变，自建实例已停止，日常 DSH 保留。详见新增记录；本次不读模型密钥或启动日志。

## 2026-11-06：取消修复安装与真实停止复验

- 文件：`docs/verification/cancellation-error-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。同步当前安装应用为 `315a6a5`，将过时的“当前安装”表述改为历史记录；补齐真实停止证据，产品代码不再变更。
- 原因与影响：离线错误复现不能替代日常 DSH 的停止结果；新增记录固定包哈希、137 个安装文件一致性、真实候选关闭和后续读取，并保留未覆盖场景，遵循最简原则，不扩大为全部验收通过。
- 验证：完整 prepack 检查退出 0，127 项专项为单独已观察计数；真实 DSH / bzkj-LLM 显示可读停止说明，候选约 0.49 秒关闭，原连接 ID/代次/DB 保持且合成值完整。22 条数据及绝对过期时间未变，唯一临时资料已删，代理/夹具退出 0、端口释放，日常 DSH 保留。安装器仍有跨插件 peer 提示；文档执行 diff 检查。

## 2026-11-06：取消错误文案修复

- 文件：`src/host/ai-reader.ts`、`tests/ai-cancellation.test.ts`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。先添加真实 DSH ToolRuntime 回归，覆盖对象取消原因、操作返回/抛错、未交付分页回滚、预算释放及普通错误保留；公共预算边界在 signal 已取消时转为固定错误说明，不输出原始原因，不声称连接交换或已发送命令已撤回。
- 原因：临时最小脚本复现 `Error: [object Object]`；直接返回的对照由宿主生成正常 aborted，标准 Error 原因也正常，定位到插件公共预算边界的原样抛出。新增测试的类型检查先通过，修复前两条运行器回归重现对象字符串，直接抛对象还触发断言库的错误匹配异常；修复后验证进行中。测试不连接 Redis、不改宿主，普通错误及现有 finally 清理不变。
- 验证：修复后严格类型、构建、5 文件 / 127 项相关回归及原始临时复现均通过，原复现现返回固定停止说明，inFlight=0。diff 检查通过；完整打包与日常 DSH 安装、真实停止复验尚待执行，不能将离线结果标为原生验收通过。

## 2026-11-06：连接事务、取消与会话隔离验收

- 文件：`docs/verification/connection-transactions-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：补齐当前安装应用的候选失败、超时、真实取消和资源释放证据；复用现有事务与延迟代理，遵循最简原则，不新增产品机制。
- 修改与影响：记录认证/超时后旧连接保持、停止等待后候选关闭、成功交换及 A 断开后 B 可读取；三次错过取消窗口只计为超时。保留取消通用对象错误、模型过度推断和其他并发/拓扑未覆盖，不把节点 5 标为完成。临时控制脚本和取证文件仅在 Windows 临时目录，产品代码、依赖、模型配置及安装包未变。
- 验证：3 个连接专项文件 / 34 项通过；真实 DSH / bzkj-LLM 与所属 Redis 8.2.6 的代理日志、客户端数量及状态/值回执对照如新增记录。22 条合成数据、绝对过期时间和数量未变；两个会话断开、两条临时资料删除，代理和夹具退出 0，3810/8939 不再监听，日常 DSH 保留。文档执行 diff 检查，不将回归或局部真实证据扩大为全部验收。

## 2026-11-06：专业数据权限与公开案例夹具

- 文件：`scripts/hold-ai-acceptance.mjs`、`docs/verification/diagnostics-specialized-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：当前构建仍缺少专业命令 ACL 拒绝和合成广告缓存的真实模型证据，复用既有持有夹具而不是创建新测试服务框架。
- 修改与影响：可选 `--enterprise` 仅创建一个合成广告 String 并加入 DUMP、绝对过期时间和数量对照；可选 `--restricted-specialized` 在所属实例创建专用账号，拒绝 JSON.GET、TS.RANGE、GEOPOS、GEODIST、GETRANGE、XINFO GROUPS，保持元信息可读，且要求相应样本已启用。默认夹具数据与原受限账号不变，产品代码和协议不变。
- 验证：修改后严格类型、脚本语法和 diff 检查通过。日常 DSH / bzkj-LLM 的 24 次工具调用留下 23 条读取卡片；广告、诊断数值、八项专业边界和六项权限拒绝与隔离数据一致。模型仍有无依据归因、虚构字段和历史目标误述，完整节点未通过。26 个 Key 的数据、绝对过期时间、数量、消费组及消费命令计数未变，夹具退出 0 并停止，日常服务保留。ACL DRYRUN 首次探针把拒绝字符串误当异常，修正断言后六项通过；详见新增验收记录。产品代码、依赖和安装包未变。

## 2026-11-06：选区竞态与模型显示归属核对

- 文件：`docs/verification/selection-and-model-display-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：区分 Redis 选区保护、模型自由文本及宿主显示问题，避免在错误模块叠加提示或界面补丁；沿用现有 epoch、确认和读取记录验证。
- 修改与影响：新增纯文本最小复现、已安装适配器四组离线响应对照及四项原生选区记录；任务清单补充当前应用版本的局部证据。保留采样时间混淆、真实响应字段未核实及其他竞态未覆盖，不把完整节点改为通过。应用代码、依赖、模型配置与安装包未变。
- 验证：现有选区专项 29 + 18 项通过；真实连续切换触发一次拒绝，恢复后仍按选区读取，未显式回退旧字段；隐藏面板后仅查询状态。22 条合成数据的 DUMP、绝对过期时间与数量不变，夹具已停止，日常服务保留。临时目录保存截图、卡片、轨迹参数、离线脚本和版本哈希；未读启动日志、未触及业务 Redis。首次夹具 stdin 关闭和 Windows pnpm 表达式传参失败均单独记录，不算验收成功。

## 2026-11-06：安装基线措辞同步

- 文件：`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。安装证据文档提交后自查发现两处旧源码仍标为当前安装，改为当次历史记录，并将交付栏同步为 `4f7ffd4` / 678 项及新验收链接。只修正版本口径，不改代码、包或验收结论。

## 2026-11-06：筛选条件安装与真实展示验收

- 文件：`docs/verification/filter-condition-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：补齐 `4f7ffd4` 的完整检查、实际安装及新查询证据，避免将此前脚本通过误记为真实模型通过。
- 修改与影响：记录 82 文件/678 项完整打包检查、包哈希、137 文件安装一致性及两轮四页实际条件展示；任务清单更新当前安装基线。保留模型空用户名解释错误、原始 think 文本展示及未覆盖场景，不把七项任务标为全部完成。
- 验证：新包经官方 CLI 安装并重启已核验日常 DSH（PID 36220）；两轮分别匹配 4/0 项，四张卡片条件与原 JSON 一致，旧记录没有被新条件覆盖。24 条隔离数据、绝对过期时间和数量校验一致，实例已停止；日常服务保留、无在途模型请求。源码提交后两路只读审查均无发现。本次仅文档，不重复完整测试。

## 2026-11-06：筛选记录保留实际条件

- 文件：`src/host/ai-hash-filter.ts`、`src/client/tool-evidence.ts`、`tests/tool-evidence.test.ts`、`scripts/smoke-ai-hash-filter.mjs`、`scripts/smoke-ai-permissions.mjs`、`docs/AI_READ_USAGE.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：真实验收中不同字段比较查询的记录仅有 pattern 和计数，卡片自身不能说明实际字段及目标值。
- 修改与影响：每批结果保存完整 `condition.field/equals` 并由既有卡片展示；不依赖历史参数、当前选择或模型解释。查询条件计入分页输出预算，保留空文本、中文和控制字符；不增加 Redis 命令，不返回未匹配值。
- 验证：语法、严格类型与 118 项专项通过。独立 Redis 8.2.6 专项核对全部续页、空字段、中文控制字符、权限失败，以及上限字段/目标值与三条长 Key 的多页完整返回；各页不超过 64 KiB。筛选夹具全部 32 条数据、绝对过期时间、数量及写命令计数不变，权限夹具数据和绝对过期时间不变，测试实例均已停止。新源码尚未安装；日常包仍为 `02988c2`，不把脚本专项当作新包真实模型验收。

## 2026-11-06：混合类型筛选与权限拒绝验收

- 文件：`scripts/hold-ai-acceptance.mjs`、`docs/verification/mixed-filter-permissions-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：当前自然语言筛选异常验收需要同时包含缺字段和稳定非 Hash 候选，并与普通未匹配明确区分。
- 修改与影响：增加可选 `--mixed-filter`，仅在所属独立 Redis 中创建两条合成候选；默认场景不变。两条 Key 纳入原有 DUMP、绝对过期时间和数量的结束对照，ready 回执记录该模式；复用 `--restricted` 进行权限拒绝验收。不改应用源码或已安装包。任务清单链接本轮证据并保留整体未完成状态。
- 验证：脚本语法和严格类型通过；已安装源码 `02988c2`、真实 DSH / `bzkj-LLM` 与隔离 Redis 8.2.6 中，两轮 18 候选的匹配/无匹配分类及 HGET/SCAN 权限拒绝与工具一致。模型仍有 HEXISTS 能力承诺、无遗漏推断和凭证变化表述错误，不记为完整回答通过。24 条合成数据、绝对过期时间和数量校验一致；界面断开、所属实例停止，日常 DSH 保留。完整页面和截图只存本机临时目录，没有业务数据入库。

## 2026-11-06：值展示安装与真实回放验收

- 文件：`docs/verification/native-values-2026-11-06.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：补齐源码 `02988c2` 的完整打包、日常安装、原生回放与真实模型状态调用证据，并更正此前端口输出误判。
- 修改与影响：记录 82 文件/676 项检查、包哈希及 137 个安装文件一致；32 条历史卡片的 39 个值块与其原始结果一致，JSON 大整数与 Stream 重复字段保留、连接详情默认折叠。新状态调用与侧栏/模型一致显示未连接，不将历史回放写成当前构建重新查询通过。任务清单更新安装基线且保留七项未完结状态。
- 环境与验证：初次端口误判源于 PowerShell 混合输出隐藏列；守卫阻止重复启动，核准 PID 后正常重启日常 DSH，新 PID 16056 监听 3080。仅读取现存合成对话及调用一次状态工具，未连接用户 Redis、未创建 Redis 夹具；日常服务保留，无在途模型请求。两次代码提交后的规范/需求审查已执行，有效 P3 已修复并双路复查通过。本次仅文档，不重复运行整套代码测试。
## 2026-11-06：选区记录隐藏嵌套连接身份

- 文件：`src/client/tool-evidence.ts`、`tests/tool-evidence.test.ts`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：`c9b5d70` 的规范审查无发现，需求审查发现 P3：`selected` 和 `currentSelection` 包含嵌套目标 ID/代次，整体展开与连接详情折叠的要求不符。
- 修改与影响：默认只投影这两个记录中的 `selection` 和 `sampledAt`；完整目标身份继续保留在原始结果中。增加两种选区信封的回归，不改变读取/选区同步逻辑。`pnpm typecheck`、新构建和 15 项专项通过；先前 674 项打包结果仅对应上一提交，新包完整检查待执行。

## 2026-11-06：原生读取记录直接展示值（进行中）

- 文件：`src/client/tool-evidence.ts`、`src/client/RedisToolEvidence.tsx`、`src/client/tool-evidence-locales.ts`、`tests/tool-evidence.test.ts`、`tests/client-bundle.test.ts`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：读取卡片默认只显示技术状态，实际值藏在原始 JSON 内，不便核对模型回答。
- 修改与影响：复用现有原生卡片，展开记录中的 String 窗口、cell、集合数组、JSON 原文、专业值和诊断字段；显示范围、完整性和续读，保留二进制 Base64、空文本、null、长整数及 Stream 同名字段顺序。连接 ID/代次收进详情，服务器/DB 仍直接显示。结构化块限制显示高度且可滚动；原始结果保持可展开。只投影本次已返回字段，不读侧栏、不发额外 Redis 命令、不修改宿主接口，不推断缺失字段或保证模型自由文本准确。
- 验证：两组修改后 `pnpm typecheck` 均通过；新构建和 13 项专项通过，覆盖范围/截断、二进制/空值、重复字段、JSON 大整数/空匹配、未知诊断值及实际客户端 bundle 的 HTML 转义、默认值展示和连接详情折叠。完整打包检查通过（82 文件、674 项，179.69 秒），包 SHA-256 为 `d91f45768d9f6e92d3fe844624b38f0de1f3902867c11a3f13ffb426df3b915e`；日常安装与真实 DSH 复验待执行。首次混排 PowerShell 对象输出误判 3080 未监听；后续独立 JSON 输出确认原 PID 31272 一直运行，此处更正，详见本次安装记录。

## 2026-11-06：范围确认安装与真实模型复验记录

- 文件：`docs/verification/query-scope-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：补齐源码 `882eec0` 的包安装和 11 月 5 日真实 Web/模型证据，将首次范围确认的“尚未安装”状态更新为实际结果。
- 修改与影响：记录包 SHA-256、82 文件/666 项打包检查和 137 文件一致性；记录首次拒绝无扫描、允许查询、Hash 两批仅一次确认、待确认切 DB 拦截，及六类型、JSON/TimeSeries/GEO/Bitmap、诊断、截断和失败分类的局部复验。分别保留模型历史状态误用、Stream 字段分页误述、Bitmap 命令误述、虚构 snapshot 字段及无证据慢日志归因，不把数值正确写成整项通过。记录长持有夹具失联、最终不变性校验未返回、旧 PID 已被其他进程占用而未终止；日常 DSH 保留运行。仅更新文档，不改运行代码，不推送。

## 2026-11-05：首次扫描范围确认（进行中）

- 文件：`src/host/ai-query-scope.ts`、`src/host/ai-tools.ts`、`tests/ai-tools.test.ts`、`tests/ai-query-scope.test.ts`、`scripts/smoke-ai-hash-filter.mjs`、`scripts/smoke-ai-permissions.mjs`、`docs/AI_READ_USAGE.md`、`docs/DSH_AI_READONLY_TASKS.md`、`package.json`、`pnpm-lock.yaml`、`UPDATE_LOG.md`。
- 原因：真实模型曾在线索不足时自行猜测 MATCH 并发起扫描，单靠工具说明不能确认用户接受的范围。
- 修改与影响：按锁定 DSH 0.2.1-rc.5 的真实 ApprovalService 和工具流水线实现首次名称扫描及 Hash 筛选的原生确认；复用工具参数定义、现有分页游标及连接代次校验。确认不占查询超时，未确认不发读取，切库或重连使待执行请求失效；拒绝不会被模型参数绕过。只保留调用期间的原生 token，不新增持久授权或聊天界面。已知 Key 读取保持现状。首次编译发现释放钩子及联合类型收窄错误，已按现有 `ctx.effect` 风格和显式分支修正；类型检查及 101 项工具/确认专项通过；覆盖未授权无命令、拒绝/取消、卸载、参数校验、连接及 DB 变化、游标绑定和其他策略短路。两个隔离集成脚本加入受控确认，验证实际命令和 ACL，不能替代真实界面确认。最终类型检查、新构建及完整回归通过：82 文件、666 项。隔离 Redis 8.2.6 验证拒绝后 SCAN 计数不变、正常续页与混合类型筛选、真实 ACL 拒绝；数据和过期时间未变，两个测试实例已停止。`dsh-user-approval` 仅作精确版本的开发类型依赖，运行时复用宿主已注册服务，缺失时拒绝扫描；未打包另一份服务。日常安装与真实界面验收待执行。

## 2026-11-05：验收版本措辞修正

- 文件：`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。规范复核发现旧筛选、诊断、认证及 GEO 记录仍称“当前包”；改为其实际旧构建 `a9dcd8d`，将连接恢复限定为当次操作。仅修正文档，避免误认为新安装包已覆盖这些验收；复核再补齐 MEMORY 不可用场景的旧版本标记。

## 2026-11-05：原生视图日常安装与局部验收

- 文件：`docs/verification/native-evidence-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：补齐暂停前已完成的包安装和真实 Web 证据，消除任务清单仍称未安装的过期状态。
- 修改与影响：记录源码、包哈希、135 文件一致性、651 项检查、一次真实模型状态调用、历史时序回放和会话切换；保留其他工具、异常及模型准确性未完成的边界。重启日常 DSH 清空活动 Redis 连接，本次未重连用户 Redis，未修改业务数据；仅更新文档。

## 2026-11-05：原生工具读取记录

- 文件：`src/client/RedisToolEvidence.tsx`、`src/client/tool-evidence.ts`、`src/client/tool-evidence-locales.ts`、`src/client/index.ts`、`package.json`、`pnpm-lock.yaml`、`tests/client-bundle.test.ts`、`tests/tool-evidence.test.ts`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：工具数据与模型解释可能不一致，当前 DSH Web 需要使用真实的 `tool.call.toolview` 扩展点；`presentResult` 不能替代此入口。
- 修改与影响：为现有 16 个读取/状态工具注册独立调用记录视图，直接展示记录中的连接、时间、状态和范围；固定说明 TTL、SCAN、MEMORY 与显式目标的证据边界，保留原始结果。没有额外 Redis 读取，不把历史记录与当前侧栏混用，不恢复预算条。补充准确版本的原生工具 UI 类型依赖和加载顺序，卸载时释放注册。
- 验证：`pnpm typecheck` 通过；`pnpm test` 完成新构建，81 个测试文件、651 项通过。专项覆盖字符串 TTL、大整数、未知实际采样数、显式/选择来源、嵌套失败、部分扫描、异常输出和实际客户端产物的卸载重载。实际 DSH Web 可见性、会话绑定与真实模型仍待验证；不据此宣称模型最终回答已无幻觉。
- 文档与审查：唯一任务清单同步补充代码验证状态，保留真实验收待办。提交 `5029214` 后需求审查无发现，规范审查发现本记录漏列任务清单文件（P3），已补齐；此次仅修改记录，不改变运行行为。

## 2026-11-05：隔离验收夹具支持 JSON 与时间序列

- 文件：`scripts/hold-ai-acceptance.mjs`、`UPDATE_LOG.md`。
- 原因：当前包需通过真实 DSH 与用户模型复验 JSON 和时间序列；日常 Redis 未提供对应模块。
- 修改与影响：增加显式 `--modules` 开关，确认独立实例具备两个模块后创建固定合成 JSON 和三个时间序列样本，纳入既有 DUMP、绝对过期时间和数量对照；默认不创建，用户 Redis 不受影响。类型检查通过；隔离 Redis 8.2.6 直接只读命令确认 JSON 大整数、null、缺失路径和三个时序样本；该夹具保持运行等待真实模型验收，结束后核对数据和停止。

## 2026-11-05：当前包 GEO 全新会话复验

- 文件：`docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：验证当前包的 GEO 正常查询以及此前模型遗漏 TYPE 的问题，避免把历史会话结果误当作新包证据。
- 结果与影响：新只读会话中的真实模型返回两成员坐标与距离，均与隔离 Redis 直接只读命令一致，并说明 TYPE、编码误差及非快照；只覆盖正常合成样本。23 个隔离 Key 的内容、绝对过期时间及数量未变，夹具已停止，原会话仍连接用户 Redis。

## 2026-11-05：当前包错误凭据复验

- 文件：`docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：验证当前安装包对实际 Redis 认证失败的界面状态及真实模型说明。
- 结果与影响：独立 Redis 8.2.6 的错误测试凭据在界面和模型状态工具均显示认证失败；仅验证断开原连接后的单次失败，模型的服务器可达表述不证明持续可达。隔离数据及过期时间未变，实例停止；日常 DSH 已恢复用户 Redis 连接，未修改用户数据或保存测试凭据。

## 2026-11-05：本机 Redis 内存诊断复验

- 文件：`docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：核对当前安装包在用户真实 Redis 和模型下对采样数及内存范围的解释。
- 结果与影响：模型正确说明实际采样数未知，但扩展出工具未提供的内存范围细节；本次整体回答未通过。仅执行一次只读调用，文档不包含业务 Key、值或数值，未修改 Redis。

## 2026-11-05：澄清历史验收的构建版本

- 文件：`docs/DSH_AI_READONLY_TASKS.md`、`docs/verification/user-questions-real-model-2026-11-05.md`、`docs/verification/enterprise-cases-research-2026-11-05.md`、`UPDATE_LOG.md`。
- 原因：独立审查发现旧版本验收仍标为“当前构建”，可能与新安装的 `a9dcd8d` 混淆。
- 修改与影响：将旧包 `1375e2f` 等的结果标为此前构建，包括权限、切库及企业案例；不改变已记录的验证结果，不宣称新包已复验这些场景。

## 2026-11-05：当前包真实模型复验

- 文件：`docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`、`UPDATE_LOG.md`。
- 原因：记录当前安装包及其真实 DSH、用户模型验收结果，避免将旧构建或专项检查当成当前完整验收。
- 结果与影响：`a9dcd8d` 打包完整检查 80 文件、647 项通过，135 个归档文件与日常安装一致。独立 Redis 中复验 MEMORY 不可用、混合类型筛选和明确字段类型不符，记录模型表述与覆盖边界；隔离数据和 TTL 未变且夹具已停止，日常 DSH 已恢复连接用户 Redis。模糊范围猜测等问题仍未解决，任务节点不标为全部完成。

## 2026-11-05：隔离验收夹具支持禁用 MEMORY

- 文件：`scripts/hold-ai-acceptance.mjs`、`UPDATE_LOG.md`。
- 原因：真实 DSH 和模型需要验证 Redis 不提供 `MEMORY` 命令时的结果；用户日常 Redis 不应为测试修改配置。
- 修改与影响：复用现有隔离 Redis 的禁用命令参数，增加 `--disable-memory` 开关，并在就绪信息中标识；默认行为不变，只影响人工验收夹具，不修改日常 Redis。类型检查通过；隔离 Redis 8.2.6 实测 `MEMORY` 不可用且 PING 正常，22 个合成 Key 的内容、绝对过期时间和数量未变，夹具已停止。

# 更新说明


## 2026-11-05 修正认证阶段错误分类回归

- `src/host/redis-transport.ts`：在实际执行 `AUTH` 时识别 Redis 5 返回的 `ERR invalid password` 和未配置密码两种固定错误；其他命令的相同文字仍不视为认证错误。原因是提交 `915c669` 的需求审查发现这些服务器返回会被误报为网络故障；依据 [Redis 5 认证源码](https://github.com/redis/redis/blob/5.0/src/server.c#L2751-L2759)，不恢复对任意错误正文的宽泛匹配。
- `tests/redis-transport.test.ts`：使用受控 RESP 服务分别验证认证阶段和普通读取阶段的相同错误；类型检查及 3 个专项文件共 64 项测试通过；使用受控 RESP 对端模拟 Redis 5 错误，未连接真实 Redis 5。上一源码 `915c669` 的完整检查已通过，80 个文件、645 项；新修改尚未完成完整检查及真实 DSH 验收。



## 2026-11-05 修正认证与内存命令错误分类

- `src/host/connection-service.ts`：按 Redis 错误前缀识别认证失败，覆盖 `NOAUTH`、`WRONGPASS` 和 `ERR AUTH`，避免错误正文回显的 Key 被误认成认证错误；依据 [Redis WRONGPASS 文档](https://redis.io/docs/latest/develop/reference/errors/common/wrongpass/) 和 [NOAUTH 文档](https://redis.io/docs/latest/develop/reference/errors/common/noauth/)。
- `src/host/ai-reader.ts`、`src/host/ai-report-samples.ts`、`src/host/ai-tools.ts`、`docs/AI_READ_USAGE.md`：`MEMORY` 命令不存在或被禁用时返回不可用及固定说明，报告结构保留该状态，不暴露服务端原始错误。
- `tests/connection-service.test.ts`、`tests/ai-tools.test.ts` 和隔离夹具脚本：覆盖认证前缀、回显含 `author` 的 Key、报告采样以及真实禁用命令；类型检查、构建及 4 个专项文件的 128 项测试通过；独立 Redis 8.2.6 中禁用 `MEMORY` 后验证不可用状态及连接仍正常，正常内存估算和数据、过期时间对照通过，两个测试实例均已停止。真实 DSH 模型复验待执行；仅修改测试实例配置，不修改用户 Redis。



## 2026-11-05 区分筛选中的非 Hash 与类型变化

- `src/host/selected-reader.ts`、`src/host/ai-hash-filter.ts`：对指定字段的筛选，将首次检查就不是 Hash 的候选记入 `notHash`，只有读取期间观察到类型变化才计入 `typeChanged`；侧栏选择仍按已有选区类型检查。原因是稳定的 String 等候选此前被误报为发生类型变化。
- `src/host/ai-reader.ts`、`src/host/ai-tools.ts`、`docs/AI_READ_USAGE.md`：明确字段查询遇到首次类型不符时返回不支持及说明，工具与使用文档解释两个计数的证据范围。
- `tests/ai-tools.test.ts`、`scripts/smoke-ai-hash-filter.mjs`：覆盖稳定非 Hash 和读取期间类型变化，并在独立 Redis 夹具核对真实非 Hash 计数。类型检查和构建通过；首次专项 94 项通过、1 项旧断言仍期待类型变化，修正后 3 个专项文件、95 项全部通过。独立 Redis 8.2.6 真实筛选确认稳定非 Hash 单独计数、类型变化计数为零，夹具停止且未观察到测试写命令增加；新包及真实 DSH 模型复验待执行，不改变用户 Redis 数据或写入能力。



## 2026-11-05 扫描案例真实对话

- 更新 `docs/verification/enterprise-cases-research-2026-11-05.md`、`docs/verification/user-questions-real-model-2026-11-05.md`：记录美团扫描案例启发下的日常 DSH、用户模型和本机 Redis 单批名称搜索。模型按明确模式仅扫描一批，正确区分空页、未完成和非快照；COUNT 的槽位数量表述比工具工作量提示更具体，不能当作实际工作量保证。
- 此次未续读、未读取值或修改用户数据，也未复现历史版本缺陷；不能将单批结果扩展为完整案例通过。



## 2026-11-05 认证故障案例真实对话

- 更新 `docs/verification/enterprise-cases-research-2026-11-05.md`、`docs/verification/user-questions-real-model-2026-11-05.md`：记录 GitHub 认证故障启发的当前构建隔离复验。模型报告认证失败和原连接状态，随后通过明确请求成功只读原连接一个 Key 的元数据；首次回答只有状态证据，不覆盖候选连接释放及其他异常。
- 临时资料已删除，独立实例的 22 个合成 Key、绝对过期时间和数量未变，实例已停止；首次启动因输入提前关闭而中止，未完成数据断言。未修改用户 Redis 数据，也不记录业务 Key 或凭据。



## 2026-11-05 本地缓存一致性真实对话

- 更新 `docs/verification/enterprise-cases-research-2026-11-05.md`、`docs/verification/user-questions-real-model-2026-11-05.md`：记录美团缓存案例启发下的日常 DSH、用户模型和本机 Redis 只读对话。模型仅获取明确 Key 的元数据并正确说明无法判断应用本地缓存一致性；它将非快照采样说成同一时刻的事实，且建议引用旧对话字段，完整案例仍待验证。
- 本次未读取 Key 值或修改用户数据，不在文档中记录业务 Key、字段和值；局部通过不等于整个案例通过。



## 2026-11-05 高负载案例真实对话

- 更新 `docs/verification/enterprise-cases-research-2026-11-05.md`、`docs/verification/user-questions-real-model-2026-11-05.md`：记录美团高负载案例启发的问题在当前日常 DSH、用户模型和本机 Redis 的真实调用及结论。模型正确指出现有 Redis 采样不足以证明网络或系统中断根因，但错误承诺插件可按时段查慢日志和延迟事件，完整回答未通过。
- 影响仅为保存验收证据和能力限制；未制造负载，未修改 Redis 数据或配置，不将业务指标写入仓库。



## 2026-11-05 企业公开案例验收准备

- 新增 `docs/verification/enterprise-cases-research-2026-11-05.md`：核对美团和 GitHub 一手案例，记录可提出的问题、应有证据、历史观察和待验收边界。原因是为用户要求的真实案例验收准备可核对依据，明确旧版 Redis 缺陷和本地采样不能代表当前或企业生产环境。
- 本次仅检索公开资料和整理验收条件，未执行完整案例验收，未操作 Redis 数据。



## 2026-11-05 模糊查询与缺失归因验收

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md`：记录日常 DSH、真实模型及用户 Redis 上一次模糊订单缓存问题；模型未澄清便猜测名称模式并执行一批扫描，续读被预算拒绝，又建议以 TTL 区分过期和从未写入。原因是两项行为不满足既定的用户意图和证据边界；节点继续标为未完成。
- 此次在既有模型会话中执行，只读且未修改用户数据；不据此推断其他会话必然发生，也不记录业务 Key 或指标。


## 2026-11-05 本机慢日志与内存诊断复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 和用户 Redis 的两项只读采样：慢日志事件时间、耗时和范围与只读对照一致；内存工具已标记实际采样未知及可能含内部碎片，但模型再次断言抽取五项并笼统排除分配器碎片，解释仍未通过。
- 未清理慢日志、修改配置或用户数据，也未把业务 Key 和指标写入仓库；不将单次查询扩大为其他异常场景通过。


## 2026-11-05 当前包专业数据模型复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH、`bzkj-LLM` 与独立 Redis 对当前构建的 JSON 三路径、时序两页和 GEO 距离合成样本：值与夹具一致；GEO 模型命令依据仍遗漏 TYPE，完整依据未通过。异常路径及独立会话未以此验收通过。
- 三个隔离 Key 的内容、绝对过期时间和数量未变，实例停止；日常 DSH 已重连用户 Redis DB0。


## 2026-11-05 用户 Redis 会话切库复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH 和 `bzkj-LLM` 对用户 Redis 的 DB0→DB1→DB0：两次切换和状态回执一致，最终界面已返回 DB0。模型称未读取任何 Key，但侧栏自动加载了 Key 名称，范围表述不准确；仅覆盖单会话正常路径。
- 本次未要求读取 Key 值或修改数据，未将业务名称写入仓库。


## 2026-11-05 本机定位与刷新复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 和用户 Redis 的正常界面联动：定位及单次刷新回执均为 `applied`，侧栏实际显示 Hash，自动刷新关闭。
- 本次不覆盖隐藏、多接收端、取消或回执丢失等场景，未写入用户 Redis 或将业务 Key 和内容写入仓库。


## 2026-11-05 基础类型与截断真实模型复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建的六类型合成读取：原始值、类型及重复 Stream 字段顺序一致，模型仍误标 String 长度字段且表格显示原样 `<br>`。
- 随后仅请求 String 前 5 字节，工具只返回指定片段并标记不完整，模型却引用同一会话的前一轮完整值，故该回答范围未通过；不推断工具额外读取或其他会话必然重现。隔离 22 个 Key 的内容和过期时间未变，实例停止，日常 DSH 已重连用户 Redis DB0。


## 2026-11-05 受限账号真实模型复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 和独立 Redis 对 HGET、SCAN 权限拒绝的复验：模型区分拒绝与数据不存在，但字段回答误引一个旧测试连接端口，完整回答不算完全准确；不扩大到全部 ACL。
- 隔离实例 22 个 Key 的内容、绝对过期时间和数量未变，实例已停止；日常 DSH 已重连用户 Redis DB0。


## 2026-11-05 合成订单筛选模型复验

- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 与独立 Redis 的两页正常筛选：16 个候选、4 个匹配、续读条件和非快照及遍历说明均与原始证据一致；权限、类型变化、取消和并发等异常未以此通过。
- 隔离实例 22 个 Key 的内容、绝对过期时间和数量未变，实例已停止，日常 DSH 已重连用户 Redis DB0。


## 2026-11-05 本机缺失 Key 和客户端概况复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 与用户 Redis 上的只读检查：缺失 Key 的采样和未知历史原因解释正确；客户端数值一致，但模型仍笼统称覆盖所有客户端，未说明副本连接不计入，范围解释未通过。
- 本次没有创建测试 Key、写入用户数据或在仓库记录业务指标；仅覆盖单次查询，不代表其他异常或存在副本环境已验收。


## 2026-11-05 内存验收版本引用修正

- `docs/verification/user-questions-real-model-2026-11-05.md` 按提交后独立规范审查，将内存复验引用明确为 `7315b69`，避免误认为已在当前安装构建复验。


## 2026-11-05 专业命令说明真实模型复验

- `docs/verification/user-questions-real-model-2026-11-05.md` 与 `docs/DSH_AI_READONLY_TASKS.md` 更新安装基线和验收：`1375e2f` 完整检查 80 文件、642 项通过，打包钩子成功，日常 profile 的 110 个构建文件与 SHA-256 为 `243ae2851fb983c3488fe718add2963a6dcbbeda2401c72c8c760ea9d0e63cc8` 的包一致。
- 日常 DSH 和 `bzkj-LLM` 对隔离 Stream 的计数复验正确，但仍漏报 TYPE 并引用不存在的 `snapshot: false`；该回答未通过。夹具 Key、过期时间及消费组稳定状态未变，实例停止；日常 DSH 已重连用户 Redis DB0。此前构建的其他模型结果不扩大到当前构建。


## 2026-11-05 专业读取命令说明修正

- `src/host/ai-tools.ts` 修正 JSON、TimeSeries、GEO 和 Stream 消费组工具的模型可见描述，说明主要查询外还会使用 TYPE 检查，避免将查询命令误称为唯一命令；不改变实际 Redis 命令或读取范围。
- `tests/ai-tools.test.ts` 校验注册描述包含类型检查，并在正常读取测试中核对实际命令顺序；`docs/AI_READ_USAGE.md` 同步解释多命令非原子读取。真实模型复验仍需执行，不能保证其自由文本始终准确。


## 2026-11-05 GEO 与 Stream 消费组局部复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 与独立 Redis 的 GEO 坐标距离和 Stream pending、lag 合成样本：数值一致，模型的消费组命令描述遗漏 TYPE，完整回答仍未通过。
- 夹具前后 DUMP、过期时间和组信息一致；脚本错误地将自然增长的待确认空闲毫秒作全等比较，导致断言失败且后续数量断言未执行。记录固定身份及投递次数的前后对照，隔离端口已停止；日常 DSH 已重连本机 Redis，未写入用户业务数据。


## 2026-11-05 专业数据验收状态同步

- `docs/DSH_AI_READONLY_TASKS.md` 根据提交 `6a83982` 后的两路独立审查，同步当前构建已复验的 JSON 和 TimeSeries 合成样本；保留其他回答和异常场景未全部通过的边界，避免任务清单与验收记录冲突。


## 2026-11-05 JSON 与时序当前构建复验

- `docs/verification/user-questions-real-model-2026-11-05.md` 记录日常 DSH、`bzkj-LLM` 与独立 Redis 模块实例的局部真实模型验收：JSON 三个路径区分大整数、null 和无匹配；TimeSeries 两页三条样本的时间和值与合成数据一致，并保留非快照与压缩桶限制。仅记录本次覆盖，不扩大到全部异常场景。
- 隔离实例两个 Key 的 DUMP、绝对过期时间和数量未变，实例已停止；日常 DSH 已重新连接用户 Redis DB0，未写入业务数据。


## 2026-11-05 查找后定位与单次刷新真实验收

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 与本机 Redis 的查找后打开和单次刷新：两个原始回执为 `applied`，实际侧栏选中并显示 Hash，自动刷新保持关闭。仅验证正常路径，未记录业务 Key 或值。

## 2026-11-05 真实名称搜索与预算恢复

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 与本机 Redis 的名称搜索：前 8 批后预算耗尽，界面恢复预算后从原游标续读 4 批并找到 1 个候选，末批结束；模型正确说明非快照，但批次数误报且使用笼统绝对表述。仅查名称，未记录业务 Key 或修改 Redis。

## 2026-11-05 缺失诊断用语澄清

- 独立审查发现 `docs/verification/user-questions-real-model-2026-11-05.md` 中“无权限错误”有歧义，改为“未发生权限错误”，明确本次只验证 Key 缺失，未将其当作权限拒绝测试。

## 2026-11-05 缺失 Key 真实模型诊断

- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录当前构建在日常 DSH、`bzkj-LLM` 与本机 Redis 的一次随机名称缺失查询：模型准确区分采样时不存在与未知历史原因，未擅自跨库或扫描；未创建 Key，未修改用户 Redis。

## 2026-11-05 客户端概况真实模型验收

- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录当前构建的日常 DSH、本机 Redis 客户端概况查询：数值及采样时间与工具一致，模型却将统计说成覆盖所有客户端；依据 [Redis INFO 文档](https://redis.io/docs/latest/commands/info/)，`connected_clients` 不包含副本连接，故范围解释未通过。未记录业务指标或修改 Redis。

## 2026-11-05 单 Key 内存报告真实回读

- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH、`bzkj-LLM` 及本机 Redis 的单 Key 内存报告保存；回读采样 UTC、请求参数、未知实际数量、固定说明及 Key 摘要，与工具证据一致。该正常路径不代表异常路径或此前模型错误推断已消除。
- 报告保存在日常 profile 固定目录；未向仓库写入业务 Key、值或指标，用户 Redis 未修改。

## 2026-11-05 六种基础类型当前构建复验

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH、`bzkj-LLM` 和独立 Redis 8.2.6 的六类型合成数据读取：内容、类型及完整状态与工具一致，Stream 重复字段有序；模型将 String 长度标成工具没有返回的字段名，Stream 表格中的 `<br>` 显示为文本，故未把整体回答准确性或展示体验标为通过。
- 隔离实例 22 个 Key 的 DUMP、绝对过期时间和数量未变，测试连接断开、实例停止，原会话已重连本机 Redis。

## 2026-11-05 已保存资料成功切换真实验收

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH、`bzkj-LLM` 切换至独立 Redis 的真实结果：工具返回连接成功和旧连接关闭，代次增加，模型读取并正确复述一个完整的合成 String。仅覆盖单次无密码路径，未在用户服务器端单独计数旧套接字。
- 临时资料已删除，测试连接断开后已重连用户本机 Redis；隔离实例 22 个 Key 的 DUMP 和绝对过期时间前后一致，实例已停止。

## 2026-11-05 候选认证失败连接数对照

- `docs/verification/user-questions-real-model-2026-11-05.md`、`docs/DSH_AI_READONLY_TASKS.md` 记录当前构建的第二次真实模型认证失败复验：独立 Redis 的客户端数请求前后均为 2，含夹具管理连接及检查连接；只支持本次失败后未观察到额外客户端，不能覆盖其他失败路径。
- 隔离实例 22 个 Key 的 DUMP、绝对过期时间和数量未变，测试资料已删除且实例已停止；用户 Redis 和日常 DSH 继续运行。

## 2026-11-05 同名连接资料真实验收

- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录 `7315b69` 在日常 DSH 与 `bzkj-LLM` 的同名资料消歧：模型列出两个分组并提问，测试选择取消后没有发起连接；语义判断仍依赖模型遵循工具说明。两条无凭据临时资料已删除，原 Redis 界面保持连接。

## 2026-11-05 候选连接认证失败真实验收

- `docs/verification/user-questions-real-model-2026-11-05.md` 与 `docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH 和 `bzkj-LLM` 对独立受限 Redis 的连接尝试：资料唯一，候选返回认证失败，原连接标识、代次、DB 与界面状态保留；模型提示在本地表单处理凭据。未核对候选套接字释放，不扩大验收范围。
- 隔离实例的 22 个 Key、DUMP 和绝对过期时间前后一致；测试资料已删除，隔离实例已停止，用户本机 Redis 和日常 DSH 继续运行。

## 2026-11-05 缺失连接资料真实验收

- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录当前安装构建在日常 DSH、`bzkj-LLM` 与本机 Redis 的只读验证：资料列表为空时未尝试连接；原会话仍连接，后续元数据读取成功且 TTL 限制解释正确。该场景不覆盖候选认证失败、资料同名及资源释放；不记录真实 Key 或值。

## 2026-11-05 专业数据验收版本澄清

- 独立审查发现 `docs/DSH_AI_READONLY_TASKS.md` 的“前一构建”存在歧义，改为实际完成 JSON、TimeSeries 及 GEO 对照的 `8f57a61`；不改变功能或验收结论。

## 2026-11-05 验收基线审查修正

- `docs/DSH_AI_READONLY_TASKS.md` 按提交后的独立审查修正两处旧构建状态：TimeSeries 模型证据属于 `53bd92e`，`7315b69` 的完整检查为 80 个文件、641 项通过；保留旧构建整套检查超时的事实。仅修正表述，不扩大真实模型验收范围。

## 2026-11-05 单 Key 内存真实模型复验

- `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md` 更新日常 profile 安装基线与模型复验结果：工具证据和报告固定说明已正确返回，但模型随后对采样数量及碎片作自相矛盾的断言，节点不能标为通过。仅作记录，不修改 Redis 或插件行为。
- 构建 `7315b69` 的 `pnpm check` 通过 80 个文件、641 项测试；安装包 SHA-256 和 110 个构建文件与日常 profile 核对一致。日常 DSH 已连接用户本机 Redis，本次业务读取为只读。DSH 工具接口文档未承诺控制模型最终自然语言，故不以提示补丁替代真实验收。

## 2026-11-05 GEO 精确读取

- `src/host/ai-reader.ts`、`src/host/ai-tools.ts` 与 `src/host/redis-transport.ts` 增加明确 Key 和成员的 GEO 坐标及两成员距离只读查询，命令边界限制固定参数、复用当前会话预算和目标校验；区分缺失、类型变化与权限错误，不扫描或修改数据。Redis 的 ZSet 类型不证明其为 GEO 索引，结果保留该限制。`tests/ai-tools.test.ts`、`tests/redis-transport.test.ts` 覆盖参数约束、二进制身份、异常和连接变更；`docs/AI_READ_USAGE.md` 与任务清单说明使用方法及未完成验收。`scripts/hold-ai-acceptance.mjs` 新增可选的隔离 GEO 数据，验收前后核对 Key 与过期时间。
- 参照 [Redis GEOPOS](https://redis.io/docs/latest/commands/geopos/) 和 [GEODIST](https://redis.io/docs/latest/commands/geodist/)；在独立 Redis 复现禁用 GEO 命令被误报为网络故障后，调整为明确的命令不可用状态并保留连接状态，并用真实隔离 Redis 复验。修正后完整 `pnpm check` 再次通过（80 个文件、631 项）；开发包 110 个 lib 文件及 AI 使用说明与该构建逐字节一致。
- `docs/verification/user-questions-real-model-2026-11-05.md` 记录独立 Redis 对照及日常 DSH 模型请求：工具坐标和距离与 Redis 一致；真实模型两次请求均因上游 HTTP 500 失败、未调用工具；之后不调用工具的普通消息也出现相同上游错误，不能标记模型验收通过。隔离实例 23 个 Key 与过期时间不变，已停止；原会话已重新连接用户 Redis。

## 2026-11-05 Bitmap 版本基线修正

- `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md` 修正独立审查发现的旧基线表述，区分打包时工作树、提交 `e5b8153`、新增专项测试和历史构建；已逐字节比较开发包内 110 个 lib 文件及 AI 使用说明。此变更只修正文档，不改变验收结论。

## 2026-11-05 Bitmap 位范围读取

- `src/host/ai-reader.ts` 和 `src/host/ai-tools.ts` 增加 AI Bitmap 有界只读查询，复用现有 String 字节读取和会话预算；明确 Key、位偏移和数量，输出指定范围位值，区分缺失、类型及读取错误，不向模型返回整个字节。仅处理最多 1024 位，不推断业务含义。`tests/ai-tools.test.ts` 覆盖跨字节、补零、异常和范围；`docs/AI_READ_USAGE.md` 与任务清单记录使用方法及当前验收状态。
- 根据 [Redis GETBIT 文档](https://redis.io/docs/latest/commands/getbit/) 对超出字符串末尾的位置按零解释。`pnpm check` 通过 80 个文件、627 项测试；独立 Redis 8.2.6 和 ToolRuntime 的多个范围与 GETBIT 一致。
- `docs/verification/user-questions-real-model-2026-11-05.md` 记录当前开发包在日常 DSH、用户模型和独立 Windows Redis 8.10.0 中的跨字节、补零与缺失验收；数值一致，但模型对选区状态作无依据判断，整体回答准确性未通过。隔离数据和过期时间不变，测试实例已停止，原会话已重新连接用户 Redis。

## 2026-11-05 未知积压量验收记录补充

- `docs/verification/user-questions-real-model-2026-11-05.md` 补充工具实际返回的原始 UTC 采样时间，修正独立审查指出的记录遗漏；不改变验收结论或 Redis 数据。

## 2026-11-05 Stream 未知积压量验收准备

- `scripts/hold-ai-acceptance.mjs` 新增可选 `--unknown-lag`：只在独立测试 Redis 创建从中间 ID 开始的消费组，并校验 Redis 返回的 lag 与 entries-read 均为未知；继续对比 Key、过期时间、消费组及消费类命令计数。用户 Redis 不做消费组写入。
- `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH 与用户模型验收：依据 [Redis XINFO GROUPS 文档](https://redis.io/docs/latest/commands/xinfo-groups/)，工具及模型区分了未知与零，但模型无依据地把消费者称为活跃消费者，整体诊断回答未通过。
- 独立实例的 22 个 Key、过期时间、组状态及消费类命令计数未变；测试连接已断开并停止夹具，原会话仍连接本机 Redis。

## 2026-11-05 Stream 消费组真实验收准备

- `scripts/hold-ai-acceptance.mjs` 增加可选 `--stream-group` 夹具，在独立 Redis 中设置 1 条待确认和 1 条待投递消息，并在测试前后核对组状态、待确认列表、消费类命令计数及 Key 和过期时间；构造时的消息投递仅发生在隔离实例。
- `docs/verification/user-questions-real-model-2026-11-05.md` 与 `docs/DSH_AI_READONLY_TASKS.md` 记录日常 DSH 和用户模型的消费组实际验收：pending、lag 数量解释正确，但模型无依据误报 Stream 总数和待确认消息 ID，整个诊断未通过。参照 [Redis XINFO GROUPS 文档](https://redis.io/docs/latest/commands/xinfo-groups/) 区分 pending、lag 和可能未知的状态。
- 独立夹具验收前后 22 个 Key 和过期时间、消费组状态及消费类命令计数一致，测试连接已断开并停止夹具；用户 Redis 不建立或推进消费组。

## 2026-11-05 隔离权限验收准备

- `scripts/hold-ai-acceptance.mjs` 增加可选 `--restricted` 模式，仅在独立临时 Redis 中创建测试用受限用户，拒绝 `HGET` 和 `SCAN`，用于日常 DSH 和真实模型的权限不足验收；不更改用户 Redis 或保存真实凭据。
- 通过日常 DSH、用户模型及独立 Redis 8.2.6 验证允许 String 读取、拒绝 HGET 与 SCAN：模型正确区分权限不足和不存在；UI 也显示权限不足。先断开后输入错误测试密码，界面及模型状态工具均报告认证失败；没有验证旧连接仍活动时的候选交换。
- `ACL DRYRUN` 核对测试账号的允许和拒绝规则；22 个合成 Key 的 DUMP、绝对过期时间和数量未变，实例已停止。对话可见内容和核对的工具结果未暴露测试密码。同步 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md`；不将本次限定场景当成全部 ACL 和认证验收。

## 2026-11-05 当前构建真实模型查询复验

- 日常 DSH 和用户模型在独立 Redis 8.2.6 中复验 `729e707` 的 Hash、List、Set、ZSet 和 Stream，核对五次显式目标工具返回、值与完整状态；Stream 同名字段顺序正确。模型表格中的部分 `<br>` 在对话里作为文本显示，范围仅为合成正常数据。
- 针对 16 个合成订单，两批筛选得到 4 个正确匹配，累计检查及匹配数与工具一致；七个名称候选正确列出并等待用户确认，空搜索结果及迭代状态也与工具一致。模型仍未说明 SCAN 非快照及可能遍历的键空间，并对空搜索断言当前不存在，故范围解释未通过。
- 结束时 22 个合成 Key 的 DUMP、绝对过期时间和数量未变，独立 Redis 已停止；同步 `docs/DSH_AI_READONLY_TASKS.md` 与 `docs/verification/user-questions-real-model-2026-11-05.md`，不把数值通过当成整体验收完成。

## 2026-11-05 核实日常 profile 依赖来源

- 使用已安装 DSH 0.2.1-rc.5 提供的只读运行时解析 API 和日常 profile 核对本插件 peer：12 个宿主包来自 installation 且版本匹配；界面 slots 仅作类型引用，React 由 Web 前端模块表提供，产物版本标识为 18.3.1。依据和局限写入 `docs/verification/user-questions-real-model-2026-11-05.md`，`peers check` 的非零结果保留，不向 profile 引入重复宿主包。
- 修正 `docs/DSH_AI_READONLY_TASKS.md` 的验收归属：六类型正常读取对应前一构建 `7b23e68`，当前 `729e707` 只复验了 String 范围，其他五类不能称当前构建已通过。未修改插件代码、Redis 或 DSH 配置。

## 2026-11-05 日常连接恢复与依赖告警

- 新构建加载后，已在 DSH 原验收会话中只读重连本机 `127.0.0.1:6379`，界面显示 DB0 的真实 Key；未修改 Redis 数据。
- 日常 profile 执行 `dsh plugin --profile web peers check` 返回非零，显示 DSH 宿主包和 React 等 peer 缺失，且涉及多个插件。`docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md` 记录该告警及真实加载通过的边界；成品交付前需进一步核查宿主依赖提供方式。

## 2026-11-05 限定 AI String 读取范围

- `src/host/string-reader.ts` 将界面 UTF-8 边界上下文设为读取器配置；`src/host/ai-reader.ts` 的 AI 读取和比较禁用边界字节，Redis GETRANGE 按请求范围执行，工具结果不再包含界面专用的 prefix/suffix。界面预览继续保留原有跨字符处理。
- 同步 `src/host/ai-tools.ts` 和 `docs/AI_READ_USAGE.md` 的比较与字节范围说明；扩展 `tests/ai-tools.test.ts`、`scripts/smoke-ai-six-types.mjs` 验证偏移、命令参数和响应边界。`pnpm typecheck`、针对范围和界面预览的 84 项测试、独立 Redis 8.2.6 的六类型工具专项及完整 `pnpm check`（80 个测试文件、626 项）通过；独立实例已停止。Redis GETRANGE 两端均包含，依据 [Redis 官方文档](https://redis.io/docs/latest/commands/getrange/)。开发包 SHA-256 为 `b6b7f9e17afd6e3f645a006d740d5e18e8d7a2b0cb51c1605d0308ca2392cf2b`，已安装日常 profile，135 个包文件与安装内容一致。日常 DSH 的全新会话与用户模型实际复验前 4 字节，工具结果无额外上下文字节，模型未继续读取；模型却将偏移参数标签误写为 `bytes=0`，回答准确性仍未完全通过。独立 Redis 22 个合成 Key 的内容及绝对过期时间未变，测试实例已停止；同步 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`。

## 2026-11-05 六类型真实模型验收准备

- 扩展 `scripts/hold-ai-acceptance.mjs`：在独立 Redis 夹具中补充 String、List、含重复字段的 Stream，并对全部合成 Key 的内容和绝对过期时间做结束前回读核验；原有 Hash、Set、ZSet 数据保留。目的是补足用户 Redis 当前抽样未发现的类型，不改变用户 Redis。
- 日常 DSH 和用户模型在独立 Redis 8.2.6 的 22 个合成 Key 上完成六种基础类型正常读取，核对真实工具结果及 Stream 重复字段顺序；并行读取五项不代表逐次串行调用。结束前全部 Key 的 DUMP 和绝对过期时间不变，独立实例已停止。
- String 前 4 字节请求的工具结果额外暴露文本边界字节，模型展示边界内容并复用了前一轮完整值，因此截断范围未通过。已更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`，修正与新构建复验待完成。

## 2026-11-05 大厂公开案例验收准备

- 在 `docs/DSH_AI_READONLY_TASKS.md` 将美团广告缓存、SCAN 并发变化、高负载排障及 GitHub Redis 认证故障的一手案例纳入现有交付验收，记录来源、自然语言验收方向和只读边界；现有功能完成之后使用真实 DSH 与用户模型执行。
- 明确优先使用用户授权的本机真实数据；缺少特定类型或异常状态时使用独立隔离 Redis，区分本机测试和企业生产规模。案例目前仅完成来源调研，未执行、未标记通过；未修改代码或 Redis 数据。

## 2026-11-05 只读取 Key 元信息

- 真实模型复验显示，只问 TTL 时旧工具仍读取整个 Hash，且模型对业务含义、未来状态和时间解释作出无证据推断。新增只读 Key 元信息工具，复用现有连接、预算和 TYPE/PTTL 读取上下文，不读取 Key 值；相关验证进行中。
- 增加工具级正常、缺失、类型变化、权限不足和非法输入测试，更新 `docs/AI_READ_USAGE.md`；实际模型复验待新构建加载。
- 扩展独立 Redis 脚本，检查有 TTL 和无 TTL 两种 Key 的元信息结果，核对 GETRANGE、HGET 和 HSCAN 的计数未增加；`pnpm typecheck`、构建、69 项工具专项及独立 Redis 8.2.6 实测通过，测试实例已停止。真实模型复验仍待加载新构建。
- 源码 `4175196` 的开发包 SHA-256 为 `ccccc8b0fca5a09cf381f8689ab92c3a42d45941b21c953a261f42be90789ec5`；安装到日常 profile 的 135 个文件与归档一致，日常 DSH 已重新启动，真实模型复验进行中。
- 真实模型新会话已调用元信息工具，结果未包含字段或值，采样 UTC 标注正确；但最终回答同时给出相互矛盾的 TTL 历史说法，仍猜测业务含义并建议写入，准确性验收失败。已记录结果，停止继续追加提示补丁，需重新审视输出方式。
- 真实模型进一步调用服务器概况、慢日志及 Key 内存诊断工具，工具有返回，但模型对单次指标作无依据判断并给出配置建议；诊断回答未通过，记录边界并不执行建议。
- 使用本机真实 Redis 验证 Hash 筛选空页续读至首个匹配并按要求停止，工具与模型均说明扫描未完成；模型另行计算目标文本字节数有误。同步任务和验收记录，不将该场景写为完整范围验收。
- 当前构建通过日常 DSH、真实模型和本机 Redis 的单个 Hash 正常链路：Key/字段定位、单次刷新和 Hex 显示四项回执均为 `applied`，面板实际状态一致；自动刷新保持关闭。其他类型和异常仍待真实验收。
- 真实模型按明确请求保存此前的服务器内存概况采样，本机回读报告的采样时间及核对字段与原工具结果一致；未将报告保存通过等同于诊断结论准确。
- 真实模型在日常 DSH 中切换本会话 DB0→DB1，查询指定测试名得到 `missing`，随后切回 DB0；面板选中状态与工具回执一致。连接资料及会话隔离异常场景仍待真实验收。

## 2026-11-05 模型回答的 TTL 和扫描边界

- 针对真实模型将 TTL 当前状态误说成历史事实、将 SCAN 结果当作一致性快照的问题，在 `src/host/ai-tools.ts` 的模型可见说明中明确采样时效、并发变化和重复结果；不更改 Redis 命令或读取范围。
- 增加工具注册说明测试；`pnpm typecheck` 与 `tests/ai-tools.test.ts` 的 68 项通过。真实模型复验待重新构建并加载当前插件，提示不能保证模型必然遵循。
- 新包 SHA-256 为 `79b60a0b23c25987d3867e2ddfc4561fe201d444ec81b72d9ef3098863a47089`，安装到日常 profile 的 135 个文件与归档一致；日常 DSH 正在重启，真实模型复验尚未完成。更新实施清单及两份验收记录，保留各自构建边界。

## 2026-11-05 日常 DSH 真实 Redis 初步验收

- 按用户授权安装源码 `90acc2c` 开发包到日常 `web` profile，135 个文件与包一致，启动日常 DSH；通过原生 Redis 面板只读连接用户本机 Redis。使用独立会话和现有模型进行明确 Key、字段、名称扫描和界面定位验证。
- 新增 `docs/verification/user-questions-real-model-2026-11-05.md`，记录实际工具调用、预算接口及界面定位结果；模型对 TTL 历史和 SCAN 快照的过度推断尚待修正。记录不复制业务 Key、字段或值；完整真实验收尚未完成。

## 2026-11-04 当前构建诊断与筛选复验

- 在独立 Redis 8.2.6 和真实 ToolRuntime 上，重新验证当前构建的四类服务器概况及五种诊断报告、指定 MATCH 的多批 Hash 筛选、显式 Hash 字段和二进制身份；检查脚本使用合成数据，测试实例均已停止。
- 同步 `docs/verification/current-development-package-2026-11-04.md` 和 `docs/DSH_AI_READONLY_TASKS.md`，区分当前构建的隔离实测与尚未完成的真实 DSH/模型验收。

## 2026-11-04 完整检查复验

- 对源码 `90acc2c` 重新执行 `pnpm check`，类型检查、构建及 79 个测试文件的 617 项测试全部通过；测试包含浏览器和宿主流，不能替代日常 DSH 与用户模型验收。
- 重建后核对开发包的 135 个文件与源码/构建一致，包 SHA-256 保持 `7c1cd9d90e38cd7234571ad06878b4556f917571383734ae1879d03ef747251c`。更新 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/current-development-package-2026-11-04.md`，说明完整检查结果及待验收边界。

## 2026-11-04 按 Key 类型校验读取范围

- 按实际 Key 类型拒绝不适用的分页、匹配和范围参数，避免忽略用户指定条件；在 String 值读取之前校验类型，并对集合续读复用相同校验。相关验证进行中。
- 增加六种类型的工具调用回归和 Hash 续读回归，并同步 `docs/AI_READ_USAGE.md` 的参数规则。
- 扩展独立 Redis 六类型脚本，检查 String 的不适用 MATCH 在 GETRANGE 前被拒绝。
- 完整检查发现两项既有 ZSet 并发测试沿用 Hash/Set 的无效参数；将其他类型请求改为合法参数，保留原有并发隔离断言，正在复验。
- `pnpm typecheck`、相关三文件 101 项和独立 Redis 8.2.6 专项通过；首次完整检查其余 78 个文件通过，失败文件调整后专项通过，未将分次结果记为单次完整通过。当前源码需要重新打包，真实日常 DSH 和模型验收仍待完成；方案、任务清单和开发包记录已标注旧包边界。
- 源码 `90acc2c` 已生成新开发包，SHA-256 为 `7c1cd9d90e38cd7234571ad06878b4556f917571383734ae1879d03ef747251c`；未重复执行 prepack。135 个文件与源码/构建及隔离安装内容一致，有限凭据模式扫描无命中，空 profile 安装和卸载通过。当前构建重新通过独立 Redis 的六类型、ACL 和切库专项；未启动日常 DSH，模型验收仍待完成。

## 2026-11-04 AI 切库与会话隔离验证

- 新增 `scripts/smoke-ai-database.mjs`，通过真实 DSH ToolRuntime 检查切库、会话隔离、无效数据库及 SELECT 权限拒绝，并核对合成数据及 TTL；确认失败时保留原数据库。
- `pnpm typecheck` 和独立 Redis 8.2.6 切库专项通过，测试实例已停止；同步 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/current-development-package-2026-11-04.md`。当前构建的日常 DSH、实际侧栏和模型验收仍待完成。

## 2026-11-04 Redis 权限拒绝验证

- 新增 `scripts/smoke-ai-permissions.mjs`，使用独立 Redis 的临时受限账号经过 DSH ToolRuntime 检查允许读取、字段读取及 Key 搜索被拒绝时的结果和错误脱敏，并核对合成数据及 TTL；避免将权限不足误判为空结果。
- `pnpm typecheck` 和独立 Redis 8.2.6 ACL 专项通过，测试实例已停止；同步 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/current-development-package-2026-11-04.md`，当前构建的日常 DSH 和模型验收仍待完成。

## 2026-11-04 六类型直接查询验证

- 新增独立 Redis 验证脚本，通过真实 DSH ToolRuntime 直接查询 String、Hash、List、Set、ZSet 和 Stream，覆盖截断、缺失 Key 与 Stream 重复字段，并核对测试数据、TTL 和写命令计数不变；测试使用合成数据且不启动日常 DSH。
- `pnpm typecheck` 和独立 Redis 8.2.6 六类型脚本通过；测试 Redis 已停止。同步任务清单和当前包验证记录，明确真实 DSH/模型验收仍待完成。

## 2026-11-04 直接读取身份与范围校验

- 普通 Key 文本读取复用现有无损 UTF-8 身份校验；Key 和集合 MATCH 拒绝无法无损编码的文本，不再悄然替换字符。侧栏选中具体字段或行时拒绝无效的分页/范围参数，避免忽略用户条件；模型说明和使用文档已同步。相关测试进行中。
- 增加注册工具测试，覆盖异常 UTF-16 不触发 Redis 读取、合法替换字符和二进制 Key 身份不变，以及选中字段时不再忽略范围参数。
- 扩展独立 Redis 脚本，用 TYPE 命令统计验证非法文本不触发读取，并核验合法替换字符和二进制 Key 的真实读取。
- 验证：类型检查、构建和六个相关测试文件共 127 项通过；独立 Redis 8.2.6 的无损文本、二进制身份、Hash 字段和测试数据/TTL 检查通过，测试实例已停止。当时源码待重新打包；日常 DSH/模型验收仍未完成。
- 源码 `4eafb8d` 的 `pnpm pack` 完整检查通过：79 个测试文件/610 项；归档 SHA-256 为 `4135363b94a45f49a73f1ebc794fab02352a3d6d5be9e0df43a37eb0ec90418f`。135 个文件与源码及隔离安装内容一致，随包链接、有限凭据模式以及隔离安装/卸载检查通过；未启动 DSH。日常 DSH 与模型验收仍待完成。

## 2026-11-04 名称查询范围约束

- 移除 AI Key 名称查询的隐式 `*` 默认值，要求首次查询和续读明确携带相同 MATCH；补充模型工具和使用文档说明，并拒绝无法无损编码的匹配文本。实现遵循明确范围、现有分页和最简原则；回归验证进行中。
- 按编译检查结果将现有 Key 与集合分页测试中的全库场景改为显式 `*`，使续读测试继续绑定原范围。
- 增加注册工具级回归：缺少范围或文本无法无损编码时不发送 SCAN；续读必须保持原 MATCH，明确的 `*` 仍可用于全库浏览。
- 扩展独立 Redis 脚本，使用命令统计核对缺少范围时不会发送 SCAN，并验证有明确前缀的名称查询与既有筛选。
- 验证：类型检查、构建及六个相关测试文件共 131 项通过；独立 Redis 8.2.6 实测缺省范围不发送 SCAN、明确前缀可查询及测试 Key 不变，测试实例已停止。当前源码需重新打包，日常 DSH 与模型验收仍待完成。

## 2026-11-04 诊断报告绑定原始采样

- 调整诊断结果的报告采样：暂存经字段限制的实际结果，在预算提交时同时记录会话标识，避免用户要求保存刚才结果时重新读取 Redis。超出结果预算时保留原诊断结果而不生成报告标识；实现和验证进行中。
- 删除重复采样工具，报告保存直接取读取器所持有的会话采样；修复迁移字段定义后发现的编译错误。
- 将报告测试切换到实际诊断工具，增加两次采样后保存第一次结果及保存时不再访问 Redis 的核验。
- 更新工具说明、离线使用指南及独立 Redis 脚本，以实际诊断结果的 `reportSampleId` 作为保存依据；相关 58 项专项测试通过。
- 修复类型检查发现的未使用提示，将原采样报告标识说明接入六个诊断工具。
- 增加采样提交前取消和单次结果字节上限回归，验证取消不留可保存采样、接近上限时保留原结果且不生成标识。
- `pnpm typecheck`、构建及诊断/预算相关 67 项测试通过；独立 Redis 8.2.6 六类报告回读通过、测试 Key 未变化且测试实例已停止。当时源码待重新打包，日常 DSH 和模型验收仍待完成。
- 源码 `f629530` 重新打包：类型检查、构建及 79 个测试文件/607 项通过；归档 SHA-256 为 `e73d74322e03119181ff765a9fde8234b6e283b2ec15fd9943fadf8e4e9c33d1`。135 个文件与来源及隔离安装内容一致，随包链接和有限凭据模式检查通过；隔离 profile 安装、配置及卸载通过，未启动 DSH。详见 `docs/verification/current-development-package-2026-11-04.md`。

## 2026-11-04 多类型预览格式验证

- 扩展 Hash、Set、ZSet、Stream 浏览器测试，逐项选中结果并执行格式动作，核对值预览渲染及 Hash/Stream 字段名格式不受影响。使用合成数据，验证进行中。
- 首轮四个视图均实际渲染 `6E 65 77`，测试断言误用小写导致失败；修正测试断言后重跑。
- `pnpm typecheck` 和四项浏览器测试通过；Hash/Stream 字段名保持原格式。任务清单已区分合成浏览器专项与未完成的日常 DSH/模型验收。

## 2026-11-04 多类型单次刷新验证

- 新增 Hash、Set、ZSet 和 Stream 实际浏览器视图的延迟刷新回归，检查旧内容仍在时不提前确认、新内容提交后才确认；`pnpm typecheck` 和四项浏览器测试通过。使用合成数据，当前构建的日常 DSH 与模型验收仍待完成。

## 2026-11-04 MATCH 预设宿主流联调

- 新增注册工具、真实 Host 动作流和浏览器侧栏贯通测试，检查筛选回执与扫描状态，以及用户抢先输入时旧动作失效；使用合成连接，不接触日常 DSH 和业务 Redis。`pnpm typecheck` 和两项贯通测试通过；同步任务清单的验证范围。

## 2026-11-04 当前开发包与文档

- 将 AI 使用说明纳入成品白名单，并将不随包分发的历史资料改为源码仓库链接；同步双语 README 和 `CHANGELOG.md` 的当前开发能力、专项检查与未完成真实验收边界。打包检查进行中。
- 源码 `8d32f60` 的 `pnpm pack` 通过完整类型检查、构建及 77 个测试文件/601 项；包 SHA-256 为 `8978385025e6964d5ee454933c69cce667881a552126459cb4c48ebec3f538fc`。核对 133 个文件、文档链接、有限凭据模式及隔离 profile 安装/卸载，未启动 DSH；详见 `docs/verification/current-development-package-2026-11-04.md`。用户日常 DSH、React 运行身份及模型逐项验收仍待用户允许重启后完成。

## 2026-11-04 扩展诊断报告

- 合并报告采样入口，扩展服务器概况、慢日志、客户端、Key 内存估计、String 有界比较和 Stream 消费组；Key 与组名称只保留 SHA-256 身份。工具仍只保存同一会话明确选定的采样，不接收自由文本、路径或 Redis 值。测试与文档更新进行中。
- 首次类型检查发现 JSON 返回类型与严格可选参数不匹配，改为复用现有 `AiJson` 类型并显式省略未提供的参数。
- 报告中的对象身份显式带 `sha256:` 前缀；同步调整隔离 Redis 脚本以验证六类诊断和敏感内容排除。
- 独立 Redis 8.2.6 实测四个概况类别和另外五类诊断报告通过，测试实例已关闭且测试 Key 未变化。报告进一步排除慢日志命令名，对非 Stream 类型仅记录 `other`；同步更新双语安装文档、使用说明和任务清单。
- 增加非法参数及 Redis ACL 拒绝的回归，确认权限失败明确记录且不会带出原始错误文本。
- 最终验证：类型检查与构建通过，两个相关测试文件共 58 项通过；收紧字段后再次通过独立 Redis 8.2.6 全部报告采样和回读。尚未在日常 DSH 和用户模型中验收。

## 2026-11-04 校正当前版本标识

- 将状态协议中的旧 `hostVersion` 改为表示声明目标的 `dshBaseline`，与依赖声明的 DSH `0.2.1-rc.5` 一致；协议版本增至 15，使新旧 Host/Client 不会把不同状态结构当作兼容。双语界面显示“目标”版本，不声称探测到实际宿主版本；相关验证进行中。
- 更新随包的双语安装和开发说明：区分旧 Release 验证与当前开发基线，修正开发包版本及 Cordis 声明，并说明本地报告和预设的保留位置。
- 验证：`pnpm typecheck`、`pnpm build` 及协议、客户端、可见面板与报告四个测试文件共 14 项通过。由于用户要求暂不重启日常 DSH，新协议尚未在该进程及模型中验收。

## 2026-11-04 本地概况报告

- 新增当前会话服务器概况采样及本地 JSON 报告工具：限定四类白名单指标、生成的文件名和 profile 目录；不接收自由报告文本或任意路径，采样绑定会话并限制保存数量。诊断结果包含采样时间、范围和连接身份；异常及验证仍在进行。
- 增加真实 ToolRuntime 专项，覆盖报告字段白名单、跨会话拒绝、任意路径和文本拒绝、会话结束失效以及保存中断的不确定结果。
- 专项使用真实概况解析器及合成传输数据，检查连接凭据和非白名单字段不会进入报告；使用说明和任务清单明确当前仅支持服务器概况报告及其验收边界。
- 新增独立 Redis 报告验收脚本，用于检查四类真实 `INFO` 采样、报告内容及测试 Key 不变；脚本只清理经过所有权校验的自建资源。
- 验证：`pnpm typecheck`、构建和两个相关测试文件共 58 项通过；独立 Redis 8.2.6（WSL 镜像）四类概况报告、凭据及合成值排除、测试 Key 未变化检查通过，测试 Redis 已停止。当前构建仍未在用户日常 DSH 和模型中验收。

## 2026-11-04 应用 MATCH 预设（进行中）

- 补充界面注入接口的 MATCH 处理器类型，修复本节点初次类型检查发现的接口缺项；界面行为和验证仍在进行。
- 更新预设工具测试的依赖注入，使测试使用真实动作协调器，修复新增参数导致的测试类型错误。
- 界面处理预设时核对会话、目标与可见状态，启动现有有界扫描并等待界面提交和选择同步；用户后续输入会使尚未确认的动作失效。Host 重新核验同步版本，结果只声称扫描已启动，未声称完成。
- 增加对渲染后筛选条件、清除选择和页面隐藏的检查，并更新现有浏览器测试夹具的依赖注入。
- 增加浏览器动作回归，覆盖筛选渲染、等待选择同步、扫描未完成时的准确回执以及用户新输入优先。
- 首轮针对性测试中，新增夹具因空白页缺少 `crypto.randomUUID` 失败；改用固定测试请求 ID 后重新验证，原有 5 个测试文件已通过。
- 聚焦详情时应用预设会显示筛选栏；补充 DSH ToolRuntime 到动作协调器的注册、缺失预设和无界面回执测试。
- 面板关闭信号会结束待确认动作；更新任务清单区分专项与真实 DSH/模型验收。两项新增专项及之前五项关联测试文件通过，完整检查待运行。
- `pnpm check` 通过：类型检查、构建、76 个测试文件共 600 项测试。新增预设应用使用说明；以上仍是本地与隔离测试，不代表当前构建已通过日常 DSH 和用户模型验收。

- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/client/ui-pane-presence.ts`、`src/client/index.ts`、`src/host/ai-match-tools.ts` 和 `src/runtime.ts`：为已保存预设定义受会话、连接和界面确认约束的应用动作；不把设置筛选等同于扫描完成。
- 原因和影响：复用既有 MATCH 存储和有界扫描，不新增 Redis 写入；预设应用会清除当前 Key 选择，界面接线尚在进行。
- 验证：类型检查和专项测试进行中。

## 2026-11-04 接入 AI 值预览格式

- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/client/ui-pane-presence.ts`、`src/client/index.ts`、`src/host/ai-reader.ts`、`src/host/ai-ui-tools.ts` 和 `src/runtime.ts`：定义受限格式动作，绑定可信会话、连接与选择。
- 新增 `src/client/FormatActionContext.ts` 并修改 `src/client/KeyBrowser.tsx`：补齐工作区注册类型与当前 Key 上下文，修复首次类型检查发现的缺失接口。
- 修改 `src/client/PreviewFormats.tsx` 和 `src/client/BytePreview.tsx`：格式更新在提交时重查动作有效性；只有可见值预览完成渲染且格式无错误才确认，用户手动切换优先。
- 修改六种基础类型的值预览入口及相关浏览器夹具：只将当前值预览注册为动作目标，Hash/Stream 字段名预览不随值格式动作改变。
- 格式状态按视图维护版本；动作失效时仅在没有较新手动格式选择的情况下回退，避免迟到动作影响新 Key 或覆盖用户操作。
- 手动更改预览格式会使旧选择版本失效；处理格式更新同步完成或取消交错，避免旧动作在用户之后提交。
- 修复格式回退函数的 TypeScript 类型，并完成 Set、ZSet、Stream 的版本化格式接线。
- 新增 `tests/format-action-browser.test.ts`：覆盖 JSON 成功、无效或截断、隐藏预览、动作回退顺序，以及手动格式选择和目标变化阻止迟到动作，8 项通过。
- 扩展 `tests/ai-tools.test.ts`：检查格式白名单、可信会话和当前选择绑定；工具专项通过。
- 扩展 `tests/ui-action-confirmation-browser.test.ts`：经真实工具入口、宿主流和 List 预览验证 Hex、无效 JSON 与用户选择变化；仍使用合成数据，实际 DSH/模型验收待执行。
- 原因和影响：支持用户按需让 AI 切换当前值的显示格式；不修改 Redis，格式错误或不可见时不得报告成功。
- 修改 `docs/AI_READ_USAGE.md` 和任务清单：说明可用格式、无效 JSON 处理和当前验收边界。
- 验证：`pnpm check` 通过类型检查、构建及 75 文件/599 项测试；包括 8 项格式浏览器测试与 3 项真实工具/宿主流格式测试。数据为合成夹具，当前构建的真实 DSH 和用户模型验收待完成。

## 2026-11-04 按读取身份实现 AI 单次刷新

- 新增 `src/client/read-confirmation.ts` 和 `tests/read-confirmation.test.ts`：以独立身份关联异步读取和实际提交的结果对象；旧渲染、未完成读取、取消和旧请求不能得到成功回执。
- 修改 `src/client/use-collection-scan.ts` 并新增 `tests/collection-read-confirmation-browser.test.ts`：集合的一次性读取绑定该身份，并等待对应结果或错误进入渲染状态；取消、目标变化和较新读取使旧身份失效，未能启动时立即拒绝。
- 修改 `src/client/auto-refresh.ts`、`src/client/AutoRefresh.tsx` 及其测试：刷新控制器统一等待具体读取器的确认，保持周期刷新默认关闭并隔离被替换的读取器；AI 动作通道尚未接入。
- 修改 `src/client/KeyDetails.tsx`：String 的一次性读取使用同一身份机制；取消、范围变化或新的手动读取使旧身份失效，错误保持现有预览并明确报告。
- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/client/ui-pane-presence.ts`、`src/client/index.ts`、`src/client/KeyBrowser.tsx`、`src/client/AutoRefresh.tsx`、`src/host/ai-reader.ts`、`src/host/ai-ui-tools.ts` 和 `src/runtime.ts`：按连接、Key 与选择绑定一次性刷新，等待同一读取渲染和选择重新同步；真实宿主流验证尚未完成。
- 更新 Key 浏览器和工作区浏览器夹具，明确提供刷新动作注册接口，避免测试遗漏真实依赖。
- 扩展 `tests/ui-action-confirmation-browser.test.ts`：通过真实工具注册、宿主动作流和合成 List 读取复现延迟、用户切换与隐藏场景；不能替代日常 DSH 和模型验收。
- 指针证据显示用户按下目标行时，取消提示插入导致表格位移，松开落在另一行。AI 动作中断改为保留原表格、静默取消，用户选择及指针位置复验通过。
- 新增 `tests/string-refresh-action-browser.test.ts`：验证 String 的延迟回执及被取消后用户手动读取优先；List 的正常、延迟、用户切换和隐藏场景已通过真实宿主动作流与合成数据测试。
- 扩展 `tests/ai-tools.test.ts`：验证刷新工具使用可信会话和已确认选择，不接受模型提供其他会话身份；正在执行相关回归。
- 原因和影响：AI 明确请求时发起一次只读刷新，只有该次结果渲染且同一选择重新同步才确认；不自动开启周期刷新，超时或回执丢失不能推断操作未发生。
- 验证：`pnpm check` 通过 74 文件/587 项测试；之后扩展的真实工具入口与同文件既有定位共 10 项测试再次通过。String 浏览器和 List 工具/宿主动作流覆盖延迟、用户新选择、隐藏及迟到结果，数据为合成夹具；其他集合及当前构建的日常 DSH/用户模型验收仍待完成。

## 2026-11-04 明确界面刷新验收契约

- 修改 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md` 与 `docs/DSH_AI_READONLY_TASKS.md`：将读取身份、渲染确认和选择重新同步直接并入现有界面动作方案及验收，纠正当前源码与历史打包基线的时间关系。
- 原因和影响：根据真实宿主流实验发现的旧结果误报，重新明确单次刷新必须绑定具体读取；未注册新工具、未改变运行代码，真实 DSH 和模型验收仍未完成。
- 验证：`pnpm typecheck` 通过；两个方案文件的本地链接检查无缺失。

## 2026-11-04 单次界面刷新方案复盘

- 对未提交的一次性 AI 界面刷新实验执行类型、组件和宿主动作流检查；组件测试通过后，合成 List 场景发现刷新自身使选择版本失效，重设计后正常刷新及隐藏面板场景通过。
- 进一步让 List 读取保持未完成并模拟用户切换选择，期望 `stale` 却得到 `applied`：旧渲染状态可被误当作新读取完成。该结果来自真实宿主动作流和合成浏览器夹具，不是真实 DSH/模型验收。
- 原因和影响：现有刷新时钟只观察 `busy` 和结果对象，缺少一次读取的明确身份，不能可靠地区分旧渲染、目标变化和新结果。为避免错误成功回执，已撤回本次未提交的刷新代码及实验测试；已提交的比较、诊断和现有手动刷新不受影响。
- 后续必须先设计由读取器生成并贯穿开始、结果和渲染确认的请求身份，验证取消、用户新操作、读取失败、隐藏、多接收端及回执丢失，再接入 AI；不能继续仅补状态判断。
- 回退后验证：`pnpm typecheck` 和 3 个文件/65 项相关测试通过；仅撤回本次实验，未改动日常 DSH 或 Redis。

## 2026-11-04 增加有界 String 比较

- 修改 `src/host/ai-reader.ts`、`src/host/ai-tools.ts`：用户明确指定同一 DB 的两个文本或规范 Base64 String Key 时，复用既有只读采样，每侧最多比较前 4096 字节；不向模型返回值，截断前缀相同不判为相等。
- 修改 `tests/ai-tools.test.ts`、`scripts/smoke-ai-overview.mjs`、`docs/AI_READ_USAGE.md` 和任务清单：覆盖完整相等、长度不同、相同截断前缀、缺失或类型不符、连接切换及参数边界，记录隔离 Redis 实测与使用范围。
- 原因和影响：支持无需发送值的有限比较；底层读取器每侧可能额外读取 3 个文本边界字节，两次读取各有时间，结果不是原子快照，不修改 Redis 数据。
- 验证：`pnpm typecheck`、55 项工具测试及文本/二进制 Key 的隔离 Redis 8.2.6 实测通过；连接切换时拒绝旧采样，夹具已停止且测试 Key 未变化。当前构建的真实 DSH 和模型验收仍待完成。

## 2026-11-04 当前开发构建打包检查

- 对源码提交 `d6959d3a80e9807063e21fe91f6e95885d567520` 执行 `pnpm pack`，预打包的类型检查、构建及 71 文件/574 项测试通过。
- 本地测试包为 `.scratch/readonly-audit-d6959d3.tgz`，SHA-256 为 `A0DC45E1A63CC2B15C287C2E1D4FE73077FC126DA6FAB47A952DA138ACAF5593`；该文件仅用于本机核对，未发布、未安装到日常 DSH。
- 检查包中文件名，未发现测试或临时目录、连接资料及常见密钥文件；扫描包内 130 个文件的私钥头、常见 `sk-` 令牌和带口令 Redis URL，均未发现候选项。有限模式扫描不能证明不存在其他格式的敏感信息。
- 原因和影响：为当前阶段保留可复核的构建证据；后续源码或文档变化后须重新打包，真实 DSH/用户模型验收和安装、卸载验证仍未完成。

## 2026-11-04 更新 AI 对话使用说明

- 修改 `README.md`、`README.zh.md` 和 `docs/AI_READ_USAGE.md`：按用户问题介绍直接读取与按需界面核对，列出当前开发版诊断和连接能力，区分旧版 Release、当前源码和真实模型待验收状态。
- 修改 `src/host/ai-tools.ts`：明确客户端列表不包含客户端地址，但既有 `connection` 仍提供目标服务器信息，避免对隐私范围产生误解。
- 原因和影响：纠正旧文档要求先选中 Key 以及“没有诊断”的过时表述；不改变 Redis 命令或读取行为。
- 验证：`pnpm typecheck` 和 AI 工具 53 项专项通过；README 对未随包分发的说明与验收记录使用源码仓库链接。本次不声称完成新一轮真实 DSH 或模型验收。

## 2026-11-04 增加 AI 客户端只读诊断

- 修改 `src/host/redis-transport.ts`、`src/host/client-list.ts`、`src/host/ai-reader.ts` 和 `src/host/ai-tools.ts`：增加连接状态采样，只允许 `CLIENT LIST`，屏蔽地址、名称、用户名及命令，最多返回 20 条。该命令无服务端分页，超出响应限制时报错。
- 修改 `tests/redis-transport.test.ts`、`tests/ai-tools.test.ts`、`scripts/smoke-ai-overview.mjs` 和任务清单：检查管理命令拒绝、字段过滤、权限及截断，并加入隔离 Redis 实测，记录真实模型验收仍待完成。
- 原因和影响：补齐按需排障能力，结果属于服务器级单次采样，不执行客户端管理或修改业务数据。
- 验证：基线 `pnpm check -- --silent` 通过类型检查、构建及 71 文件/572 项测试；新增诊断的类型检查及 2 文件/71 项专项通过。隔离 Redis 8.2.6 与 DSH ToolRuntime 实测通过，Key 未变且夹具已停止；首次断言误将既有当前连接地址计入客户端列表，修正检查范围后重跑通过。真实 DSH 和用户模型仍待验收。

## 2026-11-04 增加 AI 会话断开连接

- 修改 `src/host/ai-connection-tools.ts`、`src/runtime.ts`：按用户明确请求断开当前对话的 Redis，必须携带状态中获取的连接 ID 和代次；旧身份返回 stale，不触及替换后的连接或其他会话。
- 扩展 `tests/ai-connection-tools.test.ts` 和 `scripts/smoke-ai-connect-profile.mjs`：验证旧身份拒绝、参数边界及隔离 Redis 的实际连接后断开。
- 原因和影响：补齐连接生命周期；取消或回执丢失时先查状态，不能假定操作未发生。不会修改 Redis 业务数据。
- 验证：`pnpm typecheck`、构建、3 个文件/41 项专项通过；隔离 Redis 8.2.6 和 DSH ToolRuntime 实测连接后断开及 Key 不变，夹具已停止。真实 DSH 与用户模型仍待验收。

## 2026-11-04 接入保存的连接资料

- 新增 `src/host/ai-connection-tools.ts`，仅允许当前会话使用最近列出的资料 ID 和短期令牌连接；模型不接收密码，也不能提交任意主机。认证失败提示使用本地表单。
- 修改 `src/remote-service.ts`、`src/runtime.ts`、`src/host/connection-service.ts`：复用资料前后核对与候选连接，成功交换时同步清理旧目标的选择、游标和界面动作；失败保留原连接。
- 原因和影响：支持用户明确要求连接已保存资料，避免连接失败或资料变化时覆盖当前连接；取消或回执丢失后的结果必须重新查询状态。
- 连接交换前再次校验令牌仍属于同一会话且尚未过期或被重新列出替换，防止建立连接期间资料引用失效后仍切换。
- 新增 `tests/ai-connection-tools.test.ts`，经真实 ToolRuntime 检查令牌隔离、认证失败、旧连接保留和连接中令牌失效。
- 新增 `scripts/smoke-ai-connect-profile.mjs` 验证隔离 Redis 的资料连接交换和后续读取；`docs/AI_READ_USAGE.md` 更新资料连接及凭据边界。
- 验证：`pnpm typecheck`、构建与 3 个测试文件/34 项通过；隔离 Redis 8.2.6 及实际 ToolRuntime 验证令牌连接、连接代次、后续读取和数据不变，夹具已停止。真实 DSH 界面与用户模型验收待执行。

## 2026-11-04 增加 Stream 消费组只读诊断

- 新增 `src/host/stream-groups.ts`：解析受限的 `XINFO GROUPS` 响应，保留组名原始字节、待确认数与未投递数，区分 lag 未知及服务器未报告，限制模型输出数量和字节。
- 修改 `src/host/redis-transport.ts`、`src/host/ai-reader.ts`、`src/host/ai-tools.ts`：只允许明确 Stream Key 的 `XINFO GROUPS`，使用会话连接、类型校验、只读预算和固定错误；不读取消息、不 ACK、不推进消费组。
- 原因和影响：让用户针对指定 Stream 排查消息积压；服务器命令不支持分页，回复过大时明确失败，部分投影和采样边界需如实展示。
- 扩展 `tests/ai-tools.test.ts` 和 `tests/redis-transport.test.ts`：检查二进制组名、组数截断、未知 lag、缺失 Key、权限、错误格式、连接替换和子命令门禁。
- 新增 `scripts/smoke-ai-stream-groups.mjs`，只在隔离 Redis 构造消息和消费状态并回读比较；`docs/AI_READ_USAGE.md` 解释 pending、lag 与无服务端分页的边界。
- 处理 TYPE 与 XINFO 之间 Stream 消失的明确 Redis 回复，报告采样时 Key 缺失而非网络故障；增加对应竞态测试。
- 验证：`pnpm typecheck`、构建及 2 个测试文件/69 项通过；隔离 Redis 8.2.6 和 DSH ToolRuntime 验证二进制 Stream Key、pending/lag 及前后组状态和数据不变，夹具已停止。真实 DSH 和用户模型仍待新构建验收。

## 2026-11-04 增加 Redis 服务器概况

- 扩展 `src/host/redis-transport.ts` 的 `INFO` 门禁，仅允许固定的服务器、内存、客户端、统计和原有 keyspace 章节，不允许默认、all 或任意章节。
- 扩展 `src/host/ai-reader.ts` 和 `src/host/ai-tools.ts`：按明确类别只返回固定白名单指标，丢弃未知字段及不合格式的值；字段缺失标记部分结果，区分服务器范围、权限失败和采样时间。
- 原因和影响：回答服务器内存、客户端数量和命令统计等常见问题，保留数字精度，不把 INFO 原文或未知信息发送给模型；继续沿用会话目标和预算。
- 扩展 `tests/ai-tools.test.ts` 与 `tests/redis-transport.test.ts`，检查白名单、缺字段、精度、私有字段过滤、权限和 INFO 门禁。
- 新增 `scripts/smoke-ai-overview.mjs` 验证四类实际 Redis INFO 回复及合成 Key 不变；`docs/AI_READ_USAGE.md` 列出使用方法和部分结果语义。
- 验证：`pnpm typecheck`、构建及 2 个测试文件/65 项通过；Redis 8.2.6 隔离实例及实际 DSH ToolRuntime 对四个章节的验证通过，Key 数据不变，夹具已停止。用户模型和当前成品包的真实 DSH 验收仍待进行。

## 2026-11-04 增加有界慢日志诊断

- 扩展 `src/host/redis-transport.ts`：仅允许 `SLOWLOG GET` 且最多 10 条，拒绝重置、无限条数和其他子命令。
- 扩展 `src/host/ai-reader.ts`、`src/host/ai-tools.ts`：通过当前会话只读最近慢日志，仅投影命令名、ID、时间和执行耗时，不向模型返回命令参数、客户端地址或名称；明确日志是服务器范围，不能推断整个历史没有慢查询。
- 原因和影响：让用户直接询问近期慢查询；调用遵循原连接权限、预算、取消和上限，错误不能伪装为空结果。
- 扩展 `tests/ai-tools.test.ts`、`tests/redis-transport.test.ts`：覆盖条数和子命令门禁、字段脱敏、缺权限、畸形回复与空日志区别。
- 新增 `scripts/smoke-ai-slowlog.mjs`，仅在隔离 Redis 设置慢日志阈值并构造合成记录；更新 `docs/AI_READ_USAGE.md` 说明调用范围与脱敏。
- 验证：`pnpm typecheck`、构建以及 2 个测试文件/62 项通过；Redis 8.2.6 与真实 ToolRuntime 的慢日志验证确认参数未返回，日志及合成 Key 未变化，夹具已停止。真实 DSH 与用户模型仍待使用新包验收。

## 2026-11-04 增加明确 Key 的内存只读诊断

- 修改 `src/host/redis-transport.ts`：只允许固定形状的 `MEMORY USAGE <二进制 Key> SAMPLES 5`，拒绝其他 MEMORY 子命令、全量采样和额外参数。
- 修改 `src/host/ai-reader.ts` 和 `src/host/ai-tools.ts`：增加当前会话及 DB 内的显式 Key 内存估计，复用目标校验、期限、取消、会话预算和固定错误说明；结果包含采样时间与估计字节数，不读取值或依赖界面选择。
- 原因和影响：回答用户“这个 Key 占多少内存”，采样结果不能描述为精确值；权限不足、Key 不存在和连接变化分别处理。针对命令门禁、真实工具调用和隔离 Redis 补充验证。
- 新增测试覆盖非法子命令、无界采样、二进制 Key、权限拒绝、缺失 Key 和在途连接替换；只对本任务的合成数据运行。
- 新增 `scripts/smoke-ai-memory.mjs` 以隔离 Redis 和实际 DSH ToolRuntime 核验内存估计与数据、过期时间不变；更新 `docs/AI_READ_USAGE.md` 说明实际接口与估计边界。真实用户模型验收仍待对新构建执行。
- 验证：`pnpm typecheck`、构建以及 2 个测试文件/59 项通过；Redis 8.2.6 隔离实例的二进制 Key、缺失 Key 和数据/过期时间回读通过，夹具已停止。

## 2026-11-04 重构 Redis AI 只读方案

- 重写 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md`：从用户问题、连接范围、证据取得、回答与按需界面核对出发，重新确定产品范围、架构边界、优先级和验收方式，明确普通查询不依赖预选 Key。
- 重写 `docs/DSH_AI_READONLY_TASKS.md`：合并为七个按用户结果组织的执行节点，不继续追加旧 RO 编号；分别记录代码已有基础、本地测试结果和真实 DSH/模型验收缺口。
- 调整 `docs/RO21_CONNECTION_ARCHITECTURE_PLAN.md` 的定位：作为实际环境需要时的技术调研参考，执行范围和优先级统一由现行方案及清单决定。历史方案与验收记录保留，避免破坏已有证据。
- 原因和影响：解决以界面选择和工具拆分为中心的规划偏差，减少重复工作；本次不修改插件代码或用户 Redis。当前包完整检查通过 70 个测试文件、558 项测试，真实 DSH 模型的 Redis 场景仍待验收。
- 验证：`pnpm typecheck` 通过；文档链接和 Git 差异检查在提交前核对。

## 2026-10-15 建立独立项目目录与拆票草案

- 根目录：`E:\项目demo\dsh-redis`，按用户最新位置要求建立。未在桌面创建项目目录。
- 新增 `README.md`：提供项目定位、当前阶段、文档与任务入口，明确个人只读首版范围。
- 新增 `docs/DSH_Redis_开发路线与实施方案.md`：从已有路线复制，更新独立项目位置、当前阶段和本地研究链接；保留 P0/P1/P2 及技术边界。
- 新增 `docs/references/DSH_Database_Redis_功能与实现说明.md`：原研究文档完整复制，保留固定源码基线与功能对比，不改原件。
- 新增 `docs/TICKET_BREAKDOWN_DRAFT.md`：把横向开发步骤改为 21 张 P0 和 8 张 P1 的可展示纵向任务，列出编号、真实阻塞边、用户行为与验收摘要。
- 新增 `docs/agents/issue-tracker.md`：按用户选择记录本地 Markdown tracker、一票一文件和发布约定。
- 新增 `docs/agents/triage-labels.md`：记录 to-tickets 所需的默认 ready-for-agent 状态及阻塞规则。
- 修改原因：Redis 是独立新项目，需要独立文档、任务和后续代码边界；根据 to-tickets 先提供可审阅的任务拆分，再发布正式任务。
- 修改影响：当前仅建立规划文档，未创建运行代码、安装依赖或插件、连接 Redis、启动服务、初始化远端仓库或执行代码任务。未改动旧调研目录或参考项目。
- 链接处理：原 Git Graph 本机目录当前不可用，新方案中的 7 个自有源码索引改为固定提交 GitHub 链接，避免依赖失效的 C 盘路径。
- 审阅边界：正式 issues 待用户确认粒度、依赖及合并/拆分意见后生成；P2 仅列候选，不发布为待执行任务。
- 实际验证：7 份 Markdown 解析通过；草案连续 29 个编号、29 组交付与阻塞说明完整。依赖有向无环、无冗余直接边，P0 发布票覆盖全部 20 个前置任务；9 处本地链接有效，7 个固定提交 Git Graph 源码链接返回 HTTP 200。参考研究副本与原件字节相同，两份 C 盘原文 SHA256 均未变化；桌面未创建项目，正式 issues 尚未发布。代码编译、Redis 实连和安装测试未运行，本次没有代码变更。

## 2026-10-15 发布用户已确认的 29 张任务

- 用户确认：按原草案生成 29 张独立 Markdown，本轮不执行代码。
- 新增文件：`.scratch/redis-viewer/issues/01-native-sidebar.md` 至 `29-timeseries-chart.md`，合计 29 张；每张包含交付目标、编号与标题形式的阻塞项、ready-for-agent 状态、优先级和未勾选验收条件。
- 新增 `.scratch/redis-viewer/README.md`：正式索引、依赖执行步骤、里程碑与当前唯一可开始的 01 任务。
- 新增 `.scratch/redis-viewer/spec.md`：已确认范围和共同约束，供独立任务复用。
- 修改 `README.md`、`docs/DSH_Redis_开发路线与实施方案.md`、`docs/TICKET_BREAKDOWN_DRAFT.md`、`docs/agents/issue-tracker.md`、`docs/agents/triage-labels.md`：同步“用户已确认、任务已发布、实现未开始”的状态，保留拆分记录，入口转到正式索引。
- 修改原因：执行用户对拆分的明确确认，按 to-tickets 的本地一票一文件规则发布。
- 修改影响：保留原 21 张 P0、8 张 P1 和依赖，逐张继承已批准的验收摘要与共同约束；不创建 P2 任务，不执行实现、依赖安装、Redis 连接或服务操作；参考研究原件不变。
- 实际验证：29 张任务的编号、标题、交付、阻塞关系及原验收摘要与已确认清单一致；P0 21 张、P1 8 张，137 个验收项全部未勾选。依赖图无环、无冗余直接边，21 的传递前置覆盖全部 01–20，当前无阻塞任务仅 01。38 份 Markdown 解析、29 份复选清单和 46 处本地链接检查通过；参考研究 SHA256 保持不变。没有代码变更，未运行插件编译、Redis 实连或安装验收。

## 2026-10-15 补充稳定正式版、必要升级与最新源码副本流程

- 用户追加要求：开发使用最新稳定正式发布版 DSH；本机较旧则先升级；基于最新源码独立副本修改。本轮只写方案，不改代码或执行升级。
- 修改 `docs/DSH_Redis_开发路线与实施方案.md`：原 2.1 节标明历史调研基线；新增 2.4–2.7 节，定义开工/发布两次正式版本核对、当前只读快照、按实际渠道升级的步骤，以及正式宿主源码和最新两份插件参考源码的取得、固定 SHA、许可记录、复制裁剪与适配方法。同步 P0-00、P0-10、构建、验收和来源索引，移除“以旧 RC 接入为开发起点”的约定。
- 修改 `.scratch/redis-viewer/issues/01-native-sidebar.md`：补充最新稳定正式目标、实际运行入口/Node/profile/SDK、较旧安装先升级、源码独立副本与来源许可验收；没有合格正式版时不以 RC/alpha 替代。
- 修改 `.scratch/redis-viewer/issues/21-release-verification.md`：新增发布前复核正式版、必要同步和受影响验证；记录发行来源、核对日期与源码 SHA。
- 修改 `.scratch/redis-viewer/spec.md`：加入用户追加约束及其适用范围，区分版本调查、未来升级和本次文档工作。
- 修改 `.scratch/redis-viewer/README.md`：说明 01 没有任务阻塞不等于正式版本条件已满足，保留执行顺序；链接到详细版本证据和流程。
- 修改 `docs/TICKET_BREAKDOWN_DRAFT.md`：保留原 29 票粒度与依赖，明确本次为批准后追加约束，同步 01/21 验收摘要及共同范围。
- 修改 `README.md`：新增版本与源码基线入口，说明本机安装快照、后续必要升级及最新参考源码副本改造方式。
- 修改原因与原则：落实用户最新要求，避免将 npm latest、预发布或历史源码快照误作稳定正式开发基线；保持最简独立插件，复用必要源码，在正式 API 上改造，不修改参考项目、不维护旧版兼容层。
- 只读核对结果：本机 pnpm 入口所指 CLI 包为 `@deepseek-ai/dsh@0.2.0-rc.2`；官方 npm 注册表 latest/next 同为 RC，alpha 为 `0.2.1-alpha.4`。官方 RC 发行页标明 Pre-release，README 仍为 Developer Preview；本次尚未核实到合格正式目标，桌面内置核心与实际 profile 未确认。未从受限的 GitHub API 推断所有历史发行状态。
- 修改影响：共维护 8 份 Markdown（含本文件），未新增或删除文件；29 票仍为 21 张 P0、8 张 P1，状态均为 ready-for-agent，只有 01/21 增补验收，共 140 项全部未勾选。后续 01 先落实环境条件，21 负责发布复核；其余 27 张任务及固定研究副本未变。
- 实际验证：38 份 Markdown 解析通过，48 处本地链接有效；01/21 与拆分记录的验收内容一致；依赖图与原确认结果一致、无环、无冗余直接边，21 的传递前置仍覆盖 01–20。固定研究副本 SHA256 保持 `E138F4206B3534F3E7C74050CA7E7DC36B359AB1A64FEEB15E5E832271800B0C`。
- 未执行范围：未升级 DSH、未安装依赖或插件、未克隆或复制运行源码、未改代码、未连接 Redis、未启动或停止服务。没有运行代码，故未执行 TypeScript 编译、插件构建或真实安装验收。网页端 GPT 未参与评审。

## 2026-10-15 用户锁定 rc.2 并启动开发

- 用户明确选择 `0.2.0-rc.2`，授权代码实现；覆盖此前等待稳定正式版的前置条件，保留 RC 的真实发行属性。
- 同步根 README、共同 spec、任务索引、拆分记录、01/21 版本验收和任务状态规则；01 进入 in-progress，29 票编号和依赖不变。
- 新增 `.gitignore`：忽略依赖、构建、测试临时产物及只读上游 checkout；不忽略正式任务或 tests。
- 取得 `.scratch/upstream/dsh-git-graph`（33b3e67a39a429a0ff570d82d7264aab735fc1fd）、`dsh-database`（5d2b900b0317200b1866275c7cf48814fe84b52d）最新默认分支副本，以及官方宿主 tag `dsh-v0.2.0-rc.2`（639ed015397290b3745d163aafe02ffee4aa3f84）源码。副本用于接口核对和必要代码复用，不修改上游。
- 实际检查：Node v22.22.1、pnpm 11.22.0，`dsh.cmd --version` 为 0.2.0-rc.2；无需升级或重装。已只读核对参考接入与构建文件；尚未编译或验收插件。
- 原因与影响：版本目标已由用户明确，解除原文档中的稳定版等待；保持独立项目、最小复用和不做旧版兼容。未启动前后端服务，未改用户现有 profile 或 Redis 数据。

## 2026-10-15 任务 01：独立 Host/Client 与严格状态 RPC 骨架

- 新增 package.json、pnpm-lock.yaml、cordis.patch.yml、icon.svg，精确面向 rc.2；裁掉参考项目的 Git、subprocess、工具和模型提示依赖。
- 从 Git Graph 复制并修改 scripts/build.mjs、五份 tsconfig，生成独立 dsh-redis Host ESM / Client ModuleLoader；保留 strict、noUncheckedIndexedAccess 等检查，tests 不忽略。
- 新增 src/index.ts、runtime.ts、remote-service.ts、domain.ts、typert.shared.ts、typert.host.ts、typert.remote-client.ts：仅注册可信 Agent 作用域的 status 方法，Host 严格 Zod 与 Client 严格解析分别执行，支持请求取消，无 Redis 写入或任意命令入口。
- 新增 src/client/index.ts、RedisWorkspace.tsx、locales.ts、styles.ts：原生 Redis tab、隔离样式与宿主主题、状态空态、重试和卸载取消；贡献按 Cordis effect 清理。挂载失败不永久缓存，允许重试。
- 新增 vitest.config.ts、tests/host-typert.test.ts：验证两端拒绝额外/非法字段、版本匹配、只读状态和可信 Agent lookup，限定测试目录，避免误跑参考项目测试。
- 新增 LICENSE、licenses 下三份上游 MIT notice、THIRD_PARTY_NOTICES.md、docs/DEVELOPMENT_BASELINE.md，记录复用部分、锁定提交和本机命令版本。
- 原因与影响：按最简原则先形成不依赖 Redis 的侧栏通信链，避免把宿主接入与数据库问题混在一起；新项目与两份参考代码隔离。pnpm install --ignore-scripts 已完成，未执行安装脚本；下一步立即执行类型检查和专项回归，当前不声称通过或任务完成。

### 任务 01 首轮类型修复

- 根据 rc.2 Slots 的真实声明修正 src/client/locales.ts 与 RedisWorkspace.tsx：合并 LocaleNamespaceMap，使用框架注入的 t，替代不存在的 locale.t。
- 修正 src/client/index.ts：effect 捕获确定的挂载 Promise，不捕获可为 undefined 的共享变量；保留失败清空与显式重试行为。
- 原因：首轮 TypeScript 已暴露上述接口接入错误，立即按编译结果修正，没有归因缓存或添加旧版兼容。随后重新执行完整三层类型检查。

- 第二轮 Host/Client 类型检查已通过；tests/host-typert.test.ts 按 TypertCodec 的 mode 判别收窄后才访问 create，修复测试自身类型错误；不使用 any 或断言绕过检查。

### 任务 01 首轮通过与方案状态同步

- 实际 pnpm typecheck（Host/Client/tests）、3 项严格协议回归、pnpm build 已通过；浏览器产物原生加载、重试与清理继续验证，未标记任务完成。
- docs/DSH_Redis_开发路线与实施方案.md 同步用户最新决定、rc.2 开发/发布基线和实际进度，替换仍会阻塞实现的旧稳定版前置；链接 docs/DEVELOPMENT_BASELINE.md。保持历史官方快照和其证据，不把 RC 说成稳定。
- package.json 的 test 先构建再运行回归，check 统一串行 typecheck 与 test，保证后续产物回归读取本次源码构建结果。

### 任务 01 浏览器产物回归

- 新增 tests/client-bundle.test.ts：实际执行构建后的 ModuleLoader bundle，仅提供已声明的 React 外部模块；验证原生页签/slot/字典/样式注册、挂载失败重试、可信会话参数传递、卸载全部贡献后重新注册。
- 原因与影响：源码存在不代表浏览器闭包与生命周期可用；此回归覆盖真实打包代码，避免把 Node/Redis 依赖泄入浏览器及重复注册。原生完整 DSH profile 验收仍须另行执行。

- 产物回归首次编译发现 mock 被推断为无参数函数；为 mock 明确真实 RPC 参数类型后再检查，未使用 any 或忽略 TypeScript 错误。

### 任务 01 独立安装包与原生短测准备

- 本地打包前 pnpm check 再次通过（4 项回归）；安装包仅含独立运行文件、图标与许可证，无上游 checkout、依赖缓存或私人配置。
- 将本地 tgz 安装到项目专属 .scratch/runtime/dsh-home/profiles/web，使用 --ignore-scripts；未安装进用户日常 profile。新增开发依赖 playwright-core 1.62.1（复用本机 Chrome）和 scripts/smoke-dsh.mjs。
- 脚本按 rc.2 官方启动/鉴权/RPC 与右栏选择器执行短测，使用 localhost 随机端口、独立 session、离线模型占位配置，不发送模型 prompt；finally 关闭自己创建的浏览器及 DSH 进程树。启动 token/cookie 不写验收报告，日志 token 脱敏。
- 原因与影响：类型/模拟检查不能代替原生侧栏加载，短测验证安装包、可信 Agent lookup、真实 RPC、额外字段拒绝及原生 guide 打开页签。结果待实测，不提前勾选。

### 任务 01 原生短测首轮实际结果

- 安装包启动成功；启动令牌交换、真实存活 Agent 的 redisViewer/status 返回、原生网关拒绝额外字段均通过。
- UI 自动化被 DSH 首次 Preview Notice 拦住，并非插件 RPC 故障；脚本 finally 已确认关闭测试进程。未将该轮记为整体验收通过。
- scripts/smoke-dsh.mjs 按同版官方 Workspace/Session API 建立独立测试目录归属和明确标题，再通过真实会话树选择；正常点击 Continue 关闭首次说明，避免猜测 URL 或调用不存在的选择接口。下一轮验证原生 Redis 页签。

- 原生短测第二轮仍通过三个真实 Host 检查，UI 选择未产生消息的重命名空会话行失败；重新核对官方 workspace-new-session-folding 流程后，使用工作区行 hover 与 New session in 真实入口，移除对侧栏命名行的错误假设。测试进程均在 finally 关闭；插件实现没有为测试添加兼容或绕过。

### 任务 01 原生 UI 链路通过与视觉修正

- 项目专用 rc.2 web profile 的真实安装包已通过：启动鉴权、存活 Agent 作用域 status、额外字段拒绝、原生 guide 打开 Redis、浏览器实际 RPC 并渲染 Host ready；脚本记录 passed=true、processStopped=true。
- 人工查看 native-sidebar.png，确认原生页签和只读空态；发现此前一次脚本使用系统默认编码回读导致底栏分隔符成为乱码，修正 src/client/RedisWorkspace.tsx，后续读写统一显式 UTF-8。此次 UI 文本变化后重新打包并复验。

### 任务 01 安装产物一致性校验

- 修正编码后的构建与四项回归通过，但逐文件哈希核对发现 pnpm 对同一文件路径、同一包版本的重复 add 仍保留旧安装内容；该轮 native passed 仅证明旧包链路，不能证明分隔符修复已安装。
- scripts/smoke-dsh.mjs 新增启动前逐文件字节比较，安装内容不等于当前 lib 时直接拒绝验收；测试包改用 SHA 前缀命名的新文件路径再通过官方 plugin 命令安装，不直接改 node_modules，也不把现象归因于编译或通过结果。
- 影响：后续真实安装验收必须包含源码构建与实际安装文件一致的证据，避免同版本本地包导致假通过；只有通过一致性检查后的结果才作为任务 01 最终证据。

## 2026-10-15 任务 01 完成，进入任务 02

- 最终使用 SHA 命名的包重新安装并通过启动前文件一致性检查；原生短测 passed=true、processStopped=true，包 SHA256 为 e328834128252400813d8b33ae8246c7ef783bf8665ec2b9f1b0934a42e57062。当前构建确为被测版本，分隔符已复查正常。
- 新增 docs/verification/01-native-sidebar.md、01-native-smoke.json、01-native-sidebar.png，持久保存本票验证、边界、复现步骤与实际截图。
- 01 状态改为 done、6 项验收勾选；02 改为 in-progress。同步索引、README、共同范围与方案进度；其余任务不提前完成，29 票依赖不变。
- 原因与影响：原生第一条链路已具备可检查证据，按依赖进入手动连接。当前仍无 Redis 功能，不把原生页签通过扩张为首版完成。未改用户日常 profile，未连接用户 Redis；专用 DSH/浏览器测试进程已关闭。
- Redis 扩展环境准备：已只读确认 Docker Linux daemon 可用，并开始拉取官方 redis:8.2.6-alpine 供后续独占测试；尚未启动 Redis 容器，拉取仍在重试中，不算验证通过。

## 2026-10-15 任务 02：单机连接 Host 生命周期

- 初始化独立本地 Git 仓库（main），未提交或推送；正式任务和 tests 不在忽略规则中。
- 新增精确运行依赖 redis 6.2.1，并更新 pnpm-lock.yaml；参考 Database 的单机连接、认证和关闭流程，未引入其任意命令或写分支。
- src/domain.ts 增加输入专用凭据、连接身份/代次、状态和固定错误代码 DTO；新增 src/host/connection-service.ts：8秒连接/握手总时限、禁止自动重连/离线队列、PING 验证、测试连接所有出口关闭、可信会话隔离、替换/断开/退出资源清理、旧请求结果隔离。
- 原因与影响：连接资料与公开状态分离，密码不返回、不记录、不持久保存；用户断开不会重连，旧代次不能断开新连接。内部 RedisLink 只暴露关闭和失效事件，尚未向 Client 暴露 Redis 数据读取。
- 下一步立即检查类型；真实账号/网络与资源回归仍待执行，未标记本票通过。

## 2026-10-16 任务 02：会话当前连接与迟到结果

- src/domain.ts、src/host/connection-service.ts 收敛为每个可信会话一条当前连接，状态由 Host 返回；连接 ID 由 Host 生成并在重新连接时保留，generation 变化，断开校验两者。省去客户端自造 ID 及无界连接列表，面板重开可查询现存状态。
- 公开状态仅含 host/port/username 等非秘密目标；关闭时删除已关闭 link 引用和失效回调，取消后迟到的成功结果也会关闭自身 socket，不能覆盖新代次。优先保留超时的明确错误分类，认证分支保留首个服务器错误作内部判断。
- 原因与影响：避免面板卸载/重开留下不可见连接，保持最简会话归属；不同会话相互隔离，任何 RPC 结果都不包含密码。再次执行类型检查，专项回归接着补齐。

### 任务 02 严格连接 RPC 与会话清理

- src/typert.shared.ts、typert.host.ts、typert.remote-client.ts 增加 testConnection/connect/disconnect/connectionStatus 四个固定方法及两端严格 DTO 校验；host 只接受纯地址、端口与认证字段，拒绝 URI/额外写 operation/任意命令参数，公开结果不带密码。
- src/remote-service.ts 将连接实例归属到可信 Agent.session.id，监听 session/disposed 释放该会话资源，并在插件卸载时清理自身全部连接。测试连接不保留实例，状态查询不创建连接。
- tests/host-typert.test.ts 更新固定公开方法清单；随后的参数、错误分类、资源生命周期与真实连接回归不以仅增加接口为通过证据。立即执行三层类型检查。

### 任务 02 连接表单与显式操作

- 新增 src/client/ConnectionForm.tsx，更新 RedisWorkspace.tsx、client/index.ts、locales.ts、styles.ts：地址/端口/用户名/密码、测试、连接、断开、固定错误文案和 Host 状态恢复。只查询状态不会新建 Redis 连接，只有明确按钮触发联网。
- 请求持有取消信号与序号，卸载或后续操作使旧结果失效；连接成功清空密码输入，所有输入不写浏览器持久存储，错误只展示固定代码映射。
- 原因与影响：补齐本票 Host→RPC→UI 完整行为，使用当前主题和双语字典；尚无 Key/数据读取和 TLS 控件。立即执行类型检查，接着用生命周期与真实连接专项验证，不先勾选验收。

### 任务 02 生命周期与协议专项回归

- 新增 tests/connection-service.test.ts：验证临时测试资源关闭、认证错误脱敏、稳定身份与代次、旧断开拒绝、旧请求晚到、取消后迟到成功、测试取消、会话归属与销毁、失效后不自动重连、已取消请求不联网。
- tests/host-typert.test.ts 增加两端拒绝 URI/非法端口/超长密码/额外命令/TLS越界字段，以及公开响应内嵌密码拒绝检查。TLS仍归03，02不提前开放未实现的控件或参数。
- src/host/connection-service.ts 修正取消/超时先拒绝再关闭 socket，避免关闭错误覆盖真实原因；显式用户名允许空密码进入认证；测试连接在返回前复查取消，保证迟到结果不虚报通过。
- Docker官方镜像 redis:8.2.6-alpine 已成功拉取，digest ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e；未创建容器或接触用户实例。立即运行三层类型、构建与专项回归，后续再运行独占真实 Redis 验收。

### 任务 02 独占 Redis 真连接验收准备

- 新增 scripts/redis-fixture.mjs：固定官方 Redis 8.2.6 镜像 digest，随机绑定 loopback 端口、独立命名与所有权标签、内存/CPU限制、tmpfs数据目录；finally 核对所有权后删除自己的容器，不使用用户 Redis、不挂载宿主业务数据。
- 新增 scripts/smoke-redis-connections.mjs：使用实际 Redis 验证密码/错误密码、ACL用户名（含空密码）、无密码实例、测试/持久连接释放、状态查询不联网、会话销毁隔离、服务端断开、真实挂起socket超时及取消；检查最终客户端数量回到基线、全部测试容器已删除。
- fixture setup 的 ACL/CLIENT KILL 仅用于独占测试服务器，插件代码仍只有连接握手与PING，没有新增Redis写或命令台入口。脚本语法检查后执行；结果尚未预判。

## 2026-10-16 仅修订方案：最新稳定正式版、开发前升级与源码副本改造

- 用户最新要求：开发使用官方最新稳定正式发布版 DSH；本机不是该版先升级；根据最新源码独立副本改造。本轮明确只写文档，不改代码。
- 修改 `docs/DSH_Redis_开发路线与实施方案.md`：重写 2.4–2.7，明确稳定正式版判定、开工与发布前核对、CLI/桌面分别识别、按原渠道精确升级、资料保全和升级后核验；记录实际版本快照与未确认范围。说明先取得最新 Git Graph/Database 原样源码副本并固定提交，再复制必要骨架/Redis 读取分支到独立项目裁剪改造；宿主源码须对应稳定发行版，不以默认分支替代。同步 P0-00、P0-10、构建及验收约束，保留其他功能路线。
- 修改 `README.md`、`.scratch/redis-viewer/README.md`、`.scratch/redis-viewer/spec.md`、`docs/TICKET_BREAKDOWN_DRAFT.md`、`docs/agents/issue-tracker.md`：同步当前只写文档、后续稳定正式基线和源码复用顺序，去掉继续锁定 RC 的现行约定；保留 29 票编号、优先级、依赖和历史状态。
- 修改 `docs/DEVELOPMENT_BASELINE.md`：将现有 RC 安装、SDK 与上游 SHA 明确标为历史快照，新增本轮只读核对和后续对齐步骤，不虚构已升级、已取得新源码或已完成稳定版验收。
- 修改 `.scratch/redis-viewer/issues/01-native-sidebar.md`：只追加历史 RC 验收范围和后续正式目标复验说明，保留 6 项已完成证据及 done 状态。修改 `21-release-verification.md`：正式发布前核对最新稳定版、必要升级、源码/SDK 一致和受影响回归；未勾选任何验收项。
- 原因与原则：按用户本轮要求收紧版本基线，区分 latest 与稳定正式发行，保持最简独立插件和必要源码复用，不维护旧版兼容；保留真实历史证据，避免改写为新目标已通过。
- 实际只读核对（2026-10-16 00:22，Asia/Shanghai）：`dsh --version` 为 `0.2.0-rc.2`，PATH 优先为 pnpm 入口；官方 npm latest/next 同为 RC，alpha 为 `0.2.1-alpha.4`，已发布版本列表未见无预发布后缀的版本。官方 RC 和当前可见 alpha 发行标为 Pre-release，GitHub latest API 返回 403 限流，未据接口错误推断全部历史发行。当前尚未核实到合格稳定正式目标。
- 修改影响：本轮只维护上述 10 份既有 Markdown，代码、脚本、配置、依赖、lockfile、许可证、固定研究和既有验收产物不变。未执行 DSH 升级、插件安装、依赖安装、新源码克隆/复制、Redis 连接或服务启动/停止；没有调用网页端 GPT。
- 实际文档验证：41 份 Markdown 解析通过，50 处本地链接存在，无新增替换字符；29 票仍为 21 张 P0、8 张 P1，6 项历史已勾选、134 项未勾选，索引与任务状态一致。依赖图无环、无冗余直接边，发布票 21 的传递前置仍覆盖 01–20。
- 实际文件完整性：与本轮写入前 SHA256 比对，恰有计划内 10 份 Markdown 变化，未新增或删除文件；37 份非 Markdown 文件（含源码、脚本、测试、配置、依赖及 lockfile）及其余 27 张任务未变。固定研究 SHA256 仍为 E138F4206B3534F3E7C74050CA7E7DC36B359AB1A64FEEB15E5E832271800B0C。依赖目录、上游只读副本、构建和临时运行产物未纳入此哈希扫描，本轮没有对它们执行写操作。没有代码变更，未运行 TypeScript 编译、插件构建或代码测试。

## 2026-10-16 按当前持续目标恢复 rc.2 开发并修正空密码 ACL

- 当前持续开发目标明确为用户指定 `0.2.0-rc.2` 并直接实现；仍保留 RC 的真实发行属性，不等待稳定版或自动升级 alpha。前一轮仅文档操作记录保留，现行方案与任务约束接着同步到当前明确目标。
- 真实诊断：任务 02 实连脚本 line35 失败的是显式 ACL 用户加空密码，line32 有密码用户名已通过。独占 Redis 8.2.6 中，node-redis 6.2.1 默认 RESP3 返回 NOAUTH HELLO，而同一账户用 RESP2 返回 PONG；失败容器均已按所有权清理。
- 修改 `src/host/connection-service.ts`：固定 RESP2，使用驱动已存在的显式用户名 AUTH 路径；无兼容层或任意命令入口，保留超时、取消和资源归属。
- 修改 `src/client/ConnectionForm.tsx`、`src/client/locales.ts`：增加手动刷新 Host 当前连接状态和查询时间；查询不新建 Redis 连接、不引入后台轮询，便于观察外部断线。
- 原因与影响：以真实握手证据修正认证问题，并让用户明确知道连接状态的采集时刻；日志/DTO 仍不包含密码。保存后立即执行严格类型、构建和专项回归，再重跑独占实连，不提前标记通过。

### 当前 rc.2 约定同步与连接实连结果

- 修改方案第2.4–2.7、P0-00/10、构建与验收说明，根README、共同spec、任务索引/拆分记录、实际基线、01/21版本说明及tracker：当前目标为用户指定 rc.2 并实现，不等待稳定版；历史文档操作保留，不改写既有证据或29票依赖。
- 实际 pnpm check 通过：Host/Client/tests严格类型、构建、15项回归。修正协议后独占Redis真实连接8组检查全部通过，覆盖有密码/错误密码/命名ACL及空密码/无密码、临时与持续连接关闭、会话隔离与销毁、服务端断开、不自动重连、真实挂起socket超时与取消。两台独占Redis容器均已按所有权清理，报告 .scratch/artifacts/connection-smoke.json。
- 当前未完成：原生DSH中的连接表单交互与状态刷新验证；02保持in-progress，不将Host实连通过扩张为整票完成。没有启动用户前后端或触碰用户Redis。

### 任务02 原生连接表单验收准备

- 修改 scripts/smoke-dsh.mjs：在既有安装包一致性/可信Agent/原生guide测试之上，增加可选独占Redis模式，验证真实表单测试/错误密码/连接/断开/密码清空/浏览器持久存储无密码/手动查询时间/服务端断开后的刷新与不重连。
- 原因与影响：Host实连不能代替原生UI；不添加产品测试入口，沿真实RPC与表单操作。仍使用独立DSH_HOME、离线模型占位、loopback随机端口，finally关闭自己的浏览器/DSH进程，外层核对并清理独占Redis容器；报告不写凭据或启动令牌。
- 保存后先执行脚本语法检查，再重新打包为SHA路径安装到独立测试profile；实际结果待运行，不提前勾选。

## 2026-10-16 任务02完成，进入03 TLS

- 原生独立rc.2安装包9组检查通过；包SHA256 2f7970d70cc201d6cd47412a081ec740f0b8ad55157e6fe2b26547e4c2dc9a63。实际安装lib与本次构建逐文件一致，截图已人工核对，错误/空态/查询时间正常。
- 新增 docs/verification/02-standalone-connection.md、02-redis-connection-smoke.json、02-native-connection-smoke.json、02-native-connection.png，记录真实证据与未覆盖范围。
- 02状态done、4项验收勾选；03进入in-progress，其他未完成项不变。同步入口、方案/spec/拆分记录和tracker，29票依赖保持不变。
- 原因与影响：单机连接完整Host→RPC→原生UI行为已验证；测试临时资源均确认关闭，未接触用户实例或profile。TLS仍未实现，接下来按03实现并验收。

## 2026-10-16 任务03：TLS严格契约和验证连接

- 修改 src/domain.ts、typert.shared.ts、typert.host.ts：连接请求显式要求 tls=null 或仅含caPem的严格对象，上限64KiB；公开状态仅包含TLS布尔标记，不回传证书内容。新增证书信任/主机名错误固定代码；拒绝任意TLS选项、跳过验证、客户端私钥等参数。
- 修改 src/host/connection-service.ts：沿既有生命周期构造TLS socket，rejectUnauthorized始终true，DNS名设置SNI，IP仍由Node默认身份校验匹配IP SAN；可选CA为空时保留默认信任库，不设置自定义checkServerIdentity或明文降级。错误code映射到固定用户文案，不回显原始错误。
- 修改 ConnectionForm.tsx、locales.ts、styles.ts：TLS开关、可选PEM与验证说明，连接状态显示TLS；既有控制/秘密处理复用。更新两份专项测试的明确请求/状态形状、两个真实fixture脚本的tls=null，不维持旧请求兼容。
- 技术依据：Node22官方TLS connect/createSecureContext/checkServerIdentity文档、锁定node-redis6.2.1 socket源码，以及Redis官方TLS配置。仅验证服务器身份，不加入mTLS、关闭校验或额外连接框架。
- 保存后立即运行严格类型与专项回归；真实正确CA、错误CA、主机名不匹配和TLS资源清理接着以独占实例验证，不提前标记通过。

### 任务03 TLS夹具与严格验证回归

- 新增 scripts/create-tls-fixture.py：使用测试运行时已有cryptography生成短期根CA、无关CA、服务端证书/私钥，目录必须是本项目.runtime下精确UUID夹具；不写用户证书库，不保存CA私钥。
- 扩展 scripts/redis-fixture.mjs：可选TLS仅开放TLS端口，证书目录只读挂载，Redis不要求客户端证书；管理员仍使用正确CA/匹配身份验证，错误主机名样本单独生成。关闭容器后，校验实际路径、父目录与所有权UUID，再删除自己的证书目录。
- tests/host-typert.test.ts 增加两端拒绝跳过验证/私钥/CA路径/超长或缺失TLS契约；tests/connection-service.test.ts 增加固定TLS错误分类回归。中文说明改为“默认信任库”，不误称Node默认CA就是Windows系统证书库。
- 原因与影响：用可控证书链提供真实错误CA和错误身份样本，保持产品默认校验；测试工具不进入分发包。保存后检查脚本/Python语法并立即运行严格类型及专项回归。

### 任务03 真实TLS验证脚本

- 新增 scripts/smoke-redis-tls.mjs：在TLS-only独占Redis上验证私有CA有效链与IP SAN、持续连接/断开、错误/未知/无效PEM拒绝、默认Node信任库，以及可信CA签发但身份错误的证书；逐项核对客户端数回到基线。
- 默认信任分支仅在新建子测试进程设置NODE_EXTRA_CA_CERTS加载本次短期根CA，产品不注入信任库或关闭验证；子进程有12秒上限并等待退出。容器和证书目录均在finally按所有权与真实路径清理，报告不含密码/证书私钥。
- 实际前置：严格类型/构建与17项回归已通过；本脚本语法检查后运行，真实TLS结果待验证。

### 任务03 Host实连通过，准备原生TLS表单验收

- 实际 scripts/smoke-redis-tls.mjs 5组检查全部通过：可信CA/IP SAN、持续TLS与断开、错误/未知/无效CA拒绝、Node默认信任库、可信CA但错误身份拒绝；两台TLS-only容器及对应短期证书目录均已清理。
- 修改 scripts/smoke-dsh.mjs：REDIS_SMOKE_TLS=1在既有原生连接流程验证TLS开关/PEM、错误CA固定文案与纠正后的成功连接；报告/截图独立命名native-tls，避免覆盖02原始证据。包哈希先于spawn读取，避免元数据缺失时遗留测试进程。
- 原因与影响：原生TLS表单/严格RPC必须与真实Host校验一致，复用相同单机流程，不增加产品测试后门。保存后脚本语法检查，再打包安装真实验收；03仍未标记完成。

## 2026-10-16 任务03完成，进入04连接配置

- 17项回归、真实TLS5组和原生UI10组均通过；原生包SHA256 1a34e7660d23eb274fb4eabb8e85992ee36860edbf109bcf794627b8e5182b86，安装内容与构建逐文件一致，截图已人工核对。全部测试容器、证书目录、子进程、DSH与浏览器均清理。
- 新增 docs/verification/03-tls-connection.md、03-redis-tls-smoke.json、03-native-tls-smoke.json、03-native-tls.png。03状态done并勾选4项验收，04进入in-progress，同步入口与方案/spec/tracker，29票依赖不变。
- 下一步仅保存非秘密连接资料到当前DSH profile，密码不落盘，不增加“记住密码”或自动连接；采用已核实rc.2 ProfileContext.dir，不猜测用户主目录或写业务仓库。

## 2026-10-16 任务04：profile配置持久化与严格RPC

- 新增 src/host/profile-store.ts：当前profile下data/dsh-redis/connections.json保存非秘密设置，版本1严格文件结构、50条/4MiB上限，串行读改写，随机临时文件0600后原子替换；损坏/不支持格式明确失败，不静默重置或兼容旧文件。
- domain/typert.shared/typert.host/typert.remote-client.ts增加SavedConnection、保存/删除和列表DTO及3个固定Agent作用域RPC。保存设置严格拒绝password/额外字段，读取公开列表也校验身份唯一与选中项存在，不带连接密码或实时socket。
- src/index.ts、remote-service.ts声明profileContext依赖，使用rc.2官方ProfileContext.dir初始化存储；依赖manifest/lockfile接着加入精确app-boot SDK（开发类型及Host peer），没有猜测用户主目录或新增HTTP接口。
- 原因与影响：实现当前profile共享、会话手动选择的持久配置基础，文件保存不触发Redis联网，密码仍仅在连接内存；UI下一步接入。修改后立即安装锁定SDK（ignore-scripts）并运行严格类型/构建/专项回归，不提前完成04。

### 任务04 原生配置选择界面

- 新增 src/client/ProfileChooser.tsx，修改 ConnectionForm.tsx、client/index.ts、locales.ts、styles.ts：保存/更新/删除/刷新非秘密配置、重新选择普通/TLS连接，选择时清空密码并要求手动连接。连接或请求处理中禁用配置切换，配置请求与连接请求分别取消和隔离，刷新配置不会触发Redis联网。
- src/host/profile-store.ts保证临时文件清理失败也只抛固定存储错误，避免原始本机路径覆盖安全错误文案；已保存配置文件不因失败被删除或重置。
- 实际前置：精确app-boot SDK与lockfile安装完成（ignore-scripts），Host CRUD/严格契约已通过类型/构建/17项回归。此次UI接入后立即重新检查，再补真实文件重开/并发/失败回归和原生持久化验证。

### 任务04 真实文件和两端契约回归

- 新增 tests/profile-store.test.ts：使用项目专属临时目录验证普通/TLS重开、稳定ID更新/删除、并发不丢保存、拒绝密码、损坏/新版本/重复ID文件不被覆盖、不可用/超大文件、取消排队、profile隔离与50条上限；清理前验证真实父目录和自己的前缀。
- tests/host-typert.test.ts 增加两端保存请求/公共列表拒绝秘密、额外字段、非法名称、重复/未知身份的检查。没有模拟文件系统，把真实文件内容和失败后的字节保留作为断言。
- 原因与影响：配置存储必须可重开且失败不丢资料，不能仅靠界面或接口存在证明。保存后立即执行严格类型、构建和完整专项回归；原生重启仍待验证。

- 首轮27项中26项通过，失败位于测试夹具清理：rm非递归不能删除故意创建的空目录。tests/profile-store.test.ts改用rmdir精确删除该空目录，再检查超大文件；产品存储逻辑不变，随后重跑完整检查。

### 任务04 原生配置冷启动验收准备

- 实际 pnpm check：严格Host/Client/tests类型、构建、27项回归全通过，真实文件并发/重开/损坏保留/隔离/限额均通过。
- 扩展 scripts/smoke-dsh.mjs 的REDIS_SMOKE_PROFILES=1：第一轮通过真实UI保存普通/TLS、更新稳定ID、删除普通配置、选择时清密码和不联网，并以真实网关拒绝保存密码；关闭自己的DSH后，第二轮冷启动同一测试profile，重新选择恢复TLS资料、手动连接，再删除本次保存的测试配置。
- 原因与影响：文件类重开不能独立证明插件冷启动；双轮同profile验证真实持久化和手动联网边界，保留相同TLS/连接完整行为检查。报告分native-profiles-save/reopen，独占Redis和短期证书由外层finally清理。保存后语法检查，再打包安装测试；04仍未标记完成。

- 原生04首轮实际保存成功，测试在比较CA时因UI约定trim与夹具末尾换行不同而失败，自己的DSH/浏览器/容器/证书已清理。scripts/smoke-dsh.mjs修正3处预期为规范化PEM，不改产品；名称改用完整owner UUID，外层finally在Host退出后用产品存储类清理仅属于本次owner的配置，防止失败留下过期夹具。前次失败所留本测试profile条目按机器报告owner精确清理后再运行。

## 2026-10-16 任务04完成，进入05 DB/Key浏览

- 原生保存和冷启动两轮各12组全部通过；实际包SHA256 8a533c2685d5070ac490aa2da5f5c3e4e895b9f3c317d447e31d1f9d8c0d91eb，安装lib与构建一致。两轮截图已人工核对，连接配置文件最终空列表，不含密码；所有自己的进程、容器、短期证书与保存夹具均已清理。
- 新增 docs/verification/04-saved-profiles.md、04-native-profiles-save/reopen-smoke.json及两个PNG。04状态done并勾选4项，05进入in-progress，入口/spec/方案/tracker同步；29票依赖不变。
- 05接收边界决定记录到方案8.8：node-redis6.2.1源码与公开API无解码前最大bulk/array限制，COUNT及输出截断不能保护Host内存。因此先实现仅覆盖所需RESP2类型的有界接收适配器，按Redis官方协议在分配前限制长度/节点/深度/累计回复；复用既有生命周期，使用严格固定读取，不增加任意命令入口。适配器尚未实现或验证，接下来先以分片/二进制/大声明帧与真实Redis证明边界，再接入SCAN。

### 任务05 有界RESP2接收与二进制编码基础

- 新增 src/host/resp.ts：仅支持固定读取需要的RESP2简单串/错误/64位整数/二进制bulk/数组及null；增量处理任意TCP分片，在分配bulk前核对长度和累计1MiB帧预算，节点8192、深度32、单行4096字节，迭代收拢数组。超限或协议错误明确失败，不缓冲无限流、不把整数转为可能失真的Number。请求编码上限128KiB/1024参数，字节长度按UTF8或原Buffer计算。
- 新增 tests/resp.test.ts：真实协议帧往返、每个分片边界和逐字节输入、含CRLF/非法UTF8的bulk、64位边界/null/空值、512MiB bulk/十亿元素数组的仅头部拒绝、累计/深度/节点/行/请求预算和非法帧。测试不访问用户数据或服务器。
- 原因与影响：为所有后续读取在接收/解码层提供可验证边界，当前模块尚未接入已验收连接链；需先通过严格类型/专项检查，再接入socket和真实资源验收，不把单元检查当作完整05完成。

- 首轮类型检查发现resp.ts两处：TS不跨辅助方法追踪已完成结果的赋值，及Buffer数组从首项被推断为过窄ArrayBuffer参数。增加明确的结果读取方法、显式Buffer[]类型，不使用any/忽略检查；bulk/array长度同时只接受协议允许的非负十进制或-1。随后立即重新执行完整检查。

### 任务05 有界TCP/TLS连接适配

- 新增 src/host/redis-transport.ts：TCP/TLS始终验证身份，认证+PING共用8秒总预算；读取单帧1MiB、16项队列、10秒含排队总时限。派发前复查取消/截止/调用方目标校验。取消立即结束调用方等待，已派发回复仍有界排空后才允许下一条，超时/非法/超限则关闭该socket；无自动重连和回复串线。
- connection-service.ts将既有会话生命周期接到同一有界socket，删除原node-redis连接分支，RedisLink只新增内部固定命令读取（当前SELECT/SCAN）与派发前校验，不暴露任意RPC。domain/两端Typert/locale增加权限、超限、协议、排队已满固定代码；测试mock跟随内部接口。
- 原因与影响：把接收预算放到分配前，保留已验证的认证/TLS/手动连接和会话归属；目前尚未完成该适配器的真实回归，更未完成DB/Key。保存后立即执行严格类型与现有34项检查，接着重跑真实认证/TLS和对抗帧/资源验证，不凭协议单元测试宣称读取已安全。

### 任务05 真实传输前置回归与对抗socket检查

- 替换传输后，实际严格类型/构建/34项回归通过；既有真实Redis认证/生命周期8组、TLS5组均重新通过，测试容器/证书全部清理，未退化已完成的连接能力。
- 新增 tests/redis-transport.test.ts：自有loopback脚本peer验证超大bulk/array头部关闭、取消后排空不串回复、排队后目标校验拒绝派发、16项限额/取消队列、非法/半截帧、权限回复保留连接、禁止命令/已取消请求不写出。所有socket/server在finally关闭；真实Redis作为独立协议语义验收，不用脚本peer替代服务器结果。
- 原因与影响：接收预算和取消语义必须在实际socket事件中成立；保存后立即运行类型和专项检查。DB/Key UI与实际峰值资源测量仍待完成，05保持in-progress。

## 2026-10-16 本轮仅文档：补齐最新稳定正式版、升级和源码复制要求

- 用户本轮要求：开发使用 DSH 最新稳定正式发布版，本机不是最新版时先升级，基于最新版参考源码副本进行修改；明确只写到方案，不改代码。该要求作为后续开发和发布的现行约束，历史 RC 实现与验收记录保留。
- 修改 `docs/DSH_Redis_开发路线与实施方案.md`：更新第 2.4–2.7 节，写明正式版判定、当前只读版本快照、按原安装渠道升级及升级后实际入口/运行核心核验，以及“获取原样副本→记录 SHA/许可→复制必要骨架与 Redis 读取逻辑→独立裁剪改造”的步骤；同步 P0-00、P0-10、构建和验收要求。保持 12 类查看能力与原有开发顺序。
- 修改 `docs/DEVELOPMENT_BASELINE.md`：分开当前要求、本轮只读结果、历史 RC 源码/SDK 快照和后续落实步骤；不把历史 SHA 当作本轮新取得的最新源码，不声称已升级或通过正式版验收。
- 修改 `README.md`、`.scratch/redis-viewer/README.md`、`.scratch/redis-viewer/spec.md`、`docs/TICKET_BREAKDOWN_DRAFT.md`、`docs/agents/issue-tracker.md`：同步本轮文档边界与后续版本/升级/源码要求，保留原 29 票粒度、优先级、依赖和历史状态。
- 修改 `.scratch/redis-viewer/issues/01-native-sidebar.md`：保留已勾选的历史 RC 验收，明确新正式目标需要复验，不以原 done 状态替代新目标。修改 `21-release-verification.md` 及拆分记录对应摘要：发布前复核最新稳定正式版、必要升级、源码/SDK 对齐和受影响验证；未勾选新验收项。
- 原因与原则：落实用户最新消息，区分 latest 分发标签与稳定正式发行；遵循最简独立插件、必要源码复用和不做旧版兼容原则，避免文档继续要求直接采用旧 RC。
- 只读结果（2026-10-16 01:25，Asia/Shanghai）：用现存 pnpm shim 绝对路径执行 `--version` 返回 `0.2.0-rc.2`；本轮 Get-Command dsh 未解析到入口。官方 npm latest/next 同为 RC，alpha 为 0.2.1-alpha.4，返回的版本列表未见纯 X.Y.Z 正式号；官方可见 RC/alpha 发行均标为 Pre-release，GitHub releases API 限流 403，不能据此断言全部历史发行状态。尚未核实到符合要求的正式目标。
- 修改影响：本轮仅维护上述 10 份既有 Markdown（含本文件）；没有修改代码、脚本、配置、依赖、lockfile、许可证、固定研究或历史验收产物，没有升级或安装 DSH/插件/依赖，没有克隆或复制新运行源码，没有连接 Redis、启动或停止服务，没有使用网页端 GPT。文档保存后执行文档一致性、任务与文件完整性检查；代码检查不在本轮运行。
- 实际文档检查：44 份 Markdown 的 UTF-8、代码围栏及主方案引用定义检查通过，57 处本地链接存在；29 票仍为 P0 21 张、P1 8 张，历史已勾选 18 项、未勾选 122 项，索引与各票状态一致。依赖图无环、无冗余直接边，21 的传递前置仍覆盖 01–20。本次为结构与一致性检查，没有安装或调用额外 Markdown 渲染器。
- 实际文件完整性：写入前后 SHA256 对比，127 个受检文件中仅计划内 10 份 Markdown 变化，无新增或删除；其余 117 个文件（含全部 83 个非 Markdown 文件及其余 27 张任务）未变。固定研究 SHA256 仍为 E138F4206B3534F3E7C74050CA7E7DC36B359AB1A64FEEB15E5E832271800B0C。依赖目录、Git 元数据和上游/运行/临时产物目录未纳入本次扫描，本轮没有对它们执行写操作。没有运行 TypeScript 编译、构建或代码测试。

## 2026-10-16 当前明确目标继续 rc.2 实现与任务05

- 用户当前持续目标明确选择 `0.2.0-rc.2` 并直接开发；同步根 README、实施方案、实际基线、任务索引/spec/拆分记录、tracker 和01/21的现行执行说明。此前仅文档和稳定版调查作为历史保留，顶部当前决定覆盖其阶段限制。发布票21明确核对固定rc.2、源码/SDK及最终包一致，不升级alpha。
- 现有源码/依赖仍精确面向rc.2，无版本迁移或旧版兼容。29票范围、依赖和状态不变，继续05 DB/Key，未完成项不提前勾选。
- GPT-6 LUNA 已只读描述当前 SELECT/SCAN、会话归属、严格协议、取消队列、UI及测试入口；主任务根据真实接口实现，不采用未经复核的结论。
- 下一步新增DB/扫描DTO、可信会话读取和有界Key浏览；先验证类型与专项，再做独占Redis/原生安装。用户日常profile、Redis和服务不参与测试；不使用网页端GPT。

### 任务05 DB与SCAN完整数据链

- 修改 src/domain.ts、两端Typert及remote-client：公开连接增加DB；新增严格DatabaseTarget、ScanKeysRequest/Result、原始Base64 Key身份、固定SELECT错误与响应/缓存预算。Host仅提供selectDatabase/scanKeys结构化读取，不接收任意命令、owner或Redis游标。
- 修改 connection-service.ts：每个可信会话独立socket；切DB前推进generation，读取在入队、派发和结果返回时复核身份/DB。确认的权限/DB范围拒绝保留原DB，SELECT取消或不确定失败丢弃自身socket，避免错误DB继续读取；不影响其他会话。
- 新增 host/key-reader.ts：每动作一条SCAN，COUNT100仅为提示；不透明单次token绑定会话/连接代次/DB/MATCH，刷新替换旧扫描，空页可继续，二进制Key按字节去重。原始帧1MiB之外，Key64KiB、4096项及JSON/Base64后1MiB另限额；超限明确失败，不丢页尾再推进游标。remote-service.ts负责会话/连接切换时清理扫描。
- 新增 client/KeyBrowser.tsx、key-cache.ts，修改 ConnectionForm/index/locales/styles：显式DB输入、MATCH扫描/续扫/刷新/取消、时间/扫描完整性、Key字节数与原始Base64选择；不自动扫描、不调用INFO/CONFIG。缓存同时限制5000行和编码后累计2MiB，达到上限明确不完整并要求缩小范围。
- 实际检查：新增DTO后编译立即指出公开连接schema缺db，接通两端schema后指出缺少database本地化；按真实错误补齐，无any/兼容层。当前Host/Client/tests严格类型已通过；专项、真实Redis、资源与原生安装验证继续，不提前完成05。

### 任务05 专项、资源、真实Redis与原生包验证

- 新增 tests/key-browser.test.ts 的12项：DB/会话隔离、拒绝旧代次与错DB、SELECT权限/范围拒绝、取消后丢弃不确定socket、切库晚到回复、uint64游标/空页、二进制/空Key、token重放及MATCH/归属、刷新旧页、实际JSON放大预算、权限/预取消、缓存行数/字节、两端严格契约。host-typert原固定方法/公开状态断言同步新接口与db。
- 实际严格类型/构建及53项回归通过。首次测试在执行前因C盘可用空间0遇到ENOSPC，已把本次TEMP/TMP移到项目E盘专用目录后通过；未删除或移动用户文件。系统Docker API及创建调用超时，未将其记作功能通过。
- 新增 scripts/smoke-redis-limits.mjs，4个独立Node进程验证512MiB bulk声明、十亿元素array、两个600KiB累计帧及实际10秒挂起读取。全部通过；前三者4–5ms拒绝，RSS实测增量约0.5–2.7MiB，挂起读取10013ms结束并关闭自身socket。这是该场景的实测，不承诺整个Host峰值只有1MiB。
- 新增 scripts/prepare-redis-image.py 与 wsl-redis-fixture.mjs，redis-fixture.mjs增加显式REDIS_TEST_BACKEND=wsl-image：从官方registry取得固定index与amd64 manifest，验证每个SHA256和大小，仅在本项目E盘缓存内受限提取普通文件/文件链接；不安装系统包、不运行镜像入口、不创建跨根symlink。使用本机既有WSL Ubuntu与镜像musl loader运行官方Redis8.2.6，显式加载镜像内4个模块，随机loopback端口、128MiB数据上限、无持久化、私有UUID配置/证书；finally仅关闭已认证自有实例或核实cwd后信号自身pid，核验退出再清理精确目录。Docker仍为默认测试后端，不静默替换。
- 镜像index ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e，amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e；版本8.2.6和JSON.GET/TS.RANGE/BF.INFO已实际确认。WSL首轮空命令参数被拒，改为私有redis.conf后正常启动；未修改产品代码来适配测试。
- 新增 scripts/smoke-redis-keys.mjs：真实8组全部通过，352个Key（含二进制和空名）增量扫描、DB/会话隔离、无INFO/CONFIG账号、SELECT/SCAN拒权、越界DB、DUMP原始字节/绝对过期时刻与DBSIZE不变、64KiB键名应用层拒绝及1MiB线帧超限关闭。首次对ACL DRYRUN误用rejects断言，实查其返回拒权文本后修正测试，产品不变。真实TLS5组在新后端也重新通过，所有自有实例/临时证书/配置已清理。
- scripts/smoke-dsh.mjs增加安装版DB/SCAN契约检查与REDIS_SMOKE_KEYS=1完整UI流程（显式续扫、二进制身份、空MATCH、切DB/无效DB恢复），独立截图/报告；新包SHA9846fc6806ce39408aa71e520b9fb1cfdebc9e79e57ffd8e38183c3ceb293e5f已按SHA文件名安装到独立profile，缓存/TEMP仅本次进程使用E盘。基础原生加载/新严格契约5组通过且进程关闭；真实Key UI交互正在执行，05暂不完成。

## 2026-10-16 任务05完成，进入06 String

- 53项严格类型/构建/专项最终通过；真实Key8组、资源4组、原生TLS+Key UI15组、既有连接8组及TLS5组回归全部通过。当前验收包SHA9846fc6806ce39408aa71e520b9fb1cfdebc9e79e57ffd8e38183c3ceb293e5f，安装文件与构建一致，实际截图已人工核对。
- 新增docs/verification/05-db-key-browser.md，持久保存05的Redis/资源/原生/认证/TLS五份JSON与Key选择PNG；明确本次使用官方固定镜像文件+WSL的实际运行载体，不记为Docker通过，不扩张为其他类型或完整首版完成。全部自有实例、DSH/浏览器、临时证书/UUID配置已清理；测试缓存/镜像只保留在E盘忽略目录。
- 05状态done、5项勾选；06进入in-progress。同步README、spec、任务索引、拆分记录、基线和方案；消除现行段落中遗留的仅文档/等待稳定版限制，历史操作记录仍保留。方案6.2按实际每会话独立socket、切DB代次校验描述，未建设无用跨会话连接池。29票范围和依赖不变。
- 下一步实现TYPE/PTTL/STRLEN/GETRANGE固定只读路径与原字节预览，保留JSON数字词法、分段UTF8边界和显式Base64解码，不新增写操作或任意命令入口。

### 任务06 String元信息、字节窗口和无损格式

- 新增host/string-reader.ts，修改domain/两端Typert/remote-client/remote-service：固定TYPE/PTTL/STRLEN/GETRANGE读取，64KiB窗口、前后最多3字节UTF8上下文，空/消失/不支持/读取中类型或长度变化/失败分别返回；元信息与位置使用精确整数文本。既有会话/DB/generation校验沿用，未加入GET或任意命令RPC。
- redis-transport/connection-service支持向固定读取传入统一绝对截止；一次String读取的多条元信息/值命令共用10秒总预算，排队与派发仍受原上限控制。WRONGTYPE映射固定type-changed并丢弃本次字节，不冒充网络错误。
- 新增client/KeyDetails.tsx和value-preview.ts，接入KeyBrowser/index并补充locale/styles：点击Key读取，显式偏移/窗口/刷新/下一段与取消；Text/JSON/Hex/Binary-Base64和显式Base64解码只作用于已读字节。分段JSON不冒充完整文档；非法UTF8明确失败，跨界文本用最小上下文补全并注明窗口外字节，Hex/Base64仍保留精确窗口。
- JSON.parse仅验证语法，显示token逐字复制原文，保留大整数、指数、-0、重复字段和转义；缩进深度64、显示512KiB上限。连接代次/DB变化令KeyBrowser重挂载，旧选择不能自动在新目标读取。
- 新增tests/string-preview.test.ts的13项，覆盖4MiB值分段/EOF/空值、二进制Key、精确TTL与统一截止、Key消失/变化/权限、预取消/超时、所有UTF8切点、BOM/非法字节、JSON数字/重复字段/转义及深度、显式Base64成功/失败、两端范围/身份/数据一致性。更新host-typert固定接口清单。
- 实际Host/Client/tests严格类型、构建及66项回归全部通过。首轮新增type-changed后编译发现缺少本地化，已立即补齐；不绕过类型。真实Redis范围/ACL/只读与原生值UI仍待验证，06保持in-progress。

### 任务06 实际范围/只读证据与原生值交互准备

- 新增scripts/smoke-redis-strings.mjs，真实7组全部通过：二进制Key/毫秒TTL/空值、每个真实UTF8切点与上下文、4MiB值64KiB分段/EOF/缺失/其他类型、无GET/SET且DUMP和绝对过期时刻不变、只授GETRANGE不授GET的ACL成功及拒权、过期/旧DB代次、在实际服务端回复间由夹具管理员改变类型/长度/删除后丢弃旧字节。变更仅发生在独占测试夹具。
- scripts/smoke-redis-limits.mjs新增200ms绝对操作截止检查，与原4组一起通过，证明多步读取可把剩余总预算传给实际socket，不重新给每条命令10秒。
- KeyDetails用共享schema在发RPC前校验精确整数范围，提供固定范围提示；缓存格式化结果，输入编辑不重复格式化大窗口。两端响应补充前后上下文字节不得越出值边界。保存后严格类型及打包前66项回归再次通过。
- scripts/smoke-dsh.mjs加入REDIS_SMOKE_STRINGS=1：真实UI格式/大整数与指数、Base64解码和错误、非法UTF8、分段JSON拒绝/下一段/末字节、跨界字符与Hex偏移、整数范围、其他类型/空值/Key消失。种子数据和截图/报告单独标识，不改写05历史验收。当前重新按SHA文件名安装并执行完整原生UI，结果待回读，06尚未完成。

## 2026-10-16 任务06完成，进入07 Hash

- 最终严格类型/构建及66项回归、真实String7组、socket/资源5组和原生TLS+DB+String20组全部通过；包SHAabfa2eb11d3678d900017868f59f8596b830ff1a9dfcf90f9c2a1e96f9a4a2e8，安装lib与构建逐文件一致，原生JSON截图已人工核对。包含05完整流程回归，跨界UTF8/分段JSON/大整数/指数/解码错误与无效整数均有真实UI证据。
- 新增docs/verification/06-string-preview.md及三份JSON、一份PNG，记录真实范围和非原子快照等限制。自有Redis、DSH、浏览器、短期证书/配置均已清理，无用户数据或日常profile变更。
- 06状态done、5项勾选；07进入in-progress，入口、spec、方案、索引、拆分记录及tracker同步。29票范围/优先级/依赖保持不变，首版仍未完成；接下来实现Hash增量字段/值、共享表格与单元格字节查看。

## 2026-10-16 02:22 仅更新方案：稳定正式版、必要升级与最新源码改造

- 修改原因：落实用户本轮明确要求，开发基线使用最新稳定正式发布版，本机不一致先升级，基于最新源码在独立目录改造；本轮只写方案，不改代码。按最简原则更新既有文档，不重拆任务、不引入旧版兼容。
- 修改 docs/DSH_Redis_开发路线与实施方案.md：重写 2.4–2.7，区分正式发行与 npm latest/RC/alpha，写明实际 CLI 与桌面分别核对、保全资料、按原渠道精确升级及升级后复核；补充最新源码取得、固定 SHA、原样副本、必要源码复制和独立改造顺序。同步 P0-00/P0-10、构建、发布验收及历史验证边界，并修正 06 已完成却仍写 06 进行中的状态文字。
- 修改 docs/DEVELOPMENT_BASELINE.md：将当前稳定要求、本轮只读结果、后续步骤与历史 RC 源码/SDK 快照分开。尚未核实的正式目标不虚构版本号，不声称已升级或取得新源码。
- 修改 README.md、.scratch/redis-viewer/README.md、.scratch/redis-viewer/spec.md、docs/TICKET_BREAKDOWN_DRAFT.md、docs/agents/issue-tracker.md：同步本轮文档范围与后续共同前置；保留 29 票的范围、编号、优先级、依赖和历史状态。
- 修改 .scratch/redis-viewer/issues/01-native-sidebar.md：保留已勾选 RC 验收，仅说明新稳定基线必须复验；修改 21-release-verification.md：把未勾选的发布版本门禁改为最新稳定正式版、必要升级和对应源码/SDK/包一致性。没有勾选新验收项或改变任务状态。
- 只读核对：本机 pnpm CLI 为 0.2.0-rc.2，官方 npm latest/next 同版、alpha 为 0.2.1-alpha.4，完整元数据未见纯 X.Y.Z 正式号；官方 RC 发行页明确为 Pre-release。GitHub releases API 返回限流，不作为无正式发行的证据。桌面实际核心未确认，稳定正式目标待核实。没有修改本机安装。
- 修改影响：本轮计划内仅上述 10 份既有 Markdown（含本日志）变化，既有源码、脚本、配置、依赖、lockfile、许可证、固定研究和验收产物不改。没有执行升级、安装、新源码克隆/复制、代码构建/测试、Redis 连接或服务启停，也没有调用网页端 GPT。保存后核对文档一致性、任务状态/依赖与文件哈希，实际结果补记如下。
- 实际检查结果：写入前后 SHA256 比对共 127 个文件，恰有上述 10 份 Markdown 变化，无新增或删除；全部 81 个非 Markdown 文件及其余 27 张任务不变。固定研究 SHA256 仍为 E138F4206B3534F3E7C74050CA7E7DC36B359AB1A64FEEB15E5E832271800B0C。9 份关联文档一致性检查通过；29 张任务仍为 P0 21 / P1 8、done 6 / in-progress 1 / ready-for-agent 22，28 项已勾选 / 112 项未勾选，全部阻塞依赖与写入前一致。依赖目录、Git 元数据及被忽略的运行/上游/构建目录未纳入此哈希扫描，本轮没有对它们执行写操作。未运行 TypeScript 编译、构建或代码测试。

## 2026-10-16 继续指定 rc.2：任务07 Hash 数据链与验证

- 用户当前持续目标明确采用 0.2.0-rc.2 并直接实现；本机 CLI 再次核对同版，不重复安装。同步 README、实施方案2.4/2.6及当前目标文字、DEVELOPMENT_BASELINE、任务索引/spec/拆分记录、tracker、01/21说明；前次稳定版调查和仅文档日志保留为历史，29票范围、优先级、依赖和历史完成状态不变。
- 新增 src/host/hash-reader.ts、byte-identity.ts；修改 domain.ts、host/key-reader.ts、redis-transport.ts：固定 HLEN/HSCAN 读取，复用现有 read-context.ts 的10秒总截止及 scan-cursors.ts 的目标绑定单次令牌。严格解析偶数字段/值对、原始二进制字段、uint64游标；对Key消失、类型/字段数变化丢弃整页，COUNT仅提示。字段上限64KiB，值只外发64KiB前缀与最多3字节UTF8上下文，保留实际长度；接收仍由既有1MiB整帧/节点/深度上限控制，不把前缀当完整值或接收预算。
- 修改 typert.shared.ts、typert.host.ts、typert.remote-client.ts、remote-service.ts：增加唯一固定scanHash接口及两端严格schema，校验字节长度/前缀/元信息/状态/JSON预算；复用元信息解析，不开放HSET/HDEL、任意命令或秘密响应。连接/会话销毁清理Hash扫描令牌。
- 新增 client/HashView.tsx、CollectionTable.tsx、BytePreview.tsx、hash-cache.ts；修改 KeyDetails.tsx、KeyBrowser.tsx、index.ts、locales.ts、styles.ts：选择Hash自动进入字段/值表，明确服务端MATCH、已加载数与HLEN总数；逐次继续/刷新/取消，原始字段身份去重并更新重复字段值，缓存5000行/2MiB双上限。字段和值单元格复用Text/JSON/Hex/Base64与显式解码，部分值拒绝完整JSON格式化；表格与字节预览供后续集合复用，无写入口。
- 新增 tests/hash-view.test.ts 14项，修改 tests/host-typert.test.ts 固定接口清单；覆盖二进制与空字段/值、统一截止、非终止空页/uint64游标、重放/错目标、刷新迟到、前缀/超限、消失/类型/长度变化、奇数对/坏游标、权限/取消/超时、缓存与两端协议。三层严格类型、构建和全部80项回归通过。
- 新增 scripts/smoke-redis-hashes.mjs，真实Redis8.2.6的6组检查通过：原始字节/TTL/长值边界、真实MATCH/多页与DUMP/绝对过期时刻不变、最小ACL、65,537字节字段拒绝及2MiB值接收拒绝仅关闭自身连接、旧DB代次、实际回复间并发变化。首次夹具230短字段采用紧凑编码，COUNT不强制多页；将专门续读夹具改为已观察hashtable后通过，未改产品逻辑。独占Redis与配置已清理。
- 扩展 scripts/smoke-dsh.mjs 的 REDIS_SMOKE_HASHES=1，加入真实侧栏Hash表格、二进制/空单元格、格式化/解码、大值前缀、MATCH清空和消失/类型变化检查；已有String用例改为验证Hash正确路由。原生安装包验收待运行，07保持in-progress，不先勾选。
- 原因与影响：按原07范围形成完整读取链，复用已存在预算/令牌与格式实现，遵守单一职责、严格类型和最简原则；不改用户profile、业务Redis或全局宿主，不使用网页端GPT。后续对当前包重新打包并安装到项目内独立测试profile，再执行原生交互。

### 任务07 原生回归定位格式状态并修正

- 首次安装包原生回归在String下一窗口发现选择的Base64恢复为Text，原生断言a与YQ==不一致；自己的DSH/浏览器/Redis与证书已全部清理。该失败未记为通过。
- 修改client/BytePreview.tsx、KeyDetails.tsx、HashView.tsx：公共组件改为受控格式选择，格式状态由查看器持有，跨字节窗口加载不丢失；Hash选择新单元格时明确重置为Text。保留共享预览和现有命令/字节语义，不增加兼容或补丁分支。
- 保存后立即重跑严格类型、构建与80项回归；随后按新包SHA重新安装独立测试profile并重跑原生交互，结果待回读。
- 同步清理实施方案中先前稳定版阶段遗留的现行措辞，当前接入、构建和验收均以指定rc.2为准；仅历史调查保留当时事实。

## 2026-10-16 任务07完成：Hash真实安装包验收

- 追加Hash显式取消后令牌失效/新扫描恢复、会话令牌清理两项专项；将JSON放大夹具调整为6对字段/值，原始RESP页低于1MiB而外发JSON超限，真实Redis也验证该应用层拒绝保持连接正常。最终三层严格类型、构建与82项回归（Hash16项）通过，真实Redis6组重新通过。
- 修正后安装包原生26组通过，含TLS/DB/Key/String回归及Hash235行、二进制与空单元格、JSON大整数/指数、显式解码、64KiB部分值、MATCH和失效/类型变化。包SHA b40053d5f87ac494bd44bd42d331660410f27c22fc11d3d65f0f4c0c3839d558，安装lib与构建36文件逐字节一致。已查看原生Hash截图。
- 新增 docs/verification/07-hash-view.md、07-redis-hashes-smoke.json、07-native-hashes-smoke.json、07-native-hash-data.png；记录预算各层、非原子快照、精确命令及实际WSL载体，不扩张为其他类型/平台或完整首版完成。自建DSH/浏览器/Redis、证书和UUID配置已清理。
- 07状态done、5项验收勾选，关联README/spec/方案/基线/任务索引/拆分记录/tracker同步；29票范围、优先级与依赖不变。08 List已读取原任务和上游索引/区间事实，接下来保留零起始索引、重复元素和有界区间语义继续实现。

## 2026-10-16 任务08：List连续区间、原始索引与公共值前缀

- 08进入in-progress，保留5项未勾选验收。LUNA只读核对上游List的LRANGE区间、LLEN、TTL与行身份；主任务另核对官方LRANGE/LLEN文档后实现，不复制上游Number索引或丢失二进制的展示。
- 新增host/list-reader.ts、value-prefix.ts，修改domain.ts、host/hash-reader.ts、redis-transport.ts：增加LLEN/LRANGE固定读取、精确整数位置与包含末端的区间边界、EOF/消失/类型/长度变化处理；重复值保留不同索引，一次操作10秒总截止。将实际共用的64KiB值前缀抽成BytePrefix/valuePrefix，Hash沿用同一语义。
- 修改typert.shared.ts、typert.host.ts、typert.remote-client.ts、remote-service.ts：增加readList固定入口，两端严格限定1–100项、原始Key字节、非负signed64位置、连续索引/nextOffset/字节前缀/整页预算与状态一致性。没有LPOP、LSET或任意命令。
- 新增client/ListView.tsx、collection-value.ts，修改KeyDetails/KeyBrowser/index/locales：List选择路由、区间输入/下一段/刷新/取消、原始索引表格与公共单元格预览，复用CollectionTable/BytePreview。只显示当前区间，不积累为伪快照。Hash单元格标签/预览抽到共同函数，避免实际重复。
- 新增tests/list-view.test.ts，覆盖区间/重复/二进制/空值/EOF/精确整数、总截止/取消/错误/旧目标、类型与长度变化、巨大元素/JSON预算及两端严格协议；更新固定接口清单。新增scripts/smoke-redis-lists.mjs，验证真实区间、只读字节/过期、ACL、超限与并发变化。编译已通过，完整回归与实连结果待回读。
- 抽取前缀后的91项回归与Hash真实6组已通过；07原生包证据仍为其固定SHA历史快照，新List与重构后的当前包尚待原生安装验证，不扩张07记录的包范围。

### 任务08 真实区间通过，准备原生安装验收

- 严格Host/Client/tests类型、构建与95项回归通过（List13项）；真实List6组通过，覆盖235元素的0/100/200区间与EOF、重复/二进制/空值/长元素、DUMP与绝对过期不变及写计数不增、最小ACL、JSON放大/2MiB元素拒绝、DB旧代次和实际LRANGE回复间插入/类型变化/删除。自有Redis及夹具已清理。
- 扩展scripts/smoke-dsh.mjs的REDIS_SMOKE_LISTS=1：原生List237行区间、重复值、二进制/空/JSON/解码/部分值、0/100/200翻页、EOF/非法整数、插入刷新及消失/类型变化；同时保留Hash/String/TLS/DB回归。当前按新SHA打包并安装到独立测试profile，结果待回读，08尚未完成。
- 同步关联文档和索引，08状态in-progress，5项保持未勾选。用户日常profile与全局宿主不变。

## 2026-10-16 任务08完成：List原生区间与安装包验收

- 最终严格类型/构建及95项回归、真实List6组、原生安装包31组通过；其中包含Hash/String/TLS/DB回归。包SHA 026e85aa56f8921d2bb30987773958ee97517145f61e2f841e03082b883a391d，安装lib与构建40文件逐字节一致。已查看List截图，确认零起始索引、重复值、总数/区间、格式与精确JSON内容。
- 新增docs/verification/08-list-view.md、08-redis-lists-smoke.json、08-native-lists-smoke.json、08-native-list-data.png，保存真实命令、区间/只读/预算和非原子快照限制，不宣称全部Redis版本或完整首版通过。自建DSH/浏览器/Redis、短期证书与UUID配置全部清理；测试profile仅在项目内。
- 08状态done、5项勾选；README、基线、方案、任务索引/spec/拆分记录/tracker及共同当前进度同步，原29票范围/优先级/依赖不变。下一步09 Set已取得上游SSCAN/字节/行身份事实；当前尚未实现Set，任务保持ready-for-agent，不提前勾选。
- 收尾一致性核对通过：29票仍为P0 21/P1 8，01–08 done、其余21票ready-for-agent，38项已勾选/102项未勾选，全部阻塞依赖不变。源码/测试/脚本无新增any、替换字符或尾随空白；07/08四份机器报告均通过且自有实例已停止，固定研究SHA保持不变。关联现行文档均采用指定rc.2；完整首版尚未完成，持续目标保持进行。

## 2026-10-16 任务09：Set增量成员、原始身份与共享扫描状态

- 09进入in-progress，5项验收保持未勾选，29票原范围/优先级/依赖不变，继续指定DSH0.2.0-rc.2。LUNA只读取现有协议/原生接入事实，主任务核对Redis官方SSCAN/SCARD/SCAN文档后实现。
- 新增src/host/set-reader.ts，修改domain.ts、host/redis-transport.ts：固定TYPE/PTTL/SCARD/SSCAN，单次显式扫描与10秒总截止；成员保留完整Base64身份和字节数，单成员64KiB上限，超大成员拒绝整页，绝不截断身份。读取前后类型/数量改变丢弃结果，非原子快照限制保留。
- 修改host/scan-cursors.ts、key-reader.ts、hash-reader.ts，提取三种实际扫描共用的RESP双元素/uint64游标解析，不改变各自预算和令牌所有权。修改typert.shared.ts、typert.host.ts、typert.remote-client.ts、remote-service.ts：增加scanSet固定严格入口，校验完整字节、唯一性/SCARD/状态/JSON预算；共用字节身份解析，连接/会话清理Set令牌，不添加写命令或任意命令入口。
- 新增client/SetView.tsx、use-collection-scan.ts；修改HashView.tsx复用已有行为的显式续扫/取消/旧结果隔离Hook，避免再复制页面状态。Set复用key-cache的原始身份去重/5000行/2MiB上限、CollectionTable和BytePreview；成员MATCH、加载数/SCARD总数、无序扫描和超限明确。修改KeyDetails/KeyBrowser/index/locales接入Set路由与绑定。
- 新增tests/set-view.test.ts，修改tests/host-typert.test.ts固定接口清单：覆盖二进制/空成员、同标签不同完整身份、无序去重、uint64/空页/重放/错目标/刷新竞态、巨大成员/JSON放大、类型/数量/消失、权限/取消/截止、会话清理和两端严格协议。三层编译已通过，完整回归与真实Redis/原生安装结果待执行。
- 原因与影响：沿现有Host/Client边界增加专用只读Set查看，复用真实重复功能，遵守严格类型和最简原则；不增加旧版兼容，不改用户Redis或日常DSHprofile，不调用网页端GPT。

## 2026-10-16 03:13 仅更新方案：稳定正式版、本机升级和最新源码复制改造

- 修改原因与原则：落实用户本轮三项要求及“只写方案、不改代码”边界；统一相互冲突的现行RC条款，遵循最简原则，复用既有方案和to-tickets任务结构，不重拆29票、不引入旧版兼容。
- 修改 docs/DSH_Redis_开发路线与实施方案.md：更新2.4–2.7、P0-00/P0-10、构建和发布验收。明确开工/发布前核实官方最新稳定正式版，不能只看npm latest；检查实际CLI/桌面入口和核心、本机旧版先保全资料并按原渠道精确升级、升级后复核。写明对应宿主tag及SDK、最新插件参考副本、固定SHA/许可、必要源码复制裁剪与独立改造顺序；不整目录覆盖现有工作。
- 修改 docs/DEVELOPMENT_BASELINE.md：分开后续稳定要求、本轮只读快照、待执行步骤与历史RC实现；尚未核实到稳定目标不虚构版本、不默用预发布版。既有package/SDK锁定仍是历史RC现状，本轮没有把它们迁移为稳定版。
- 修改 README.md、.scratch/redis-viewer/README.md、.scratch/redis-viewer/spec.md、docs/TICKET_BREAKDOWN_DRAFT.md、docs/agents/issue-tracker.md：统一入口及任务共同约束，准确区分01–08的历史验收与09进行中且未验收；不改变29票的范围、优先级、状态和依赖。
- 修改 .scratch/redis-viewer/issues/01-native-sidebar.md：仅更新现行说明并将已勾选列表明确标为历史RC验收，保留原有复选项内容和状态；修改21-release-verification.md未勾选的版本验收，要求最新稳定正式版、本机按需升级及对应源码/SDK/安装包一致性。
- 本轮只读核对：命令入口为C:/Users/admin/AppData/Local/pnpm/dsh.ps1，执行--version返回0.2.0-rc.2。首次PowerShell注册表HTTP读取失败，未用该失败推断版本；随后Node HTTPS成功读取官方npm完整元数据，33个版本中未见纯X.Y.Z号，latest/next为0.2.0-rc.2，alpha为0.2.1-alpha.4。官方rc.2发行页明确Pre-release；GitHub releases/latest跳回发行列表。尚未核实到稳定正式目标，桌面运行核心未确认，均如实写入方案。
- 修改影响与边界：本轮计划内只改上述10份既有Markdown（含本日志），保留固定研究和验收产物；未执行安装、升级、依赖修改、新源码克隆/复制、业务代码修改、Redis连接、服务启停、编译或代码测试，未使用网页端GPT。保存后以文件哈希和任务字段比对核查只改文档、29票依赖/状态/勾选保持不变，结果补记如下。
- 实际检查结果：写入前后SHA256比对198个文件，恰有上述10份既有Markdown变化，无新增或删除；全部150个非Markdown文件、其余27张任务与固定研究/验收产物均不变。29票仍为P0 21/P1 8、done 8/in-progress 1/ready-for-agent 20，38项已勾选/102项未勾选，全部状态、优先级与阻塞字段和写入前一致。9份关联文档现行要求、Markdown围栏及本地链接检查通过。扫描排除了依赖、Git元数据及被忽略的运行/上游/临时产物目录，本轮未对这些目录执行写操作。仅文档修改，未运行编译、构建或代码测试。

## 2026-10-16 继续指定rc.2：Set真实验收准备

- 当前用户持续目标明确采用0.2.0-rc.2并直接开发完整29票，覆盖前次仅文档及等待稳定正式版的阶段限制。同步README、开发基线、实施方案2.4–2.7/P0/发布约定、任务索引/spec/拆分记录/tracker及01/21说明；历史稳定调查保留，不再作为执行门禁。本机CLI与依赖均为指定rc.2，无需重复安装。
- 新增scripts/smoke-redis-sets.mjs：基于现有独占Redis夹具验证原始二进制/空/64KiB成员、真实SSCAN/MATCH、无SMEMBERS或写命令、DUMP/绝对过期不变、最小ACL、65537字节/JSON放大/2MiB接收边界、旧DB代次及实际回复间类型/数量/消失变化。所有管理员写操作仅用于自有夹具。
- 修改scripts/smoke-dsh.mjs：增加REDIS_SMOKE_SETS=1及独立报告/截图、235成员和紧凑Set种子，实际侧栏续扫/字节与格式/MATCH/消失及类型变化验证；原有Hash/List/String/TLS/DB流程一并回归。复用现有扫描/清理逻辑，保持最简和既有设计风格。
- 当前仅完成脚本语法检查；严格类型/全部回归、真实Redis与当前包原生安装验证待结果回读。09保持in-progress，验收未勾选，29票范围和依赖不变；不修改用户日常profile或Redis，不使用网页端GPT。

## 2026-10-16 任务09完成：Set真实安装包验收

- 严格Host/Client/tests类型、构建和全部110项回归通过（Set15项）；真实Redis6组及原生安装包35组通过，覆盖Hash/List/String/TLS/DB回归。包SHA7912099c2064acbf3a5acf01557cbd7e509d5926083257698c28755e865e9dfa，安装lib与构建42文件逐字节一致，Set截图已查看。
- 新增docs/verification/09-set-view.md、09-redis-sets-smoke.json、09-native-sets-smoke.json、09-native-set-data.png，记录实际命令、完整成员身份、预算各层及非快照限制。自有DSH/浏览器/Redis、证书和UUID配置已清理，不改日常profile或用户Redis。
- 09状态done、5项验收勾选，10进入in-progress、验收保持未勾选；同步README、基线、方案、任务索引/spec/拆分记录/tracker。29票范围/优先级/阻塞依赖不变，首版仍未完成。接下来按10票实现ZSet原始成员/分数和明确分页语义。

## 2026-10-16 任务10：ZSet双模式读取与成员/分数链路

- 按原10票范围实现分数升序rank区间与明确无序ZSCAN两种模式，保留原始成员字节及Redis分数原文；主任务核对官方ZRANGE/ZSCAN/ZCARD文档，LUNA仅提供当前与上游字段事实，不以其描述替代验收。
- 新增src/host/zset-reader.ts、redis-score.ts，修改domain.ts、host/redis-transport.ts：固定ZCARD/ZRANGE WITHSCORES/ZSCAN，不开放写入；rank整数精确、截止10秒共用、前后元信息变化丢弃旧行，scan令牌绑定目标/MATCH并在切到rank时作废；完整成员64KiB、整帧/外发各1MiB，超限拒绝整页。分数只做有限double/inf文本验证，保持原始拼写。
- 修改typert.shared.ts、typert.host.ts、typert.remote-client.ts、remote-service.ts：增加readZSet严格判别请求及结果，拒绝rank/cursor混用、非法分数/身份/元信息/续读，连接和会话生命周期清理自身令牌。修改tsconfig.client.json显式纳入浏览器共享score校验；首次TS6307与readonly数组类型不符已立即修正，三层编译通过，无any或兼容绕过。
- 新增client/ZSetView.tsx、zset-cache.ts；修改KeyDetails/KeyBrowser/index/locales及use-collection-scan.ts：选择ZSet进入独立双模式表格，rank只保留当前区间；扫描按原始成员去重且更新重复分数，缓存5000行/2MiB。共用Hook新增明确queryKey以取消模式/区间切换的旧读取，复用表格和字节预览，不复制页面扫描状态；保留未来GEO所需原始ZSet入口。
- 新增tests/zset-view.test.ts 15项，修改固定RPC方法清单；覆盖完整字节/分数原文、精确rank/EOF、空页/uint64游标/重放/目标绑定、超大成员/JSON放大、坏回复/变化/权限/取消/总截止/迟到、缓存与两端模式严格性。三层类型检查通过，全部回归、实际Redis和原生包结果待回读，10保持in-progress、验收未勾选。
- 原因和影响：在既有深度边界增加本票完整路径，复用真实共用行为，保持最简与严格类型；未改用户日常profile或业务Redis、未启动用户前后端，未调用网页端GPT。

### 任务10 真实Redis通过，当前包原生验收准备

- 严格类型/构建及125项回归通过（ZSet15项）。新增scripts/smoke-redis-zsets.mjs，真实7组通过：固定分数字节（-inf/0/1.0000000000000002/1e+100/inf）、二进制/空成员、0/100/200区间与EOF、ZSCAN多页及MATCH111/0、切rank作废扫描令牌、无写入/DUMP/绝对过期不变、最小ACL、64KiB/65537字节/JSON放大/2MiB接收边界、旧DB及实际回复间数量/类型/消失。自有Redis已清理。
- 首次真实校验对照使用node-redis默认RESP3，返回嵌套member/double，无法作为分数原文字节依据而失败；尝试独立RESP2 duplicate又因其默认维护功能仅支持RESP3而失败。两次均未记为通过，自有实例已清理；停止在该对照方案叠加配置，改为固定Redis8.2.6已知样本的完整成员及分数原文断言，不使用Number重写、不修改产品读取逻辑，随后真实7组通过。
- 扩展scripts/smoke-dsh.mjs的REDIS_SMOKE_ZSETS=1：235成员rank0/100/200与无序续扫、分数/二进制/空/JSON/解码、模式切换/MATCH/EOF/非法排名/插入刷新、超大成员拒绝及消失/类型变化；保留Set/Hash/List/String/TLS/DB回归。locales和ZSetView补充准确的排名输入提示。保存后语法及三层编译通过。
- 当前重新按包SHA安装独立测试profile并运行原生交互，结果待回读；10仍in-progress，所有验收未勾选。09证据保持历史固定包范围，不把它改写为当前ZSet包通过。

## 2026-10-16 任务10完成：ZSet双模式真实安装包验收

- 最终严格类型/构建及125项回归、真实ZSet7组、原生安装包40组通过，包含Set/Hash/List/String/TLS/DB回归。包SHAb88718983687ec21719c933f9c4cb06becdcf6c54598122c2f5c04d301150b00，安装lib与构建46文件逐字节一致；rank/scan两张截图均已查看。
- 新增docs/verification/10-zset-view.md、10-redis-zsets-smoke.json、10-native-zsets-smoke.json、10-native-zset-data.png、10-native-zset-scan-data.png，记录精确分数/成员、分页/模式隔离/只读/预算和非原子快照限制，保留夹具失败过程；不虚构GEO或完整首版已完成。自有进程、证书和UUID配置均已清理。
- 10状态done、5项勾选；11 Stream进入in-progress且未勾选。同步README、基线、方案、任务索引/spec/拆分记录/tracker，保留历史包证据。29票仍为P0 21/P1 8，原范围/依赖不变，后续继续全部剩余功能。
- 收尾检查：29票P0/P1仍为21/8，01–10 done、11 in-progress、其余18票ready-for-agent，48项勾选/92项未勾选；逐票阻塞边与原批准图一致。09/10四份机器报告均通过并确认自有实例/证书/UUID目录已清理，当前安装lib46文件再次逐字节核对一致；固定研究SHA保持E138F4206B3534F3E7C74050CA7E7DC36B359AB1A64FEEB15E5E832271800B0C。修正拆分记录中遗留的09进行中摘要；完整29票目标保持active，未宣称首版完成。

## 2026-10-16 任务11：Stream原始字段对与ID范围读取

- 按11票实现正向XRANGE/反向XREVRANGE、XLEN元信息与排他消息ID续页，固定结构化只读命令；主任务核对官方文档和Redis8.2.6 stream.h，LUNA仅读取当前接入/上游事实。
- 新增src/stream-id.ts、host/stream-reader.ts，修改domain.ts、host/redis-transport.ts和tsconfig.client.json：ID两部分各uint64精确字符串，完整范围包含初始两端，续读用(lastID)边界而不加减或转Number；实际发出字符为左括号前缀，不带右括号。页令牌绑定可信会话、连接/DB代次、Key、方向与范围，取消/刷新/退出清理。字段按有序数组保留重复名称和空/二进制字节，不转对象；完整字段64KiB、值前64KiB、整帧/外发各1MiB、累计4096字段对预算。正常追加允许继续，检测到XLEN减少/类型改变/删除则丢弃旧页，仍不承诺原子快照。
- 修改typert.shared.ts/host.ts/remote-client.ts、remote-service.ts：增加readStream严格输入/输出、方向/范围/消息顺序/字段前缀/元信息/预算校验，注册生命周期清理；无XGROUP/XREADGROUP/XACK或任意命令入口。
- 新增client/StreamView.tsx、stream-cache.ts；修改KeyDetails/KeyBrowser/index/locales和共享Hook注释：Stream消息表、字段对表、重复项序号和原字节预览，双向选择/范围提交/续读/刷新/取消，复用CollectionTable/BytePreview/useCollectionScan。消息缓存5000条/2MiB，输入编辑不自动查询，查询提交/方向切换废弃旧结果。
- 新增tests/stream-view.test.ts，修改固定方法清单，覆盖重复/二进制/空字段与值、双uint64边界、正反向排他续页/末端空页、追加与裁剪、坏嵌套回复、巨大消息/JSON放大、令牌归属/重放/迟到、权限/取消/总截止、缓存与两端严格契约。测试数组索引的TS2322已立即以明确样本修正，无any或兼容绕过；完整检查结果待回读。
- 原因与影响：在现有Host/Client边界完成Stream查看链路，沿用真实共用模块，遵守最简和严格类型。11仍in-progress、所有验收未勾选，实际Redis及当前包原生验收待执行；不修改用户Redis或日常profile，不调用网页端GPT。

### 任务11 真实Stream和消费状态通过，准备原生安装验收

- 严格Host/Client/tests类型、构建与142项回归通过（Stream17项）。新增scripts/smoke-redis-streams.mjs，真实7组通过：原始重复/二进制/空字段对、精确uint64 ID和64KiB值前缀、235条双向续页和包含边界的1条页、空Stream、消费组last-delivered/Pending/XINFO GROUPS不变、DUMP/绝对过期/写和组命令计数不变、最小ACL禁止XREADGROUP/XACK、65537字节字段/JSON放大/2MiB接收拒绝、旧DB与两方向实际回复间追加/裁剪/类型/消失。自有Redis已清理。
- 扩展scripts/smoke-dsh.mjs的REDIS_SMOKE_STREAMS=1：235消息双向续读、七个原始字段对/重复名称/二进制/空值、JSON/解码/部分值、草稿输入不自动读取、范围/错误/极大ID/追加刷新/超限/空Stream/消失与类型变化，并以实际Pending/组快照核对消费进度不变。保留全部已有基础类型和TLS/DB回归。种子新增5个DB0 Key，权限外管理命令仅用于自有夹具。
- 脚本语法检查通过；当前按新包SHA安装项目内独立profile并运行原生交互，结果待回读。11仍in-progress，不先勾选验收，不把10历史包证据改写为当前Stream包通过。

### 任务11 首次原生范围等待修正

- 首次原生包在范围草稿提交后立即检查完成文案，误用了旧范围的按钮就绪状态；失败截图显示新范围首条1000-101已返回、继续读取可用，脚本却已退出续读循环。失败未记为通过，自有DSH/Redis/浏览器和证书均已清理。
- 仅修改scripts/smoke-dsh.mjs：提交新范围后显式等待已加载1条且首ID为1000-101，再验证全部3条边界和完成状态；不增加固定sleep、不弱化断言、不改产品读取逻辑。脚本语法通过，使用相同已安装SHA包重新执行完整原生回归，无需重复构建未变化的产品代码。

## 2026-10-16 04:09 仅文档：落实最新稳定版、本机升级和最新源码改造要求

- 修改原因与原则：用户本轮明确要求将三项约束写入方案、不改代码。按最新指令统一现行要求，遵循最简原则，沿用既有to-tickets结构；保留历史RC实现/验收，不重拆29票，不增加旧版兼容设计。
- 修改 docs/DSH_Redis_开发路线与实施方案.md：重写2.4–2.7的稳定版定义、只读版本快照、实际入口辨认、资料保全、原渠道升级/复核、发布前再核验和源码取得/选择性复制步骤；同步P0-00、P0-10、构建及发布验收。明确官方宿主源码按稳定tag核对API，最新Git Graph/Database保留独立原样副本后提取必要骨架与只读分支，不覆盖原项目/已有工作或修改全局宿主源码。
- 修改 docs/DEVELOPMENT_BASELINE.md：集中记录现行约束、本机/官方只读事实、后续执行顺序与历史RC快照，明确没有稳定目标时不猜测版本、不自动改用预发布，不将方案写成已升级。
- 修改 README.md、.scratch/redis-viewer/README.md、.scratch/redis-viewer/spec.md、docs/TICKET_BREAKDOWN_DRAFT.md、docs/agents/issue-tracker.md：统一入口、共同前提和当前只写文档的范围；保留任务历史状态，历史RC记录与稳定目标验收分开。
- 修改 .scratch/redis-viewer/issues/01-native-sidebar.md：只更新说明并追加待代码阶段执行的稳定基线，保留done及全部历史复选项；修改21-release-verification.md：更新尚未勾选的版本门禁，增加最新稳定正式版、本机必要升级/资料保留、源码/SDK及复制来源核对。
- 本轮只读核对：实际pnpm shim及全局包、--version均为0.2.0-rc.2。官方npm完整元数据33个版本无纯X.Y.Z号，latest/next为rc.2、alpha为0.2.1-alpha.4；官方GitHub API取得28条Release均prerelease，rc.2页面明确Pre-release，releases/latest API返回404（结合完整列表判断，不以单次404推断）。因此当前尚无满足本方案的稳定正式目标，桌面运行核心未核实；不执行猜测性升级。官方来源URL已写入方案。
- 本轮只读源码核对：git ls-remote确认Git Graph master为33b3e67a39a429a0ff570d82d7264aab735fc1fd，Database main为5d2b900b0317200b1866275c7cf48814fe84b52d，均与已有原样副本一致；未fetch、克隆或复制。后续开工须重新查询最新坐标并锁定。
- 影响与边界：只修改上述10份既有Markdown（含本日志）；不改业务源码、脚本、配置、依赖/锁文件、构建产物、参考源码或固定研究/验收文件，不安装升级，不连接Redis或启停服务，不调用网页端GPT；纯文档无需编译或代码测试。保存后核对非Markdown哈希、29票状态/优先级/阻塞和复选项、Markdown围栏/本地链接及现行条文一致性，实际结果随后补记。
- 实际文档检查结果：写入前后恰有上述10份既有Markdown变化，无新增/删除；受检143个非Markdown（根配置、src/scripts/tests/lib/licenses）哈希全部一致，固定研究及其余文档/验收产物哈希不变。29票仍为P0 21/P1 8、done 10/in-progress 1/ready-for-agent 18，48项已勾选/92项未勾选；逐票状态、优先级、阻塞编号与勾选序列未变，其余27张任务文件完全不变。9份关联文档现行约束、46个本地链接与Markdown代码围栏检查通过。检查未覆盖node_modules、Git元数据或忽略的运行/上游缓存，本轮未向这些目录写入；未运行编译、构建或代码测试。

## 2026-10-16 按指定rc.2继续，任务11证据归档完成

- 当前用户持续目标明确选择0.2.0-rc.2直接开发完整29票；恢复README、基线、实施方案、索引/spec/拆分/tracker和01/21顶部执行要求，前次仅文档与稳定版调查保留为历史，不作为当前门禁。本机CLI/SDK已同版，不重复安装，不改宿主源码。
- 新增docs/verification/11-stream-view.md、11-redis-streams-smoke.json、11-native-streams-smoke.json、11-native-stream-data.png、11-native-stream-ids.png。读取已有报告：142项回归、真实Stream7组与原生46组通过；包SHAed5ff2366a464133db3cf9683733cc772956b3990a02efde62eb514643a7561b，再次核对安装lib与构建50文件一致，两张截图已查看。自有进程/证书/UUID资源清理均为true；不重建未变化的产品代码，不改写失败记录。
- 11改done并勾选5项，12改in-progress且保持未勾选；同步当前进度，原29票范围、优先级与依赖不变。下一步完成RedisJSON完整Host/契约/UI/真实扩展和原生安装验证，未宣称首版完成。遵守最简/严格类型与已有模块边界；不调用网页端GPT。

## 2026-10-16 任务12：RedisJSON根值与JSONPath读取链路

- 修改前已说明复用10秒截止/取消/代次及字节格式器、保留JSON原文、拒绝巨型完整节点的原因；LUNA仅读取当前/上游事实，主任务核对官方JSON.GET/JSON.TYPE及自有Redis8.2.6实测。实际RedisJSON模块ver80209，TYPE ReJSON-RL；RESP2 JSON.TYPE为类型数组/空数组/null，JSON.GET保持匹配数组，9007199254740993原文不变；无匹配、缺失、null及实际路径/错类型错误签名已核对。两个探查实例均已清理。
- 新增src/redis-json.ts、host/json-reader.ts，修改domain.ts、host/redis-transport.ts：固定JSON.TYPE/JSON.GET及元信息，不开放写命令；仅JSONPath，原始Key字节身份、10秒总截止和目标守卫复用。完整选择最多64KiB/4096匹配，接收/外发各1MiB，超限拒绝不伪分页；前后类型和匹配类型变化丢弃结果，不宣称快照。固定区分缺命令/无匹配/无Key/语法错误/类型改变/权限，不回显服务器私密错误。
- 修改typert.shared/host/remote-client.ts、remote-service.ts及tsconfig.client.json：新增readJson严格DTO/两端schema/可信会话RPC，拒绝未知字段、坏字节和不一致状态，不经JSON解析后重序列化数值。reader无游标/长寿命资源，沿用现有连接退出清理。
- 新增client/JsonView.tsx，修改KeyDetails/KeyBrowser/index/locales：真实ReJSON-RL进入专用根路径/路径提交视图，草稿不发RPC，取消与旧结果隔离，保留服务器匹配数组及JSON大数原文；复用BytePreview六种格式，明确预算及缩小路径提示，String JSON格式化入口保留。
- 逻辑批次后严格Host/Client/tests类型检查均通过；初次apply_patch因transport集合声明形式与预期不符被原子拒绝，确认无文件写入后按实际ReadonlySet声明修正并成功应用，不是编译问题。当前尚未执行本票专项/真实/原生验收，12保持in-progress及未勾选。遵守最简/严格类型，不加兼容层，不改日常profile或用户Redis，不调用网页端GPT。

### 任务12 专项回归与内部错误边界修正

- 新增tests/json-view.test.ts 12项，修改固定RPC方法清单；覆盖原始Key/JSON词法、匹配/null/缺失、64KiB边界与拒绝、坏回复/匹配变化、固定错误分流、目标/取消/10秒总截止、两端严格schema与原有格式器。
- 首次完整回归153通过/1失败：连接层read把RedisReplyError过早变为network，专用reader无法识别命令缺失。修改host/connection-service.ts仅在Host内部保留服务器拒绝，先复查目标/取消守卫，再由各reader映射固定DTO；仍不向RPC回显原始消息。修正后三层类型、构建及全部154项回归通过，已有类型回归均通过。
- 为真实缺命令场景曾尝试自有fixture启动rename-command JSON.GET，Redis在模块命令注册前处理重命名而拒绝启动；失败未计通过，进程和UUID目录已清理。停止该配置方向并完全撤回fixture参数/配置改动，不尝试卸载有自定义类型的模块。缺命令分支已有专项验证，真实脚本将明确记录已取得的服务器未知命令回复注入与直接实连验证的区别，不虚构模块未安装环境。
- 当前12保持in-progress；真实Redis和原生当前包验收尚待执行，不修改用户Redis或日常DSHprofile。

### 任务12 真实RedisJSON读取通过

- 新增scripts/smoke-redis-json.mjs：真实8组通过，Redis8.2.6/ReJSON ver80209、二进制Key/根值/路径匹配数组、9007199254740993及UTF8原文字节、null/空数组/无路径/无Key/普通String/实际语法错误、JSONPath数组切片和多匹配、DUMP/绝对过期/相关写命令计数不变、最小ACL及独立JSON.TYPE/GET拒绝、64KiB/65537字节/4097匹配/2MiB接收拒绝、窄路径恢复与手动重连、DB代次和实际回复间类型/删除/路径匹配变化均通过。自有socket/实例/目录已清理。
- 缺命令分支以自有服务器实际unknown-command回复注入Host拒绝路径验证，报告明确标注此为fault injection，不冒称无模块服务器实测；已有单元专项也覆盖JSON.TYPE/GET缺失。未新增模块卸载或修改用户服务器配置的流程。
- 首次真实脚本在type-race留下String后，下一轮夹具JSON.SET遇错类型而失败；失败未算通过且资源已清理。修正仅为每轮夹具预置前DEL自身race Key，另补实际在JSON.GET前改类型触发模块错误，随后8组通过；未修改产品逻辑。
- 当前准备当前包原生JSON视图验收，12仍in-progress且验收未勾选。所有代码/脚本变更、原因与影响按既有边界记录，不改日常profile或用户Redis，不调用网页端GPT。

### 任务12 当前包原生验收准备

- 扩展scripts/smoke-dsh.mjs的REDIS_SMOKE_JSON=1、独立native-json报告及两张截图：新增4个JSON模块Key和ver80209记录，验证与String分离、根匹配数组/大数/UTF8及Text/JSON/Hex/Base64、草稿不查询、切片/路径、null/空值/缺失与语法错误、DUMP/绝对过期不变、超限根值拒绝后窄路径恢复、删除/转String清空旧内容；保留全部既有基础类型及TLS/DB回归。
- tests/json-view.test.ts补一项迟到服务器拒绝时旧目标优先返回stale，验证内部保留错误不会绕开目标守卫。脚本语法和三层类型检查通过；打包前全部155项回归通过（JSON13项）。当前按包SHA安装独立profile并执行真实原生交互，12保持in-progress且验收未勾选。
- 修改原因与影响：完成本票可验证链路，复用既有验收启动/扫描/清理流程，固定module环境且不加入任何写入口；未操作用户Redis、日常profile或网页端GPT。

## 2026-10-16 任务12完成：RedisJSON真实安装包验收

- 三层类型/构建与155项回归、真实Redis8组、原生安装51组通过，包含全部已有基础类型及TLS/DB回归。包SHA02c557bc4d2d5ca3bc7615f9eaa909e29636260ed59b5862fefa0440f2f082ea，安装lib与构建54文件逐字节一致，根值/路径两张截图已查看。自有Redis、DSH、浏览器、证书和UUID目录已清理。
- 新增docs/verification/12-redis-json.md、12-redis-json-smoke.json、12-native-json-smoke.json、12-native-json-data.png、12-native-json-path.png，记录实际ver80209、预算、只读、非原子限制、错误和失败过程；命令缺失明确为真实错误回复Host fault injection，不冒称无模块环境实连通过。peer提示继续核对其具体依赖事实。
- 12状态done并勾选5项，13 Bitmap进入in-progress且全部未勾选；同步七份进度入口并修正01遗留的本轮仅文档说明。原29票范围、优先级、阻塞不变，完整首版仍未完成；按指定rc.2继续全部剩余任务。

## 2026-10-16 任务13：复用String有界读取的Bitmap视图

- 修改前已说明采用已有GETRANGE将位范围换算为字节窗口，不新增BITFIELD可变子命令或冗余Host/RPC。主任务核对官方Bitmap/GETRANGE/BITPOS文档（首字节最高位偏移0，次字节最高位偏移8），LUNA仅提供上游和当前模块事实；普通String不得自动判断为业务Bitmap。
- 新增client/bitmap-preview.ts：位偏移以精确整数字符串/BigInt处理，每次1–4096位换算最多513字节，原有String reader再带最多6字节UTF8上下文但不参与位值；只展开当前窗口，32位一行，最后不足按实际总长裁剪，空String和EOF返回空、不伪造补零。校验返回字节窗口与所选范围匹配。
- 新增client/BitmapView.tsx，修改KeyDetails.tsx、locales.ts：仅在String手动点击按位查看，提供偏移/位数提交、下一窗口/取消/刷新、精确总位数/范围及状态；复用现有严格String DTO、10秒截止、目标守卫、CollectionTable，不添加写命令。返回String重新读取，旧请求和内容不能覆盖新目标。
- 新增tests/bitmap-view.test.ts 7项：全256字节值/所有不对齐起点的高位优先、4096位/513字节和行界、末位/空/EOF、超安全整数、非法输入/坏窗口、排除UTF8上下文、实际调用String reader固定GETRANGE路径。首次测试元组推断出现TS2345，立即用只读元组限定修正，无any或兼容绕过；三层类型检查通过，完整检查结果见本轮实际输出，13保持in-progress且验收未勾选，真实/原生证据待补。
- 原因和影响：用已存在的有界读取能力完成专用解释，遵守最简/单一职责/严格类型，不复制后端能力，不修改用户Redis或日常profile，不调用网页端GPT。

### 任务13 真实Bitmap通过，准备原生安装包验收

- 严格类型/构建与162项回归通过。新增scripts/smoke-redis-bitmap.mjs：真实7组通过，独立BITFIELD_RO GET u1对照验证原始二进制Key/最高位先/跨字节、2MiB源值4096位与精确续区间、末位/空/EOF/最大整数偏移、DUMP/绝对过期/写命令计数不变、最小GETRANGE权限及SETBIT拒绝、DB旧代次和实际长度/类型/删除变化。实测最大范围回复519字节（513窗口+最多6上下文），只用TYPE/PTTL/STRLEN/GETRANGE；自有资源已清理。脚本以Node22原生TS读取同一浏览器纯转换源码，Host用构建产物，安装包UI另做原生验证，不混淆两者。
- 扩展scripts/smoke-dsh.mjs的REDIS_SMOKE_BITMAP=1、独立native-bitmap报告与两截图：新增2MiB位样本/空String，验证手动进入/返回、位序/总长、精确下一窗口、草稿不查、4096位128行、末位/EOF/超大整数/非法输入、原字节/过期不变及消失/转Hash清空。全部已有类型/TLS/DB回归保留。
- 脚本语法通过，当前按新包SHA安装隔离profile后验收；13保持in-progress、所有验收未勾选，不虚构当前原生通过。遵守最简原则、复用既有启动/清理，不触碰日常profile/用户Redis，不调用网页端GPT。

## 2026-10-16 任务13完成：Bitmap真实安装包验收

- 三层类型/构建及162项回归、真实Redis7组、原生安装55组通过，含全部已有类型及TLS/DB回归。包SHA54a74b0e10e02df51815ca79804fc9ec32a6cf198dfec51c02a8b8f78d1a9a1a，安装lib与构建54文件逐字节一致；默认和不对齐范围两图已查看。自有Redis/DSH/浏览器/证书/UUID目录已清理。
- 新增docs/verification/13-bitmap-view.md、13-redis-bitmap-smoke.json、13-native-bitmap-smoke.json、13-native-bitmap-data.png、13-native-bitmap-range.png。明确手动解释String、最高位先、无补零、实际519字节范围回复、进入前String首窗64KiB边界、复用Host只读/取消/代次及非原子限制，不冒称全部29票已完成。
- 13改done且勾选5项，14 GEO进入in-progress且验收未勾选，七份进度入口同步；29票原范围/优先级/依赖不变。当前继续14及后续全部功能，未进行Git提交/push、未调用网页端GPT。

### 任务14 GEO真实语义探查及当前收尾核对

- LUNA完成14票、当前ZSet reader/view/schema、上游Geo推断与rc.2共享模块规则的只读事实检索；主任务核对官方GEOPOS，并在独占Redis8.2.6实测二进制/空成员、缺成员和普通ZSet分数。GEOADD样本经GEOPOS返回量化后坐标（如13.361389338970184/38.1155563954963），TYPE仍zset；普通0、-1、1.5、大于52位和inf分数也可返回坐标。因此实现必须保留手动解释及原始ZSet，不沿用上游首行探测即业务Geo的推断，不从展示标签重建成员。该探查实例已停止并清理，14仍in-progress、验收未勾选。
- 后续14按有界排名区间查看经纬表，保留原始成员字节/分数/排名；固定GEOPOS与已有只读元信息/范围命令，共用一次10秒截止。成员组成的GEOPOS请求须在组包前检查总字节预算，坐标以服务器原文保存并验证有限范围；无坐标、无命令和权限分开。以上为下一步实现约束，尚无本票代码或通过声明。
- peer提示事实：隔离profile明确autoInstallPeers:false，锁文件未给DSH peers resolved版本/物理链接；rc.2官方Client模块表共享React/Cordis，CLI运行时resolver提供DSH/profile解析，不能仅由缺物理链接断言版本冲突。当前尚未取得具体peer告警清单；发布票21仍需核对实际运行共享版本与打包声明，不以原生通过代替依赖审计。

- 实际收尾检查：29票P0/P1仍21/8，01–13 done、14 in-progress、其余15票ready，63项勾选/77项未勾选；全部阻塞边与批准图一致。11–13六份报告均passed，原生报告确认进程停止，全部fixture清理true；固定研究SHA保持E138F4206B3534F3E7C74050CA7E7DC36B359AB1A64FEEB15E5E832271800B0C。完整29票目标仍在进行，未宣称首版完成。

## 2026-10-16 任务14：GEO有界排名区间完整链路

- 修改前已说明复用ZSet成员解析、固定ZRANGE/GEOPOS/元信息、单次10秒截止和手动解释语义，保持最简/单一职责/严格类型；不维护旧版兼容、不做自动业务类型推断，不引入地图或外网瓦片。
- 新增src/host/zset-values.ts并修改zset-reader.ts：提取两处实际共用的完整成员/分数解码，保留scan重复更新与rank唯一、64KiB身份及原分数字符串语义；既有ZSet专项仍纳入完整回归。
- 新增domain GEO DTO、redis-geo.ts、host/geo-reader.ts，修改redis-transport.ts固定只读allowlist：排名区间最多100行，Key加成员原字节96KiB预检查后才构造GEOPOS参数，完整成员64KiB，接收/外发各1MiB；坐标文本只验证有限经纬范围，不经Number重写。前后TYPE/ZCARD/PTTL改变丢弃结果；nil坐标独立保留、不伪造身份或类型；无命令/权限/缺失/不支持分流固定DTO，取消/超时/目标守卫沿用。
- 修改typert.shared/host/remote-client.ts、remote-service.ts、tsconfig.client.json：新增readGeo严格输入/输出及可信会话作用域；拒绝混入scan/任意命令、坏坐标/排名/重复身份、元信息与分页不一致、超预算及未知字段。stateless reader不创建游标资源。
- 新增client/GeoView.tsx，修改ZSetView.tsx、index.ts、locales.ts：手动坐标视图保留原rank/score/member、精确坐标和字节预览，提交范围/下一页/取消/刷新、返回原ZSet重新读取，草稿不查询，旧结果不覆盖新目标。GEO量化误差及普通ZSet也可解码的范围已说明。
- 新增tests/geo-view.test.ts 14项，更新固定RPC清单；覆盖原字节/空成员/坐标原文、排名/EOF、nil与非业务类型推断、请求预算边界和巨型身份、坏RESP/坐标范围、元信息变化、固定错误/私密文本、可信目标及迟到拒绝、取消/总截止和两端严格schema/输出预算。首次错误数值样本用number不符合RESP2 RedisReply，引发TS2345；立即改为真实RESP2整数类型bigint，无any绕过。三层类型检查、构建与全部176项回归通过，14仍in-progress，真实/原生验收待补。
- 未修改用户Redis或日常profile，未启动用户前后端服务，不调用网页端GPT、不提交或push。


## 2026-10-16 本轮仅文档：最新稳定正式版、必要升级与源码副本改造

用户本轮明确要求把三项要求写入方案，并强调不改代码：开发采用 DSH 最新稳定发布版、本机版本不符合时先升级、以最新参考源码副本为基础开发。本轮据此仅维护文档，现行要求优先于历史 RC 开发决定；不继续功能票，不将文档修改写成已完成升级或迁移。

### 修改文件、原因与影响

| 文件 | 修改内容与原因 | 影响 |
| --- | --- | --- |
| docs/DSH_Redis_开发路线与实施方案.md | 重整 2.4–2.7：稳定发行判定、本机实际入口核对、资料保全、同渠道升级与复核、最新源码副本/复制范围及许可；同步 P0-00/P0-10、构建和版本验收 | 后续先落实稳定目标，再开发；宿主取匹配发行的源码，参考插件取最新可追溯快照，已有实现先比较再裁剪更新 |
| docs/DEVELOPMENT_BASELINE.md | 用现行四项要求和六步流程替代相互冲突的现行/历史段落，记录本轮只读快照及保留的 RC 基线 | 明确未升级、未迁移；历史包验收不代表稳定目标已通过 |
| README.md | 同步仅文档阶段、最新稳定版及源码规则，保留原任务入口 | 项目入口与正式方案一致 |
| docs/TICKET_BREAKDOWN_DRAFT.md | 同步共同版本规则，整理重复执行历史，保留 29 条功能、依赖和优先级 | 不重新拆票，不把旧阶段决定当作现行要求 |
| docs/agents/issue-tracker.md | 明确后续先核实稳定目标及必要升级，再按原 P0 前沿推进 | 跟踪规则与本轮文档范围一致 |
| .scratch/redis-viewer/spec.md | 同步稳定版、升级和原样源码副本规则 | Agent 范围说明不再要求当前继续 RC 实现 |
| .scratch/redis-viewer/README.md | 更新阶段说明与共同版本约定，保留任务表 | 原 29 票状态与阻塞边保持原样 |
| .scratch/redis-viewer/issues/01-native-sidebar.md | 将已完成勾选明确标为原 RC 历史验收，现行稳定基线单独说明 | 保留既有 done 与勾选，不冒称稳定目标验收完成 |
| .scratch/redis-viewer/issues/21-release-verification.md | 首项验收改为发布前核实最新稳定正式版、必要升级、对应源码/SDK与产物复验 | 最终发布门禁与现行方案一致，仍未勾选 |
| UPDATE_LOG.md | 追加本节文件、原因、影响、事实和验证记录 | 保留此前全部日志，不改写历史代码工作或测试结果 |

### 本轮只读核对

- 本机 2026-10-16 04:59（UTC+8）：PATH 实际 pnpm dsh.ps1 返回 0.2.0-rc.2；另有 npm 目录入口。桌面实际运行核心本轮未核实，不由 CLI 推断。
- 官方 npm 完整元数据 33 个版本未见纯 X.Y.Z 稳定号，latest/next 均为 0.2.0-rc.2，alpha 为 0.2.1-alpha.4；官方 API 返回 28 条公开 Release 未见非 draft 且非 prerelease，rc.2 的 prerelease 为 true。因此本轮尚无可落实的稳定目标，未执行猜测性升级。
- git ls-remote 核对 Git Graph master 为 33b3e67a39a429a0ff570d82d7264aab735fc1fd、Database main 为 5d2b900b0317200b1866275c7cf48814fe84b52d，与现有参考副本一致；未 clone/fetch/复制源码。
- 依据：https://github.com/deepseek-ai/deepseek-harness/releases 、https://api.github.com/repos/deepseek-ai/deepseek-harness/releases?per_page=100 、https://registry.npmjs.org/@deepseek-ai%2Fdsh 。这是当前快照，开工与发布前须重新核对。

### 验证与执行边界

- 对比本轮前后 SHA-256：169 个产品源码、脚本、测试、lib 产物、许可证、根非 Markdown 配置/依赖文件及固定研究文档全部不变。
- 29 张任务的标题、状态、优先级、Blocked by 与验收复选框逐项不变；01–13 done、14 in-progress、15–29 ready-for-agent 是保留的既有状态，本轮没有新增完成记录。
- 9 份修改文档的当前范围声明一致；UTF-8 文本无替换字符，涉及 E 盘本地 Markdown 目标的链接全部存在；历史日志追加前哈希和长度一致，原内容未重写。
- 本轮不运行编译、构建、Redis 或原生交互验收；文档检查不冒充功能测试。未改产品代码、依赖/锁文件或用户配置，未安装升级、复制源码、启停用户服务，也未提交或 push。


## 2026-10-16 继续不依赖 Docker 的检查（不改代码）

- 原因：用户暂时无法处理 C 盘空间/Docker，要求先继续其他检查；沿用当前不改代码、不安装升级的边界。修改前已说明仅记录实际结果和待验收项，保持最简，不调整功能或任务状态。
- 修改文件：新增 docs/verification/14-checks-without-docker.md，记录实际命令、三层类型结果、169 项测试、7 项排除范围、既有真实 Redis 证据核对及当前构建/已安装包差异；本 UPDATE_LOG.md 追加本节，未改写历史记录。影响为提供可复核检查记录，不增加产品能力或宣称 GEO 完整验收。
- 三层类型检查分别执行 tsc --noEmit --composite false --incremental false，Host/Client/tests 均退出 0；避免生成代码或 tsbuildinfo。TEMP/TMP 指向 E 盘已有测试目录。C 盘仍无可用空间，未清理用户文件。
- 直接运行 Vitest，排除需要临时本机 TCP peer 的 redis-transport.test.ts；15 文件、169 项全部通过，退出 0。本轮不运行 build、不启动任何 Redis/DSH/前后端服务；client-bundle 测试使用现有 lib/client.js，不冒充新包构建/安装验收。
- 核对已有 GEO 机器报告为 8 组通过、两套自建夹具清理标记 true；报告来自先前 wsl-image Redis 8.2.6 实际运行，本轮未重跑。29 份既有验证 JSON 均可解析且 passed=true，这只是原记录核对。
- 包差异：当前 lib 60 文件，隔离测试 profile 安装 lib 54 文件；6 个新增文件、13 个同名内容不同。旧 Bitmap 包原生 55 组通过不能算当前 GEO 原生通过；未更新测试 profile 或日常安装。
- 验证：169 个产品/依赖/产物等受保护文件 SHA-256 与修改前相同；29 张任务标题、状态、优先级、Blocked by 和验收勾选均不变。14 仍 in-progress，未把测试结果扩大为完整首版通过。没有提交/push、网页 GPT 评审或用户服务启停。


## 2026-10-16 按指定 rc.2 继续：GEO 原生验收准备

- 当前用户持续目标再次明确使用 0.2.0-rc.2 并直接实施全部原29票；本轮据此继续，不重复安装同版、不升级alpha，也不再将早期稳定版调查作为等待条件。同步README、DEVELOPMENT_BASELINE、实施方案2.4及阶段验收、任务拆分记录、tracker、spec/索引与01/21当前基线，历史快照及原票状态/依赖保留。
- 修改 scripts/smoke-dsh.mjs：新增GEO feature flag与独立报告名，seed235成员/大参数/普通ZSet/变化样本，实际手动ZSet切坐标、精确坐标/分数/字节预览、100/100/35分页、草稿不查询/EOF/整数、权限与恢复、超请求预算减条数恢复、删除/转型；nil位置UI使用明确的响应故障注入，真实nil竞争已有Redis报告另证。GEOPOS禁用使用自建服务器实际rename-command选项，不伪装真实无命令环境。
- 新脚本node --check与三层类型检查通过。仅测试脚本与基线文档变化，GEO生产实现沿用已有受测代码；当前尚未完成新包原生验收，14继续in-progress。此前GEO真实Redis8组报告已核对为passed且两套自建夹具清理true，后续归档与新包UI证据分别记录。
- 接下来pack会执行完整176项回归，再仅安装到项目独立profile，使用固定官方镜像文件的wsl-image夹具。不会启停用户已有服务、使用日常profile、清理用户C盘文件或提交/push。

- GEO首次原生运行完成53组后，新增脚本选择了不存在的decodedJson选项而超时；进程与自建Redis均已由finally清理。错误修正为已有decode-json选项，并显式设置30秒页面步骤超时；仅验收脚本变化，包及生产实现不变，不需重打包。为主动结束测试而进行的PID唯一性识别未通过保护检查，未终止任何进程；随后原运行自行返回失败并确认清理true。保留首次报告供追溯，再以同一安装包重跑。
- HLL前置实证：在独占Redis8.2.6运行6组PFCOUNT源字节/绝对过期比较，稀疏/稠密与有效/失效缓存的重复双输入保持源值；管理员单输入对照确实更新失效缓存，伪头/坏稀疏被拒绝、缺失不创建Key。机器记录hll-source-probe.json已保存，自建夹具清理true；尚不宣称HLL产品功能完成。


## 2026-10-16 任务14完成：GEO安装包与缺命令实证

- 包SHA256为5daea558886be622c7ea145dd53534eaa0ca5fb0dcff5078b401bcff29654089；pack完成严格类型、构建与完整176项回归，按SHA命名仅安装项目test profile。安装lib60文件集合和字节全部一致。修正首次测试选项后，同包原生62组通过；自建Redis实际禁用GEOPOS、管理员unknown-command确认的独立环境15组通过。脚本中新增禁用实证和metadata标记，node --check通过。
- 归档docs/verification/14-geo-view.md、14-redis-geo-smoke.json、14-native-geo-smoke.json、14-native-geo-unavailable-smoke.json、14-native-geo-data.png与14-native-geo-member.png，机器报告/图片与原件哈希相同，两个截图已查看。nil UI注入和真实竞争证据分别说明；表格换行不冒称全局布局20已完成。
- 14号任务5项勾选并done，15号任务因HLL固定源码及6组前置实证进入in-progress，尚无产品完成声明。同步README、baseline、方案、拆分记录、tracker、spec与索引的单一进度；保留原29票优先级和阻塞图。
- 实际pnpm peers check列出13个missing peers（cordis、11个DSH模块、react），当前隔离profile禁止自动安装peer；已开始按官方共享解析机制与实际宿主版本核对。原生成功不代替该发布审计，不在测试profile盲目安装额外宿主/React副本；21仍未完成。
- 全部自建DSH/浏览器/Redis已结束，证书与UUID目录清理字段true。当前为官方固定Redis镜像文件+wsl-image验证，不是Docker；用户C盘/日常profile/业务Redis和已有服务均未动，不提交/push。全部29票目标仍active，后续15–29继续。


## 2026-10-16 任务15：HLL只读计数链路与专项

- 修改前已说明采用已核对源码及6组真实Redis前置实证的重复双输入PFCOUNT；不使用单输入缓存写回，不把HYLL头当作业务或原始成员证明。
- 新增src/host/hll-reader.ts：复用可信session/DB/generation、10秒总截止和既有字节/传输边界，只读TYPE/PTTL/STRLEN/两次GETRANGE0..15与PFCOUNT同一完整Buffer两次；前后类型、长度和头部比较，保留估算整数文本、dense/sparse与原缓存有效标记。普通/伪头/坏稀疏、权限、缺命令/不支持参数、变化、缺失分流固定结果；无回退或源缓存修复，头部魔数采用精确字节比较。
- 修改domain.ts、typert.shared/host/remote-client.ts、remote-service.ts与redis-transport.ts：新增HllReadRequest/HllReadResult、readHll严格两端契约、Agent作用域RPC及内部固定命令PFCOUNT。结果禁止失败带计数/秘密、错误编码/缓存状态/元信息，计数保留Int64精度；未引入任意命令入口。
- 新增client/HllView.tsx，修改KeyDetails.tsx、KeyBrowser.tsx、index.ts、locales.ts：String手动进入、取消/刷新、估算与编码/缓存卡片及返回String后重新读取；识别失败仍可看原始字节，强调约0.81%标准误差、不能枚举原成员和非原子快照，不自动网络/写回。
- 新增tests/hll-view.test.ts 12项，更新tests/host-typert.test.ts固定RPC清单；覆盖真实重复键形状、只取16字节头、单截止、编码/缓存/精确整数/空Key、伪魔数和非HLL、固定拒绝与不回退、变化/权限/坏回复/编码预算、旧目标/取消/超时及两端严格schema。前三批立即三层类型检查均通过；现在执行构建和全部188项回归，HLL真实reader与安装包验收仍待补，15保持in-progress。
- 14验收文档和对应包证据保持原样；新的HLL源码不冒充已在14包验收。没有操作业务Redis、日常profile、用户服务或提交/push。

- HLL完整检查实际结束：严格类型/构建与全部188项回归通过。新增scripts/smoke-redis-hll.mjs，扩展两个fixture脚本的独占disableHllCount选项，用真实核心PFCOUNT禁用环境证明不可用分支；各mjs语法检查通过。首次真实reader已过3组，ACL夹具无效resetcommands导致setup失败，源业务代码无改动，实例已清理；修正为项目其他已实证夹具采用的reset on权限列表，并去掉多余的同DB SELECT，再重跑。首次机器报告另存hll-first-attempt-smoke.json。

- HLL真实reader复跑7组全部通过，两个夹具清理true；包括稀疏/稠密/有效及失效缓存、空/二进制Key、真实源字节/绝对过期及写计数、2MiB伪HLL仅16字节头部读取、64KiB Key重复参数超限后健康恢复、最小ACL/拒绝后原String可读、DB代次、实际类型/删除/长度/缓存竞争，实际禁用PFCOUNT环境不回退。补充scripts/smoke-dsh.mjs的HLL标记、七种源样本、手动入口/缓存/字节返回/格式错误/权限/删除转型及实际缺命令验证，语法检查通过；随后打包与原生验收。

- HLL包SHA256=b082b065ff4d0689a2c3238159b0f7802b4d8941ef84626853c3016e512aed5f，pack严格类型/构建/188回归通过，仅安装独立profile。原生第一次完成60组后，测试把新建空HLL的源缓存标记预期为有效，但实际PFADD新建会置失效；机器可见文本确认空HLL=0且Invalid，产品正确。修正仅该测试预期false，同包重跑；首次报告另存native-hll-first-attempt-smoke.json，所有自建资源已清理true。


## 2026-10-16 任务15完成：HLL只读估算与真实包验收

- 生产HLL源码、严格契约/Agent RPC、手动视图及12专项已在包b082b065ff4d0689a2c3238159b0f7802b4d8941ef84626853c3016e512aed5f验证：pack三层类型/构建/完整188项通过；真实reader7组、源语义对照6组、原生完整67组、实际禁用PFCOUNT环境15组通过。安装lib62文件集合及字节一致；原生刷新等待本次RPC，防止旧计数误判；首次空HLL缓存预期错误已修正，仅测试变化同包复跑。
- 新增docs/verification/15-hll-count.md及6份源报告/截图，归档内容与原始文件哈希相同；两个HLL截图已查看。明确32字节头部界限仅属HLL请求，String初始窗口单独计；0.81%为标准误差而非绝对界限；不扩大为所有Redis版本支持或统一取消/会话/布局已完成。
- 15号5项勾选并done；16号因官方文档/上游/契约事实核对开始进入in-progress，仍无实现声明。更新README、baseline、方案8.5及历史过时当前进度、拆分记录、tracker、spec和索引，保持原29票范围/优先级/阻塞图。
- 补充21号依赖审计事实：rc.2官方profile.ts确有共享runtime与autoInstallPeers:false设计，实际12个DSH/Cordis模块版本匹配；React官方Web源码lock18.3.1与浏览器当前实际版本的证明分开，后者仍待发布票核验；不以原生成功代替此门禁，不盲目装peer副本。
- 本轮全部自建DSH/浏览器/Redis均停止，fixture证书/UUID目录清理true；没有操作用户业务库、日常profile或已有服务、未清理用户C盘、未提交/push、未调用网页GPT。14/15的历史包证据分别保留，完整29票目标仍active。


## 2026-10-16 任务16：TimeSeries协议实证与首批实现

- 修改前说明：先在独占临时实例确认时间边界，再复用严格Agent RPC、既有游标/取消/预算与表格，不增加写入、聚合或曲线。任务计数审计15 done/16 in-progress/13 ready，原参考说明SHA不变、无遗留夹具；第一次审计误假定所有历史票均5项，脚本改为逐票验证未完成项，不改任务内容。
- 新增scripts/probe-timeseries.mjs，以原始RESP2/BigInt实测Redis8.2.6、TimeSeries80210：TYPE为TSDB-TYPE，0和Int64最大值及超过53位时间戳精确；两方向均最小/最大包含端点，空范围/空序列空数组，Stream排他语法、负数/溢出被拒绝，NaN/inf样本被拒绝。3组通过并记录timeseries-source-probe.json，实例/目录清理true。
- 新增src/redis-timeseries.ts与host/timeseries-reader.ts及domain契约：固定TS.INFO/TS.RANGE/TS.REVRANGE，原始值文本与精确时间戳，分页上页末时间戳±1且避免端点溢出，内部前缀区分0与终结游标；可信session/DB/代次、总10秒、单用token绑定范围/方向/条数。INFO权限/命令拒绝不阻塞范围读取，删除/类型变化/缺命令/超限分别固定结果；TYPE后检不宣称原子快照。
- 修改typert.shared/host/remote-client、remote-service、redis-transport、client/index/KeyDetails/KeyBrowser/use-collection-scan，接入严格20号RPC、reader生命周期与TSDB类型路由。新增client/TimeSeriesView与timeseries-cache、补中英locale，含范围/方向/100条页、取消/连续读、原文表格、元信息独立失败、5000条/2MiB缓存。tests/host-typert固定端点清单同步。尚待立即类型检查、专项、真实reader和原生包验收，16仍未完成；不动业务数据、用户服务或日常profile。
- 首次立即类型检查：Host通过，Client报告TS6307（显式include漏新增redis-timeseries.ts）；只补tsconfig.client.json的共享源清单，不调整运行代码或类型严格度。现在重跑三层类型检查。
- 修正显式编译清单后Host/Client/tests全通过。新增tests/timeseries-view.test.ts 14项覆盖精确值/端点/双向分页/0终点/权限独立/竞态/坏回复/token绑定/取消超时/缓存及两端schema；其首轮TS检查指出测试试图构造RESP2解码类型不可能产生的JS number，删除这条冗余夹具（真实解码只产生BigInt），保留字符串/Buffer/数组畸形、负值、溢出与精度测试，立即重跑。
- 三层类型、构建与完整202项回归通过（新增14项）。新增scripts/smoke-redis-timeseries.mjs真实reader验证；首次期望将写入数值字面量当作服务器返回原文，实际Redis会将其标准化为-1E-17和1.7976931348623157E308，产品如实保留正确。仅修正测试oracle为管理员RESP2返回的值文本，时间戳仍对照精确种子字符串，保留首次报告timeseries-first-attempt-smoke.json；全部夹具已清理true，立即复跑。
- 真实reader第二次失败仅因测试页分组断言：5条种子、每页2条时末时间戳依次1、Int64最大值-1，下一起点应为2与Int64最大值，而非第三条时间戳+1。重新核对完整种子/分页关系，修正测试预期并保留second-attempt报告；未修补业务代码，夹具清理true，复跑全部真实检查。
- 第三次真实reader已通过6组（精确原文/235样本分页/只读不变/最小ACL/实际2MiB INFO拒绝/真实DB隔离）；类型竞争失败暴露真实模块前缀ERR WRONGTYPE，区别于核心WRONGTYPE及ERR TSDB。用独立临时实例单独复现了INFO/RANGE的Hash与missing错误形状，不再修测试预期；仅在TimeSeries reader增加该固定错误族的TYPE重检，专项改为真实前缀，并扩展源探针记录。保留third-attempt报告，各实例已清理，立即编译/完整回归和真实复验。
- 修正真实ERR WRONGTYPE后，三层类型/构建/202回归再次通过，源探针3组与真实reader7组全部通过、夹具清理true。扩展scripts/smoke-dsh.mjs的REDIS_SMOKE_TIMESERIES标记、4类种子、双向235条/精准端点/草稿输入/INFO与范围实际ACL/空序列/删除转型及原始值过期对照；另明确标注缺命令UI和坏时间戳采用响应故障注入，不能冒称真实缺模块。准备检查脚本、打包并仅安装项目测试profile进行原生验收。
- TimeSeries包SHA256=39dd8a922dd20fabf00d3e98d72b5d7ff40ec68204aa9e0503060478b964c8ca；pack三层类型/构建/202项回归通过，按SHA命名只安装隔离测试profile，安装lib66文件集合与字节一致。原生全功能回归正在运行；暂不勾选16号，也不将已有真实reader7组冒称安装包界面验收。
- 第一次原生已通过TimeSeries双向235条、精确Int64、草稿/端点/空范围与真实ACL；在HTTP响应篡改溢出时间戳专项失败，实际界面展示了溢出值。原生wire路径未自动执行描述器的结果校验。保留native-timeseries-first-attempt-smoke.json及失败截图，不将该结果标通过；产品仅在TimeSeriesView接收成功结果后显式执行已有timeSeriesReadResultSchema，再进入缓存/渲染，无新校验规则/框架。所有自建资源已清理true；即刻三层类型/构建/完整回归、重新打包与原生复验。17原票已核对只含Bloom，不包含Cuckoo。
- 结果显式校验补齐后首次重pack：三层类型及构建通过，Vitest双worker在当前Windows系统commit余量约1.1GiB时发生semi-space分配OOM/IPC关闭，非测试断言失败；检查无残留本项目Vitest worker。将vitest.config.ts最大worker从2减为1并注释原因，不减少用例或降低校验，后续命令临时NODE_OPTIONS限制单进程堆/半空间；不修改系统分页/用户进程。重新执行完整prepack。
- 单worker完整prepack成功：202/202回归、Host/Client/tests类型及构建通过；新包SHA256=f26893bdc08882e99237eba5597b92637ce3da71aa6d790527dee8bfcfa3603a，仅安装隔离profile，正在复跑全部原生功能和新增响应故障注入。未跳过prepack、未减少用例或改用户系统配置。


## 2026-10-16 任务16完成：TimeSeries与原生接收边界验收

- 最终包f26893bdc08882e99237eba5597b92637ce3da71aa6d790527dee8bfcfa3603a：完整prepack严格三层类型/构建/202回归，真实reader复验7组、源RESP2探针3组、原生全功能73组均通过；安装lib66文件集合/字节相同。显式Client结果校验的坏时间戳拒绝、清空旧表与恢复在真实安装包通过；首次失败/OOM及修正记录保留。
- 归档docs/verification/16-timeseries-view.md、16-redis-timeseries-smoke.json、16-timeseries-source-probe.json、16-native-timeseries-smoke.json、16-native-timeseries-data.png，报告和截图与原件哈希一致，截图已查看。明确真实ACL/竞态/接收超限与UI故障注入区别、同类型变化非原子、巨量INFO不能靠缩小样本数解决、曲线/主题/慢请求/发布审计未完成。
- 16号5项勾选done；17号官方文档/原票事实核对开始in-progress（仍5项未勾选），只含Bloom，不含Cuckoo。同步README、baseline、方案8.6和进度、拆分草案、tracker、spec及索引，保留原29票范围、优先级、依赖与历史稳定迁移记录；清掉拆分01摘要把未来稳定迁移误作当前前置的过时句。
- 21票补充浏览器接收校验待全覆盖的真实审计事实，20票补充双时间输入不均/数字列换行证据，不勾选这些未验收任务。所有自建DSH/Chrome/Redis已结束，证书和UUID目录清理true；没有修改业务库/日常profile/用户服务、清理C盘或提交/push；29票目标继续active。
- 16归档后独立核验29票状态/依赖图/参考SHA和空夹具目录通过，安装lib实际为66文件；归档脚本末行临时循环变量被复用而误打印38，正文/断言均为66，独立重核输出已纠正。17开始：新增scripts/probe-bloom.mjs，复用已验证的RESP2探针方法，在独占实例确认Bloom/Cuckoo实际类型、scaling/non-scaling元信息、二进制/空查询和实际假阳性；先不写Bloom产品代码。


## 2026-10-16 本地Git里程碑提交约定与首个检查点

- 用户明确要求每完成一个小目标即提交本地Git。后续每票完成相应验证后提交，不push，不改写历史、不跳过hooks。当前真实分支main尚无提交，暂存为空、无remote；使用已有Git身份WhitePlusMS。
- 首个提交建立01–16已验收代码/测试/文档/证据基线，包含17号只读调研及3组通过的探针，但不把未完成Bloom产品实现当已交付。17号本批已写入但尚未接入/编译的domain/shared契约与bloom-reader仅保留工作区，暂存快照还原至16号形态；不重置或覆盖工作文件。
- 提交前从暂存tree导出独立临时目录，使用现有依赖进行严格类型/构建/全部202回归验证；具体结果随后追加。node_modules/lib/运行夹具/本机安装内容均沿用.gitignore排除。
- 暂存tree独立导出后的Host/Client/tests严格类型、构建与全部202测试通过。完整git diff --cached --check仅提示不可变参考文档原有4处Markdown两空格硬换行和末尾空行；保留原SHA不改写历史参考，该文件之外的暂存检查通过。追加实际验证结果后执行首个本地提交，236文件构成01–16基线；17号未完成产品代码仍留工作区，无push。


## 2026-10-16 任务17：Bloom只读单项查询链路

- 16号里程碑已按用户授权本地提交15c4b64fda928d33ebc84da67ed5f7dc5626b171（main，无push）；独立快照202项通过。自动审批审核拒绝临时导出目录递归清理，仅返回blocked by policy，目录保留.scratch/runtime/git-checkpoint-16-9a30381a-b854-48b6-8b56-22b09d3c9298（含指向既有依赖的junction），无服务运行，不改用户依赖或绕过策略。
- Bloom源探针3组通过，已实证MBbloom--和MBbloomCF区分、BF.INFO不扩展时Expansion rate=null、缺失/错误类型的EXISTS为0、实际never-added-643是假阳性。只做原17票Bloom，不增加Cuckoo或写操作。
- 新增host/bloom-reader.ts：固定TYPE/PTTL/BF.INFO与按需单项BF.EXISTS，完整Key字节与查询字节，INFO权限/不可用独立于查询；前后TYPE/TTL防缺失或错误类型被0误显示为阴性，固定not found重检、总10秒、Int64文本和统一预算。不枚举/插入/预留过滤器。
- domain、typert.shared/host/remote-client、remote-service、transport、client/index/KeyDetails/KeyBrowser接入readBloom严格21号RPC。新增client/BloomView.tsx和bloom-query.ts及中英locale：统计自动首读、查询显式单项≤4KiB Text/Base64（空字节有效），结果显示可能性、提交项原字节及独立权限状态，原文计数与null扩展系数；成功结果显式schema校验后渲染。tests/host-typert端点同步。立即类型检查，专项/真实reader/包验收尚未完成，17保持in-progress，完成后按新约定本地提交。
- Bloom链路首轮三层类型检查通过；新增tests/bloom-view.test.ts 14项，覆盖INFO-only不隐式查询、概率标记与空/二进制项、null不扩展、Cuckoo排除、独立ACL/缺命令、0返回竞态重检、Int64/畸形字段与标记、取消/超时/旧代次、4KiB字节/规范Base64和两端严格schema。立即类型/构建/完整回归，17尚未验收、不提交未完成代码。
- Bloom真实reader6组一次通过，源字节/绝对过期/写计数不变、最小权限、实际0返回竞争、64KiB Key与4KiB查询项、DB代次等通过，夹具清理true。扩展scripts/smoke-dsh.mjs的BLOOM标记、5类种子、INFO-only不查询/草稿无RPC、Text/Base64/空/最大字节、非扩展null/真实假阳性/Cuckoo排除、真实ACL、删除转型和源不变；缺命令及伪造确定性标记用明确响应故障注入。现在语法检查、完整prepack及原生安装包验收；通过后提交17。
- Bloom完整prepack已通过严格类型/构建/216回归，包SHA256=a0ac67733e206831ded8d0e4a734883715a9ead0631ee2dfa3b5c79321b9c507按SHA名安装隔离profile；安装lib68文件集合/内容一致。真实reader6组通过，原生全功能正在验收，17仍未完成、未提交。


## 2026-10-16 任务17完成：Bloom概率查询安装包验收

- 包a0ac67733e206831ded8d0e4a734883715a9ead0631ee2dfa3b5c79321b9c507完成三层严格类型/构建/216回归；源3组、真实reader6组、原生完整79组通过，安装lib68文件集合/字节一致。真实假阳性截图已查看，概率与统计文案符合实际结果；无Cuckoo/写操作。
- 新增docs/verification/17-bloom-view.md及四份机器报告/截图，归档与源件SHA相同。记录null扩展来自固定模块实证、缺命令与伪造确定性结论的HTTP注入边界、删除/转型后0不冒充阴性、真实ACL、源DUMP/绝对过期/写计数不变；未宣称所有模块或统一会话恢复已验收。
- 17号五项勾选done，18号因可信生命周期/现有状态事实核对开始in-progress但未勾选；更新README、baseline、方案8.7、拆分草案、tracker、spec及索引。保留原29票优先级/依赖和固定参考SHA。下一步仅按原18票实施，17本轮归档核对后本地提交，无push。
- 所有自建DSH/Chrome/Redis已退出，证书/UUID目录清理true；用户业务库、日常profile和已有服务未动。之前Git16临时快照递归清理被自动审核拒绝（blocked by policy），原目录/junction继续保留，不绕过删除策略。


## 2026-10-16 任务18首批：可信会话浏览选择

- 17已本地提交7ff5185，工作区干净后开始18。完整核对官方rc.2 SessionStore/客户端binding生命周期：侧栏解绑不等于Host session/disposed，不借用对话header/event-log保存插件选择。
- 新增domain.SessionBrowsingState及固定格式枚举；typert.shared/host/remote-client与remote-service新增load/saveBrowsingState严格Agent RPC，禁止浏览器在DTO伪造sessionId、值、秘密、socket/游标。src/host/browsing-state.ts以可信sessionId的Map保存当前Host生命周期内的配置ID、DB、MATCH、原Key字节、各视图格式及String窗口；clone边界、取消前校验、disposed仅删自身，Host卸载清全部，无Redis操作/自动联网/磁盘写入。按原票无跨DSH重启恢复声明。
- tests/host-typert固定端点清单同步23项；立即三层类型检查。18 UI/专项/真实包验收仍待完成，任务继续in-progress。

- 18第二批新增client/BrowsingSession.tsx与session-state-queue.ts，修改RedisWorkspace/index：可信slot闭包绑定偏好RPC、每会话串行读写，卸载前已发有限保存完成后新挂载再load；不同会话独立，迟到保存响应不覆盖UI，load/save失败可显式重试，成功结果显式严格schema后渲染。
- ProfileChooser恢复当前会话配置ID和设置，KeyBrowser恢复DB/MATCH/原Key Base64；恢复仅显示身份，用户显式读才挂KeyDetails，实际DB不符需手动SELECT。Key列表/值/续页token不恢复。KeyDetails保留已提交String窗口，八视图格式改由同一会话context保存，保留各自原默认格式，移除cell选择自动重置格式；value-preview复用domain格式类型，仍用既有BytePreview。locale明确Host生命周期及load/save错误。
- 批量脚本误按无类型的en声明定位，实际英文词典为显式Record类型，最后一步未匹配；类型检查立即发现7个缺失翻译。修正准确声明并补齐条目，未绕过编译。此时18仍未验收/未提交。

- 18严格类型/构建/完整222回归首次通过，其中新会话状态6项。随后补明确sessionKey作为Provider的React key，防DSH复用同一组件位置时短暂沿用旧会话表单/context；浏览器身份仅用于卸载隔离，Host归属仍由闭包及Agent lookup确定。扩展现有真实client bundle测试验证两个slot绑定各自sessionId，不通过DTO指定归属；立即重新类型检查。

- 新增scripts/smoke-session-state.mjs并在原生脚本加入SESSIONS开关、独立报告及自建profile：真实可信API新建第二会话，经官方源码证实的data-row-key切换；验证共享配置/独立DB与二进制Key/格式/窗口、无自动Redis命令、旧HTTP响应跨会话丢弃、单会话断连与显式重连DB边界。真正session移除无公开Remote，事件清理只以Host状态/连接专项和源码接线核对，不冒称点击归档等于dispose。旧String回归两处显式选择Text，不继续依赖新Key隐式reset。原生尚未运行，随后语法检查/完整pack/隔离安装。
- 18完整prepack222项通过，包53c5b7dcb6a4f2c538d67f894d7fbf6e7029bcdc83e837c0214211720cc4b075。首次安装相对tgz路径被CLI按profile目录解析导致ENOENT，改绝对同SHA路径后成功；lib70文件字节一致。原生首次运行在最终报告前中断，不能从中途截图判为通过。
- 自动审核拒绝本次UUID6a0fb5e9自建Redis信号/目录清理的整条命令，仅返回blocked by policy，命令没有执行且未换机制重试。随后仅只读核对：本次Windows脚本/DSH进程已不在，Linux记录pid286在/proc已不存在；两份UUID目录保留。中断事实独立记录native-sessions-interrupted.json，未假造完整报告或清理成功。接下来同包捕获完整console复跑，不依据未知中断原因改产品代码。

- 同包第二次原生console证实openSession先创建waitForResponse Promise、再独立await行点击，会在点击等待期间出现未处理的response超时，导致Node退出并跳过finally；首次中断不能仅凭相似性断定同因。修脚本为先等待实际session行，再Promise.all绑定响应与点击，确保失败进入原catch/finally；加入逐组console记录以追溯已完成检查，产品包不变。不依据缺少页面状态的错误继续补产品；重新抓真实DOM定位行缺失或切换原因。

- 第三次同包运行生成完整失败报告：77组（含既有全部类型、A状态保存、Host关闭）通过后，未选中blank B没有列表行。源码和失败截图一致：rc.2树明确隐藏非current blank，rename不改变blank；这不是Redis状态实现故障。本次finally完整退出并清理true。保存失败原报告/console/截图，停下重审测试方向，没有继续猜测DOM。
- 改验收为自建第二唯一workspace，目录在当前独占Redis UUID目录内随原finally回收；走官方New session in workspace/adopt已有blank入口，并从真实session/create响应核对目标ID后确认aria-selected。两会话状态目标仍不同，既有无自动Redis/迟到响应等验收不减；不写产品测试hook、不额外安装插件、不发模型请求。包与70个lib不变，随后同包重跑。

- 下一次同包全类型复跑在普通SCAN阶段失败：7组后报告未complete，随后fixture admin ClientClosedError；并行只读WSL探针返回Service I/O 0x800703e3，当前C盘仅约238MiB。这里只记录同时观察到的环境连接中断，不把相关性当成产品根因。该轮自建DSH/Redis/证书/目录正常清理true，完整失败报告/console/截图另存environment-failure。保留先前77组全视图报告，后续不改产品，改用仅KEYS+SESSIONS的小夹具隔离跨会话，期间不额外调用WSL探针。

- 缩小KEYS+SESSIONS的同包复跑仅完成5个Host基础组，在初始DSH New session按钮等待超时，尚未执行双会话流程。自建DSH/Redis/证书/目录均清理true；visibleText为空，失败截图尝试未写入新文件，现有native-sessions-failure.png仍是上一轮15:47旧图，未将其复制冒充本轮证据。bootstrap-failure JSON/console单独保留。
- 暂停真实Redis重复全跑，验收脚本始终记录有界脱敏browser pageerror/console error/requestfailed到机器报告，随后只跑无Redis的Host/侧栏启动检查。产品源码与包不变，18状态仍in-progress，没有把环境失败当成完成或继续打产品补丁。

- 无Redis的同包原生Host/侧栏启动已通过，browser pageErrors/consoleErrors/requestFailures均为空，自建DSH正常退出；原报告native-smoke.json为本次时间戳。继续同包仅普通直连KEYS+SESSIONS小夹具验证，不额外调用WSL探针，TLS和全类型既有77组另记，不混称完整21发布通过。


## 2026-10-16 任务18完成：可信会话偏好与显式恢复

- 产品包53c5b7dcb6a4f2c538d67f894d7fbf6e7029bcdc83e837c0214211720cc4b075严格三层类型/构建/222回归通过，lib70文件集合/字节一致；最终普通直连原生双会话21组通过，无Redis启动单独通过，预期旧readString请求ERR_ABORTED外无page/console错误。两个workspace的真实DSH blank创建/复用入口证实独立选择/共享配置/无自动Redis命令、二进制Key/格式/窗口、A旧HTTP响应不覆盖B、单owner断开和DB手动恢复。
- 新增docs/verification/18-session-browsing-state.md及八份原始报告/截图/console归档，均与原件SHA相同；B截图已查看。保留同包完整类型运行77组但整轮false、未处理waiter、7组环境失连及5组页面启动失败；没有将失败改为通过、假造新截图或宣称21门禁已完。19/20边界明确，状态只保留当前Host生命周期，不新增磁盘/浏览器秘密保存。
- 18四项勾选done，19按题目和既有取消/队列事实核对进入in-progress，仍5项未勾选；同步七个进度入口与方案6.2、tracker加入每验证小目标本地提交约定，原29票图/优先级与固定参考SHA保留。18完成核对后本地提交，无push。
- 最终成功轮资源正常清理true；早期异常两对目录6a0fb5e9/ab6db273及Git16快照仍保留，清理被自动审核拒绝后未绕过。最后仅只读验证原Linux PID286/298不存在，当前无这些自建Redis运行；没有启停用户已有服务、日常profile或清理C盘。


## 2026-10-16 任务19首批：取消语义与传输边界验证

- 开始前核对main=1ef57e4且工作区干净，18 done/19 in-progress。完整读Host transport/connection/read context与既有单测、String/UI取消路径，复用现有16项队列和10秒共享截止/回复排空，不重复造生产调度器。
- 修改client/locales.ts中英timeout/cancelled提示：停止等待不承诺Redis已停止执行；超时/取消后先刷新连接状态，断开则手动重连再缩小范围重试。仅解释实际恢复步骤，无写命令、自动重连或UI实现细节入口。
- tests/redis-transport.test.ts新增3项有意义的loopback协议验证：排队截止过期不派发且socket可复用；active硬截止只通知一次、不派发后继；取消后分片回复必须全部排空才派发下一命令。短deadline用于单元验证，不能冒充真实生产10秒已测。
- 新增scripts/read-delay-proxy.mjs，仅测试用Node loopback代理，复用生产RESP解码及请求/接收预算，转发真实Redis且可扣留一条实际回复；分别记录连接/固定命令和Key原字节身份、不保存AUTH参数/密码，所有socket/server由自身close回收。不发DEBUG/EVAL/全局CLIENT PAUSE，不把延迟网络回复称作停止服务器计算。先语法/类型/构建/回归，随后真实双会话验证，19尚未完成不提交。

- 首批三层类型/构建/完整225回归通过，transport新增3项均通过。新增scripts/smoke-redis-recovery.mjs：真实Redis经代理执行生产String reader与transport，覆盖取消排空/下一响应身份、active+15队列、短排队截止、SELECT前generation及派发guard、实际固定10秒硬截止、取消已执行SELECT的DB不确定性、真实TCP EOF/手动重连不重放、另一会话读取、源字节/绝对过期/写计数和64KiB Key。代理注释明确只是不记录AUTH诊断，不声称认证内存里没有秘密。mjs语法检查后运行，尚无真实通过声明。

- 首轮真实恢复脚本完成1组，实际取消等待1ms且B可继续读取。第2组在取消满队列后、刚release代理旧回复就立即新读，state=failed导致预期value失败；夹具清理true。此时具体错误码未记录，不直接判为产品缺陷。脚本现记录首次state/error，只允许busy作为尚在排空的中间状态，有限轮询等待Host实际消费旧帧和清队列后再检查；其他错误仍失败，生产不新增自动重试。
- 首次尝试写入上述诊断时PowerShell尚未启动即退出-1073741523，整条命令未执行；随后cmd只读git status确认仍只有首批5个变更。使用apply_patch完成本次脚本/日志更新，继续轻量命令验证，不把失败命令当作已执行。

- 真实恢复复验8组全部通过：实际取消1ms返回，生产总截止约10041ms；取消满队列后首次重试确为busy，旧帧消费完后恢复。手动重连仅AUTH/PING、无旧读取重放；A超时/EOF/取消不影响B，源DUMP/绝对过期/写计数不变，64KiB Key身份完整，夹具及目录清理true。保留首轮失败报告recovery-first-attempt-smoke.json，不将有限验收轮询写入生产。
- 据实补充中英busy提示：取消后旧回复仍可能待排空，等待、刷新状态再手动重试。没有修改已验证的生产队列或增加自动重试；立即严格类型检查，随后以测试专用代理补原生侧栏取消/真实10秒超时/EOF与另一可信会话独立性验收。
- busy提示修改后三层严格类型通过。新增scripts/smoke-native-recovery.mjs，在真实DSH浏览器主动取消active及queued String读取，并用真实代理命令轨迹检查Host没有执行已取消后检/排队读取；实际10秒超时和TCP EOF后走刷新状态、密码重输、手动重连及显式已选Key读取，独立可信B会话同时可读。smoke-dsh.mjs只增加RECOVERY开关/独立报告和owned plain loopback代理的finally，不更改默认验收路径。先语法检查、完整prepack与隔离安装后运行，尚未宣称原生通过。

## 2026-10-16 任务19完成：真实取消、硬截止与手动恢复

- 完整prepack严格三层类型/构建/225回归通过；包4318a096b047621717654659810e4559f2740ea04373a598616d135e97cc6563按SHA路径仅安装隔离profile，lib70完整集合/字节一致。原有peer缺项提醒保留待21核查，没有盲目另装共享runtime。
- 原生18组全部通过：UI active/queued取消实际传至Host，释放旧回复后只执行第三次显式读取；取消约31ms、生产固定截止约10100ms。A超时/实际TCP EOF后刷新状态/重输密码/手动重连新generation，只有AUTH/PING、不重放旧读取；显式已选Key读取后原值正确，B可信会话保持自己的目标并可读。
- 新增docs/verification/19-read-cancellation-recovery.md及真实成功/首轮失败/原生报告和两张截图归档，均核对源件SHA；截图已查看，当前滚动未同时显示全部值区域，值以原生机器断言为证、20继续布局。明确plain真实网络回复延迟不等于Redis计算中止，也不冒称全类型/TLS慢请求和21门禁已完成。
- 19五项勾选done；20据原票/共享容器/rc.2布局事实核对开始in-progress，四项仍未勾选；同步七个进度入口和方案6.4，保留29票原图/优先级/依赖及不可变参考SHA。归档核对后提交19本地Git，无push。
- 本票自建DSH/Chrome/Redis及代理全部退出，Host socket回管理连接基线，证书/UUID目录清理true；原生page/console errors为空，只有预期两条readString ERR_ABORTED。用户服务、业务库、日常profile/C盘未动；此前18两对目录和16快照仍按清理拒绝记录保留，没有绕过策略。
- 归档后复核29票数量/P0=21/P1=8、全部原依赖图和参考SHA不变，当前19 done/20 in-progress/其余9 ready，七个摘要一致，git diff --check通过。提交范围仅19产品提示/传输专项/真实及原生验收脚本、原始证据和必要进度文档，不含依赖、lib、运行夹具或未来20产品代码。

## 2026-10-16 任务20：共享窄宽侧栏容器

- 19本地提交8cab309，main保持干净；布局原型以独立分支prototype/sidebar-layout提交2475afcb4dc642cdb7ddf88e5a59c9206f457be3，HTML和一次性浏览器核对留在ignored artifacts供预览。已向用户提供A/B/C可选偏好，默认推荐A；未收到回复不称用户确认，按既有全部任务实施授权继续推荐结构。原型不并入main、不冒充真实Redis/生产验收。
- KeyBrowser增加唯一列表/详情容器与导航状态：窄栏往返、宽栏CSS自动分栏，两个面板保持挂载；返回保存列表scrollTop/选中Key并恢复键盘焦点，不重新读取值。同Key重新打开不重置已提交String窗口。所有类型仍沿用现有KeyDetails路由，不复制各类型布局状态，不更改Host/RPC/代次。
- ConnectionForm将共享配置收进原生details，连接成功时收起，释放主浏览空间；断开时展开。styles.ts统一flex/grid高度链、插件内部滚动/防滚动链、长Key截短显示/原身份保留、共享表格数字不换行/局部横滚、明暗错误色及键盘焦点。TimeSeries和Stream双边界独立等宽，小于420px改上下排列，不继续套95px端口宽度；中英locale补导航/配置/空详情提示。
- 立即严格类型检查，随后补CollectionTable语义列标记与原生尺寸/主题/加载错误空态/返回定位证据；20四项仍未勾选，当前尚未宣称布局完成。
- 首批共享布局三层严格类型通过；补充新扫描回列表、隐藏列表时不以伪scroll事件覆盖已保存位置，并删除外层非空分支内的重复判断。CollectionTable只给既有列id加DOM语义标记，数字列的局部横滚复用这些id，无第二套表格或布局状态；随后再检查类型与完整225回归。
- 原生通用scanAll按新交互在窄栏先点Back to keys，再编辑MATCH；宽栏按钮隐藏时仍直接操作可见列表。没有跳过原Key/类型检查或改变生产行为，继续以真实安装包验收。
- 新增scripts/smoke-sidebar-layout.mjs与LAYOUT开关：1920px真实DSH视口，用原生rightbar手柄拖到340/900/300px，通过Settings/General按钮切Light/Dark。独占夹具只增加12种查看的最小样本，验证共享窄栏、长Key/值、返回滚动/焦点/无重读、TimeSeries等宽边界、GEO数字局部横滚、验证错误/空态、源DUMP/绝对过期不变。不是静态原型或CSS宽度注入，尚待语法/完整prepack和真实包运行；加载态专项后续补在同一验收中。
- 加载布局验收采用明确HTTP回复延迟：先取得真实Host回复再扣留，检查340px loading/Cancel按钮/边界，finally释放后值恢复；此项不冒称实际Redis取消，19原生已单独验证。打开Bitmap/HLL/GEO时等待各自真实手动解释按钮，避免把GEO前置ZSet误当String。宽栏CSS用等优先级后置规则，不使用!important；注释说明实际面板宽度而非主窗口决定布局。随后语法/完整prepack。
- 完整prepack严格类型/构建/225回归通过；包2c976b69a5265f984882eefe34dc830962671c0d8c0eca60affb6847d1e08848仅安装隔离profile，lib70完整集合/字节一致。首次原生22组全部通过，实际拖动340/900/300px、12种查看共用窄栏、返回2270px定位/焦点/无重读、原生Dark/Light、局部滚动、加载/错误/空态及12份源数据不变；自建DSH/Redis/证书/目录清理true，浏览器三类错误均空。
- 用户随后明确选择A方案，按该布局交付。已查看宽明亮/窄深色截图；为避免只见表格标题，验收脚本补滚动到GEO数据行，并另存窄深色TS数据截图。仅改测试取景、不改已通过产品包；同包复验后归档提交20，不重复运行无变化的类型/225测试。
- 同包第二次22组通过，但人工查看新增数据截图发现300px TS元信息dt的auto列挤压dd，Int64呈竖排，GEO成员最小宽度不足；现有边界检查未覆盖此可读性，不能直接完成20。最小修正styles.ts：元信息两列有界、窄栏堆叠、成员列至少120px、长Key标题单行省略而原字节textarea保留。原生专项补两个长时间戳均单行、成员列宽和标题高度断言；立即类型/完整prepack，新包重新安装/验收。保留前两次passed报告作为其原检查范围的记录，不改写为最终修正已通过。
- 元信息修正包d0f827f5f2c65632e49774de7ddaa8e618f5425b1dbd46631197c41f0cdda003严格类型/225回归与原生22组通过，TS元信息两个长时间戳均单行。人工截图发现剩余GEO rank表头被表格通用overflow-wrap:anywhere逐字折行；重新核对共享表头规则，统一所有th单行/正常断词，所有原始数字列含rank/index不换行，以局部横滚承担宽度，不逐列设置额外布局状态。专项对所有实际表格增加表头一行断言，并以真实ArrowRight验证聚焦表格横滚、取景归零。20尚未完成，立即类型/pack并以最终包复验；这次修正不改Host/RPC。

## 2026-10-16 任务20完成：用户选择A的真实侧栏布局

- 最终包c5a26feca07ed474a51b96edc8e112e13d0e8f88a8cc6a1a22197e06a41f427d完整prepack三层严格类型/构建/225回归通过，隔离安装lib70完整集合/字节相同；真实原生22组通过，全部已显示表头一行、两个TS长元信息单行、GEO成员宽/数字列、ArrowRight局部横滚均通过。最终截图已查看，最后一列需局部横滚时如实保留，不截短实际数字。
- 新增docs/verification/20-sidebar-layout-themes.md、最终及两份前检查范围的原始报告、四张原生截图，均按源件字节/哈希归档。记录12类共享容器、实际300/340/900px手柄、Settings/General明暗、返回135px定位/焦点/无重读、加载注入边界、空态/错误、源12份DUMP/绝对过期不变及可读性修正过程。独立原型分支2475afc不合main，用户已明确选择A。
- 20四项勾选done；21依据原票/23RPC消费入口/共享runtime源码事实核对开始in-progress，五项未勾选；同步七个进度入口及方案6.5，原29票图/P0=21/P1=8/优先级和参考SHA保持。21仍需当前包全门禁和浏览器实际React版本证据，不以旧包或schema单测代替。
- 本票各轮自建DSH/Chrome/Redis均正常退出，Host socket回管理员基线、证书/UUID目录清理true，最终浏览器page/console/request错误均空。未启停用户服务、动业务库/日常profile或清理C盘；早期清理被自动审核拒绝的18/16目录继续保留。归档核对后提交20本地Git，不push、不改写历史或跳过hooks。
- 提交前核对29票原图、P0/P1数量、20 done/21 in-progress/其余8 ready、七个摘要和参考SHA均正确；归档长Key由实际种子计算为2060字节，纠正文档初写2059。仅整理KeyBrowser/ConnectionForm新包裹层JSX缩进以符合现有风格；立即类型/构建，并与原生验收前保存的70文件哈希逐项比较，不以格式改动额外扩大测试范围。
- 首个格式脚本因CRLF边界未匹配在写入前断言退出；第二个脚本只完成KeyBrowser后因未声明变量停在ConnectionForm前，没有继续修补该脚本。改用直接文件补丁完成剩余六行缩进，相关功能未改变。各次严格类型/构建均通过且70产物仍与实际原生安装一致；最终再次核对，不重跑无变化的225用例。

## 2026-10-16 任务21：统一浏览器结果校验

- 完整核对固定rc.2 protocol/gateway及官方generator和测试：strict结果的create供Host使用，Client unary invoke仅调用可选decode；parse异常进入gateway/internal，取消仍进入gateway/cancelled。src/typert.shared.ts在唯一createRedisInvocation结果codec补decode并复用原schema，使全部23项RPC在UI状态/缓存之前校验，不新增代理层或23套包装。
- client/BloomView.tsx、TimeSeriesView.tsx、BrowsingSession.tsx删除重复的远端结果parse；本地表单/偏好patch仍保留原输入校验。改动影响结果接收边界，不改变Host命令/DTO、只读策略或取消语义。随后立即三层类型检查，再补真实编译bundle及原生安装响应故障验证；21仍in-progress，不将此前包的验收当作当前通过。
- 首批及编译bundle测试调整后三层严格类型均通过。tests/client-bundle.test.ts直接检查真实lib/client.js注册的23个strict decode均拒绝null/额外字段，并验证正确/错误只读状态；tests/host-typert.test.ts补连接测试结果成功/错误互斥与秘密字段拒绝，补上此前独立result schema覆盖缺项。后续真实浏览器测试独立于此mock，不把单测冒称原生wire验证。
- scripts/smoke-release-boundary.mjs增加只在RELEASE验收启用的启动观测：原样调用真实module loader/factory/apply，仅捕获插件实际React/Context与create返回的module system，验证引用同一性及React.version；不创建另一实例。真实SDK的23项方法经HTTP server-response故障注入验证decode/错误分支，route短路不触达Host，结束恢复观测。smoke-dsh.mjs增加开关和完整安装文件集合核对；smoke-session-state.mjs按20实际窄栏返回列表，profile折叠时检查attached，未放宽会话/无网络/值身份断言。先语法、类型和完整prepack，再安装运行，尚无原生通过声明。
- 新包0a23cbfb11f9cedbed2e2fa086eeebb33da9a522c92048fda52040e53a99a2ae完整prepack严格三层类型/构建/226回归通过，隔离安装后无Redis原生7组通过：实际React18.3.1且同一对象，真实SDK全部23项拒绝畸形成功payload并能恢复，额外秘密字段/矛盾连接测试也拒绝；browser三类错误均空，自建DSH退出。先归档boundary原件，完整类型/会话/TLS门禁尚待执行。
- README补随包可用的安装、侧栏/12类查看、分页和特殊类型手动解释、会话恢复/密码不落盘、取消/超时/断线操作及验收入口；易过期进度改为链接本地任务索引，避免每次文档状态更新改变已验证包。此后重新打包安装再跑完整门禁，不以0a包替代最终包。
- 最终包bb2b83e51c1a83abc18c9f638484bded2e53451931ffa2d534f5c06d9584a1ea再次完整prepack严格类型/构建/226回归通过，隔离安装原生全12类+双会话+真实decoder/React共87组通过；TLS保存/冷重启两轮各17组通过，均自建进程/夹具清理true。剩余同包19/20专项执行中，21暂不勾选。
- 临时资源清单核对先遇直接global peer路径不存在；沿真实CLI的createRequire解析后12个Host版本匹配，又发现原manifest与tarball存在pnpm移除packageManager/scripts.prepack的实际差异；改读tarball后临时REPL的structuredClone对象跨realm导致strict compare失败。停止补临时脚本，新增独立scripts/verify-release-package.mjs，用普通Node+只读Python标准tarfile验证实际包/安装全部文件、70个lib集合/字节、版本/锁文件/源码输入SHA；只记录已观测的pack字段裁剪，不更改产品或依赖以迎合核对。先语法检查再执行，后续结果另记。

## 2026-10-16 任务21完成：P0独立安装包门禁

- 独立Node资源核对成功：最终bb2b83e包79个文件逐字节匹配安装目录，lib完整70集合/字节一致，沿真实CLI解析12个Host peer版本正确，实际生产redis6.2.1/zod4.4.3与锁定相符；source/tests/scripts/lock及包清单SHA记入release-manifest。pnpm pack只移除两个已观测开发字段，tarball manifest与安装完全一致；未为消除peer提示复制另一个runtime。
- 同一最终包的12类+双会话+真实decoder/React原生87组、TLS资料保存/冷启动各17组、布局22组、恢复18组全部通过。最后两轮返回位置345px相同，取消约33ms、实际10秒截止10077ms；原生SDK23项畸形结果拒绝与正常恢复再次通过。page/console errors均空，原生会话1条及取消2条预期ERR_ABORTED原样记录。
- 新增docs/verification/21-release-verification.md：完整P0证据矩阵、固定DSH/参考提交与日期/复制裁剪/许可、真实React引用同一性、当前包身份/安装闭包、只读与数据预算、操作复现及明确未覆盖环境。docs/verification/artifacts/21-release保留五轮当前包原始报告/日志/截图、早期0a边界专项和实际资源清单；各归档与原件核对哈希，宽明亮/窄深色数据截图已查看。未声称其他Redis/宿主版本或TLS慢链路恢复已实测。
- 21五项勾选done；22依据原票/已有KeyBrowser和字节身份/缓存事实进入in-progress，五项仍空。六份当前进度文档与方案6.6同步；随包README使用稳定操作说明并指向任务索引，避免完成状态更改包身份。P0验收完成、29票仍有8张P1，原图/编号/优先级和不可变参考SHA保持。此为单一21小目标，核对后本地提交，不push/改写历史/跳hooks。
- 本轮所有自建DSH/Chrome/Redis、TLS证书/UUID目录均退出或回收，Host socket回管理员基线，恢复代理停止。未碰用户服务、业务库、日常profile/C盘；旧16快照及18两对清理被自动审批拒绝的目录继续保留，未绕过策略。随后只做归档/图/源码输入清单/链接/git diff核对，不重复无变化的类型/全量验收。
- 提交前29票/P0=21/P1=8、全部原Blocked by图与不可变参考SHA核对不变，21 done/22 in-progress/其余7 ready正确；源码/测试/脚本输入哈希仍与已归档清单逐项相同，当前包五轮原件/副本一致，验收相对链接全部存在，git diff --check通过。暂存区初始为空，本次只提交上述21小目标及必要进度文件。
- 首次提交命令因cmd参数引号被拆开，Git在创建提交前拒绝pathspec；暂存内容保留。改用execFile结构化参数传完整提交信息，不跳过hooks、不改写历史。

## 2026-10-16 按用户反馈重做数据库工作台界面

- 用户明确当前文字堆叠不符合预期，应参考DSH Database和RESP的操作/左右分栏；覆盖20先前窄栏往返方案。已完整核对实际参考截图（Database连接/DB、Key、详情三块）、当前前端与固定rc.2侧栏公开API。公开插件API无设置宿主宽度/最大化字段，不用CSS或内部服务篡改宿主；仅改插件自身响应式布局。
- 可交互样例在独立prototype/database-redis-workbench分支955b860de5d6d57929d38b83aaee68d79dc03f81本地提交，主分支未合入原型；ignored .scratch/artifacts/redis-workbench.prototype.html保留可双击副本。A为Database三栏，B为RESP合并树两栏，可选偏好已发出，当前按更接近用户指定Database的A继续，不称用户已确认。此前离线示例检查pageerror/HTTP请求为空且自建浏览器退出；内置浏览器file://打开被URL安全策略拒绝，仅允许http/https，未用其他浏览器/本地服务/CDP绕过，改提供文件与图片。
- 第一批生产调整：ProfileChooser仍唯一持有资料列表/选择与保存删除逻辑，新增左侧资料导航和原生dialog，原连接表单作为children共用同一状态，不重复加载/保存配置；ConnectionForm保留原手动连接、代次、AbortController与密码清空，状态/断开/刷新压入工具栏，详情布局预留三栏。新增Icon/HelpDetails本地共享组件，不加依赖；KeyBrowser只增加DB输入ref供导航聚焦；locales补双语工具文案。修改后立即三层严格类型通过。
- 20按新视觉/交互标准重开，21当前包门禁待新界面复验；旧P0证据保留各自包与范围，不能当作用户视觉认可。22准备事实保留，先回ready-for-agent，原29票编号/优先级/Blocked by不变。后续完成各类型说明收起、数据/元信息/格式工具栏和真实布局检查，尚未宣称新版UI完成。
- 第二批共享界面/各类型改造后三层严格类型通过：KeyBrowser移除被新要求替代的窄栏往返状态/Back按钮，所有宽度保留Key与右详情并列；新增Data/Metadata页签，切换仅改变显示不卸载读取器，完整Base64身份放元信息。BytePreview沿用原无损formatter/格式会话状态，常用四格式改按钮、显式Base64解码选择和用户点击复制已读内容；复制错误/迟到完成有界处理，不新增Redis请求。
- 12类查看器的hint/budget/live说明迁入共享HelpDetails，读取错误/范围/部分结果不收起。styles.ts替换旧单页CSS为Database三栏：连接导航164px、Key导航210px、右侧数据；760px以下压缩连接导航为配置入口，480px以下Key栏128px，仍左右；数据/元信息各自有界滚动，类型/TTL紧凑显示、完整元信息在页签，格式/表格/状态栏复用主题token。全程Host/DTO/只读命令/预算未改，未添加依赖；随后再查类型/226回归和当前实际原生界面。
- styles/全部12类型说明收起和未保存连接DB导航补齐后，完整pnpm check三层严格类型/构建/226回归通过，git diff --check通过。README按新连接弹窗、左右导航、格式与元信息操作更新，20/21历史验收文档显式加重开边界，不篡改原始包报告。当前UI结构实现作为一个可审阅小目标本地提交，原生安装与视觉验收尚未完成；接着适配实际新控件的验收步骤，不保留旧隐藏select/Back等兼容实现来迎合旧测试。

- 新工作台验收迁移首批：新增scripts/native-view-controls.mjs集中操作真实设置dialog、四格式按钮/显式解码与Metadata原字节身份；smoke-dsh/session-state/native-recovery改走这些可见入口，移除旧Back与valueFormat选择器，不添加产品兼容控件。已连接会话切换不弹设置，断开才显式打开，不放宽原无Redis自动命令、值/格式/窗口、源字节与恢复断言。新版报告另用native-ui-release/native-ui-profiles/native-ui-recovery/native-workbench前缀，保留旧包原报告。布局验收继续按本次左右分栏标准改写，尚未原生运行。

- 新布局专项改为真实DSH Database/RESP验收：340px仍左右显示Key/数据且键盘焦点/列表位置不变，Data/Metadata/格式/帮助/同Key点击不重读，设置dialog按需打开且已连接字段锁定/密码为空；900px显示连接/DB、Key、数据三块。继续12类、300/340/900真实手柄、明暗、长Key/时间戳/局部表格滚动、加载/错误/空态和源DUMP/过期不变。截图新前缀native-workbench，不将旧往返界面检查冒充本次标准。首次rg引号被cmd拆分未得完整检索，改结构化Node子进程检查；产品未改。
- 首次验收脚本语法核对调用在REPL的process全局不可用处停止，前述文件已落盘，未运行服务；改用PATH中的Node结构化参数后五个mjs均通过语法检查。

- 新包77ea3a0完整prepack三层类型/构建/226回归通过并仅隔离安装。首轮原生11组含关闭后基线通过，布局在选Key后先点击Text格式、再断言焦点仍在Key的测试顺序错误处失败；实际截图已查看，Key/数据持续并列。原失败JSON/console/截图保留workbench-first-*，page/console/request错误为空，进程/夹具清理true。将焦点断言移到键盘选中后、格式点击前，新增脱敏有界errorStack诊断；未为验收改产品。

- 第二轮同包真实布局14组含关闭后基线通过；340px长Key加载中新增Cancel使form内flex:0 0 auto按钮组无法缩小，工具栏越界断言失败。原报告/console/截图保留workbench-loading-*，自建进程/夹具清理true且浏览器错误为空。完整复核KeyDetails与共享CSS后最小修正actions允许收缩、max-width:100%和内部换行；String两种特殊解释按钮共用redis-actions，不再各占整行。专项失败时也记录几何/越界按钮，不把恢复后的截图当作加载现场。仅改客户端布局，不改Host/DTO/预算，立即严格类型检查。
- 布局专项同时直接截取真实插件pane和完整DSH窗口，避免完整聊天窗口使侧栏缩小难以审阅；这是实际HTTP应用截图，不裁剪/代替原型file://受限打开，也不修改像素。新产品修正后三层严格类型通过，完整prepack进行中。

- 修正包47057faa完整226项/prepack通过并隔离安装，真实布局15组含关闭后基线通过，覆盖至TimeSeries且所有已跑几何无越界；随后旧“边界必须上下排列”断言与当前196px详情可容纳两95px等宽输入的实际截图不符而失败。保留workbench-boundaries-*。检查改为等宽且至少90px、随可用宽度换行并记录坐标，不为旧预期改生产；所有资源正常回收。LUNA只读定位发现GEO/HLL提示现在在HelpDetails、TS.INFO在Metadata；完整类型脚本改从用户可见帮助/元信息入口验证原文案/数值，不读隐藏文案或删除原断言。
- 本次独立包核查继续逐字节比较实际tarball/安装全部79项及lib完整70集合、Host实际peer与源输入SHA；报告写入workbench-release-manifest.json，并指向本次native-ui-release实际浏览器React证据，避免覆盖或误链接旧UI发布记录。只调整验收报告位置，不改产品包。

- 47057faa新布局专项23组全通过，真实900px三块/300px深色数据pane截图均已查看，12种源值/绝对过期不变且进程/夹具清理true。人工复核仍见完成态重复“数据变化请刷新”等静态句子占窄栏多行，按用户减少文字要求进一步压缩中英keys/Stream/TimeSeries idle/more/complete为短状态；错误、缓存超限、部分读取范围及HLL/Bloom语义保留可见，详细刷新/空页说明仍在帮助。脚本相应核对短完成态，读取断言不减。此更改影响随包locale，须新包重验，不将47057faa已通过当作最终包。
- 中英Key帮助同步补空页/手动刷新说明，常态主栏仅显示短状态；47057faa的23组通过报告/console另存workbench-47057faa-*，后续新包报告不覆盖其包身份。
- 最终紧凑文案包509aa7b0严格三层类型/构建/226回归通过，仅安装本项目隔离web profile。会话验收的自建Sessions配置增加到既有finally按当前owner限定的清理集合，正常或失败退出后都只回收本轮测试资料；不清理先前UUID目录/历史配置、不碰用户日常资料。当前最终包布局复验运行中。

## 2026-10-16 Database/RESP工作台新版20完成

- 最终包509aa7b06132ab0fa3123bafca18f75f43df10ac019c00cfbffdcfc950373e43严格三层类型/构建/226回归及真实布局23组全通过；实际900px三块、340/300px始终Key/数据左右，21个几何采样无横向越界、所有帮助默认收起，位置2484px与焦点/无重读、设置dialog、12类、明暗、局部数字表格/时间戳、加载/错误/空态和12源DUMP/绝对过期不变已验。真实pane和完整窗口截图均已查看，所有本轮资源正常退出/回收。
- 新增docs/verification/20-database-workbench.md及原始成功/失败/阶段报告、console与真实截图；归档逐项核对源件SHA。旧往返UI报告保留为历史，本次没有声称新的可选A/B已获用户确认，也未用原型代替真实安装应用。20按新版标准四项勾选done，六个进度入口同步01–20 done/21 in-progress/22–29 ready，原29票图和参考SHA不变。
- 真实12类/双会话/实际decoder与React的21新包复验仍执行中，不以布局通过冒称全部发布验收；当前Verified UI小目标按用户约定本地提交，无push。

- 21最终包全类型运行在12种查看及真实decoder/React已通过后，会话脚本openSession(B)预先打开modal，caller又按旧顺序读取后台状态，导致未处理waitForRequest超时进程退出、未写最终报告。原console和native-ui-release-interrupted.json明确false保留，不能当整轮通过。只读CIM确认本轮DSH/专属Chrome已不存在，精确UUID97c1b089的Linux PID269也已不存在；核对绝对realpath和非符号链接后只回收该UUID目录及同owner Sessions资料，先前拒绝清理的目录未动。
- 会话验收顺序改为仅在实际操作连接字段时打开modal，状态判断时保持工作台可见；activeOwner用Promise.all绑定事件与点击，防等待异常逃过finally。产品无需补丁，包509aa7b0不变。按固定rc.2 LanguageRow/官方e2e真实代码增加Settings→General→English/中文菜单切换和中文三栏截图，验证本地化数据/元信息页签及切换不重读，再恢复English；不注入语言store或改日常profile。随后以同包分项复验。

- 20同包509aa7b0补原生中文菜单验收后24组全部通过，22个几何样本有界；中文三块JSON、数据/元信息页签和大整数原文保留且切换无Redis重读，随后恢复English。中文真实pane/完整DSH截图已查看并按源SHA归档，之前同包英文23组JSON/console另存。20文档/票和六个当前摘要更新为24组，21完整功能复验在修正顺序后重新执行，尚未宣称整轮通过。

- 21第二轮完整报告明确83组后false，12类型/SDK边界及A/B状态隔离、迟到响应、独立读取均已通过；最后断开A重连时漏显式打开设置，password.fill不可见而超时。本轮finally完整退出/回收true，原报告/console/截图保留native-ui-session-modal-*。停止重复全类型追跑，逐行重新审视全部185行会话脚本：B字段编辑从既有一次打开入口开始，A重连必须明确再打开。此前批处理String.replace只改首个匹配导致漏项；改为精确文件补丁，删B冗余调用并补A，不新增抽象或修改产品。下一步只用小夹具验证完整会话流程，再复跑最终全门禁。

- 最终包会话小夹具21组全部通过，包括A/B切换无自动Redis、独立DB/二进制Key/格式/窗口、旧响应隔离、伪造归属拒绝、A断线手动DB恢复和B不受影响；本轮进程/夹具/资料正常回收，浏览器错误范围随后随21原件归档。独立包核查79项/70lib/12Host peer/2生产依赖全部一致，包仍509aa7b0。原29票/P0=21/P1=8/全部依赖和参考研究SHA核对不变，git diff --check通过。

- 小夹具21组通过后的最终组合复验83组处，noRedisRestore(A)命令计数发现PTTL/STRLEN各+1而失败，整轮false保留native-ui-session-counter-*，finally清理true。重新核对末次B显式refresh：旧coverage节点仍可见，click后waitFor可能在新请求清空旧内容前立即通过；该读取的后检与下一计数基线重叠。改为绑定B可信owner的真实readString HTTP响应、校验原值OQ==并等待该响应sampledAt实际渲染后才采样。没有加固定sleep、忽略计数或改产品自动读取行为，保持切换无命令断言不变。原生其他门禁尚未执行，不称最终发布通过。

- 真实响应边界修正后同包509aa7b0全12类+双会话+实际SDK decoder/React完整87组通过；noRedisRestore计数保持不变、A手动重连/DB恢复与B独立再次通过。所有本轮进程/夹具/资料正常回收。原83组false/中断记录继续保留，未改写；仅此一处验收等待边界发生变化，产品包与已通过24组中英布局保持不变。接续TLS冷重启/原生恢复两项，21仍in-progress。
- 同一509aa7b0包TLS连接/资料保存、错误CA、普通与TLS增改删及冷启动恢复两阶段各13组通过（本次未启KEYS，不能写成旧门禁的17组；记录时误写计数已立即按真实报告纠正）。密码不落盘/无自动连接及资料回收通过，page/console/request错误均空，两个Host退出和TLS/Redis资源清理true。当前原生恢复专项运行，随后补同包TLS+KEYS两阶段，保留这两份13组记录。
- 同包原生恢复18组全通过；真实active/queued取消到Host、10秒硬截止、TCP EOF及另一可信B独立、密码重输/手动新generation和显式已选Key读取再次验证。源原字节/绝对过期不变、代理与全部自建进程/夹具清理true。最后补TLS+KEYS双阶段，并以更新后的验收脚本重新记录源输入SHA；产品包始终509aa7b0。

## 2026-10-16 新工作台21完整复验完成

- 最终同一包509aa7b06132ab0fa3123bafca18f75f43df10ac019c00cfbffdcfc950373e43全部门禁通过：严格三层类型/构建/226回归；真实12类+双会话+SDK23项decode与实际React同一性87组；TLS含DB/Key保存/冷启动17/17组；中英/明暗/真实左右工作台24组；取消恢复18组，取消29ms、实际生产截止10141ms。page/console错误均空，预期1条会话与2条取消ERR_ABORTED保留。初轮TLS未开KEYS为13/13，已保留阶段报告而非伪称17。
- 新增docs/verification/21-workbench-release.md与35份原始机器报告/日志/console/截图/资源清单，逐一匹配源件SHA；79包文件/70lib/12Host peer/2生产依赖/134源输入核对一致，固定宿主tag及两参考HEAD/日期重新只读核实。中文pane、窄深色数据、B会话及恢复fresh截图已查看。失败/中断与小夹具/13组阶段记录原样保留，不混算当前门禁。
- 最终全部本轮自建DSH/Chrome、Redis/TLS/UUID目录和代理退出/回收；中断97c1b089按精确进程/路径核实后另行回收，未假造finally成功。此前16/18清理审批拒绝目录保持，没有重试；用户业务库/日常profile/已有服务/C盘清理未动。
- 21五项勾选done，六个当前摘要同步01–21 done/22–29 ready；方案6.8补本次新包，旧21文档横幅指向新版，原29票图/优先级及不可变参考SHA保留。剩余8张P1未完成，当前目标不标完成。最后仅提交已验证的验收时序修正/文档/原件，不改产品包、不push或改写历史。
- 提交前最终核对：29票/P0=21/P1=8、01–21 done/22–29 ready、全部原Blocked by图与参考研究SHA不变；六处当前摘要一致，61个验收相对链接存在，134个归档源输入哈希与当前源码逐项相同，git diff --check通过。暂存区起初为空，只收本次21验收修正/原件及必要文档，不含lib/依赖/运行资源或P1代码。

## 2026-10-16 第22项命名空间与大列表开始

- 修改本票状态及六个当前进度入口：01–21 done、22 in-progress、23–29 ready；原29票编号、P0/P1及Blocked by不变。
- 先完整核对KeyBrowser、key-cache、显示字节工具、样式、双语及本票验收；LUNA仅只读描述Database树/原生脚本/夹具事实，最终方案由主模型确定。按最简和单一职责原则，新建本地字节分组模型与共享Key目录组件，Host/RPC、游标、缓存及读取预算保持已有语义。
- 树/列表/分隔符/展开/定位只作用于已加载Key，不访问Redis；原始完整Base64继续作为唯一Key身份，目录计数只代表当前已加载去重Key。深度设限后余下字节保留在叶名称，禁止丢身份；虚拟渲染不冒充驱动接收内存有界，需单独验证新包。

- 第一批实现：新增src/client/key-namespaces.ts，将分隔符按完整UTF-8字节匹配，叶/目录身份区分且保留空Key、空段、非法UTF-8及BOM；增量追加只解析新尾部，刷新/筛选替换清索引，最多16层，余下字节仍为叶内容。新增tests/key-namespaces.test.ts六项覆盖碰撞、重复、换筛选、Unicode/二进制、64KiB深路径、5000上限与虚拟窗口；立即三层严格类型及六项专项全通过。
- 第二批界面：新增KeyCatalog.tsx唯一管理本地树/列表、分隔符、展开和虚拟行；KeyBrowser仅委托目录与原选择回调，不移动读/游标状态。键盘在目录上以方向键/Enter导航，保留至多一个离屏活动行以维持ARIA目标；显式定位只展开已加载祖先并滚动，不触发读取。Icon/styles/locales增加紧凑工具栏、按需设置帮助和固定30px行，组计数在窄栏仍可见；未加依赖或Host接口。接着立即编译并验证真实UI与增量位置。

- 虚拟行验收迁移：scripts/native-view-controls.mjs增加真实滚动定位raw identity与原生侧栏手柄共用helper；smoke-dsh/session-state/native-recovery改选实际可见行，通用单Key回归显式切平铺。smoke-sidebar-layout保留原12类/几何/无重读/源值断言，只将旧button焦点改为目录ARIA活动行语义，并复用实际手柄；不通过保留隐藏全量DOM兼容旧脚本。新模型六项专项和三层严格类型已通过，实际安装验收尚未开始。

- 完整pnpm check已通过：三层严格类型、构建和232回归（新增6项命名空间测试）。新增scripts/smoke-key-namespaces.mjs，以现有随机owner/独立Redis及有界真实RESP代理种5105条、512条4KiB名称及二进制/空段夹具，准备验证部分计数、增量锚点、两种缓存上限、可见行数量、分隔符/筛选/定位无命令、原生900/340布局、删除/变型/旧代次、ACL和真实SCAN取消/10秒截止。smoke-dsh增加明确NAMESPACES入口/独立报告前缀并复用原finally归属清理；尚未运行，不能记作通过。

- 自查发现展开Set原可跨多次MATCH/刷新保留旧目录身份，可能长期累积。按有界状态/单一职责原则，key-namespaces索引增加只读本地revision，只有缓存替换/清空时变化；KeyCatalog在该revision或分隔符索引变化时清展开和活动行，增量追加保持。专项增加revision不随追加变化/替换须变化断言，立即三层严格类型通过。当前候选e7db52a6原生运行的阶段结果不作为这次重置后的最终包通过。

- 候选e7db52a6原生首轮14组后失败：5000条缓存/23个挂载行、无命令定位/增量锚点已通过，随后900px手柄超时；实际截图及browser/context代码证明NAMESPACES沿用1440px默认视口，受DSH主区宽度约束。原件另存namespaces-e7db52a6-first-*，浏览器三类错误为空、DSH/代理/Redis/目录清理true。仅将该布局验收入口视口与既有LAYOUT一致设1920px，不修改宿主或放宽900px断言；noPresentationRedis最终成功前标false。
- README按真实导航补树/平铺/分隔符、已加载计数、虚拟行、16层余下名称和显式定位，说明本地状态与手动读取边界；原29票及读取预算不变。将本地revision修正纳入新包，旧候选阶段结果不计作最终验收。

- 最终候选563388a2e6803e188328defc0414a14fa0b728623c5681191678735dc21519fb重新prepack严格类型/构建/232回归通过。首次安装命令误填不存在的哈希文件名，-4058停止，未启动服务；已使用刚核实的563388a2真实SHA路径更正并隔离安装成功。验收脚本按真实ListReadResult.page与对应原字节核对外部变型，不误期待String错误态；有界代理持有回复列入本脚本finally释放。

- 最终候选563388a2首轮真实命名空间25组全通过：5105条在5000截断、仅挂25行（562px视口）、58页扫描；512个4KiB名称在368条/43页触及2MiB DTO缓存；340px导航128/详情211、零横溢出，实际截止10108ms。空/二进制/重复段与碰撞、换分隔符/无效草稿/筛选无命令、增量锚点/定位、外部删改变型、旧代次、ACL、真实SCAN取消/无重放全部通过；代理只观察固定只读命令，源DUMP/绝对过期不变。page/console错误为空，1条预期取消ERR_ABORTED，DSH/代理/Redis/目录清理true。
- 两张真实pane截图已查看；截图停在定位后的深层叶，补一段纯显示Home将树顶5000组计数留图，不改产品/读取断言；原25组与截图另存namespaces-563388a2-located-*。随后同包执行全12类型/双会话/实际SDK与React，再执行原工作台布局和补图专项，最后更新票与提交。

- 新增docs/verification/22-key-namespaces.md，逐步说明字节ID、16层、增量revision/清状态、虚拟窗口上界/ARIA焦点/锚点、显式定位、网络与DTO/堆边界、实际25组结果和未覆盖范围；完整类型/双会话/布局仍标待复验，不提前勾票。LUNA核对六文档还存在旧当前段和22表格ready，已同步成22 in-progress；历史6.8/旧包/阶段结果原样保留。核实原29票无缺重号、21P0done/8P1（22in-progress）和所有依赖、三参考HEAD仍固定。

- 同一563388a2包原12类+双会话+实际SDK/React完整87组全部通过；新增虚拟列表按真实可见入口操作，未放宽原0自动Redis/目标代次/格式/数据范围/源字节/权限/消失/类型改变等断言。page/console错误为空，1条预期会话取消ERR_ABORTED保留；所有本轮DSH/Chrome/Redis/目录及专属会话配置正常回收。现执行原工作台24组中英/明暗/手柄/加载/全部类型布局，再补树顶原生截图，不变产品包。

- 同包工作台首轮11组后键盘断言失败，false原件保留namespaces-563388a2-keyboard-*；browser三类错误为空、进程/Redis/目录清理true。完整重审KeyCatalog.navigate和布局步骤：脚本残留对旧行button强制focus，Enter被目录按其活动索引0处理，并没有按预期导航至178。最小修正只在脚本通过目录Home、真实ArrowDown到实际row-index、Enter激活，再采样滚动基线；不改产品，不接受错误Key或削弱焦点/值/无重读断言。

- 键盘步骤经重审后，同一563388a2包工作台24组全部通过，22个几何样本有界：真实Home/方向键/Enter与目录ARIA活动行、列表位置、无重读、12类型、300/340/900、Dark/Light和实际中英菜单切换、加载/错误/空态及源DUMP/绝对过期均通过。browser三类错误为空，DSH/Chrome/Redis/目录清理true。随后仅同包补树顶截图/计数检查，不改产品，再核实包源输入/清单和完成本地提交。

## 2026-10-16 第22项完成

- 最终同一563388a2e6803e188328defc0414a14fa0b728623c5681191678735dc21519fb包严格类型/构建/232回归；命名空间含树顶补图25组、全12类/双会话/实际SDK与React87组、原工作台中英/明暗24组全部通过。最终5000条仅25挂载（562px），58页；512个4KiB名称在368条/41页触2MiB，实际SCAN总截止10109ms。真实900/340树顶及中文工作台截图均已查看，Key/数据左右且分组计数明确。
- 全部本轮DSH/Chrome、Redis/UUID目录、专属会话配置与代理正常退出/回收；page/console均空，命名空间和会话各1条预期取消ERR_ABORTED，布局request错误空。42原始文件+1归档清单写入docs/verification/artifacts/22-key-namespaces并逐项SHA核对；初次REPL收据变量未持久化停止后重读完成，未改变原件。旧e7视口false、563键盘false及定位阶段25组保留独立名称。
- 实际79包文件/70lib完整集合和字节、12Host peer、2生产依赖、138源输入与当前代码逐项一致；三参考HEAD仍固定、不可变研究SHA e138f420…未变。TLS冷启动与完整19恢复本轮未重复，不能冒称该新包17/17或全部19通过；本票SCAN取消/10秒/代次和读取边界均有实际新包证据。
- docs/verification/22-key-namespaces.md补完整实现/结果/复现/边界/原件，方案6.9新增入口。22五项勾done，六处当前摘要及22表格同步01–22 done/23–29 ready，原29票/21P0+8P1/依赖不变。此验证小目标按用户要求本地Git提交，不push；仍有七张P1，目标不标完整项目完成。

- 提交前最终审计：29票无缺重号、21P0/8P1、01–22 done/23–29 ready及全部原依赖图完全一致；六当前摘要一致。138源输入SHA/42归档原件SHA逐项匹配，19个实现说明相对链接存在；main分支、暂存区起初为空、git diff --check通过。审计初次解析受原票CRLF空行影响，已改为直接读取Blocked by物理行核实，未改原票行尾或依赖。仅收本票生产/验收/文档与原件，不含lib、依赖、运行资源或23代码。

## 2026-10-16 第23项开始

- 第22项本地提交2548f67后工作区干净；当前23 in-progress、24–29 ready，原图/优先级不变。LUNA只读完整描述共享BytePreview、lossless formatter、各状态归属/预算/测试和固定rc.2公开侧栏API；根模型据实际代码决定，仅做显式原位聚焦，不调用内部宽度/全屏接口。
- 按prototype的LOGIC规范，在独立prototype/redis-focus-state分支b024bbe保存单文件纯内存状态预览，含聚焦往返/搜索范围/折叠复制、宽度和明暗；主分支不含HTML壳，ignored副本可双击。发出可选偏好但未称用户已确认，不绕过之前file://策略打开。主分支六摘要/23票与表格改开始，验收仍未勾。
- 生产实现先新增纯已读内容模型：字面搜索不接受正则、命中范围和结构控件有界；JSON只按已验证formatter的字符串/括号原位置建立折叠索引，不JSON.stringify数值；复制继续取完整formatter文本，不能复制折叠省略号或把窗口搜索当完整Redis检索。遵循单一职责/最简和严格类型，不改Host/RPC/Redis预算。

- 第一批内容模型落盘：value-preview.ts将现有512Ki字符常量命名导出为MAX_PREVIEW_CHARACTERS，数值/原formatter行为未改；loaded-content.ts新增区分大小写的字面非重叠搜索（最多保留1000命中、总数仍完整计数、查询256字符且Unicode有效），以及已验证JSON输出的括号/引号结构索引（64深度、512多行控件）与源范围投影；无读取/无JSON重序列化。
- 新增loaded-content.test.ts六项覆盖字面元字符、Unicode/空/无命中/无效查询/上限、转义括号、重复字段/大整数/指数/-0、父折叠隐藏子节点/展开精确恢复及大量块上限。立即三层严格类型通过；首轮19项中18通过，一项测试把emoji后UTF-16偏移误手算成17，逐字符核实应16（末尾20），仅改测试期望，接着完整check。尚未接UI或声称本票完成。

- 23纯模型完整pnpm check三层严格类型/构建/238回归全部通过；新增docs/verification/23-focused-value-view.md，记录原型分支/未确认偏好、算法及有界语义、6项专项和未接UI/未原生范围，完整输出归档artifacts/23-focused-value-view/model-check-console.log。23票追加阶段证据仍in-progress且不勾验收；按用户小目标约定仅本地提交模型与进度/必要文档，尚不发布新包或声称第23项完成。暂未收到不同偏好，后续按可选预览的原位方式继续。

- 模型提交前git diff --cached --check仅指出原始pnpm输出末尾自带空白行（model-check-console.log:124）。为保留机器原件未裁剪该日志：其他全部文件正常whitespace检查通过；仅对这个日志路径单次允许blank-at-eof、仍检查其他空白问题，不改仓库配置、不跳过hooks/测试。随后本地提交此模型小目标。

- 23界面首批：BytePreview复用纯模型，新增按需查找/局部Ctrl(Cmd)+F、F3/Enter与Esc、前1000范围高亮/完整总数限额提示、前512 JSON块SVG按钮/全折叠展开；原文本片段按源offset渲染，复制始终完整preview.text，按异步序号防迟到回写。搜索命中只滚动pre自身，不用scrollIntoView移动DSH祖先；不增加Redis请求。
- KeyBrowser仅新增本地focused和列表位置ref；显式按钮临时隐藏目录而不卸载详情/读取器，退出恢复scrollTop和目录焦点，Esc在查找未处理时才退出。Icon/locales/styles补紧凑图标、双语、预览容器/高亮和显示状态，默认左右不变，不调用宿主私有宽度或全屏。接着立即三层类型检查；原生和包验证尚未进行，不勾23票。

- UI接入后二次完整check三层类型/构建/238回归通过。新增smoke-focused-value.mjs独占原生专项与FOCUSED入口/1920视口/真实只读代理，准备核对同DOM聚焦/列表返回、局部快捷键、已读范围/1000高亮、512折叠、原数值token和Hash单元格、源DUMP/expiry及零额外命令。复制使用明确受控Clipboard API替身记录完整writeText参数/拒绝/迟到，不访问用户剪贴板，也不把此结果声称为OS权限验收；结束恢复该页面原描述符。尚未运行、未标本票done。

- 生产原位聚焦补齐现有compact连接入口的复用：styles.ts将既有窄栏入口样式移至共同规则，聚焦时只在插件.redis-connection内按:has状态切同一compact网格并隐藏连接/Key导航，保留设置/状态与返回；默认宽窄规则不变，不复制连接控制器或调用宿主接口。README补当前已读搜索/快捷键/折叠预算和复制语义，需随新包验证。新原生脚本核对真实HashView后选择data-hash-value而非字段名，JSON种子改为直接可验证字面串而无替换修补；尚未运行。立即严格类型后打新候选，先前预打包不作为此版本验收。

- 聚焦候选f6052a121f4cc68cfb0a3942819e0d7eb03ed04952013f5a825cc0517ea18d73严格prepack三层类型/构建/238回归通过并仅隔离web profile安装，未替换日常DSH。当前FOCUSED+RECOVERY合并实测：先新显示控件/Hash共享，再既有真实active/queued取消、10秒/EOF和独立B恢复；新增种子只在独占管理员socket执行且累计更新本轮expectedKeyCount。尚未记通过，23仍in-progress。

- f6052a12首轮原生12组后复制断言失败，false原件保留focus-f6052a12-textread-*；所有本轮进程/代理/Redis/目录清理true，browser三类错误为空。聚焦往返、原Key/列表位置/搜索状态及无命令已通过。真实diff显示copy实际传formatter完整原文，而测试以pre.innerText取源，被内嵌SVG折叠按钮的布局换行影响（nested后多换行）。仅把正文原字符核对改textContent，仍在折叠后对比完整未折叠源并验拒绝/迟到，未改产品/包、未裁剪内容或放宽数值断言；同包重新实测。

- 同一f6052a12包修正正文取值方式后聚焦+完整原生恢复25组全部通过：虚拟列表位置/二进制Key/格式与搜索保留、局部Ctrl+F/Enter/Shift/Esc、逐块/整体折叠、完整writeText参数/拒绝/迟到隔离、未读尾词不命中、1000高亮/完整总数、1200对象512控件/原文末项与Hash值复用及源DUMP/expiry保持。真实active/queued取消、10秒/EOF、手动新代次/无重放和可信B独立均通过。浏览器page/console为空；2条预期取消ERR_ABORTED保留；DSH/Chrome/代理/Redis/目录正常回收，聚焦截图已查看。继续同包原12类型/会话与实际SDK/React、工作台中英明暗回归，23仍in-progress。

- docs/verification/23-focused-value-view.md同步实际UI职责/同DOM聚焦/快捷键与搜索范围（只BytePreview文字、不假装统计/整集合搜索）、f605同包25组/45ms取消/10151ms截止/1122列表位置及真实宽窄几何，明确受控Clipboard API范围与innerText阶段false，不提前标done。全12类型/双会话/SDK回归正在执行。

- 同一f6052a12候选原12类型/双会话/实际SDK decoder和React完整87组全部通过，原严格协议/权限/消失变型/只读/预算/格式/归属与恢复状态断言均保留。page/console错误为空，1条预期会话取消ERR_ABORTED；所有本轮DSH/Chrome/Redis/目录/专属会话配置正常回收。现执行原工作台24组，然后第22项大列表回归，不借用旧包结果，23仍in-progress。

## 2026-10-16 任务23完成：原位聚焦、已读搜索与JSON折叠

- 同一f6052a121f4cc68cfb0a3942819e0d7eb03ed04952013f5a825cc0517ea18d73包工作台24组/22几何样本及命名空间25组完成，连同聚焦+恢复25组、全12类/双会话/实际SDK与React87组和严格类型/构建/238回归全部通过。各套共享基础检查，不相加冒称独立场景。实际中英宽栏/深色窄栏截图已查看，默认左右工作台保留。
- 包验证79文件/70lib集合与字节、12Host peer、2生产依赖和141源输入SHA逐项相符。原始41份文件及证据清单按字节/SHA归档至docs/verification/artifacts/23-focused-value-view，含模型原始日志及同包innerText取值阶段false；不覆盖历史22原件。
- docs/verification/23-focused-value-view.md改为完整功能/状态所有权/搜索算法/源范围折叠/复制/聚焦与快捷键、实际预算/同包结果/复现/未验证范围，明确搜索只BytePreview已读文本、复制替身不等于OS权限、2MiB不是JS堆、新包未重跑TLS冷重启。实际GETRANGE取消45ms/10151ms截止与EOF、SCAN10125ms截止分别保留收据。
- 23票五项据范围勾done；六个当前进度入口及23表格同步01–23 done/24–29 ready，方案新增6.10。遵循最简、同一状态所有权及严格类型，不新增Host/RPC/依赖/Redis命令，原29票编号/P0P1/依赖和固定参考SHA保留。生产README已随同包验证，本次收口不改随包代码或README。
- 四套page/console错误为空，预期取消ERR_ABORTED按原报告保留；DSH/Chrome/代理/独占Redis/本轮owner目录均清理true，用户服务/业务库/日常profile/C盘和曾被拒绝清理的旧目录不动。没有npm开发服务或网页端GPT评审。按用户每个小目标本地提交约定核对后提交23；项目仍有六张P1，不标整体目标完成。

- 提交前审计：29票无缺重号、21P0/8P1、23done/6ready、全部原Blocked by图一致；六当前摘要同步。141源输入/41归档原件SHA逐项匹配，22个相对文档链接存在，不可变研究SHA保持e138f420…。main分支，原暂存区为空，已跟踪变更git diff --check通过；本次只收23生产/原生脚本/证据和进度文档，不含依赖/lib/夹具/原型或24实现。

- 暂存空白检查仅发现原始focus-ui-check-console.log第124行的pnpm末尾空白行；为保留证据字节不裁剪日志。其他文件使用正常cached whitespace检查；仅此日志路径单次允许blank-at-eof、仍查其他空白问题，不改仓库配置或跳hooks。

## 2026-10-16 任务24开始：连接资料分组、URI与导入导出

- 23已本地提交e55b255且main干净。24依原票前置04开始，四项仍空，六进度入口/24表格同步；不改原29票图和历史23证据。
- 继续prototype LOGIC技能，独立分支prototype/profile-transfer-state提交10ff150展示重名整批拒绝/改名/跳过、保存不连接、URI草稿/清密码、分组与无秘密导出。源在该分支src/client/prototypes/profile-transfer.prototype.html，ignored副本可双击；无测试/数据库/服务/生产合并，不称用户已确认。
- LUNA完整描述既有ProfileChooser/ConnectionForm/持久化与schema/RPC事实；核对Redis官方连接URL、Node URL和node-redis文档后，docs/verification/24-profile-import-export.md记录完整边界。最简复用原配置队列/稳定id，新增可选分组及严格无秘密可移植格式；导入仅新增、冲突改名或跳过、Host串行整批检查/一次原子写，无覆盖或自动连接。URI只填表单和会话DB草稿，密码/原URI不保存，导出白名单不含密码/CA/运行身份。接下来先实现纯模型及Host契约，立即严格类型/回归，UI与真实包尚未开始。

- 首次批量替换在首文件前置校验因原CRLF行尾不匹配停止，没有写任何生产文件；当时typecheck仅检查旧源码，不能计为新模型通过。改为读取时识别并保留每个文件原行尾，先校验全部替换再写入，未重排无关代码。
- 第24项首批模型/Host：domain增加可选group、无秘密PortableConnection/ProfileDocument及256KiB上限；shared/Host严格codec和remote-service/remote-client/client桥接新增importProfiles，拒绝额外字段/空批次，复用RemoteResult。profile-transfer以同组同名规则、白名单导出/有界JSON解析实现资料模型；connection-uri只解析基础redis/rediss、百分号解码/IPv6/路径DB，固定null失败，不记录或透传URL异常。
- RedisProfiles沿用原队列/原子文件写，保存校验同组同名；导入重新验证整批/50条容量、分配新id并一次追加，TLS导入仅开关/空CA，不覆盖/连接。分组缺省即当前未分组语义，不增加迁移/旧接口分支。ProfileChooser此阶段只增加action类型，尚无新UI行为。立即检查三层TypeScript；专项及真实包未运行。

- 新模型/Host三层TypeScript首检通过；随后加入URI原始路径限制与UTF-16校验，拒绝URL点段归一化吞掉DB或替换畸形凭据，不记录输入。新增资料/URI/Host存储与两端codec专项：运行对象额外secret仍白名单导出、未知格式/秘密/身份字段拒绝、UTF-8字节预算、精确Unicode冲突、分组重开/稳定id/空CA导入、整批失败不部分写、并发重验/取消与容量。
- 首次测试接入在bundle计数替换前置校验停止，其他专项已写；随后完整check因两项测试TypeScript错误中止（exactOptionalPropertyTypes下不应显式group:undefined；有意坏输入不应直接写成已知DTO的多余字段字面量）。立即分别改为省略分组字段和先构造结构化坏输入变量，保留严格类型/运行拒绝断言，不用any或放宽DTO。实际bundle断言变量为descriptors，现基于全文件改成24；旧方法清单也增加importProfiles，不删断言。继续严格检查与回归，尚未标新专项通过。

- 第24项模型/Host最终三层类型、完整构建及250回归通过，新增12项分别覆盖4资料/3URI/4存储/1两端codec；实际client bundle与Host/共享完整方法清单均为24。scripts/smoke-release-boundary.mjs真实SDK坏成功结果清单加入importProfiles并同步文案，尚未运行新原生包，不宣称SDK24通过。
- 两份模型原始输出按字节归档docs/verification/artifacts/24-profile-import-export，实施说明和24票comment记录模型范围/未完成UI与实际重开。24仍in-progress、四项不勾；此模型+Host小目标核对后按用户约定本地提交，不push/改写历史。

- 模型提交审计：原29票/全部依赖/优先级保持，01–23done/24in-progress/25–29ready和六处当前摘要一致，未勾24验收。正常cached空白检查只报原始model-check-console.log第126行pnpm末尾空白行，保留原字节；其余文件正常检查通过，仅该日志路径单次允许blank-at-eof，不改配置或绕过hooks。

- 24界面首批：ProfileChooser增加可选分组输入、按组导航/下拉，保存仍复用稳定id；run明确refresh/follow/keep三种选择行为，导入只更新同一资料列表且保留现有表单/选择，不触发连接。新增ConnectionUri只在按需入口持有密文输入，提交立即清原URI，固定错误，choose新建后仅填ConnectionForm与会话DB草稿，关闭设置清秘密。
- 新增ProfileTransfer：File.size与UTF-8双重256KiB上限、严格解析后仅存无秘密预览；每行可改名/分组/跳过，冲突/空选择/容量时禁提交，Host仍整批复验。下载仅显式白名单JSON，经Blob/object URL触发后回收；关闭设置/迟到文件读取用序号隔离。locales双语和styles只增加设置内折叠入口/分组/有界预览，默认主工作台不堆文字。立即三层类型检查；当前未打包或原生验证。

- 24 UI首次TypeScript被英文翻译中单引号未转义阻断，立即以不含内嵌单引号的等义文案修复，原失败输出保留profiles-ui-first-typecheck-console.log。同步移除未用导入，UI容量判断复用MAX_PROFILES而非重复数字；没有归因缓存、放宽类型或改变已验证Host模型。继续立即三层类型检查。

- 修正翻译后，编译暴露client composite显式include未列两个新共享模块（TS6307）；完整核对三端tsconfig，host/tests已有正确模式，仅将src/connection-uri.ts与src/profile-transfer.ts追加client既有显式清单，不扩大通配/关闭严格项。原失败输出保留profiles-ui-scope-typecheck-console.log。两类错误是语法和编译范围，未继续修补产品状态逻辑；同时固定配置错误提示明确同组重名需刷新。随后完整check。

- 24 UI完整三层类型/构建/250回归通过。新增scripts/smoke-profile-transfer.mjs：真实上传/Blob下载、URI固定错误/DB草稿、改名/跳过冲突、导入保持原选择及密码草稿、坏文档/Host整批拒绝/容量、冷Host重启重选和显式URI连接/DB1读取；独立DB0/DB1源DUMP与绝对过期对照。它在既有独占生命周期内运行，Host停后按本轮精确owner名称清资料，旧owner不动。
- 初次主脚本注入在匹配到两处profilePhase=reopen时前置校验停止，主脚本未写；改为明确renamedName后的唯一上下文再集成，避免误改收尾分支。PROFILE_TRANSFER分开save/reopen两个新DSH进程，生产界面/包未为验收修改。随后先mjs语法、prepack、隔离安装再实测，尚无新原生通过声明。

- 打包前完整核对随包README，补分组/URI草稿/无秘密JSON格式与256KiB/50条、冲突改名跳过/不覆盖/手动TLS CA与连接操作；因此前一预打包不作为最终候选。ProfileTransfer改用有界arrayBuffer和fatal UTF-8解码，拒绝损坏文件静默替换地址，关闭/迟到仍用同一序号守卫。
- 原生专项加入真实损坏UTF-8文件和明确标注的受控File.arrayBuffer延迟，关闭重开后释放验证旧预览丢弃，并finally恢复API；不冒称OS慢磁盘测试。通过实际UI状态响应取浏览器可信Agent，而非API另建会话，后续状态/坏导入校验均用该owner。待完整prepack和新SHA包实测，尚无通过声明。

- 最终资料功能候选37b335ddb15a12056c1eb3885c83cd879b971af49b66797fc26027831af7e5e0（117420字节）严格prepack三层类型/构建/250回归通过，按SHA路径仅安装项目隔离web profile，未换日常DSH。启动PROFILE_TRANSFER+KEYS两轮真实save/reopen，尚未记通过；保存/导入操作只在隔离配置，Redis只做独占只读查看，finally清理本轮进程/owner资料。

- 37b335dd真实PROFILE_TRANSFER两轮首次18/17组全部通过：真实Blob文件下载白名单、上传预览/改名/跳过、型/秘密/容量/损坏UTF-8拒绝、Host整批冲突不改原文件、导入保留当前选择和密码草稿；受控文件延迟关闭后旧预览丢弃。冷DSH重启五条分组/导入id与本地CA保留，导入TLS空CA、选择零Redis命令/连接；URI手动连接DB0，DB1仅草稿，显式Select/扫描才读真实值，DB0/DB1源DUMP/expiry不变。
- 两轮page/console/request错误均为空，所有自建DSH/Chrome/Redis/本轮目录停止，精确owner的五条测试资料清除。继续同包全类型/双会话/24方法SDK、工作台及既有TLS冷重启门禁，24仍未勾完成。

- 同一37b335dd包全12类型/双会话/实际SDK与React87组全部通过，坏成功HTTP结果的实际严格decoder覆盖24个方法（含新importProfiles），源权限/消失/变型/预算等原断言保留。page/console为空，1条预期会话取消ERR_ABORTED；本轮资源清理true。包验证81文件/72lib集合字节、12Host peer、2依赖和148源输入SHA一致。现运行中英明暗工作台24组，随后既有TLS配置两轮，24未提前完成。

## 2026-10-16 任务24完成：连接资料分组、URI和无秘密导入导出

- 同包37b335dd最终250回归、资料18/17两轮、全12类/双会话/实际24方法SDK与React87、工作台24/22几何样本和真实TLS配置冷重启17/17均通过；当前包81文件/72lib、12Host peer、2依赖、148源输入一致，实际预览/分组/中文工作台截图已查看。
- 43份原始文件及清单归档docs/verification/artifacts/24-profile-import-export，按源字节/SHA核对，包含实际下载JSON、模型原件及UI两次编译错误原件；完整doc记录格式/职责/URI解析/文件fatal UTF-8与序号/冲突精确比较/队列原子写/对象URL、实际结果/复现/边界。不把受控File API延迟当OS慢磁盘或原22/23旧包证据合并为本包通过。Node22文档页浏览工具不可达，沿用已阅Node官方基础URL文档，补WHATWG Encoding正式fatal解码规范与实际损坏文件依据，不冒称已读不可达页面。
- 24四项勾done，六当前摘要/24表格同步01–24done/25–29ready；方案新增6.11和当前24RPC说明，原第21项有日期的23方法历史原样保留。原29票图/优先级/参考SHA不变，README已在当前包验证，收口不改随包源码。
- 六原生报告page/console为空，只有全类型1条预期会话取消ERR_ABORTED；所有本轮DSH/Chrome/Redis/证书/owner目录及五条资料/TLS专项配置正常清理。原清理拒绝项/旧owner、用户业务库/服务/日常profile/C盘不动，无开发服务或网页端GPT评审。按每小目标本地提交约定核对后提交24；完整目标还余五张P1，不提前标完成。

- 24最终提交审计：29票/21P0+8P1/全部原依赖和24done/5ready一致，六处摘要同步；148源输入、43归档原件SHA逐项匹配，35个相对文档链接有效，不可变参考SHA保持e138f420…。main、原暂存区为空，已跟踪diff whitespace通过；只收24 UI/原生专项/随包说明/最终证据与进度，不含依赖/lib/夹具/原型或25实现。

- 暂存whitespace仅发现原始profiles-ui-check-console.log第126行pnpm末尾空白行；原字节证据不裁剪。其余文件正常cached检查通过，仅该路径单次允许blank-at-eof且仍检查其他空白问题，不改配置或跳hooks。

## 2026-10-16 任务25开始：服务器概览手动快照

- 24已完整本地提交6927426，main干净；25依原票06开始，六摘要/25表格同步01–24done/25in-progress/26–29ready，五项仍空，原29票图/优先级不变。
- LUNA只读提供现有连接/代次/transport白名单/ReadContext/1MiB帧及真实INFO依赖事实，根模型完整阅读相关实现并核Redis官方字段文档。docs/verification/25-server-overview.md记录最简方向：固定无参数INFO，Host只挑16字段、缺失null/精确uint64文本/明确单位和Host采样时间；128KiB解释预算不冒充网络接收或堆限制。
- 下一步纯解析/DTO/Host及必要专项，随后独立概览卡片入口，保持默认左右和只在显式打开/刷新时读取；无通用命令、section输入、服务器配置写入、持续轮询或图表。尚无源码/真实包通过声明。

### 25 固定 INFO 模型与 Host 读取（待检查）
- 修改 src/domain.ts、redis-info.ts、host/overview-reader.ts、host/redis-transport.ts、typert.shared.ts、typert.host.ts、typert.remote-client.ts、remote-service.ts：新增16项有界快照、uint64精确文本、严格两端契约及固定无参数INFO；复用会话/DB/代次和10秒截止。
- 修改 tsconfig.client.json、tests/host-typert.test.ts、tests/client-bundle.test.ts，新增 tests/overview.test.ts：同步25方法与解析/权限/预算/取消/晚结果专项。主界面尚未接入，25仍进行中。
- 原因/影响：提供独立服务器概览的数据基础，不增加任意命令、写入或自动轮询；128KiB是语义预算，RESP接收上限仍为已有1MiB。立即进行类型检查。

### 25 模型里程碑验证与本地提交
- pnpm check通过：Host/Client/tests严格TS、构建、25文件258项测试；其中overview.test.ts含8项INFO专项。原始日志保全至 docs/verification/artifacts/25-server-overview/model-check-console.log。
- 文档更新 docs/verification/25-server-overview.md，明确静态/模型已通过、UI与真实Redis尚未完成；原任务图与25进行中状态保持。按照已授权的小目标本地提交，不推送。

### 25 状态原型与UI接入范围
- 一次性原型保存在 .scratch/artifacts/server-overview.prototype.html，捕获到 prototype/server-overview-state；main仅记录指针，不加入HTML壳。三组引导描述正常/缺字段、关闭迟到、权限/切换连接。
- 接下来修改 ConnectionForm/index.ts/locales/styles 并新增 ServerOverview.tsx，以独立入口+四组卡片使用既有对话框、图标和DSH主题；原Key分栏保持，复用现有RPC错误文案/AbortSignal，保持职责最简。

### 25 概览UI已接入（待验证）
- 新增 src/client/ServerOverview.tsx；修改 ConnectionForm.tsx、index.ts、styles.ts、locales.ts。状态栏独立入口、四组16字段卡片、手动刷新/取消/关闭、采样时间与双语单位/缺失文案；使用既有dialog、HelpDetails和Icon。
- 关闭/取消清空已读指标并abort，组件按id/generation/db重挂隔离晚结果；打开/刷新由按钮触发，不增加mount自动INFO或轮询。Key工作台DOM和默认分栏保持。
- 预检发现英文词典原本带Record约束，按其真实声明接入；写入前失败的字符串匹配未修改源文件。立即重新执行实际UI类型检查。

### 25 原生验证入口准备
- 概览dialog使用独立redis-overview-dialog类，styles仅共享原dialog基础规则；避免既有连接配置定位器与新dialog混淆。
- scripts/smoke-release-boundary.mjs同步25个真实Remote方法；接下来新增固定INFO原生专项并按新模式接入smoke-dsh.mjs，使用隔离真实Redis延迟代理验证，不修改用户实例。

### 25 原生专项静态检查
- scripts/smoke-server-overview.mjs新增真实8.2.6卡片、显式INFO、ACL拒绝、精确值/缺失/非法响应注入、取消/关闭/队列、10秒、EOF/新代次/B隔离和源数据不变检查；smoke-dsh新增独立overview模式与其拥有的代理。
- 首次node --check发现测试输出JSON处换行转义写成源码字面换行，立即修正，两个脚本语法检查通过；未运行失败脚本。真实UI类型检查已通过，后续打包前再执行全量严格检查。

### 25 打包前说明
- README新增概览实际操作入口、16项四组/手动读取/单位/未报告/关闭保位说明。客户端单位细分秒、字节、连接数、Key数、次数与操作/秒，避免次/个混写。
- scripts/smoke-server-overview.mjs和smoke-dsh.mjs语法通过。立即通过prepack执行完整严格检查并生成唯一SHA包，后续只安装到项目隔离profile。UI与真实Redis尚未宣称通过。

### 25 安装包核对环境修正
- 新包prepack通过258项，SHA=01a92d9112146dbcab48b4a97ab432c7b0334b1ca83eb6dc7d6b985141d2f68a；仅安装至项目隔离DSH_HOME。
- 首次verify-release-package未携带其明确要求的REDIS_TEST_PYTHON/DSH_CLI_ENTRY，被脚本前置断言拒绝；原始日志另存overview-package-env-missing-console.log，未作为通过。使用同一完整显式环境重跑；实际INFO原生专项正在独立夹具中执行。

### 25 真实INFO专项通过
- 当前包01a92d9安装文件逐字节匹配；原生INFO21项通过，真实Redis8.2.6，取消31ms/实际生产超时10101ms，真实ACL/EOF/代次/B隔离/不重放/源数据不变均形成证据。
- 原始报告保留2条主动取消的readOverview ERR_ABORTED；页面和console错误为空。所有自建进程/夹具/代理停止。实际截图已查看，4组卡片有序、背景工作台分栏保留。
- docs/verification/25-server-overview.md追加已验证范围和注入/真实版本/预算/TLS边界；同包完整SDK/数据/会话及布局回归仍在执行，25继续进行中。

### 25 完整验收、归档和本地提交
- 同包01a92d9：prepack258项、INFO原生21、完整SDK/数据/会话87、布局24全部通过；85打包/76lib/12peers/2依赖/153源码输入逐文件核对。概览21及布局24、完整87均processStopped/fixturesStopped=true，INFO代理也停止。
- docs/verification/artifacts/25-server-overview归档30份原始文件+inventory；docs/verification/25-server-overview.md记录真实/注入/版本/TLS/接收与语义预算边界，实际查看卡片截图。六处当前进度同步01–25 done/26–29 ready，25原五项勾选且依赖不变。
- 保留原日志结尾空行；只对明确raw日志文件使用单次git core.whitespace=-blank-at-eof检查，其余文件标准diff --check，不修改Git配置/跳过hook。所有自建服务已停止，准备本地语义提交，不push。

### 26 开始：有界慢日志快照
- 六处当前进度与26任务切至进行中，原依赖/编号/优先级不变；新增docs/verification/26-slowlog-view.md记录官方命令及8.2.6源码、固定GET数量/只传字节摘要/4-6-7段与真实接收预算。
- 接下来新增严格慢日志DTO/纯命令名验证/Host reader，transport限定SLOWLOG GET和正数最多101，复用现有可信会话/代次/取消/10秒，不开放RESET/CONFIG或命令输入；模型专项后提交小目标。

### 26 模型与Host实现（待检查）
- 新增 redis-slowlog.ts、host/slowlog-reader.ts、tests/slowlog.test.ts，更新domain、strict两端Typert/remote-service、客户端scope和方法清单（26方法）。
- 固定GET count+1、最多101原始项/100展示、128已记录参数/前8个长度摘要；整数原文和4/6/7段校验，正文及客户端身份不进入DTO。传输层同时约束INFO无参数/SLOWLOG只GET正数最多101；loopback测试确保RESET/LEN/-1等零派发。
- 新增8项慢日志模型专项与1项真实socket拒写形状测试。立即执行完整类型/构建/测试；UI尚未接入，26不勾。

### 26 模型里程碑通过并本地提交
- pnpm check通过26文件267项（新增8项slowlog模型与1项loopback固定诊断形状）；原始日志保存在docs/verification/artifacts/26-slowlog-view/model-check-console.log。
- docs/verification/26-slowlog-view.md记录通过范围与尚未完成UI/真实Redis边界；状态仍26进行中。原始日志结尾空行保持，仅该raw文件单次git whitespace例外检查，其他文件标准check，不更改Git配置/跳过hook。

### 26 慢日志UI与共用快照生命周期（待检查）
- 新增SnapshotDialog.tsx，抽取25已有显式打开/刷新/取消/关闭/晚结果控制；ServerOverview.tsx保留字段分组/单位展示，通过共用组件呈现。避免两套读取规则，原25交互/数据边界保持；后续重跑25原生专项。
- 新增SlowLogView.tsx，使用现有CollectionTable、数量1/10/25/50/100、精确ID/秒/微秒、受限参数长度与空/更多/完整/不可用状态；本机时间只作辅助，精确Unix秒仍显示，超Date范围明确未报告。
- ConnectionForm/index/Icon/locales/styles接入独立history入口与共用dialog主题，不挤主Key/详情分栏。立即类型检查；真实Redis和原生UI尚未验收。

### 26 原生专项与打包前检查
- scripts/smoke-slowlog.mjs及smoke-dsh新增慢日志模式，明确自建fixture admin准备/恢复配置、种子/清空与插件GET边界。验证真实6段/1-10-100条/长参数隐藏、日志不变、ACL、非法DTO注入、取消/队列/10秒/EOF/代次/B/空与Key源不变。脚本node --check通过。
- README追加当前慢日志操作；smoke-release-boundary方法清单同步26。UI类型检查通过，立即prepack完整检查后固定SHA并隔离安装；新增共用SnapshotDialog的影响将以同包概览原生回归覆盖。

### 26 真实夹具返回形状修正
- 首次native-slowlog在自建admin的CONFIG GET数组假设处前置失败；产品尚未打开慢日志，报告passed=false且所有进程/夹具停止。原始JSON/log/console/失败截图另存fixture-shape-failure文件，未算验收。
- 已完整读取实际wsl-redis-fixture与已安装@redis/client6.2.1 CONFIG_GET/generic-transformers：正式configGet转换器默认返回键对象。smoke-slowlog改用该正式SDK方法获取配置并按精确键恢复，不加数组/Map兼容分支，不改产品代码。脚本重新静态检查后用同一个8245456包重跑；包源码清单会按实际新测试脚本hash重建。

### 26 真实慢日志专项通过
- 同包8245456：慢日志原生22项通过，真实8.2.6六段、1/10/100条、长/敏感参数仅摘要，ACL/取消/10秒/EOF/代次/B/空与源数据不变。actual截图已查看，是可滚动结构表格，背景工作台保留。
- DEFAULT_RESP=3及CONFIG GET正式对象映射已由实际SDK代码核实；前次失败原件保留，修正仅涉及测试脚本，同包重跑。当前各自建进程/夹具/代理全部停止。文档追加真实/注入/旧形状/接收预算边界；25共用dialog回归正在执行，26仍进行中。

### 26 完整交付、归档与本地提交
- 同包8245456：prepack267、慢日志22、概览回归21、完整SDK/数据/会话87、布局24全部通过；慢日志取消32ms、超时10092ms，真实与HTTP注入边界在26验收文档分开记录。所有自建DSH/Redis/代理停止。
- docs/verification/artifacts/26-slowlog-view保全39原件+inventory，包括前置fixture形状失败，当前包89文件/80lib/12peers/2依赖及实际源码SHA可核对。六处当前进度同步01–26done/27–29ready，26五项勾选且图不变。
- 保留raw日志原始结尾空行；仅明确raw路径单次core.whitespace=-blank-at-eof，其他文件标准diff --check，不改Git配置/跳过hook。本地语义提交，不push。

### 27 开始：客户端连接快照
- 六处当前进度与27票切进行中、图不变，新增docs/verification/27-client-list.md记录官方协议与预算/字段/只读边界。
- 接下来新增14字段解析/严格DTO/Host CLIENT LIST；复用可信DatabaseTarget与10秒、RESP1MiB，256KiB后置解释/200行展示并报告实际本次记录数；固定LIST子命令拒绝KILL/PAUSE，不开放管理写或记录地址。先专项/类型，后复用快照弹窗和表格，不堆主界面。

### 27 客户端列表模型与固定LIST（待检查）
- 新增redis-client-list.ts、host/client-list-reader.ts、tests/client-list.test.ts；更新domain、strict两端Typert/remote-service、Client scope与27方法计数、tsconfig。14字段全部必有nullable槽，精确uint64与有界UTF8文本、缺失/新增/重复、256KiB解释/200行与本次总记录数一致校验。
- transport仅允许CLIENT LIST一个字面参数，真实loopback测试KILL/PAUSE/过滤/SETNAME等零派发。9项模型专项加1项socket子命令测试，复用可信目标/代次/取消/10秒；无常规地址日志。立即完整类型/构建/测试，UI尚未接入。

### 27 模型里程碑通过与本地提交
- pnpm check通过27文件277项（新增9模型+1实际loopback拒写形状）；原始日志保存在27-client-list/model-check-console.log。docs/verification/27-client-list.md记录静态/模型范围，未声称真实大列表/UI，27继续进行中。
- 原始日志结尾空行保留，仅raw指定路径单次git whitespace例外，其余标准check，不改配置/跳过hook。本地小目标提交，不推送。

### 27 原生客户端表格接入（待检查）
- 新增ClientListView.tsx，复用SnapshotDialog和CollectionTable：主表7列，其他7字段点击地址后在精简元信息区查看；选中动作无网络，刷新清除上一快照详情；缺失null与空名称/用户分开显示。
- ConnectionForm/index/Icon/locales/styles接入独立客户端图标、双语单位、同次返回数/200条截断/空/不可用、帮助中的接收与解释预算说明。未改既有快照组件或主Key/详情布局。
- 预检发现styles的同名grid选择器有媒体规则，未写入前收紧到原display:grid规则后一次通过；前次匹配拒绝没有改源文件。立即对真实新UI类型检查，再真实大列表和预算实连。

### 27 真实大列表与双预算专项准备
- 新增scripts/smoke-client-list.mjs与smoke-dsh独立clients模式：205个夹具自有连接、真实208返回/200展示、行详情无读取、ACL、状态/非法DTO注入、取消/队列/10秒/EOF/代次/B、连接退出与Key源不变。子进程和205连接均finally关闭。
- 核实官方CLIENT SETNAME无额外名称长度上限（受Redis字符串上限），仅夹具admin设置300KB/1.1MB名称构造真实大回复；256KiB后置预算经UIA验证，1MiB接收通过直连Host C验证，避免代理自身上限误充产品证据。smoke-dsh显式保留夹具directSettings，仅测试使用。
- 同步真实SDK27方法，脚本语法检查通过；客户端UI严格类型检查通过。产品不提供任何SETNAME/KILL/PAUSE，仅LIST。

### 27 打包前完整检查
- README新增客户端快照操作、点击详情/200显示与返回数/双预算/无管理写说明；27真实SDK方法表已同步。立即prepack277专项/回归与构建，再固定实际包SHA、只装隔离profile。原26完整提交保留独立证据；本27 UI与真实大列表尚未冒称通过。

### 27 真实客户端列表与双预算通过
- 同包26cd754原生23项：208返回/200展示，205自有额外连接、字段/详情/单位、真实ACL、取消/队列/10秒/EOF/代次/B、真实连接退出和二进制Key源不变；所有自建进程/Redis/代理/205连接停止。
- 256KiB后置解释限制经真实UIA大回复验证（保留连接）；1MiB接收限制经直连真实Host C大bulk验证（只关闭C、A/B可用），明确避免把代理上限当产品。测试SETNAME仅自有夹具；未开放产品管理写。
- docs/verification/27-client-list.md记录真实/注入/版本/TLS/接收与JS堆边界，实际已查看结构化表格截图。完整数据/SDK回归正在执行，27仍进行中。

### 27 完整交付、证据归档与本地提交
- 同包26cd754：严格prepack277、客户端原生23、全数据/会话/实际27方法SDK87、工作台24全部通过；93打包/84lib/12peers/2依赖与164输入逐文件匹配。客户端取消49ms、超时10112ms，所有自建DSH/Redis/代理/205客户端停止。
- docs/verification/artifacts/27-client-list保全28原件+inventory，27验收文档记录真实/注入/版本/TLS/预算及旧包专项边界；六摘要和原27五项同步done，01–27done/28–29ready，原29票图不变。README随包已验。
- 主界面继续Database/RESP分栏，客户端精选表格与按需详情不堆默认工作台。只提交当前27 UI/专项/验收与进度，不含lib、依赖、运行夹具或新28代码；raw日志保留原字节，按明确路径做单次blank-at-eof例外，其余标准diff检查，不改配置/跳过hook。

### 28 开始：当前Key受控自动刷新
- 27已本地提交44d0043，六处摘要/原28切进行中，29ready且原图不变。已完整核对独立reader和集合hook、固定rc.2原生useTabInfo，直接复用visible/signal，避免DOM轮询判断。
- 状态原型保存prototype/key-auto-refresh-state/355df0c，双击副本.scratch/artifacts/key-auto-refresh.prototype.html，HTML不进main；新增src/client/auto-refresh.ts纯one-shot调度器与9项行为测试，后续UI复用。默认关闭/5秒、最小1秒、完成后计时、owner防迟到、停用后已排队effect拒发。
- 原型生成时Node REPL的CJS typescript动态导入返回空namespace，转为本机Node正式require；cmd经execFile传入组合命令和where在该REPL环境拒绝，未写生产文件/动真实index，改用已核路径Git结构化argv与专用GIT_INDEX_FILE成功捕获。原型不连接DB/不运行浏览器、不写测试。
- 当前只调度模型，无新Host命令、UI或真实Redis通过声明；立即严格类型/构建/专项检查。

### 28 调度模型通过与本地提交
- 完整pnpm check通过28文件286项，新9项调度行为均通过，原始日志保全28-key-auto-refresh/model-check-console.log。没有新增Host方法或持久状态，28仍进行中。
- 原型分支与模型状态推演指针已记录，未声称用户验收；仅调度/测试/阶段记录与进度作为小目标本地提交，不推送。

### 28 接入当前查看器与原生可见性（待检查）
- 新增AutoRefresh.tsx：原生tab.visible/signal和document.visibilitychange，按Key独立时钟、小工具栏、双语帮助/成功时间；RedisWorkspace正式props.useTabInfo，KeyBrowser按原始Key挂边界。styles只加工具栏，窄栏图标/间隔/帮助一行，长规则折叠，不改变原Database/RESP分栏。
- KeyDetails/Bitmap/Hll/Json/List/Geo/Bloom注册原有已提交请求和取消；use-collection-scan统一其余集合，ZSet进入GEO禁用父源；所有开始同步清等待，关闭后排队的自动effect必须许可才发请求。Bloom自动item=null仅统计，原成员判断不重放。
- 首次大型编辑脚本被JS解析前置拒绝，未写文件；其后那次typecheck仅验证旧模型，未算UI通过。已拆为预检Map/正式写入两步，全部唯一上下文匹配后一次落盘。无新Host RPC、持久配置或依赖。立即检查真实新UI严格TS。

- 28真实UI首次严格TS发现exactOptionalPropertyTypes拒绝active:boolean|undefined；已保留auto-refresh-ui-optional-type-failure.log，调用处明确options.active!==false，不放宽类型/兼容分支。立即重跑三层TS。

### 28 真实原生专项准备
- 新增scripts/smoke-auto-refresh.mjs，smoke-dsh接入独立AUTO_REFRESH模式/自有12类种子/延迟代理。覆盖12 reader、最小间隔/已提交参数/首个有界页/Bloom不重放、真实慢回复不叠加、Off/原生panel与A-B切换/DB/ACL/消失/变型/JSON预算/10秒/EOF/新代次/关闭tab/源DUMP与expiry。所有种子、写入准备、B workspace与admin只属于本轮隔离fixture，外层finally仍关原生DSH/代理/Redis。
- 浏览器页面隐藏只记录handler/模型覆盖，不冒称OS最小化已测；真实面板/会话/关闭使用rc.2实际DOM按钮。UI三层严格TS已通过，脚本先node语法检查再打包，不提前声称原生通过。

### 28 打包前说明与脚本核对
- README补当前Key开关/5秒默认/1秒最小/完成后等待、已提交范围/首个有界页/Bloom统计/隐藏失败停止及不持久化规则。源码未加新Host方法。
- 根据实际英文词典核对Bitmap/GEO/HLL与List下一页按钮，修正尚未运行的测试定位；第一种查看器复用刚完成的显式选择，避免同Key再次点击本来就不重读而等待错误响应。timings用真实换行结尾。node语法通过后prepack完整检查，实际原生尚未宣称通过。

- 28候选f6f9e2e（136502字节）prepack286项通过。第一次隔离安装引用同条cmd中的DSH_CLI_ENTRY被当成字面路径，Node前置MODULE_NOT_FOUND，无安装动作；改为已验证CLI绝对路径后安装成功，未改日常DSH。下一步该唯一包做原生自动刷新和逐文件核对。

### 28 首轮原生脚本返回形状修正
- f6f9e2e真实原生前14组/12 reader两轮已通过，实测两次请求间隔1015–1026ms；随后测试把单个Playwright Response错误数组解构而中止，不是产品失败，所有自建DSH/Redis/代理/B资源已停止。四个原始失败文件保留auto-refresh-script-shape-failure*。
- 只修改smoke-auto-refresh：直接接单Response；settled在auto开启时等待真实On·waiting，而非仍可点击的停止开关，避免慢读期间提前采样。脚本node语法后同包重跑，更新当前测试源码SHA清单；不把前14组算最终验收，产品包未变化。

### 28 取消与放行时序核对
- 第二轮前16组通过（含12 reader、64KiB部分值、真实慢回复无重叠），Off后立即释放包时断言A的postchecks=0失败（实为3），原始四文件保留auto-refresh-cancel-release-failure*，passed=false且所有自建资源停止。
- 停止修补并完整核对rc.2 connection/client/rpc.ts37–57、rpc-host.ts261及项目ReadContext/Connections/transport118–154：浏览器用fetch AbortSignal，没有独立远程取消ACK；Host调用有guard，active取消停止等待但排空真实回复至截止，不直接关闭socket。立即release可能先于HTTP中止到Host，不是停止Redis计算的承诺。
- 测试保持回复被扣留，等待真实readString requestfailed并完成B的真实Host读取后再release，沿用已验证19的交付顺序；仍断言A零后置命令/B可用/晚结果不重启，不放宽产品或取消断言。报告reader改记实际readGeo/readHll，visibility标记仅在真实步骤完成后置true。产品包仍f6f9e2e，同包继续专项。

### 28 最后标签关闭后的原生界面核对
- 第三轮前22组及真实取消交付/面板/会话/DB/ACL/消失/变型/预算/超时/EOF均通过；最后关闭Redis唯一tab后试图点击旧隐藏pane的New tab而超时，原始四文件保留auto-refresh-last-tab-reopen-failure*，所有自建资源已停。已实际查看失败截图，整个右栏确实收起。
- 重新核对真实界面状态，测试现在先点可见expand、等当前open，再只定位可见guide/New tab；未修改产品/增加兼容或隐藏断言。仍保持同包f6f9e2e，完整专项重跑；不同子场景的脚本错误均原样保留，不冒充通过。

### 28 真实自动刷新专项通过
- 同包f6f9e2e原生26组完整通过，含12 reader两轮、真实慢包>两间隔仅1请求、完成后等待、Off取消/B交付、原生panel/A-B/DB/tab生命周期、真实ACL/消失/变型/JSON预算、10秒/EOF/手动重连新代次与源DUMP/expiry。前述三次测试问题保留独立失败原件，最终报告不混入旧通过。
- page/console错误为空，预期取消请求单列；本轮自建DSH/Redis/代理/B全部停止。接下来同包完整12类/会话/27方法SDK与工作台回归，28仍进行中。

### 28 最终状态显示核对
- f6f9e2e已全通过286/自动26/完整87/布局24，作为checkpoint原始报告和console/manifest另存10件。最后源审查发现：自动失败的clock保留成功时间但UI只在enabled显示；停用后queued begin被统一写成hidden。
- 仅AutoRefresh.tsx让failed/hidden/cancelled继续显示保留的上次成功时间，默认关闭仍不增加文字；auto-refresh.ts在明确停用时拒发并保留原停止原因。原9项测试加强Off原因断言，真实ACL专项加强成功时间可见与精确原时间不变。职责/连接/命令/时序不改，重新prepack/最终新包验收，不拿f6旧包报告当新通过。

- 28验收文档补实际文件职责、one-shot/pendingOwner/许可、各类型已提交查询规则、无新Host/依赖、HTTP无取消ACK及三次失败与真实/未测边界。最终4cc78d0（136510字节）严格prepack286和逐文件安装核对通过；f6旧包标为checkpoint，最终原生重跑中，未提前勾done。

### 29 独立内存原型准备（28最终完整回归期间）
- 不修改随包src/scripts/tests：仅.scratch/artifacts/timeseries-chart.prototype.html和临时纯模块，捕获prototype/timeseries-chart-state/d66eebd625a91822f0fd7072da53687609f768bf。基于已读精确DTO推演BigInt时间差、double先归一避免溢出、前512读取顺序/升序绘制/未绘制数、异常整幅拒画与UTC Date边界，三个引导和自由操作。无服务/Redis/浏览器/原型测试，HTML不进main。
- 原型是根模型的状态/数值设计资料，不代表用户认可视觉；29正式实现尚未开始，28最终新包26已通过、87运行中。

### 28 完整交付、归档和本地提交
- 最终4cc78d01（136510字节）：286严格测试、自动原生26、完整SDK/12类型/双会话87、工作台24全部通过；93打包/84lib/12peers/2依赖/168输入逐文件匹配。实际12轮间隔1013–1028ms、取消27ms、截止10058ms，失败保留原成功时间验证通过。
- 52份原件+inventory保全28-key-auto-refresh，含三轮失败和f6 checkpoint，最终新包报告明确隔开；实际已查看窄宽结构。三报告page/console为空、自动3/完整1预期取消、布局0请求错误，所有自建DSH/Redis/代理/B均停止。
- 六摘要和原28五项同步01–28done/29ready；无新Host API、依赖、自动重连或持久状态。只提交当前28实现/说明/专项/证据，不提交29源码（曲线原型已单独捕获throwaway分支）。保持raw日志原字节，仅指定日志路径单次blank-at-eof例外；其余标准check，无push/改Git配置/跳过hook。

### 29 正式开始：已读TimeSeries样本曲线
- 28已完整提交a02d065，六摘要/29票切进行中，原依赖16/编号/优先级不变。新增src/client/timeseries-plot.ts、tests/timeseries-chart.test.ts与29验收记录。
- 根模型已完整核对现有TimeSeriesView/cache/Host/strict测试、MDN BigInt和Date规范；采用BigInt时间差、最大绝对值归一、前512读取前缀/升序绘制/未绘制计数、原始文本/UTC边界。无新Host API/查询/依赖或库扩容，异常整图拒绝不静默过滤。
- 10项新测试覆盖相邻53位/Int64最大值、全跨度、反向前缀/输入不变、double极值/微小原文、空/单点/零、非法/重复/前缀外异常、UTC边界、5000缓存点坐标预算。立即严格类型/构建/测试，UI尚未接入；原型在throwaway分支不进主包。

### 29 投影模型通过并本地提交
- 完整pnpm check通过29文件296项，新10项曲线数值/预算行为均通过，原始日志保全29-timeseries-chart/model-check-console.log。模型和单次原始时间/值保持精确，坐标明确近似，不新建数据读取或类型契约。
- 29仍进行中，界面/实际Redis未宣称通过。按每小目标本地提交模型/测试/阶段文档与进度，不推送。

### 29 曲线UI接入（待检查）
- 新增TimeSeriesChart.tsx：只读现有cache、memo投影、本地SVG/点原文title与详情、UTC辅助、范围/最值/未绘制数。键盘左右/Home/End只移动本地图点并局部滚动，不滚DSH文档或读取Redis。重复刷新清空旧图/详情，选择按时间身份匹配新点，无旧数据残留。
- TimeSeriesView加入默认表格/曲线切换和共用折叠帮助；模式不进入queryKey或Host，保留原分页/方向/已提交范围与28自动生命周期。locales双语与styles只新增有界图表/本地横滚/简短披露，既有工作台左右分栏不变，无新增依赖/Host契约。立即三层严格TS。

### 29 真实曲线专项准备
- 新增scripts/smoke-timeseries-chart.mjs与主smoke CHART模式：实际TimeSeries80210断言、二进制Key、53位/Int64相邻与double极值、700样本/手动600已读512绘制、逆向/空/常量、表格本地切换/键盘、自动刷新后新页、真实取消/ACL/消失/变型/10秒/新代次/B、明确HTTP非法时间注入、明暗中英与局部横滚/源DUMP和expiry。
- 所有数据准备及故障写仅自有fixture，B仅受信测试会话，finally还原ACL/关B，主生命周期停DSH/代理/Redis。产品无新Host API；曲线三层严格TS通过，脚本先静态语法检查再最终打包。

### 29 打包前核对
- README追加TimeSeries表格/曲线实际操作、512读取前缀/不绘制数/原始点值与UTC辅助、自动刷新沿用模式，明确本地显示切换不替换读取源；28原解释方式措辞相应收窄。没有新增缓存/持久设置/服务器语法。
- 核对既有词典，TimeSeries继续使用stream.more的实际英文Continue reading，测试定位按真实控件修正（尚未运行失败）；两个脚本node语法通过。立即prepack严格296与最终候选包，再安装项目隔离profile实连。

### 29 真实曲线专项通过
- 最终候选b21a919b（140128字节）严格prepack296和93打包/84lib/12peers/2依赖/172源码输入逐文件安装核对通过；曲线原生21组通过，真实Redis8.2.6/TimeSeries80210。600已读/512绘制、53位/Int64相邻、极值、零额外读取、自动刷新保持模式、取消44ms/截止10037ms、ACL/消失/变型/代次/B与源DUMP/expiry均实际验证。
- 实际已查看900px中文暗色三栏与340px暗色Key/详情左右分栏截图；root/Key/document无溢出，图内局部121px横滚正常。page/console无错误，1条预期取消单列，所有自建DSH/Redis/代理/B停止。29验收文档记录真实/HTTP注入范围，完整同包87/布局24仍进行中，29不提前完成。

### 29 完整交付、原29票全部验收与本地提交准备
- 最终同包b21a919b（140128字节）：prepack29文件296项、曲线原生21组、完整12类型/会话/27方法SDK87组、整体工作台24组全部通过。93打包/84lib/12Host peer/2依赖和172源码输入逐SHA一致；实际曲线取消44ms、截止10037ms。三报告page/console为空，曲线与完整各1条预期取消，布局0请求错误；所有自建DSH/Redis/代理/B已停止。
- docs/verification/artifacts/29-timeseries-chart按字节归档32原件+inventory，含中文/明暗/窄宽实际截图、SDK和安装清单；29验收文档完整说明实现职责、数值/前512显示预算、UTC、真实与注入/模型/版本/TLS/取消边界。实际已查看中文三栏和窄Key/详情并列，不声称用户已认可视觉。
- 文档同步预检发现索引使用真实E盘绝对链接而非假设的相对链接，预检在任何写入前拒绝；按实际物理行唯一替换状态后再落盘，无遗漏或半写入。六份进度与29原五项同步done，原01–29共21张P0/8张P1全部完成，原编号/优先级/依赖未改，P2仍候选。
- README为本次实际随包操作说明；用户日常DSH profile未自动修改。下一步核对140复选项、依赖、参考原件、归档SHA与Git暂存范围，再本地语义提交；不push。

### 29 最终一致性审计通过
- 原29票连续编号、21张P0/8张P1、全部done、140项checked/0项未勾、原Blocked by物理行依赖逐项一致；六份当前进度一致，63处本地链接均有效。固定Database/RESP研究原件SHA保持e138f4206b3534f3e7c74050ca7e7dc36b359ab1a64feeb15e5e832271800b0c。
- 32份归档原件的长度/SHA及172源码输入重核一致；当前main暂存起点为空。仅本29UI/原生专项/使用说明/验收/进度与证据进入本地提交，排除lib、依赖、tgz、runtime和原型壳；原始日志不重写字节，仅明确raw路径单次blank-at-eof检查，其余标准diff检查，不改Git配置/跳过hook或推送。

## 2026-10-17 安装到日常DSH：前置核对与配置保全
- 用户明确授权把已验收Redis插件安装到正在使用的DSH，以实际查看界面和操作。当前PATH入口CLI为0.2.0-rc.2，正式DSH_HOME为C:/Users/admin/.dsh、目标profile为web；未发现正在运行的DSH进程或现有DSH浏览器页。
- 安装候选沿用已验收b21a919b4ac93768fc22fdf47ecd8c6fd609687f9b216bb277ad8e6369ceb737包（140128字节），实际SHA已复核，不重新构建或改产品代码。C盘约1.37GiB/E盘约62.9GiB可用；不清理用户文件。
- 现有profile含Git Graph失效本地依赖及input-plus/web-search旧rc.6 peer约束。plugin --profile web --help实际进入pnpm转发/reconcile而非只打印顶层帮助，触发现有依赖错误；add --help输出超过读取预算，未作为安装成功。已核对package.json仍与事前读取内容一致；后续先基于实际CLI实现核对语法。
- 已将profile五份安装配置原字节备份到项目.scratch/runtime/daily-install-20261017-261001dc-7c75-4cc7-8dae-3d77eaf51977/backup（忽略目录，不入Git），不读取/备份凭据或用户会话正文，不启动npm dev/start。接下来只添加Redis及处理确实阻止启动的既有配置问题，保持宿主兼容检查。

### 日常安装：包落盘，恢复profile启用清单
- 官方plugin add的pnpm步骤17秒完成，Redis0.1.0已落盘，但随后既有Git Graph缺package.json导致全profile reconcile退出1；没有把该命令整体误记为成功。93份实际安装文件逐字节/长度/SHA全部匹配b21a919b已验收包。
- 初次在工具内嵌Node运行时直接import官方operations被其模块解析器以缺execa拒绝，发生在配置写入之前；改为本机Node独立进程加载同一官方saveManifest/withFileLock，不继续修补工具模块路径或改宿主代码。一次验证读取使用了未保留的嵌套作用域变量，前置拒绝未写入；随后从已归档manifest重新读取。
- 在官方原子锁下仅调整dsh.profile.bundles：保留base/web-app并启用dsh-redis，暂时停用既有dsh-input-plus/dsh-web-search（rc.6 peers）与dsh-git-graph（原路径缺元数据）。原三项dependencies逐项完全保留，未改其源码、个别配置或兼容豁免；五份配置备份已保全。
- 产品代码未变；接下来启动用户正式web profile验证真实Redis侧栏，不连接业务Redis、不发送模型消息。

### 正式安装完成与真实数据可见性核对
- 正式web profile的93文件与b21a919b包逐SHA一致，保留原依赖并仅调整启用列表后，日常DSH真实启动成功：Host已注册、页面Redis入口/Host就绪/连接配置可见；127.0.0.1:7198、PID 37976。用户应用保持打开，未启动npm开发服务或额外Redis夹具。
- 用户提供RESP真实数据截图后，用可见UI状态反馈复现“只加载102、可继续扫描”。只点击左侧只读继续扫描，观测202/302/402/504/605/705/760，最终扫描完成，与RESP总数一致；原因是显式增量SCAN和目录仅统计已加载Key。右侧Hash字段独立分页。本次未改源码、Redis值、地址/DB/MATCH，未填写密码或发送模型消息。
- 新增docs/verification/daily-install-2026-10-17.md与artifacts/daily-install-2026-10-17的无秘密安装报告/首次失败原始控制台，记录3个旧插件暂时停用、依赖/配置保留、备份位置、实际Node准备/启动等待失败及最终恢复方式。认证启动URL、私有备份、业务Key/值/截图不入Git。
- 产品包未变，93文件再次核验；本轮仅安装与诊断文档，按最简原则不重复执行产品编译/296测试。接下来检查文档链接和Git差异后，按小目标本地提交，不push。

## 2026-10-17 RESP操作方式与自动Key加载：开始
- 用户明确要求RESP式连接→DB→目录/Key统一导航树与右详情，当前DB自动分批加载、总数/进度/取消，并另确认右侧集合滚动自动续读；覆盖旧手动逐页与三栏表单规则，原29票历史证据保留。
- 新增docs/RESP_WORKBENCH_PLAN.md跟踪三个小目标与实际验收；新增src/client/key-loading.ts顺序游标加载/有界缓存/取消迟到隔离/1000页或60秒新页预算和精确进度计算，新增10项模型行为测试。无后台连接、写命令或真实业务数据使用，接下来立即严格类型检查，再建立同逻辑内存原型。

### 自动Key加载纯模型通过
- 三层严格TS与10项自动加载模型专项通过，760个Key不重叠顺序8批完成、空页不提前终止、字节去重、取消后无迟到发布/后续派发、缓存/时间/页预算和异常停止均覆盖。
- 同一纯模块内存原型已捕获prototype/resp-db-key-workbench/db72a922be09af61a7f3a325ef411251fda30e1f，源码HTML壳不进main；三个引导与自由操作只演示状态，当前不声称数据库计数或正式界面已完成。准备将该小目标单独本地提交，再接Host目录和RESP UI。

## 2026-10-17：DB目录与数量快照实现

- 新增 domain 数据库DTO、redis-databases纯解析和Host database-reader，读取固定DBSIZE、INFO keyspace、CONFIG GET databases；保留64位数量文本和未知状态。
- typert shared/host/remote-client、remote-service注册严格readDatabases；redis-transport限制新增命令形态，所有者/代次/DB/期限复用RedisReadContext。无通用命令入口、无配置写入。
- 依据Redis官方DBSIZE、INFO、CONFIG GET文档；影响为导航可获得真实DB数和计数快照。编译和专项验证随后记录。

- 首轮全量检查发现旧browser-bundle测试固定27个RPC；已更新28并增加真实loopback命令形态测试，拒绝CONFIG SET/通配/额外参数、DBSIZE额外参数和INFO任意section。

- DB目录里程碑：Host/Client/tests严格类型通过，31个测试文件/315项通过；固定元数据命令真实loopback形态、ACL未知、64位精度、取消/错误代次/10秒期限与双面DTO均已覆盖。原始检查日志保存docs/verification/artifacts/resp-workbench/database-check.log。此时尚未接入UI。

## 2026-10-17：RESP 导航与自动扫描接入

- KeyBrowser接入单链自动加载、DB快照、数量/进度/停止状态，连接与DB/会话变更取消；筛选草稿只在提交时生效，移除手动Key续扫。
- KeyCatalog在一个虚拟列表内展示DB/目录/Key，按文件夹优先和名称排序，计数和状态显示真实已读范围。ConnectionForm/ProfileChooser移除独立连接列，继续使用原有设置弹窗。
- 显示只移除外层引号，控制字符转义与原始Base64身份保留；新增中英文加载状态。布局和右侧续读继续接入。

- styles改为单连接导航加详情两栏，新增DB行/Key黄色图标、计数与底部加载进度；集合表格固定字段宽度、单行省略/横滚，不再挤成多行。
- CollectionTable增加以本表视口为root的底部观察器；useCollectionScan同步锁防同游标重复，延续既有取消/错误/缓存限制并加本轮1000页或60秒停止。Hash/Set/ZSet/Stream/TimeSeries移除继续按钮并接入自动续读；ZSet范围偏移只在本地转换，未混入Host扫描令牌。

- List/GEO复用新增通用有界row-cache保留原始索引/成员身份追加读取；ZSet rank范围同样滚动续读。右侧上限按1000页及现有行/字节预算，不按用户停留时长中断正常浏览。新增范围缓存与RESP排序测试。

- 单元格值预览直接显示安全文本，不再二次JSON编码产生大量反斜杠；完整值/字节覆盖仍由点击详情显示。Hash同时显示已读/集合总量，续读提示改为“滚动到底自动加载”。

- 新增smoke-resp-workbench.mjs与隔离原生模式，种入760 Key、235/236行基础/特殊集合、空DB/独立DB/5100Key大库；通过现有只读延迟代理验证取消、旧DB回复、实际两栏和滚动，无业务库写入。待运行通过后记录结果；旧29票报告保持历史。

- 首轮原生测试已装入新包并实际加载760 Key；验收窗口1440限制800侧栏拖宽，测试停在尺寸步骤，所属DSH/Redis/代理均已释放。专用模式改用1920测试窗口并按选中DB身份等待扫描结果。
- 实际截图发现单Key前缀仍形成多余目录；KeyNamespaces显示层压缩单成员目录为完整剩余Key，原始字节路径不变，多成员分组保留。同步排序与深路径测试。

- README同步两栏导航、自动Key扫描与DB快照、右侧滚动、单Key目录压缩和真实预算；文档明确MATCH分母、未知权限与动态数据边界。目录压缩专项9项及类型已通过。

- 第二轮原生启动在进入夹具前发生Node ArrayBuffer分配失败，未留下新owner目录或测试服务。只读核查主机仍有约7GiB可用提交内存；将单个验收进程堆预算由512MiB调为1GiB再运行，不终止其他Node进程或修改系统设置。

- trace-uncaught已定位真实原因：隔离profile因同名同版本tgz复用旧安装，verifyInstalled对不同大Buffer调用deepEqual时，Node断言Myers差异分配失败；不是插件或Redis读取OOM。保留逐字节真实性校验，改为Buffer.equals，并使用SHA命名新包安装。前述加堆预算未解决，停止该方向。

- 哈希包重装后真实原生浏览验证已通过760自动Key、236行Hash/Set与235行List/ZSet/Stream/TimeSeries/GEO、原始数据DUMP不变及空/独立DB。脚本取消控件错用英文Cancel（实际Cancel read），已按实际词条修正；增加右侧取消迟到与Set空中间页验证。失败轮次服务/夹具均已清理。

- 原生进阶轮次已通过Hash取消迟到、Set空中间页、Key取消和恢复、DB所有权切换、大库5100→5000明确部分状态；停止在筛选按钮名称。发现KeyBrowser筛选复用了namespace.apply词条，实际为应用分隔符；改为独立workbench.apply（应用筛选/Apply filter），同步原生脚本真实文案，所属服务均已清理。

- README补充同版本更新必须使用唯一哈希文件名，避免已复现的旧包复用；最终包重新执行默认prepack门禁。

- 最终SHA 4a9660dfbdedac5608ee0876dbf39f02854ed9bd893e0e5d3c7298ba416c5a87：默认pack前置严格类型/构建/318项通过，真实原生RESP模式29项通过（含7类集合、取消迟到、空页、DB切换、5100预算、MATCH与4种宽度），测试DSH/代理/Redis均已停止。
- 差异检查清理KeyCatalog一行尾部空白；重新类型检查和构建，并核对生成lib仍与已验收安装包逐字节相同。验收记录与日常更新继续归档。

- 已归档本轮原始类型/构建/318测试/29原生报告、Host日志和合成Hash截图到docs/verification/artifacts/resp-workbench，新增resp-workbench-2026-10-17.md逐文件说明、实现/操作、执行范围与预算。原29票历史证据保留，当前包未冒用旧原生模式的结果。

## 2026-10-17：日常DSH更新与真实数据回看

- 先备份实际web profile的5份安装/运行清单，再核对旧PID/7198所有权后更新SHA唯一包并隐藏重启，保留原origin和会话页；只有package.json、pnpm-lock.yaml包引用发生变化，其他依赖、启用bundles和cordis配置不变。
- 验证97个包文件及88个lib文件匹配SHA4a9660df…；12 Host peers/2依赖/180源码输入记录package-manifest.json，未放宽旧插件兼容或安装检查。
- 实际浏览器恢复原127.0.0.1:6379连接，不录入密码；真实DB0自动760/760、100%完成，树导航、0告警、0继续按钮。只将计数写入daily-install.json，业务Key/值和私有认证启动日志不进入Git。
- docs/RESP_WORKBENCH_PLAN.md全部跟进项完成；resp-workbench-2026-10-17.md补充具体profile变化、备份、服务身份与真实查看。测试DSH/代理/Redis均已停止，用户日常DSH继续运行供实际操作。

## 2026-10-17：启动日常 DSH 与界面细节调整

- 用户要求启动查看，复用既有隐藏启动器在 127.0.0.1:7198 启动正式 web profile；实际界面已连接本地 Redis，DB0 为 760/760、100% 完成。启动日志与含业务数据截图留在忽略目录，不入 Git。
- 用户随后要求独立图标/非红黄配色、字段详情不再从下方挤占视图、连接界面整理。新增 docs/UI_REFINEMENT_PLAN.md 跟踪本轮范围、步骤与验证；原整体两栏、只读接口、原始字节身份和凭据边界保持。
- 代码只读核对由用户指定 GPT6 LUNA 提供文件/调用事实，主模型完整核对相关实现并负责设计与修改。发现详情为表格后方 inline preview，分隔符使用绝对定位帮助层；连接为原生 dialog 和现有显式连接流程。未执行网页端 GPT 评审。
- 新增本地内存交互原型 .scratch/artifacts/redis-ui-polish.prototype.html，展示三种字段详情结构及连接整理；采用用户要求所对应的独立详情页。原型不访问 Redis、不保存配置、不进入正式安装包，待独立 prototype 分支归档。

### 原创图标、配色及目录设置

- 原型已保存在 prototype/redis-ui-polish（8206238），正式 main 只保留方案，未加入演示代码。
- src/client/Icon.tsx 改为自绘的分区 DB、分组目录、数据标签 Key，新增返回箭头和稳定 data-icon 标识；styles.ts 使用青绿/灰蓝/淡紫主题变量及轻量选中背景，移除红色 DB、黄色目录与实心蓝选中覆盖。
- src/client/KeyCatalog.tsx 将分隔符设置从绝对定位帮助层改为导航栏内展开，应用后关闭，说明按需展开；不覆盖表格或目录，校验与分组算法不变。随后立即执行严格类型检查。
- 本小目标 Host/Client/tests 三层严格类型检查通过；原生显示与交互和后续字段详情一起验收，尚未更新日常安装包。

### 字段详情改为右侧独立页面

- 新增 src/client/DetailPage.tsx：共用区域内返回入口、标题与焦点恢复，不添加路由、弹窗或新读取；原表格保留挂载。HashView/ListView/SetView/ZSetView/StreamView 复用此组件，Stream 增加消息→字段→值的逐级返回。
- CollectionTable.tsx 增加 paused，详情打开时断开自动续页观察，原先已开始的单个请求仍按既有取消/身份规则处理；返回后恢复原游标续读。styles.ts 同一右侧区域一次只显示一个内容页；Base64 身份默认折叠，已有 Text/JSON/Hex/Base64、搜索/复制保留。
- locales.ts 添加中英文返回文案；Host DTO、数据读取和只读边界未变。随后立即执行类型检查，再通过原生测试实际核对滚动/焦点。
- 字段页面首次三层严格类型检查已通过；继续连接表单整理后一起执行真实原生回归。

### 连接配置分组与交互说明

- ProfileChooser.tsx 继续使用原生 dialog，标题增加自绘图标和简短说明；内容分为资料侧栏与连接信息，底部折叠导入导出，窄窗口自动上下排列。保留原生 label、错误/忙状态与资料选择不连接的语义。
- ConnectionForm.tsx 以服务器、认证和 TLS 分组，连接/测试动作靠右；增加密码仅本次使用的提示与未连接空态。已连接时明确先断开才能编辑，并复用同一个 disconnectCurrent 动作，消除重复断开处理。
- styles.ts、locales.ts 同步布局/主题及中英文说明；无新依赖、无密码持久化、没有更改 TLS 验证或 Host 返回 DTO。随后立即运行严格类型检查。
- 完整严格类型/构建/318 项回归通过。pnpm pack 不支持 --ignore-scripts，首个命令在解析阶段退出，随后按现有默认 prepack 门禁重新打包通过；候选 SHA256 为 162c5d13644512916a0183889b9f3e54dcd758ff3195daabf09dd111b64645a8，已用唯一文件名安装到隔离测试 profile。
- 为本轮真实 UI 查看在忽略目录新增 ui-refinement.manual.mjs，仅启动现成独占 WSL Redis fixture 与隔离 DSH，验证安装 lib 后等待停止标记；浏览器操作通过 cua_repl 执行。只向新建测试库准备合成数据，用户 6379 数据库和日常 profile 此时未更新。
- 首轮原生核对已验证连接测试/连接、TLS 输入切换、760自动加载、目录设置 static 且紧贴列表不覆盖、详情 static 且表格隐藏与续页暂停、JSON切换与焦点返回。返回像素位置核对观察到滚动偏差，CollectionTable 因此显式保存自己的纵横滚动并在返回时恢复，不依赖隐藏元素的浏览器锚定；随后重查类型并重新构建候选。
- 首轮独占 DSH/Redis 已正常停止，新建 fixture 目录按所有权清理；两个历史受限 fixture 未触碰。README.md 同步独立详情返回、暂停续页、Stream层级和连接分组/断开入口；不以旧包报告替代本轮结果。
- 最终交互候选6d3b5be6通过16项cua原生专项：Hash实际鼠标返回前后scrollTop均2272且焦点回原字段；详情静态布局/隐藏表格/暂停续页；二进制FF00；Set/List/ZSet返回、Stream逐级返回；元信息切换；467.56px侧栏两区无重叠/外溢；中文暗色/浅色740px连接框；关闭清密码、断开后编辑、760自动扫描、目录栏内展开与三色图标。7份源DUMP逐字节未变，测试DSH/Redis已停止且新夹具已清理。
- 截图与无秘密报告保存docs/verification/artifacts/ui-refinement。源码/候选安装的97包文件、88lib、12Host peers/2依赖逐文件/版本核对通过；16专项对应6d3候选，不冒称本次重跑原29项RESP完整模式。
- 截图复核发现两条遗留帮助与当前行为冲突，locales.ts 中英同步缩短并更正自动分批扫描和名称排序说明。此后只重查类型、最终包/安装及实际帮助显示，不重复未受影响的集合行为测试；报告保留候选SHA边界。

### 本轮完成：最终安装、真实字段查看与本地提交

- 实现小目标已本地提交74a8076；图标/目录设置为3bc75a5，方案为910e6ac；原型独立8206238，均未推送。
- 最终文案修正包61d18726a59c7e35500f33256f62faa2a571f2a72b2fa724f73d186f9422aabd通过默认prepack的三层类型/构建/318回归，隔离和日常安装逐97文件校验通过；12Host peers/2依赖版本不变，最终与候选清单分别保全。
- 新增docs/verification/ui-refinement-2026-10-17.md详细列出文件/原因/影响、16原生专项、318回归、7 DUMP不变、明暗截图与检查边界；UI_REFINEMENT_PLAN全部勾选。原生行为专项对应6d3候选，最终仅帮助文案变化，在日常实际核对新帮助，不冒称重新运行整套16或历史29原生模式。
- 日常profile五清单原字节备份在忽略目录，安装命令exit0，仅package.json与pnpm-lock.yaml包引用变化，其他依赖/bundles/cordis不变。确认PID16772和7198所有权后隐藏更新启动PID35240，应用继续保留供用户查看。
- 日常实际127.0.0.1:6379恢复成功，DB0为760/760、100%、无继续按钮；当前已打开真实字段的静态详情页和返回按钮。凭据未填写、业务值只读；只存计数/行为，业务Key/值/截图与启动token不入Git。全部自建测试DSH/Redis已停止并按所有权清理，未启动npm dev/start或触碰旧受限夹具。
- 最后一次浅色外观验证影响了当前显示；已通过日常可见设置恢复用户原深色，实际主题背景rgb(21,21,23)、强调色#79c6b6，关闭设置并保留字段详情页。仅为测试状态恢复，源码未变；daily-install.json补记theme=dark。

## 2026-10-17：图标、帮助与 RESP Hash 对比审阅

- 用户要求先看多组更鲜明的 DB/目录/Key 图标，逐项审视圆圈帮助，并研究 RESP 2022.2 Hash 表格与双预览。新一轮先交付研究与交互样例，等待用户选择；不修改正式插件源码或安装包。
- `docs/HELP_UI_AUDIT.md`：核对 17 处 JSX / 19 个功能帮助场景 / 34 个不同正文 key，逐项列删除、移动到文档、改为上下文短标签的方案。明确保留真实失败/部分状态、按钮名称、估算等必要语义；不会删除底层读取限制和只读控制。
- `docs/references/RESP_HASH_SOURCE_REVIEW.md`：固定 RESP 2022.2 SHA，核查原表格、两个 MultilineEditor、选行联动和上下分区的真实源码；区分原版写入/分页与本项目已确认只读/触底续读。给出复用 Hash 缓存、字节身份、BytePreview 的实现步骤及待执行验收点。
- GPT6 LUNA 仅提供帮助调用及上游源码/图标路径事实，主模型核对实际文件并负责结论；官方仓库只读副本、过程清单保存在忽略目录。未执行网页端 GPT 评审、npm dev/start、Redis 写入或依赖安装。
- 文档小目标完成差异/空白检查；本小目标仅修改两份新文档与本更新日志，没有 TypeScript 源码变更，因此未把历史类型或浏览器测试冒称为本轮结果。
- 交互样例 `.scratch/artifacts/icon-hash-lab.prototype.html` 提供 Tabler 实心、Phosphor 双色、自绘双色、Tabler 描边四组图标，16/20/24px 与树行同屏；另有三套高饱和配色和深浅主题。DB 不红、目录不黄。所有图标、样式、交互及 MIT 许可内嵌，不新增运行依赖。
- Hash 样例 A 为上表格/下字段和值固定分区；B 为下方并排预览，C 为左表右预览，B/C 窄栏均退为上下。支持演示行选择、独立 Text/JSON/Hex/Base64、二进制/空值、局部滚动、本地搜索、460px 与比例选择。全部合成数据，没有触碰真实 Redis。
- `.scratch/artifacts/icon-hash-comparison.png` / `.svg` 为同组图标和三布局的静态示意，PNG 1440×1136，已渲染人工查看；不是已安装插件截图。`ICON_LICENSES.md`、`ICON_HASH_PROTOTYPE.md`、`build-icon-hash-lab.cjs` 随原型保存完整许可、源 SHA、操作/边界和生成方法。
- 内联脚本语法、4×3 图标角色、许可、无外部运行脚本/网络调用/占位符核对通过。首次原型差异检查仅发现上游 SVG 带入行尾空白，已在生成器清理并重渲染，随后检查通过；本轮未做真实浏览器/DSH/Redis 验收，未启动任何服务。
- 六份原型交付物已本地归档 `prototype/redis-icon-hash-lab`（`5ddac110d15d5ecea2288db67465c84be7fab22c`），主分支不包含原型代码。`docs/ICON_HASH_VISUAL_REVIEW.md` 保存可点击交付物、组合选择、验证范围和后续清单；用户选定前不修改或重装正式插件。原日常 DSH 继续可用，无本轮测试服务需要停止。

## 2026-10-18：采用 Phosphor 青紫橘与 RESP Hash 操作

- 用户明确选择 Phosphor 双色第 2 组及青/紫/橘配色，并要求参照 RESP 截图和 DSH Database 的实际操作；新增 `docs/RESP_OPERATION_REFINEMENT.md` 记录已确定目标、步骤和待验收项，不再提供多套 Hash 操作让用户猜选。
- `src/client/NavigationIcon.tsx` 新增四个固定来源的内联 SVG（DB、关闭/打开目录、Key）；`Icon.tsx` 将导航形状交给该模块，移除旧方块/标签绘图，其他工具图标沿用原实现。没有引入图标运行依赖。
- `src/client/styles.ts` 使用青 DB/强调、紫目录、橘 Key，深浅主题分别采用已选原型配色；导航 17px 保证小尺寸识别，双色填充与原工具描边分开。`THIRD_PARTY_NOTICES.md` 及 `licenses/phosphor-icons-MIT.txt` 保留完整许可和来源。随后立即运行严格类型检查。
- 图标小目标三层严格类型检查通过；仅对已确认图标/配色作正式修改，实际原生外观将与 Hash 新操作一起核对，尚未安装本轮包。
- `HashView.tsx` 改为 RESP 固定表格/字段/值三分区，字段原始 Base64 仍是行身份，选行只改变本地预览；两处格式独立。新增只查已加载字节的本地搜索，搜索期间不触发后续页；服务端 MATCH 改为显式展开/提交的草稿，输入不清空现有数据。计数拆为已加载和全部字段，避免错误匹配分母。
- `CollectionTable.tsx` 增加可选整行选择、显示序号所需 render 索引、空态和局部键盘导航；不改变其他类型的详情行为或读取边界。`BytePreview.tsx` 将六种已有格式统一为单个下拉，支持带字段/值名称及字节数的紧凑标题，复制/查找/JSON折叠仍复用原功能；`native-view-controls.mjs` 同步新的格式控件。
- `styles.ts` 给 Hash 正常布局的三个区域分配高度、各自滚动，移除 Hash 对独立 DetailPage 的使用；`locales.ts` 中英同步搜索、筛选、刷新、空态和计数名称。随后立即严格类型检查；真实原生操作验证继续进行，尚未将本轮包更新到日常 DSH。
- Hash 核心首次三层严格类型检查通过。`RedisWorkspace.tsx`、`AutoRefresh.tsx`、`KeyCatalog.tsx`、`KeyDetails.tsx` 去除本轮主操作链的四个重复帮助入口，Hash 已去除本身入口；底层自动刷新/读取限制与条件错误保留，其他类型的专用帮助按既有审查分阶段处理。
- `BytePreview.tsx` 清理空搜索时重复作用域文字，Hash 状态显示真实 Key TTL；`styles.ts` 删除两处旧绝对定位帮助规则和被新规则重复覆盖的格式样式。新增 `docs/references/DSH_DATABASE_REDIS_OPERATIONS.md` 核对固定来源、实际 Hash 接线与本轮实现取舍；不把上游截图 String/JSON 冒称 Hash，也不复制写操作。
- `locales.ts` 中英删除六组已无调用的长帮助正文；共享 `hash.identity` 仍供 Stream 使用而保留。`KeyBrowser.tsx` 聚焦详情优先进入 Hash 值预览；原生脚本 `smoke-dsh.mjs`、`smoke-focused-value.mjs`、`smoke-resp-workbench.mjs` 同步新 Hash 刷新/筛选、双预览作用域及触底操作，不再依赖已移除的 cell 详情页或续扫按钮。脚本修改不表示已经执行；马上进行类型、构建和现有回归。
- `pnpm check` 通过：Host/Client/tests 三层严格类型、standalone 构建、32 文件 / 318 项现有回归。Hash 操作与主链提示小目标据此本地提交；布局、真实鼠标/键盘和滚动行为另做隔离 DSH 验证，不以此回归代替。
- 首个交互候选 SHA256 `10c380a0115f519ed33bfaa7d2f805c7a65cb79cb22c0d6533023af112ae5c8d` 通过默认 pack 门禁并安装到隔离 profile，88 个 lib 逐字节匹配。忽略目录 `hash-operation.manual.mjs` 仅启动独占 Redis/延迟代理/DSH，CUA 实际操作；240 字段、匹配100/空匹配、取消迟到、二进制、131073大值部分覆盖、无损JSON和复制/查找、896/464px 两种宽度均实际核对。7 份源 DUMP 不变、代理无写命令/KEYS/协议错误；所属三服务与新fixture已正常清理。
- 原生核对发现旧通用 metadata 选择器优先级导致 Hash 重复显示 TYPE/TTL，现从原规则排除 Hash；本地搜索状态不再误写“滚动加载”。`HashView.tsx` 明确空字段/空值显示，按原始字段身份重建预览局部状态，切行不残留上一行查找和滚动；`BytePreview.tsx` 只在查找打开时高亮，关闭立即清除。两个格式仍由父组件独立保存，表格不重建。随后立即类型检查并准备最终候选复核。
- `README.md` 同步实际 Hash/其他集合操作差异及统一格式下拉；两份先前审查/对比文档追加本轮实施进度，明确剩余14个专用帮助场景仍保留，未宣称全量删除。
- 最终包 `79ce59fb8c0aa1a1098bbae379669d884cf0b08f711ecea7f6175d55b95df048` 再次通过默认 prepack 的三层类型、构建、32 文件/318 回归。按用户“启动项目，实时看更新”要求，备份个人 web profile 的五份清单后更新；确认旧 PID35240/7198 所有权，仅停止所属进程树并隐藏重启为 PID45416，保持 127.0.0.1:7198。没有运行 npm dev/start:dev。
- 最终 98 个包文件与日常安装逐字节一致，88 个 lib 同时与当前构建一致；仅 package.json/pnpm-lock.yaml 插件引用变化，其他依赖、bundles、cordis 不变。打包根清单按 pnpm 发布规范变化，不能直接与源码清单作字节比较，记录以 tarball 为准。
- 最终原生页面已手动恢复 127.0.0.1:6379、DB0 的 760/760，并打开真实8字段 Hash；确认 Text/JSON 两种独立格式、固定三分区、metadata 不重复、关闭查找清高亮、切行重置查找且保留格式。真实业务内容、截图、认证 URL 和安装备份仅留忽略目录；应用窗口保留给用户查看。
- 新增 `docs/verification/hash-operation-2026-10-18.md`，逐文件说明修改原因/影响、候选11项CUA检查、最终复核和边界，配套无秘密包/命令/清理报告；完成 `RESP_OPERATION_REFINEMENT.md` 清单。临时三服务已清理，用户日常服务按明确启动要求保留；后续小目标通过检查后构建/安装并刷新，同步窗口，不声称具备源码自动热更新。

## 2026-10-18：统一 List / Set / ZSet / Stream 选行操作

- 用户要求四种集合与 RESP 的操作方式一致：选中一行即固定显示详情，保持表格与滚动，不再往返详情页；附 DB 工具栏截图要求核对操作。新增 `docs/COLLECTION_INLINE_PLAN.md` 跟踪步骤、原始身份、游标/取消、宽窄及真实验证范围。
- 大量代码探寻按用户要求由 GPT6 LUNA 仅提供实际调用事实，主模型完整阅读相关视图及共享模块后负责实现。复用既有 CollectionTable / BytePreview / DTO / reader，不引入另一套读取或兼容层；不在未明确要求下新增 Redis 写入操作。
- `ListView.tsx`、`SetView.tsx`、`ZSetView.tsx` 改为整行选择及固定表格/预览；选择按原始索引/成员 Base64，无额外网络请求，不再暂停可见表格的续页。显示空成员/空值、原始分数及真实字节覆盖，换行通过原身份重置预览局部状态。
- List/ZSet 先校验范围再清选择；Set/ZSet MATCH 分离草稿和已提交 pattern，queryKey 由提交状态驱动，打字不清空缓存。ZSet 保留排名区间、ZSCAN、GEO 现有入口，两个游标语义不混用。
- `styles.ts` 将 Hash 既有固定预览样式共享给三种集合，新增两区网格及就近工具/状态；数据页隐藏重复 metadata，元信息页仍可查看。`locales.ts` 补中英空成员和选行文案；删除三页旧详情跳页/冗余帮助调用。立即执行三层严格类型检查，原生操作稍后独立验证。
- List/Set/ZSet 小目标 Host/Client/tests 三层严格类型检查通过，按用户要求本地提交，不推送；尚未将此中间包安装到日常 DSH，等 Stream 同屏完成后一并专项验证和同步。
- `StreamView.tsx` 移除消息/单元格双层详情页，消息列表、字段对表格和字段/值预览同屏；选消息默认显示首字段对，选字段对同时更新两个预览，身份为消息 ID+字段出现序号，重复字段名不合并。字段与值格式独立，换行重置局部状态，不新增读取。
- Stream 范围/批量输入收纳到明确工具入口，草稿提交后读取并收起，方向选择、刷新和取消就近显示；消息表选中时继续正常触底读。`styles.ts` 增加四个独立区域及字段表局部滚动，`locales.ts` 添加对应中英文。立即重查三层严格类型，窄屏和原生操作随后验证。
- Stream 首轮三层严格类型通过。确认全项目无调用后删除 `DetailPage.tsx`，`CollectionTable.tsx` 删除无调用 paused/隐藏恢复分支，所有集合保持可见表格的自身滚动；清理旧隐藏页/返回 CSS 及中英无调用 hint、身份和返回文案。Geo 仍使用的成员身份及 inline 预览样式保留；`KeyBrowser.tsx` 聚焦优先进入 Stream 值预览。再次立即严格类型检查后本地提交本小目标。
- 清理后三层严格类型再次通过。`README.md` 更新四类型同屏流程、MATCH 草稿语义和查找状态；`HELP_UI_AUDIT.md` 记录本轮四场景/十组正文清理及剩余8 JSX/10功能场景。新增 `docs/references/RESP_DB_TOOLBAR_COMPARISON.md`，按固定源码列出截图七项、当前已提供的筛选/刷新、其余缺项与后续方案；明确 DB 列表实时更新不等于 Key 内容自动刷新，未新增控制台/内存扫描/写入入口。
- 四集合最终候选 `34e7cb8351c04d25c3911b53736589c6a307bb3348ddb5086515d62e99e5c941` 已通过默认 prepack 的三层严格类型、构建、32 文件 / 318 项测试。List/Set/ZSet 小目标本地提交 `0a8c1b1`，Stream/共享清理本地提交 `53ab6f5`，没有推送。
- 本次独占 Redis 8.2.6 + 原生 DSH 的 CUA 专项13项通过：List241、Set238、ZSet237、Stream235 行选中时继续加载；二进制、空成员、重复索引/字段、无损 JSON、部分字节、MATCH/范围草稿、取消迟到、Stream逆序/元信息及464px深浅布局。7份源DUMP和消费组状态未变，代理只观察到允许的读取命令；本轮所属DSH/代理/Redis均已停止，新建fixture已清理。先前中断轮次没有完整结束报告，不作为本轮验收证据。
- `scripts/smoke-resp-workbench.mjs` 补充四集合选行不读取、固定表格/预览及续页保留选择断言。只做脚本语法检查，不冒称本轮执行了该 Playwright 全模式；本轮浏览器动作通过 CUA，历史独立模式不计入本轮通过项。下一步核对日常 profile 备份和安装字节，再保持7198供用户查看。
- 日常web profile五清单已原字节备份，安装上述SHA唯一包exit0；逐98包文件及88lib核对通过，仅package.json/pnpm-lock.yaml引用变化，其他依赖/bundles/cordis未变。恢复时7198无监听，隐藏启动PID11652并实际打开，保留供用户查看。
- 当前本机127.0.0.1:6379无监听，原生连接实际失败；未填写凭据、未启动或修改用户Redis，不宣称真实760 Key已恢复。`daily-install.json`如实记录connected=false及原因，业务资料和认证/安装私有输出不入Git。
- 新增 `docs/verification/collection-inline-2026-10-18.md` 逐文件说明原因/影响、13项实际CUA专项、318回归、只读/清理和日常连接边界；归档合成截图、原生/命令/清理及包文件报告。`COLLECTION_INLINE_PLAN.md`清单完成，测试三服务已停止，仅按用户要求保留日常7198；最后执行语法与差异检查后本地提交验证小目标。

## 2026-10-18：状态文字与控件呈现审查

- 用户要求先检查自动刷新等功能把状态文字堆到界面的问题，并给出具体改法。本轮只读审查正式组件；GPT6 LUNA收集组件/文案/状态条件事实，主模型核对实际AutoRefresh、时钟状态、共享格式器、主链和CSS后负责审查结论。
- 已定位自动刷新按钮/间隔/启停状态/成功时间多处呈现，CSS将每个small强制独占一行；同时核对集合计数、TTL、各类读取时间、Host版本常驻、复制反馈、进度和专用类型帮助。没有把视觉隐藏h2或元信息页重复字段误算为数据页常驻重复。
- `.scratch/artifacts/build-status-ui-prototype.mjs` 生成独立交互样例 `status-ui.prototype.html`，以合成Hash工作台比较就近收纳、顶部集中、底部状态台三种结构；保留青紫橘导航图标和完整Phosphor许可，状态、明暗、464px与当前样式可切换。只在内存演示，不连接Redis、不安装插件、不访问剪贴板或保存业务数据。
- 本轮遵循最简原则，只拟调整信息层级、按钮反馈与状态呈现，复用原有enabled/busy/reason/intervalMs/sampledAt。失败、权限、未读完整、估算/可能存在和已提交范围的必要语义保留；正式源码、读取约束、日常7198运行状态暂不修改。原型先做脚本语法与静态检查，再独立分支归档并提交本地审查文档。
- `docs/UI_STATUS_PRESENTATION_AUDIT.md`按15类问题列真实位置、改法、保留语义与P0/P1顺序，建议A就近收纳；标明视觉隐藏标题/元信息页不是数据页常驻重复，自动刷新停止原因需结合ready和当前结果解释，避免历史失败误报为当前失败。没有增加倒计时、RPC或新的状态机。
- 原型生成器、内联脚本、内嵌导航图标/许可/无外部资源或数据访问静态检查通过；初次PowerShell原型文本整理命令在解析阶段退出，随后用明确字面量的Node整理并重生成通过。内置浏览器拒绝本地file协议，未用服务器/其他浏览器/间接执行绕过，未声称运行布局或截图通过；交付HTML供用户双击比较。
- 样例说明和静态报告分别保存在 `.scratch/artifacts/STATUS_UI_PROTOTYPE.md`、`status-ui-static-check.json`，与生成器/HTML一起单独归档原型分支；主分支只保留审查与更新日志。本轮没有正式TS变更/插件重装、没有重新执行318回归或新服务，日常页面只读观察后保留。
- 原型小目标已本地提交 `prototype/redis-state-controls / ab858f9`，随后回到main，忽略目录保留可双击副本。审查文档和本日志经差异检查后独立提交；没有将演示代码放进主分支或安装包，没有推送。

## 2026-10-18：实施A方案P0+P1状态控件

- 用户已确认按A方案直接实施并更新日常DSH；新增 `docs/STATE_CONTROLS_IMPLEMENTATION_PLAN.md` 跟踪七个小目标。以6233a26为实施起点，复用真实DTO/时钟/游标/取消；大量源码只读探寻由GPT6 LUNA提供事实，主模型负责判断和修改。
- 小目标1：`AutoRefresh.tsx`移除自动刷新的正常状态/时间行，提供组合图标开关+秒数选择和正常文档流中的按需读取详情；`KeyBrowser.tsx`将provider提升到当前Key整个详情区，控件放在页签右侧，保持原始身份卸载边界。没有修改AutoRefreshClock或增加计时器/RPC。
- `BytePreview.tsx`复制成功改为原按钮1600ms对勾，失败保持可见短提示；每实例独立，切行/格式/卸载清定时和迟到结果。`Icon.tsx`补时钟/暂停/勾/警告/锁，`styles.ts`重排控件与内联详情/无障碍隐藏反馈，`locales.ts`中英同步。立即检查三层严格类型，再本地提交本小目标。
- 小目标1 Host/Client/tests 三层严格类型检查通过；时钟状态机/协议接口未改，原生交互稍后使用同一最终包验证。
- 小目标2：新增 `KeyPresentation.tsx` 只提升当前叶视图元信息到Key标题，按渲染所有者清理，不改变读取结果；`ReadControls.tsx`共用手动读取/取消、范围开关、范围进度和按需时间。`KeyBrowser.tsx`收纳数量/真实进度/筛选标签，避免MATCH分母误报，聚焦时保留DB身份。
- Hash/List/Set/ZSet/Stream移除常驻读取时间、重复TYPE/TTL和正常长状态；保留数量、范围、分数、原始身份、部分状态、错误和触底加载。List/Set/ZSet范围/MATCH按需展开，独立刷新读取已提交条件；Stream移除重复未选消息提示。`styles.ts`和中英文文案同步，立即执行严格类型检查。
- 小目标2首次检查发现Stream残留无调用Icon导入，立即删除；随后Host/Client/tests三层严格类型通过，差异空白检查通过。本地提交当前小目标，暂不将中间包安装到日常环境。
- 小目标3：`KeyDetails.tsx`、`JsonView.tsx`、`BitmapView.tsx`统一叶视图元信息上报、就近刷新/取消与按需范围；刷新使用已提交条件，下一窗口不误用尚未提交的count草稿。String保留真实字节覆盖/部分，Bitmap保留位范围与总位数，JSON明确已提交路径、匹配数/字节及元信息中的类型；取消和错误仍可见，去掉常驻时间/busy及三页重复帮助。立即执行三层严格类型检查。
- 小目标3首次检查发现应用按钮使用了不存在的翻译键，立即复用既有workbench.apply；随后Host/Client/tests三层严格类型通过。本小目标本地提交，实际范围/复制/布局在最终原生专项中核对。
- 小目标4：GEO/TimeSeries/HLL/Bloom共用Key元信息和读取按钮，收起范围/查询设置与原始Base64身份，删除重复时间/busy/帮助。GEO保留量化与显式解释短说明，TimeSeries保留范围/总数区别及TS.INFO不可用，图表强调仅已读数据和未绘制数；HLL把估算作为主结果，编码/缓存留元信息；Bloom保留“可能存在/本次阴性”、非精确记录数及权限说明。`styles.ts`/中英同步，立即严格类型检查。
- 小目标4 Host/Client/tests三层严格类型通过；专用reader、命令、协议、缓存和自动刷新生命周期未改。本地提交当前专用类型界面小目标。
- 小目标5：`RedisWorkspace.tsx`用具名锁标记只读，正常Host/基线收进按需信息；`ConnectionForm.tsx`测试结果回到按钮，修改草稿即清除旧通过状态，操作按钮显示自身busy；密码/TLS各留一条就近说明，底栏只保留连接图标/诊断入口/按需状态时间，错误仍可见。`ProfileChooser.tsx`移除重复说明并图标化重载。
- `SnapshotDialog.tsx`及ClientList/SlowLog/Overview去掉重复busy/采样时间行和帮助，改为刷新/取消/按需时间，数量与部分标记就近；慢日志时区移到时间单元格标题。无新的RPC、读取时机、连接动作或Redis写入。立即进行严格类型检查，然后清理无调用帮助和对应文案/CSS。
- 小目标5首轮类型检查暴露底栏连接可空的直接访问，立即使用可空目标读取，随后三层类型通过。确认全项目无调用后删除`HelpDetails.tsx`、帮助/旧底栏样式与17组中英长正文；URI/资料导入导出压缩说明，保留秘密排除、显式预览及CA另填，读取文件状态放在文件控件。`BytePreview.tsx`把跨界字符补全字节收成带完整说明的数量标记。清理后三层严格类型再次通过，本地提交。
- 小目标6首个候选`2e8238da…`通过默认prepack：三层类型/standalone构建/32文件318项回归；隔离DSH+官方Redis8.2.6原生CUA18组检查覆盖连接、自动刷新、复制、集合续读、部分值、特殊类型、权限及464px深浅布局。14份Key DUMP和Stream消费组不变，代理未观察到写命令/KEYS或协议错误；所属DSH/代理/Redis已停止，新fixture已清理。
- 收尾静态核对发现List/GEO失败分支与共享error重复，统一成一处，GEO保留专用oversize说明；连接测试结果由原boolean改为单个passed/failed/null，失败原按钮显示警告并保留详细错误，草稿改变清旧结果。没有改变读取流程；立即类型检查，随后最终包复核失败/成功、共享控件及安装。
- 收尾三层严格类型通过；README、两份审查文档和新增`docs/verification/state-controls-2026-10-18.md`同步现状、逐文件原因/影响、18组候选检查与最终包待验边界。本地提交收尾小目标，再执行最终包专项与日常安装。
- 最终包SHA256 `6194353d9b58f2f74a17fdff00546995ba3488c5646296152b20b511d63fd319`再次通过默认prepack的三层类型/构建/32文件318回归。最终7组原生专项通过：测试失败恢复、List/GEO真实权限错误去重、复制独立反馈、实际定时读取/33px工具带、元信息/Host入口、464px深色及5000/5100部分标记。14份DUMP与消费组不变，所属DSH/代理/Redis停止且新fixture已清理；新增最终合成截图和原生/只读/清理报告。
- 日常五清单已备份，安装唯一SHA包后98发布文件、88lib逐字节相同；仅package.json/pnpm-lock.yaml插件引用变化，其他依赖/bundles/cordis未变。再次核对旧PID11652/7198，停止其所属进程树并隐藏重启PID39180；手动只读恢复真实6379，DB0 760/760和8字段Hash实际可见，JSON值预览正常。认证、业务截图/内容与备份不入Git。
- `STATE_CONTROLS_IMPLEMENTATION_PLAN.md`七步完成，验收文档区分候选18组与最终7组及历史脚本边界；归档最终包清单、安装摘要与原生证据。本轮没有网页GPT评审、npm dev/start:dev或推送；临时服务均结束，明确授权的日常7198和可见页面保留。最后差异/归档检查后本地提交验证与安装小目标。

## 2026-10-19：整理当前功能清单与连接界面说明

- 用户要求统计实际已经实现的功能，并具体列出选择/新建连接界面的信息及客户端连接快照的操作。新增 `docs/FEATURE_INVENTORY.md`，以 `main / 4786a61` 为源码基线，按工作区、连接、连接资料、DB/Key、基础数据、专用查看、内容工具、读取刷新、诊断、会话十个模块整理56项编号条目；明确统计是清单条目，字段和按钮不另行累加。
- 文档逐项列出连接窗口的区域、9个字段、默认/必填/保存语义、测试与连接的区别、首次连接/复用步骤、URI草稿、导入预览和导出内容；区分连接服务器与查看这台服务器的客户端连接快照，补齐快照7列表格+7项详情、慢日志5列及概览4组16字段。
- 完整说明6种基础类型、6种专用查看方式、6种格式、集合选行同屏预览、自动分批/触底加载、条件提交、自动刷新、会话内状态恢复；区分专用解释与独立TYPE、连接资料落盘与浏览状态内存、当前已加载与服务器总量。写入当前未提供的功能，不将候选计划或测试夹具能力算入已实现功能。
- `README.md`增加功能清单入口并明确六种显示格式；静态核对发现慢日志本机日期、参数字节摘要和可用原始参数数位于被共享CSS隐藏的small元素中，因此修正README旧描述、在清单中单列显示缺口，未修改组件或样式。影响仅为文档准确性与可查阅性。
- 大量源码事实探寻由GPT6 LUNA提供描述，主模型交叉核对接线、DTO与CSS后负责清单结论。本次仅文档修改，不启动/停止日常服务、不访问业务内容、不安装插件、不进行网页GPT评审；文档统计、链接及差异检查完成后本地提交，既有原生验收仅作为对应历史证据引用。
- 文档专项检查通过：56个编号唯一且各模块数量一致、服务器概览16字段、35个本地源码/验收链接存在，README入口与六种格式说明一致；`git diff --check`通过。没有应用源码变更，因此未重复执行类型编译、318项回归或原生安装验收。

## 2026-10-19：按56项清单只读审查功能与界面

- 用户要求逐项检查已经实现的功能及操作，重点连接配置、三个快照和小按钮图标，先列问题建议、暂不改代码。新增 `docs/FEATURE_OPERATION_AUDIT.md`，以 `a583214` 为审查基线，为56项分别记录源码/自动化/当前界面证据和待复测范围，整理8项P1、7项P2；未在覆盖范围内发现需立即停用的P0，不把全部异常路径说成通过。
- 连接审查列出保存资料会经select回调清空当次密码、关闭设置后测试标记失效、资料与连接状态并行恢复覆盖草稿、已连接时资料管理全部被禁用；分别说明触发条件、源码位置、影响、最小方案和隔离验收。删除确认、错误分类和非零DB衔接另列P2；没有修改或删除真实资料、切换实际服务器或制造认证错误。
- 当前7198页面实测连接窗口禁用态、客户端快照/选条详情、慢日志空结果和数量草稿显式提交、概览4组16字段及Escape关闭返回。客户端680px表格中ID列185px挤压其他列至约78px，地址/名称/命令省略后缺完整查看入口；慢日志日期/参数长度被共享small隐藏由源码和CSS确认，未为造非空日志修改Redis。
- 自动刷新专项用合成查找词验证：Hash值查找栏在默认5秒刷新后卸载消失，原行仍选中；结束恢复自动刷新关闭、慢日志数量10、关闭全部诊断窗口并保留日常页面。没有把真实Key内容、密码、客户端地址或业务截图写入报告，也未声称抓包或DUMP对比通过。
- 图标审查确认4个导航图标来自已许可Phosphor，27个操作/状态图标仍是本地手绘path，常见26px按钮/14px图标；初报28经逐项统计纠正为27。文档建议保留青紫橘导航、改用官方Lucide React组件并统一语义、反馈和热区。核对官方Lucide/Phosphor文档及web-design-guidelines技能；未安装依赖或更改图标代码。
- `README.md`增加审查入口；`docs/FEATURE_INVENTORY.md`增加当前问题说明、补充保存后重填密码的临时实际操作并纠正GEO为点击成员按钮，保留56项统计。影响仅为文档准确性和后续可执行建议；应用源码、依赖、测试文件及已安装插件未改。
- 本轮 `pnpm typecheck` 三层严格类型通过；`pnpm exec vitest run` 32文件318项通过，没有重新构建/打包或重跑历史原生smoke。大量源码探寻按要求由GPT6 LUNA描述，主模型复核；没有网页GPT评审、npm dev/start:dev、服务重启或推送，测试进程已完成。文档统计、来源链接和差异检查后本地提交本审查小目标。
- 文档专项复核通过：清单与核对表56个编号逐一匹配，8项P1/7项P2与标题和统计一致，27个本地path定义均入图标清单，51个本地来源链接及行号存在。应用代码、依赖、测试与安装文件无差异；本次只提交审查文档、清单勘误、README入口和本更新日志。

## 2026-10-19：评估删除低频功能以收敛范围

- 用户提出低频功能可能增加操作与维护复杂性，希望评估摘除快照、GEO、URI、非零DB偏好等是否更合适。本轮只读核对依赖，由GPT6 LUNA提供描述、主模型做取舍；没有将探讨性问题当作正式删除代码的指令。
- `docs/FEATURE_OPERATION_AUDIT.md`追加第8节精简建议，保留连接资料与手动连接、DB/Key导航、六种基础类型、普通JSON格式化/查找/复制、手动及自动刷新；将三诊断、专用类型、URI、资料导入导出、自动恢复DB/Key及独立测试等列作删减候选。模块类型和显式Base64解码注明实际需求未核实，TLS/CA、分隔符、分组和原始Hex/Base64放二级入口，未伪造使用频率统计。
- 新段明确GEO删除后仍可看底层ZSet，Bitmap/HLL删除后仍保留String原始字节；删除RedisJSON模块视图不等于删除普通JSON格式化。保留手动选择非零DB及会话隔离，不把“去偏好恢复”误当作固定DB0；删除概览仍需保留DB目录的INFO keyspace依赖。
- 逐项说明旧问题的范围变化：两项快照P1及相关P2可随模块退出；连接保存密码、实际身份与草稿、资料禁用、自动刷新及核心图标仍需修，不承诺删功能等于无bug。记录沿组件/RPC/读取/测试的删除边界与后续顺序，并为原保留全部功能的修复顺序增加适用范围说明。
- `README.md`更新审查入口名称，当前56项功能清单不变，候选不写成已删除功能。本次仅文档变更，不读取业务内容、不操作Redis、不启动/停止服务、不安装插件、不改应用代码或依赖；文档检查后本地提交，没有推送或网页GPT评审。
- 文档检查通过：原56项核对表保持完整、54个本地来源链接及行号有效、`git diff --check`无空白错误；差异仅涉及README、审查文档和更新日志。无应用代码变更，未重复运行编译或回归，也未把上轮318项通过写作本轮重新执行。

## 2026-10-19：实施六种基础类型精简版

- 用户明确授权按精简方案直接修改、修复连接/自动刷新、保留青紫橘导航并将小按钮统一为Lucide，完成后更新现用DSH；每个小目标本地提交。新增 `docs/SLIM_VIEWER_IMPLEMENTATION.md` 跟踪删除、连接、刷新、图标、验证、安装六个检查点，起点91dc39e。
- 大量依赖探寻由GPT6 LUNA描述，主模型核对实际源码和协议后实施。删除诊断、专用视图、URI、导入导出、独立测试和浏览恢复时，保留六种类型、DB目录元数据、手动SELECT、字节身份、读取取消及所属会话隔离；不维护删除能力的兼容层。

- 小目标1/2：删除63个低频视图、Host reader、解析器、状态恢复和专用测试/脚本文件；`domain.ts`、三份typert文件、`remote-service.ts`、Client注入及`redis-transport.ts`从28个RPC收敛为16个，删除对应DTO/schema和命令白名单。仍保留`INFO keyspace`、DBSIZE/CONFIG GET databases以读取DB目录，不再允许诊断INFO、CLIENT、SLOWLOG及模块命令。
- `PreviewFormats.tsx`替代`BrowsingSession.tsx`，只保存挂载期间六种视图的Text/JSON/Hex/Base64格式；`RedisWorkspace.tsx`、`KeyBrowser.tsx`、`KeyDetails.tsx`和五种集合视图移除自动恢复及专用解释接线。普通JSON格式化仍在，GEO底层ZSet、Bitmap/HLL底层String仍可查看原始数据。
- `ConnectionForm.tsx`将编辑草稿与实际ConnectionView分开，状态/SELECT回复仅更新实际连接；只有明确选择资料才填草稿。去掉独立测试，关闭连接窗口取消尚未完成的connect；已连接时可管理其他资料，切换服务器仍需显式断开。密码只保留本次草稿、连接或关闭后清空。
- `ProfileChooser.tsx`保存/刷新回复只更新资料列表和名称分组，不再调用select回填，因此保存不会清空密码；资料重载不覆盖草稿；删除改为显示真实资料名的二次确认。分组及TLS/CA按需展开。`profile-store.ts`保留原有核心持久化、重复名称/容量校验，删除批量导入。
- `value-preview.ts`/`BytePreview.tsx`删除显式Base64解码选项；`locales.ts`修正已连接时编辑资料的说明、名称冲突及容量提示。`scripts/build.mjs`先验证并清空本项目lib输出，再构建，防止已删除模块残留进安装包。
- `host-typert`/bundle/连接/资料/String/transport测试删去退出功能的断言，新增运行时拒绝已删除命令且不发送到Redis的回归；bundle仍检查原生注册/卸载和严格16方法decode。三层严格类型通过；全量构建与19文件187项回归通过。连接UI与刷新连续性尚待隔离原生专项，不把单元通过等同实际安装验收。

- 小目标3：`use-collection-scan.ts`同一查询刷新时不清空当前cache/result，而在现有页数、缓存上限内重新读取已加载批次，完成后原子替换；续读仍保留单次游标锁、所属代次与取消校验。查询/目标改变明确clear。五种集合view的手动刷新不再主动清选行；范围/筛选改变照常清选择。
- `KeyDetails.tsx`同一字节窗口刷新保留String预览，仅明确换窗口重置；取消保留上次已提交画面。五集合视图与中英`locales.ts`对刷新后未包含原选行显示准确提示，不把扫描批次未包含误判为Redis删除。BytePreview本地查找/折叠在相同内容刷新中不再被父组件卸载；内容实际变化时原有格式器重算规则保留。立即检查编译，随后隔离真实页面验证选行/查找/滚动。

- 小目标3三层严格类型、重新构建与19文件187项现有回归通过；原生查找栏/折叠/延迟刷新专项留在安装前执行。此提交不改变只读命令、Host reader预算和自动刷新时钟的会话/可见性停止机制。

- 小目标4：`Icon.tsx`移除27个本地手绘操作path，改为`lucide-react@1.59.0`官方静态组件；保留原`NavigationIcon.tsx`四个Phosphor双色SVG及青紫橘配色。操作图标16px/1.75描边，普通图标按钮28px热区；`ReadControls.tsx`与Hash/Set/ZSet区分Funnel筛选与SlidersHorizontal范围设置。
- `package.json`/`pnpm-lock.yaml`固定Lucide与`esbuild@0.28.2`；`scripts/build.mjs`用esbuild打包Client依赖，仍以DSH原生ModuleLoader注册，只将react及react/jsx-runtime外部化。Host ESM/声明文件流程不变；继续先清本项目lib，避免删除功能残留。许可证复制到`licenses/lucide-react-LICENSE.txt`，`THIRD_PARTY_NOTICES.md`记入来源。
- `locales.ts`清理退出功能的中英文键，保留普通JSON和原始字节解析；编译发现字节解析错误仍在使用，已保留并改为准确简短提示。`styles.ts`删除专用视图、快照、URI/导入等失效样式，保留共享连接dialog，补分组/TLS展开和删除确认样式；`tsconfig.client.json`删去不存在的旧文件输入。逐轮编译优先，随后验证真实浏览器bundle与隔离界面。

- 小目标4三层严格类型与esbuild实际浏览器产物通过19文件187项回归；bundle加载测试确认仅使用宿主react/react-jsx外部依赖，16方法严格decode和注册/卸载仍正常。导航源码未改，退出功能文案/专用样式已清；实际原生深浅与窄栏检查待后续隔离验收。

- 验证与说明小目标：README与`docs/FEATURE_INVENTORY.md`改为六类型/四格式/8模块41项当前清单，逐字段说明连接窗口、保存不丢密码、已连接资料管理及刷新连续性；旧56项完整清单归档到`docs/references/FEATURE_INVENTORY_4786a61.md`，操作审查文首注明历史基线并改指历史清单，旧证据不冒充当前通过。
- 新增`docs/verification/slim-viewer-2026-10-19.md`区分已完成类型/187回归与待执行的隔离及安装。Host连接/TLS smoke改用唯一connect路径，成功后显式断开，不保留test API的兼容壳；release-boundary改为16方法及ConnectionView反例。原生旧入口正在收敛到六类型，完成后才执行。

- 原生专项发现连接/删除资料的取消按钮复用读取文案，已在ConnectionForm/ProfileChooser改用独立ui.cancel中英文；不支持模块类型提示改为当前类型暂不支持，避免误说只能按String查看。仅修正场景表达，不改变取消或连接行为；立即三层类型检查。

- 本轮真实Host专项11套73组通过：连接8/TLS5/String7/Hash6/List6/Set6/ZSet7/Stream7/Key8/帧预算5/恢复8；所有所属Redis/TCP夹具已清理。候选7b71a067…经prepack三层类型+187回归；隔离安装67发布/56lib文件逐字节匹配。
- `scripts/smoke-dsh.mjs`由原12类型大入口收敛成自有DSH/Redis原生验收夹具，仅提供合成种子和loopback hold/verify/stop，UI一律由CUA操作；删除已失效的smoke-auto-refresh/sidebar-layout/resp-workbench三入口，保留其历史报告。旧release-boundary辅助脚本只更新16方法语法，本轮没有执行该headless驱动，不冒充原生decoder专项。
- CUA实际通过连接错误/保存后直接连接、草稿与实际连接隔离、关闭等待后socket基线、已连接资料管理/删除取消；String正常刷新查找折叠保留，长hold等待中128px滚动保留、超时后正确停止并手动重连。五集合均加载200行选第106行，定时刷新后行数/选中身份/表格滚动/查找词/折叠保持，成功时间更新；Stream重复字段未合并。
- 手动DB1/DB0、六视图约464px（实际463）33px工具带无整体溢出、原生明暗主题及1279px Hash全宽均检查；保留Phosphor青紫橘、操作为官方Lucide。六DUMP与Stream消费组不变，代理未见写命令/KEYS或协议错误；隔离DSH/代理/WSL已停止清理。`docs/verification/slim-viewer-2026-10-19.md`与实施状态同步，并归档脱敏合成截图/JSON；最终提示文案和日常安装仍待最终包核对。

- 最终发布小目标：最终包SHA256 57e4d6a34e199a97c63e884596f88dc64b5cea10c11f480bed0aef4534cfac71（应用检查点7b8f15f）默认prepack再通过严格类型/全新构建/19文件187项；按唯一SHA文件名装入日常web profile。67发布文件、56lib、12宿主peer及3运行依赖逐一核对，Lucide已内联且许可随包发布。
- 安装前五清单已备份；只有package.json插件引用和pnpm-lock.yaml变化，其他manifest内容、workspace、cordis配置不变。`scripts/verify-release-package.mjs`增加显式REDIS_VERIFY_PACKAGE_ROOT以同一只读核对工具检查日常安装；默认仍隔离目录，实际执行通过。归档final-release-manifest/daily-config-check/daily-install-summary，私有备份与token日志不入Git。
- 仅停止已核对旧DSH7198进程树39180；首次启动重复web profile参数被CLI拒绝，已改成原命令同样的单个--profile web，隐藏重启后127.0.0.1:7198/PID23752就绪。没有为启动问题更改插件、宿主版本或用户配置。
- CUA在用户原页面重载新版：连接表单官方Lucide、TLS按需展开、无独立测试；按原本机6379设置手动连接，真实DB0自动加载760/760，Hash20字段/1选行/2预览，无就地错误、自动刷新关闭。只记录数量，不保存业务内容、认证、真实截图或业务DUMP；原页标记保留供用户查看。
- `docs/SLIM_VIEWER_IMPLEMENTATION.md`全部检查点完成，当前41项清单和精简验收同步最终SHA及候选/最终证据边界。临时DSH/代理/Redis及所有验收进程已结束，明确要求使用的日常DSH保留；无npm dev/start:dev、网页GPT评审、推送。最终差异及文档检查后本地提交安装小目标。

## 2026-10-19：DSH官方规范与对话读取审查

- 用户调用grill-me，要求按DSH官方插件开发说明核对当前Redis插件，明确对话应能直接读取Redis。本轮解析该入口并读取grilling技能；大量源码/官方资料事实探寻由GPT6 LUNA完成，主模型交叉核对官方固定版本、当前Host/Client、连接/游标以及日常安装产物后负责结论。
- 新增 `docs/DSH_PLUGIN_COMPLIANCE_AND_AI_READ_AUDIT.md`，记录官方依据、12项接入核对、源码和安装证据边界。当前bundle/Client/侧栏/Remote路径与核对到的官方接口相符，但runtime只注册侧栏服务，没有模型工具；不把侧栏可读等同对话可读或全面合规，不把第三方Database当官方规范。
- 发现原方案将显式AI只读工具放在P2；按本轮目标建议提升为P0，复用现有六类reader与连接。额外核对每reader每session单扫描槽：未来AI若直接复用同一槽会使UI续页失效；方案要求UI/AI游标状态分开，并保留同一真实session和Redis连接，不新建平行连接规避问题。
- 用户已确认Q1复用当前会话手动连接、Q2识别侧栏当前Key/字段、Q3明确要求时允许切DB并同步侧栏；审查文档列P0-A至D的工具/当前选择/DB同步/端到端验收与日常安装顺序，全部标为未实施，等待整体范围确认。
- 核对日常web profile引用精简SHA包且bundles包含dsh-redis；安装runtime/remote-service与项目产物哈希一致。本轮7198无监听，未启动服务或据安装记录宣称当前运行验收通过；没有查询真实Redis内容、读取凭据、发送DSH对话或改动应用/依赖/配置/安装包。
- 修改原因是纠正“插件已接入”和“AI读取已完成”的边界，为后续最小补齐提供可审阅方案；影响仅文档与本更新记录。官方契约固定0.2.0-rc.2对应639ed015提交，不自动更换宿主；文档检查后本地提交，不推送。本轮无应用变更，不重复运行编译或历史187项回归，不使用网页GPT评审。
- 后续核对rc2官方事件转发存在应用显式白名单，不能假设插件随意emit即可被Client订阅。DB同步方案收敛为复用既有connectionStatus，在侧栏可见时核对Host内存状态、仅变化时应用；不查询Redis、不重连、不自行开Key内容刷新，也不修改官方宿主转发白名单。此项仍只是待确认方案。
- 文档静态检查通过：17个本地来源链接及行号有效、无行末空白；暂存差异检查通过且仅包含审查文档与本日志。没有运行编译、测试、服务或Redis查询；本小目标仅提交这两份Markdown。

## 2026-10-19：实施DSH对话只读Redis

- 用户已整体确认审查方案Q4，开始P0-A至D，不再等待重复授权。新增 `docs/AI_READ_IMPLEMENTATION.md` 跟踪四个小目标；`package.json` 在peer/dev两处固定官方 `@deepseek-ai/dsh-tools@0.2.0-rc.2`，用于与现用宿主共享工具注册服务并进行严格类型检查。
- 本轮先复用现有连接、六类型reader与只读命令，UI/AI分别持有扫描状态，遵循最简、单一职责和严格类型原则；不新增任意命令、Redis写入或旧版兼容。先安装并核对依赖/编译，再实现工具；依赖锁文件随实际解析更新。
- 依赖安装遇到npm直连重置，离线模式因缺少postcss策略元数据未通过；改为继承Windows既有本机代理，保留供应链策略检查，179项检查通过后实际新增5包。锁文件更新，三层严格类型通过，没有关闭策略或运行依赖脚本。
- 新增 `host/ai-reader.ts`，复用同一RedisConnections并为AI独立构造各reader，统一类型发现、64KiB对话结果预算与值前缀/完整性表达；超预算明确失败，不丢批尾再推进游标。新增 `host/ai-tools.ts`，按官方defineTool注册status/keys/value三个独有前缀工具，身份来自exec.agent，取消信号传到底层，拒绝额外模型参数。
- `index.ts`依赖tools服务，`runtime.ts`注册官方工具；`remote-service.ts`让AI reader随连接替换、断开、会话/插件释放清理。没有增加Redis命令或新socket；界面RPC暂仍16项。立即进行严格编译，随后补工具契约/游标与真实组装测试。
- 首轮Host/Client/tests三层严格类型通过。补充将scanComplete与完整Key分开，过滤/续读后的末页不冒充全量，集合前缀参与完整性计算；开发依赖增加同版SystemPrompt，仅供真实ToolRuntime组装测试使用，不增加产品服务。随后核对依赖与编译。
- 新增 `tests/ai-tools.test.ts`，使用官方SystemPrompt/ToolRuntime实际组装，覆盖模型schema发现与卸载、可信session和无密码投影、六类型调用、UI/AI续页隔离、前缀/末页语义、取消及额外参数拒绝；传输层仅用明确合成数据，不把此测试当真实LLM对话验收。新增后立即编译并跑专项。
- 新增测试首次运行暴露测试插件漏写tools注入，已按产品入口同样的官方inject契约补齐；这是组装夹具问题，没有绕开官方服务检查。随后重跑编译和工具专项。
- 工具专项9项通过后发现官方prompt按工具名排序，测试改为验证真实集合而非注册顺序；补充超预算明确失败后可重读的合成反例。继续执行完整编译/构建/回归，完成后提交A小目标。
- A小目标严格Host/Client/tests类型、全新构建、20文件197项回归全部通过，其中10项官方工具组装专项验证六类型、卸载、身份、预算、取消与游标隔离。实施记录同步；真实LLM、选中上下文、DB同步及安装仍待后续，差异检查后本地提交A，不推送。
- B小目标新增选择身份DTO及严格setSelection RPC（Host/Client共17项），仅保存同会话目标代次和Key/字段/成员/下标/Stream字段序号，不保存数据值。`ai-reader.ts`在无key参数时读取最后同步选择，检查读取期间选择/连接变化；status展示标识及同步时间，超预算仅清AI游标，不清选择。
- 新增 `host/selected-reader.ts`，List/Stream复用既有精确范围；Hash/Set/ZSet增加官方只读HGET/SISMEMBER/ZSCORE固定命令，保留接收预算、取消、类型与目标校验，不提供命令文本入口。契约依据为Redis官方对应命令文档；二进制字段/成员不以显示文字替代。下一步接Client选择并补严格协议/选项读取测试，立即先编译当前Host变更。
- `CurrentSelection.tsx`新增选择标识上下文，60ms合并快速选行，卸载清理；五集合视图仅上报现有选中原始身份。`KeyBrowser.tsx`按Key持有该上下文，`client/index.ts`按session串行选择RPC，避免旧Key清理覆盖新选择；不重读或缓存当前值，不改变原预览布局/刷新时机。工具状态保留最后同步时间，明确上下文来源。
- 严格Host/shared/browser选择codec统一并增加17th descriptor，现有协议/实际bundle测试同步方法数；选中绑定跨代次重新同步时会先失效旧记录。立即进行三层编译，再补选择读取和顺序专项。
- B接线后三层严格类型通过；工具测试增加六种当前选择精确读取、二进制Hash字段、Stream重复字段第二项、会话/代次拒绝、选中对象消失和读取期间选择替换；协议测试增加身份/序号/Base64/额外字段反例。ZSCORE按UTF-8严格验证文本，避免ASCII高位截除掩盖非法服务端值。再次编译并执行全回归。
- B完整检查20文件200项通过。实际bundle测试再增加选择RPC串行顺序断言；协议版本提升2，旧/新Host混装不会误报同协议；smoke-dsh代理白名单补三项固定只读命令。未执行的release-boundary旧驱动仅同步17方法列表/文字，不把它计入本轮原生验收。
- B最终三层类型/构建/20文件200项再次通过，实际bundle的选择请求顺序验证通过；辅助release-boundary的Host状态样例同步协议2。实施记录更新并本地提交当前选择小目标，原生与真实对话留在D，不提前更新日常安装。
- C小目标新增官方redis_viewer_select_db工具，仅描述为用户明确要求时切库，复用原SELECT及代次保护，换代后清AI选择/游标。新增 `client/connection-sync.ts` 并接ConnectionForm：可见时串行核对Host内存状态，变化才应用；跳过手动操作、过期回复和connecting瞬态，隐藏/卸载取消，不读Redis数据、不重连、不改变资料草稿或开启内容自动刷新。立即编译并补同步专项。
- C首轮三层类型通过。手动SELECT也清理换代后的AI状态；同步失败恢复仅清本轮同步产生的RPC提示，不用恒定重设相同ConnectionView引发界面重绘。新增4项ConnectionSync定时/可见/迟到/恢复测试及专用切DB工具验证，普通读取不会产生SELECT，切DB不新开socket；立即编译和全回归。
- C最终严格类型、全新构建、21文件205项回归通过；实施记录补齐工具、换代和同步检查点。差异检查后本地提交该小目标，不推送；隔离真实对话及日常安装尚未执行，继续进入D。
- D原生夹具复用 `scripts/smoke-dsh.mjs`，增加受项目scratch路径约束的独立home/证据/私有控制文件选项；真实模型模式才保留原provider环境并追加六个小型合成AI Key，默认仍是阻断模型的旧模式。改动避免覆盖既有验收home或将大集合回归当真实对话；DUMP覆盖原六Key与新增六Key，写入只在所属夹具种子阶段。凭据仅原字节复制到私有隔离home，联调后删除，不打印、不提交。
- 候选包默认prepack通过205项回归，隔离安装73发布/62lib/13宿主peer逐字节匹配。新增 `scripts/smoke-ai-chat.mjs`，沿官方Session API以cookie交换认证、follow取得cursor、page读取工具调用/结果及assistant实际消息，仅收集所属合成验收会话；不使用mock provider或独立浏览器驱动。私有准备脚本的Windows ESM路径修正为file URL后成功，未涉及产品代码。
- 首次真实provider请求在DSH中超时重试；独立HEAD连通性检查同样超时，尚不能认定真实对话通过。Session观测脚本的ws改从实际声明该依赖的官方api-gateway包解析（全局CLI没有直接ws依赖），不新增产品依赖。继续原生与网络排查，结果如实记录。
- Session观测按现有发布核对方式先realpath解析pnpm链接入口后成功，实际失败轮次无工具调用/结果，不伪造模型证据。用户已收到模型服务恢复询问；在等待期间增加独立、无真实凭据的本地SSE脚本模型夹具以核对原生AgentLoop/工具/RPC接线，观测器显式区分actual-provider与scripted-local-fixture。该补充验证不能替代真实模型验收，也不改日常provider配置。
- 本地接线验收启动后执行环境中断，原生浏览器与临时PTY进程均已消失；未将中断轮次记作通过。按已记录owner核对WSL PID/cwd并清理所属夹具，重建唯一临时home，改用隐藏后台助手保持验收服务生命周期，结束仍经明确stop清理。
- 本地脚本模型第一次配置因缺少官方必填models[].id未激活adapter；启动日志和官方schema共同确认后只补齐测试配置，不改产品来绕开NO_ADAPTER。夹具的启动检查失败不记作插件调用成功。
- README/功能清单增加对话模块5条，当前9模块46条；新增 `docs/AI_READ_USAGE.md` 说明同会话手动连接、四工具、六类型当前选择、明确切DB及部分结果语义。历史审查仅加后续状态指针，不改写当时缺口；示例自然语言明确不是实际模型验收记录。修改仅使现有实现和验收边界可查，不扩展产品能力。
- 本地脚本模型接线已发现全部4工具，真实Redis六类型读取及未连接状态走通官方AgentLoop；原生侧栏同时可选Key。观测器仅打印调用摘要/末条短预览，完整合成结果留在独立证据JSON，减少重复数据输出；接下来核对六种选中身份与切DB同步。
- 本地原生专项完成30工具调用：六类型明确读取和六种当前选择、Stream重复字段第二项、DB0/1/0同步及旧自动刷新清理、另一会话未连接拒绝。全程1个Redis连接；12合成Key的DUMP及Stream消费组不变，无代理协议错误。归档仅合成投影轨迹/断言/截图，新增专项报告并同步实施记录；真实模型超时仍未通过，安装仍待最终包检查。
- 所属DSH/WSL Redis经finally确认停止且夹具目录移除，独立脚本模型stop后确认无监听；真实凭据副本已删除。46条功能编号唯一、当前说明链接有效；JS语法/差异检查通过。第二会话首轮实际只调用status，补发CURRENT后才验证value拒绝，专项按真实30调用及1预期拒绝记账；不将测试预期统计错误算产品缺陷。此检查点本地提交文档/接线观测与合成证据，最终安装继续独立进行。
- 最终安装检查点：确认7198无监听，按已授权日常profile更新范围准备唯一SHA包和五清单私有备份；使用原正确启动参数与独立私有日志。真实模型服务仍未恢复，不以安装更新代替真实对话通过；不更改日常provider/连接资料或宿主版本。
- 最终包SHA256 a23e3902105e1b7a9ebadaee373eb3db52ab74293c9cb74d32ab01252c7b4689，默认prepack再次通过205项。官方CLI安装日常profile，73发布/62lib/13peer/3运行依赖匹配；lib与原生候选完全相同。只有Redis依赖引用/锁文件变化，三份workspace/cordis配置不变，五份清单已备份；最终manifest和安装摘要仅含公开元信息及哈希。
- 官方安装器另报既有input-plus/web-search旧peer与当前宿主不兼容；遵循框架拒绝机制，未为其加入豁免或擅自改动其他插件。Redis13项peer匹配，7198/PID44396就绪，原生页面手动只读连接本机6379，DB0自动加载760/760；未选择业务Key、未保存业务数据或真实截图。退出全屏后保留Redis/对话并排页面供用户使用。
- 实施/验收文档补齐日常安装、临时清理和实际阻塞；D仍明确为真实provider超时待复验，没有伪造通过。最终本地提交安装小目标，不推送；无网页GPT评审、npm dev/start:dev、业务写入或日常provider变更，所有所属临时验收服务已结束，用户明确要求使用的日常DSH保留。

## 2026-10-19：继续核对真实模型连通性

- 用户要求继续，随后选择恢复当前模型服务。本轮先复查日常provider/default-model和7198监听；仍为bzkj/DeepSeek-V4-Flash，日常DSH正常，模型3200直连超时、经既有代理502。GET模型目录的无认证连接检查也超时，未发送API密钥、Redis数据或新模型对话；不把旧205项/30调用当本轮重跑。
- 使用diagnosing-bugs技能按请求/路由/出口分层；模型服务器不是本机，当前最佳路由经过FlClash，另有物理网卡默认网关。新增私有 `check-model-route.mjs`，固定同一URL比较普通路由与单次请求绑定物理地址，仅投影状态/耗时并以断言明确失败，不修改系统路由或代理。三个待验证原因是代理出口、物理内网可达性和服务器端口状态，尚未下恢复结论。
- 单次请求绑定物理地址仍超时；该检查不代表绕过TUN，因此未下代理故障或服务端故障结论。用户明确要求“别动flcash”，立即中断相关事实代理并停止所有FlClash探寻；代理确认仅查路径/字段/端口，主代理也仅查询与发出有界HTTP检查，全程无FlClash配置、模式、系统代理或路由写入。
- 验收与实施文档补记当前接口未就绪、7198仍在线和用户约束；脱敏证据只保留模型名称、目标host/port、HTTP状态/退出码及耗时，不含凭据、物理网卡地址或代理控制信息。产品/依赖/安装配置/业务Redis未改，没有启动临时服务，不重复执行已通过回归；文档及差异检查后本地提交本复查小目标，不推送。

## 2026-10-19：恢复真实模型联调

- 用户已确认日常DSH普通模型连通并要求继续；复查默认模型为 `deepseek-official / deepseek-flash`，与此前失败的bzkj内网路由不同。保持FlClash、系统代理/路由、日常DSH模型与Redis连接配置原样，不继续旧网络排查。
- 在忽略目录 `.scratch/runtime` 新建唯一隔离home准备脚本，核对已安装最终包SHA，并只复制所选官方模型条目和该模型所需的单个凭据引用。凭据不输出、不归档，测试结束后删除副本；合成Redis用于真实对话，不读取业务值。修改原因是继续未完成的D验收，影响仅临时验收环境及本文档，不修改产品功能。
- 用户随后明确要求使用真实数据，立即停止所属隔离DSH/Redis，核对processStopped/fixtureStopped为true，删除隔离凭据副本并关闭测试标签；没有向合成环境发送模型提示。改在日常7198新建专用DSH会话，由界面手动连接本机真实6379；模型、系统代理/路由均不变。
- 真实模型前三轮完成7次官方工具调用：未连接状态、连接后状态、两批Key检索、真实Hash整Key读取、侧栏切Key/选行后的空参数精确读取。独立HLEN/HGET逐字节核对8字段及当前字段均一致；初始验证脚本将选中字段的未知基数null误转换为0，按已实现契约只对整Key校验基数后通过，无需修改产品。
- 只读统计真实DB0共760个唯一Key且全部为Hash，Redis8.10.0，统计前后总数760。本轮不补种其他类型；五种无真实样本的类型继续明确为此前隔离验收。新增 `docs/verification/ai-read-real-data-2026-10-19.md` 和脱敏断言JSON，只保存类型、数量和匹配布尔值，业务Key/字段/值不入文档或Git；DB切换/跨会话检查继续后续执行。
- 第二阶段真实联调完成：两个所属DSH会话7轮/14次工具调用，13成功、1次预期未连接拒绝，无非预期工具错误或非Redis工具。DB0→1→0保持同一连接ID、代次2→3→4；原5秒自动刷新/旧Hash表格清理，选择失效；返回原会话连接保留，最终DB0总数760。
- 截图核对发现一次样式节点缺失和SVG放大；核对 `src/client/styles.ts`、Client入口/构建及实际安装bundle均包含内联样式，官方动态Client不要求独立index.css。页面重载后style节点1、flex布局/16px图标恢复，随后跨会话正常；根因未定位，未称作源码修复。归档截图只含连接/DB计数，未包含业务Key/字段/值；之前无效的空白截取已被可视检查通过的最终图覆盖。
- 更新 `docs/verification/ai-read-real-data-2026-10-19.md`、脱敏JSON及计数截图，补完整DB/会话结果与样式待复现项；同步 `docs/AI_READ_IMPLEMENTATION.md`、`docs/AI_READ_USAGE.md`、`docs/FEATURE_INVENTORY.md`，历史审查和旧接线报告只加后续结果指针，不改写当时失败事实。核对脚本对官方日志header的session-前缀修正后通过；日志和真实数据只在内存解析，无产品变更。
- 本轮仅文档/验收证据变更，不重跑205项或重复安装；进行JS语法、JSON断言、文档链接、图像人工核对与差异检查。日常7198/PID26896保留在原已连接会话、DB0/无选中Key，临时DSH/WSL Redis已停并删除凭据副本；不运行npm dev/start:dev、网页GPT评审或Git推送，FlClash及系统代理/路由原样。
- 最终只读核对：日常安装62个lib文件与项目产物逐字节一致；40个本地文档/证据链接有效，14调用/14结果、0非预期错误、最终760项等JSON断言通过，脱敏JSON未含本轮业务文本。截图已人工查看，显示正常青色DB图标和DB0(760)，没有业务Key/值。两项完成小目标分别本地提交，不推送。

## 2026-10-19：说明AI读取架构及MCP区别

- 用户询问AI读写范围及是否通过MCP接入。本轮按实际代码核对 `src/index.ts`、`runtime.ts`、工具/AI reader、连接/RESP传输、选择/DB同步及固定rc2官方工具/MCP资料；必要的大量源码事实定位由GPT6 LUNA负责，主模型交叉核对后形成说明。
- 新增 `docs/AI_READ_ARCHITECTURE.md`，明确当前是DSH原生tools API注册的四个自定义工具，界面与Host之间的Typert RPC不是MCP；正式Redis访问由项目RedisTransport通过node:net/node:tls及RESP2完成，区分验收脚本的node-redis使用。包含调用流程图、当前选择/同会话连接/游标/DB同步、固定命令、结果预算及模型数据去向，并以实际源码和官方固定版本资料链接支持。
- 纠正“读写已完成”的理解：本插件开放读取与明确要求时的逻辑DB切换，未提供新增/修改/删除或自由命令。`docs/AI_READ_USAGE.md` 补入口并把“四个官方工具”改为“插件注册的四个工具”，避免误认为DSH自带Redis工具；`docs/AI_READ_IMPLEMENTATION.md` 增加架构说明链接。变更影响仅说明文档与本文，无产品/依赖/模型/代理配置改动，不访问业务Redis、不重跑真实对话或历史205项、不安装/重启服务；文档与差异检查后本地提交，不推送。
- 文档检查通过：24个本地链接有效，12个源码行链接均指向存在的非空行，四个工具名与实际注册一致，Markdown代码围栏成对，官方参考checkout仍为固定639ed015提交。再次明确集合值前缀与字段/成员完整身份的区别；仅文档修改，未执行编译或服务联调。

## 2026-10-19：记录后续写入候选

- 用户要求将刚讨论的新增/修改/删除与人工确认方案只加入后续规划，不继续讨论或开发。项目未找到名为vitamin的文件，按项目README记录并向用户说明该理解；不改原29票历史状态，不发布新的实现票。
- `README.md` 新增“后续任务规划”，明确候选未实施、当前仍只读；记录Hash单字段新增/修改优先、删除后续、当前连接临时解锁、逐次差异预览与人工确认、Host单次授权及目标/数据变化失效、发布前反例验证。不将开关或AI自填confirm参数当作执行批准，不包含批量删除/清库/任意命令/脚本。
- 影响仅README规划及本更新说明，无应用代码、依赖、安装包、DSH/Redis/模型或代理配置变更；不启动服务、不访问业务数据。进行Markdown及差异检查后按已授权要求本地Git提交，不推送。

## 2026-10-19：核对统一README与发布规范

- 已完整读取用户提供的 `E:\项目demo\dsh-git-graph\DSH_PLUGIN_GUIDE.md`，作为后续Redis插件文档与发布整理的参考。区分其中引用的官方支持方式与团队维护约定；末尾可复制任务说明仅为模板，本轮未据此执行安装、发布、推送或社区提交，也未重新验证官方在线市场状态。
- 只读对照当前 `README.md`、`package.json`：当前README为中文，缺少 `README.zh.md`、`CHANGELOG.md`、`docs/DEVELOPMENT.md` 和规范约定的 `docs/screenshots/`；安装说明侧重本地SHA包，需在实际发布准备时补公开成品包来源、界面安装、更新及卸载步骤，并处理E盘绝对文档链接。README的“官方模型工具”表述也应统一为通过官方接口注册的自定义工具。上述为待整理差项，未冒称已经完成。
- 当前prepack已沿用pnpm check，包清单已有lib/patch/icon/许可；本轮仅核对声明，未重跑构建、打包或实际安装。现有写入候选继续标为后续规划，不改变只读功能。变更仅本文：保存参考与核对结果，未修改README、应用代码、依赖、配置、实际DSH或业务Redis；差异检查后本地Git提交，不推送。

## 2026-10-19：整理插件交付文档

### 小目标一：安装、更新与卸载

- 新增 `docs/INSTALLATION.md` 和 `docs/INSTALLATION.zh.md`，提供内容对应的中英文成品包构建、SHA 唯一路径、界面安装、CLI 安装、启用、更新、回退、停用、卸载和资料清理步骤。命令以实际存在的 Web profile 为前提，不编造仓库、注册表发布或 Release 下载地址。
- 核对固定 `0.2.0-rc.2` 官方 CLI、插件管理器与包操作源码，以及本项目 profile-store、连接释放和构建脚本；明确 rc 基线不是最新稳定版声明、Desktop 未验收、本地路径由 Host 解析、无热重载时需正常重启。安装、更新与卸载记录的是实际机制，不据文档整理重启日常 DSH。
- 保存字段、密码不持久化、会话连接隔离、卸载保留资料、对话结果进入模型上下文分别说明；资料清理只针对所属连接文件，不建议删除整个 home/profile。修改原因是补齐可执行维护步骤和数据保留边界，影响仅两份说明及本文，不改变运行代码、依赖、当前安装或业务数据。
- 本小目标先进行 Markdown 围栏、相对路径和差异检查；中文 README 的互链将在紧接的双语首页小目标补齐。实际打包与独立 profile 的安装/卸载验证留在最终交付检查，不提前声称已经执行。本轮不对外发布、不启动服务，不使用网页 GPT 评审。
- 两份指南的4段 PowerShell 命令逐字一致，围栏与暂存差异检查通过；现有相对链接可解析，唯一待补入口为下一小目标的 `README.zh.md`。按用户授权本地提交这3份文档，不推送。

### 小目标二：中英文 README 与可移植截图

- 将 `README.md` 整理为英文首页，新增 `README.zh.md`，顶部相互切换；两份文档同步当前六类型、连接与资料、DB/Key 自动加载、行详情、格式与刷新、4个原生工具、数据去向、边界、验收范围和未实施写入规划。修正“官方模型工具”措辞，明确原生 Tool API 与 Typert RPC 不是 MCP。
- 文档入口全部改用仓库相对路径，不把本机 E 盘路径、未设置的 Git 远程或未发布的注册表名称作为下载入口；保留真实 Node/DSH 基线以及预发布、平台和五类缺少真实业务样本的边界。CHANGELOG 与开发说明入口由下一小目标补齐。
- 新增 `docs/screenshots/` 的2张原生 JPEG 和双语来源说明：仅原样复用已人工核对的隔离数据 Hash 全宽、Stream 窄栏截图，不使用用户业务画面，不冒称重新拍摄或验证了后续 AI 接线；两种语言共享图片和日期说明。检查发现源文件扩展名为PNG而实际为JPEG，交付副本仅改成正确的 `.jpg`，内容哈希与原文件一致，不修改历史证据。
- 修改原因是让新读者能按真实当前功能理解、安装和使用插件，同时保留写入候选；影响仅 README、文档素材与本文。没有调整产品、依赖、实际 DSH 安装或 Redis 数据；下一步检查语言事实一致、图片哈希和本地链接后本地提交。
- 检查通过：两份README的工具名、图片链接、构建命令一致，各保留5条后续写入候选；34处相对链接核对，除下一小目标待建的CHANGELOG/开发说明外均存在。两张图人工查看通过、实际JPEG尺寸均1280×720，副本SHA256与历史源图一致；围栏与暂存差异检查通过后本地提交，不推送。

### 小目标三（2026-10-20）：版本记录、开发说明和成品文档检查

- 新增 `CHANGELOG.md`，按真实提交归纳当前未发布功能、体验变化、已修正问题、已移除范围和验收边界；明确0.1.0只是本地开发标识，没有编造tag、发布日期、公共仓库或下载入口，也未把样式问题称为已修复。
- 新增 `docs/DEVELOPMENT.md`，说明版本/peer基线、目录职责、原生工具与RPC、正式RESP2链路、会话与资料生命周期、只读边界、检查和构建、各层验收、现有专项脚本前置与清理、旧核包脚本固定路径、本地打包校验及需另行授权的未来发布步骤。以现有实现为准，不引入额外服务或修改宿主。
- `package.json.files` 仅增加双语首页、CHANGELOG、两份安装说明、开发说明和已审阅截图，避免包内README图片/互链失效；不把整个历史docs或scratch带入成品。`.gitignore` 增加 `.release/`，隔离本地tgz和校验文件。修改原因是让文档可随包交付，影响仅成品文档白名单，不改变依赖、锁文件、版本、运行源码与日常安装。
- 下一步执行默认prepack、归档逐字节/文档链接检查，并在独立DSH_HOME只运行官方包管理与配置打印，验证安装/卸载/资料保留；不启动Host或Redis，不读取业务值，不对外发布。检查结果随后补入本节。
- 首次默认prepack通过三层严格类型、全新构建及21文件205项。文档静态检查发现工具服务官方链接误用了agent目录，已按固定checkout改为真实的core/tools路径；跨零点后的维护记录使用2026-10-20，历史截图与运行验收日期仍保留2026-10-19。由于成品文档变更，需重打最终包并核对本次来源，首次包不作为最终交付结果。
- 最终包默认prepack再次通过21文件205项，SHA256为 `71c3831d60f26910b837a5a34a4f5342f819a098fc47d29a35cdf8c0b3ec309b`；81个成品文件逐字节核对（manifest核对pnpm实际移除packageManager/prepack的规范化），62个lib与改前基线相同，44处包内相对链接、3处章节锚点、12处固定官方资料路径通过。生成本地tgz、SHA唯一路径副本与双空格校验文件，不对外上传。
- 独立无凭据DSH_HOME仅用官方CLI完成两次安装、列包、两次卸载和重新安装，81个安装文件均与包一致；以官方dump-config确认安装/重装后ui-redis存在、卸载后消失。空connections.json在卸载/重装期间字节不变，所属临时home已清理；没有启动Host/Redis、复制用户配置、读取真实数据或更改日常profile。
- 临时核对脚本先后暴露JSON键顺序比较、remove不接受offline、内部清单结构假设的问题；改为结构比较、正式remove命令和官方dump-config直接核对，未改产品配合检查脚本。失败轮次不计为通过，具体过程及范围写入新增 `docs/verification/documentation-2026-10-20.md`；不把同包重装称为跨正式版本升级验收。
- 修改清单最终仅为主文档、审阅截图、包内文档白名单、输出忽略规则与本更新记录。历史运行源码/依赖/锁文件、日常DSH、模型和代理配置均未改；不运行npm dev/start:dev或网页GPT评审。最后进行差异与文档检查，按用户授权提交最后一个小目标，不推送、不发布。

## 2026-10-20：定位、推广文案、README 与封面

### 小目标一：product-marketing 定位与 oil-tone 文案

- 按用户指定顺序完整读取 product-marketing、oil-tone、beautify-github-readme、oil-cover 的技能与所需参考；本轮为README模式、封面为明确指定的Agent自主模式。当前无营销上下文及oil-cover用户配置，按现有实现自动起草，不改用户全局配置，不索要外部服务Key，头像默认关闭。
- 新增 `.agents/product-marketing.md` v1，记录个人开发者定位、同一DSH工作区内查看/提问的价值、六类型与同屏详情卖点、替代工作方式、异议、用语、证据和目标。读者与动因明确为根据范围形成的假设；无访谈、客户、采用量、性能或商业定价证据时不补造。
- 新增 `PROMOTION.md` 的中文长短介绍和英文介绍，遵循oil-tone，仅描述当前六类型只读查看、手动单机/TLS连接、同会话原生工具与当前选择；保留固定rc基线及对话结果的模型数据去向。链接指向既有宿主官方仓库和本地操作说明，不捏造本项目公开地址或下载入口。
- 修改原因是为后续README与封面固定事实和表达边界，影响仅营销文档与本文，不改产品、依赖、安装或用户数据。下一步执行tone lint与链接检查，反馈定位草案并继续独立的素材准备，随后本地提交。
- `PROMOTION.md` 的oil-tone lint通过，人工核对未加入虚构经历、客户证言、效果数字或公开发布承诺；两份营销文档围栏及4处本地链接检查通过。已向用户展示定位摘要并提供可选调整入口，默认按现有个人开发者定位继续；营销上下文后续由其他技能复用，底部版本记录保留演变原因。

### 小目标二：beautify-github-readme 双语轻量整理

- `README.md` 和 `README.zh.md` 首段围绕同一工作区内定位Key、选行查看、继续提问展开；保留醒目的只读/单机TLS/Windows与rc基线，加5个本地导航入口。原生Hash截图仍是首个视觉证据，未使用生成图替代。
- 安装与首次操作提前，完整9模块和六类型表格、Stream窄栏图放在可展开区域；其余要求、工具、模型数据去向、限额、验证范围、已知问题、许可及5条未实施写入候选保留。仅调整读者动线和措辞，不删事实或新增兼容承诺。
- 新增 `docs/screenshots/readme-flow.svg`，用可编辑SVG说明手动连接、浏览、选行、同对话提问；这是明确的流程图，复用青紫橘，不生成品牌横幅或动态资产。`docs/screenshots/README.md` 标明流程图与真实截图的区别，现有包白名单自然包含该图，无需更改manifest。
- 修改原因是使首次阅读先看到实际界面与可执行操作，再按需查看详细清单；影响仅README与文档素材。接下来执行两语tone lint、README/SVG审计及900/360宽明暗预览；运行源码、依赖、锁文件与日常DSH保持原样。
- 用户已明确确认按该定位继续，`.agents/product-marketing.md` 依技能规则升为v2并追加确认记录，不把维护者确认当作市场验证。原生本地Markdown预览发现中文要求列表的粗体边界需留空格，按CommonMark补4处间隔，不改要求内容；双语tone lint及README图片/SVG基本审计已通过。
- 完成8组原生浏览器明暗/宽窄/双语预览并人工查看：宽屏980视口、900内容列，窄屏360视口（原生滚动条后实际约344.8内容宽），图片均加载、无整页横向溢出。最初将窄栏宽度硬等同360的断言已改为与可用宽度核对，这是校验口径修正，无产品或README补丁。两语展开详情的2张表格和Stream图显示正常。
- 两份README共40处相对链接及12处本地锚点通过，工具/图片/命令一致，各5条后续候选，原生截图哈希未变；截图API实际返回JPEG，私有预览图仅按真实格式改扩展名。新增 `docs/verification/marketing-2026-10-20.md` 记录范围与证据。临时浏览器视口已复位、预览页及所属服务已关闭；未改日常DSH、不重跑产品回归，差异检查后本地提交。

### 小目标三：oil-cover Agent 自主模式封面

- 在 `docs/promotion/` 归档现有隔离Hash截图副本 `dsh-redis-demo.jpg`，原字节保留；`dsh-redis-demo.oil-cover/frames/` 保存参考图及既有项目icon.svg副本，只把该矢量原样栅格化为PNG参考，不修改原图标或原生截图。没有用户头像配置，按默认无人物执行，不写全局技能配置。
- 生图前保存 `analysis.md`、`cover_plan.md` 和3份完整prompt，锁定标题“在 DSH 里 / 查看 Redis”、副标题“六种类型 · 只读查看”；分别规划3:4、4:3、16:9，复用同一原生Hash证据和项目图标，外层为雾蓝/淡紫纸面风格，强调选行与同屏预览，不引入写入、图表、性能或官方背书。
- 接下来逐画幅调用支持参考图的内置imagegen，一次整图生成，生成后归档实际返回、底图和最终图并人工检查。不使用外部服务Key，不本地贴字、拼贴、裁切或修补；生成图与README原生证据明确区分，最后本地提交、不发布。
- 3次独立内置调用均成功：3:4为1086×1448、4:3为1448×1086，横向伴随为1672×941（整数像素近似16:9）；保留实际尺寸不裁切。最终3张PNG、3张无人物底图与工具原始输出逐字节相同，完整解码通过；原始输出不删除、不覆盖。没有追加候选或审美返工。
- `cover_plan.md` 整理为实际交付状态，新增 `generation-record.json` 保存真实返回字段名/MIME/源文件名、引用素材、尺寸和哈希，不伪造模型或内部字段，不收录本机默认绝对路径；实际output_hint仅留忽略目录。新增 `docs/promotion/README.md` 提供三图、文案、素材和提示词入口；`docs/verification/marketing-2026-10-20.md` 补交付检查与原生证据/生成视觉的区别。
- 三图已逐张人工检查标题、只读范围、项目识别、Hash选行与JSON预览。原生浏览器约299px缩略图下标题仍可辨识，三图加载正常，未本地改图；临时视口已复位、页面及所属服务已关闭。运行源码、现有图标、两张README原生截图、依赖/锁文件、日常DSH与业务数据不变；随后完成公开文件链接/哈希/差异检查并提交最后小目标，不发布、不推送。
- 最终12份相关Markdown、90处本地链接、围栏与路径检查通过，无机器绝对路径或明显凭据；3个最终图/底图/源工具PNG哈希一致，prompt齐全，原始Hash副本和icon.svg副本与来源一致。两份README和PROMOTION的tone lint、README图片/SVG审计通过，当前差异不包含运行源码、依赖、锁文件或原图标；校验服务均确认退出。仅暂存本小目标素材、说明及日志，按已授权要求本地提交。

## 2026-10-20：README 顶部轻量动画标题

- 用户希望参考自己的 GitGraph README 顶部 GIF。已只读核对该 README、Git 中保存的 SVG/运动配置与 GIF：参考文件为1200×280、5秒循环。其当前工作树缺少素材，从 HEAD 对象提取到本项目忽略目录查看，未恢复、修改或提交 GitGraph 文件。
- `docs/screenshots/readme-header.svg`、`readme-header-motion.svg`、`readme-header-motion.json` 新增可编辑标题及运动配置，复用现有 icon.svg 的数据库路径与青紫橘导航色，以 DB→目录→Key 的依次强调表达浏览顺序；文字始终可见，稳定停留后淡出循环，不模拟真实服务器活动。
- `README.md`、`README.zh.md` 仅在最顶部增加共用 GIF 并在语言切换旁提供静态入口；原有功能、安装命令、真实截图、边界、版本事实及未实施写入规划保持不变。`docs/screenshots/README.md` 补来源与维护说明，本文记录原因和影响。既有包白名单已覆盖该目录，不改 manifest、运行源码、依赖或当前 DSH 安装。
- 接下来导出 GIF，核对首尾、静止段、透明轮廓、实际时长/体积，再执行双语链接和 README 审计、原生浏览器宽窄明暗预览；通过后本地提交，不对外发布或推送。所有临时生产、预览文件限于所属忽略目录，结束停止所属预览服务。
- 导出环境未提供ffmpeg/ffprobe/rsvg-convert，复用技能的命名层合成逻辑与已安装Sharp/Pillow，无新增依赖；第一轮发现透明色键重复，修正私有编码器后最终文件通过全帧解码。成品1200×280、150源帧/75编码帧、5000ms无限循环、199871字节（约195KiB）；静止1.6–3.9秒逐像素一致，首尾相同，透明轮廓稳定，已人工检查进入/停留/退出。
- 两份README各4个图片引用及新增SVG基本审计通过；README/素材说明共51处本地引用、12处锚点有效。去除两处顶部新增后正文与HEAD逐字一致；项目icon、2张原生截图、原流程图哈希不变。没有修改运行源码、依赖、锁文件、manifest或版本，不为文档变更重跑产品测试。
- 完成双语×明暗×宽窄8组原生浏览器预览并人工查看；980视口/900内容列、360视口/约344.8实际列宽下全部图片加载、无整页横向溢出。临时视口已复位、所属标签关闭、HTTP服务确认停止；新增 `docs/verification/readme-header-2026-10-20.md` 保存实际方法、失败轮次及检查边界。接下来只对本小目标精确暂存并本地提交，不推送。

## 2026-10-20：打开中文版 README 完整本地预览

- 用户要求把顶部动图、原生截图和文字放在同一页查看，暂不发布。复用既有 Markdown 渲染模板，在忽略目录 `.scratch/artifacts/readme-header-20261020/` 生成 `README.zh.full-preview.html` 与私有导出助手；默认展开功能详情，保留明暗、900/360宽度与展开/收起控件，4个图片资源以原始字节内嵌，方便离线完整查看。
- 导出助手首次因Windows换行未匹配模板终点，规范化临时模板读取后成功；最终HTML约499KB，核对4个内嵌图片与源文件逐字节相同、详情展开、末尾规划及许可正文存在。没有改README、图片、运行源码、依赖或安装，不启动项目/预览HTTP服务，不重复运行产品测试。
- 内置浏览器自动安全策略拒绝file协议（仅允许HTTP/HTTPS），未绕过策略。改用Codex受支持的本地文件打开工具，向当前聊天右侧面板发出打开请求，返回queued；不将排队当成已经看到页面或本轮浏览器验收通过。提供可直接打开的本地HTML文件入口；本记录按既有授权本地提交，不发布或推送。

## 2026-10-20：准备上传 GitHub 并查看线上 README

- 用户本轮明确要求推送GitHub并打开README，作为新的上传授权；按上下文将语音中的“email”理解为README，不操作邮箱、Release、注册表或社区市场。当前main基线bf3ecec，工作树干净，无remote；GitHub连接器与现有Git认证均确认账号WhitePlusMS，两种认证查询目标WhitePlusMS/dsh-redis均返回404。
- 按项目约束委派GPT-6 Luna只读盘点代码/文档与main可达历史，仅接受路径、统计和检索描述，由主代理复核：当前838个跟踪文件、约31.7MiB、78提交；不会把node_modules、未跟踪runtime/artifacts或其他本地分支自动当成推送目标。当前完整Git树包括历史验收资料；package.json成品白名单不决定Git推送范围。
- 主代理核对真实数据JSON的businessValuesSaved=false、独立验证写入数为0；相关文档标明脱敏断言及合成选择截图。限定检索当前文本与main可达历史的常见token前缀、长sk串、AWS访问Key、PEM私钥头、含账号密码URL无匹配；未覆盖图片OCR、混淆及通用secret scanner，不将其描述为绝对安全保证。
- Git Credential Manager现有凭据仅在子进程内用于官方GitHub API认证核对，未输出、保存或修改认证值；按官方REST文档确认可用的个人仓库创建端点，当前未调用创建操作。原生GitHub新建仓库页面显示未登录，但API认证可用；未向网页填入凭据。
- 已向用户询问在WhitePlusMS下新建dsh-redis的私有/公开选择，建议先私有；这是缺少目标可见性信息，不是重复请求已有推送授权。等待明确选择期间不创建远端、不配置origin、不上传；本小目标只更新本文并本地提交。未改README、运行代码、依赖、DSH、模型或代理配置，未启动服务或重复执行产品测试。

## 2026-10-20：创建已确认的私有 GitHub 仓库

- 用户明确选择“新建私有仓库”，据此创建 `WhitePlusMS/dsh-redis`；官方API回读确认owner、仓库名及private=true，未扩大可见性。已有认证仅在进程内使用，未输出或写入文件；临时仓库元数据不含凭据，保存在忽略目录。
- 当前main检查点8b8b24e、工作树干净且无remote，新增origin为 `https://github.com/WhitePlusMS/dsh-redis.git`；不更改用户其他项目的远端或本地原型分支。仓库初始默认分支沿用账号设置，首次推送main后将新仓库默认分支设为main，便于首页直接展示当前README。
- 本小目标只补本文并本地提交；下一步推送明确的main分支和其可达历史，不推其他分支、标签或未跟踪资料。随后核对远端提交、默认分支和私有状态，并打开中文版README确认动图/截图的实际GitHub显示；未把仓库创建当成已经推送。
- 不修改运行代码、依赖、README正文、实际DSH或业务Redis，不启动项目服务，也不创建Release、注册表发布或社区投稿。

## 2026-10-20：私有仓库首次推送与 GitHub README 实际查看

- 首次明确推送main成功，Git返回new branch并建立origin/main上游；检查点为c9997cfc7e0f4a5f07eae4bf3c034db5dc808045。官方API核对同一分支提交，已将这个新仓库默认分支设为main；回读确认private=true。git ls-remote只显示main，未上传其他原型分支或标签，当时HEAD与origin/main为0/0。
- 官方Contents API逐项对比README.md、README.zh.md、动画GIF、静态SVG、Hash/Stream原生截图与流程SVG共7个文件，远端blob SHA均与本地Git对象相同。保留本地开发包与预发布宿主事实，没有把私有源码上传描述成成品Release或公开市场发布。
- 通过用户现有Chrome GitHub会话打开 `https://github.com/WhitePlusMS/dsh-redis/blob/main/README.zh.md`，原生页面确认中文版正文与预览视图；DOM核对4种正文图片全部加载，GIF为1200×280，两张原生截图1280×720，流程图1200×176。GitHub另含一个隐藏GIF副本，不重复计为素材。
- 已保存1520×4225的原生完整页面截图，以及仅截取顶部、保留GitHub与仓库上下文的展示副本；实际文件与不含签名查询参数的图片检查记录均留在忽略目录 `.scratch/artifacts/readme-header-20261020/`。已人工查看顶部动图、中文介绍及原生Hash截图同屏效果，用户请求的Chrome标签已标记为交付保留；没有更改用户原有标签、登录资料或浏览器视口。
- 本小目标仅更新本文，本地提交后继续按已授权推送main并核对最终远端SHA；不修改README正文、产品代码、依赖、运行配置或实际DSH，不启动服务、不连接业务Redis，不重复执行产品回归，也不创建Release、外发消息或社区投稿。

## 2026-10-20：按 GitGraph 与官方机制修正安装、版本与发布说明

- 用户指出README把本地绝对路径作为主要安装入口，漏掉固定版本tag/Release成品及界面/CLI两种方式。本次完整对照用户提供的DSH_PLUGIN_GUIDE.md，并核对GitGraph当前线上0.5.1 README与f4ae9a9发布工作流；本地旧README仍是0.5.0源码归档说明，不能作为最新交付流程直接照搬。
- 重新浏览固定dsh-v0.2.0-rc.2的官方publish与ui-plugin-manager说明；按项目约束由GPT-6 Luna提供固定源码解析/包管理描述，主代理核对当前manifest和Git树事实。DSH支持界面/CLI tarball安装，tag+Release是项目采用的版本交付约定，不称为官方唯一强制渠道；Redis的lib不入Git且无prepare，不将源码tag压缩包当作构建成品。
- README.md、README.zh.md同步新增维护者版本交付顺序、Release附件和校验文件、界面/CLI两个入口、私有附件登录下载后Host本地安装、公开Release URL示例、更新及原profile启用/重启。补独立卸载与FAQ、仓库作者/反馈入口；源构建移往详细文档，原功能、四工具、六类型、隐私边界、原生截图和5条写入候选保留。
- docs/INSTALLATION.md、INSTALLATION.zh.md前置固定版本Release成品取得方式，界面/CLI使用同一来源；本地构建移到后面的维护部分，保留SHA开发包步骤与数据清理说明。统一默认CLI命令，补Release404/私有权限、源码缺lib与失效开发路径排查；不假设浏览器或Git凭据会自动授权Host下载私有Release。
- docs/DEVELOPMENT.md将未来发布章节细化为检查提交、打包校验、版本tag、Release双附件、重新下载与两种安装入口验收的流程；修正已配置私有远端的状态及任务授权措辞，说明Redis尚无Release自动化。CHANGELOG.md同步私有源码/仍未发布的真实状态及本轮文档变化。
- 官方API回读确认仓库仍私有、main为默认分支，当前tag和Release列表均为空；v0.1.0完整地址只作为待发布格式示例，没有伪造已存在的附件。修改原因是补齐普通用户与维护者的交付步骤，影响仅7份Markdown，不修改代码、manifest、依赖、构建流程、DSH安装或Redis数据，不实际创建tag/Release或安装插件。
- 下一步检查中英文命令/版本/链接一致、PowerShell示例语法、README图片和新增锚点、差异与原生预览；通过后按既有授权本地提交并同步这个私有仓库，不运行示例中的安装/卸载/tag命令，不因纯文档变更重复产品回归。
- 文档静态检查通过：6份主文档77处本地引用、31处锚点；两份README各4张图片引用有效，中英文README的4段PowerShell与两份安装指南的6段PowerShell逐字一致。原有图片、四工具标识、各5条写入候选保留，package/锁文件/原图字节不变；本次差异仅7份Markdown。
- PowerShell示例仅进行AST解析，不执行安装/卸载/Tag/Host命令。最初校验器未兼容CRLF的代码围栏终点而匹配0段，该轮不计通过；修正临时校验器并强制预期24段后，实际24段语法错误为0。双语README及安装/开发说明oil-tone检查通过；补中文强调标签后的空格，避免CommonMark把标记显示为普通文字。
- 拉取私有origin后确认当前main与origin/main为0/0；即将精确暂存本轮7份文档、提交并同步main，再核对GitHub实际安装章节显示。没有新增发布工作流、创建tag或更改版本，所有v0.1.0附件地址仍标明待发布。
- 文档小目标提交38b7a28并推送私有origin/main成功。通过已有Chrome会话刷新实际GitHub中文版README，确认“方式一：从DSH界面安装”“方式二：从CLI安装”、tag/校验文件、固定附件地址、卸载命令与强调的当前未发布状态均已出现；实际定位到安装章节并保存原生画面，标签继续保留供用户查看。
- 原生检查记录及截图位于忽略目录 `.scratch/artifacts/install-docs-20261020/`；只核对文档渲染，未把待发布URL视为下载成功，也未冒称Release安装已验收。此收尾仅更新本文，继续本地提交并同步main，最终核对远端一致与无新增tag；源码、依赖、现有动图/截图、日常服务及业务数据未变。

## 2026-10-20：发布 v0.1.0

### 小目标一：冻结首版发布说明

- 用户明确授权创建v0.1.0 tag和GitHub Release，上传成品包及校验文件，保持仓库私有，并实际验证DSH界面与CLI两种安装入口；这是本轮新的发布授权，替代此前仅整理文档的边界。每个小目标继续本地提交。
- README.md、README.zh.md、docs/INSTALLATION.md、docs/INSTALLATION.zh.md同步固定v0.1.0 Release、成品附件及访问权限说明，删除已不适用的待发布示例表述。私有仓库仍采用登录下载后Host绝对路径安装，未冒称Host能继承浏览器身份。
- CHANGELOG.md将首版用户可见行为归入0.1.0，日期2026-10-20，保留Unreleased供后续记录；docs/DEVELOPMENT.md同步当前分发版本和本轮安装验收范围。六类型只读边界、未来写入候选、预发布宿主与已知样式问题均保留。
- 修改原因是使即将打包的文档与已授权的首版交付一致，影响仅上述6份文档及本文；不改运行源码、manifest、锁文件、素材或日常DSH配置。标签与Release尚待默认prepack检查及成品核对通过后创建，安装结果在实际执行后单独记录。
- 冻结依赖安装通过（Already up to date，pnpm11.22.0）；6份主文档57处本地引用、围栏、中英文安装命令一致性、四工具及各5条后续写入候选检查通过，git diff --check通过。当前main仅精确提交这7份Markdown，接着从该检查点执行默认打包。

### 小目标二：生成并核对首版成品

- 从干净的86eb93b7b174ce7d8d04260e450d658c4ad52e8d执行默认pnpm pack；prepack完成Host/Client/tests严格类型、全新构建、21文件205项回归，全部通过。成品输出在忽略目录.release/v0.1.0，不跳过构建或检查钩子。
- 归档为dsh-redis-0.1.0.tgz，408868字节，SHA256为95f18567132ee9d75c212a162b9c332a1ea422b06f1d16a2cd6660d4597245d7；生成同一文件的SHA256SUMS.txt。检查86个文件、62个lib入口、64处包内相对链接、许可及所有来源字节，manifest仅包含pnpm正常规范化差异。
- 新增docs/verification/release-v0.1.0-2026-10-20.md记录本次结果和验收范围；本小目标只提交该报告与本文，不改变已打包文件。随后tag固定在已检查源码86eb93b，不将后续验收记录误称成品来源，也不移动tag；真实上传及安装结果待执行后追加。

### 小目标三：发布私有Release并回下载核对

- 已按授权推送main和附注tag v0.1.0；tag解引用固定86eb93b，未推送其他本地分支/标签。GitHub API在发布前后均核对仓库ID1425983719、WhitePlusMS/dsh-redis、private=true。
- 创建Release草稿417629679，上传同一次核对的408868字节tgz和87字节SHA256SUMS.txt，检查两个附件的state/size/digest后正式发布。Release地址为https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.0，北京时间2026-10-20 02:51:03；没有npm发布、市场投稿或可见性修改。
- 从正式Release重新下载两附件，逐字节一致，下载的校验文件再次验证tgz通过。Git认证只在子进程内使用、不落盘；签名资源重定向不携带API Authorization。忽略目录仅存非凭据发布元数据及所需成品。
- docs/verification/release-v0.1.0-2026-10-20.md追加真实标签、Release、附件与回下载证据；修改原因是区分已完成的发布与待执行的安装验收，影响仅报告与本文。本小目标本地提交后继续用正式下载附件验证CLI和原生界面。

### 小目标四：实际CLI安装验收

- 使用正式Release回下载的同一个95f18567成品，在全新独立DSH_HOME中调用官方DSH CLI0.2.0-rc.2；按正常命令安装、list列出0.1.0，dump-config确认ui-redis组合，安装后86文件逐字节一致。没有用ignore-scripts/offline参数改变用户文档的安装路线。
- CLI卸载成功、包链接与ui-redis组合均移除，专门创建的空连接资料保留且字节一致；finally核对所属绝对路径后清理本轮临时home。此轮无Host/Redis服务，不读写日常profile或业务数据。
- 原生Chrome已打开正式Release，确认v0.1.0、86eb93b、两个上传附件和校验值，保留该交付页；截图只含发布说明与仓库上下文。报告追加CLI实际结果，影响仅docs/verification/release-v0.1.0-2026-10-20.md及本文，记录后本地提交；原生UI安装继续单独验收。

### 小目标五：原生界面安装、启用与收尾

- 另建无日常凭据的独立Web profile，原生浏览器实际执行插件→添加插件→正式下载包绝对路径→安装→立即启用。详情显示v0.1.0、ui-redis运行中；会话右栏Redis入口、样式及连接表单正常，Host记录Read-only Host registered，86个安装文件与正式包一致。没有连接Redis或调用真实模型。
- 实测本地tgz安装没有单独的版本预览页，改在安装后插件详情核对。README.md、README.zh.md、docs/INSTALLATION.md、docs/INSTALLATION.zh.md据此修正操作顺序；这是一处文档勘误，不重新打包、覆盖发布附件或移动v0.1.0。Release说明补充已验收状态和实际核对顺序。
- 安装日志的peer警告经限定GPT-6 Luna源码事实及主代理复核：临时profile的pnpm静态检查缺少14个宿主共享peer，DSH运行时另有安装scope解析/浏览器共享模块机制。保留该观察，不为消除警告重复安装DSH/React；实际Host/Client加载成功，不把pnpm peers check记作通过。验收定位器两次歧义按真实DOM作用域处理，无产品补丁。
- 报告docs/verification/release-v0.1.0-2026-10-20.md追加UI流程、peer提示、文档勘误和范围。所属Host54328、端口8343/8344均停止，临时home已清理；日常7198继续监听。修改原因是保存实际用户路径及验收结果，影响仅上述4份指南、报告与本文；接着检查文档、精确本地提交并同步main，保持发布tag与附件不变。
- 小目标五提交fe39f4c并同步私有main成功；回读确认远端main与本地一致、0/0，工作树干净。Release仍已发布且private=true，两附件ID/大小/digest、源码tag解引用均未变；正式回下载包SHA仍95f18567。6份文档57处引用和双语命令一致性复查通过，运行源码/脚本/tests/manifest/锁文件/patch/图片相对86eb93b无变化，不重复产品测试。
- 最后原生刷新GitHub Release，实际确认已加入CLI与界面验收状态、安装后版本核对勘误、完整报告链接；Release页保留供用户查看。收尾仅补报告及本文并本地提交、同步main，清除已停止夹具的私有控制指针；不移动tag，不替换成品包，不启动任何额外服务。

## 2026-10-28：DSH AI 原生能力只读实施规划

- 用户要求将已讨论的顺序写为完整本地实施方案和任务清单，本轮先不改代码，后续优先做不写入 Redis 的内容。当前源码基线为 `7be8f4a7c1ded2ba1cb47196ed6025a5039c0689`；写文档前工作树干净，插件 `0.1.0`、宿主及 SDK `0.2.0-rc.2`。
- 新增 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md`，明确由 DSH 自带 AI 调用插件工具，人工和 AI 共用 Host 能力；逐阶段描述范围、当前基线、调用分层、结果和预算、界面回执、已有连接管理、诊断、拓扑扩展、专业类型与验证要求。修改原因是把泛化的客户端路线收敛为可实施的 DSH 插件能力，避免另造模型或业务工作流。
- 新增 `docs/DSH_AI_READONLY_TASKS.md`，登记 33 项待开始任务，每项包含交付、源码候选范围和验收条件，总表列明直接依赖；单列 5 项 Redis 写入暂缓任务。实际非写入顺序为第 1→2→4→5→6 阶段，第 3 阶段不作为后续依赖。旧 29 票与历史验收不改写、不冒充新范围完成。
- 只读边界包含连接/断开、SELECT、界面状态及用户明确请求的本地偏好/报告保存；排除改值、TTL 修改、删除、Stream 消费推进、服务器配置修改、任意命令和脚本。写入确认框架也暂不建设。环境、模块和组合模式须分别验证，不因命令叫“查询”就认定无副作用。
- 源码复核确认正式访问使用自建 TCP/TLS RESP2 transport，不能把现有 redis npm 依赖当作已经支持 Cluster/Sentinel。方案将正式连接库/架构选择放在独立前置任务，宿主 API 也须按固定版本核验，不自动升级或改日常环境。
- 本轮影响仅上述两份新 Markdown 与本日志；未修改运行源码、测试、脚本、manifest、锁文件、现有功能文档和发布物，未连接 Redis、调用真实模型、启停服务、安装插件或提交推送。接下来回读文档，检查任务数量/依赖、链接、写入暂缓边界、差异与 UTF-8；纯文档变更不执行会生成构建产物的产品编译和回归。
- 文档校验通过：33 个 RO 条目与总表一一对应且均待开始，5 个 W 条目均暂缓；直接依赖有效且无循环/悬空引用，20 处本地链接有效，UTF-8 无替换字符、代码围栏成对。历史日志前缀与 HEAD 原文一致，`git diff --check` 通过；最终修改范围核对为两份新文档及本日志。以上仅为文档检查，不代表代码功能、Redis、原生 DSH 或模型回归通过。

## 2026-10-28：启动只读能力实施

- 修改 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：根据用户授权启动实施；将各连接模式的技术前置统一指向公共契约，允许已满足前置条件的专业读取独立推进，并保留最终全范围验收依赖。原因是避免无关环境缺失阻塞；推荐阶段顺序与写入暂缓边界保持不变。
- 修正 RO03 对无选择且无显式目标的失败条件；RO05 补充连续预算的归属、累计、重置和继续规则；说明 Redis 数据作为工具结果可能进入 DSH 与模型链路，真实业务数据须先明确范围。以上为实施约束澄清，尚未改变运行代码或连接 Redis。
- 新增 `docs/verification/readonly-ro01-contract-2026-10-28.md`，记录本机 CLI、项目 SDK、固定上游 tag、现有工具/会话/取消/RPC、Client 侧栏打开接口和现有选择确认的边界；将任务清单 RO01 标记进行中。原因是为后续实现提供可核验契约，避免混淆 Client API 与 Host 调用；运行中的 DSH 实例和界面动作回执仍待验证，不能标完成。本次 `pnpm typecheck` 和 `git diff --check` 通过；没有操作用户 Redis。
- 更新 RO01 核验记录和任务清单总述：沙箱内 Vitest 为 193 项通过、12 项回环连接 `EACCES`；随后允许本机回环后重跑传输专项，12 项通过。两次结果分别记录，不称完整 `pnpm check` 通过；Docker 命令不在 PATH，真实 Redis/DSH 界面和模型验收尚未执行。原因是保留可核验的测试及环境边界；未连接用户 Redis、未更改运行代码。
- 在 `docs/verification/readonly-ro01-contract-2026-10-28.md` 追加隔离 WSL Redis 8.2.6 实测：随机端口上合成 Key 扫描、跨会话拒绝和值不变通过，fixture 已停止并移除；使用既有 `lib`，不代表重新构建验收。执行 `dsh web --help` 曾意外尝试写日常 `profiles/web/cordis.yml`，沙箱 `EPERM` 拒绝，进程退出且未启动服务；后续仅用明确隔离的 DSH_HOME/DSH_AGENTS_HOME。原因是完整记录测试、资源归属与意外操作边界；用户现有 Redis 未连接。
- 校正同一核验记录中 Docker 夹具与 WSL Redis 夹具的表述，避免将 Docker 未运行误写成所有隔离 Redis 均未运行；不影响代码或测试数据。
- 追加隔离代理测试异常记录：第二次 WSL fixture 提示其 Redis 未在规定时间内退出，未取得有效命令顺序结果；复查该次进程号不存在且该次端口无监听，在确认目录真实路径、父目录及 UUID 后仅移除本次 fixture 目录。原因待排查，本次验证未通过；未连接或关闭用户 Redis，未清理历史 fixture。
- 追加隔离 DSH Web 启动尝试：仅使用新建空工作目录、独立 DSH_HOME/DSH_AGENTS_HOME 和精简环境；测试脚本未获得启动及退出可靠回执，进程查询未发现符合该次命令的 DSH/Node 进程，核对路径及无重解析点后移除该次临时目录。原因是记录运行实例核验缺口；不能将此尝试记为通过，用户当前 DSH Web 地址仍待确认。
- 更新 `docs/verification/readonly-ro01-contract-2026-10-28.md`：用户确认日常 DSH 未启动；以独立空目录、随机回环端口及精简环境启动隔离 DSH Web，观察到 ready 后结束本次进程树并清理专属目录。此证据仅覆盖宿主启动，尚未加载 Redis 插件或验证原生界面、真实模型。另一次只读检查运行 `dsh --profile web --help` 再次触及默认 profile，沙箱 `EPERM` 拒绝；未启动服务，后续禁止无隔离环境的 profile 命令。
- 更新 RO01 契约报告与任务清单：核对实际启动入口及其 `dsh-app-boot` 均为 0.2.0-rc.2，结合固定版官方接口源码和隔离 Host ready 证据，将 RO01 标为完成并启动 RO02。原因是完成宿主基线及接口证据归档；原生 Client、插件加载和真实模型仍须后续单独验收，不因 RO01 完成而宣称通过。
- 修改 `tests/redis-transport.test.ts`：让现有模拟回环服务支持合成密码，并新增 AUTH、PING、SELECT、SCAN 顺序测试。原因是区分建连认证、显式切库和数据查询，验证只读传输实际发出的命令；测试仅连接自身随机端口，不改变运行时代码或访问用户 Redis。`pnpm typecheck` 通过；提升本机回环访问权限后，传输专项 13 项通过。
- 修改 `src/host/connection-service.ts` 和 `tests/key-browser.test.ts`：普通读取路径在运行时拒绝 SELECT，并验证拒绝时不会向 transport 发命令或改变会话状态，正常专用切库仍递增代次。原因是 TypeScript 的排除类型不约束无类型调用，若绕过会使服务器实际 DB 与会话记录不一致；不改变常规读取和专用切库接口。`pnpm check` 完整构建和 21 文件、207 项测试通过；旧 `lib` 已备份至 `.scratch/runtime/ro02-lib-backup-4b0049e7-d5bb-470c-9583-054d341cec50`。
- 补强 `tests/redis-transport.test.ts` 的模拟认证、切库和扫描参数断言，原因是仅验证命令名称不足以发现错误参数；`pnpm typecheck` 与 13 项传输专项通过，测试使用合成数据和自有本机端口，不单独代表真实 Redis 命令跟踪。
- 新增 `docs/verification/readonly-ro02-boundary-2026-10-28.md` 并将任务清单 RO02 标为完成：新构建产物使用独立 Redis 8.2.6 和代理验证 AUTH、PING、SELECT、SCAN 轨迹与合成值不变，fixture 已停止并移除。报告明确 transport 的命令白名单、少数命令精确验参及其他命令由 reader/schema 限制的区别；未连接用户 Redis，原生 DSH 插件和真实模型留待后续验收。
- 开始 RO03：修改 `src/host/ai-reader.ts`、`src/host/ai-tools.ts` 和 `tests/ai-tools.test.ts`，为状态/切库结果增加状态采样时间、切库请求目标，为 Key 扫描回显实际 pattern，为值读取标识显式目标或侧栏选择，并同步工具说明与专项测试。原因是让模型区分请求与实际连接、当前数据与旧选择；复用现有连接、reader 和分页 DTO，不改变 Redis 命令。任务清单 RO03 标记进行中，检查结果随后记录。
- 补充 `tests/ai-tools.test.ts`：验证官方工具渲染包含显式目标来源，并模拟切库权限拒绝，核对请求 DB 与实际 DB 分开返回；原因是避免失败被解释为成功。首轮 `pnpm typecheck` 及 14 项 AI 工具专项通过，本次新增断言待复测。
- 改进同一测试的拒绝场景：通过注册的 `redis_viewer_select_db` 工具和模拟 Redis `NOPERM` 响应验证错误映射、请求 DB 与实际 DB，不直接替换连接服务。原因是覆盖完整工具路径；修改前 15 项 AI 专项及类型检查通过，本次修改后继续检查。
- 修改 `src/host/connection-service.ts`、`src/host/ai-reader.ts`、`src/remote-service.ts` 和 `tests/ai-tools.test.ts`：共享连接视图校验，AI 与界面切库结果过期时不清理替换连接的选择；新增两条入口的可控并发回归。原因是旧切库返回的 stale 结果可能携带新连接代次，原逻辑会误清新选择；不新增 Redis 命令或跨会话访问。检查结果随后记录。
- 修复 `tests/ai-tools.test.ts` 的测试夹具类型：首次类型检查报私有字段交叉类型被归约为 `never`，改为先创建实例形状再用 `Reflect.set` 注入模拟依赖；原因是让测试可在严格 TypeScript 下执行，不影响生产代码。
- 独立复核发现仅比较连接视图字段仍不能区分新旧连接恰好返回相同权限错误的情况；修改 `src/host/connection-service.ts`，原连接记录已被替换时明确返回 stale，且 stale 视图不视为当前视图；在 `tests/ai-tools.test.ts` 为 AI 和界面入口分别补充两次切库均被拒绝的并发回归。原因是保护新连接的选择和错误状态；上一版完整构建与 211 项测试通过，新修改需重新验证。
- 进一步复核发现切库成功后、返回调用方之前，同一新 DB 已产生的选择也可能被延迟清理。重新调整 `src/host/connection-service.ts`、`src/host/ai-reader.ts`、`src/remote-service.ts`：在切库同步递增代次时通过回调清理旧状态，不在异步完成后清理整会话；保留过期结果检查。`tests/ai-tools.test.ts` 增加 AI 和界面入口的新 DB 选择交错测试；原因是清理必须与启动的切库操作绑定，不得覆盖新状态。修改前类型检查通过，本次修改后继续检查。
- 完整梳理切库生命周期后，修改 `src/host/connection-service.ts`：错误处理核对原连接记录、操作代次及当前状态，迟到结果不能覆盖断开或重连；若传输故障已由 onFailure 登记，则保留真实错误。`tests/key-browser.test.ts` 覆盖断开后迟到成功、权限拒绝和取消；`tests/connection-service.test.ts` 覆盖在途网络故障。原因是单靠连接记录身份无法区分同一记录被主动断开；上一版 `pnpm check` 为 21 文件、215 项通过，本次需重新验证。
- 新增 `docs/verification/readonly-ro03-ai-results-2026-10-28.md` 并将任务清单 RO03 标为完成：独立复核未发现新的可复现阻断问题；最终 `pnpm check` 构建及 21 文件、219 项测试通过。新构建产物经隔离 Redis 8.2.6、合成数据和正式工具注册完成四工具调用，观察到限定命令且数据未变，fixture 已停止并移除。此次无真实模型对话、原生界面或用户 Redis 验收。
- 开始 RO04：修改 `src/domain.ts`、`src/typert.shared.ts`、`src/host/connection-service.ts`、`src/client/ConnectionForm.tsx`、`src/client/locales.ts` 和任务清单，增加可选环境标签并随连接建立时复制到实际连接状态；界面从真实连接显示标签，未填写显示未知环境，资料可保存用户填写的标签。RPC 协议版本升为 3，以同步 Host/Client 契约；原因是避免当前草稿或其他资料被误显示为当前服务器环境。标签为空是正常未指定状态，未删除或重写用户资料；类型、测试和界面验收随后进行。
- 同步 `src/typert.host.ts` 的 Host Zod 校验，并更新 `tests/host-typert.test.ts`、`tests/profile-store.test.ts`、`tests/connection-service.test.ts` 和 `docs/DEVELOPMENT.md`；原因是 Host 与浏览器共享协议必须一致，同时验证标签约束、资料持久化、实际连接快照与协议版本。前一版类型检查通过，本次继续检查并进行原生界面验收。
- 修改 `src/client/ConnectionForm.tsx` 和 `src/client/styles.ts`：连接状态条限制环境标签宽度并保留完整 title，连接提示允许长标签折行。原因是避免窄侧栏中长标签挤出其他状态控件；标签仍取实际连接快照。此前类型检查及 28 项协议、资料、连接专项测试通过，当前样式仍需真实浏览器验收。
- 新增 `src/connection-errors.ts` 并更新 `src/client/locales.ts`、`src/host/ai-reader.ts` 和 `tests/ai-tools.test.ts`，让界面中英文和 AI 中文错误解释共用固定错误码文案；AI 按连接、扫描或读取的实际错误返回说明，保留原错误码。原因是避免界面与 AI 对相同错误解释不一致，不回显服务器原始错误或凭据；检查随后记录。
- 修改 `tsconfig.client.json` 将共享错误文案文件纳入客户端工程。原因是首次类型检查报 TS6307，客户端 composite 工程要求显式列出共享源文件；继续重新编译和测试。
- 扩展 `tests/ai-tools.test.ts`，验证 Key 扫描及值读取被拒绝时 AI 与界面使用相同说明且不回显 Redis 原始错误。原因是统一错误说明必须覆盖读取路径而不仅是切库；修复工程配置后类型检查及 49 项相关专项测试通过，本次修改后继续检查。
- 独立复核发现同一连接在读取中发生网络故障时，AI 返回前的目标检查可能把真实错误误报为 stale；修改 `src/host/connection-service.ts` 和 `src/host/ai-reader.ts`，仅允许同一连接、同一代次和 DB 的对应失败结果返回，替换目标仍拒绝；已失败连接再次读取时说明实际错误。`tests/ai-tools.test.ts` 增加扫描、显式值与选中项三种网络故障回归。调整 `src/client/styles.ts` 的环境标签选择器优先级，以确保省略号规则生效。原因是准确区分故障与旧目标；本次修改后继续检查。
- 在 `tests/ai-tools.test.ts` 补充读取故障后立即重连的交错测试；原因是证明保留同连接错误时不会放行替换连接的旧结果。修改前类型检查和 AI 专项 25 项通过，本次修改后继续检查。

### 2026-10-28：真实 DSH Web 与 Redis 只读验收进展

- 文件与原因：本条追加至 `UPDATE_LOG.md`，记录 RO04 的连接环境标识、统一错误提示及真实界面检查，供后续继续实施和复核。
- 构建与测试：`pnpm check` 通过，21 个测试文件、226 项测试通过；`pnpm pack` 的预打包检查在允许本机随机测试端口的环境中再次通过。默认沙箱下的首次打包因本机测试端口 `EACCES` 失败，未将该失败当作代码回归；隔离依赖缓存缺失后从 npm 官方仓库安装到了项目内临时 profile。
- 实际验收：在 `.scratch/runtime/dsh-readonly-web-20261028` 独立 DSH home 安装本轮构建包，启动绑定本机回环地址的 DSH Web；日志确认 Redis Host 注册，真实侧栏可打开，连接本机 `127.0.0.1:6379` 成功，DB 0 显示已加载 760 个 Key，并只读打开一个 Hash（8 个字段）。无标签连接显示“未知环境”；更改连接表单中的草稿标签后当前连接标识保持不变。
- 影响与边界：真实 Redis 仅用于连接、扫描和查看，未进行业务数据修改；本次未验证真实模型调用。DSH 使用隔离配置和离线占位模型设置，不覆盖日常 profile。任务结束前关闭本轮启动的 DSH；用户已有 Redis 保持运行。
- 其他：一次只读探查尝试在未隔离的 DSH profile 上调用 help/list，CLI 先尝试写锁而被系统拒绝，未成功修改该 profile；后续操作均使用隔离 home。

### 2026-10-28：RO05 会话读取预算基础模块

- 初步接入 `src/host/ai-reader.ts`、`ai-tools.ts`、`remote-service.ts`：四工具共享可信会话预算，读取失败和取消计次；切库、重连和断开清目标而不重置预算。侧栏恢复 RPC 和专项回归仍在接入。
- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/typert.host.ts`、`src/typert.remote-client.ts`、`src/remote-service.ts`：增加会话预算状态和恢复的严格 RPC；协议升级到 4，开发说明同步为 19 个方法。恢复请求不接受外部会话标识。
- 修改 `src/client/index.ts`、`src/client/RedisWorkspace.tsx`、`src/client/locales.ts`：在侧栏按需查看预算，并通过手动按钮恢复已耗尽预算；在途读取未结束时不能恢复。UI 与真实模型验收仍待执行。
- 修改 `tests/ai-tools.test.ts`、`tests/host-typert.test.ts`、`tests/client-bundle.test.ts`：验证跨工具预算、会话隔离、切库不重置、人工恢复和严格 RPC 接线；测试结果以本次实际执行记录为准。
- 已通过当前源码的类型检查、客户端构建及上述专项 47 项；继续补充真实注册的四工具与断开重连、在途取消测试。`docs/DEVELOPMENT.md` 明确计次范围仅为通过 DSH 宿主参数校验后进入执行的调用，避免把宿主拒绝的无效参数误计为已执行。
- 补充验证：四工具混合累计、实际 RemoteService 断开重连、切库及准入后取消均加入测试；再次执行 `pnpm typecheck`、`pnpm build` 和预算、工具、Host 协议、客户端 bundle 专项，共 47 项通过。未运行 DSH 或访问 Redis；真实原生界面和模型验收、分页批尾处理仍待后续。
- 修改 `src/host/ai-reader.ts`、`src/client/RedisWorkspace.tsx`：预算耗尽时提示展开面板、刷新状态后继续；其他面板已恢复时，按照 Host 返回的最新状态展示，不误报恢复失败。`tests/ai-tools.test.ts` 与 `tests/ai-budget.test.ts` 增加提示和双面板回执测试。
- 本次修正后 `pnpm typecheck` 通过，`pnpm exec vitest run tests/ai-budget.test.ts tests/ai-tools.test.ts` 共 37 项通过；尚待新构建的原生界面验收。
- RO05 Key 尾批准备：新增 `src/host/ai-key-pages.ts`，按真实完整 JSON 的 64 KiB 上限切分受限扫描页；`src/host/scan-cursors.ts`、`key-reader.ts` 在当前目标和当前扫描仍有效时允许取消后重试原 Key 游标。此时尚未接入 AI 工具，后续继续完成事务和专项测试。
- `src/host/ai-reader.ts`、`ai-tools.ts` 将 Key 尾批接入注册工具：使用会话、目标和匹配条件绑定的一次性 AI 令牌，预算计费及取消/目标复核后才提交批尾位置；不清除其他数据类型游标。专项验证尚在执行，其他类型和整体 RO05 仍未完成。
- `src/host/ai-reader.ts` 不再在任何单项 AI 超限时清理所有类型游标；新增 `tests/ai-key-pages.test.ts` 覆盖大批次分段、令牌重放和绑定、取消后重试以及单 Key 超限。测试结果随后记录。
- 首轮类型检查与相关测试 58 项通过；继续补充后续尾批取消、切库时旧结果、并发新旧扫描和其他类型超限不影响 Key 游标的交错测试。
- 补充类型检查和专项 62 项通过；继续增加通过正式工具注册的多段读取，以及空页令牌在预算暂停与手动恢复后保持有效的测试。
- 独立审阅发现底层游标推进后、上层保存批次前取消的交错风险；`tests/ai-key-pages.test.ts` 增加确定性回归以复现。该子项仍待修正和复核，不将既有 64 项通过解释为该竞态已通过。
- 针对复现的取消交错，`src/host/ai-key-pages.ts` 在检查迟到取消前保存已成功取回的批次；`src/host/ai-budget.ts` 和 `ai-reader.ts` 将尾批提交及字节结算放在同一同步步骤，提交失败仍计调用但不计未返回的字节。新增专项覆盖。提交结果后若宿主或网络丢失回执，当前机制不能确认模型是否收到，也不能保证该情形自动重放；不得将其视为已解决。
- 修正后 `pnpm typecheck` 与 Key 批尾、工具、Key reader、预算四项专项共 66 项通过，包含先失败再通过的取消交错和失败结果不计字节测试；独立审阅与完整构建尚待主任务执行。
- Hash AI 批尾准备：新增 `src/host/ai-hash-pages.ts` 和可复用值预览 `ai-value.ts`，以完整字段为单位保留尾批；`src/host/hash-reader.ts` 仅在 AI 显式启用时支持安全取消重试。模块尚未接入调用，类型检查和专项测试随后执行；Set、ZSet、Stream 未改。
- `src/host/ai-reader.ts` 与 `ai-tools.ts` 接入 Hash 尾批事务；使用独立前缀区分 Hash 续读令牌，在读取和提交时验证会话、连接、Key、匹配条件及当前选择。共享原有 AI 值预览实现；其他类型批尾未改变。专项测试尚待执行。
- 新增 `tests/ai-hash-pages.test.ts`，使用合成 transport 和正式工具注册检查大 Hash 分段、令牌绑定、取消重试、选择变化与单字段超限；未访问用户 Redis。验证结果随后记录。
- 首轮 Hash 与关联回归 73 项通过；继续补充 Hash 尾批取消、空页预算恢复、切 DB 和新旧请求交错、其他 Key 游标独立性的测试。
- 补充测试首次运行有 1 项失败：测试错误地假设 100 个字段只需两段，实际上由于完整 JSON 预算需要更多段；测试已改为跟随令牌直到结束后再核对全部字段。待复验。
- Hash 批尾及相关回归复验：`pnpm typecheck` 通过，Hash 批尾、AI 工具、Key 批尾、原 Hash reader 和预算专项五个文件共 77 项通过；包含实际 Key 令牌在 Hash 超限后继续、取消交错和旧目标结果拒绝。测试使用合成 transport；真实 Redis、原生 DSH 和真实模型未在该子项验收。工具结果提交后网络丢失回执仍不能自动确认或重放；Set、ZSet、Stream 和 List 的批尾未实现，RO05 整体未完成。
- RO05 Set AI 批尾：新增 `src/host/ai-set-pages.ts`，按完整成员身份及实际 JSON 字节分段；修改 `set-reader.ts` 和 `ai-reader.ts`，仅 AI Set reader 在安全条件下支持取消后重试，Set 专用令牌在探测前识别并绑定会话、目标、Key、匹配条件和选中项。ZSet、Stream、List 批尾仍未实现；专项验证随后执行。
- 新增 `tests/ai-set-pages.test.ts`，以合成 transport 验证 Set 分段、会话/目标/筛选绑定、取消、预算恢复、新旧并发、超限及 Key/Hash 游标隔离；包含正式工具注册调用。类型检查和 Set 基线回归随后执行。
- Set 首轮专项中新增 9 项通过、关联工具回归有 1 项因超限错误缺少“预算”提示而失败；`src/host/ai-set-pages.ts` 已补充清晰文案，随后复验。尚未进行共享事务迁移。
- Set 基线复验：`pnpm typecheck` 通过，Key/Hash/Set 批尾、原 reader、工具和预算七个专项共 101 项通过。新增 `src/host/ai-page-store.ts` 和独立事务测试，提取强类型的状态、分段和提交规则；目前尚未替换任何现有分页实现。
- 隔离真实 TCP 与正式工具核验（主任务执行）：合成数据中 Key 140 个分 3 次、Hash 140 个字段分 6 次完整读回，单结果均不超过 64 KiB；临时 Redis 已由夹具关闭。这不是实际模型对话。
- `src/host/ai-key-pages.ts` 和 `ai-reader.ts` 将 Key 分页迁入共享事务，保留独立状态、原 UUID 令牌及预算提交行为；原取消和并发回归随后重跑。
- Key 迁移后类型检查与四文件 60 项专项通过；`src/host/ai-hash-pages.ts` 现迁入同一内部事务，同时保留独立 store、h: 令牌、完整字段和原有结果语义，Hash 专项随后重跑。
- Hash 迁移后类型检查与五文件 71 项专项通过；`src/host/ai-set-pages.ts` 现迁入同一内部事务，继续使用独立 store 和 s: 令牌，保留完整成员身份与超限说明。三类联合回归随后执行。
- 三类迁移后 `pnpm typecheck` 及分页事务、Key/Hash/Set 批尾、原 reader、工具和预算九文件联合测试 120 项通过。ZSet、Stream、List 不在此次重构中；共享事务仍需独立审阅和完整构建。工具结果提交后的回执丢失不能确认或自动重放。
- 独立复核发现 Hash/Set 续读绕过首读公共参数校验；`src/host/ai-reader.ts` 将既有校验前移到包装令牌处理之前，并复用已校验的探测请求。`tests/ai-hash-pages.test.ts`、`tests/ai-set-pages.test.ts` 验证非法字节数及偏移被拒绝，且原有效令牌仍可续读；修改后检查待执行。
- 复验结果：`pnpm typecheck` 通过，分页事务、三类批尾、工具、原 reader 和预算九文件共 122 项通过；非法参数没有触发新的模拟 Redis 命令。实际模型对话、其他类型批尾以及响应回执丢失仍未验收。
- RO05 ZSet 扫描批尾：新增 `src/host/ai-zset-pages.ts`，使用独立共享事务实例和 z: 令牌保留完整成员及分数原文；`zset-reader.ts` 仅 AI 扫描支持安全取消重试，`ai-reader.ts` 在切换排名读取时同步失效该会话的扫描尾批。类型检查与专项测试随后执行；排名模式分页、List 和 Stream 批尾未改变。
- 主任务隔离真实 TCP Set 核验：140 个合成成员由实际注册 AI 工具分 3 次完整读回，每次不超过 64 KiB；夹具实例已关闭，未执行真实模型对话。
- 新增 `tests/ai-zset-pages.test.ts`，使用合成 transport 验证扫描分段、成员/分数、绑定、取消、排名模式隔离及其他类型游标；包含正式工具注册。类型与测试结果随后记录。
- 首次 ZSet 专项有一项测试超时：夹具将下一次正常响应排在取消模拟之前，导致等待条件不触发；已调整测试响应队列，需重新验证，不能将首次测试算作通过。
- 调整夹具后类型检查与八文件 97 项通过。进一步发现无效排名请求先清扫描尾批，`src/host/ai-reader.ts` 已改为先校验排名参数，再执行模式切换；补充非法参数不消耗令牌、空页预算恢复和新旧扫描并发测试，待复验。
- ZSet 扫描批尾复验：`pnpm typecheck` 通过，ZSet 批尾及原 reader、AI 工具、Key/Hash/Set、分页事务和预算八文件共 100 项通过；含无效排名参数保留令牌、真实工具注册、成员身份和分数原文、取消/切目标及跨类型隔离。使用合成 transport，尚待真实 Redis/原生 DSH/真实模型验证；ZSet 排名、List 和 Stream 的大页批尾未实现，网络回执丢失仍无法自动确认。

- 新增 `src/host/ai-budget.ts`：按可信会话身份累计 AI 调用次数与结果字节；每个并发请求先预留完整单次结果额度，失败或取消也消耗已准入的调用次数。达到上限后只有无在途请求时才能由受信用户动作恢复；会话释放使旧额度凭据失效。
- 新增 `tests/ai-budget.test.ts`：覆盖并发预留、累计字节、失败/取消计数、会话隔离、旧凭据、恢复及非法输入。
- 影响：本模块尚未接入 AI 工具或侧栏，不改变现有 Redis 读取行为；RO05 整体仍在实施和验收中。类型检查和专项测试在修改后执行。

### 2026-10-28：补齐 AI 的 Key 状态说明

- 修改 `src/connection-errors.ts`、`src/client/locales.ts` 和 `src/host/ai-reader.ts`：共享 Key 消失和读取中发生变化的中英文说明，使 AI 的显式读取和选中项读取与界面表达一致，不改变底层状态码或 Redis 命令。
- 修改 `tests/ai-tools.test.ts`：覆盖不存在、读取中内容变化及选中项类型变化的工具结果与界面说明一致；验证结果以实际执行为准。
- 补充修正：`src/host/ai-reader.ts` 识别初次探测与具体类型读取之间的类型变化，避免误报不支持；共享文案不推测变化发生的时刻。`tests/ai-tools.test.ts` 增加 Hash 变为 List 的交错场景。此前完整检查为 227 项通过，本次补充后的检查另行记录。
- 重新核对选中项入口后，修改 `src/host/selected-reader.ts`：已选 List 或 Stream 的实际类型不匹配时统一返回 `changed`，保留缺失与失败状态；相应工具测试覆盖两种类型。前一版完整检查 227 项通过，本次修改后继续检查。

### 2026-10-28：预算面板的真实 DSH 初步验收

- 更新 `docs/DSH_AI_READONLY_TASKS.md`：RO05 标记为进行中，记录已完成的会话预算和仍待完成的超限批尾、真实模型验收，避免将部分结果误标完成。
- 当前构建经 `pnpm pack` 默认预打包检查通过，并离线安装到项目隔离 DSH profile；实际 DSH Web 的 Redis 侧栏显示 AI 读取预算 `0/32` 次、`0/1048576` 字节，手动刷新可用。再次只读连接本机 Redis，DB 0 显示已加载 760 个 Key，普通浏览保持可用。
- 保存另一条隔离测试连接资料后，已连接的服务器和标签保持不变。此验证未覆盖预算耗尽后的原生界面恢复，也未调用真实模型；所有 Redis 操作为读取，日常 DSH profile 未安装本次包。

- 验证结果：本模块新增后 pnpm typecheck 通过，pnpm exec vitest run tests/ai-budget.test.ts 7 项通过；未启动服务或访问 Redis。

### 2026-10-28：Key 批尾全量检查

- `src/host/ai-key-pages.ts`、`src/host/ai-reader.ts`、`src/host/ai-budget.ts`、`src/host/key-reader.ts` 与游标相关修改：为 AI Key 扫描保留受限批尾，确保继续读取先交付已接收的尾部，并在取消、目标变化和并发新扫描时保护游标及预算记账。
- `tests/ai-key-pages.test.ts` 和关联测试覆盖单项过大、令牌、取消及迟到交错；独立审阅发现并复现的两处取消/记账问题已修复并复测。
- 本次 `pnpm check` 通过，23 个测试文件、251 项测试通过。此结果为本机测试，宿主提交后丢失响应无法保证重放；其他类型的批尾、真实模型对话及最终原生验证仍未完成。

### 2026-10-28：ZSet 并发与参数回归复现

- `tests/ai-zset-pages.test.ts`：新增模拟测试，复现旧排名探测迟到、探测返回时取消及扫描与排名参数混用，检查有效扫描令牌不被误消费；不访问 Redis。
- `src/host/ai-reader.ts`、`src/host/ai-zset-pages.ts`、`src/host/ai-page-store.ts`：只对校验通过的 ZSet 操作登记会话顺序，防止旧排名请求清理新扫描；扫描拒绝混用排名参数，取消与无效令牌不能登记或清游标。共享分页器的登记钩子仅用于 ZSet，其他类型保留既有行为。
- `src/host/ai-tools.ts`：工具说明明确 ZSet 扫描不能同时传排名参数；`tests/ai-zset-pages.test.ts` 补充无效请求、其他类型与排名执行中被新扫描取代的交错回归。
- 验证：新增复现测试初次为 3 失败、10 通过；修复后 `pnpm typecheck` 通过，Key/Hash/Set/ZSet 分页、预算和工具共 6 个测试文件 87 项通过。均使用模拟连接；未启动 DSH 或访问 Redis。结果提交后若传输丢失，不能保证响应重放。

### 2026-10-28：ZSet 排名与扫描独立性

- `tests/ai-zset-pages.test.ts`：调整并新增模拟回归，要求成功、取消和迟到的排名请求不会清除扫描令牌，也不因另一个模式的读取而失败。
- `src/host/ai-reader.ts`、`src/host/ai-zset-pages.ts`、`src/host/ai-page-store.ts`：为 ZSet 排名使用独立读取器，移除跨模式顺序及共享分页器专用钩子；排名不再清理 ZSet 扫描令牌，取消及失败不破坏扫描；扫描参数、目标与选择校验和预算提交保护保持有效。
- `tests/ai-zset-pages.test.ts`：补充扫描进行中取消后迟到的排名请求与原扫描令牌仍可使用，以及排名读取失败不影响扫描的交错测试。
- 验证：新模式测试在修改前复现 4 失败、12 通过；修复后 `pnpm typecheck` 通过，分页、预算和工具共 6 个测试文件 90 项通过。测试使用模拟连接，未启动 DSH 或访问 Redis；结果提交后丢失响应仍无法保证重放。

### 2026-10-28：迟到类型探测的分页回归

- `tests/ai-hash-pages.test.ts`、`tests/ai-set-pages.test.ts`、`tests/ai-zset-pages.test.ts`：以模拟连接构造旧类型探测迟到、较新令牌已经提交的交错，验证旧操作不得使新令牌失效；本步骤只添加回归测试，未改实现。
- 验证：`pnpm typecheck` 通过；上述三个测试文件共 3 项新增失败、40 项通过，三项均复现较新令牌续读时返回 stale。结果表明问题尚未修复，测试使用模拟连接，未访问 Redis。
- 主任务此前隔离真实 TCP 验证：140 个合成 ZSet 成员及整数分数经正式注册 AI 工具分 3 次完整读回，各次结果不超过 64 KiB；临时 Redis 夹具已关闭，不代表真实模型对话。
- `src/host/ai-page-coordinator.ts` 与 `tests/ai-page-coordinator.test.ts`：新增独立双槽事务协调器和单元测试，候选页在预算提交时替换当前槽；失败/取消不替换，同类型在途互斥，提交版本用于识别迟到探测。尚未接入生产读取器。
- `src/host/ai-reader.ts`、`src/host/ai-hash-pages.ts`：先为 Hash 接入独立候选槽，类型探测前读取无副作用版本快照，槽清理包括对应底层 reader；Set 和 ZSet 暂未接入。
- 修正 Hash 快照声明位置，使其属于值读取而非 Key 扫描，解决类型检查发现的未使用及未定义错误。
- `tests/ai-hash-pages.test.ts`：按新约定验证同类型在途时明确 busy、提交后可重新开始；迟到探测被拒绝后不再预置错误的额外模拟扫描页。
- `tests/ai-hash-pages.test.ts`：补充真实当前 Hash 令牌与新首读取消、成功替换的模拟组合，核验旧令牌不被未提交候选清除。
- `src/host/ai-reader.ts`、`src/host/ai-set-pages.ts`、`tests/ai-set-pages.test.ts`：Set 使用同一双槽协调器、独立 reader 和提交版本；同步更新在途冲突与迟到探测模拟预期。
- `tests/ai-set-pages.test.ts`：补充 Set 新首读取消后继续使用原令牌的组合回归。
- `src/host/ai-reader.ts`、`src/host/ai-zset-pages.ts`、`tests/ai-zset-pages.test.ts`：ZSet 扫描接入独立双槽和提交版本，排名 reader 继续与扫描独立；调整在途冲突与迟到探测模拟。
- `tests/ai-zset-pages.test.ts`：补充新首扫取消后原令牌继续，以及无效令牌、Hash/Set 操作不使等待中的 ZSet 探测失效。
- 验证：三个迟到探测复现已转绿；逐步接入后 `pnpm typecheck` 通过，协调器、四种分页、预算及工具共 7 个测试文件 101 项通过。测试均为模拟连接，未启动 DSH 或访问 Redis。此项仍需独立复核，提交后的响应传输丢失不保证重放。

### 2026-10-28：空分页协调状态清理

- `tests/ai-page-coordinator.test.ts`：添加会话销毁后旧探测失败及无效令牌不留下空会话状态的复现测试，使用内存夹具，不访问 Redis。
- `src/host/ai-page-coordinator.ts`：无效续读及旧快照不创建空状态；候选失败、回滚或无结果提交后仅在操作身份匹配且无当前槽、无已提交版本时删除空状态，保留有效令牌与版本记录。
- `tests/ai-page-coordinator.test.ts`：补充旧异步请求失败晚于新会话提交的交错，验证旧清理不会移除新状态。
- 验证：先复现 2 项空状态残留，修复后 `pnpm typecheck` 通过，分页、预算及工具共 7 个测试文件 104 项通过；测试使用模拟连接，未启动 DSH 或访问 Redis。

### 2026-10-28：Stream AI 消息分页

- `tests/ai-stream-pages.test.ts`：新增模拟 Stream 大批次及续读取消测试，验证整条消息、重复字段顺序、64 KiB 边界和取消重试；本步骤先复现现状，不访问 Redis。
- `src/host/ai-stream-pages.ts`、`src/host/ai-reader.ts`：Stream AI 采用独立双槽及消息级分段，保留重复字段索引和原身份，值继续标识预览完整性；`src/host/stream-reader.ts` 为 AI 读取增加当前目标内的取消续读恢复。
- 移除 Stream 分页模块未使用的类型导入，修复类型检查错误。
- `tests/ai-stream-pages.test.ts`：补充目标、方向、范围、选择及 count 校验，反向范围、候选取消、旧探测迟到、底层返回后取消和超大单条消息的跨类型游标隔离。
- `tests/ai-stream-pages.test.ts`：补充空页、截断值、预算恢复、成功换槽、提交前目标变化和正式注册 AI 工具调用回归。
- `tests/ai-stream-pages.test.ts` 验证候选消息超限不破坏旧 Stream 令牌；`src/host/ai-tools.ts` 明确 Stream 续读须保持方向及范围并以整条消息分批。
- `tests/ai-stream-pages.test.ts`：新增大批次缓存尾部分页时缩小 count 的回归，用于复现每次返回条数未按最新请求限制的问题。
- `src/host/ai-page-store.ts`、`src/host/ai-stream-pages.ts`：共享分页切片增加可选行数上限，Stream 传当前已校验 count，返回条数与 64 KiB 同时受限；其他类型继续按原规则切片。
- 验证：首次复现大批次直接超限和取消后无法续读；后续又复现缓存尾批 count=1 实际返回 13 条。修复后 `pnpm typecheck` 通过，Stream、分页、预算、工具、Stream view 与 Host codec 共 11 个测试文件 149 项通过。均为模拟连接，未启动 DSH 或访问 Redis；底层 1 MiB 接收上限、单条不可拆消息和提交后响应丢失仍有既定限制，真实模型对话尚未验证。

### 2026-10-28：Key 自动扫描暂停续读

- `src/client/key-loading.ts`、`tests/key-loading.test.ts`：完整批次后暂停时保留游标，手动续读沿用缓存和累计页数并重置本轮页数/时间限制；缓存溢出、失败和取消不提供续读令牌。该步骤尚未接入按钮。
- `src/client/KeyBrowser.tsx`、`src/client/locales.ts`：暂停状态提供继续扫描入口，同步防止重复点击；切换目标、筛选或页面隐藏时取消并丢弃续读令牌，缓存溢出仅提示缩小范围；补充中英文提示。
- `src/client/key-loading.ts`、`tests/key-loading.test.ts`：统一可继续及取消状态判定，补充缓存恰好满额、随后溢出和隐藏取消的状态回归；完整末页恰好满额仍可标为完成。
- `src/client/KeyBrowser.tsx`：数据库选择结束时按控制器身份清理忙碌标记，防止无效阻塞续读；防双击使用弱引用，避免额外保留整份 Key 缓存。
- `tests/key-loading.test.ts`：补充续读期间失效令牌与取消后迟到响应的模拟回归；`README.md`、`README.zh.md`：区分每轮自动扫描预算与总缓存上限，并说明手动继续和缓存批尾丢弃后的处理。
- `tests/key-resume-browser.test.ts`：增加本地浏览器模拟交互，验证到达 1000 批暂停后双击继续仅调用一次且使用原游标；浏览器不可用时跳过。双语 README 补充 60 秒限制只阻止启动后续批次。
- `tests/key-resume-browser.test.ts`：为浏览器路径增加明确的类型收窄，修复类型检查错误。
- `tests/key-resume-browser.test.ts`：首次交互测试超时，增加页面错误诊断和短等待，用于定位模拟页面问题。
- `tests/key-resume-browser.test.ts`：测试包使用与项目构建一致的自动 JSX 配置，修复模拟页面因 `React is not defined` 未渲染的问题。
- 验证：`pnpm typecheck` 通过，Key 加载、Host 游标与本地 Chrome 浏览器模拟交互共 3 个测试文件 32 项通过；浏览器模拟了 1000 个空批次及双击继续，确认仅发送一次原令牌并显示后续 Key。未启动 DSH 或访问 Redis，真实 DSH 界面及用户数据未在本步骤验证。

### 2026-10-28：Key 扫描失效提示

- `src/client/KeyBrowser.tsx`、`src/client/locales.ts`：Key 扫描状态失效时提示列表可能不完整并手动刷新，已加载内容保留；其他连接错误继续使用原提示。
- `tests/key-resume-browser.test.ts`：新增中英文浏览器模拟回归，验证旧游标失效时显示专用文案、保留已加载 Key 且不自动重扫。
- 验证：`pnpm typecheck` 通过，Key 加载与本地 Chrome 浏览器模拟交互共 2 个测试文件 17 项通过；不代表真实 DSH 验收，本步骤未启动 DSH 或访问 Redis。

### 2026-10-28：AI 连接视图版本说明

- `src/host/ai-tools.ts`：状态与切库工具的模型提示明确 generation 表示插件连接与 DB 视图版本，切库可能递增，不能仅据此推断物理连接重建或 Redis 服务器重启；不增加返回字段或 Redis 命令。
- `tests/ai-tools.test.ts`：检查实际注册的模型工具 schema 包含上述语义，并在模拟切库时核对连接 id 保持及 generation 变化。
- `tests/ai-tools.test.ts`：同时核对实际切库工具返回中的连接 id、DB 和 generation，避免只检查内部状态。
- 验证：`pnpm typecheck` 与注册 AI 工具专项 32 项通过；基于模拟连接，尚未重新进行真实模型对话，本步骤未启动 DSH 或访问 Redis。

### 2026-10-28：RO04 错误与日志模拟核验

- `tests/connection-service.test.ts`：注入假密码和假证书标记，捕获连接成功、掉线、断开、认证及 TLS 错误路径日志，检查固定错误结果与日志不包含注入内容。
- `tests/profile-store.test.ts`：在资料保存、移除、非法密码和损坏文件路径注入假凭据标记，捕获 info/warn/error 输出，检查不回显标记；测试使用隔离临时目录。
- `tests/profile-store.test.ts`：通过实际远程服务资料保存方法和模拟连接核验，保存另一份资料不会修改当前连接；未设置环境标签时不生成猜测值。
- `tests/profile-store.test.ts`、`tests/ai-tools.test.ts`：进一步检查非法资料异常文本与注入假敏感信息的权限拒绝工具结果不会回显该信息。
- `docs/verification/readonly-ro04-errors-2026-10-28.md`：记录当前模拟证据与尚需真实认证、TLS、ACL、超时、Key 变化及宿主日志验收的边界；RO04 保持进行中。

### 2026-10-28：日志测试捕获格式修正

- `tests/log-output.ts`、`tests/connection-service.test.ts`、`tests/profile-store.test.ts`：将日志参数按 Node console 的格式渲染后检查，并验证 Error 消息及嵌套 cause 中的假标记可被检测，避免 JSON 序列化遗漏异常内容。
- `docs/verification/readonly-ro04-errors-2026-10-28.md`：将“不启动 DSH 或访问 Redis”的范围准确限定为本次模拟测试。
- 验证：`pnpm typecheck` 通过；连接、资料和 AI 工具专项 3 个文件 56 项通过。本次模拟测试未启动 DSH 或访问 Redis。
### 2026-10-28：日常 DSH 已安装版本的真实模型验证

- 新增 `docs/verification/readonly-real-model-installed-2026-10-28.md`：记录真实 DeepSeek-V41-Flash 对话、Redis 工具轨迹、当前字段读取和明确切换临时 DB 的证据。
- 真实模型通过 DSH 调用状态、Key 扫描、值读取和切库工具；测试目标为自建临时 Redis 的合成数据，回读确认数据未变化。未读取或记录模型凭据。
- 已安装插件的 AI reader 构建哈希与当前项目构建不同，故此次只验证已安装版本；本轮新代码的真实模型与原生界面仍需单独验收。未安装日常 profile、未提交或推送。
### 2026-10-28：RO05 分页预算验证记录

- 新增 `docs/verification/readonly-ro05-pagination-2026-10-28.md`，说明预算、分页、暂停继续、游标失效提示的实现与分层证据，保留多面板、响应丢失和当前版本真实模型尚未验收的边界。
- 当前包默认预打包检查通过 30 个测试文件、330 项测试，其中两项是真实浏览器的组件夹具；安装在项目隔离 DSH profile 后，真实侧栏显示预算面板并只读扫描本机 DB 0 的 760 个 Key。
- 多类型隔离 Redis/正式 ToolRuntime 合成数据检查与日常 profile 的旧版真实模型对话分别记录，不把它们合并为当前版本真实模型验收。
### 2026-10-28：真实 DSH 扫描暂停续读验证

- 更新 `docs/verification/readonly-ro05-pagination-2026-10-28.md`：在项目隔离 profile 的当前构建中，使用临时 Redis 的 150,000 个合成短 Key，验证不匹配筛选扫描触发暂停，点击继续后完成。
- 夹具预查扫描约 1,495 批；真实界面先显示“本轮扫描已暂停”，人工点击“继续扫描”后显示“扫描完成”。测试实例已按 owner 校验的夹具流程关闭；用户已有 Redis 没有写入。此项为原生 DSH 界面证据，不是真实模型多页对话。
### 2026-10-28：当前构建的真实模型多页验证

- 新增 `docs/verification/readonly-ro06-real-model-2026-10-28.md`：在共享现有模型凭据的独立临时 DSH profile 中，对合成 Redis 实际完成两页 Key 续读、选中 Hash 字段和明确切库；完整回读测试数据一致。
- 真实模型一次误把 generation 递增说成物理重连；`src/host/ai-tools.ts` 的状态和切库工具说明已明确版本语义。新包在新真实对话中复测切库，模型没有再作该推断；这是单次样本。
- 最终 `pnpm pack` 预打包检查通过 30 文件、331 项测试。临时 profile 的 schema 初始化命令曾报 Loader tree carrier 错误，实际 Host 随后成功运行；测试会话存于共享 DSH 历史，未删除其他会话。RO06 剩余取消、跨会话与预算等真实验收仍未完成。
### 2026-10-28：修正验收包哈希

- 修正 `docs/verification/readonly-ro06-real-model-2026-10-28.md` 中的最终包 SHA-256 转写，并以 `Get-FileHash` 对实际包重新核对；仅修改验证记录，不影响代码或运行行为。
### 2026-10-28：真实模型验收资源清理

- 更新 `docs/verification/readonly-ro06-real-model-2026-10-28.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录本次当前构建的真实模型多页、选中项和切库证据，保留 RO05/RO06 的未验收条件。
- 本次启动的 DSH Host 和合成 Redis 端口已停止，`127.0.0.1:6379` 经 TCP 检测仍可连接；按绝对路径与父目录核验后删除本次唯一临时 profile，未删除日常 `web` profile 或模型凭据。测试对话留在共享 DSH 历史中。
### 2026-10-28：RO04 隔离 Redis Host 实测

- 更新 `docs/verification/readonly-ro04-errors-2026-10-28.md`，新增去除临时资源标识的连接与 TLS JSON 收据。连接 Host smoke 8 项、TLS Host smoke 5 项通过，覆盖真实密码/ACL 认证、错误密码、真实 socket 超时/取消、可信与错误 CA 和主机名不匹配。
- 测试使用项目内独立脚本与构建副本、临时 WSL Redis 8.2.6；夹具报告资源停止并移除。原历史收据未覆盖；系统证书、用户现有 Redis 与日常 DSH profile 未修改。真实 Redis 命令 ACL 拒绝及这些错误在原生 DSH 界面的呈现仍待验证。

### 2026-10-28：RO04 真实界面异常验证

- 更新 `docs/verification/readonly-ro04-errors-2026-10-28.md`：记录隔离 DSH profile 配合合成 TLS/ACL Redis 的真实界面验证。未信任 CA、错误认证和禁止 SCAN 的权限拒绝分别显示相应错误；权限错误显示加载失败而非空库。成功连接后重新打开设置时密码输入框为空。
- 使用独立本机 TCP 黑洞验证连接超时提示；证书主机名不匹配的原生界面、超时恢复、Key 变化和实际宿主日志仍需验证，RO04 继续保持进行中。一次 ACL 预检格式不匹配的夹具启动已退出并清理，修正预检后完成验证；测试未写入用户 Redis。
- 验证：`pnpm check` 在允许回环访问的环境通过 TypeScript 编译和 30 个文件、336 项测试。首次沙箱运行的 13 项 socket 测试因本机回环连接 `EACCES` 失败；授权后重跑全部通过。
- 本次 DSH 和所有临时 Redis/TCP 测试端口均已关闭，Key 消失的临时夹具也按自身流程清理；该界面场景尚未完成。用户原 Redis `127.0.0.1:6379` 的 TCP 端口仍可连接。

### 2026-10-29：RO04 Key 变化原生界面验证

- 更新 `docs/verification/readonly-ro04-errors-2026-10-28.md`：隔离 DSH 连接自建临时 Redis 后，使用合成数据核验 Key 被删除和自然过期后的刷新提示，以及 String 变为 Hash 后的类型和内容刷新；不改业务 Redis。
- `pnpm check` 基线通过 30 个文件、336 项测试。首次临时 Redis 夹具未能成功启动，退出时临时目录报 EBUSY；目录内容为空，删除该专属空目录的操作被自动策略拒绝，保留待处理。第二次夹具启动成功并完成上述界面检查。
- 第二次测试的临时 Redis 输出 `FIXTURE_CLEANED`，本次启动的隔离 DSH 已停止；文档修改后 `pnpm typecheck` 通过。RO04 仍有原生界面及实际运行日志验收缺口，RO05、RO06 和后续任务状态未更改。

### 2026-10-29：RO04 主机名和超时恢复补测

- `docs/verification/readonly-ro04-errors-2026-10-28.md`：记录隔离 DSH 的 TLS 主机名不匹配提示，以及黑洞超时后刷新状态、手动连接另一临时 Redis 并加载合成 Key 的真实界面结果。没有证明同一端点恢复后重连；RO04 继续进行中。
- 同一临时 TCP 端点经受控转发从挂起切换到可用后，DSH 手动重连成功并加载测试 Key；合成密码触发的认证失败未在本次收集的宿主标准输出中回显。更新同一验收记录，保留其他日志通道及运行中读操作超时的限制。
- 此批测试的两套临时 Redis 均输出 `FIXTURE_CLEANED`，TCP 黑洞和转发器均输出关闭标记，隔离 DSH 已停止；文档更新后 `pnpm typecheck` 通过。

### 2026-10-29：RO06 模型重试与会话界面

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录新临时 profile 使用已有模型配置时，真实模型请求重试 5 次后传输失败，未调用 Redis 工具；合成 Redis 在第一会话可加载 141 个 Key，第二会话初始显示未连接。界面会话隔离不能替代真实模型跨会话验收，RO06 仍未完成。

### 2026-10-29：RO05 真实 Redis 工具预算恢复

- `docs/verification/readonly-ro05-pagination-2026-10-28.md`：记录当前构建通过正式注册 ToolRuntime 访问独立临时 Redis，验证 32 次预算耗尽、跨会话恢复拒绝、本会话恢复后原游标继续和 141 个合成 Key 完整返回。首次误传不支持的参数被工具拒绝；按注册 schema 更正参数后通过。该检查没有调用真实模型。
- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：补充当前构建正式工具在隔离 Redis 上的选中字段、预取消和切库清空选择检查；脚本调用与真实模型严格分开。
- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：连接测试 Redis 后重试真实模型，仍在工具调用前报传输错误；共享设置中的单个 TCP 连通结果不能证明模型 API 可用。140 个合成 String、Hash 字段和 DB 1 的回读与预置一致。
- `docs/verification/readonly-ro05-pagination-2026-10-28.md`、`docs/DSH_AI_READONLY_TASKS.md`：记录当前构建在隔离 Redis 上的 UI/AI 游标独立实测，分页预算专项 11 文件 141 项通过，并将 RO05 标记完成；真实模型验收依旧属于 RO06，不代表已完成。

### 2026-10-29：RO04 损坏资料真实界面

- `docs/verification/readonly-ro04-errors-2026-10-28.md`：在本次独立临时 DSH profile 中写入带合成标记的无效资料，验证真实界面显示固定读取失败提示、宿主输出固定警告且没有回显标记；真实保存失败及其他日志通道尚未核验。
- 更正上一条关于 `wsl-fixture-e31a16ea-c174-45ef-9f69-67bfed6b5903` 为空的表述：重新检查发现其中有一份该临时夹具的 `redis.conf`，不应当称为空目录。此前删除尝试被自动策略拒绝，目录继续保留。
- 为评估真实保存失败的构造，临时把本次独立 profile 的资料目录置为普通文件；核查发现这样会先触发读取失败，不能证明写入路径，因此立即恢复原目录，未将该尝试计为通过。

### 2026-10-29：日常 DSH 模型配置核对

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录应用户要求按日常 `dsh web` 配置启动，并发出普通模型测试消息；实际重试 5 次后仍报传输错误。日常与临时 profile 的模型配置层存在字段差异，尚不能据此判定最终配置或失败原因；未输出凭据，也未修改日常 profile。
- 上轮独立 Redis 输出 `FIXTURE_CLEANED`，临时 DSH 已停止；删除本轮唯一临时 profile `redis-eval-20261029-01a181a4` 的命令被自动策略拒绝，未绕过限制，该 profile 暂时保留，日常配置未删除或覆盖。

### 2026-10-29：日常 DSH 模型网络错误诊断

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录用户确认日常 DSH Web 与测试在同一台电脑；本轮没有发现其他正在监听的 DSH Web。临时诊断进程沿用日常配置，只输出模型网络错误类型与代码，普通消息复现 `ECONNRESET`；未输出模型地址、请求或凭据，不能据此判定连接由哪一方重置。RO06 未因此通过。

### 2026-10-29：RO04 真实资料保存失败验证

- `docs/verification/readonly-ro04-errors-2026-10-28.md`：在本轮独立 DSH profile 恢复合成空资料，通过短时文件占用模拟保存时替换失败；真实界面显示固定错误，宿主输出固定警告且不包含合成地址。释放文件后回读原内容不变，临时写入文件已清理；不扩大到其他日志通道。
- 真实 Redis 与 transport 的受控交错中，在 `GETRANGE` 返回后由独立夹具改变类型或删除合成 Key，结果分别为 `changed`、`missing` 且不返回旧字节；夹具确认清理。结果已写入 RO04 记录，不称作原生界面的并发交错。
- `docs/DSH_AI_READONLY_TASKS.md`、`docs/verification/readonly-ro04-errors-2026-10-28.md`：按 RO04 清单条件汇总模拟、真实 Host 和原生界面证据并标记完成；保留第三方/系统日志、其他超时组合及原生界面并发交错未覆盖的限制。模型对话另属 RO06。

### 2026-10-29：补正固定版 Gateway 事件证据

- `docs/verification/readonly-ro01-contract-2026-10-28.md`：补充固定 rc.2 Gateway 文档中 Host 事件源、Client 订阅、活动流及 scoped waterfall 回执的证据；澄清其不自动证明 Redis 面板已就绪、唯一接收或动作应用成功。未修改源码，RO07 仍须按依赖及真实装配验证推进。

### 2026-10-30：日常 DSH 模型普通消息复测

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录按日常 `dsh web` 配置启动的普通消息复测，重试 5 次后仍显示传输失败；没有调用 Redis 工具，本次启动进程已停止。真实模型验收 RO06 仍未通过。
- `docs/DSH_AI_READONLY_TASKS.md`：将已有部分真实模型和工具调用证据的 RO06 从“待开始”更正为“进行中”，并列出尚缺的真实模型场景；未勾选完成。
- `docs/verification/readonly-ro01-contract-2026-10-28.md`：补充固定版 API Remotes 的应用级事件白名单约束，澄清插件不能单靠 `ctx.remote.$on()` 增加自定义转发事件；后续界面动作仍需核验可用通道和多 Client 回执。

### 2026-10-30：当前构建临时启动补丁

- `.scratch/runtime/readonly-current-entry.patch.yml`：为本次 DSH 验证准备按插件 ID 覆盖入口的临时启动补丁，指向当前项目 Host 构建；仅在显式传入该补丁时生效，不修改日常 profile 或现有安装包。实际 Host 和 Client 是否成功加载仍需启动核验。

- 更正：首次临时补丁试图直接覆盖 `name`，合成配置证明旧入口未变；固定版 DSH 使用 `name` 校验目标身份。临时补丁现改为仅本次启动禁用旧条目并插入独立 ID 的当前入口，仍须核验合成配置和实际装配；未改日常 profile。

### 2026-10-30：日常模型与当前构建验证

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录日常 `bzkj-LLM` 普通消息成功、默认 DeepSeek 仍连接重置；旧安装包真实分页结果为 101 和 40 条，模型误报 139 条。记录临时插件入口补丁的实际装配问题，以及独立 profile 叠加日常模型配置后当前包与原生面板的确认结果；RO06 继续进行中。

### 2026-10-30：AI Key 批次计数

- `src/host/ai-key-pages.ts`：为 AI Key 分页结果增加由本次返回数组长度计算的 `returnedCount`，帮助模型准确报告当前批次数量；该字段不表示全库总数。
- `tests/ai-key-pages.test.ts`：检查拆分后的每批计数和空页计数，保留分页上限和续读检查。
- `docs/AI_READ_USAGE.md`：说明计数的范围和空页、续读语义。

### 2026-10-30：新包真实分页与已有预算证据

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：补记上一轮真实模型的选中字段、切库、跨会话和预算耗尽轨迹；关闭进程后的旧游标不算恢复成功。记录新包 SHA-256、完整打包检查 30 文件 336 项通过，以及真实模型直接读取 `returnedCount` 得到 100、41 的分页结果。预算恢复与真实工具取消仍待验收。

### 2026-10-30：预算恢复真实模型验收

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录新包下真实模型触发 32 次调用预算、侧栏手动恢复后使用原游标续读 41 条并完成；记录延迟代理取消试验因模型未发出工具调用而未取得在途取消证据。RO06 仍为进行中。

### 2026-10-30：界面动作契约准备

- `docs/verification/readonly-ro07-action-contract-draft-2026-10-30.md`：依据固定版 Gateway 和侧栏文档，整理双向流候选、可信会话、唯一接收者、目标代次、用户选择优先、终态回执及待验证场景；该文档为草稿，RO06 的直接依赖和 RO07 真实装配验收仍未完成。

### 2026-10-30：RO06 真实在途取消

- `docs/verification/readonly-ro06-real-model-2026-10-28.md`：记录合成 Redis 的响应扣留、真实 DSH 停止、1,223 毫秒工具错误及释放响应后的面板读取；轨迹错误对象未展示底层取消码，限制已保留。对比两个验收包，仅 AI Key 分页 Host 文件发生变化。
- `docs/DSH_AI_READONLY_TASKS.md`：按真实模型、原生界面、隔离数据和检查证据将 RO06 标记完成，RO07 标记进行中；默认 DeepSeek 连接重置和 RO07 原生装配仍未解决。

### 2026-10-30：恢复本机 Redis 连接

- 用户反馈 DSH Redis 无法连接。只读核查发现本机 Redis 仍监听 `127.0.0.1:6379`，当前验收会话保留了已关闭的测试代理 `127.0.0.1:10758`，因而无法连接。
- 在该验收会话将地址改回本机 `6379` 并连接；DSH 原生面板显示已连接、DB 0 已加载 760 个 Key、扫描完成。此次只检查界面连接及数量，没有修改 Redis 数据，也没有向模型发送业务数据；不对其他会话或其连接状态作推断。
- 后续验收结束前应检查用户正在使用的页面，避免留下失效的测试代理地址。

### 2026-10-30：RO07 Host 动作协调基础

- `src/host/ui-action-coordinator.ts`：增加按可信会话管理界面接收者的协调器，限制每会话一个在途动作；校验接收者唯一性、请求身份、目标和选择版本，区分取消、超时、断开及过期，并清理计时器与取消监听。接收方须在实际执行前校验并遵守取消信号；该组件尚未接入 RemoteStream 或原生界面。
- `tests/ui-action-coordinator.test.ts`：覆盖会话隔离、多界面冲突、错误回执、用户变化、取消、超时、断开及迟到回执。

### 2026-10-30：RO07 双向流协议描述

- `src/typert.shared.ts`、`src/typert.host.ts`、`src/typert.remote-client.ts`：增加受可信 Agent 作用域约束的界面动作流描述，以及请求、取消和回执严格校验；Client 在消费流时仍须主动解析帧。当前尚未接入服务及原生界面。
- `tests/host-typert.test.ts`、`tests/client-bundle.test.ts`：同步协议端点数量和清单；实际 Host/Client 流装配仍待验证。
- `src/domain.ts`、`src/host/ui-action-coordinator.ts`、`src/host/ui-action-channel.ts`、`src/typert.shared.ts`、`src/typert.remote-client.ts` 及两项专项测试：修复协议描述首次编译时 Client 引入 Host 专用模块的错误，统一从公共类型定义引用，不向浏览器引入 Node 模块。

### 2026-10-30：RO07 Host 流装配

- `src/remote-service.ts`：从 Gateway 的可信 Agent 和本次调用上行建立界面动作流；会话结束或插件卸载时清理接收者，连接或 DB 目标变化时撤销等待中的动作。当前仍未接入 Client 和模型，实际流装配待验证。
- `tests/host-typert.test.ts`：验证 Host 和 Client 的流描述符、可信 Agent、取消签名、消息及回执校验一致，并拒绝额外字段和未支持动作。
- `tests/host-typert.test.ts`：修复新增测试中可选上行 codec 在回调内丢失类型收窄导致的 TypeScript 编译错误。
- `tests/host-typert.test.ts`：根据重新核对的报错行，同样固定下行 codec 的类型收窄。

### 2026-10-30：RO07 Client 流接收

- `src/client/index.ts`、`src/client/RedisWorkspace.tsx`、`src/client/ui-actions.ts`：为可见的 Redis 面板建立会话绑定的动作流，并在卸载或隐藏时取消；对每个下行帧做严格校验，当前尚未实现的动作返回不支持，不声称界面已应用。
- `tests/client-bundle.test.ts`：核验浏览器 bundle 的流接口使用正确的可信会话。实际原生 DSH 装配和动作验收仍待进行。
- `src/client/ui-actions.ts`、`tests/ui-actions-client.test.ts`：避免取消与 finally 重复释放同一流，验证不支持动作、无效帧和面板提前取消时不会假报成功。
- `tests/ai-tools.test.ts`：修复完整检查中发现的旧 Host 原型替身未初始化动作协调器的问题，统一构造并在测试后释放；不改变真实 Redis 连接行为。
- 协调器发送前复制目标标识并拒绝非法回执终态；专项测试验证目标对象后续变化不会改变请求快照。

### 2026-10-30：RO07 界面动作通道基础

- `src/host/ui-action-channel.ts`：将单个界面接收者与上下行异步流关联；限制待发送消息，处理取消、断流和迟到回执，并在流退出时注销接收者。此通道尚未接入 DSH RemoteStream 或原生界面。
- `tests/ui-action-channel.test.ts`：核验实际异步迭代中的回执匹配、取消、断流、多界面及会话隔离。
- 使用显式状态对象修正异步回调中的 TypeScript 类型收窄错误，不改变通道语义。
- 上行迭代等待与通道关闭信号竞争，避免通道内部持续等待不响应的输入；流关闭时请求输入迭代器释放，底层来源仍须遵守自身取消契约。
- 对迭代器释放时的同步或异步异常统一捕获，避免影响断流清理。

### 2026-10-30：继续工作时恢复已停止的本机服务

- 当前重新检查时，8575、9250、6379 均无监听，历史进程会话已不存在；不能沿用上次运行状态作为当前证据。
- 重新启动原验收 profile 的 DSH Web，地址为 http://127.0.0.1:8575/，继续复用日常模型配置。
- 核验原安装目录 E:\Redis-8.10.0-Windows-x64-cygwin 的 start.bat 后，按相同工作目录及 redis.conf 启动原 redis-server.exe；未修改配置或数据文件。
- 只读检查：PING 返回 PONG；DBSIZE 返回 760。未读取业务值、未写入 Redis。
- 新包 RO07 仍使用单独的 9250 验证实例；Host 挂载问题未标记通过。当前源码 pnpm typecheck 通过。

### 2026-10-30：中断后恢复服务并校正 RO07 草稿

- 中断后重新检查发现 Redis 与 DSH 监听均已停止，按原 Redis 安装目录和配置启动服务，并以原验收 profile 启动 DSH Web。Redis PING 为 PONG，DB0 为 760 个键；DSH 界面重连后显示 760 个键、扫描完成。
- `docs/verification/readonly-ro07-action-contract-draft-2026-10-30.md`：将过时的 RO06 未完成状态改为已完成，说明 RO07 实现和验收边界；不将已有模块测试冒充真实 Gateway 往返。

### 2026-10-30：准备 RO07 Gateway 集成验证

- `package.json`、`pnpm-lock.yaml`：新增开发依赖 `@deepseek-ai/dsh-typert-registry@0.2.0-rc.2`，与既定 DSH 基线一致，用于测试中装配真实 Typert Registry 和 Gateway。运行时插件依赖及日常 DSH 安装没有改变。
- 新增依赖后 `pnpm typecheck` 通过；真实流往返测试仍在准备。

### 2026-10-30：RO07 Host Gateway 双向流测试

- `tests/ui-action-gateway.test.ts`：用固定版真实 Typert Registry、Gateway 和 Redis Host 服务，以虚拟 Agent 进行进程内双向流测试；验证其他会话无接收者、动作帧经 Gateway 输出、匹配回执从上行到达协调器，未使用 Redis 数据。
- 测试首次编译发现测试侧 Host contribution 的 `face` 推断为 string，注册时显式固定为 `host`；随后 `pnpm typecheck` 与专项测试通过。
- 覆盖范围为进程内 Gateway；WebSocket、浏览器和实际界面动作仍待验收，RO07 保持进行中。
- `docs/verification/readonly-ro07-action-contract-draft-2026-10-30.md`：补充本次进程内 Gateway 验证和浏览器验收边界。
- 完整 `pnpm check` 通过：类型检查、构建及 34 个测试文件的 351 项测试通过；其中浏览器测试为本地自动化验证，不能替代 RO07 实际动作及模型验收。

### 2026-10-30：接入 Redis 面板可见性工具

- `src/host/ai-ui-tools.ts`、`src/runtime.ts`：增加 `redis_viewer_show`，由宿主提供会话身份，复用动作协调器，区分已确认可见、未挂载和多接收者等终态；未挂载时提示用户打开侧栏，不接受会话参数或 Redis 命令。
- `src/client/ui-actions.ts`、`src/client/RedisWorkspace.tsx`：只在收到有效动作时确认面板当前可见，隐藏或过期返回过期；不通过 DOM 注入打开侧栏。
- `tests/ai-ui-tools.test.ts`、`tests/ui-actions-client.test.ts`：覆盖工具会话隔离、多接收者、非法参数、可见性和过期动作；真实浏览器双向通信及模型验收尚未完成。
- 重新打包并安装独立 profile，包 SHA-256 `ad5b281202bea400f359d7ad621c369185db8e00eec12108572205767f737c19`；确认安装的 Host 入口与当前构建一致。专项 6 文件 17 项通过，prepack 全量检查通过。
- 实际 DSH Web 与 `bzkj-LLM` 两次调用：可见面板返回 `applied`，收起侧栏返回 `no_receiver` 及人工打开提示；隔离会话未连接 Redis。此验证覆盖浏览器双向通信和可见性，不覆盖自动打开或其他动作。
- `docs/DSH_AI_READONLY_TASKS.md`：将 RO08 更新为进行中，指向真实验证记录，保留自动展开和完整验收缺口。
- 隔离 DSH 同会话的两个浏览器客户端同时可见时，真实模型工具返回 `ambiguous`；关闭第二客户端后再次返回 `applied`。已将结果与验证边界写入 RO07 记录。
- `src/host/ai-ui-tools.ts`、`tests/ai-ui-tools.test.ts`：根据真实模型对 `applied` 的解释，明确工具只确认面板已有可见状态，没有执行打开操作，并验证返回说明。

### 2026-10-31：界面选择和目标变化失效通知

- `src/host/ai-reader.ts`、`src/remote-service.ts`：在已接收的选择实际变化或目标清理时，通知同会话动作协调器使在途动作失效；重复发布相同选择不会取消动作。AI 切换 DB 的目标清理也走相同通知。
- `tests/ai-tools.test.ts` 及 AI 分页测试夹具：接入该通知并测试真实变化、重复选择和 DB 切换。界面本地操作至 Host 防抖上报前的竞态仍需处理，不将本次改动作为 RO07 全部验收。
- 两次类型检查发现测试对异步回调重赋值的收窄假设不成立；重新分析后改用数组分别记录每次动作信号，避免依赖跨回调类型推断。
- `pnpm typecheck` 通过；涉及工具、五类 AI 分页和界面动作通道的 9 个测试文件、118 项测试通过。上述测试使用合成传输和进程内 Gateway，不代表浏览器或真实模型已经验收。
- 当前构建 `pnpm check` 通过：类型检查、构建及 35 个测试文件、354 项测试通过。真实 DSH/模型对本次代码尚未重新验收。
- 重新按日常 `dsh web` 配置启动本机 Web，监听 `127.0.0.1:8575`；未更换日常 profile 中的插件。已有 Redis 进程保留，未对业务数据执行读写。
- 重新打包当前代码，隔离安装包 SHA-256 `330943eac5ad728c521343e4e67fc554e45faca2f88b729adb328f60cc3cfcf2`，安装的 AI reader 与本次构建哈希一致。独立 DSH 原生 Redis 面板正常显示，验证会话未连接 Redis。
- 使用 `bzkj-LLM` 请求调用 `redis_viewer_show` 时，隔离实例返回“API 密钥无效 AUTH”，未进入工具调用；日常 `dsh web` 中同一模型的一条无业务数据普通消息也返回相同错误。真实模型复验未通过，未读取或输出密钥；不据此推断具体凭据失效原因。
- `src/client/ui-actions.ts`、`src/client/RedisWorkspace.tsx`：将客户端动作处理改为可异步执行，等待界面提交期间继续消费取消帧；面板卸载、请求取消和过期不发送迟到成功回执，为后续原生侧栏打开和界面定位提供基础。
- `tests/ui-actions-client.test.ts`：覆盖等待中的取消和迟到成功不回执；当前动作仍仅检查可见性，自动打开尚未实现。
- 动作实际调用前再次检查所属通道与取消状态；回执发送失败时释放通道，避免异步任务在已关闭状态继续或出现未处理异常。
- `src/client/ui-pane-presence.ts`、`tests/ui-pane-presence.test.ts`：增加会话内可见面板计数和有界等待，原生打开后只有实际面板报告可见才确认；覆盖取消、会话变化、多个面板和原生打开失败。尚未接入 DSH 侧栏。
- `src/client/index.ts`、`src/client/RedisWorkspace.tsx`、`src/host/ai-ui-tools.ts`：将每窗口动作接收者绑定到 DSH 的屏幕会话，调用原生 `openTab('redis')`，等待相应页签正文可见后返回成功；会话切换或通道关闭取消等待。同步调整工具说明和客户端 bundle 测试；真实 DSH/模型验收仍待执行。
- `tests/ui-session-channel.test.ts`：补充当前会话通道与原生侧栏调用的装配测试，验证未收到实际页签可见通知前不回执成功，以及会话退出时释放流。
- 当前包完整预打包检查通过；隔离包 SHA-256 `81f28d7de6fcec11167eb524729b31786e2cda5cccdc015a0dd1be3583373733`，安装后浏览器 bundle 哈希与构建一致，实际 DSH Redis 面板正常装配。模型 AUTH 错误仍使实际工具触发和自动打开验收待完成；未连接业务 Redis。
- `src/client/RedisWorkspace.tsx`：在宿主页签生命周期信号中止时立即释放可见状态，避免页签失效后仍作为已显示的回执依据；卸载清理仍幂等。
- `tests/ui-pane-presence.test.ts`：增加同一提交连续出现两个可见页签的竞态用例，检查不能在第一个出现时误报唯一可见面板。
- `src/client/ui-pane-presence.ts`：合并同一轮页签可见变化后再判断唯一性，修复上述用例先出现第一个页签时误回成功的问题。
- 最新隔离包 SHA-256 `175e209ab73a8d7daa10813a6a013fed56ccd986c78d805d8a87815c871857a5`，prepack 通过 37 文件、360 项测试；真实 DSH 与日常 `DeepSeek-V41-Flash` 验证侧栏收起后自动打开返回 `applied`、双客户端返回 `ambiguous`、关闭一个后恢复 `applied`。验证会话未连接 Redis；此前 `bzkj-LLM` 返回 AUTH，不代表当前日常模型不可用。
- `src/domain.ts`、`src/typert.shared.ts`、`src/host/ui-action-coordinator.ts`、`src/client/ui-pane-presence.ts`、`src/host/ai-ui-tools.ts`：同窗口多个可见 Redis 页签与多窗口统一返回 `ambiguous`，并提示保留唯一界面；协议和协调器专项覆盖该终态。此后变更尚需重打包及真实 DSH 复验。
- `src/client/index.ts`：订阅 DSH 连接代次，断线时释放该会话旧动作流，连接恢复时为当前会话建立新流；会话或代次未就绪时不派发。调整客户端测试夹具；真实断线重连仍需验收。
- `tests/ui-session-channel.test.ts`：增加连接代次消失、恢复和会话离开用例，检查旧流释放、新代次仅建立一次新流及订阅清理。
- 当前隔离包 SHA-256 `888dd39e2d37c06b8be9f425cc0e9d41d75349c90f92b29c2b53ceb51a75ba32` 的预打包检查通过（37 文件、362 项测试）。真实 DSH 及 `DeepSeek-V41-Flash` 在隔离宿主重启前和原浏览器手动重连后均成功打开面板，返回 `applied`；会话未连接 Redis。验证记录补充于 `docs/verification/readonly-ro07-action-contract-draft-2026-10-30.md`；同代次开流失败或提前结束及本地选择竞态仍需处理。
- `src/client/index.ts`：同一连接代次的动作流建立失败或提前结束后，最多延时重试三次；会话、连接代次变化和卸载时取消重试。重试耗尽后等待会话或连接变化，不进行无界轮询；专项测试和真实模型验证待补。
- `tests/ui-session-channel.test.ts`：增加开流失败、流提前结束与重试上限测试；验证结果以实际运行记录为准。
- 专项测试补充等待重试期间卸载的清理断言；确保卸载后不会再次开流。
- `pnpm check` 通过：类型检查、构建及 37 个测试文件的 363 项测试通过。重试代码尚未完成真实 DSH 和模型验证。
- 隔离包 SHA-256 `65d8d89f8b783aa6016098b0837d86a27d3582360fa39e2fb1286e3c8ab63989`；隔离 profile 安装的 Client 与当前构建 SHA-256 均为 `b589502f23550c006937c532ae2b1b3c666c961f6817c014ddb5a4727c6f5c63`。真实 DSH 和 `DeepSeek-V41-Flash` 从收起状态调用 `redis_viewer_show`，面板打开并返回 `applied`，未连接 Redis。该实测只覆盖正常调用；开流失败重试的行为由自动化测试验证。

### 2026-10-31：选择竞态防护进行中

- 新增 `src/client/selection-epoch.ts` 和 `tests/selection-epoch.test.ts`：表示浏览器本地同步失效的单调版本及其同步状态，旧异步完成不能将较新的版本标为已同步。此时尚未连接操作入口和 Host，不代表竞态已解决。
- 扩展动作流上行类型、严格编解码、Host 与 Client 的版本状态交换：目标动作要求版本已同步且相同，失效后取消在途动作。当前仅完成基础连接，实际选择事件接入和测试仍待完成。
- 更新客户端动作流测试夹具以传入版本对象，区分初始版本帧与动作回执；修复类型检查暴露的旧调用签名。
- 动作流专项测试的无关回执使用合法 UUID，确保测试检查的是回执匹配而非非法协议帧。
- `src/client/SelectionEpochContext.ts`、`RedisWorkspace.tsx`、`index.ts`：为每个 DSH 会话共享独立的本地选择版本并连接动作流；`KeyBrowser.tsx` 和 `CollectionTable.tsx` 在 Key 或集合行实际变化前同步失效；`CurrentSelection.tsx` 仅在对应选择经 Host 接受后同步版本。筛选清除、目标变化和端到端竞态仍待覆盖，尚不能视为完成。
- `src/client/ui-actions.ts`：本地版本变化时立即中止在途目标动作并回报过期，避免等待异步动作结束；补充迟到成功不回执测试。
- `src/host/ui-action-coordinator.ts`、`ui-action-channel.ts`：按实际流记录选择版本，仅在唯一接收者已同步时暴露版本，并在取消或流关闭后清理；补充版本变化取消在途动作的通道测试。后续目标工具必须使用该版本并再次校验。
- `CollectionTable.tsx`、`StreamView.tsx`：支持识别同一 Stream 消息重置字段位置的选择变化，确保字段发生变化时同步失效。
- `selection-epoch.ts`、`ConnectionForm.tsx`、`KeyBrowser.tsx`、`CurrentSelection.tsx`：初始选择版本设为未同步；连接和 DB 切换设置边界，进行中不能确认旧选择，结束后重新发布当前界面选择；空选择也须经 Host 接受。筛选清除及真实交错验收仍未完成。
- `KeyBrowser.tsx` 和五类集合视图：筛选、范围和模式变更导致当前选择变化时，在本地操作前失效；Hash 本地搜索仅在所选字段可见性变化时失效。`CurrentSelection.tsx` 对缓存更新导致的行消失或恢复也在界面提交时失效。真实交错验收仍待完成。
- 新增 `tests/selection-race-browser.test.ts`，用合成数据和真实浏览器延迟旧选择回执，验证新选择不会被旧回执错误确认；尚不替代真实 DSH 与模型验收。
- `tests/ui-actions-client.test.ts` 增加旧目标动作执行前被拒绝的断言；`tests/ui-action-gateway.test.ts` 在固定版真实 Gateway 中验证非零选择版本上行。
- `SelectionEpochContext.ts`、`KeyBrowser.tsx`：订阅会话版本变化，连接或 DB 操作取消后重新发布当前选择，避免在途边界结束后一直停留在未同步状态；版本就绪状态变化本身不触发重复发布。
- 选择竞态浏览器夹具改为使用相同的版本订阅，检查真实渲染更新下的迟到回执。
- `.scratch/runtime/ro07-validation-20261030/selection-fixture.mjs`：复用随机端口、独立进程的 Redis 夹具创建两条合成 Hash 字段，结束前回读核对；用于真实 DSH 界面选择验收，不使用现有 Redis。
- 隔离包 `0e3b5a732a10f64a7fb9c0e018627747aae5e330bd20de5ccb8526823ac11698` 预打包检查通过（39 文件、369 项测试），安装 Client 与构建哈希一致。真实 DSH 和 `DeepSeek-V41-Flash` 成功打开侧栏；快速切换两条合成 Hash 字段后，无参数读取返回最后选中的 `second` / `synthetic-two`。详情和验证限制写入 `docs/verification/readonly-ro07-action-contract-draft-2026-10-30.md`。
- `domain.ts`、`typert.shared.ts`、`client/index.ts`、`remote-service.ts`、`host/ai-reader.ts`：无参数读取侧栏选择前后，使用受信会话和目标在原生动作流上确认唯一可见面板的同步版本；失效时拒绝结果并回滚暂存页。显式 Key 读取不要求面板确认。AI 读取测试夹具同步注入模拟确认；实际交错和真实模型回归待验证。
- `host/ai-reader.ts`：选择读取的暂存页提交时再次检查界面版本，阻止确认后发生版本变化的旧结果提交；测试夹具提供受控的版本判断。
- 修复选择读取的新校验对同一连接网络失败的误判：只有读取结果错误与当前同一目标的失败状态一致时保留原错误，替换连接仍按过期处理。
- `tests/ai-tools.test.ts`：新增界面确认失败时不读旧选择、显式 Key 仍可读取，以及暂存分页在版本变化后拒绝提交并可重试的测试。
- `typert.shared.ts`：动作协议拒绝“打开面板附带目标”或“确认选择缺少目标”的无效组合；同步调整目标动作测试夹具。
- `src/domain.ts`：动作流上行协议发生不兼容变更，协议版本从 4 提升到 5，避免旧 Host 或 Client 与新版混用时被当作同一契约。
- 协议 5 隔离包 `e9812a39efa1e11a21a68347a50483aaf4e08d5a323703d38b54f44b43419962` 已在真实 DSH 与 `DeepSeek-V41-Flash` 中验证：选中合成 Hash 字段可无参数读取；隐藏面板时旧选择读取被拒绝；显式合成 Key 读取不受影响。验证过程使用独立 Redis，记录详见 RO07 验收草稿；尚未覆盖真实 DSH 延迟动作。
- 新增 `.scratch/runtime/ro07-validation-20261030/stop-selection-fixture.mjs`：为本次输入通道已关闭的独立 Redis 夹具回读两条合成字段并关闭随机端口实例；使用前已核对进程及端口归属。
- `src/host/ai-tools.ts`、`docs/AI_READ_USAGE.md`：说明当前选择读取必须由唯一可见面板确认，而显式 Key 读取不要求面板可见；避免把最后同步的旧选择当作当前选择。
- 合成夹具已回读两条字段一致并停止，隔离 DSH 已停止；日常 DSH 8575 与用户 Redis 6379 仍在监听。夹具进程因输入通道关闭而未进入原自动清理回调，验证用配置目录保留在 E:。
- `tests/ai-tools.test.ts`：补充最终界面确认失败后的分页回滚测试，检查重试复用已取得页而不是重复推进 Redis 游标。
- 修正该测试范围：首个未提交候选页按现有协调器设计允许重新扫描；对已交付游标的续读页，确认失败后必须保留已取得页，重试不得重复推进底层游标。
- `RedisWorkspace.tsx`、`CurrentSelection.tsx`、`KeyBrowser.tsx`：页签可见性变化时失效选择版本；仅可见且信号有效的页签发布和同步选择，移除旧页签卸载时无条件清空选择的行为，防止隐藏页签覆盖当前选择。多窗口跨流的迟到 RPC 仍需处理。
- `selection-epoch.ts`、`ConnectionForm.tsx`、`KeyBrowser.tsx`：目标切换边界在取消信号触发时同步释放，迟到结果仍受请求序号和目标代次保护；补充取消后边界可恢复测试。
- 协议升级为 6：删除独立选择 RPC，将选择身份发布和确认放进会话动作流，Host 仅接受唯一接收流、匹配版本的发布；流关闭时拒绝在途发布。此变更仍在编译和跨窗口交错测试中，不代表验收完成。
- 修正动作流清理函数的显式 `void` 返回类型，解决编译发现的类型收窄问题。
- 测试夹具迁移到流式选择协议，调整端点数量及初始化版本断言；旧选择 RPC 不再注册。
- 清除已删除 RPC 的测试假对象，并更新严格上行编解码及联合消息类型，修复迁移编译错误。
- `tests/ui-action-channel.test.ts`、`tests/selection-epoch.test.ts`：覆盖多接收流拒绝发布、仅唯一流允许发布、旧版本拒绝，以及流关闭时在途发布失败。
- `tests/selection-race-browser.test.ts`：增加同会话两个页签（一可见一隐藏）的真实浏览器夹具，验证隐藏页签不发布、旧页签迟到回执不确认新选择。
- `selection-epoch.ts`、`CurrentSelection.tsx`、`KeyBrowser.tsx`、`RedisWorkspace.tsx`、`index.ts`、`locales.ts`：选择发布失败时显示明确状态和手动重试入口；点击后为当前会话重建动作流并重新发布，不进行无界自动轮询。验证待执行。
# 2026-10-31：选择同步通道失败后的恢复

- RO09 Key 定位协议基础：`src/domain.ts`、`src/typert.shared.ts` 将协议提升至 7，增加精确 Key 动作和选择提交帧；`src/host/ui-action-coordinator.ts`、`src/host/ui-action-channel.ts` 对动作、唯一流、版本和有效期进行同步核验；`src/host/ai-reader.ts`、`src/remote-service.ts` 支持核验后的选择提交。客户端定位和完整验收尚未完成。
- 修正上述协议分支的 TypeScript 类型收窄，使流状态和动作联合类型能通过静态检查。
- 扩展 `tests/ui-action-channel.test.ts`：验证 Key 动作仅能通过匹配请求和连续版本的提交帧成功，普通成功回执、旧版本和用户抢先选择不能更新 Host 选择。
- 修改 `src/client/ui-pane-presence.ts`、`src/client/selection-epoch.ts`、`src/client/ui-actions.ts` 和 `src/client/index.ts`：为唯一可见面板注册定位处理器，并在界面提交后通过同一动作流提交新选择；直到 Host 确认前保持选择未同步，失败或断流触发撤销。`src/client/KeyBrowser.tsx` 增加对应处理器接口，具体界面实现待接入。
- 修正客户端异步回调所持提交状态的 TypeScript 类型收窄。
- 修改 `src/client/KeyBrowser.tsx`、`KeyCatalog.tsx`、`CurrentSelection.tsx` 和 `locales.ts`：增加可取消的定位候选、界面提交检查与回退；未扫描目标独立显示并保持计数和游标不变，同 Key 程序定位清除旧子项。浏览器扫描夹具补充处理器注册桩。
- 修正候选动作回调类型，并在目录目标可见后显式触发父组件确认，避免只凭状态排队确认定位。
- 新增 `tests/key-locate-browser.test.ts`：在真实浏览器中检验未扫描目标独立显示、扫描计数不变及迟到提交回执不能覆盖用户选择。
- 补齐定位浏览器夹具所需的现有预览格式容器，确保测试按实际组件层级运行。
- 调整定位浏览器测试的各阶段等待期限，便于明确定位失败环节。
- 经真实 DOM 与动作帧排查，浏览器夹具未加载插件样式导致虚拟 Key 行被状态栏遮挡；现加载实际样式以验证可点击的用户界面。
- 浏览器夹具还原 `.dsh-redis` 与连接容器，使带作用域的现有样式正确生效。
- 新增 `src/host/ai-locate-tool.ts` 并在 `src/runtime.ts` 注册 `redis_viewer_locate_key`；`src/host/ai-reader.ts` 增加会话目标检查和单次 TYPE 点读。工具只接受文本或规范 Base64 Key，不扫描、不获取值；区分不存在、读取失败和界面未确认，并复用当前会话预算。
- 新增 `tests/ai-locate-tool.test.ts`：使用真实 DSH ToolRuntime、隔离模拟 Redis 与动作流覆盖文本、二进制和空 Key 的定点检查与提交，验证不存在、权限拒绝、非法参数及命令范围。
- 修正定位工具测试中动作联合类型的收窄。
- 修改 `src/client/selection-epoch.ts`、`CollectionTable.tsx`、`StreamView.tsx`：手动选行先接管程序候选并使旧动作失效；修改 `KeyBrowser.tsx` 和 `styles.ts`：定位期间隐藏并保留原详情组件，暂停其可见性与选择发布，取消时恢复原字段状态。
- 扩展定位浏览器回归：验证原 Hash 字段在拒绝动作后仍选中，以及候选 Hash 的字段可被用户接管并抵抗迟到回执。
- 调整 `src/client/KeyBrowser.tsx` 的拒绝回退顺序：先恢复原选择，再通知外部选择版本，避免 React 同步渲染中途卸载已保留的旧详情。
- 外部状态通知改到回退视图的 layout 提交后执行；浏览器回归增加原 DOM 身份及原字段发布断言。
- 修正浏览器原生 DOM 身份检查中的选择器，使其使用标准 CSS 语法。
- 修改 `src/host/ui-action-channel.ts`：匹配当前定位请求的提交被拒绝时立即结束动作并撤销已同步状态；`tests/ui-action-channel.test.ts` 覆盖拒绝后没有后续上行帧仍能及时释放动作，其他请求 ID 不得终止当前动作。
- 修改 `src/client/RedisWorkspace.tsx`、`CurrentSelection.tsx`、`KeyBrowser.tsx` 和 `index.ts`：浏览器标签进入后台时撤销可见面板登记并停止选择发布，回到前台重新登记；确认动作同时检查浏览器可见性。`ui-actions.ts` 在确认等待期间选择版本变化时撤销旧候选。
- 新增 `tests/workspace-visibility-browser.test.ts`：在真实 Chromium 中模拟可见性事件，验证后台撤销面板登记、版本失效及返回前台重新登记。本机无头 Chromium 的两个标签均报告可见，实际 DSH 后台切换仍待验收。
- 新增 `tests/locate-inflight-browser.test.ts`：将真实 React 选行、DSH ToolRuntime 与 Host 动作流相连，使用合成 transport 暂停 TYPE 后重选同一字段，核验旧定位失效且不派发界面动作。
- 完整链路浏览器夹具使用 route 拦截的 localhost 页面，提供与实际 DSH 一致的安全上下文，不启动网络服务。
- 扩展 `tests/key-locate-browser.test.ts`：覆盖同 Key 程序重选清除旧字段、取消时保留原详情和字段，以及取消后的迟到成功回执。
- 扩展 `tests/ui-action-gateway.test.ts`：通过固定版真实 Host Gateway 验证二进制 Key 的协议 7 动作、提交帧和确认帧。
- 更新 `src/host/ai-locate-tool.ts` 的说明及定位工具测试：明确极长 Key 的后续读取可能超出结果预算；覆盖空 Base64、最大二进制身份、超限输入，以及定位已提交但新版本尚未同步时禁止无参读旧值、同步后读取新值。
- 将极长 Key 的限制说明扩展到状态查询；最大身份测试分别验证定位确认与状态预算拒绝。
- 扩展 `tests/ai-locate-tool.test.ts`：在合成 TYPE 查询尚未返回时取消或重连，核验旧目标不被派发到界面。
- 修复 `src/client/KeyBrowser.tsx` 与 `KeyCatalog.tsx`：聚焦详情时程序定位先恢复目录，等待目标行实际位于可见目录后才提交；期间手动切换焦点会使旧动作失效。扩展真实浏览器回归覆盖聚焦模式下的未扫描目标。
- 扩展定位浏览器回归，覆盖已扫描 Key 所在命名空间折叠时的展开、可见选中与提交，保持已扫描计数不变。
- 扩展定位浏览器回归：等待确认期间用户手动进入聚焦模式时，旧动作失效，迟到回执不改变用户选择与聚焦状态。
- 修复 `src/client/KeyBrowser.tsx`：所有手动焦点切换都立即使选择版本失效，覆盖 Host 的 TYPE 检查尚未返回、界面动作尚未下发的时间窗口。
- 统一目录鼠标、键盘、滚轮和辅助点击操作的选择失效入口，覆盖折叠、定位、视图设置及用户滚动；程序定位回退时仅在用户未再变更焦点时恢复原聚焦布局。
- 将数据与元信息页签手动切换纳入用户操作保护；定位失败且用户未修改页签时恢复原页签，避免旧动作覆盖新选择。
- 扩展真实 React + ToolRuntime + Host 流的在途 TYPE 回归，覆盖手工重选字段、切换焦点、折叠命名空间、定位当前 Key、切换元信息及树/列表；浏览器回归检查定位失败后恢复原聚焦与页签。
- 收窄目录用户操作保护到可能被定位覆盖的导航、视图及分隔符操作；连续滚轮只在一次手势开始时使选择失效，普通打开筛选面板不触发无关同步。
- 滚轮保护改为手势期间保持选择未同步，静止后释放边界，防止超过发布延迟后旧定位仍覆盖后续滚动；完整链路测试覆盖手势中请求与无关筛选展开。
- `src/client/KeyCatalog.tsx` 为滚动条指针拖动持有单次选择边界；指针释放/取消、窗口失焦、页面隐藏和组件卸载时解除边界并注销监听器。
- 修正目录窗口变量与浏览器 `window` 的类型冲突，并在指针捕获丢失时释放拖动边界。
- 在真实 Chromium 中用合成指针事件覆盖长拖期间请求被拒、释放/取消/捕获丢失/失焦/隐藏/卸载后的边界恢复及监听器清理；未将模拟事件称为系统原生滚动条实测。
- 监听器回归按组件实际注册的回调进行身份核对，排除 Playwright 自身的点击拦截器。
- 修正监听器夹具对 Playwright 预注册点击拦截器的识别，避免把测试工具自身监听器算作组件泄漏。
- 扩展 `tests/locate-inflight-browser.test.ts`：在 Chromium 显示原生滚动条，用真实鼠标按住并拖动合成 Key 列表，核验拖动时定位拒绝、松开后同步恢复。
- 调整原生滚动条夹具的合成 Key，避免全部被折叠为单一命名空间，从而实际形成可滚动列表。
- 新增 `src/host/ai-profile-tools.ts`，并在 `src/runtime.ts` 注册 `redis_viewer_profiles`：在用户要求时按页返回已保存资料的唯一 ID、名称和分组，复用会话预算，不输出连接设置；每页独立采样，不声称原子快照。工具说明明确名称和分组按用户填写内容返回，不把自定义文字误称经过凭据过滤。新增 `tests/ai-profile-tools.test.ts` 覆盖空列表、分页、同名分组、敏感设置不输出、参数拒绝、无会话、取消、资料损坏和预算。该改动仅实现 RO12 的资料列表，连接和断开仍待完成。
- 补充 `tests/ai-profile-tools.test.ts`：验证资料读取在途取消后不返回结果、不计结果字节，另一会话仍可独立读取并计入自身预算。
- 更新 `docs/verification/readonly-ro07-action-contract-draft-2026-10-30.md`：记录协议 6 安装包哈希、真实 DSH 和模型对合成字段、多客户端冲突及恢复的验证，以及测试范围与服务清理结果。
- 修改 `tests/ui-action-gateway.test.ts`：通过真实 Host Gateway 验证新版选择发布帧、会话归属和确认帧；修改 `tests/ui-session-channel.test.ts` 补充再次重试成功的检查。
- 修改 `src/client/index.ts`：动作通道有限次数重试耗尽后标记当前选择同步失败，让界面保留手动恢复入口；不增加持续重试。
- 修改 `tests/ui-session-channel.test.ts`：覆盖未建立 Redis 连接时连续开流失败、手动重试及再次失败后的状态，防止恢复入口消失。
# 2026-11-01：连接扩展方案草稿

- 修正 `docs/verification/readonly-ro09-key-locate-2026-11-01.md` 与 `docs/DSH_AI_READONLY_TASKS.md`：明确真实模型结果属于协议 7 构建，当前协议 8 源码尚待重新构建和验收。
- 新增 `docs/verification/readonly-ro09-key-locate-2026-11-01.md`，并更新 `docs/DSH_AI_READONLY_TASKS.md` 的 RO09、RO12 证据入口：记录协议 7 包哈希、398 项预打包检查、真实 DSH/模型的合成文本和二进制 Key 定位、字段恢复、资料列表及清理；集合项定位和连接生命周期仍未完成。
- 隔离模型验收配置补充：E 盘 DSH 测试实例使用固定版凭据服务支持的路径引用日常凭据库，测试配置只包含路径，不复制或记录凭据值；避免在隔离实例重复录入密钥。
- 新增 `docs/RO21_CONNECTION_ARCHITECTURE_PLAN.md`：依据现有有界 RESP 实现及固定版本官方资料，记录 mTLS、SSH、Sentinel、Cluster 的候选设计、连接与资料模型影响、生命周期和验证矩阵；现阶段均为方案，未宣称连接模式已实现。
- 更新 `docs/DSH_AI_READONLY_TASKS.md` 的 RO21 证据入口：说明方案仍待验证和实际实现，任务保持未完成。
# RO09 Hash 字段定位：定点读取基础（进行中）

- 继续修改 `src/domain.ts`、`src/typert.shared.ts`、`src/host/ui-action-channel.ts`、`src/host/ai-reader.ts` 和 `src/host/ai-locate-tool.ts`：新增当前 Hash 字段定位动作与模型工具，固定 Host 待处理请求中的 Key/字段身份，并对定点读取过程中的选择版本作校验；界面实现与完整验收仍待完成。
- 修正 `src/host/selected-reader.ts` 的结果类型导出，满足公开方法的 TypeScript 声明生成要求。
- 新增 `tests/hash-field-locate.test.ts`：使用内存合成 Redis 链路检查空字段、空值、字段缺失、类型变化、权限错误、编码拒绝与读取期间用户改选，确保不依赖用户 Redis。
- 补充 `tests/ui-action-channel.test.ts`：验证字段提交仅采用 Host 待处理动作的身份，提交与界面重新同步之间不暴露已同步选择。
- 修正 `src/host/ai-reader.ts` 的读取后连接校验：同一连接失败保留实际超限或网络错误，连接被替换时仍拒绝旧结果；`tests/hash-field-locate.test.ts` 注入两类连接失败验证分类。
- 调整 `src/host/ai-locate-tool.ts`：明确区分 Key 不存在、字段不存在和类型变化，选择过期给出中文提示，并说明 Key 与字段组合可能超过请求预算；`tests/hash-field-locate.test.ts` 使用真实 RESP 编码器覆盖最大身份组合超限。
- 扩展 `tests/ai-locate-tool.test.ts`：以合成连接串联真实 ToolRuntime 与 Host 双向流，验证二进制字段身份、提交后同步前拒绝无参读取、同步后读取新字段，以及定位结果不包含字段值。
- 更新 `tests/host-typert.test.ts` 的严格端点清单，纳入只读 `readHashField` 并继续核对 Host/Client 两端一致。
- 补充合成链路中的无效字段参数、字段缺失中文提示以及 HGET 期间重连测试，确保不会提交旧连接目标。
- 验收状态：当前协议 8 的 Hash 字段定位仍在实施中。合成 ToolRuntime/Host 流、严格协议、错误分类和类型检查已验证；统一候选禁用后的最终浏览器版本尚未复测，也未在真实 DSH 与模型中验收。C 盘空间不足时未继续启动浏览器或 DSH。
- 待核实的界面风险：用户按下候选行下方旧字段后，候选取消可能使旧行在松手前位移，造成点击丢失或误选；候选字段已缓存和旧选择为独立采样时布局不同。需在系统盘空间恢复后，用真实鼠标和触摸按下、取消回退、松手的受控浏览器交错验证，并覆盖隐藏、失焦、断流及取消的清理；未验证前不宣称该子项完成。

- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/typert.host.ts` 和 `src/typert.remote-client.ts`：新增严格的 Hash 字段读取请求与结果，协议版本升至 8，区分空值、字段不存在、Key 不存在、类型变化和读取失败。
- 修改 `src/host/selected-reader.ts` 和 `src/remote-service.ts`：复用现有只读定点读取，允许调用者对命令执行期间的选择状态施加校验；界面采样不改变 HSCAN 缓存和统计。
- 修改 `tests/client-bundle.test.ts`：同步检查新增的远程调用描述符数量。该组是后续字段定位事务的基础，尚未提供模型定位能力或完成 RO09。

# Hash 字段定位客户端接入（实施中）

- `HashView.tsx` 接入当前 Hash 的定点字段采样与独立目标行，保留 HSCAN 缓存及计数，增加候选回退与人工选择优先。
- `CurrentSelection.tsx`、`ui-actions.ts`、`ui-pane-presence.ts` 和 `index.ts` 接入请求级发布暂停、字段动作与提交回执，避免提交期间发布旧字段。
- `CollectionTable.tsx` 仅在目标行实际滚入自身可见区域后确认，并在定位期间暂停自动翻页；仍需运行编译和专项浏览器验证。
- 修正 `CollectionTable.reveal` 的严格可选类型以允许显式传入 `undefined`。
- 保留之前的独立字段选择，人工接管候选时保留该行；请求级暂停同步阻断已经排队的旧选择发布定时器。
- 更新 Key 定位及延迟读取浏览器合成夹具，提供新增 Hash 处理器与定点读取接口。
- 新增 `tests/hash-locate-browser.test.ts`，使用合成字段验证目标可见、暂停旧发布、拒绝回退及人工抢先；尚待执行。
- 修复测试夹具的 Key 展示上下文；字段只有被直接点击才接管候选，筛选更改会取消在途定位；定点行标注来源及采样时间，本地筛选计数只统计扫描缓存。
- 字段表滚动手势在整个滚轮/拖动周期内使旧动作失效；定位暂停自动续扫并提供明确继续入口，拒绝时恢复原分页意图；扫描开始使在途动作失效、后续采样不再永久显示旧定点值，保留原自动刷新时钟。修正浏览器测试在筛选失效后先等待重新同步。
- 修正新 Key 候选组件首次 Hash 扫描误使 Key 定位失效：仅对已挂载且实际可发布的详情的后续扫描递增选择版本。
- 扩展合成 Chromium 回归，覆盖候选期间滚动、延迟读取与搜索抢先、空字段及后续刷新清理定点样本；待执行验证。
- 固定滚轮与迟到回执的测试时序，验证事件确实使版本失效，并在失败时输出消息、发布及 DOM 状态以定位原因。
- 增加无选中字段筛选、二进制字段、真实 Chromium 滚动条按住、自动刷新、取消/断流和拒绝后滚动及焦点回退的合成回归，尚待运行。
- 为字段候选记录定位前的列表滚动位置，拒绝或取消且用户未导航时在候选移除后恢复；用户滚动或选行时保留其新位置。
- 修正自动刷新测试夹具中控件被其他区域遮挡的布局，使浏览器通过真实点击操作刷新控件。
- 自动刷新夹具改为真实 KeyBrowser 的 toolbar/inspector 层级，移除临时层级样式，并在点击前断言浏览器实际命中按钮。
- 按每次扫描信号记录替换或追加，追加页未命中时保留独立字段，命中时采用新扫描样本；用户主动滚动解除定位后的临时续扫保护，恢复原分页意图。
- 浏览器夹具第二个扫描页返回终止游标，避免合成数据永久返回同一续页导致不真实的连续扫描。
- 字段表统一鼠标/触摸按下边界，候选按下期间仅保留不可提交的视觉行，按下后移动与取消放弃候选；触摸取消后保持边界至触摸结束，键盘滚动同样维持到按键释放。
- 字段表按下先触发既有用户接管通知，再建立手势边界，以保留 Key 定位候选详情中的人工选行。
- 简化字段候选交互：待 Host 确认行明确标注定位中并禁用，取消时立即回退，不跨通道保留视觉 handoff；仅 Key 候选详情的鼠标按下沿用既有接管，触摸滑动不会提前接管。
- 统一候选交互：待确认的 Key 详情显示定位中并使用原生 `inert`，鼠标、触摸和键盘均等待确认；目录其他 Key 仍可抢先选择；更新旧 Key 回归。
- 缩短 Key 浏览器夹具单项操作等待，定位统一禁用后的首个真实失败步骤。
- Key 候选回归改为验证 inert 并从目录切换抢先，回退到旧详情后再验证焦点按钮可用。
- 删除 KeyBrowser 旧的全局用户选择接管监听；目录明确选 Key 仍走原显式选择处理，树/列表等导航只取消候选。

### RO12 Host 候选连接基础（进行中）

- 修改 src/host/connection-service.ts：增加仅供 Host 内部调用的候选连接预检与同会话状态核验，成功后同步交换 socket；失败、取消和并发连接操作会清理候选并保留当前连接。
- 影响：尚未注册 RPC 或 AI 工具；资料版本、用户凭据与界面联动仍需后续接入，跨进程资料修改的原子核验尚未实现。
- 验证：正在执行 TypeScript 编译及合成连接生命周期测试。

- 新增 	ests/candidate-connection.test.ts：使用合成 transport 检查预检失败、取消后迟到连接、并发替换和会话隔离，不连接实际 Redis。

- 补充候选连接竞争、断开、切换数据库和认证失败合成用例，验证过期候选不会覆盖最新会话连接。

- 验证结果：pnpm typecheck 通过；候选连接与现有连接服务合成测试共 23 项通过。测试未启动服务，TEMP/TMP 指向 E 盘。

### RO09 Hash 指针竞态回归（进行中）
- 修改 tests/hash-locate-browser.test.ts：补充候选字段等待 Host 确认时，用户对已加载字段执行真实鼠标按下、抬起的布局和选择验证，检查候选撤销不能改变指针命中。该测试用于定位未完成的选择竞态，不代表功能已验收。

### RO12 候选连接取消与资源释放修复（进行中）

- 修改 `src/host/connection-service.ts`：拒绝覆盖正在连接或切换数据库的会话；候选连接和校验支持立即取消等待、清理迟到连接；交换后分别尝试解除监听和关闭旧连接，记录未确认释放的资源以便销毁时重试，并返回真实交换状态与旧资源释放状态。该内部能力尚未注册为 AI 工具，保存资料的并发校验及完整验收仍未完成。
- 本次修复的 TypeScript 检查与并发、取消、资源异常专项测试正在执行，结果见后续记录。
- 修改 `tests/candidate-connection.test.ts`：覆盖手动连接与 SELECT 期间的抢占拒绝、不响应取消的开启与校验、迟到结果和异常、旧资源单项释放失败及候选资源双重释放失败与重试。`pnpm typecheck` 通过；连接服务及候选连接两组共 30 项测试通过。未连接或修改用户 Redis；外部资料变更与提交之间的原子校验仍待设计和验证。

- 修改 src/client/CollectionTable.tsx 和 src/client/HashView.tsx：记录指针交互起止，定位撤销立即解除事务，但延迟到指针事件结束后移除候选行，避免按下和抬起之间目标行位置变化；手动交互后不恢复旧滚动位置，取消、失焦和卸载沿用现有手势清理。正在进行真实浏览器回归。

- 修改 src/client/HashView.tsx：组件卸载时取消延迟清理并阻止重新调度；修改 tests/hash-locate-browser.test.ts：增加鼠标取消、窗口失焦和触摸取消事件序列，检查候选消失并恢复同步，避免手势状态遗留。

### RO09：List 和 Stream 选中项在途选择校验（进行中）

- 修改 `src/host/list-reader.ts`、`src/host/stream-reader.ts` 和 `src/host/selected-reader.ts`：把调用方的选择有效性校验传入现有只读上下文；Stream 保留原有游标校验，防止读取期间选择变化后继续派发后续命令。
- 修改 `src/host/ai-reader.ts`：当前选中项通过实际 AI 读取入口时，在命令派发前和响应后使用已确认的界面选择版本；读取结束再次检查，保证未同步的新选择也不会返回旧内容，同时保留同一连接真实失败结果。
- 新增 `tests/ai-selected-race.test.ts`：通过 DSH 工具注册与调用入口，以合成传输分别在 List 的 TYPE/LRANGE、Stream 的 TYPE/XRANGE 返回前更改界面版本或选中目标，验证后续命令不派发且旧值不返回；未操作用户 Redis。
- 检查：`pnpm typecheck` 通过；`tests/ai-selected-race.test.ts`、`tests/list-view.test.ts`、`tests/stream-view.test.ts`、`tests/ai-tools.test.ts` 共 4 个文件、71 项测试通过。本项只修复读期间的选择竞态，不代表 List/Stream 程序定位或 RO09 已完成，尚需真实 DSH 和模型验收。

- 修改 tests/hash-locate-browser.test.ts：将真实鼠标竞争回归扩展为未缓存字段与已缓存字段两种候选，验证候选行重排也不会改变用户按下的字段。
- 补充 `src/host/connection-service.ts` 与 `tests/candidate-connection.test.ts`：宿主已销毁后非合作的 opener 才返回连接时，首次关闭异常会立即再尝试一次；持续异常会保留资源并记录不含异常详情的固定警告，不宣称已经关闭。覆盖首次恢复和持续失败两种情况；`pnpm typecheck` 通过，候选连接与连接服务共 32 项测试通过。该处理不能保证持续抛错或永不返回的外部资源已释放。

- 检查结果：pnpm typecheck 通过；tests/hash-locate-browser.test.ts 与 tests/selection-race-browser.test.ts 共 3 项真实 Chromium 测试通过，包含按下/抬起之间的未缓存与已缓存候选字段、鼠标取消、触摸取消、失焦和既有选择同步场景；git diff --check 通过（仅有换行符提示）。这些是本机合成夹具结果，不等于真实 DSH 和模型验收。

### RO09：List 定位协议基础（进行中）

- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/host/ui-action-channel.ts`、`src/client/ui-actions.ts` 和 `src/client/ui-pane-presence.ts`：协议升级至 9，增加仅包含 Key 身份与非负 List 下标的动作，并由 Host 从已批准动作生成选择，拒绝普通回执伪装为成功。Client 与工具链尚待接入，本项未完成。
- 更新 `docs/DSH_AI_READONLY_TASKS.md` 与 `docs/verification/readonly-ro09-key-locate-2026-11-01.md`：标明协议 7 真实模型证据不适用于现有协议 9。
- 检查：此组修改后 `pnpm typecheck` 通过；尚未进行本协议真实模型验收。

- List 定位 Host 基础：`src/host/ai-reader.ts` 复用选中项的可信会话、选择版本与读取校验；`src/host/ai-locate-tool.ts` 增加 `redis_viewer_locate_list_index`，限制非负 64 位整数文本，仅采样一个下标并明确并发位移语义。Client 接收与界面回执尚未接通，本项未完成；此次编译 `pnpm typecheck` 通过。

- 修改 tests/hash-locate-browser.test.ts：补充超过手势超时的真实鼠标按住、以及定位期间用户滚动后分页恢复的浏览器复现；用于检查现有方案的遗漏，目前尚未宣称修复。

- 复现结果：真实 Chromium 长按超过 10 秒后目标行纵坐标从 195 变为 167，证实手势定时器会提前移除候选；暂时缩短等待以继续单独复现分页问题，修复时恢复长按检查。

- List 定位客户端：`src/client/ui-pane-presence.ts`、`src/client/index.ts` 将动作路由到当前唯一可见 List 视图；`src/client/ListView.tsx` 单独读取下标并暂存候选，界面可见且 Host 确认后才发布选择，样本不混入分页缓存，人工交互或旧目标作废；`src/client/locales.ts` 增加中英位置变化提示。此组 `pnpm typecheck` 通过；专项与真实 DSH/模型验证尚未执行，RO09 未完成。

### RO12 资料同进程事务基础（进行中）

- 修改 `src/host/profile-store.ts`：同进程内使用同一规范化文件路径的资料实例共用串行队列，避免独立实例并发保存时丢失更新；增加内部 `withVerifiedProfile`，在队列内最终读取并比较完整规范化资料快照，再同步调用提交回调。候选网络连接仍须在队列外准备，当前原语未接入连接切换或模型工具。
- 新增 `tests/profile-transaction.test.ts`：检查独立资料实例并发保存、先写后校验、校验提交先于后续写入、入队时快照、删除及取消。上述队列仅协调同进程按相同规范化路径访问的插件实例；不保护其他进程、人工直接写入或不同路径别名，不能将其描述为文件系统级原子事务。
- 验证：代码及测试修改后的 `pnpm typecheck` 通过；专项测试结果待运行。资料列表后的凭据输入、候选连接提交整合与真实 DSH 模型验证仍待完成。
- 补充验证结果：`pnpm exec vitest run tests/profile-transaction.test.ts tests/profile-store.test.ts` 共 2 个文件、14 项测试通过；日志中的专项测试“待运行”状态以此结果为准。

- 修改 src/client/CollectionTable.tsx：移除会误判长按结束的固定超时，改由抬起、取消、失焦、隐藏、卸载或鼠标返回时已松开来结束边界。修改 src/client/HashView.tsx：区分指针交互与真实滚动，拒绝定位时保留用户后续滚动产生的分页状态；修改 tests/hash-locate-browser.test.ts：恢复超过 10 秒的真实长按回归并验证滚动恢复分页。

- 长按测试已越过原 10 秒故障点；分页断言仍失败，暂时增加仅输出合成夹具计数与界面状态的诊断并缩短长按等待，确认是否存在额外状态覆盖。

- 修正分页回归的等待条件：滚轮事件异步分发，必须等选择版本发生变化并重新同步后再断言，避免把滚轮尚未处理误判为分页失败；移除临时输出，恢复真实长按等待。

- 新增 `tests/list-locate.test.ts`：通过注册的 DSH 工具与 Host 动作流验证精确下标、确认提交、选择重新同步、越界、非法参数和伪造成功回执；结果只包含下标，不将采样值放进定位结果。新增 `tests/list-locate-browser.test.ts`：合成分页数据配合真实 Chromium 检查未加载下标、加载计数、用户按下/抬起与迟到读取竞争。
- 检查：`pnpm typecheck`、`pnpm build` 通过；重建后的 7 个相关测试文件 40 项通过，另有 1 项 Chromium 交互测试通过。独立复审及真实 DSH/模型验收仍待完成，本轮不宣称 RO09 完成。

- 严格等待滚轮处理后分页断言仍失败；暂时记录合成夹具前后的扫描次数和表格尺寸，区分游标耗尽与分页状态覆盖，再恢复长按测试。

- 修正 `src/client/ListView.tsx` 的候选撤回：记录等待期间用户的滚动翻页意图，避免恢复旧暂停状态覆盖用户的新操作；候选行因指针交互延迟移除时，同样保留随后发生的滚动。
- 扩展 `tests/list-locate-browser.test.ts`：在原本分页暂停时发起定位并滚轮操作，验证撤回后自动分页保持可用、旧选择未被迟到确认覆盖；`pnpm typecheck` 和该 Chromium 测试通过。

### RO12 资料验证与候选连接交换衔接（进行中）

- 修改 `src/host/connection-service.ts`：候选连接在资料队列外完成准备；新增内部 `connectProfileCandidate`，用同一份规范化资料快照构造连接设置并在资料队列中最终比对，通过同步回调执行会话 CAS 和连接交换。旧连接保持到交换成功；取消、最终核对时资料不匹配或会话已改变时不提交候选，尝试释放候选；会话已被其他操作改变时保留该操作的结果。交换完成后若 gate 抛错或取消仍报告已经发生的交换；回执返回前连接又丢失或被替换时标记 `changed` 并返回当前状态，避免误报仍然连接。旧连接释放失败仍标记 `uncertain`，持续失败不声称已经关闭。
- 修改 `tests/candidate-connection.test.ts`，新增 `tests/profile-connection-transaction.test.ts`：覆盖资料修改与排队取消、连接设置快照绑定、提交后异常、迟到回调及交换后连接失效或被替换。该内部链路尚未注册为 DSH 工具，也未接入界面和凭据输入；资料队列仅协调同进程、相同规范化路径的插件实例，不能保证对其他进程或人工直接修改的排他性。
- 验证：`pnpm typecheck` 通过；候选连接、普通连接及资料事务 4 个测试文件共 43 项通过。未启动服务或操作 Redis。

- 分页诊断发现断言前更多按钮也不存在，继续记录合成扫描游标以确定是否已自动读完；没有更改 Redis 数据。
- 同项浏览器测试进一步确认滚轮触发后选择版本实际递增并重新同步，且读取页数未变化、游标未被提前消费，再断言可继续分页；复测通过。

- 诊断确认分页断言时合成游标已读完，前述失败不能证明分页错误。修改 tests/hash-locate-browser.test.ts，让分页专测期间保留后续合成页，并移除临时诊断输出；重新验证实际状态归属。
- 后续修正：`connectProfileCandidate` 连接前先在共享资料队列中核对快照：若预检读到的资料与原快照不同，则不会打开候选连接；候选意图在初次核对前登记，期间人工操作可以取消。预检后资料若发生变化，网络握手可能已经开始；连接完成后第二次核对若仍不匹配则不交换。资料队列仅协调同进程按相同规范化路径访问的实例，不排除其他进程或不同路径别名的并发更改。新增预检时资料已改变则无网络连接、以及复核等待中用户切换连接两项测试；当时上述 4 个相关测试文件共 45 项通过，`pnpm typecheck` 通过。
- 核对边界：当前实现只比较预检和最终检查时的规范化内容，没有变更历史或单调版本；资料 A→B→A 若在检查时均为完全相同的 A，仍可能通过并交换，不能宣称任何中间变化都会使候选失效。相应源码注释已修正，功能未接入模型与界面。

- 扩展 tests/hash-locate-browser.test.ts：恢复 10 秒以上长按，增加窗口外松开后返回的恢复，以及暂停翻页时滚轮和鼠标拖动两种用户意图；测试夹具在这些场景确保仍有后续页。

- 检查结果：pnpm typecheck 通过；tests/hash-locate-browser.test.ts 和 tests/selection-race-browser.test.ts 共 3 项浏览器测试通过，覆盖真实鼠标长按超过 10 秒、未缓存/已缓存候选、滚轮及拖动后分页恢复，以及模拟取消、失焦和窗口外松开。夹具与真实触屏、真实 DSH 和模型验收边界仍然不同。
- 修复空会话断开竞态：`src/host/connection-service.ts` 中，当前会话尚无连接记录时也会取消该会话的在途候选，再返回断开状态；已存在连接时仍先检查目标身份和代次，过期目标不得取消候选。`tests/candidate-connection.test.ts` 覆盖资料复核和连接建立期间取消、迟到连接释放、跨会话隔离及过期目标不会取消。`pnpm typecheck` 通过；候选、资料衔接和现有连接 3 文件共 45 测试通过。该行为尚未接入模型工具。

### RO10 集合刷新互斥（进行中）

- 修改 `src/client/use-collection-scan.ts`：同一目标已有读取时同步拒绝新的刷新或续页，防止忙碌状态尚未渲染时连续触发造成取消和重复读取；切换目标仍使用既有清理逻辑取消旧请求并读取新目标。
- 新增 `tests/collection-refresh-race-browser.test.ts`：在真实 Chromium 中使用延迟合成读取复现重复刷新，在修改前观察到 3 次调用且前两次被取消；测试同时覆盖切换目标后迟到结果不覆盖新目标。修复后专项测试待执行，本项未接入 AI 动作，RO10 尚未完成。

### Redis 界面动作最终确认（进行中）

- 修改 `src/domain.ts`、`src/host/ui-action-coordinator.ts`、`src/host/ui-action-channel.ts`、`src/client/ui-actions.ts` 和 `src/host/ai-locate-tool.ts`：协议提升至 10，界面动作 Host 提交后等待客户端完成选择发布并同步，再报告 `applied`；提交后确认中断统一返回 `unknown`，定位工具明确说明结果未知。复用现有选择发布通道，不把 Redis 值传入动作帧。专项测试与双向流中断回归尚在进行。
- 修改 `tests/ui-action-channel.test.ts`：增加接收提交结果前断开、选择发布后同步前断开以及发布了错误选择的可控通道回归，并把成功路径改为等待匹配选择发布和同步。TypeScript 检查通过；本组测试尚待运行。
- 修改 `tests/ai-locate-tool.test.ts`、`tests/list-locate.test.ts` 和 `tests/ui-action-gateway.test.ts`：真实工具注册和 Gateway 夹具同步模拟客户端选择发布与同步，验证定位成功必须经历新的确认流程。TypeScript 检查通过，集成测试正在执行。
- 新增 `tests/ui-action-confirmation-browser.test.ts`：连接真实浏览器 ListView、客户端动作流与 Host 协调器，分别检查最终选择确认完成和确认帧丢失后的结果；TypeScript 检查通过，测试正在执行。
- 为 `tests/ui-action-confirmation-browser.test.ts` 增加失败诊断（仅合成输入与选择版本），定位首次端到端连接未同步；TypeScript 检查通过，测试尚未通过。
- `tests/ui-action-confirmation-browser.test.ts` 首次运行因 `about:blank` 非安全上下文缺少 `crypto.randomUUID` 而失败；已在合成夹具中提供确定性的合法标识，真实 DSH localhost 的运行环境不同。TypeScript 检查通过；完整确认协议仍在修正人工选择 ABA 竞态。
- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/client/selection-epoch.ts`、`src/client/CurrentSelection.tsx`、`src/client/ui-actions.ts` 和 `src/host/ui-action-channel.ts`：为动作完成后的选择发布绑定动作请求 ID；手动选择、滚动或其他失效会清除旧确认，防止改选后又选回原目标的 ABA 误确认；Host 拒绝未匹配发布的同步帧。TypeScript 检查通过，相关回归正在适配。
- 更新 `tests/ui-action-channel.test.ts`、`tests/ai-locate-tool.test.ts`、`tests/list-locate.test.ts`、`tests/ui-action-gateway.test.ts` 的成功夹具，使选择发布显式携带所属动作 ID；TypeScript 检查通过，专项测试待执行。
- 更新 `tests/ui-action-confirmation-browser.test.ts` 与 `tests/ui-action-channel.test.ts`：增加真实客户端手动改选再选回的 ABA 竞争、无匹配发布直接伪造同步的测试；TypeScript 检查通过，专项测试待执行。

### Redis 界面动作单次 Host 提交协议设计（进行中）

- `prepare`：Host 校验动作、原选择版本、连接及唯一界面，记录预期目标并将选择状态置为未同步，但不写入新选择；随后回复客户端允许继续。
- `render/publish`：客户端处理准备结果、提交 React 界面，再用既有 `publishSelection` 发送当前真实选择及动作 ID。Host 仅在动作 ID、连接、内容、版本、期限及唯一界面均匹配时一次性提交新选择；新选择不同或无动作 ID 视为用户操作，结束旧动作为 `unknown` 并按普通选择处理。
- `applied/sync`：Host 收到并提交匹配发布才返回 `applied`；在客户端收到发布回执并发出同步状态之前，Host 选择仍不可信，不能据此进行无参数读取。准备后若通道断开、取消或超时，报告 `unknown`，不推断界面是否执行；准备前按原有 stale/timeout 等状态报告。
- 本地选择版本变化会立即取消旧的待回执发布，使最新选择能够发布；迟到回执按 ID 忽略。协议将通过真实浏览器与 Host 相连的成功、丢包、用户 ABA、隐藏、多界面和同步回归验证；当前仍未完成。
- RO10 集合刷新互斥验证补充：`pnpm typecheck` 通过；新 Chromium 竞态和自动刷新共 10 项测试通过；Hash 与 List 定位各 1 项浏览器回归通过。前述“专项测试待执行”以本条实际结果为准；尚未接入 DSH AI 刷新动作或完成 RO10 验收。
- 修改 `src/host/ui-action-channel.ts` 和 `src/client/selection-epoch.ts`：准备阶段不再写 Host 选择，带动作 ID 的渲染后发布才执行唯一提交；选择版本变化立即终止旧待回执发布，并忽略迟到回执。TypeScript 检查通过；现有测试正在按新提交时点更新，功能尚待完整回归。
- 更新 `tests/ui-action-channel.test.ts`、`tests/ui-action-gateway.test.ts` 和 `tests/selection-epoch.test.ts`：以渲染后发布为 Host 提交时点，增加旧发布被新选择立即取代及迟到回执忽略的回归；TypeScript 检查通过，专项测试正在执行。
- 修正 `tests/ui-action-channel.test.ts`：准备阶段的拒绝改由目标失效触发，不再依赖旧版准备时执行提交的行为。首次单次提交专项运行中 28 项通过、1 项旧断言失败；真实浏览器 ABA 从约 11.6 秒降至约 2.2 秒。TypeScript 检查通过，修改后的测试待重跑。
- 更新 `tests/ui-action-confirmation-browser.test.ts`：补充模拟面板隐藏、第二个 Host 接收流和动作完成后的重新同步；TypeScript 检查通过，专项测试正在执行。上一轮单次提交相关 8 组 43 项测试通过。

### RO12 内部资料快照令牌（进行中）

- 新增 `src/host/profile-snapshots.ts`：生成随机不透明令牌，按可信会话、资料 ID 和规范化资料快照绑定；同一会话同一资料重新签发会使旧令牌失效。每会话最多 50 项、全局最多 250 项，5 分钟到期；使用单一计时器清理过期数据，支持按会话及服务销毁清理。令牌不编码连接设置，解析只供可信 Host 内部使用并返回独立副本；严格资料校验拒绝密码字段，不记录资料或凭据。
- 新增 `tests/profile-snapshots.test.ts`：覆盖随机令牌、跨会话与错误 ID 拒绝、快照副本、旧令牌撤销、密码拒绝、到期/销毁清理和容量边界。该存储尚未接入资料列表、连接表单或模型工具，不代表 RO12 已完成。
- 检查：首次类型检查发现测试中故意注入的密码字面量触发 TS2353，已调整非法夹具写法；随后 `pnpm typecheck` 通过，令牌专项 4 项测试通过。未启动服务或操作 Redis。
- 更新 `src/host/ui-action-coordinator.ts`、`src/host/ui-action-channel.ts`：保持 Host 单次提交，等客户端收到发布回执并同步同一版本后才报告 `applied`；任意过期、错误或重复动作 ID 的发布均直接拒绝，绝不降级成人工选择。TypeScript 检查通过，对应中断和迟到帧测试正在更新。上一轮 Key/Hash/List、可见性及竞态浏览器共 16 项通过，但需对当前修订再复验。
- 补充 `src/host/ui-action-channel.ts` 的版本校验：已提交动作后，如果未经新发布直接声称其他版本已同步，则拒绝该通道状态；同步调整 `tests/ui-action-channel.test.ts` 对错误动作身份的预期。TypeScript 检查通过，针对性测试待执行。
- 更新 `tests/ui-action-confirmation-browser.test.ts`、`tests/ui-action-channel.test.ts`：增加 Host 完成唯一提交但发布回执丢失、用户新选择后旧动作令牌迟到的回归；检查旧帧被拒且不覆盖新选择。TypeScript 检查通过，测试待运行。
- 完成单次 Host 提交及最终同步回归：`pnpm typecheck` 通过，8 个相关测试文件共 47 项通过，包括真实浏览器连 Host 的确认帧及发布回执丢失、人工 ABA、模拟面板隐藏、第二接收流、同步恢复，以及旧动作令牌不能覆盖更新的人工选择。
- 当前时效边界：面板在准备后隐藏，若旧动作的发布帧一直未到达 Host，Host 无法区分动作自身与用户导致的未同步版本，会保留该动作至最多 10 秒并返回 `unknown`；此时不声称成功，用户后续动作可能暂时收到 busy。若迟到动作帧到达也必须拒绝，不能当作人工选择。未在真实 DSH 或用户模型上验收协议 10。
- 诊断性完整检查：`pnpm check` 通过，55 个测试文件共 466 项通过，包含本地浏览器测试。该检查开始时其他资料列表工作可能尚在修改，不能作为源码稳定后的最终检查；集成完成后需重跑。真实 DSH 和用户模型逐项验收仍未完成。

### Redis 状态工具的选择同步边界（进行中）

- 新增 `tests/ai-selection-status-channel.test.ts`：通过真实 Host 双向动作通道及注册的工具，覆盖动作发布后未同步、通道断开和重开后重新同步，同时检查无参数值读取仍拒绝未同步状态。TypeScript 检查通过，正在先验证旧实现是否暴露未确认选择。
- 调整 `tests/ai-selection-status-channel.test.ts` 的首个前置断言，以便先定位现有状态工具在未同步阶段的实际错误，而非仅因新字段缺失提前失败。TypeScript 检查通过。

### RO12 资料列表快照令牌接入（进行中）

- 修改 `src/host/profile-snapshots.ts`：支持将每页令牌暂存，只有工具结果通过预算校验时才提交；取消或失败时回滚，不撤销先前令牌。按暂存引用计数管理空会话，避免一个请求回滚误使并发请求失效；会话销毁后迟到的暂存不能复活。
- 修改 `src/host/ai-profile-tools.ts` 与 `src/runtime.ts`：`redis_viewer_profiles` 每项附带按可信会话和完整资料快照绑定的随机短期 `snapshotToken`；容量不足时为 `null`，每页仍独立读取，摘要不包含连接设置或凭据。同一资料重列会替换旧令牌，按 session 和插件销毁清理；尚未注册连接工具，也不接受模型提供密码。
- 修改 `tests/profile-snapshots.test.ts`、`tests/ai-profile-tools.test.ts`：新增暂存提交/回滚、并发与销毁，以及真实 ToolRuntime 的跨会话、资料变更、取消、容量耗尽和释放验证。首次专项回归因旧摘要断言不接受新增字段而失败，调整断言后复测通过；`pnpm typecheck` 通过，2 文件共 9 项专项测试通过。未运行 DSH 或操作 Redis。
- 已复现旧问题：动作提交到 Host、客户端未同步时，`redis_viewer_status` 返回了尚未确认的新 Key。修改 `src/host/ai-reader.ts`、`src/remote-service.ts`、`src/host/ai-tools.ts`：复用唯一通道同步状态，未同步时返回 `selectionSync: unavailable` 和空的 `currentSelection`，同步时标记 `synchronized`；说明中明确空选择与不可确认的区别和记录时间含义。无参数值读取的确认逻辑未改。同步适配 `tests/ai-selection-status-channel.test.ts`、`tests/ai-locate-tool.test.ts`、`tests/list-locate.test.ts`、`tests/ai-tools.test.ts` 的注入回调；TypeScript 检查通过，专项回归正在运行。
- 更新 `docs/AI_READ_USAGE.md`：解释 `selectionSync`、不可确认与无选择的区别，以及 `currentSelection.sampledAt` 是 Host 记录时间。`pnpm typecheck` 通过；真实通道及状态、定位和选择读取竞态共 5 个测试文件、47 项测试通过。真实 DSH/模型整体验收仍待完成。

### RO12 资料令牌并发容量修正

- 修改 `src/host/profile-snapshots.ts`：对尚未提交的新令牌预留全局及当前会话容量；容量已被其他暂存占用时返回 `null`，不再先返回令牌、后因容量竞争整页提交失败。回滚、会话销毁、插件销毁或五分钟暂存过期会释放预留；暂存数量和单个定时器受限，随机令牌同时避开在途和已提交令牌。已提交的其他会话令牌不被驱逐。
- 修改 `tests/profile-snapshots.test.ts`：覆盖全局 249 项时跨会话竞争最后位置、同会话竞争最后位置、无令牌结果提交、回滚、会话销毁、暂存过期和已提交令牌保留。`pnpm typecheck` 通过，快照与真实 ToolRuntime 列表共 2 文件 12 项测试通过。本次未启动服务或操作 Redis；模型连接工具仍未接入。

### 协议 10 真实 DSH 与模型子项证据

- 新增 `docs/verification/readonly-ro09-protocol10-2026-11-01.md`：归档隔离 DSH `0.2.0-rc.2`、真实 `DeepSeek-V41-Flash` 和合成 Redis 的 Key、Hash、List、资料列表令牌及侧栏可见性状态结果；区分模型实际读取与其他尚未验收的任务，不写入凭据、令牌实值或业务数据。
- 记录测试包 SHA-256 为 `34d2ea9468dd45ef04c46c63f40f47cc2d7d74029f1f3cbc91d42b6cf5667e36`，该包默认 prepack 为 56 文件、470 测试通过；包早于资料快照容量修复，不将该结果外推到当前源码或新包。文档修改后 `pnpm typecheck` 通过；RO07～RO33 均未据此整体标记完成。
- 同一测试包在 2026-11-01 20:30（本地时间）从隐藏状态请求 `redis_viewer_show` 时，面板实际打开但工具返回 `stale`；该场景明确记为失败，原因待排查修复。

### RO09 Set 成员定位 Host 基础（进行中）
- 修改 src/domain.ts、src/typert.shared.ts、src/typert.host.ts、src/typert.remote-client.ts、src/remote-service.ts：协议升至 11，新增严格原始字节 Set 成员点查 DTO 和受信会话 RPC，复用 RedisSelectedReader 的 TYPE、SISMEMBER、TYPE、PTTL，只读且不推进 SSCAN。
- 修改 src/host/ai-reader.ts、src/host/ai-locate-tool.ts、src/host/ui-action-channel.ts：加入共享预算的精确文本或规范 Base64 成员定位，动作仅包含身份并沿用带令牌的确认链；类型、缺失、失败、超限和不确定确认分别报告。修改 tests/host-typert.test.ts、tests/client-bundle.test.ts：同步端点清单。客户端及完整验收仍在进行。

- 新增 tests/set-member-locate.test.ts：对合成 Host 验证空和二进制成员、精确命令序列、缺失、类型变化、权限、错误回复、请求超限与双端严格编码；通过真实工具注册和 Host 动作流验证只有完成选择确认后才报告 applied，严格拒绝混合参数和写入命令。

### RO09 Set 成员定位客户端（进行中）
- 修改 src/client/SetView.tsx：新增精确成员点查、候选与独立定位行，保持扫描计数，拒绝时恢复状态并保留用户选择、滚动和翻页意图。修改 src/client/ui-pane-presence.ts、ui-actions.ts、index.ts：通过现有对话级界面通道传送 Set 成员动作和精确点查，复用动作令牌确认。正在编译与浏览器验证。

### Redis 侧栏显示动作与选择版本（进行中）

- 新增 `tests/ai-show-selection-channel.test.ts`：使用真实注册工具、Client 动作处理和 Host 双向通道，模拟打开侧栏导致选择版本变化并观察显示动作结果。TypeScript 检查通过；正在复现实际模型验收中面板打开但返回 stale 的问题。

- 扩展 tests/set-member-locate.test.ts：在 SISMEMBER 等待期间分别改选和替换连接，断言旧采样按 stale 拒绝，不能落到新会话状态；先前 Set/Hash/List 与双端协议共 20 项专项通过。
- 已用真实工具注册与双向通道复现：侧栏打开且可见，但选择版本变化令 `redis_viewer_show` 错误返回 `stale`。修改 `src/host/ui-action-coordinator.ts`：选择或目标失效仅取消带目标的动作，显示侧栏这类无目标动作继续由可见性、通道、歧义和超时检查决定。TypeScript 检查通过；专项回归正在运行。

- 新增 tests/set-locate-browser.test.ts：通过真实 Chromium 的 Set 视图和 Host 双向动作通道，覆盖筛选外、二进制、空成员、扫描数不增加及用户指针选择抢占；使用合成读取，不操作用户 Redis。

- 检查结果：pnpm typecheck 通过；tests/set-member-locate.test.ts 4 项通过，另外 Hash/List 和双端协议回归通过；这些为合成 Host 测试，真实 Chromium 和 DSH/模型验收仍待完成。
- 扩充 `tests/ai-show-selection-channel.test.ts`：在打开侧栏时同时触发版本变化和普通选择重新发布，覆盖两条会调用协调器失效入口的实际路径。TypeScript 检查通过；上一轮 6 个专项文件 35 项测试通过，更新后正在重跑。

- 扩展 tests/set-locate-browser.test.ts：增加已缓存成员不重复、点查期间筛选变化取消、准备阶段隐藏面板等浏览器与 Host 通道回归。
- 完成显示侧栏动作专项回归：`pnpm typecheck` 通过；真实工具注册加 Host/Client 双向通道、协调器、面板可见性及会话通道共 6 个测试文件、35 项通过。目标相关动作仍在选择变化时取消，断流、多接收者与超时保护保留。尚未重新打包或在真实 DSH、用户模型中复验该修复。

- 扩展 Set 浏览器回归：用仍有后续页的合成数据，在定位等待期间滚轮操作后检查自动翻页恢复，防止旧的暂停状态覆盖用户意图。
- 新增 `tests/show-lifecycle.test.ts`：针对目标为空的 show 动作，覆盖等待期间会话销毁返回 disconnected、第二接收者出现返回 ambiguous、迟到成功回执无效及其他会话不受影响。`pnpm typecheck` 通过；show 生命周期、Host/Client 模拟通道及协调器共 3 文件 10 测试通过。本项为本地测试，不替代真实 DSH 重新验收。

- 执行 pnpm build，重新生成 lib/ 中的 Host 和 Client 构建产物，使新增 Set 成员 RPC 进入 bundle；先前直接运行 bundle 测试因读取旧产物而失败，正对新产物复验。

- 验证：pnpm typecheck 和 pnpm build 通过；Set 成员 Host/读取、Set 视图、Set 浏览器+Host 通道、现有确认通道等 5 文件 41 项测试通过；重建后 tests/client-bundle.test.ts 通过。测试使用合成数据，真实 DSH 和用户模型验收仍待进行。

### RO11 MATCH 预设存储基础（进行中）

- 新增 `src/host/match-preset-store.ts`：固定 DSH profile 的插件数据目录，仅持久化规范化名称、名称摘要 ID 和 MATCH 条件；按名称创建不可覆盖的预设，使用同目录临时文件写完后创建硬链接，目标已存在返回冲突；按 ID 读取和有界分页列表，不接收路径，不保存结果、游标或凭据。读写错误只报告固定类型；列表不是快照。该内部存储尚未接入界面或 AI 工具。
- 本机 E 盘是 NTFS，隔离目录单进程探针验证硬链接目标已存在时 EEXIST 且原内容不变。Node 官方文件系统 API 及 Microsoft CreateHardLink 说明该方法的平台限制；其他文件系统、网络共享及断电持久性未验证。`pnpm typecheck` 通过；多进程冲突与异常测试正在添加。
- 新增 `tests/match-preset-store.test.ts`：覆盖 profile 隔离、名称规范化与冲突、分页、非法路径/多余字段拒绝、损坏和过大文件、预取消及多个独立 Windows 进程同名同时保存。首次 TypeScript 检查发现未使用导入并已立即删除，重新检查通过；专项测试正在执行。
- 多进程测试首次未能启动：Node 的 strip-only 测试模式不支持源码中的 TypeScript 参数属性，故不能据此判断并发行为。已调整 `tests/match-preset-store.test.ts`，由同一源码生成隔离测试模块供子进程运行，并让启动失败及时结束而非等待超时；TypeScript 检查通过，正在重测。

### 协议 11 真实 DSH 与模型子项证据

- 新增 docs/verification/readonly-ro09-protocol11-2026-11-01.md：记录隔离 DSH rc.2、DeepSeek-V41-Flash 与合成 Redis 的真实侧栏打开、Set Key/二进制成员定位、无参读取、缺失成员及筛选外定位结果，明确未使用业务数据。
- 该次测试包 SHA-256 为 274d22cc1ab0befc15f9a215c30e073195b258cf6a0aca631e976b031a5f795f，默认 prepack 60 文件、481 项测试通过；该包早于动作二次采样 Host 队列失效的后续修复，不能代替新包及完整任务验收。
- RO11 独立预设存储专项测试通过：7 项覆盖规范化冲突、固定 profile 范围、路径/多余字段拒绝、分页、损坏/超限/取消；8 个独立 Windows 进程同步竞争同名条件时，恰有 1 个成功、7 个返回冲突，最终内容完整且无测试临时文件。TypeScript 检查通过。该结果仅证明本机 E: NTFS 场景，不证明网络共享、其他文件系统或断电后的持久性；尚未接入 UI/AI。
- 复核后修改 `src/host/match-preset-store.ts`、`tests/match-preset-store.test.ts`：取消导致大量预设无法列出的 10000 目录项硬上限，分页每次扫描目录但仅保留 11 个候选且不承诺快照；严格拒绝实际非法 UTF-8，测试使用真实损坏字节并核验原文件未被修改。TypeScript 检查通过，专项测试正在执行。
- 明确限制：每页都需遍历目录，目录很大时耗时随条目增长；只在异步 I/O 间检查取消，不能保证阻塞中的单次文件系统调用立即返回。依赖可信 DSH profile 目录，`lstat` 和 `open` 不是防恶意本机替换的原子操作。硬链接成功后若用户取消或进程中断，预设可能已经保存，未来 UI/AI 接入需报告结果未知并回读，不能声称未保存。
- 修复 `src/host/match-preset-store.ts` 在空目录或不存在路径等待 I/O 时忽略取消的边界，并在 `tests/match-preset-store.test.ts` 加入开始操作后立即取消的实际文件系统回归；TypeScript 检查通过，专项测试正在执行。
- 新增 `tests/match-preset-cancellation.test.ts`：在真实硬链接成功后立即触发取消，检查已保存预设可回读，避免调用方误称未保存。紧随修改的 TypeScript 检查遇到并行 Set 工作编译错误：`tests/set-member-locate.test.ts` 引用的 `setMemberReadResultSchema` 当前未导出，已通知对应任务处理；本次预设修改未碰该共享文件。
- 协议任务修复并行的 Set 导出后确认 `pnpm typecheck` 通过；预设存储 2 个测试文件共 9 项通过，包括真实 NTFS 链接完成后立即取消且可回读、多进程同名冲突、非法 UTF-8、分页及 I/O 边界取消。该结果不代表预设已接入 DSH 界面或 AI，整项 RO11 仍未完成。

### 动作二次点查的 Host 校验（协议 12）

- 将 Hash 字段、List 下标、Set 成员定位的界面二次点查统一为 `readActionPoint`：`src/domain.ts`、`src/typert.shared.ts`、`src/typert.host.ts`、`src/typert.remote-client.ts` 定义严格协议；`src/client/HashView.tsx`、`ListView.tsx`、`SetView.tsx`、`src/client/index.ts` 只提交动作 requestId；`src/remote-service.ts` 和 `src/host/ui-action-coordinator.ts` 从可信会话内仍有效的动作取出目标与精确身份，入队前、实际命令派发前和结果返回前重新校验。普通 List 分页仍走原读取流程。
- 删除生产路径已无调用的旧 Hash 字段和 Set 成员点查 RPC，不保留兼容接口；保留 AI 输入需要的身份校验。`src/host/ai-locate-tool.ts` 将 unknown 文案改为已进入准备阶段、最终结果未知，避免声称动作已提交。
- 新增 `tests/action-point-race-gateway.test.ts`：通过真实 Typert Gateway 与受控合成 Redis 连接复现延迟取消竞态，覆盖 Hash、List、Set、跨会话与伪造 requestId、额外参数、迟到请求和正常 List 分页。更新 `tests/ui-action-coordinator.test.ts`、`tests/host-typert.test.ts`、`tests/client-bundle.test.ts`、`tests/hash-field-locate.test.ts`、`tests/set-member-locate.test.ts` 及 Hash/List/Set、Key 和并发定位浏览器测试，匹配统一协议。
- 检查结果：`pnpm typecheck` 通过；动作队列、协调器、协议、Hash/List/Set 定位及 List 视图共 7 个测试文件 46 项通过。此前适配后的 Hash/List/Set 真实 Chromium 夹具通过；这些使用合成数据和受控连接，不代表新协议包已在真实 DSH 和用户模型验收。
- 边界：只有 Host 已获知动作失效且命令尚未派发时，才能阻止该后续命令；不能撤回已经发出的命令，也不能提前获知仍在传输中的界面选择。新协议须重新构建安装并在真实 DSH 中验证。
- 修正 `src/remote-service.ts` 动作点查：独立 unary 请求取消时返回 `cancelled`，选择已失效仍返回 `stale`；`tests/action-point-race-gateway.test.ts` 在真实 Gateway + 合成受控连接中取消 unary 请求并验证不派发命令。`pnpm typecheck` 与专项 3 项通过。
- 收紧 `src/host/ui-action-coordinator.ts` 和 `src/remote-service.ts`：每个有效动作只允许领取一次界面点查，取消后不能重复领取，不同动作独立计数；派发时深拷贝动作，隔离调用方后续修改的嵌套成员身份。限制不阻止已经派发的 Redis 命令，也不把动作通道视为对恶意本机代码的隔离边界。
- 扩充 `tests/action-point-race-gateway.test.ts` 和 `tests/ui-action-coordinator.test.ts`：覆盖 Hash/List/Set 的成功、独立 unary 取消、Host 已知失效、并发及取消后重复请求，以及连续独立动作和调用方修改嵌套身份。`pnpm typecheck` 通过；Gateway、协调器和通道共 3 文件、34 项通过，使用受控合成连接，尚未在真实 DSH/模型中验收。
- 复核动作派发：生产动作是普通 JSON 身份数据，`src/host/ui-action-channel.ts` 与协调器的提交校验依赖同一个请求引用。修改 `src/host/ui-action-coordinator.ts`，对复制后的完整请求、目标和嵌套动作身份递归冻结，保留原引用身份，防止接收者或内部 `activeRequest` 查询意外改变点查和提交目标。
- `tests/ui-action-coordinator.test.ts` 新增接收者及内部查询的嵌套成员、Key、目标 DB 和版本变更尝试，并确认单次点查领取与正常回执仍可用。`pnpm typecheck` 通过；协调器、动作通道、真实 Gateway 加受控连接、AI 工具共 4 文件 39 项通过。此修复维护 Host 内部不变量，未证明存在外部可利用路径，也未替代真实 DSH 与模型验收。
- 新增 `tests/zset-locate-browser.test.ts`：使用合成 ZSet 数据、真实 Chromium 和 Host 动作通道，准备覆盖 range 页外不伪造排名、筛选外、二进制及空成员、原始 score、缓存去重、用户选择抢占与点查中断。`pnpm typecheck` 通过；ZSet UI 接口仍在开发，浏览器专项尚未运行，不代表功能或真实 DSH/模型验收完成。

### RO09 ZSet 精确成员定位（进行中）
- 更新 `src/domain.ts`、`src/typert.shared.ts` 和 `src/remote-service.ts`：协议升至 13，新增 ZSet 动作并在原一次性点查 DTO 中传递严格校验的 Redis 原始 score 文本；点查身份仍由可信会话内有效动作提供。`src/host/ai-reader.ts`、`src/host/ai-locate-tool.ts` 新增当前 Key 的只读 ZSCORE 采样工具，文本或规范 base64 二选一并使用现有预算。
- 更新 `src/host/ui-action-channel.ts`、`src/client/ui-actions.ts`、`src/client/ui-pane-presence.ts`、`src/client/index.ts` 和 `src/client/ZSetView.tsx` 类型接线，使 ZSet 动作走现有准备/发布确认。上述每组 `pnpm typecheck` 均通过；ZSet 界面实现及专项验证正在进行，尚不能视为完成。
- 修改 `src/host/match-preset-store.ts`：采用 256 个固定槽及名称哈希线性探测，使用独立 `match-preset-slots` 固定目录，创建仍以硬链接避免覆盖；满槽明确返回 full，列表及按 ID 查询每次最多检查 256 槽，读取在关闭句柄后再次检查取消。旧的未接入目录没有修改或清理。TypeScript 检查通过，容量、多进程碰撞及迟到 close 专项测试正在适配。
- 完善 `src/host/match-preset-store.ts` 的固定槽文件解析：无效或不匹配的内部 ID 统一作为存储损坏处理，不把损坏文件冒充合法输入错误；TypeScript 检查通过。
- ZSet 浏览器专项执行通过：真实 Chromium + Host 动作通道、合成点查/分页，覆盖范围外无排名、筛选外、二进制与空成员、原始 score、缓存内去重、手动选择抢占、延迟采样取消；补充刷新后恢复分页原 score 与 rank、计数不变的回归。`pnpm typecheck` 和 `tests/zset-locate-browser.test.ts` 通过；未在此测试中使用真实 Gateway、Redis 或 DSH 模型。
- 更新 `tests/match-preset-store.test.ts`：适配固定槽目录及按槽分页，增加 8 个独立进程争用两个同起始槽的不同名称、256 槽满后不改变已有预设的回归；TypeScript 检查通过，测试正在执行。
- 修改 `tests/match-preset-cancellation.test.ts`：通过受控延迟真实文件句柄关闭，分别验证 get/list 在 close 等待期间收到取消后不会返回成功；TypeScript 检查通过。固定槽上一轮两文件 11 项测试通过，新增用例正在运行。
- 固定 256 槽实现专项完成：`pnpm typecheck` 通过，2 个测试文件共 13 项通过，含独立 Windows 进程同名竞争、同起始槽不同名称并发、满槽不修改 256 条已有记录、非法 UTF-8、读取 close 等待期间取消以及硬链接成功后取消可回读。分页/按 ID 最多检查 256 槽；此前无界存储目录未被修改或删除。
- 边界：槽数仅限制正常已发布记录及每次遍历槽数，并不限制同时运行或崩溃进程留下的临时文件总量，也不保证单次 I/O 耗时。依赖受信任本机 profile 目录，不能防同权限本机进程直接替换文件；链接成功后的取消/断流需要调用方报告未知并回读。当前未接入 UI/AI，RO11 尚未完成。
- 实现 `src/client/ZSetView.tsx` 临时候选和确认：页外或筛选外成员显示独立采样行，排名为空，分数字符串及采样时间可见，不写入分页缓存；用户操作、目标变化或通道失效阻止旧动作提交，随后同身份分页或刷新替换临时样本。
- 更新 `src/typert.host.ts` 与 `tests/set-member-locate.test.ts` 的双端严格 score 字段；扩充 `tests/action-point-race-gateway.test.ts` 覆盖 ZSet 原始成员 bytes、分数、跨会话、并发领取、取消和失效；`docs/AI_READ_USAGE.md` 补充定位与两次采样的边界。
- `pnpm typecheck` 通过；真实 Gateway 配合受控合成连接及协议/通道专项 6 文件 52 项通过；`tests/zset-locate-browser.test.ts` 使用真实 Chromium 与合成读数，覆盖排名页外、筛选外、二进制/空成员、分数原文、去重、刷新、用户选择抢占和取消。真实 DSH 及用户模型尚未验证。
- 新增 `tests/zset-member-locate.test.ts`：真实 ToolRuntime 与 Host 双阶段通道配合合成 Redis 响应，覆盖二进制和空成员、原始分数、确认后无参读取、缺失成员、类型变化及非法参数。
- 独立复核发现 `ZSCORE` 后的 TYPE/PTTL 排队会使分数时间偏晚；修改 `src/host/selected-reader.ts` 在分数响应后立即记录该次采样时间，后续类型和 TTL 仍独立核验。受控时钟测试使 TTL 阶段延迟 5 秒，验证分数时间保持原采样时刻。
- 检查结果：`pnpm typecheck` 通过；ZSet 新回归及原动作/协议组合 9 文件 62 项通过，Hash/List/Set 浏览器与通道相关 6 文件 15 项通过；时间修正后 ZSet 工具和 Gateway 2 文件 14 项通过。真实 Chromium 和真实 Gateway 均使用受控合成 Redis 数据；当前协议 13 尚未在真实 DSH 和用户模型验收。

### 2026-11-01 RO11 预设存储重复身份检查

- 修改 `src/host/match-preset-store.ts`：单条读取和分页返回前都遍历最多 256 个固定槽，检测所有有效记录的 ID；出现重复 ID 时返回 `storage`，保存操作的预检查也因此拒绝在损坏状态下继续写入。分页仍是非快照，并发外部篡改期间不能保证读取到某个时刻的完整状态；该检查不改变可信目录假设。
- 修改 `tests/match-preset-store.test.ts`：实际写入跨页重复 ID（内容不同）的槽文件，核验查询、任意分页和新建操作均失败，且原文件不变；同时重新运行已有 Windows 多进程同名/哈希碰撞、容量及取消测试。
- 每次代码修改后 `pnpm typecheck` 通过；专项 `vitest` 共 2 个文件、14 项通过。满额 256 条记录分 26 页反复完整检查约 10.3 秒（本机测试结果，并非时间上限）；每页 I/O 有 256 槽数量上限，单次文件系统操作的耗时和外部篡改不受此约束。该存储尚未接入界面或 AI，不能视为 RO11 端到端完成。
- 修复 Host 动作提交门槛：`src/host/ui-action-coordinator.ts` 记录与当前动作绑定的一次点查成功，`src/remote-service.ts` 只在真实读取成功且会话、动作仍有效时标记，`src/host/ui-action-channel.ts` 仅允许 Hash/List/Set/ZSet 点查成功后准备提交；Key 和 show 继续沿用各自语义。`tests/action-point-race-gateway.test.ts` 先复现四类动作跳过、缺失和取消后仍被接受，再验证成功、跳过、缺失、权限拒绝、取消、失效及伪造发布；测试使用真实 Gateway 和受控合成 RedisLink。
- 改造 `tests/action-point-fixture.ts`、`tests/ai-locate-tool.test.ts`、`tests/list-locate.test.ts`、`tests/set-member-locate.test.ts`、`tests/zset-member-locate.test.ts`、`tests/ui-action-channel.test.ts` 及 `tests/hash-locate-browser.test.ts`、`tests/set-locate-browser.test.ts`、`tests/zset-locate-browser.test.ts`，使用实际 Host 点查配合受控连接完成动作，而非手工置位成功；Hash/List 原浏览器交互模拟测试保留，并新增真实 Host 点查集成场景。
- 修复 `src/host/ai-locate-tool.ts` 的文本身份编码：Key、Hash 字段、Set 与 ZSet 成员拒绝不配对的 UTF-16 代理项，保留合法非 BMP 文本及规范 Base64 字节。`tests/locate-unicode.test.ts` 通过真实工具注册验证四类输入；失败不向 Redis 发出点查。
- ZSet 工具描述及结果明确 `score` / `sampledAt` 属于第一次工具预采样，界面再次采样可得到不同分数和时间。`tests/zset-two-samples-browser.test.ts` 联合真实 ToolRuntime、Host 点查与 Chromium，受控夹具返回不同原始分数和时间，并核验工具结果与界面各自对应的采样。
- 检查结果：每组修改后 `pnpm typecheck` 通过；Gateway、Unicode 及双采样浏览器共 3 文件 26 项通过；四类浏览器回归 4 文件 6 项通过。上述真实 Gateway/Chromium 均使用合成 Redis，尚未完成协议 13 在真实 DSH 和用户模型中的验证。

### RO09 动作点查门控回归补充
- 修改 `tests/action-point-race-gateway.test.ts`：覆盖 Hash、List、Set、ZSet 点查成功后旧动作失效、新动作不得复用成功状态，以及成功采样后到期的提交必须拒绝；使用真实 Host/Gateway 和合成 Redis 链路，避免影响用户数据。
- 原因与影响：验证动作身份及期限边界；仅增加测试，不改变运行行为。
- 验证：正在执行 TypeScript 类型检查和专项测试。

- 类型检查首次发现网关返回值为 unknown，测试按已有消息 schema 解析，确保类型安全。
- 验证结果：pnpm typecheck 通过；Host/Gateway 专项 32 项通过，覆盖四种集合的旧动作成功状态隔离和到期拒绝。Redis 链接为合成夹具，未连接或修改用户 Redis。

### 2026-11-01 RO11 预设存储基础 Git 检查点

- 新增 `src/host/match-preset-store.ts`，在可信 DSH profile 目录内以 256 个固定槽保存名称、摘要 ID 与 MATCH 条件；使用同目录硬链接原子创建，拒绝覆盖，满槽和损坏内容明确报错。分页非快照；不保存 Redis 数据、凭据或用户指定路径。
- 新增 `tests/match-preset-store.test.ts` 和 `tests/match-preset-cancellation.test.ts`，覆盖真实 Windows 多进程同名和哈希碰撞、容量满、重复 ID、非法 UTF-8 及取消时序。以干净基线 `7be8f4a` 加上述三个文件独立验证：`pnpm typecheck` 通过，两个专项文件共 14 项通过。
- 该节点仅为 Host 内部存储，尚未接入界面和模型；正常已发布条目与单次遍历受 256 槽限制，崩溃遗留临时文件、单次 I/O 时长和外部篡改不在该限制内。RO11 整体尚未完成。

### 2026-11-01 开发协议文档校正

- 修改 `docs/DEVELOPMENT.md`：按当前 `src/domain.ts` 和 `src/typert.remote-client.ts` 将开发版协议更新为 13、20 个 RPC 方法，工具说明指向当前 AI 使用文档；发布版 v0.1.0 的历史协议说明保留。原因是开发过程已增加界面联动和动作点查，旧的协议 4、19 方法描述不再准确；影响仅为开发文档，不改变运行行为。

### 协议 13 界面动作确认夹具修正
- 修改 `tests/ui-action-confirmation-browser.test.ts`：为六种 List 动作确认场景接入真实 Host/Gateway 点查与独立合成 Redis 连接，使用实际连接目标并核验 LRANGE。
- 原因与影响：原夹具缺少协议 13 必需的点查导致六项失败；仅修复测试接线，不修改产品行为或用户 Redis。
- 验证：正在执行类型检查和浏览器专项。

- 验证结果：pnpm typecheck 通过；真实 Chromium + Host/Gateway 合成连接确认场景 6 项和点查网关回归 32 项，共 38 项通过。隐藏后已准备动作可能等待至期限后返回 unknown，此为既有状态机限制。

### RO09 Stream 消息字段精确定位（协议 14，进行中）
- 修改 `src/domain.ts`、`src/typert.shared.ts`、`src/typert.host.ts`、`src/remote-service.ts`，新增带消息 ID、字段对位置及原始字段字节的动作；UI 一次性点查返回该次完整受限消息及目标值。先检查整个 DTO 的序列化大小，再标记点查成功，超限不能提交；普通 AI 单字段读取不携带整条消息。
- 修改 `src/host/selected-reader.ts`、`src/host/ai-reader.ts`、`src/host/ai-locate-tool.ts`，以独立 `XRANGE` 采样当前 Stream Key，按零基字段对位置识别重复字段，重新点查时核对原始字段字节；只使用既有只读命令，不推进消费组。消息或字段不存在、类型变化、权限与超限保留明确结果；两次采样不是事务快照。
- 修改 `src/host/ui-action-channel.ts`、`src/client/ui-actions.ts`、`src/client/ui-pane-presence.ts`、`src/client/index.ts`、`src/client/StreamView.tsx`：消息和字段两张表都显示目标后才进入提交；页外样本独立于分页缓存，用户切换、滚动、隐藏等竞争会使旧动作失效。`docs/AI_READ_USAGE.md` 增加工具参数和边界。
- 新增 `tests/stream-locate.test.ts`、`tests/stream-locate-browser.test.ts`，并更新 `tests/set-member-locate.test.ts` 协议夹具。TypeScript 检查通过；Stream、既有动作 Gateway、单字段 AI 隐私、协议和读取器共 6 文件 113 项通过。Stream 真实 Chromium 与 Host 点查专项也已通过，所有上述 Redis 响应均为受控合成数据；协议 14 尚未在真实 DSH 和用户模型验收。
- 补充协议 14 的双端严格 codec、重复/空/二进制字段、超限响应、普通 AI 单字段不附带其他字段值的验证。Stream 独立 Host/Gateway 专项共 12 项通过；Stream、Hash、List、Set、ZSet 浏览器定位及 ZSet 双采样重跑共 6 文件 8 项通过，使用真实 Chromium 和 Host 动作路径、受控合成 RedisLink。独立代码复核未发现可证实的 Stream 门控缺陷；不代表真实 DSH、Redis 业务数据或用户模型验收。

### 2026-11-02 从用户任务重新构建只读方案

- 重写 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md`：移除旧编号和阶段串行结构，按用户提出问题、确认范围、查找目标、读取分析、回答及按需界面核对构建方案；保留数据和只读边界、成本预算、已有基础、当前未完成状态及真实 DSH/用户模型验收要求。
- 重写 `docs/DSH_AI_READONLY_TASKS.md`：将原有任务合并为开发基线、直接查询、线索查找、范围筛选、诊断、界面、连接、专业数据和交付九个节点；每个节点记录现状、工作范围、前置及验收。保留原授权能力和五类暂缓写入；历史清单可通过 Git 提交 `d6a12f8` 追溯，不继续在现行清单堆叠旧编号。
- 修改 `docs/RO21_CONNECTION_ARCHITECTURE_PLAN.md`：专题显示标题去掉旧任务编号，保留文件路径及原技术研究，避免历史引用失效。
- 原因与影响：用户要求完全重构方案，合并重复任务、不继续叠加旧编号；本轮只修改规划文档，不修改 Redis、服务或运行代码。历史验证仅对应各自记录的构建，不能冒充当前工作区验收。
- 验证：三份现行方案的相对链接、代码围栏和九个交付节点通过检查，主方案与任务清单不再使用旧任务编号；`git diff --check` 通过。`pnpm typecheck` 仍因暂停前 `src/host/ai-match-tools.ts` 第 19、40 行的两处 TS2345 失败；恢复代码工作需先修复，文档检查与本次 Git 提交单独进行。

### 2026-11-02 只读方案按用户问题重新排序

- 更新 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md`：以明确 Key 直接提问、候选发现、有界跨 Key 筛选、常见诊断和按需界面核对组织交付；保留会话隔离、预算、数据进入模型的范围、真实验收和写入暂缓边界。说明历史验收与当前构建不同，并要求每个已验证节点本地提交。
- 更新 `docs/DSH_AI_READONLY_TASKS.md`：保留 RO01—RO33 编号和历史记录，重排真实依赖及按需交付范围；新增 RO34 无选中直接读取、RO35 候选发现及歧义、RO36 有界跨 Key 筛选的交付和真实模型验收标准，记载 RO07—RO12 的部分进展及现有类型错误。
- 更新 `docs/RO21_CONNECTION_ARCHITECTURE_PLAN.md`：明确连接扩展按实际环境需求独立排期和验证，单机查询不依赖全部扩展完成；保留原有技术调研和未验证边界。
- 更新 `docs/DSH_Redis_开发路线与实施方案.md` 与 `docs/TICKET_BREAKDOWN_DRAFT.md`：标识原 29 票为历史路线并链接现行只读方案，避免旧优先级被误认为当前执行顺序；历史事实与验收原文保留。
- 将任务清单直接引用的既有 RO01—RO09 验证 Markdown 及其必要 JSON/Markdown 附件纳入本次文档提交，便于检出后追溯旧构建证据；这些记录为此前工作，不代表本轮重新执行验收。
- 原因与影响：用户要求优先围绕直接提问、发现和分析，而非强制界面选中；本轮仅重排规划，不改变 Redis、服务或运行代码，不把计划写成已经交付。
- 验证：三份现行方案的相对链接、代码围栏、RO01—RO36 标题及 W01—W05 均已检查；`git diff --check` 通过。`pnpm typecheck` 仍因暂停前 `src/host/ai-match-tools.ts` 第 19、40 行两处 TS2345 失败；这不是文档改动造成，恢复代码开发时需优先修复。本轮不以历史测试替代当前构建检查。

### 2026-11-01 Stream 动作协议文档同步

- 修改 `docs/DEVELOPMENT.md`：依据 `src/domain.ts` 将开发版协议更新为 14，RPC 方法仍为 20 个。原因是 Stream 重复字段定位扩展了动作与点查结果；影响仅为开发文档，真实 DSH 和模型验收另行记录。

## 2026-11-04：适配 DSH 0.2.1-rc.5（进行中）

- 更新 `package.json` 中的 DSH 引擎、peer 及开发依赖版本，以当前运行时的实际接口编译并消除旧版本阻止加载的问题；保留其他已有工作区修改。依赖锁文件和验证结果待更新。
- 同步将 `@deepseek-ai/cordis` 升级至 4.0.5，以满足 DSH 0.2.1-rc.5 的 peer 要求。
- 修改 `src/host/ai-match-tools.ts`：将预设和分页结果构造为普通 JSON 对象，修复原有两处 TS2345，字段和业务行为不变。
- 新增 `tests/gateway-fixture.ts`，更新四个 Gateway 测试文件以注入官方 `dsh-api-remote-access` 和 owner Peer，适配新版调用契约；`package.json`、`pnpm-lock.yaml` 加入该测试依赖。仅影响测试环境。
- `package.json` 将插件版本升为 0.1.1，用于与现有 0.1.0 安装包区分；待完整测试后打包。
- 验证：`pnpm typecheck`、构建、`pnpm peers check` 通过；完整 `pnpm test` 为 69 个文件 551 项通过，含 Chromium 及合成 Redis/Gateway 测试。
- 构建 `.scratch/dsh-redis-0.1.1.tgz`，安装至本机 DSH `web` profile；`dsh web --dump-config` 已包含 Redis 和 Git Graph，不再显示两者版本拦截。配置加载不等于真实页面、真实 Redis 或模型验收；打包包含工作区原有未提交修改。
- OPC UA 旧包仍因版本不兼容而被跳过；安装器还提示 input-plus 和 web-search 依赖不兼容。未运行前后端开发服务。

### 2026-11-04 明确 Key 和 Hash 字段的直接读取

- 修改 `src/host/ai-tools.ts` 和 `src/host/ai-reader.ts`：`redis_viewer_value` 接受明确的 Key 与 Hash 字段文本或规范 Base64 身份，复用既有只读字段 reader 和会话预算，不依赖面板选中；拒绝身份冲突、无损编码失败以及混用分页参数。
- 修改 `tests/ai-tools.test.ts`：覆盖面板不可用时直接读取、二进制字段、字段或 Key 缺失、类型不符与非法参数；复用现有合成链路，不访问用户 Redis。
- 增加读取期间连接替换的回归，确保旧目标不会向新连接派发字段读取。同步 `docs/DSH_AI_READONLY_IMPLEMENTATION_PLAN.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录现用 DSH 0.2.1-rc.5、已通过的旧错误修复和历史检查边界，避免计划错误地继续要求修复已经修好的错误。
- 新增 `scripts/smoke-ai-explicit-hash.mjs`：使用已有独立 Redis 夹具和真实 DSH ToolRuntime 验证显式字段、二进制字段、缺失状态、TTL 及数据/到期时间前后不变；夹具准备阶段的写入限定在自身实例。
- 修改 `src/host/ai-reader.ts` 和 `tests/ai-tools.test.ts`：明确解释指定 Hash 字段不存在的状态；修改 `docs/AI_READ_USAGE.md`：将明确 Key/字段的直接提问作为使用路径，并区分当前选择和旧版宿主契约。原因是让工具结果和使用说明符合新的用户任务流程；该修改后 `pnpm typecheck` 与 AI 工具 39 项专项通过。
- 原因与影响：支持用户直接询问指定对象的字段，避免必须先在界面选中；读取只使用固定只读命令，真实 DSH/模型验收待完成。
- 修改前 `pnpm check` 通过：69 个测试文件、551 项通过；直接字段读取修改后 `pnpm typecheck` 和 3 文件/60 项专项通过。独立 WSL 镜像 Redis 8.2.6 和真实 DSH ToolRuntime 专项通过，合成 Key 的 DUMP 和绝对过期时间不变，测试 Redis 已停止；这不是原生 DSH 界面与真实模型验收。

### 2026-11-04 筛选预设工具基线验证

- 新增 `tests/ai-match-tools.test.ts`：通过 DSH ToolRuntime 和独立本地资料目录验证预设列表、保存、同名冲突、无效参数以及保存后中断的未知结果和回读；测试仅使用合成条件，不连接 Redis。
- 原因与影响：暂停前的预设工具虽然已修复类型并注册，尚缺入口级行为验证；该改动只增加专项测试，不视为完整 UI 或真实模型验收。`pnpm typecheck` 通过，预设工具及存储专项 3 文件/15 项通过。

### 2026-11-04 当前开发基线检查点

- 归档此前工作区的只读 Host/Client、选择动作、预算分页、连接候选、筛选预设工具、DSH 0.2.1-rc.5 依赖及相应测试；具体文件和先前实施记录见本日志各节及此提交差异。界面动作、AI 连接和预设应用仍是进行中，不能因基线提交而称其完整交付。
- 清理 `src/client/selection-epoch.ts` 文件末尾多余空行，以通过 Git 格式检查；不改变运行逻辑。
- 验证：新增显式字段功能之前，当前工作区 `pnpm check` 通过，69 文件/551 项测试通过；新增的预设工具专项另行通过。构建基线与用户日常 DSH 已安装包不同，原生界面和真实模型必须按后续构建分别验收。此节点只提交本地，不推送；业务 Redis 未操作。
- 将暂存区精确应用到独立工作区 `.scratch/runtime/baseline-review-20261104-a` 后，类型检查、构建和基础/预设工具 2 文件 38 项测试通过；清理其中依赖目录联接时被自动审批拒绝，临时工作区与联接保留，未删除原始依赖。

### 2026-11-04 直接查询 Set 和 ZSet 成员

- 修改 `src/host/ai-reader.ts`、`src/host/ai-tools.ts`：显式指定 Key 与成员后识别 Set/ZSet 并复用精确只读 reader，返回成员存在性或分数；身份与分页互斥、类型/目标/预算均有校验，不依赖面板。
- 修改 `tests/ai-tools.test.ts`：覆盖无界面下成员读取、二进制身份、缺失、错误类型、类型变化、ACL 拒绝和非法参数；仅使用合成连接。更新 `docs/AI_READ_USAGE.md`、`docs/DSH_AI_READONLY_TASKS.md`：记录成员参数及当前完成边界。
- 新增 `scripts/smoke-ai-explicit-members.mjs`：在独立 Redis 夹具中核对二进制 Set/ZSet 成员、精确分数、缺失和数据不变，并比较扫描及写入命令计数。
- 验证：`pnpm typecheck` 和 3 文件/46 项专项通过；独立 Redis 8.2.6 与 DSH ToolRuntime 验收通过，数据不变且未发生集合扫描或写入，夹具已停止。当前构建的真实 DSH/模型验收仍待完成。

### 2026-11-04 指定范围内筛选 Hash 字段（进行中）

- 新增 `src/host/ai-hash-filter.ts`，修改 `src/host/ai-reader.ts` 和 `src/host/ai-tools.ts`：为明确 MATCH、字段和目标值的查询提供独立游标的有界筛选，每次最多检查 10 个候选，只返回匹配 Key 及状态计数；分页与预算提交复用现有机制。
- 修改 `tests/ai-tools.test.ts` 的工具注册预期。原因与影响：支持按用户指定范围查询字段值，避免把全量业务值发送模型；代码正在实现，类型和边界验证待执行，不代表真实模型验收。
- 修正 `src/host/ai-hash-filter.ts` 对续读令牌的校验：AI 自身带前缀的令牌与底层 UUID 游标分开处理，避免有效续读被共享 RPC schema 拒绝；不改变 Redis 命令范围。
- 扩充 `tests/ai-tools.test.ts`：通过合成 Redis 链路验证每批 10 个候选、跨批续读、条件绑定、独立普通扫描游标、权限失败及中途取消后的批次恢复，并检查未匹配值不会进入结果。
- 筛选结果增加字段读取的起止时间；拒绝无法无损编码的 MATCH 文本，增加空扫描页续读测试。结果仅代表分批采样，不是事务快照。
- 新增 `scripts/smoke-ai-hash-filter.mjs`：独立 Redis 夹具准备多条合成订单，校验多页匹配、缺失字段、错误类型、未匹配值不外发以及数据/写命令计数不变。更新 `docs/AI_READ_USAGE.md` 和 `docs/DSH_AI_READONLY_TASKS.md` 说明参数、预算与真实验收状态。
- 验证：`pnpm typecheck` 和 3 文件/62 项筛选及预算专项通过；独立 Redis 8.2.6 与 DSH ToolRuntime 的多页筛选通过，数据和写命令计数不变，夹具已停止。当前构建的真实 DSH/模型验收仍待完成。
- 使用说明明确单个 Redis RESP 响应上限与整次多命令查询的接收量不同，避免把模型输出预算误认为服务器读取总量。

### 2026-11-04 实际 DSH 模型验收准备

- 在当前日常 DSH Web 的独立新会话中，使用已配置 `bzkj-LLM` 发送不含业务数据的普通连接测试，模型回复“模型连接正常”；Redis 侧栏可打开且当时未连接。该结果不代表当前插件构建已经加载或完成 Redis 对话验收。
- 新增 `scripts/hold-ai-acceptance.mjs`：通过已有独立夹具准备合成订单、用户、Set 和 ZSet，等待验收完成后回读关键数据与 Key 数量并停止自己创建的 Redis；不读取或修改用户业务 Redis。脚本及实际模型工具调用待验证。
- 在日常 DSH 通过插件管理器安装并启用当前包，使用用户模型和隔离 Redis 验证显式字段、Set/ZSet 成员、缺失 Key、名称候选和两批 Hash 筛选；代表性数据及 Key 数量未变化，测试实例已停止。
- 新增 `docs/verification/user-questions-real-model-2026-11-04.md` 记录实际工具调用、环境、包哈希、已验证范围及界面动作/预算接口失败；同步更新 `docs/DSH_AI_READONLY_TASKS.md` 的状态，避免把局部通过描述成全部完成。
- 失败定位：浏览器流回执报告新增的 `redisViewer/openUiChannel` 不存在，新增预算接口返回 404；本机固定版 Typert loader 文档说明 manifest 按进程缓存。旧宿主接口清单未随包替换更新是与现象一致的原因，尚待安全重启后确认。本次未停止用户 DSH 或业务 Redis。

### Redis 适配版推送与重新安装

- 按用户要求仅处理 Redis；在独立工作区基于已提交代码更新双语 README、依赖、锁文件、CHANGELOG、更新日志及 esbuild 构建许可，保留原工作区未提交功能。
- 独立版本 `pnpm typecheck`、构建和 23 文件 219 项测试通过；提交 `d6cd51aa6074096c295756c19bd92c8af7e62ddc` 已推送到 origin/main，同时推送该分支此前已有的三个提交。
- 从该提交构建 `.scratch/artifacts/d6cd51a/dsh-redis-0.1.1.tgz`，重新安装到 DSH web profile；回读版本 0.1.1、引擎 0.2.1-rc.5，客户端文件哈希与构建一致，配置包含 Redis。真实 DSH 页面、真实 Redis 和模型尚未验收。
- 原工作区保留在原提交及未提交修改；推送版在独立工作区，避免覆盖现有工作。
### 2026-11-05 真实选区竞争与预算验证

- 更新 `docs/verification/user-questions-real-model-2026-11-05.md`：记录真实模型在选区变化后绕过选区读取失败、使用旧字段显式读取并误称当前选区的问题；记录预算耗尽拒绝及界面手动恢复的实际结果，不记录业务 Key、字段和值。
- 更新 `docs/DSH_AI_READONLY_TASKS.md`：将真实选区竞争明确标为未通过，避免将正常界面动作回执误认为完整的选区安全验收。
- 原因与影响：准确保留真实 DSH、用户模型和用户 Redis 验证边界，供后续针对性修复；本次只更新文档，不修改 Redis 数据或运行逻辑。
- 补充 `docs/verification/user-questions-real-model-2026-11-05.md`：记录真实客户端明细工具调用及模型未经工具证实地归属连接的问题，诊断回答仍未通过；不记录业务数据。
- 补充 `docs/verification/user-questions-real-model-2026-11-05.md`：记录真实 Hash 的 Stream 消费组不支持边界，模型正确报告类型；未据此宣称真实 Stream 或完整诊断已验收。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录两个真实 DSH 会话连接同一本机 Redis 后的 DB 切换隔离，以及当前源码 `4175196` 的完整检查结果；不扩大到断开或其他拓扑。
- 验证：`pnpm check` 通过，79 个测试文件、619 项测试通过；业务 Redis 未写入，模型回答准确性和选区竞争仍未通过。
- 修改 `src/connection-errors.ts` 和 `src/host/ai-locate-tool.ts`：统一中英文缺失 Key 提示为采样时不存在，定位工具复用同一提示，避免从单次缺失推断历史或过期原因；只修改结果说明，不改变 Redis 命令。类型检查、3 个文件的 79 项相关测试通过，新构建及真实 DSH 复验待进行。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录源码 `8981f5e` 开发包安装到日常 profile、135 文件与包一致，以及重启后真实模型对未写入测试名称的缺失 Key 提示复验通过；明确其他真实模型问题未解决。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md`：记录新构建通过日常 DSH、用户模型及真实 Redis 的一个显式 Hash 单字段复验；不记录业务身份或值。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md`：记录收起侧栏后同一真实字段仍可通过显式参数读取及回答；不推及未测试的数据类型。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md`：记录线索不足时模型未擅自搜索，但错误声称 MATCH 可避免全库遍历；回答准确性仍未通过。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录源码 `8981f5e` 的完整 `pnpm check` 通过，共 79 个测试文件、619 项；自动测试通过不等于真实模型准确性通过。

### 2026-11-05 移除侧栏常驻 AI 读取预算

- 修改 `src/client/RedisWorkspace.tsx` 和 `src/client/locales.ts`：移除侧栏常驻的预算标题、调用次数和结果字节；在现有插件信息中仅当预算耗尽或状态查询失败时显示恢复操作。
- 修改 `src/host/ai-reader.ts` 与 `tests/ai-tools.test.ts`：预算耗尽时引导用户打开插件信息恢复读取，避免提示不存在的界面入口。保留原有会话预算和用户手动恢复机制，不改变 Redis 数据操作。
- 修改 `tests/workspace-visibility-browser.test.ts`：在真实浏览器夹具中验证常驻区域消失、正常状态无恢复按钮，以及额度耗尽后从插件信息恢复。
- 原因与影响：按用户要求简化侧栏，同时避免达到读取上限后无法继续。关闭或重挂插件信息时取消并释放未完成的状态请求。
- 验证：类型检查通过；三个测试文件共 79 项通过，包含真实 Chromium 夹具中常态隐藏和耗尽后恢复的交互。源码提交 `dddc8b0` 已构建并安装日常 `web` profile，安装的 Client 与构建哈希一致；重启日常 DSH 后在真实页面确认常驻区域消失、插件信息可打开，并重新连接本机 Redis。未耗尽真实会话额度，真实耗尽恢复未在此次重测。

### 2026-11-05 明确 SCAN 的实际扫描范围

- 修改 `src/host/key-reader.ts`、`src/host/ai-key-pages.ts`、`src/host/ai-hash-filter.ts`：名称搜索和 Hash 筛选结果附带 SCAN 的实际键空间、MATCH 过滤对象、COUNT 提示及完整遍历可能覆盖整个当前 DB 的结构化说明；命令仍使用原有只读 SCAN，候选数量限制不变。
- 修改 `src/host/ai-tools.ts`、`docs/AI_READ_USAGE.md`、`tests/ai-tools.test.ts`：依据 Redis 官方 SCAN 文档说明 MATCH 和 COUNT 的语义，并验证搜索及筛选的结果证据。原因是实际模型此前误称 MATCH 可避免全库遍历；新增证据不保证模型一定遵循，仍需真实模型复验。
- 验证：`pnpm typecheck` 通过；名称搜索、Hash 筛选和分页存储的 3 个测试文件共 82 项通过，覆盖空页续读及大批次边界；尚待实际 DSH 和用户模型复验，不修改用户 Redis 数据。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录 `a86a8fc` 开发包安装、135 文件核对及真实 Redis 上名称搜索和 Hash 筛选的首批模型结果。模型正确说明 MATCH 不保证避开当前 DB 键空间，但仍对负载和完整迭代保证作错误断言，准确性未通过。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录 `a86a8fc` 完整检查 79 文件、619 项通过，以及真实模型断开一个独立会话后另一会话仍连接 DB0；切回后出现选区同步提示且重试未恢复，需继续诊断。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 和 `docs/DSH_AI_READONLY_TASKS.md`：记录真实 DSH 中 Chrome 与内置浏览器同时打开同一会话造成选区冲突的对照，以及错开会话并重试后的恢复；真实模型对一个稳定选区的读取与面板一致。原因是修正此前未识别多接收端的验收记录；影响仅为明确实际验证范围，不改变代码或 Redis 数据，选区切换竞争仍未通过。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md`：记录真实模型在本机 Redis 上跨 12 次工具调用完成一次自然语言前缀搜索，以及模型误报批次数、未交代扫描一致性限制；记录 200 个 Key 的有界类型抽样全为 Hash，但不推断未抽样部分。原因是保留实际验收结果和限制；仅执行只读命令，不改变业务数据或代码。
- 扩充 `tests/ui-session-channel.test.ts`：建立页面隐藏和重新显示的会话通道与真实宿主接收者协调回归，检查隐藏页面不占用接收端、显示页面仍保留冲突保护；原因是排查多浏览器下的选区同步问题。本次只添加测试，不改变运行逻辑或 Redis 数据，正在验证测试能否复现。
- 修改 `src/client/index.ts`：浏览器页面隐藏时关闭本页面的会话动作通道，重新显示时按当前会话及连接代次重建，并移除监听器；调整测试的模拟文档以支持可见性事件。原因是受控回归已证明隐藏页面仍占用接收端；不会更改 Redis 连接或数据，双可见页面仍须避免误认唯一接收端。真实 DSH 验证尚待完成。
- 修改 `tests/client-bundle.test.ts`：为打包客户端测试提供标准可见性事件，并核验卸载移除监听器。首次完整检查中 619 项通过、该测试因模拟文档缺少事件接口失败；本次仅修正测试夹具，修正后仍需重跑检查。
- 验证：修正测试夹具后，客户端包及会话通道专项 6 项通过；`pnpm pack` 的完整类型检查、构建与测试通过，共 79 个文件、620 项。开发包已生成，尚未安装或在真实 DSH 中复验。
- 更新 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md`：记录源码 `04c7768` 开发包安装到日常 DSH、包的 135 个文件与安装一致、真实模型稳定选区读取及未经证实的额外业务推断；记录两个可见页面的冲突和关闭临时页后的恢复。原因是避免把模拟隐藏事件误当成真实后台页验收；真实后台释放与模型回答准确性仍待验证。本次未修改 Redis 数据。

### 2026-11-05 修正选中值的采样时间

- 新增 `tests/selected-sampling-time.test.ts`：用受控时钟和合成连接检查 Hash、Set、ZSet、List 的精确读取时间及后续元数据延迟，分别覆盖值存在和不存在；原因是排查采样时间是否被后续检查推迟。本次仅增加回归测试，不操作用户 Redis，正在验证是否复现。
- 修改 `src/host/selected-reader.ts` 和 `src/host/list-reader.ts`：将 Hash/Set/ZSet 精确成员读取与 List 页的采样时间绑定到对应 Redis 读取响应，并将 List 页时间传递给选中行；类型变化或读取失败仍按实际最终状态报告。更新 `docs/AI_READ_USAGE.md` 说明 TTL 和其他元数据的采样时刻可能不同。原因是受控时钟测试复现后续 TTL 查询延迟导致采样时间偏晚；不改变 Redis 命令、值或数据，修正后仍待验证。
- 验证：类型检查通过；采样时间、Hash/Set/ZSet/List 定位、List 读取和 AI 工具共 7 个专项文件、99 项通过。测试使用合成连接；完整打包和真实 DSH、本机 Redis 验证仍待执行。
- 完整打包验证：`pnpm pack` 自动执行类型检查、构建和全部测试，80 个测试文件、624 项通过；开发包已生成，真实 DSH 与本机 Redis 复验仍待执行。
- 更新 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md`：记录源码 `fd3fb91` 开发包安装日常 DSH、135 个文件与包一致，以及真实模型对本机 Hash 字段读取时值、状态和 UTC 时间与工具返回一致。原因是明确实际验收与受控延迟测试边界；没有在用户 Redis 人为制造延迟或修改数据，其他类型与模型准确性不据此标为通过。
- 更新 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md`：记录真实 DSH、用户模型与本机 Redis 的 12 批完整筛选，逐批核对检查和匹配数、扫描完成与非快照说明；模型的命令说明遗漏类型和 TTL 检查。原因是保存可核验结果并保留回答准确性缺口；未修改业务数据，异常和并发未覆盖。

### 2026-11-05 慢日志时间转换

- 扩充 `tests/ai-tools.test.ts`：覆盖慢日志事件 Unix 秒到 UTC 的正常值、日期范围边界、超范围保留原值及诊断报告回读。原因是真实模型正确复述时间戳但错误换算本地时间；当前仅新增测试，使用合成数据，未更改 Redis 或生产逻辑。
- 修改 `src/host/ai-reader.ts`、`src/host/ai-report-samples.ts`、`src/host/ai-tools.ts` 和 `docs/AI_READ_USAGE.md`：慢日志结果及报告增加由原始 Unix 秒转换的 UTC 事件时间，日期超范围时保留秒数并返回空时间；明确事件时间与本次查询时间不同。原因是减少模型自行换算错误；不修改 Redis 命令或暴露日志参数，无法保证模型一定正确解释，专项及真实模型验证待执行。
- 验证：类型检查通过；AI 工具、报告和预算共 3 个文件、80 项测试通过，覆盖正常时间、日期最大范围、超范围及原始秒数保留。真实模型与当前包的完整打包检查仍待执行。
- 完整打包验证：`pnpm pack` 的类型检查、构建及全部回归通过，共 80 个测试文件、625 项；开发包已生成，真实 DSH 和模型复验仍待执行。
- 更新 `docs/DSH_AI_READONLY_TASKS.md` 和 `docs/verification/user-questions-real-model-2026-11-05.md`：记录源码 `7b23e68` 开发包已安装日常 DSH、135 文件与包一致；真实模型复验同一条本机慢日志时 UTC 和北京时间换算正确，但额外作了无工具依据的日志“过期”描述。原因是保留时间修正和模型准确性的独立边界；未清理日志或修改 Redis 配置。

### 2026-11-05 RedisJSON 单路径只读查询（进行中）

- `src/host/redis-transport.ts`：仅放行单 Key、单 JSONPath 的 `JSON.GET`，拒绝格式选项、多个路径及写命令。
- `src/host/ai-tools.ts`、`src/host/ai-reader.ts`：新增明确指定 Key 和路径的 AI 查询，保留 Redis 原始 JSON 数字文本，区分无匹配、JSON null、缺失、类型不符、模块不可用、权限和查询失败；读取继续受现有超时、连接代次和结果预算约束。
- `tests/ai-tools.test.ts`、`tests/redis-transport.test.ts`：覆盖精度、空匹配、参数边界和错误分支，并将新工具纳入模型 schema 注册清单。复测 97 项通过；读取类型变化时的二次检查也保留真实错误。
- `scripts/smoke-ai-json-path.mjs`：新增只在独立 RedisJSON 实例写入合成样本的集成检查，比较注册工具与真实命令的结果及 ACL，并核对数据和过期时间未被读取操作改变。首轮发现真实 RedisJSON 对非 JSON 类型返回 `Existing key has wrong Redis type`，已按实测修正分类及测试；独立实例复验通过，真实 DSH 模型验收仍待完成。
- `docs/AI_READ_USAGE.md`、`docs/DSH_AI_READONLY_TASKS.md`：说明 JSONPath 的数组语义、无服务端分页与大小限制，并记录当前验收状态。独立 Redis 8.2.6 RedisJSON 集成检查复验通过，数据和 TTL 不变；本机 Redis 8.10.0 未提供 JSON.GET，工具实测返回不可用且连接保持正常。日常 DSH 的 HZ-bzkj-LLM 普通消息重试五次仍返回上游 HTTP 500，因此真实模型验收待完成。
- 完整检查：`pnpm check` 通过，80 个测试文件、634 项测试；`git diff --check` 无空白错误。本次仅完成代码和已列范围的验证，真实 DSH 模型及未覆盖场景仍待验收。
- 提交 `9c351a9` 后按 `code-review` 规范和需求双轴独立只读审查，两者均发现 `NOAUTH` 会被错误报告成路径查询失败。修正 `src/host/ai-reader.ts` 优先复用认证、权限和中断错误分类，调整其他服务端拒绝的通用说明；`tests/ai-tools.test.ts` 新增认证失效及敏感错误文本不泄露验证。原因是准确区分连接认证与路径问题，不改变查询或 Redis 数据。
- 提交 `b05d8f6` 后的规范复审发现通用认证匹配可能命中错误正文中的 `author` 等 Key 或路径。`src/host/ai-reader.ts` 改为仅识别 Redis 错误码前缀；`tests/ai-tools.test.ts` 增加未知命令和路径错误含 `author` 的回归。原因是让认证与功能不可用保持正确区分，且不暴露原始错误。

### 2026-11-05 TimeSeries 有界范围查询（进行中）

- `src/host/redis-transport.ts`、`src/host/ai-reader.ts`、`src/host/ai-tools.ts`：增加只读 `TS.RANGE`，要求明确 Key 与有限的毫秒起止时间，每批最多返回 100 个原始样本，多取一条判断是否还有后续；保留数值文本、续读起点和非快照说明。固定命令形态，不开放聚合或写入；模块缺失、类型、权限和错误分开报告。
- 依据 Redis 官方文档及隔离 Redis 8.2.6 模块实测的 `TSDB-TYPE`、RESP 样本格式和缺失/类型错误实施；编译、测试及真实 DSH 模型验收均待执行。
- `tests/ai-tools.test.ts`、`tests/redis-transport.test.ts`：新增分页边界、精确样本、无模块、权限和错误响应专项，并验证拒绝超范围参数、聚合选项及写命令；类型检查和相关 100 项测试通过。
- `scripts/smoke-ai-timeseries.mjs`：新增独立 RedisTimeSeries 样本、续读、空范围、类型和 ACL 对照，真实 Redis 8.2.6 模块专项通过，采样前后序列及 TTL 一致。本机 Redis 8.10.0 实测无 TS.RANGE，工具返回不可用且连接仍正常。
- `docs/AI_READ_USAGE.md`、`docs/DSH_AI_READONLY_TASKS.md`：说明时间戳范围、每批上限、非快照和压缩序列限制，并将真实模块对照、用户 Redis 缺少模块及日常模型上游 HTTP 500 的验收边界写入清单。
- 完整检查：`pnpm check` 通过，80 个测试文件、637 项测试；当前真实模型验收仍未完成，测试通过不等同于模型回答准确。
- 提交 `3932927` 后需求审查指出续读未绑定连接与条件，压缩序列范围提示不充分。`src/host/ai-reader.ts` 复用现有提交后生效的分页存储生成不透明游标，绑定会话、连接代次、DB、Key、起止和数量；`src/host/ai-tools.ts` 明示压缩序列可能省略未闭合桶或包含结束时间后的原始样本。原因是防止跨目标混用页面及夸大覆盖范围；首次类型检查指出可选数量不能显式传 `undefined`，已修复，相关验证待补充。
- `tests/ai-tools.test.ts` 补充更换 Key、范围、数量、会话、DB 和连接后续读拒绝；`scripts/smoke-ai-timeseries.mjs` 增加真实压缩规则和桶范围对照；`docs/AI_READ_USAGE.md` 同步游标与压缩语义。隔离 Redis 8.2.6 中确认默认查询省略未闭合桶且已闭合桶可包含结束时间之后的样本，数据与 TTL 不变；类型检查及相关 104 项测试通过。
- 提交 `8fa8abd` 后规范审查指出失败状态也会 `complete: false` 但没有游标。`src/host/ai-tools.ts` 与 `docs/AI_READ_USAGE.md` 改为仅成功且游标非空时续读；`tests/ai-tools.test.ts` 核对缺失及类型不符均无游标。原因是避免模型把失败当成可续读结果反复请求。
- 同次需求审查指出第二页失败后旧游标失效但没有恢复说明。沿用既有分页组件的终止行为，在 `src/host/ai-reader.ts` 明确返回从原范围重新查询的提示，工具与文档同步说明；新增失败页和旧游标失效测试，避免虚假的续读承诺。
- 提交 `3c91d39` 后双轴复审指出取消或异常未交付结果时游标可能保留，原文字过于绝对。`src/host/ai-tools.ts` 和 `docs/AI_READ_USAGE.md` 将失效范围限定为收到非成功状态，取消或无回执标明状态不确定；`tests/ai-tools.test.ts` 验证请求中取消后可用原游标重试。原因是准确反映提交边界，不改变分页组件行为。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 与 `docs/DSH_AI_READONLY_TASKS.md`：记录源码 `8f57a61` 的完整检查首次超时、单项及整套复跑结果；归档哈希、安装文件对照；当前 `bzkj-LLM` 对本机模块缺失和隔离 JSON、TimeSeries、GEO 的实际工具输出与回答错误；并记录重启 DSH 中断一条正在执行的请求、随后恢复本机 Redis 连接。原因是区分工具数值通过与模型解释未通过，保留操作影响和未覆盖项；未写入用户 Redis。
- `src/host/ai-reader.ts`、`src/host/ai-tools.ts`、`docs/AI_READ_USAGE.md`：时间序列样本补充由原始毫秒确定性换算的 UTC 时间，超出 JavaScript 日期范围时返回 null 并保留原始值；`tests/ai-tools.test.ts` 和 `scripts/smoke-ai-timeseries.mjs` 覆盖纪元、范围边界及压缩桶。原因是真实模型将 0–3000 毫秒的纪元含义解释错误，提供可核对的时间证据；模型回答是否改善仍需真实复验。
- UTC 时间字段验证：类型检查、86 项相关测试及隔离 RedisTimeSeries 真模块对照通过；测试实例已停止，独立夹具数据与过期时间未变。真实 DSH 与模型尚未复验该字段。
- 更新 `docs/verification/user-questions-real-model-2026-11-05.md` 与 `docs/DSH_AI_READONLY_TASKS.md`：记录源码 `53bd92e` 的包哈希、日常安装对照、完整检查中浏览器测试超时及其单独复跑；真实 DSH、`bzkj-LLM`、独立 Redis 的两批时间序列复验中，模型正确复述三个 UTC 时间及非快照和压缩桶限制。原因是区分当前构建的局部修正与仍未通过的完整检查及其他验收；隔离数据未变且实例已停止，本机 Redis 会话已恢复。
- 提交 `83cd642` 后双轴只读审查发现验收记录中旧版 `8f57a61` 仍称“当前构建”。修正 `docs/verification/user-questions-real-model-2026-11-05.md` 为当时构建、曾安装，并明确本机模块缺失结果所属版本，避免将旧验收扩大为新版证据。

### 2026-11-05 单 Key 内存估算语义（进行中）

- 在真实 DSH、`bzkj-LLM` 和本机 Redis 对服务器概况及单 Key 内存估算做只读复验。工具原始值与模型列出的字节、连接数一致，但模型将 MiB 换算标成 MB，并把 `SAMPLES 5` 说成必定采样五个元素、笼统排除分配器碎片；整体诊断解释未通过。
- `src/host/ai-reader.ts`、`src/host/ai-tools.ts`、`src/host/ai-report-samples.ts`：将含糊的 `samples` 改为 `requestedSamples`、`actualSamples: null`，明确 Redis 未提供实际数量或误差，且 Key 分配开销可能包含内部碎片；诊断报告同步保存结构化参数。依据 Redis 官方 MEMORY USAGE 文档，目的是避免把命令参数当作实际样本证据；不改变 Redis 查询。
- `tests/ai-tools.test.ts`、`scripts/smoke-ai-memory.mjs`、`docs/AI_READ_USAGE.md` 同步验证及说明，并检查诊断报告保留新的结构化参数；类型检查、84 项专项及隔离 Redis 真命令对照通过，隔离数据和 TTL 未变；真实模型复验待执行。
- `docs/verification/user-questions-real-model-2026-11-05.md` 记录当前已安装构建的两项真实诊断：工具原值复述一致，但单位标记、实际采样数和碎片解释不准确。原因是保留模型推断错误和工具采样证据的区别，不将本机业务身份或指标写入仓库。
- 提交 `81cf8de` 后需求审查建议让保存的报告脱离对话也可理解。`src/host/ai-report-samples.ts` 用固定字面量白名单保留两条采样及范围说明，`src/host/ai-reader.ts` 复用同一说明，`tests/ai-tools.test.ts` 回读确认并拒绝替换为自由文本；类型检查及首轮 84 项测试通过，新增拒绝测试后需复测。
## 2026-11-06：实现查找、读取后的本轮答案收束

- 原因：真实读取结果正确，但模型自由补充了未经证实的历史、数值或范围；用户要求直接完成查询到回答链路。按最简、单一职责原则新增独立最终回答工具，普通读取继续支持后续查询。
- 文件：`src/host/ai-answer.ts` 订阅 DSH 已提交会话事件，自动引用本轮、同会话、同连接代次和 DB 的读取记录，限制记录及答案大小；答案准备成功后调用正式 `concludeTurn()`。真实模型首轮暴露内部调用 ID 不可可靠填写，因此移除该参数，改由 Host 自动绑定，不以补提示词让模型猜 ID。不另建查询、游标或聊天系统。
- 文件：`src/redis-answer.ts` 从实际记录生成中文事实、原值、TTL 与覆盖解释，保留 JSON 原文和精确数值；`src/redis-read-tools.ts` 统一读取工具目录，`src/client/tool-evidence.ts` 移出目录常量，`src/runtime.ts` 注册最终回答工具，`src/host/ai-tools.ts` 补充工作流入口提示。
- 文件：`src/client/RedisToolEvidence.tsx`、`src/client/tool-evidence-locales.ts` 展示最终文字和原值，沿用原生工具视图和 React 文本转义；`tsconfig.client.json` 加入共享文件。`tests/ai-answer.test.ts` 覆盖实际 reader/ToolRuntime/SessionStore 串联、旧引用、切库重连、取消及精度边界。
- 源码依据：重新对照临时目录中 RedisVL `merge_locked_filter` 与 futuretea `continueScan`/`takeScanItems`，保留现有服务端范围确认和 surplus 分页；本轮新增的是 DSH 答案记录绑定，没有复制 SSPL 代码。
- 文件：`tests/client-bundle.test.ts` 验证实际打包视图和文本转义；`docs/AI_READ_USAGE.md`、`docs/DEVELOPMENT.md` 更新调用方式、33 个工具和最终回答边界。严格类型、构建及 125 项相关回归通过；无参数简化后类型与 7 项受影响回归通过。真实 bzkj-LLM + Redis 8.2.6 + 产品 ToolRuntime/SessionStore/reader 的两轮通过：status→keys→value→answer，以及 key_metadata→answer；合成数据及数量不变，所属 Redis 已停止。临时证据 `dsh-redis-answer-20261106/model-flow-v2.json` 保留首轮失败与修复后结果；本项不是 DSH Web/AgentLoop 验收，日常安装尚未更新。
