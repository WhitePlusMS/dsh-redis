import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES, type StreamMessage } from '../domain.ts'

export interface StreamCache { readonly messages: readonly StreamMessage[]; readonly bytes: number; readonly limited: boolean }
export const emptyStreamCache = (): StreamCache => ({ messages: [], bytes: 0, limited: false })

/** Message IDs identify rows; field occurrences remain inside the ordered array. */
export function appendStreamMessages(previous: StreamCache, incoming: readonly StreamMessage[]): StreamCache {
  const messages = new Map(previous.messages.map(message => [message.id, message]))
  const size = (message: StreamMessage): number => new TextEncoder().encode(JSON.stringify(message)).length
  let bytes = previous.bytes
  for (const message of incoming) {
    const old = messages.get(message.id), nextBytes = bytes - (old === undefined ? 0 : size(old)) + size(message)
    if ((old === undefined && messages.size >= MAX_CACHED_KEYS) || nextBytes > MAX_CACHED_KEY_BYTES) return { messages: [...messages.values()], bytes, limited: true }
    messages.set(message.id, message); bytes = nextBytes
  }
  return { messages: [...messages.values()], bytes, limited: previous.limited }
}
