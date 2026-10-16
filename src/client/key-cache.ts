import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES, type RedisKey } from '../domain.ts'

export interface KeyCache { readonly keys: readonly RedisKey[]; readonly bytes: number; readonly limited: boolean }
export const emptyKeyCache = (): KeyCache => ({ keys: [], bytes: 0, limited: false })

/** Deduplicate by bytes, with a cumulative encoded-byte cap as well as a row cap. */
export function appendKeys(previous: KeyCache, incoming: readonly RedisKey[]): KeyCache {
  const keys = new Map(previous.keys.map(key => [key.base64, key]))
  let bytes = previous.bytes
  for (const key of incoming) {
    if (keys.has(key.base64)) continue
    const size = new TextEncoder().encode(JSON.stringify(key)).length
    if (keys.size >= MAX_CACHED_KEYS || bytes + size > MAX_CACHED_KEY_BYTES) return { keys: [...keys.values()], bytes, limited: true }
    keys.set(key.base64, key); bytes += size
  }
  return { keys: [...keys.values()], bytes, limited: previous.limited }
}
