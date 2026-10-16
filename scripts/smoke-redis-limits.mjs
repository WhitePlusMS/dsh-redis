/** Adversarial wire/deadline checks run in isolated Node children, never user Redis. */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { RedisTransport } from '../lib/host/redis-transport.js'
import { RespDecoder } from '../lib/host/resp.js'
import { until } from './redis-fixture.mjs'

async function adversarial(mode) {
  const sockets = new Set()
  const server = createServer(socket => {
    sockets.add(socket); socket.on('error', () => undefined); socket.on('close', () => sockets.delete(socket))
    let parser = new RespDecoder()
    socket.on('data', chunk => {
      const result = parser.write(chunk)
      if (!result.done) return
      parser = new RespDecoder()
      assert(Array.isArray(result.value) && Buffer.isBuffer(result.value[0]))
      const command = result.value[0].toString()
      if (command === 'PING') { socket.write('+PONG\r\n'); return }
      assert.equal(command, 'SCAN')
      if (mode === 'bulk') socket.write('$536870912\r\n')
      if (mode === 'array') socket.write('*1000000000\r\n')
      if (mode === 'cumulative') {
        socket.write('*2\r\n$614400\r\n'); socket.write(Buffer.alloc(614400, 97)); socket.write('\r\n$614400\r\n')
      }
      // stalled: handshake succeeded, but its actual read never receives a reply.
    })
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const address = server.address(); assert(address && typeof address !== 'string')
  let transport
  const baseline = process.memoryUsage().rss
  let peak = baseline
  const sample = () => { peak = Math.max(peak, process.memoryUsage().rss) }
  const sampler = setInterval(sample, 5)
  try {
    transport = await RedisTransport.open({ host: '127.0.0.1', port: address.port, username: '', password: '', tls: null }, new AbortController().signal)
    const started = performance.now()
    const timesOut = mode === 'stalled' || mode === 'operation-deadline'
    await assert.rejects(transport.execute('SCAN', ['0'], new AbortController().signal, () => undefined, mode === 'operation-deadline' ? Date.now() + 200 : undefined), error => error.code === (timesOut ? 'timeout' : 'oversize'))
    const elapsedMs = Math.round(performance.now() - started)
    await until(() => sockets.size === 0, 'bounded frame failure closes peer socket')
    sample()
    const rssGrowthBytes = peak - baseline
    assert(rssGrowthBytes < 32 * 1024 * 1024, 'Unexpected RSS growth on bounded/malicious frame')
    if (mode === 'stalled') assert(elapsedMs >= 9500 && elapsedMs < 13000, 'Read must enforce the actual ten-second deadline')
    else if (mode === 'operation-deadline') assert(elapsedMs >= 150 && elapsedMs < 2000, 'Shared operation deadline must cap a shorter remaining command budget')
    else assert(elapsedMs < 2000, 'Declared oversize must fail before waiting for a body')
    return { mode, declared: mode === 'bulk' ? '512 MiB bulk' : mode === 'array' ? '1 billion array elements' : mode === 'cumulative' ? 'two 600 KiB bulks' : 'no read reply', elapsedMs, rssBaselineBytes: baseline, rssPeakBytes: peak, rssGrowthBytes, socketClosed: sockets.size === 0 }
  } finally {
    clearInterval(sampler); transport?.close()
    for (const socket of sockets) socket.destroy()
    await new Promise(done => server.close(done))
  }
}

if (process.argv[2] === '--child') {
  const mode = process.argv[3]
  assert(['bulk', 'array', 'cumulative', 'stalled', 'operation-deadline'].includes(mode))
  console.log(JSON.stringify(await adversarial(mode)))
} else {
  const report = { startedAt: new Date().toISOString(), checks: [], passed: false }
  try {
    for (const mode of ['bulk', 'array', 'cumulative', 'stalled', 'operation-deadline']) {
      const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=96', import.meta.filename, '--child', mode], { windowsHide: true, timeout: 20_000, maxBuffer: 256 * 1024 })
      report.checks.push(JSON.parse(stdout)); console.log('[limits] ' + mode + ' passed')
    }
    report.passed = true
  } catch (error) { report.error = error instanceof Error ? error.message : String(error); process.exitCode = 1; console.error(report.error) }
  finally {
    report.finishedAt = new Date().toISOString()
    const artifacts = resolve(import.meta.dirname, '../.scratch/artifacts'); await mkdir(artifacts, { recursive: true })
    await writeFile(resolve(artifacts, 'limits-smoke.json'), JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length }))
  }
}
