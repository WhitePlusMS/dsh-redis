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
