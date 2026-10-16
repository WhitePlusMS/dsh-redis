import type { ReactNode } from 'react'

export interface CollectionColumn<Row> { readonly id: string; readonly title: string; readonly render: (row: Row) => ReactNode }

/** Shared native table; callers supply type-specific identity and cell actions. */
export function CollectionTable<Row>({ rows, identity, columns, label }: { readonly rows: readonly Row[]; readonly identity: (row: Row) => string; readonly columns: readonly CollectionColumn<Row>[]; readonly label: string }) {
  return <div className="redis-collection-table" tabIndex={0}>
    <table aria-label={label}>
      <thead><tr>{columns.map(column => <th key={column.id} scope="col" data-column={column.id}>{column.title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={identity(row)}>{columns.map(column => <td key={column.id} data-column={column.id}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  </div>
}
