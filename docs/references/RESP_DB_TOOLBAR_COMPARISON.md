# RESP 数据库行工具栏：截图逐项核对（2026-10-18）

核对对象为用户截图中 `db0 (760)` 右侧七个图标。名称和顺序直接取 RESP.app 2022.2 的 QML 菜单，未凭图形猜测；当前插件以 `59cb88a` 后的集合界面修改为背景，保持首版严格只读。

## 从左到右的实际功能

| # | RESP 动作 | 当前 DSH Redis 是否有 | 当前入口 / 缺项方案 |
| --- | --- | --- | --- |
| 1 | Open Keys Filter：筛选 Key | 有 | 左侧顶部“筛选 Key”展开 MATCH，提交后扫描；不是全文搜索所有未加载值。 |
| 2 | Reload Keys in Database：重新加载 DB Key | 有 | 左侧“扫描 / 刷新”，重新读取 DB 数量与 Key 目录，保留自动分批、进度和取消。 |
| 3 | Add New Key：新增 Key | 无，属于后续写入阶段 | 当前不放无效加号占位。未来独立定义各类型新增 DTO、校验、确认和写入权限，不能用任意命令入口绕过只读边界。 |
| 4 | Enable / Disable Live Update：开启/关闭 DB Key 列表实时更新 | 无等价 DB 列表开关 | 当前右侧“自动刷新”只刷新选中 Key 的内容。后续若需要列表实时更新，可复用现有目录读取、取消和可见性控制，显式开关、单轮完成后等待下一轮，保留选中身份和滚动；不得把内容刷新冒称目录实时更新。建议作为 P1 独立任务。 |
| 5 | Open Console：打开当前 DB 控制台 | 无 | 首版不提供任意 Redis 命令执行器。若需要只读诊断台，需另行定义允许的命令、参数 DTO、输出预算与取消；写控制台属于后续独立阶段。 |
| 6 | Analyze Used Memory：分析此 DB / 命名空间的内存 | 无等价逐 Key / DB 分析 | 状态栏已有服务器概览，但它是服务器总体内存。后续 P1 可做单独有界只读快照：显式启动、分批采样、取消、已分析数与覆盖范围，汇总时明确采样/部分，不能把已加载 Key 的合计宣称完整 DB 内存。 |
| 7 | Bulk Operations：批量操作子菜单 | 无，主要属于后续写入阶段 | 原版包含清空 DB、按筛选删除、批量 TTL、复制 Key 到其他 DB、RDB 导入及返回。当前不接这些入口；未来需逐项独立设计范围预览、确认、权限和结果，不给出能点击但不工作的按钮。 |

这次用户要求核对这些操作，**未要求本轮新增控制台、内存分析、DB 定时扫描或写入功能**。本轮实现范围为四种集合的选行预览，以上缺项保留为明确的后续方案。

## 与集合界面的关系

- RESP 对 List / Set 使用 SingleItemEditor，ZSet 使用 SortedSetItemEditor；选中表格行后，在同一分栏区域加载成员/分数。
- RESP StreamItemEditor 是 ID 加值编辑器，值按 JSON object 呈现。本项目已经按原始字段对提供 DTO；为了保留重复字段名、二进制与出现顺序，继续显示字段对表格及字段/值预览，不把字段对压成会覆盖同名键的对象。
- 本轮 List / Set / ZSet 固定表格/详情两区；Stream 消息表、字段表和双预览同屏。对应格式、复制、查找保持就近，选行不调用 Host，不再经过“返回表格”。
- 本轮不复制 RESP 的图标、代码或写入控制；沿用用户已选 Phosphor 青紫橘和现有字节格式器。

## 固定源码依据

- 仓库：`redis/RedisDesktopManager`，标签 `2022.2`，SHA `7f5408a328dc9c6dac141b6678b31d7cbdf9ca49`。
- [database.qml](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/connections-tree/menu/database.qml)：50–64 为回调；74–103 为七个菜单项；118–138 为批量子菜单。
- [editor.js](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/editors/editor.js) 定义类型到编辑器映射。
- [StreamItemEditor.qml](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/editors/StreamItemEditor.qml) 定义 ID 及 JSON object 值编辑器。
- 当前 `KeyBrowser.tsx` 明确接入筛选、刷新和取消；`AutoRefresh.tsx` 接入选中 Key 的 reader；`ConnectionForm.tsx` 状态栏接入概览、慢日志和客户端快照，均不能当作缺项的等价实现。

QML 菜单动作只证明触发的 UI / Operations 接口；本文没有把未追踪到协议层的上游操作方法名推断为实际 Redis 命令清单。
