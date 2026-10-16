/** The RESP2 subset used by fixed Redis reads. Bulk values remain binary-safe. */
export const MAX_REPLY_BYTES = 1024 * 1024
export const MAX_REQUEST_BYTES = 128 * 1024
const MAX_NODES = 8192
const MAX_DEPTH = 32
const MAX_LINE_BYTES = 4096
const MIN_INTEGER = -(1n << 63n)
const MAX_INTEGER = (1n << 63n) - 1n

export class RedisReplyError extends Error {}
export class RedisFrameError extends Error {
  constructor(readonly code: 'oversize' | 'protocol') { super(code) }
}
export type RedisArgument = string | Buffer
export type RedisReply = string | bigint | Buffer | null | RedisReplyError | RedisReply[]
export type DecodedReply = { readonly done: false } | { readonly done: true; readonly value: RedisReply }

interface ArrayFrame { remaining: number; readonly values: RedisReply[] }
interface BulkFrame { readonly value: Buffer; offset: number; ending: number }

/** Reject declarations before allocation; never concatenate an unbounded input stream. */
export class RespDecoder {
  private readonly line = Buffer.allocUnsafe(MAX_LINE_BYTES)
  private lineLength = 0
  private carriageReturn = false
  private bulk: BulkFrame | null = null
  private readonly arrays: ArrayFrame[] = []
  private result: { readonly value: RedisReply } | null = null
  private bytes = 0
  private nodes = 0

  constructor(private readonly maxBytes = MAX_REPLY_BYTES) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_REPLY_BYTES) throw new RedisFrameError('oversize')
  }
  private consume(count: number): void {
    if (this.bytes + count > this.maxBytes) throw new RedisFrameError('oversize')
    this.bytes += count
  }
  private accept(value: RedisReply): void {
    let next = value
    // Close nested arrays iteratively, so input depth cannot exhaust the JS stack.
    while (true) {
      const parent = this.arrays.at(-1)
      if (parent === undefined) { this.result = { value: next }; return }
      parent.values.push(next)
      if (--parent.remaining > 0) return
      this.arrays.pop()
      next = parent.values
    }
  }
  private integer(text: string): bigint {
    if (!/^[+-]?\d{1,20}$/u.test(text)) throw new RedisFrameError('protocol')
    const value = BigInt(text)
    if (value < MIN_INTEGER || value > MAX_INTEGER) throw new RedisFrameError('protocol')
    return value
  }
  private header(line: Buffer): void {
    if (++this.nodes > MAX_NODES) throw new RedisFrameError('oversize')
    const prefix = line[0]
    const text = line.subarray(1).toString('utf8')
    if (prefix === 43) { this.accept(text); return }
    if (prefix === 45) { this.accept(new RedisReplyError(text)); return }
    if (prefix === 58) { this.accept(this.integer(text)); return }
    if (prefix !== 36 && prefix !== 42) throw new RedisFrameError('protocol')
    if (!/^(?:-1|\d{1,20})$/u.test(text)) throw new RedisFrameError('protocol')
    const length = this.integer(text)
    if (length === -1n) { this.accept(null); return }
    if (length < 0n) throw new RedisFrameError('protocol')
    if (prefix === 36) {
      if (length + BigInt(this.bytes) + 2n > BigInt(this.maxBytes)) throw new RedisFrameError('oversize')
      this.bulk = { value: Buffer.allocUnsafe(Number(length)), offset: 0, ending: 0 }
    } else {
      if (length > BigInt(MAX_NODES - this.nodes) || this.arrays.length >= MAX_DEPTH) throw new RedisFrameError('oversize')
      if (length === 0n) this.accept([])
      else this.arrays.push({ remaining: Number(length), values: [] })
    }
  }
  private decoded(): DecodedReply {
    const result = this.result
    return result === null ? { done: false } : { done: true, value: result.value }
  }
  write(chunk: Buffer): DecodedReply {
    if (this.result !== null) throw new RedisFrameError('protocol')
    let offset = 0
    while (offset < chunk.length) {
      if (this.result !== null) throw new RedisFrameError('protocol')
      const bulk = this.bulk
      if (bulk !== null) {
        if (bulk.offset < bulk.value.length) {
          const count = Math.min(chunk.length - offset, bulk.value.length - bulk.offset)
          this.consume(count)
          chunk.copy(bulk.value, bulk.offset, offset, offset + count)
          offset += count; bulk.offset += count
          if (offset === chunk.length) continue
        }
        this.consume(1)
        if (chunk[offset++] !== (bulk.ending === 0 ? 13 : 10)) throw new RedisFrameError('protocol')
        if (++bulk.ending === 2) { this.bulk = null; this.accept(bulk.value) }
        continue
      }
      const byte = chunk[offset++]
      this.consume(1)
      if (this.carriageReturn) {
        if (byte !== 10) throw new RedisFrameError('protocol')
        const line = this.line.subarray(0, this.lineLength)
        this.lineLength = 0; this.carriageReturn = false
        this.header(line)
      } else if (byte === 13) this.carriageReturn = true
      else {
        if (byte === undefined || byte === 10) throw new RedisFrameError('protocol')
        if (this.lineLength === MAX_LINE_BYTES) throw new RedisFrameError('oversize')
        this.line[this.lineLength++] = byte
      }
    }
    return this.decoded()
  }
}

/** Encode only a bounded argument array; Redis command selection stays in Host readers. */
export function encodeCommand(arguments_: readonly RedisArgument[]): Buffer {
  if (arguments_.length === 0 || arguments_.length > 1024) throw new RedisFrameError('oversize')
  const parts: Buffer[] = [Buffer.from('*' + arguments_.length + '\r\n')]
  let bytes = parts[0]?.length ?? 0
  for (const argument of arguments_) {
    const length = Buffer.isBuffer(argument) ? argument.length : Buffer.byteLength(argument)
    const header = Buffer.from('$' + length + '\r\n')
    if (bytes + header.length + length + 2 > MAX_REQUEST_BYTES) throw new RedisFrameError('oversize')
    parts.push(header, Buffer.isBuffer(argument) ? argument : Buffer.from(argument), Buffer.from('\r\n'))
    bytes += header.length + length + 2
  }
  return Buffer.concat(parts, bytes)
}
