# 21: 从安装包完成只读首版的真实验收

> 当前执行基线：用户明确选择 `0.2.0-rc.2` 并继续原 29 票实现。宿主、对应源码和配套 SDK 固定该 RC 版，如实标注预发布属性；此前稳定版调查及仅文档检查保留为历史，不作为本次实现的等待条件。

**What to build:** 用户能在目标 DSH 安装独立包，并依说明完成连接、检索、12 类查看、会话切换和退出。

**Blocked by:** 08 按原始索引查看 List；09 增量查看 Set 成员；11 按消息 ID 查看 Stream；12 查看 RedisJSON 根值和指定路径；13 按位偏移查看 Bitmap；14 从 ZSet 切换查看 GEO 坐标；15 只读查看 HyperLogLog 估算数量；16 按时间范围查看 TimeSeries 样本；17 查看 Bloom 信息和成员存在性；19 取消读取并从超时或断线中恢复；20 在窄宽侧栏和两种主题下完成查看

**Status:** done

**Priority:** P0

- [x] 发布前核对指定 rc.2、对应源码 tag/SHA、配套 SDK、包哈希与实际安装一致，完成受影响验证；如实记录 RC 属性、来源/日期及参考复制范围，不使用浮动 latest，历史包验收不代替当前包通过。
- [x] 所有 P0 功能票有验收证据；适用扩展未验证则明确记录，不能算作通过或宣称完整支持。
- [x] 源码、锁定依赖、包版本/哈希和运行资源闭包一致，类型/专项回归与安装版交互通过。
- [x] 测试受版本管理；记录大响应实际边界、只读证据、环境版本和操作说明，清理自己创建的测试资源。
- [x] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## Comments

2026-10-16：发布依赖审计事实：隔离profile pnpm peers check报告13个missing（Cordis、11个DSH模块、React）。固定rc.2官方profile.ts明确hoisted+autoInstallPeers:false，以安装目录的共享runtime供给宿主peer；root已复核相关源码段。全局安装实际manifest的Cordis4.0.4及11个DSH模块0.2.0-rc.2与声明匹配；React不在CLI Node lock/实体包，官方rc.2 Web workspace lock解析18.3.1，不能拿源码lock替代浏览器实际共享版本直接证据。后者仍待本票核验，不盲目安装另一React/宿主副本。原生HLL67组成功不替代整体验收。

2026-10-16：16原生响应故障注入发现当前rc.2客户端wire路径未自动执行结果描述器，越界时间戳曾显示；TimeSeries接收入口已显式复用严格schema，新包73组验证拒绝、清空与恢复。其他RPC浏览器接收处仍需本票逐项审计，不把schema单测或Host网关校验代替真实Client边界；本票不勾选。

2026-10-16：20完成后本票开始，5项仍未勾选。LUNA只读事实已核对23项RPC及全部浏览器消费入口：目前只有TimeSeries/Bloom/浏览状态显式parse返回，其他入口仍待统一核验；Host/描述器schema不代替真实浏览器。已定位rc.2 Web seed.ts→__ModuleLoader__.create→ClientModuleSystem.import('react')的实际共享模块链，以及Host createRuntimeResolution→PluginPackages→installRuntimeInterception解析路径；尚未取得浏览器实际React.version，不据lock下结论。不复制另一个React/宿主runtime；后续以当前最终包完成真实门禁。

2026-10-16：最终包bb2b83e51c1a83abc18c9f638484bded2e53451931ffa2d534f5c06d9584a1ea完成全部P0发布门禁：226回归、安装版87/17/17/22/18组、79包文件/70lib/12Host peer/实际React18.3.1同一性。23项真实SDK decoder拒绝畸形结果并恢复。完整证据、输入SHA、来源日期/许可、预算/只读、使用说明及未覆盖范围见docs/verification/21-release-verification.md；早期包和清理拒绝记录保留，不冒称29票全部完成。本轮自建资源均退出，完成核对后本地提交。

2026-10-16：用户要求前端参考Database/RESP重做。旧bb2b83e包的功能/资源证据保留；20重开后本票恢复in-progress，新UI编译/交互/安装包身份需重新验证，旧包通过不等于当前视觉验收。

2026-10-16新版复验完成：Database/RESP最终包509aa7b06132ab0fa3123bafca18f75f43df10ac019c00cfbffdcfc950373e43三层类型/构建/226回归，真实全类型/双会话/SDK及共享React87组、TLS含DB/Key保存/冷启动17/17组、中英/主题/分栏24组、恢复18组均通过；79包文件/70lib/12Host peer/实际React18.3.1/134源输入一致。全部本轮资源退出或精确回收，保留中断/两次83组与阶段记录，详见docs/verification/21-workbench-release.md。01–21完成，22–29仍待开发，不改原依赖/优先级。
