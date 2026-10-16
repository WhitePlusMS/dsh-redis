import { describe, expect, it } from 'vitest'
import { RedisBrowsingStates, emptyBrowsingState } from '../src/host/browsing-state.ts'
import { browsingStateSchema } from '../src/typert.shared.ts'
import { redisHostDescriptors } from '../src/typert.host.ts'
import { SessionStateQueue } from '../src/client/session-state-queue.ts'
const signal = () => new AbortController().signal

function gate() {
  let release: () => void = () => { throw new Error('Gate not initialized') }
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}
describe('trusted-session browsing choices', () => {
  it('isolates two sessions, returns detached objects, and disposes only its owner', () => {
    const states = new RedisBrowsingStates(), a = { ...emptyBrowsingState(), profileId: 'shared-config', db: 1, pattern: 'orders:*', keyBase64: Buffer.from([0, 255, 128]).toString('base64') }
    states.save('a', a, signal())
    states.save('b', { ...emptyBrowsingState(), profileId: 'shared-config', db: 3, pattern: 'b:*' }, signal())
    Reflect.set(a.formats, 'string', 'hex')
    const view = states.load('a', signal()); Reflect.set(view.formats, 'json', 'base64')
    expect(states.load('a', signal())).toEqual({ ...a, formats: emptyBrowsingState().formats })
    states.disposeSession('a')
    expect(states.load('a', signal())).toEqual(emptyBrowsingState())
    expect(states.load('b', signal())).toMatchObject({ db: 3, pattern: 'b:*' })
    states.dispose(); expect(states.load('b', signal())).toEqual(emptyBrowsingState())
  })
  it('distinguishes empty-key selection from none and preserves exact maximum bytes/window', () => {
    const states = new RedisBrowsingStates()
    for (const keyBase64 of [null, '', Buffer.alloc(65536, 255).toString('base64')]) {
      const value = { ...emptyBrowsingState(), keyBase64, stringOffset: '9223372036854775807', stringCount: 256 }
      expect(states.save('a', value, signal())).toEqual(value)
      expect(states.load('a', signal()).keyBase64).toBe(keyBase64)
    }
    expect(new RedisBrowsingStates().load('a', signal())).toEqual(emptyBrowsingState())
  })
  it('does not read or mutate after cancellation', () => {
    const states = new RedisBrowsingStates(), controller = new AbortController(); controller.abort()
    expect(() => states.save('a', { ...emptyBrowsingState(), db: 9 }, controller.signal)).toThrow()
    expect(() => states.load('a', controller.signal)).toThrow()
    expect(states.load('a', signal()).db).toBe(0)
  })
  it('rejects ownership, values, secrets, live target and cursor fields on both protocol faces', () => {
    const codec = redisHostDescriptors.find(value => value.method === 'saveBrowsingState')?.parameters.find(value => value.name === 'request')?.codec
    const result = redisHostDescriptors.find(value => value.method === 'loadBrowsingState')?.result
    if (codec?.mode !== 'strict' || result?.mode !== 'strict') throw new Error('Missing browsing codecs')
    for (const schema of [browsingStateSchema, codec.create(), result.create()]) {
      expect(schema.parse(emptyBrowsingState())).toEqual(emptyBrowsingState())
      for (const field of ['sessionId', 'agentId', 'password', 'value', 'target', 'cursor', 'caPem']) expect(() => schema.parse({ ...emptyBrowsingState(), [field]: 'must-not-survive' })).toThrow()
      const valid = emptyBrowsingState()
      for (const value of [{ ...valid, db: -1 }, { ...valid, db: 65536 }, { ...valid, pattern: 'x'.repeat(257) }, { ...valid, profileId: '' }, { ...valid, keyBase64: 'YQ' }, { ...valid, keyBase64: Buffer.alloc(65537).toString('base64') }, { ...valid, formats: { ...valid.formats, string: 'yaml' } }, { ...valid, formats: { ...valid.formats, command: 'SET a b' } }, { ...valid, stringOffset: '9223372036854775808' }, { ...valid, stringCount: 257 }]) expect(() => schema.parse(value)).toThrow()
    }
  })
})
describe('preference request ordering across sidebar mounts', () => {
  it('loads after earlier same-session saves, while another session runs independently', async () => {
    const queue = new SessionStateQueue(), first = gate(), order: string[] = []
    const one = queue.run('a', async () => { order.push('a1-start'); await first.promise; order.push('a1-end') })
    const two = queue.run('a', async () => { order.push('a2') })
    const load = queue.run('a', async () => { order.push('a-load') })
    await queue.run('b', async () => { order.push('b') })
    expect(order).toEqual(['a1-start', 'b'])
    first.release(); await Promise.all([one, two, load])
    expect(order).toEqual(['a1-start', 'b', 'a1-end', 'a2', 'a-load'])
  })
  it('recovers the next same-session request after rejection without replaying the failed save', async () => {
    const queue = new SessionStateQueue(), order: string[] = []
    await expect(queue.run('a', async () => { order.push('failed'); throw new Error('offline') })).rejects.toThrow('offline')
    await expect(queue.run('a', async () => { order.push('read'); return 1 })).resolves.toBe(1)
    expect(order).toEqual(['failed', 'read'])
  })
})
