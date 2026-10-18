import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PreviewFormat, PreviewView } from '../domain.ts'

type Formats = Readonly<Record<PreviewView, PreviewFormat>>
const initial: Formats = { string: 'text', hash: 'text', list: 'text', set: 'text', zset: 'text', stream: 'text' }
const Context = createContext<{ readonly formats: Formats; readonly change: (view: PreviewView, format: PreviewFormat) => void } | null>(null)

/** Mounted-session display choices only. No connection, DB or Key is restored. */
export function PreviewFormats({ children }: { readonly children: ReactNode }) {
  const [formats, setFormats] = useState(initial)
  return <Context.Provider value={{ formats, change: (view, format) => setFormats(previous => ({ ...previous, [view]: format })) }}>{children}</Context.Provider>
}
export function useBrowsingFormat(view: PreviewView): readonly [PreviewFormat, (format: PreviewFormat) => void] {
  const context = useContext(Context)
  if (context === null) throw new Error('Missing Redis preview formats')
  return [context.formats[view], format => context.change(view, format)]
}
