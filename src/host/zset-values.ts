import { MAX_KEY_BYTES, type ZSetEntry } from '../domain.ts'
import { isRedisScore } from '../redis-score.ts'
import { byteIdentity } from './byte-identity.ts'
import { RedisFrameError, type RedisReply } from './resp.ts'

/** Shared complete member/score decoding for ZSet pages and explicit GEO ranges.
 * Scan duplicates update their score; rank ranges must contain unique members.
 */
export function zsetEntries(values: readonly RedisReply[], offset: string | null, limit: number): readonly ZSetEntry[] {
  if (values.length % 2 !== 0) throw new RedisFrameError('protocol')
  if (values.length / 2 > limit) throw new RedisFrameError(offset === null ? 'oversize' : 'protocol')
  const rows = new Map<string, ZSetEntry>()
  for (let index = 0; index < values.length; index += 2) {
    const raw = values[index], rawScore = values[index + 1]
    if (!Buffer.isBuffer(raw) || !Buffer.isBuffer(rawScore)) throw new RedisFrameError('protocol')
    if (raw.length > MAX_KEY_BYTES) throw new RedisFrameError('oversize')
    const member = byteIdentity(raw), score = rawScore.toString('utf8')
    if (!isRedisScore(score) || (offset !== null && rows.has(member.base64))) throw new RedisFrameError('protocol')
    rows.set(member.base64, { member, score, rank: offset === null ? null : String(BigInt(offset) + BigInt(index / 2)) })
  }
  return [...rows.values()]
}
