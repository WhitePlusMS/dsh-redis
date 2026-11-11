import { createServer, type Socket } from 'node:net'
import { describe, expect, it } from 'vitest'
import { RedisTransport, type RedisReadCommand } from '../src/host/redis-transport.ts'
import { RedisFrameError, RedisReplyError, RespDecoder, type RedisReply } from '../src/host/resp.ts'

const signal = () => new AbortController().signal
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

/** A scripted loopback peer exercises transport ordering and deliberately invalid replies.
 * Official Redis container checks independently verify the real command/protocol semantics.
 */
async function withPeer(run: (transport: RedisTransport, commands: string[]) => Promise<void>, reply: (socket: Socket, arguments_: RedisReply[]) => void, password = ''): Promise<void> {
  const sockets = new Set<Socket>()
  const commands: string[] = []
  const server = createServer(socket => {
    sockets.add(socket)
    socket.on('error', () => undefined)
    socket.on('close', () => sockets.delete(socket))
    let parser = new RespDecoder()
    socket.on('data', (chunk: Buffer) => {
      const result = parser.write(chunk)
      if (!result.done) return
      parser = new RespDecoder()
      if (!Array.isArray(result.value)) throw new Error('Expected command argument array')
      const first = result.value[0]
      if (!Buffer.isBuffer(first)) throw new Error('Expected binary command name')
      commands.push(first.toString('utf8'))
      if (first.toString('utf8') === 'PING') socket.write('+PONG\r\n')
      else reply(socket, result.value)
    })
  })
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Expected owned TCP address')
  let transport: RedisTransport | undefined
  try {
    transport = await RedisTransport.open({ host: '127.0.0.1', port: address.port, username: '', password, tls: null }, signal())
    await run(transport, commands)
  } finally {
    transport?.close()
    for (const socket of sockets) socket.destroy()
    await new Promise<void>(done => server.close(() => done()))
  }
}
const SCAN_EMPTY = '*2\r\n$1\r\n0\r\n*0\r\n'

describe('bounded Redis socket transport', () => {
  it('cancels a queued transaction without dispatching it after the active read finishes', async () => {
    const firstSeen = deferred<Socket>()
    let reads = 0
    await withPeer(async (transport, commands) => {
      const first = transport.execute('SCAN', ['0'], signal(), () => undefined)
      const peer = await firstSeen.promise
      const controller = new AbortController()
      const write = transport.replaceExisting({ type: 'string', key: Buffer.from('key'), before: Buffer.from('old'), after: Buffer.from('new') }, controller.signal, () => undefined, () => { throw new Error('Must not submit') }, () => undefined)
      controller.abort()
      expect(await write).toBe('not-executed')
      expect(commands).toEqual(['PING', 'SCAN'])
      peer.write(SCAN_EMPTY)
      await first
      expect(await transport.execute('SCAN', ['0'], signal(), () => undefined)).toEqual([Buffer.from('0'), []])
      expect(commands).toEqual(['PING', 'SCAN', 'SCAN'])
    }, socket => { if (++reads === 1) firstSeen.resolve(socket); else socket.write(SCAN_EMPTY) })
  })
  it('holds one queue slot from WATCH through write readback', async () => {
    const watched = deferred<Socket>()
    let written = false
    const bulk = (text: string) => '$' + Buffer.byteLength(text) + '\r\n' + text + '\r\n'
    await withPeer(async (transport, commands) => {
      let submitted = false
      const write = transport.replaceExisting({ type: 'string', key: Buffer.from('key'), before: Buffer.from('old'), after: Buffer.from('new') }, signal(), () => undefined, () => { submitted = true }, () => undefined)
      const peer = await watched.promise
      const read = transport.execute('SCAN', ['0'], signal(), () => undefined)
      expect(commands).toEqual(['PING', 'INFO', 'WATCH'])
      peer.write('+OK\r\n')
      expect(await write).toBe('written-verified')
      expect(submitted).toBe(true)
      expect(await read).toEqual([Buffer.from('0'), []])
      expect(commands.at(-1)).toBe('SCAN')
      expect(commands.indexOf('SCAN')).toBeGreaterThan(commands.indexOf('EXEC'))
    }, (socket, args) => {
      const command = String(args[0])
      if (command === 'INFO') socket.write(bulk('redis_version:8.2.6\r\n'))
      else if (command === 'WATCH') { if (!written) watched.resolve(socket); else socket.write('+OK\r\n') }
      else if (command === 'TYPE') socket.write('+string\r\n')
      else if (command === 'PTTL') socket.write(':-1\r\n')
      else if (command === 'STRLEN') socket.write(':3\r\n')
      else if (command === 'GETRANGE') socket.write(bulk(written ? 'new' : 'old'))
      else if (command === 'MULTI') socket.write('+OK\r\n')
      else if (command === 'SET') socket.write('+QUEUED\r\n')
      else if (command === 'EXEC') { if (!written) { written = true; socket.write('*1\r\n+OK\r\n') } else socket.write('*0\r\n') }
      else if (command === 'SCAN') socket.write(SCAN_EMPTY)
      else throw new Error('Unexpected command ' + command)
    })
  })
  it('separates authentication and connection commands from explicit DB selection and reads', async () => {
    await withPeer(async (transport, commands) => {
      expect(commands).toEqual(['AUTH', 'PING'])
      expect(await transport.execute('SELECT', ['1'], signal(), () => undefined)).toBe('OK')
      expect(await transport.execute('SCAN', ['0'], signal(), () => undefined)).toEqual([Buffer.from('0'), []])
      expect(commands).toEqual(['AUTH', 'PING', 'SELECT', 'SCAN'])
    }, (socket, args) => {
      const parts = args.map(arg => Buffer.isBuffer(arg) ? arg.toString('utf8') : arg)
      const command = parts[0]
      if (command === 'AUTH') { expect(parts).toEqual(['AUTH', 'synthetic-fixture-password']); socket.write('+OK\r\n') }
      else if (command === 'SELECT') { expect(parts).toEqual(['SELECT', '1']); socket.write('+OK\r\n') }
      else if (command === 'SCAN') { expect(parts).toEqual(['SCAN', '0']); socket.write(SCAN_EMPTY) }
      else throw new Error('Unexpected command reached the peer')
    }, 'synthetic-fixture-password')
  })
  it.each(['ERR invalid password', 'ERR Client sent AUTH, but no password is set'])('classifies %s only in the AUTH exchange', async message => {
    const commands: string[] = []
    await expect(withPeer(async () => { throw new Error('Authentication must not succeed') }, (socket, args) => {
      commands.push(String(args[0])); socket.write('-' + message + '\r\n')
    }, 'synthetic-fixture-password')).rejects.toMatchObject({ code: 'auth' })
    expect(commands).toEqual(['AUTH'])
    await withPeer(async transport => {
      await expect(transport.execute('SCAN', ['0'], signal(), () => undefined)).rejects.toBeInstanceOf(RedisReplyError)
    }, socket => { socket.write('-' + message + '\r\n') })
  })
  it('rejects huge declared arrays/bulks and announces connection failure', async () => {
    for (const header of ['$536870912\r\n', '*1000000000\r\n']) {
      await withPeer(async transport => {
        const lost = deferred<Error>()
        transport.onFailure(lost.resolve)
        await expect(transport.execute('SCAN', ['0'], signal(), () => undefined)).rejects.toMatchObject({ code: 'oversize' })
        expect(await lost.promise).toBeInstanceOf(RedisFrameError)
      }, socket => { socket.write(header) })
    }
  })
  it('drains a cancelled reply before dispatching the next command, without consuming the old result', async () => {
    const firstSeen = deferred<Socket>()
    let reads = 0
    await withPeer(async (transport, commands) => {
      const controller = new AbortController()
      const first = transport.execute('SCAN', ['0'], controller.signal, () => undefined)
      const cancelled = expect(first).rejects.toMatchObject({ code: 'cancelled' })
      const peer = await firstSeen.promise
      controller.abort(); await cancelled
      const second = transport.execute('SCAN', ['0'], signal(), () => undefined)
      expect(commands).toEqual(['PING', 'SCAN'])
      peer.write(SCAN_EMPTY)
      expect(await second).toEqual([Buffer.from('9'), []])
      expect(commands).toEqual(['PING', 'SCAN', 'SCAN'])
    }, socket => { if (++reads === 1) firstSeen.resolve(socket); else socket.write('*2\r\n$1\r\n9\r\n*0\r\n') })
  })
  it('rechecks a queued target immediately before writing it', async () => {
    const firstSeen = deferred<Socket>()
    let reads = 0
    await withPeer(async (transport, commands) => {
      const first = transport.execute('SCAN', ['0'], signal(), () => undefined)
      const peer = await firstSeen.promise
      const stale = transport.execute('SCAN', ['0'], signal(), () => { throw new Error('stale target') })
      const rejected = expect(stale).rejects.toThrow('stale target')
      peer.write(SCAN_EMPTY)
      await first; await rejected
      expect(commands).toEqual(['PING', 'SCAN'])
      expect(await transport.execute('SCAN', ['0'], signal(), () => undefined)).toEqual([Buffer.from('0'), []])
    }, socket => { if (++reads === 1) firstSeen.resolve(socket); else socket.write(SCAN_EMPTY) })
  })
  it('bounds pending commands and skips cancelled entries instead of dispatching them later', async () => {
    const firstSeen = deferred<Socket>()
    await withPeer(async (transport, commands) => {
      const controllers = Array.from({ length: 16 }, () => new AbortController())
      const waiting = controllers.map(controller => transport.execute('SCAN', ['0'], controller.signal, () => undefined))
      const settled = Promise.allSettled(waiting)
      const peer = await firstSeen.promise
      await expect(transport.execute('SCAN', ['0'], signal(), () => undefined)).rejects.toMatchObject({ code: 'busy' })
      for (const controller of controllers) controller.abort()
      expect((await settled).every(value => value.status === 'rejected')).toBe(true)
      peer.write(SCAN_EMPTY)
      expect(commands).toEqual(['PING', 'SCAN'])
    }, socket => { firstSeen.resolve(socket) })
  })
  it('closes on malformed framing or a connection ending inside a bulk', async () => {
    for (const malformed of [true, false]) {
      await withPeer(async transport => {
        await expect(transport.execute('SCAN', ['0'], signal(), () => undefined)).rejects.toMatchObject({ code: malformed ? 'protocol' : 'network' })
      }, socket => { if (malformed) socket.write('+OK\r\n+SECOND\r\n'); else socket.end('$10\r\nabc') })
    }
  })
  it('keeps a framed permission failure separate from socket failure', async () => {
    let reads = 0
    await withPeer(async transport => {
      await expect(transport.execute('SCAN', ['0'], signal(), () => undefined)).rejects.toBeInstanceOf(RedisReplyError)
      expect(await transport.execute('SCAN', ['0'], signal(), () => undefined)).toEqual([Buffer.from('0'), []])
    }, socket => { socket.write(++reads === 1 ? '-NOPERM fixture denied\r\n' : SCAN_EMPTY) })
  })
  it('expires a queued deadline without sending it, leaving the active socket reusable', async () => {
    const firstSeen = deferred<Socket>()
    let reads = 0
    await withPeer(async (transport, commands) => {
      const first = transport.execute('SCAN', ['0'], signal(), () => undefined)
      const peer = await firstSeen.promise
      const queued = transport.execute('SCAN', ['0'], signal(), () => undefined, Date.now() + 60)
      await expect(queued).rejects.toMatchObject({ code: 'timeout' })
      expect(commands).toEqual(['PING', 'SCAN'])
      peer.write(SCAN_EMPTY); await first
      expect(await transport.execute('SCAN', ['0'], signal(), () => undefined)).toEqual([Buffer.from('0'), []])
      expect(commands).toEqual(['PING', 'SCAN', 'SCAN'])
    }, socket => { if (++reads === 1) firstSeen.resolve(socket); else socket.write(SCAN_EMPTY) })
  })
  it('announces a stalled active deadline once and never dispatches its queued successor', async () => {
    const firstSeen = deferred<Socket>()
    await withPeer(async (transport, commands) => {
      const failure = deferred<Error>(), failures: Error[] = []
      transport.onFailure(error => { failures.push(error); failure.resolve(error) })
      const first = transport.execute('SCAN', ['0'], signal(), () => undefined, Date.now() + 100)
      const firstRejected = expect(first).rejects.toMatchObject({ code: 'timeout' })
      await firstSeen.promise
      const queued = transport.execute('SCAN', ['0'], signal(), () => undefined)
      const queuedRejected = expect(queued).rejects.toMatchObject({ code: 'timeout' })
      await Promise.all([firstRejected, queuedRejected])
      expect(await failure.promise).toMatchObject({ code: 'timeout' })
      expect(failures).toHaveLength(1); expect(commands).toEqual(['PING', 'SCAN'])
      await expect(transport.execute('SCAN', ['0'], signal(), () => undefined)).rejects.toMatchObject({ code: 'timeout' })
    }, socket => { firstSeen.resolve(socket) })
  })
  it('drains every fragment after cancellation before the next command gets a reply', async () => {
    const firstSeen = deferred<Socket>()
    let reads = 0
    await withPeer(async (transport, commands) => {
      const controller = new AbortController()
      const first = transport.execute('SCAN', ['0'], controller.signal, () => undefined)
      const rejected = expect(first).rejects.toMatchObject({ code: 'cancelled' })
      const peer = await firstSeen.promise; controller.abort(); await rejected
      const second = transport.execute('SCAN', ['0'], signal(), () => undefined)
      peer.write('*2\r\n$1\r\n0\r\n')
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(commands).toEqual(['PING', 'SCAN'])
      peer.write('*0\r\n')
      expect(await second).toEqual([Buffer.from('9'), []])
      expect(commands).toEqual(['PING', 'SCAN', 'SCAN'])
    }, socket => { if (++reads === 1) firstSeen.resolve(socket); else socket.write('*2\r\n$1\r\n9\r\n*0\r\n') })
  })
  it('rejects removed diagnostic and module commands before dispatch', async () => {
    await withPeer(async (transport, commands) => {
      // Cast deliberately untrusted input to exercise the runtime boundary too.
      for (const command of ['JSON.GET', 'GEOPOS', 'PFCOUNT', 'TS.INFO', 'BF.EXISTS']) {
        await expect(transport.execute(command as RedisReadCommand, [], signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      }
      for (const args of [[], ['all']]) await expect(transport.execute('INFO', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
    }, () => { throw new Error('A removed command reached the peer') })
  })
  it('allows only fixed database metadata shapes and refuses config mutations or wildcards', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['SET', 'databases', '32'], ['GET', '*'], ['GET', 'databases', 'maxmemory'], [Buffer.from('GET'), 'databases']]) await expect(transport.execute('CONFIG', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      await expect(transport.execute('DBSIZE', ['extra'], signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      await expect(transport.execute('INFO', ['keyspace', 'all'], signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('DBSIZE', [], signal(), () => undefined)).toBe(760n)
      expect(await transport.execute('INFO', ['keyspace'], signal(), () => undefined)).toEqual(Buffer.alloc(0))
      expect(await transport.execute('CONFIG', ['GET', 'databases'], signal(), () => undefined)).toEqual([Buffer.from('databases'), Buffer.from('16')])
    }, (socket, args) => {
      const text = args.map(arg => Buffer.isBuffer(arg) ? arg.toString() : arg)
      if (text[0] === 'DBSIZE') socket.write(':760\r\n')
      else if (text[0] === 'INFO') { expect(text).toEqual(['INFO', 'keyspace']); socket.write('$0\r\n\r\n') }
      else { expect(text).toEqual(['CONFIG', 'GET', 'databases']); socket.write('*2\r\n$9\r\ndatabases\r\n$2\r\n16\r\n') }
    })
  })
  it('limits server INFO to approved single sections', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['all'], ['everything'], ['server', 'memory'], [Buffer.from('server')]]) await expect(transport.execute('INFO', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      for (const section of ['server', 'memory', 'clients', 'stats']) expect(await transport.execute('INFO', [section], signal(), () => undefined)).toEqual(Buffer.alloc(0))
      expect(commands).toEqual(['PING', 'INFO', 'INFO', 'INFO', 'INFO'])
    }, socket => { socket.write('$0\r\n\r\n') })
  })
  it('allows only a fixed, bounded MEMORY USAGE request', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['PURGE'], ['USAGE', Buffer.from('key')], ['USAGE', 'key', 'SAMPLES', '5'], ['USAGE', Buffer.from('key'), 'SAMPLES', '0'], ['USAGE', Buffer.from('key'), 'SAMPLES', '5', 'extra']]) {
        await expect(transport.execute('MEMORY', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      }
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('MEMORY', ['USAGE', Buffer.from([0, 255]), 'SAMPLES', '5'], signal(), () => undefined)).toBe(128n)
      expect(commands).toEqual(['PING', 'MEMORY'])
    }, (socket, args) => {
      expect(args).toEqual([Buffer.from('MEMORY'), Buffer.from('USAGE'), Buffer.from([0, 255]), Buffer.from('SAMPLES'), Buffer.from('5')])
      socket.write(':128\r\n')
    })
  })
  it('allows only bounded SLOWLOG GET and rejects reset or all entries', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['RESET'], ['GET'], ['GET', '-1'], ['GET', '0'], ['GET', '11'], ['GET', '1', 'extra']]) await expect(transport.execute('SLOWLOG', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('SLOWLOG', ['GET', '10'], signal(), () => undefined)).toEqual([])
      expect(commands).toEqual(['PING', 'SLOWLOG'])
    }, (socket, args) => {
      expect(args).toEqual([Buffer.from('SLOWLOG'), Buffer.from('GET'), Buffer.from('10')]); socket.write('*0\r\n')
    })
  })
  it('allows only XINFO GROUPS for one binary Stream Key', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['STREAM', Buffer.from('key')], ['GROUPS', 'key'], ['GROUPS', Buffer.from('key'), 'extra']]) await expect(transport.execute('XINFO', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('XINFO', ['GROUPS', Buffer.from([0, 255])], signal(), () => undefined)).toEqual([])
      expect(commands).toEqual(['PING', 'XINFO'])
    }, (socket, args) => { expect(args).toEqual([Buffer.from('XINFO'), Buffer.from('GROUPS'), Buffer.from([0, 255])]); socket.write('*0\r\n') })
  })
  it('allows only one bounded raw TimeSeries window', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['key', '0', '1', 'COUNT', '1'], [Buffer.from('key'), '-', '+', 'COUNT', '1'], [Buffer.from('key'), '2', '1', 'COUNT', '1'], [Buffer.from('key'), '0', '1', 'COUNT', '102'], [Buffer.from('key'), '0', '1', 'COUNT', '1', 'AGGREGATION', 'sum', '1']]) await expect(transport.execute('TS.RANGE', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      await expect(transport.execute('TS.ADD' as RedisReadCommand, [Buffer.from('key'), '1', '1'], signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('TS.RANGE', [Buffer.from([0, 255]), '0', '1000', 'COUNT', '101'], signal(), () => undefined)).toEqual([[1000n, '1.25']])
      expect(commands).toEqual(['PING', 'TS.RANGE'])
    }, (socket, args) => { expect(args).toEqual([Buffer.from('TS.RANGE'), Buffer.from([0, 255]), Buffer.from('0'), Buffer.from('1000'), Buffer.from('COUNT'), Buffer.from('101')]); socket.write('*1\r\n*2\r\n:1000\r\n+1.25\r\n') })
  })
  it('allows one explicit JSONPath and no write or formatting commands', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['key', '$'], [Buffer.from('key')], [Buffer.from('key'), 'x'], [Buffer.from('key'), '$', '$.other'], [Buffer.from('key'), '$' + 'x'.repeat(1024)], [Buffer.from('key'), '$\ud800']]) await expect(transport.execute('JSON.GET', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      await expect(transport.execute('JSON.SET' as RedisReadCommand, [Buffer.from('key'), '$', '1'], signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('JSON.GET', [Buffer.from([0, 255]), '$.x'], signal(), () => undefined)).toEqual(Buffer.from('[1]'))
      expect(commands).toEqual(['PING', 'JSON.GET'])
    }, (socket, args) => { expect(args).toEqual([Buffer.from('JSON.GET'), Buffer.from([0, 255]), Buffer.from('$.x')]); socket.write('$3\r\n[1]\r\n') })
  })
  it('accepts only fixed GEO point and distance argument shapes', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['key', Buffer.from('member')], [Buffer.from('key'), Buffer.from('a'), Buffer.from('b')]]) await expect(transport.execute('GEOPOS', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      for (const args of [[], [Buffer.from('key'), Buffer.from('a'), Buffer.from('b')], [Buffer.from('key'), Buffer.from('a'), Buffer.from('b'), 'yards'], [Buffer.from('key'), Buffer.from('a'), Buffer.from('b'), 'm', 'extra']]) await expect(transport.execute('GEODIST', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('GEOPOS', [Buffer.from('key'), Buffer.from([0, 255])], signal(), () => undefined)).toEqual([null])
      expect(await transport.execute('GEODIST', [Buffer.from('key'), Buffer.from('a'), Buffer.from('b'), 'km'], signal(), () => undefined)).toEqual(Buffer.from('1.25'))
      expect(commands).toEqual(['PING', 'GEOPOS', 'GEODIST'])
    }, (socket, args) => { if (String(args[0]) === 'GEOPOS') socket.write('*1\r\n$-1\r\n'); else socket.write('$4\r\n1.25\r\n') })
  })
  it('allows only CLIENT LIST and rejects connection administration', async () => {
    await withPeer(async (transport, commands) => {
      for (const args of [[], ['KILL', 'ID', '1'], ['PAUSE', '100'], ['LIST', 'ID', '1'], [Buffer.from('LIST')]]) await expect(transport.execute('CLIENT', args, signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
      expect(await transport.execute('CLIENT', ['LIST'], signal(), () => undefined)).toEqual(Buffer.alloc(0))
      expect(commands).toEqual(['PING', 'CLIENT'])
    }, (socket, args) => { expect(args).toEqual([Buffer.from('CLIENT'), Buffer.from('LIST')]); socket.write('$0\r\n\r\n') })
  })
  it('refuses cancelled and non-allowlisted commands before writing them', async () => {
    await withPeer(async (transport, commands) => {
      const controller = new AbortController(); controller.abort()
      await expect(transport.execute('SCAN', ['0'], controller.signal, () => undefined)).rejects.toMatchObject({ code: 'cancelled' })
      const untrusted = 'SET' as RedisReadCommand
      await expect(transport.execute(untrusted, ['key', 'value'], signal(), () => undefined)).rejects.toMatchObject({ code: 'protocol' })
      expect(commands).toEqual(['PING'])
    }, () => { throw new Error('A rejected command reached the peer') })
  })
})
