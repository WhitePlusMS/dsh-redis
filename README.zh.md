<p align="center">
  <img src="docs/screenshots/readme-header.svg" width="100%" alt="DSH Redis — 在 DeepSeek Harness 中查看 Redis 和使用 AI 读写">
</p>

# DSH Redis

[English](README.md) | 简体中文

**DSH Redis 是 DeepSeek Harness（DSH）中的 Redis 工作区。** 连接 Redis、浏览数据库和 Key、查看数据，也可以在同一个对话中处理日常查询与操作。

**连接管理 · Key 浏览 · 数据预览 · 对话工具 · 诊断信息**

当前源码 **0.1.2** 适配 **DSH Web 0.2.2-rc.1**。按下方步骤构建安装；旧版 v0.1.0 面向 DSH 0.2.0-rc.2，不包含当前新增能力。

[安装](#安装与更新) · [开始使用](#开始使用) · [对话中使用](#对话中使用) · [功能](#功能) · [环境要求](#环境要求) · [使用边界](#数据与边界) · [常见问题](#常见问题)

[![Hash 表格与同屏字段、值预览](docs/screenshots/hash-workbench-dark.jpg)](docs/screenshots/hash-workbench-dark.jpg)

*截图记录于 2026-10-19，宿主为 DSH Web `0.2.0-rc.2`，使用隔离测试数据。复用已验收的六类型查看器截图，不冒充本次文档修订重新执行的验收。[截图来源说明](docs/screenshots/README.md)。*

- **连接与整理**：连接单机 Redis，支持 ACL、TLS 和命名连接资料。
- **浏览数据**：通过目录树或列表查看 DB 和 Key，浏览 String、Hash、List、Set、ZSet 和 Stream。
- **对话中操作**：围绕指定 Key 或当前选中项提问、查找数据、查看诊断信息和执行支持的更新。
- **适应工作习惯**：在侧栏或展开工作区中操作，切换明暗主题和中英文界面。

![手动连接 Redis，浏览 DB 和 Key，查看选中行，再在同一 DSH 对话里提问](docs/screenshots/readme-flow.svg)

## 安装与更新

规划中的市场固定地址为 `https://github.com/WhitePlusMS/dsh-redis/releases/latest/download/dsh-redis.tgz`。仓库已公开，但当前 v0.1.2 Release 尚未提供固定附件；须等正式 Release 提供并验证该附件后再向市场登记。固定地址不会自动升级已安装插件；请保留版本化安装包和校验文件以便回退。

从 [v0.1.2 Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.2) 下载 `dsh-redis-0.1.2.tgz` 和 `SHA256SUMS.txt`，核对校验值后，将安装包放到 DSH Host，用 `dsh plugin --profile web add <安装包绝对路径>` 安装。

也可以从源码构建：

当前源码版本 `0.1.2` 适配 DSH Web `0.2.2-rc.1`。以下步骤在 DSH Host 的 PowerShell 中从源码构建并安装；需要 Git、Node.js 24.9 及以上版本和 pnpm：

```powershell
git clone https://github.com/WhitePlusMS/dsh-redis.git
cd dsh-redis
pnpm install --frozen-lockfile
New-Item -ItemType Directory -Force .release | Out-Null
pnpm pack --pack-destination .release
$packageForInstall = (Resolve-Path -LiteralPath '.release/dsh-redis-0.1.2.tgz').Path
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

打包命令会执行类型检查、构建和测试。profile 引用该归档期间请保留文件；需要时重启同一个 DSH profile。此前的 [0.1.0 Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.0) 面向 DSH 0.2.0-rc.2，不适用于 0.2.2-rc.1。环境准备、界面安装、更新回退及清理见[完整安装指南](docs/INSTALLATION.zh.md)。

## 开始使用

1. 打开一个 DSH 对话，在右侧栏选择 **Redis**。
2. 打开**选择或新建连接**，填写地址、端口和可选 ACL 认证，按需展开 TLS。填写名称和可选分组后可保存不含密码的连接资料。
3. 点击**连接**。新连接从 DB 0 开始，自动分批加载 Key；单独保存资料不会连接。
4. 选择目标 DB、目录和 Key，点击集合中的行即可同屏查看详情；通过工具栏切换格式、查找或复制。
5. 自动刷新默认关闭，间隔预选 5 秒，通过刷新控件开启。切换 Key/DB/会话、隐藏视图、取消或读取失败会停止；重新显示不会自行开启。
6. 在当前版本中可直接询问“`order:1001` 的 `status` 是什么？”，也可在选中字段后询问“解释当前选中的字段”。需要切 DB 时明确提出，侧栏会跟随 Host 的新 DB。
7. 如需修改，在侧栏顶部打开**插件信息 → 开启 AI 写入**，在当前对话中明确指定已有 Key 或 Hash 字段及完整新值。写入按照当前 DSH 工具权限执行：策略允许时可以直接执行，策略要求询问时由 DSH 处理。可用工具返回的操作 ID 在插件信息中查询结果。

连接期间编辑或保存资料不会改变实际服务器。开发版支持明确要求 AI 连接唯一确定的已保存资料；需要密码时在本地连接表单填写。

## 对话中使用

在 DSH 对话中连接 Redis 后，可以围绕指定 Key 或当前选中项提问：

- “`order:1001` 的 `status` 字段是什么？”
- “查找 `order:*` 的 Key。”
- “最近有没有慢查询？”
- “把已有的 `order:1001` 的 `status` 字段完整替换为 `shipped`。”

使用更新示例时，在侧栏打开**插件信息 → 开启 AI 写入**并提供完整新值。DSH 会按工具权限策略执行，可以使用操作 ID 查询结果。支持的目标和使用条件见[数据与边界](#数据与边界)。

## 功能

<details>
<summary>展开完整功能与六类型查看方式</summary>

| 模块 | 已实现能力 |
| --- | --- |
| 连接 | 单机 Redis 地址、端口、可选 ACL 用户名/密码、TLS 与可选私有 CA；手动连接、断开 |
| 连接资料 | 本地选择、新建、命名、分组、更新和删除；不保存密码 |
| DB 与 Key | DB 目录与数量、手动切库、自动分批 `SCAN`、MATCH 筛选、加载数量与有上限的进度 |
| 导航 | 目录树或平铺列表、可配置分隔符、定位与键盘操作；青色 DB、紫色目录、橘色 Key |
| 数据查看 | String、Hash、List、Set、ZSet、Stream；选行同屏查看详情，集合滚动追加下一批 |
| 内容预览 | Text、JSON、Hex、Base64、查找、JSON 折叠、复制当前已读内容 |
| 刷新 | 手动刷新，可选 1/5/10/30 秒自动刷新；原内容仍存在时保留选中和查看状态 |
| DSH 界面 | 原生侧栏、展开工作区、明暗主题、中英文、Lucide 操作图标 |
| 对话 | DSH 原生工具支持直接读取、有限范围查找与筛选；开发版还包含诊断、连接及按需界面动作 |
| 数据更新 | 在对话中替换支持的已有 String 值或 Hash 字段，并查询操作结果 |

| 类型 | 查看方式 |
| --- | --- |
| String | 有界字节窗口预览 |
| Hash | 字段/值表格，独立字段与值预览 |
| List | 下标/值表格与选中元素预览 |
| Set | 成员表格与选中成员预览 |
| ZSet | 成员/分数表格，范围或扫描，选中成员预览 |
| Stream | 消息表格、有序字段对、字段与值预览；同名字段保留独立身份 |

窄栏中的 Stream 同样通过选行直接查看：

![DSH 窄侧栏中的 Stream 消息与字段详情](docs/screenshots/stream-sidebar-dark.jpg)

*截图记录于 2026-10-19，使用隔离测试数据，Redis 侧栏宽约 464 px；周围 DSH 工作区属于原生截图的一部分。*

</details>

## 环境要求

- **宿主：** DSH Web `0.2.2-rc.1`，与当前包声明的依赖版本一致。
- **运行与构建：** Node.js `>=24.9.0`；实际使用 Node.js `24.22.1`、pnpm `11.22.0` 验证。
- **Redis：** Host 能访问的单机服务器。已有 Redis `8.2.6` 六类型隔离验收及 Redis `8.10.0` 真实 Hash 验收，不声明完整的 Redis 版本兼容矩阵。
- **对话：** DSH 已配置可用模型，并允许使用插件工具。侧栏查看不需要另配模型 API Key。

Desktop、macOS、Linux 尚未验收。Node.js 声明范围也不等于范围内每个版本都已实际验证。

## 对话工具

| 工具 | 用途 |
| --- | --- |
| `redis_viewer_status` | 查询本对话的连接、DB 与当前选择标识 |
| `redis_viewer_keys` | 有界检索 Key，使用独立分页状态 |
| `redis_viewer_value` | 读取指定 Key；不传 Key 时读取侧栏当前选择 |
| `redis_viewer_select_db` | 用户明确要求时切换本对话的 DB，并同步侧栏 |
| `redis_viewer_prepare_write` / `redis_viewer_execute_write` | 准备并执行已启用的受控 String 或 Hash 字段替换 |
| `redis_viewer_write_status` | 查询当前对话中仍保留的操作结果 |

开发版还注册了有界 Hash 筛选、内存/慢日志/服务器/客户端/消费组诊断、RedisJSON 路径、TimeSeries 样本、Bitmap 位范围及 GEO 坐标/距离读取，以及连接资料和界面工具。用户明确要求时可在本地保存经过字段限制的诊断采样。读取工具目录、参数与限制见随包的 [AI 读取说明](docs/AI_READ_USAGE.md)；这些新增能力不代表旧版 v0.1.0 Release 已包含。

名称搜索和 Hash 筛选的首批，以及 AI 应用已保存的 MATCH 预设，都需要 DSH 原生范围确认，显示服务器、DB 与实际查询条件。宿主同时要求询问时，一次提示显示两项确认内容。同条件续页沿用该查询，已知 Key 的直接读取不需要这项扫描确认。拒绝或取消会停止查询。`SCAN MATCH` 仍可能遍历当前 DB 整个键空间，结果不是一致性快照。

展开工具调用可查看“Redis 读取记录”，其中值、查询条件、时间、完整性及原始结果直接来自本次调用。模型解释仍可能无依据推断或混用历史结果，记录不代表已校验模型文字。累计读取额度耗尽时，待在途调用结束后打开“插件信息 → 继续读取”；新消息、切库或重连不会重置该额度。

这是通过 DSH 原生 Tool API 注册的自定义工具，**不是 MCP 服务**。Client 通过 Typert RPC 同步选择标识，工具实际调用时才从 Redis 读取值。界面和 AI 的分页状态分开，复用同一会话所属的网络连接。

可以这样询问：“读取 `order:1001` 的 `status` 字段”“查找 `order:*` 的 Key”“最近有没有慢查询”。这些是使用示例，不是记录下来的模型回答。对话不能借用另一个对话的连接。

## 数据与边界

资料保存在 `<DSH_HOME>/profiles/<profile>/data/dsh-redis/connections.json`，包含名称、分组、地址、端口、用户名、TLS/CA，**不含密码**。资料在同一个 DSH profile 内共用，网络连接与选择按对话隔离；重新连接不会自动恢复以前的 DB 或 Key。

AI 工具输出会进入 DSH 对话记录，并可能发送到该对话配置的模型服务。选择 Key 不会自动把整个 DB 发送给模型。卸载插件会保留资料，也不会清除对话历史；[清理说明](docs/INSTALLATION.zh.md#停用卸载与清理资料)区分了这些操作。

Key 列表最多缓存 5,000 个 Key 或 2 MiB 编码结果。每轮自动扫描最多启动 1,000 批，或在 60 秒到期后不再启动下一批；暂停后可手动继续。达到缓存上限并丢弃批尾时需缩小筛选范围并重新扫描。筛选或中断的结果不代表完整 DB，Redis `SCAN` 在数据并发变化时也不提供一致性快照。AI 返回预算为 64 KiB；String 默认窗口及部分集合值前缀为 4,096 字节。扫描完成与值是否截断分别表达，扫描完成不代表每个值都已完整读取。

AI 写入 MVP 要求 Redis 7.4 或以上，目标 Key 和 Hash 字段均不得有 TTL；Key、字段及前后值各不超过 4,096 字节。仅支持已有目标的单次完整值替换，不支持创建、删除、批量或修改 TTL。提案最多有效 5 分钟，轮次结束、连接变化或关闭写入后提前失效；执行前仍会重新检查目标和原值。写入前后检查不能保证业务语义正确，也不能保证之后不被其他客户端修改。操作记录只在宿主内存短暂保留；结果未知时不要自动重试，需先检查目标当前值。

当前不包含：自由命令控制台、直接打开 RDB/AOF、快照、特殊类型专用视图、曲线、URI 导入、资料导入导出、Cluster、Sentinel、内置 SSH 隧道或客户端证书认证。开发版诊断是有范围的采样，不是完整服务器快照。普通 String 内的 JSON 仍可格式化。

DSH 会话历史可以保留完整提案，包括准备工具结果和执行工具入参中的 Key、可选字段、原值和新值。Base64 保留原始字节，可以解码还原。提案过期和 Host 短期操作记录清除均不会清除这些会话事件。

## 验证记录

项目已在独立 DSH profile 和隔离 Redis 环境中验证。测试环境与覆盖范围见 [DSH 验证记录](docs/verification/dsh-0.2.2-rc.1-2026-11-12.md)和[操作测试记录](docs/verification/ai-write-mvp-2026-11-11.md)。

原生联调曾出现一次样式节点缺失、图标放大，刷新后恢复，根因仍未定位。

## 卸载

在 DSH 的**插件**页面卸载 **dsh-redis**；或按要求停止目标 profile 后执行：

```powershell
dsh plugin --profile web remove dsh-redis
```

需要时重载或重启同一个 profile。卸载会保留连接资料和 DSH 对话历史；[清理已保存资料](docs/INSTALLATION.zh.md#停用卸载与清理资料)是另一个操作。

## 常见问题

**为什么 Release 地址返回 404？**

先核对 tag、`.tgz` 附件是否存在，以及 DSH Host 能否访问 GitHub。若直接安装失败，可下载安装包、校验后从 Host 本地路径安装。

**可以安装 GitHub 的 Source code 源码归档吗？**

当前 Git 树不包含 `lib/`，包入口却需要这些构建产物。使用 Release 成品 `.tgz`，或[先构建本地包](docs/INSTALLATION.zh.md#准备成品包)；仅创建源码 tag 不会得到可加载的 Redis 安装包。

**为什么提示 `cannot resolve profile bundle "dsh-redis"`？**

检查 profile 是否仍指向已经移动、删除的开发目录或归档。在同一个 profile 移除旧来源，再添加核对过的成品包，按要求重载或重启。单独执行依赖 `install` 会沿用原来源。详见[常见安装问题](docs/INSTALLATION.zh.md#常见问题)。

## 文档与许可

- [安装、更新与卸载](docs/INSTALLATION.zh.md)
- [English installation guide](docs/INSTALLATION.md)
- [版本记录](CHANGELOG.md) · [问题反馈](https://github.com/WhitePlusMS/dsh-redis/issues) · [推广介绍](https://github.com/WhitePlusMS/dsh-redis/blob/main/PROMOTION.md)
- [开发与维护说明](docs/DEVELOPMENT.md)
- [截图来源说明](docs/screenshots/README.md)

使用 MIT 许可，见 [LICENSE](LICENSE)。第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和[许可目录](licenses/)。这是社区插件，不是 Redis 或 DeepSeek 官方产品。
