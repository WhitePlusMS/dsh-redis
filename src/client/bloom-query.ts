import { MAX_BLOOM_ITEM_BYTES } from '../domain.ts'

/** An empty item is valid and distinct from an information-only null request. */
export function bloomItemBase64(mode: 'text' | 'base64', value: string): string {
  if (mode === 'base64') {
    const bytes = atob(value)
    if (bytes.length > MAX_BLOOM_ITEM_BYTES || btoa(bytes) !== value) throw new TypeError('Invalid Bloom item')
    return value
  }
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > MAX_BLOOM_ITEM_BYTES) throw new TypeError('Bloom item too large')
  return btoa(String.fromCharCode(...bytes))
}
