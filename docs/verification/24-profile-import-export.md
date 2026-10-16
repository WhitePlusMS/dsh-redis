# 24：连接资料分组、URI与导入导出实现说明

本票已验收，宿主固定0.2.0-rc.2。当前包SHA256：37b335ddb15a12056c1eb3885c83cd879b971af49b66797fc26027831af7e5e0，117420字节。三层严格类型/构建/250回归、实际资料两轮18/17、全12类/双会话/SDK与React87、工作台24、TLS配置冷重启两轮17/17均在同包通过。各套含共享基础检查，不相加冒称互不重复场景。01–24 done，25–29待实施，原29票依赖/优先级不变。

## 功能与操作

1. 在原连接设置窗口选择资料，可修改名称和分组，保存后保持原id。左侧按组显示连接，下拉菜单也分组；不填分组表示未分组。主工作台保持Database/RESP的连接、Key与详情分栏，不把新说明铺到默认界面。
2. 按需展开“从Redis URI填写”，粘贴基础redis/rediss URI并点填写草稿。原URI立即清空，只将解析结果放到现有表单；密码不保存。URI中的DB只填会话草稿，连接仍从DB0开始，必须手动选择DB。
3. 展开“导入/导出连接资料”，点导出生成本地JSON文件。只包含名称、可选分组、地址、端口、用户名、TLS布尔开关；不含密码、CA PEM、URI、连接id/generation或浏览数据。
4. 选择本插件资料文件先看预览，可修改各行名称/分组，或取消勾选。与现有或本批次同组同名时阻止提交，须明确改名、改组或跳过；没有隐式覆盖策略。
5. 点“导入选中资料”后，Host重新核对当前存储并整批新增。不覆盖既有项，不改变当前选中资料、表单或已填密码草稿，不自动连接。TLS导入不带CA，使用私有CA时需要手动补填。
6. 关闭设置清原URI、密码和导入预览；迟到文件结果不会重新出现。重开或冷重启后资料/分组保留，选择资料只恢复公开配置，仍需手动输入密码和连接。

## 文件与职责

| 文件 | 责任 |
| --- | --- |
| [domain.ts](../../src/domain.ts) | 可选group、PortableConnection、ProfileDocument和ImportProfilesRequest及50条/256KiB边界 |
| [typert.shared.ts](../../src/typert.shared.ts)、[typert.host.ts](../../src/typert.host.ts)、[typert.remote-client.ts](../../src/typert.remote-client.ts) | Host/Client同规严格codec与第24个RPC方法importProfiles |
| [profile-transfer.ts](../../src/profile-transfer.ts) | 同组同名比较、显式白名单导出、有界资料文档解析 |
| [connection-uri.ts](../../src/connection-uri.ts) | 无副作用基础URI解析；返回请求草稿/DB或固定null |
| [profile-store.ts](../../src/host/profile-store.ts)、[remote-service.ts](../../src/remote-service.ts) | 原profile目录内串行整批导入、重验冲突/容量、新id及一次原子写 |
| [ProfileChooser.tsx](../../src/client/ProfileChooser.tsx) | 唯一资料列表/选择owner，分组与refresh/follow/keep结果策略 |
| [ConnectionUri.tsx](../../src/client/ConnectionUri.tsx)、[ConnectionForm.tsx](../../src/client/ConnectionForm.tsx) | URI秘密输入和既有表单/密码/连接动作的单一归属 |
| [ProfileTransfer.tsx](../../src/client/ProfileTransfer.tsx) | 有界文件读取/预览、显式勾选/改名/分组、下载与迟到结果隔离 |
| [styles.ts](../../src/client/styles.ts)、[locales.ts](../../src/client/locales.ts)、[tsconfig.client.json](../../tsconfig.client.json) | 设置内按需入口/有界滚动/双语，以及两个共享模块的明确编译清单 |
| [profile-transfer.test.ts](../../tests/profile-transfer.test.ts)、[connection-uri.test.ts](../../tests/connection-uri.test.ts)、[profile-store.test.ts](../../tests/profile-store.test.ts)、[host-typert.test.ts](../../tests/host-typert.test.ts) | 秘密/格式/字节/URI/并发/原子失败与两端协议专项 |
| [smoke-profile-transfer.mjs](../../scripts/smoke-profile-transfer.mjs)、[smoke-dsh.mjs](../../scripts/smoke-dsh.mjs) | 实际上传下载、两轮DSH进程、资料重开/手动连接与owner清理 |

保持现有RemoteResult及领域DTO返回链路；这是DSH Typert插件，未新增Nest响应包装、通用命令入口或依赖。新增RPC只管理本地配置，Redis只读命令白名单未改。

## 可移植资料格式

唯一支持的资料格式如下；没有原Database/RESP专有格式自动转换、旧版本迁移或旧接口兼容分支。存储文件与可移植文件各有明确职责，不能将本地connections.json原样作为导入文件。

~~~json
{
  "format": "dsh-redis-connections",
  "version": 1,
  "profiles": [
    {
      "name": "本地开发",
      "group": "开发",
      "settings": {
        "host": "127.0.0.1",
        "port": 6379,
        "username": "reader",
        "tls": false
      }
    }
  ]
}
~~~

每层对象都拒绝额外字段。名称及非缺省分组必须非空、去两端空白后不再变化，最多80个UTF-16代码单元；group省略表示当前模型的未分组，不新增迁移路径。地址/端口/用户名沿用既有严格连接校验。资料文件最多50条，实际导入请求必须至少1条。文档允许导出空集合，界面没有选中项时不提交。

TLS在可移植格式中是布尔值，在本地设置中才是null或包含caPem的对象。导出显式逐字段构造，连本地公共CA也不带出；运行对象意外多带秘密时也不会整体序列化。带password/caPem/URI/id等字段的输入直接拒绝，不偷偷过滤后导入。

## 完整实现方法

### URI只生成表单草稿

格式和编码依据[Redis官方连接URL文档](https://redis.io/docs/latest/develop/clients/connection-urls/)；URL字段行为参考[Node官方URL文档](https://nodejs.org/docs/latest-v20.x/api/url.html)与[node-redis配置](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md)。实际运行与验证仍为项目固定Node/CLI版本，不因资料链接更换运行时。

输入最多16384个UTF-16代码单元。先去除剪贴板外层空白，检查小写redis/rediss、基础authority和纯数字DB路径，拒绝查询、片段、内嵌空白/控制字符、反斜杠和点段；不让URL归一化把/2/..静默变成其他DB。encodeURI先拒绝畸形UTF-16，再用URL解析；用户名/密码分别decodeURIComponent，IPv6去除地址外方括号，缺省端口6379，DB0–65535，最后交原ConnectionRequest schema核用户名256、密码4096等字段上限。任何异常只返回null，界面固定错误不拼接原输入。

ConnectionUri自己只持有临时URI输入、固定错误和DB提示。成功时ProfileChooser先切新建，ConnectionForm再接收host/port/username/password/TLS/CA；BrowsingSession只更新DB草稿并清旧Key。不会调用connect或SELECT。提交清URI、设置关闭/连接成功清密码；密码不会进入SaveProfileRequest、ProfileDocument或浏览状态。

### 文件读取与预览

File.size先检查256KiB，再await arrayBuffer并检查实际字节数；使用fatal UTF-8解码，坏字节直接失败，避免地址被替换为�。该行为依据[WHATWG Encoding规范](https://encoding.spec.whatwg.org/#interface-textdecoder)，并有实际损坏UTF-8文件验收。文本进入parseProfileDocument后再次核UTF-8编码字节，再JSON.parse并严格校验固定format/version及字段。

只把校验后的PortableConnection行保存在内存，不保留原始JSON或文件路径；文件input同步清空以便重选。每次文件读取/提交及关闭都递增序号，异步完成仅在序号一致时更新状态。关闭后旧读取不回填；原文件读取本身没有提供取消或OS磁盘性能保证。

勾选行的名称/分组显式去两端空白，空分组省略；逐次渲染校验所选DTO、容量和冲突。冲突标签为JSON.stringify([group或空串,name])，比较精确Unicode，不折叠大小写/规范化，也不以地址等价推断同一连接。已有和批内重复都纳入同一Set规则，界面显示冲突并禁提交；用户改名、改组或取消勾选后才允许继续。

### Host整批新增与文件原子写

新增importProfiles请求只收非空profiles数组。Typert从可信Agent查当前DSH profile归属，客户端不能传任意文件目录；资料共享范围继续是profileContext.dir。Host和Client各有strict codec，未知/秘密字段在进入存储前拒绝。

RedisProfiles先校验请求，进入既有promise串行队列后重新读取当前资料；验证总数量不超过50，并将当前标签与整批标签一次检查。这样另一面板在预览后新增了同名项也不会被覆盖，而是整批拒绝。通过后为每条创建新UUID，TLS布尔开关转成本地null或空CA对象，合并完整结果后只调用一次原write。返回selectedId=null，ProfileChooser的keep策略仅更新列表，不应用当前表单或改变其选择。

原write严格校验结果，序列化version=1本地资料，编码文件最多4MiB；在既有所属目录请求0700、随机临时文件wx/0600，成功后rename替换，并finally清自身临时文件。冲突、容量或写前取消不会产生部分导入；一旦开始文件写，不提供取消后的事务撤销，结果仍以整批文件替换为边界。未声称Windows实际ACL等同POSIX模式，未新增凭据保险箱。

现有save也采用同组同名检查，重命名/分组沿用稳定id；remove和原配置队列继续原职责。分组导航只处理最多50条本地资料，没有第二套Redis连接控制器。

### 导出与简洁界面

createProfileDocument显式挑name/group/host/port/username/TLS布尔，严格校验后JSON.stringify并核256KiB。点击导出才创建JSON Blob和对象URL，以固定文件名dsh-redis-connections.json下载；finally移除临时a并revoke对象URL。原生验收通过真实download事件和保存后的实际文件核字段，不用剪贴板替身或假文件结果代替下载。

新能力在原设置dialog内，URI与导入导出默认折叠；导入预览内部最大320px滚动，双语沿宿主主题。默认主区域仍为连接/DB、Key、详情；窄栏持续Key/详情左右，帮助仍按需。没有调用宿主私有宽度API或启动开发服务。

## 当前同包实际证据

| 验收 | 实际结果 |
| --- | --- |
| 严格类型/构建 | [最终prepack](artifacts/24-profile-import-export/profiles-pack-console.log)：250回归，新增12项；模型原始检查亦保留 |
| 资料第一轮 | [18组报告](artifacts/24-profile-import-export/native-profile-transfer-save-smoke.json)：真实URI、分组/改名、上传/下载/改名或跳过冲突、坏文件/秘密/损坏UTF-8/容量、保持当前选择/密码草稿、关闭清秘密 |
| 资料冷重启 | [17组报告](artifacts/24-profile-import-export/native-profile-transfer-reopen-smoke.json)：实际新DSH进程重新选择五条稳定id及分组，无自动连接；本地CA保留、导入CA为空，URI草稿DB1需显式选择/扫描才读取 |
| 原12类及双会话 | [87组报告](artifacts/24-profile-import-export/native-ui-release-smoke.json)：实际React身份、全部24个RPC坏成功结果decoder及原权限/变型/预算/只读/会话断言 |
| 工作台 | [24组报告](artifacts/24-profile-import-export/native-workbench-smoke.json)：22几何样本，实际300/340/900px、中英/明暗、加载/空/错误、默认左右及12类源值/过期不变 |
| 真实TLS冷重启 | [保存17组](artifacts/24-profile-import-export/native-ui-profiles-save-smoke.json)、[重开17组](artifacts/24-profile-import-export/native-ui-profiles-reopen-smoke.json)：错误CA拒绝、纠正后真实连接、配置重开/空密码/手动连接及DB/Key链路 |
| 包/输入身份 | [完整清单](artifacts/24-profile-import-export/workbench-release-manifest.json)：148源输入、81包文件/72lib集合与字节、12Host peer、2依赖逐项一致 |

资料操作用独占管理员INFO commandstats前后及客户端数核零额外Redis命令/连接；显式连接、SELECT和读取单独验证。两轮DB0/DB1源DUMP与绝对过期相同。关闭后迟到文件采用明确受控File.arrayBuffer API延迟，并finally恢复函数，不冒称OS慢磁盘测试。

六份原生报告pageerror与console error为空；只有全类型会话的1条预期readString ERR_ABORTED，其余请求失败为空。每轮自建DSH/Chrome/Redis、证书与本轮owner目录均停止/回收；资料专项五条及TLS专项本轮配置按精确owner名称清理。旧owner资料、此前被拒绝清理的目录、用户服务/业务库/日常DSH_HOME与C盘文件不动。

[真实导入预览](artifacts/24-profile-import-export/native-profile-transfer-preview.png)、[分组与DB1数据](artifacts/24-profile-import-export/native-profile-transfer-groups.png)和[中文工作台](artifacts/24-profile-import-export/native-workbench-panel-wide-zh.png)已查看。属于真实新包截图，不是原型或用户视觉确认。

## 阶段记录与未验证范围

模型小目标已提交5eb09d75efd41741eb4059a706b234c9cc95e204，之前23为e55b255。纯状态原型只在prototype/profile-transfer-state分支10ff150b962c997bf8d2bfb02deaa0163136205c，源src/client/prototypes/profile-transfer.prototype.html；ignored副本.scratch/artifacts/profile-transfer.prototype.html可双击。三条引导展示重名、跳过、URI/手动连接；纯内存、无测试/数据库/持久化，主分支不合HTML壳、不绕过file://限制。实际产品根据既有明确约束和实测实现，未称用户另行确认了该原型。

首批模型替换因CRLF预校验在写前停止，未将旧源码typecheck当新模型通过；随后保留行尾。测试接入有两处严格TS错误，分别改为省略可选group及先构造有意坏输入，未用any或放宽DTO。UI首检有英文单引号语法错误，[原输出](artifacts/24-profile-import-export/profiles-ui-first-typecheck-console.log)保留；修复后暴露composite显式include遗漏，[原输出](artifacts/24-profile-import-export/profiles-ui-scope-typecheck-console.log)保留，完整读配置后只追加两条共享路径，没有放宽严格项。主原生脚本首次注入因上下文不唯一停在写前，随后定位唯一阶段；实际资料两轮首次均通过，没有失败报告被覆盖为成功。

未验证用户业务Redis、真实OS权限/只读ACL自动配置、任意第三方资料格式、全进程堆限制或恶意外部进程并发修改配置文件；不支持Sentinel/Cluster/SSH或密码导入/导出。原22命名空间及23聚焦专项保留各自包身份，本票没有把旧包25组合并计入新包。25–29服务器概览、慢日志/客户端、自动刷新和时序图表继续按原票实施。

## 归档与复现

[归档清单](artifacts/24-profile-import-export/evidence-inventory.json)列出43份原始文件及逐项SHA，清单另1份；包括两份已提交模型日志、两份UI编译阶段输出、实际JSON下载、六套原生报告/日志/截图及包清单。每份与.scratch/artifacts源件逐字节核对。构建父提交5eb09d75efd41741eb4059a706b234c9cc95e204只表示模型基线，148项sourceInputs才代表构建时包含未提交UI的实际输入。

包为.scratch/artifacts/dsh-redis-37b335ddb15a12056c1eb3885c83cd879b971af49b66797fc26027831af7e5e0.tgz；版本0.1.0以SHA区分，只安装项目隔离.scratch/runtime/dsh-home的web profile。

用新终端设置E盘TEMP/TMP和NODE_OPTIONS=--max-old-space-size=512 --max-semi-space-size=4，REDIS_TEST_BACKEND=wsl-image；REDIS_TEST_PYTHON、DSH_CLI_ENTRY、REDIS_BROWSER_EXECUTABLE取本机实际Python、固定rc.2 CLI和Chrome（原清单有路径）。pnpm pack后按SHA安装隔离profile，再运行node scripts/smoke-dsh.mjs。每种模式用新终端，共同设REDIS_SMOKE_CONNECTIONS=1、REDIS_SMOKE_KEYS=1：

- 资料两轮：另设REDIS_SMOKE_PROFILE_TRANSFER=1，使用plain夹具，脚本实际save/reopen两个新DSH进程。
- TLS两轮：另设REDIS_SMOKE_PROFILES=1和REDIS_SMOKE_TLS=1；与资料模式分开。
- 工作台：另设REDIS_SMOKE_LAYOUT=1。
- 全类型与会话：另设REDIS_SMOKE_RELEASE=1、REDIS_SMOKE_SESSIONS=1及STRINGS/HASHES/LISTS/SETS/ZSETS/STREAMS/JSON/BITMAP/GEO/HLL/TIMESERIES/BLOOM各对应REDIS_SMOKE_变量为1。

顺序执行各模式，不并行探测WSL夹具。包验证运行node scripts/verify-release-package.mjs。没有npm run dev/start:dev或网页端GPT评审；代码与事实核对使用用户要求的LUNA只读描述，由根模型依据源码/规范及实际证据判断。
