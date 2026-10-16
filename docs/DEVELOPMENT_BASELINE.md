# DSH 开发版本、升级与源码基线

> 当前执行基线：用户明确选择 `0.2.0-rc.2` 并继续原 29 票实现。宿主、对应源码和配套 SDK 固定该 RC 版，如实标注预发布属性；此前稳定版调查及仅文档检查保留为历史，不作为本次实现的等待条件。

## 现行要求

当前按用户明确指定的 `0.2.0-rc.2` 实现完整原 29 票，不等待稳定正式版。

- CLI/相关 SDK 固定 rc.2；宿主源码为官方 `dsh-v0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84`。本机 CLI 已同版，不重复安装或自动改用 alpha；桌面核心按实际验证另记。
- Git Graph、Database 保留原样参考副本与来源/SHA/日期/许可，仅在独立项目裁剪必要接入骨架与只读逻辑，既有工作先比较，不整目录覆盖。
- 只适配目标宿主真实 API，不维护旧版兼容。每次变更完成受影响类型、专项、真实 Redis 和原生包验证；历史包证据不冒充当前包通过。
- 原 29 票范围、优先级、依赖保留；当前 01–19 done、20 布局与主题适配 in-progress，其余 9 票 ready-for-agent。测试用独立 profile 和自建 Redis，采用已验证的 wsl-image 路径，不依赖失去响应的 Docker，也不清理用户 C 盘文件。

## 前次仅文档阶段的只读快照（2026-10-16）

| 对象 | 核对结果 | 说明 |
| --- | --- | --- |
| 本机实际 CLI | pnpm 入口 dsh.ps1 返回 `0.2.0-rc.2`；另有 npm 目录入口 | 当前使用 RC，后续先明确实际升级入口 |
| 官方 npm | 33 个版本未见纯 X.Y.Z 稳定号；latest/next 为 `0.2.0-rc.2`，alpha 为 `0.2.1-alpha.4` | latest 不等于稳定正式版 |
| 官方 GitHub Release | API 返回 28 条公开发行，未见非 draft 且非 prerelease 的发行；rc.2 明确为 prerelease | 本轮尚无满足要求的稳定目标，不猜测升级 |
| 项目实际依赖 | DSH 引擎及相关 SDK/peer 仍固定 `0.2.0-rc.2` | 本轮只读检查，未改 manifest/锁文件 |
| 桌面实际运行核心 | 本轮未核实 | 不用 CLI 或外壳版本替代 |
| Git Graph 上游 HEAD | master / `33b3e67a39a429a0ff570d82d7264aab735fc1fd` | git ls-remote 核对，与现有副本一致 |
| Database 上游 HEAD | main / `5d2b900b0317200b1866275c7cf48814fe84b52d` | 同上，未重新复制源码 |

版本查询时间为本机 2026-10-16 04:59（UTC+8）。依据：[官方发行 API](https://api.github.com/repos/deepseek-ai/deepseek-harness/releases?per_page=100)、[官方发行页](https://github.com/deepseek-ai/deepseek-harness/releases)、[npm 完整元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh)、[rc.2 发行页](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)。开工时重新核对，以上不承诺未来版本状态。

## 以后另行迁移稳定版时的参考步骤

下列流程保留为历史方案；当前 rc.2 实现不以稳定版发布为前置。

1. 核实官方最新稳定正式版和安装发行；没有稳定目标时如实记录，保留代码并继续文档准备，不擅自切换 RC/alpha。
2. 记录实际 CLI/桌面核心、命令路径、Node、包管理器和 profile。比较目标，完成必要资料保全及同渠道升级；从原入口复核版本和资料保留情况。
3. 获取该稳定发行对应宿主 tag/commit，以及最新 Git Graph、DSH Database 的独立源码副本，保留原样并登记来源/SHA/日期/许可。
4. 比较现有独立实现，再复制必要 Host/Client、侧栏、Typert、构建骨架和 Redis 读取分支进行裁剪改造；去掉 Git 业务、其他数据源、写入口及不符合预算/只读语义的分支。保留 LICENSE/NOTICE，不带入依赖目录、缓存、私人配置、旧构建物或 Git 元数据。
5. 按稳定宿主官方清单锁定配套依赖，完成严格类型、专项回归、构建及独立 profile 的真实安装/侧栏/RPC验证；记录包哈希、安装文件一致性与实际结果，再继续功能票。
6. 发布前重新核验最新稳定版，目标变更则完成必要升级和受影响复验；仅清理自建测试资源，不停止用户已有服务。

官方宿主源码用于核对插件 API，交付仍是独立 Redis 插件；不复制整个 DSH 宿主开发另一个应用，不修改全局安装目录源码。最新参考如使用超前 API，按目标稳定版调整必要部分，不引入旧版兼容层。

## 保留的 RC 历史基线

| 对象 | 历史锁定值 |
| --- | --- |
| CLI / SDK | `0.2.0-rc.2` |
| 官方宿主源码 | `dsh-v0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84` |
| Node / pnpm | `v22.22.1` / `11.22.0`（既有开发记录） |

原样参考副本位于 `.scratch/upstream/`，来源和 MIT 许可见 THIRD_PARTY_NOTICES.md 与 licenses。已有验收见 docs/verification/，只证明各自记录的环境和包；本轮没有重跑这些验收。

当前进度：01–19 done，20 布局与主题适配 in-progress，其余9票 ready-for-agent；19证据见 docs/verification/19-read-cancellation-recovery.md：225项回归、真实恢复8组与原生18组通过，安装lib70文件一致。18历史完整类型77组失败及各失败报告继续保留，21发布门禁仍需完整重验；29票范围/优先级/依赖不变，完整首版尚未完成。
