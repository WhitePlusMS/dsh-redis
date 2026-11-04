import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import type { PreviewFormat, PreviewView } from '../domain.ts'

type Formats = Readonly<Record<PreviewView, PreviewFormat>>
const initial: Formats = { string: 'text', hash: 'text', list: 'text', set: 'text', zset: 'text', stream: 'text' }
type ActionFormat = (format: PreviewFormat, current: () => boolean) => () => void
const Context = createContext<{ readonly formats: Formats; readonly change: (view: PreviewView, format: PreviewFormat) => void; readonly action: (view: PreviewView, format: PreviewFormat, current: () => boolean) => () => void } | null>(null)

/** Mounted-session display choices only. No connection, DB or Key is restored. */
export function PreviewFormats({ children }: { readonly children: ReactNode }) {
  const [formats, setFormats] = useState(initial)
  const versions = useRef<Record<PreviewView, number>>({ string: 0, hash: 0, list: 0, set: 0, zset: 0, stream: 0 })
  const change = (view: PreviewView, format: PreviewFormat) => { versions.current[view]++; setFormats(previous => ({ ...previous, [view]: format })) }
  const action = (view: PreviewView, format: PreviewFormat, current: () => boolean) => {
    const version = ++versions.current[view], before = formats[view]
    setFormats(previous => versions.current[view] === version && current() ? { ...previous, [view]: format } : previous)
    return () => {
      if (versions.current[view] !== version) return
      versions.current[view]++
      setFormats(previous => ({ ...previous, [view]: before }))
    }
  }
  return <Context.Provider value={{ formats, change, action }}>{children}</Context.Provider>
}
export function useBrowsingFormat(view: PreviewView): readonly [PreviewFormat, (format: PreviewFormat) => void, ActionFormat] {
  const context = useContext(Context)
  if (context === null) throw new Error('Missing Redis preview formats')
  return [context.formats[view], format => context.change(view, format), (format, current) => context.action(view, format, current)]
}
