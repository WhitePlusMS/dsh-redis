# 25：Redis服务器概览快照（进行中）

当前01–24done、25in-progress、26–29ready，原29票图不变。尚未实现或验收本票，不能引用旧包通过数作为新功能证据。

## 核实来源和最简边界

- [Redis官方INFO文档](https://redis.io/docs/latest/commands/info/)定义服务器/内存/连接/统计字段与单位。已有本地node-redis6.2.1 INFO定义标记只读；本项目现有transport尚未允许普通INFO。
- 复用现有RedisReadContext、可信会话DatabaseTarget及read前/派发前/返回后代次校验、生产10秒总截止与有界RESP。只增加固定INFO入口，不接受任意命令或section字符串，不改服务器配置。
- 单次无参数INFO，在Host选择redis_version/redis_mode/uptime_in_seconds、used_memory/used_memory_rss/used_memory_peak/maxmemory、connected_clients/blocked_clients、total_connections_received/total_commands_processed/instantaneous_ops_per_sec/keyspace_hits/keyspace_misses/expired_keys/evicted_keys共16项。其余原始文本不进入Client。
- 原RESP接收帧1MiB继续在声明长度/接收前检查；INFO另设128KiB解释预算，在已接收的有界帧内执行，不能将该后置预算冒称网络接收或JS堆上限。固定字段/长度约束结果规模。
- 计数/字节/秒值保留0–18446744073709551615十进制文本，不转Number；未知字段忽略，缺失或不合法值以null明确未报告，重复选定字段拒绝协议歧义。采集时间来自Host本机ISO。
- 界面按独立概览入口和四组结构化指标，显式打开/刷新才读取；取消/关闭/代次切换忽略旧结果。主Key/详情左右工作台不变，本票不做持续轮询或时序图。

## 待验证

先纯解析、严格两端DTO、真实Host INFO reader、固定只读白名单和模型专项；再实际Redis权限/预算/取消/10秒/代次/源数据与安装包。当前五项不勾，不声明UI或真实版本样本通过。

## 模型里程碑

类型检查和25个测试文件/258项测试通过，原始控制台见[模型检查](artifacts/25-server-overview/model-check-console.log)。其中8项为INFO专项，检查固定命令/参数、缺失与零值、uint64精度、未知/重复字段、UTF8/128KiB、严格双端契约、权限/可信会话/DB/代次、取消与10秒截止。尚未连接Client界面，也未将本里程碑冒称真实Redis或原生DSH验收；25五项仍不勾。

## 原生INFO专项已通过（同包其他回归尚在执行）

包SHA `01a92d9112146dbcab48b4a97ab432c7b0334b1ca83eb6dc7d6b985141d2f68a`，122829字节；逐文件核对85个打包文件、76个lib文件、12个Host peers和2个依赖，隔离安装完全匹配。prepack再次通过25文件258项。

Redis8.2.6单机真实样本，原生概览专项21项通过：四组16字段、显式无参数INFO、无自动读取、关闭保留左右分栏/Key字节身份/滚动、真实ACL拒绝与显式恢复；主动取消31ms，队列中已取消INFO不派发；生产10秒截止实际10101ms与EOF均清空旧指标，只结束A连接，B会话仍能读String；手动新代次连接无INFO/SELECT/SCAN重放，旧target零派发。选定Key及二进制Key的DUMP和绝对过期时间不变。自建DSH、Redis夹具、代理全部停止且清理标志为true。页面/console错误为空；两次readOverview ERR_ABORTED是取消/关闭请求的预期记录。

明确区分：超53位值、缺失/零与非法数值响应通过标注的HTTP结果注入验证UI/实际浏览器decoder，不能冒称真实Redis产生这些指标；128KiB与坏UTF8/重复字段预算由模型测试验证，不声称真实INFO曾达到此大小；只验证8.2.6真实版本，跨版本字段缺失由纯解析/严格DTO与注入覆盖。INFO是服务器级，无Key参数，因此Key消失/TYPE改变不对应此入口，不额外伪造TYPE读取。TLS概览专用实连未执行，既有TLS基础不被冒称本项新证据。

## 同包回归、归档与完成

同一SHA包完整数据/会话/真实SDK回归87项、布局回归24项均通过；SDK与真实Web种子使用同一个React18.3.1，25方法全部拒绝非法成功响应。布局包含真实300/340/900px、原生主题/语言切换、加载/错误/空态及12类源值/绝对过期不变；这不是用户视觉确认。所有测试的自建DSH和Redis都结束。完整回归保留1条预期readString主动取消ERR_ABORTED，布局页面/console/request错误均为空。

- [概览报告](artifacts/25-server-overview/native-overview-smoke.json)、[实际样本](artifacts/25-server-overview/native-overview-real-sample.json)、[四组卡片](artifacts/25-server-overview/native-overview-cards.png)、[超时界面](artifacts/25-server-overview/native-overview-timeout.png)
- [完整浏览与实际SDK报告](artifacts/25-server-overview/native-ui-release-smoke.json)、[布局报告](artifacts/25-server-overview/native-workbench-smoke.json)、[中文真实工作台](artifacts/25-server-overview/native-workbench-panel-wide-zh.png)
- [逐文件安装包清单与源码hash](artifacts/25-server-overview/workbench-release-manifest.json)、[归档原字节清单](artifacts/25-server-overview/inventory.json)

归档30份原始文件加1份inventory，包含模型日志、prepack/安装/包核对、实际门禁JSON/log/console/截图；SHA逐一核对，保留原始日志结尾空行。包核对第一次遗漏显式环境变量而前置拒绝，原失败日志保留且未算通过；补齐同一明确环境后核对成功。原生脚本首次语法静态检查的换行转义已在执行前修正。原型分支d1feeac仅作状态一手来源，未合并HTML壳。

本票五项完成，原01–25 done、26–29 ready，原29票依赖未改变；整个项目尚未完成。
