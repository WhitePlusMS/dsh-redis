# 16 TimeSeries 时间范围与样本表验收

2026-10-16，用户指定DSH 0.2.0-rc.2，CLI/SDK同版，Node22.22.1、pnpm11.22.0。Redis8.2.6官方固定镜像文件通过既有WSL运行，TimeSeries模块实际MODULE LIST版本80210。使用项目独立DSH_HOME/profile、自建UUID实例，未使用业务库、日常profile或Docker。

## 产物与结果

- 包SHA-256：`f26893bdc08882e99237eba5597b92637ce3da71aa6d790527dee8bfcfa3603a`；按SHA命名安装，lib66文件集合和内容逐字节一致。
- Host/Client/tests严格类型、构建、完整202项回归通过，其中TimeSeries专项14项；源RESP2语义探针3组、真实生产reader7组、原生全功能73组通过，截图已查看。
- 镜像digest ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e，amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e。证据只适用于所列环境与包，未宣称其他模块版本已实测。

## 功能、边界和只读证据

1. TYPE精确匹配TSDB-TYPE，自动进入时间表；支持最小/最大毫秒时间、正倒序、每页1–100及继续读取。-和+表示最早/最晚；两方向都按lower/upper参数顺序发送，端点包含。每次只显示服务器已返回的样本，曲线留在29号。固定命令仅TYPE/PTTL/TS.INFO/TS.RANGE/TS.REVRANGE。[TS.RANGE](https://redis.io/docs/latest/commands/ts.range/)、[TS.REVRANGE](https://redis.io/docs/latest/commands/ts.revrange/)
2. 源探针直接用RESP2保留BigInt，确认0、9007199254740993及9223372036854775807精确，空范围/空序列为空数组，拒绝负数/溢出/Stream的(timestamp语法。续读在Host使用上页末时间戳±1，达到最大值或反向0后停止；内部前缀区分真实时间0与通用游标的终结标记。opaque token单用并绑定session/连接代次/DB/Key原始字节/范围/方向/条数。
3. 时间戳和服务器数值原文均以字符串传递，样本表不经Number重写。Redis会把某些写入字面量规范化为-1E-17、1.7976931348623157E308，保留的是服务器输出而非最初写入拼写。固定目标80210拒绝NaN/inf写入，未冒称其他新版本NaN支持。
4. INFO仅展示总样本数、首末时间戳和保留期；总数属于整个序列，不是范围匹配数。INFO权限拒绝/命令缺失与样本状态分开，权限不足仍可读取范围。未申请DEBUG或全量扫描，未传出标签、规则或巨大元信息正文。[TS.INFO](https://redis.io/docs/latest/commands/ts.info/)
5. 不增加聚合或LATEST；压缩序列未封闭末桶不包含。INFO、样本与TTL为分次观察，前后TYPE能发现部分删除/转型，不能发现所有同类型替换/回写或证明原子快照；并发写入、删除、保留淘汰可改变后续页。不会偷偷重连、重放或改变查询语义。
6. 真实235样本在两个方向以3页完整读出、时间戳无重复；单条页验证99–101包含边界，以及精确数值/0/Int64末端。二进制Key、空Key/空序列、完整64KiB Key、DB代次隔离通过。DUMP、绝对PEXPIRETIME及监测的TS.ADD/CREATE/DEL/ALTER/INCRBY/DECRBY和普通写命令计数均不变。
7. 最小ACL可只给连接/TYPE/PTTL/TS.RANGE/TS.REVRANGE；未给TS.INFO仍有样本，授权后恢复元信息。范围拒绝显示permission且不保留旧样本，另一方向可继续；TS.ADD仍被禁止。真实删除/转型分别在首TYPE后及范围返回后触发，丢弃旧样本。模块的ERR WRONGTYPE与ERR TSDB错误由固定分支重检TYPE，不外泄服务器文本。
8. 每页100、实际接收全帧/外发各1MiB、缓存5000样本/2MiB与总10秒截止沿用既有边界。真实2MiB TS.INFO标签被接收层拒绝并只关闭自己的socket，显式重连恢复；缩小样本数不能缩小该INFO本身，巨大元信息可能仍无法读取。取消/超时及stale/token/畸形返回的专项通过，统一慢网络/多会话恢复仍由18/19收口。
9. 原生实际验证了样本表、235条双向分页、精确端点与值原文、草稿不查询、错误范围保留上一已提交结果、空范围、INFO/REVRANGE真实ACL拒绝及恢复、空序列、删除/转String与源值/过期不变。缺命令UI和溢出时间戳使用明确标注的HTTP响应故障注入，不能称为真实无扩展服务器。目标无TimeSeries类型时通常由类型判定显示unsupported/missing；未实际禁用模块后保留其数据。
10. 原生故障注入曾发现rc.2当前调用路径未自动运行结果描述器校验，界面显示溢出时间戳。已在TimeSeriesView成功响应入口显式复用严格schema，再入缓存/渲染；新包73组证明坏值拒绝、旧表清空和正常恢复。其他RPC的浏览器接收边界留在21统一审计，不能据此宣称全部已核验。

## 修正记录与未扩大范围

真实检查首次将写入数值字面量当作服务器返回文本、第二次误判2条页的末样本；修正测试oracle和分组预期。第三次6组后暴露真实ERR WRONGTYPE前缀，独立实证后补固定类型重检，全部真实检查重跑7组通过。首次原生63组后因越界响应仍展示而失败，修复显式解析后重新打包并完成73组；失败报告均保留.scratch/artifacts原名，不改写为通过。

重pack曾在双worker的Windows commit压力下发生semi-space OOM；检查无遗留本项目worker后将Vitest并发降为1，并对本轮命令临时设512MiB堆/4MiB半空间。完整prepack202项实际通过，没有跳过生命周期、减少测试或更改用户系统设置。

截图中两时间输入宽度仍不均衡，20号统一布局任务收口；本票不宣称主题/窄侧栏验收完成。共享React运行时版本和其他客户端RPC接收校验留在21；13个profile missing-peer诊断的历史事实仍保留，不把本次原生成功替代整个发布门禁。全部自建DSH、Chrome、Redis已退出，证书/UUID目录清理true；未提交/push，完整29票仍未完成。

证据：[真实reader](16-redis-timeseries-smoke.json)、[RESP2源语义](16-timeseries-source-probe.json)、[原生73组](16-native-timeseries-smoke.json)、[样本表截图](16-native-timeseries-data.png)。
