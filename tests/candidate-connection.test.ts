import { describe, expect, it, vi } from 'vitest'
import { RedisConnections, type RedisLink, type RedisOpener } from '../src/host/connection-service.ts'
import type { ConnectionErrorCode, ConnectionRequest, ConnectionView } from '../src/domain.ts'

const settings: ConnectionRequest = { host: 'fixture', port: 6379, username: '', password: 'synthetic-secret', tls: null }
const signal = () => new AbortController().signal
const allow = () => true
const accept = async (_signal: AbortSignal, commit: () => undefined) => { commit(); return true }
function target(view: ConnectionView) {
  if (view.id === null) throw new Error('Expected a connection identity')
  return { id: view.id, generation: view.generation }
}
function link() {
  const listeners = new Set<(code: ConnectionErrorCode) => void>()
  const close = vi.fn()
  const transport: RedisLink = { close, execute: async () => null, onFailure: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } }
  return { transport, close, fail: (code: ConnectionErrorCode) => { for (const listener of listeners) listener(code) } }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

describe('internal candidate connection lifecycle', () => {
  it('commits only after validation and then closes the old connection', async () => {
    const old = link(), candidate = link(), validation = deferred<boolean>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.connectCandidate('a', { ...settings, host: 'replacement' }, signal(), async (_signal, commit) => { if (!await validation.promise) return false; commit(); return true }, allow)
      await Promise.resolve()
      expect(service.status('a')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
      validation.resolve(true)
      const result = await pending
      expect(result.state).toBe('connected')
      if (result.state !== 'connected') throw new Error('Expected a candidate connection')
      expect(result.view.id).toBe(before.id)
      expect(result.view.generation).toBeGreaterThan(before.generation)
      expect(result.view.target?.host).toBe('replacement')
      expect(result.previousRelease).toBe('closed')
      expect(old.close).toHaveBeenCalledTimes(1)
      expect(service.disconnect('a', target(before)).error).toBe('stale')
      expect(candidate.close).not.toHaveBeenCalled()
      candidate.fail('network')
      expect(service.status('a')).toMatchObject({ state: 'error', error: 'network' })
      expect(candidate.close).toHaveBeenCalledTimes(1)
    } finally { service.dispose() }
  })

  it.each(['reject', 'throw'] as const)('preserves the old link when validation does %s', async mode => {
    const old = link(), candidate = link()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const result = await service.connectCandidate('a', settings, signal(), async () => {
        if (mode === 'throw') throw new Error('synthetic-secret')
        return false
      }, allow)
      expect(result.state).toBe('failed')
      expect(JSON.stringify(result)).not.toContain(settings.password)
      expect(service.status('a')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
      expect(candidate.close).toHaveBeenCalledTimes(1)
    } finally { service.dispose() }
  })

  it('closes a socket returned after cancellation even when the opener ignores the signal', async () => {
    const old = link(), candidate = link(), opening = deferred<RedisLink>(), controller = new AbortController()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockReturnValueOnce(opening.promise)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const validate = vi.fn(accept)
      const pending = service.connectCandidate('a', settings, controller.signal, validate, allow)
      controller.abort(); opening.resolve(candidate.transport)
      expect(await pending).toEqual({ state: 'failed', error: 'cancelled' })
      expect(validate).not.toHaveBeenCalled()
      expect(candidate.close).toHaveBeenCalledTimes(1)
      expect(old.close).not.toHaveBeenCalled()
      expect(service.status('a')).toEqual(before)
    } finally { service.dispose() }
  })

  it('closes a failed candidate while validation is waiting and keeps the old link', async () => {
    const old = link(), candidate = link(), validation = deferred<boolean>(), started = deferred<void>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.connectCandidate('a', settings, signal(), () => { started.resolve(); return validation.promise }, allow)
      await started.promise
      candidate.fail('network')
      expect(candidate.close).toHaveBeenCalledTimes(1)
      validation.resolve(true)
      expect(await pending).toEqual({ state: 'failed', error: 'network' })
      expect(service.status('a')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('rejects an obsolete candidate after a manual replacement without affecting another session', async () => {
    const old = link(), other = link(), candidate = link(), replacement = link(), opening = deferred<RedisLink>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(other.transport).mockReturnValueOnce(opening.promise).mockResolvedValueOnce(replacement.transport)
    const service = new RedisConnections(open)
    try {
      await service.connect('a', settings, signal())
      const b = await service.connect('b', settings, signal())
      const pending = service.connectCandidate('a', settings, signal(), accept, allow)
      const newest = await service.connect('a', settings, signal())
      opening.resolve(candidate.transport)
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      expect(service.status('a')).toEqual(newest)
      expect(service.status('b')).toEqual(b)
      expect(candidate.close).toHaveBeenCalledTimes(1)
      expect(replacement.close).not.toHaveBeenCalled()
      expect(other.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('cancels a candidate for an empty session on disposal and does not disturb a different session', async () => {
    const other = link(), candidate = link(), opening = deferred<RedisLink>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(other.transport).mockReturnValueOnce(opening.promise)
    const service = new RedisConnections(open)
    try {
      const b = await service.connect('b', settings, signal())
      const pending = service.connectCandidate('a', settings, signal(), accept, allow)
      service.disposeSession('a')
      opening.resolve(candidate.transport)
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      expect(candidate.close).toHaveBeenCalledTimes(1)
      expect(service.status('b')).toEqual(b)
      expect(other.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('cancels an empty-session candidate on disconnect without affecting another session', async () => {
    const other = link(), candidate = link(), opening = deferred<RedisLink>()
    const service = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(other.transport).mockReturnValueOnce(opening.promise))
    try {
      const otherView = await service.connect('b', settings, signal())
      const pending = service.connectCandidate('a', settings, signal(), accept, allow)
      expect(service.disconnect('a', { id: 'no-live-record', generation: 1 }).state).toBe('disconnected')
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      opening.resolve(candidate.transport)
      await Promise.resolve()
      expect(candidate.close).toHaveBeenCalledTimes(1)
      expect(service.status('b')).toEqual(otherView)
      expect(other.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('cancels an empty-session preflight before it opens a socket', async () => {
    const check = deferred<boolean>(), open = vi.fn<RedisOpener>()
    const service = new RedisConnections(open)
    try {
      const pending = service.connectCandidate('a', settings, signal(), accept, () => check.promise)
      service.disconnect('a', { id: 'no-live-record', generation: 1 })
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      check.resolve(true)
      await Promise.resolve()
      expect(open).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('does not let a stale disconnect cancel a live session candidate', async () => {
    const old = link(), candidate = link(), opening = deferred<RedisLink>()
    const service = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockReturnValueOnce(opening.promise))
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.connectCandidate('a', { ...settings, host: 'new.fixture' }, signal(), accept, allow)
      expect(service.disconnect('a', { ...target(before), generation: before.generation + 1 }).error).toBe('stale')
      opening.resolve(candidate.transport)
      expect(await pending).toMatchObject({ state: 'connected', view: { target: { host: 'new.fixture' } } })
      expect(candidate.close).not.toHaveBeenCalled()
      expect(old.close).toHaveBeenCalledTimes(1)
    } finally { service.dispose() }
  })

  it('allows only the newest candidate to commit in the same session', async () => {
    const old = link(), late = link(), newest = link(), opening = deferred<RedisLink>()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockReturnValueOnce(opening.promise).mockResolvedValueOnce(newest.transport)
    const service = new RedisConnections(open)
    try {
      await service.connect('a', settings, signal())
      const first = service.connectCandidate('a', settings, signal(), accept, allow)
      const second = await service.connectCandidate('a', { ...settings, host: 'newest' }, signal(), accept, allow)
      opening.resolve(late.transport)
      expect(await first).toEqual({ state: 'failed', error: 'stale' })
      expect(second.state).toBe('connected')
      expect(service.status('a').target?.host).toBe('newest')
      expect(late.close).toHaveBeenCalledTimes(1)
      expect(old.close).toHaveBeenCalledTimes(1)
      expect(newest.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it.each(['disconnect', 'selectDatabase'] as const)('cancels an in-flight candidate when the owner performs %s', async action => {
    const old = link(), candidate = link(), opening = deferred<RedisLink>()
    const selecting: RedisLink = { ...old.transport, execute: async () => 'OK' }
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(selecting).mockReturnValueOnce(opening.promise)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.connectCandidate('a', settings, signal(), accept, allow)
      const current = action === 'disconnect' ? service.disconnect('a', target(before)) : await service.selectDatabase('a', { ...target(before), db: 2 }, signal())
      opening.resolve(candidate.transport)
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      expect(service.status('a')).toEqual(current)
      expect(candidate.close).toHaveBeenCalledTimes(1)
      expect(current.state).toBe(action === 'disconnect' ? 'disconnected' : 'connected')
      if (action === 'selectDatabase') { expect(current.db).toBe(2); expect(old.close).not.toHaveBeenCalled() }
    } finally { service.dispose() }
  })

  it('reports a fixed authentication error without replacing the old connection', async () => {
    const old = link()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockRejectedValueOnce(new Error('WRONGPASS ' + settings.password))
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const result = await service.connectCandidate('a', settings, signal(), accept, allow)
      expect(result).toEqual({ state: 'failed', error: 'auth' })
      expect(JSON.stringify(result)).not.toContain(settings.password)
      expect(service.status('a')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('does not replace a connection while its manual connect is pending', async () => {
    const opening = deferred<RedisLink>(), manual = link()
    const open = vi.fn<RedisOpener>().mockReturnValueOnce(opening.promise)
    const service = new RedisConnections(open)
    try {
      const pending = service.connect('a', settings, signal())
      expect(await service.connectCandidate('a', settings, signal(), accept, allow)).toEqual({ state: 'failed', error: 'stale' })
      expect(open).toHaveBeenCalledTimes(1)
      opening.resolve(manual.transport)
      expect((await pending).state).toBe('connected')
      expect(manual.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('does not replace a connection while SELECT is pending', async () => {
    const old = link(), selecting = deferred<'OK'>(), entered = deferred<void>()
    const transport: RedisLink = { ...old.transport, execute: async () => { entered.resolve(); return selecting.promise } }
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(transport)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.selectDatabase('a', { ...target(before), db: 2 }, signal())
      await entered.promise
      expect(await service.connectCandidate('a', settings, signal(), accept, allow)).toEqual({ state: 'failed', error: 'stale' })
      expect(open).toHaveBeenCalledTimes(1)
      selecting.resolve('OK')
      expect(await pending).toMatchObject({ state: 'connected', db: 2 })
      expect(old.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('returns on cancellation before a non-cooperative opener settles and closes its late socket', async () => {
    const old = link(), late = link(), opening = deferred<RedisLink>(), controller = new AbortController()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockReturnValueOnce(opening.promise)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.connectCandidate('a', settings, controller.signal, accept, allow)
      controller.abort()
      expect(await pending).toEqual({ state: 'failed', error: 'cancelled' })
      expect(service.status('a')).toEqual(before)
      opening.resolve(late.transport)
      await Promise.resolve()
      expect(late.close).toHaveBeenCalledTimes(1)
      expect(old.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it.each(['recovers', 'always fails'] as const)('retries a late socket after disposal when close %s', async mode => {
    const opening = deferred<RedisLink>()
    const close = vi.fn(() => { if (mode === 'always fails' || close.mock.calls.length === 1) throw new Error('synthetic-secret') })
    const late: RedisLink = { close, execute: async () => null, onFailure: () => () => undefined }
    const service = new RedisConnections(vi.fn<RedisOpener>().mockReturnValueOnce(opening.promise))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const pending = service.connectCandidate('a', settings, signal(), accept, allow)
      service.dispose()
      expect(await pending).toEqual({ state: 'failed', error: 'stale' })
      opening.resolve(late)
      await Promise.resolve()
      expect(close).toHaveBeenCalledTimes(2)
      expect(warn).toHaveBeenCalledTimes(mode === 'recovers' ? 1 : 2)
      expect(JSON.stringify(warn.mock.calls)).not.toContain('synthetic-secret')
      // A persistent failure remains retained for any later explicit disposal.
      service.dispose()
      expect(close).toHaveBeenCalledTimes(mode === 'recovers' ? 2 : 3)
    } finally { warn.mockRestore() }
  })

  it('returns on cancellation while validation ignores the signal and observes its later rejection', async () => {
    const old = link(), candidate = link(), validation = deferred<boolean>(), started = deferred<void>(), controller = new AbortController()
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport)
    const service = new RedisConnections(open)
    try {
      const before = await service.connect('a', settings, signal())
      const pending = service.connectCandidate('a', settings, controller.signal, () => { started.resolve(); return validation.promise }, allow)
      await started.promise
      controller.abort()
      expect(await pending).toEqual({ state: 'failed', error: 'cancelled' })
      expect(candidate.close).toHaveBeenCalledTimes(1)
      validation.reject(new Error('synthetic late failure'))
      await Promise.resolve()
      expect(service.status('a')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it.each(['throw', 'abort'] as const)('reports an actual exchange when the gate later does %s', async mode => {
    const old = link(), candidate = link(), controller = new AbortController()
    const service = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport))
    try {
      await service.connect('a', settings, signal())
      const result = await service.connectCandidate('a', { ...settings, host: 'replacement' }, controller.signal, async (_signal, commit) => {
        commit()
        if (mode === 'throw') throw new Error('synthetic gate failure')
        controller.abort()
        return true
      }, allow)
      expect(result).toMatchObject({ state: 'connected', previousRelease: 'closed', view: { target: { host: 'replacement' } } })
      expect(service.status('a').target?.host).toBe('replacement')
      expect(old.close).toHaveBeenCalledTimes(1)
      expect(candidate.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it('ignores a commit callback retained after its gate has ended', async () => {
    const old = link(), candidate = link()
    const service = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport))
    let late: (() => undefined) | undefined
    try {
      const before = await service.connect('a', settings, signal())
      expect(await service.connectCandidate('a', settings, signal(), async (_signal, commit) => { late = commit; return false }, allow)).toEqual({ state: 'failed', error: 'stale' })
      late?.()
      expect(service.status('a')).toEqual(before)
      expect(old.close).not.toHaveBeenCalled()
      expect(candidate.close).toHaveBeenCalledTimes(1)
    } finally { service.dispose() }
  })

  it('reports the current error when the exchanged connection fails before the gate returns', async () => {
    const old = link(), candidate = link()
    const service = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport))
    try {
      await service.connect('a', settings, signal())
      const result = await service.connectCandidate('a', settings, signal(), async (_signal, commit) => { commit(); candidate.fail('network'); return true }, allow)
      expect(result).toMatchObject({ state: 'changed', previousRelease: 'closed', view: { state: 'error', error: 'network' } })
      expect(service.status('a')).toMatchObject({ state: 'error', error: 'network' })
      expect(old.close).toHaveBeenCalledTimes(1)
      expect(candidate.close).toHaveBeenCalledTimes(1)
    } finally { service.dispose() }
  })

  it('reports the newer connection when another operation replaces the committed candidate', async () => {
    const old = link(), candidate = link(), replacement = link()
    const service = new RedisConnections(vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate.transport).mockResolvedValueOnce(replacement.transport))
    try {
      await service.connect('a', settings, signal())
      const result = await service.connectCandidate('a', settings, signal(), async (_signal, commit) => {
        commit()
        await service.connect('a', { ...settings, host: 'newest' }, signal())
        return true
      }, allow)
      expect(result).toMatchObject({ state: 'changed', previousRelease: 'closed', view: { state: 'connected', target: { host: 'newest' } } })
      expect(candidate.close).toHaveBeenCalledTimes(1)
      expect(replacement.close).not.toHaveBeenCalled()
    } finally { service.dispose() }
  })

  it.each(['unsubscribe', 'close'] as const)('reports a successful swap and retries a failed old %s', async failed => {
    const old = link(), candidate = link()
    const unsubscribe = vi.fn(() => { if (failed === 'unsubscribe' && unsubscribe.mock.calls.length === 1) throw new Error('secret') })
    const close = vi.fn(() => { if (failed === 'close' && close.mock.calls.length === 1) throw new Error('secret') })
    const transport: RedisLink = { ...old.transport, close, onFailure: () => unsubscribe }
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(transport).mockResolvedValueOnce(candidate.transport)
    const service = new RedisConnections(open)
    const before = await service.connect('a', settings, signal())
    const result = await service.connectCandidate('a', { ...settings, host: 'replacement' }, signal(), accept, allow)
    expect(result).toMatchObject({ state: 'connected', previousRelease: 'uncertain', view: { id: before.id, state: 'connected' } })
    expect(service.status('a').target?.host).toBe('replacement')
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    service.dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(failed === 'unsubscribe' ? 2 : 1)
    expect(close).toHaveBeenCalledTimes(failed === 'close' ? 2 : 1)
    service.dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(failed === 'unsubscribe' ? 2 : 1)
    expect(close).toHaveBeenCalledTimes(failed === 'close' ? 2 : 1)
  })

  it('continues candidate cleanup when unsubscribe and close both fail and retries only the failed resources', async () => {
    const old = link(), started = deferred<void>(), validation = deferred<boolean>(), controller = new AbortController()
    const unsubscribe = vi.fn(() => { if (unsubscribe.mock.calls.length === 1) throw new Error('secret') })
    const close = vi.fn(() => { if (close.mock.calls.length === 1) throw new Error('secret') })
    const candidate: RedisLink = { close, execute: async () => null, onFailure: () => unsubscribe }
    const open = vi.fn<RedisOpener>().mockResolvedValueOnce(old.transport).mockResolvedValueOnce(candidate)
    const service = new RedisConnections(open)
    const before = await service.connect('a', settings, signal())
    const pending = service.connectCandidate('a', settings, controller.signal, () => { started.resolve(); return validation.promise }, allow)
    await started.promise
    controller.abort()
    expect(await pending).toEqual({ state: 'failed', error: 'cancelled' })
    expect(unsubscribe).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(2)
    expect(service.status('a')).toEqual(before)
    expect(old.close).not.toHaveBeenCalled()
    service.dispose()
    expect(unsubscribe).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(2)
  })
})
