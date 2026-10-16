import type { RedisKey } from '../domain.ts'
import { prefixLabel } from './collection-value.ts'

export const MAX_NAMESPACE_DEPTH = 16
export const KEY_ROW_HEIGHT = 30
const OVERSCAN = 6

type Leaf = { readonly kind: 'key'; readonly id: string; readonly label: string; readonly key: RedisKey }
type Folder = { readonly kind: 'namespace'; readonly id: string; readonly label: string; count: number; readonly children: Map<string, Node> }
type Node = Leaf | Folder
export type KeyRow = (Leaf | Omit<Folder, 'children'>) & { readonly depth: number; readonly parentId: string | null }

/** A separator is UTF-8, while keys remain byte strings, including invalid UTF-8. */
export function validSeparator(value: string): boolean {
  const bytes = new TextEncoder().encode(value)
  return bytes.length > 0 && bytes.length <= 16 && new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) === value
}
function byteLabel(value: string): string {
  return prefixLabel({ base64: btoa(value), byteLength: value.length, fullByteLength: value.length, suffix: '' })
}
export const keyRowId = (base64: string): string => `key:${base64}`

/** Incremental index over the bounded cache. Refresh/replacement resets it; labels never identify nodes. */
export class KeyNamespaces {
  readonly #separator: string
  #keys: readonly RedisKey[] = []
  readonly #roots = new Map<string, Node>()
  readonly #paths = new Map<string, readonly string[]>()
  #revision = 0

  constructor(separator: string) {
    if (!validSeparator(separator)) throw new Error('Invalid namespace separator')
    this.#separator = Array.from(new TextEncoder().encode(separator), value => String.fromCharCode(value)).join('')
  }

  update(keys: readonly RedisKey[]): void {
    if (keys.length < this.#keys.length || this.#keys.some((key, index) => keys[index] !== key)) {
      this.#roots.clear(); this.#paths.clear(); this.#keys = []; ++this.#revision
    }
    for (const key of keys.slice(this.#keys.length)) {
      if (this.#paths.has(key.base64)) continue
      const raw = atob(key.base64), ancestors: string[] = []
      let children = this.#roots, start = 0
      // A hostile key with thousands of separators cannot produce unbounded nesting.
      for (let depth = 0; depth < MAX_NAMESPACE_DEPTH; ++depth) {
        const end = raw.indexOf(this.#separator, start)
        if (end < 0) break
        const next = end + this.#separator.length, id = `namespace:${btoa(raw.slice(0, next))}`
        let folder = children.get(id)
        if (folder === undefined) {
          folder = { kind: 'namespace', id, label: byteLabel(raw.slice(start, end)), count: 0, children: new Map() }
          children.set(id, folder)
        }
        if (folder.kind !== 'namespace') throw new Error('Invalid namespace index')
        ++folder.count; ancestors.push(id); children = folder.children; start = next
      }
      children.set(keyRowId(key.base64), { kind: 'key', id: keyRowId(key.base64), label: ancestors.length === 0 ? key.label : byteLabel(raw.slice(start)), key })
      this.#paths.set(key.base64, ancestors)
    }
    this.#keys = keys
  }

  get revision(): number { return this.#revision }
  path(base64: string): readonly string[] | undefined { return this.#paths.get(base64) }

  /** Stable first-seen SCAN order; folder counts cover loaded keys only, never the whole DB. */
  rows(expanded: ReadonlySet<string>, tree: boolean): readonly KeyRow[] {
    if (!tree) return this.#keys.map(key => ({ kind: 'key', id: keyRowId(key.base64), label: key.label, key, depth: 0, parentId: null }))
    const rows: KeyRow[] = []
    const visit = (nodes: ReadonlyMap<string, Node>, depth: number, parentId: string | null): void => {
      for (const node of nodes.values()) {
        if (node.kind === 'key') rows.push({ ...node, depth, parentId })
        else {
          rows.push({ kind: node.kind, id: node.id, label: node.label, count: node.count, depth, parentId })
          if (expanded.has(node.id)) visit(node.children, depth + 1, node.id)
        }
      }
    }
    visit(this.#roots, 0, null)
    return rows
  }
}

/** Fixed-height rows bound mounted DOM to viewport + overscan; the focused row may be retained separately. */
export function keyRowWindow(count: number, scrollTop: number, height: number): { readonly start: number; readonly end: number } {
  const top = Math.max(0, Math.min(scrollTop, Math.max(0, count * KEY_ROW_HEIGHT - height)))
  return { start: Math.max(0, Math.floor(top / KEY_ROW_HEIGHT) - OVERSCAN), end: Math.min(count, Math.ceil((top + Math.max(0, height)) / KEY_ROW_HEIGHT) + OVERSCAN) }
}
