# RO03：AI 工具结果语义核验

日期：2026-10-28。状态：工具结果和隔离 Redis 验证完成；真实模型及原生界面留待阶段验收。

## 本次改动

- [ai-reader.ts](../../src/host/ai-reader.ts) 在状态和切库结果标明状态采样时间，切库结果同时返回请求 DB 和实际连接状态；Key 扫描结果回显实际 `pattern`；值结果用 `source` 区分显式 Key 与侧栏选择。各类型原有的读取时间、部分值、游标和精确字节身份继续使用各自数据结构。
- [ai-tools.ts](../../src/host/ai-tools.ts) 同步说明上述字段。选择记录的 `sampledAt` 是界面同步时间，状态结果的 `sampledAt` 是当前状态采样时间，两者不代表 Redis 原子快照。
- [connection-service.ts](../../src/host/connection-service.ts) 在切库代次变化时同步触发旧状态失效；[AI 入口](../../src/host/ai-reader.ts)和 [界面 RPC 入口](../../src/remote-service.ts)不会在旧操作异步返回后清掉新的选择。切库错误处理核对连接记录、操作代次和状态，迟到结果不得覆盖断开或新连接；已登记的传输错误保留。

## 验证结果

- `pnpm check`：Host、Client、tests 类型检查、构建和 21 个测试文件共 219 项通过。
- [ai-tools.test.ts](../../tests/ai-tools.test.ts)、[key-browser.test.ts](../../tests/key-browser.test.ts) 和 [connection-service.test.ts](../../tests/connection-service.test.ts) 覆盖请求 DB 与实际 DB、权限拒绝、新旧连接交错、同一新 DB 选择、主动断开后迟到成功/错误及传输失败。现有测试另覆盖显式目标、无选择、二进制身份、重复 Stream 字段和长整数相关边界。
- 新构建产物使用隔离 Redis 8.2.6、合成 Key、项目正式工具注册与受控本机代理：status、keys、value、select_db 四个工具均返回预期结果；合成值未变。代理看到的命令只有 `AUTH`、`PING`、`SCAN`、`TYPE`、`PTTL`、`STRLEN`、`GETRANGE`、`SELECT`。隔离 Redis 已停止，所属目录已移除。
- 这次工具调用由本地测试代码发起，不是 DSH 真实模型对话；没有访问用户 Redis，也没有安装插件到日常 DSH。独立代码复核未发现新的可复现阻断问题。
