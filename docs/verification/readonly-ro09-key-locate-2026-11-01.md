# RO09 Key 定位子项验证记录

状态：本记录针对协议 7 构建的 Key 定位场景；后续源码已进入协议 9，必须重新构建并验收。Hash、List、Set、ZSet 和 Stream 的字段或成员程序定位仍未完成，RO09 整项保持进行中。

## 构建与安装

- 协议版本 7；`pnpm pack` 默认预打包检查通过，包括类型检查与 44 个测试文件、398 项测试。安装包 SHA-256：`0d557a21cb21d81da9c5b7198678c1ac36c7983f33de566590f9a53092be0684`。
- 独立 DSH Web `0.2.0-rc.2` 测试配置和安装依赖位于 E 盘；安装后 Client 构建与安装文件 SHA-256 均为 `75fbd354bcf62d621743fb161663926037a15e9ac4a509c54bc45b6d3388c469`。测试实例通过固定版凭据服务引用日常模型配置，没有复制或记录密钥。
- 自动化覆盖真实 Chromium、实际 Host Gateway 和 ToolRuntime：二进制及空 Key、缺失/无权限、在途取消和重连、超长结果预算、用户抢先选择、目录聚焦与折叠、滚轮和原生滚动条拖动。浏览器后台可见性事件在 Chromium 中受控模拟；不能将其记为真实 DSH 后台切换通过。

## 真实 DSH 与模型

- 使用 `DeepSeek-V41-Flash` 和随机端口独立 Redis 8.2.6；用户 Redis 未用于测试写入。测试准备阶段只向所属 Redis 写入合成 Hash 和二进制 Key。
- 模型实际调用 `redis_viewer_locate_key` 定位文本 Key `fixture:selection`，返回 `applied`，侧栏实际选中该 Key；随后无参数 `redis_viewer_value` 返回 `source: selection` 和两个合成字段。
- 先将 Key MATCH 设置为不匹配条件，使目录已加载数量为 0；模型以 `keyBase64: AP8B` 定位未扫描的二进制 Key，返回 `applied`，界面单独显示 `0x00ff01`，无参数读取返回 `synthetic-binary`。定点目标没有计入已扫描 Key 数量。
- 模型定位不存在的 `fixture:missing` 返回 `missing`，没有替换原选择；收起侧栏后无参数读取明确返回界面不可用错误，重新打开后读取恢复到原二进制选择。
- 模型定位合成 Hash，人工选中 `second` 后收起并重新打开侧栏，字段仍被选中；模型无参数读取返回 `source: selection`、字段 `second` 和 `synthetic-two`。
- 模型调用 `redis_viewer_profiles` 列出隔离配置中保存的 `Synthetic fixture`，仅返回资料 ID 和名称，没有返回连接设置。此项只验证 RO12 的列表子项，不代表连接生命周期管理完成。

## 边界与清理

模型请求和插件读取均限定在合成测试数据；测试准备时的 Redis 写入仅发生在随机端口隔离实例。结束前核对合成 Hash 和二进制值未改变，隔离 DSH 与 Redis 的监听端口已停止；日常 DSH `8575` 和用户 Redis `6379` 仍在运行。没有安装到日常 profile、提交或推送。

真实 DSH 后台标签的隐藏/恢复、真实延迟动作及全部集合项程序定位仍待验收。大 Key 虽可定位，但完整身份可能超出单次 AI 结果预算，工具会明确拒绝该次结果，不能当成完整读取。
