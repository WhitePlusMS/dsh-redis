import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { RedisKey } from '../domain.ts'
import { HelpDetails } from './HelpDetails.tsx'
import { Icon } from './Icon.tsx'
import { KEY_ROW_HEIGHT, KeyNamespaces, keyRowId, keyRowWindow, validSeparator, type KeyRow } from './key-namespaces.ts'
import { NS } from './locales.ts'

type Props = { readonly keys: readonly RedisKey[]; readonly selected: RedisKey | null; readonly select: (key: RedisKey) => void; readonly t: TranslateNS<typeof NS> }

/** Presentation only: no remote actions, persisted values, cursors or automatic reads. */
export function KeyCatalog({ keys, selected, select, t }: Props) {
  const [tree, setTree] = useState(true)
  const [separator, setSeparator] = useState(':')
  const [draft, setDraft] = useState(':')
  const [separatorError, setSeparatorError] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [focusId, setFocusId] = useState<string | null>(null)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  const list = useRef<HTMLDivElement>(null)
  const previousRows = useRef<readonly KeyRow[]>([])
  const locate = useRef<string | null>(null)
  const domId = useId()
  const index = useMemo(() => new KeyNamespaces(separator), [separator])
  // appendKeys retains old object references; a refresh/replacement makes this index reset.
  const model = useMemo(() => { index.update(keys); return index }, [index, keys])
  const rows = useMemo(() => model.rows(expanded, tree), [model, keys, expanded, tree])
  const activeIndex = Math.max(0, rows.findIndex(row => row.id === focusId))
  const window = keyRowWindow(rows.length, viewport.top, viewport.height)
  const mounted = Array.from({ length: window.end - window.start }, (_, offset) => window.start + offset)
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
    setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function activate(row: KeyRow): void {
    setFocusId(row.id); list.current?.focus({ preventScroll: true })
    if (row.kind === 'namespace') toggle(row.id)
    else select(row.key)
  }
  function navigate(event: KeyboardEvent<HTMLDivElement>): void {
    const row = rows[activeIndex]
    if (row === undefined) return
    const step = Math.max(1, Math.floor(viewport.height / KEY_ROW_HEIGHT))
    switch (event.key) {
      case 'ArrowDown': reveal(Math.min(rows.length - 1, activeIndex + 1)); break
      case 'ArrowUp': reveal(Math.max(0, activeIndex - 1)); break
      case 'Home': reveal(0); break
      case 'End': reveal(rows.length - 1); break
      case 'PageDown': reveal(Math.min(rows.length - 1, activeIndex + step)); break
      case 'PageUp': reveal(Math.max(0, activeIndex - step)); break
      case 'ArrowRight':
        if (row.kind === 'namespace') { if (expanded.has(row.id)) reveal(activeIndex + 1); else toggle(row.id) }
        break
      case 'ArrowLeft':
        if (row.kind === 'namespace' && expanded.has(row.id)) toggle(row.id)
        else if (row.parentId !== null) reveal(rows.findIndex(value => value.id === row.parentId))
        break
      case 'Enter': case ' ': activate(row); break
      default: return
    }
    event.preventDefault()
  }

  return <>
    <div className="redis-namespace-tools" role="group" aria-label={t('namespace.view')}>
      <button type="button" className="redis-icon-button" title={t('namespace.tree')} aria-label={t('namespace.tree')} aria-pressed={tree} onClick={() => setTree(true)}><Icon name="tree" /></button>
      <button type="button" className="redis-icon-button" title={t('namespace.list')} aria-label={t('namespace.list')} aria-pressed={!tree} onClick={() => setTree(false)}><Icon name="list" /></button>
      <button type="button" className="redis-icon-button" title={t('namespace.locate')} aria-label={t('namespace.locate')} disabled={selected === null || model.path(selected.base64) === undefined} onClick={() => {
        if (selected === null) return
        locate.current = keyRowId(selected.base64)
        setExpanded(previous => new Set([...previous, ...model.path(selected.base64) ?? []]))
      }}><Icon name="locate" /></button>
      <HelpDetails label={t('namespace.settings')}>
        <form onSubmit={event => {
          event.preventDefault()
          if (!validSeparator(draft)) { setSeparatorError(true); return }
          setSeparatorError(false); setExpanded(new Set()); setSeparator(draft)
        }}>
          <label>{t('namespace.separator')}<input name="namespaceSeparator" value={draft} maxLength={16} spellCheck={false} onChange={event => { setDraft(event.target.value); setSeparatorError(false) }} /></label>
          <button type="submit">{t('namespace.apply')}</button>
        </form>
        {separatorError && <p role="alert" className="redis-error">{t('namespace.invalid')}</p>}
        <p>{t('namespace.hint')}</p>
      </HelpDetails>
    </div>
    <div ref={list} className="redis-key-list" role="tree" aria-label={t(tree ? 'namespace.tree' : 'namespace.list')} tabIndex={0} aria-activedescendant={rows[activeIndex] === undefined ? undefined : `${domId}-${activeIndex}`} data-key-view={tree ? 'tree' : 'list'} data-row-count={rows.length} onKeyDown={navigate} onScroll={event => setViewport({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })}>
      {rows.length === 0 ? <p>{t('keys.empty')}</p> : <div className="redis-key-spacer" style={{ height: rows.length * KEY_ROW_HEIGHT }}>
        {mounted.map(rowIndex => {
          const row = rows[rowIndex]!
          return <button type="button" role="treeitem" tabIndex={-1} id={`${domId}-${rowIndex}`} key={row.id} data-key-base64={row.kind === 'key' ? row.key.base64 : undefined} data-namespace-id={row.kind === 'namespace' ? row.id : undefined} data-row-index={rowIndex} aria-level={row.depth + 1} aria-expanded={row.kind === 'namespace' ? expanded.has(row.id) : undefined} aria-selected={row.kind === 'key' ? selected?.base64 === row.key.base64 : undefined} data-active={rowIndex === activeIndex} title={row.kind === 'key' ? row.key.label : row.label} style={{ top: rowIndex * KEY_ROW_HEIGHT, paddingLeft: 4 + Math.min(row.depth, 3) * 8 }} onClick={() => activate(row)}>
            <Icon name={row.kind === 'key' ? 'key' : expanded.has(row.id) ? 'folderOpen' : 'folder'} /><span>{row.label}</span>
            {row.kind === 'namespace' ? <small data-namespace-count title={t('namespace.loaded')}>{row.count}</small> : <small title={`${row.key.byteLength} ${t('keys.bytes')}`}>{row.key.byteLength}</small>}
          </button>
        })}
      </div>}
    </div>
  </>
}
