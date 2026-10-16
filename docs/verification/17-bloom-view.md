# 17 Bloom 统计与单项概率查询验收

2026-10-16，DSH CLI/SDK 0.2.0-rc.2，Node22.22.1、pnpm11.22.0。独占 Redis8.2.6 官方固定镜像文件，经既有 WSL 路径运行；Bloom 模块实际版本80212。使用独立 DSH_HOME/profile，不触及业务 Redis 或日常配置。

## 产物与结果

- 包 SHA-256：`a0ac67733e206831ded8d0e4a734883715a9ead0631ee2dfa3b5c79321b9c507`；按 SHA 名称安装，lib68文件集合和内容逐字节相同。
- 三层严格类型、构建、完整216项回归通过，其中 Bloom 专项14项。源 RESP2 探针3组、实际生产 reader6组、原生安装包全功能79组通过，截图已查看。
- 镜像 digest `ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e`，amd64 manifest `f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e`。结论仅对应本环境与包。

## 行为与实现边界

1. TYPE 精确匹配 `MBbloom--`，自动进入统计视图；`MBbloomCF` 不进入 Bloom。Cuckoo 无查询或写入入口。首读仅 BF.INFO，草稿输入/切换输入格式不请求 Redis；用户显式提交才执行一个 BF.EXISTS。固定内部命令仅 TYPE/PTTL/BF.INFO/BF.EXISTS。
2. 统计展示容量、分配字节、子过滤器数、记录插入次数、扩展系数，整数保留 Int64 字符串。记录插入次数不等于可枚举、精确的原始去重成员数量。INFO 字段严格校验，拒绝重复/缺失/错误类型；实际 non-scaling 返回 Expansion rate=null，显示不扩展。这一 null 细节来自80212实际探针，并非官方文档的显式承诺。[BF.INFO](https://redis.io/docs/latest/commands/bf.info/)
3. 单项支持 UTF-8 Text 或规范 Base64，至多4KiB；空字节是有效项，与 null（仅统计）分开。完整二进制 Key 至多64KiB，直接用原字节发送，结果回显提交项 Base64，不把正在编辑的草稿冒充已查询项。超限输入在客户端拒绝且不发 RPC，Host 仍独立执行严格字节校验。
4. BF.EXISTS 的0显示阴性，1仅显示“可能存在”，不使用确定存在标记。实际只插入 only-added 的高误报测试过滤器，对 never-added-643 返回1，原生截图展示该真实假阳性；不虚构完整成员列表。固定 RESP2 生产传输收到整数，管理员 RESP3 收到布尔，各自按明确协议处理。[BF.EXISTS](https://redis.io/docs/latest/commands/bf.exists/)
5. 缺失和错误类型的 EXISTS 原始结果也可能为0；前后 TYPE/PTTL 和固定 not-found/WRONGTYPE 重检阻止将其误显示为阴性。实际删除或转 Cuckoo 在 TYPE、INFO、EXISTS 后触发，其中两次真实 EXISTS0均被丢弃。无法检测所有同类型替换、并发插入/扩展，统计、查询与TTL不是原子快照。
6. INFO 的 permission/unavailable 与成员查询独立。真实最小 ACL 未给 BF.INFO 仍可查项，授权后恢复统计；拒绝 BF.EXISTS 清除旧结论，统计仍可查看，显式恢复成功。BF.ADD 仍被禁止，无自动写回、重连或回退。扩展缺失/无命令 UI 使用明确的 HTTP 响应故障注入，目标实际仍加载模块，不能宣称实测了保留 Bloom 数据的无模块服务器。
7. 可信 Agent 会话、连接/DB代次、总10秒截止、取消与固定错误沿用共享边界；坏 INFO/概率枚举、过期目标、超时和取消经专项验证。接收全帧1MiB、请求128KiB，固定输出形状和4KiB单项限制控制消息规模；没有无限 BF.MEXISTS/任意命令入口。
8. Client 在渲染前显式复用严格结果 schema。原生 HTTP 注入伪造 membership=present 被拒绝，旧结论清空，随后正常读取恢复；这证明 Bloom 当前入口，其他 RPC 接收审计留给21。手动统计刷新清除原查询，Key/目标变化中止旧请求，统一多会话慢请求恢复由18/19收口。
9. 真实6组证明二进制/空Key和项、完整64KiB Key/4KiB项、非扩展/空过滤器、实际误报、ACL、DB代次与删除/转型；DUMP、绝对 PEXPIRETIME、监测写命令计数均不变。没有为巨大实际过滤器造超过53位计数；大整数边界来自严格单元夹具。
10. 原生79组覆盖既有所有数据视图及 Bloom 新增6组，包括草稿无RPC、最大/空/二进制项、实际误报、null扩展、ACL、缺命令UI/伪造结果注入、源字节/过期不变、删除与Cuckoo转换。所有自建 DSH/Chrome/Redis 已结束，证书与UUID目录清理true。未调整用户服务、日常profile或C盘文件。

## 范围和后续

18 会话状态、19统一取消恢复、20窄侧栏/主题、21发布门禁及8张P1仍未完成。本票不声明完整29票交付。用户已授权完成小目标即本地 Git 提交，本次在归档核对后提交17，无push。

证据：[实际reader6组](17-redis-bloom-smoke.json)、[源语义3组](17-bloom-source-probe.json)、[原生79组](17-native-bloom-smoke.json)、[真实假阳性截图](17-native-bloom-probability.png)。
