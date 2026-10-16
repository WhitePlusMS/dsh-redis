# 26：有界慢日志快照（进行中）

当前01–25done、26in-progress、27–29ready，原29票图不变。

## 技术来源和边界

- [Redis官方SLOWLOG GET](https://redis.io/docs/latest/commands/slowlog-get/)与[Redis8.2.6 slowlog.c](https://github.com/redis/redis/blob/8.2.6/src/slowlog.c)已读取。真实目标8.2.6返回6段；明确接受文档描述的4/6/7段，其他形状拒绝，无命令降级。
- 固定SLOWLOG GET count+1，UI数量1–100，最多接收101条，额外一条仅判断更多，不提供-1/RESET/LEN/CONFIG；运行时白名单同时约束固定GET与计数。
- 只传id、Unix秒、执行微秒、受限命令名、已记录参数数、前8个参数的字节数和可用时原始总参数数。参数正文与客户端地址/名称均不进入DTO或常规日志。字节数是Redis记录片段长度，服务器自己可能截断，不能据此还原或宣称完整原参数。
- 沿用RESP接收1MiB、8192节点/深度32、10秒总截止、可信会话DatabaseTarget及代次校验；有界表格输出不冒充网络或JS堆上限。未验收，先模型/类型/Host，再原生表格/真实版本/权限/取消/超时/边界与包。

## 模型里程碑

Host/Client/tests类型、构建、26文件267项通过（新增8项slowlog、1项真实loopback固定子命令测试），[原始控制台](artifacts/26-slowlog-view/model-check-console.log)。覆盖正文/地址不出DTO、精确整数、空/数量/4-6-7段、首8参数长度、损坏形状/顺序/预算、权限/不可用、可信目标/代次/B、取消/10秒及严格两端契约。此处mock/loopback不是实际Redis日志或原生UI验收，五项仍不勾。
