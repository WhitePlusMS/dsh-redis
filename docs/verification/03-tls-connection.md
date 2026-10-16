# 03 TLS连接验收

日期：2026-10-16，DSH 0.2.0-rc.2，Node v22.22.1，Redis8.2.6 TLS-only独占实例。未连接用户Redis或更改用户证书库。

- pnpm check：三层严格类型、构建、17项回归通过；两端拒绝私钥、CA路径、关闭验证、额外TLS选项、超长PEM和缺失TLS字段。
- 真实TLS 5组：可信根CA/有效IP SAN成功；持续连接和断开；错误/未知/无效PEM拒绝并释放资源；空CA使用Node默认信任库（新测试进程通过NODE_EXTRA_CA_CERTS加载本次短期根CA）；可信CA签发但DNS身份与目标IP不同，返回独立主机名错误。
- 原生安装包10组：在02流程之上，TLS开关与CA PEM进入真实RPC，错误CA显示固定证书错误，纠正后测试/连接/断开成功；认证失败、状态刷新、密码清空和退出释放依旧通过。
- 实际安装lib与构建逐文件一致，包SHA256 `1a34e7660d23eb274fb4eabb8e85992ee36860edbf109bcf794627b8e5182b86`。截图03-native-tls.png已人工查看。
- TLS服务器只开TLS监听；产品rejectUnauthorized始终true且不覆盖默认checkServerIdentity，DNS目标才设置SNI，不以明文重试。管理员也验证真实证书链/正确身份。
- Host两台和原生一台独占TLS Redis容器、相应短期证书目录、新建Node测试进程、DSH和浏览器均已退出/清理。

证据：03-redis-tls-smoke.json、03-native-tls-smoke.json、03-native-tls.png。复现需要Docker、本机Chrome和含cryptography的REDIS_TEST_PYTHON；Host执行node scripts/smoke-redis-tls.mjs，原生在重新打包SHA路径安装后设置REDIS_SMOKE_CONNECTIONS=1、REDIS_SMOKE_TLS=1运行scripts/smoke-dsh.mjs（另设置DSH_CLI_ENTRY、REDIS_BROWSER_EXECUTABLE）。仅在测试子进程使用短期CA，不改变产品或本机默认信任库。

本票不包含mTLS客户端证书、不提供跳过校验，不证明任意公网服务器或其他平台均已实测。连接保存和数据查看属于后续票。

依据：[Node TLS](https://nodejs.org/docs/latest-v22.x/api/tls.html)、[Redis TLS](https://redis.io/docs/latest/operate/oss_and_stack/management/security/encryption/)及本地锁定node-redis6.2.1 socket源码。
