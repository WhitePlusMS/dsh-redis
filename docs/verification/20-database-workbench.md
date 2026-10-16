# 20：Database/RESP 工作台改版验收

日期：2026-10-16。此文档对应用户要求的持续左右分栏界面；旧窄栏列表/详情往返的包与报告仍见 [历史验收](20-sidebar-layout-themes.md)，不用于证明本次界面已通过。

## 交付操作

- 面板宽度超过760px：左侧个人连接与当前实际DB、中间Key检索/列表、右侧数据详情。900px实际侧栏为164px连接区、210px Key区和剩余详情区。
- 宽度不超过760px：连接区压缩为顶部配置入口，Key与详情始终左右显示；不再用整页往返替代列表。480px以下Key区128px，真实300/340px可操作；数据表格按自身滚动查看完整列。
- 连接配置、用户名/密码、TLS和保存/删除操作通过同一个原生dialog按需打开；连接后关闭并清空密码。已连接时不能误改连接参数，刷新/断开在底部工具栏。
- 详情分为数据、元信息页签；原始Key Base64身份和完整元数据在元信息查看。切换显示不会卸载读取器，不触发Redis读取。String及集合单元格共用Text/JSON/Hex/Base64按钮和显式Base64解码选择，可复制已读预览。
- 主界面只保留控件、短扫描/范围状态、数据、读取覆盖范围与必要错误。常规说明、预算和刷新语义放在帮助中。HLL估算、Bloom假阳性、部分数据/缓存超限等不能当作完整结果的含义仍明确显示。
- 12种查看沿用原Host/DTO/只读命令/预算，没有新增任意命令、写操作、自动连接或自动重放。命名空间分组/虚拟列表仍属于22，聚焦查看/内容搜索仍属于23。

## 来源与实现范围

参考DSH Database实际Redis截图与用户提供RESP.app 2022.2界面，采用连接/DB、Key导航、数据详情的操作结构。Database参考副本仍是5d2b900b0317200b1866275c7cf48814fe84b52d；完整对照记录保留在references目录，没有覆盖或修改上游副本。

交互原型独立保存在prototype/database-redis-workbench分支955b860de5d6d57929d38b83aaee68d79dc03f81，未合入主分支；默认采用更接近Database的三块结构，不声称用户已明确确认新的A/B选择。内置浏览器的file://原型打开被URL安全策略拒绝；未绕过。以下验收直接针对真实DSH HTTP应用和安装包，不是该离线原型。

实际修改：ProfileChooser/ConnectionForm共用唯一连接资料/表单状态并呈现导航/dialog；KeyBrowser移除旧Back布局状态，保留两侧挂载并加Data/Metadata；BytePreview沿用无损formatter和会话格式状态；Icon/HelpDetails提供本地图标和按需说明；12类视图收起静态说明；styles统一高度、主题、局部滚动及工具栏尺寸，locales压缩常态文案。所有原始字节、严格结果decode和手动读取边界保留。

固定rc.2公开插件API未提供设置宿主宽度/最大化的方法，本实现只改变插件自身布局，未修改DSH内部store或壳层CSS。

## 本次包与检查

| 项目 | 结果 |
| --- | --- |
| 目标DSH | 0.2.0-rc.2，按用户指定，属于预发布版 |
| 最终包 | dsh-redis@0.1.0 |
| SHA-256 | 509aa7b06132ab0fa3123bafca18f75f43df10ac019c00cfbffdcfc950373e43 |
| 编译/回归 | 三层严格类型、构建、226项通过；完整prepack |
| 真实Redis | 官方8.2.6 Alpine镜像的独占WSL夹具，plain loopback，不连接业务库 |
| 原生布局 | 24组全部通过；22个几何采样均无插件/页面横向溢出 |
| 执行时间UTC | 2026-10-16T10:32:25.810Z — 2026-10-16T10:32:56.309Z |
| 浏览器异常 | pageerror/console error/request failure均为空 |
| 资源 | DSH/Chrome退出、Host socket回基线，Redis/证书/本轮UUID目录清理true |

依赖/79个包文件/70个lib与全部功能复验以21本次新包报告为准；不把本次布局专项当作全部发布门禁。

## 实际交互证据

1. 通过DSH原生右栏手柄拖到340、900、300再900px，没有CSS伪造宿主宽度。宽栏连接导航可见，紧凑栏仍有可见Key和详情。
2. 340px键盘选中native:140保留焦点；列表scrollTop为2904px。切Data/Metadata、格式、打开/关闭帮助、同Key再点击后位置不变，读取计数不增加。
3. 已连接时设置dialog按需打开：密码为空、地址字段锁定，关闭后继续浏览且无新读取。
4. 2060字节长Key完整Base64身份可查看，标题一行省略；131073字节String只预览64KiB窗口，实际大值在局部滚动，不滚动DSH正文。
5. 真实Host回复后的明确HTTP延迟只用于加载布局：取消按钮出现后仍在边界内，释放route后数据显示。此项不替代19的真实Host取消/生产10秒超时验证。
6. String、Hash、List、Set、ZSet、Stream、RedisJSON、Bitmap、GEO、HLL、TimeSeries、Bloom共用同一容器。340px TS边界各96.5px，按可用空间换行；300px中两个16位以上元信息时间戳各只有一行。
7. GEO表头/排名/分数/经纬度不变成竖排，成员列至少120px，ArrowRight可以滚动局部表格；右侧完整列需要横滚时如实保留。
8. 通过Settings/General实际切换Dark/Light；颜色更新不重读。再用正式Language菜单切中文并恢复English：中文三栏、数据/元信息页签、JSON与9007199254740993原始数字保持可见，全程不新增Redis读。加载、验证错误、无匹配Key、空详情均检查。
9. 12种查看夹具前后DUMP及绝对过期时间完全相同。

## 截图与原件

- [中文宽栏真实插件面板](artifacts/20-workbench/native-workbench-panel-wide-zh.png)、[完整中文DSH](artifacts/20-workbench/native-workbench-wide-zh.png)；已人工查看。
- [宽栏真实插件面板](artifacts/20-workbench/native-workbench-panel-wide-light.png)、[窄栏深色数据](artifacts/20-workbench/native-workbench-panel-narrow-dark.png)；均为真实pane直接截图，已人工查看。
- [完整宽栏DSH](artifacts/20-workbench/native-workbench-wide-light.png)、[窄栏元信息](artifacts/20-workbench/native-workbench-narrow-dark.png)、[窄栏数据](artifacts/20-workbench/native-workbench-narrow-dark-data.png)、[加载态](artifacts/20-workbench/native-workbench-loading.png)。
- [最终机器报告](artifacts/20-workbench/native-workbench-smoke.json)、[操作console](artifacts/20-workbench/native-workbench-console.log)、[DSH脱敏日志](artifacts/20-workbench/native-workbench-smoke.log)、[prepack](artifacts/20-workbench/workbench-prepack-console.log)；归档逐项核对源件SHA。

早期记录保留：77ea3a0第一轮脚本在点击格式之后仍要求Key焦点，顺序错误已纠正；下一轮实际加载工具栏越界，已修复共享flex收缩/换行。47057faa轮按旧规则强制TS输入上下排列，实际等宽并排而失败，改为验证可用等宽/边界并记录坐标；随后47057faa的23组通过，但常态文案仍偏长。最终509aa7b0缩短文案后先23组通过，增加正式中文菜单/页签/值验证后同包24组通过；原英文23组报告另存native-workbench-english-23-*。上述报告分别以workbench-first/loading/boundaries/47057faa前缀原样归档；失败没有改写成成功。

## 验证边界

- 主流程为en-US；额外通过DSH原生菜单切中文验证JSON三栏、页签、值和切换不重读并实际截图，随后恢复English。没有因此宣称全部类型的中文交互逐项重跑。
- 未验证其他DSH/Redis/桌面内核版本，不把离线原型、单元回归或旧包记录当作这些环境验收。
- 复制按钮保持只复制已读预览；本专项没有读取用户剪贴板来核对其内容。
- 仅回收本轮创建的测试进程和UUID资源；此前16快照/18两对被自动清理审批拒绝的目录继续保留。没有操作用户业务库、日常profile、已有服务或C盘文件。
