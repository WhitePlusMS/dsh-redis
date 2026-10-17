import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'

export interface CollectionColumn<Row> { readonly id: string; readonly title: string; readonly render: (row: Row) => ReactNode }
interface Props<Row> {
  readonly rows: readonly Row[]
  readonly identity: (row: Row) => string
  readonly columns: readonly CollectionColumn<Row>[]
  readonly label: string
  readonly onEnd?: (() => Promise<void>) | undefined
  readonly loading?: boolean
  readonly paused?: boolean
}

/** Observe the bottom inside this table, never the document. A local latch prevents
 * overlapping callbacks before React commits busy state; readers own cursor/error limits.
 */
export function CollectionTable<Row>({ rows, identity, columns, label, onEnd, loading = false, paused = false }: Props<Row>) {
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
    <table aria-label={label}>
      <thead><tr>{columns.map(column => <th key={column.id} scope="col" data-column={column.id}>{column.title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={identity(row)}>{columns.map(column => <td key={column.id} data-column={column.id}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
    <div ref={sentinel} className="redis-page-sentinel" aria-hidden="true" />
  </div>
}
