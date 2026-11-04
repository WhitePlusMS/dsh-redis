import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { DatabaseCatalog, RedisKey } from '../domain.ts'
import { displayLabel } from './collection-value.ts'
import { Icon } from './Icon.tsx'
import { KEY_ROW_HEIGHT, KeyNamespaces, keyRowId, keyRowWindow, validSeparator, type KeyRow } from './key-namespaces.ts'
import { NS } from './locales.ts'
import { SelectionEpochContext } from './SelectionEpochContext.ts'

type DatabaseRow = { readonly kind: 'database'; readonly id: string; readonly label: string; readonly db: number; readonly depth: number; readonly parentId: null }
type NavigationRow = KeyRow | DatabaseRow
type Props = { readonly databases: DatabaseCatalog | null; readonly db: number; readonly selectingDb: boolean; readonly selectDb: (db: number) => void; readonly keys: readonly RedisKey[]; readonly selected: RedisKey | null; readonly select: (key: RedisKey) => void; readonly located: boolean; readonly locateToken: string | null; readonly onLocated: (token: string) => void; readonly t: TranslateNS<typeof NS> }

/** Presentation only: no remote actions, persisted values, cursors or automatic reads. */
export function KeyCatalog({ keys, selected, select, t, databases, db, selectingDb, selectDb, located, locateToken, onLocated }: Props) {
  const epoch = useContext(SelectionEpochContext)
  const wheel = useRef<{ timer: ReturnType<typeof setTimeout> | undefined; end: (() => void) | undefined } | null>(null)
  const drag = useRef<{ readonly pointerId: number; readonly end: (() => void) | undefined } | null>(null)
  const [tree, setTree] = useState(true)
  const [dbOpen, setDbOpen] = useState(true)
  const [separator, setSeparator] = useState(':')
  const [draft, setDraft] = useState(':')
  const [separatorError, setSeparatorError] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  const list = useRef<HTMLDivElement>(null)
  const locatedKey = useRef<HTMLButtonElement>(null)
  const previousRows = useRef<readonly NavigationRow[]>([])
  const locate = useRef<string | null>(null)
  const domId = useId()
  const endWheel = () => { const current = wheel.current; wheel.current = null; if (current !== null) { if (current.timer !== undefined) clearTimeout(current.timer); current.end?.() } }
  const endDrag = () => { const current = drag.current; drag.current = null; current?.end?.() }
  useEffect(() => {
    const pointerEnded = (event: PointerEvent) => { if (drag.current?.pointerId === event.pointerId) endDrag() }
    const hidden = () => { if (document.visibilityState !== 'visible') { endDrag(); endWheel() } }
    window.addEventListener('pointerup', pointerEnded, true)
    window.addEventListener('pointercancel', pointerEnded, true)
    window.addEventListener('lostpointercapture', pointerEnded, true)
    window.addEventListener('blur', endDrag)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pointerup', pointerEnded, true)
      window.removeEventListener('pointercancel', pointerEnded, true)
      window.removeEventListener('lostpointercapture', pointerEnded, true)
      window.removeEventListener('blur', endDrag)
      document.removeEventListener('visibilitychange', hidden)
      endDrag(); endWheel()
    }
  }, [])
  function userScroll(): void {
    if (wheel.current === null) { epoch?.userSelect(); wheel.current = { timer: undefined, end: epoch?.beginBoundary(new AbortController().signal) } }
    else if (wheel.current.timer !== undefined) clearTimeout(wheel.current.timer)
    wheel.current.timer = setTimeout(endWheel, 150)
  }
  const index = useMemo(() => new KeyNamespaces(separator), [separator])
  // appendKeys retains old object references; a refresh/replacement makes this index reset.
  const model = useMemo(() => { index.update(keys); return index }, [index, keys])
  const rows = useMemo((): readonly NavigationRow[] => {
    const known = new Map(databases?.keyspace?.map(row => [row.db, row.keys]) ?? [])
    const dbs = databases?.databaseCount == null ? [...new Set([db, ...known.keys()])].sort((a, b) => a - b) : Array.from({ length: databases.databaseCount }, (_, i) => i)
    return dbs.flatMap((value): NavigationRow[] => {
      const count = value === db && databases?.currentKeys != null ? databases.currentKeys : known.get(value) ?? (databases?.keyspace == null ? '?' : '0')
      const parent = 'database:' + value
      const row: DatabaseRow = { kind: 'database', id: parent, label: 'db' + value + ' (' + count + ')', db: value, depth: 0, parentId: null }
      return value === db && dbOpen ? [row, ...model.rows(expanded, tree).map(child => ({ ...child, depth: child.depth + 1, parentId: child.parentId ?? parent }))] : [row]
    })
  }, [model, keys, expanded, tree, databases, db, dbOpen])
  const activeIndex = Math.max(0, rows.findIndex(row => row.id === focusId))
  const rowWindow = keyRowWindow(rows.length, viewport.top, viewport.height)
  const mounted = Array.from({ length: rowWindow.end - rowWindow.start }, (_, offset) => rowWindow.start + offset)
  // Retain at most one off-screen active row so aria-activedescendant always resolves.
  if (rows.length > 0 && !mounted.includes(activeIndex)) mounted.push(activeIndex)

  useLayoutEffect(() => {
    // Old folder identities must not accumulate across MATCH/DB refreshes.
    setExpanded(new Set()); setFocusId(null)
  }, [model, model.revision])

  useLayoutEffect(() => {
    const element = list.current
    if (element === null) return
    const measure = (): void => setViewport(previous => previous.top === element.scrollTop && previous.height === element.clientHeight ? previous : { top: element.scrollTop, height: element.clientHeight })
    const observer = new ResizeObserver(measure)
    observer.observe(element); measure()
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const element = list.current
    if (element === null) return
    const prior = previousRows.current
    const anchor = prior[Math.floor(element.scrollTop / KEY_ROW_HEIGHT)]
    const requested = locate.current
    const next = rows.findIndex(row => row.id === (requested ?? anchor?.id))
    // Appending inside an expanded folder may insert rows above the viewport.
    element.scrollTop = next < 0 ? 0 : next * KEY_ROW_HEIGHT + (requested === null ? element.scrollTop % KEY_ROW_HEIGHT : 0)
    if (requested !== null) { setFocusId(requested); element.focus({ preventScroll: true }) }
    locate.current = null; previousRows.current = rows
    setViewport({ top: element.scrollTop, height: element.clientHeight })
  }, [rows])

  useLayoutEffect(() => {
    if (locateToken === null || selected === null) return
    const path = model.path(selected.base64)
    const visible = (element: HTMLElement | null, container: HTMLElement | null): boolean => {
      if (element === null || container === null || element.getClientRects().length === 0 || container.getClientRects().length === 0) return false
      const row = element.getBoundingClientRect(), bounds = container.getBoundingClientRect()
      return row.width > 0 && row.height > 0 && row.bottom > bounds.top && row.top < bounds.bottom && row.right > bounds.left && row.left < bounds.right
    }
    if (path === undefined) {
      if (visible(locatedKey.current, locatedKey.current?.closest<HTMLElement>('.redis-key-catalog') ?? null)) onLocated(locateToken)
      return
    }
    const id = keyRowId(selected.base64)
    if (rows.some(row => row.id === id)) {
      reveal(rows.findIndex(row => row.id === id))
      const element = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('[data-key-base64]') ?? []).find(node => node.dataset.keyBase64 === selected.base64) ?? null
      if (visible(element, list.current)) onLocated(locateToken)
      return
    }
    locate.current = id; setDbOpen(true); setExpanded(previous => new Set([...previous, ...path]))
  }, [locateToken, selected?.base64, model, model.revision, rows, activeIndex, onLocated])

  function reveal(rowIndex: number): void {
    const element = list.current, row = rows[rowIndex]
    if (element === null || row === undefined) return
    setFocusId(row.id)
    const top = rowIndex * KEY_ROW_HEIGHT
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + KEY_ROW_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = top + KEY_ROW_HEIGHT - element.clientHeight
    setViewport({ top: element.scrollTop, height: element.clientHeight })
  }
  function toggle(id: string): void {
    epoch?.userSelect()
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function activate(row: NavigationRow): void {
    setFocusId(row.id); list.current?.focus({ preventScroll: true })
    if (row.kind === 'database') { epoch?.userSelect(); if (row.db === db) setDbOpen(!dbOpen); else selectDb(row.db) }
    else if (row.kind === 'namespace') toggle(row.id)
    else select(row.key)
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>): void {
    const row = rows[activeIndex]
    if (row === undefined) return
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'ArrowRight', 'ArrowLeft', 'Enter', ' '].includes(event.key)) epoch?.userSelect()
    const step = Math.max(1, Math.floor(viewport.height / KEY_ROW_HEIGHT))
    switch (event.key) {
      case 'ArrowDown': reveal(Math.min(rows.length - 1, activeIndex + 1)); break
      case 'ArrowUp': reveal(Math.max(0, activeIndex - 1)); break
      case 'Home': reveal(0); break
      case 'End': reveal(rows.length - 1); break
      case 'PageDown': reveal(Math.min(rows.length - 1, activeIndex + step)); break
      case 'PageUp': reveal(Math.max(0, activeIndex - step)); break
      case 'ArrowRight':
        if (row.kind === 'database') { if (row.db !== db) selectDb(row.db); else if (!dbOpen) setDbOpen(true); else reveal(activeIndex + 1) }
        if (row.kind === 'namespace') { if (expanded.has(row.id)) reveal(activeIndex + 1); else toggle(row.id) }
        break
      case 'ArrowLeft':
        if (row.kind === 'database' && row.db === db) setDbOpen(false)
        else if (row.kind === 'namespace' && expanded.has(row.id)) toggle(row.id)
        else if (row.parentId !== null) reveal(rows.findIndex(value => value.id === row.parentId))
        break
      case 'Enter': case ' ': activate(row); break
      default: return
    }
    event.preventDefault()
  }

  return <>
    <div className="redis-namespace-tools" role="group" aria-label={t('namespace.view')}>
      <button type="button" className="redis-icon-button" title={t('namespace.tree')} aria-label={t('namespace.tree')} aria-pressed={tree} onClick={() => { epoch?.userSelect(); setTree(true) }}><Icon name="tree" /></button>
      <button type="button" className="redis-icon-button" title={t('namespace.list')} aria-label={t('namespace.list')} aria-pressed={!tree} onClick={() => { epoch?.userSelect(); setTree(false) }}><Icon name="list" /></button>
      <button type="button" className="redis-icon-button" title={t('namespace.locate')} aria-label={t('namespace.locate')} disabled={selected === null || model.path(selected.base64) === undefined} onClick={() => {
        if (selected === null) return
        epoch?.userSelect()
        setDbOpen(true)
        locate.current = keyRowId(selected.base64)
        setExpanded(previous => new Set([...previous, ...model.path(selected.base64) ?? []]))
      }}><Icon name="locate" /></button>
      <button type="button" className="redis-icon-button redis-namespace-settings-toggle" title={t('namespace.settings')} aria-label={t('namespace.settings')} aria-expanded={settingsOpen} aria-controls={`${domId}-settings`} onClick={() => setSettingsOpen(!settingsOpen)}><Icon name="settings" /></button>
    </div>
    {settingsOpen && <section id={`${domId}-settings`} className="redis-namespace-settings" aria-label={t('namespace.settings')}>
      <div className="redis-section-heading"><strong>{t('namespace.settings')}</strong><button type="button" className="redis-icon-button" title={t('ui.close')} aria-label={t('ui.close')} onClick={() => setSettingsOpen(false)}><Icon name="close" /></button></div>
        <form onSubmit={event => {
          event.preventDefault()
          if (!validSeparator(draft)) { setSeparatorError(true); return }
          epoch?.userSelect()
          setSeparatorError(false); setExpanded(new Set()); setSeparator(draft); setSettingsOpen(false)
        }}>
          <label>{t('namespace.separator')}<input name="namespaceSeparator" value={draft} maxLength={16} spellCheck={false} onChange={event => { setDraft(event.target.value); setSeparatorError(false) }} /></label>
          <button type="submit">{t('namespace.apply')}</button>
        </form>
        {separatorError && <p role="alert" className="redis-error">{t('namespace.invalid')}</p>}
    </section>}
    {located && selected !== null && !keys.some(key => key.base64 === selected.base64) && <button ref={locatedKey} type="button" className="redis-chip" data-located-key={selected.base64} aria-pressed="true" onClick={() => select(selected)}>{t('keys.located')} · {displayLabel(selected.label)}</button>}
    <div ref={list} className="redis-key-list" role="tree" aria-label={t(tree ? 'namespace.tree' : 'namespace.list')} tabIndex={0} aria-activedescendant={rows[activeIndex] === undefined ? undefined : `${domId}-${activeIndex}`} data-key-view={tree ? 'tree' : 'list'} data-row-count={rows.length} onKeyDown={navigate} onWheel={userScroll} onPointerDown={event => {
      if (event.target !== event.currentTarget || event.button !== 0 || drag.current !== null) return
      epoch?.userSelect(); drag.current = { pointerId: event.pointerId, end: epoch?.beginBoundary(new AbortController().signal) }
    }} onScroll={event => setViewport({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })}>
      {rows.length === 0 ? <p>{t('keys.empty')}</p> : <div className="redis-key-spacer" style={{ height: rows.length * KEY_ROW_HEIGHT }}>
        {mounted.map(rowIndex => {
          const row = rows[rowIndex]!
          return <button type="button" role="treeitem" tabIndex={-1} id={`${domId}-${rowIndex}`} key={row.id} data-key-base64={row.kind === 'key' ? row.key.base64 : undefined} data-namespace-id={row.kind === 'namespace' ? row.id : undefined} data-db={row.kind === 'database' ? row.db : undefined} disabled={selectingDb} data-row-index={rowIndex} aria-level={row.depth + 1} aria-expanded={row.kind === 'database' ? row.db === db && dbOpen : row.kind === 'namespace' ? expanded.has(row.id) : undefined} aria-selected={row.kind === 'database' ? row.db === db : row.kind === 'key' ? selected?.base64 === row.key.base64 : undefined} data-active={rowIndex === activeIndex} title={displayLabel(row.kind === 'key' ? row.key.label : row.label)} style={{ top: rowIndex * KEY_ROW_HEIGHT, paddingLeft: 4 + Math.min(row.depth, 8) * 12 }} onClick={() => activate(row)}>
            {row.kind === 'database' && <Icon name={row.db === db && dbOpen ? 'down' : 'right'} />}<Icon name={row.kind === 'database' ? 'database' : row.kind === 'key' ? 'key' : expanded.has(row.id) ? 'folderOpen' : 'folder'} /><span>{displayLabel(row.label)}{row.kind === 'namespace' && <small data-namespace-count title={t('namespace.loaded')}> ({row.count})</small>}</span>

          </button>
        })}
      </div>}
    </div>
  </>
}
