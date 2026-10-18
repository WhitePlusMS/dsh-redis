# 四种集合选行同屏操作验收（2026-10-18）

## 已交付的操作

List、Set、ZSet 与现有 Hash 使用相同原则：点击任意一行立即在固定区域显示内容，表格保留在原处，继续滚动就追加下一批。没有“打开详情页 → 返回表格”的过程。Stream 同时保留消息表、字段对表、字段预览和值预览；选择消息立即显示第一对字段，选择另一字段对同时切换两个预览。

沿用 Phosphor 青/紫/橘导航图标、只读 DTO、现有读取预算和格式器。不增加 Redis 写命令、任意命令控制台或无效工具栏占位。

## 修改的文件、原因与影响

| 文件 | 修改原因与实际影响 |
| --- | --- |
| `src/client/ListView.tsx` | 取消独立详情页，按原始索引选行，固定表格和值预览；相同内容位于不同索引时仍可分别选择。范围校验失败保留当前内容；有效提交清除旧选择。 |
| `src/client/SetView.tsx` | 原始成员 Base64 为行身份，空成员也可选择；固定表格和成员预览。MATCH 分离输入草稿和已提交条件，打字不清空或读取，提交才换查询。 |
| `src/client/ZSetView.tsx` | 固定表格和成员预览，保持排名、原始分数字符串、排名区间/ZSCAN/GEO 入口；选分数单元格同样选择整行。模式、范围和已提交 MATCH 分别驱动读取，不混用游标。 |
| `src/client/StreamView.tsx` | 消息、字段对、字段和值四区同屏，删除两级跳页。按消息 ID 与字段出现序号选择，保留同名字段的不同值及原始顺序。范围/批量大小按需展开，方向/刷新/取消就近显示。 |
| `src/client/CollectionTable.tsx` | 复用整行鼠标/键盘选择和触底观察；删除已无调用的 paused、隐藏表格及返回滚动恢复分支，选中时继续加载。 |
| `src/client/DetailPage.tsx` | 全项目已无调用后删除；不保留旧交互兼容层。 |
| `src/client/styles.ts` | 与 Hash 共享固定预览样式；三类型使用表格/预览两区，Stream 四区各自滚动。数据页隐藏重复 TYPE/TTL，元信息页照常显示。删除旧详情页样式，保留 GEO 仍使用的 inline 样式。 |
| `src/client/KeyBrowser.tsx` | 聚焦详情时优先进入 Stream 值预览，复用现有聚焦行为。 |
| `src/client/locales.ts` | 同步中英文选行、空成员、Stream 范围/刷新文案；删除四类型不再调用的十组长帮助与旧返回文案，保留 GEO 等仍在使用的说明。 |
| `README.md`、`docs/HELP_UI_AUDIT.md` | 更新实际操作与帮助审查进度；剩余8处 JSX、10个功能帮助场景，未宣称全量删除。 |
| `docs/references/RESP_DB_TOOLBAR_COMPARISON.md` | 固定 RESP2022.2 源码，逐项核对截图七个图标，写明已有入口和缺项方案。 |
| `scripts/smoke-resp-workbench.mjs` | 为后续当前模式回归补充四集合选行不读取、表格/预览同时可见、续页保留选择的断言。本轮只做语法检查，实际浏览器专项由 CUA 执行。 |
| `docs/COLLECTION_INLINE_PLAN.md`、`UPDATE_LOG.md`、本记录及附件 | 记录顺序、检查结果、包字节、服务清理和实际连接边界。 |

## 安装包与代码检查

验收与日常安装使用同一包，SHA256：

`34e7cb8351c04d25c3911b53736589c6a307bb3348ddb5086515d62e99e5c941`

- 每个实现小目标后立即通过 Host / Client / tests 三层严格 TypeScript 检查。
- 默认 `pnpm pack` 触发现有 prepack：严格类型、构建、32个测试文件 / 318项测试全部通过。原始输出：[pack.log](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/pack.log)。
- List/Set/ZSet 小目标提交 `0a8c1b1`；Stream 与共享清理提交 `53ab6f5`，只在本地提交。
- 日常安装包98个文件与 tarball 逐字节一致；其中88个 lib 文件同时与源码构建输出一致。[文件清单](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/package-manifest.json)。
- 浏览器验收后仅修改文档、验收脚本及报告；插件运行源码和安装包没有再次变化。

## 原生浏览器专项

使用独占 Redis8.2.6、测试 DSH profile 和只读命令记录/延迟代理。所有浏览器动作使用 CUA；没有使用用户6379实例准备数据。合成数据为 List241、Set238、ZSet237、Stream235，另含二进制、空成员、重复内容及131073字节的大值。

| # | 本轮实际通过的行为 |
| --- | --- |
| 1 | Set 选行在当前表格旁显示；输入草稿不读取、不清选择；选中时触底继续到238成员；空成员及 `FF00` 原始身份正确。 |
| 2 | Set 提交空匹配清除旧详情；代理扣住读取后取消，释放迟到结果不恢复行或选择。 |
| 3 | ZSet 点击分数单元格选择整行，空成员分数为原文 `-2`，二进制成员保持原始字节；选中时排名续读至237。 |
| 4 | ZSet 切换 ZSCAN 清选择；MATCH 草稿不读取、不清当前行；提交空匹配清除详情。 |
| 5 | Stream 选择消息立即展示首字段对；相同 `repeat` 名称的两行分别展示 `first` / `second`；字段和值的 `FF00` / `FE00` 及空字段/值可独立查看，选行不读取。 |
| 6 | Stream JSON 保留 `9007199254740993`、`1e400`、`-0` 原始数值词法；大值显示 `65536/131073`，拒绝把部分字节当完整 JSON。切换消息重置字段选择；选中时消息继续到235。 |
| 7 | 正常侧栏实际宽464px，两个表格和两个预览边界不重叠、根区域无横向溢出，字段和值内容仍可见。 |
| 8 | Stream 元信息/数据切换保留当前字段与值，不额外读取。 |
| 9 | Stream 范围草稿保持预览；提交上限 `1000-2` 后得到3消息并清旧选择；逆序从 `1000-2` 开始。 |
| 10 | 464px浅色主题实际截图中，Stream 选中行、字段和值均可见。 |
| 11 | List 鼠标/方向键选行在本地切换，选中时继续至241；原始重复索引、空值、二进制值正确。 |
| 12 | List 464px浅色布局无覆盖；部分大值显示真实覆盖，JSON 原始数值词法保持。 |
| 13 | List 无效范围保留当前选择，有效 EOF 范围清空表格和旧预览。 |

完整结果与实际测得区域边界：[native-report.json](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/native-report.json)。

![Stream 宽栏暗色：消息、字段表及双预览同屏](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/stream-wide-dark.png)

![Stream 464px浅色侧栏](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/stream-narrow-light.png)

另保留 [Stream窄栏暗色](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/stream-narrow-dark.png) 与 [List窄栏浅色](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/list-narrow-light.png)。以上全部为合成数据的实际界面截图。

## 只读与服务清理

- 验收前后7份 Key 的 DUMP 逐字节相同，Stream 消费组状态相同。
- 代理只记录到白名单内的连接/读取命令，没有写命令、KEYS 或协议错误。[读取汇总](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/read-summary.json)。
- 本轮测试 DSH、代理、Redis 均已停止，新建 WSL fixture 按精确路径与所有权检查后清理。[结束报告](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/cleanup.json)。
- 先前中断轮次没有完整结束报告，不作为本轮通过证据，也未批量清理历史受限 fixture。
- 不运行 npm dev/start:dev，不执行网页端 GPT 评审，不推送 Git。

## 日常 DSH 当前状态

个人 web profile 的5份清单先按原字节备份，再安装上述唯一哈希包。只有 `package.json` 和 `pnpm-lock.yaml` 的插件引用发生变化，其他依赖、bundles、cordis 配置未变。安装 exit0，98/88文件核对通过。私有备份、启动认证 URL、安装日志及日常截图只留在忽略目录。

[http://127.0.0.1:7198/](http://127.0.0.1:7198/) 已启动并在浏览器打开，PID11652，保留供用户查看。恢复时原7198没有监听，因此没有终止其他应用进程。

**本机 `127.0.0.1:6379` 当前没有监听服务，实际连接返回无法连接。** 没有填写凭据，没有修改或启动用户 Redis 服务；本轮不声称已恢复真实760个 Key。Redis 服务恢复后，可在已打开的连接配置中手动连接原地址，查看新界面。[日常安装记录](E:/项目demo/dsh-redis/docs/verification/artifacts/collection-inline/daily-install.json)。

## 截图七个工具按钮的结论

从左到右为筛选、刷新、新增 Key、DB Key 列表实时更新、控制台、内存分析、批量操作。目前已有筛选与刷新；右侧已有的是单个 Key 内容自动刷新，与 DB 目录定时扫描不同。其他项分别记录了后续实现方案，本轮没有扩大只读范围或增加按钮占位。

见 [逐项对比及固定源码依据](E:/项目demo/dsh-redis/docs/references/RESP_DB_TOOLBAR_COMPARISON.md)。本轮没有重新执行历史29项完整 RESP 模式、各类型旧独立原生模式或全部自动刷新模式；不将此前结果冒称当前包的本轮验证。
