import { MAX_DATABASE_ENTRIES, type DatabaseKeyCount } from './domain.ts'

/** INFO keyspace contains counts only. Reject malformed/duplicate database rows. */
export function parseDatabaseKeyspace(text: string): readonly DatabaseKeyCount[] {
  const rows: DatabaseKeyCount[] = [], seen = new Set<number>()
  for (const line of text.split(/\r?\n/u)) {
    if (line === '' || line.startsWith('#')) continue
    const match = /^db(0|[1-9]\d{0,4}):(.+)$/u.exec(line)
    if (match === null) throw new TypeError('Invalid keyspace row')
    const db = Number(match[1]), fields = match[2]!.split(','), counts = fields.filter(field => field.startsWith('keys='))
    const keys = counts[0]?.slice(5)
    if (db > 65535 || seen.has(db) || counts.length !== 1 || keys === undefined || !/^(?:0|[1-9]\d{0,18})$/u.test(keys) || BigInt(keys) > (1n << 63n) - 1n) throw new TypeError('Invalid keyspace count')
    if (rows.length >= MAX_DATABASE_ENTRIES) throw new RangeError('Keyspace is too large')
    seen.add(db); rows.push({ db, keys })
  }
  return rows.sort((a, b) => a.db - b.db)
}
