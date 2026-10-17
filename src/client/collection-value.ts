import type { BytePrefix } from '../domain.ts'
import { previewValue } from './value-preview.ts'

/** Cell labels are bounded display text; requests never reconstruct bytes from them. */
export function prefixWindow(value: BytePrefix) { return { ...value, offset: '0', prefix: '', complete: value.byteLength === value.fullByteLength } }
export function prefixLabel(value: BytePrefix): string {
  const preview = previewValue(prefixWindow(value), 'text')
  return preview.error === null ? JSON.stringify(preview.text.slice(0, 120)) + (preview.text.length > 120 ? '…' : '') : 'Base64: ' + value.base64.slice(0, 48) + (value.base64.length > 48 ? '…' : '')
}

/** Strip only display quotes; escaped controls remain visible, identity stays raw Base64. */
export function displayLabel(label: string): string {
  return label.startsWith('"') && label.endsWith('"') ? label.slice(1, -1) : label
}

/** Human-readable cell text without JSON-encoding quotes a second time.
 * React renders text safely; control characters stay visibly escaped.
 */
export function cellLabel(value: BytePrefix): string {
  const preview = previewValue(prefixWindow(value), 'text')
  if (preview.error !== null) return prefixLabel(value)
  return preview.text.slice(0, 160).replace(/[\u0000-\u001f\u007f]/gu, char => JSON.stringify(char).slice(1, -1)) + (preview.text.length > 160 ? '…' : '')
}
