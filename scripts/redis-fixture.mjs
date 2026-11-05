/** Exclusive Redis container for acceptance; all mutations belong to fixture setup. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, realpath, rm } from 'node:fs/promises'
import { resolve, dirname, basename, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { createClient } from 'redis'
import { withWslRedisFixture } from './wsl-redis-fixture.mjs'

const exec = promisify(execFile)
const IMAGE = 'redis:8.2.6-alpine@sha256:ea5a07305d6c66f99df5a5ff8d9659e8f6cb598e6e586dc8dd92b7fcd915746e'
const LABEL = 'dsh-redis-test-owner'
const docker = async (...args) => (await exec('docker', args, { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 })).stdout.trim()

export async function until(check, description, timeout = 3000) {
  const deadline = Date.now() + timeout
  while (!(await check())) {
    if (Date.now() >= deadline) throw new Error('Timed out: ' + description)
    await delay(25)
  }
}

/** No host data mount, fixed trusted image, random loopback port and ownership-checked cleanup. */
export async function withRedisFixture(run, { passwordRequired = true, tls = false, wrongHostname = false, disableGeoPos = false, disableHllCount = false, disableMemory = false } = {}) {
  if (process.env.REDIS_TEST_BACKEND === 'wsl-image') return withWslRedisFixture(run, { passwordRequired, tls, wrongHostname, disableGeoPos, disableHllCount, disableMemory, image: IMAGE })
  const owner = randomUUID()
  const name = 'dsh-redis-test-' + owner
  const password = passwordRequired ? randomUUID() : ''
  let container
  let admin
  let certDirectory
  let caPem
  let wrongCaPem
  const metadata = { image: IMAGE, owner, container: null, redisVersion: null, moduleCommands: [], tls, stopped: false, certificatesRemoved: !tls }
  try {
    if (tls) {
      assert(process.env.REDIS_TEST_PYTHON, 'Set REDIS_TEST_PYTHON to a Python runtime with cryptography')
      certDirectory = resolve(import.meta.dirname, '../.scratch/runtime/tls-fixture-' + owner)
      await exec(process.env.REDIS_TEST_PYTHON, [resolve(import.meta.dirname, 'create-tls-fixture.py'), certDirectory, wrongHostname ? 'mismatch' : 'valid'], { windowsHide: true, timeout: 30_000 })
      caPem = await readFile(resolve(certDirectory, 'ca.pem'), 'utf8')
      wrongCaPem = await readFile(resolve(certDirectory, 'wrong-ca.pem'), 'utf8')
    }
    container = await docker('create', '--name', name, '--label', LABEL + '=' + owner, '--memory', '384m', '--cpus', '1', '--tmpfs', '/data', '-p', '127.0.0.1::6379',
      ...(tls ? ['--mount', 'type=bind,source=' + certDirectory + ',target=/tls,readonly'] : []), IMAGE,
      'redis-server', '--save', '', '--appendonly', 'no', '--loglevel', 'warning',
      ...(tls ? ['--port', '0', '--tls-port', '6379', '--tls-cert-file', '/tls/server.pem', '--tls-key-file', '/tls/server.key', '--tls-ca-cert-file', '/tls/ca.pem', '--tls-auth-clients', 'no'] : []),
      ...(passwordRequired ? ['--requirepass', password] : []), ...(disableGeoPos ? ['--rename-command', 'GEOPOS', ''] : []), ...(disableHllCount ? ['--rename-command', 'PFCOUNT', ''] : []), ...(disableMemory ? ['--rename-command', 'MEMORY', ''] : []))
    assert(/^[a-f0-9]{64}$/.test(container))
    metadata.container = container
    await docker('start', container)
    const mapped = await docker('port', container, '6379/tcp')
    const match = /^127\.0\.0\.1:(\d+)$/.exec(mapped)
    assert(match, 'Fixture must bind only on loopback')
    const settings = { host: '127.0.0.1', port: Number(match[1]), username: '', password, tls: tls ? { caPem } : null }
    const deadline = Date.now() + 20_000
    while (admin === undefined) {
      const candidate = createClient({ socket: { host: settings.host, port: settings.port, reconnectStrategy: false, connectTimeout: 1000,
        ...(tls ? { tls: true, ca: caPem, rejectUnauthorized: true, ...(wrongHostname ? { servername: 'wrong-host.fixture' } : {}) } : {}),
      }, ...(passwordRequired ? { password } : {}) })
      candidate.on('error', () => undefined)
      try { await candidate.connect(); await candidate.ping(); admin = candidate }
      catch (error) {
        if (candidate.isOpen) candidate.destroy()
        if (Date.now() >= deadline) throw error
        await delay(100)
      }
    }
    metadata.redisVersion = /redis_version:([^\r\n]+)/.exec(await admin.info('server'))?.[1] ?? null
    assert.equal(metadata.redisVersion, '8.2.6')
    const commands = ['JSON.GET', 'TS.RANGE', 'BF.INFO']
    const commandInfo = await admin.sendCommand(['COMMAND', 'INFO', ...commands])
    metadata.moduleCommands = Array.isArray(commandInfo) ? commands.filter((_name, index) => commandInfo[index] !== null) : []
    const clients = async () => (await admin.sendCommand(['CLIENT', 'LIST'])).trim().split('\n').filter(Boolean).length
    const value = await run({ settings, admin, clients, metadata, wrongCaPem, certDirectory })
    return { value, fixture: metadata }
  } finally {
    try {
      if (admin?.isOpen) admin.destroy()
      if (container !== undefined) {
        const labels = JSON.parse(await docker('inspect', '--format', '{{json .Config.Labels}}', container))
        assert.equal(labels[LABEL], owner, 'Refusing cleanup without our ownership marker')
        await docker('rm', '--force', '--volumes', container)
        metadata.stopped = true
      }
    } finally {
      if (certDirectory !== undefined) {
        const actual = await realpath(certDirectory).catch(error => { if (error.code !== 'ENOENT') throw error; return undefined })
        if (actual !== undefined) {
          const runtime = await realpath(resolve(import.meta.dirname, '../.scratch/runtime'))
          assert(actual.startsWith(runtime + sep) && dirname(actual) === runtime && basename(actual) === 'tls-fixture-' + owner, 'Refusing recursive cleanup outside the exact owned directory')
          await rm(actual, { recursive: true })
        }
        metadata.certificatesRemoved = true
      }
    }
  }
}
