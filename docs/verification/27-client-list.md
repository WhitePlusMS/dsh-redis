# 27：有界客户端连接快照（已验收）

当前01–27done、28–29ready，原29票图不变；各节保留本轮里程碑时点。

## 来源与最简范围

[Redis官方CLIENT LIST](https://redis.io/docs/latest/commands/client-list/)已核对选定字段、版本新增字段及应容忍缺失/忽略未知的约定；LUNA也只读描述了8.2.6 networking.c实际输出。固定CLIENT LIST，不开放TYPE/ID输入、KILL/PAUSE或任意管理子命令。

选定id/addr/name/user/age/idle/flags/db/cmd/qbuf/omem/sub/psub/ssub14字段，整数为uint64十进制原文，文本有字符/UTF8预算；缺失/非法值null，重复选定字段与已显示记录的重复非空ID拒绝歧义，跳过未知。

沿用RESP1MiB/8192节点/深度32、10秒操作截止和可信目标代次；CLIENT LIST另加256KiB解释预算（后置，不能冒称网络/JS堆限制）。最多200展示行，统计原始有界文本中本次返回记录数，明确完整/截断。固定字段不进入常规日志；主表精选列、其他字段点选后查看，保留工作台分栏。先模型/契约/Host，再原生实连/大列表/预算/权限/取消/超时，尚未验收。

## 模型里程碑

严格Host/Client/tests类型、构建、27文件277项通过（新增9项client-list与1项loopback管理命令拒发）。[原始控制台](artifacts/27-client-list/model-check-console.log)覆盖固定LIST、字段新增/缺失/空/零/uint64/UTF8/歧义、205记录仅200展示、256KiB解释预算、协议/权限/不可用、可信目标/代次/B、取消/10秒与双端严格覆盖一致性。尚未验证原生UI/真实大列表，五项仍不勾。

## 客户端原生专项（其他同包回归进行中）

当前包SHA `26cd754135521aa664261ad1ab92f73654bb8e865a4277cc6ae9f706b098dfb4`，132837字节；prepack再次277项，通过93打包文件/84lib/12peers/2依赖及逐文件隔离安装核对。

真实Redis8.2.6客户端原生专项23项通过：205个夹具自有额外连接、实际208记录/200展示与明确截断，14选定字段、7列表格及按需7字段详情、单位/空名称、关闭清空、行检查零读取；真实ACL LIST拒绝、取消/排队/10秒/EOF/代次/B/手动重连无重放、真实客户端退出清除详情和Key值/过期不变。205连接全部finally关闭，自建DSH/Redis/代理全停清理。

真实大回复的两个预算分开验证：夹具admin仅为构造样本设置自有连接的300KB名称，UI A在完整有界帧接收后触发256KiB解释拒绝，清空表格但保留连接；恢复名称后显式刷新恢复。另用1.1MB名称构造大于1MiB的真实CLIENT LIST，Host C直接连接自有Redis，拒绝声明过大的bulk、无结果且只关闭C，A/B正常；明确绕开测试代理自身1MiB decoder，不冒领代理的边界。测试用SETNAME不是插件接口，[官方长度边界](https://redis.io/docs/latest/commands/client-setname/)已核实，夹具finally整体关闭。两者均不声称总JS堆固定上限。

缺字段/空名、非法数值ID、unavailable与空结果UI由明确HTTP结果注入验证，不冒称旧版/缺命令实际服务。连接中的CLIENT LIST至少包含自身连接，真正零记录在本次模型/注入覆盖。真实只测8.2.6，字段新增/缺失与uint64极值由纯解析/严格DTO覆盖。入口无Key字节输入，源Key DUMP/过期不变只证明诊断未改值；Key TYPE消失不对应此服务器入口。TLS客户端快照专用门禁未执行，不把既有TLS基础证据冒充新验证。

## 最终同包验收与归档

同一包 `26cd754135521aa664261ad1ab92f73654bb8e865a4277cc6ae9f706b098dfb4`：prepack严格Host/Client/tests类型与构建、27文件277测试；客户端原生23、完整12类数据/双会话/实际React及27方法SDK87、工作台24（22几何样本）全部通过。93打包文件、84lib、12Host peer、2依赖与164源码输入SHA逐文件匹配。客户端实际取消49ms、生产截止10112ms。

[原生专项](artifacts/27-client-list/native-clients-smoke.json)、[全数据与SDK](artifacts/27-client-list/native-ui-release-smoke.json)、[布局](artifacts/27-client-list/native-workbench-smoke.json)、[精确包清单](artifacts/27-client-list/workbench-release-manifest.json)、[28份原件SHA清单](artifacts/27-client-list/inventory.json)可复核。各报告page/console错误为空；客户端有2条预期取消ERR_ABORTED，全数据有1条预期取消，布局无请求错误。各报告processStopped/fixturesStopped=true，客户端代理与205额外连接也全部停止。

本包未修改SnapshotDialog和已有INFO/SLOWLOG渲染器，不把25/26旧包专项当作本包重跑。当前布局通过不等于用户视觉验收；真实客户端表格截图已查看，按需详情和背景工作台分栏保留。无新TLS客户端专项、无不同Redis版本实连结论；接收、后置解释、展示三种预算各自表述。仅项目隔离profile安装，无日常配置/业务数据/开发服务改动。
