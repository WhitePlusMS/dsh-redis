import { MAX_REDIS_WRITE_BYTES } from '../domain.ts'

export const MAX_WRITE_BASE64 = Math.ceil(MAX_REDIS_WRITE_BYTES / 3) * 4

/** Preserve exact Redis byte identity, including an empty value. */
export function decodeWriteBytes(value: string): Buffer | null {
  if (value.length > MAX_WRITE_BASE64) return null
  const bytes = Buffer.from(value, 'base64')
  return bytes.length <= MAX_REDIS_WRITE_BYTES && bytes.toString('base64') === value ? bytes : null
}
