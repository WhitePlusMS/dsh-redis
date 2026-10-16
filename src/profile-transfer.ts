import { MAX_PROFILE_DOCUMENT_BYTES, PROFILE_DOCUMENT_FORMAT, type PortableConnection, type ProfileDocument, type SavedConnection } from './domain.ts'
import { profileDocumentSchema } from './typert.shared.ts'

/** A label is local presentation identity, distinct from the stable saved ID. */
export function profileLabel(value: Pick<PortableConnection, 'name' | 'group'>): string {
  return JSON.stringify([value.group ?? '', value.name])
}

/** Shared by preview and queued Host commit; no overwrite policy is implicit. */
export function conflictingProfiles(current: readonly Pick<PortableConnection, 'name' | 'group'>[], incoming: readonly Pick<PortableConnection, 'name' | 'group'>[]): ReadonlySet<string> {
  const seen = new Set(current.map(profileLabel)), conflicts = new Set<string>()
  for (const value of incoming) {
    const label = profileLabel(value)
    if (seen.has(label)) conflicts.add(label)
    seen.add(label)
  }
  return conflicts
}

/** Never serialize a saved object wholesale: certificates stay local too. */
export function createProfileDocument(profiles: readonly SavedConnection[]): ProfileDocument {
  return profileDocumentSchema.parse({ format: PROFILE_DOCUMENT_FORMAT, version: 1, profiles: profiles.map(value => ({
    name: value.name, ...(value.group === undefined ? {} : { group: value.group }),
    settings: { host: value.settings.host, port: value.settings.port, username: value.settings.username, tls: value.settings.tls !== null },
  })) })
}
export function serializeProfileDocument(profiles: readonly SavedConnection[]): string {
  const text = JSON.stringify(createProfileDocument(profiles), null, 2) + '\n'
  if (new TextEncoder().encode(text).length > MAX_PROFILE_DOCUMENT_BYTES) throw new Error('Redis profiles: document limit reached')
  return text
}
export function parseProfileDocument(text: string): ProfileDocument {
  // Check bytes before JSON parsing; the file picker also checks File.size.
  if (text.length > MAX_PROFILE_DOCUMENT_BYTES || new TextEncoder().encode(text).length > MAX_PROFILE_DOCUMENT_BYTES) throw new Error('Redis profiles: document limit reached')
  try { return profileDocumentSchema.parse(JSON.parse(text) as unknown) }
  catch { throw new Error('Redis profiles: invalid document') }
}
