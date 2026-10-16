# 28：受控自动刷新当前 Key（已验收）

01–28 done，29 ready。原29票图不变，下文阶段记录以最终验收为准。

## 基础与范围

依据固定rc.2的ui-sidebar-right/src/client/contract/slots.ts和tab-info.ts，PropsRuntime注入useTabInfo返回tab.visible及记录寿命signal；隐藏与session switch不会abort记录signal，必须同时观察visible。浏览器[visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event)覆盖页面隐藏；[React external store](https://react.dev/reference/react/useSyncExternalStore)遵守缓存不可变snapshot与稳定订阅。实际React仍锁18.3.1，未采用新版本API。

一个Key边界一个纯调度器，Reader token只归属当前查看方式；一个完成后计时的one-shot timer，1/5/10/30秒、默认5秒。不会更换连接/DB或新增Host方法。原只读命令、字节/代次、取消/10秒和RESP接收/语义预算继续由既有Host负责，自动读取不提高边界。

隐藏/取消/失败/变型或owner变更停止且不自动恢复；正在排队的React自动effect在停用后不得发起读取。默认工具栏小开关；查询范围沿用已提交状态，集合重新读取首个有界页、无游标自动排空，Bloom只统计不重放成员判断。不持久化enabled、计时器、读值。

原型指针与状态裁决见原28票，HTML仅throwaway分支；以下保留模型/UI/真实验证的阶段记录，最终验收见末节。

## 调度模型里程碑

严格三层TS、构建、28文件286项通过，其中9项新调度行为：默认不读/最小间隔、慢读不重叠/完成后计时、手动读取重置等待、隐藏取消/恢复不启用、tick同步复核可见、停用后排队effect拒发、错误/消失/变型停用、旧owner不可影响新、卸载/订阅释放。原始输出见[model-check-console.log](artifacts/28-key-auto-refresh/model-check-console.log)。该模型里程碑时点尚未接UI、未执行真实原生。

## 实现职责与请求边界

| 文件 | 职责与影响 |
| --- | --- |
| src/client/auto-refresh.ts | 单个当前reader token、至多一个one-shot定时器、合法间隔、开始/完成/停止/替换和排队effect许可；无DOM/连接/值缓存。 |
| src/client/AutoRefresh.tsx | 框架可见性与document事件、当前Key边界、紧凑工具栏、稳定external-store订阅；reader保留自己的查询/取消。 |
| RedisWorkspace.tsx / KeyBrowser.tsx | 正式useTabInfo，Key原始Base64为边界key；上层已有connection generation/DB边界继续承担隔离。 |
| KeyDetails / Bitmap / Hll / Json / List / Geo / Bloom | 原有effect在dispatch前begin；自动刷新仅递增已提交请求的attempt，取消复用旧controller与清空规则。 |
| use-collection-scan.ts / ZSetView.tsx | Hash/Set/ZSet/Stream/TimeSeries重读首个有界页；原手动more保留；draft clear停用，GEO时父ZSet源不注册。 |
| locales.ts / styles.ts / README.md | 双语帮助和状态；窄栏图标/间隔/帮助一行，规则按需展开；保留工作台布局。 |

每次真实读取同步begin并移除等待；只有成功value/page结算后才能预约下一轮。tick先复核原生visible、记录signal和document可见，置pendingOwner再调用当前reader。React可能先重绘旧result再运行effect，pendingOwner阻止旧成功报告重挂定时器；effect开始再确认许可，Off/隐藏/换owner后不发已排队自动请求。完成、失败、取消、卸载、换Key/DB/Session/view均有同一owner守卫，旧cleanup/report不能注销新reader。

自动刷新参数只取原有已提交请求；格式和未提交输入不重置。String/Bitmap/JSON/List/GEO重读原窗口/路径，HLL重复有界估算。Hash/Set/ZSet扫描与Stream/TimeSeries使用cursor=null、替换缓存首个有界页，不把局部结果标成全量。Bloom自动固定itemBase64=null，统计失败不自动重复，原有显式成员判断不重放。关闭开关/隐藏时取消当前自动等待；原生Redis命令可能仍执行或排空，不承诺瞬间停止服务器计算。

不增加Host RPC、Typert schema、Redis命令或依赖；现有27个方法、严格双端DTO、可信会话/DB/代次、Key字节、队列/10秒截止、1MiB接收与各reader语义预算原样承担数据边界。自动刷新不保存到BrowsingSession，不引入Redis订阅/自动重连/自动SELECT。上次成功时间仅更新于成功读取，失败后继续显示最后成功时间和停止原因；默认关闭不增加时间说明行。

## 测试中遇到的问题与证据界限

第一次在12 reader通过后，测试将单个Playwright Response数组解构而失败；第二次立即释放真实扣留回复早于跨HTTP中止交付，取消后置命令断言失败；第三次已通过生命周期与失败门禁，但关闭唯一tab后忘记展开整个侧栏，定位到隐藏New tab。各次passed=false、资源停止，四原件分别保留script-shape-failure、cancel-release-failure、last-tab-reopen-failure前缀。均先核代码/真实截图再改测试；没有以忽略断言、改缓存或扩大权限掩盖。

固定rc.2 Connection使用fetch AbortSignal承载unary，Host接Request.signal，没有独立远程取消ACK。最终取消门禁明确等待浏览器requestfailed、保持真实回复扣留并完成B Host读取，再释放并验证A零后置命令/无重启；这证明本次交付顺序下中止到达Host，不是点击瞬间远端已停止的保证。Host传输取消拒绝等待但排空有界帧，截止才关闭停滞socket。

真实版本仅Redis8.2.6/相同自建module环境；缺命令/其他版本不冒充新实连。浏览器页面后台事件为模型与已注册handler覆盖，真实原生面板收起、A/B切换、tab关闭/重开覆盖，不宣称OS最小化/睡眠实测。真实慢回复是TCP代理扣留Redis已产生的回复，不宣称Redis计算变慢或被中止。新自动刷新未单独跑TLS/服务端1MiB超量收包门禁；已有Host基础与原票证据保留，不混为本包新通过。

## 最终候选

状态显示修正后的包SHA `4cc78d01a745a6ba96824962fa8e8d511f857ffacbf2e1234384d8b47abd1233`，136510字节；严格prepack286项通过，逐文件隔离安装已核。此前f6f9e2e的286/26/87/24为独立checkpoint，不能代替最终新包验收。最终新包原生专项和受影响门禁已全部通过，结果如下。

## 最终同包验收

| 门禁 | 4cc78d01实际结果 |
| --- | --- |
| 严格Host/Client/tests类型、构建、单元/Host/协议 | 28文件286项通过（prepack） |
| 真实自动刷新原生专项 | 26组通过；12 reader、实际两轮间隔1013–1028ms、取消27ms、Host截止10058ms |
| 完整数据/会话/实际SDK | 87组通过，27方法坏成功HTTP结果全拒绝；实际React18.3.1同对象、Chrome155.0.8059.80/Node22.22.1 |
| 实际工作台布局 | 24组、22几何样本，300/340/900px、明暗及EN/ZH/EN |
| 包与安装 | 93文件/84lib/12Host peer/2依赖/168源码输入逐文件SHA一致 |

[自动专项报告](artifacts/28-key-auto-refresh/native-auto-refresh-smoke.json)、[精确时序](artifacts/28-key-auto-refresh/native-auto-refresh-timings.json)、[完整数据与SDK](artifacts/28-key-auto-refresh/native-ui-release-smoke.json)、[布局报告](artifacts/28-key-auto-refresh/native-workbench-smoke.json)、[精确包清单](artifacts/28-key-auto-refresh/workbench-release-manifest.json)、[52原件SHA清单](artifacts/28-key-auto-refresh/inventory.json)。三报告page/console均无错误，自动3条/完整1条预期readString ERR_ABORTED、布局0条请求失败。processStopped/fixturesStopped均true，自动代理全关闭；实际窄/宽截图已查看，原工作台分栏和图标工具栏保留。布局通过不等于用户已验收视觉。

复现：使用21验收文档中固定E盘/rc.2/Chrome/WSL夹具环境，在严格打包并仅安装隔离DSH_HOME后，设置REDIS_SMOKE_CONNECTIONS=1、REDIS_SMOKE_KEYS=1、REDIS_SMOKE_AUTO_REFRESH=1运行node scripts/smoke-dsh.mjs；完整回归用原RELEASE+12类型+SESSIONS组合，布局另用LAYOUT=1。各WSL门禁串行，包核对脚本仅文件读校验可并行；没有启动npm dev、动日常profile/用户业务库或网页端GPT评审。
