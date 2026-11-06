# 诊断与专业数据边界实测

日期：2026-11-06。工作区起点 `2869732`；沿用已安装应用源码 `4f7ffd4`，包哈希及 678 项完整检查见[安装记录](filter-condition-2026-11-06.md)，本轮没有重新打包、安装或修改模型配置。

## 结论与范围

日常 DSH Web / `bzkj-LLM` 的新只读会话完成 24 次工具调用：打开面板 1 次、广告缓存 3 次、概况/慢日志/消费组 6 次、专业边界 8 次、专业权限拒绝 6 次。轨迹没有名称扫描工具、替代读取或消费工具。连接时侧栏自动加载了名称和 DB 信息，因此不能把全部 UI 访问也说成只读了指定 Key。

原生结果中的值、空结果、缺失及权限拒绝与隔离实例对照一致。模型正确保留多项主要限制，但仍有无依据归因、虚构字段和误述历史目标；完整回答准确性未通过，不将节点 3/6/7 标为完成。正文及标题仍可见 think 标签，归属调查见[上轮记录](selection-and-model-display-2026-11-06.md)。

## 夹具与保护

复用 `scripts/hold-ai-acceptance.mjs`，新增两个可选开关：`--enterprise` 创建合成广告 String 并纳入不变性检查；`--restricted-specialized` 创建只用于此所属实例的受限账号，保持 TYPE 等元信息可读，拒绝 JSON.GET、TS.RANGE、GEOPOS、GEODIST、GETRANGE、XINFO GROUPS。要求同时启用 modules、geo 和 stream-group（unknown-lag 也启用组）。默认夹具行为不变，不增加产品命令或依赖。

本次运行使用 `REDIS_TEST_BACKEND=wsl-image`，参数为 `--enterprise --modules --geo --unknown-lag --restricted-specialized`。实例 Redis 8.2.6，回环端口 3708，26 个合成 Key。账号仅经本地连接表单输入，密码未进入模型请求或结果文档。先以默认连接查询，再断开并使用受限账号连接同一实例；这不是原连接保持期间候选连接失败的验收。

独立管理连接执行 ACL DRYRUN，六种读取均得到拒绝字符串，TYPE 得到 OK。最初临时探针误用 `assert.rejects`，因 DRYRUN 返回字符串而失败；随后改用字符串断言，六项通过。另直接核对 JSON 三路径、空 TS.RANGE、缺失 GEO 成员/距离、越界 GETRANGE 和缺失 Bitmap Key；这些属于只读命令对照，不代替模型验收。

结束先在 UI 断开，夹具对照全部 Key 的 DUMP、PEXPIRETIME、DBSIZE、组信息、XPENDING，以及 xreadgroup/xack/xclaim/xautoclaim/xgroup|setid/xdel/xtrim 调用计数。返回 `fixtureDataUnchanged`、`groupStateUnchanged`、`noConsumptionCommands`、`fixtureStopped` 均为 true，进程退出 0，端口 3708 不再监听。日常 DSH 3080 保留。本轮没有连接业务 Redis。

## 广告缓存与诊断

广告请求只给出 `fixture:ad:1001`、`fixture:ad:missing` 两个明确 Key，同时询问本地缓存一致性。两次 metadata、一次显式 value：广告值为 `{"id":"1001","status":"synthetic-active"}`，41 字节，完整，TTL -1；另一 Key 为 missing。采样 UTC `01:33:21.051Z` 至 `.066Z`。模型正确说明 TTL 仅代表当前状态、缺失原因不能据此确认、没有应用进程侧证据就无法判断缓存一致性。本轮该问题的主要事实和边界吻合。

随后请求服务器概况、最近 3 条慢日志和 `fixture:stream` 消费组，询问网络丢包/操作系统中断是否可被确定为高延迟根因。实际读取四个 overview section、slowlog(count=3)、stream_groups：

- 概况：Redis 8.2.6、uptime 325 秒、used_memory 1757648、RSS 28352512、maxmemory 134217728、比值 16.13；客户端 2、阻塞 0。其余 stats 保留在原始卡片中。
- 慢日志实际返回 1 条，JSON.SET，17685 微秒；事件 UTC `01:30:52.000Z`，查询 UTC `01:36:16.098Z`，两者未混淆。该写命令来自夹具初始化，不是插件执行写入。
- 两组：fixture-group 的 pending=1、lag=1；fixture-unknown 的 pending=0、entriesRead=null、lag=null、lagStatus=unknown。模型未把 unknown 说成 0，也未虚构待确认消息 ID。

模型正确说明现有采样不足以判断网络或 OS 根因，且慢日志不含网络往返。但它将高内存比值具体解释为 jemalloc arena 预占，结果未提供分配器或该因果证据；又把 pending=1 表述为“卡在消费者手里”，单次未确认计数不能证明卡住。主要数值一致不等于完整诊断通过。

案例来源为[美团 DSP 本地缓存实践](https://tech.meituan.com/2018/12/20/lrucache-practice-dsp.html)与[美团 Redis 高负载实践](https://tech.meituan.com/2018/03/16/redis-high-concurrency-optimization.html)。这里只借用问题形态，未复现企业生产架构、规模或故障。扫描与 GitHub 认证案例不计为本轮完成。

## 专业边界与权限

正常账号的八次调用 UTC `01:37:14.549Z` 至 `.611Z`：

| 目标 | 工具事实 | 模型主要结论 |
| --- | --- | --- |
| JSON $.large | matchesJson 原文 `[9007199254740993]`，matchCount=1 | 保留大整数精度 |
| JSON $.nil / $.absent | `[null]` / `[]`，matchCount=1 / 0 | 区分 null 值和无匹配 |
| TS 4000–5000 ms，count=3 | samples=[]，complete=true，cursor=null | 区分窗口无样本与整条序列为空 |
| GEO 缺失成员坐标及距离 | member-missing，coordinates/distance=null | 不解释为零距离，不断言另一成员存在或缺失 |
| Bitmap 偏移 1000、8 位 | String 长 22 字节，bits=00000000 | 越界补零，不代表已存储八个零 |
| 不存在的 Bitmap Key | missing，bits=null | 与存在 Key 的零值区分 |

完整文本仍有错误：把 JSON.GET 简称“三次独立 GET”；为 TimeSeries 窗口增加了结果和接口均没有的 `receivedAt` 字段，并把聚合桶时间覆盖扩写成“结束后才落库”。[TS.RANGE 官方定义](https://redis.io/docs/latest/commands/ts.range/)按样本 Unix 毫秒时间戳查询，压缩桶可能覆盖 toTimestamp 以后的原始样本时间，不等于入库时间。工具结果本身没有这两个说法。

受限连接的六次调用 UTC `01:38:25.764Z` 至 `.812Z`：JSON $.nil、TS 1000–3000/count=3、GEO west 坐标、west→east 距离、Bitmap offset=0/count=8、Stream groups。均为 `state=failed,error=permission`，没有值；TS 与 groups 的空数组伴随 complete=false。原生卡片展示错误信息，模型正确解释这些为空占位，未把拒绝当作缺失或模块不可用。轨迹确认没有重试和替代读取。

模型附加解释仍误称上轮 `fixture:west` 缺失；上轮明确缺失的坐标目标是 `fixture:missing`。它还把空用户名说成匿名账号，空用户名本身不能支持该认证结论。故本轮权限分类通过，整段回答未通过。

## 检查、证据与后续

- 夹具修改后 `pnpm typecheck`、`node --check scripts/hold-ai-acceptance.mjs`、`git diff --check` 通过；真实夹具启停与数据不变性如上。没有新增 TypeScript 或产品接口，不重复全量打包测试。
- 临时证据目录：`C:/Users/admin/AppData/Local/Temp/dsh-redis-diagnostics-specialized-20261106/`。保存四轮 DOM 文本、diagnostic-cards.json、boundary-cards.json、all-cards.json（23 条完整读取结果）、tool-trajectory.json（含 show 的 24 次参数/截断摘要）、permissions.jpg。完整结果以 cards 为准，轨迹摘要不能替代完整返回。
- 保存截图时尝试点击已经消失的“回到底部”按钮超时；检查截图确认页面本来就在底部，直接保存，无重复模型请求。这不是产品查询失败。
- 尚未覆盖本构建专业模块缺失、上限、取消和并发变化的全部原生组合；本轮也没有做认证候选连接失败、扫描续页或发布验收。

本轮继续支持“确定性读取记录供核对”的现有设计，没有证据支持通过新提示补丁保证全部自由文本正确。后续分别处理宿主/模型响应契约、未覆盖的连接与 UI 场景，并在最终文档中准确区分工具事实和模型解释的保证范围。
