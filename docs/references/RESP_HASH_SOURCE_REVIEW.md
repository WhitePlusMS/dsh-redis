# RESP.app 2022.2 Hash 交互研究与本项目实现映射

核查日期：2026-10-17。用户截图标明 RESP.app 2022.2，研究固定在该版本源码；本文区分源码事实与本项目拟实施方案。本轮只交付文档和交互样例。

## 版本与证据

- 官方项目现位于 [redis/RedisDesktopManager](https://github.com/redis/RedisDesktopManager)，旧的 `uglide` 地址会重定向。
- [2022.2 tag](https://github.com/redis/RedisDesktopManager/releases/tag/2022.2) 对应源码提交：`7f5408a328dc9c6dac141b6678b31d7cbdf9ca49`。下文链接均固定到该提交。
- 核查时仓库 HEAD 为 `15f6d85528cdb957f09ace0ee5cdf8df0640954c`，不将当前 HEAD 或当前 Redis Insight 的说明混作截图版本行为。
- 主模型直接查看用户截图：上方表格，下方“键名”和“键值”两个预览区。截图是布局参考；源码用于核对这些区域的结构及联动。
- 本地只读源码快照：`.scratch/upstream/resp-app-2022.2`，未编译或安装 RESP，也未拷贝其 QML/C++ 实现到本插件。
- 该固定快照根目录 `LICENSE` 为 GPL v3；此处研究布局与交互结构，后续按本项目 React 模块自行实现。图标候选另有各自 MIT 许可。

## 源码实际怎样实现 Hash

| 行为 | 源码及观察 |
|---|---|
| 表格显示行号、字段、值 | [`hashkey.cpp:11–23`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/app/models/key-models/hashkey.cpp#L11-L23) 返回 `rowNumber / key / value` 及对应 role。这里的 key 是 Hash 字段，外层 Redis Key 单独显示。 |
| 表格和预览上下分区 | [`ValueTabs.qml:325–348`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/ValueTabs.qml#L325-L348) 使用竖直 `BetterSplitView`，分别安放 `ValueTable` 和 editor wrapper。源码设置表格最小 300px、编辑器最小 220px。 |
| 下方同时有字段和数值区 | [`HashItemEditor.qml:16–44`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/editors/HashItemEditor.qml#L16-L44) 创建两个 `MultilineEditor`；字段区默认首选高度 140px，值区填充剩余空间，各自带格式器。 |
| 选中行后同步加载两个内容 | [`ValueTabs.qml:425–438`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/ValueTabs.qml#L425-L438) 取模型 `getRow(row)`，重置编辑器后 `setValue(rowValue)`；[`HashItemEditor.qml:66–74`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/editors/HashItemEditor.qml#L66-L74) 分别调用字段与值的 `loadFormattedValue`。 |
| 行选择与代理模型关联 | [`ValueTable.qml:428–443`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/ValueTable.qml#L428-L443) 在选中行变化时映射模型行并触发加载，不依靠表格上省略的显示字符串还原数据。 |
| 有页码分页 | [`ValueTable.qml:385–425`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/ValueTable.qml#L385-L425)、[`Pagination.qml`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/Pagination.qml) 提供页码、前后页。默认 page size 来自 [`valueviewmodel.cpp:313–317`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/modules/value-editor/valueviewmodel.cpp#L313-L317)，为 100。 |
| 搜索有明确模型作用域 | [`ValueTabs.qml:72–94`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/qml/value-editor/ValueTabs.qml#L72-L94) 的代理模型使用通配符、忽略大小写、匹配各列。不能仅据截图把它推断为服务器端全文搜索。 |
| 原版带编辑能力 | [`hashkey.cpp:40–123`](https://github.com/redis/RedisDesktopManager/blob/7f5408a328dc9c6dac141b6678b31d7cbdf9ca49/src/app/models/key-models/hashkey.cpp#L40-L123) 存在 HSET/HSETNX/HDEL；界面也带新增/删除/保存。这些不属于本项目当前只读范围。 |

结论：用户喜欢的效果来自**表格与两个预览区同时存在、固定分配空间、选行联动**。这可以在现有 React 数据层上实现，无需搬入 RESP 的 Qt 工程。截图中的具体像素尺寸不直接套用到 DSH 窄侧栏。

## 与当前插件的差异

当前 `HashView.tsx` 点击字段或值会进入 `DetailPage`，通过父级 `data-cell-open` 样式隐藏表格；`CollectionTable` 暂停触底续读并记录滚动，返回后恢复。这是上一轮“不要底部弹窗”的实现。

本次用户进一步明确希望比较 RESP 风格，因此新的样例 A 将“上下分区”做成**正常布局中的固定区域**：表格始终可见，预览有自己的高度和滚动条。它不会在表格末尾追加大块内容，也不会盖住上方表格。

| 项目 | 当前实现 | 候选 A |
|---|---|---|
| 选中内容 | 字段/值之一，进入独立详情页 | 选中整行，同时更新字段和值 |
| 表格 | 详情打开后隐藏 | 始终可见，保持局部滚动 |
| 预览 | 同一右侧区域里的详情页 | 下方字段区 + 值区，各自滚动 |
| 格式选择 | Hash 详情共用浏览格式 | 字段和值分别选择格式 |
| 续读 | 详情打开时 paused | 表格可见时继续按触底规则续读；用户未滚到末尾不额外扫全量 |
| 返回 | 显式返回表格 | 常规选行无需返回；大内容可另开现有专注详情 |
| 全局导航 | 左 DB/Key，右数据 | 保留 |
| 写入 | 严格只读 | 严格只读 |

## 三个可选布局

1. **A：表格在上，字段和值在下方上下排列。** 最贴近用户截图。字段区较矮、值区更高，三个区域分别滚动；推荐从此方案实施。
2. **B：表格在上，下方字段和值左右并排。** 适合较宽面板；窄侧栏样例会自动退为上下排列。
3. **C：右侧数据区内再分两栏，左侧字段表、右侧字段和值。** 适合连续对照较多字段；窄侧栏优先展示正在操作的区域，避免挤出几列不可读内容。

三者共用同一个外层 DB/Key 导航。交互样例中图标、配色和 Hash 布局可以独立选择。

## 选定后如何实施

### 1. 复用数据身份与读取

继续使用 `useCollectionScan`、当前 Host DTO、取消/所有权约束和分页缓存。选中状态存 `field.base64`，从已读行列表查找完整字段与值；行号只用于显示，不能作为字段身份。重复扫描返回时沿用现有完整字节去重方式。

点击行只改变本地选择，不能为此重新 HSCAN、把省略字符串当原始字段或触发任何写命令。刷新或切换 DB/Key 时按现有所有权清理选择；选中字段不存在时显示空预览，不悄悄选中另一个同位置字段。

### 2. 用区域布局解决遮挡

在 `HashView.tsx` 的可用内容高度内使用普通 CSS Grid/Flex 分区，所有可缩区域明确 `min-height: 0` / `min-width: 0`。表格 viewport、字段预览、值预览分别负责自己的 `overflow: auto`。

不使用 absolute/fixed 底部详情、不将预览追加在自增高表格之后、不把 RESP 的 300px+220px 最小值硬套到 DSH。短窗口优先收紧表格和字段区；保留有用预览高度，再允许最外层有限滚动。原型的比例只用于审阅，正式值按选定方案验收。

### 3. 表格与预览联动

- 表格列为 `# / 字段 / 值`，长内容单行省略；点击任一单元格选择整行。
- 在表格内部使用上下键移动选择；焦点留在表格，预览更新不抢焦点、不滚动祖先。切换格式也不移动表格。
- 两个预览复用 `BytePreview`，分别持有字段格式和值格式；字段为完整字节，值继续使用现有范围/前缀覆盖数据。
- 文本、JSON、Hex、Base64 和复制沿用真实字节语义；非法 JSON 显示格式错误，不改写原始内容。复制遵循选定格式，并明确复制字段还是值。
- 字节数、完整/部分状态直接位于预览标题；Base64 身份不再常驻独立大文本框，可通过现有格式选择查看。

### 4. 自动加载与搜索

保留用户已经确认的 Key 自动分批加载、右侧触底续读。RESP 自带的手动页码不作为本轮回退理由。

服务器 MATCH 与本地搜索职责明确：现有 MATCH 表单继续提交读取条件；本地搜索若保留，标签写“搜索已加载字段/内容”，不宣传全库全文检索。HLEN 是整张 Hash 字段数；有 MATCH 时用“匹配已加载 N / 全部字段 M”两个独立含义，不能把 N/M 当匹配完成百分比。

### 5. 先 Hash，再按需要复用

先只实现选定的 Hash 布局，检查是否适合真实 DSH 宽度和大值。List/Set/ZSet/Stream 保持原行为，除非用户确认也采用同类联动。共用部分只抽预览面板和必要布局，不引入全新路由或状态框架。

图标和帮助清理分别提交，便于回看。变更前完整阅读相关实现，严格类型检查优先；无需增加依赖即可内联少量有许可记录的 SVG。

## 正式实施时的验收点（本轮未执行）

- 同一行字段与值正确同步，二进制字段身份和特殊字节不丢失；过滤/刷新不能选错行。
- 大 Hash 触底续读仍然只有一条请求链；选行/切格式不重新扫描，不重置局部滚动。
- 表格、字段、值都能独立滚动，预览没有遮盖表格；460px 附近侧栏、宽面板、短窗口及明暗主题可用。
- 字段和值各自格式状态、非法 JSON、二进制、空字符串、超长值、实际截断状态正确。
- 键盘选择、焦点、复制/查找名称可用；已移除的帮助不影响操作名称或必要错误。
- 继续严格只读；真实数据核查与合成测试分开记录。测试服务由本轮启动者在结束时停止。

## 图标素材与许可

| 样例 | 来源与固定提交 | 本地素材 | 处理 |
|---|---|---|---|
| 1 实心 | [Tabler](https://github.com/tabler/tabler-icons/tree/a4ce1404bc6d24d3c365afe7b258d6bf6f48d62d)，MIT | `icons/filled/{database,folder,key}.svg` | 24×24，原路径，按语义着色 |
| 2 双色 | [Phosphor core](https://github.com/phosphor-icons/core/tree/2b75f3ad12b420c9504ef05df8d2564a28f8500e)，MIT | `assets/duotone/{database,folder,key}-duotone.svg` | 256×256 缩放，原路径；浅层不透明度在样例中增强 |
| 3 自绘双色 | 本项目样例原创 | HTML 内自绘 24×24 SVG | DB 圆柱、目录口袋、Key 圆环钥匙，强化小尺寸识别 |
| 4 描边 | 同一 Tabler 固定提交，MIT | `icons/outline/{database,folder,key}.svg` | 24×24，原路径/描边属性，使用高饱和颜色 |

另核查了 [IconPark](https://github.com/bytedance/IconPark/tree/8dc132da4c85671ba6a5962c87aa2bdafbf158e9)（Apache-2.0）。该快照的 `source/Datas/database.svg` 不存在；可用相近文件是 `database-code.svg`。所查 `Office/folder.svg` 形状更接近文件袋，本轮不作为树目录首选，也未嵌入样例。

HTML 内嵌 Tabler、Phosphor 的完整 MIT 声明及源 SHA，旁边也保存可读许可文件。SVG 着色和尺寸调整不需要安装其运行包。本轮图标不取用 RESP 的红 DB/黄目录/黄 Key 素材。未来正式采用时把对应声明随实际分发包保留。
