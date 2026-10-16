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

export const inject = ['remote', 'slots', 'locale', 'sidebarRightTabs']

export function apply(ctx: Context): void {
  ctx.effect(installRedisStyles)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'redis dictionaries')
  const t = ctx.locale.bind(NS)
  let remoteReady: ReturnType<typeof ctx.remote.$mount> | undefined
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
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: 'dsh-redis', kind: 'redis', title: () => t('view.title'),
    guide: [{ id: 'redis', order: 30, title: () => t('view.title'), description: () => t('guide.description') }],
  }), 'redis tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: 'dsh-redis', locale: NS,
    inject: (sessionId): RedisWorkspaceInjected => ({
      status: async signal => (await remote()).status(sessionId, {}, signal),
      testConnection: async (request, signal) => (await remote()).testConnection(sessionId, request, signal),
      connect: async (request, signal) => (await remote()).connect(sessionId, request, signal),
      disconnect: async (request, signal) => (await remote()).disconnect(sessionId, request, signal),
      connectionStatus: async signal => (await remote()).connectionStatus(sessionId, {}, signal),
      listProfiles: async signal => (await remote()).listProfiles(sessionId, {}, signal),
      saveProfile: async (request, signal) => (await remote()).saveProfile(sessionId, request, signal),
      removeProfile: async (request, signal) => (await remote()).removeProfile(sessionId, request, signal),
      selectDatabase: async (request, signal) => (await remote()).selectDatabase(sessionId, request, signal),
      scanKeys: async (request, signal) => (await remote()).scanKeys(sessionId, request, signal),
      readString: async (request, signal) => (await remote()).readString(sessionId, request, signal),
      scanHash: async (request, signal) => (await remote()).scanHash(sessionId, request, signal),
      readList: async (request, signal) => (await remote()).readList(sessionId, request, signal),
      scanSet: async (request, signal) => (await remote()).scanSet(sessionId, request, signal),
      readZSet: async (request, signal) => (await remote()).readZSet(sessionId, request, signal),
      readStream: async (request, signal) => (await remote()).readStream(sessionId, request, signal),
      readJson: async (request, signal) => (await remote()).readJson(sessionId, request, signal),
      readGeo: async (request, signal) => (await remote()).readGeo(sessionId, request, signal),
      readBloom: async (request, signal) => (await remote()).readBloom(sessionId, request, signal),
      readTimeSeries: async (request, signal) => (await remote()).readTimeSeries(sessionId, request, signal),
      readHll: async (request, signal) => (await remote()).readHll(sessionId, request, signal),
    }),
  }, RedisWorkspace)), 'redis tab body')
  console.info('[dsh-redis] Native sidebar registered')
}
