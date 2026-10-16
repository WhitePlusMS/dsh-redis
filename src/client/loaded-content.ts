import { MAX_PREVIEW_CHARACTERS } from './value-preview.ts'

export const MAX_SEARCH_MATCHES = 1000
export const MAX_JSON_FOLDS = 512
export interface TextRange { readonly start: number; readonly end: number }
export interface LoadedMatches {
  readonly ranges: readonly TextRange[]
  readonly total: number
  readonly limited: boolean
  readonly error: 'query' | 'limit' | null
}

/** Literal, case-sensitive UTF-16 offsets into the exact preview, without Unicode normalization. */
export function findLoadedText(text: string, query: string): LoadedMatches {
  if (text.length > MAX_PREVIEW_CHARACTERS) return { ranges: [], total: 0, limited: false, error: 'limit' }
  if (query.length > 256 || new TextDecoder('utf-8', { ignoreBOM: true }).decode(new TextEncoder().encode(query)) !== query) return { ranges: [], total: 0, limited: false, error: 'query' }
  if (query.length === 0) return { ranges: [], total: 0, limited: false, error: null }
  const ranges: TextRange[] = []
  let total = 0
  for (let from = 0; ;) {
    const start = text.indexOf(query, from)
    if (start < 0) break
    const end = start + query.length
    if (ranges.length < MAX_SEARCH_MATCHES) ranges.push({ start, end })
    ++total; from = end
  }
  return { ranges, total, limited: total > ranges.length, error: null }
}

export interface JsonFold { readonly start: number; readonly end: number; readonly depth: number; readonly line: number; readonly hiddenLines: number }
export interface JsonFolds { readonly blocks: readonly JsonFold[]; readonly limited: boolean; readonly error: 'json' | 'limit' | null }
type OpenBlock = { readonly start: number; readonly line: number; readonly depth: number; readonly closing: string; readonly slot: number | null }

/** Input is already syntax-validated, token-preserving formatter output. This indexes structure,
 * not JSON values: escaped quotes/brackets never create folds or round numbers.
 */
export function indexJsonFolds(text: string): JsonFolds {
  if (text.length > MAX_PREVIEW_CHARACTERS) return { blocks: [], limited: false, error: 'limit' }
  const blocks: JsonFold[] = [], stack: OpenBlock[] = []
  let quoted = false, line = 0, eligible = 0
  for (let index = 0; index < text.length; ++index) {
    const character = text[index]
    if (quoted) {
      if (character === '\\') ++index
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') { quoted = true; continue }
    if (character === '\n') { ++line; continue }
    if (character === '{' || character === '[') {
      if (stack.length >= 64) return { blocks: [], limited: false, error: 'limit' }
      const multiline = text[index + 1] === '\n'
      const slot = multiline && eligible < MAX_JSON_FOLDS ? blocks.length : null
      if (multiline) ++eligible
      const block = { start: index, depth: stack.length, line, closing: character === '{' ? '}' : ']', slot }
      if (slot !== null) blocks.push({ start: index, end: index, depth: stack.length, line, hiddenLines: 0 })
      stack.push(block)
    } else if (character === '}' || character === ']') {
      const block = stack.pop()
      if (block === undefined || block.closing !== character) return { blocks: [], limited: false, error: 'json' }
      if (block.slot !== null) blocks[block.slot] = { start: block.start, end: index, depth: block.depth, line: block.line, hiddenLines: Math.max(0, line - block.line - 1) }
    }
  }
  if (quoted || stack.length > 0) return { blocks: [], limited: false, error: 'json' }
  return { blocks, limited: eligible > MAX_JSON_FOLDS, error: null }
}

export type ContentPiece =
  | { readonly kind: 'text'; readonly start: number; readonly end: number }
  | { readonly kind: 'toggle'; readonly block: JsonFold; readonly collapsed: boolean }
  | { readonly kind: 'summary'; readonly block: JsonFold }

/** Projection references source ranges; hidden text and display ellipses never replace the source. */
export function projectLoadedText(length: number, blocks: readonly JsonFold[], collapsed: ReadonlySet<number>): readonly ContentPiece[] {
  const pieces: ContentPiece[] = []
  let cursor = 0
  for (const block of blocks) {
    if (block.start < cursor) continue // A collapsed ancestor already owns this entire range.
    if (cursor < block.start) pieces.push({ kind: 'text', start: cursor, end: block.start })
    const hidden = collapsed.has(block.start)
    pieces.push({ kind: 'toggle', block, collapsed: hidden })
    if (hidden) {
      pieces.push({ kind: 'text', start: block.start, end: block.start + 1 }, { kind: 'summary', block }, { kind: 'text', start: block.end, end: block.end + 1 })
      cursor = block.end + 1
    } else cursor = block.start
  }
  if (cursor < length) pieces.push({ kind: 'text', start: cursor, end: length })
  return pieces
}
