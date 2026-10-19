import type { Context } from '@deepseek-ai/cordis'
import { RedisRemoteService } from './remote-service.ts'
import { registerRedisTools } from './host/ai-tools.ts'

/** Sidebar and model tools share one Host-owned connection per trusted session. */
export function apply(ctx: Context): void {
  const service = new RedisRemoteService(ctx)
  registerRedisTools(ctx, service.ai)
  console.info('[dsh-redis] Read-only Host registered')
}
