import type { GeoPosition } from './domain.ts'

/** Validate finite Redis coordinate text without rewriting its decimal spelling.
 * Redis geohash uses the Web Mercator latitude bound; decoded values are not an
 * exact reconstruction of the originally submitted GEOADD coordinates.
 */
export function isGeoPosition(value: GeoPosition): boolean {
  const number = (text: string, limit: number): boolean => text.length <= 128 && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text) && Number.isFinite(Number(text)) && Math.abs(Number(text)) <= limit
  return number(value.longitude, 180) && number(value.latitude, 85.05112878)
}
