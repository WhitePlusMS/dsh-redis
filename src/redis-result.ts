const utf8 = new TextEncoder()

export function resultFits(text: string, maxBytes: number): boolean {
  return text.length <= maxBytes && utf8.encode(text).byteLength <= maxBytes
}

export function resultRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Treat persisted results as data. Malformed or oversize records cannot become evidence. */
export function parseResultRecord(text: string, maxBytes: number): Record<string, unknown> | null {
  if (!resultFits(text, maxBytes)) return null
  try { return resultRecord(JSON.parse(text)) }
  catch { return null }
}
