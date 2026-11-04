/** Exercise saved-profile exchange through DSH tools and an owned Redis. */
import assert from 'node:assert/strict'
import { Context, symbols } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { registerRedisConnectionTools } from '../lib/host/ai-connection-tools.js'
import { registerRedisProfileTools } from '../lib/host/ai-profile-tools.js'
import { registerRedisTools } from '../lib/host/ai-tools.js'
import { RedisProfiles } from '../lib/host/profile-store.js'
import { RedisProfileSnapshots } from '../lib/host/profile-snapshots.js'
import { RedisRemoteService } from '../lib/remote-service.js'
import { withRedisFixture } from './redis-fixture.mjs'

const runtime = resolve(import.meta.dirname, '../.scratch/runtime')
await mkdir(runtime, { recursive: true })
const directory = await mkdtemp(join(runtime, 'ai-connect-smoke-'))
const signal = new AbortController().signal
try {
  const { fixture } = await withRedisFixture(async ({ settings, admin }) => {
    await admin.sendCommand(['SET', 'fixture:key', 'synthetic-value'])
    const buffers = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const before = await buffers.sendCommand(['DUMP', 'fixture:key'])
    const ctx = new Context(), snapshots = new RedisProfileSnapshots(), profiles = new RedisProfiles(directory)
    ctx.provide('profileContext', { name: 'fixture', dir: directory, patchPath: '', installAnchor: '', cwd: '.', home: '.', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined })
    await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime); await ctx.plugin(RedisRemoteService)
    const proxy = ctx.get('redisViewer'), service = proxy[symbols.original] ?? proxy
    const agent = { id: 'fixture-session', ctx, session: { id: 'fixture-session' } }
    try {
      const initial = await service.connect(agent, settings, signal)
      assert.equal(initial.state, 'connected')
      const { password: _password, ...safeSettings } = settings
      await profiles.save({ id: null, name: 'Fixture', settings: safeSettings }, signal)
      await ctx.plugin({ name: 'ai-connect-smoke', inject: ['tools'], apply: scope => {
        registerRedisTools(scope, service.ai)
        registerRedisProfileTools(scope, service.ai, snapshots, (owner, s) => service.listProfiles(owner, {}, s))
        registerRedisConnectionTools(scope, service.ai, snapshots, (owner, profile, s, current) => service.connectSavedProfile(owner, profile, s, current))
      } })
      const call = async (name, arguments_) => {
        const result = await ctx.tools.execute({ callId: 'fixture-call', name, arguments: arguments_, agent, signal })
        assert.equal(result.isError, false)
        return JSON.parse(result.content.filter(block => block.type === 'text').map(block => block.text).join(''))
      }
      const listed = await call('redis_viewer_profiles', {})
      const connected = await call('redis_viewer_connect_profile', { id: listed.profiles[0].id, snapshotToken: listed.profiles[0].snapshotToken })
      assert.equal(connected.state, 'connected'); assert.equal(connected.connection.db, 0)
      assert(connected.connection.generation > initial.generation)
      const value = await call('redis_viewer_value', { key: 'fixture:key' })
      assert.equal(value.value.text, 'synthetic-value')
      assert.deepEqual(await buffers.sendCommand(['DUMP', 'fixture:key']), before)
    } finally { await ctx.fiber.dispose() }
  }, { passwordRequired: false })
  assert(fixture.stopped)
  console.log(JSON.stringify({ passed: true, redisVersion: fixture.redisVersion, backend: fixture.backend ?? 'docker', fixtureStopped: fixture.stopped, checks: ['saved-profile token', 'connection exchange', 'subsequent read', 'unchanged Key'] }))
} finally {
  const actual = await realpath(directory)
  if (dirname(actual) !== await realpath(runtime) || !basename(actual).startsWith('ai-connect-smoke-')) throw new Error('Refusing cleanup outside the owned test directory')
  await rm(actual, { recursive: true })
}
