# 2026-10-16 不依赖 Docker 的检查记录

用户暂时无法处理 C 盘空间和 Docker，要求继续其他检查。本轮沿用不改代码、不安装升级的边界；没有启动 Redis、DSH 或前后端服务，也没有访问业务 Redis。

## 本轮实际执行结果

| 检查 | 结果 | 范围 |
| --- | --- | --- |
| Host 类型检查 | 通过，退出码 0 | noEmit，关闭 composite/incremental，不生成编译产物或 tsbuildinfo |
| Client 类型检查 | 通过，退出码 0 | 同上 |
| tests 类型检查 | 通过，退出码 0 | 同上，包含所有测试源码的类型 |
| Vitest | 15 个文件、169 项全部通过，退出码 0 | 未执行需要临时 TCP 监听的 redis-transport.test.ts 共 7 项；未执行 build |
| 产品与任务保护 | 169 个文件哈希、29 张任务元数据与复选项均不变 | 包括源码、脚本、测试、lib、根非 Markdown 配置/依赖及固定研究文档 |
| 既有证据解析 | docs/verification 中 29 份 JSON 均可解析，passed 均为 true | 只核对原有记录，不等于本轮重跑这些环境 |

开始时 C 盘可用空间仍为 0，E 盘约 67 GiB。检查命令的 TEMP/TMP 显式指向 `E:\项目demo\dsh-redis\.scratch\runtime\test-temp`。使用已有本地依赖，没有安装操作。

实际命令（在项目根目录执行）：

```powershell
$env:TEMP='E:\项目demo\dsh-redis\.scratch\runtime\test-temp'
$env:TMP=$env:TEMP
node node_modules/typescript/bin/tsc -p tsconfig.host.json --noEmit --composite false --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.client.json --noEmit --composite false --incremental false
node node_modules/typescript/bin/tsc -p tsconfig.tests.json --noEmit --composite false --incremental false
node node_modules/vitest/vitest.mjs run --exclude tests/redis-transport.test.ts
```

这些测试多数直接验证 src；client-bundle.test.ts 使用现有 lib/client.js。没有重建产物，因此本轮测试通过不等于“重新构建与安装包验收通过”。测试中的 Redis connected 文案来自 mock RedisLink，不代表连接真实服务器。

## GEO 已有真实 Redis 记录与缺口

已核对[已有 GEO 机器报告](E:/项目demo/dsh-redis/.scratch/artifacts/geo-smoke.json)，其 8 组检查为 passed，执行于 2026-10-16 04:53（Asia/Shanghai）。环境为固定官方 Redis 8.2.6 镜像文件的 wsl-image 路径；不是 Docker 运行，也不是本轮重跑。报告中两套自建夹具均记录 stopped、certificatesRemoved、fixtureRemoved 为 true。

报告 SHA-256：`84cf5b9057288e01995ba4c054fa99653296a47b15a04c02a72a0268f980f92a`。

该记录覆盖完整成员字节/坐标、235 成员分页、源值及过期时刻不变、权限拒绝、请求/接收预算、目标代次、实际类型/删除竞争、GEOPOS 在自建实例中禁用后返回不可用。当前只确认该报告内容与状态，未重新执行真实读取。

## 安装包一致性检查

现有项目 lib 为 60 个文件，隔离测试 profile 中安装包 lib 为 54 个文件；当前增加 6 个 GEO/共用解码产物，同名文件另有 13 个内容不同，安装侧没有独有文件。测试 profile 路径为 `.scratch/runtime/dsh-home/profiles/web/`。

因此，[13 号 Bitmap 包的 55 组原生验收](E:/项目demo/dsh-redis/docs/verification/13-native-bitmap-smoke.json)只能证明其包 SHA `54a74b0e10e02df51815ca79804fc9ec32a6cf198dfec51c02a8b8f78d1a9a1a`，不能作为当前 GEO 构建的安装或界面通过证据。本轮未更新该测试 profile，也未安装到日常 profile。

## 本轮没有验证的范围

- 需要临时本机 TCP 测试 peer 的 7 项协议回归，未运行；其源码类型检查已通过。
- Docker API 和 C 盘空间问题未修复，也未反复调用不响应的 Docker。
- 未重跑真实 Redis、TLS、DSH 原生界面或当前包安装；未补 GEO 界面验收。
- 未进行稳定正式版迁移、DSH 升级或依赖变更。

任务 14 继续保持 in-progress，01–13 done、15–29 ready-for-agent；29 张原任务的优先级、阻塞边和验收勾选不变。下一次安装验收需使用与验证源码一致的新包，并遵守现行开发版本方案；完整首版仍未完成。
