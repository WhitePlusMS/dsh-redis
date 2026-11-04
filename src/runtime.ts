import type { Context } from '@deepseek-ai/cordis'
import { RedisRemoteService } from './remote-service.ts'
import { registerRedisTools } from './host/ai-tools.ts'
import { registerRedisFormatTool, registerRedisRefreshTool, registerRedisUiTools } from './host/ai-ui-tools.ts'
import { registerRedisProfileTools } from './host/ai-profile-tools.ts'
import { registerRedisLocateTool } from './host/ai-locate-tool.ts'
import { RedisProfileSnapshots } from './host/profile-snapshots.ts'
import { RedisMatchPresets } from './host/match-preset-store.ts'
import { registerRedisMatchTools } from './host/ai-match-tools.ts'
import { registerRedisConnectionTools } from './host/ai-connection-tools.ts'
import { RedisReports, registerRedisReportTools } from './host/ai-report-tools.ts'

/** Sidebar and model tools share one Host-owned connection per trusted session. */
export function apply(ctx: Context): void {
  const service = new RedisRemoteService(ctx)
  const snapshots = new RedisProfileSnapshots()
  registerRedisTools(ctx, service.ai)
  registerRedisProfileTools(ctx, service.ai, snapshots, (agent, signal) => service.listProfiles(agent, {}, signal))
  registerRedisConnectionTools(ctx, service.ai, snapshots, (agent, profile, signal, isCurrent) => service.connectSavedProfile(agent, profile, signal, isCurrent), (agent, target, signal) => service.disconnect(agent, target, signal))
  registerRedisMatchTools(ctx, service.ai, new RedisMatchPresets(ctx.profileContext.dir), service.uiActions)
  registerRedisReportTools(ctx, service.ai, new RedisReports(ctx.profileContext.dir))
  registerRedisLocateTool(ctx, service.ai, service.uiActions)
  registerRedisUiTools(ctx, service.uiActions)
  registerRedisRefreshTool(ctx, service.ai, service.uiActions)
  registerRedisFormatTool(ctx, service.ai, service.uiActions)
  console.info('[dsh-redis] Read-only Host registered')
}
