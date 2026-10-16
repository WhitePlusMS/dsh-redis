/** Validate Redis double text without replacing its original spelling/precision. */
export function isRedisScore(value: string): boolean {
  if (value.length > 128) return false
  return /^[+-]?inf$/u.test(value) || (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value) && Number.isFinite(Number(value)))
}
