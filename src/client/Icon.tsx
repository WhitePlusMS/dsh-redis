import { Check, ChevronDown, ChevronRight, ChevronUp, ChevronsDownUp, ChevronsUpDown, Copy, Funnel, History, Info, List, ListTree, LocateFixed, Lock, Maximize2, Minimize2, Pause, Plus, RefreshCw, Search, Settings2, SlidersHorizontal, Timer, TriangleAlert, Unplug, X } from 'lucide-react'
import { NavigationIcon, type NavigationIconName } from './NavigationIcon.tsx'

const actions = {
  clock: Timer, pause: Pause, check: Check, warning: TriangleAlert, lock: Lock,
  history: History, add: Plus, refresh: RefreshCw, disconnect: Unplug, close: X,
  settings: Settings2, info: Info, copy: Copy, tree: ListTree, list: List,
  locate: LocateFixed, search: Search, filter: Funnel, range: SlidersHorizontal,
  collapse: ChevronsDownUp, expand: ChevronsUpDown, up: ChevronUp, down: ChevronDown,
  right: ChevronRight, focus: Maximize2, restore: Minimize2,
} as const
type IconName = NavigationIconName | keyof typeof actions

/** Official components are bundled locally; only React is supplied by DSH. */
export function Icon({ name }: { readonly name: IconName }) {
  if (name === 'database' || name === 'folder' || name === 'folderOpen' || name === 'key') return <NavigationIcon name={name} />
  const Action = actions[name]
  return <Action className="redis-icon" data-icon={name} size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />
}
