# DSH Redis 安装、更新与卸载

[English](INSTALLATION.md) | 简体中文

当前源码版本 **0.1.1**，适配 **DSH Web 0.2.1-rc.5**。旧版 v0.1.0 面向 DSH 0.2.0-rc.2，不适用于当前宿主。

## 适用环境

- 已配置 DSH Web `0.2.1-rc.5`；沿用服务当前浏览器的 profile 和 `DSH_HOME`。
- Node.js `^22.19.0 || >=24.0.0`、pnpm `11.22.0`、Git。已验证平台为 Windows。
- Host 能访问 Redis，构建环境能下载依赖。
- 下文使用已有 `web` profile；已有源码目录时跳过 clone 和 cd。

## 准备成品包

当前版本从源码构建；已有可信成品包时可跳过构建。同版本 SHA 文件名用于本地开发检查点，不替代正式发布版本。

在希望存放源码的目录打开 PowerShell 并执行；如果已经有源码，请进入现有仓库，跳过 `git clone` 和 `cd`：

```powershell
node --version
pnpm --version
dsh --version
git clone https://github.com/WhitePlusMS/dsh-redis.git
cd dsh-redis
pnpm install --frozen-lockfile
New-Item -ItemType Directory -Force .release | Out-Null
pnpm pack --pack-destination .release

$packagePath = (Resolve-Path -LiteralPath '.release\dsh-redis-0.1.1.tgz').Path
$sha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
$packageForInstall = Join-Path (Split-Path -Parent $packagePath) ("dsh-redis-0.1.1-{0}.tgz" -f $sha256)
Copy-Item -LiteralPath $packagePath -Destination $packageForInstall
$packageForInstall
```

`pnpm pack` 会执行 `prepack`：严格类型检查、全新构建和单元回归，不要跳过这个钩子。SHA 文件名用于区分同为 `0.1.1` 的不同开发包；复制改名不会改变包的内容。只要 profile 的依赖清单和锁文件仍引用这个本地包，就保留它所在的路径。

本地计算 SHA256 可以标识手里的文件；接收别人交付的包时，还应与该可信来源提供的校验值核对。自行算出一个新值本身不能证明文件来源。

## 从 DSH 界面安装

1. 打开 DSH 的**插件 → 添加插件**。
2. 填写上一步构建得到的 `$packageForInstall` 所显示的 Host 绝对路径；如果使用可信来源提供的成品包，也可填写该包路径。来源必须是构建后的 `.tgz`，不是仓库页面或 Source code 源码归档。
3. 点击**安装**。本地归档会先检查来源，再执行安装；本次验证的流程没有独立的包名、版本预览页。
4. 完成后选择**立即启用**，再在已安装插件的详情核对 `dsh-redis`、`0.1.1` 和 `ui-redis` 运行状态。直接关闭成功窗口会让新组合包保持关闭。
5. 打开一个对话，在右侧栏选择 **Redis**。profile 不支持热重载时，按 DSH 的提示重启原 Host。

本地路径由 **DSH Host 所在电脑**解析。浏览器和 Host 分处两台电脑时，填写浏览器电脑上的路径不会上传文件，应先把包传到 Host。

DSH 支持包名、Git、tarball 和本地路径。本项目采用 Release 成品 tarball；仅输入注册表包名 `dsh-redis` 安装还需要单独发布到 npm。这里与 [GitGraph](https://github.com/WhitePlusMS/dsh-git-graph/blob/f4ae9a9b8ed40233f7322df5f967708be9e29316/README.zh.md#安装与更新) 使用相同的受支持安装机制，Release 托管是本项目的交付约定，并非 DSH 唯一支持的分发渠道。

## 从 CLI 安装

在同一个 PowerShell 窗口使用上方生成的 `$packageForInstall`。

添加所选成品包并核对安装版本：

```powershell
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

成品包包含本插件的 `lib/`，用户安装时无需编译本插件；解析运行依赖仍可能需要联网。

安装后在**插件**页面核对组合包，若未启用则手动开启。不支持热重载时，按原方式重启同一个 Host；沿用原启动命令（默认 Web 为 `dsh web`），加载完成后再刷新浏览器。

也可以只打印组合配置，不启动服务：

```powershell
dsh --profile web --dump-config
```

Redis 的 Host 条目是 `ui-redis`，由 `dsh-redis` 组合包提供。pnpm 能列出包，不代表组合包和客户端已经激活；完整配置可能包含其他 profile 信息，不应直接作为公开报错附件。

## 首次连接与安装检查

1. 在 Redis 侧栏打开**选择或新建连接**。
2. 填写地址、端口及可选的 ACL 用户名、密码。服务器需要时开启 TLS；使用私有 CA 时提供 CA 证书。
3. 想保存连接资料时填写名称和可选分组。保存只保存资料，点击**连接**才建立网络连接。
4. 新连接从 DB 0 开始，选择目标 DB，等待 Key 自动分批加载，再选择 Key 查看。
5. 需要对话读取时，在这个已经手动连接的 DSH 对话里询问当前 Key 或字段。模型服务和宿主工具策略须可用。

需要能访问 Redis 的是 Host，浏览器能访问不等于 Host 能访问。TLS 始终验证证书；当前没有内置 SSH 隧道、Cluster 或 Sentinel 模式。

## 更新

当前验证的 DSH 版本没有这个已安装组合包的自动更新操作，采用**卸载旧包，再安装新成品包**。

1. 保留旧包及校验值，方便回退。备份目标 profile 的 `package.json`、`pnpm-lock.yaml`，以及实际存在的 `pnpm-workspace.yaml`、`cordis.yml`、`cordis.patch.yml`；使用已保存资料时，也备份下文的 Redis 连接文件。
2. 构建目标版本的成品包，或取得可信来源提供的成品包与校验文件。已发布更新使用新版本、新 tag，保留旧附件不变；本地同版本的不同构建使用新的 SHA 文件名。
3. 在**插件**中关闭、卸载 DSH Redis。没有热重载时，按 DSH 要求先通过原来的正常方式停止该 profile 的 Host。
4. 安装新包，启用组合包；需要时重启同一个 profile，再刷新浏览器。
5. 重新手动连接，核对 DB、Key 列表与值预览。使用 AI 工具时，再在同一个对话中检查读取。

CLI 对应步骤如下，其中 `$packageForInstall` 是已核对的新包路径，或公开可下载的固定版本 Release 附件 URL：

```powershell
dsh plugin --profile web remove dsh-redis
dsh plugin --profile web add $packageForInstall
dsh plugin --profile web list dsh-redis
```

仅修改 CLI 依赖不会卸载正在运行的 Host。走 CLI 替换路线时，先停止目标 profile，完成后沿用原命令和环境重新启动；重新安装后检查组合包开关，之前显式关闭的组合包可能仍保持关闭。

回退时按同样步骤安装保留的旧包。当前资料文件有版本化 schema，没有通用的向后兼容或降级保证；未来若 schema 改变，应保留并使用与旧版本匹配的资料备份。

## 数据与配置保存

| 内容 | 位置与生命周期 |
| --- | --- |
| 已保存连接资料 | `<DSH_HOME>/profiles/<profile>/data/dsh-redis/connections.json` |
| 保存字段 | 名称、可选分组、地址、端口、可选用户名和 TLS/CA |
| 密码 | 仅当前表单与 Host 连接持有，不写入连接资料文件 |
| Redis 网络连接 | 归属一个 DSH 对话，其他对话不会共用 |
| 当前 DB、Key、选中行 | 运行时状态，不据此自动恢复网络连接 |
| AI 工具返回值 | 进入 DSH 对话记录，并可能发送给该对话配置的模型服务 |

`DSH_HOME` 默认是 `~/.dsh`。Windows 默认 `web` profile 的资料文件为 `%USERPROFILE%\.dsh\profiles\web\data\dsh-redis\connections.json`；自定义 home 时位置随之改变。资料只在同一个 DSH profile 内共用，文件可能含内网地址、用户名及 CA 内容。

插件不另设模型 API Key：侧栏查看使用 Redis 连接，对话使用 DSH 已配置的模型。历史 Release 不提供诊断快照导出。当前源码可按明确请求将诊断采样保存到 `data/dsh-redis/reports`；卸载后报告和已保存的 MATCH 预设仍留在 profile 中。

## 停用、卸载与清理资料

- **停用：**在**插件**中关闭 DSH Redis 组合包。Host 实际卸载插件后会释放其连接和 reader；没有热重载时可能需要重启。
- **卸载：**使用插件管理器的卸载操作，或先停止目标 profile，再执行 `dsh plugin --profile web remove dsh-redis`。按要求重载或重启，才会让正在运行的 Host 释放旧插件。
- **保留资料：**卸载会移除包依赖和组合包选择，不会删除 `data/dsh-redis/connections.json`。同 profile 重新安装后可复用已保存资料，密码需重新输入，连接需手动发起。
- **删除资料：**可在连接选择器删除单条资料。需要彻底清理时，先卸载运行中的插件，按需备份并仅删除这个插件所属的连接文件，不要删除整个 DSH home 或 profile。

停用、卸载不会删除 Redis Key 或模型服务配置。已有对话记录由 DSH 管理，卸载本插件不会清除历史工具结果。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| Release URL 返回 404/403 | 核对 tag 与指定附件是否存在，以及访问权限；浏览器登录不等于安装器已获授权，私有附件下载后使用 Host 路径 |
| Source code 归档没有可加载入口 | 使用构建后的 `.tgz`；当前源码 Git 树不含 `lib/` |
| `cannot resolve profile bundle "dsh-redis"` | 在同一 profile 移除已失效的开发来源，再添加核对过的成品包；单独 `install` 会复用旧来源 |
| 安装后没有 Redis 入口 | 目标 profile、组合包开关、Host 重载或重启、浏览器刷新及 Host 诊断 |
| DSH 提示版本不兼容 | 核对包声明的 DSH 版本：v0.1.0 历史证据使用 `0.2.0-rc.2`，当前 0.1.1 源码声明 `0.2.1-rc.5`；不要强制豁免或让当前包降回旧基线 |
| 无法连接 | Host 到 Redis 的网络、端口、ACL、TLS、CA，以及实际返回的错误 |
| 换对话后看不到连接 | 回到手动连接的对话；网络连接按会话隔离 |
| 加载数量小于 DB 总数 | MATCH 筛选和有上限的扫描可能只返回部分结果，先查看加载状态，再刷新或缩小筛选范围 |
| 重载后无样式或图标异常放大 | 曾出现一次样式节点缺失，刷新浏览器后恢复，根因未定位；记录版本与复现步骤，不直接归因为缓存 |

## 依据

下列官方资料是旧版 DSH 0.2.0-rc.2 的历史参考，不据此断言最新上游行为完全相同：

- [官方插件发布与安装说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.zh.md)
- [官方插件管理器：安装、启用与更新限制](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.zh.md)
- [官方 CLI：profile、插件命令与重载](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/cli/README.zh.md)
- [官方包操作实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/boot/plugin-manager/src/operations.ts)
- [项目中文 README](../README.zh.md)
