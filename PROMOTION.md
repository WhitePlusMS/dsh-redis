# DSH Redis 推广介绍

## 中文介绍

[DSH Redis](https://github.com/WhitePlusMS/dsh-redis) 是 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的社区插件。它把 Redis 查看放进 DSH 的侧栏，也提供对话工具，按需读取当前会话连接的数据。

连接单机 Redis 后，我们可以浏览 DB 和 Key，查看 String、Hash、List、Set、ZSet 和 Stream。集合选中一行时，字段或元素的详情会显示在同一视图里；已读取的内容支持切换格式、查找和复制。

在同一个对话中，可以直接请求读取指定 Key 或字段，也可以围绕当前选择提问。工具还支持在明确范围内查找 Key、筛选 Hash，以及读取慢日志等诊断信息。查询结果会记录范围和必要的状态，方便核对；模型如何解释这些信息由模型决定。

需要修改数据时，可以为当前连接开启 AI 写入，替换已有 String 值或 Hash 字段。写入默认关闭，执行遵循 DSH 工具权限设置，并在写入前检查旧值、在执行后返回结果。

插件支持单机 Redis 和 TLS。连接资料不保存密码，但工具参数和结果会进入 DSH 对话记录，并可能发送给该对话配置的模型服务。当前版本适配 DSH Web `0.2.2-rc.1`；安装步骤、功能范围和验证记录见[中文 README](README.zh.md)及[安装指南](docs/INSTALLATION.zh.md)。

## 简短介绍

DSH Redis 是一个 DSH 社区插件：在侧栏查看 Redis 六种基础类型，在对话中读取数据、按范围查找和获取诊断信息，并可按需开启受控的 AI 写入。

## English introduction

[DSH Redis](https://github.com/WhitePlusMS/dsh-redis) is a community plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It adds Redis browsing to the native sidebar and lets the current conversation read data through its own connection.

Connect to a standalone Redis server to browse databases and Keys, inspect String, Hash, List, Set, ZSet and Stream values, and view a selected collection row without leaving the current view. Already-read content can be formatted, searched and copied.

In the same conversation, request a specific Key or field, or ask about the current selection. The tools also support bounded Key searches, Hash filtering and diagnostic information such as slow logs. Tool results carry their scope and relevant status; the model decides how to interpret them.

When a change is needed, enable AI writes for the current connection to replace an existing String value or Hash field. Writes are off by default, follow DSH tool permissions, check the previous value before execution and return the outcome.

The plugin supports standalone Redis with TLS. Saved connection profiles do not contain passwords. Tool arguments and results enter DSH conversation history and may be sent to the configured model provider. The current version targets DSH Web `0.2.2-rc.1`; see the [README](README.md) and [installation guide](docs/INSTALLATION.md) for setup, scope and verification.
