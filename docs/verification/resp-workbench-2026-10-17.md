# RESP 导航与自动加载验收（2026-10-17）

本次跟进用户给出的 RESP.app 样式和操作参考：把连接、DB、目录/Key 合到左侧导航，右侧查看数据；自动加载当前DB的Key，集合表格滚动续读。原29票及其历史证据不重写。

## 当前结果

- DSH / SDK：固定用户已选择的 0.2.0-rc.2，未切换宿主版本。
- 包：dsh-redis 0.1.0，SHA256 `4a9660dfbdedac5608ee0876dbf39f02854ed9bd893e0e5d3c7298ba416c5a87`，146340字节。
- 严格Host/Client/tests类型、构建、32个测试文件/318项通过；最后空白清理后重新类型检查和构建，88个生成文件与已验收安装包逐字节相同。
- 真实Redis 8.2.6 + 原生DSH + 真实Chrome：29项通过；测试DSH、延迟代理、Redis夹具全部停止。
- 当前报告只计入本次已执行检查。旧手动分页原生模式对应历史包，其旧的“不自动扫描/继续按钮”断言不适用于当前交互，不把原29票的87项原生报告计作本包重测。

## 修改文件、原因与影响

| 文件 | 修改 | 原因与影响 |
|---|---|---|
| src/domain.ts、redis-databases.ts、host/database-reader.ts | DB目录/计数DTO、限定解析及固定元数据读取 | 获得真实DB目录与数量，不从已加载Key推算总数；未知与0分开 |
| src/host/redis-transport.ts、typert.shared.ts、typert.host.ts、typert.remote-client.ts、remote-service.ts | 注册严格readDatabases，限定DBSIZE、INFO keyspace、CONFIG GET databases参数 | 沿用可信会话、连接代次、DB和10秒期限；无通用命令或写入入口 |
| src/client/key-loading.ts | 单链自动Key加载与进度模型 | SCAN逐页自动续读；空页不误判完成，按原始字节去重，取消后丢弃迟到回复 |
| src/client/KeyBrowser.tsx、KeyCatalog.tsx、key-namespaces.ts | 统一虚拟树、DB选择、自动加载、筛选与计数；名称排序/单成员目录压缩 | 两栏操作；点击DB后自动加载，目录展开仅本地；保留二进制身份和定位 |
| src/client/ConnectionForm.tsx、ProfileChooser.tsx、index.ts | 移除独立连接列，设置仍在原弹窗，注入目录RPC | 避免三栏挤占；保存资料、TLS、密码清空与会话隔离沿用原逻辑 |
| src/client/CollectionTable.tsx、use-collection-scan.ts | 表内底部观察器、同步请求锁、追加页上限 | 一个底部事件只发一页，避免同游标重复；取消、失败或预算到达停止 |
| src/client/HashView.tsx、SetView.tsx、ZSetView.tsx、StreamView.tsx、TimeSeriesView.tsx | 移除继续按钮并接入滚动续读 | 仅可见表格需要后页时读取，曲线不自动拉取历史 |
| src/client/ListView.tsx、GeoView.tsx、row-cache.ts | 原范围改为有界追加；保留原索引/成员身份 | 滚动接着浏览；范围数据仍为动态读取，不宣称事务快照 |
| src/client/collection-value.ts、styles.ts、locales.ts | 清理显示引号/二次转义、字段列固定宽度、单行预览和中英文提示 | 不把字段名挤成多行；宽表内横滚，点击查看完整已读值及字节覆盖 |
| tests/key-loading.test.ts、databases.test.ts、row-cache.test.ts、key-namespaces.test.ts、redis-transport.test.ts等 | 自动加载、严格DTO、字节/行预算、目录显示与命令形态专项 | 760条、空页/重复、取消迟到、权限、精度、超时、大库与排序可复查 |
| scripts/smoke-resp-workbench.mjs、smoke-dsh.mjs、smoke-release-boundary.mjs | 当前RESP原生模式、隔离种子/延迟与28个RPC清单 | 只对自建夹具写入/故障注入，日常业务Redis只读；大Buffer比对失败不生成巨量差异 |
| README.md、UPDATE_LOG.md、docs/RESP_WORKBENCH_PLAN.md | 同步操作、预算、证据与安装路径 | 同版本更新使用唯一SHA文件名，避免复用旧同名包 |

## 操作与实现

1. 已连接会话打开可见面板，先获取DB快照，再顺序执行SCAN；上一批完成后才发下一批。COUNT只是Redis工作量提示，不能当精确页长，只有游标结束才完成。
2. 左侧DB行显示数量；底部显示DB总数、已读数量、进度和停止原因。全部匹配且总数已知才计算百分比，完成时已读等于快照总数才显示100%；MATCH筛选不把DB总数冒充匹配总数。
3. 点击DB执行现有SELECT并换浏览所有权；旧请求取消，新DB自动从头扫描。会话切换不新建连接；恢复的Key值仍由用户点击读取。
4. 文件夹展开、树/列表切换、分隔符与定位只操作已加载数据。目录数是已加载组内Key数。目录优先、大小写敏感名称排序；只有一个Key的前缀直接显示完整剩余Key。
5. 右侧Hash、Set、List、ZSet、Stream、TimeSeries表格与GEO使用表内底部观察器；忙时同步锁阻止重发，下一游标或范围仍由原读取器验证。空中间页继续，取消/错误后不自动重试。
6. 字段和值使用单行预览，内容不从显示文本还原身份。点击单元格沿用Text/JSON/Hex/Base64、查找和字节覆盖；完整原始身份在元信息或选中项详情。

DBSIZE、INFO keyspace和CONFIG GET databases均为固定读取。CONFIG仅允许GET和字面量databases；没有SET、通配读取或额外参数。ACL拒绝或命令不可用将对应元数据标为未知，仍可SCAN；协议错误、超限和连接故障保留明确错误。

官方依据：[DBSIZE](https://redis.io/docs/latest/commands/dbsize/)、[INFO](https://redis.io/docs/latest/commands/info/)、[CONFIG GET](https://redis.io/docs/latest/commands/config-get/)、[SCAN](https://redis.io/docs/latest/commands/scan/)。

## 已执行验证

- 模型/Host：Key 760多批串行、空页/原始字节去重、预取消/迟到、5000条/字节边界、权限/RPC故障、页数/时间预算、64位精度、严格双面DTO和10秒期限。loopback传输验证拒绝CONFIG SET、通配、任意INFO section和DBSIZE额外参数。
- 原生：760Key自动完整加载与100%；单树/本地展开/二进制Key；Hash/Set 236行及List/ZSet/Stream/TimeSeries/GEO各235行滚动；Hash取消迟到及Set空中间页；七类值DUMP未变。
- 原生：空DB1、独立DB2；延迟SCAN取消与恢复；DB切换丢弃旧批次；5100Key在5000停止且不显示100%；MATCH草稿不读取、提交自动完成且不伪造匹配百分比。
- 原生：400/550/800/1000像素两栏无重叠/外溢，宽表内横滚；只读代理没有观察到写命令、KEYS或协议错误；测试断开/重连/服务器断线状态与密码清空。
- 包：唯一SHA包安装后比较生成文件。初次同名tgz更新复用了旧安装，断言的大Buffer差异导致分配失败；通过哈希路径重装解决，校验保留严格字节相等，没有放宽真实性。

证据：本目录下 [原生报告](artifacts/resp-workbench/native-report.json)、[原生运行日志](artifacts/resp-workbench/native-run.log)、[打包与318项检查](artifacts/resp-workbench/build-and-tests.log)、[Hash界面截图](artifacts/resp-workbench/native-hash.png)。截图和值全部来自隔离合成夹具。

## 边界

Key缓存最多5000条/2MiB，自动扫描另限1000页或60秒；集合追加沿用5000行/2MiB及1000页上限。达到预算显示部分结果，需缩小筛选或范围刷新。DB目录解释最多128KiB/4096个非空DB条目；元数据不可得不伪造0。全量目录最多65536个DB且只渲染可见行。连接、总数和范围不是事务快照。

日常profile更新与实际业务库查看单独记录在本报告末尾；不保存业务Key/值截图到Git，不把测试种子或故障注入用于业务Redis。

## 日常profile已更新并实际查看

- 2026-10-17在实际C:/Users/admin/.dsh的web profile按SHA唯一包路径安装，97个包内文件/88个lib文件与验收包一致；包核对另包括12个Host peers、2个dependencies和180个源码输入哈希。实现提交为6c229fc。
- 已先备份5份配置到E:/项目demo/dsh-redis/.scratch/runtime/daily-resp-install-20261017-17c3d27b-d221-4d26-8f38-ac4d216c17ba，只在实际配置中变更package.json和pnpm-lock.yaml的Redis包引用；其他依赖、启用bundle和cordis配置均保持原样。没有恢复此前已停用的第三方插件。启动日志含本机认证URL，保留在忽略目录，不进入Git。
- 核对旧PID37976确为当前profile及7198监听后停止所属进程树；以隐藏进程PID16528、同profile/loopback/7198重新启动，stderr为空，日常应用保留运行供用户查看。
- 通过真实浏览器恢复原127.0.0.1:6379连接，未填写或保存密码；实际页面显示db0总数760、已加载760、100%扫描完成，默认树视图，无告警及继续扫描按钮。此处仅归档计数，不归档业务Key或值。
- 证据：[日常安装及界面计数](artifacts/resp-workbench/daily-install.json)、[最终包逐文件清单](artifacts/resp-workbench/package-manifest.json)、[安装输出](artifacts/resp-workbench/daily-install.log)。原生测试服务均已关闭，日常DSH是用户要求保留的交付界面。
