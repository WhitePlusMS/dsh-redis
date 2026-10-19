import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, RedisSelectionItem, SelectionAck, SetSelectionRequest } from '../domain.ts'

export type SetCurrentSelection = (request: SetSelectionRequest, signal: AbortSignal) => Promise<RemoteResult<SelectionAck>>
const SelectionItem = createContext<((item: RedisSelectionItem | null) => void) | null>(null)

/** Publish identities only. A short debounce combines fast keyboard selections. */
export function CurrentSelection(props: { readonly target: DatabaseTarget; readonly keyBase64: string; readonly publish: SetCurrentSelection; readonly children: ReactNode }) {
  const [item, setItem] = useState<RedisSelectionItem | null>(null)
  const { id, generation, db } = props.target, publish = props.publish, keyBase64 = props.keyBase64
  useEffect(() => {
    const timer = setTimeout(() => { void publish({ target: { id, generation, db }, selection: { keyBase64, item } }, AbortSignal.timeout(5000)).catch(() => undefined) }, 60)
    return () => clearTimeout(timer)
  }, [publish, id, generation, db, keyBase64, item])
  useEffect(() => () => {
    // A keyed owner clears before its replacement publishes. Client entry
    // serializes these RPCs, so a late cleanup cannot erase the new selection.
    void publish({ target: { id, generation, db }, selection: null }, AbortSignal.timeout(5000)).catch(() => undefined)
  }, [publish, id, generation, db, keyBase64])
  return <SelectionItem.Provider value={setItem}>{props.children}</SelectionItem.Provider>
}

/** Row/value bytes remain in their existing views; only raw identity is shared. */
export function useCurrentItem(item: RedisSelectionItem | null): void {
  const publish = useContext(SelectionItem), identity = JSON.stringify(item)
  useEffect(() => { publish?.(item) }, [publish, identity])
}
