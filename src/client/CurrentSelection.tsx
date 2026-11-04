import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { DatabaseTarget, RedisSelectionItem, SelectionAck, SetSelectionRequest } from '../domain.ts'
import { SelectionEpochContext } from './SelectionEpochContext.ts'
import { RefreshVisibility } from './AutoRefresh.tsx'

export type SetCurrentSelection = (request: SetSelectionRequest, signal: AbortSignal) => Promise<RemoteResult<SelectionAck>>
const SelectionItem = createContext<((item: RedisSelectionItem | null) => void) | null>(null)
const SelectionAction = createContext<{ readonly active: boolean; readonly hold: (id: string) => void; readonly release: (id: string) => void } | null>(null)
export function useSelectionAction() { return useContext(SelectionAction) }

/** Publish identities only. A short debounce combines fast keyboard selections. */
export function CurrentSelection(props: { readonly target: DatabaseTarget; readonly keyBase64: string; readonly publish: SetCurrentSelection; readonly revision: number; readonly suspended: boolean; readonly children: ReactNode }) {
  const [item, setItem] = useState<RedisSelectionItem | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  const heldRef = useRef<string | null>(null)
  const epoch = useContext(SelectionEpochContext)
  const visibility = useContext(RefreshVisibility)
  const { id, generation, db } = props.target, publish = props.publish, keyBase64 = props.keyBase64
  useEffect(() => {
    if (held !== null || props.suspended || visibility?.visible === false || visibility?.signal.aborted || document.visibilityState !== 'visible') return
    const revision = epoch?.snapshot().revision
    let active = true
    const timer = setTimeout(() => { if (heldRef.current !== null) return; void publish({ target: { id, generation, db }, selection: { keyBase64, item } }, AbortSignal.timeout(5000)).then(result => {
      if (active && !visibility?.signal.aborted && result.ok && result.value.accepted && revision !== undefined) epoch?.synchronize(revision)
      else if (active && revision !== undefined) epoch?.fail(revision)
    }).catch(() => { if (active && revision !== undefined) epoch?.fail(revision) }) }, 60)
    return () => { active = false; clearTimeout(timer) }
  }, [publish, id, generation, db, keyBase64, item, epoch, props.revision, props.suspended, held, visibility?.visible, visibility?.signal])
  return <SelectionAction.Provider value={{ active: !props.suspended && visibility?.visible !== false && !visibility?.signal.aborted, hold: id => { heldRef.current = id; setHeld(id) }, release: id => { if (heldRef.current === id) { heldRef.current = null; setHeld(null) } } }}><SelectionItem.Provider value={setItem}>{props.children}</SelectionItem.Provider></SelectionAction.Provider>
}

/** Row/value bytes remain in their existing views; only raw identity is shared. */
export function useCurrentItem(item: RedisSelectionItem | null): void {
  const publish = useContext(SelectionItem), identity = JSON.stringify(item)
  const epoch = useContext(SelectionEpochContext), previous = useRef(identity)
  const visibility = useContext(RefreshVisibility)
  useLayoutEffect(() => {
    if (visibility?.visible === false || visibility?.signal.aborted) return
    // Cache refresh can remove or restore a selected row without a click.
    if (previous.current !== identity) { previous.current = identity; epoch?.invalidateSelection(item) }
    publish?.(item)
  }, [publish, identity, epoch, visibility?.visible, visibility?.signal])
}
