# 07 Hash 字段、增量表格与单元格字节预览验收

日期：2026-10-16，Asia/Shanghai。DSH 0.2.0-rc.2，Node v22.22.1，Redis 8.2.6；使用项目内独立 DSH_HOME 与官方固定镜像文件/WSL 专用 Redis，没有使用用户业务 Redis 或日常 profile。

验收包 SHA256：`b40053d5f87ac494bd44bd42d331660410f27c22fc11d3d65f0f4c0c3839d558`。官方 plugin 命令安装带 SHA 文件名的本地包；启动前与补充测试后均核对安装 lib 和构建的 36 个文件逐字节一致。

## 实际结果

- Host/Client/tests 严格类型、构建和 82 项回归通过，Hash 专项 16 项。包含显式取消、会话令牌释放、过期令牌/错误目标、刷新竞态、精确字节、空字段、边界、失败状态、输出预算和两端严格协议。
- 真实 Redis 6 组通过：二进制与空字段/值、毫秒 TTL、64 KiB 值前缀与 UTF-8 上下文；230 字段真实续扫、111 个 MATCH 结果、非匹配扫描；HGET/HGETALL/写命令计数不增加，DUMP 与绝对过期时刻不变；最小读取 ACL 与明确拒权；大字段、JSON 放大和接收超限；旧 DB 代次与实际回复间类型/数量/删除变化。
- 边界夹具明确区分三层：65,537 字节字段在已接收帧内被应用拒绝，连接继续可用；6 对各 64 KiB 字段和值的 RESP 页低于 1 MiB，Base64/JSON 放大后整页拒绝，不返回部分行或续读令牌，连接仍可用；2 MiB 值由接收层拒绝，仅关闭对应连接，手动重连恢复。
- 原生安装包 26 组通过，回归连接/TLS/DB/Key/String，同时验证 Hash 自动路由、235 个原始字段去重行、二进制与空单元格、JSON 大整数/指数、显式 Base64 解码、部分值提示、字段 MATCH、消失与类型变化清空。
- 已查看真实 Hash 截图。自建 DSH/浏览器/Redis 已关闭，证书和 UUID 夹具目录已清理；缓存与固定镜像文件留在 E 盘忽略目录。

## 行为与限制

固定 `TYPE/PTTL/HLEN/HSCAN`；每次显式操作只执行一次 HSCAN，多个命令共用 10 秒总截止。字段身份是完整原始 Base64，显示文本不用于重建请求。空字段合法；重复字段按字节身份去重并更新已加载值。原始值前缀保持字节，不代表完整值身份。

HSCAN 的 COUNT 是提示，紧凑 Hash 可能一页返回全部内容。字段 MATCH 是服务端扫描条件，HLEN 是整张 Hash 的字段数，不能当匹配总数；界面区分已加载、扫描结束、仍可继续和缓存超限。缓存上限为 5000 行及 2 MiB 编码数据，达到上限时当前表格明确不完整。

字段上限 64 KiB；值外发最多前 64 KiB，另带最多 3 字节后文用于 UTF-8 边界；显示实际原值长度，部分内容拒绝完整 JSON 格式化。HSCAN 本身不支持大值字节分页：1 MiB 整帧接收预算可能拒绝整页或巨大单值，缩小 MATCH 也不保证任意巨大单字段能读取。接收预算、外发预算与浏览器缓存分别生效。

读取前后检查类型与字段数量，变化时丢弃整页；同类型同数量的并发替换不能据此检测，多个命令及多页均不是原子快照。刷新会重新开始扫描，取消/失败后不能重放旧令牌。无 HSET/HDEL 或任意命令接口。

公共表格和字节预览供后续集合使用；窄屏/明暗完整收口、List/Set/ZSet/Stream 和特殊类型仍按后续任务验收。本票通过不代表完整首版完成。

## 复现与证据

`pnpm check`；真实读取为 `node scripts/smoke-redis-hashes.mjs`，显式设置 `REDIS_TEST_BACKEND=wsl-image` 使用已核验的固定镜像。原生脚本使用既有专用 profile，设置 CONNECTIONS/TLS/KEYS/STRINGS/HASHES 对应的 `REDIS_SMOKE_` 开关为 1；CLI 和浏览器路径显式指定，安装前重新打包并按 SHA 文件名安装。

机器证据：[真实 Hash](07-redis-hashes-smoke.json)、[原生 UI](07-native-hashes-smoke.json)。首次原生检查发现 String 翻页丢格式状态，修正后完整重跑通过；失败与修正过程记录于 UPDATE_LOG.md，未冒称首次通过。

命令语义依据：[HSCAN](https://redis.io/docs/latest/commands/hscan/)、[SCAN 的通用扫描约束](https://redis.io/docs/latest/commands/scan/)、[HLEN](https://redis.io/docs/latest/commands/hlen/)。

![Hash 原生单元格预览](E:/项目demo/dsh-redis/docs/verification/07-native-hash-data.png)
