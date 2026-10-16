import { MAX_SCAN_JSON_BYTES, MAX_VALUE_BYTES, type BytePrefix } from '../domain.ts'
import { RedisFrameError } from './resp.ts'

/** Shared collection-cell prefix. The RESP receive cap applies before this
 * projection, and the complete outer JSON page has its own separate budget.
 */
export function valuePrefix(raw: Buffer): BytePrefix {
  if (raw.length > MAX_SCAN_JSON_BYTES) throw new RedisFrameError('oversize')
  const bytes = raw.subarray(0, MAX_VALUE_BYTES)
  return { base64: bytes.toString('base64'), byteLength: bytes.length, fullByteLength: raw.length, suffix: raw.subarray(bytes.length, bytes.length + 3).toString('base64') }
}
