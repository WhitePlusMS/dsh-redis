# 20 窄宽侧栏、明暗主题与共享查看容器

2026-10-16，用户选择A：窄栏列表/详情往返，宽栏左右分栏。实际验收为DSH `0.2.0-rc.2`原生Web侧栏、Node22.22.1、pnpm11.22.0；最终包SHA-256 `c5a26feca07ed474a51b96edc8e112e13d0e8f88a8cc6a1a22197e06a41f427d`，隔离profile安装lib70完整集合及字节与构建一致。

## 使用行为

1. 手动连接后，“连接配置”自动收起，仍可用原生details展开；断开后展开配置。DB、MATCH和扫描仍由用户主动提交。
2. 插件实际宽度小于640px时，选择Key进入详情；“返回Key列表”保留列表滚动、选中身份和键盘焦点。两个面板不卸载，返回再打开同一个Key保留已读值/窗口，不自动重读。需要最新数据时点“读取/刷新”。
3. 实际宽度达到640px时同时显示列表与详情，调整宿主侧栏宽度自动切换；布局由容器宽度决定，不按整个浏览器窗口猜测。没有另加持久化布局开关或各类型重复的布局状态。
4. 长Key标题单行省略，完整字节身份仍在只读Base64文本框；截短标题不改变Key或请求参数。长值在自己的预览区滚动，表格按需横滚，焦点在表格时可用右方向键滚动。
5. TimeSeries/Stream双边界等宽；插件不超过420px时，边界输入和元信息上下排列，避免长时间戳挤成竖排。表头和原始数字保持单行，GEO成员列有最小宽度，超出宽度由表格内部承担。
6. 明暗表面、文字、边线沿用DSH主题token；错误色按真实body主题属性切换，交互控件有可见键盘焦点。根面板不滚动DSH正文，列表、详情、预览、表格和配置分别在插件内滚动。

导航位置和已读缓存仅在当前挂载面板内保留；会话切换/重启仍按18的边界恢复选择，不新增值、游标或秘密持久化。新的Key/搜索/扫描/DB继续清理对应旧结果，Host归属、代次、预算、只读命令和取消协议不变。

## 实现范围

- `KeyBrowser.tsx`统一左右容器、窄栏导航和滚动/焦点；所有基础/扩展类型仍走既有KeyDetails路由。同Key重新打开不重置已提交String窗口。
- `ConnectionForm.tsx`只调整共享配置的原生details和布局标记；连接逻辑、密码清空和手动恢复保持。
- `styles.ts`统一flex/grid高度链、容器查询、局部滚动、防滚动链、长标题、元信息、共享表格和主题焦点规则。
- `CollectionTable.tsx`将既有列id作为DOM标记，复用数字列样式；没有复制表格或增加新表格状态。TimeSeries/Stream只增加双边界样式，TimeSeries增加数字值样式作用域，中英locale补导航/配置/空详情。
- `smoke-dsh.mjs`增加独立LAYOUT模式与12类最小样本；`smoke-sidebar-layout.mjs`操作真实右栏拖拽手柄及Settings/General主题按钮。通用scanAll按新窄栏交互先返回列表，未跳过原功能检查。

## 实际证据

[最终原生报告](20-native-layout-smoke.json)22组全部通过；严格Host/Client/tests类型、构建和完整225回归通过，prepack完整执行。

| 项目 | 实际结果 |
| --- | --- |
| 宿主尺寸 | 1920×960视口；操作原生`data-side=rightbar`手柄，实际panel宽度340、900、300、900px。插件内宽分别少1px边线。未采用CSS宽度注入或原型代替。 |
| 列表往返 | 实际键盘Enter打开/返回；最终轮scrollTop前后135一致，选中Key和焦点恢复，再打开同Key读取次数不增加。早期同流程也记录过2270/485/7590等位置，但最终包证据按其自身135记录。 |
| 12种查看 | String、Hash、List、Set、ZSet、Stream、RedisJSON、Bitmap、GEO、HLL、TimeSeries、Bloom全部在340px真实数据流程进入同一容器；手动解释类经过其真实入口。 |
| 长数据 | 2060字节Key的完整Base64与夹具一致，标题高度不超过24px；131073字节String仅读取既定窗口，预览可局部横滚。工具栏位于插件宽度内。 |
| 表格与数字 | 各已显示表头均一行；GEO经纬度/分数不拆字，成员列至少120px。表格聚焦后真实ArrowRight可横滚；宽栏列表/详情几何边界并排。300px两个元信息时间戳文本Range均只有一行。 |
| 主题 | 通过DSH设置点击Dark/Light，无额外读取。实际背景从rgb(255,255,255)变为rgb(21,21,23)，主文字从rgb(15,17,21)变为rgb(249,250,251)；错误色分别rgb(180,35,24)/rgb(255,180,171)。 |
| 状态 | 实际空MATCH与空详情、TimeSeries本地范围校验错误，均未产生面板横溢或DSH document滚动；加载样式以明确的HTTP回复延迟注入检查，释放后真实值恢复。 |
| 只读/退出 | 12份源DUMP和绝对PEXPIRETIME前后不变；浏览器page/console/request errors均空。DSH进程退出，Host连接回管理员基线，独占Redis/证书/UUID目录清理true。 |

[宽栏明亮/GEO](20-native-layout-wide-light.png)、[窄栏深色/双边界](20-native-layout-narrow-dark.png)、[窄栏深色/数据区](20-native-layout-narrow-dark-data.png)、[长Key加载态](20-native-layout-loading.png)均已查看。表格允许横滚，所以截图当前窗口不同时显示全部列；完整数字未截短，仍可滚动查看。

## 预览与修正追溯

原型按`prototype`技能保存在本地独立分支`prototype/sidebar-layout`提交`2475afcb4dc642cdb7ddf88e5a59c9206f457be3`，路径`.scratch/redis-viewer/prototypes/sidebar-layout.prototype.html`；可直接打开的副本在ignored artifacts。同一文件A/B/C切换、宽度/主题/状态为离线示例，无Redis调用。用户明确选A后按此实现，原型未合入main；生产代码单独编译和原生验收。

最初2c976b69包的22组边界检查通过，但新增数据区截图暴露元信息auto列挤压长时间戳、成员列太窄；[原报告](20-native-layout-before-metadata-fix-smoke.json)保留。修正为窄栏堆叠/成员最小宽度后，d0f827f5包新增时间戳检查通过，截图仍见rank表头被通用断词规则逐字换行；[该报告](20-native-layout-before-header-fix-smoke.json)保留。最终统一表头规则并增加全部表头/键盘横滚检查，生成本页c5a26fec包完成验收。旧报告的passed只对应其当时检查范围，不能代替最终可读性修正的验证；没有伪造旧截图归档。

加载态是先取得真实Host回复后在HTTP层扣留，仅证明布局及释放恢复；实际Redis取消/硬截止另见19。当前样本来自独占官方Redis8.2.6固定镜像文件、wsl-image后端、plain TCP，不是业务库或Docker恢复证明。未启停用户服务、修改日常profile或清理C盘；早期18/16清理拒绝保留目录的事实不变。

本票不宣称全部P0发布门禁或全部29票完成。21继续统一当前包、全部接收边界、共享运行依赖、会话/退出及完整门禁；八张P1后续按原图推进。
