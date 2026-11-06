# 文档同步包与独立安装生命周期验收

日期：2026-11-06。打包源码 `15efd5c`，版本 `0.1.1`，DSH `0.2.1-rc.5`。这次只更新交付说明，未修改产品运行代码；文档节点两路独立审查均 0 项发现。

## 包与检查

- 执行 `pnpm pack --pack-destination .scratch/artifacts/delivery-15efd5c`，默认 prepack 完成严格类型、构建与全部 Vitest：**83 个文件 / 682 项通过**，测试阶段 199.01 秒，进程退出 0。
- 归档 SHA-256：`43b11d18ebd1e9b0814b19ff52c9ff4e783ed2ad79974d5d262865154110ddf9`。
- 保留包：`.scratch/artifacts/delivery-15efd5c/dsh-redis-0.1.1-43b11d18ebd1e9b0814b19ff52c9ff4e783ed2ad79974d5d262865154110ddf9.tgz`；同目录 `SHA256SUMS.txt` 记录该文件名及校验值。未发布或推送。
- 逐项读取 tar 内容，137 个文件均在 `package.json.files` 与自动包含的 manifest 范围内；无重复条目、非普通文件或越界路径。除 pnpm 转换后的 package.json 外，136 个文件与源码/构建输出逐字节一致；manifest 仅省略 packageManager 与 scripts.prepack。
- 112 个 `lib/` 文件的集合和内容与日常已安装来源 `622dce6` 的归档完全相同。此证据只说明运行产物未变，不代替新包的实际原生加载或全部场景复验。
- 包内 Markdown/图片引用的 69 个本地目标均存在；源码里的七份主要随包文档另核对 32 个工具名称、16 类记录视图、协议 15 / 20 RPC 一致。远端链接只核对 main 路径在本工作区存在，未声称已推送或网络可访问。
- 白名单仅包含运行产物、说明、静态截图与许可，没有 profile、连接文件、模型凭据、测试运行目录或本次合成数据文件；这是归档路径和当前源码比对，不是任意内容的秘密检测器。

## 独立安装、卸载和重装

使用已安装的官方 CLI，令每条命令的 `DSH_HOME` 指向 `C:/Users/admin/AppData/Local/Temp/dsh-redis-delivery-docs-20261106/isolated-home`，profile 为 `web`。该 home 由 CLI 首次初始化，没有复制日常配置或凭据，没有启动 Host 或连接 Redis。

1. `dsh plugin --profile web add <上述归档>` 退出 0，137 个安装文件逐字节匹配包；`dsh --profile web --dump-config` 退出 0，组合配置包含 `ui-redis` / `dsh-redis`。
2. 在独立 profile 写入合法空资料 `{"version":1,"profiles":[]}`，记录哈希。它仅用于验证文件保留，不是业务连接资料，也没有设置密码。
3. `remove dsh-redis` 退出 0；依赖、bundle 列表条目及 node_modules 包链接消失，重新 dump 的配置无 Redis 条目。空资料字节及 SHA-256 保持不变。
4. 再次 `add` 同一包退出 0，137 文件再次匹配，组合配置恢复 Redis，空资料哈希仍相同。
5. 最后再次 `remove` 退出 0，确认依赖、bundle 和包链接均移除，空资料保留；独立 home 没有 `.credentials.yaml`。保留该空 home 与脱敏验收日志，不删除用户资料。

安装器报告 peer 依赖警告，**不记为 peers check 通过**。这里只验证 CLI 包生命周期、配置组合及空资料保留；没有验证新包的原生界面安装、运行中卸载、真实模型、非空资料/报告/预设保留或其他平台。CLI 成功和 dump-config 成功不等于实际服务启动成功。

## 日常状态与证据

日常 DSH 仍监听 127.0.0.1:3080，PID10476，保留原安装 `622dce6` 的归档；本次没有替换它。新包与其运行产物相同，但随包文档更新尚未安装到日常 profile。整体模型准确性、剩余 UI/并发场景及最终交付仍未完成。

临时证据目录 `C:/Users/admin/AppData/Local/Temp/dsh-redis-delivery-docs-20261106/` 保存完整 pack 日志、包清单及哈希、安装/卸载/重装日志、组合配置、`checks.json`、`archive-verification.json`、`installed-verification.json`、`uninstall-check.json`、`reinstall-check.json`、`cleanup.json`。临时 `verify-archive.py` 从包与源码逐字节校验，没有提取归档或执行其中脚本；旧固定 v0.1.0 路径的验证器未被误用于本包。

本报告和任务/更新日志不在成品文件白名单中；记录本次验收无需再修改归档。下一次修改任何随包文件时，必须重新固定来源和哈希。
