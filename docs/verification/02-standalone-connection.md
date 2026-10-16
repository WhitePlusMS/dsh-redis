# 02 单机连接验收

日期：2026-10-16（Asia/Shanghai）。实际宿主为 DSH 0.2.0-rc.2，Node v22.22.1；Redis 8.2.6 官方镜像和固定 digest 见机器报告。所有数据和 ACL 仅属于独占测试实例。

- pnpm check：Host/Client/tests 严格类型、构建和15项回归通过。
- 真实 Redis 8组：密码、错误密码、命名ACL含空密码、无密码；测试连接不遗留socket，手动连接/断开、状态查询不新建连接；会话隔离/销毁、服务端断开、不重连；真实挂起socket的8秒超时与取消；关闭端口的网络错误。
- 原生安装包9组：鉴权、可信Agent作用域、拒额外字段、原生侧栏打开；表单测试/认证失败/连接/断开、查询时间、密码清空、浏览器持久存储不含密码、外部断线后手动刷新及不重连；Host退出后socket回到基线。
- 安装前逐文件比较lib与实际profile安装内容，防止同名本地包仍加载旧内容。包SHA256：`2f7970d70cc201d6cd47412a081ec740f0b8ad55157e6fe2b26547e4c2dc9a63`。
- finally确认测试浏览器和DSH进程树已关闭；两台Host测试Redis容器与一台原生测试Redis容器均已按所有权清理。

node-redis6.2.1默认RESP3在显式用户名/空密码时省略HELLO AUTH；独占真实服务器重现NOAUTH，固定RESP2后同用户返回PONG并通过完整检查。该选择只固定传输协议，不增加兼容分支或任意命令接口。

证据：02-redis-connection-smoke.json、02-native-connection-smoke.json、02-native-connection.png。复现：pnpm check；node scripts/smoke-redis-connections.mjs；重新打包到SHA路径并安装到项目独立测试profile后，以DSH_CLI_ENTRY、REDIS_BROWSER_EXECUTABLE和REDIS_SMOKE_CONNECTIONS=1运行node scripts/smoke-dsh.mjs。脚本不向模型发送prompt。

本票未覆盖TLS、保存连接、DB/Key或任何数据读取；这些属于后续独立任务。未连接用户Redis，未安装到用户日常profile。
