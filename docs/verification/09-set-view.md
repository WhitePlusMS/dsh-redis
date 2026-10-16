# 09 Set 增量成员查看验收

验证日期：2026-10-16。用户指定DSH `0.2.0-rc.2`；仅代表本票与下述固定包，不代表完整首版或所有平台通过。

## 验收环境与产物

- 独立项目测试profile，非用户日常DSH_HOME；Node22.22.1、pnpm11.22.0、DSH CLI/配套SDK精确rc.2。
- Redis8.2.6，官方redis:8.2.6-alpine镜像固定digest ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e，amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e；显式wsl-image夹具执行提取镜像文件，不冒充Docker验收。
- 最终包SHA256：`7912099c2064acbf3a5acf01557cbd7e509d5926083257698c28755e865e9dfa`。以SHA文件名安装，避免同版本本地包缓存；安装lib与当前构建42文件逐字节一致。
- 严格Host/Client/tests类型、构建、110项回归（含Set15项）通过；真实Redis6组及当前安装包原生35组通过。

## 交付行为与证据

1. 选择Set进入成员查看；单次SSCAN、显式继续/刷新/取消，成员以完整Base64身份去重，不由显示文本重建。真实多页231成员、MATCH111/0；原生235成员、二进制/空成员、JSON大整数/指数与显式Base64解码通过。
2. 每次读取固定TYPE/PTTL/SCARD/SSCAN及后置元信息；不发SMEMBERS，不提供SADD/SREM/SPOP或任意命令接口。实际DUMP、绝对过期时刻与相关写命令计数前后不变；仅授权ping/type/pttl/scard/sscan的账号可读，拒绝SSCAN明确为permission，SADD仍被ACL拒绝。
3. 成员完整身份最多64KiB；65537字节成员拒绝整页，不截断为假身份。原始RESP低于1MiB但JSON放大超限的页也整页拒绝且socket仍可用；2MiB成员由有界接收拒绝，仅自身连接关闭，手动重连可恢复。缓存5000成员/2MiB双上限。
4. 单次10秒总预算、旧DB/代次、游标单次令牌/错目标/重放/迟到刷新、空非终止页、取消及会话清理由专项覆盖。实际SSCAN回复之间由夹具管理员改变数量、类型或删除Key时丢弃旧页；原生刷新不显示旧成员。MATCH编辑清空行与选中预览，不自动读取，显式提交后才扫描。
5. 共用扫描Hook及游标解析后的Hash/List/String/TLS/DB原生回归全部通过。截图已查看，235加载数、SCARD总数、完整成员身份及JSON原文数值可见。

## 运行与限制

SSCAN无排序和快照保证，COUNT仅为提示；紧凑编码可一次返回全部。数量相同的成员替换或修改可能发生在元信息检查之间，无法承诺原子快照；刷新以当前服务端返回为准。巨型成员可能在缩小MATCH后仍不能读取，不用截断身份掩盖限制。该票不引入写入、Cluster、其他类型或用户环境兼容承诺。

真实及原生脚本finally均已停止自有Redis/DSH/浏览器，证书与UUID配置目录已删除；未改用户业务数据或日常profile。机器证据：[Redis](09-redis-sets-smoke.json)、[原生](09-native-sets-smoke.json)、[截图](09-native-set-data.png)。
