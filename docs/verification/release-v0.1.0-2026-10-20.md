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

## 后续实际结果

本检查点尚未创建tag或Release。后续依次记录上传、重新下载字节核对、独立profile的CLI安装与原生界面安装结果；不能把上面的构建和核包通过视作安装已验收。

宿主基线仍为Windows、Node.js22.22.1、DSH Web0.2.0-rc.2（预发布）。本轮安装验证不重新执行真实模型/业务Redis读写验收，不修改日常profile、模型或代理配置。
