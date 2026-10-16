# 11 Stream 消息 ID 范围与原始字段对验收

验证日期：2026-10-16；用户指定DSH0.2.0-rc.2（RC），Node22.22.1、pnpm11.22.0、精确SDK，独立profile。结果只覆盖本票与所列回归，不代表全部29票或所有平台通过。

## 产物和实际结果

- 包SHA256：`ed5ff2366a464133db3cf9683733cc772956b3990a02efde62eb514643a7561b`。按SHA命名安装，保存证据前再次确认安装lib与当前构建50文件逐字节一致。
- 已有严格Host/Client/tests类型、构建和142项回归通过（Stream17项）；真实Redis7组、原生安装包46组通过，含String/Hash/List/Set/ZSet/TLS/DB回归。本次整理证据未重复构建未变化的代码。
- Redis8.2.6固定官方镜像，显式wsl-image后端：image sha256 ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e；amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e。未当作Docker验收。

## 读取行为与边界

1. 固定TYPE/PTTL/XLEN与XRANGE或XREVRANGE COUNT，初始包含范围两端；续页使用上一ID的左括号排他前缀，不加减ID或转Number。ID两部分各uint64；真实/原生235条双向分页、包含端点的单条页、空Stream与最大ID均通过。
2. 字段按原始有序数组保留，重复名称、空名称及二进制字段和值不丢失；原生七字段对中same=one/two均可独立选择。共用字节预览保留大整数/指数原文、Hex/Base64及显式解码。两张截图已查看。
3. 无消费组写命令或任意命令入口。实际读取前后DUMP、绝对过期时刻、Pending摘要、XINFO GROUPS与last-delivered、相关写入/消费组命令计数不变；最小ACL读取成功，XREADGROUP/XACK仍禁止。
4. 每页最多100消息、4096字段对，完整字段最多64KiB，值前缀最多64KiB；接收全帧与外发JSON各1MiB，缓存5000消息/2MiB。65537字段和低于1MiB RESP但JSON放大的页整页拒绝，socket健康；2MiB值在接收层拒绝，仅关闭自身连接，手动重连可恢复。COUNT不是字节保证，单个巨大消息仍可能不可读。
5. 令牌绑定可信会话、连接/DB代次、原始Key、方向与范围；10秒总截止覆盖元信息和分页，取消/超时/旧代次/迟到结果有回归。输入草稿不自动查询，提交方向/范围废弃旧页；权限、缺失、类型改变有明确状态。
6. 正常追加允许继续，检测到XLEN减少、类型变化或删除则丢弃旧数据；实际双方向回复间变化验证通过。读取非原子快照，等长替换可能不可检测；满页尾部可能需要空页探测，短页后新增内容需显式刷新，不能承诺完整历史一致性。

## 失败记录与清理

首次原生脚本提交范围后读取旧范围完成状态，截图显示新范围首ID已返回且可继续。失败未记通过；脚本改为等待新首ID和已加载1条后再续读，不改产品逻辑、不加固定sleep、不弱化断言。使用同一已安装SHA包重跑46组通过。

报告确认自有Redis、DSH、浏览器停止，证书与UUID配置目录已删除；未操作用户Redis或日常profile。

机器证据：[Redis](11-redis-streams-smoke.json)、[原生](11-native-streams-smoke.json)、[字段截图](11-native-stream-data.png)、[精确ID截图](11-native-stream-ids.png)。官方语义：[XRANGE](https://redis.io/docs/latest/commands/xrange/)、[XREVRANGE](https://redis.io/docs/latest/commands/xrevrange/)、[XLEN](https://redis.io/docs/latest/commands/xlen/)。
