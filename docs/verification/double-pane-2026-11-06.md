# 双面板歧义、恢复与隐藏刷新实测

日期：2026-11-06。工作区起点 `445efcd`，沿用日常 DSH Web 已安装应用源码 `622dce6`，包及安装一致性见[既有记录](intent-and-rejection-2026-11-06.md)。本轮没有替换包、修改产品代码、依赖或模型配置。

## 结果与范围

在真实 DSH / `bzkj-LLM` 的一个新只读会话中，通过原生“分栏”同时显示两个 Redis 面板。选区读取与刷新被拒绝，打开动作返回 `ambiguous`；关闭第二个面板后恢复选区读取和一次刷新；随后收起侧栏再次刷新被拒绝。模型没有把这些失败说成成功，没有改用历史 Key 读取或自动重试。

这是**同一浏览器、同一会话内两个面板**的验收，覆盖 `UiPanePresence` 的非唯一面板判断，不是两个浏览器注册两个 Host 接收端的验证。隐藏场景是收起侧栏，不是浏览器后台标签、网络断流、超时或丢失回执。这些剩余场景与完整节点 4 仍未完成。

## 实际过程与原始结果

- 复用 `scripts/hold-ai-acceptance.mjs`，`REDIS_TEST_BACKEND=wsl-image`，仅本任务所属回环实例 `127.0.0.1:1908`，22 个合成 Key；无保存资料、无密码。手动连接 DB0 并选择 `fixture:string`，不连接业务 Redis。
- 原生分栏后，左面板保留 String 选择，右面板无 Key 选择，两个面板都显示“当前选择未能同步”。截图确认它们同时可见；临时 1920×1080 视口用于同时操作聊天和双面板，结束已恢复默认。
- 请求读取当前选择后刷新一次，禁止历史目标回退、扫描和重试。`03:41:13.165Z` 状态为 `selectionSync=unavailable`、`currentSelection=null`。随后 value 和 refresh 均返回“侧栏选择正在变化或界面不可用，请在当前对话打开唯一 Redis 面板并重试。”模型正确说明无法确认选中值和刷新结果。它在状态不可用后仍各尝试了一次工具，因此只确认阻断和结果表达，不称所有交互都已最简。
- 另请求只打开一次面板，真实 `redis_viewer_show {}` 返回 `{"outcome":"ambiguous","message":"当前对话有多个可接收的界面，请只保留一个后重试。"}`。模型区分 ambiguous 与 applied，没有宣称已打开或重试；这里“多个可接收的界面”是固定消息，不能反推存在两个 Host 通道。
- 窄侧栏第一次关闭按钮操作未移除面板，经 DOM 与截图复核后全屏操作，确认第二个标签实际消失。唯一面板的同步提示自动消失，没有点击“重试同步”或重新选 Key。`03:43:45.539Z` 状态恢复 `synchronized`，仍是相同连接 ID / generation=5 / DB0，选区记录时间仍为 `03:40:31.685Z`。
- 恢复后的 value 返回 `source=selection`，`fixture:string` 的值为 `synthetic-string-value`，22 字节、complete=true、TTL=-1，值采样时间 `03:43:46.411Z`。这些值与原生读取卡片及夹具内容一致。`redis_viewer_refresh {}` 返回 `applied`，面板最近读取更新为 11:43:46（UTC+8），内容可见且自动刷新关闭。模型这轮区分了选择记录时间和值采样时间，没有把 TTL 推断为历史状态。
- 手动收起侧栏后，请求仅刷新一次且不要展开。实际只出现一次 refresh，参数 `{}`，返回上述选区/界面不可用错误；侧栏保持隐藏，模型未称 applied、未读历史值或重试。模型将失败归于界面侧；结果本身只能证明选择/界面前置条件不可用，不用于排除所有其他根因。

以上 UTC 时间来自原始结果。手动连接和显示面板会加载 Key 名称，不能将“模型没有调用名称扫描工具”扩大为整个插件没有 SCAN。模型正文和标题仍可出现 think 标签，正常工具调用不等于显示问题或一般回答准确性已解决。

## 检查、证据与清理

`node node_modules/vitest/vitest.mjs run tests/ui-pane-presence.test.ts tests/ui-action-coordinator.test.ts tests/ui-session-channel.test.ts`：3 文件 / 20 项通过，2.23 秒。它们包含受控通道和协调器用例，不能替代尚未完成的真实跨浏览器、断流或回执丢失验收。

手动断开后，夹具对全部 22 个 Key 的 DUMP、PEXPIRETIME 和 DB0 数量断言通过，返回 `fixtureDataUnchanged=true`、`fixtureStopped=true`，进程退出 0；1908 不再监听，日常 DSH 3080 / PID10476 保留。本轮只补文档，执行 diff 检查，不重复未改应用代码的编译、完整测试或打包。

临时证据：`C:/Users/admin/AppData/Local/Temp/dsh-redis-double-pane-20261106/`。`dual-dom.txt` / `dual-cards.json` 为双面板失败，`ambiguous-dom.txt` 为打开动作歧义，`recovered-dom.txt` / `recovered-cards.json` 为恢复后的状态和值及刷新回执，`hidden-dom.txt` 为隐藏刷新失败。`two-visible.png`、`recovered.png`、`hidden.png` 分别保留实际界面。仅合成数据，临时证据不随发布包分发。
