import { describe, expect, it } from 'vitest'
import { encodeCommand, MAX_REPLY_BYTES, MAX_REQUEST_BYTES, RedisFrameError, RedisReplyError, RespDecoder } from '../src/host/resp.ts'

describe('bounded binary RESP2 frames', () => {
  it('encodes byte lengths and arbitrary binary arguments without changing identities', () => {
    const key = Buffer.from([0, 255, 13, 10, 128])
    const wire = encodeCommand(['GETRANGE', key, '中文', '0'])
    expect(wire.includes(Buffer.from('$6\r\n中文\r\n'))).toBe(true)
    expect(new RespDecoder().write(wire)).toEqual({ done: true, value: [Buffer.from('GETRANGE'), key, Buffer.from('中文'), Buffer.from('0')] })
  })
  it('handles every split boundary, including CRLF and raw binary CRLF inside a bulk', () => {
    const binary = Buffer.from([0, 255, 13, 10, 128])
    const wire = Buffer.concat([Buffer.from('*7\r\n+OK\r\n:9007199254740993\r\n$-1\r\n$0\r\n\r\n*2\r\n:1\r\n-ERR fixture\r\n$5\r\n'), binary, Buffer.from('\r\n*-1\r\n')])
    const expected = { done: true, value: ['OK', 9007199254740993n, null, Buffer.alloc(0), [1n, new RedisReplyError('ERR fixture')], binary, null] }
    for (let split = 1; split < wire.length; split++) {
      const parser = new RespDecoder()
      expect(parser.write(wire.subarray(0, split))).toEqual({ done: false })
      expect(parser.write(wire.subarray(split))).toEqual(expected)
    }
    const parser = new RespDecoder()
    for (let offset = 0; offset < wire.length; offset++) {
      const decoded = parser.write(wire.subarray(offset, offset + 1))
      expect(decoded).toEqual(offset === wire.length - 1 ? expected : { done: false })
    }
  })
  it('preserves signed 64-bit integer limits, optional signs, nulls and empty aggregates', () => {
    for (const [wire, value] of [[':+42\r\n', 42n], [':9223372036854775807\r\n', 9223372036854775807n], [':-9223372036854775808\r\n', -9223372036854775808n], ['*-1\r\n', null], ['*0\r\n', []]] as const) {
      expect(new RespDecoder().write(Buffer.from(wire))).toEqual({ done: true, value })
    }
  })
  it('rejects huge declared bulks or arrays from their header without needing a payload', () => {
    for (const header of ['$536870912\r\n', '*1000000000\r\n']) {
      expect(() => new RespDecoder().write(Buffer.from(header))).toThrow(expect.objectContaining({ code: 'oversize' }))
    }
  })
  it('limits cumulative bytes, nested arrays, value count and header size', () => {
    const wire = Buffer.from('*2\r\n$16\r\nabcdefghijklmnop\r\n$16\r\nabcdefghijklmnop\r\n')
    expect(() => new RespDecoder(40).write(wire)).toThrow(expect.objectContaining({ code: 'oversize' }))
    expect(() => new RespDecoder().write(Buffer.from('*1\r\n'.repeat(33)))).toThrow(expect.objectContaining({ code: 'oversize' }))
    expect(() => new RespDecoder().write(Buffer.from('*8192\r\n'))).toThrow(expect.objectContaining({ code: 'oversize' }))
    expect(() => new RespDecoder().write(Buffer.from('+' + 'x'.repeat(4097)))).toThrow(expect.objectContaining({ code: 'oversize' }))
    expect(() => new RespDecoder(MAX_REPLY_BYTES + 1)).toThrow(RedisFrameError)
  })
  it('rejects malformed lengths, terminators, out-of-range integers and multiple replies', () => {
    for (const wire of ['$-2\r\n', '*-2\r\n', ':9223372036854775808\r\n', ':NaN\r\n', '$1\r\nx!\n', '+OK\n', '%0\r\n', '+OK\r\n+SECOND\r\n']) {
      expect(() => new RespDecoder().write(Buffer.from(wire))).toThrow(expect.objectContaining({ code: 'protocol' }))
    }
  })
  it('bounds outgoing frames before making an oversized payload copy', () => {
    expect(() => encodeCommand([])).toThrow(RedisFrameError)
    expect(() => encodeCommand(['SCAN', 'x'.repeat(MAX_REQUEST_BYTES)])).toThrow(expect.objectContaining({ code: 'oversize' }))
    expect(() => encodeCommand(Array.from({ length: 1025 }, () => 'x'))).toThrow(RedisFrameError)
  })
})
