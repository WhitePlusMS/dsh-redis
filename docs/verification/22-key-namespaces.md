# 22：命名空间、大列表与定位实现说明

本票范围：在 Database/RESP 左右工作台内，按可配置分隔符浏览已加载 Key，虚拟渲染长列表，并返回已选 Key。当前生产候选包为 `563388a2e6803e188328defc0414a14fa0b728623c5681191678735dc21519fb`，固定宿主 `0.2.0-rc.2`。本票已完成：严格类型/构建与232回归、25组命名空间、87组全12类/双会话/SDK与React、24组中英/明暗工作台均在同一包通过。

## 功能与操作

1. 手动选择 DB、填写 Redis MATCH 并扫描。目录只使用已收到、按完整原字节去重后的缓存，不因展开而扫描服务器。
2. Key 栏图标切换命名空间树和平铺列表。树默认折叠，目录右侧数字表示**组内已加载 Key 数**；全局已加载数量与“可继续扫描 / 扫描完成 / 缓存上限”一直显示。
3. 信息入口按需展开分隔符设置，默认 `:`。提交有效分隔符才应用；空值、非法 Unicode 或超过16 UTF-8字节的草稿显示校验错误，保留当前有效分组。不增加常态长说明。
4. 点击目录展开/折叠，点击叶 Key 使用原先的显式读取链路。方向键、Home/End、PageUp/PageDown 移动活动行，Enter/空格展开目录或查看 Key；移动活动行本身不读取。
5. “定位已选 Key”只在该完整身份存在于当前缓存时可用。它展开祖先并滚动、聚焦到同一叶；不再次读取值。会话恢复只记得 Key 但没有缓存时，该按钮禁用，仍需原有显式扫描/读取。
6. 刷新或换 MATCH 清旧缓存、目录展开和活动行；增量续扫保持已有展开与滚动锚点。切换会话不恢复缓存、游标、目录树或值，保持P0的会话边界。

连接导航、Key 栏、右侧详情沿用现有响应式分栏；侧栏较窄时保留 Key/详情左右。新功能不调用宿主宽度内部服务。格式、元信息、复制和原12类查看仍由已有组件负责。

## 文件与职责

| 文件 | 本票职责 |
| --- | --- |
| [key-namespaces.ts](../../src/client/key-namespaces.ts) | 原字节命名空间索引、增量追加/替换、16层上限、平铺行和虚拟窗口计算 |
| [KeyCatalog.tsx](../../src/client/KeyCatalog.tsx) | 唯一本地导航状态、分隔符草稿、树/平铺、展开、键盘、滚动和定位 |
| [KeyBrowser.tsx](../../src/client/KeyBrowser.tsx) | 保留扫描/游标/缓存/代次和原选择回调，仅委托目录显示 |
| [key-cache.ts](../../src/client/key-cache.ts) | 既有完整身份去重、5000条/2MiB编码缓存；本票未改 |
| [styles.ts](../../src/client/styles.ts)、[Icon.tsx](../../src/client/Icon.tsx)、[locales.ts](../../src/client/locales.ts) | 原主题内的紧凑图标、30px固定行、可见组计数、双语与按需设置 |
| [key-namespaces.test.ts](../../tests/key-namespaces.test.ts) | 字节碰撞/Unicode/深度/增量/缓存替换与窗口专项 |
| [smoke-key-namespaces.mjs](../../scripts/smoke-key-namespaces.mjs) | 实际安装的DSH/Redis/延迟代理专项，不使用全量隐藏DOM或React内部状态 |
| [native-view-controls.mjs](../../scripts/native-view-controls.mjs) | 通过可见平铺列表与真实滚动定位原始身份，复用实际侧栏手柄 |

没有新增Host方法、DTO、依赖或通用命令执行入口。`src/common/dto/api-response.dto.ts`不属于这个DSH插件架构；继续使用已经统一的严格`RemoteResult`及现有领域返回契约，未另造返回包装或兼容旧接口。

## 原字节分组方法

服务器返回的`RedisKey.base64`始终是完整身份；`label`只用于展示，不能拿来切分、去重或反推请求。

- `atob(base64)`得到每字符对应一个原始字节的字符串，不先进行UTF-8解码，因此`0xff`、`0xfe`、NUL、空字节串都可区分。
- 将经校验的分隔符用`TextEncoder`转成完整UTF-8字节串，再按这些字节查找边界；不按字符规范化，不将无效字节替换为`�`。
- 每个目录的ID为`namespace:`加上**包含该分隔符的完整前缀字节**的Base64；叶ID为`key:`加上完整Key Base64。目录与叶ID空间分开，`a`、`a:`、`a::x`或相同截断标签不会合并。
- 空Key仍是合法的`key:`叶；前导、连续和末尾分隔符保留空段。标签沿用现有`prefixLabel`：有效文本用引号表示，无效UTF-8用有界Base64提示，完整身份继续在详情“元信息”。
- 最多创建16层目录；剩余路径作为叶名称继续显示，原完整Key不截断。单个64KiB、数万分隔符的Key不会创建数万嵌套节点。

这只是显示分组，不推断Redis业务类型、不改变Key、不发送目录名。目录计数是已加载去重Key的子树数量；SCAN本身不是快照，顺序采用首次收到的顺序，不声称全局排序、全库匹配总数或实时一致性。

## 增量索引与状态重置

`appendKeys`保留已缓存Key对象及顺序，追加页只增加新尾部。`KeyNamespaces.update`检查上一数组是否仍为当前数组的对象前缀；是则只解析新尾部，对每个首次出现的完整身份给其祖先计数加1。

缓存变短、对象前缀不一致表示刷新/筛选/替换，索引清空后按新缓存建立。本地`revision`只在这类替换变化，不随追加变化；`KeyCatalog`据此清除旧展开Set与活动行，防止不同筛选的目录身份长期累积。分隔符变化创建独立新索引并重置展开。

索引不拥有SCAN游标，也不持有Redis客户端；显示切换、展开和定位不会消费、重新生成或重放游标。扫描失败、取消和超时继续由既有KeyBrowser清游标并给固定状态；旧代次、旧筛选的迟到页仍受原Host/客户端序列守卫限制。

## 虚拟行、焦点与返回定位

行高为30px，滚动区总高度为`当前可见树行数 × 30`。根据实际`scrollTop`与ResizeObserver测量的高度计算可见区，两端各多渲染6行；其余行不创建DOM。可见树行最多为5000个Key及各自至多16层目录，折叠部分不进入可见行数组。

挂载行数量上界为`ceil(视口高度 / 30) + 14`：其中含两侧overscan/边界取整，最多额外保留1个离屏活动行，使`aria-activedescendant`总能指向实际DOM节点。目录使用tree/treeitem、aria-level/expanded；叶使用完整身份与aria-selected。目录自身保留焦点，键盘移动只改变活动行，激活才调用原选择回调。

续扫可能向已展开目录插入新叶，从而把其他行向后移动。更新前记录顶部行ID与该行内像素偏移，更新后查找同一ID并恢复偏移；如果显示方式变化使该行不再存在，回到顶部。显式定位优先：通过当前完整身份的祖先ID展开路径、找到叶索引，再计算滚动位置；不对未挂载DOM盲目调用scrollIntoView，也不偷偷发起扫描。

## 有界性与读取保证

| 边界 | 本票行为 |
| --- | --- |
| 5000条 / 2MiB编码DTO缓存 | 保留既有上限；到任一上限停止续扫、游标失效，并明确当前不完整 |
| Key原字节至多64KiB | 分组不截身份；非法UTF-8、空Key、BOM和规范化形式保持区别 |
| 树深16层 | 更深字节保留在叶名称/原身份；不构建无限递归树 |
| Host单页/接收/外发 | 继续原SCAN COUNT提示100、页至多4096身份、接收/外发各1MiB及既有请求预算，不把界面虚拟化当作网络内存约束 |
| 显式读取 | 分组操作零Redis命令；只有扫描/选择/刷新进入已有只读命令白名单 |
| 取消/超时 | 取消停止等待、旧页不进入缓存；生产总截止10秒；不声称Redis计算立即停止，重连不重放读取 |
| 同名/同类型替换 | SCAN和多命令读取非原子快照；无法证明未发生并发同类型替换，需用户显式刷新 |

2MiB是现有Key DTO编码计量，**不是浏览器JS堆上限**。树索引、标签、Set、React状态及渲染本身另有开销；源缓存条数/编码字节、16层结构和DOM窗口共同约束本票规模，没有测量或声称整个进程占用不超过2MiB。

## 当前实际验证

候选包`563388a2…`在项目隔离web profile安装；原生脚本递归比较实际安装`lib`集合和字节，拒绝同版本旧包。官方独占Redis镜像夹具使用随机owner、自建端口/密码、独立管理员种子和有界RESP代理；不连接用户业务库，不改日常profile。

- 严格Host/Client/tests TypeScript、完整构建及232项回归通过，含新增6项命名空间专项。
- 第22项真实原生25组通过：5105条在5000缓存停止；562px视口只挂25行；58页增量扫描。512个约4KiB名称在368条/41页触发2MiB编码缓存，数量未伪称完整。
- 实际900/340px原生手柄布局通过；340px的Key栏128px、详情211px，横向溢出0。
- 无读取展开/键盘移动/模式与分隔符切换/无效草稿/定位/MATCH编辑通过代理命令计数核对；选中值和原字节身份保留，增量锚点与偏移相同。
- 空Key、二进制前缀、空段/重复段、目录与叶碰撞、Unicode形式和深层路径通过模型专项及实际原生链路。外部管理员删除/变型后，显式刷新去旧值并路由到实际List；伪造新代次在发命令前拒绝。
- 实际受限ACL用户SCAN返回固定权限错误且无行/游标；手动正常重连只AUTH/PING，不重放扫描。
- 真实Redis SCAN回复在独占代理处延迟，原生取消后旧页/游标丢弃、排空不重放；实际生产截止10109ms，手动重输密码连接进入新代次。
- 代理观察的插件命令仅SCAN/TYPE/PTTL/STRLEN/GETRANGE/LLEN/LRANGE/AUTH/PING；管理员种子、删改和ACL属于测试夹具。观察的二进制/空/普通源DUMP与绝对过期保持不变。
- 原生pageerror和console error为空；1条预期取消`ERR_ABORTED`保留。自建DSH/浏览器、代理、Redis及本轮目录均正常退出/回收。

同包全12类/双会话/SDK与React87组、工作台24组（22个几何样本）及树顶补图25组均通过。前两套page/console错误为空，布局request失败为空；全类型1条会话取消、命名空间1条SCAN取消ERR_ABORTED如实保留。最终三套资源回收均true。实际包79文件、lib70集合/字节、12Host peer、2生产依赖和138源输入SHA逐项一致。旧工作台包509aa7b0的TLS/恢复结果保留其原范围，不计入本包检查数。

## 阶段失败与适用范围

候选`e7db52a6…`首轮在14组后实际900px手柄超时：该入口用了1440px浏览器视口，宿主主区约束使侧栏达不到900px。原false报告/日志/截图保留，浏览器错误为空，资源清理true。仅将测试入口视口改为既有布局专项的1920px，没有修改宿主、注入宽度状态或放宽断言。随后把缓存替换清展开状态的修正纳入候选`563388a2…`重跑，不能合并两包通过项。

不覆盖Sentinel/Cluster/SSH、生产负载压测、任意大Key/模块结果、屏幕阅读器人工验收或全进程堆上限。P1后续23–29仍未在本票实现；聚焦搜索/JSON折叠、资料导入导出、服务器概览/慢日志/客户端、自动刷新、时序图表分别属于后续原票。

## 同包原件与复现

42份原始文件及1份归档清单位于[artifacts/22-key-namespaces](artifacts/22-key-namespaces/evidence-inventory.json)，每份均与.scratch/artifacts源件逐一核对SHA，阶段false与通过报告分名保留。安装包为.scratch/artifacts/dsh-redis-563388a2e6803e188328defc0414a14fa0b728623c5681191678735dc21519fb.tgz；包版本仍0.1.0，以SHA区分。源码父提交为e05bec047336157c7f66d89d655e6b0e0ae05bac，源输入详细SHA在清单内，不把父提交写成包含本票代码的提交。

| 证据 | 本次结果 |
| --- | --- |
| [命名空间原生报告](artifacts/22-key-namespaces/native-namespaces-smoke.json) | 25组；5000/368条两类上限、25挂载行、10109ms截止及清理true |
| [全部类型及会话报告](artifacts/22-key-namespaces/native-ui-release-smoke.json) | 87组；12类、会话和实际SDK/React |
| [工作台报告](artifacts/22-key-namespaces/native-workbench-smoke.json) | 24组、22个几何样本、中英与明暗 |
| [实际包/安装/源输入清单](artifacts/22-key-namespaces/workbench-release-manifest.json) | 79文件/70lib、12Host peer、2依赖、138源输入 |
| [严格检查和打包输出](artifacts/22-key-namespaces/namespaces-pack-console.log) | 类型、构建及232回归 |
| [900px命名空间实际截图](artifacts/22-key-namespaces/native-namespaces-wide.png) | 连接/DB、树形目录与数据三栏，树顶显示5000及组内已加载计数 |
| [340px命名空间实际截图](artifacts/22-key-namespaces/native-namespaces-narrow.png) | Key/详情保持并列，分组计数可见 |
| [中文工作台实际截图](artifacts/22-key-namespaces/native-workbench-panel-wide-zh.png) | 原生语言菜单切换，JSON大整数原文保留 |

复现时在项目根目录、新的PowerShell会话设置本机路径（记录的真实路径见包清单actualCli和运行收据），使用E盘TEMP/TMP和NODE_OPTIONS=--max-old-space-size=512 --max-semi-space-size=4；REDIS_TEST_BACKEND=wsl-image，REDIS_TEST_PYTHON为本机Python，DSH_CLI_ENTRY为固定rc.2实际CLI，REDIS_BROWSER_EXECUTABLE为Chrome。先pnpm pack并把对应SHA包安装到本项目.scratch/runtime/dsh-home的web profile；不要使用用户日常DSH_HOME。

随后每种模式使用新终端设置REDIS_SMOKE_CONNECTIONS=1和REDIS_SMOKE_KEYS=1，运行node scripts/smoke-dsh.mjs：命名空间另设REDIS_SMOKE_NAMESPACES=1；工作台另设REDIS_SMOKE_LAYOUT=1；全类型另设REDIS_SMOKE_RELEASE=1、REDIS_SMOKE_SESSIONS=1及STRINGS/HASHES/LISTS/SETS/ZSETS/STREAMS/JSON/BITMAP/GEO/HLL/TIMESERIES/BLOOM各自对应REDIS_SMOKE_前缀变量为1。三种模式顺序执行，避免并行WSL夹具探测。包核对用相同环境运行node scripts/verify-release-package.mjs。

本轮未重复执行完整TLS冷重启17/17或19的所有GETRANGE/EOF恢复门禁；这些Host源码未改，历史结果见21工作台发布文档且保留旧包身份。新包SCAN取消/真实10秒截止/手动新代次、本票读取链路及原12类型/双会话则均为上述本轮实际证据。

同包工作台首轮11组后曾因测试仍强制focus旧button而把目录活动行0当目标178，false报告另存namespaces-563388a2-keyboard-*；改为目录Home/实际方向键/Enter后24组全过。未改产品迎合测试、未接受错误Key或移除滚动/焦点/无重读断言。归档第一次在组装收据时遇到REPL变量未持久化而停止；随后重读清单、写入并逐项核对完成，原件和源码未改写。
