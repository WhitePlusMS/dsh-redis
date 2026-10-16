import type { Context } from '@deepseek-ai/cordis'
import { RedisRemoteService } from './remote-service.ts'

/** Register the sidebar service without adding any model-facing tools. */
export function apply(ctx: Context): void {
  new RedisRemoteService(ctx)
  console.info('[dsh-redis] Read-only Host registered')
}
