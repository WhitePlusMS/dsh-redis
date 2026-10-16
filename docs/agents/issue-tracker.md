# Issue tracker: Local Markdown

> 当前执行基线：用户明确选择 `0.2.0-rc.2` 并继续原 29 票实现。宿主、对应源码和配套 SDK 固定该 RC 版，如实标注预发布属性；此前稳定版调查及仅文档检查保留为历史，不作为本次实现的等待条件。

用户于 2026-10-15 选择本地 Markdown；项目根目录为 `E:\项目demo\dsh-redis`。不使用 Git Graph 的仓库或外部 tracker。

## 约定

- 功能目录：`.scratch/redis-viewer/`。
- 正式实现任务：`.scratch/redis-viewer/issues/<NN>-<slug>.md`，两位编号从 01 开始，前置在后继之前。
- 一票一个文件，不用合并文件代替正式任务。
- 顶部保留 `What to build`、`Blocked by`、`Status` 和验收复选项；正文描述用户行为，不锁定具体实现文件路径。
- `Blocked by` 列出编号与标题；无阻塞写 `None (can start immediately)`。编号和优先级不代替阻塞关系。
- 发布使用 `ready-for-agent`；仍有未完成前置的任务不能开工。状态词汇见同目录 `triage-labels.md`。
- 后续讨论追加在任务的 `Comments` 小节，完成时附实际验证证据。
- 用户2026-10-16明确授权：每完成一个验证通过的小目标即提交本地Git；按功能收口并记录证据，不push、不改写历史、不跳过hooks。

## 当前执行前提

核对指定 rc.2 与对应宿主源码/SDK，本机同版不重装。继续全部原 29 票；按已解除阻塞的 P0 优先，稳定版调查保留历史，不阻塞当前目标。

## 当前状态

用户于 2026-10-15 确认草案，29 张正式任务已写入本地 issues：P0 21 张、P1 8 张。任务索引位于功能目录 README；原草案作为已确认拆分记录保留。

2026-10-16：当前按指定 rc.2 继续实现，01–22 done、23 in-progress、24–29 ready-for-agent；历史仅文档检查作为原时点记录保留。

当前进度：01–22 done；23 in-progress（原位聚焦、已读内容搜索与JSON折叠）；24–29 ready-for-agent。22的232回归/25命名空间/87全类型与会话/24工作台证据见docs/verification/22-key-namespaces.md。原29票编号/优先级/依赖不变，23尚未验收。
