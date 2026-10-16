import type { BytePrefix } from '../domain.ts'
import { previewValue } from './value-preview.ts'

/** Cell labels are bounded display text; requests never reconstruct bytes from them. */
export function prefixWindow(value: BytePrefix) { return { ...value, offset: '0', prefix: '', complete: value.byteLength === value.fullByteLength } }
export function prefixLabel(value: BytePrefix): string {
  const preview = previewValue(prefixWindow(value), 'text')
  return preview.error === null ? JSON.stringify(preview.text.slice(0, 120)) + (preview.text.length > 120 ? '…' : '') : 'Base64: ' + value.base64.slice(0, 48) + (value.base64.length > 48 ? '…' : '')
}
