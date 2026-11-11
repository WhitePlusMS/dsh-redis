import { describe, expect, it } from 'vitest'
import { RedisConnections, type RedisWritableLink } from '../src/host/connection-service.ts'
import type { ConnectionRequest } from '../src/domain.ts'

const settings: ConnectionRequest = { host: 'fixture', port: 6379, username: '', password: '', tls: null }
const request = { type: 'string' as const, key: Buffer.from('key'), before: Buffer.from('old'), after: Buffer.from('new') }
const signal = () => new AbortController().signal

describe('write connection ownership', () => {
  it('rejects foreign or changed targets and keeps a successful result on its original connection', async () => {
    let submissions = 0
    const link: RedisWritableLink = { close: () => undefined, onFailure: () => () => undefined, execute: async () => 'OK',
      async replaceExisting(_request, _signal, guard, submitted) { guard(); submitted(); return 'written-verified' },
    }
    const connections = new RedisConnections(async () => link)
    try {
      const view = await connections.connect('a', settings, signal())
      if (view.id === null) throw new Error('Missing connection')
      const target = { id: view.id, generation: view.generation, db: view.db }
      expect(await connections.replaceExisting('b', target, request, signal(), () => undefined, () => { submissions++ })).toBe('not-executed')
      expect(await connections.replaceExisting('a', { ...target, db: 1 }, request, signal(), () => undefined, () => { submissions++ })).toBe('not-executed')
      expect(await connections.replaceExisting('a', target, request, signal(), () => undefined, () => { submissions++ })).toBe('written-verified')
      expect(submissions).toBe(1)
      await connections.selectDatabase('a', { ...target, db: 1 }, signal())
      expect(await connections.replaceExisting('a', target, request, signal(), () => undefined, () => { submissions++ })).toBe('not-executed')
      expect(submissions).toBe(1)
    } finally { connections.dispose() }
  })

  it('refuses a stale queued write before it can submit', async () => {
    let release!: () => void, entered!: () => void, submissions = 0
    const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    const link: RedisWritableLink = { close: () => undefined, onFailure: () => () => undefined, execute: async () => 'OK',
      async replaceExisting(_request, _signal, guard, submitted) { guard(); entered(); await waiting; guard(); submitted(); return 'unknown' },
    }
    const connections = new RedisConnections(async () => link)
    try {
      const view = await connections.connect('a', settings, signal())
      if (view.id === null) throw new Error('Missing connection')
      const target = { id: view.id, generation: view.generation, db: view.db }
      const pending = connections.replaceExisting('a', target, request, signal(), () => undefined, () => { submissions++ })
      await started
      await connections.selectDatabase('a', { ...target, db: 1 }, signal())
      release()
      expect(await pending).toBe('not-executed')
      expect(submissions).toBe(0)
    } finally { connections.dispose() }
  })

  it('does not convert an uncertain submitted write to not-executed after disconnect', async () => {
    let release!: () => void, entered!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    const link: RedisWritableLink = { close: () => undefined, onFailure: () => () => undefined, execute: async () => 'OK',
      async replaceExisting(_request, _signal, guard, submitted) { guard(); submitted(); entered(); await waiting; throw new Error('receipt lost') },
    }
    const connections = new RedisConnections(async () => link)
    try {
      const view = await connections.connect('a', settings, signal())
      if (view.id === null) throw new Error('Missing connection')
      const target = { id: view.id, generation: view.generation, db: view.db }
      const pending = connections.replaceExisting('a', target, request, signal(), () => undefined, () => undefined)
      await started
      connections.disconnect('a', target)
      release()
      expect(await pending).toBe('unknown')
    } finally { connections.dispose() }
  })

  it.each([false, true])('keeps the correct old-connection result after reconnect, submitted=%s', async alreadySubmitted => {
    let release!: () => void, entered!: () => void, submissions = 0
    const waiting = new Promise<void>(resolve => { release = resolve }), started = new Promise<void>(resolve => { entered = resolve })
    const old: RedisWritableLink = { close: () => undefined, onFailure: () => () => undefined, execute: async () => 'OK',
      async replaceExisting(_request, _signal, guard, submitted) {
        guard()
        if (alreadySubmitted) submitted()
        entered(); await waiting
        if (!alreadySubmitted) { guard(); submitted() }
        return 'written-verified'
      },
    }
    const replacement: RedisWritableLink = { close: () => undefined, onFailure: () => () => undefined, execute: async () => 'OK',
      async replaceExisting() { throw new Error('Replacement must not inherit old work') },
    }
    let opened = 0
    const connections = new RedisConnections(async () => ++opened === 1 ? old : replacement)
    try {
      const view = await connections.connect('a', settings, signal())
      if (view.id === null) throw new Error('Missing connection')
      const target = { id: view.id, generation: view.generation, db: view.db }
      const pending = connections.replaceExisting('a', target, request, signal(), () => undefined, () => { submissions++ })
      await started
      const current = await connections.connect('a', settings, signal())
      expect(current.generation).toBeGreaterThan(view.generation)
      release()
      expect(await pending).toBe(alreadySubmitted ? 'written-verified' : 'not-executed')
      expect(submissions).toBe(alreadySubmitted ? 1 : 0)
    } finally { connections.dispose() }
  })
})
