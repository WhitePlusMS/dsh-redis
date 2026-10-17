import { useEffect, useRef, type ReactNode } from 'react'

export interface CollectionColumn<Row> { readonly id: string; readonly title: string; readonly render: (row: Row) => ReactNode }
interface Props<Row> {
  readonly rows: readonly Row[]
  readonly identity: (row: Row) => string
  readonly columns: readonly CollectionColumn<Row>[]
  readonly label: string
  readonly onEnd?: (() => Promise<void>) | undefined
  readonly loading?: boolean
}

/** Observe the bottom inside this table, never the document. A local latch prevents
 * overlapping callbacks before React commits busy state; readers own cursor/error limits.
 */
export function CollectionTable<Row>({ rows, identity, columns, label, onEnd, loading = false }: Props<Row>) {
  const viewport = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null)
  const pending = useRef(false), latest = useRef({ onEnd, loading })
  latest.current = { onEnd, loading }
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
  return <div ref={viewport} className="redis-collection-table" tabIndex={0} data-auto-page={onEnd !== undefined} aria-busy={loading}>
    <table aria-label={label}>
      <thead><tr>{columns.map(column => <th key={column.id} scope="col" data-column={column.id}>{column.title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={identity(row)}>{columns.map(column => <td key={column.id} data-column={column.id}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
    <div ref={sentinel} className="redis-page-sentinel" aria-hidden="true" />
  </div>
}
