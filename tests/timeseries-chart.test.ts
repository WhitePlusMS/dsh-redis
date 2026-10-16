import { describe, expect, it } from 'vitest'
import { MAX_CHART_POINTS, projectSamples, sampleUtc } from '../src/client/timeseries-plot.ts'
import type { TimeSeriesSample } from '../src/domain.ts'
const row = (timestamp: string, value = '1'): TimeSeriesSample => ({ timestamp, value })

describe('local projection of loaded TimeSeries samples', () => {
  it('keeps adjacent timestamps above 53 bits distinct before screen conversion', () => {
    const points = projectSamples([row('9007199254740993', '1.2345678901234567'), row('9007199254740994', '2')]).points
    expect(points.map(p => [p.timestamp, p.x])).toEqual([['9007199254740993', 0], ['9007199254740994', 1]])
    expect(points[0]?.value).toBe('1.2345678901234567')
  })
  it('retains adjacent Int64-maximum samples and their exact raw milliseconds', () => {
    const result = projectSamples([row('9223372036854775806'), row('9223372036854775807')])
    expect(result).toMatchObject({ state: 'plot', from: '9223372036854775806', to: '9223372036854775807' })
    expect(result.points.map(p => p.x)).toEqual([0, 1])
    expect(sampleUtc(result.points[1]?.timestamp ?? '')).toBeNull()
  })
  it('projects the full Int64 span approximately without changing source text', () => {
    const result = projectSamples([row('0'), row('9007199254740993'), row('9223372036854775807')])
    expect(result.points.map(p => p.timestamp)).toEqual(['0', '9007199254740993', '9223372036854775807'])
    expect(result.points[0]?.x).toBe(0); expect(result.points[2]?.x).toBe(1)
    expect(result.points[1]?.x).toBeGreaterThan(0)
  })
  it('uses the first loaded prefix, sorts only that copy and reports every omitted point', () => {
    const source = Array.from({ length: 600 }, (_, i) => row(String(599 - i), String(i))), original = JSON.stringify(source)
    const result = projectSamples(source)
    expect(result).toMatchObject({ loaded: 600, omitted: 88, from: '88', to: '599' })
    expect(result.points).toHaveLength(MAX_CHART_POINTS)
    expect(result.points[0]?.value).toBe('511'); expect(result.points.at(-1)?.value).toBe('0')
    expect(JSON.stringify(source)).toBe(original)
  })
  it('does not overflow for opposite finite double extremes or silently discard small values', () => {
    const source = [row('0', '-1.7976931348623157e308'), row('1', '1e-300'), row('2', '1.7976931348623157e308')]
    const result = projectSamples(source)
    expect(result.points.map(p => p.y)).toEqual([0, 0.5, 1])
    expect(result.points.map(p => p.value)).toEqual(source.map(p => p.value))
    expect(result).toMatchObject({ minValue: source[0]?.value, maxValue: source[2]?.value })
  })
  it('handles empty, single, constant, zero and negative-zero data without a fake zero series', () => {
    expect(projectSamples([])).toMatchObject({ state: 'empty', loaded: 0, omitted: 0, points: [] })
    expect(projectSamples([row('7', '-0')]).points).toEqual([{ timestamp: '7', value: '-0', x: 0.5, y: 0.5 }])
    const result = projectSamples([row('0', '0'), row('1', '-0'), row('2', '0')])
    expect(result.points.map(p => p.y)).toEqual([0.5, 0.5, 0.5]); expect(result.points[1]?.value).toBe('-0')
  })
  it('refuses the complete plot for invalid/duplicate samples rather than filtering them', () => {
    for (const invalid of [row('-1'), row('01'), row('9223372036854775808'), row('1', 'NaN'), row('1', 'inf'), row('1', '1e400'), row('1', '1\n')]) {
      expect(projectSamples([row('0'), invalid])).toMatchObject({ state: 'invalid', points: [], loaded: 2, omitted: 2 })
    }
    expect(projectSamples([row('1'), row('1', '2')]).state).toBe('invalid')
  })
  it('does not hide a malformed point beyond the drawing prefix', () => {
    const rows = Array.from({ length: MAX_CHART_POINTS + 1 }, (_, i) => row(String(i)))
    rows[MAX_CHART_POINTS] = row(String(MAX_CHART_POINTS), 'NaN')
    expect(projectSamples(rows)).toMatchObject({ state: 'invalid', points: [], loaded: MAX_CHART_POINTS + 1 })
  })
  it('formats auxiliary time explicitly in UTC and respects Date limits before Number conversion', () => {
    expect(sampleUtc('0')).toBe('1970-01-01T00:00:00.000Z')
    expect(sampleUtc('8640000000000000')).toBe('+275760-09-13T00:00:00.000Z')
    for (const timestamp of ['8640000000000001', '9007199254740993', '9223372036854775807', '-1', '01']) expect(sampleUtc(timestamp)).toBeNull()
  })
  it('keeps all drawn coordinates finite/bounded at the existing 5000-row cache limit', () => {
    const source = Array.from({ length: 5000 }, (_, i) => row(String(9223372036854775807n - BigInt(i) * 1000n), String(Math.sin(i) * Number.MAX_VALUE)))
    const result = projectSamples(source)
    expect(result).toMatchObject({ state: 'plot', loaded: 5000, omitted: 4488 })
    expect(result.points).toHaveLength(512)
    for (const point of result.points) for (const coordinate of [point.x, point.y]) { expect(Number.isFinite(coordinate)).toBe(true); expect(coordinate).toBeGreaterThanOrEqual(0); expect(coordinate).toBeLessThanOrEqual(1) }
  })
})
