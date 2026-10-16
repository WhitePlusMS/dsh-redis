import { describe, expect, it } from 'vitest'
import { MAX_PREVIEW_CHARACTERS, formatJson } from '../src/client/value-preview.ts'
import { MAX_JSON_FOLDS, MAX_SEARCH_MATCHES, findLoadedText, indexJsonFolds, projectLoadedText } from '../src/client/loaded-content.ts'

describe('searching the loaded preview only', () => {
  it('uses literal case-sensitive offsets, preserves Unicode forms and never interprets regex syntax', () => {
    const text = 'a.*a 😀 中文 é é\na.*a'
    expect(findLoadedText(text, 'a.*a').ranges).toEqual([{ start: 0, end: 4 }, { start: 16, end: 20 }])
    expect(findLoadedText(text, '😀').ranges.map(range => text.slice(range.start, range.end))).toEqual(['😀'])
    expect(findLoadedText(text, 'é').total).toBe(1)
    expect(findLoadedText(text, 'é').total).toBe(1)
    expect(findLoadedText(text, 'A.*A').total).toBe(0)
    expect(findLoadedText(text, 'unloaded')).toMatchObject({ ranges: [], total: 0, error: null })
    expect(findLoadedText('aaaaa', 'aa').ranges).toEqual([{ start: 0, end: 2 }, { start: 2, end: 4 }])
  })
  it('counts all loaded matches but bounds retained highlight ranges; empty/invalid/oversized queries are distinct', () => {
    const result = findLoadedText('a'.repeat(40000), 'a')
    expect(result.total).toBe(40000); expect(result.ranges).toHaveLength(MAX_SEARCH_MATCHES); expect(result.limited).toBe(true)
    expect(findLoadedText('abc', '')).toMatchObject({ total: 0, limited: false, error: null })
    expect(findLoadedText('abc', 'x'.repeat(257)).error).toBe('query')
    expect(findLoadedText('😀', '\ud800').error).toBe('query')
    expect(findLoadedText('x'.repeat(MAX_PREVIEW_CHARACTERS + 1), 'x').error).toBe('limit')
  })
})

describe('token-preserving JSON folding', () => {
  const source = '{"id":9007199254740993,"n":1e400,"n":-0,"a":{"literal":"} [ \\\" \\\\"},"b":[{"empty":{}},2]}'
  it('indexes braces outside quoted escapes and leaves all original numeric/key tokens unchanged', () => {
    const formatted = formatJson(source), result = indexJsonFolds(formatted)
    expect(result.error).toBeNull(); expect(result.limited).toBe(false)
    expect(result.blocks).toHaveLength(4)
    for (const block of result.blocks) {
      expect(['{', '[']).toContain(formatted[block.start])
      expect(formatted[block.end]).toBe(formatted[block.start] === '{' ? '}' : ']')
      expect(block.hiddenLines).toBeGreaterThan(0)
    }
    const expanded = projectLoadedText(formatted.length, result.blocks, new Set())
    expect(expanded.filter(piece => piece.kind === 'text').map(piece => formatted.slice(piece.start, piece.end)).join('')).toBe(formatted)
    expect(formatted).toContain('9007199254740993'); expect(formatted).toContain('1e400'); expect(formatted).toContain('-0')
    expect((formatted.match(/"n"/g) ?? []).length).toBe(2)
  })
  it('suppresses descendants of a collapsed ancestor and recovers exactly on expand without replacing the source', () => {
    const text = formatJson(source), model = indexJsonFolds(text), root = model.blocks[0]!
    const folded = projectLoadedText(text.length, model.blocks, new Set(model.blocks.map(block => block.start)))
    expect(folded.filter(piece => piece.kind === 'toggle')).toHaveLength(1)
    expect(folded.filter(piece => piece.kind === 'summary')).toMatchObject([{ block: root }])
    expect(folded.filter(piece => piece.kind === 'text').map(piece => text.slice(piece.start, piece.end)).join('')).toBe('{}')
    expect(findLoadedText(text, '9007199254740993').total).toBe(1)
    expect(projectLoadedText(text.length, model.blocks, new Set()).filter(piece => piece.kind === 'text').map(piece => text.slice(piece.start, piece.end)).join('')).toBe(text)
  })
  it('bounds fold controls even when many containers exist, retaining the root and source coverage', () => {
    const text = formatJson('[' + Array.from({ length: 1200 }, (_, i) => '{"id":' + i + '}').join(',') + ']')
    const model = indexJsonFolds(text)
    expect(model.error).toBeNull(); expect(model.limited).toBe(true); expect(model.blocks).toHaveLength(MAX_JSON_FOLDS)
    expect(model.blocks[0]).toMatchObject({ start: 0, end: text.length - 1, depth: 0 })
    const pieces = projectLoadedText(text.length, model.blocks, new Set())
    expect(pieces.filter(piece => piece.kind === 'text').map(piece => text.slice(piece.start, piece.end)).join('')).toBe(text)
    expect(indexJsonFolds('x'.repeat(MAX_PREVIEW_CHARACTERS + 1)).error).toBe('limit')
  })
  it('ignores scalar/empty containers and refuses broken structure or excessive depth', () => {
    for (const text of ['null', '9007199254740993', '"[{}]"', '{}', '[]']) expect(indexJsonFolds(text)).toEqual({ blocks: [], limited: false, error: null })
    for (const text of ['{', '[}', '"unfinished']) expect(indexJsonFolds(text).error).toBe('json')
    expect(indexJsonFolds('['.repeat(65) + ']'.repeat(65)).error).toBe('limit')
  })
})
