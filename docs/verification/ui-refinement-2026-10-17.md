# Redis 界面细节验收（2026-10-17）

本轮落实用户实际查看后的四项要求：原创导航图标/配色、字段详情不使用底部面板、详情样式整理及连接配置美化。保留左右两区、rc.2 原生页签、单机只读与原有连接/数据 DTO。没有新增依赖或 Host 命令，也没有执行网页端 GPT 评审。

## 修改内容

| 文件 | 修改原因与实际影响 |
| --- | --- |
| `src/client/Icon.tsx`、`styles.ts` | 自绘分区 DB、分组目录、数据标签，分别使用青绿、灰蓝和淡紫；轻量青绿选中背景与进度替换原红黄图标/实心蓝选中。不引入外部图标素材。 |
| `KeyCatalog.tsx` | 分隔符设置移到目录栏内，应用后关闭，说明折叠；原 UTF-8 校验、字节身份和分组操作不变。 |
| 新增 `DetailPage.tsx` | 在已有右侧内容区提供标题和返回按钮，打开时聚焦返回入口；返回后只在原触发元素仍连接且可见时恢复焦点，不抢其他 Key/会话的焦点。 |
| `HashView.tsx`、`ListView.tsx`、`SetView.tsx`、`ZSetView.tsx`、`StreamView.tsx` | 复用同一详情页，表格保留挂载；字段/成员身份信息折叠。Stream 提供消息列表→字段表→字段/值详情的逐级返回。 |
| `CollectionTable.tsx` | 详情期间暂停底部观察器；显式保留本表的纵横滚动，返回时恢复；不改变已开始请求的旧结果隔离、缓存与游标规则。 |
| `ProfileChooser.tsx` | 原生连接 dialog 增加标题、简述、资料侧栏/连接编辑区与底部折叠传输；窄窗口通过媒体规则转单列，保持标签和错误状态。 |
| `ConnectionForm.tsx` | 服务器/认证/TLS 分组，突出连接动作；已连接时说明先断开再编辑，两个断开入口共用原有逻辑。密码仍在成功/关闭时清空，选择资料仍不连接。 |
| `locales.ts`、`README.md` | 中英文返回入口与分组说明；更正自动 Key 扫描和排序的遗留帮助文案，更新实际操作方法。 |
| `docs/UI_REFINEMENT_PLAN.md`、`UPDATE_LOG.md` | 跟踪本轮用户要求、每个修改步骤、验证边界和本地提交。 |

交互原型只用内存示例，归档于 `prototype/redis-ui-polish`（8206238）；正式包不包含原型或切换工具栏。

## 实际验证

- 完整 `pnpm check` / 默认 `pnpm pack` 门禁通过：Host、Client、tests 严格类型，构建和 32 文件 / 318 项回归。原始打包检查见 [build-and-tests.log](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/build-and-tests.log)。
- 交互候选 SHA256 `6d3b5be677659c564b48d4a008bdce0e96fc140c080bfb34047274ee4aa2a44f` 在独立 profile、官方 Redis 8.2.6 WSL fixture 上通过 16 项 `cua_repl` 原生专项，见 [native-ui-report.json](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/native-ui-report.json)。
- Hash 通过实际鼠标点击，返回前后 `scrollTop=2272`，焦点回到原字段；语义点击工具本身可能先定位行，报告单独保留该观察，没有把点击前的工具自动定位误认为产品返回行为。
- 详情是静态文档流内的独立区域，打开后表格不可见且 `data-auto-page=false`；二进制字段 `/wA=` 的 Hex 为 `FF 00`。Set/List/ZSet 返回、Stream 两级返回及元信息切换均通过。
- 窄原生侧栏实际 467.56 px：左侧 155 px、右侧 312.56 px，没有区域重叠或根外溢。明暗主题与中文连接框实际核对；浅色 dialog 宽740 px、内容宽/滚动宽均738 px，连接中字段禁用、断开后可编辑，关闭清密码。
- 目录设置实测 `position:static`，其底边与列表顶边一致，不覆盖树或详情。浅色 DB/目录/Key 的颜色分别为 `rgb(57,126,114)`、`rgb(90,124,159)`、`rgb(121,112,150)`。
- 自有 Redis DB0 760 Key 自动加载完成；7 种夹具集合的 DUMP 前后逐字节一致。两轮自有 DSH/Redis 均停止，新 fixture 按所有权删除；原两个受限目录未触碰。最终清理记录见 [cleanup.json](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/cleanup.json)。

本轮 TLS 仅核对表单展开/收起，未重跑真实 TLS 握手；Host/TLS 代码未变。没有把原29项 RESP 全流程或原29票的历史结果记作本轮重跑。交互候选之后仅缩短并更正了两条中英帮助文案，最终包另做类型/打包、逐文件安装与日常显示核对；16项行为专项保留自己的候选 SHA。

## 本机截图

全部来自隔离合成数据，不包含用户业务 Key/值或密码。

- [中文暗色连接配置](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/connection-dark-zh.png)
- [中文浅色连接配置](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/connection-light-zh.png)
- [中文暗色字段详情](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/detail-dark-zh.png)
- [窄侧栏字段详情](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/detail-narrow-dark-zh.png)

## 日常安装

- 最终包 SHA256：`61d18726a59c7e35500f33256f62faa2a571f2a72b2fa724f73d186f9422aabd`。更正帮助后再次通过默认 prepack 严格类型/构建/318回归；使用唯一 SHA 文件名，隔离安装与日常安装的97包文件、88lib、12Host peers和2依赖均核对通过。最终 [package-manifest.json](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/package-manifest.json) 与交互候选 [candidate-package-manifest.json](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/candidate-package-manifest.json) 分开保存。
- 先备份原 web profile 五份清单到 `.scratch/runtime/daily-ui-refinement-1ef8f286-0732-4ec6-8b98-96bf090148b9/backup`，确认7198旧进程所属后停止并通过官方 plugin add 更新。命令实际 exit0；仅 `package.json`、`pnpm-lock.yaml` 的 Redis 包引用变化，其他依赖、启用 bundles 与 Cordis 配置保持不变。
- 隐藏启动日常 DSH，PID35240，原 `http://127.0.0.1:7198/`。实际中文暗色配置含服务器/认证分组，未输入密码，恢复原127.0.0.1:6379连接；DB0自动760/760、100%完成、0继续按钮，原创图标和更正的帮助均已在实际页面核对。
- 在用户既有真实 Key 中实际打开字段详情：`data-cell-open=true`，有“返回表格”，`position:static`；只记录行为和计数，业务 Key/值及截图留在忽略目录，不入Git。日常页面已保留供用户操作，临时测试服务全部停止。
- 无秘密安装及UI结果见 [daily-install.json](E:/项目demo/dsh-redis/docs/verification/artifacts/ui-refinement/daily-install.json)。CLI启动认证URL、用户配置备份和业务截图不归档到版本库。
