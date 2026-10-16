type IconName = 'add' | 'refresh' | 'disconnect' | 'close' | 'settings' | 'database' | 'key' | 'info' | 'copy'
const paths: Record<IconName, string> = {
  add: 'M10 4v12M4 10h12',
  refresh: 'M16.5 8A6.7 6.7 0 0 0 4 5M3.5 12A6.7 6.7 0 0 0 16 15M16.5 3v5h-5M3.5 17v-5h5',
  disconnect: 'M7 3v5M13 3v5M5 8h10v2a5 5 0 0 1-10 0V8M10 15v3',
  close: 'm5 5 10 10M15 5 5 15',
  settings: 'M7 3 6 5 4 6l1 3-1 3 2 1 1 3h4l1-3 3-1-1-3 1-3-3-1-1-2H7ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  database: 'M3 5c0-4 14-4 14 0v10c0 4-14 4-14 0V5Zm0 0c0 4 14 4 14 0M3 10c0 4 14 4 14 0',
  key: 'M9.5 9.5a4 4 0 1 0 0-6 4 4 0 0 0 0 6Zm0 0-6 6v2h3v-2h2v-2l3-3',
  info: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 6v5M10 6h.01',
  copy: 'M6 6h10v11H6V6Zm6 0V3H3v11h3',
}

/** Local inline icons keep the native browser bundle free of new runtime peers. */
export function Icon({ name }: { readonly name: IconName }) {
  return <svg className="redis-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
