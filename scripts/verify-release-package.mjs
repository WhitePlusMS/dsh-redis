/** Verify the actual tarball, installed payload and shared runtime versions.
 * Plain Node avoids REPL realm/prototype differences. Python's standard tarfile
 * only reads the archive; no files are extracted or dependencies installed.
 */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const root = resolve(import.meta.dirname, '..')
const installed = resolve(root, '.scratch/runtime/dsh-home/profiles/web/node_modules/dsh-redis')
const artifact = resolve(root, '.scratch/artifacts/dsh-redis-0.1.0.tgz')
const run = promisify(execFile)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
assert(process.env.REDIS_TEST_PYTHON && process.env.DSH_CLI_ENTRY, 'Specify REDIS_TEST_PYTHON and DSH_CLI_ENTRY')
const archiveInfo = JSON.parse((await run(process.env.REDIS_TEST_PYTHON, ['-c', [
  'import tarfile,hashlib,json,sys',
  'with tarfile.open(sys.argv[1],"r:gz") as archive:',
  ' entries=[{"path":item.name.removeprefix("package/"),"bytes":item.size,"sha256":hashlib.sha256(archive.extractfile(item).read()).hexdigest()} for item in archive.getmembers() if item.isfile()]',
  ' manifest=json.load(archive.extractfile("package/package.json"))',
  ' print(json.dumps({"manifest":manifest,"files":entries}))',
].join('\n'), artifact], { windowsHide: true, maxBuffer: 1024 * 1024 })).stdout)
const sourceManifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const expectedManifest = JSON.parse(JSON.stringify(sourceManifest))
// Observed pnpm pack output intentionally excludes these development fields.
delete expectedManifest.packageManager
delete expectedManifest.scripts.prepack
assert.deepEqual(archiveInfo.manifest, expectedManifest, 'Unexpected manifest transformation during pack')
assert.deepEqual(JSON.parse(await readFile(resolve(installed, 'package.json'), 'utf8')), archiveInfo.manifest)
for (const entry of archiveInfo.files) {
  assert(!entry.path.startsWith('../') && !entry.path.startsWith('/'))
  const bytes = await readFile(resolve(installed, entry.path))
  assert.equal(bytes.length, entry.bytes, entry.path)
  assert.equal(sha256(bytes), entry.sha256, entry.path)
}
async function inventory(directory, prefix = '') {
  const rows = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name
    if (entry.isDirectory()) rows.push(...await inventory(resolve(directory, entry.name), path + '/'))
    else {
      const bytes = await readFile(resolve(directory, entry.name))
      rows.push({ path, bytes: bytes.length, sha256: sha256(bytes) })
    }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path))
}
const lib = await inventory(resolve(root, 'lib'))
assert.deepEqual(await inventory(resolve(installed, 'lib')), lib, 'Installed lib file set or bytes differ')
assert.deepEqual(await inventory(resolve(installed, 'licenses')), await inventory(resolve(root, 'licenses')))
for (const file of ['README.md', 'cordis.patch.yml', 'icon.svg', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) assert.deepEqual(await readFile(resolve(installed, file)), await readFile(resolve(root, file)))
const actualCli = await realpath(process.env.DSH_CLI_ENTRY)
const runtimeRequire = createRequire(actualCli)
const hostPeers = []
for (const [name, declared] of Object.entries(sourceManifest.peerDependencies)) {
  if (name === 'react') continue // Browser identity/version is observed by native RELEASE smoke.
  const manifest = runtimeRequire.resolve(name + '/package.json')
  const actual = JSON.parse(await readFile(manifest, 'utf8')).version
  assert.equal(actual, name === '@deepseek-ai/cordis' ? '4.0.4' : declared)
  hostPeers.push({ name, declared, actual, manifest })
}
const installedRequire = createRequire(resolve(installed, 'package.json'))
const dependencies = []
for (const [name, declared] of Object.entries(sourceManifest.dependencies)) {
  const manifest = installedRequire.resolve(name + '/package.json')
  const actual = JSON.parse(await readFile(manifest, 'utf8')).version
  assert.equal(actual, declared)
  dependencies.push({ name, actual, manifest })
}
const sourceInputs = [...await inventory(resolve(root, 'src'), 'src/'), ...await inventory(resolve(root, 'scripts'), 'scripts/'), ...await inventory(resolve(root, 'tests'), 'tests/')]
for (const file of (await readdir(root)).filter(file => file.startsWith('tsconfig') || file.startsWith('vitest.') || ['package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'README.md'].includes(file))) {
  const bytes = await readFile(resolve(root, file))
  sourceInputs.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) })
}
const report = {
  verifiedAt: new Date().toISOString(), packageName: sourceManifest.name, packageVersion: sourceManifest.version,
  packageSha256: sha256(await readFile(artifact)),
  sourceParentCommit: (await run('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true })).stdout.trim(),
  sourceInputs: sourceInputs.sort((a, b) => a.path.localeCompare(b.path)), lib,
  packedFiles: archiveInfo.files, packedManifest: archiveInfo.manifest,
  packOmittedDevelopmentFields: ['packageManager', 'scripts.prepack'],
  installedPackageRoot: await realpath(installed), installedAllPackageFilesMatch: true,
  actualCli, hostPeers, dependencies,
  browserReact: 'See actual runtime identity/version in native-ui-release-smoke.json',
  pnpmLockSha256: sha256(await readFile(resolve(root, 'pnpm-lock.yaml'))),
}
await writeFile(resolve(root, '.scratch/artifacts/workbench-release-manifest.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ packageSha256: report.packageSha256, libFiles: lib.length, packedFiles: archiveInfo.files.length, hostPeers: hostPeers.length, dependencies: dependencies.length, installedAllPackageFilesMatch: true }))
