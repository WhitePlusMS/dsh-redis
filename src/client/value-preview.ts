import type { StringReadResult } from '../domain.ts'

import type { PreviewFormat } from '../domain.ts'
export type { PreviewFormat } from '../domain.ts'
export interface ValuePreview { readonly text: string; readonly error: 'utf8' | 'json' | 'partial-json' | 'base64' | 'limit' | null; readonly contextBytes: number }
type Window = Pick<StringReadResult, 'base64' | 'prefix' | 'suffix' | 'offset' | 'complete'>
export const MAX_PREVIEW_CHARACTERS = 512 * 1024
class PreviewFailure extends Error { constructor(readonly code: NonNullable<ValuePreview['error']>) { super(code) } }
const bytes = (base64: string): Uint8Array => Uint8Array.from(atob(base64), character => character.charCodeAt(0))
const decoder = () => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** Keep the smallest context completing characters that cross a byte window.
 * The text can include those boundary characters; Hex/Base64 remain the exact
 * requested bytes, and the UI explicitly reports any outside-context bytes.
 */
export function decodeTextWindow(value: Pick<Window, 'base64' | 'prefix' | 'suffix'>): { text: string; contextBytes: number } {
  const raw = bytes(value.base64), prefix = bytes(value.prefix), suffix = bytes(value.suffix)
  if (raw.length === 0) return { text: '', contextBytes: 0 }
  for (let before = 0; before <= prefix.length; before++) {
    for (let after = 0; after <= suffix.length; after++) {
      const joined = new Uint8Array(before + raw.length + after)
      joined.set(prefix.subarray(prefix.length - before), 0); joined.set(raw, before); joined.set(suffix.subarray(0, after), before + raw.length)
      try { return { text: decoder().decode(joined), contextBytes: before + after } } catch { /* Try only the bounded outside context; never replace invalid bytes. */ }
    }
  }
  throw new PreviewFailure('utf8')
}

/** JSON.parse checks syntax only. Its values are discarded: all displayed tokens,
 * including integers/exponents/escapes, are copied from the original text.
 */
export function formatJson(source: string): string {
  try { JSON.parse(source) } catch { throw new PreviewFailure('json') }
  const parts: string[] = []
  let size = 0, depth = 0, previous = ''
  const push = (text: string) => { if ((size += text.length) > MAX_PREVIEW_CHARACTERS) throw new PreviewFailure('limit'); parts.push(text) }
  const newline = () => { push('\n' + '  '.repeat(depth)) }
  for (let index = 0; index < source.length;) {
    const character = source[index++]
    if (character === undefined || /[ \t\r\n]/u.test(character)) continue
    if (character === '"') {
      const start = index - 1
      while (index < source.length) { const next = source[index++]; if (next === '\\') index++; else if (next === '"') break }
      push(source.slice(start, index)); previous = 'value'; continue
    }
    if (character === '{' || character === '[') {
      push(character); if (++depth > 64) throw new PreviewFailure('limit')
      const next = source.slice(index).match(/[^ \t\r\n]/u)?.[0]
      if (next !== (character === '{' ? '}' : ']')) newline()
    } else if (character === '}' || character === ']') {
      depth--; if (previous !== (character === '}' ? '{' : '[')) newline(); push(character)
    } else if (character === ',') { push(','); newline() }
    else if (character === ':') push(': ')
    else {
      const start = index - 1
      while (index < source.length && !/[ \t\r\n{}\[\],:]/u.test(source[index] ?? '')) index++
      push(source.slice(start, index))
    }
    previous = character
  }
  return parts.join('')
}

export function previewValue(value: Window, format: PreviewFormat): ValuePreview {
  try {
    const raw = bytes(value.base64)
    if (format === 'base64') return { text: value.base64, error: null, contextBytes: 0 }
    if (format === 'hex') {
      const lines: string[] = []
      for (let index = 0; index < raw.length; index += 16) {
        const offset = (BigInt(value.offset) + BigInt(index)).toString(16).toUpperCase().padStart(8, '0')
        lines.push(offset + '  ' + [...raw.subarray(index, index + 16)].map(byte => byte.toString(16).toUpperCase().padStart(2, '0')).join(' '))
      }
      return { text: lines.join('\n'), error: null, contextBytes: 0 }
    }
    if ((format === 'json' || format === 'decode-json') && !value.complete) throw new PreviewFailure('partial-json')
    let text: string, contextBytes = 0
    if (format === 'decode-text' || format === 'decode-json') {
      let decoded: string
      try {
        const encoded = decoder().decode(raw).replace(/[ \t\r\n]/gu, '')
        decoded = atob(encoded)
        if (btoa(decoded) !== encoded) throw new Error('Non-canonical Base64')
      } catch { throw new PreviewFailure('base64') }
      try { text = decoder().decode(Uint8Array.from(decoded, character => character.charCodeAt(0))) }
      catch { throw new PreviewFailure('utf8') }
    } else {
      const decoded = decodeTextWindow(value)
      text = decoded.text; contextBytes = decoded.contextBytes
    }
    if (format === 'json' || format === 'decode-json') text = formatJson(text)
    if (text.length > MAX_PREVIEW_CHARACTERS) throw new PreviewFailure('limit')
    return { text, error: null, contextBytes }
  } catch (error) { return { text: '', error: error instanceof PreviewFailure ? error.code : 'base64', contextBytes: 0 } }
}
