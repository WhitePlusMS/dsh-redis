/** Current RESP navigation acceptance against owned native DSH + official Redis. */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { RESP_TYPES } from 'redis'
import { until } from './redis-fixture.mjs'
import { assertSelectedIdentity, findLoadedKey, resizeSidebar, chooseValueFormat } from './native-view-controls.mjs'

export async function prepareRespFixture(fixture) {
  const admin = fixture.admin
  fixture.respKeys = { hash: 'CDP:hash', set: 'FOURWAYCAR:set', list: 'FZ:list', zset: 'L:zset', stream: 'PY:stream', ts: 'Y:timeseries', geo: 'file:geo' }
  const k = fixture.respKeys
  const rows = Array.from({ length: 235 }, (_, i) => String(i).padStart(3, '0'))
  await admin.hSet(k.hash, Object.fromEntries(rows.map(i => ['row_' + i, JSON.stringify({ id: i, col_0: 'DBX16.6', label: 'fixture ' + 'x'.repeat(90) })])))
  await admin.hSet(k.hash, Buffer.from([255, 0]), Buffer.from([254, 0]))
  await admin.sAdd(k.set, rows.map(i => 'item-' + i))
  await admin.sAdd(k.set, Buffer.from([255, 0]))
  await admin.rPush(k.list, rows.map(i => 'value-' + i))
  await admin.sendCommand(['ZADD', k.zset, ...rows.flatMap(i => [String(Number(i)), 'item-' + i])])
  await admin.sendCommand(['GEOADD', k.geo, ...rows.flatMap(i => ['13.361389', '38.115556', 'place-' + i])])
  for (const i of rows) {
    await admin.sendCommand(['XADD', k.stream, '1000-' + Number(i), 'field', 'value-' + i])
    await admin.sendCommand(['TS.ADD', k.ts, String(Number(i)), String(Number(i) / 10)])
  }
  const groups = [['CDP',5],['FOURWAYCAR',33],['FZ',61],['L',361],['PY',61],['Y',141],['file',87]]
  for (const [group,count] of groups) for (let i=1;i<count;i++) await admin.set(group + ':item-' + String(i).padStart(3,'0'), 'fixture')
  fixture.respBinary = Buffer.from([255,0,13,10,128]).toString('base64')
  await admin.set(Buffer.from(fixture.respBinary,'base64'),'binary fixture')
  for(let i=0;i<10;i++) await admin.set('FOURWAYCAR' + i + ':GZ','root fixture')
  assert.equal(await admin.sendCommand(['DBSIZE']),760)
  await admin.select(2); await admin.set('db2:only','two')
  await admin.select(3)
  for(let i=0;i<5100;i+=100) await admin.mSet(Object.fromEntries(Array.from({length:Math.min(100,5100-i)},(_,n)=>['large:'+(i+n),'fixture'])))
  await admin.select(0)
}

export async function smokeRespWorkbench({ page, fixture, pane, artifacts, report }) {
  const record = (...checks) => { report.checks.push(...checks); console.log('[smoke check] '+checks.join(' | ')) }
  const keys = pane.locator('.redis-keys'), status = () => keys.locator('[data-key-load-phase]')
  const proxy = fixture.recoveryProxy
  assert(proxy,'RESP acceptance owns a delay proxy')
  const countCommand = command => proxy.commands.filter(row=>row.command===command).length
  const loaded = async () => Number(await keys.locator('[data-loaded-keys]').innerText())
  async function complete(expected) {
    await until(async()=>await status().getAttribute('data-key-load-phase')==='complete','automatic key scan completed')
    assert.equal(await loaded(),expected)
  }
  async function db(value,expected,phase='complete') {
    const list=keys.locator('.redis-key-list')
    await list.evaluate(el=>{el.scrollTop=0})
    const row=list.locator('[data-db="'+value+'"]')
    if (!(await row.count())) {
      await list.evaluate(el=>{el.scrollTop=el.scrollHeight})
      await until(async()=>await row.count()===1,'DB row in virtual navigation')
    }
    await row.click(); await until(async()=>await keys.locator('[data-db="'+value+'"][aria-selected="true"]').count()===1 && await status().getAttribute('data-key-load-phase')===phase && await loaded()===expected,'DB auto scan phase')
  }
  async function select(name) {
    await (await findLoadedKey(keys,Buffer.from(name).toString('base64'))).click()
    const details=keys.locator('.redis-details')
    await details.waitFor()
    return details
  }
  async function drain(details,selector,expected) {
    const table=details.locator('.redis-collection-table').first()
    await table.waitFor()
    for(let i=0;i<25;i++) {
      const count=Number(await details.locator(selector).innerText())
      if(count===expected) break
      await table.evaluate(el=>{el.scrollTop=el.scrollHeight})
      await page.waitForTimeout(100)
    }
    assert.equal(Number(await details.locator(selector).innerText()),expected)
    assert.equal(await details.getByRole('button',{name:/Continue (scan|reading)/}).count(),0)
  }
  await resizeSidebar(page,pane,800)
  await complete(760)
  assert.equal(await status().getAttribute('data-db-total'),'760')
  assert((await status().innerText()).includes('100%'))
  assert.equal(await keys.getByRole('button',{name:'Continue scan',exact:true}).count(),0)
  assert.equal(await pane.locator('.redis-profile-navigation').count(),0)
  assert.equal(await keys.locator('input[name="pattern"]').count(),0)
  assert(countCommand('SCAN')>=7)
  const db0=keys.locator('[data-db="0"]')
  assert.equal(await db0.getAttribute('aria-expanded'),'true')
  assert.equal((await db0.innerText()).trim(),'db0 (760)')
  const folders=await keys.locator('[data-namespace-id] span').allTextContents()
  assert.deepEqual(folders.slice(0,7),['CDP (5)','FOURWAYCAR (33)','FZ (61)','L (361)','PY (61)','Y (141)','file (87)'])
  assert(folders.every(label=>!label.startsWith('"')))
  record('760 keys auto-load to completion with exact DB total/progress, one DB/folder/key tree and no continuation form')
  const requestCount=proxy.commands.length
  await keys.locator('[data-namespace-id]').first().click()
  await page.waitForTimeout(100)
  assert.equal(proxy.commands.length,requestCount,'Folder expansion is local')
  record('folder expansion is local and labels/counts stay compact without display quotes')
  await (await findLoadedKey(keys,fixture.respBinary)).click()
  await assertSelectedIdentity(keys,fixture.respBinary)
  record('binary key identity remains exact in the new navigation')
  const buffers=fixture.admin.withTypeMapping({[RESP_TYPES.BLOB_STRING]:Buffer})
  const snapshots=new Map()
  for(const name of Object.values(fixture.respKeys)) snapshots.set(name,await buffers.sendCommand(['DUMP',name]))

  const heldHash=proxy.holdNext('HSCAN',fixture.respKeys.hash)
  let details=await select(fixture.respKeys.hash)
  await until(async()=>heldHash.received,'held Hash page received')
  await details.getByRole('button',{name:'Cancel read',exact:true}).click()
  const hashStopped=countCommand('HSCAN'); heldHash.release(); await page.waitForTimeout(100)
  assert.equal(Number(await details.locator('[data-loaded-fields]').innerText()),0)
  assert.equal(countCommand('HSCAN'),hashStopped)
  await details.getByRole('button',{name:'Refresh Hash',exact:true}).click()
  await details.locator('[data-loaded-fields]').waitFor()
  await drain(details,'[data-loaded-fields]',236)
  record('cancelled delayed Hash page never renders late rows or auto-continues; refresh recovers')
  assert(countCommand('HSCAN')>=3)
  const geometry=await details.locator('[data-column="field"]').first().evaluate(el=>({width:el.getBoundingClientRect().width,whiteSpace:getComputedStyle(el).whiteSpace}))
  assert(geometry.width>=150 && geometry.whiteSpace==='nowrap')
  await details.locator('[data-hash-value="'+Buffer.from('row_000').toString('base64')+'"]').click()
  await chooseValueFormat(details,'json')
  assert((await details.locator('.redis-hash-value .redis-value').innerText()).includes('col_0'))
  await page.screenshot({path:resolve(artifacts,'native-resp-workbench-hash.png'),fullPage:true})
  record('Hash scroll auto-loads all 236 fields; row selection keeps the table and both previews visible')
  for(const [kind,selector,expected] of [['set','[data-loaded-members]',236],['list','[data-list-count]',235],['zset','[data-loaded-zset]',235],['stream','[data-loaded-messages]',235],['ts','[data-loaded-samples]',235]]) {
    details=await select(fixture.respKeys[kind]); await details.locator(selector).waitFor()
    await drain(details,selector,expected)
    record(kind+' table scroll appends every range/page without a Continue button')
    if(kind==='set') {
      await details.locator('input[name="setPattern"]').fill('absent:*')
      await details.getByRole('button',{name:'Scan / refresh',exact:true}).click()
      await until(async()=>Number(await details.locator('[data-loaded-members]').innerText())===0 && (await details.innerText()).includes('Scan complete'),'empty MATCH collection pages complete')
      record('empty intermediate Set pages continue automatically until the cursor ends')
    }
  }
  details=await select(fixture.respKeys.geo)
  await details.getByRole('button',{name:/GEO/}).click()
  details=keys.locator('.redis-details')
  await details.locator('[data-loaded-geo]').waitFor()
  await drain(details,'[data-loaded-geo]',235)
  record('GEO coordinate ranges also append on scroll')
  for(const [name,snapshot] of snapshots) assert.deepEqual(await buffers.sendCommand(['DUMP',name]),snapshot)
  record('all collection views preserve serialized fixture values')

  await db(1,0)
  assert.equal(await status().getAttribute('data-db-total'),'0')
  await db(2,1)
  await db(0,760)
  record('DB tree switching automatically reads empty DB1 and independent DB2, then restores DB0 count')

  const refresh=keys.getByRole('button',{name:'Scan / refresh',exact:true})
  let hold=proxy.holdNext('SCAN')
  await refresh.click(); await until(async()=>hold.received,'held SCAN received')
  await keys.getByRole('button',{name:'Cancel read',exact:true}).click()
  assert.equal(await status().getAttribute('data-key-load-phase'),'cancelled')
  const stopped=countCommand('SCAN'); hold.release(); await page.waitForTimeout(200)
  assert.equal(await loaded(),0); assert.equal(countCommand('SCAN'),stopped)
  await refresh.click(); await complete(760)
  record('cancelled delayed SCAN never publishes a late page or starts its successor; refresh recovers')

  hold=proxy.holdNext('SCAN')
  await refresh.click(); await until(async()=>hold.received,'held DB0 scan received')
  await keys.locator('.redis-key-list').evaluate(el=>{el.scrollTop=0})
  const switching=keys.locator('[data-db="1"]').click()
  await page.waitForTimeout(50); hold.release(); await switching
  await complete(0); assert.equal(await keys.locator('[data-key-base64]').count(),0)
  await db(3,5000,'limited')
  await until(async()=>await status().getAttribute('data-key-load-phase')==='limited','large DB bounded stop')
  assert.equal(await loaded(),5000)
  assert.equal(await status().getAttribute('data-db-total'),'5100')
  assert(!(await status().innerText()).includes('100%'))
  await db(0,760)
  record('DB switch rejects old page ownership; a 5100-key DB stops visibly at 5000 without false completion')

  await keys.getByRole('button',{name:'Filter keys',exact:true}).click()
  const input=keys.locator('input[name="pattern"]')
  const before=countCommand('SCAN'); await input.fill('CDP:*'); await page.waitForTimeout(100)
  assert.equal(countCommand('SCAN'),before,'Filter drafts do not read')
  await input.locator('xpath=ancestor::form').getByRole('button',{name:'Apply filter',exact:true}).click(); await complete(5)
  assert.equal(await status().getAttribute('data-db-total'),'760')
  assert(!(await status().innerText()).includes('100%'))
  await input.fill('*'); await input.locator('xpath=ancestor::form').getByRole('button',{name:'Apply filter',exact:true}).click(); await complete(760)
  await keys.getByRole('button',{name:'Filter keys',exact:true}).click()
  record('submitted MATCH auto-scans without treating DB total as the filtered denominator')

  details=await select(fixture.respKeys.hash); await details.locator('[data-loaded-fields]').waitFor()
  for(const width of [400,550,800,1000]) {
    await resizeSidebar(page,pane,width)
    const layout=await keys.evaluate(el=>{
      const a=el.querySelector('.redis-key-catalog').getBoundingClientRect(),b=el.querySelector('.redis-key-detail').getBoundingClientRect(),box=el.getBoundingClientRect()
      return {left:a.width,right:b.width,overlap:a.right>b.left+1,overflow:el.scrollWidth>box.width+1}
    })
    assert(layout.left>=145 && layout.right>=100 && !layout.overlap && !layout.overflow)
    const table=details.locator('.redis-collection-table').first()
    await table.evaluate(el=>{el.scrollLeft=el.scrollWidth})
    assert(await table.evaluate(el=>el.scrollLeft>0 || el.scrollWidth<=el.clientWidth))
    await table.evaluate(el=>{el.scrollLeft=0})
  }
  await resizeSidebar(page,pane,800)
  await page.screenshot({path:resolve(artifacts,'native-resp-workbench.png'),fullPage:true})
  record('native two-pane geometry and table horizontal scroll pass at 400/550/800/1000 px')
  const writes=new Set(['SET','DEL','HSET','SADD','ZADD','XADD','TS.ADD','GEOADD','FLUSHDB','EVAL','KEYS'])
  assert(proxy.commands.every(row=>!writes.has(row.command)),'Viewer must issue no write/KEYS commands')
  assert.deepEqual(proxy.errors,[])
  record('proxy observed only viewer connection/read commands and no protocol errors or KEYS command')
}
