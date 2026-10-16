# 27：有界客户端连接快照（进行中）

当前01–26done、27in-progress、28–29ready，原29票图不变。

## 来源与最简范围

[Redis官方CLIENT LIST](https://redis.io/docs/latest/commands/client-list/)已核对选定字段、版本新增字段及应容忍缺失/忽略未知的约定；LUNA也只读描述了8.2.6 networking.c实际输出。固定CLIENT LIST，不开放TYPE/ID输入、KILL/PAUSE或任意管理子命令。

选定id/addr/name/user/age/idle/flags/db/cmd/qbuf/omem/sub/psub/ssub14字段，整数为uint64十进制原文，文本有字符/UTF8预算；缺失/非法值null，重复选定字段与已显示记录的重复非空ID拒绝歧义，跳过未知。

沿用RESP1MiB/8192节点/深度32、10秒操作截止和可信目标代次；CLIENT LIST另加256KiB解释预算（后置，不能冒称网络/JS堆限制）。最多200展示行，统计原始有界文本中本次返回记录数，明确完整/截断。固定字段不进入常规日志；主表精选列、其他字段点选后查看，保留工作台分栏。先模型/契约/Host，再原生实连/大列表/预算/权限/取消/超时，尚未验收。

## 模型里程碑

严格Host/Client/tests类型、构建、27文件277项通过（新增9项client-list与1项loopback管理命令拒发）。[原始控制台](artifacts/27-client-list/model-check-console.log)覆盖固定LIST、字段新增/缺失/空/零/uint64/UTF8/歧义、205记录仅200展示、256KiB解释预算、协议/权限/不可用、可信目标/代次/B、取消/10秒与双端严格覆盖一致性。尚未验证原生UI/真实大列表，五项仍不勾。
