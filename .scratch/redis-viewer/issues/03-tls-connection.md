# 03: 通过验证服务器身份的 TLS 连接

**What to build:** 用户启用 TLS、配置必要 CA 后连接 Redis，能够分辨证书、主机名或连接失败。

**Blocked by:** 02 手动测试、连接和断开单机 Redis

**Status:** done

**Priority:** P0

- [x] 验证正确 CA、错误 CA、主机名不匹配及正常可信证书链。
- [x] 不提供默认跳过验证路径，不加入 mTLS 客户端私钥功能。
- [x] TLS 失败和断开均清理连接，表单、严格契约、Host 与实际 TLS 验证一致。
- [x] 交付所需的严格类型契约、Host 行为和界面；完成适当类型检查与专项验证，实际证据、未验证范围及改动原因和影响记入更新说明。

## Comments

2026-10-16：4项验收完成。17项回归、Host真实TLS5组和原生UI10组通过，所有测试资源及短期证书已清理。证据见 docs/verification/03-tls-connection.md。
