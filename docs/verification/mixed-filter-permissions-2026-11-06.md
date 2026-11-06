# 混合类型筛选与权限拒绝真实验收

日期：2026-11-06。应用为已安装源码 `02988c2`，包 SHA-256 `682b5931b1d12e987af360f7693f083a62f34cfdbf9ac357bd519c15e2ae8583`；日常 DSH Web `0.2.1-rc.5`，模型 `bzkj-LLM`，新建独立对话，访问模式仅可查看。本轮只改验收夹具与文档，没有重新构建或替换应用包。

## 环境和步骤

使用既有 WSL 官方 Redis 8.2.6 镜像夹具：`REDIS_TEST_BACKEND=wsl-image node scripts/hold-ai-acceptance.mjs --mixed-filter --restricted`。本次监听 `127.0.0.1:6001`，24 条合成 Key；其中 16 条订单 Hash、1 条缺少 status 的 Hash、1 条 String，其他 6 条为基础类型样本。仅连接所属隔离实例，没有读取用户 Redis 业务数据。

`--mixed-filter` 为可选模式，复用既有初始化与结束校验。新增两条 Key 纳入 DUMP、PEXPIRETIME 和 DBSIZE 对照。账号凭据仅在本地连接表单输入，不放进模型请求、截图中的表单或本报告。侧栏无选中 Key，没有开启自动刷新。

以自然语言分别提出下列问题，没有告诉模型预期数量或指定工具。每个首次筛选出现 DSH 原生确认，明确服务器、DB0、pattern、字段与比较值，并说明 SCAN 可能遍历整个 DB；确认后续页不重复审批。换比较值、切换账号后均重新确认。

## 实际工具与结果

| 问题 | 实际调用 | 结果 |
| --- | --- | --- |
| 在 fixture:order:* 查找 status 精确等于 synthetic-failed，只检查该字段 | status 一次、filter_hash 两次 | checked 10+8=18；matched 3+1=4；different 5+7=12；missingField 1；notHash 1；其他分类 0。匹配名称为 fixture:order:0、4、8、12 |
| 相同范围查找 synthetic-no-match，不额外定位跳过项 | filter_hash 两次 | checked 10+8=18；matched 0；different 8+8=16；missingField 1；notHash 1；其他分类 0 |
| 本地切换受限账号后查询 fixture:order:0 的 status，并执行原 failed 筛选；拒绝后不绕过或复用旧值 | status 一次、value 一次、filter_hash 一次 | value.state=failed、error=permission、cell=null；筛选 state=failed、error=permission、所有候选计数 0、scanComplete=false、cursor=null |

前两次筛选均第二批结束，cursor=null、scanComplete=true；工具没有把缺字段和非 Hash 算进 different，也没有把错误伪装成无匹配。两轮初始采样时间分别为 `2026-11-06T00:50:39.299Z`、`00:51:40.199Z`。权限失败采样分别为 `00:52:26.186Z`、`00:52:43.150Z`。卡片与原始 JSON 的对应计数、名称和失败状态一致。

账号切换通过本地表单先断开再连接；不是候选连接失败保留旧连接场景，不据此宣称认证失败或候选资源释放已验收。新连接代次为 2，仍为同一隔离地址和 DB0。侧栏自动扫描被拒绝，显示已连接及权限错误，名称为空。模型未额外调用缓存、其他账号、其他 DB 或替代工具。

## 模型回答边界

匹配名称、分页数量、分类计数和两项权限拒绝复述正确。无匹配回答区分了缺字段/非 Hash 与值不同，说明非快照、可能重复、不能推断业务订单不存在；权限回答没有将旧账号结果作为本次值。

完整回答仍未通过，具体问题保留如下：

- 第一轮额外承诺可用 TYPE 与 HEXISTS 在不读字段值的情况下识别跳过项；当前传输白名单不含 HEXISTS，也没有独立存在性工具。没有实际执行该承诺，但其能力表述不实。
- 第二轮由两轮候选数与跳过数一致推断“支持遍历没丢项、过滤逻辑稳定”。这些汇总不能证明候选集合相同或没有遗漏，即使随后保留了非快照说明也不能支持前述推断。
- 权限回答写出“凭证未变化”，与本轮明确切换账号以及工具返回用户名变化不一致；其建议把 HSCAN/SCAN 与 HGET 作为替代授权选项也不适用于当前精确字段工具。没有实际提权或重试，仍不能把整段建议记为准确。
- 页面显示模型输出中的 `<think>` 文本，最终回答前有大量推演内容；此处只记录观察，不据此归因于 Redis 插件渲染或改变宿主/模型配置。

本轮不继续叠加提示词补丁，也不把结果卡片保真等同于自由回答准确。后续需要按具体任务核对工具能力与回答依据；现有七项任务维持未全部完成。

## 只读对照与清理

初始化后、模型读取前：SCAN calls=1（侧栏首次加载）、HGET=0、SET=2、HSET=18、DBSIZE=24。结束时成功 SCAN calls=3（初始侧栏加两轮筛选）、HGET calls=34；HGET rejected_calls=1，SCAN rejected_calls=2（受限侧栏一次、模型筛选一次）。没有 HGETALL 或 DEL 的 commandstats 行；SET/HSET calls 仍为 2/18。筛选每轮只对 17 个 Hash 读取 status，非 Hash 跳过；34 次 HGET 与两轮相符。

本地界面断开后，排除短暂观察连接的服务端客户端数从最初的 2 降至 1（只剩夹具管理连接）。随后结束回执为 `fixtureDataUnchanged:true`、`fixtureStopped:true`，24 条 Key 的 DUMP、绝对过期时间和数量与初始化一致。日常 DSH 保留运行；没有在途模型请求。本轮不覆盖并发写入、类型变化、取消、预算耗尽或所有 ACL 组合。

`node --check scripts/hold-ai-acceptance.mjs` 与 `pnpm typecheck` 通过。临时证据目录为 `C:\Users\admin\AppData\Local\Temp\dsh-redis-mixed-filter-20261106`，保存 `matched.txt`、`no-match.txt`、`permissions.txt`、`cards.json`、`final-stats.json` 和 `permission-result.jpg`。完整页面含本机工作区名称，仅保留本地，不提交 Git。
