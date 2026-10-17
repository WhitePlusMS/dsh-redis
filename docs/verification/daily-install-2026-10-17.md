# 2026-10-17：正式DSH安装与真实数据可见性核对

## 交付结果

Redis 0.1.0已安装到用户日常DSH_HOME C:/Users/admin/.dsh下的web profile，并在实际0.2.0-rc.2界面打开Redis原生右栏。安装93份文件的长度和SHA逐项匹配已验收包b21a919b4ac93768fc22fdf47ecd8c6fd609687f9b216bb277ad8e6369ceb737（140128字节）。正式界面已实际显示Host已就绪、连接配置及后续已连接的数据视图，不把隔离profile报告当作本轮正式安装证据。

[无秘密安装报告](artifacts/daily-install-2026-10-17/installation.json)、[首次安装原始控制台](artifacts/daily-install-2026-10-17/initial-install-console.log)。没有改产品源码或重新打包，无新增兼容层、依赖功能或写命令。

## 现有配置与最小处理

安装前PATH入口CLI已为0.2.0-rc.2，未检测到运行中的DSH；无需升级宿主。原web profile选中Git Graph、input-plus和web-search，其中Git Graph旧路径仅残留部分工程，package.json缺失；另两项实际peer仍要求rc.6。安装命令的pnpm部分17秒成功，但宿主后置全profile对账因旧Git Graph失败，首次CLI退出码1。该失败原始控制台保留，未冒充命令整体成功。

先备份五份profile安装配置，再通过本机Node正常模块加载器调用DSH官方saveManifest/withFileLock，只调整dsh.profile.bundles：保留base/web-app并加入Redis，暂时停用上述三个不可加载项。原有三项dependencies/spec逐项不变，源码及个别插件配置保留；未allow-version或降低兼容检查，也未恢复/覆盖正在迁移的Git Graph项目。

备份位于E:/项目demo/dsh-redis/.scratch/runtime/daily-install-20261017-261001dc-7c75-4cc7-8dae-3d77eaf51977/backup。备份含本地profile配置，留在忽略目录，不入Git；不复制凭据文件或会话正文。恢复原启用清单仍会遇到原兼容/路径问题，应先分别修复；本次不自动回退。

安装准备曾在工具内嵌Node模块加载器导入官方operations时因execa解析失败，配置写入未发生；后改用本机Node调用同一API成功。一次作用域变量/路径准备的前置失败亦未写配置。后台启动的等待调用超时后没有重复启动，先检查实际日志，确认Host已注册、无stderr、唯一loopback服务已就绪，再验证页面。启动认证URL/令牌与真实数据截图均未写入此文档或Git。

## “真实数据为什么看不到”的实际核对

用户RESP截图显示DB0共760个Key，正式插件初始只显示102并明确标记“可继续扫描”。只读UI检查返回pass=false（扫描未完成），随后只点击左侧Key目录的继续扫描：102→202→302→402→504→605→705→760，最终状态“扫描完成”，与用户截图总数一致。没有改变地址、DB、MATCH、凭据或数据。

原因是当前实现按显式操作增量加载：每次一个SCAN COUNT 100（提示值，不保证恰好100项），游标归零才完成；命名空间目录数字只统计当前缓存中的已加载Key，不是整库计数。初始不完整目录不表示Redis缺失。该结论由实际UI批次变化和最终760状态支持；不是仅凭代码推测。右侧Hash字段使用另一条独立的有界扫描，右侧的继续扫描不等于左侧的Key目录扫描。

对应实现：src/client/KeyBrowser.tsx的scan(false)/scan(true)与cursor状态，src/host/key-reader.ts固定SCAN，src/host/scan-cursors.ts零游标转完成，key-cache.ts累计去重/5000个或2MiB预算，KeyCatalog/key-namespaces按已加载数据建树与虚拟列表。代码事实由LUNA只读提取，根代理通过实际UI反馈作出上述判断；本次未修改源码、注入业务数据、添加调试日志或编写镜像实现测试。真实Key/值和密码不入报告。

## 运行状态与验证边界

正式用户DSH当前仅监听127.0.0.1:7198，进程PID 37976；浏览器保留为交付供用户操作。此为本次要求的日常应用，不是npm dev/start开发服务，不在安装完成时关闭用户正在体验的应用或Redis连接。没有启动额外Redis夹具、发送模型消息、填写凭据或执行Redis写命令。

正式安装/配置启用、Host注册、页面入口/就绪/连接表单和实库Key扫描已验证；未把760个Key的所有值全部读取或导出，也不宣称已验收用户业务内容。源代码和被测包均未变化，因此不重复运行296项产品构建/测试；本轮新增证据为实际正式profile、93文件一致、可见UI与分页反馈。
