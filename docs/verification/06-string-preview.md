# 06 String 元信息、字节窗口与格式验收

日期：2026-10-16，Asia/Shanghai。DSH 0.2.0-rc.2，Node v22.22.1，真实 Redis 8.2.6。测试采用 05 记录的官方固定镜像文件/WSL 专用实例，未使用用户 Redis。

验收包 SHA256：`abfa2eb11d3678d900017868f59f8596b830ff1a9dfcf90f9c2a1e96f9a4a2e8`。通过官方 plugin 命令安装 SHA 文件名本地包；启动前逐文件确认安装 lib 与本次构建一致。

## 实际结果

- Host/Client/tests 严格类型、构建与 66 项回归通过，新增 String 专项 13 项。
- 真实 Redis 7 组通过：二进制 Key、精确 TTL/字节、空值、每个 UTF-8 切点、4 MiB 值分段、EOF/缺失/其他类型、实际 GETRANGE 而无 GET/SET、DUMP/绝对过期时刻不变、受限 ACL、真实过期/旧 DB 代次，以及管理员在实际回复之间修改类型/长度/删除 Key 后丢弃旧字节。
- 5 组真实 socket/资源检查通过，额外 200 ms 操作截止实际在 209 ms 结束，挂起读取在 10001 ms 结束，均关闭自身 socket。此为具体场景结果，不代表所有网络环境的固定延迟。
- 原生安装包 20 组通过，包含 05 全部 DB/扫描流程与新的 String UI：Text/JSON/Hex/Base64、无损大整数/指数、显式 Base64 解码及失败、非法 UTF-8、分段 JSON 提示、两次续读到最后一个字节、跨界字符和精确 Hex 偏移、整数范围提示、Hash 不支持/空 String/Key 消失。
- 原生截图已人工核对。Redis、DSH、浏览器均已关闭，短期证书与 UUID 配置目录已清理；测试缓存与官方镜像文件仅保留在项目 E 盘忽略目录。

## 行为与边界

固定 `TYPE/PTTL/STRLEN/GETRANGE`，一次操作共用 10 秒绝对截止。String 窗口最多 64 KiB，另外最多前后各 3 字节供 UTF-8 边界使用。Text 明确显示补全跨界字符所用的窗口外字节数；Hex/Base64 严格对应原请求窗口，不替换非法字节。

PTTL、总长度和位置按整数文本传输。空值、超出 EOF、过期、其他类型、读取期间变化和权限失败分别呈现。各条读取命令不构成原子快照；同类型/同长度的并发替换不能据元信息证明未变，界面明确提示刷新。

JSON.parse 只检查语法，其结果不用于显示；格式化逐字复制原始 token，保留大整数、指数、-0、重复字段与转义。分段内容不能标成完整 JSON。缩进深度最多 64，格式化显示最多 512 KiB。Base64 解码由用户显式选择，采用标准编码校验并报告解码错误。

新 Hash 等集合查看器、特殊类型、会话持久恢复、主题/窄屏完整验收及最终发布仍在后续任务范围，本票通过不扩张为完整首版完成。

机器证据：[真实 String](06-redis-strings-smoke.json)、[资源与截止](06-limits-smoke.json)、[原生 UI](06-native-strings-smoke.json)。复现使用 `scripts/smoke-redis-strings.mjs`；原生脚本在05环境基础上增加 `REDIS_SMOKE_STRINGS=1`。

![String JSON 原生预览](E:/项目demo/dsh-redis/docs/verification/06-native-string-data.png)
