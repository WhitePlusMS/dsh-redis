import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { StringReadResult } from '../domain.ts'
import { previewValue, type PreviewFormat } from './value-preview.ts'
import { NS } from './locales.ts'
import { Icon } from './Icon.tsx'
import { findLoadedText, indexJsonFolds, projectLoadedText, type TextRange } from './loaded-content.ts'

type Window = Pick<StringReadResult, 'base64' | 'prefix' | 'suffix' | 'offset' | 'complete'>
const formats: readonly PreviewFormat[] = ['text', 'json', 'hex', 'base64', 'decode-text', 'decode-json']

/** The same byte formatter serves String windows and collection cells. */
export function BytePreview({ value, t, format, onFormatChange, heading }: { readonly value: Window; readonly t: TranslateNS<typeof NS>; readonly format: PreviewFormat; readonly onFormatChange: (format: PreviewFormat) => void; readonly heading?: { readonly label: string; readonly description: string } }) {
  const preview = useMemo(() => previewValue(value, format), [value, format])
  const [copyState, setCopyState] = useState<'copied' | 'failed' | null>(null)
  const copySequence = useRef(0)
  const [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState('')
  const [matchIndex, setMatchIndex] = useState(0), [scrollAttempt, setScrollAttempt] = useState(0)
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set())
  const searchInput = useRef<HTMLInputElement>(null), content = useRef<HTMLPreElement>(null)
  const matches = useMemo(() => findLoadedText(preview.text, searchOpen ? query : ''), [preview.text, query, searchOpen])
  const folds = useMemo(() => (format === 'json' || format === 'decode-json') && preview.error === null ? indexJsonFolds(preview.text) : { blocks: [], limited: false, error: null }, [preview.text, preview.error, format])
  const pieces = useMemo(() => projectLoadedText(preview.text.length, folds.blocks, collapsed), [preview.text, folds, collapsed])
  const current = matches.ranges.length === 0 ? -1 : matchIndex % matches.ranges.length
  useEffect(() => {
    ++copySequence.current; setCopyState(null); setCollapsed(new Set()); setMatchIndex(0)
    return () => { ++copySequence.current }
  }, [preview.text, format])
  useEffect(() => { if (searchOpen) searchInput.current?.focus() }, [searchOpen])
  useLayoutEffect(() => {
    const element = content.current, mark = element?.querySelector<HTMLElement>('[data-search-current="true"]')
    if (!searchOpen || query === '' || element === null || mark === null || mark === undefined) return
    const view = element.getBoundingClientRect(), hit = mark.getBoundingClientRect()
    // Only the preview scrolls; scrollIntoView could move a DSH ancestor/document.
    if (hit.top < view.top) element.scrollTop -= view.top - hit.top
    else if (hit.bottom > view.bottom) element.scrollTop += hit.bottom - view.bottom
    if (hit.left < view.left) element.scrollLeft -= view.left - hit.left
    else if (hit.right > view.right) element.scrollLeft += hit.right - view.right
  }, [searchOpen, query, current, pieces, scrollAttempt])
  function nextMatch(delta: number): void {
    if (matches.ranges.length === 0) return
    setCollapsed(new Set()); setMatchIndex((matchIndex + delta + matches.ranges.length) % matches.ranges.length); setScrollAttempt(value => value + 1)
  }
  function text(range: TextRange): ReactNode {
    const nodes: ReactNode[] = []
    let cursor = range.start
    for (let index = 0; index < matches.ranges.length; ++index) {
      const hit = matches.ranges[index]!
      if (hit.end <= range.start) continue
      if (hit.start >= range.end) break
      const start = Math.max(hit.start, range.start), end = Math.min(hit.end, range.end)
      if (cursor < start) nodes.push(preview.text.slice(cursor, start))
      nodes.push(<mark key={`${index}-${start}`} data-search-current={index === current}>{preview.text.slice(start, end)}</mark>)
      cursor = end
    }
    if (cursor < range.end) nodes.push(preview.text.slice(cursor, range.end))
    return nodes
  }
  return <section className="redis-byte-preview" aria-label={heading?.label ?? t('content.preview')} onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') { event.preventDefault(); setSearchOpen(true); searchInput.current?.focus() }
    else if (event.key === 'Escape' && searchOpen) { event.preventDefault(); setSearchOpen(false); content.current?.focus({ preventScroll: true }) }
    else if (event.key === 'F3' || event.key === 'Enter' && event.target === searchInput.current) { event.preventDefault(); nextMatch(event.shiftKey ? -1 : 1) }
  }}>
    <div className="redis-format-toolbar" role="group" aria-label={t('value.format')}>
      {heading !== undefined && <div className="redis-preview-caption"><strong>{heading.label}</strong><small className="redis-preview-size">{heading.description}</small></div>}
      <select name="valueFormat" aria-label={heading === undefined ? t('value.format') : `${heading.label} · ${t('value.format')}`} value={format} onChange={event => { const choice = formats.find(value => value === event.target.value); if (choice !== undefined) onFormatChange(choice) }}>
        {formats.map(choice => <option key={choice} value={choice}>{choice === 'base64' ? 'Base64' : t(`value.format.${choice}`)}</option>)}
      </select>
      <button type="button" className="redis-icon-button" title={t('content.find')} aria-label={t('content.find')} disabled={preview.error !== null} onClick={() => { setSearchOpen(true); searchInput.current?.focus() }}><Icon name="search" /></button>
      {folds.blocks.length > 0 && <>
        <button type="button" className="redis-icon-button" title={t('content.collapse')} aria-label={t('content.collapse')} onClick={() => setCollapsed(new Set(folds.blocks.filter(block => block.depth === 0).map(block => block.start)))}><Icon name="collapse" /></button>
        <button type="button" className="redis-icon-button" title={t('content.expand')} aria-label={t('content.expand')} onClick={() => setCollapsed(new Set())}><Icon name="expand" /></button>
      </>}
      <button type="button" className="redis-icon-button redis-copy-button" title={heading === undefined ? t('ui.copy') : `${t('ui.copy')} · ${heading.label}`} aria-label={heading === undefined ? t('ui.copy') : `${t('ui.copy')} · ${heading.label}`} disabled={preview.error !== null} onClick={() => {
        const current = ++copySequence.current
        if (navigator.clipboard === undefined) { setCopyState('failed'); return }
        void navigator.clipboard.writeText(preview.text).then(() => { if (current === copySequence.current) setCopyState('copied') }).catch(() => { if (current === copySequence.current) setCopyState('failed') })
      }}><Icon name="copy" /></button>
      {copyState !== null && <small role="status">{t(copyState === 'copied' ? 'ui.copied' : 'ui.copyError')}</small>}
    </div>
    {searchOpen && <div className="redis-content-search" role="search" aria-label={t('content.find')}>
      <input ref={searchInput} name="loadedQuery" maxLength={256} value={query} aria-label={t('content.query')} placeholder={t('content.query')} spellCheck={false} onChange={event => { setQuery(event.target.value); setMatchIndex(0); setCollapsed(new Set()) }} />
      <small role="status" data-content-matches>{matches.error !== null ? t('content.invalidQuery') : query === '' ? '' : `${current + 1}/${matches.ranges.length}`}</small>
      <button type="button" className="redis-icon-button" aria-label={t('content.previous')} title={t('content.previous')} disabled={matches.ranges.length === 0} onClick={() => nextMatch(-1)}><Icon name="up" /></button>
      <button type="button" className="redis-icon-button" aria-label={t('content.next')} title={t('content.next')} disabled={matches.ranges.length === 0} onClick={() => nextMatch(1)}><Icon name="down" /></button>
      <button type="button" className="redis-icon-button" aria-label={t('content.close')} title={t('content.close')} onClick={() => { setSearchOpen(false); content.current?.focus({ preventScroll: true }) }}><Icon name="close" /></button>
      <small className="redis-content-scope">{t('content.scope')}{matches.limited ? ` · ${t('content.matchLimit')} 1000 / ${matches.total}` : ''}</small>
    </div>}
    {folds.limited && <small>{t('content.foldLimit')}</small>}
    {preview.error !== null ? <p role="alert" className="redis-error">{t(`value.error.${preview.error}`)}</p> : <pre ref={content} className="redis-value" data-value-preview tabIndex={0}>{pieces.map((piece, index) => {
      if (piece.kind === 'text') return <Fragment key={index}>{text(piece)}</Fragment>
      if (piece.kind === 'summary') return <span key={index} className="redis-json-summary"> … {piece.block.hiddenLines} {t('content.lines')} </span>
      const label = t(piece.collapsed ? 'content.expandBlock' : 'content.collapseBlock') + ` ${piece.block.line + 1}`
      return <button type="button" key={index} className="redis-json-toggle" data-json-fold={piece.block.start} aria-label={label} title={label} aria-expanded={!piece.collapsed} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(piece.block.start)) next.delete(piece.block.start); else next.add(piece.block.start); return next })}><Icon name={piece.collapsed ? 'right' : 'down'} /></button>
    })}</pre>}
    {preview.contextBytes > 0 && <p>{t('value.context')} {preview.contextBytes} {t('keys.bytes')}</p>}
  </section>
}
