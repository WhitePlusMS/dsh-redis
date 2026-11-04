import { describe, expect, it } from 'vitest'
import { ReadConfirmation } from '../src/client/read-confirmation.ts'

describe('read identity confirmation', () => {
  it('never treats the old render or an unfinished read as the requested result', async () => {
    const confirmation = new ReadConfirmation<object>(), controller = new AbortController()
    const old = {}, next = {}, request = confirmation.start(controller.signal)
    if (request === null) throw new Error('Missing request')
    let completed = false
    void request.outcome.then(() => { completed = true })
    confirmation.rendered(old, false, false)
    confirmation.settle(request.id, next, false)
    confirmation.rendered(old, false, false)
    confirmation.rendered(next, true, false)
    await Promise.resolve(); expect(completed).toBe(false)
    confirmation.rendered(next, false, false)
    await expect(request.outcome).resolves.toBe('applied')
  })
  it('ignores stale responses, cancellation and replaced identities', async () => {
    const confirmation = new ReadConfirmation<object>(), firstSignal = new AbortController()
    const first = confirmation.start(firstSignal.signal)
    if (first === null) throw new Error('Missing request')
    expect(confirmation.start(new AbortController().signal)).toBeNull()
    firstSignal.abort(); await expect(first.outcome).resolves.toBe('stale')
    const second = confirmation.start(new AbortController().signal)
    if (second === null) throw new Error('Missing replacement')
    confirmation.settle(first.id, {}, false)
    confirmation.rendered(null, false, false)
    expect(confirmation.active(second.id)).toBe(true)
    confirmation.settle(second.id, null, true)
    confirmation.rendered(null, false, true)
    await expect(second.outcome).resolves.toBe('failed')
  })
})
