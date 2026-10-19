# 推广文案

## 中文介绍

DSH Redis 是 [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) 的社区插件，可以在原生右侧栏查看 Redis 数据，并让当前对话读取选中的内容。

手动连接 Redis 后，左侧会分批加载当前 DB 的 Key，支持目录、列表和筛选。右侧可以查看 String、Hash、List、Set、ZSet、Stream。点击集合中的一行，字段或元素的详情会直接显示在同一视图里，也可以切换 Text、JSON、Hex、Base64，进行查找和复制。

需要进一步分析时，可以在同一个 DSH 对话里询问“解释当前选中的字段”或检索指定 Key。插件通过 DSH 原生工具接口读取本会话已连接的 Redis，不需要重新复制整段内容。用户明确要求切换 DB 时，侧栏会跟随更新。

当前版本只读，支持单机直连和 TLS，适合已经在 DSH 中开发、调试，并需要检查 Redis 数据的个人开发者。已验证环境为 Windows + DSH Web `0.2.0-rc.2`。对话读取的结果会进入 DSH 历史，并可能发送给所配置的模型服务。安装和使用步骤见[中文 README](README.zh.md)及[安装指南](docs/INSTALLATION.zh.md)。

## 简短介绍

DSH Redis 把 Redis 查看放进 DSH 侧栏：支持六种基础类型、Key 筛选和同屏选行详情，还能让同一对话按需读取当前选择。当前只读，支持单机 Redis 与 TLS，已在 Windows + DSH Web `0.2.0-rc.2` 验证。

## English introduction

DSH Redis is a community plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness). It puts Redis browsing in the native right sidebar and lets the current conversation read the item selected there.

After a manual connection, the sidebar loads Keys in batches and offers tree/list navigation and filtering. It supports String, Hash, List, Set, ZSet and Stream. Selecting a collection row opens its details in the same view, with Text, JSON, Hex and Base64 previews, find and copy controls.

In that same DSH conversation, ask about the selected field or search for a Key. The plugin's native DSH tools read through the connection already owned by the conversation. An explicitly requested DB change also updates the sidebar.

The current version is read-only, with standalone Redis and TLS support. It is intended for developers who already work in DSH and need to inspect Redis data. The verified environment is Windows with DSH Web `0.2.0-rc.2`. Tool results enter DSH history and may be sent to its configured model provider. See the [English README](README.md) and [installation guide](docs/INSTALLATION.md).
