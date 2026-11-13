import { MAX_REDIS_WRITE_BYTES } from '../domain.ts'
import { RedisReplyError, type RedisArgument, type RedisReply } from './resp.ts'

export type RedisReplaceRequest =
  | { readonly type: 'string'; readonly key: Buffer; readonly before: Buffer; readonly after: Buffer }
  | { readonly type: 'hash'; readonly key: Buffer; readonly field: Buffer; readonly before: Buffer; readonly after: Buffer }
export type RedisSampleRequest =
  | { readonly type: 'string'; readonly key: Buffer }
  | { readonly type: 'hash'; readonly key: Buffer; readonly field: Buffer }

export type RedisWriteResult = 'not-executed' | 'conflict' | 'rejected' | 'written-verified' | 'written-unverified' | 'written-mismatch' | 'unknown'
type Send = (args: readonly RedisArgument[], beforeDispatch: () => void) => Promise<RedisReply>
class RedisSampleError extends Error {}

type TransactionPhase = 'none' | 'watch' | 'multi' | 'uncertain'
type Command = (args: readonly RedisArgument[]) => Promise<RedisReply>

async function supportsWrite(command: Command): Promise<boolean> {
  const info = await command(['INFO', 'server'])
  const version = Buffer.isBuffer(info) ? /^redis_version:(\d+)\.(\d+)\.(\d+)(?:\D|$)/mu.exec(info.toString('utf8')) : null
  return version !== null && (Number(version[1]) > 7 || Number(version[1]) === 7 && Number(version[2]) >= 4)
}

/** Every observation checks the same persistent target before reading bytes. */
async function persistentTarget(request: RedisSampleRequest, command: Command): Promise<'ready' | 'key' | 'field'> {
  if (await command(['TYPE', request.key]) !== request.type || await command(['PTTL', request.key]) !== -1n) return 'key'
  if (request.type === 'hash') {
    const ttl = await command(['HPTTL', request.key, 'FIELDS', '1', request.field])
    if (!Array.isArray(ttl) || ttl.length !== 1 || ttl[0] !== -1n) return 'field'
  }
  return 'ready'
}

function readBytes(request: RedisSampleRequest, length: number, command: Command): Promise<RedisReply> {
  return request.type === 'string' ? command(['GETRANGE', request.key, '0', String(length)]) : command(['HGET', request.key, request.field])
}

/** Cleanup runs even after caller cancellation; an uncertain socket is retired. */
async function cleanTransaction(state: TransactionPhase, send: Send, close: () => void): Promise<void> {
  if (state === 'none') return
  if (state === 'watch' || state === 'multi') {
    try { if (await send([state === 'watch' ? 'UNWATCH' : 'DISCARD'], () => undefined) === 'OK') return } catch { /* retire below */ }
  }
  try { close() } catch { /* preserve the operation's outcome */ }
}

/** Sample the full target under WATCH and reject any concurrent change. */
export async function runRedisSample(request: RedisSampleRequest, send: Send, close: () => void, signal: AbortSignal, guard: () => void): Promise<Buffer> {
  let state: TransactionPhase = 'none'
  const phase = (): TransactionPhase => state
  const check = () => { signal.throwIfAborted(); guard() }
  const command = (args: readonly RedisArgument[]) => send(args, check)
  try {
    if (!await supportsWrite(command)) throw new RedisSampleError('Redis 版本不支持写入前态检查。')
    state = 'watch'
    if (await command(['WATCH', request.key]) !== 'OK') throw new RedisSampleError('Redis 前态监听失败。')
    const target = await persistentTarget(request, command)
    if (target === 'key') throw new RedisSampleError('Redis 目标不存在、类型不匹配或有过期时间。')
    if (target === 'field') throw new RedisSampleError('Redis 字段不存在或有过期时间。')
    const length = request.type === 'string' ? await command(['STRLEN', request.key]) : await command(['HSTRLEN', request.key, request.field])
    if (typeof length !== 'bigint' || length < 0n || length > BigInt(MAX_REDIS_WRITE_BYTES)) throw new RedisSampleError('Redis 前态值超过限制或不可用。')
    const value = await readBytes(request, Number(length), command)
    if (!Buffer.isBuffer(value) || value.length !== Number(length)) throw new RedisSampleError('Redis 前态值不完整或已变化。')
    state = 'multi'
    if (await command(['MULTI']) !== 'OK') throw new RedisSampleError('Redis 前态验证失败。')
    const receipt = await send(['EXEC'], () => { check(); state = 'uncertain' })
    if (receipt === null) { state = 'none'; throw new RedisSampleError('Redis 前态发生并发变化，请重新发起。') }
    if (!Array.isArray(receipt) || receipt.length !== 0) throw new RedisSampleError('Redis 前态验证回执异常。')
    state = 'none'
    check()
    return value
  } catch (error) {
    if (error instanceof RedisSampleError) throw error
    throw new RedisSampleError('Redis 前态采样失败，请检查连接、权限和当前目标。')
  } finally { await cleanTransaction(phase(), send, close) }
}

/** Fixed single-target transaction; caller owns the connection for the entire operation. */
export async function runRedisReplace(request: RedisReplaceRequest, send: Send, close: () => void, signal: AbortSignal, guard: (submitted: boolean) => void, submitted: () => void, readback: (sampledAt: string) => void): Promise<RedisWriteResult> {
  let state: TransactionPhase = 'none'
  let wasSubmitted = false
  let written = false
  const phase = (): TransactionPhase => state
  const check = () => {
    if (!wasSubmitted) signal.throwIfAborted()
    guard(wasSubmitted)
  }
  const command = (args: readonly RedisArgument[]) => send(args, check)
  const matches = async (expected: Buffer): Promise<boolean> => {
    if (await persistentTarget(request, command) !== 'ready') return false
    if (request.type === 'string' && await command(['STRLEN', request.key]) !== BigInt(expected.length)) return false
    const value = await readBytes(request, expected.length, command)
    return Buffer.isBuffer(value) && value.equals(expected)
  }
  try {
    if (!await supportsWrite(command)) return 'not-executed'
    // Mark uncertain state before dispatch: a lost response must close or unwatch.
    state = 'watch'
    if (await command(['WATCH', request.key]) !== 'OK') return 'not-executed'
    if (!await matches(request.before)) return 'conflict'
    state = 'multi'
    if (await command(['MULTI']) !== 'OK') return 'not-executed'
    const queued = request.type === 'string'
      ? await command(['SET', request.key, request.after])
      : await command(['HSET', request.key, request.field, request.after])
    if (queued !== 'QUEUED') return 'not-executed'
    const reply = await send(['EXEC'], () => {
      check()
      submitted()
      wasSubmitted = true
      state = 'uncertain'
    })
    if (reply === null) { state = 'none'; return 'conflict' }
    if (!Array.isArray(reply) || reply.length !== 1) return 'unknown'
    state = 'none'
    if (reply[0] instanceof RedisReplyError) return 'rejected'
    if (request.type === 'string' ? reply[0] !== 'OK' : reply[0] !== 0n) {
      // A positive HSET receipt means a write happened but not the expected update.
      if (request.type === 'hash' && reply[0] === 1n) return 'written-mismatch'
      return 'unknown'
    }
    written = true
    // WATCH the readback as a unit: independent reads alone can combine a value
    // and TTL that never coexisted. An empty transaction proves no watched
    // change occurred between the reads and the validation EXEC.
    state = 'watch'
    if (await command(['WATCH', request.key]) !== 'OK') return 'written-unverified'
    const matched = await matches(request.after)
    const sampledAt = new Date().toISOString()
    state = 'multi'
    if (await command(['MULTI']) !== 'OK') return 'written-unverified'
    const receipt = await send(['EXEC'], () => { check(); state = 'uncertain' })
    if (receipt === null) { state = 'none'; return 'written-unverified' }
    if (!Array.isArray(receipt) || receipt.length !== 0) return 'written-unverified'
    state = 'none'
    try { readback(sampledAt) } catch { return matched ? 'written-unverified' : 'written-mismatch' }
    return matched ? 'written-verified' : 'written-mismatch'
  } catch {
    if (wasSubmitted) return written ? 'written-unverified' : 'unknown'
    return 'not-executed'
  } finally { await cleanTransaction(phase(), send, close) }
}
