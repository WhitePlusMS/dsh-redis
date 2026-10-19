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
- 重新下载的包是下面两条安装验收的共同来源。不把上传、下载和构建通过等同于安装通过。

## CLI 实际安装

在新建、无用户模型凭据的独立DSH_HOME中，使用官方DSH CLI0.2.0-rc.2，安装从正式Release重新下载的同一个tgz。没有使用跳过脚本或离线参数替代文档中的正常安装方式。

1. `--profile web --dump-config`初始化官方Web profile，不启动Host。
2. `plugin --profile web add <下载包绝对路径>`成功，`plugin --profile web list dsh-redis`列出0.1.0。
3. 安装后的86个文件逐字节匹配正式包；组合配置出现ui-redis。
4. 创建仅含空profiles数组的连接资料，执行CLI卸载；包链接移除，组合配置不再有ui-redis，空连接资料字节不变。
5. finally核对临时home的真实路径和所有权后清理成功；该轮未启动Host、未连接Redis。

机器记录位于忽略目录 `.scratch/artifacts/release-v0.1.0/cli-install.json`。正式Release页面也已通过实际GitHub登录会话打开，确认版本、源码提交、两附件及校验值；未把私有下载链接写成匿名可用。

## DSH 原生界面实际安装

使用另一个全新的独立DSH_HOME，启动官方DSH Web0.2.0-rc.2。没有复制日常profile或模型凭据；模型指向不可连接的本机地址，本轮不发对话请求，也不连接Redis或写入测试Key。

1. 在实际原生页面打开“插件 → 添加插件”，填写正式Release回下载包的Host绝对路径，点击安装。
2. 界面经历“正在检查”后显示“已安装”，安装详情中的真实命令为`pnpm add <下载包绝对路径>`，退出成功。
3. 点击“立即启用”，组合包开关开启；插件详情明确显示`v0.1.0`、“共1个 · 1运行中”，组件为`ui-redis`。
4. 回到隔离会话，打开右侧栏，出现Redis入口；点击后原生查看器正常显示。实际页面中Redis样式节点为1，图标尺寸及布局正常。
5. 打开“选择或新建连接”，核对资料选择、名称、分组、地址、端口、认证、TLS及连接按钮；关闭后返回同一Redis界面，没有点击连接。
6. Host端再次核对安装的86个文件逐字节匹配正式成品；Host日志记录“Read-only Host registered”，无加载错误。

本次使用端口8343的Host及8344的所属控制服务，结束已关闭进程树；两端口无监听，临时home删除成功。日常7198仍在监听，未停止或更新用户原有服务。截图及机器记录保留在忽略目录`.scratch/artifacts/release-v0.1.0/`，包括已安装、版本/运行中、原生侧栏、连接表单及Release附件页面；不收录登录token或业务数据。

### 实测发现及说明

- **文档顺序：** 原安装指南提到安装前的包名/版本预览，本次本地tgz流程没有这一步，而是在安装后插件详情核对。本轮已同步修正main上的双语README和安装指南；v0.1.0 tag与两个已发布附件保持不变，Release说明补充实际核对顺序。
- **pnpm peer提示：** 安装日志出现missing-peer警告，独立profile内`pnpm peers check`返回14项宿主共享包/React缺失。没有为消除静态警告把这些共享服务再装一份。官方运行时在安装scope收集dependencies与peers并提供profile模块解析，浏览器使用shell的共享模块表；本次实际Host注册、组件运行、Client与样式加载均成功。依据为固定版本[profile运行时解析](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/boot/app-boot/src/profile.ts#L357)与[浏览器共享模块](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/modules/README.md#sharing-modules)。不把pnpm静态检查记为通过，也不据此声称所有宿主版本都兼容。
- **验收工具：** 原生会话项的AX名称与DOM角色不同，最初定位未命中；连接表单与后台tab也有同名关闭按钮。改用页面实际暴露的唯一作用域后完成操作，未修改产品来配合验收脚本。

## 最终范围

本次完成私有Release、上传/回下载校验、CLI安装/卸载、原生DSH安装/启用及连接入口验收。没有重新运行真实模型或业务Redis验收，也没有把安装成功当作六种真实业务数据全部通过。先前样式节点缺失问题本次未复现，根因仍未定位，不宣称修复。

收尾核对：Release仍为已发布、private=true，两上传附件ID/大小/digest保持不变，v0.1.0仍指向86eb93b。main已同步界面安装勘误与验收报告，实际GitHub Release页面也显示安装后版本核对和完整验收记录入口；不重新构建或替换已发布包。运行源码、脚本、tests、manifest、锁文件、patch和既有图片相对发布来源无修改，工作树检查通过。

宿主基线仍为Windows、Node.js22.22.1、DSH Web0.2.0-rc.2（预发布）。本轮安装验证不重新执行真实模型/业务Redis读写验收，不修改日常profile、模型或代理配置。
