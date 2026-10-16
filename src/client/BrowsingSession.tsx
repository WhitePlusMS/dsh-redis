import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { PreviewFormat, PreviewView, SessionBrowsingState } from '../domain.ts'
import { browsingStateSchema } from '../typert.shared.ts'
import { NS } from './locales.ts'

export interface BrowsingActions {
  readonly loadBrowsingState: (signal: AbortSignal) => Promise<RemoteResult<SessionBrowsingState>>
  readonly saveBrowsingState: (state: SessionBrowsingState, signal: AbortSignal) => Promise<RemoteResult<SessionBrowsingState>>
}
interface BrowsingContextValue {
  readonly state: SessionBrowsingState
  readonly update: (patch: Partial<SessionBrowsingState>) => void
}
const BrowsingContext = createContext<BrowsingContextValue | null>(null)

/** Only Host-session preferences cross mounts. Never restore values or start Redis
 * work here. Save replies cannot overwrite newer local choices or another mount.
 */
export function BrowsingSession(props: BrowsingActions & { readonly t: TranslateNS<typeof NS>; readonly children: ReactNode }) {
  const [state, setState] = useState<SessionBrowsingState | null>(null)
  const [attempt, setAttempt] = useState(0), [loadError, setLoadError] = useState(false), [saveError, setSaveError] = useState(false)
  const latest = useRef<SessionBrowsingState | null>(null), alive = useRef(false), sequence = useRef(0)
  useEffect(() => {
    const controller = new AbortController(); alive.current = true
    setLoadError(false); setState(null); latest.current = null
    void props.loadBrowsingState(controller.signal).then(result => {
      if (controller.signal.aborted) return
      if (!result.ok) throw new Error('Preferences unavailable')
      const value = result.value
      latest.current = value; setState(value)
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true) })
    return () => { alive.current = false; controller.abort(); ++sequence.current }
  }, [props.loadBrowsingState, attempt])
  const update = useCallback((patch: Partial<SessionBrowsingState>) => {
    if (latest.current === null) return
    const value = browsingStateSchema.parse({ ...latest.current, ...patch })
    latest.current = value; setState(value); setSaveError(false)
    const current = ++sequence.current
    // Finite Host-memory writes can finish for their captured owner after unmount.
    // The injected per-session queue makes a subsequent load await those writes.
    void props.saveBrowsingState(value, AbortSignal.timeout(5000)).then(result => {
      if (!result.ok) throw new Error('Preferences unavailable')
    }).catch(() => { if (alive.current && current === sequence.current) setSaveError(true) })
  }, [props.saveBrowsingState])
  if (state === null) return <div role="status">{props.t(loadError ? 'session.loadError' : 'session.loading')}{loadError && <button type="button" onClick={() => setAttempt(value => value + 1)}>{props.t('action.retry')}</button>}</div>
  return <BrowsingContext.Provider value={{ state, update }}>
    {saveError && <p className="redis-error" role="alert">{props.t('session.saveError')} <button type="button" onClick={() => update({})}>{props.t('action.retry')}</button></p>}
    {props.children}
  </BrowsingContext.Provider>
}
export function useBrowsingState(): BrowsingContextValue {
  const value = useContext(BrowsingContext)
  if (value === null) throw new Error('Redis browsing session is missing')
  return value
}
export function useBrowsingFormat(view: PreviewView): readonly [PreviewFormat, (format: PreviewFormat) => void] {
  const { state, update } = useBrowsingState()
  return [state.formats[view], format => update({ formats: { ...state.formats, [view]: format } })]
}
