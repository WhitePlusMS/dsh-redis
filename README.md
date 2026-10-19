# DSH Redis

DSH 原生右侧栏中的个人 Redis 查看器。当前精简版只保留六种基础类型和日常查看操作，严格只读，支持单机直连及 TLS。

> 按此前明确确认的开发基线，宿主、SDK 和官方源码固定为 `DSH 0.2.0-rc.2`，这是预发布版本。此轮精简不更换宿主基线；此前稳定版调查和原29票记录保留为历史。

## 当前功能

- 连接：地址、端口、可选 ACL 用户名/密码、TLS/CA；手动连接、断开和状态查询。
- 连接资料：本地选择、新建、保存、更新、分组、删除确认与刷新。不保存密码；保存资料不会清空当次密码。
- DB / Key：手动切换 DB；自动分批 SCAN、总数和进度；MATCH 筛选、树/列表、分隔符、定位与键盘导航。
- 数据：String、Hash、List、Set、ZSet、Stream。集合选中一行直接显示同屏详情，滚动到底追加下一批。
- 内容：Text、JSON、Hex、Base64 四种格式，查找、JSON 折叠及复制当前已读内容。
- 刷新：手动刷新、1/5/10/30秒自动刷新、取消和最近读取时间。同一查询刷新保留画面，重新读取已加载批次后替换结果。
- 界面：青色 DB、紫色目录、橘色 Key 的 Phosphor 双色导航，官方 Lucide 操作图标，随 DSH 明暗主题及中英文切换。
- 对话：通过4个官方模型工具复用本会话连接，检索Key、读取六类型及当前选中行；用户明确要求时切DB并同步侧栏。模型服务及宿主工具策略需可用，实际验收状态见下方实施记录。

已删除诊断快照、六种特殊类型专用视图及曲线、URI、资料导入导出、独立测试连接、显式 Base64 解码、DB/Key 选择自动恢复。普通 String 中的 JSON 格式化仍保留；GEO 可看底层 ZSet，Bitmap/HLL 可看底层 String 原始字节。模块专用类型显示不支持。

## 操作

1. 打开 DSH 会话右侧栏的 Redis，点击“选择或新建连接”或连接配置图标。
2. 选择已保存资料，或填写地址、端口、用户名及密码；TLS 与 CA 在折叠区域中。需要保存时填写名称，可选分组，再点保存。
3. 直接点“连接”，成功后关闭窗口并自动加载 DB 0。关闭设置会清空密码；取消未完成的连接会释放所属连接请求。
4. 左侧选择 DB / 目录 / Key，右侧查看数据。Hash 为表格、字段和值三区；List/Set/ZSet 为表格与详情两区；Stream 的消息、字段对和字段/值预览同屏。
5. 使用预览格式下拉、查找和复制图标。范围与服务端筛选按需展开，填写草稿后点应用才读取。
6. 自动刷新为图标开关加间隔下拉，默认关闭。同一 Key 刷新保留选行和未卸载的预览；原选行未包含在本次读取中会提示重新选择。切换 Key/DB/会话、隐藏、取消或读取失败会停止自动刷新。
7. 已连接时仍可编辑、保存、删除其他资料，实际连接身份单独显示。切换服务器前先断开，再选择资料并手动连接。
8. 在同一会话对话中询问“查看当前选中的字段”“查找 `order:*` 的Key”或“切到DB1查看指定Key”。未连接时先手动连接；无需复制数据或生成快照。选行只同步标识，值在工具调用时读取；详见[对话使用说明](E:/项目demo/dsh-redis/docs/AI_READ_USAGE.md)。

资料在同一 DSH profile 内共用；网络连接和读取按会话隔离。连接从 DB 0 开始，不自动恢复以前的 DB/Key。格式选择仅在当前挂载会话内保存。不直接打开 RDB/AOF 文件，不提供 Redis 写入、命令控制台、Cluster、Sentinel 或内置 SSH 隧道。

## 后续任务规划

以下为待开发候选，仅记录规划，尚未进入当前开发排期；当前版本继续保持只读。

- [ ] 可选写入模式：优先支持 Hash 单字段新增、修改，再考虑单字段删除和整个 Key 删除。
- [ ] 当前会话连接临时解锁：默认关闭，由用户手动开启；断开、重连或更换连接后自动关闭，开启开关不等于批准具体变更。
- [ ] 每次变更先预览后确认：展示服务器、DB、Key、字段、修改前后内容及 TTL 影响；AI 只提出待确认操作，用户点击执行后才允许写入。
- [ ] Host 强制校验确认：用户确认只授权对应的单次操作，AI 传入 `confirm: true` 不算人工确认；目标、DB 或待修改数据变化后，旧确认失效，需重新预览确认。
- [ ] 写入能力验证：覆盖未解锁、未确认、取消、重复提交、目标或数据变化等情况，确认读取和现有会话隔离不受影响，再考虑发布。

本候选不包含批量删除、清空 DB、任意命令或脚本执行，也不改变现有只读工具的能力范围。

## 构建与安装

项目目录：`E:\项目demo\dsh-redis`。使用 Node `^22.19.0 || >=24.0.0`、pnpm 11.22.0 和上述 DSH 基线。

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm pack --pack-destination .scratch/artifacts
```

打包再次检查类型、构建和回归。按包的 SHA256 复制为唯一文件名，再安装到目标 web profile，避免同版本复用旧包：

```powershell
dsh plugin --profile web add '<唯一 SHA 包的绝对路径>' --ignore-scripts
```

开发验证使用项目内独立 `DSH_HOME` 与自建 Redis；临时服务验收后关闭。日常安装前备份配置、核对包与安装文件，用户明确要求查看的日常 DSH 保持运行。

## 文档与验证

- [当前功能清单：9 个模块、46 项条目](E:/项目demo/dsh-redis/docs/FEATURE_INVENTORY.md)
- [对话读取实施与验收状态](E:/项目demo/dsh-redis/docs/AI_READ_IMPLEMENTATION.md)
- [本次精简实施与检查点](E:/项目demo/dsh-redis/docs/SLIM_VIEWER_IMPLEMENTATION.md)
- [精简版专项验收](E:/项目demo/dsh-redis/docs/verification/slim-viewer-2026-10-19.md)
- [旧56项操作审查与精简决策](E:/项目demo/dsh-redis/docs/FEATURE_OPERATION_AUDIT.md)
- [参考项目与 RESP 对比](E:/项目demo/dsh-redis/docs/references/DSH_Database_Redis_功能与实现说明.md)
- [开发基线要求](E:/项目demo/dsh-redis/docs/DEVELOPMENT_BASELINE.md)
- [更新说明](E:/项目demo/dsh-redis/UPDATE_LOG.md)

`pnpm check` 覆盖严格类型、构建和单元回归。真实 Redis 与原生 DSH 专项使用 `scripts/smoke-*.mjs`，工具路径和实际结果见本次验收文档；历史29票、12类型和318项回归的报告只对应当时版本。
