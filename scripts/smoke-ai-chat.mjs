/** Observe the official Session RPC/history of an owned native DSH fixture.
 * This does not mock the provider or invoke browser automation. Prompts and
 * side-panel selections are made in the actual UI through CUA.
 */
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

const root = resolve(import.meta.dirname,'..'), runtime = resolve(root,'.scratch/runtime')
const privatePath = resolve(process.env.REDIS_SMOKE_PRIVATE ?? resolve(runtime,'ai-chat-native.private.json'))
assert(privatePath.startsWith(runtime+sep))
const fixture = JSON.parse(await readFile(privatePath,'utf8'))
const metadataPath = resolve(process.env.REDIS_SMOKE_METADATA ?? resolve(runtime,'ai-chat-package.private.json'))
assert(metadataPath.startsWith(runtime+sep))
const meta = JSON.parse(await readFile(metadataPath,'utf8'))
// Match the release verifier: pnpm's CLI link is not the module's resolution
// directory on Windows. Resolve the real entry before asking for host peers.
const runtimeRequire = createRequire(await realpath(meta.cli))
const WebSocket = createRequire(runtimeRequire.resolve('@deepseek-ai/dsh-api-gateway/package.json'))('ws')
const auth = await fetch(fixture.readyUrl,{redirect:'manual'})
assert.equal(auth.status,303)
const cookie = auth.headers.get('set-cookie')?.split(';',1)[0]
assert(cookie)
const origin = new URL(fixture.readyUrl).origin
async function rpc(endpoint,args) {
  const response = await fetch(origin+'/api/'+endpoint,{
    method:'POST',headers:{'content-type':'application/json',cookie},
    body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method:endpoint,payload:{args}}),
  })
  assert(response.ok,'RPC HTTP '+response.status)
  const body = await response.json()
  assert(body.result.ok,'RPC rejected '+JSON.stringify(body.result.error))
  return body.result.value
}
async function cursor(sessionId) {
  const socket = new WebSocket(origin.replace(/^http/u,'ws')+'/api/remote.mux',{headers:{cookie}})
  const streamId = 'ai-acceptance-'+randomUUID()
  try {
    await new Promise((done,reject)=>{socket.once('open',done);socket.once('error',reject)})
    return await new Promise((done,reject)=>{
      const timer=setTimeout(()=>reject(new Error('History cursor timed out')),10000)
      socket.on('message',bytes=>{
        const frame=JSON.parse(bytes.toString())
        if(frame.streamId!==streamId)return
        if(frame.type==='error'){clearTimeout(timer);reject(new Error('History follow rejected'))}
        if(frame.type==='item'&&frame.value.type==='snapshot'){clearTimeout(timer);done(frame.value.cursor)}
      })
      socket.send(JSON.stringify({type:'open',streamId,endpoint:'session/follow',payload:{args:{request:{address:{kind:'session',sessionId}}}}}))
    })
  } finally {socket.close()}
}
const sessions = (await rpc('session/list',{_request:{}})).items
const evidence=[]
for(const session of sessions) {
  const throughSeq=await cursor(session.sessionId)
  const page=await rpc('session/page',{request:{address:{kind:'session',sessionId:session.sessionId},throughSeq,maxMessages:100}})
  const events=page.records.filter(record=>record.type==='event').map(record=>record.event)
  const calls=events.filter(event=>event.type==='tool/call').map(event=>({seq:event.seq,...event.data}))
  const results=events.filter(event=>event.type==='tool/result').map(event=>({seq:event.seq,...event.data}))
  const assistant=events.filter(event=>event.type==='assistant/message').flatMap(event=>event.data.message.content.filter(block=>block.type==='text').map(block=>block.text))
  evidence.push({sessionId:session.sessionId,running:session.running,hasMore:page.hasMore,throughSeq,calls,results,assistant,events})
}
const artifacts=resolve(meta.artifacts)
assert(artifacts.startsWith(resolve(root,'.scratch/artifacts')+sep))
await mkdir(artifacts,{recursive:true})
await writeFile(resolve(artifacts,'model-history.json'),JSON.stringify({observedAt:new Date().toISOString(),provider:meta.provider??'bzkj',model:meta.model??'DeepSeek-V4-Flash',modelSource:meta.modelSource??'actual-provider',sessions:evidence},null,2)+'\n')
console.log(JSON.stringify(evidence.map(item=>({sessionId:item.sessionId,running:item.running,hasMore:item.hasMore,calls:item.calls.map(call=>({seq:call.seq,name:call.name,arguments:call.arguments})),resultCount:item.results.length,errorCount:item.results.filter(result=>result.message?.isError===true).length,lastAssistantPreview:item.assistant.at(-1)?.slice(0,200)??null}))))
