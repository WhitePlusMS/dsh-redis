/** Owned Redis + installed DSH fixture for native browser acceptance.
 * Browser interactions are performed through CUA. This process only seeds
 * synthetic data, starts the isolated runtime and exposes bounded test controls.
 * POST /stop always closes the proxy, child tree and owned Redis in finally.
 */
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { RESP_TYPES } from 'redis'
import { withRedisFixture } from './redis-fixture.mjs'
import { createReadDelayProxy } from './read-delay-proxy.mjs'

const root = resolve(import.meta.dirname, '..'), runtime = resolve(root, '.scratch/runtime')
const home = resolve(process.env.REDIS_SMOKE_HOME ?? resolve(runtime, 'dsh-home'))
const artifacts = resolve(process.env.REDIS_SMOKE_ARTIFACTS ?? resolve(root, '.scratch/artifacts'))
const privateFile = resolve(process.env.REDIS_SMOKE_PRIVATE ?? resolve(runtime, 'slim-native.private.json'))
const realModel = process.env.REDIS_SMOKE_REAL_MODEL === '1'
const run = promisify(execFile), cli = process.env.DSH_CLI_ENTRY
assert(cli, 'Set DSH_CLI_ENTRY to the verified rc.2 lib/bin.js')
assert(home.startsWith(runtime + sep) && privateFile.startsWith(runtime + sep), 'Owned runtime paths must stay inside project scratch')
assert(artifacts.startsWith(resolve(root, '.scratch/artifacts') + sep) || artifacts === resolve(root, '.scratch/artifacts'))
const report = { startedAt: new Date().toISOString(), passed: false, processStopped: false, fixtureStopped: false }
const allowed = new Set(['AUTH','PING','SELECT','DBSIZE','INFO','CONFIG','SCAN','TYPE','PTTL','STRLEN','GETRANGE','HLEN','HSCAN','HGET','LLEN','LRANGE','SCARD','SSCAN','SISMEMBER','ZCARD','ZRANGE','ZSCAN','ZSCORE','XLEN','XRANGE','XREVRANGE'])
const readable = new Set(['PING','GETRANGE','HSCAN','HGET','LRANGE','SSCAN','SISMEMBER','ZRANGE','ZSCAN','ZSCORE','XRANGE','XREVRANGE','SCAN'])
await mkdir(artifacts, { recursive: true })

async function sameFiles(source, installed) {
  const entries = await readdir(source, { withFileTypes: true })
  assert.deepEqual((await readdir(installed)).sort(), entries.map(entry => entry.name).sort())
  for (const entry of entries) {
    const a = resolve(source, entry.name), b = resolve(installed, entry.name)
    if (entry.isDirectory()) await sameFiles(a, b)
    else assert((await readFile(a)).equals(await readFile(b)), 'Installed mismatch: ' + relative(root, a))
  }
}

try {
  const checked = await withRedisFixture(async fixture => {
    report.fixture = fixture.metadata
    const { admin } = fixture
    const value = index => JSON.stringify({ id: index, name: 'needle', payload: { rows: Array.from({ length: 20 }, (_, n) => 'payload ' + n) }, tail: Array.from({ length: 32 }, (_, n) => 'line ' + n) })
    const keys = ['string','hash','list','set','zset','stream'].map(type => 'slim:' + type)
    await admin.set(keys[0], value(0))
    for (let index = 0; index < 240; ++index) {
      const item = value(index)
      await admin.hSet(keys[1], 'field-' + String(index).padStart(3, '0'), item)
      await admin.rPush(keys[2], item); await admin.sAdd(keys[3], item)
      await admin.zAdd(keys[4], { score: index + 0.125, value: item })
      await admin.sendCommand(['XADD',keys[5],(index + 1) + '-0','field',item,'field','duplicate'])
    }
    await admin.sendCommand(['XGROUP','CREATE',keys[5],'unchanged-fixture-group','0'])
    if (realModel) {
      const compact = ['string','hash','list','set','zset','stream'].map(type => 'ai:' + type)
      await admin.set(compact[0], 'synthetic-string-value')
      await admin.hSet(compact[1], { temperature: '24.8', state: 'synthetic-running' })
      await admin.rPush(compact[2], ['synthetic-first','synthetic-second'])
      await admin.sAdd(compact[3], ['synthetic-alpha','synthetic-beta'])
      await admin.zAdd(compact[4], [{score:1.25,value:'synthetic-alpha'},{score:2.5,value:'synthetic-beta'}])
      await admin.sendCommand(['XADD',compact[5],'1-0','field','synthetic-first','field','synthetic-second'])
      keys.push(...compact)
    }
    await admin.select(1); await admin.set('db1:only','synthetic'); await admin.select(0)
    const binary = admin.withTypeMapping({ [RESP_TYPES.BLOB_STRING]: Buffer })
    const dumps = () => Promise.all(keys.map(async key => (await binary.sendCommand(['DUMP',key])).toString('base64')))
    const before = await dumps(), groups = await admin.sendCommand(['XINFO','GROUPS',keys[5]])
    const proxy = await createReadDelayProxy(fixture.settings)
    let hold = null, child, server, output = '', exited
    try {
      await sameFiles(resolve(root,'lib'),resolve(home,'profiles/web/node_modules/dsh-redis/lib'))
      const env = { ...process.env, DSH_HOME: home, DSH_AGENTS_HOME: resolve(home,'agents'), DO_NOT_TRACK: '1' }
      if (!realModel) {
        env.DEEPSEEK_API_KEY = 'keyless-owned-fixture'; env.DEEPSEEK_BASE_URL = 'http://127.0.0.1:1'
        delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY
      }
      child = spawn(process.execPath,[cli,'web','--no-open','--host','127.0.0.1','--port','0'],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
      exited = new Promise(done => child.once('close',done))
      const readyUrl = await new Promise((done,reject) => {
        const timer = setTimeout(() => reject(new Error('Owned DSH startup timed out')),60_000)
        const consume = chunk => {
          output = (output + chunk.toString()).slice(-120_000)
          const match = output.match(/dsh web:\s*(http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s\x1b]+)/u)
          if (match) { clearTimeout(timer); done(match[1]) }
        }
        child.stdout.on('data',consume); child.stderr.on('data',consume)
        child.once('error',error => {clearTimeout(timer);reject(error)})
        child.once('exit',code => {clearTimeout(timer);reject(new Error('Owned DSH exited: '+code))})
      })
      let stop
      const stopped = new Promise(done => { stop = done })
      const verify = async () => {
        assert.deepEqual(await dumps(),before); assert.deepEqual(await admin.sendCommand(['XINFO','GROUPS',keys[5]]),groups)
        assert(proxy.commands.every(entry => allowed.has(entry.command))); assert.deepEqual(proxy.errors,[])
        return { dumpKeysUnchanged: keys.length, streamGroupsUnchanged: true, commands: [...new Set(proxy.commands.map(entry => entry.command))].sort(), proxyErrors: [] }
      }
      server = createServer(async (request,response) => {
        response.setHeader('content-type','application/json')
        try {
          const path = new URL(request.url,'http://127.0.0.1').pathname
          if (request.method === 'GET' && path === '/state') {
            response.end(JSON.stringify({hold:hold === null ? null : {received:hold.received,connectionId:hold.connectionId},clients:await fixture.clients(),commands:proxy.commands,errors:proxy.errors})); return
          }
          assert.equal(request.method,'POST')
          let input = ''; for await (const chunk of request) {input += chunk;assert(input.length < 4096)}
          if (path === '/hold') {
            const {command,key = null} = JSON.parse(input);assert(readable.has(command));assert(hold === null)
            hold = proxy.holdNext(command,key); response.end('{"armed":true}'); return
          }
          if (path === '/release') {hold?.release();hold = null;response.end('{"released":true}');return}
          if (path === '/verify') {report.readOnly = await verify();response.end(JSON.stringify(report.readOnly));return}
          if (path === '/stop') {hold?.release();hold = null;report.readOnly = await verify();response.end('{"stopping":true}');stop();return}
          response.statusCode = 404;response.end('{}')
        } catch (error) {response.statusCode = 400;response.end(JSON.stringify({error:error.message}))}
      })
      await new Promise((done,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',done)})
      const address = server.address();assert(address && typeof address !== 'string')
      // Private scratch file is never committed or copied into the evidence report.
      await writeFile(privateFile,JSON.stringify({readyUrl,control:'http://127.0.0.1:'+address.port,settings:proxy.settings,keys,owner:fixture.metadata.owner}),{mode:0o600})
      console.log(JSON.stringify({ready:true,controlPort:address.port,dshPid:child.pid,fixtureKeys:keys.length}))
      await stopped
      report.passed = true
    } finally {
      hold?.release()
      if (server?.listening) await new Promise(done => server.close(done))
      await proxy.close()
      if (child !== undefined && child.exitCode === null && child.signalCode === null) {
        if (process.platform === 'win32') await run('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true}).catch(() => undefined)
        else child.kill('SIGTERM')
        await Promise.race([exited,delay(5000)])
      }
      report.processStopped = child === undefined || child.exitCode !== null || child.signalCode !== null
      assert(report.processStopped,'Owned DSH did not stop')
      const safe = output.replace(/([?&]token=)[^\s&]+/gu,'$1[redacted]').replaceAll(fixture.settings.password,'[redacted]')
      await writeFile(resolve(artifacts,'slim-native-host.log'),safe)
    }
  })
  report.fixtureStopped = checked.fixture.stopped && checked.fixture.fixtureRemoved
  assert(report.fixtureStopped)
} catch (error) {report.error = error.stack;process.exitCode = 1;console.error(error.message)}
finally {
  report.finishedAt = new Date().toISOString()
  await writeFile(resolve(artifacts,'slim-native-session.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify({passed:report.passed,processStopped:report.processStopped,fixtureStopped:report.fixtureStopped}))
}
