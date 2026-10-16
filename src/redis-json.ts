/** Redis validates JSONPath grammar; no command text or legacy-path fallback. */
export function isJsonPath(value: string): boolean {
  return value.startsWith('$') && value.length <= 1024 && !/[\u0000-\u001f\u007f]/u.test(value)
}

/** Actual RedisJSON module TYPE, verified against the pinned Redis fixture. */
export function isRedisJsonType(value: string): boolean { return value === 'ReJSON-RL' }

/** Parsing validates shape only. Keep original serialized bytes; parsed numbers
 * must never be serialized back into the result.
 */
export function jsonMatchCount(bytes: Uint8Array): number {
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  if (!Array.isArray(parsed)) throw new TypeError('Redis JSON reply is not a match array')
  return parsed.length
}
