import type { Agent } from '@deepseek-ai/dsh-agent'
import type { UiAction } from '../src/domain.ts'
import type { RedisConnections } from '../src/host/connection-service.ts'
import type { UiActionCoordinator } from '../src/host/ui-action-coordinator.ts'
import { RedisRemoteService } from '../src/remote-service.ts'

/** Exercise the real Host point reader against the test's controlled Redis link. */
export async function sampleActionPoint(connections: RedisConnections, actions: UiActionCoordinator<UiAction>, sessionId: string, requestId: string, signal: AbortSignal) {
  const service = Object.create(RedisRemoteService.prototype) as RedisRemoteService
  Reflect.set(service, 'connections', connections)
  Reflect.set(service, 'uiActions', actions)
  return service.readActionPoint({ session: { id: sessionId } } as unknown as Agent, { requestId }, signal)
}
