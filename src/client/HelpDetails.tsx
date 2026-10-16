import type { ReactNode } from 'react'
import { Icon } from './Icon.tsx'

/** Explanations are available on demand; errors and read coverage stay outside. */
export function HelpDetails({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return <details className="redis-help">
    <summary title={label} aria-label={label}><Icon name="info" /></summary>
    <div className="redis-help-content">{children}</div>
  </details>
}
