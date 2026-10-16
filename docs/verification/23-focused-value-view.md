# 23：聚焦详情、搜索与 JSON 折叠实现说明

本票已验收，固定宿主0.2.0-rc.2。生产包SHA256为 f6052a121f4cc68cfb0a3942819e0d7eb03ed04952013f5a825cc0517ea18d73：三层严格类型/完整构建/238回归，以及同包聚焦与恢复25组、全12类/双会话/实际SDK与React87组、工作台24组、命名空间25组全部通过。原29票当前01–23 done，24–29尚待执行；各套组数有共同基础检查，不相加冒称互不重复场景数。

## 功能与操作

1. 默认保留用户要求的Database/RESP工作台：连接/DB、Key目录和右侧数据；窄栏仍保持Key/详情左右。点击详情标题的聚焦图标，才临时收起连接及Key导航，给同一详情腾出空间；退出后恢复原Key和列表位置。
2. 文本预览工具栏的查找图标按需打开输入框。在预览内部按Ctrl/Cmd+F也可打开；Enter或F3向后、Shift+Enter/F3向前。Esc先关闭查找，再次Esc退出聚焦。快捷键不接管插件之外的DSH内容。
3. 查找是当前已读、当前格式文本上的区分大小写字面匹配；显示完整命中总数，最多高亮和导航前1000处。搜索不到未读取尾部并不表示Redis完整值中不存在。
4. JSON预览可逐块折叠/展开，也可全部折叠/展开。保留原数值和字符串token，大整数、指数、负零、重复字段或转义不会经过JS数值再序列化。
5. 复制始终使用当前格式的完整已读文本，包括被折叠隐藏的部分。它不自动补读Redis剩余内容；Base64/Hex仍准确对应当前实际收到的字节。

聚焦适用于所有详情；查找与JSON折叠只适用于共享BytePreview，例如String、RedisJSON和选中的集合单元格。未增加整张集合、HLL/Bloom统计、元信息或整个DSH页面搜索，也没有自动读全值功能。说明收在按需帮助入口，不堆到常态工作区。

## 文件与状态归属

| 文件 | 职责 |
| --- | --- |
| [loaded-content.ts](../../src/client/loaded-content.ts) | 已读文字的字面搜索、JSON源范围索引和折叠投影，不拥有网络能力 |
| [value-preview.ts](../../src/client/value-preview.ts) | 复用原512Ki字符预算、严格字节解释和保留token的JSON formatter |
| [BytePreview.tsx](../../src/client/BytePreview.tsx) | 唯一查找草稿/开关/当前命中/折叠Set；源片段渲染、快捷键和完整文本复制 |
| [KeyBrowser.tsx](../../src/client/KeyBrowser.tsx) | 唯一聚焦状态、进入时保存Key列表位置、退出时恢复位置和焦点 |
| [styles.ts](../../src/client/styles.ts)、[Icon.tsx](../../src/client/Icon.tsx)、[locales.ts](../../src/client/locales.ts) | 插件自身网格切换、紧凑图标/局部滚动/双语与按需查找条 |
| [loaded-content.test.ts](../../tests/loaded-content.test.ts) | Unicode/字面范围/预算、原token、父子折叠及源文本完全恢复专项 |
| [smoke-focused-value.mjs](../../scripts/smoke-focused-value.mjs)、[smoke-dsh.mjs](../../scripts/smoke-dsh.mjs) | 实际安装包、独占Redis与只读代理的原生专项入口 |

格式继续由原BrowsingSession持有，所选Key/集合行/读取状态继续归原组件；没有第二套值缓存或状态副本。聚焦只改变CSS显示，KeyCatalog、KeyDetails和具体查看器保持挂载，不触发读取effect。进入时记scrollTop并聚焦已有预览；退出恢复列表和焦点。搜索只改本地文字，前后代理命令数必须相同。

没有新增Host/RPC方法、依赖或通用命令执行入口。该DSH插件沿用现有严格RemoteResult及领域DTO；src/common/dto/api-response.dto.ts不是此项目现有架构，未另造响应包装或旧接口兼容层。

## 完整实现方法

### 字面搜索

输入仅为已得到的preview.text。先校验不超过既有512Ki字符输出预算；查询至多256个UTF-16代码单元，校验有效Unicode，不进行归一化或正则解释。使用indexOf按非重叠匹配向前扫描，完整累加total；仅前1000个start/end范围进入导航/高亮数组。无查询、无命中、无效查询和达到保存上限分别反馈，不能把上限伪称全部高亮。

React按原范围拆出文本节点与mark，不插入HTML。查询或导航时展开折叠内容以显示命中。滚动只根据预览自身矩形修改其scrollTop/scrollLeft，避免scrollIntoView推动DSH祖先文档。格式/预览源变化时清折叠、重置命中游标并使旧复制promise失效；聚焦往返则保留同一组件状态。

### JSON结构与折叠

输入为已有formatter校验且保留原token的JSON文本。线性扫描双引号、转义及大括号/方括号位置，只为跨行容器记录源范围；沿用64层限制，至多登记512个多行折叠控件，并显示控件上限提示。超过控件数的其他内容仍按原文显示，不丢弃值。

projectLoadedText输出源文字片段、开合按钮和摘要片段。折叠祖先时不挂载后代控件，展开时仍引用原源范围，因此可精确恢复。SVG按钮不含正文字符；摘要仅是显示投影，不能用DOM回拼复制内容。复制直接调用writeText(preview.text)，并沿用异步序号守卫处理成功、拒绝和迟到完成，避免旧结果覆盖新状态。

### 原位聚焦与简洁布局

KeyBrowser在原详情容器上加本地focused状态。CSS只在本插件.redis-connection中匹配该状态，复用既有compact连接入口、保留设置与连接状态，并临时隐藏连接/Key导航；没有调用宿主私有侧栏宽度、最大化或全屏服务。默认宽窄布局不受此显式操作影响。Escape仅在子查找没有处理时退出聚焦，防止一次按键同时收查找并跳走。

独立纯内存原型保存在prototype/redis-focus-state分支b024bbedf084b87c97149b5a51cd2f4435fcc6de；源路径src/client/prototypes/redis-focus.prototype.html，ignored副本.scratch/artifacts/redis-focus.prototype.html可双击。主分支没有合入原型壳，原型未接Redis或冒充宿主验收；没有绕过先前file://浏览器限制。可选偏好无回复时按既有实施授权继续原位方案，不称用户明确确认了该新增选择。

## 预算与边界

| 项目 | 实际边界 |
| --- | --- |
| 搜索输入 | 当前BytePreview已读文本，最大512Ki字符；不是服务端搜索 |
| 查询 | 有效Unicode，最多256 UTF-16代码单元；区分大小写、非重叠字面匹配 |
| 命中显示 | 全文计总数；最多保留/挂载/导航前1000处并提示限额 |
| JSON折叠 | 深度64、最多512个多行容器控件；折叠祖先不挂后代；源文本仍完整 |
| 网络与Key缓存 | 既有RESP帧/请求、分页、5000条/2MiB编码DTO预算不变；显示上限不代表全进程堆或Redis完整值受该尺寸约束 |
| 只读与并发 | 显示操作零额外Redis命令；显式刷新仍走原代次、权限/消失/变型及取消/超时链路；多命令读取不提供原子快照 |
| 复制 | 当前格式完整已读文本；不补读未读取尾部，不根据折叠DOM重新组装 |

## 当前同包实际结果

| 验收 | 实际结果与原件 |
| --- | --- |
| 三层类型、构建及238回归 | [最终prepack输出](artifacts/23-focused-value-view/focus-pack-console.log)，新增6项纯模型专项 |
| 聚焦与原生恢复 | [25组报告](artifacts/23-focused-value-view/native-focused-smoke.json)：二进制Key、位置1122px、快捷键/搜索/折叠/Hash复用与零额外命令；active/queued取消45ms、生产截止10151ms、实际TCP EOF、可信B独立及手动新代次不重放 |
| 原12类、双会话及实际SDK/React | [87组报告](artifacts/23-focused-value-view/native-ui-release-smoke.json)：严格协议、权限/消失/变型、预算/格式、会话归属及源字节/绝对过期保持 |
| 工作台布局 | [24组报告](artifacts/23-focused-value-view/native-workbench-smoke.json)：22个几何样本，实际300/340/900px手柄、中英/明暗、12类/加载/空/错误与默认左右；1371px列表位置及同值保持 |
| 命名空间大列表 | [25组报告](artifacts/23-focused-value-view/native-namespaces-smoke.json)：5105条在5000缓存停止、562px视口只挂25行/58页；512个约4KiB名称在368条/43页触发2MiB编码DTO；真实SCAN取消/10125ms截止及无重放 |
| 包和源码身份 | [完整清单](artifacts/23-focused-value-view/workbench-release-manifest.json)：141源输入SHA、79包文件/70lib集合与字节、12Host peer、2生产依赖，安装包完整匹配 |

聚焦专项900px详情899px/预览883px，340px详情339px/预览327px；退出后恢复Key/详情并列，详情211px/预览199px，横溢出与DSH文档滚动均为0。部分读取值的未读尾词零命中；重复词只挂1000高亮且报告完整总数；1200对象JSON只登记512控件，根折叠只挂1个，展开末项1199保留。Hash选中值复用同一预览，返回不再次HSCAN。源DUMP和绝对过期均不变。

四套pageerror和console error均为空。聚焦2条readString取消、全类型1条readString取消、命名空间1条scanKeys取消ERR_ABORTED按预期保留；布局无请求失败。自建DSH/Chrome、代理、独占Redis和本轮owner目录均正常停止/回收。此前已被拒绝清理的旧目录保持原记录，未另找方式删除；用户服务、业务库、日常DSH_HOME及C盘文件未改。

实际[中文宽栏](artifacts/23-focused-value-view/native-workbench-panel-wide-zh.png)、[窄栏深色](artifacts/23-focused-value-view/native-workbench-panel-narrow-dark.png)、[900px聚焦](artifacts/23-focused-value-view/native-focused-wide.png)和[340px聚焦查找](artifacts/23-focused-value-view/native-focused-narrow.png)截图已查看。属于真实安装包截图，不是原型或用户视觉认可记录。

## 阶段失败与未验证范围

纯模型首轮一项测试把emoji后的UTF-16偏移手算为17，实际16、结束20；逐字符核实后仅修测试预期，最终238回归通过，未用阶段18/19替代最终结果。

同包聚焦首轮12组后复制断言false，原因是测试把pre.innerText当成原文本，嵌入SVG按钮的布局使该属性额外包含换行。实际复制参数始终是formatter全文；仅将测试源oracle改为textContent，仍在折叠后逐字符核对完整文本、数值、拒绝和迟到隔离，不裁剪内容、不改产品包。[首轮false原件](artifacts/23-focused-value-view/focus-f6052a12-textread-native-focused-smoke.json)及日志/截图分名保留；本轮所有资源当时也已清理。

复制验收明确使用受控Clipboard API替身记录writeText参数、拒绝和迟到完成，结束恢复页面原描述符；不读取/覆盖用户OS剪贴板，不能称实际系统剪贴板权限已经验证。未执行屏幕阅读器人工验收、生产负载压测、任意大模块值或全进程堆测量；未在新包重跑完整TLS冷重启17/17，历史结果保留原包范围。本轮GETRANGE取消/超时/EOF及SCAN取消/超时属于上述新包实际结果。24–29的资料导入导出、服务器/慢日志/客户端、自动刷新及时序图表不在本票完成范围。

## 原件与复现

[归档清单](artifacts/23-focused-value-view/evidence-inventory.json)收录41份原始文件，逐一比对.scratch/artifacts源件字节和SHA，含先前已提交的model-check原始日志与本轮阶段false；清单自身另1份。模型小目标提交b40b55f459d65b34a2c5294729da948a0783f7ef；当前候选基于该父提交构建，141项sourceInputs才表示构建时实际输入，不能把父提交误写为含所有未提交UI的代码提交。

包路径.scratch/artifacts/dsh-redis-f6052a121f4cc68cfb0a3942819e0d7eb03ed04952013f5a825cc0517ea18d73.tgz，版本仍0.1.0，以SHA区分。只安装项目隔离.scratch/runtime/dsh-home/web，不替换日常DSH。源输入、锁文件、实际CLI及React身份见包清单与87组报告。

复现时在项目根目录用新的终端设置E盘TEMP/TMP和NODE_OPTIONS=--max-old-space-size=512 --max-semi-space-size=4，REDIS_TEST_BACKEND=wsl-image；REDIS_TEST_PYTHON、DSH_CLI_ENTRY和REDIS_BROWSER_EXECUTABLE使用本机实际Python、固定rc.2 CLI与Chrome路径（原收据中保留）。先pnpm pack、按SHA安装隔离profile，再运行node scripts/smoke-dsh.mjs。每种模式使用新终端，共同设置REDIS_SMOKE_CONNECTIONS=1和REDIS_SMOKE_KEYS=1：

- 聚焦加恢复：REDIS_SMOKE_FOCUSED=1、REDIS_SMOKE_RECOVERY=1。
- 工作台：REDIS_SMOKE_LAYOUT=1。
- 命名空间：REDIS_SMOKE_NAMESPACES=1。
- 全12类与会话：REDIS_SMOKE_RELEASE=1、REDIS_SMOKE_SESSIONS=1，以及STRINGS/HASHES/LISTS/SETS/ZSETS/STREAMS/JSON/BITMAP/GEO/HLL/TIMESERIES/BLOOM各自对应REDIS_SMOKE_变量为1。

四种模式按顺序执行，不并行探测WSL夹具；每套finally清理其owner资源。包验证使用相同本机环境运行node scripts/verify-release-package.mjs。本票没有启动npm run dev或npm run start:dev，也没有使用网页端GPT评审。
