/** Profile-owned configuration only. No credential protection or network code belongs here. */
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { MAX_PROFILES, type ProfileCollection, type ProfileId, type SavedConnection, type SaveProfileRequest } from '../domain.ts'
import { profileCollectionSchema, profileIdSchema, saveProfileSchema } from '../typert.shared.ts'

const MAX_FILE_BYTES = 4 * 1024 * 1024
const storageError = () => new Error('Redis connection profiles could not be read or saved.')
// Only plugin instances in this process participate; external file writers do not.
const pendingByPath = new Map<string, Promise<void>>()

export class RedisProfiles {
  private readonly file: string
  private readonly queueKey: string
  constructor(profileDirectory: string) {
    this.file = resolve(profileDirectory, 'data', 'dsh-redis', 'connections.json')
    this.queueKey = process.platform === 'win32' ? this.file.toLowerCase() : this.file
  }

  /** Serialize cooperating instances using the same normalized file path. */
  private queue<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    const result = (pendingByPath.get(this.queueKey) ?? Promise.resolve()).then(() => { signal.throwIfAborted(); return operation() })
    const tail = result.then(() => undefined, () => undefined)
    pendingByPath.set(this.queueKey, tail)
    void tail.then(() => { if (pendingByPath.get(this.queueKey) === tail) pendingByPath.delete(this.queueKey) })
    return result
  }
  private async read(): Promise<ProfileCollection> {
    try {
      if ((await stat(this.file)).size > MAX_FILE_BYTES) throw storageError()
      const data: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      if (typeof data !== 'object' || data === null || Array.isArray(data)) throw storageError()
      const record = data as Record<string, unknown>
      if (record.version !== 1 || Object.keys(record).some(key => key !== 'version' && key !== 'profiles')) throw storageError()
      return profileCollectionSchema.parse({ profiles: record.profiles, selectedId: null })
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { profiles: [], selectedId: null }
      console.warn('[dsh-redis] Connection profile storage unavailable')
      throw storageError()
    }
  }
  private async write(collection: ProfileCollection): Promise<void> {
    const checked = profileCollectionSchema.parse(collection)
    const content = JSON.stringify({ version: 1, profiles: checked.profiles }, null, 2) + '\n'
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw storageError()
    const temporary = this.file + '.' + randomUUID() + '.tmp'
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
      await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      await rename(temporary, this.file)
    } catch {
      console.warn('[dsh-redis] Connection profile save failed')
      throw storageError()
    } finally {
      try { await rm(temporary, { force: true }) }
      catch { console.warn('[dsh-redis] Temporary profile cleanup failed'); throw storageError() }
    }
  }
  list(signal: AbortSignal): Promise<ProfileCollection> { return this.queue(signal, () => this.read()) }
  /** Caller prepares its candidate first. No asynchronous work is allowed in commit. */
  withVerifiedProfile(expected: SavedConnection, signal: AbortSignal, commit: () => undefined): Promise<boolean> {
    // Parse now to snapshot nested settings before this operation enters the queue.
    const snapshot = profileCollectionSchema.parse({ profiles: [expected], selectedId: null }).profiles[0]!
    const normalized = JSON.stringify(snapshot)
    return this.queue(signal, async () => {
      const current = (await this.read()).profiles.find(value => value.id === snapshot.id)
      signal.throwIfAborted()
      if (current === undefined || JSON.stringify(current) !== normalized) return false
      if (commit() !== undefined) throw new TypeError('Redis profile commit must be synchronous.')
      return true
    })
  }
  save(request: SaveProfileRequest, signal: AbortSignal): Promise<ProfileCollection> {
    const input = saveProfileSchema.parse(request)
    return this.queue(signal, async () => {
      const current = await this.read()
      const id = input.id ?? randomUUID()
      if (input.id !== null && !current.profiles.some(value => value.id === id)) throw new Error('The saved Redis connection no longer exists.')
      if (input.id === null && current.profiles.length >= MAX_PROFILES) throw new Error('The saved Redis connection limit was reached.')
      if (current.profiles.some(value => value.id !== id && value.name === input.name && (value.group ?? '') === (input.group ?? ''))) throw new Error('A Redis connection with this group and name already exists.')
      const value = { id, name: input.name, ...(input.group === undefined ? {} : { group: input.group }), settings: input.settings }
      const profiles = input.id === null ? [...current.profiles, value] : current.profiles.map(item => item.id === id ? value : item)
      signal.throwIfAborted()
      const result = { profiles, selectedId: id }
      await this.write(result)
      console.info('[dsh-redis] Connection profile saved')
      return result
    })
  }
  remove(request: ProfileId, signal: AbortSignal): Promise<ProfileCollection> {
    const input = profileIdSchema.parse(request)
    return this.queue(signal, async () => {
      const current = await this.read()
      if (!current.profiles.some(value => value.id === input.id)) throw new Error('The saved Redis connection no longer exists.')
      const result = { profiles: current.profiles.filter(value => value.id !== input.id), selectedId: null }
      signal.throwIfAborted()
      await this.write(result)
      console.info('[dsh-redis] Connection profile removed')
      return result
    })
  }
}
