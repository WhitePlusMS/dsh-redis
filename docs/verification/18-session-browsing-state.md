# 18 按可信 DSH 会话恢复浏览选择

2026-10-16，用户指定 DSH CLI/SDK 0.2.0-rc.2，Node22.22.1、pnpm11.22.0。包 SHA-256：`53c5b7dcb6a4f2c538d67f894d7fbf6e7029bcdc83e837c0214211720cc4b075`；隔离profile安装lib70文件集合/内容一致。

## 交付行为

- 连接资料仍共用；每个可信 Host 会话分别保存配置ID、已选DB、Key MATCH、原Key的规范Base64、八种查看器各自的显示格式、已提交String字节窗口。空Key字符串与未选择null不同，完整二进制Key上限64KiB。
- 状态保留在当前Host实例的会话Map，独立于React挂载和连接对象；不写浏览器local/sessionStorage或磁盘。Host/插件重启后重新选择，当前票不承诺跨DSH重启恢复。连接配置文件原有持久化范围保持。
- 恢复只显示Key身份，不自动SCAN/读取值/SELECT/新建socket。连接仍在时显示实际状态；连接不存在等待手动连接。手动重连从DB0开始，若保存Key属于DB1，先手动SELECT DB1再允许读取，避免误查同名Key。
- 不恢复值、集合缓存、续页opaque token或socket/generation；String只恢复已提交窗口，其余集合/模块在显式打开后重新首读。格式继续用既有BytePreview，保留原默认值，换cell不再默默重置用户格式。

## 实现与边界

1. `loadBrowsingState/saveBrowsingState`为固定23项Agent RPC清单的两项。归属来自Typert可信Agent lookup，slot注入闭包捕获sessionId；DTO只允许既定字段，拒绝sessionId/agentId、值、密码、目标或cursor。两端严格schema，Client进入context前也显式parse。
2. `RedisBrowsingStates`每次读写返回独立对象，取消在变更前检查；`session/disposed`只移除自己的浏览状态、连接和游标，Host卸载清全部。不存在跨会话共享Redis客户端；共享的是无密码连接资料。六项新专项覆盖两个会话/clone/owner disposal/取消/二进制及空Key/最大窗口/严格字段/队列顺序与拒绝恢复。
3. 固定rc.2 SessionStore中disposed是离开store的生命周期（包含publication rollback），客户端sidebar binding cleanup不是该事件。没有公开普通Session delete Remote，未将“归档”冒称Host dispose。核心清理以状态及连接专项、真实Host事件接线和整体Host退出为证；未在原生中伪造普通删除按钮已测。
4. `BrowsingSession`先加载偏好，再挂连接表单；sessionKey作为Provider React key，防复用组件时携带前会话表单。每会话偏好请求串行，新挂载load等待先前已发save；不同会话互不等待。有限保存可在旧视图卸载后为其捕获的owner完成，响应不会重写新UI；失败有显式重试。网络/进程失败仍可能失去未保存选择，不承诺事务式跨进程保存。
5. `ProfileChooser`恢复ID并回填非密码设置；找不到配置则清该会话失效引用，不自动连Redis。`KeyBrowser`恢复选择后只显示提示，显式“读取已选Key”才挂载reader。新搜索/扫描/目标变更清当前结果，所有实际读取继续使用既有DB/连接代次校验和取消。

## 实际验证

- 严格Host/Client/tests类型、构建与完整222项回归通过（新状态专项6项）；真实client bundle验证两个slot闭包分别绑定自己的session ID。pack生命周期完整执行，没有跳过hooks或减少测试。
- [普通直连双会话21组](18-native-sessions-smoke.json)全部通过，自建Redis8.2.6官方固定镜像文件+wsl-image；未用Docker或业务库。A为DB1、二进制Key、MATCH=session:a:*、Hex、offset1/count256；B为DB0、native:9、Base64。两会话分别在两个自建workspace，使用DSH普通工作区创建/复用blank入口并核对实际session/create响应ID；不是伪造Host身份或调用模型。
- 实际INFO commandstats在切换恢复前后保持，socket数和target不变；仅手动操作才连接/SELECT/读取。A/B各自恢复，断开A不影响B；A重连DB0先禁止读保存的DB1 Key，手动选DB后恢复。Host拒绝在B状态DTO塞A的sessionId和密码且不回显秘密，两边状态不变。
- A实际reader返回后在HTTP边界明确延迟，切B后放行；旧请求被abort，B的值OQ==、格式和两边保存选择不变。报告唯一requestFailure为预期的readString net::ERR_ABORTED，pageError与consoleError为空。这是前端迟到结果注入，不能冒称Redis服务器慢计算已经取消；统一传输取消/超时由19验收。
- [无Redis侧栏启动](18-native-bootstrap-smoke.json)通过，浏览器三类错误均为空。[B恢复截图](18-native-sessions-b.png)已查看，完整Base64值在机器检查中校验；截图下方数据预览不在当前可见区，20仍需完成布局。
- 同包全类型运行完成原有75个视图/协议检查和A状态保存，加最终Host关闭共[77组记录](18-native-types-before-hidden-blank-smoke.json)，随后因脚本点击DSH隐藏的非current blank B而失败，**整轮passed=false**。不将77组报告冒充全套成功；21最终发布需再跑完整门禁。后续改工作区入口才完成上述21组专项。

## 失败追溯和资源

初次原生在报告前中断，原因未确证，[原记录](18-native-interrupted.json)保留；第二次console确认未提前处理的waitForResponse超时导致Node退出并跳过finally，[console](18-native-unhandled-response-console.txt)保留。验收改成绑定并发waiter，随后捕获真实隐藏blank失败，停下重审为官方workspace入口，没有往产品补测试hook。

另一次[7组环境失败](18-native-environment-failure-smoke.json)在普通SCAN前后出现管理连接关闭，同时只读WSL命令有Service I/O 0x800703e3；当时C盘约238MiB。下一次[5组页面启动失败](18-native-page-bootstrap-failure-smoke.json)未进入双会话，visibleText为空且没有新失败截图，不拿上一轮旧PNG冒充。上述事实不证明C盘是唯一根因。随后无Redis启动与普通直连21组成功；此前完整类型报告、各失败记录均保留，未重写成通过。

最终成功轮自建DSH/Chrome/Redis、证书和UUID目录均清理true；没有启停用户服务、清理C盘或动日常profile。早期两轮异常退出留下6a0fb5e9与ab6db273两对UUID临时目录，清理命令被自动审核拒绝（blocked by policy）后未绕过。最终只读核对原Linux PID286/298均不存在；目录继续保留。16号Git导出快照及其junction也因此前清理拒绝保留，不参与本次构建或提交。

19取消/断线恢复、20布局主题、21发布门禁及八张P1未完成；本票不声明完整29票交付。按用户约定归档核对后提交本地Git，不push。
