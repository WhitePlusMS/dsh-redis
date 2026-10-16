# 14 GEO 有界坐标查看验收

日期2026-10-16。目标DSH为用户指定0.2.0-rc.2（RC），CLI/SDK同版；Node22.22.1、pnpm11.22.0。独立DSH_HOME/test profile、自建Redis8.2.6固定官方镜像文件，通过wsl-image运行，不是Docker验收，不访问业务Redis。

## 产物和验证范围

- 包SHA-256：`5daea558886be622c7ea145dd53534eaa0ca5fb0dcff5078b401bcff29654089`，按SHA命名安装到项目测试profile；安装lib与构建60文件完整集合和内容逐字节一致。
- 三层类型、构建、完整176项回归通过，包含GEO14项及TCP协议7项。此前仅离线169项记录不冒充本次完整回归，二者分别保留。
- 真实Redis8组已有记录已核对并原样归档；其后GEO生产代码未变化。当前包原生主流程62组、独立禁用GEOPOS环境15组通过。两张GEO截图已查看。
- image：redis:8.2.6-alpine@sha256:ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e；amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e。

## 行为与边界

1. 由ZSet手动进入坐标视图，保留原始ZSet入口；普通负数/小数等分数也可返回坐标，不以GEOPOS成功确定业务类型。保留原始成员字节身份、排名与分数字符串，坐标按服务器原文显示并说明geohash量化误差。
2. 固定TYPE/PTTL/ZCARD/ZRANGE/GEOPOS，一次10秒总截止、可信session/DB/generation前后守卫。排名区间最多100项；原生235成员按100/100/35续读，EOF与最大Int64偏移精确，草稿不发请求，非法输入保留已提交结果。
3. 共用ZSet完整成员/分数解码，单成员最多64KiB。Key加成员原字节在组装GEOPOS参数前合计检查96KiB，传输请求128KiB、接收/对外回复各1MiB。真实请求/响应超限验证分别记录；原生超预算不截断身份，减为1项可在同一连接恢复。
4. 二进制、空、JSON和Base64编码成员保留完整身份；原生字节预览/大整数JSON断言通过，未将显示字符串反向作为Redis参数。表格当前列数字允许换行；完整窄宽/主题交互仍由20号任务收口，不宣称该任务已完成。
5. 真实读取前后DUMP、绝对过期时刻和GEO/ZSet写命令计数不变；最小读取ACL可用，GEOPOS拒绝是permission，GEOADD仍被禁止。原生实际权限拒绝清旧行、恢复权限可重新读；原生源DUMP与过期时刻不变。
6. nil位置单独显示，不丢弃整个ZSet。真实reader记录证明同基数成员替换竞争会产生nil；原生nil UI分支使用明确标记的响应故障注入验证，不冒称UI当次由真实竞争产生。其他坐标和成员保持可读。
7. 无命令使用自建实例启动时实际rename-command GEOPOS禁用，并由管理员unknown-command断言确认；该独立原生环境显示unavailable且能返回ZSet。与权限错误、Key缺失/转型分别验证，非合成无命令异常。
8. 元信息变化、实际DB代次/权限/超时/取消/预算在专项及真实reader层验证；原生删除或转String会移除旧坐标。不会承诺原子快照；相同基数/类型的并发变化可能无法完整检测，统一慢请求/会话恢复仍在19号任务。

## 首次脚本失败与清理

首次主流程因新增测试把decode-json选项误写为decodedJson，在53组后超时；生产代码未变。修正选项后以同一包通过62组，并明确设置30秒步骤超时。首次失败记录留在.scratch/artifacts/native-geo-first-attempt-smoke.json。曾尝试定位自建浏览器提前关闭，但PID唯一性保护未通过，没有终止任何进程；原运行自行超时进入finally并完成清理。

所有本轮自建Redis、DSH和浏览器已停止，证书与UUID目录清除，报告清理字段true。未动日常profile或用户服务、未提交/push。

隔离profile的pnpm peers check实际报13个missing peers，原生加载成功不能代替共享依赖版本审计；21号发布门禁保留该核对，不盲目安装额外React或宿主副本。此票通过仅限GEO和所列回归，不代表全部29票或完整首版通过。

证据：[真实Redis](14-redis-geo-smoke.json)、[原生主流程](14-native-geo-smoke.json)、[实际无命令环境](14-native-geo-unavailable-smoke.json)、[坐标表](14-native-geo-data.png)、[成员预览入口](14-native-geo-member.png)。官方语义：[GEOPOS](https://redis.io/docs/latest/commands/geopos/)、[Geospatial](https://redis.io/docs/latest/develop/data-types/geospatial/)。
