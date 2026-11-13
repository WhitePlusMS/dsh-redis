import { z } from 'zod'
import { createRedisDescriptors, TYPERT_PACKAGE } from './typert.shared.ts'

// DSH's Host registry consumes Zod; delegate validation to the same strict
// schema used at the Client wire boundary, including collection invariants.
export const redisHostDescriptors = createRedisDescriptors(schema => z.unknown().transform(value => schema.parse(value)))
export const TYPERT = { package: TYPERT_PACKAGE, face: 'host' as const, schemas: [], invocations: redisHostDescriptors, model: { services: [], events: [], objects: [] } }
export default TYPERT
