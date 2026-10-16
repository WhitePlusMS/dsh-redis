import type { ConnectionRequest } from './domain.ts'
import { connectionRequestSchema } from './typert.shared.ts'

export const MAX_URI_CHARACTERS = 16 * 1024
export interface ParsedConnectionUri { readonly request: ConnectionRequest; readonly db: number }

/** Parse only the documented basic TCP/TLS form. Never expose URL exceptions,
 * the raw input, or credentials in an error/result intended for display/logging.
 */
export function parseConnectionUri(input: string): ParsedConnectionUri | null {
  if (input.length > MAX_URI_CHARACTERS) return null
  const text = input.trim()
  if (!/^rediss?:\/\/[^/?#]+(?:\/\d*)?$/u.test(text) || /[\s\\\0\u007f]/u.test(text)) return null
  try {
    // Reject malformed UTF-16 rather than silently replacing a credential byte.
    encodeURI(text)
    const url = new URL(text)
    const host = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname
    if (host === '' || (url.pathname !== '' && url.pathname !== '/' && !/^\/\d+$/u.test(url.pathname))) return null
    const db = url.pathname === '' || url.pathname === '/' ? 0 : Number(url.pathname.slice(1))
    if (!Number.isSafeInteger(db) || db < 0 || db > 65535) return null
    const request = connectionRequestSchema.parse({ host, port: url.port === '' ? 6379 : Number(url.port), username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), tls: url.protocol === 'rediss:' ? { caPem: '' } : null })
    return { request, db }
  } catch { return null }
}
