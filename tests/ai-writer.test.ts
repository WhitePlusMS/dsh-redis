import { afterEach, describe, expect, it, vi } from 'vitest'
import { RedisAiWriter, type RedisWriteInput } from '../src/host/ai-writer.ts'
import { RedisConnections, type RedisWritableLink } from '../src/host/connection-service.ts'
import type { ConnectionRequest } from '../src/domain.ts'
import { runRedisSample } from '../src/host/redis-write-transaction.ts'

const settings: ConnectionRequest = { host: 'fixture', port: 6379, username: '', password: 'fixture-secret', tls: null }
const input: RedisWriteInput = { type: 'string', keyBase64: 'aw==', fieldBase64: null, afterBase64: 'bmV3' }
const signal = () => new AbortController().signal
afterEach(() => vi.useRealTimers())

async function setup() {
  let value = Buffer.from('old'), fieldTtl = -1n, version = '8.2.6', submissions = 0, redisType: 'string' | 'hash' = 'string'
  let pause: (() => Promise<void>) | undefined
  let pauseWrite: (() => Promise<void>) | undefined, pauseAfterSubmit: (() => Promise<void>) | undefined, sampleConflict = false
  const link: RedisWritableLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute() { throw new Error('Unexpected read') },
    async sampleExisting(request, requestSignal, guard) {
      return runRedisSample(request, async (args, before) => {
        before()
        const command = String(args[0])
        if (command === 'INFO') return Buffer.from('redis_version:' + version + '\r\n')
        if (command === 'TYPE') return redisType
        if (command === 'PTTL') return -1n
        if (command === 'HPTTL') return [fieldTtl]
        if (command === 'STRLEN' || command === 'HSTRLEN') return BigInt(value.length)
        if (command === 'GETRANGE' || command === 'HGET') { await pause?.(); return Buffer.from(value) }
        if (command === 'EXEC') return sampleConflict ? null : []
        return 'OK'
      }, () => undefined, requestSignal, guard)
    },
    async replaceExisting(request, _signal, guard, submitted, readback) {
      guard(false); await pauseWrite?.(); guard(false); submitted(); submissions++
      value = Buffer.from(request.after)
      await pauseAfterSubmit?.(); guard(true)
      readback('2026-11-11T00:00:00.000Z')
      return 'written-verified'
    },
  }
  const connections = new RedisConnections(async () => link)
  const view = await connections.connect('a', settings, signal())
  if (view.id === null) throw new Error('Missing connection')
  const target = { id: view.id, generation: view.generation, db: view.db }
  const writer = new RedisAiWriter(connections)
  return { writer, connections, target, get value() { return value.toString() }, get submissions() { return submissions },
    setTtl(value: bigint) { fieldTtl = value }, setVersion(value: string) { version = value }, setType(value: 'string' | 'hash') { redisType = value }, setPause(value: () => Promise<void>) { pause = value }, setWritePause(value: () => Promise<void>) { pauseWrite = value }, setAfterSubmitPause(value: () => Promise<void>) { pauseAfterSubmit = value }, setSampleConflict() { sampleConflict = true },
    close() { writer.dispose(); connections.dispose() },
  }
}

describe('Host write coordination', () => {
  it('requires enablement, binds the complete proposal, executes once, and retains the result', async () => {
    const f = await setup()
    try {
      await expect(f.writer.prepare('a', f.target, '1', () => true, input, signal())).rejects.toThrow('未启用')
      f.writer.enable('a', f.target)
      const proposal = await f.writer.prepare('a', f.target, '1', () => true, input, signal())
      expect(proposal.beforeBase64).toBe('b2xk')
      await expect(f.writer.execute('a', '1', () => true, { ...proposal, afterBase64: 'YmFk' }, signal())).rejects.toThrow('提案')
      const record = await f.writer.execute('a', '1', () => true, proposal, signal())
      expect(record).toMatchObject({ state: 'written-verified', readbackAt: '2026-11-11T00:00:00.000Z', identity: { keyBase64: 'aw==' } })
      expect(f.value).toBe('new')
      expect(f.writer.status('a', proposal.id)).toEqual(record)
      expect(f.writer.status('b', proposal.id)).toBeNull()
      expect(JSON.stringify(record)).not.toContain('fixture-secret')
      await expect(f.writer.execute('a', '1', () => true, proposal, signal())).rejects.toThrow('提案')
      expect(f.submissions).toBe(1)
    } finally { f.close() }
  })

  it('rejects unsupported versions and field expiration before issuing a proposal', async () => {
    const f = await setup()
    try {
      f.writer.enable('a', f.target)
      f.setVersion('7.2.0')
      await expect(f.writer.prepare('a', f.target, '1', () => true, input, signal())).rejects.toThrow('版本')
      f.setVersion('8.2.6'); f.setType('hash'); f.setTtl(100n)
      const hash = { ...input, type: 'hash' as const, fieldBase64: 'Zg==' }
      await expect(f.writer.prepare('a', f.target, '1', () => true, hash, signal())).rejects.toThrow('字段不存在或有过期时间')
      expect(f.submissions).toBe(0)
    } finally { f.close() }
  })

  it('does not issue a proposal when a delayed read outlives its enable cycle', async () => {
    const f = await setup()
    let release!: () => void, entered!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    try {
      f.writer.enable('a', f.target)
      f.setPause(async () => { entered(); await waiting })
      const pending = f.writer.prepare('a', f.target, '1', () => true, input, signal())
      await started
      f.writer.disable('a'); f.writer.enable('a', f.target)
      release()
      await expect(pending).rejects.toThrow()
      expect(f.submissions).toBe(0)
    } finally { f.close() }
  })

  it('refuses an inconsistent sample and an operation that expires before dispatch', async () => {
    vi.useFakeTimers()
    const f = await setup()
    let release!: () => void, entered!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    try {
      f.writer.enable('a', f.target)
      const proposal = await f.writer.prepare('a', f.target, '1', () => true, input, signal())
      f.setWritePause(async () => { entered(); await waiting })
      const pending = f.writer.execute('a', '1', () => true, proposal, signal())
      await started
      vi.advanceTimersByTime(60_000)
      release()
      expect((await pending).state).toBe('not-executed')
      expect(f.submissions).toBe(0)
      f.setSampleConflict()
      await expect(f.writer.prepare('a', f.target, '1', () => true, input, signal())).rejects.toThrow('并发变化')
    } finally { f.close() }
  })

  it('continues original-connection readback after submission even if the turn ends and the proposal expires', async () => {
    vi.useFakeTimers()
    const f = await setup()
    let release!: () => void, entered!: () => void, current = true
    const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    try {
      f.writer.enable('a', f.target)
      const proposal = await f.writer.prepare('a', f.target, '1', () => current, input, signal())
      f.setAfterSubmitPause(async () => { entered(); await waiting })
      const pending = f.writer.execute('a', '1', () => current, proposal, signal())
      await started
      current = false; f.writer.endTurn('a', '1'); vi.advanceTimersByTime(60_000)
      release()
      expect((await pending).state).toBe('written-verified')
      expect(f.submissions).toBe(1)
    } finally { f.close() }
  })
})
