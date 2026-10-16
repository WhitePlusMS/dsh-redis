# 13 Bitmap 位范围只读查看验收

验证日期2026-10-16。DSH为用户指定0.2.0-rc.2（RC），对应CLI/SDK，Node22.22.1、pnpm11.22.0、独立DSH_HOME/test profile。只证明本票及所列回归，不代表全部29票或其他环境通过。

## 产物与环境

- 包SHA256：`54a74b0e10e02df51815ca79804fc9ec32a6cf198dfec51c02a8b8f78d1a9a1a`；按SHA命名安装，安装lib与构建54文件逐字节一致。两个原生截图已查看。
- 严格Host/Client/tests类型、构建及162项回归通过（Bitmap7项）；真实Redis7组、原生安装包55组通过，包含JSON与全部已有基础类型、TLS/DB回归。
- Redis8.2.6官方固定镜像文件，显式wsl-image执行；image digest ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e，amd64 manifest f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e；未当作Docker验证。

## 实现与行为

1. 从普通String手动点击View as Bitmap，不自动识别业务类型；保留Back to String且返回时重新读取。原生确认二进制String最初仍处于String页，空String也能手动按位查看。没有新增Host方法/RPC或写入口，复用既有String DTO、固定TYPE/PTTL/STRLEN/GETRANGE和目标/超时/取消机制。
2. 位偏移精确字符串/BigInt，0–7位为首字节，最高位偏移0；8位为次字节最高位。当前窗口最多4096位，32位一行，末行按实际位数截取。专项穷举256字节值及全部8种不对齐起点，与独立二进制文本对照；真实BITFIELD_RO GET u1仅作为独占夹具管理员的只读对照，不进入产品命令列表。
3. 位窗口换算最多513原始字节；已有String reader额外读取最多6字节UTF8上下文但不参与位计算。2MiB源值的Bitmap请求实测最大GETRANGE回复519字节，4096位/128行及下一偏移均精确，不展开源String。进入Bitmap前String页仍保留既有最多64KiB首窗；519字节界限专指Bitmap位范围请求，不冒称整个选Key流程只接收519字节。
4. 实际最后一位返回1位，无下一页；空String、EOF及超大整数偏移显示空窗口，不伪造零填充。UI明确说明此处是查看现存位，而非GETBIT越界零填充语义。非法偏移不发请求并保留已提交范围；原生9223372036854775807偏移保持原文。
5. 真实读取前后DUMP、绝对过期时间、SET/SETBIT/BITFIELD/BITOP/GETDEL/GETEX等写命令计数不变。只授予PING/TYPE/PTTL/STRLEN/GETRANGE即可查看；拒绝GETRANGE为permission，SETBIT仍被ACL禁止。原生DUMP与过期时间也不变。
6. 真实DB代次切换后旧窗口为stale、DB1为missing；实际范围回复后源值长度/类型变化或删除均丢弃旧字节。原生删除/转Hash后位表清空。相同长度内容更新仍可能不可检测，读取不宣称原子快照。
7. 窗口转换验收使用同一浏览器纯转换源码与构建Host；原生验收另证明打包后的浏览器实现，二者范围分别记录。取消/10秒截止/权限/旧结果规则来自已验证String reader与本视图AbortController；统一慢请求和多会话恢复仍在19，不将本票普通快速读取冒充慢服务器全链取消验收。

## 清理与证据

测试元组推断TS2345已立即限定只读元组修复，无any/兼容绕过；原生55组首次运行通过。自有Redis、DSH、浏览器全部停止，证书与UUID目录删除，机器报告确认；未操作用户Redis或日常profile。安装的peer提示按隔离profile/官方共享规则后续在发布门禁进一步核对，原生成功不替代依赖审计。

证据：[Redis](13-redis-bitmap-smoke.json)、[原生](13-native-bitmap-smoke.json)、[默认窗口](13-native-bitmap-data.png)、[不对齐范围](13-native-bitmap-range.png)。官方语义：[Bitmap](https://redis.io/docs/latest/develop/data-types/strings/bitmaps/)、[GETRANGE](https://redis.io/docs/latest/commands/getrange/)、[BITPOS位编号](https://redis.io/docs/latest/commands/bitpos/)、[BITFIELD_RO](https://redis.io/docs/latest/commands/bitfield_ro/)。
