import type { StreamMessage } from '../domain.ts'
import { appendRows, type RowCache } from './row-cache.ts'

export type StreamCache = Omit<RowCache<StreamMessage>, 'rows'> & { readonly messages: readonly StreamMessage[] }
export const emptyStreamCache = (): StreamCache => ({ messages: [], bytes: 0, limited: false })

export function appendStreamMessages(previous: StreamCache, incoming: readonly StreamMessage[]): StreamCache {
  const { rows, bytes, limited } = appendRows({ ...previous, rows: previous.messages }, incoming, row => row.id)
  return { messages: rows, bytes, limited }
}
