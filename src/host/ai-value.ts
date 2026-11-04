import type { BytePrefix } from '../domain.ts'

export const MAX_AI_VALUE_BYTES = 4096

/** Decode complete UTF-8 only; binary values retain their original bytes. */
export function aiText(bytes: Buffer): string | null {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
  catch { return null }
}

/** Values may be prefixes, but field and member identities never are. */
export function aiValue(bytes: BytePrefix) {
  const raw = Buffer.from(bytes.base64, 'base64').subarray(0, MAX_AI_VALUE_BYTES)
  return { base64: raw.toString('base64'), text: aiText(raw), byteLength: raw.length, fullByteLength: bytes.fullByteLength, complete: raw.length === bytes.fullByteLength }
}
