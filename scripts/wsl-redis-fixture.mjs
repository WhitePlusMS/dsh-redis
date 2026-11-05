/** Explicit opt-in test backend: verified official image files, no system install. */
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { resolve, dirname, basename, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { createClient } from 'redis'

const root = resolve(import.meta.dirname, '..')
const runtime = resolve(root, '.scratch/runtime')
const imageBase = resolve(runtime, 'redis-image-f4a7260ec5f0')
const imageRoot = resolve(imageBase, 'root')
const wslPath = path => {
  assert(/^[A-Za-z]:\\/u.test(path)); return '/mnt/' + path[0].toLowerCase() + '/' + path.slice(3).replaceAll('\\', '/')
}
const exec = promisify(execFile)
async function freePort() {
  const server = createServer()
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const address = server.address(); assert(address && typeof address !== 'string')
  await new Promise(done => server.close(done)); return address.port
}
async function removeOwned(directory, expectedName) {
  const actual = await realpath(directory)
  const parent = await realpath(runtime)
  assert(actual.startsWith(parent + sep) && dirname(actual) === parent && basename(actual) === expectedName, 'Refusing cleanup outside exact owned fixture')
  await rm(actual, { recursive: true })
}

export async function withWslRedisFixture(run, { passwordRequired, tls, wrongHostname, disableGeoPos, disableHllCount, disableMemory, image }) {
  const receipt = JSON.parse(await readFile(resolve(imageBase, 'verified-image.json'), 'utf8'))
  assert.equal(receipt.imageIndex, image.split('@')[1]); assert.equal(receipt.manifest, 'sha256:f4a7260ec5f053de31eccb19ba2c997f7c3ea4ace799c9479d411b84bd6f158e')
  const owner = randomUUID(), password = passwordRequired ? randomUUID() : ''
  const directory = resolve(runtime, 'wsl-fixture-' + owner)
  await mkdir(directory, { recursive: false })
  let certDirectory, wrongCaPem, caPem, child, admin, closed
  let output = ''
  const metadata = { backend: 'wsl-image', image, manifest: receipt.manifest, owner, container: null, redisVersion: null, moduleCommands: [], tls, stopped: false, certificatesRemoved: !tls, fixtureRemoved: false }
  try {
    if (tls) {
      assert(process.env.REDIS_TEST_PYTHON, 'Set REDIS_TEST_PYTHON explicitly')
      certDirectory = resolve(runtime, 'tls-fixture-' + owner)
      await exec(process.env.REDIS_TEST_PYTHON, [resolve(import.meta.dirname, 'create-tls-fixture.py'), certDirectory, wrongHostname ? 'mismatch' : 'valid'], { windowsHide: true, timeout: 30_000 })
      caPem = await readFile(resolve(certDirectory, 'ca.pem'), 'utf8'); wrongCaPem = await readFile(resolve(certDirectory, 'wrong-ca.pem'), 'utf8')
    }
    const port = await freePort()
    // A private config avoids WSL's Windows-command-line handling of empty arguments.
    const quote = value => JSON.stringify(value)
    const config = ['bind 127.0.0.1', 'protected-mode yes', 'port ' + (tls ? '0' : String(port)), 'save ""', 'appendonly no', 'loglevel warning',
      'dir ' + quote(wslPath(directory)), 'pidfile ' + quote(wslPath(resolve(directory, 'redis.pid'))), 'maxmemory 128mb', 'maxmemory-policy noeviction',
      ...(passwordRequired ? ['requirepass ' + password] : []),
      ...(tls ? ['tls-port ' + port, 'tls-cert-file ' + quote(wslPath(resolve(certDirectory, 'server.pem'))), 'tls-key-file ' + quote(wslPath(resolve(certDirectory, 'server.key'))), 'tls-ca-cert-file ' + quote(wslPath(resolve(certDirectory, 'ca.pem'))), 'tls-auth-clients no'] : []),
      ...['redisbloom', 'redisearch', 'redistimeseries', 'rejson'].map(name => 'loadmodule ' + quote(wslPath(resolve(imageRoot, 'usr/local/lib/redis/modules/' + name + '.so')))),
      // Built-in GEOPOS exists during config parsing; confined refusal fixture.
      ...(disableGeoPos ? ['rename-command GEOPOS ""'] : []),
      ...(disableHllCount ? ['rename-command PFCOUNT ""'] : []),
      ...(disableMemory ? ['rename-command MEMORY \"\"'] : []),
    ].join('\n') + '\n'
    await writeFile(resolve(directory, 'redis.conf'), config, { mode: 0o600 })
    const args = ['-d', 'Ubuntu', '--exec', wslPath(resolve(imageRoot, 'lib/ld-musl-x86_64.so.1')), '--library-path', [resolve(imageRoot, 'lib'), resolve(imageRoot, 'usr/lib')].map(wslPath).join(':'), wslPath(resolve(imageRoot, 'usr/local/bin/redis-server')), wslPath(resolve(directory, 'redis.conf'))]
    child = spawn('wsl.exe', args, { cwd: directory, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    closed = new Promise((done, reject) => { child.once('error', reject); child.once('close', done) })
    const consume = chunk => { output = (output + chunk.toString(chunk.subarray(0, 80).filter(byte => byte === 0).length > 10 ? 'utf16le' : 'utf8')).slice(-16000) }
    child.stdout.on('data', consume); child.stderr.on('data', consume)
    const settings = { host: '127.0.0.1', port, username: '', password, tls: tls ? { caPem } : null }
    const deadline = Date.now() + 20_000
    while (admin === undefined) {
      const candidate = createClient({ socket: { host: settings.host, port, reconnectStrategy: false, connectTimeout: 500,
        ...(tls ? { tls: true, ca: caPem, rejectUnauthorized: true, ...(wrongHostname ? { servername: 'wrong-host.fixture' } : {}) } : {}),
      }, ...(passwordRequired ? { password } : {}) })
      candidate.on('error', () => undefined)
      try { await candidate.connect(); await candidate.ping(); admin = candidate }
      catch {
        if (candidate.isOpen) candidate.destroy()
        if (child.exitCode !== null || Date.now() >= deadline) throw new Error('Owned WSL Redis startup failed: ' + output.replaceAll(password || owner, '[redacted]'))
        await delay(100)
      }
    }
    metadata.redisVersion = /redis_version:([^\r\n]+)/u.exec(await admin.info('server'))?.[1] ?? null
    assert.equal(metadata.redisVersion, '8.2.6')
    const commands = ['JSON.GET', 'TS.RANGE', 'BF.INFO'], info = await admin.sendCommand(['COMMAND', 'INFO', ...commands])
    metadata.moduleCommands = commands.filter((_name, index) => info[index] !== null)
    assert.equal(metadata.moduleCommands.length, 3)
    const clients = async () => (await admin.sendCommand(['CLIENT', 'LIST'])).trim().split('\n').filter(Boolean).length
    const value = await run({ settings, admin, clients, metadata, wrongCaPem, certDirectory })
    return { value, fixture: metadata }
  } finally {
    try {
      if (admin?.isOpen) {
        // The admin authenticated to this randomly owned endpoint; no user server is used.
        await admin.sendCommand(['SHUTDOWN', 'NOSAVE']).catch(() => undefined)
        if (admin.isOpen) admin.destroy()
      }
      if (child !== undefined && child.exitCode === null && child.signalCode === null) {
        const stop = `import os,pathlib,signal,sys,time
p=pathlib.Path(sys.argv[1]);d=pathlib.Path(sys.argv[2]).resolve()
if p.exists():
 pid=int(p.read_text());cwd=pathlib.Path('/proc/'+str(pid)+'/cwd')
 if cwd.exists():
  assert cwd.resolve()==d,'Refusing to signal a process outside owned fixture'
  os.kill(pid,signal.SIGTERM)
`
        await exec('wsl.exe', ['-d', 'Ubuntu', '--exec', 'python3', '-c', stop, wslPath(resolve(directory, 'redis.pid')), wslPath(directory)], { windowsHide: true, timeout: 5000 })
        const stopped = await Promise.race([closed.then(() => true), delay(5000).then(() => false)])
        assert(stopped, 'Owned WSL Redis did not exit after shutdown')
      }
      metadata.stopped = child === undefined || child.exitCode !== null || child.signalCode !== null
      assert(metadata.stopped)
    } finally {
      if (metadata.stopped) {
        if (certDirectory !== undefined) { await removeOwned(certDirectory, 'tls-fixture-' + owner); metadata.certificatesRemoved = true }
        await removeOwned(directory, 'wsl-fixture-' + owner); metadata.fixtureRemoved = true
      }
    }
  }
}
