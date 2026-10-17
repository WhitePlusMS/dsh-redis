# DSH Database Redis 操作核对与本轮取舍（2026-10-18）

核查对象是最早参考的 [zhuoxiaoshuai/dsh-database](https://github.com/zhuoxiaoshuai/dsh-database)，固定快照 `5d2b900b0317200b1866275c7cf48814fe84b52d`。本地只读副本位于 `.scratch/upstream/dsh-database`。没有安装、运行或改动这个上游项目。

## 截图和真实接线

上游 [Redis 截图](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/docs/screenshots/redis-keys.png) 展示连接 → DB → Key 导航，以及一个 **String/JSON** 值；它没有展示 Hash 的选行和双预览。主模型直接查看截图，并完整核对下列具体组件，不能据这张图声称 Hash 已有 RESP 操作。

| 部件 | 源码事实 |
|---|---|
| Key 树和内容分栏 | [`overview.tsx:327–381`](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/src/client/redis/overview.tsx#L327-L381) 将 Key 树与详情分别传给 `SearchTreeSplit`，点 Key 会更新选中、读取内容并关闭窄屏树抽屉。 |
| Hash 列 | [`key-model.ts:31–40`](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/src/client/redis/key-model.ts#L31-L40) 定义 Key / Value / TTL；Hash map 转行时填的 TTL 是 `-1`，不能据此认定每个真实字段 TTL 都读到了。 |
| 关键词搜索 | [`key-table.tsx`](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/src/client/redis/key-table.tsx) 在当前 `rows` 上搜索；列头按钮做本地排序。它不是服务器端全文搜索。 |
| 点行 | 同组件的行 `onClick` 调用 `startEdit`，在行内放入编辑输入框。组件声明了可选 `onCell`，但 overview 的 Hash 接线没有传入该回调。 |
| 查看行 | 行尾 Eye 按钮把全部列拼成一段文本放到表格下方。该行为没有独立的字段和值字节格式预览。 |
| 格式工具栏 | [`key-string.tsx`](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/src/client/redis/key-string.tsx) 的 Text/JSON/Hex/Binary 栏属于 String；上游 Hash 表没有接这组格式按钮。 |
| Key 工具栏 | [`key-toolbar.tsx`](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/src/client/redis/key-toolbar.tsx) 将类型、Key 名、TTL、刷新和复制放在所查看内容附近，同时提供改名、设置 TTL、删除等写操作。 |
| 新增/修改/删除 | [`overview.tsx:282–318`](https://github.com/zhuoxiaoshuai/dsh-database/blob/5d2b900b0317200b1866275c7cf48814fe84b52d/src/client/redis/overview.tsx#L282-L318) 把 Hash 编辑接到 HSET、删除接到 HDEL；该插件有读写能力。 |

## 本项目的具体决定

1. 沿用“工具与当前内容放在一起”的组织方式：刷新、搜索、格式、复制各有明确作用域；收起服务端 MATCH 高级输入，正常浏览界面不堆出许多说明。
2. 本地 Hash 搜索覆盖已经读到的字段和值字节；搜索时暂停触底续读，避免用户在“搜索已加载内容”时意外启动更多 Redis 请求。清空本地搜索后恢复原表格。
3. 服务端 MATCH 用草稿与提交值分开管理。此前 Hash 输入 `onChange` 会 clear 已加载数据，现改为显式应用后读取；筛选动作不再与打字混在一起。
4. Hash 选行、固定字段/值两个预览采用用户明确提供的 RESP 2022.2 效果。序号只用于显示，实际选中与更新仍以原始字段 Base64 识别。
5. 字段和值分别控制显示格式；共用原来的 `BytePreview`，六种格式保留，统一下拉减少窄栏工具栏堆叠。复制作用于所在预览的当前格式。
6. 当前范围继续只读，不将上游点行编辑、新建、HSET/HDEL 或假定字段 TTL 复制进来。TTL 显示的是现有后端 DTO 返回的 Key TTL。
7. 全局仍采用用户确认的左 DB/Key、右数据两栏，保留自动加载和触底追加；不搬回上游“加载更多/加载全部”按钮。

## 当前实现问题与修正映射

| 原行为 | 本轮实现 |
|---|---|
| 点字段/值分别进入详情页，隐藏表格 | 选中整行，表格、字段、值同时可见 |
| 需要记住刚才点的是字段还是值 | 两个区域标题直接标明字段和值 |
| 表格后方大预览会挤占页面，或隐藏表格暂停浏览 | 正常 Grid 分区与局部滚动；表格可见期间保持触底续读 |
| Hash 输入筛选字符就清空数据 | 草稿不改变当前结果，提交 MATCH 才读取 |
| 两个列名、多个按钮和长帮助争抢空间 | 紧凑工具栏、单个格式下拉、就地状态；必要错误保留 |
| HLEN 与匹配加载数混成一个比例 | “已加载字段”和“全部字段”分开显示，不伪造匹配百分比 |

用户提供截图中的字段和值仅用于理解交互，本轮文档与测试使用合成数据；不把真实业务 Key/值或启动凭据提交到 Git。
