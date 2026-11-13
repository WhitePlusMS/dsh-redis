import type { RedisSelection, UiAction } from './domain.ts'

/** Both faces and the point reader use the same raw selection identity. */
export function selectionForAction(action: UiAction): RedisSelection | null {
  switch (action.kind) {
    case 'selectKey': return { keyBase64: action.key.base64, item: null }
    case 'selectHashField': return { keyBase64: action.keyBase64, item: { kind: 'hash', fieldBase64: action.field.base64 } }
    case 'selectListIndex': return { keyBase64: action.keyBase64, item: { kind: 'list', index: action.index } }
    case 'selectSetMember': return { keyBase64: action.keyBase64, item: { kind: 'set', memberBase64: action.member.base64 } }
    case 'selectZSetMember': return { keyBase64: action.keyBase64, item: { kind: 'zset', memberBase64: action.member.base64 } }
    case 'selectStreamField': return { keyBase64: action.keyBase64, item: { kind: 'stream', id: action.id, fieldIndex: action.fieldIndex, fieldBase64: action.fieldBase64 } }
    default: return null
  }
}
