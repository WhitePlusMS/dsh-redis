import type { ConnectionErrorCode } from './domain.ts'

/** Key state explanations are shared by the sidebar and model results. */
export const keyStateMessages = {
  missing: { zh: 'Key 已不存在或已过期。', en: 'The key no longer exists or has expired.' },
  changed: { zh: 'Key 类型或内容已变化，请刷新。', en: 'The key type or content has changed. Refresh the key.' },
} as const

/** Shared explanations for the sidebar and model-facing tool results. */
export const connectionErrorMessages = {
  auth: { zh: '认证失败，请检查用户名和密码。', en: 'Authentication failed. Check the username and password.' },
  network: { zh: '无法连接 Redis，请检查地址、端口和服务状态。', en: 'Cannot connect to Redis. Check the host, port and server.' },
  timeout: { zh: 'Redis 操作超时。请先刷新连接状态；连接已断开时手动重连，再缩小范围重试。', en: 'Redis operation timed out. Refresh connection status first; reconnect manually if disconnected, then narrow the range and retry.' },
  cancelled: { zh: '已取消等待，Redis 可能仍在处理。请先刷新连接状态，再手动重试。', en: 'Stopped waiting; Redis may still be processing. Refresh connection status before retrying manually.' },
  stale: { zh: '连接已变化，请查看当前状态后重试。', en: 'The connection changed. Check its current state and retry.' },
  'tls-certificate': { zh: 'TLS 证书验证失败，请检查 CA 和证书有效期。', en: 'TLS certificate verification failed. Check the CA and certificate validity.' },
  'tls-hostname': { zh: 'TLS 证书与连接地址不匹配，请检查主机名。', en: 'TLS certificate does not match the connection address. Check the hostname.' },
  permission: { zh: 'Redis 账号无权执行此操作，请检查权限。', en: 'The Redis account is not allowed to perform this operation.' },
  oversize: { zh: 'Redis 请求或回复超出安全读取范围，请缩小范围后重试。', en: 'The Redis request or reply exceeds the safe read limit. Narrow the range and retry.' },
  protocol: { zh: '无法解析 Redis 回复，请检查地址和服务类型。', en: 'Cannot parse the Redis reply. Check the endpoint and service type.' },
  busy: { zh: '读取队列已满。取消后可能仍需等待旧回复结束；请稍候、刷新连接状态后手动重试。', en: 'Read queue is full. Cancelled reads may still be draining replies. Wait, refresh connection status, then retry manually.' },
  database: { zh: 'DB 编号超出服务器允许范围，请选择有效的 DB。', en: 'The DB index is outside the server range. Choose a valid DB.' },
  'type-changed': { zh: 'Key 类型已变化，请刷新。', en: 'The key type changed. Refresh the key.' },
} as const satisfies Record<ConnectionErrorCode, { readonly zh: string; readonly en: string }>
