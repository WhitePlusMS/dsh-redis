# RO04 错误解释与凭据日志核验

日期：2026-10-28，更新于 2026-10-29。状态：**完成**，范围以本记录所列实际证据为准。

本记录区分模拟测试、隔离 Redis Host 实测和原生 DSH 界面验证；每项证据的范围见下表。本次模拟测试没有启动 DSH 或访问 Redis；资料测试使用项目下独立临时目录，并由测试清理。

## 本轮检查

- `pnpm typecheck`：通过。
- `pnpm exec vitest run tests/connection-service.test.ts tests/profile-store.test.ts tests/ai-tools.test.ts tests/string-preview.test.ts tests/hash-view.test.ts tests/list-view.test.ts tests/set-view.test.ts tests/zset-view.test.ts tests/stream-view.test.ts tests/host-typert.test.ts`：10 个文件、154 项通过。
- 后续修正日志捕获格式后，`pnpm typecheck` 通过；重跑 `tests/connection-service.test.ts tests/profile-store.test.ts tests/ai-tools.test.ts`，3 个文件、56 项通过。新增反向测试确认 Error 消息及嵌套 cause 可被捕获。
- 在项目内独立副本运行 Host smoke：[连接收据](readonly-ro04-host-connections-2026-10-28.json) 8 项通过，覆盖密码/ACL 认证、错误密码、断开、会话隔离、真实挂起连接的超时与取消；[TLS 收据](readonly-ro04-host-tls-2026-10-28.json) 5 项通过，覆盖可信 CA、不受信任或错误 CA、默认信任库及主机名不匹配。所有自建 Redis 实例均报告停止和清理，原历史收据未覆盖。
- 隔离 DSH profile 和临时 Redis 的真实界面验证：未信任 CA 显示 TLS 证书验证失败；错误账号密码显示认证失败；可信 CA 和正确账号连接成功后，禁止 SCAN 的 ACL 显示权限不足与“加载失败 · 已保留成功批次”，没有显示为空库。重新打开连接设置时密码输入框为空。独立 TCP 黑洞夹具触发连接超时，界面显示超时和刷新、重连建议。测试凭据和数据均为合成，未写用户 Redis。
- 2026-10-29 在隔离 DSH 和独立临时 Redis 中选择合成 String Key，由夹具分别删除、设置短过期、替换为 Hash：界面手动刷新后，删除和过期均显示“Key 已不存在或已过期”，旧值不再显示；类型变化刷新后显示 Hash 类型及新的字段和值。测试操作仅作用于专属临时实例。
- 同日再用隔离 DSH 验证：TCP 黑洞使连接超时，关闭表单并刷新状态后仍显示未连接；随后选择可信 CA、连接地址与证书 SAN 不匹配的临时 TLS Redis，界面显示“TLS 证书与连接地址不匹配，请检查主机名。”；最后手动连接另一独立可用 Redis，成功显示已连接并加载合成 Key。测试没有证明原先黑洞端点恢复后重连的情况。
- 随后建立可控的本机 TCP 转发夹具：同一端口先不转发导致连接超时，恢复转发到独立 Redis 后手动重新连接，界面显示已连接并加载合成 Key。另用合成密码触发 Redis 认证失败，本次宿主标准输出未出现该密码或 PEM 标记；这只覆盖本次收集的标准输出，不能推断其他日志通道。
- 在本轮新建的独立 DSH profile 中写入含合成敏感标记的无效连接资料文件，点击刷新配置后界面显示固定的资料读写失败提示；实际宿主输出记录固定存储错误警告，未出现该标记。此项覆盖读取损坏资料，并不覆盖实际保存失败或其他日志通道。
- 随后在同一独立 profile 中恢复空资料，使用短时文件占用阻止替换，原生界面保存合成资料时显示固定失败提示，宿主标准输出出现固定保存失败警告且未回显合成地址；释放文件后回读原空资料不变、无残留临时写入文件。只检查本次宿主输出，不涵盖系统及第三方日志。
- 使用独立 Redis 和真实 transport 包装执行一次可控交错：`GETRANGE` 返回旧 String 字节后，由夹具分别将该合成 Key 改为 Hash 或删除，再让读取继续。结果分别为 `changed` 和 `missing`，返回字节均为空；测试夹具已关闭并清理。该检查由脚本控制交错，不是原生界面的并发操作。

| 范围 | 当前证据 | 限制 |
| --- | --- | --- |
| 认证和 TLS | 模拟 opener、隔离 Redis Host 和原生 DSH 界面分别验证错误分类、密码认证、TLS 握手及未信任 CA、主机名不匹配的错误提示。 | 证据仅覆盖所测证书与账号情形。 |
| 权限和超时 | [AI 工具测试](../../tests/ai-tools.test.ts) 验证权限提示和拒绝文本不回显；原生界面显示真实 ACL 拒绝及挂起 socket 超时，同一地址恢复后手动重连成功。 | 只覆盖测试端点的连接超时恢复，不代表所有读操作超时后的恢复。 |
| Key 消失、过期、类型变化 | [String](../../tests/string-preview.test.ts)、[Hash](../../tests/hash-view.test.ts)、[List](../../tests/list-view.test.ts)、[Set](../../tests/set-view.test.ts)、[ZSet](../../tests/zset-view.test.ts)、[Stream](../../tests/stream-view.test.ts) 与 [AI 工具](../../tests/ai-tools.test.ts) 模拟测试；隔离 DSH 界面实测删除、过期和 String 转 Hash 后刷新。 | 界面删除与过期使用同一提示；实测仅覆盖上述类型变化，不证明并发读取一致性快照。 |
| 资料、环境标签 | [资料测试](../../tests/profile-store.test.ts) 验证通过远程服务保存另一份资料时模拟连接不变、未提供环境标签时不猜测，并验证密码字段拒绝与非敏感资料持久化。 | 未覆盖本轮真实 DSH 的所有资料异常路径；CA 资料按现有设计可保存，不等同私钥保护验证。 |
| 凭据与错误日志 | [连接服务测试](../../tests/connection-service.test.ts) 在连接成功、掉线、断开及模拟认证/TLS 错误中注入假标记并捕获 `console.info/warn/error`；[资料测试](../../tests/profile-store.test.ts) 捕获保存、移除和损坏文件路径日志，并检查异常文本不含假密码。 | 仅证明所执行的服务路径和捕获的输出；没有检查真实宿主、第三方库、操作系统或所有潜在日志通道。 |

## 验收范围与剩余边界

1. 本轮主机名不匹配原生界面验证已完成；不对用户现有 Redis 改账号或证书。
2. 同一测试端点连接超时后恢复及手动重试已验证；其他运行中读操作超时恢复仍需区分。
3. 真实 Redis 和 transport 的受控并发类型变化与删除已验证；原生界面未单独控制同一交错。
4. 实际 DSH/Host 已覆盖资料读取和保存失败的固定输出及合成标记；其他日志通道和更广的异常组合仍需明确边界。

RO04 的清单条件已由上述模拟、真实 Host 和原生界面证据共同覆盖。这里保留未覆盖的组合，不能将其视为第三方/操作系统全日志或原子一致性证明；RO06 的真实模型验收另行进行。
