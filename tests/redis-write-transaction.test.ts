import { describe, expect, it } from 'vitest'
import { runRedisReplace, runRedisSample, type RedisReplaceRequest } from '../src/host/redis-write-transaction.ts'
import { RedisReplyError, type RedisArgument, type RedisReply } from '../src/host/resp.ts'

const input: RedisReplaceRequest = { type: 'string', key: Buffer.from('key'), before: Buffer.from('old'), after: Buffer.from('new') }

function fixture(request: RedisReplaceRequest = input, failReadback = false) {
  const calls: string[] = [], controller = new AbortController()
  let closed = false, submitted = false, updated = false, sampledAt: string | null = null
  let override: ((name: string) => RedisReply | Error | undefined) | undefined
  const send = async (args: readonly RedisArgument[], before: () => void): Promise<RedisReply> => {
    before()
    const name = String(args[0]); calls.push(name)
    const changed = override?.(name)
    if (changed instanceof Error) throw changed
    if (changed !== undefined) return changed
    if (name === 'INFO') return Buffer.from('redis_version:8.2.6\r\n')
    if (name === 'TYPE') return request.type
    if (name === 'PTTL') return -1n
    if (name === 'HPTTL') return [-1n]
    if (name === 'STRLEN') return 3n
    if (name === 'GETRANGE' || name === 'HGET') return Buffer.from(updated ? 'new' : 'old')
    if (name === 'SET' || name === 'HSET') return 'QUEUED'
    if (name === 'EXEC') { if (updated) return []; updated = true; return [request.type === 'string' ? 'OK' : 0n] }
    return 'OK'
  }
  return {
    calls, controller, get closed() { return closed }, get submitted() { return submitted }, get sampledAt() { return sampledAt },
    setOverride(value: (name: string) => RedisReply | Error | undefined) { override = value },
    run: () => runRedisReplace(request, send, () => { closed = true }, controller.signal, () => undefined, () => { submitted = true }, value => { if (failReadback) throw new Error('record failure'); sampledAt = value }),
  }
}

describe('fixed Redis write transaction', () => {
  it('does not leak raw server errors from proposal sampling', async () => {
    const sample = { type: 'string' as const, key: Buffer.from('key') }
    await expect(runRedisSample(sample, async (_args, before) => { before(); throw new Error('private-server-secret') }, () => undefined, new AbortController().signal, () => undefined)).rejects.toThrow('前态采样失败')
    try { await runRedisSample(sample, async () => { throw new Error('private-server-secret') }, () => undefined, new AbortController().signal, () => undefined) } catch (error) { expect(String(error)).not.toContain('private-server-secret') }
  })
  it.each([input, { ...input, type: 'hash' as const, field: Buffer.from('field') }])('updates and reads back an existing $type target', async request => {
    const f = fixture(request)
    expect(await f.run()).toBe('written-verified')
    expect(f.submitted).toBe(true)
    expect(f.sampledAt).toEqual(expect.any(String))
    expect(Number.isFinite(Date.parse(f.sampledAt!))).toBe(true)
    expect(f.closed).toBe(false)
    expect(f.calls.filter(name => name === 'SET' || name === 'HSET')).toEqual([request.type === 'string' ? 'SET' : 'HSET'])
    expect(f.calls).toContain('WATCH')
    expect(f.calls).toContain('EXEC')
  })

  it('does not enqueue a write when the preflight value or TTL differs', async () => {
    for (const refused of ['PTTL', 'GETRANGE']) {
      const f = fixture()
      f.setOverride(name => name === refused ? (name === 'PTTL' ? 5n : Buffer.from('different')) : undefined)
      expect(await f.run()).toBe('conflict')
      expect(f.calls).toContain('UNWATCH')
      expect(f.calls).not.toContain('MULTI')
      expect(f.submitted).toBe(false)
    }
    const f = fixture({ ...input, type: 'hash', field: Buffer.from('field') })
    f.setOverride(name => name === 'HPTTL' ? [1000n] : undefined)
    expect(await f.run()).toBe('conflict')
    expect(f.calls).not.toContain('HSET')
  })

  it('cancels before EXEC and discards the transaction without writing', async () => {
    const f = fixture()
    f.setOverride(name => { if (name === 'SET') f.controller.abort(); return undefined })
    expect(await f.run()).toBe('not-executed')
    expect(f.submitted).toBe(false)
    expect(f.calls).not.toContain('EXEC')
    expect(f.calls).toContain('DISCARD')
  })

  it('continues readback after cancellation when EXEC was already dispatched', async () => {
    const f = fixture()
    f.setOverride(name => { if (name === 'EXEC') f.controller.abort(); return undefined })
    expect(await f.run()).toBe('written-verified')
    expect(f.submitted).toBe(true)
  })

  it('distinguishes lost EXEC, explicit command error, and failed post-write readback', async () => {
    const lost = fixture()
    lost.setOverride(name => name === 'EXEC' ? new Error('socket lost') : undefined)
    expect(await lost.run()).toBe('unknown')
    expect(lost.closed).toBe(true)
    const denied = fixture()
    denied.setOverride(name => name === 'EXEC' ? [new RedisReplyError('NOPERM')] : undefined)
    expect(await denied.run()).toBe('rejected')
    let types = 0
    const readback = fixture()
    readback.setOverride(name => name === 'TYPE' && ++types === 2 ? new Error('socket lost') : undefined)
    expect(await readback.run()).toBe('written-unverified')
  })

  it('treats an EXEC watch conflict as not written', async () => {
    const f = fixture()
    f.setOverride(name => name === 'EXEC' ? null : undefined)
    expect(await f.run()).toBe('conflict')
    expect(f.closed).toBe(false)
  })

  it('does not claim a verified readback if the value changed during sampling', async () => {
    const f = fixture()
    let executes = 0
    f.setOverride(name => name === 'EXEC' && ++executes === 2 ? null : undefined)
    expect(await f.run()).toBe('written-unverified')
    expect(f.sampledAt).toBeNull()
    expect(f.closed).toBe(false)
  })

  it('retains an observed mismatch when recording the sample time fails', async () => {
    const matched = fixture(input, true)
    expect(await matched.run()).toBe('written-unverified')
    const mismatch = fixture(input, true)
    let reads = 0
    mismatch.setOverride(name => name === 'GETRANGE' && ++reads === 2 ? Buffer.from('bad') : undefined)
    expect(await mismatch.run()).toBe('written-mismatch')
  })

  it('keeps the unknown outcome if connection cleanup throws after EXEC is sent', async () => {
    const send = async (args: readonly RedisArgument[], before: () => void): Promise<RedisReply> => {
      before()
      const name = String(args[0])
      if (name === 'INFO') return Buffer.from('redis_version:8.2.6\r\n')
      if (name === 'TYPE') return 'string'
      if (name === 'PTTL') return -1n
      if (name === 'STRLEN') return 3n
      if (name === 'GETRANGE') return Buffer.from('old')
      if (name === 'SET') return 'QUEUED'
      if (name === 'EXEC') throw new Error('lost')
      return 'OK'
    }
    expect(await runRedisReplace(input, send, () => { throw new Error('close listener') }, new AbortController().signal, () => undefined, () => undefined, () => undefined)).toBe('unknown')
  })
})
