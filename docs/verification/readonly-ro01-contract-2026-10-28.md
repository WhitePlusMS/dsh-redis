# RO01：DSH 固定版本接口核验记录

日期：2026-10-28。状态：固定版本与接口契约核验完成；原生插件界面及真实模型尚未验收。

## 版本证据

- 项目源码基线为 `7be8f4a7c1ded2ba1cb47196ed6025a5039c0689`；工作区另有本轮未提交的实施文档和更新说明。
- 项目 `package.json` 固定插件 `0.1.0`、DSH engine 和相关 SDK `0.2.0-rc.2`。本机 `dsh --version` 输出 `0.2.0-rc.2`；这只证明 CLI 版本，不能证明某个正在运行的 Host 或浏览器 Client 的版本。
- 本次启动的隔离 Web 使用全局 `@deepseek-ai/dsh@0.2.0-rc.2` 入口；该入口导入的 `@deepseek-ai/dsh-app-boot` 安装包版本为 `0.2.0-rc.2`。隔离宿主已实际到达 ready 并停止；插件本身没有在该实例中加载，浏览器 Client 和真实模型留待阶段验收。
- 本地上游源码 `.scratch/upstream/deepseek-harness` 的 HEAD 和 `dsh-v0.2.0-rc.2` tag 均解析为 `639ed015397290b3745d163aafe02ffee4aa3f84`。下列上游依据均指这一固定版本，不以其他分支代替。

## 已核验的接口与现有接线

| 项目 | 当前事实与依据 |
| --- | --- |
| 工具注册 | [ai-tools.ts](../../src/host/ai-tools.ts) 通过 `ctx.tools.register` 注册四个工具；固定版 [工具文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/core/tools/README.zh.md) 描述注册、结果和取消。 |
| 会话身份 | 工具从执行上下文 `exec.agent.session.id` 取会话；[remote-service.ts](../../src/remote-service.ts) 从 Typert 提供的 Agent 获取所属会话。模型参数不包含 session ID。 |
| 取消 | 工具检查并向 reader 传递 `exec.signal`；Client 发起 RPC 时传递取消信号。取消不等于 Redis 已执行命令可以撤销，活动响应由 transport 排队处理。 |
| 工具展示 | 当前工具的 `output.render` 将规范 JSON 返回为文本；没有单独的 Redis 专用工具卡片。固定版工具契约见 [添加工具说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/cookbook/adding-a-tool.md)。 |
| Client 到 Host | [客户端入口](../../src/client/index.ts) 通过 Typert mount 和 RPC 发起请求；Host 方法的身份和信号由协议传入。 |
| Client 打开侧栏 | 固定版 [右侧栏文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-sidebar-right/README.zh.md) 定义 Client 的 `ctx.sidebarRight.openTab/openResource`，打开内容时展开面板。插件注册了 Redis tab；不能据此推断 Host 可以直接调用该 Client API。 |
| Host 到 Client 事件 | 固定版 [Gateway 文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/api/gateway/README.zh.md) 描述 Host 组合注册事件源、Client 使用 `ctx.remote.$on()` 订阅转发事件；`hasLiveClient()` 只观察活动事件流，不保证目标 Redis 面板已就绪或后续投递成功。[API Remotes 文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/api/remotes/README.md) 说明事件名单由宿主 `API_REMOTE_FORWARDED_EVENTS` 固定选择，插件不能只靠 `$on()` 增加自定义转发事件。每个 Client 有独立队列；多界面下的唯一接收者仍需单独设计。 |
| 界面动作回执 | 现有 [共享协议](../../src/typert.shared.ts) 的 `SelectionAck` 只确认 Client 同步选择身份，不能表示 AI 发起的打开或定位动作已应用。Gateway 文档描述 Agent-scoped waterfall 可回送结果，但多 Client 接收、取消、重放和插件事件装配是否满足 RO07 仍需实际验证；不能把发送事件或存在活动流直接当作界面成功。 |

## 后续验证和实施约束

1. 原生插件界面验收时继续确认实际运行的 Host、Client 和插件版本，分别记录证据；不能用 CLI 版本替代浏览器 Client 或插件的运行验收。
2. RO07/RO08 先确认可信的 Host–Client 通道和接收者、取消及终态。没有经验证的通道时，工具应提示用户打开 Redis 面板，不能声称已经打开；不以 DOM 注入绕过宿主接口。
3. 每项新增工具继续沿用固定版本的参数验证、可信会话和取消语义，UI 请求已派发不能等同于用户界面已应用。
4. 本次没有连接用户 Redis、执行真实 DSH 模型对话或验收原生界面；`pnpm typecheck` 通过仅证明当前源码类型检查通过。
5. 2026-10-29 补核固定版 Gateway 文档，修正此前对 Host→Client 事件证据不完整的描述；普通通知重连不重放，pending scoped waterfall 的重放与多 Client fanout 不能替代插件级唯一接收者和应用回执验证。
6. 2026-10-30 补核固定版 API Remotes 文档及事件名单源码：新增转发事件需要宿主应用选择变更；RO07 不得将插件自行订阅新事件当作既有受支持能力。Client 主动打开的双向 Remote 流仍需按具体插件契约另行核验。

## 本地检查

- `pnpm typecheck`：通过。
- 沙箱内 `pnpm exec vitest run`：21 个文件中 20 个通过，193 项通过；传输测试 12 项因自建回环 socket 连接被拒绝而失败，报 `EACCES`。这次没有执行 `pnpm build`。
- 经允许访问本机回环后，单独执行 `pnpm exec vitest run tests/redis-transport.test.ts`：12 项通过。该测试仅连接自身建立的随机回环端口并清理自己的 socket；以上两次结果分别记录，不声称一次完整 `pnpm check` 通过。
- Docker 命令当前不在 PATH，Docker 夹具和原生 DSH 夹具尚未运行；用户 Redis、真实模型和原生界面仍待验收。
- Ubuntu WSL 可用；使用项目现有 `wsl-image` fixture 启动随机端口 Redis 8.2.6，写入合成 Key，验证插件读取、跨会话目标被拒绝和合成值未变化。输出确认所属 Redis 已停止、fixture 目录已移除；使用的是已有 `lib` 产物，未验证本次新构建或用户 Redis。
- 后续尝试通过隔离代理核验 AUTH/PING/SELECT/SCAN 时，WSL fixture 报告 Redis 未在清理等待时间内退出，未得到有效命令顺序结果。单独核对该次生成的进程号已不存在、fixture 端口无监听，检查真实路径和目录身份后移除该次独有目录；未处理其他进程或历史 fixture。原因尚待排查，不能把该次验证记为通过。
- 查询 `dsh web --help` 时，CLI 实际尝试写入日常 `profiles/web/cordis.yml`；沙箱以 `EPERM` 拒绝，命令退出，未启动 DSH。后续命令必须明确设置隔离的 `DSH_HOME` 和 `DSH_AGENTS_HOME`，不得用默认 profile 探测。
- 使用新建空工作目录、独立 `DSH_HOME`/`DSH_AGENTS_HOME` 和精简环境尝试隔离启动 DSH Web；启动和退出均未得到测试脚本的可靠回执。复查未发现符合该次命令的 DSH/Node 进程，核对临时目录路径及无重解析点后移除该次目录。该次不计运行验收通过；当前用户侧 DSH Web 地址仍待确认。
- 用户确认日常 DSH 当前未启动。随后以无模型凭据的精简环境、新建空目录和随机本机端口启动隔离 DSH Web：测试脚本观察到 ready，随后结束本次进程树并确认退出，专属目录已移除。仅验证隔离宿主启动；未加载本项目插件、未验收原生界面或真实模型。
- 此后另一只读检查再次尝试 `dsh --profile web --help`，CLI 同样试图写入默认 profile 并被沙箱 `EPERM` 拒绝；没有启动服务。继续禁止无隔离环境的 profile 命令。
