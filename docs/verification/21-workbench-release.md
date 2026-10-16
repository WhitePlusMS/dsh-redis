# 21：Database/RESP 新工作台安装包完整复验

2026-10-16。按用户指定的DSH 0.2.0-rc.2运行，明确为RC预发布版。此次完成20界面重做后的21复验；[旧bb2b83e验收](21-release-verification.md)保留原包范围，不代替以下新包结果。01–21完成不表示29票全部完成，22–29仍待开发。

## 最终交付身份

| 对象 | 实际核对 |
| --- | --- |
| 项目 / 插件 | E:\项目demo\dsh-redis / dsh-redis@0.1.0 |
| tgz SHA-256 | 509aa7b06132ab0fa3123bafca18f75f43df10ac019c00cfbffdcfc950373e43 |
| 宿主 | CLI、11个DSH Host peer均0.2.0-rc.2；Cordis4.0.4 |
| 客户端共享React | 真实Web seed与插件require为同一个对象，React.version=18.3.1 |
| Node / pnpm / Chrome | 22.22.1 / 11.22.0 / 155.0.8059.80 |
| 生产依赖 | 实际安装redis6.2.1、zod4.4.3，与锁定一致 |
| 包和安装 | 79个tar常规成员逐字节匹配；lib完整70文件集合与本次构建字节一致 |
| Redis与扩展 | 自建Redis8.2.6；RedisJSON80209、TimeSeries80210、Bloom80212 |
| 镜像 | redis:8.2.6-alpine@sha256:ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e |
| amd64 manifest | f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e |

[当前资源清单](artifacts/21-workbench/workbench-release-manifest.json)记录134个源码/脚本/测试/配置输入、锁文件、包文件、lib和实际依赖路径的SHA。sourceParentCommit为e04c1bf960985bfa11c4aba07f10b79a2d80b177；本次另外修改的会话验收等待边界也按真实文件哈希进入sourceInputs，父提交不冒称包含未提交变化。

pnpm pack只移除实际观察到的packageManager和scripts.prepack开发字段，其余manifest与源一致；安装manifest与tarball一致。安装仍保留shared peer提醒，沿真实CLI realpath解析12个Host peer并观察浏览器实际React，不用复制另一套Host/React来消除提醒。

## 固定来源与复制范围

本次重新从本地原样副本核对HEAD/日期，宿主tag和HEAD一致：

| 来源 | SHA / 提交日期 | 本项目使用范围 |
| --- | --- | --- |
| DeepSeek Harness / dsh-v0.2.0-rc.2 | 639ed015397290b3745d163aafe02ffee4aa3f84 / 2026-09-29T17:21:31+08:00 | 真实Host/Client、侧栏、Typert、共享模块与语言设置API；宿主仍为外部运行时 |
| 自有Git Graph | 33b3e67a39a429a0ff570d82d7264aab735fc1fd / 2026-10-11T09:28:08+08:00 | 裁剪必要注册/构建/侧栏/严格协议骨架，无Git业务 |
| DSH Database | 5d2b900b0317200b1866275c7cf48814fe84b52d / 2026-10-09T21:51:03+08:00 | Redis读取与实际界面操作参考，未复制写入口、其他数据库和整套应用 |

RESP.app 2022.2按用户截图参考分栏操作。新工作台详情见[20界面验收](20-database-workbench.md)：连接配置按需dialog、左连接/DB和Key导航、右数据/元信息、格式工具栏、帮助收起与短状态。窄栏始终保留Key/详情左右，不再沿用旧整页往返；不篡改DSH内部store/壳层宽度。命名空间与聚焦查找仍是22/23，未冒称已实现。

固定副本不等于未来最新版。上游原样checkout和Git元数据不随包分发，MIT来源/全文许可仍随包保留；没有覆盖用户Git Graph工程、全局DSH源码或日常profile。

## 同一最终包的门禁

| 检查 | 结果 / 原始报告 |
| --- | --- |
| 严格类型、构建、prepack | 三层tsc、20测试文件、226项通过；[日志](artifacts/20-workbench/workbench-prepack-console.log) |
| 12类 + 双会话 + 实际SDK/React | 87组通过；[native-ui-release](artifacts/21-workbench/native-ui-release-smoke.json) |
| TLS保存/增改删、错误CA、DB/Key | 17组通过；[save](artifacts/21-workbench/native-ui-profiles-save-smoke.json) |
| TLS冷重启、显式恢复/连接、DB/Key | 17组通过；[reopen](artifacts/21-workbench/native-ui-profiles-reopen-smoke.json) |
| Database/RESP真实分栏、主题、中英 | 24组通过；[20机器报告](artifacts/20-workbench/native-workbench-smoke.json) |
| active/queued取消、10秒截止、TCP EOF | 18组通过；[native-ui-recovery](artifacts/21-workbench/native-ui-recovery-smoke.json) |
| 包/源输入/实际共享版本 | 全部一致；[workbench-release-manifest](artifacts/21-workbench/workbench-release-manifest.json) |

全类型时间UTC为2026-10-16T10:41:02.777Z至2026-10-16T10:42:00.682Z；取消约29ms、实际生产截止10141ms。布局真实拖动300/340/900px、原生Dark/Light和Language菜单切中文/English，中文JSON三栏/页签/大整数保持且不重读，22个几何采样有界。英文全类型及中文布局均限实际范围，不宣称每种类型中文逐项重跑。

五轮pageerror/console error均空。完整会话有1条、恢复取消有2条预期readString ERR_ABORTED；TLS两轮与布局无request failure。报告保留真实失败请求记录，不把预期取消说成全零。

最后仅修改验收脚本的可见控件操作和等待真实响应结束的时序，未改产品源/包；mjs语法和当前原生全门禁通过，不为这些脚本修改重新打包或把旧包当新包。

## P0交付证据

| 任务 | 本次安装版实际覆盖 |
| --- | --- |
| 01–04 | 原生侧栏/Agent RPC、错误请求拒绝，手动普通/TLS测试/连接/断开、错误认证/CA、资料增改删/冷恢复/密码不落盘 |
| 05–06 | 230 Key增量及显式续扫、二进制/空MATCH、DB1/非法DB/恢复；String大值64KiB窗口、UTF-8边界及Text/无损JSON/Hex/Base64/显式解码 |
| 07–11 | Hash/Set原字节去重与MATCH、List原索引和重复值、ZSet rank与scan/精确score、Stream双uint64 ID与重复字段顺序；分页/EOF/删除/类型改变与超限恢复，未推进消费组/Pending |
| 12 RedisJSON | 真模块根/JSONPath匹配数组、null与无匹配区分、超预算拒绝与缩路径恢复、数字原文 |
| 13 Bitmap | 普通String手动解释，2MiB源值只读有界位窗口，位序/不对齐/末尾与越界不伪造零 |
| 14 GEO | ZSet手动解释，原成员/rank/score及量化坐标、ACL与组合请求超预算，返回原ZSet |
| 15 HLL | sparse/dense/空/坏表示、估算/缓存标识与权限；重复同Key的PFCOUNT union不写回源缓存，不声称可枚举成员 |
| 16 TimeSeries | 真模块235样本、正反向范围、int64原文、INFO部分权限/范围拒绝、畸形时间戳拒绝及恢复 |
| 17 Bloom | 真模块INFO/EXISTS、空/二进制/4KiB查询项、真实假阳性、非扩展过滤器、Cuckoo区分及畸形确定存在拒绝 |
| 18–19 | 共享资料/独立DB、Key、格式、窗口；迟到A不覆盖B、切换无Redis命令；取消排空/超时/EOF不影响B，显式重连新generation且不重放 |
| 20–21 | 12类共享紧凑工作台、dialog/页签/帮助/格式不重读、局部滚动/精确数字/空错加载态、中英/明暗、当前包资源闭包与原始证据 |

23个RPC均通过真实SDK结果decode，畸形成功payload得到gateway/internal并可恢复；共享严格schema在UI状态/缓存前验证。该route故障专项零Host派发，不冒充真实Redis功能；真实读取由87组实际数据轮覆盖。编译bundle也检查全部23个decoder，没有新增23套包装、任意命令或兼容层。

## 数据预算与只读范围

| 范围 | 保持的硬边界 |
| --- | --- |
| RESP / 队列 | 单帧1MiB、请求128KiB、行头4096B；连接8秒/读取共享10秒、每连接最多16项队列 |
| Key / 缓存 | 完整Key最多64KiB，单页最多4096项/1MiB JSON；本地最多5000项/2MiB DTO |
| String和集合预览 | 窗口/值前缀最多64KiB；巨型集合单回复仍受完整RESP预算约束 |
| List/ZSet/GEO | 区间最多100项，GEO Key+成员最多96KiB；完整成员超限整页拒绝 |
| Stream / TS | 每页最多100；Stream字段对最多4096，TS时间戳和值保留原文 |
| RedisJSON / Bitmap / Bloom | JSONPath完整匹配最多64KiB/4096项，无伪分页；位图每次最多4096位/513字节；Bloom每次1项最多4KiB |

只读transport未变。测试的SET/ACL/删除/类型转换/断线均由独占管理夹具发出；生产界面无写入口或任意命令。布局逐一比较12种源DUMP/绝对过期，其他轮检查源字节、JSON及Stream group/Pending；取消不承诺服务器停止计算，超限/部分/近似/概率语义保留。

## 原始记录、清理和未覆盖范围

原始报告、脱敏DSH日志、console、会话B与恢复截图共35份归档在[21-workbench](artifacts/21-workbench/workbench-release-manifest.json)同目录，均逐项匹配源件SHA；中文真实截图及加载/主题/数字局部滚动见20归档。已查看中文pane、窄深色数据、恢复fresh及B会话截图。

保留完整失败链：首轮74条console检查后modal阻挡状态按钮导致未处理超时，未写最终报告，单独记录为未通过的中断结果；83组轮漏打开A设置入口失败；下一83组轮命令基线与上一次显式读后检重叠失败。分别保留interrupted/session-modal/session-counter原件，不将其改为成功。修正为实际字段操作才开dialog，事件与点击用Promise.all，B新读取真实HTTP响应及其sampledAt渲染后才取基线。无固定sleep、计数豁免或产品补丁，最后同包87组通过。会话21组小夹具和最初TLS连接配置13/13组是阶段记录；最终TLS开启KEYS后17/17组重新通过。

最终五轮所有自建DSH/Chrome、Redis、TLS证书/UUID目录退出/回收，Host socket回管理员基线，恢复代理停止。中断的97c1b089轮另行只读核实专属Windows进程不存在、Linux PID269不存在，再核对绝对路径后回收该UUID/同owner资料；没有声称其finally成功。先前16快照/18两对被自动审批拒绝清理的目录仍按旧记录保留，没有重试删除。

未操作用户业务库/日常profile/已有服务或清理C盘。实测仅指定rc.2 CLI/Web、官方Redis8.2.6指定模块；其他桌面核心/宿主/Redis/模块版本、TLS慢链路取消、Cluster/Sentinel/SSH等未验证。8张P1继续按原图，不因本次UI改版增加写功能或冒称29票完成。

## 复现

使用随包README的独立安装步骤，TEMP/TMP指向E盘测试目录；pnpm check或pnpm pack执行类型/构建/226回归。SHA文件名tgz只装本项目DSH_HOME=.scratch/runtime/dsh-home的web profile，避免同版本包缓存。

公共环境REDIS_TEST_BACKEND=wsl-image、REDIS_TEST_PYTHON、DSH_CLI_ENTRY、REDIS_BROWSER_EXECUTABLE均显式绝对路径；node scripts/smoke-dsh.mjs，环境开关前缀REDIS_SMOKE_，值1，未列模式关闭：

- 全类型/会话：CONNECTIONS、KEYS、RELEASE、SESSIONS、STRINGS、HASHES、LISTS、SETS、ZSETS、STREAMS、JSON、BITMAP、GEO、HLL、TIMESERIES、BLOOM。
- TLS双阶段：CONNECTIONS、KEYS、TLS、PROFILES。
- 布局/中英：CONNECTIONS、KEYS、LAYOUT；恢复：CONNECTIONS、KEYS、RECOVERY；各独占WSL夹具串行。
- node scripts/verify-release-package.mjs读取当前包、安装与源输入，写workbench-release-manifest.json，不启动服务。

测试及脚本受版本管理；原生route注入限定测试浏览器，不把HTTP故障当作服务器卸载模块或停止计算。
