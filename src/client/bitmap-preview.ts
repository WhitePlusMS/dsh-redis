import type { StringReadResult } from '../domain.ts'

export const MAX_BITMAP_BITS = 4096
export interface BitmapRange { readonly offset: string; readonly count: number }
export interface BitmapRow { readonly offset: string; readonly bits: string }
export interface BitmapWindow {
  readonly offset: string
  readonly count: number
  readonly totalBits: string
  readonly nextOffset: string | null
  readonly rows: readonly BitmapRow[]
}

/** Bit positions remain integer text; only a bounded within-window index becomes
 * a Number. GETRANGE covers at most 513 bytes, even for an unaligned start.
 */
export function bitmapByteRange(range: BitmapRange): { readonly offset: string; readonly count: number } {
  if (!/^(?:0|[1-9]\d{0,18})$/u.test(range.offset) || BigInt(range.offset) > (1n << 63n) - 1n || !Number.isSafeInteger(range.count) || range.count < 1 || range.count > MAX_BITMAP_BITS) throw new TypeError('Invalid bitmap range')
  const offset = BigInt(range.offset)
  return { offset: String(offset / 8n), count: Math.ceil((Number(offset % 8n) + range.count) / 8) }
}

/** Redis numbers bit zero at the first byte's most significant bit. Prefix and
 * suffix bytes belong to UTF-8 formatting and never enter the requested bits.
 * Past EOF is shown as an empty view, not fabricated zero padding or new data.
 */
export function bitmapWindow(value: StringReadResult, range: BitmapRange): BitmapWindow {
  const bytes = bitmapByteRange(range)
  if (value.state !== 'value' || value.metadata?.type !== 'string' || value.metadata.length === null || value.offset !== bytes.offset || value.byteLength > bytes.count) throw new TypeError('Invalid bitmap byte window')
  const raw = Uint8Array.from(atob(value.base64), char => char.charCodeAt(0))
  if (raw.length !== value.byteLength) throw new TypeError('Invalid bitmap bytes')
  const start = BigInt(range.offset), total = BigInt(value.metadata.length) * 8n
  const available = total > start ? total - start : 0n, count = Number(available < BigInt(range.count) ? available : BigInt(range.count))
  const skip = Number(start % 8n)
  if (skip + count > raw.length * 8 && count !== 0) throw new TypeError('Incomplete bitmap byte window')
  let bits = ''
  for (let index = 0; index < count; index++) {
    const position = skip + index, byte = raw[Math.floor(position / 8)]
    if (byte === undefined) throw new TypeError('Missing bitmap byte')
    bits += (byte >> (7 - position % 8)) & 1
  }
  const rows: BitmapRow[] = []
  for (let index = 0; index < bits.length; index += 32) rows.push({ offset: String(start + BigInt(index)), bits: bits.slice(index, index + 32) })
  const end = start + BigInt(count)
  return { offset: range.offset, count, totalBits: String(total), nextOffset: count > 0 && end < total ? String(end) : null, rows }
}
