import { useEffect, useRef } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { ActionPointReadRequest, ActionPointReadResult, DatabaseTarget, UiActionRequest } from '../domain.ts'
import type { SelectionEpoch } from './selection-epoch.ts'
import type { KeyActionResult } from './ui-pane-presence.ts'

type PointRequest = UiActionRequest<{ readonly keyBase64: string }>
type Commit = Extract<KeyActionResult, { readonly kind: string }>['kind']

function isCurrent(request: PointRequest, signal: AbortSignal, epoch: SelectionEpoch | null): boolean {
  return !signal.aborted && Date.now() < request.expiresAt && epoch?.current(request.selectionRevision) === true && document.visibilityState === 'visible'
}

export async function readCollectionPoint(
  request: PointRequest, signal: AbortSignal, epoch: SelectionEpoch,
  target: DatabaseTarget, keyBase64: string,
  read: (input: ActionPointReadRequest, signal: AbortSignal) => Promise<RemoteResult<ActionPointReadResult>>,
  isAvailable: () => boolean,
): Promise<ActionPointReadResult | 'stale' | 'failed'> {
  const owner = request.target
  if (owner === null || owner.id !== target.id || owner.generation !== target.generation || owner.db !== target.db || request.action.keyBase64 !== keyBase64 || !isCurrent(request, signal, epoch)) return 'stale'
  try {
    const response = await read({ requestId: request.requestId }, signal)
    if (!isCurrent(request, signal, epoch) || !isAvailable()) return 'stale'
    return response.ok && response.value.state === 'value' ? response.value : 'failed'
  } catch {
    return signal.aborted ? 'stale' : 'failed'
  }
}

export interface CollectionPoint {
  readonly request: PointRequest
  readonly signal: AbortSignal
  userScrolled: boolean
  userInteracted: boolean
  abort(): void
}
type PointData = Omit<CollectionPoint, 'abort' | 'userScrolled' | 'userInteracted'>
interface Publication { hold(id: string): void; release(id: string): void }

/** Hold selection publication through Host acknowledgement. Keep a pressed row
 * mounted until its click can finish, then roll back that candidate's UI state.
 */
export function useCollectionPoint<Data extends PointData>() {
  type T = Data & CollectionPoint
  const pending = useRef<{ readonly action: T; readonly reveal: (kind: Commit, epoch: SelectionEpoch | null) => void } | null>(null)
  const deferred = useRef<{ readonly action: T; readonly finish: () => void } | null>(null)
  const pointer = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { clearTimeout(timer.current); deferred.current = null; pointer.current = false }, [])

  function begin(
    data: Data,
    publication: Publication,
    show: (action: T) => void,
    accept: (action: T) => void,
    restore: (action: T) => void,
  ): Promise<KeyActionResult> {
    if (pending.current !== null || deferred.current !== null) return Promise.resolve('stale')
    return new Promise(resolve => {
      const { request, signal } = data
      let resolved = false, retired = false
      const retire = () => {
        retired = true
        signal.removeEventListener('abort', reject)
        pending.current = null
        publication.release(request.requestId)
      }
      const reject = () => {
        if (retired) return
        retire()
        if (pointer.current) {
          action.userInteracted = true
          deferred.current = { action, finish: () => restore(action) }
        } else restore(action)
        if (!resolved) resolve('stale')
      }
      const action = { ...data, userScrolled: false, userInteracted: false, abort: reject }
      pending.current = { action, reveal: (kind, epoch) => {
        if (resolved) return
        if (!isCurrent(request, signal, epoch)) { reject(); return }
        resolved = true
        resolve({ kind, accepted: () => {
          if (retired) return
          retire()
          accept(action)
        }, rejected: reject })
      } }
      publication.hold(request.requestId)
      show(action)
      signal.addEventListener('abort', reject, { once: true })
      if (signal.aborted) reject()
    })
  }

  function pointerInteraction(active: boolean): void {
    pointer.current = active
    if (active || deferred.current === null || timer.current !== undefined) return
    // Native click follows pointerup in the same event sequence.
    timer.current = setTimeout(() => {
      timer.current = undefined
      if (pointer.current) return
      const rollback = deferred.current
      deferred.current = null
      rollback?.finish()
    }, 0)
  }

  return {
    begin,
    current: () => pending.current?.action ?? deferred.current?.action ?? null,
    abort: () => pending.current?.action.abort(),
    reveal: (action: T, kind: Commit, epoch: SelectionEpoch | null) => {
      if (pending.current?.action === action) pending.current.reveal(kind, epoch)
    },
    pointerInteraction,
  }
}
