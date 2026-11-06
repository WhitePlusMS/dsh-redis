# 缺失 Key 与 TTL 历史边界复验

日期：2026-11-06。源码起点 `22f68b9`，日常 DSH 0.2.1-rc.5 / bzkj-LLM 沿用应用安装 `ba1a4da`；安装包比对沿用[此前记录](refresh-receipt-2026-11-06.md)，本轮未重新打包或比对安装文件。没有修改应用、模型配置、认证或业务数据。

## 实际范围

新建原生日常 DSH 只读对话，模型先仅打开 Redis 面板，再由本地表单连接所属合成夹具。夹具为 `scripts/hold-ai-acceptance.mjs` 默认 22 条数据，Redis 端口 4781，经已有 RESP 代理 8050 转发并记录命令名称。没有保存连接资料或连接业务 Redis。

连接时侧栏读取 DB 信息并扫描名称；随后收起侧栏，没有选中任何 Key。以下两轮都在这个状态直接查询指定名称。只读诊断期间的命令增量为 `TYPE → TYPE → PTTL → TYPE`，无 SCAN、GET/GETRANGE 或 SELECT。清理前重新打开侧栏又读取 DB 信息和名称，不能把整个验收过程称为无扫描。

## 问题与结果

| 请求 | 实际工具结果 | 核对结果 |
| --- | --- | --- |
| `fixture:missing 查不到，请帮我判断原因。只检查这个 Key，不扫描、不读取其他 Key。` | status 确认 DB0、selectionSync=unavailable；metadata 返回 missing、type=null、ttlMs=null，采样 UTC 05:16:38.916Z | 定点身份、缺失状态和范围一致；实际仅增加一次 TYPE，没有从旧选区取值 |
| `再只检查 fixture:string 的类型和 TTL，不读取值。能据此判断它从未设置过过期时间吗？` | metadata 返回 value、type=string、ttlMs="-1"，采样 UTC 05:18:55.035Z；ttlMeaning 明确只描述当前状态 | 模型正确回答不能证明“从未设置”；TYPE/PTTL/TYPE 与返回一致，未读取值 |

第一轮模型提出跨 DB 查询的澄清问题，验收输入“不要再查，也不要切库。请结束这次诊断，只说明目前哪些事实能确定、哪些历史原因不能确定。”后结束，没有继续查询。这个后续约束属于验收输入，不能把修正后的收尾当成未经引导的首次回答。

两轮结果为同一连接、同一 DB0。原生读取卡片保留实际身份、采样时间、TTL 含义及非快照限制，没有把 null 当成 -1，也没有返回值字段。临时脚本从保存的原始 JSON 和命令记录逐项断言通过。

## 尚未通过的解释

主要采样事实和“不能由当前 TTL 推断历史”的结论正确；完整回答仍有问题：

- 第一轮将历史及跨范围问题统称“这类信息根本不留痕”，又称过期“事后不可验证”。本次证据只支持这些工具结果没有历史资料，不能证明系统不存在其他记录。它把负例 fixture 明确标为推断，没有当作实测事实，但对可能原因排序缺少测量依据。
- 第二轮说 SET 不带 EX/PX/SETEX 就丢弃旧 TTL：SETEX 是独立命令，且该概括遗漏了 KEEPTTL。官方 [SET 参数与保留 TTL 说明](https://redis.io/docs/latest/commands/set/) 可直接核对这些边界。
- 第二轮同时提到 RDB/AOF 和 RESTORE“未携带过期时间”，容易把不同恢复机制混在一起。不能从本次 -1 推断发生了这些过程；Redis 会把过期信息以绝对时间保存，见[官方过期与持久化说明](https://redis.io/docs/latest/commands/expire/#expires-and-persistence)。
- 以“持续监听 expire/persist”作为历史判断来源仍需要完整覆盖时段等条件。通知采用 Pub/Sub，断连期间事件会丢失，不能把缺少事件视为从未发生的证明，见[官方 Keyspace notifications](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/)。

上述扩展内容不是工具返回的事实，也没有执行对应写入。模型仍把 think 标签输出到正文。此轮不将完整节点 1/3/7 或整体模型准确性标为通过；也不向 Redis reader 追加聊天清理逻辑或把重复提示词修改当成解决方案。

## 回执故障注入尝试与边界

本轮原计划验证真实渲染完成后丢失回执，未成功实施，不能计为通过：

1. 临时 HTTP/WebSocket 代理只绑定回环地址，保留 Host/Origin/认证信息交由原宿主验证。新端口 1196 被 DSH 的 authority-bound cookie 校验拒绝；没有改写认证、连接模型或转发 Redis 命令，代理随后退出 0。首次依赖定位失败在监听前退出，改为 pnpm 包真实路径后才正常启动。
2. 返回原始已授权 3080 页面后，浏览器 CDP 明确不支持 Page.addScriptToEvaluateOnNewDocument。故障脚本没有安装或执行，没有进一步绕过；随后使用普通原生 UI 完成本页诊断。

此前 `22f68b9` 的 15 项浏览器回归仍只是 Chromium/内存 Host 通道/合成读取，不替代这里缺失的真实回执验收。后台标签页 hidden 的工具限制也未因此消除。

## 清理与证据

页面已手动断开并关闭。RESP 代理最后记录连接关闭、errors 为空并退出 0；Redis 夹具对照全部 22 条 Key 的 DUMP、PEXPIRETIME 和 DBSIZE 一致，返回 fixtureDataUnchanged=true、fixtureStopped=true，进程退出 0。4781/8050 及中途尝试的 1195/1196/4350 均无监听，日常 DSH 3080 / PID20528 保留。

本机证据目录：`C:/Users/admin/AppData/Local/Temp/dsh-redis-receipt-wire-20261106/`。包含 missing-initial/final/raw-dom、ttl-final/raw-dom、两张截图、closing-dom、proxy-events/state、verify.mjs、verification.json 以及 RESEARCH_LOG。首次 DOM 提取脚本未去缩进而断言失败，修正提取后通过，不视为产品错误。

复用代理控制器时曾误在上一轮证据目录启动，立即停止且未发生连接或命令；本轮追加记录已单独保存，旧日志恢复原字节前缀、旧状态恢复原最后停止记录，再复制控制器到本轮目录。详细操作保留在本机 RESEARCH_LOG，不混为历史验收的新事件。

仅新增文档记录，执行文档 diff 检查；没有重复未变产品的完整构建与测试。真实模型工具读取通过不等于模型全部文字正确。
