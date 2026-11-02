# RO02：只读命令和会话边界核验

日期：2026-10-28。状态：本任务核验完成；用户 Redis、原生 DSH 界面及真实模型未验收。

## 实现边界

- [redis-transport.ts](../../src/host/redis-transport.ts) 运行时限制命令名称；`CONFIG`、`INFO`、`DBSIZE` 另有精确参数约束。其余读取命令的参数形状由各 Host reader 的固定模板和 [共享协议 schema](../../src/typert.shared.ts) 约束，不声称 transport 对每个只读命令逐项验参。
- [ai-tools.ts](../../src/host/ai-tools.ts) 的四个工具使用执行上下文中的会话，不接收模型指定的 session 或任意命令。Client RPC 和 AI 入口使用共享 schema 验证目标、类型、范围及参数；各 reader 自行构造固定命令。
- [connection-service.ts](../../src/host/connection-service.ts) 的普通读取路径同时在 TypeScript 和运行时拒绝 `SELECT`；专用切库先递增连接代次，校验并发状态后再更新 DB。读取派发前和返回后均校验所属会话、连接代次和 DB。
- 传输响应有大小、排队、超时和取消边界；取消时已发出的请求会按既有设计排空响应或关闭连接，不能称为撤销服务器已执行的命令。

## 本次证据

- `pnpm check`：完整构建通过，21 个测试文件、207 项测试通过。其后只修改了模拟传输测试的参数断言，再次运行 `pnpm typecheck` 和传输专项，13 项通过。
- [key-browser.test.ts](../../tests/key-browser.test.ts) 验证绕过类型传入 `SELECT` 时不派发命令、不改变会话状态；专用切库仍更新 DB 和代次；同文件覆盖跨会话、旧代次、取消及迟到结果。
- [redis-transport.test.ts](../../tests/redis-transport.test.ts) 的合成回环 peer 分别核对 AUTH 密码、SELECT DB、SCAN 游标及命令顺序；它是协议模拟，不单独代表真实 Redis 结果。
- 使用新构建 `lib`、独立 WSL Redis 8.2.6 和受控本机代理，测试自身准备合成值；实际观察到插件依次发出 `AUTH → PING → SELECT → SCAN`，测试后合成值未变。fixture 返回 Redis 已停止、所属目录已移除；测试准备写入仅发生在该独立实例。
- 用户已开启的 Redis 未被连接、读取、修改或停止。原生 DSH 插件安装、真实模型对话和业务数据验证不属于本任务通过的范围。
