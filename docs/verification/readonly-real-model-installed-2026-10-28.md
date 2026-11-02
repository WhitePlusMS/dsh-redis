# 已安装 DSH 插件的真实模型与合成 Redis 验证

日期：2026-10-28。此记录针对用户日常 DSH Web profile 中已经安装的插件，不代表当前工作区最新代码的原生 DSH 验收。

## 环境与范围

- 本机 DSH Web 使用已有模型配置，界面选择 DeepSeek-V41-Flash，访问模式为“仅可查看”。未读取或记录模型凭据。
- 另建临时、仅绑定本机回环地址的 Redis，使用随机端口与合成数据：两个 String Key 和一个含两个字段的 Hash。此实例不属于用户现有 Redis。
- 启动日志显示 Redis 插件 Host 已注册。比较已安装 `lib/host/ai-reader.js` 与当前工作区构建文件的 SHA-256 后，确认两者不同，因此下列结果只能归属于已安装版本。

## 实际对话与结果

1. 模型对不要求工具的连接检查回复“模型连接正常”。
2. 要求只读查询 `order:*` 并读取 `order:1001`。真实 DSH 轨迹显示依次调用 `redis_viewer_status`、`redis_viewer_keys`、`redis_viewer_value`；工具返回 3 个合成 Key 和预置的 `synthetic order alpha`，模型回答与工具输出相符。
3. 在真实 Redis 侧栏选择合成 Hash 的 `status` 字段后，要求读取当前字段。轨迹显示调用 `redis_viewer_status` 与无参数的 `redis_viewer_value`；模型返回字段 `status` 和预置值 `synthetic-ready`。
4. 明确要求切换到 DB 1。轨迹显示 `redis_viewer_select_db` 参数为 `{"db":1}`，随后调用 `redis_viewer_status`；回答和侧栏均显示当前 DB 1，原选中项失效。
5. 对临时 Redis 的 DB 0 回读验证：3 个 Key 的预置值和字段未变化。上述业务数据全部为本次临时合成数据；无 Redis 值、TTL、删除或消息确认等写操作由插件执行。

## 未覆盖

- 本次未在真实模型对话中验证当前工作区新构建的分页、预算或暂停续读；不能据此将 RO05/RO06 标记完成。
- 未覆盖真实模型下多页继续、取消、跨会话、权限/TLS 失败或传输丢失场景。
- 此记录不代表已将新插件安装到用户日常 DSH profile、发布或部署。
