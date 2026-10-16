# DSH Redis

> 当前执行基线：用户明确选择 `0.2.0-rc.2` 并继续原 29 票实现。宿主、对应源码和配套 SDK 固定该 RC 版，如实标注预发布属性；此前稳定版调查及仅文档检查保留为历史，不作为本次实现的等待条件。

独立的 DSH 原生右侧栏 Redis 查看器，面向个人使用；首版严格只读，支持单机与 TLS。

项目根目录：`E:\项目demo\dsh-redis`。

当前阶段：按指定 rc.2 继续完整 29 票；01–17 已验收，18 会话浏览状态正在推进。

## 文档入口

- [正式任务索引：21 张 P0、8 张 P1](E:/项目demo/dsh-redis/.scratch/redis-viewer/README.md)
- [开发路线与实施方案](E:/项目demo/dsh-redis/docs/DSH_Redis_开发路线与实施方案.md)
- [已确认的任务拆分记录](E:/项目demo/dsh-redis/docs/TICKET_BREAKDOWN_DRAFT.md)
- [参考项目研究及 RESP.app 对比](E:/项目demo/dsh-redis/docs/references/DSH_Database_Redis_功能与实现说明.md)
- [本地任务跟踪规则](E:/项目demo/dsh-redis/docs/agents/issue-tracker.md)
- [更新说明](E:/项目demo/dsh-redis/UPDATE_LOG.md)

## 首版范围

String、Hash、List、Set、ZSet、Stream，以及 RedisJSON、Bitmap、GEO、HyperLogLog、TimeSeries、Bloom 的专用查看。特殊查看不等于独立 Redis TYPE，扩展能力依目标服务器而定。

基本显示为 Text、JSON、Hex、Binary/Base64 与显式 Base64 解码。连接资料在同一 DSH profile 内共用，浏览选择按会话分离；恢复选择不自动新建连接。

## 当前版本与源码约定

当前按用户明确指定的 `0.2.0-rc.2` 实现完整原 29 票，不等待稳定正式版。

- CLI/相关 SDK 固定 rc.2；宿主源码为官方 `dsh-v0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84`。本机 CLI 已同版，不重复安装或自动改用 alpha；桌面核心按实际验证另记。
- Git Graph、Database 保留原样参考副本与来源/SHA/日期/许可，仅在独立项目裁剪必要接入骨架与只读逻辑，既有工作先比较，不整目录覆盖。
- 只适配目标宿主真实 API，不维护旧版兼容。每次变更完成受影响类型、专项、真实 Redis 和原生包验证；历史包证据不冒充当前包通过。
- 原 29 票范围、优先级、依赖保留；当前 01–17 done、18 会话浏览状态 in-progress，其余 11 票 ready-for-agent。测试用独立 profile 和自建 Redis，采用已验证的 wsl-image 路径，不依赖失去响应的 Docker，也不清理用户 C 盘文件。

## 任务执行

正式任务已写入 `.scratch/redis-viewer/issues/`，一票一文件；使用 `Blocked by` 表示实际前置。优先做已解除阻塞的 P0 任务，不把编号误当作唯一串行顺序。

后续按[开发基线要求](E:/项目demo/dsh-redis/docs/DEVELOPMENT_BASELINE.md)核对指定 rc.2、对应源码/SDK和产物，再继续剩余功能与受影响验收；P2仍为候选。

当前进度：01–17 done，18 会话浏览状态 in-progress，其余11票 ready-for-agent；17证据见 docs/verification/17-bloom-view.md：216项回归、真实reader6组、源语义3组及原生79组通过，安装lib68文件一致。29票范围/优先级/依赖不变，完整首版尚未完成。
