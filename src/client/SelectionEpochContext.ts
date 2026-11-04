import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'
import type { SelectionEpoch } from './selection-epoch.ts'

/** A pane and its action stream share the same session-scoped version. */
export const SelectionEpochContext = createContext<SelectionEpoch | null>(null)

/** A primitive snapshot avoids rerenders when only the ready flag changes. */
export function useSelectionRevision(): number {
  const epoch = useContext(SelectionEpochContext)
  const subscribe = useCallback((notify: () => void) => epoch?.subscribe(notify) ?? (() => undefined), [epoch])
  const read = useCallback(() => epoch?.snapshot().revision ?? 0, [epoch])
  return useSyncExternalStore(subscribe, read, read)
}
