import { useContext, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { SelectionEpochContext } from './SelectionEpochContext.ts'

export interface CollectionColumn<Row> { readonly id: string; readonly title: string; readonly render: (row: Row, index: number) => ReactNode }
interface Props<Row> {
  readonly rows: readonly Row[]
  readonly identity: (row: Row) => string
  readonly columns: readonly CollectionColumn<Row>[]
  readonly label: string
  readonly onEnd?: (() => Promise<void>) | undefined
  readonly loading?: boolean
  readonly selection?: { readonly id: string | null; readonly onSelect: (row: Row) => void; readonly disabled?: (row: Row) => boolean }
  readonly emptyMessage?: string
  readonly reveal?: { readonly id: string; readonly remember: (top: number) => void; readonly ready: () => void } | undefined
  readonly restoreScroll?: { readonly top: number } | undefined
  readonly onUserScroll?: () => void
  readonly onPointerInteraction?: (active: boolean) => void
}

/** Observe the bottom inside this table, never the document. A local latch prevents
 * overlapping callbacks before React commits busy state; readers own cursor/error limits.
 */
export function CollectionTable<Row>({ rows, identity, columns, label, onEnd, loading = false, selection, emptyMessage, reveal, restoreScroll, onUserScroll, onPointerInteraction }: Props<Row>) {
  const epoch = useContext(SelectionEpochContext)
  const viewport = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null)
  const pending = useRef(false), latest = useRef({ onEnd, loading, onUserScroll })
  const wheel = useRef<{ timer: ReturnType<typeof setTimeout> | undefined; end: (() => void) | undefined } | null>(null)
  const drag = useRef<{ readonly pointerId: number; readonly touch: boolean; readonly x: number; readonly y: number; readonly end: (() => void) | undefined; readonly interaction: ((active: boolean) => void) | undefined; moved: boolean } | null>(null)
  const keys = useRef<{ readonly pressed: Set<string>; readonly end: (() => void) | undefined } | null>(null)
  latest.current = { onEnd, loading, onUserScroll }
  const endWheel = () => { const current = wheel.current; wheel.current = null; if (current !== null) { if (current.timer !== undefined) clearTimeout(current.timer); current.end?.() } }
  const endDrag = () => { const current = drag.current; drag.current = null; if (current !== null) { current.end?.(); current.interaction?.(false) } }
  const endKeys = () => { const current = keys.current; keys.current = null; current?.end?.() }
  useEffect(() => {
    if (onUserScroll === undefined) return
    const pointerMoved = (event: PointerEvent) => {
      const current = drag.current
      if (current === null || current.pointerId !== event.pointerId) return
      // A release outside the window may have no pointerup. A later mouse move
      // with no buttons pressed is authoritative and releases the boundary.
      if (!current.touch && event.buttons === 0) { endDrag(); return }
      if (current.moved || Math.hypot(event.clientX - current.x, event.clientY - current.y) < 5) return
      current.moved = true; latest.current.onUserScroll?.()
    }
    const pointerEnded = (event: PointerEvent) => { if (drag.current?.pointerId === event.pointerId && !drag.current.touch) endDrag() }
    const pointerCancelled = (event: PointerEvent) => {
      const current = drag.current
      if (current === null || current.pointerId !== event.pointerId) return
      if (!current.touch) { endDrag(); return }
      if (!current.moved) { current.moved = true; latest.current.onUserScroll?.() }
    }
    const touchEnded = (event: TouchEvent) => { if (event.touches.length === 0 && drag.current?.touch) endDrag() }
    const keyUp = (event: globalThis.KeyboardEvent) => { const current = keys.current; if (current !== null) { current.pressed.delete(event.key); if (current.pressed.size === 0) endKeys() } }
    const blur = () => { endDrag(); endKeys() }
    const hidden = () => { if (document.visibilityState !== 'visible') { endWheel(); blur() } }
    const unsubscribe = epoch?.subscribe(() => { if (epoch.hasFailure()) blur() })
    window.addEventListener('pointermove', pointerMoved, true); window.addEventListener('pointerup', pointerEnded, true); window.addEventListener('pointercancel', pointerCancelled, true)
    window.addEventListener('lostpointercapture', pointerCancelled, true); window.addEventListener('touchend', touchEnded, true); window.addEventListener('touchcancel', touchEnded, true); window.addEventListener('keyup', keyUp, true); window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', hidden)
    return () => { unsubscribe?.(); window.removeEventListener('pointermove', pointerMoved, true); window.removeEventListener('pointerup', pointerEnded, true); window.removeEventListener('pointercancel', pointerCancelled, true); window.removeEventListener('lostpointercapture', pointerCancelled, true); window.removeEventListener('touchend', touchEnded, true); window.removeEventListener('touchcancel', touchEnded, true); window.removeEventListener('keyup', keyUp, true); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden); endWheel(); blur() }
  }, [onUserScroll === undefined, epoch])
  function userWheel(): void {
    if (onUserScroll === undefined) return
    onUserScroll()
    if (wheel.current === null) { epoch?.userSelect(); wheel.current = { timer: undefined, end: epoch?.beginBoundary(new AbortController().signal) } }
    else if (wheel.current.timer !== undefined) clearTimeout(wheel.current.timer)
    wheel.current.timer = setTimeout(endWheel, 150)
  }
  useLayoutEffect(() => { if (restoreScroll !== undefined && viewport.current !== null) viewport.current.scrollTop = restoreScroll.top }, [restoreScroll])
  const activeIndex = selection === undefined ? -1 : Math.max(0, rows.findIndex(row => identity(row) === selection.id))
  useLayoutEffect(() => {
    const root = viewport.current
    if (root === null || reveal === undefined || selection?.id !== reveal.id) return
    const row = Array.from(root.querySelectorAll<HTMLTableRowElement>('tbody > tr')).find(element => element.dataset.rowIdentity === reveal.id)
    if (row === undefined || row.getAttribute('aria-selected') !== 'true') return
    const bounds = root.getBoundingClientRect(), header = root.querySelector('thead')?.getBoundingClientRect().height ?? 0
    if (bounds.width === 0 || bounds.height <= header || row.getBoundingClientRect().height === 0) return
    reveal.remember(root.scrollTop)
    const before = row.getBoundingClientRect()
    if (before.top < bounds.top + header) root.scrollTop -= bounds.top + header - before.top
    else if (before.bottom > bounds.bottom) root.scrollTop += before.bottom - bounds.bottom
    const after = row.getBoundingClientRect()
    if (after.top >= bounds.top + header - 1 && after.bottom <= bounds.bottom + 1) reveal.ready()
  }, [reveal, rows, selection?.id])
  function selectRow(index: number): void {
    const row = rows[index], root = viewport.current
    if (selection === undefined || row === undefined || root === null || selection.disabled?.(row)) return
    epoch?.userSelect()
    selection.onSelect(row)
    const element = root.querySelectorAll<HTMLTableRowElement>('tbody > tr')[index]
    if (element === undefined) return
    element.focus({ preventScroll: true })
    // Keep keyboard navigation inside this viewport; never scroll a DSH ancestor.
    const view = root.getBoundingClientRect(), cell = element.getBoundingClientRect()
    const header = root.querySelector('thead')?.getBoundingClientRect().height ?? 0
    if (cell.top < view.top + header) root.scrollTop -= view.top + header - cell.top
    else if (cell.bottom > view.bottom) root.scrollTop += cell.bottom - view.bottom
  }
  function navigate(event: KeyboardEvent<HTMLTableRowElement>, index: number): void {
    if (selection === undefined || event.target !== event.currentTarget) return
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : null
    if (next === null) return
    event.preventDefault(); selectRow(Math.max(0, Math.min(rows.length - 1, next)))
  }
  useEffect(() => {
    const root = viewport.current, end = sentinel.current
    if (root === null || end === null || onEnd === undefined || loading) return
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || pending.current || latest.current.loading || latest.current.onEnd === undefined) return
      pending.current = true
      void latest.current.onEnd().finally(() => { pending.current = false })
    }, { root, rootMargin: '0px 0px 40px 0px' })
    observer.observe(end)
    return () => observer.disconnect()
  }, [onEnd, loading, rows])
  return <div ref={viewport} className="redis-collection-table" tabIndex={0} data-auto-page={onEnd !== undefined} aria-busy={loading} onWheel={userWheel} onKeyDown={event => {
    if (onUserScroll === undefined || event.defaultPrevented || !['PageUp', 'PageDown', 'Home', 'End', ' ', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    if (keys.current === null) { onUserScroll(); keys.current = { pressed: new Set(), end: epoch?.beginBoundary(new AbortController().signal) } }
    keys.current.pressed.add(event.key)
  }} onPointerDown={event => {
    if (onUserScroll === undefined || event.button !== 0 || drag.current !== null) return
    const id = event.target instanceof Element ? event.target.closest<HTMLTableRowElement>('tbody > tr')?.dataset.rowIdentity : undefined
    const row = rows.find(value => identity(value) === id)
    if (row !== undefined && selection?.disabled?.(row)) event.preventDefault()
    onPointerInteraction?.(true)
    const end = epoch?.beginBoundary(new AbortController().signal)
    drag.current = { pointerId: event.pointerId, touch: event.pointerType === 'touch', x: event.clientX, y: event.clientY, end, interaction: onPointerInteraction, moved: false }
  }}>
    <table aria-label={label} role={selection === undefined ? undefined : 'grid'}>
      <thead><tr>{columns.map(column => <th key={column.id} scope="col" data-column={column.id}>{column.title}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={identity(row)} data-row-identity={identity(row)} aria-selected={selection === undefined ? undefined : selection.id === identity(row)} aria-disabled={selection?.disabled?.(row) || undefined} tabIndex={selection === undefined ? undefined : index === activeIndex ? 0 : -1} onClick={selection === undefined ? undefined : () => selectRow(index)} onKeyDown={event => navigate(event, index)}>{columns.map(column => <td key={column.id} data-column={column.id}>{column.render(row, index)}</td>)}</tr>)}{rows.length === 0 && emptyMessage !== undefined && <tr><td colSpan={columns.length} className="redis-collection-empty">{emptyMessage}</td></tr>}</tbody>
    </table>
    <div ref={sentinel} className="redis-page-sentinel" aria-hidden="true" />
  </div>
}
