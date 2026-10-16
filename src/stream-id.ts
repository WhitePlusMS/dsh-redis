const MAX_UINT64 = (1n << 64n) - 1n
export const MAX_STREAM_ID = `${MAX_UINT64}-${MAX_UINT64}`

/** Both unsigned-64-bit components remain decimal text across the RPC boundary. */
export function isStreamId(value: string): boolean {
  const match = /^(0|[1-9]\d{0,19})-(0|[1-9]\d{0,19})$/u.exec(value)
  return match !== null && match[0] === value && BigInt(value.slice(0, value.indexOf('-'))) <= MAX_UINT64 && BigInt(value.slice(value.indexOf('-') + 1)) <= MAX_UINT64
}

/** Inputs have already passed isStreamId; compare pairs, never JS numbers. */
export function compareStreamIds(left: string, right: string): number {
  const part = (id: string) => [BigInt(id.slice(0, id.indexOf('-'))), BigInt(id.slice(id.indexOf('-') + 1))] as const
  const a = part(left), b = part(right)
  return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0
}
export function isStreamRange(start: string, end: string): boolean {
  return (start === '-' || isStreamId(start)) && (end === '+' || isStreamId(end)) && (start === '-' || end === '+' || compareStreamIds(start, end) <= 0)
}
export function withinStreamRange(id: string, start: string, end: string): boolean {
  return (start === '-' || compareStreamIds(id, start) >= 0) && (end === '+' || compareStreamIds(id, end) <= 0)
}
