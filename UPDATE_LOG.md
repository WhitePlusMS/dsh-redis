# 更新说明

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
