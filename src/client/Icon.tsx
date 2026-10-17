import { NavigationIcon, type NavigationIconName } from './NavigationIcon.tsx'

type IconName = NavigationIconName | 'clients' | 'history' | 'add' | 'refresh' | 'disconnect' | 'close' | 'settings' | 'info' | 'copy' | 'tree' | 'list' | 'locate' | 'search' | 'collapse' | 'expand' | 'up' | 'down' | 'right' | 'back' | 'focus' | 'restore'
const paths: Record<Exclude<IconName, NavigationIconName>, string> = {
  clients: 'M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 17v-2a5 5 0 0 1 10 0v2M14 4a3 3 0 0 1 0 6M14 12a5 5 0 0 1 4 5',
  history: 'M3 8a7 7 0 1 1 1 7M3 3v5h5M10 6v5l3 2',
  add: 'M10 4v12M4 10h12',
  refresh: 'M16.5 8A6.7 6.7 0 0 0 4 5M3.5 12A6.7 6.7 0 0 0 16 15M16.5 3v5h-5M3.5 17v-5h5',
  disconnect: 'M7 3v5M13 3v5M5 8h10v2a5 5 0 0 1-10 0V8M10 15v3',
  close: 'm5 5 10 10M15 5 5 15',
  settings: 'M7 3 6 5 4 6l1 3-1 3 2 1 1 3h4l1-3 3-1-1-3 1-3-3-1-1-2H7ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  info: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 6v5M10 6h.01',
  copy: 'M6 6h10v11H6V6Zm6 0V3H3v11h3',
  tree: 'M4 3v12h4M4 7h4M9 5h7v4H9V5Zm0 8h7v4H9v-4',
  list: 'M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01',
  locate: 'M10 2v3M10 15v3M2 10h3M15 10h3M10 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  search: 'M14 14l4 4M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3Z',
  collapse: 'M4 4h12M4 16h12M7 7l3 3 3-3M7 13l3-3 3 3',
  expand: 'M4 4h12M4 16h12M7 9l3-3 3 3M7 11l3 3 3-3',
  up: 'm5 12 5-5 5 5',
  down: 'm5 8 5 5 5-5',
  right: 'm8 5 5 5-5 5',
  back: 'M16 10H4m5-5-5 5 5 5',
  focus: 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4',
  restore: 'M3 7h4V3M13 3v4h4M17 13h-4v4M7 17v-4H3',
}

/** Local inline icons keep the native browser bundle free of new runtime peers. */
export function Icon({ name }: { readonly name: IconName }) {
  if (name === 'database' || name === 'folder' || name === 'folderOpen' || name === 'key') return <NavigationIcon name={name} />
  return <svg className="redis-icon" data-icon={name} viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
