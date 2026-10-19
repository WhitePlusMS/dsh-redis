# DSH Redis 安装、更新与卸载

[English](INSTALLATION.md) | 简体中文

本文对应本地构建的 `dsh-redis@0.1.0`。目前不声明已经公开发布、上架注册表或提供 Release 下载地址。使用维护者交付的成品 `.tgz`，或从当前源码构建。

## 适用环境

| 项目 | 当前基线 |
| --- | --- |
| 宿主 | DeepSeek Harness Web `0.2.0-rc.2` |
| 实际验证的平台 | Windows、Node.js `22.22.1` |
| 声明的 Node.js 范围 | `^22.19.0 || >=24.0.0` |
| 构建工具 | pnpm `11.22.0` |
| 插件包 | `dsh-redis@0.1.0`，本地开发版本 |

`0.2.0-rc.2` 是预发布版本；这里记录实际验证的基线，不把它称为最新稳定版。本插件尚未完成 Desktop、macOS、Linux 安装验收，不能仅凭 Web Client 声明推断 Desktop 可用。

先确认浏览器正在使用哪个 DSH profile。下列命令以**已经存在的 `web` profile** 为例，沿用它原来的 `DSH_HOME` 和 CLI 安装位置。另建一个 home 并不能更新当前运行的实例。独立 npm CLI 也不能管理保留给桌面端的 `desktop` profile。

## 准备成品包

已经拿到经过核对的 `.tgz` 时，可以跳过构建，直接把它在 Host 上的绝对路径交给插件管理器。

从包含 `package.json` 的源码根目录，在 PowerShell 执行：

```powershell
node --version
pnpm --version
dsh --version
pnpm install --frozen-lockfile
pnpm pack --pack-destination .release

$packagePath = (Resolve-Path -LiteralPath '.release\dsh-redis-0.1.0.tgz').Path
$sha256 = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
$packageForInstall = Join-Path (Split-Path -Parent $packagePath) ("dsh-redis-0.1.0-{0}.tgz" -f $sha256)
Copy-Item -LiteralPath $packagePath -Destination $packageForInstall
$packageForInstall
```

`pnpm pack` 会执行 `prepack`：严格类型检查、全新构建和单元回归，不要跳过这个钩子。SHA 文件名用于区分同为 `0.1.0` 的不同开发包；复制改名不会改变包的内容。只要 profile 的依赖清单和锁文件仍引用这个本地包，就保留它所在的路径。

本地计算 SHA256 可以标识手里的文件；接收别人交付的包时，还应与该可信来源提供的校验值核对。自行算出一个新值本身不能证明文件来源。

## 从 DSH 界面安装

1. 打开 DSH 的**插件 → 添加插件**。
2. 填入成品包绝对路径。按上述步骤构建时，使用最后输出的 `$packageForInstall` 路径。
3. 确认预览中的包名为 `dsh-redis`、版本符合预期，再安装。
4. 完成后选择**立即启用**。直接关闭成功窗口会让新组合包保持关闭。
5. 打开一个对话，在右侧栏选择 **Redis**。profile 不支持热重载时，按 DSH 的提示重启原 Host。

本地路径由 **DSH Host 所在电脑**解析。浏览器和 Host 分处两台电脑时，填写浏览器电脑上的路径不会上传文件，应先把包传到 Host。

DSH 支持包名、URL 和本地包等来源；本项目目前提供本地成品包步骤，没有把尚未发布的注册表名称或虚构 GitHub 地址当作下载入口。

## 从 CLI 安装

在上面的同一个 PowerShell 会话中，确认仍是目标 `web` profile 和原来的 `DSH_HOME`：

```powershell
dsh plugin --profile web add $packageForInstall --ignore-scripts
dsh plugin --profile web list dsh-redis
```

成品包已包含 `lib/`，安装时不需要编译本插件。`--ignore-scripts` 作用于安装阶段，不会跳过前面打包时的 `prepack` 检查。解析运行依赖仍可能需要联网。

安装后在**插件**页面核对组合包，若未启用则手动开启。不支持热重载的 profile，需要按原方式重启 Host 后才会使用新依赖；Host 加载完成后再刷新浏览器。

也可以只打印组合配置，不启动服务：

```powershell
dsh --profile web --dump-config
```

Redis 的 Host 条目是 `ui-redis`，由 `dsh-redis` 组合包提供。pnpm 能列出包，不代表组合包和客户端已经激活。完整配置可能包含其他 profile 信息，不应直接作为公开报错附件。

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
2. 构建或取得新包，核对校验值。开发期间即使版本号没变，也使用新的 SHA 文件名。
3. 在**插件**中关闭、卸载 DSH Redis。没有热重载时，按 DSH 要求先通过原来的正常方式停止该 profile 的 Host。
4. 安装新包，启用组合包；需要时重启同一个 profile，再刷新浏览器。
5. 重新手动连接，核对 DB、Key 列表与值预览。使用 AI 工具时，再在同一个对话中检查读取。

CLI 对应步骤如下，其中 `$packageForInstall` 是新包路径：

```powershell
dsh plugin --profile web remove dsh-redis
dsh plugin --profile web add $packageForInstall --ignore-scripts
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

插件不另设模型 API Key：侧栏查看使用 Redis 连接，对话使用 DSH 已配置的模型。不直接打开 RDB/AOF 文件，也不提供诊断快照导出。

## 停用、卸载与清理资料

- **停用：**在**插件**中关闭 DSH Redis 组合包。Host 实际卸载插件后会释放其连接和 reader；没有热重载时可能需要重启。
- **卸载：**使用插件管理器的卸载操作，或先停止目标 profile，再执行 `dsh plugin --profile web remove dsh-redis`。按要求重载或重启，才会让正在运行的 Host 释放旧插件。
- **保留资料：**卸载会移除包依赖和组合包选择，不会删除 `data/dsh-redis/connections.json`。同 profile 重新安装后可复用已保存资料，密码需重新输入，连接需手动发起。
- **删除资料：**可在连接选择器删除单条资料。需要彻底清理时，先卸载运行中的插件，按需备份并仅删除这个插件所属的连接文件，不要删除整个 DSH home 或 profile。

停用、卸载不会删除 Redis Key 或模型服务配置。已有对话记录由 DSH 管理，卸载本插件不会清除历史工具结果。

## 常见问题

| 现象 | 检查方法 |
| --- | --- |
| 安装后没有 Redis 入口 | 目标 profile、组合包开关、Host 重载或重启、浏览器刷新及 Host 诊断 |
| DSH 提示版本不兼容 | 使用已验证的 `0.2.0-rc.2` 基线，不把强制版本豁免当作兼容性验证 |
| 无法连接 | Host 到 Redis 的网络、端口、ACL、TLS、CA，以及实际返回的错误 |
| 换对话后看不到连接 | 回到手动连接的对话；网络连接按会话隔离 |
| 加载数量小于 DB 总数 | MATCH 筛选和有上限的扫描可能只返回部分结果，先查看加载状态，再刷新或缩小筛选范围 |
| 重载后无样式或图标异常放大 | 曾出现一次样式节点缺失，刷新浏览器后恢复，根因未定位；记录版本与复现步骤，不直接归因为缓存 |

## 依据

下列官方资料固定在已验证的 DSH 版本，不据此断言最新上游行为完全相同：

- [官方插件发布与安装说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.zh.md)
- [官方插件管理器：安装、启用与更新限制](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-plugin-manager/README.zh.md)
- [官方 CLI：profile、插件命令与重载](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/cli/README.zh.md)
- [官方包操作实现](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/boot/plugin-manager/src/operations.ts)
- [项目中文 README](../README.zh.md)
