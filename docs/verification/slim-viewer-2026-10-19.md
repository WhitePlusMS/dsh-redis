# 六类型精简版验收记录

2026-10-19。当前源码检查点：f6d09cc、0365de8、e9294a8。只记录本轮实际结果；历史12类型/318项报告不能代替本轮验证。

## 已完成的静态与单元检查

- Host、Client、tests三层严格TypeScript通过。
- 全新lib输出构建；Client将官方Lucide直接打包，仅React及jsx-runtime由DSH提供。
- 19文件187项回归通过，包含16方法严格协议、原生注册/卸载、六种读取、字节/游标、连接代次、取消/迟到、资料CRUD和时钟规则。
- 删除功能的UI、RPC、DTO、Host读取及对应命令移除；保留DB目录INFO keyspace、手动SELECT、TLS与只读读取边界。

## 隔离专项与安装

候选包 SHA256：`7b71a067a0924333402a7e178c1138f55731217ee52d299cf446c0179c4cdc90`。它通过默认prepack的三层类型、全新构建和187回归，隔离安装67个发布文件、56个lib逐字节匹配。随后只调整两处取消按钮及不支持类型的中英文提示，最终包在下文另记，不能混为同一SHA。

| 本轮实际检查 | 结果与边界 |
|---|---|
| 11套Host专项 | 连接8、TLS5、String7、Hash6、List6、Set6、ZSet7、Stream7、Key8、帧/预算5、恢复8，共73组通过；均自建夹具及所属清理 |
| 原生连接/资料 | CUA实际操作错误认证、保存后不重填密码直接连接、资料刷新不覆盖草稿、显式选择、关闭等待请求后连接数回到基线、已连接编辑/保存、删除确认及取消、状态查询不覆盖草稿；保存文件不含测试密码 |
| String正常刷新 | 1秒定时实际成功时间改变；查找词needle、JSON折叠保持。人为hold的读取等待中，查找/折叠和128px预览滚动保持；hold超10秒预算后正确停刷/报超时，随后手动重连成功。没有将超时后的清空说成正常刷新保持 |
| 五集合正常刷新 | Hash/List/Set/ZSet/Stream先触底加载到200行，选择第106行，打开值查找/折叠JSON，再开启1秒自动刷新；完成后200行、选中身份、表格scrollTop、查找词、折叠状态保持，成功读取时间更新、无就地错误。Stream重复field两次仍为两个序号 |
| DB及入口 | DB1实际加载1个Key，再回DB0加载6个；切换后无自动刷新开启。六类型仍可查看，专用/诊断/解码入口不存在 |
| 窄栏及配色 | 原生拖动到约464px（DOM实际463px），六视图无整体横向溢出、页签工具带33px；实际浅/深主题。导航青rgb(0,127,169)、紫rgb(121,69,206)、橘rgb(188,72,13)；实际存在官方Lucide SVG |
| 宽栏 | 原生侧栏及宿主全屏1279px Hash，表格与字段/值三区可见，无整体横向溢出；截图仅合成数据 |
| 只读证据 | 六个合成Key的DUMP与Stream消费组不变；代理只见AUTH/PING/SELECT及白名单读取，未见写命令/KEYS，代理协议错误为空 |
| 清理 | 隔离DSH进程树、代理、Redis均已停止，所属WSL夹具目录移除；12536/12537无监听。日常7198未在隔离测试阶段停用 |

原生检查全部通过CUA，`scripts/smoke-dsh.mjs`仅提供自有Redis/DSH及hold、verify、stop控制。旧12类型的自动刷新/布局/RESP入口已移除；其余历史UI辅助脚本不作为本轮执行证据。没有执行网页GPT评审或headless Playwright UI驱动。只记录就地错误和本轮交互结果，不宣称覆盖全部浏览器控制台、服务器权限或异常组合。

证据目录：[本轮合成验收产物](artifacts/slim-2026-10-19/)。保存Host专项JSON、CUA检查摘要、夹具清理/只读报告和四张合成截图；不保存临时token/密码文件或业务内容。

## 最终包及日常安装

- 最终包SHA256：`57e4d6a34e199a97c63e884596f88dc64b5cea10c11f480bed0aef4534cfac71`，应用源码检查点`7b8f15f`。默认prepack再次通过三层类型、全新构建、19文件187回归。
- 日常profile：`C:\Users\admin\.dsh\profiles\web`。按唯一SHA文件名安装；67个发布文件、56个lib、12项宿主peer和3项运行依赖核对一致。发布manifest归档为`final-release-manifest.json`。
- 安装前备份package.json、pnpm-lock.yaml、pnpm-workspace.yaml、cordis.yml、cordis.patch.yml。仅前两份插件引用/锁文件变化；其他manifest项、workspace及cordis配置保持一致。备份和包含临时token的运行文件留在被忽略的本机scratch，不入Git。
- 仅停止已核对的原7198 DSH进程树。首次启动因重复选择web profile被CLI拒绝；改成与原进程一致的单个`--profile web`参数后恢复，监听为127.0.0.1:7198、PID23752（本次快照），实际版本仍为已确认的0.2.0-rc.2。
- CUA重载原有日常页面，确认新Lucide图标、TLS折叠及无独立测试入口；手动以原本机6379设置连接，只读自动加载DB0 **760/760**，真实Hash显示20字段、1行选中、字段/值两个预览，无就地错误，自动刷新关闭。未保存业务截图、Key/字段正文、认证或业务DUMP。
- 当前日常DSH和原浏览器页保留，用户可直接查看。隔离服务与所有开发验收进程已结束；没有npm dev/start:dev、网页GPT评审或Git推送。

`verify-release-package.mjs`增加`REDIS_VERIFY_PACKAGE_ROOT`显式读取目标，未设置时仍检查项目隔离安装。它只比较文件和版本，不修改安装或配置；本轮用它实际复核日常包。

专项只使用项目内独立DSH profile与自建Redis，合成数据；不向业务Redis写入，不将凭据或业务截图提交Git。临时服务结束后关闭；日常DSH按用户要求保持运行。

工具路径需显式设置：`DSH_CLI_ENTRY`指向已核实rc.2的lib/bin.js，`REDIS_BROWSER_EXECUTABLE`指向Chrome，`REDIS_TEST_PYTHON`指向含cryptography的Python，`REDIS_TEST_BACKEND=wsl-image`。本机Node22.22.1、pnpm11.22.0；实际使用版本在专项报告中记录。
