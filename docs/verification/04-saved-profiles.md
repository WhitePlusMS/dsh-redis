# 04 个人连接配置验收

日期：2026-10-16（Asia/Shanghai）；实际DSH/SDK 0.2.0-rc.2，Node22.22.1，独占Redis8.2.6 TLS-only。

- pnpm check：Host/Client/tests严格类型、构建与27项回归通过，其中8项使用真实配置文件，覆盖普通/TLS重开、更新/删除稳定ID、并发不丢写、密码拒绝、损坏/未知版本/重复ID文件保留、不可用/超大文件、取消、profile隔离、50条限额。
- 两端严格协议拒绝保存请求/公开列表内的password、额外字段、错误名称/重复或未知身份；保存仅含地址、用户名和TLS/CA资料。
- 原生第一轮12组：真实UI保存普通/TLS、更新名称保留ID、删除普通配置、重新选择清密码且不联网；真实网关拒绝将密码存入设置且不回显。既有TLS/测试/连接/断开/错误/资源回归通过。
- 第一轮DSH和浏览器已关闭；第二轮冷启动同一个独立profile，12组检查通过，保存配置可选且默认未选择/未连接，选择后地址/端口/TLS/CA恢复、密码空，再手动连接成功。最后通过UI删除本次测试配置。
- 文件路径由官方ProfileContext.dir确定，独立测试落在.scratch/runtime/dsh-home/profiles/web/data/dsh-redis/connections.json；文件最终version1、profiles空，测试结束无密码和过期夹具残留。未写业务仓库、用户日常profile、证书库或用户Redis。
- 安装内容与构建lib逐文件一致，包SHA256 `8a533c2685d5070ac490aa2da5f5c3e4e895b9f3c317d447e31d1f9d8c0d91eb`。两轮截图已人工核对；DSH/浏览器/Redis/短期证书均已清理。

保存使用当前profile插件目录、50条/4MiB上限、串行读改写、0600临时文件和原子替换。不实现记住密码；密码默认只在操作内存中，不伪装为已有跨平台秘密持久化。

原生复现：重新打包到SHA命名路径并安装到项目独立profile，设置DSH_CLI_ENTRY、REDIS_BROWSER_EXECUTABLE、REDIS_TEST_PYTHON及REDIS_SMOKE_CONNECTIONS=1、REDIS_SMOKE_TLS=1、REDIS_SMOKE_PROFILES=1，运行node scripts/smoke-dsh.mjs。finally仅清理完整owner UUID对应的测试配置，不清空其他条目。

证据：04-native-profiles-save/reopen-smoke.json及对应PNG。初轮测试PEM末尾换行断言与表单trim约定不符，已按真实语义修正并完整重跑；未为通过修改产品行为。DB/Key、会话浏览状态、导入导出为后续任务。
