# 选区竞态与模型文本显示核对

日期：2026-11-06。源码基线 `df80ccc`；沿用已安装应用源码 `4f7ffd4`，本轮没有改应用代码、重新打包或重启日常 DSH。安装哈希及全量检查沿用 [筛选条件验收](filter-condition-2026-11-06.md)，不计为本轮重测。

## 结论

- 当前安装版本在真实 DSH Web / `bzkj-LLM` 中完成稳定 Hash 字段、发送后切换字段、隐藏侧栏、连续切换造成拒绝后重读四项局部核对。此次未出现旧字段显式读取冒充当前选区。
- 连续切换确实触发一次选区确认拒绝；后续重读仍使用选区来源。模型保留了变化限制，但把选区记录时间称为实际读取时间，因此完整回答精度仍未通过。
- `<think>` 标题及正文问题在没有 Redis 工具调用的纯文本对话中也能复现，不能归为 Redis reader 缺陷。已安装适配器的离线合成响应证实：独立 reasoning 字段能拆分，正文内标签不会被拆分；尚未取得真实模型服务的原始响应，不能直接断言服务端具体字段或配置错误。
- 47 项现有选区专项通过；不代替所有类型、真实多接收端、丢回执、流中断、取消及超时验收。节点 4 和完整交付仍保持部分完成。

## 环境与数据边界

日常 DSH Web 使用原有 `bzkj-LLM`，新建只读验收会话。最初两轮仅做纯文本验证，未连接 Redis，轨迹无工具调用。随后只打开 Redis 面板，并通过本地表单连接所属隔离 Redis 8.2.6；没有连接用户业务 Redis，也没有修改模型配置。

夹具使用 `scripts/hold-ai-acceptance.mjs` 默认 22 条合成 Key，`REDIS_TEST_BACKEND=wsl-image`，本次端口 `7346`。目标 Hash `fixture:user:123` 含 `name=synthetic-user`、`status=synthetic-active`。自动刷新保持关闭。连接会触发侧栏的名称/DB 信息加载，手动选 Key 会读取其 Hash 页面，不能将本轮描述为所有 UI 读取都仅限单字段。

第一次未分配交互终端时，夹具在端口 `7239` 就绪后因 stdin 关闭退出；未用于验收，其 finally 清理完成，之后核对无该端口监听。第二次使用交互终端持有 `7346` 完成以下验证。结束时先在界面断开，再让夹具校验全部 22 条 Key 的 DUMP、PEXPIRETIME 和 DBSIZE；返回 `fixtureDataUnchanged: true`、`fixtureStopped: true`。

## 原生选区验证

四轮使用相同自然语言请求“读取并解释当前侧栏选中的字段”，没有在请求中指定 Key 或字段，也没有告诉模型应选择哪个工具。轨迹中的所有 `redis_viewer_value` 参数均为 `{}`。

| 场景 | 实际调用与结果 | 本轮判断 |
| --- | --- | --- |
| 稳定选择 name | status 确认同步；value 返回 `source=selection`，字段 name，值 synthetic-user，14 字节 | 目标、值和来源一致 |
| 发送后立即改选 status | 新状态记录字段 status；value 返回 synthetic-active，16 字节 | 读到新字段；没有把上一轮 name 当当前值 |
| 发送后收起侧栏 | 仅 status 调用；`selectionSync=unavailable`、`currentSelection=null` | 模型说明无法确认，未调用 value，也未从历史字段回退读取 |
| 恢复面板后连续 12 次交替选择 name/status | 首次 value 拒绝；两次 status 分别为 unavailable、同步 name；最后 value 重新确认并读取 status | 拒绝不是成功；恢复后的值仍为 selection 来源，没有显式目标回退 |

最后一轮关键 UTC 时间及结果：

1. `01:23:25.925Z`：状态结果同步，记录的选区为 status。
2. `01:23:26.407Z`：轨迹记录 value 调用开始，参数 `{}`，7 ms 后失败；错误为“侧栏选择正在变化或界面不可用，请在当前对话打开唯一 Redis 面板并重试。”
3. `01:23:27.648Z`：状态 unavailable，没有公开有效选区。
4. `01:23:28.126Z`：状态恢复同步，记录的选区为 name，选区自身时间 `01:23:27.929Z`。
5. 最后 value 返回 status 的 synthetic-active；`selected.sampledAt=01:23:28.835Z`，`value.sampledAt=01:23:29.291Z`，两者含义不同。模型最终正确区分“那次读取所确认的选区”和之后的界面选择，却把前者时间在表格中标成“实际读取时”。该精度问题保留为未通过，不能将两种时间合并。

这些是实际手动交错所触发的一次拒绝与恢复，不是所有时序的保证。此次选择反复变化由验收点击主动造成，不证明插件自行抖动，也不证明历史显式回退风险在其他对话中彻底消失。

## 模型文本显示的最小复现与源码依据

在打开 Redis 面板前的新会话中：

1. 请求只回复“显示正常”，回复正文正常，但会话标题变为 `<think>`。
2. 请求不用工具计算 `137 × 29`，正文包含 `<think>` / `</think>` 标签，结果为 3973；无工具调用。

当前 profile 的安全白名单检查只确认此模型使用 `openai-completions`，模型条目没有声明 reasoningEfforts；未记录密钥、私有服务地址或原始 profile。未读取 DSH 启动日志。

核对的是实际安装文件，不使用旧上游 checkout 代替：

| 包 | 版本 | 源码位置与行为 |
| --- | --- | --- |
| `@earendil-works/pi-ai` | 1.5.0 | `dist/api/openai-completions.js:370` 处理 reasoning_content/reasoning/reasoning_text；`:415` 将 content 作为 text_delta 原样发送 |
| `@deepseek-ai/dsh-llm-pi-ai` | 0.2.1-rc.5 | `lib/index.js:1537` 将 text_delta 转为正文，将 thinking_delta 转为 reasoning-delta |
| `@deepseek-ai/dsh-session-title-first-prompt-llm` | 0.2.1-rc.5 | `lib/index.js:67` 取第一个非空正文行；`:84` 只汇总 text blocks 后生成标题 |

离线 `check-adapter.mjs` 直接导入已安装 pi-ai parser，使用自定义 fetch 返回合成 SSE，实际网络请求为 0。四个组合为 reasoning=false/true × 独立 reasoning_content/正文内分片 think 标签。断言全部通过：前者生成 thinking 与 text 两类内容，后者仅生成带标签的 text，且不受 model.reasoning 布尔值影响。因此单纯补模型的 reasoning 声明不能证明正文标签问题已修复；也不能通过 Redis 工具提示或隐藏 DOM 文本宣称修复。

下一步应在模型服务或适配层用不含业务内容的原始响应验证字段契约，再决定服务端拆分或有明确协议依据的适配。若确实需要修改宿主，这属于独立改造，应同时覆盖流式分片、标题、历史重放、工具调用及合法正文中的标签。当前 Redis 插件保持现有职责，没有加入全局聊天文本处理器。

## 检查与本地证据

- `pnpm exec vitest run tests/selection-epoch.test.ts tests/ui-action-confirmation-browser.test.ts tests/ui-actions-client.test.ts tests/ai-locate-tool.test.ts`：4 文件 / 29 项通过，32.03 秒。包含浏览器与真实 Host 协调器，但 Redis 响应为合成，不冒充真实模型。
- `node node_modules/vitest/vitest.mjs run tests/ai-tools.test.ts -t 'selection|sidebar|staged'`：18 项通过、68 项未选中。此前用 Windows pnpm 包装器传该表达式时引号处理失败，未执行测试；改用 Node 入口后成功，不记为产品失败。
- 离线适配器 4 个组合通过。结果只证明其已安装解析逻辑，不是私有模型服务的响应抓包。
- 本轮仅补验收文档，未改 TypeScript、依赖、配置或服务；没有新增接口，也没有重新全量编译或打包。

临时证据位于 `C:/Users/admin/AppData/Local/Temp/dsh-redis-selection-diagnosis-20261106/`：`pure-text.txt/jpg`、`stable-selection.txt`、`changed-selection.txt`、`hidden-selection.txt/jpg`、`racing-selection.txt`、`racing-rejection.jpg`、`selection-cards.json`、`tool-trajectory.json`、`check-adapter.mjs`、`adapter-results.json`、`adapter-versions.json`。所读源码文件哈希已固定在 adapter-versions.json；这些仅含合成数据及本地运行标识，不随发布包分发。截图和原始结果分别保留，不能用截图替代调用参数与数据不变性对照。
