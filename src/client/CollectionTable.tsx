import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface CollectionColumn<Row> { readonly id: string; readonly title: string; readonly render: (row: Row, index: number) => ReactNode }
interface Props<Row> {
  readonly rows: readonly Row[]
  readonly identity: (row: Row) => string
  readonly columns: readonly CollectionColumn<Row>[]
  readonly label: string
  readonly onEnd?: (() => Promise<void>) | undefined
  readonly loading?: boolean
  readonly paused?: boolean
  readonly selection?: { readonly id: string | null; readonly onSelect: (row: Row) => void }
  readonly emptyMessage?: string
}

/** Observe the bottom inside this table, never the document. A local latch prevents
 * overlapping callbacks before React commits busy state; readers own cursor/error limits.
 */
export function CollectionTable<Row>({ rows, identity, columns, label, onEnd, loading = false, paused = false, selection, emptyMessage }: Props<Row>) {
  const viewport = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null)
  const pending = useRef(false), latest = useRef({ onEnd, loading, paused })
  const position = useRef({ top: 0, left: 0 })
  latest.current = { onEnd, loading, paused }
  // Hiding a table can change browser scroll anchoring. Keep its own position,
  // rather than trying to scroll a DSH ancestor back after returning from a cell.
  useLayoutEffect(() => {
    const element = viewport.current
    if (!paused && element !== null) { element.scrollTop = position.current.top; element.scrollLeft = position.current.left }
  }, [paused])
  function rememberPosition(): void {
    const element = viewport.current
    if (!paused && element !== null && element.getClientRects().length !== 0) position.current = { top: element.scrollTop, left: element.scrollLeft }
  }
  const activeIndex = selection === undefined ? -1 : Math.max(0, rows.findIndex(row => identity(row) === selection.id))
  function selectRow(index: number): void {
    const row = rows[index], root = viewport.current
    if (selection === undefined || row === undefined || root === null) return
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
    if (root === null || end === null || onEnd === undefined || loading || paused) return
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || pending.current || latest.current.loading || latest.current.paused || latest.current.onEnd === undefined) return
      pending.current = true
      void latest.current.onEnd().finally(() => { pending.current = false })
    }, { root, rootMargin: '0px 0px 40px 0px' })
    observer.observe(end)
    return () => observer.disconnect()
  }, [onEnd, loading, paused, rows])
  return <div ref={viewport} className="redis-collection-table" tabIndex={0} data-auto-page={onEnd !== undefined && !paused} aria-busy={loading} onScroll={rememberPosition} onClickCapture={rememberPosition}>
    <table aria-label={label} role={selection === undefined ? undefined : 'grid'}>
      <thead><tr>{columns.map(column => <th key={column.id} scope="col" data-column={column.id}>{column.title}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={identity(row)} data-row-identity={identity(row)} aria-selected={selection === undefined ? undefined : selection.id === identity(row)} tabIndex={selection === undefined ? undefined : index === activeIndex ? 0 : -1} onClick={selection === undefined ? undefined : () => selectRow(index)} onKeyDown={event => navigate(event, index)}>{columns.map(column => <td key={column.id} data-column={column.id}>{column.render(row, index)}</td>)}</tr>)}{rows.length === 0 && emptyMessage !== undefined && <tr><td colSpan={columns.length} className="redis-collection-empty">{emptyMessage}</td></tr>}</tbody>
    </table>
    <div ref={sentinel} className="redis-page-sentinel" aria-hidden="true" />
  </div>
}
