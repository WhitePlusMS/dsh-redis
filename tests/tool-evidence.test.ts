import { expect, it } from 'vitest'
import { redisEvidence } from '../src/client/tool-evidence.ts'

it('keeps exact TTL and integer strings from the recorded result without historical inference', () => {
  const evidence = redisEvidence('redis_viewer_key_metadata', JSON.stringify({ readOnly: true, connection: { id: 'fixture', generation: 3, db: 1 }, key: { label: '"fixture:key"' }, state: 'value', type: 'string', ttlMs: '-1', sampledAt: '2026-11-05T00:00:00.000Z' }))
  expect(evidence?.rows).toContainEqual({ label: 'ttlMs', value: '-1' })
  expect(evidence?.rows).toContainEqual({ label: 'connection.db', value: '1' })
  expect(evidence?.notes).toContain('ttl')
  const memory = redisEvidence('redis_viewer_memory', '{"readOnly":true,"bytes":"9007199254740993","requestedSamples":5,"actualSamples":null}')
  expect(memory?.rows).toContainEqual({ label: 'bytes', value: '9007199254740993' })
  expect(memory?.rows).toContainEqual({ label: 'actualSamples', value: 'null' })
  expect(memory?.notes).toContain('memory')
})

it('preserves explicit versus selected provenance and nested read states', () => {
  const explicit = redisEvidence('redis_viewer_value', JSON.stringify({ readOnly: true, source: 'explicit', value: { state: 'selection-missing', sampledAt: 'fixture-time', metadata: { ttlMs: '-1' } } }))
  expect(explicit?.notes).toContain('explicit')
  expect(explicit?.notes).not.toContain('selected')
  expect(explicit?.rows).toContainEqual({ label: 'value.state', value: 'selection-missing' })
  expect(explicit?.rows).toContainEqual({ label: 'value.sampledAt', value: 'fixture-time' })
  expect(redisEvidence('redis_viewer_value', '{"readOnly":true,"source":"selection"}')?.notes).toContain('selected')
})

it('retains partial scan counts and continuation verbatim without inventing totals', () => {
  const evidence = redisEvidence('redis_viewer_filter_hash', '{"readOnly":true,"pattern":"fixture:*","counts":{"checked":10,"matched":0,"failed":1},"scanComplete":false,"cursor":"opaque"}')
  expect(evidence?.rows).toContainEqual({ label: 'counts.failed', value: '1' })
  expect(evidence?.rows).toContainEqual({ label: 'scanComplete', value: 'false' })
  expect(evidence?.rows.some(row => row.label === 'totalCount')).toBe(false)
  expect(evidence?.notes).toContain('scan')
  expect(evidence?.raw).toContain('"cursor": "opaque"')
})

it('does not promote malformed, oversized or unrelated output to structured read evidence', () => {
  for (const text of ['bad json', 'null', '[]', '{"state":"value"}', ' '.repeat(131073)]) expect(redisEvidence('redis_viewer_value', text)).toBeNull()
})
