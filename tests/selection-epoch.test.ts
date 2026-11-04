import { expect, it, vi } from 'vitest'
import { SelectionEpoch } from '../src/client/selection-epoch.ts'

it('invalidates synchronously and never synchronizes an older publication', () => {
  const epoch = new SelectionEpoch(), changed = vi.fn()
  const unsubscribe = epoch.subscribe(changed)
  expect(epoch.current(0)).toBe(false)
  epoch.synchronize(0)
  changed.mockClear()
  const first = epoch.invalidate(), second = epoch.invalidate()
  expect(epoch.current(0)).toBe(false)
  expect(epoch.current(second)).toBe(false)
  epoch.synchronize(first)
  expect(epoch.snapshot()).toEqual({ revision: 2, synchronized: false })
  epoch.synchronize(second)
  expect(epoch.current(second)).toBe(true)
  expect(changed.mock.calls.map(([snapshot]) => snapshot)).toEqual([
    { revision: 1, synchronized: false }, { revision: 2, synchronized: false }, { revision: 2, synchronized: true },
  ])
  unsubscribe(); epoch.invalidate(); expect(changed).toHaveBeenCalledTimes(3)
})

it('does not synchronize an old selection while a target change is pending', () => {
  const epoch = new SelectionEpoch()
  epoch.synchronize(0)
  const end = epoch.beginBoundary(new AbortController().signal), pending = epoch.snapshot().revision
  epoch.synchronize(pending); expect(epoch.current(pending)).toBe(false)
  end(); end()
  const next = epoch.snapshot().revision
  expect(next).toBe(pending + 1)
  epoch.synchronize(pending); expect(epoch.current(next)).toBe(false)
  epoch.synchronize(next); expect(epoch.current(next)).toBe(true)
})

it('releases a target-change boundary immediately on cancellation', () => {
  const epoch = new SelectionEpoch(), controller = new AbortController()
  const end = epoch.beginBoundary(controller.signal)
  controller.abort()
  const revision = epoch.snapshot().revision
  epoch.synchronize(revision)
  expect(epoch.current(revision)).toBe(true)
  end(); expect(epoch.snapshot().revision).toBe(revision)
})

it('binds publication to one stream and rejects an in-flight publication on close', async () => {
  const epoch = new SelectionEpoch(), send = vi.fn(), unbind = epoch.bindPublisher(send)
  const revision = epoch.snapshot().revision, signal = new AbortController()
  const request = { target: { id: 'fixture', generation: 1, db: 0 }, selection: null }
  const pending = epoch.publish(request, revision, signal.signal)
  const frame = send.mock.calls[0]?.[0]
  expect(frame).toMatchObject({ kind: 'publishSelection', revision, request })
  epoch.finishPublication(frame.requestId, true)
  await expect(pending).resolves.toEqual({ ok: true, value: { accepted: true } })
  const interrupted = epoch.publish(request, revision, signal.signal)
  unbind()
  await expect(interrupted).rejects.toThrow('stream closed')
  expect(epoch.current(revision)).toBe(false)
  await expect(epoch.publish(request, revision, signal.signal)).rejects.toThrow('unavailable')
})

it('supersedes an old publication immediately and ignores its late acknowledgement', async () => {
  const epoch = new SelectionEpoch(), send = vi.fn(), unbind = epoch.bindPublisher(send)
  const request = { target: { id: 'fixture', generation: 1, db: 0 }, selection: null }
  const old = epoch.publish(request, epoch.snapshot().revision, new AbortController().signal)
  const oldId = send.mock.calls[0]?.[0].requestId
  epoch.userSelect()
  await expect(old).rejects.toThrow('superseded')
  const current = epoch.publish(request, epoch.snapshot().revision, new AbortController().signal)
  const currentId = send.mock.calls[1]?.[0].requestId
  epoch.finishPublication(oldId, true)
  epoch.finishPublication(currentId, true)
  await expect(current).resolves.toEqual({ ok: true, value: { accepted: true } })
  unbind()
})
