# 20: 在窄宽侧栏和两种主题下完成查看

**What to build:** 按用户最新反馈采用DSH Database/RESP工作台：左侧连接/DB导航与Key列表，右侧数据详情；说明按需展开、工具栏紧凑，明暗和受限宽度仍可操作、滚动留在插件内。窄栏不再默认替换隐藏整份列表。

**Blocked by:** 07 分页查看 Hash 字段和值

**Status:** in-progress

**Priority:** P0

- [ ] 返回保留定位，长 Key/值不会挤坏工具栏或滚动 DSH 正文。
- [ ] 共享查看容器适配各种查看器，不为每种类型复制布局状态。
- [ ] 真实侧栏尺寸、主题、加载/错误/空态及键盘基本操作有交互证据。
- [ ] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## 当前查看证据

2026-10-16：16原生样本表截图已查看，数值精确，但沿用地址/端口布局的双时间输入宽度不均（右侧过窄）；本票统一处理，同步验证GEO数字列换行与窄宽侧栏/主题，16不冒称布局验收。截图docs/verification/16-native-timeseries-data.png。

2026-10-16：19真实取消/恢复验收完成后开始本票。已核对固定rc.2原生侧栏的最小/最大宽度、fullscreen/push标记和明暗主题属性，以及现有共享列表/表格/预览滚动和双输入列宽；先做可审阅的布局方案与交互预览，4项仍未勾选。

原型上下文：本地prototype/sidebar-layout分支2475afcb4dc642cdb7ddf88e5a59c9206f457be3，.scratch/redis-viewer/prototypes/sidebar-layout.prototype.html；可打开的独立副本为.scratch/artifacts/sidebar-layout.prototype.html。A窄栏往返/宽栏分栏，B页签/上下窗格，C覆盖详情；用户偏好询问为可选，默认按A继续，未声称已经得到确认。原型只离线样例，实际共享容器和原生DSH验收仍需独立完成。

2026-10-16完成：用户明确选择A；最终包c5a26feca07ed474a51b96edc8e112e13d0e8f88a8cc6a1a22197e06a41f427d三层严格类型/构建/225回归通过，lib70文件集合与字节一致，真实原生22组通过。实际拖拽340/900/300px、原生Dark/Light、全部12查看器、返回位置/焦点/无重读、长Key/值、加载/错误/空态、键盘横滚和局部滚动均验证；12源数据/绝对过期不变，所有本票资源清理true。两次可读性遗漏经人工截图发现、统一规则修正并补检查，原报告保留；详见docs/verification/20-sidebar-layout-themes.md。原型独立分支不合main；21发布和8张P1未完成，按约定本地提交20，无push。

2026-10-16用户最新反馈重开：当前界面文字堆叠不符合预期，要求参考Database/RESP左右分栏，覆盖旧A窄栏往返偏好。独立交互原型prototype/database-redis-workbench / 955b860，副本.scratch/artifacts/redis-workbench.prototype.html，A连接/DB→Key→详情、B合并树→详情；可选偏好无回复时按更贴近Database的A实施，不称用户已确认。旧包报告保持原范围，新UI需独立验收；长说明进入帮助，错误/只读/当前范围保持可见。
