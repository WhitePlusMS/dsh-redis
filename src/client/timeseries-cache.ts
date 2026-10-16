import { MAX_CACHED_KEYS, MAX_CACHED_KEY_BYTES, type TimeSeriesSample } from '../domain.ts'

export interface TimeSeriesCache { readonly samples: readonly TimeSeriesSample[]; readonly bytes: number; readonly limited: boolean }
export const emptyTimeSeriesCache = (): TimeSeriesCache => ({ samples: [], bytes: 0, limited: false })

/** Exact timestamp text identifies a sample. Cache limits count encoded content. */
export function appendTimeSeriesSamples(previous: TimeSeriesCache, incoming: readonly TimeSeriesSample[]): TimeSeriesCache {
  const samples = new Map(previous.samples.map(sample => [sample.timestamp, sample]))
  const size = (sample: TimeSeriesSample): number => new TextEncoder().encode(JSON.stringify(sample)).length
  let bytes = previous.bytes
  for (const sample of incoming) {
    const old = samples.get(sample.timestamp), nextBytes = bytes - (old === undefined ? 0 : size(old)) + size(sample)
    if ((old === undefined && samples.size >= MAX_CACHED_KEYS) || nextBytes > MAX_CACHED_KEY_BYTES) return { samples: [...samples.values()], bytes, limited: true }
    samples.set(sample.timestamp, sample); bytes = nextBytes
  }
  return { samples: [...samples.values()], bytes, limited: previous.limited }
}
