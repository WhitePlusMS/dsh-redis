# v0.1.0 私有 Release 与安装验收

## 发布来源与成品

- 用户授权：发布v0.1.0，仓库保持私有，上传成品安装包与校验文件，实际验证DSH界面和CLI安装；不包含npm或社区市场发布。
- 源码提交：`86eb93b7b174ce7d8d04260e450d658c4ad52e8d`，main上的发布文档检查点。版本tag将固定在此，不随后续验收记录提交移动。
- 成品：`dsh-redis-0.1.0.tgz`，408868字节。
- SHA-256：`95f18567132ee9d75c212a162b9c332a1ea422b06f1d16a2cd6660d4597245d7`。
- 校验文件：`SHA256SUMS.txt`，一行 `HASH  dsh-redis-0.1.0.tgz`，中间两个空格。

## 本次检查

| 项目 | 结果 |
| --- | --- |
| 冻结依赖 | pnpm11.22.0，`pnpm install --frozen-lockfile`通过，无依赖变更 |
| 默认打包 | `pnpm pack --pack-destination .release/v0.1.0`执行默认prepack，无跳过钩子 |
| 严格类型 | Host、Client、tests三层通过 |
| 全新构建与回归 | 21个文件、205项测试全部通过 |
| 成品内容 | 86个文件，其中62个lib文件，导出入口、patch、图片和许可齐全 |
| 来源一致 | 所有文件逐字节一致；package.json仅有pnpm正常移除的packageManager和scripts.prepack |
| 包内相对链接 | 64处通过，未包含源码、临时profile或node_modules目录 |
| 发布文档 | 6份主文档57处本地引用通过，中英文命令一致，四工具及写入候选保留 |

核包机器可读记录保存在忽略目录 `.release/v0.1.0/package-check.json`。这份记录不包含凭据或业务数据。

## 实际发布与重新下载

- 附注tag `v0.1.0` 已推送，对象为 `fb5a4cdf62535f713ab6d9d430311d9107b55c53`，解引用为上述源码提交。只推送main和该明确tag，未上传其他分支/标签。
- [GitHub Release](https://github.com/WhitePlusMS/dsh-redis/releases/tag/v0.1.0) ID为417629679，已从草稿正式发布；API发布时间为2026-10-19T18:51:03Z，即北京时间2026-10-20 02:51:03。仓库private=true，插件Release为0.1.0，宿主预发布基线另行注明。
- 附件 `dsh-redis-0.1.0.tgz` ID657130934，408868字节；`SHA256SUMS.txt` ID657130975，87字节。GitHub返回的digest均与上传来源一致，未替换同名附件。
- 已通过GitHub官方API重新下载两个正式附件，逐字节匹配上传来源，并用下载的SHA256SUMS.txt重新核对下载成品。认证只在进程内使用；重定向到签名附件域名时不转发GitHub API凭据。
- 重新下载的包是后续两条安装验收的共同来源。此检查点尚未完成原生界面安装，不把上传、下载和构建通过等同于安装通过。

## CLI 实际安装

在新建、无用户模型凭据的独立DSH_HOME中，使用官方DSH CLI0.2.0-rc.2，安装从正式Release重新下载的同一个tgz。没有使用跳过脚本或离线参数替代文档中的正常安装方式。

1. `--profile web --dump-config`初始化官方Web profile，不启动Host。
2. `plugin --profile web add <下载包绝对路径>`成功，`plugin --profile web list dsh-redis`列出0.1.0。
3. 安装后的86个文件逐字节匹配正式包；组合配置出现ui-redis。
4. 创建仅含空profiles数组的连接资料，执行CLI卸载；包链接移除，组合配置不再有ui-redis，空连接资料字节不变。
5. finally核对临时home的真实路径和所有权后清理成功；该轮未启动Host、未连接Redis。

机器记录位于忽略目录 `.scratch/artifacts/release-v0.1.0/cli-install.json`。正式Release页面也已通过实际GitHub登录会话打开，确认版本、源码提交、两附件及校验值；未把私有下载链接写成匿名可用。

宿主基线仍为Windows、Node.js22.22.1、DSH Web0.2.0-rc.2（预发布）。本轮安装验证不重新执行真实模型/业务Redis读写验收，不修改日常profile、模型或代理配置。
