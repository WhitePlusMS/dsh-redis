# 08 List 连续区间、原始索引与单元格验收

日期：2026-10-16，Asia/Shanghai。DSH 0.2.0-rc.2，Node v22.22.1，Redis 8.2.6。使用独立 DSH_HOME 和官方固定镜像文件/既有 WSL 专用实例，没有访问用户业务 Redis 或日常 profile。

验收包 SHA256：`026e85aa56f8921d2bb30987773958ee97517145f61e2f841e03082b883a391d`。按 SHA 文件名安装本地包；安装 lib 与构建的 40 个文件逐字节一致。

## 实际结果

- Host/Client/tests 严格类型、构建与95项回归通过，List专项13项，包含两端严格协议。Hash前缀抽取后真实Hash6组也通过，原生安装包同时回归Hash与String。
- 真实Redis6组通过：二进制Key、重复元素保留独立原始索引、二进制/空/长值、精确TTL；235元素按0/100/200区间到234末位，signed64最大位置返回EOF；DUMP及绝对过期时刻不变、List写命令计数不增；最小ACL与拒权；JSON放大和2MiB元素拒绝；DB旧代次与实际LRANGE回复间插入/类型变化/删除丢弃旧结果。
- 原生安装包31组通过，包含TLS/DB/Key/String/Hash回归及List：237元素首屏100项、相同值不同索引、二进制/空单元格、无损JSON与显式解码、64KiB部分值、0/100/200翻页与末37项、EOF/非法整数输入、插入后刷新以及消失/类型变化清空。
- 已查看List真实截图。自建DSH/浏览器/Redis已关闭，证书及UUID配置目录已清理，仅在E盘忽略目录保留测试缓存和已核验镜像。

## 行为与边界

固定 TYPE/PTTL/LLEN/LRANGE，一次操作共用10秒截止。请求使用非负signed64整数文本偏移，数量1–100，LRANGE的末端包含在区间内，避免浮点索引和差一位。行身份为原始零起始索引，重复值绝不合并；每次只显示当前连续区间，不把多页累积为并发数据快照。

LLEN是读取时总元素数。读取前后类型/数量改变，或返回条数与观察长度不符时丢弃区间。多个命令并非原子快照；相同长度的并发替换或插入加删除不能据此检测，后续索引可能移动，界面明确提示刷新。

单元格复用BytePrefix、CollectionTable和BytePreview：最多返回64KiB原始前缀及3字节UTF8上下文，保留实际元素长度；部分值拒绝完整JSON格式化，Text/Hex/Base64/显式解码与Hash使用同一实现。格式化不写回Redis。

区间条数不是字节保证。接收整帧1MiB与外发JSON1MiB预算分别生效；12个64KiB元素的RESP页可在接收范围内，但JSON放大后整页拒绝，不返回部分行或假nextOffset，连接仍可用。2MiB单元素由接收层拒绝并只关闭自身连接。缩小条数可以减少整页大小，但无法保证任意巨大单元素可读取。

没有LPOP/RPOP/LSET/LTRIM等修改入口，也没有任意命令通道。List只读区间、取消、超时、旧目标及失败状态均有对应证据；本次结果不证明所有Redis版本、桌面平台或整个首版完成。窄屏/明暗完整收口及其他类型仍按后续票推进。

## 复现与证据

`pnpm check`；真实区间为 `node scripts/smoke-redis-lists.mjs`，显式设置 `REDIS_TEST_BACKEND=wsl-image` 使用已核验的官方固定镜像。原生脚本增加 `REDIS_SMOKE_LISTS=1`，同时启用CONNECTIONS/TLS/KEYS/STRINGS/HASHES回归开关，CLI和浏览器路径显式指定。安装前重新打包并以SHA文件名安装到项目测试profile。

机器证据：[真实List](08-redis-lists-smoke.json)、[原生安装包UI](08-native-lists-smoke.json)。命令依据：[LRANGE](https://redis.io/docs/latest/commands/lrange/)、[LLEN](https://redis.io/docs/latest/commands/llen/)。

![List 原生单元格预览](E:/项目demo/dsh-redis/docs/verification/08-native-list-data.png)
