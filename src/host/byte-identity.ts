import type { RedisKey } from '../domain.ts'

/** Display labels are lossy on purpose; only Base64 is used for identity. */
export function byteIdentity(raw: Buffer): RedisKey {
  let label: string
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw)
    label = JSON.stringify(text.slice(0, 160)) + (text.length > 160 ? '…' : '')
  } catch { label = '0x' + raw.subarray(0, 32).toString('hex') + (raw.length > 32 ? '…' : '') }
  return { base64: raw.toString('base64'), byteLength: raw.length, label }
}
