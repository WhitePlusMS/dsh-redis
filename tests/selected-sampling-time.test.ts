import { expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink } from '../src/host/connection-service.ts'
import { RedisSelectedReader } from '../src/host/selected-reader.ts'
import { RedisLists } from '../src/host/list-reader.ts'
import type { RedisSelectionItem } from '../src/domain.ts'

it.each(['hash', 'set', 'zset', 'list'] as const)('preserves the %s point-read time when later metadata is delayed', async kind => {
  const sampled = new Date('2026-01-01T00:00:00.000Z'), later = new Date('2026-01-01T00:00:05.000Z')
  let present = true, ttlCalls = 0
  const link: RedisLink = {
    close: () => undefined, onFailure: () => () => undefined,
    async execute(command, _args, signal, guard) {
      signal.throwIfAborted(); guard()
      if (command === 'TYPE') return kind
      if (command === 'PTTL') { ttlCalls++; if (kind !== 'list' || ttlCalls % 2 === 0) vi.setSystemTime(later); return -1n }
      if (command === 'HGET') return present ? Buffer.from('value') : null
      if (command === 'SISMEMBER') return present ? 1n : 0n
      if (command === 'ZSCORE') return present ? Buffer.from('1.5') : null
      if (command === 'LLEN') return present ? 1n : 0n
      if (command === 'LRANGE') return present ? [Buffer.from('value')] : []
      throw new Error('Unexpected synthetic Redis command')
    },
  }
  const connections = new RedisConnections(async () => link), signal = new AbortController().signal
  try {
    const connection = await connections.connect('fixture', { host: 'fixture', port: 6379, username: '', password: '', tls: null }, signal)
    if (connection.id === null) throw new Error('Missing connection')
    const target = { id: connection.id, generation: connection.generation, db: 0 }
    const item: RedisSelectionItem = kind === 'hash' ? { kind, fieldBase64: 'Zg==' } : kind === 'list' ? { kind, index: '0' } : { kind, memberBase64: 'bQ==' }
    vi.useFakeTimers()
    for (const exists of [true, false]) {
      present = exists; ttlCalls = 0; vi.setSystemTime(sampled)
      const result = await new RedisSelectedReader(connections).read('fixture', target, 'aw==', item, signal)
      expect(result).toMatchObject({ state: exists ? 'value' : 'selection-missing', sampledAt: sampled.toISOString() })
      expect(new Date().toISOString()).toBe(later.toISOString())
    }
    if (kind === 'list') {
      present = true; ttlCalls = 0; vi.setSystemTime(sampled)
      const page = await new RedisLists(connections).read('fixture', { target, keyBase64: 'aw==', offset: '0', count: 1 }, signal)
      expect(page).toMatchObject({ state: 'page', sampledAt: sampled.toISOString() })
    }
  } finally { vi.useRealTimers(); connections.dispose() }
})
