/** Native right-sidebar registration adapted from the latest Git Graph source. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { TYPERT_REMOTE } from '../typert.remote-client.ts'
import { RedisWorkspace, type RedisWorkspaceInjected } from './RedisWorkspace.tsx'
import { installRedisStyles } from './styles.ts'
import { en, NS, zh } from './locales.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SetSelectionRequest } from '../domain.ts'

export const inject = ['remote', 'slots', 'locale', 'sidebarRightTabs']

export function apply(ctx: Context): void {
  ctx.effect(installRedisStyles)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'redis dictionaries')
  const t = ctx.locale.bind(NS)
  let remoteReady: ReturnType<typeof ctx.remote.$mount> | undefined
  const selectionUpdates = new Map<SessionId, Promise<unknown>>()
  // Rejected mounts are not cached, so an explicit retry can discover a recovered Host.
  const remote = async () => {
    if (remoteReady === undefined) {
      const pending = ctx.remote.$mount(TYPERT_REMOTE).catch((error: unknown) => {
        remoteReady = undefined
        throw error
      })
      remoteReady = pending
      ctx.effect(() => pending, 'redis remote')
    }
    await remoteReady
    return ctx.get('remote.redisViewer') as typeof ctx.remote.redisViewer
  }
  // Serialize selection writes across keyed pane owners and remounts. Requests
  // contain identities only; a replacement cannot race its predecessor's clear.
  const setSelection = (sessionId: SessionId, request: SetSelectionRequest, signal: AbortSignal) => {
    const previous = selectionUpdates.get(sessionId) ?? Promise.resolve()
    const pending = previous.catch(() => undefined).then(async () => (await remote()).setSelection(sessionId, request, signal))
    selectionUpdates.set(sessionId, pending)
    const settled = () => { if (selectionUpdates.get(sessionId) === pending) selectionUpdates.delete(sessionId) }
    void pending.then(settled, settled)
    return pending
  }
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'dsh-redis', kind: 'redis', title: () => t('view.title'),
    guide: [{ id: 'redis', order: 30, title: () => t('view.title'), description: () => t('guide.description') }],
  }), 'redis tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: 'dsh-redis', locale: NS,
    inject: (sessionId): RedisWorkspaceInjected => ({
      sessionKey: sessionId,
      status: async signal => (await remote()).status(sessionId, {}, signal),
      connect: async (request, signal) => (await remote()).connect(sessionId, request, signal),
      disconnect: async (request, signal) => (await remote()).disconnect(sessionId, request, signal),
      connectionStatus: async signal => (await remote()).connectionStatus(sessionId, {}, signal),
      setSelection: (request, signal) => setSelection(sessionId, request, signal),
      listProfiles: async signal => (await remote()).listProfiles(sessionId, {}, signal),
      saveProfile: async (request, signal) => (await remote()).saveProfile(sessionId, request, signal),
      removeProfile: async (request, signal) => (await remote()).removeProfile(sessionId, request, signal),
      selectDatabase: async (request, signal) => (await remote()).selectDatabase(sessionId, request, signal),
      readDatabases: async (request, signal) => (await remote()).readDatabases(sessionId, request, signal),
      scanKeys: async (request, signal) => (await remote()).scanKeys(sessionId, request, signal),
      readString: async (request, signal) => (await remote()).readString(sessionId, request, signal),
      scanHash: async (request, signal) => (await remote()).scanHash(sessionId, request, signal),
      readList: async (request, signal) => (await remote()).readList(sessionId, request, signal),
      scanSet: async (request, signal) => (await remote()).scanSet(sessionId, request, signal),
      readZSet: async (request, signal) => (await remote()).readZSet(sessionId, request, signal),
      readStream: async (request, signal) => (await remote()).readStream(sessionId, request, signal),
    }),
  }, RedisWorkspace)), 'redis tab body')
  console.info('[dsh-redis] Native sidebar registered')
}
