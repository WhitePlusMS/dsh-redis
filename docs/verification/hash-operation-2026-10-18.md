# Phosphor 图标与 RESP Hash 操作验收（2026-10-18）

本轮按用户确定的第 2 组 Phosphor 双色、青/紫/橘配色及 RESP 截图实现。当前个人 DSH 已更新并保留运行，地址为 `http://127.0.0.1:7198/`。Redis 操作仍严格只读。

## 实际操作

1. 手动连接后，当前 DB 的 Key 自动分批加载；左侧保持 DB / 目录 / Key 树导航。
2. 打开 Hash，上方显示行号、字段和值，点击任意单元格选中整行。
3. 字段和值同时显示在下方固定区域；选行不隐藏表格、不进入另一个页面，各区分别滚动。
4. 字段和值各有格式下拉、查找和复制，格式独立。换行重置预览的查找、折叠和滚动局部状态，格式选择仍保留；关闭查找立即清除高亮。
5. 顶部搜索仅过滤已加载字段和值，不触发新一轮 Redis 扫描；搜索期间停止触底续页。
6. 漏斗展开服务器字段 MATCH，输入只改草稿；点击应用后才读取，显示全部字段可清除 MATCH。未筛选时表格触底自动续读。
7. 表头明确已加载数、Hash 全部字段数和 Key TTL。大值仍明确部分覆盖，真实错误、取消和预算控制保留。

## 修改文件、原因与影响

| 文件 | 修改原因及结果 |
| --- | --- |
| `src/client/NavigationIcon.tsx`、`Icon.tsx` | 四个 Phosphor 双色导航 SVG，区分青色 DB、紫色开/关目录和橘色 Key；保留工具图标，增加筛选图标，无新增运行依赖。 |
| `src/client/styles.ts` | 深浅主题三色变量；Hash 正常布局三分区及局部滚动；排除旧通用 metadata 选择器，消除重复 TYPE/TTL；去除旧帮助定位样式。 |
| `src/client/HashView.tsx` | 原详情跳页改为整行选择、固定双预览；本地搜索和显式提交 MATCH；空字段/空值有可读名称，仍用原始 Base64 作身份；不增加 Host 读取接口。 |
| `src/client/CollectionTable.tsx` | 可选整行选择、序号、空态、键盘导航；仅滚动本表格，原始游标续页与其他类型暂停逻辑复用。 |
| `src/client/BytePreview.tsx` | 六种已有格式统一下拉；标题就近显示字段/值、字节覆盖；查找关闭清高亮，复用已有格式、复制、搜索和 JSON 折叠。 |
| `src/client/KeyBrowser.tsx` | Hash 聚焦详情优先进入值预览。 |
| `src/client/RedisWorkspace.tsx`、`AutoRefresh.tsx`、`KeyCatalog.tsx`、`KeyDetails.tsx` | 清除本次主浏览链中的重复帮助入口；连同 Hash 共五个帮助场景。实际异常及截断状态保留。 |
| `src/client/locales.ts` | 中英同步具体按钮、作用域、计数、空值与状态；删除六组无调用帮助正文，共享 Stream 文案保留。 |
| `scripts/native-view-controls.mjs`、`smoke-dsh.mjs`、`smoke-focused-value.mjs`、`smoke-resp-workbench.mjs` | 同步新的格式下拉、Hash 选行及双预览作用域。仅完成脚本语法检查，本轮未执行这些历史完整 UI 套件。 |
| `THIRD_PARTY_NOTICES.md`、`licenses/phosphor-icons-MIT.txt` | 固定 Phosphor 上游 SHA，保留完整 MIT 许可。没有复制 RESP 代码或资产。 |
| `README.md`、`docs/HELP_UI_AUDIT.md`、`docs/ICON_HASH_VISUAL_REVIEW.md` | 同步已采用的操作与图标；明确其他类型仍使用原详情方式，以及剩余 14 个专用帮助场景。 |
| `docs/references/DSH_DATABASE_REDIS_OPERATIONS.md` | 记录固定上游源码：DSH Database 的 Hash 实际为行内编辑与整行文本预览，官方 String/JSON 截图不能当作 Hash 交互；本项目采用用户要求的 RESP 双预览，不引入写操作。 |
| `docs/RESP_OPERATION_REFINEMENT.md`、`UPDATE_LOG.md` | 跟踪完成范围、真实验证边界及日常启动说明。 |

## 包与检查边界

- 交互候选 SHA256：`10c380a0115f519ed33bfaa7d2f805c7a65cb79cb22c0d6533023af112ae5c8d`。
- 最终安装 SHA256：`79ce59fb8c0aa1a1098bbae379669d884cf0b08f711ecea7f6175d55b95df048`。
- 最终默认 `pnpm pack` 执行原有 prepack 门禁：Host / Client / tests 三层严格类型、standalone 构建、32 文件 / 318 项回归全部通过。
- 候选的原生测试发现重复 metadata 和本地搜索状态描述问题；最终修正这两项，并补空字段/空值名称、关闭查找清高亮、切行重置预览。没有以候选结果冒称最终又完整重跑一遍原生专项。
- 发布清单以实际 tarball 为准：pnpm 会规范化根 `package.json`（移除已执行 prepack 及 packageManager）。98 个包文件全部与日常安装逐字节相同，88 个 lib 文件同时与本地构建输出相同。

## 隔离原生操作验证

使用独占 WSL 官方 Redis 8.2.6 镜像夹具、只读命令记录/延迟代理和隔离 DSH profile；通过 CUA 操作原生 DSH 页面，不使用伪造 DOM 或仅凭静态 HTML 验收。数据均为测试数据。

候选记录共 11 项：整行选择和独立格式、二进制原始身份及双预览、大值部分覆盖、无损 JSON 和本地查找、选中期间自动续页、查找下一项、MATCH 草稿与提交、空匹配及空页完成、取消后拒绝迟到页、元信息页保留读取/选择、复制成功反馈。

- Hash 共 240 字段，实际触底加载 101 → 201 → 240；本地搜索没有新增 HSCAN。
- 二进制字段 FF00、值 FE00 可独立查看。131073 字节值仅已读 65536 字节时明确标记部分预览。
- JSON 保留大整数、超大指数、负零和重复对象键。查找通过下一项按钮验证；本轮未把输入法影响下的 Enter 操作记为通过。
- MATCH 草稿不清空已有结果，提交后匹配 100 条；无匹配结果自动完成中间空页并清空两个预览。
- 暗色 896.11px / 464.11px 两种实际侧栏宽度无根区域外溢，三个区域相接且局部滚动；浅色图标实际色值核对通过。候选截图保留发现问题时的状态，不能代表最终 metadata 显示。
- 7 份源 DUMP 前后逐字节不变；代理无写命令、KEYS 或协议错误。独占 DSH、代理、Redis 全部停止，本轮新建夹具目录按所有权清理。

原始无秘密证据：[候选报告](artifacts/hash-operation/candidate-native-report.json)、[命令与源数据摘要](artifacts/hash-operation/candidate-read-summary.json)、[清理结果](artifacts/hash-operation/candidate-cleanup.json)。

## 日常更新与实际查看

用户明确要求启动并实时看更新后，先备份个人 web profile 的五份清单，再安装最终唯一 SHA 包；确认旧 PID / 7198 所有权后，仅停止该 DSH 进程树并隐藏重启。新服务 PID 45416，监听 `127.0.0.1:7198`。

- 五份清单仅 `package.json`、`pnpm-lock.yaml` 的插件引用发生变化；其他依赖、启用 bundles 和 cordis 配置不变。
- 原生页面手动连接已有 `127.0.0.1:6379`，无密码输入；真实 DB0 自动加载 760/760、100%，打开一个含 8 字段的 Hash。
- 最终页面确认整行选择、表格不隐藏、字段 Text / 值 JSON 独立、两个固定预览、旧 metadata 在数据页隐藏、查找高亮 1 → 0、切行关闭查找且格式保留。
- 实际页面已打开并保留供用户操作。业务 Key/值、截图、认证启动 URL、运行日志和五份配置备份只留忽略目录，不进入 Git；仓库仅保留计数、布局、包身份和检查结果。
- 当前插件采用构建/安装后刷新页面，**没有源码保存即自动热更新**。后续每个可运行小目标检查通过后继续同步此窗口；不启动 npm dev/start:dev，不执行网页端 GPT 评审。

日常安装证据：[包文件清单](artifacts/hash-operation/package-manifest.json)、[安装及界面记录](artifacts/hash-operation/daily-install.json)、[最终打包检查日志](artifacts/hash-operation/final-pack.log)。临时验证服务均已停止；用户要求保留的日常服务继续运行。
