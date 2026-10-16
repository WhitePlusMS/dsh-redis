# DSH Redis 任务索引

> 当前执行基线：用户明确选择 `0.2.0-rc.2` 并继续原 29 票实现。宿主、对应源码和配套 SDK 固定该 RC 版，如实标注预发布属性；此前稳定版调查及仅文档检查保留为历史，不作为本次实现的等待条件。

> 更新2026-10-16：当前继续指定 rc.2 的完整 29 票；01–17 已验收，18 会话浏览状态推进，按实际证据更新完成状态。

## 当前起点

现有任务状态为 01–17 done、18 in-progress、19–29 ready-for-agent，验收各自对应原 RC 环境与包。当前继续原功能票，继续 18 会话浏览状态实现，不改写历史包结果；版本按实施方案第 2.4 节指定 rc.2。完整首版仍未完成。

## 当前版本与源码约定

当前按用户明确指定的 `0.2.0-rc.2` 实现完整原 29 票，不等待稳定正式版。

- CLI/相关 SDK 固定 rc.2；宿主源码为官方 `dsh-v0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84`。本机 CLI 已同版，不重复安装或自动改用 alpha；桌面核心按实际验证另记。
- Git Graph、Database 保留原样参考副本与来源/SHA/日期/许可，仅在独立项目裁剪必要接入骨架与只读逻辑，既有工作先比较，不整目录覆盖。
- 只适配目标宿主真实 API，不维护旧版兼容。每次变更完成受影响类型、专项、真实 Redis 和原生包验证；历史包证据不冒充当前包通过。
- 原 29 票范围、优先级、依赖保留；当前 01–17 done、18 会话浏览状态 in-progress，其余 11 票 ready-for-agent。测试用独立 profile 和自建 Redis，采用已验证的 wsl-image 路径，不依赖失去响应的 Docker，也不清理用户 C 盘文件。

## 任务清单

| 编号 | 优先级 | 任务 | Blocked by | 状态 |
| --- | --- | --- | --- | --- |
| 01 | P0 | [在独立 DSH 侧栏看到插件状态](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/01-native-sidebar.md) | 无 | done |
| 02 | P0 | [手动测试、连接和断开单机 Redis](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/02-standalone-connection.md) | 01 | done |
| 03 | P0 | [通过验证服务器身份的 TLS 连接](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/03-tls-connection.md) | 02 | done |
| 04 | P0 | [保存和重新选择个人连接配置](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/04-saved-profiles.md) | 03 | done |
| 05 | P0 | [选择 DB 并增量检索 Key](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/05-db-key-browser.md) | 02 | done |
| 06 | P0 | [查看 String 的元信息和四种基础格式](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/06-string-preview.md) | 05 | done |
| 07 | P0 | [分页查看 Hash 字段和值](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/07-hash-view.md) | 06 | done |
| 08 | P0 | [按原始索引查看 List](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/08-list-view.md) | 07 | done |
| 09 | P0 | [增量查看 Set 成员](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/09-set-view.md) | 07 | done |
| 10 | P0 | [查看 ZSet 成员与分数](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/10-zset-view.md) | 07 | done |
| 11 | P0 | [按消息 ID 查看 Stream](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/11-stream-view.md) | 07 | done |
| 12 | P0 | [查看 RedisJSON 根值和指定路径](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/12-redis-json.md) | 06 | done |
| 13 | P0 | [按位偏移查看 Bitmap](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/13-bitmap-view.md) | 06 | done |
| 14 | P0 | [从 ZSet 切换查看 GEO 坐标](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/14-geo-view.md) | 10 | done |
| 15 | P0 | [只读查看 HyperLogLog 估算数量](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/15-hll-count.md) | 06 | done |
| 16 | P0 | [按时间范围查看 TimeSeries 样本](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/16-timeseries-view.md) | 07 | done |
| 17 | P0 | [查看 Bloom 信息和成员存在性](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/17-bloom-view.md) | 06 | done |
| 18 | P0 | [按 DSH 会话恢复各自的浏览状态](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/18-session-browsing-state.md) | 04、06 | in-progress |
| 19 | P0 | [取消读取并从超时或断线中恢复](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/19-read-cancellation-recovery.md) | 18 | ready-for-agent |
| 20 | P0 | [在窄宽侧栏和两种主题下完成查看](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/20-sidebar-layout-themes.md) | 07 | ready-for-agent |
| 21 | P0 | [从安装包完成只读首版的真实验收](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/21-release-verification.md) | 08、09、11、12、13、14、15、16、17、19、20 | ready-for-agent |
| 22 | P1 | [按命名空间浏览大量 Key](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/22-key-namespaces.md) | 06 | ready-for-agent |
| 23 | P1 | [聚焦详情并搜索、折叠已读内容](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/23-focused-value-view.md) | 20 | ready-for-agent |
| 24 | P1 | [整理、导入和导出连接资料](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/24-profile-import-export.md) | 04 | ready-for-agent |
| 25 | P1 | [查看 Redis 服务器概览快照](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/25-server-overview.md) | 06 | ready-for-agent |
| 26 | P1 | [查看有界的慢日志快照](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/26-slowlog-view.md) | 07 | ready-for-agent |
| 27 | P1 | [查看有界的客户端连接快照](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/27-client-list.md) | 07 | ready-for-agent |
| 28 | P1 | [受控自动刷新当前选中 Key](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/28-key-auto-refresh.md) | 19 | ready-for-agent |
| 29 | P1 | [把已读取的 TimeSeries 样本显示为曲线](E:/项目demo/dsh-redis/.scratch/redis-viewer/issues/29-timeseries-chart.md) | 16 | ready-for-agent |

## 执行前沿与里程碑

- 起点只有 01；01 完成后进入 02。
- 02 后，03（TLS）与 05（DB/Key）技术上可分别推进。
- 03 后可以做 04；05 后做 06，至此可演示连接、检索和 String 查看。
- 06 后可以分别推进 07、12、13、15、17；04 与 06 都完成后可做 18。
- 07 后可做 08、09、10、11、16、20；10 后可做 14；18 后可做 19。
- P0 发布票 21 的直接阻塞是 08、09、11、12、13、14、15、16、17、19、20；这些叶节点的传递依赖覆盖 01–20，没有重复写入全部上游。
- P1 22–29 的边表示实际技术前置，优先级仍低于 P0。

| 里程碑 | 对应任务 | 用户能检查的结果 |
| --- | --- | --- |
| M1 | 01 | DSH 独立 Redis 页签与 Host 状态 |
| M2 | 02–04 | 手动直连、TLS、连接资料保存和重开 |
| M3 | 05–06 | 选择 DB、检索 Key、查看 String 与格式 |
| M4 | 07–17 | 12 类查看器及各自语义证据 |
| M5 | 18–21 | 会话/取消/布局完整并有真实安装包验收 |

## 上下文

- [范围与共同约束](E:/项目demo/dsh-redis/.scratch/redis-viewer/spec.md)
- [开发路线](E:/项目demo/dsh-redis/docs/DSH_Redis_开发路线与实施方案.md)
- [已确认的拆分记录](E:/项目demo/dsh-redis/docs/TICKET_BREAKDOWN_DRAFT.md)

当前进度：01–17 done，18 会话浏览状态 in-progress，其余11票 ready-for-agent；17证据见 docs/verification/17-bloom-view.md：216项回归、真实reader6组、源语义3组及原生79组通过，安装lib68文件一致。29票范围/优先级/依赖不变，完整首版尚未完成。
