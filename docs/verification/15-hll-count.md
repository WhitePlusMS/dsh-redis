# 15 HyperLogLog 只读估算查看验收

2026-10-16，DSH为用户指定0.2.0-rc.2（RC），CLI/SDK同版，Node22.22.1、pnpm11.22.0。自建Redis8.2.6官方固定镜像文件以wsl-image运行，独立DSH_HOME/profile；不访问业务Redis或日常profile。

## 版本、产物与结果

- 包SHA-256：`b082b065ff4d0689a2c3238159b0f7802b4d8941ef84626853c3016e512aed5f`，按SHA命名安装；安装lib与构建62文件的集合和内容逐字节一致。
- 严格Host/Client/tests类型、构建、完整188项回归通过；HLL专项12项。源语义前置6组、实际生产reader7组、完整原生67组及独立禁用PFCOUNT环境15组通过，两张HLL截图已查看。
- Redis镜像digest ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e；amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e。不是Docker验收。

## 实现与只读证据

1. String手动进入HLL，原始String入口保留并在返回时重新读取。显示近似基数、dense/sparse和源缓存有效标记。HLL提供估算，不能枚举原始成员；约0.81%为标准误差，不是误差绝对上限。[PFCOUNT官方说明](https://redis.io/docs/latest/commands/pfcount/)
2. 固定请求为PFCOUNT同一完整Key两次。官方8.2.6源码在argc>2时合并到临时寄存器，单输入分支才可能更新源缓存；未复制该C实现，只依据其语义使用固定命令。[固定源码](https://github.com/redis/redis/blob/8.2.6/src/hyperloglog.c#L1418-L1497) 真实前置测试同时以管理员单输入对照确认失效缓存确实会变化，而重复双输入的稀疏/稠密、有效/失效缓存源字节和绝对过期时刻保持不变。
3. 生产读取器TYPE/PTTL/STRLEN、GETRANGE0..15、固定双输入PFCOUNT、再复查TYPE/长度/TTL/头部。成功HLL请求最多读取两次各16字节源头部，不全量GET值；元信息、计数及协议头另计。进入HLL之前的String预览仍按其独立最多64KiB字节窗口读取，不能把32字节头部上限冒称整个选Key流程总网络读取量。
4. HYLL魔数精确按字节比较，encoding和dense长度先检查；这是候选格式，稀疏完整性由服务器计数路径验证，不证明业务来源。普通值、空String、伪魔数/编码、坏稀疏、2MiB伪HLL均有invalid状态，保留原始String。真实2MiB伪值的HLL窗口仍仅16字节，不传完整值。空HLL为成功估算0，与缺失或格式错误分开。
5. RPC只接受target/keyBase64，Agent归属来自宿主；输出严格检查状态、元信息、估算整数文本、编码和缓存标记，错误无原始Key/密码或服务器私有文本。目标代次、DB、前后守卫、取消和总10秒截止沿用既有服务；Int64结果不经JS Number改写。固定双输入Key的编码受传输128KiB单命令预算约束，64KiB Key被明确拒绝，原身份不截断且连接仍健康，正常Key随即可读。
6. 最小ACL仅授予连接/元信息/GETRANGE/PFCOUNT即可查看；PFADD不可用。拒绝PFCOUNT显示permission，原始String继续可读。unknown-command或不支持双输入不会回退单输入；实际自建实例启动禁用PFCOUNT，生产reader和原生界面分别验证unavailable及返回String。错误参数形状仅有专项模拟证据，未假称目标服务器本身不支持双输入。
7. 真实DUMP、绝对过期时刻及HLL写命令计数不变；原生稀疏/稠密、有效/失效缓存与零计数刷新、权限拒绝恢复、返回Base64原字节、坏稀疏/普通String、删除/转Hash通过。原生刷新明确等待本次RPC，避免把旧计数当新结果。
8. 真实DB代次隔离、类型/删除/长度和另一个管理员单输入更新缓存的竞争均丢弃计数。相同类型/长度/头部的并发变化仍可能不可检测，不承诺原子快照。统一慢请求、多会话恢复和全局布局分别由19/18/20收口，不能将本票快速请求验收扩大为这些任务已完成。

## 失败修正与未扩大范围

首次真实reader在ACL设置时用了不存在的resetcommands，修正为其他已实证夹具的reset on命令列表后7组全部重跑通过；产品代码未受该修正影响。首次原生将新建空HLL缓存错误预期为有效，实际PFADD新建会置失效；界面显示0和Invalid正确，修正仅测试预期后以同包67组通过。两个首次报告留在.scratch/artifacts，未改写成通过。

所有自建Redis、DSH和浏览器已退出，证书和UUID目录清理标记true；不改用户服务或日常配置。包仍存在官方共享依赖架构下的profile missing-peer诊断；12个DSH/Cordis安装版本与声明匹配的事实已核对，React浏览器实际共享版本的直接核验留在21，原生成功不冒充整个发布审计通过。

本报告只证明所列8.2.6环境与包；没有声称其他Redis版本都实测通过。当前15号完成，完整29票首版未完成。

证据：[实际reader](15-redis-hll-smoke.json)、[源语义对照](15-hll-source-probe.json)、[原生](15-native-hll-smoke.json)、[实际缺命令](15-native-hll-unavailable-smoke.json)、[估算卡片](15-native-hll-data.png)、[无效格式](15-native-hll-invalid.png)。
