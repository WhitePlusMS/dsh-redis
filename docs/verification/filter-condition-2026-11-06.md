# 筛选条件记录与日常安装验收

日期：2026-11-06。应用源码 `4f7ffd4811ece293e3bd4236a56c96beca4db669`，DSH Web `0.2.1-rc.5`，真实模型 `bzkj-LLM`。本次补齐筛选记录缺失字段名和比较值的问题；不改变筛选语义、读取命令或模型自由回答。

## 实现与自动检查

Host 每批结果保留完整 `condition.field` 和 `condition.equals`，空页及失败页也保留；内容来自当前已校验的查询条件，不是从 Redis 读到的值。原生卡片从本次记录直接展示 JSON，不从参数历史或侧栏推断。分页尺寸测量计入条件的 JSON 转义长度，仍受 64 KiB 限制。

- 脚本语法、三层 TypeScript 检查通过；工具、范围确认、实际客户端构建和卡片投影共 118 项专项通过。
- 两个独立 Redis 8.2.6 / WSL 镜像专项通过。筛选专项覆盖普通续页、缺字段/非 Hash、空字段及空比较值、中文加控制字符；1024 字节字段和 4096 字节目标值均为 NUL 的边界场景，与三条长 Key 组合后正确分批，全部匹配身份返回且各页不超过 64 KiB。32 条初始化数据的 DUMP、PEXPIRETIME、DBSIZE 与写命令计数结束对照一致。
- 权限专项验证允许读取及 HGET、SCAN 拒绝，筛选失败仍保留本次条件且 checked=0；数据和绝对过期时间不变。测试实例均已停止。这些是实际 Redis / ToolRuntime 专项，不是模型验收。
- 提交 `4f7ffd4` 后，规范和需求两路独立只读审查均为 0 项发现。
- 默认 `pnpm pack` 的完整 prepack 通过：82 个测试文件、678 项，184.11 秒。

## 安装与加载

包 SHA-256：`9c1709da01185768a8a3209629b67ca3aa5b5a8c7626e09d29d9387828662eac`。原包及固定哈希文件位于 `.scratch/artifacts/filter-condition-20261106/`；日常 web profile 依赖清单指向固定哈希文件。

先备份 profile 的五份现存清单/配置，核实日常服务原 PID `16056` 的 Node 路径、DSH 入口、web 参数及 3080 监听所有权，再停止该服务、通过官方 CLI 安装新包并以原 Web 入口重启。当前 PID `36220` 监听 `127.0.0.1:3080`。137 个归档文件与安装内容逐字节一致，除包管理器生成的 package.json 外亦与工作区源产物一致；归档顶层白名单检查通过。未读取或输出启动日志。

## 真实界面与模型

浏览器刷新后，在原隔离验收对话连接新建的独立 Redis 8.2.6（本次 `127.0.0.1:12696`、DB0、24 条合成 Key），无选中项，模型访问模式仅可查看。明确告知模型旧连接及历史结果已过时；不连接用户业务 Redis。

1. 自然语言请求在 `fixture:order:*` 按 `status` 精确等于 `synthetic-failed` 查找。模型先查当前状态，确认新地址，再发起原生范围确认。接受后执行两批筛选，只确认一次：checked 10+8=18，matched 2+2=4，different 6+6=12，missingField=1、notHash=1，其余 0。匹配名称为 `fixture:order:0/4/8/12`。两批记录时间均为 `2026-11-06T01:07:12.677Z`，各自读取时间范围仍独立保留。
2. 请求相同范围改查 `synthetic-no-match`。新条件重新确认，续页不重复确认；两批 checked 10+8=18、matched=0、different 8+8=16，missingField=1、notHash=1，其余 0。记录时间为 `2026-11-06T01:08:04.918Z`。

四张新卡片的 condition 值块与各自原始 JSON 逐一相等，前两张仍为 synthetic-failed，后两张为 synthetic-no-match；两轮各自末页 scanComplete=true、cursor=null。旧构建的历史卡片不补造不存在的 condition。

模型最终回答正确复述匹配名称、分类和当前地址，说明非快照与范围限制，没有复用旧端口结果或把跳过项当成值不同。本次没有再出现上一轮的 HEXISTS 承诺或由计数一致推断无遗漏，但只覆盖这两次对话，不代表这些问题普遍消除。首轮中间说明把空用户名称为“无认证用户”，状态中的空 username 不能证明服务端身份或认证配置；页面仍显示模型 `<think>` 文本，完整模型解释及展示问题保持待处理。

## 结束对照和证据

结束时 SCAN calls=3（侧栏一次、两轮筛选各一次）、HGET calls=34，SET/HSET 仍为初始化的 2/18，没有 HGETALL 或 DEL 的 commandstats 行。界面手动断开后，夹具回执 `fixtureDataUnchanged:true`、`fixtureStopped:true`，24 条 Key 的内容、绝对过期时间和数量均与初始化一致。没有在途模型请求，日常 DSH 保留运行。

本机证据目录 `C:\Users\admin\AppData\Local\Temp\dsh-redis-filter-condition-20261106` 保存 `installed-check.json`、`matched.txt`、`no-match.txt`、`cards.json` 和 `condition-card.jpg`；截图和完整页面含本机工作区信息，不提交仓库。完整打包日志另存 `dsh-redis-filter-condition-pack-20261106.log`。本次真实模型未复验权限失败、空字段、控制字符或输出上限，其证据仅来自上述专项；其他七项任务及企业案例继续按唯一任务清单执行。
