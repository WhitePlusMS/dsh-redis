# 19 取消读取并从超时或断线中恢复

2026-10-16，用户指定 DSH CLI/SDK `0.2.0-rc.2`，Node22.22.1、pnpm11.22.0。实际原生安装包 SHA-256：`4318a096b047621717654659810e4559f2740ea04373a598616d135e97cc6563`；隔离 profile 的 lib70文件集合及全部字节与构建一致。

## 交付行为

- 取消立即停止等待并丢弃当前值，明确 Redis 可能仍在处理。已经发出的单条命令仍需排空完整回复或达到固定硬截止；取消普通读取不会无条件关闭本会话连接，更不会关闭其他会话连接。
- 连接队列最多一条 active 加15条 queued。取消的排队项在轮到它时不再派发；旧回复尚未消费、队列尚未释放时，新请求仍可能得到 busy。界面提示等待、刷新连接状态后手动重试，不自动重试用户读取。
- 每次读取共享固定10秒总预算，包含排队和全部元信息/数据命令。排队截止后不得补发；active硬截止或TCP断开只失败该连接，手动重连保留域连接ID并产生新generation，不重放旧队列。
- SELECT在派发前推进generation，旧读取不再交付、旧代次排队命令不再发送。SELECT已经执行但确认丢失/取消时，关闭本会话状态不确定的socket；再次手动连接从DB0开始，不能带着未知DB继续读。
- 读取错误不会伪装成功或保留旧String值。连接栏显示上次状态查询，用户按提示点击“刷新状态”取得当前Host状态，再输入密码、手动连接，最后显式读取恢复的Key。重连不自动SCAN、SELECT或读取。

## 实现

复用已有 `RedisTransport` 串行链、16项上限、接收帧预算和固定硬截止，以及 `RedisReadContext` 总截止、`RedisConnections`可信会话/DB/generation校验。本票不另造调度器，不修改已验证的生产传输；产品改动仅为中英cancelled/timeout/busy提示，说明实际恢复步骤。

`tests/redis-transport.test.ts`新增三项loopback协议验证：排队项截止前不派发且后续可用；active硬截止只通知一次并失败后继；取消后分片回复必须完整排空，下一请求才能得到自己的响应。短截止只用于专项，不冒充真实生产10秒。

新增测试专用 `scripts/read-delay-proxy.mjs`，转发真实Redis的固定RESP2请求/回复，复用生产请求/接收预算；可以扣留一条已经由Redis计算完成的实际回复，或关闭指定的自建连接。诊断只记连接、命令和首Key字节身份，排除AUTH/PING参数，不输出密码；不向Redis注入DEBUG、EVAL或全局暂停。

`scripts/smoke-redis-recovery.mjs`验证生产reader/transport；`scripts/smoke-native-recovery.mjs`经 `smoke-dsh.mjs` 的RECOVERY开关验证真实安装包浏览器→Host→Redis。普通验收路径保持；代理、B会话连接、DSH、浏览器和Redis均有各自finally/关闭断言。

## 实际验证

| 层次 | 结果与证据 |
| --- | --- |
| 编译与回归 | Host/Client/tests三层严格类型、构建、完整225项回归通过；transport现有加新增共10项通过；prepack完整执行，无跳过hooks。 |
| 生产reader/真实Redis | [8组报告](19-redis-recovery-smoke.json)通过。实际取消1ms，生产截止10041ms；一条active加15条queued、第17条busy、取消跳过、短排队截止不补发、SELECT代次竞争、取消已执行SELECT、实际TCP EOF、手动重连仅AUTH/PING、另一会话持续可读。 |
| 字节与只读 | 上述真实报告验证二进制Key与最大64KiB Key完整；源DUMP、绝对PEXPIRETIME与监测的数据写命令计数不变。代理只见固定AUTH/PING/SELECT/TYPE/PTTL/STRLEN/GETRANGE；SELECT属于生命周期。 |
| 原生安装包 | [18组报告](19-native-recovery-smoke.json)全部通过。实际取消31ms、固定生产截止10100ms。A为实际UI会话，B由DSH可信session/create建立并调用同一Host；未伪造DTO sessionId或使用业务库。 |
| 真实Host取消证据 | UI取消active及queued读取后释放旧回复，A轨迹只剩第三次显式String读取的7条命令；已取消active的后检及已取消queued读取均未派发。不能仅以HTTP ERR_ABORTED或旧UI未更新判断此项通过。 |
| 原生恢复 | 实际超时与TCP EOF均清空旧预览；B的socket/目标代次和native:9值不变。A先刷新状态、密码重输、手动重连，只握手无旧队列重放，Key列表0条、预览为空；显式“读取已选Key”才显示新数据。 |
| 退出资源 | 原生DSH进程退出、全部Host sockets释放、测试代理全部连接关闭；本票两次真实fixture均stopped/certificatesRemoved/fixtureRemoved=true。浏览器pageErrors/consoleErrors为空，两条requestFailures为预期取消的readString ERR_ABORTED。 |

[超时截图](19-native-recovery-timeout.png)已查看，显示明确状态刷新/手动重连提示；[重新读取截图](19-native-recovery-fresh.png)已查看。截图受当前滚动位置影响，没有同时展示全部值区域，值在原生机器断言中精确校验；窄宽侧栏布局由20继续，不将此图当作布局验收。

权限、消失、类型/长度变化、畸形回复及预算失败沿用各reader的固定DTO与现有专项；完整225项均回归通过。此前各类型真实Redis/ACL证据仍对应各自归档包；本票真实延迟专项采用String和共享transport，不能冒称所有类型在所有服务器上都执行了慢命令。

## 首轮失败与边界

[首轮真实报告](19-redis-recovery-first-attempt-smoke.json)保留passed=false：取消满队列、向Host写回旧帧后立即重试，测试预期value但实际failed；初次未记录错误码。随后只增加诊断，实测确为busy；验收脚本有限等待Host消费旧帧/清队列后再读取，其他错误仍失败。生产没有加入轮询或自动重试，没有因测试时序重写队列。

这些检查延迟的是实际回复网络交付，Redis已完成该条命令；取消不是服务器计算中止。即使硬截止关闭客户端，也不能宣称Redis立即停止执行。前后TYPE/长度/TTL校验不能排除同类型同长度替换，各次读取仍非原子快照。

本轮真实专项为独占官方Redis8.2.6固定镜像文件、wsl-image后端、随机密码/loopback端口和plain TCP；TLS另见既有04/22相关证据，不把本票plain代理称为TLS慢链路已验收。所有改动在独立项目和隔离测试profile；未清理C盘、启停用户服务或改日常profile。早期18号两对临时目录及16号Git快照的清理拒绝记录仍保留，不属于本票遗留运行服务。

20布局主题、21完整发布门禁和八张P1继续待办；本票通过不等于全部29票交付。按用户要求归档核对后提交本地Git，不push。
