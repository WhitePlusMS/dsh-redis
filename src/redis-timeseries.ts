import { isRedisScore } from './redis-score.ts'

export const MAX_TIMESERIES_TIMESTAMP = '9223372036854775807'
export const isTimeSeriesType = (type: string): boolean => type === 'TSDB-TYPE'
export function isTimeSeriesTimestamp(value: string): boolean {
  return /^(?:0|[1-9]\d{0,18})$/u.test(value) && BigInt(value) <= BigInt(MAX_TIMESERIES_TIMESTAMP)
}
export function isTimeSeriesRange(start: string, end: string): boolean {
  return (start === '-' || isTimeSeriesTimestamp(start)) && (end === '+' || isTimeSeriesTimestamp(end)) && (start === '-' || end === '+' || BigInt(start) <= BigInt(end))
}
export function withinTimeSeriesRange(timestamp: string, start: string, end: string): boolean {
  return (start === '-' || BigInt(timestamp) >= BigInt(start)) && (end === '+' || BigInt(timestamp) <= BigInt(end))
}
/** Fixed target TimeSeries 80210 rejects NaN/inf samples. Keep finite server text. */
export const isTimeSeriesValue = (value: string): boolean => isRedisScore(value) && Number.isFinite(Number(value))
