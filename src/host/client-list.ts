import { RedisFrameError, type RedisReply } from './resp.ts'

/** CLIENT LIST cannot paginate server-side; discard addresses, names and command text. */
export function projectClients(reply: RedisReply) {
  if (!Buffer.isBuffer(reply)) throw new RedisFrameError('protocol')
  let raw: string
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(reply) } catch { throw new RedisFrameError('protocol') }
  const lines = raw.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const clients = lines.slice(0, 20).map(line => {
    const values = new Map<string, string>()
    for (const token of line.trimEnd().split(' ')) {
      const index = token.indexOf('=')
      if (index <= 0) throw new RedisFrameError('protocol')
      const key = token.slice(0, index)
      if (!['id', 'age', 'idle', 'db', 'flags'].includes(key)) continue
      if (values.has(key)) throw new RedisFrameError('protocol')
      values.set(key, token.slice(index + 1))
    }
    const id = values.get('id'), age = values.get('age'), idle = values.get('idle'), db = values.get('db'), flags = values.get('flags')
    if (id === undefined || age === undefined || idle === undefined || db === undefined || flags === undefined || ![id, age, idle, db].every(value => /^\d{1,20}$/u.test(value)) || !/^[A-Za-z]{1,32}$/u.test(flags)) throw new RedisFrameError('protocol')
    return { id, ageSeconds: age, idleSeconds: idle, db, flags }
  })
  return { clients, totalCount: lines.length, complete: clients.length === lines.length }
}
