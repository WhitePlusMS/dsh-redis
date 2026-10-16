# 26：有界慢日志快照（进行中）

当前01–25done、26in-progress、27–29ready，原29票图不变。

## 技术来源和边界

- [Redis官方SLOWLOG GET](https://redis.io/docs/latest/commands/slowlog-get/)与[Redis8.2.6 slowlog.c](https://github.com/redis/redis/blob/8.2.6/src/slowlog.c)已读取。真实目标8.2.6返回6段；明确接受文档描述的4/6/7段，其他形状拒绝，无命令降级。
- 固定SLOWLOG GET count+1，UI数量1–100，最多接收101条，额外一条仅判断更多，不提供-1/RESET/LEN/CONFIG；运行时白名单同时约束固定GET与计数。
- 只传id、Unix秒、执行微秒、受限命令名、已记录参数数、前8个参数的字节数和可用时原始总参数数。参数正文与客户端地址/名称均不进入DTO或常规日志。字节数是Redis记录片段长度，服务器自己可能截断，不能据此还原或宣称完整原参数。
- 沿用RESP接收1MiB、8192节点/深度32、10秒总截止、可信会话DatabaseTarget及代次校验；有界表格输出不冒充网络或JS堆上限。未验收，先模型/类型/Host，再原生表格/真实版本/权限/取消/超时/边界与包。

## 模型里程碑

Host/Client/tests类型、构建、26文件267项通过（新增8项slowlog、1项真实loopback固定子命令测试），[原始控制台](artifacts/26-slowlog-view/model-check-console.log)。覆盖正文/地址不出DTO、精确整数、空/数量/4-6-7段、首8参数长度、损坏形状/顺序/预算、权限/不可用、可信目标/代次/B、取消/10秒及严格两端契约。此处mock/loopback不是实际Redis日志或原生UI验收，五项仍不勾。

## 慢日志原生专项（同包其他回归进行中）

当前包SHA `8245456e7f55c18717a03c7421495d5a6d7dc49c0cfaddeff5f963b6e24990e6`，128195字节；prepack再次267项，通过89打包文件/80lib/12Host peers/2依赖逐字节核对。

真实Redis8.2.6六段日志在原生表格专项22项通过：精确ID/Unix秒/微秒、150KB输入由服务器截断为151字节记录片段、32项截断参数只展示前8长度，正文/地址/名称不出DTO；真实1/10/100行、count草稿零读取、GET count+1/更多/冻结服务日志不变、真实ACL GET拒绝与显式恢复、主动与排队取消、10秒/EOF/旧代次零派发/B隔离/重连不重放、实际空日志/Key值及过期不变。参数摘要不能推断原始内容或原始字节数。

首次验收在fixture admin CONFIG GET返回被误当数组的前置断言处失败，产品尚未打开慢日志，自建资源全停清理；原始失败报告/log/console/截图保留。已核对实际WSL夹具和SDK6.2.1：DEFAULT_RESP=3，默认MAP映射对象；改用正式configGet并按明确键读取/恢复配置，不加双形状兼容。只修正测试脚本，以同一产品包重跑通过，重新生成实际脚本hash的源码清单。

真实服务只覆盖8.2.6六段；4/7段由模型验证；非法duration及unavailable的UI是明确HTTP结果注入，不能当成真实版本/缺命令样本。8192节点/1MiB实际接收限制复用已有RESP/loopback检查，本次没有制造1MiB真实SLOWLOG回复；100行和截断参数则为真实实连。日志/配置RESET、阈值调整仅为随机owner夹具admin准备/验证，插件没有这些接口，结束finally恢复配置并整体销毁夹具。入口无Key参数，Key消失/TYPE改变不对应此诊断；仍检查原二进制Key的DUMP/过期不变。

## 同包回归、归档与完成

同一SHA包的服务器概览原生21项（覆盖抽出SnapshotDialog后的真实取消/队列/生产10秒/EOF/目标代次）、完整数据/会话/真实SDK87项、布局24项均通过；React18.3.1实际种子身份相同，26方法非法成功响应全部拒绝。布局继续覆盖300/340/900px、真实主题/语言、12类数据与绝对过期不变，全部自建DSH/Redis/代理停止。

慢日志取消32ms/超时10092ms；慢日志与概览报告各保留2条预期主动取消ERR_ABORTED，完整数据报告保留1条预期readString取消，页面和console错误均空；布局request错误也为空。

- [慢日志报告](artifacts/26-slowlog-view/native-slowlog-smoke.json)、[实际受控样本](artifacts/26-slowlog-view/native-slowlog-real-sample.json)、[真实表格](artifacts/26-slowlog-view/native-slowlog-table.png)
- [共用弹窗概览回归](artifacts/26-slowlog-view/native-overview-smoke.json)、[完整SDK/数据报告](artifacts/26-slowlog-view/native-ui-release-smoke.json)、[布局报告](artifacts/26-slowlog-view/native-workbench-smoke.json)、[中文真实工作台](artifacts/26-slowlog-view/native-workbench-panel-wide-zh.png)
- [逐文件包和源码清单](artifacts/26-slowlog-view/workbench-release-manifest.json)、[39份原始产物SHA](artifacts/26-slowlog-view/inventory.json)、[夹具准备失败原始报告](artifacts/26-slowlog-view/native-slowlog-fixture-shape-failure.json)

源原件逐字节保全，日志结尾空行保留；一份inventory之外共39原件，源码清单按修正后的实际测试脚本重建。TLS慢日志专用实连未执行，不把既有TLS证据冒称本项新门禁。共用快照沿用25状态原型d1feeac的显式读取/取消/关闭/迟到规则，没有合并原型HTML；实际表格截图已查看，未声称用户确认外观。

本票原五项完成，01–26done、27–29ready；原29票依赖/优先级不变，整个项目尚未完成。
