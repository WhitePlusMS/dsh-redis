import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'

type Props = { readonly title: string; readonly backLabel: string; readonly onBack: () => void; readonly children: ReactNode; readonly kind?: 'cell' | 'message' }

/** A page inside the existing inspector. The table stays mounted behind a hidden
 * sibling, so returning restores the same rows and local scroll without a read.
 */
export function DetailPage({ title, backLabel, onBack, children, kind = 'cell' }: Props) {
  const back = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const origin = document.activeElement
    back.current?.focus({ preventScroll: true })
    // Wait for the table to be visible again. A Key/DB change removes the origin,
    // and must never move focus back into another or an unmounted data view.
    return () => queueMicrotask(() => {
      if (origin instanceof HTMLElement && origin.isConnected && origin.getClientRects().length !== 0) origin.focus({ preventScroll: true })
    })
  }, [])
  return <section className={`redis-detail-page ${kind === 'message' ? 'redis-stream-fields' : 'redis-cell-preview'}`} aria-label={title}>
    <div className="redis-detail-page-heading">
      <button ref={back} type="button" className="redis-back-button" onClick={onBack}><Icon name="back" /><span>{backLabel}</span></button>
      <h2 title={title}>{title}</h2>
    </div>
    {children}
  </section>
}
