import type { Context } from '@deepseek-ai/cordis'
import type { PeerId, PeerScope } from '@deepseek-ai/dsh-typert-protocol'

/** In-process calls speak for a live owner, as required by the DSH Gateway. */
export function ownerPeer(ctx: Context): PeerScope {
  return { id: 'fixture-owner' as PeerId, ctx, principal: { kind: 'owner' }, signal: new AbortController().signal, interactions: 'answer', async dispose() {} }
}
