/** Loader entry. Browser modules are discovered separately by DSH. */
export const name = 'ui-redis'
export const inject = ['profileContext', 'tools']
export { apply } from './runtime.ts'
export { RedisRemoteService } from './remote-service.ts'
export type * from './domain.ts'
