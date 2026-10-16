import { describe, expect, it, vi } from 'vitest'
import { bitmapByteRange, bitmapWindow, MAX_BITMAP_BITS } from '../src/client/bitmap-preview.ts'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisStrings } from '../src/host/string-reader.ts'
import type { StringReadResult } from '../src/domain.ts'

function value(bytes: Buffer, offset = '0', total = String(bytes.length)): StringReadResult {
  return { state: 'value', error: null, metadata: { type: 'string', ttlMs: '-1', length: total }, offset, base64: bytes.toString('base64'), byteLength: bytes.length, prefix: '', suffix: '', complete: offset === '0' && String(bytes.length) === total, nextOffset: null, sampledAt: new Date().toISOString() }
}

describe('Bitmap byte windows and Redis bit order', () => {
  it('uses highest-bit-first numbering for all byte values and every unaligned start', () => {
    for (let byte = 0; byte < 256; byte++) {
      const bytes = Buffer.from([byte, 255 - byte, 0xa5]), all = [...bytes].map(v => v.toString(2).padStart(8, '0')).join('')
      for (let offset = 0; offset < 8; offset++) {
        const range = { offset: String(offset), count: 16 }, wanted = bitmapByteRange(range)
        const window = bitmapWindow(value(bytes.subarray(0, wanted.count), wanted.offset, '3'), range)
        expect(window.rows.map(row => row.bits).join('')).toBe(all.slice(offset, offset + 16))
        expect(window.count).toBe(16); expect(window.totalBits).toBe('24'); expect(window.nextOffset).toBe(offset + 16 < 24 ? String(offset + 16) : null)
      }
    }
  })
  it('caps maximum aligned and unaligned windows without reading a whole String', () => {
    expect(bitmapByteRange({ offset: '0', count: MAX_BITMAP_BITS })).toEqual({ offset: '0', count: 512 })
    expect(bitmapByteRange({ offset: '7', count: MAX_BITMAP_BITS })).toEqual({ offset: '0', count: 513 })
    const rows = bitmapWindow(value(Buffer.alloc(513, 0xa5), '0', '2097152'), { offset: '7', count: 4096 })
    expect(rows.rows.length).toBe(128); expect(rows.rows[0]?.offset).toBe('7'); expect(rows.rows[127]?.offset).toBe('4071'); expect(rows.rows.every(row => row.bits.length === 32)).toBe(true)
    expect(rows.nextOffset).toBe('4103'); expect(rows.totalBits).toBe('16777216')
  })
  it('clips the last bit, keeps empty String/EOF empty, and never invents zero padding', () => {
    const last = bitmapWindow(value(Buffer.from([0xa5]), '1', '2'), { offset: '15', count: 64 })
    expect(last).toMatchObject({ count: 1, totalBits: '16', rows: [{ offset: '15', bits: '1' }], nextOffset: null })
    for (const [offset, total] of [['0', '0'], ['16', '2'], ['17', '2'], ['9223372036854775807', '2']] as const) {
      const range = { offset, count: 64 }, bytes = bitmapByteRange(range)
      expect(bitmapWindow(value(Buffer.alloc(0), bytes.offset, total), range)).toMatchObject({ count: 0, rows: [], nextOffset: null })
    }
  })
  it('retains bit offsets and total bit lengths beyond JavaScript safe integers', () => {
    expect(bitmapByteRange({ offset: '9007199254740993', count: 8 })).toEqual({ offset: '1125899906842624', count: 2 })
    const window = bitmapWindow(value(Buffer.from([0xff, 0]), '1125899906842624', '9007199254740993'), { offset: '9007199254740993', count: 8 })
    expect(window.totalBits).toBe('72057594037927944'); expect(window.rows).toEqual([{ offset: '9007199254740993', bits: '11111110' }]); expect(window.nextOffset).toBe('9007199254741001')
  })
  it('rejects invalid ranges and mismatched byte windows without expansion', () => {
    for (const offset of ['', '-1', '01', '1.0', '1e3', ' 1', '9223372036854775808']) expect(() => bitmapByteRange({ offset, count: 8 })).toThrow()
    for (const count of [0, -1, 4097, 1.5, NaN, Infinity]) expect(() => bitmapByteRange({ offset: '0', count })).toThrow()
    const sample = value(Buffer.from([0xa5]))
    for (const change of [{ offset: '1' }, { byteLength: 0 }, { state: 'missing' }, { metadata: { type: 'hash', ttlMs: '-1', length: '1' } }, { metadata: null }, { base64: '!' }]) expect(() => bitmapWindow({ ...sample, ...change } as StringReadResult, { offset: '0', count: 8 })).toThrow()
    expect(() => bitmapWindow(value(Buffer.alloc(2)), { offset: '0', count: 8 })).toThrow()
    expect(() => bitmapWindow(value(Buffer.alloc(0), '0', '100'), { offset: '0', count: 8 })).toThrow()
  })
  it('ignores UTF-8 context bytes and groups partial last rows at exact bit positions', () => {
    const sample = { ...value(Buffer.from([0x80, 1, 0xa5, 0xff, 0x80])), prefix: '////', suffix: '////' }
    expect(bitmapWindow(sample, { offset: '0', count: 33 }).rows).toEqual([{ offset: '0', bits: '10000000000000011010010111111111' }, { offset: '32', bits: '1' }])
  })
  it('uses the existing strict String reader for a 513-byte request plus bounded context', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const key = Buffer.from([255, 0]), source = Buffer.alloc(2 * 1024 * 1024, 0xa5), calls: string[] = []
    const execute: RedisLink['execute'] = async (command, args, _signal, guard) => {
      guard(); calls.push(command); expect(args[0]).toEqual(key)
      if (command === 'TYPE') return 'string'
      if (command === 'PTTL') return -1n
      if (command === 'STRLEN') return BigInt(source.length)
      if (command === 'GETRANGE') { expect(args.slice(1)).toEqual(['0', '515']); return source.subarray(Number(args[1]), Number(args[2]) + 1) }
      throw new Error('Unexpected bit write or full read')
    }
    const connections = new RedisConnections(async () => ({ close: () => undefined, execute, onFailure: () => () => undefined }))
    try {
      const signal = new AbortController().signal, view = await connections.connect('bitmap', { host: 'localhost', port: 6379, username: '', password: '', tls: null }, signal)
      if (view.id === null) throw new Error('Missing fixture')
      const range = { offset: '7', count: 4096 }, result = await new RedisStrings(connections).read('bitmap', { target: { id: view.id, generation: view.generation, db: 0 }, keyBase64: key.toString('base64'), ...bitmapByteRange(range) }, signal)
      expect(result.state).toBe('value'); expect(result.byteLength).toBe(513)
      expect(bitmapWindow(result, range).count).toBe(4096)
      expect(calls).toEqual(['TYPE', 'PTTL', 'STRLEN', 'GETRANGE', 'TYPE', 'STRLEN', 'PTTL'])
    } finally { connections.dispose(); info.mockRestore() }
  })
})
