/** Profile-scoped immutable MATCH presets. No Redis data, credentials or caller paths are stored. */
import { createHash, randomUUID } from 'node:crypto'
import { link, lstat, mkdir, open, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface MatchPreset { readonly id: string; readonly name: string; readonly pattern: string }
export interface MatchPresetPage { readonly presets: readonly MatchPreset[]; readonly nextCursor: string | null; readonly snapshot: false }
export type MatchPresetErrorCode = 'invalid' | 'conflict' | 'full' | 'cancelled' | 'storage'

export class MatchPresetError extends Error {
  constructor(readonly code: MatchPresetErrorCode) { super(`Redis MATCH preset: ${code}`) }
}

const PAGE_SIZE = 10
const MAX_FILE_BYTES = 8192
const SLOT_COUNT = 256
const ID = /^[a-f0-9]{64}$/u

function checkId(value: unknown): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new MatchPresetError('invalid')
  return value
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max || Buffer.from(value, 'utf8').toString('utf8') !== value) throw new MatchPresetError('invalid')
  return value
}
function nameAt(value: unknown): string {
  const name = text(value, 80).normalize('NFC')
  if (name.length === 0 || name.length > 80 || name.trim() !== name || /[\u0000-\u001f\u007f/\\]/u.test(name)) throw new MatchPresetError('invalid')
  return name
}
function parseInput(value: unknown): { readonly name: string; readonly pattern: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new MatchPresetError('invalid')
  const record = value as Record<string, unknown>
  if (Object.keys(record).some(key => key !== 'name' && key !== 'pattern')) throw new MatchPresetError('invalid')
  return { name: nameAt(record.name), pattern: text(record.pattern, 256) }
}
function presetId(name: string): string { return createHash('sha256').update(name, 'utf8').digest('hex') }
function parseStored(value: unknown): MatchPreset {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new MatchPresetError('storage')
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 3 || Object.keys(record).some(key => key !== 'id' && key !== 'name' && key !== 'pattern')) throw new MatchPresetError('storage')
  try {
    const id = checkId(record.id), name = nameAt(record.name), pattern = text(record.pattern, 256)
    if (id !== presetId(name) || record.name !== name) throw new Error('Invalid preset identity')
    return { id, name, pattern }
  } catch { throw new MatchPresetError('storage') }
}
function cancelled(signal: AbortSignal): void { if (signal.aborted) throw new MatchPresetError('cancelled') }
function errorCode(error: unknown): string | undefined { return error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : undefined }

/** Immutable fixed slots; creation uses a non-replacing filesystem link.
 * The profile directory must be trusted: lstat/open cannot stop a hostile local replacement.
 */
export class RedisMatchPresets {
  private readonly directory: string
  constructor(profileDirectory: string) { this.directory = resolve(profileDirectory, 'data', 'dsh-redis', 'match-preset-slots') }
  private path(slot: number): string { return resolve(this.directory, `${String(slot).padStart(3, '0')}.json`) }

  async save(input: { readonly name: string; readonly pattern: string }, signal: AbortSignal): Promise<MatchPreset> {
    const value = parseInput(input), preset: MatchPreset = { id: presetId(value.name), ...value }
    const content = JSON.stringify(preset) + '\n', temporary = resolve(this.directory, `.staging-${randomUUID()}.tmp`)
    let created = false
    cancelled(signal)
    try {
      await mkdir(this.directory, { recursive: true, mode: 0o700 })
      // A complete scan detects existing identities even if a slot was removed externally.
      if (await this.get(preset.id, signal) !== null) throw new MatchPresetError('conflict')
      const file = await open(temporary, 'wx', 0o600)
      created = true
      try { await file.writeFile(content, 'utf8') } finally { await file.close() }
      cancelled(signal)
      const start = Number.parseInt(preset.id.slice(0, 2), 16)
      for (let offset = 0; offset < SLOT_COUNT; offset++) {
        cancelled(signal)
        const slot = (start + offset) % SLOT_COUNT
        try {
          await link(temporary, this.path(slot))
          // After link succeeds the preset exists even if cancellation arrives before return.
          return preset
        } catch (error) {
          if (errorCode(error) !== 'EEXIST') throw error
          const existing = await this.readSlot(slot, signal)
          if (existing === null) throw new MatchPresetError('storage')
          if (existing.id === preset.id) throw new MatchPresetError('conflict')
        }
      }
      throw new MatchPresetError('full')
    } catch (error) {
      if (error instanceof MatchPresetError) throw error
      console.warn('[dsh-redis] MATCH preset save failed')
      throw new MatchPresetError('storage')
    } finally {
      if (created) try { await unlink(temporary) } catch { console.warn('[dsh-redis] MATCH preset temporary cleanup failed') }
    }
  }

  async get(id: string, signal: AbortSignal): Promise<MatchPreset | null> {
    checkId(id)
    const presets = await this.readAll(signal)
    return presets.find(entry => entry.preset.id === id)?.preset ?? null
  }

  /** Validate all identities before returning any result, including across page boundaries. */
  private async readAll(signal: AbortSignal): Promise<readonly { readonly slot: number; readonly preset: MatchPreset }[]> {
    const entries: { slot: number; preset: MatchPreset }[] = [], ids = new Set<string>()
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const preset = await this.readSlot(slot, signal)
      if (preset === null) continue
      if (ids.has(preset.id)) throw new MatchPresetError('storage')
      ids.add(preset.id)
      entries.push({ slot, preset })
    }
    cancelled(signal)
    return entries
  }

  /** A fixed slot is read at most once per traversal; close precedes the final cancellation check. */
  private async readSlot(slot: number, signal: AbortSignal): Promise<MatchPreset | null> {
    const path = this.path(slot)
    cancelled(signal)
    try {
      if (!(await lstat(path)).isFile()) throw new MatchPresetError('storage')
      const file = await open(path, 'r')
      let preset: MatchPreset
      try {
        if (!(await file.stat()).isFile()) throw new MatchPresetError('storage')
        const buffer = Buffer.alloc(MAX_FILE_BYTES + 1)
        let size = 0
        while (size < buffer.length) {
          cancelled(signal)
          const read = await file.read(buffer, size, buffer.length - size, size)
          if (read.bytesRead === 0) break
          size += read.bytesRead
        }
        if (size > MAX_FILE_BYTES) throw new MatchPresetError('storage')
        cancelled(signal)
        const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size))
        preset = parseStored(JSON.parse(content) as unknown)
      } finally { await file.close() }
      cancelled(signal)
      return preset
    } catch (error) {
      cancelled(signal)
      if (errorCode(error) === 'ENOENT') return null
      if (error instanceof MatchPresetError) throw error
      console.warn('[dsh-redis] MATCH preset read failed')
      throw new MatchPresetError('storage')
    }
  }

  /** Each page checks at most 256 fixed slots; concurrent changes are not a snapshot.
   * Cancellation is checked between I/O calls, not during a blocked filesystem operation.
   */
  async list(cursor: string | null, signal: AbortSignal): Promise<MatchPresetPage> {
    if (cursor !== null && !/^(?:0|[1-9]\d{0,2})$/u.test(cursor)) throw new MatchPresetError('invalid')
    const slot = cursor === null ? 0 : Number(cursor)
    if (slot >= SLOT_COUNT) throw new MatchPresetError('invalid')
    cancelled(signal)
    const entries = (await this.readAll(signal)).filter(entry => entry.slot >= slot).slice(0, PAGE_SIZE)
    const next = entries.length === PAGE_SIZE ? entries[entries.length - 1]!.slot + 1 : SLOT_COUNT
    cancelled(signal)
    return { presets: entries.map(entry => entry.preset), nextCursor: next < SLOT_COUNT ? String(next) : null, snapshot: false }
  }
}
