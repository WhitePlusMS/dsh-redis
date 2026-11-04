<p align="center">
  <img src="docs/screenshots/readme-header.gif" width="100%" alt="DSH Redis — 在 DeepSeek Harness 中只读查看 Redis">
</p>

# DSH Redis

[English](README.md) | 简体中文 · [静态标题](docs/screenshots/readme-header.svg)

[DSH Redis](https://github.com/WhitePlusMS/dsh-redis) 是 **WhitePlusMS** 开发的 **DeepSeek Harness（DSH）** 社区插件。当前开发版支持在对话中直接询问指定 Key、按明确条件查找或进行有界诊断；需要核对结果或解释当前选择时再使用侧栏。读取使用本对话所属的 Redis 连接。

**只读查看 · 单机 Redis + TLS · Windows / DSH Web（预发布版）**

下方安装示例对应已发布的 **v0.1.0**，历史验证环境是 DSH Web `0.2.0-rc.2`。当前源码版本为 **0.1.1**，声明使用 DSH `0.2.1-rc.5`；新增 AI 能力仍在验收，不能认为已包含在旧版 Release 中。

[安装](#安装与更新) · [开始使用](#开始使用) · [功能](#功能) · [对话读取](#对话读取) · [使用边界](#数据与边界) · [卸载](#卸载) · [常见问题](#常见问题)

![Hash 表格与同屏字段、值预览](docs/screenshots/hash-workbench-dark.jpg)

*截图记录于 2026-10-19，宿主为 DSH Web `0.2.0-rc.2`，使用隔离测试数据。复用已验收的六类型查看器截图，不冒充本次文档修订重新执行的验收。[截图来源说明](docs/screenshots/README.md)。*

![手动连接 Redis，浏览 DB 和 Key，查看选中行，再在同一 DSH 对话里提问](docs/screenshots/readme-flow.svg)

## 安装与更新

使用已验证的 **DSH Web `0.2.0-rc.2`**，Host 上须有可用的 pnpm；命令行方式还需要能调用 `dsh`。下面两种方式安装的是同一个 Release 成品 `.tgz`，使用 DSH 官方支持的 tarball 安装机制。依据见[官方打包说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.zh.md)和[插件管理器说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.zh.md)。

**当前版本：`v0.1.0`。** 在[对应 Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.0) 获取 `dsh-redis-0.1.0.tgz` 和 `SHA256SUMS.txt`。[WhitePlusMS/dsh-redis](https://github.com/WhitePlusMS/dsh-redis) 保持私有，下载前须登录有仓库访问权限的账号。

维护者的交付顺序是：**核对提交 → 构建并 `pnpm pack` → `v<version>` tag → GitHub Release 上传 `.tgz` 与 `SHA256SUMS.txt` → 用户安装**。普通用户使用成品包；[版本发布步骤](docs/DEVELOPMENT.md#8-版本化发布与安装入口)由维护者完成。

### 方式一：从 DSH 界面安装

1. 在 [Releases](https://github.com/WhitePlusMS/dsh-redis/releases) 选择一个已发布版本，取得该版本的 `dsh-redis-<version>.tgz` 和 `SHA256SUMS.txt`，核对校验值。
2. 打开 DSH 的**插件 → 添加插件**。公开 Release 可以直接粘贴完整的固定版本附件 URL；当前私有仓库则需先登录 GitHub 下载附件，将文件放到 Host，再填入该文件的绝对路径。
3. 安装后选择**立即启用**，在已安装插件的详情里核对 `dsh-redis`、`v0.1.0` 和 `ui-redis` 运行状态，再在对话右侧栏打开 **Redis**。没有热重载时，按提示重启原 Host。

`v0.1.0` 固定附件地址（私有期间需要下载授权）：

```text
https://github.com/WhitePlusMS/dsh-redis/releases/download/v0.1.0/dsh-redis-0.1.0.tgz
```

浏览器的 GitHub 登录不会传给 Host 的包安装器；仓库保持私有时，采用登录下载后安装本地文件的方式。

### 方式二：从 CLI 安装

已有公开可下载的 Release 时，在 Host 终端执行：

```powershell
dsh plugin --profile web add https://github.com/WhitePlusMS/dsh-redis/releases/download/v0.1.0/dsh-redis-0.1.0.tgz
dsh plugin --profile web list dsh-redis
```

私有 Release 则先下载同一个附件，把示例路径换成它在 Host 上的实际位置，再执行：

```powershell
$packageForInstall = (Resolve-Path -LiteralPath 'C:\dsh-plugins\dsh-redis-0.1.0.tgz').Path
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

安装、启动和卸载使用服务当前浏览器的同一个 profile 与 `DSH_HOME`；`web` 是 Web 示例，不代表 Desktop。沿用原命令启动 Web（默认 Web 为 `dsh web`），需要重启时重启原实例。Release 成品包含 `lib/`，与 GitHub 自动生成的 **Source code** 源码归档不同。

### 更新已安装版本

取得目标版本的 Release 附件和校验文件。在**插件**中卸载旧包，按相同方式安装新包并启用。通过 CLI 替换时，按需要先停止目标 Host，再执行：

```powershell
dsh plugin --profile web remove dsh-redis
dsh plugin --profile web add $packageForInstall
```

这里的 `$packageForInstall` 应指向**新版**已核对的附件路径，或公开可下载的固定版本 URL。需要时重启同一个 profile，保留旧包用于回退。profile 检查、本地构建、更新回退和资料保存见[安装指南](docs/INSTALLATION.zh.md)。

## 开始使用

1. 打开一个 DSH 对话，在右侧栏选择 **Redis**。
2. 打开**选择或新建连接**，填写地址、端口和可选 ACL 认证，按需展开 TLS。填写名称和可选分组后可保存不含密码的连接资料。
3. 点击**连接**。新连接从 DB 0 开始，自动分批加载 Key；单独保存资料不会连接。
4. 选择目标 DB、目录和 Key，点击集合中的行即可同屏查看详情；通过工具栏切换格式、查找或复制。
5. 自动刷新默认关闭，间隔预选 5 秒，通过刷新控件开启。切换 Key/DB/会话、隐藏视图、取消或读取失败会停止；重新显示不会自行开启。
6. 在开发版中可直接询问“`order:1001` 的 `status` 是什么？”，也可在选中字段后询问“解释当前选中的字段”。需要切 DB 时明确提出，侧栏会跟随 Host 的新 DB。

连接期间编辑或保存资料不会改变实际服务器。开发版支持明确要求 AI 连接唯一确定的已保存资料；需要密码时在本地连接表单填写。

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

- **宿主：** 已发布 v0.1.0 历史验证环境为 DSH Web `0.2.0-rc.2`。当前开发源码在 `package.json` 声明 DSH `0.2.1-rc.5`，完整原生验收仍待完成。
- **运行与构建：** Node.js `^22.19.0 || >=24.0.0`；实际使用 Node.js `22.22.1`、pnpm `11.22.0` 验证。
- **Redis：** Host 能访问的单机服务器。已有 Redis `8.2.6` 六类型隔离验收及 Redis `8.10.0` 真实 Hash 验收，不声明完整的 Redis 版本兼容矩阵。
- **对话：** DSH 已配置可用模型，并允许使用插件工具。侧栏查看不需要另配模型 API Key。

Desktop、macOS、Linux 尚未验收。Node.js 声明范围也不等于范围内每个版本都已实际验证。

## 对话读取

| 工具 | 用途 |
| --- | --- |
| `redis_viewer_status` | 查询本对话的连接、DB 与当前选择标识 |
| `redis_viewer_keys` | 有界检索 Key，使用独立分页状态 |
| `redis_viewer_value` | 读取指定 Key；不传 Key 时读取侧栏当前选择 |
| `redis_viewer_select_db` | 用户明确要求时切换本对话的 DB，并同步侧栏 |

开发版还注册了有界 Hash 筛选、Key 内存估计、慢日志、服务器概况、客户端和 Stream 消费组诊断，以及连接资料和界面工具。参数与限制见[源码仓库中的 AI 使用说明](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/AI_READ_USAGE.md)；这些新增能力不代表旧版 v0.1.0 Release 已包含。

这是通过 DSH 原生 Tool API 注册的自定义工具，**不是 MCP 服务**。Client 通过 Typert RPC 同步选择标识，工具实际调用时才从 Redis 读取值。界面和 AI 的分页状态分开，复用同一会话所属的网络连接。

可以这样询问：“读取 `order:1001` 的 `status` 字段”“查找 `order:*` 的 Key”“最近有没有慢查询”。这些是使用示例，不是记录下来的模型回答。对话不能借用另一个对话的连接。

## 数据与边界

资料保存在 `<DSH_HOME>/profiles/<profile>/data/dsh-redis/connections.json`，包含名称、分组、地址、端口、用户名、TLS/CA，**不含密码**。资料在同一个 DSH profile 内共用，网络连接与选择按对话隔离；重新连接不会自动恢复以前的 DB 或 Key。

AI 工具输出会进入 DSH 对话记录，并可能发送到该对话配置的模型服务。选择 Key 不会自动把整个 DB 发送给模型。卸载插件会保留资料，也不会清除对话历史；[清理说明](docs/INSTALLATION.zh.md#停用卸载与清理资料)区分了这些操作。

Key 列表最多缓存 5,000 个 Key 或 2 MiB 编码结果。每轮自动扫描最多启动 1,000 批，或在 60 秒到期后不再启动下一批；暂停后可手动继续。达到缓存上限并丢弃批尾时需缩小筛选范围并重新扫描。筛选或中断的结果不代表完整 DB，Redis `SCAN` 在数据并发变化时也不提供一致性快照。AI 返回预算为 64 KiB；String 默认窗口及部分集合值前缀为 4,096 字节。扫描完成与值是否截断分别表达，扫描完成不代表每个值都已完整读取。

当前不包含：Redis 写入、自由命令控制台、直接打开 RDB/AOF、快照、特殊类型专用视图、曲线、URI 导入、资料导入导出、Cluster、Sentinel、内置 SSH 隧道或客户端证书认证。开发版诊断是有范围的采样，不是完整服务器快照。普通 String 内的 JSON 仍可格式化。

## 验证与已知问题

2026-11-04 基线通过类型检查、构建及 **71 个测试文件 / 572 项测试**；此后新增客户端诊断另通过专项测试和隔离 Redis 8.2.6 实测。此前部分开发构建使用合成数据通过了真实 DSH/模型提问；当前构建的原生界面通道及完整真实模型验收仍待完成，详见[源码仓库中的验收记录](https://github.com/WhitePlusMS/dsh-redis/blob/main/docs/verification/user-questions-real-model-2026-11-04.md)。历史测试不能代表当前构建已验收。

原生联调曾出现一次样式节点缺失、图标放大，刷新浏览器后恢复，根因仍未定位。源码仓库保留历史验收记录，但历史功能不代表都保留在当前精简版中。

## 后续规划

以下候选未实施、未排期，当前版本继续只读。

- [ ] 可选写入先支持 Hash 单字段新增、修改，再考虑单字段删除和整个 Key 删除。
- [ ] 当前会话连接临时手动解锁，默认关闭；断开、重连、更换连接后关闭。开启开关不等于批准具体操作。
- [ ] 每次变更先展示服务器、DB、Key、字段、修改前后及 TTL 影响。AI 提出操作，用户决定是否执行。
- [ ] Host 强制校验对应单次操作的人工确认。AI 传入 `confirm: true` 不算批准；目标、DB、数据变化使旧确认失效。
- [ ] 验证未解锁、未确认、取消、重复提交和目标/数据变化等情形，再确认原读取与会话隔离正常，才考虑发布。

该候选不包含批量删除、清空 DB、任意命令和脚本执行。

## 卸载

在 DSH 的**插件**页面卸载 **dsh-redis**；或按要求停止目标 profile 后执行：

```powershell
dsh plugin --profile web remove dsh-redis
```

需要时重载或重启同一个 profile。卸载会保留连接资料和 DSH 对话历史；[清理已保存资料](docs/INSTALLATION.zh.md#停用卸载与清理资料)是另一个操作。

## 常见问题

**为什么 Release 地址返回 404？**

先核对 tag、`.tgz` 附件名，以及当前账号是否有仓库访问权限。浏览器登录不会授权另一台 Host 下载；这个私有 Release 采用登录下载后安装本地文件的方式。

**可以安装 GitHub 的 Source code 源码归档吗？**

当前 Git 树不包含 `lib/`，包入口却需要这些构建产物。使用 Release 成品 `.tgz`，或[先构建本地包](docs/INSTALLATION.zh.md#准备成品包)；仅创建源码 tag 不会得到可加载的 Redis 安装包。

**为什么提示 `cannot resolve profile bundle "dsh-redis"`？**

检查 profile 是否仍指向已经移动、删除的开发目录或归档。在同一个 profile 移除旧来源，再添加核对过的成品包，按要求重载或重启。单独执行依赖 `install` 会沿用原来源。详见[常见安装问题](docs/INSTALLATION.zh.md#常见问题)。

## 文档与许可

- [安装、更新与卸载](docs/INSTALLATION.zh.md)
- [English installation guide](docs/INSTALLATION.md)
- [版本记录](CHANGELOG.md) · [问题反馈](https://github.com/WhitePlusMS/dsh-redis/issues)
- [开发与维护说明](docs/DEVELOPMENT.md)
- [截图来源说明](docs/screenshots/README.md)

使用 MIT 许可，见 [LICENSE](LICENSE)。第三方来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 和[许可目录](licenses/)。这是社区插件，不是 Redis 或 DeepSeek 官方产品。
