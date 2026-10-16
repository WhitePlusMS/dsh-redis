# 24：连接资料整理、URI与导入导出（进行中）

阻塞04已done；当前24 in-progress，01–23 done、25–29 ready，原29票图不变。尚无生产或真实包通过声明。

## 已核实资料与实现边界

现有ProfileChooser独占配置/选择、ConnectionForm独占密码与连接；RedisProfiles按profileContext.dir串行read-modify-write、4MiB文件/50条限制、0600临时文件与rename。当前无导入/导出/URI或分组能力。LUNA仅描述实际文件与位置，根模型据真实源码制定以下最简方案。

- [Redis官方连接URL文档](https://redis.io/docs/latest/develop/clients/connection-urls/)确认redis/rediss、百分号编码凭据和路径DB；查询参数不通用。本插件只解析这套基本形式，拒绝查询/片段等未实现选项，以固定错误反馈，原URI不日志/回显。
- [Node URL官方文档](https://nodejs.org/docs/latest-v20.x/api/url.html)与[node-redis配置](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md)用于核对URL字段解释；实际连接继续既有严格ConnectionRequest，不把URI交给驱动绕过预算/策略。URI /DB只填会话DB草稿，仍需连接后显式Select DB。
- 分组是当前资料的可选字段，缺省含义即未分组；不增加旧版本迁移、旧接口或兼容分支。保存/改名/分组复用原稳定id。
- 可移植资料格式固定format=dsh-redis-connections、version=1，最多50条/256KiB，只允许名称、可选分组、地址/端口/用户名/TLS布尔开关。不接受密码、CA、URI、id/generation或其他字段；导出仅显式白名单，不复制完整settings。TLS CA不随导出，导入后需要手动补填。
- 导入先预览、可改名称/分组并跳过行；同组同名按精确Unicode区分，不规范化。Host在原串行队列内重验容量及全部冲突，整批追加/一次原子写，不覆盖既有项；并发造成的新冲突整批拒绝，无部分写入或自动连接。

## 状态预览

独立prototype/profile-transfer-state分支10ff150b962c997bf8d2bfb02deaa0163136205c，src/client/prototypes/profile-transfer.prototype.html；ignored副本.scratch/artifacts/profile-transfer.prototype.html可双击。纯内存reducer展示重名拒绝/改名/跳过、URI草稿/关闭清密码、分组与无秘密字段导出，三条引导和完整可读状态。无测试/数据库/持久化/浏览器宿主验收，未绕过file://限制，主分支不合HTML壳；预览不等于用户视觉确认。

## 后续验证

先严格DTO/Host原子持久化、纯URI与资料模型，立即三层类型与专项/完整回归，再接现有简洁设置窗口；实际新包需验证URI无秘密回显/配置文件无密码、冲突不部分写、分组与重开、导出文件内容和实际手动选择/连接。通过前四项均不勾选，不借用旧包TLS或源证据。

## 已验证的模型与Host小目标

首批严格Host/Client/tests TypeScript、完整构建及250回归通过，新增12项（4资料、3 URI、4存储和1两端codec），[完整检查原件](artifacts/24-profile-import-export/model-check-console.log)与[首次模型类型检查](artifacts/24-profile-import-export/model-typecheck-console.log)按原字节归档。Client bundle实际严格解码器数量扩为24，Host/Client完整方法顺序同步；实际SDK malformed清单也加入importProfiles，尚未运行新的原生SDK专项。

存储测试验证同组同名/批内重名时全批不写、并发第二批冲突拒绝、排队取消/50条上限不改原文件、重命名/分组稳定id、TLS导入空CA和冷重开；资料测试验证字段白名单、未知/秘密字段拒绝、256KiB UTF-8字节计量及精确Unicode；URI测试验证百分号凭据/IPv6/TLS/DB草稿与错误固定null。原URI解析拒绝点段和非法UTF-16，继续原ConnectionRequest上限。没有产品界面、真实Redis或宿主安装通过声明，四项继续未勾；此独立小目标先本地提交。
