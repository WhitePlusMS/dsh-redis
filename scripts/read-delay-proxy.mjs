/** Isolated acceptance proxy. It forwards real RESP2 to a real Redis and can
 * withhold one bounded reply; it never injects Redis commands or records authentication arguments in diagnostics.
 */
import assert from 'node:assert/strict'
import { createServer, createConnection } from 'node:net'
import { RespDecoder, MAX_REPLY_BYTES, MAX_REQUEST_BYTES } from '../lib/host/resp.js'

export async function createReadDelayProxy(settings) {
  assert.equal(settings.tls, null, 'This fixture explicitly covers plain loopback TCP')
  const links = new Map(), holds = new Set(), commands = [], errors = []
  let nextId = 0, armed = null
  const server = createServer(client => {
    const upstream = createConnection({ host: settings.host, port: settings.port })
    const link = { id: ++nextId, client, upstream, closed: false, request: null, hold: null, bytes: 0, chunks: [], input: new RespDecoder(MAX_REQUEST_BYTES), output: new RespDecoder() }
    links.set(link.id, link)
    function close() {
      if (link.closed) return
      link.closed = true; link.chunks = []; link.bytes = 0
      if (link.hold !== null) holds.delete(link.hold)
      client.destroy(); upstream.destroy()
    }
    link.close = close
    for (const socket of [client, upstream]) {
      socket.setNoDelay(true)
      socket.on('error', error => { errors.push(error.code ?? 'network'); close() })
      socket.on('close', close)
    }
    client.on('data', chunk => {
      try {
        assert(link.request === null && link.hold === null, 'A new request overtook a pending reply')
        const decoded = link.input.write(chunk)
        if (decoded.done) {
          assert(Array.isArray(decoded.value) && decoded.value.every(Buffer.isBuffer))
          const [name, ...args] = decoded.value; assert(name)
          const command = name.toString('ascii')
          link.request = { command, args }
          commands.push({ connectionId: link.id, command, ...(command !== 'AUTH' && command !== 'PING' && args[0] !== undefined ? { firstArgumentBase64: args[0].toString('base64') } : {}) })
          link.input = new RespDecoder(MAX_REQUEST_BYTES)
          if (armed !== null && armed.command === command && (armed.keyBase64 === null || args[0]?.toString('base64') === armed.keyBase64)) {
            link.hold = armed; armed.link = link; holds.add(armed); armed = null
          }
        }
        upstream.write(chunk)
      } catch { errors.push('proxy-request-protocol'); close() }
    })
    upstream.on('data', chunk => {
      try {
        assert(link.request !== null, 'Reply without an owned request')
        const decoded = link.output.write(chunk)
        if (link.hold !== null) {
          link.bytes += chunk.length; assert(link.bytes <= MAX_REPLY_BYTES)
          link.chunks.push(Buffer.from(chunk))
        } else client.write(chunk)
        if (decoded.done) {
          if (link.hold !== null) link.hold.received = true
          link.request = null; link.output = new RespDecoder()
        }
      } catch { errors.push('proxy-reply-protocol'); close() }
    })
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address(); assert(address && typeof address !== 'string')
  return {
    settings: { ...settings, host: '127.0.0.1', port: address.port }, commands, errors,
    get connections() { return [...links.values()].map(link => ({ id: link.id, closed: link.closed })) },
    holdNext(command, key = null) {
      assert(armed === null, 'Another acceptance reply is already armed')
      const hold = { command, keyBase64: key === null ? null : Buffer.from(key).toString('base64'), received: false, link: null,
        get connectionId() { return this.link?.id ?? null },
        release() {
          if (armed === hold) armed = null
          const link = this.link
          if (link !== null && link.hold === hold) {
            if (!link.closed) for (const chunk of link.chunks) link.client.write(chunk)
            link.chunks = []; link.bytes = 0; link.hold = null
          }
          holds.delete(hold)
        },
      }
      armed = hold
      return hold
    },
    disconnect(connectionId) { const link = links.get(connectionId); assert(link); link.close() },
    async close() {
      if (armed !== null) { armed.release(); armed = null }
      for (const hold of holds) hold.release()
      for (const link of links.values()) link.close()
      if (server.listening) await new Promise(resolve => server.close(resolve))
    },
  }
}
