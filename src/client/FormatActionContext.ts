import { createContext } from 'react'
import type { DatabaseTarget } from '../domain.ts'
import type { FormatActionHandler } from './ui-pane-presence.ts'

/** The selected Key owns the value-preview action, not the whole workspace. */
export const FormatActionContext = createContext<{ readonly register: (handler: FormatActionHandler) => () => void; readonly target: DatabaseTarget; readonly keyBase64: string } | null>(null)
