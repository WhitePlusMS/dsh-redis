import { expect, it, vi } from 'vitest'
import { showRedisPane, UiPanePresence } from '../src/client/ui-pane-presence.ts'

it('waits for the actual pane and isolates sessions', async () => {
  const presence = new UiPanePresence(), open = vi.fn(), signal = new AbortController()
  const result = showRedisPane(presence, 'a', () => true, open, Date.now() + 10000, signal.signal)
  expect(open).toHaveBeenCalledOnce()
  const other = presence.attach('b')
  const own = presence.attach('a')
  expect(await result).toBe('applied')
  own(); other()
})

it('does not report success after cancellation, session change or an ambiguous pane', async () => {
  const presence = new UiPanePresence(), signal = new AbortController(), open = vi.fn()
  const cancelled = showRedisPane(presence, 'a', () => true, open, Date.now() + 10000, signal.signal)
  signal.abort(); expect(await cancelled).toBe('stale')
  let current = true
  const changed = showRedisPane(presence, 'a', () => current, open, Date.now() + 10000, new AbortController().signal)
  current = false; const close = presence.attach('a'); expect(await changed).toBe('stale')
  const closeSecond = presence.attach('a')
  expect(await showRedisPane(presence, 'a', () => true, open, Date.now() + 10000, new AbortController().signal)).toBe('ambiguous')
  closeSecond(); close()
})

it('returns failure if the native open request throws', async () => {
  expect(await showRedisPane(new UiPanePresence(), 'a', () => true, () => { throw new Error('no surface') }, Date.now() + 10000, new AbortController().signal)).toBe('failed')
})

it('does not acknowledge the first pane when the same commit reveals two panes', async () => {
  const presence = new UiPanePresence(), releases: Array<() => void> = []
  const result = showRedisPane(presence, 'a', () => true, () => {
    releases.push(presence.attach('a'), presence.attach('a'))
  }, Date.now() + 10000, new AbortController().signal)
  expect(await result).toBe('ambiguous')
  for (const release of releases) release()
})
