/** Probe the installed DSH approval contract with synthetic sessions; no Redis or UI. */
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import ApprovalService from '@deepseek-ai/dsh-user-approval'

async function probe(answerer) {
  const ctx = new Context()
  await ctx.plugin(ApprovalService)
  const events = [{ type: 'turn/start' }]
  const agent = { session: {
    get seq() { return events.length },
    eventAt: index => events[index],
    append(type, data) { const event = { type, data }; events.push(event); return event },
  } }
  ctx.on('approval/request', answerer)
  try {
    const outcome = await ctx.approval.request({ agent, toolName: 'redis_write_probe', reason: 'synthetic-only' })
    const audit = events.filter(event => event.type.startsWith('approval/')).map(event => ({
      type: event.type,
      fields: Object.keys(event.data).filter(key => key !== 'id').sort(),
      outcome: event.data.outcome ?? null,
    }))
    return { outcome, audit }
  } finally {
    await ctx.fiber.dispose()
  }
}

// Both are deliberately scripted: neither is presented as a real human UI.
const machine = await probe(async () => 'allowed-once')
const simulatedUi = await probe(async () => 'allowed-once')
assert.equal(machine.outcome, 'allowed-once')
assert.deepEqual(machine, simulatedUi)
assert.deepEqual(machine.audit.map(event => event.type), ['approval/asked', 'approval/decided'])
assert.deepEqual(machine.audit[1].fields, ['outcome'])
console.log(JSON.stringify({ package: '@deepseek-ai/dsh-user-approval', kind: 'in-process-synthetic', sameOutcomeAndAudit: true, audit: machine.audit }))
