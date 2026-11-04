import { isStreamId } from '../stream-id.ts'
import { byteIdentity } from './byte-identity.ts'
import { RedisFrameError, type RedisReply } from './resp.ts'

/** XINFO GROUPS has no server-side pagination. Bound the projected result as well as the RESP frame. */
export function projectStreamGroups(reply: RedisReply) {
  if (!Array.isArray(reply)) throw new RedisFrameError('protocol')
  const groups: Array<{ name: ReturnType<typeof byteIdentity>; consumers: string; pending: string; lastDeliveredId: string; entriesRead: string | null; entriesReadReported: boolean; lag: string | null; lagStatus: 'available' | 'unknown' | 'not-reported' }> = []
  let size = 0
  for (const row of reply) {
    if (groups.length === 20) break
    if (!Array.isArray(row) || row.length % 2 !== 0) throw new RedisFrameError('protocol')
    const fields = new Map<string, RedisReply>()
    for (let index = 0; index < row.length; index += 2) {
      const name = row[index], value = row[index + 1]
      if (!Buffer.isBuffer(name) || value === undefined) throw new RedisFrameError('protocol')
      const label = name.toString('utf8')
      if (fields.has(label)) throw new RedisFrameError('protocol')
      fields.set(label, value)
    }
    const name = fields.get('name'), consumers = fields.get('consumers'), pending = fields.get('pending'), delivered = fields.get('last-delivered-id')
    if (!Buffer.isBuffer(name) || typeof consumers !== 'bigint' || consumers < 0n || typeof pending !== 'bigint' || pending < 0n || !Buffer.isBuffer(delivered) || !isStreamId(delivered.toString('utf8'))) throw new RedisFrameError('protocol')
    const read = fields.get('entries-read'), lag = fields.get('lag')
    if ((read !== undefined && read !== null && (typeof read !== 'bigint' || read < 0n)) || (lag !== undefined && lag !== null && (typeof lag !== 'bigint' || lag < 0n))) throw new RedisFrameError('protocol')
    const group = { name: byteIdentity(name), consumers: consumers.toString(), pending: pending.toString(), lastDeliveredId: delivered.toString('utf8'), entriesRead: typeof read === 'bigint' ? read.toString() : null, entriesReadReported: read !== undefined, lag: typeof lag === 'bigint' ? lag.toString() : null, lagStatus: lag === undefined ? 'not-reported' as const : lag === null ? 'unknown' as const : 'available' as const }
    const bytes = Buffer.byteLength(JSON.stringify(group))
    if (size + bytes > 48 * 1024) {
      if (groups.length === 0) throw new RedisFrameError('oversize')
      break
    }
    size += bytes; groups.push(group)
  }
  return { groups, totalCount: reply.length, complete: groups.length === reply.length }
}
