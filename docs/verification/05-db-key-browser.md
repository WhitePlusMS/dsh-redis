# 05 DB 选择与 Key 增量浏览验收

日期：2026-10-16，Asia/Shanghai。指定 DSH 0.2.0-rc.2；Node v22.22.1。验收包 SHA256：`9846fc6806ce39408aa71e520b9fb1cfdebc9e79e57ffd8e38183c3ceb293e5f`，安装 lib 与当前构建逐文件一致。

## 实际结果

- 严格 Host/Client/tests 类型、构建与 53 项回归通过；其中 12 项针对 DB/Key、游标身份、二进制、缓存与两端严格契约。
- 真实 Redis 8 组通过：352 个 Key 分 4 页；二进制与空名、两会话/DB 隔离、越界 DB、空 MATCH、无 INFO/CONFIG 的受限账号、SELECT/SCAN 拒权、DUMP 字节/绝对过期时刻/DBSIZE 不变、巨大 Key 与接收超限。
- 4 组独立进程资源检查通过：512 MiB bulk、十亿元素数组、累计超限在 4–5 ms 拒绝；实际 RSS 增量 0.5–2.7 MiB。无回复读取在 10013 ms 超时并关闭该 socket。这些是具体场景的采样结果，1 MiB 帧限制不等于整个 Host RSS 上限。
- 真实认证/生命周期 8 组与 TLS 5 组回归通过。
- 原生安装包 15 组通过：可信 Agent/RPC 与严格字段拒绝、未连接 SCAN、TLS/认证、230 项显式 MATCH 续扫、二进制选择、空结果、DB1 切换、无效 DB 保持原 DB 及恢复、断开和资源清理。截图已人工核对。

## 测试运行方式

C 盘当时可用空间为 0，Docker API 不响应。没有删除用户文件或重启 Docker。TEMP/TMP、pnpm 包缓存和独立 DSH_HOME 使用本项目 E 盘目录。

本次真实 Redis 显式采用 `REDIS_TEST_BACKEND=wsl-image`：从官方 registry 下载并逐层校验固定镜像，使用既有 WSL Ubuntu 加载该镜像内的 musl/Redis/模块文件。没有安装 Ubuntu 系统软件包，测试实例绑定 loopback 随机端口，无 RDB/AOF 持久化，数据上限 128 MiB。它是实际 Redis 服务端，运行载体是 WSL 专用进程，不记为 Docker 容器验收。

- 官方镜像 index：`sha256:ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e`。
- linux/amd64 manifest：`sha256:f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e`。
- 实际 Redis：8.2.6，JSON.GET、TS.RANGE、BF.INFO 可用；这些扩展的查看器尚未因此算作实现。

准备运行文件：`python scripts/prepare-redis-image.py`。在上述环境变量下执行 `node scripts/smoke-redis-keys.mjs`、`node scripts/smoke-redis-limits.mjs` 和既有连接/TLS脚本。原生检查使用 `scripts/smoke-dsh.mjs`，设置 `DSH_CLI_ENTRY`、`REDIS_BROWSER_EXECUTABLE`、`REDIS_TEST_PYTHON` 及 `REDIS_SMOKE_CONNECTIONS=1`、`REDIS_SMOKE_TLS=1`、`REDIS_SMOKE_KEYS=1`。先将当前包按 SHA 文件名安装到项目专用 profile，再执行真实安装检查。

## 边界与证据

单次 SCAN，COUNT100 是提示；空页仍可能有后续，游标使用不透明单次 token。Key 最大 64 KiB，接收帧和外发 JSON 各 1 MiB；浏览缓存同时限制 5000 行与编码后 2 MiB。超限不丢尾项后声称扫描完成。切换 DB 前推进连接代次；排队派发与结果返回都校验 DB/代次。SELECT 取消后状态不确定时关闭自身会话 socket。

所有自有 Redis、DSH、浏览器进程均关闭；短期证书与 UUID 夹具目录已清理。镜像文件和测试缓存保留在忽略的 `.scratch/runtime` 内。未接触用户 Redis、日常 DSH profile 或原本运行的服务。String 值查看、会话持久恢复、完整主题/窄屏和首版发布仍属于后续任务。

机器证据：[Redis](05-redis-keys-smoke.json)、[资源](05-limits-smoke.json)、[原生 UI](05-native-keys-smoke.json)、[认证回归](05-connection-regression-smoke.json)、[TLS 回归](05-tls-regression-smoke.json)。

![原生 DB1 Key 选择](E:/项目demo/dsh-redis/docs/verification/05-native-keys-data.png)
