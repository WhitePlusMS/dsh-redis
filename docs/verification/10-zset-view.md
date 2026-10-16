# 10 ZSet 成员、分数与两种分页验收

验证日期：2026-10-16；DSH为用户指定0.2.0-rc.2，仍如实标为RC。本票完成不代表完整首版或所有平台/服务器版本通过。

## 环境与产物

- Node22.22.1、pnpm11.22.0、精确rc.2 CLI/SDK，独立DSH_HOME/test profile，非用户日常profile。
- Redis8.2.6固定官方镜像文件，显式wsl-image执行：image digest ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e；amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e。不是Docker执行验收。
- 包SHA256：`b88718983687ec21719c933f9c4cb06becdcf6c54598122c2f5c04d301150b00`。按SHA命名安装，安装lib与当前构建46文件逐字节一致。
- 严格Host/Client/tests类型、构建及125项回归通过（ZSet15项）；真实Redis7组、当前安装包原生40组通过，包含Set/Hash/List/String/TLS/DB回归。两张ZSet截图已查看。

## 行为与边界

1. rank模式固定ZRANGE WITHSCORES，分数升序，同分由Redis按成员字节排序，零起排名/偏移保留为精确整数文本。当前区间最多100行，不积累为伪快照；真实0/100/200区间及signed64最大EOF通过，原生235成员末页35行，非法排名有明确提示。
2. scan模式固定ZSCAN MATCH COUNT100，返回无序成员/分数，不显示排名或假全局排序；完整原始成员身份去重，重复返回更新分数。真实231成员多页、MATCH111/0；原生235成员和MATCH111/0通过。rank与scan请求/结果严格分离，切rank使旧scan令牌失效，切换UI取消旧结果。
3. 成员完整Base64字节身份最多64KiB，空成员/非法UTF8/二进制可选中。分数展示Redis实际回复文本，不通过Number重写，也不承诺还原最初ZADD输入拼写：Redis会把输入-0规范为回复0。固定实际样本断言-inf、0、1.0000000000000002、1e+100、inf，成员JSON的大整数/指数原文和显式Base64解码也通过。
4. 固定TYPE/PTTL/ZCARD/ZRANGE或ZSCAN与后置元信息检查；无ZADD/ZREM/ZPOP/任意命令入口。读取前后DUMP、绝对过期时刻和相关写命令计数不变；最小ACL两模式成功，拒ZSCAN显示permission且rank仍可读，ZADD被服务端拒绝。
5. 65537字节成员整页拒绝，不用前缀替换身份；rank和scan的低于1MiB原始页经JSON放大后超限也整页拒绝，socket仍可用。2MiB成员在有界接收处拒绝，仅关闭自身连接，手动重连恢复。全帧/外发各1MiB，scan缓存5000行/2MiB，COUNT只是提示。
6. 单次操作10秒总截止，旧DB/代次、取消、令牌错目标/重放/迟到及会话清理由专项验证。真实两模式读取回复间由自有夹具管理员改变数量、类型或删除Key均丢弃旧行。原生超限后切健康Key恢复，消失/类型变化清空表格。

## 验证限制与清理

读取不是原子快照：数量不变的分数或成员变化可能逃过前后基数检查；区间后续排名可能随并发变化偏移，扫描也无全局排序/快照承诺。巨型单成员在减少条数/MATCH后仍可能不可读。保留原始ZSet入口供后续GEO查看，不在本票虚构GEO已完成。

首次真实对照使用默认RESP3管理员返回数字而失败，第二次独立RESP2 duplicate因客户端维护功能不支持而失败；均已清理且未计为通过。停止为该对照叠加配置，采用固定Redis8.2.6已知成员/分数字节样本断言，产品逻辑未为此修改，最终7组通过。

自有Redis、DSH、浏览器已停止，证书和UUID配置已删除，未改用户业务Redis或日常profile。机器证据：[Redis](10-redis-zsets-smoke.json)、[原生](10-native-zsets-smoke.json)、[rank截图](10-native-zset-data.png)、[scan截图](10-native-zset-scan-data.png)。官方语义：[ZRANGE](https://redis.io/docs/latest/commands/zrange/)、[ZSCAN](https://redis.io/docs/latest/commands/zscan/)、[ZCARD](https://redis.io/docs/latest/commands/zcard/)。
