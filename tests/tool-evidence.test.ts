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

it('shows only the recorded String window with its range and completeness', () => {
  const evidence = redisEvidence('redis_viewer_value', JSON.stringify({ readOnly: true, value: { text: 'synth', base64: 'c3ludGg=', byteLength: 5, offset: '0', nextOffset: '5', complete: false, metadata: { type: 'string', length: '22' } } }))
  expect(evidence?.values).toEqual([{ label: 'value.text', value: '"synth"' }])
  expect(evidence?.rows).toEqual(expect.arrayContaining([
    { label: 'value.offset', value: '0' }, { label: 'value.nextOffset', value: '5' },
    { label: 'value.byteLength', value: '5' }, { label: 'value.complete', value: 'false' },
    { label: 'metadata.length', value: '22' },
  ]))
  expect(evidence?.rows.some(row => row.label === 'snapshot')).toBe(false)
})

it('distinguishes empty text, binary bytes and a missing selected cell', () => {
  const values = (value: unknown) => redisEvidence('redis_viewer_value', JSON.stringify({ readOnly: true, value }))?.values
  expect(values({ text: '', base64: '', complete: true })).toEqual([{ label: 'value.text', value: '""' }])
  expect(values({ text: null, base64: '/w==' })).toEqual([{ label: 'value.text', value: 'null' }, { label: 'value.base64', value: '"/w=="' }])
  expect(values({ state: 'selection-missing', cell: null })).toEqual([{ label: 'value.cell', value: 'null' }])
})

it('preserves collection identities, per-cell truncation and repeated Stream fields in order', () => {
  const field = { label: '"field"', base64: 'ZmllbGQ=', byteLength: 5 }
  const cell = { text: 'first', base64: 'Zmlyc3Q=', byteLength: 5, fullByteLength: 8, complete: false }
  const collections = {
    entries: [{ index: '9007199254740993', field, value: cell }],
    members: [field],
    messages: [{ id: '1-0', fields: [{ index: 0, field, value: cell }, { index: 1, field, value: { ...cell, text: 'second' } }] }],
  }
  for (const [name, entries] of Object.entries(collections)) {
    const evidence = redisEvidence('redis_viewer_value', JSON.stringify({ readOnly: true, value: { [name]: entries, scanComplete: false, complete: false, cursor: 'fixture-next' } }))
    expect(JSON.parse(evidence?.values.find(row => row.label === `value.${name}`)?.value ?? 'null')).toEqual(entries)
    expect(evidence?.values).toContainEqual({ label: 'value.cursor', value: '"fixture-next"' })
    expect(evidence?.rows).toContainEqual({ label: 'value.scanComplete', value: 'false' })
  }
})

it.each(['[9007199254740993]', '[null]', '[]'])('shows JSON.GET source unchanged: %s', matchesJson => {
  const evidence = redisEvidence('redis_viewer_json_path', JSON.stringify({ readOnly: true, matchesJson, path: '$.value' }))
  expect(evidence?.values).toContainEqual({ label: 'matchesJson', value: matchesJson })
})

it('keeps diagnostic unknowns and professional values without numeric conversion', () => {
  const fields = { samples: [{ timestampMs: '9007199254740993', value: '1.2500' }], coordinates: { longitude: '1.0000', latitude: '2.0000' }, distance: null, bits: '0000', groups: [{ pending: '1', lag: null }], fields: { blocked_clients: '0' } }
  const evidence = redisEvidence('redis_viewer_timeseries', JSON.stringify({ readOnly: true, ...fields }))
  for (const [name, value] of Object.entries(fields)) expect(JSON.parse(evidence?.values.find(row => row.label === name)?.value ?? '"missing"')).toEqual(value)
})

it('keeps recorded server and DB visible while moving opaque connection identifiers to details', () => {
  const evidence = redisEvidence('redis_viewer_status', JSON.stringify({ readOnly: true, connection: { id: 'fixture-id', generation: 9, db: 1, target: { host: '127.0.0.1', port: 2418, tls: false } } }))
  expect(evidence?.details).toEqual([{ label: 'connection.id', value: 'fixture-id' }, { label: 'connection.generation', value: '9' }])
  expect(evidence?.rows).toContainEqual({ label: 'connection.target.port', value: '2418' })
  expect(evidence?.rows).toContainEqual({ label: 'connection.db', value: '1' })
  expect(evidence?.rows.some(row => row.label === 'connection.id')).toBe(false)
})

it.each(['selected', 'currentSelection'])('keeps nested %s connection identities out of expanded values', key => {
  const selection = { keyBase64: 'aw==', item: { kind: 'hash', fieldBase64: 'Zg==' } }
  const selected = { target: { id: 'fixture-nested-id', generation: 2, db: 1 }, selection, sampledAt: 'fixture-time' }
  const evidence = redisEvidence('redis_viewer_value', JSON.stringify({ readOnly: true, [key]: selected }))
  expect(evidence?.values).toEqual([{ label: `${key}.selection`, value: JSON.stringify(selection, null, 2) }])
  expect(evidence?.rows).toContainEqual({ label: `${key}.sampledAt`, value: 'fixture-time' })
  expect(evidence?.raw).toContain('fixture-nested-id')
})
