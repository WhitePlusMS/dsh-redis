import type { TimeSeriesSample } from '../domain.ts'
import { isTimeSeriesTimestamp, isTimeSeriesValue } from '../redis-timeseries.ts'

export const MAX_CHART_POINTS = 512
export interface PlotPoint extends TimeSeriesSample { readonly x: number; readonly y: number }
export interface SamplePlot {
  readonly state: 'empty' | 'plot' | 'invalid'
  readonly points: readonly PlotPoint[]
  readonly loaded: number
  readonly omitted: number
  readonly from: string | null
  readonly to: string | null
  readonly minValue: string | null
  readonly maxValue: string | null
}
/** Only the loaded prefix is drawn. Sorting this copy never reorders the table/cache.
 * BigInt differences retain nearby Int64 timestamps before approximate screen projection.
 */
export function projectSamples(samples: readonly TimeSeriesSample[]): SamplePlot {
  const empty = (state: 'empty' | 'invalid'): SamplePlot => ({ state, points: [], loaded: samples.length, omitted: samples.length, from: null, to: null, minValue: null, maxValue: null })
  if (samples.length === 0) return empty('empty')
  const identities = new Set<string>()
  for (const sample of samples) {
    if (!isTimeSeriesTimestamp(sample.timestamp) || !isTimeSeriesValue(sample.value) || identities.has(sample.timestamp)) return empty('invalid')
    identities.add(sample.timestamp)
  }
  const ordered = samples.slice(0, MAX_CHART_POINTS).map(sample => ({ sample, timestamp: BigInt(sample.timestamp), value: Number(sample.value) }))
    .sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0)
  const first = ordered[0], last = ordered.at(-1)
  if (first === undefined || last === undefined) return empty('empty')
  let minimum = first, maximum = first, magnitude = 0
  for (const point of ordered) {
    if (point.value < minimum.value) minimum = point
    if (point.value > maximum.value) maximum = point
    magnitude = Math.max(magnitude, Math.abs(point.value))
  }
  // Normalize before subtraction: opposite finite double extremes must not overflow.
  const low = magnitude === 0 ? 0 : minimum.value / magnitude, high = magnitude === 0 ? 0 : maximum.value / magnitude
  const span = last.timestamp - first.timestamp
  const points = ordered.map(point => ({ ...point.sample,
    x: span === 0n ? 0.5 : Number((point.timestamp - first.timestamp) * 1000000n / span) / 1000000,
    y: high === low ? 0.5 : ((magnitude === 0 ? 0 : point.value / magnitude) - low) / (high - low),
  }))
  return { state: 'plot', points, loaded: samples.length, omitted: samples.length - points.length,
    from: first.sample.timestamp, to: last.sample.timestamp, minValue: minimum.sample.value, maxValue: maximum.sample.value }
}
/** UTC is auxiliary. Out-of-Date-range timestamps remain exact decimal milliseconds. */
export function sampleUtc(timestamp: string): string | null {
  if (!isTimeSeriesTimestamp(timestamp) || BigInt(timestamp) > 8640000000000000n) return null
  return new Date(Number(timestamp)).toISOString()
}
