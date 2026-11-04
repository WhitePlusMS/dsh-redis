# 用户问题：真实 DSH 与模型部分验收

日期：2026-11-04。此记录仅覆盖下列场景，不代表全部任务完成。

## 环境与范围

- 用户日常 DSH Web `0.2.1-rc.5`，`127.0.0.1:3080`，使用其已配置的 `bzkj-LLM`。在新建的独立对话中测试。
- 构建源码包含提交 `a38cae1`；安装包 `dsh-redis@0.1.1` 的 SHA-256：`9fad6f9c554d7c4a4c5467dfc4f51a75522f35062cba5c2eb17cb58a7343a09c`。插件管理器显示该包路径并显示运行中；安装后的 Client 及 Host 描述文件与构建产物哈希相同。
- 自建隔离 Redis `8.2.6`，本机随机端口、19 个合成 Key；不涉及用户业务数据。脚本 `scripts/hold-ai-acceptance.mjs` 在释放前校验五个代表性 Key 的 DUMP 和总 Key 数量未变，输出 `fixtureDataUnchanged: true`、`fixtureStopped: true`。

## 已观察到的结果

1. **直接字段读取**：侧栏收起、未选中 Key，询问 `fixture:user:123` 的 `status`。模型调用 `redis_viewer_value`，实际参数为 `key: fixture:user:123`、`field: status`；返回 `source: explicit`、`synthetic-active`、Hash、无过期时间。模型给出了连接、DB、时间和结果。
2. **按字段筛选**：询问 `fixture:order:*` 中 `status = synthetic-failed` 的订单。模型两次调用 `redis_viewer_filter_hash`，报告两批共检查 16 个候选、命中 4 个（尾号 0、4、8、12），说明扫描完成不等于一致性快照。
3. **成员和缺失**：模型分别调用 `redis_viewer_value` 查询 `fixture:members`、`fixture:scores` 和不存在的 `fixture:user:missing`，回答成员存在、分数 `3.75`、Key 不存在，并未断言不存在的原因。
4. **名称线索**：询问名称以 `fixture:order:1` 开头的候选，模型调用 `redis_viewer_keys` 使用 `fixture:order:1*`，返回 7 个候选（1、10 至 15），未擅自选择，并说明扫描范围。

## 发现的问题

- 要求打开 `fixture:user:123` 时，隐藏面板下 `redis_viewer_show` 返回 `no_receiver`，`redis_viewer_locate_key` 返回 `stale`；手动打开面板、刷新页面和手动选择后，选择同步仍不可用，模型如实说明未定位成功。
- 真实浏览器流回执为 `gateway/invocation-unavailable`：`redisViewer/openUiChannel` 没有活动 Remote 方法。预算面板的新增 `redisViewer/aiBudgetStatus` 请求为 HTTP 404。旧包的 Host 描述中没有这两个接口，新包中有。
- 本机 DSH `dsh-typert-loader` 固定版本文档明确说明包解析和导入的 manifest 在进程生命周期内缓存；当前日常 DSH 进程早于插件替换启动。**旧接口清单未随替换更新是与这些证据一致的原因，仍须以重启后的结果确认**。不能把本次定位失败认作插件逻辑已经修复或已经验收通过。
- 为避免中断其他会话，本次未停止日常 DSH。当前新插件已经安装并启用，但该进程中的新增 Host 接口无法使用；在安全重启并复验前，界面定位、选择同步及预算面板不能标为可用。其他异常组合、全部基础类型、诊断和真实模型完整验收仍待执行。
