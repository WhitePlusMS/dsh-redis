/** Verify the actual tarball, installed payload and shared runtime versions.
 * Plain Node avoids REPL realm/prototype differences. Python's standard tarfile
 * only reads the archive; no files are extracted or dependencies installed.
 */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs, promisify } from 'node:util'

const root = resolve(import.meta.dirname, '..')
// All targets are explicit: an old archive or report must never become the
// implicit baseline for a new release. Do not overwrite earlier evidence.
const { values } = parseArgs({ options: { archive: { type: 'string' }, installed: { type: 'string' }, output: { type: 'string' } }, allowPositionals: false })
assert(values.archive && values.installed && values.output, 'Required: --archive <tgz> --installed <package-directory> --output <new-report.json>')
const installed = resolve(values.installed), artifact = resolve(values.archive), output = resolve(values.output)
const run = promisify(execFile)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
assert(process.env.REDIS_TEST_PYTHON && process.env.DSH_CLI_ENTRY, 'Specify REDIS_TEST_PYTHON and DSH_CLI_ENTRY')
const archiveInfo = JSON.parse((await run(process.env.REDIS_TEST_PYTHON, ['-c', [
  'import tarfile,hashlib,json,sys,pathlib',
  'with tarfile.open(sys.argv[1],"r:gz") as archive:',
  ' entries=[]',
  ' seen=set()',
  ' for item in archive.getmembers():',
  '  assert item.isfile() and item.name.startswith("package/"), "Unexpected archive entry: " + item.name',
  '  name=item.name.removeprefix("package/")',
  '  path=pathlib.PurePosixPath(name)',
  '  assert name and not path.is_absolute() and ".." not in path.parts and "\\\\" not in name and str(path)==name, "Invalid archive path: " + name',
  '  assert name not in seen, "Duplicate archive entry: " + name',
  '  seen.add(name)',
  '  entries.append({"path":name,"bytes":item.size,"sha256":hashlib.sha256(archive.extractfile(item).read()).hexdigest()})',
  ' manifest=json.load(archive.extractfile("package/package.json"))',
  ' print(json.dumps({"manifest":manifest,"files":entries}))',
].join('\n'), artifact], { windowsHide: true, maxBuffer: 1024 * 1024 })).stdout)
const sourceManifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const expectedManifest = JSON.parse(JSON.stringify(sourceManifest))
// Observed pnpm pack output intentionally excludes these development fields.
delete expectedManifest.packageManager
delete expectedManifest.scripts.prepack
assert.deepEqual(archiveInfo.manifest, expectedManifest, 'Unexpected manifest transformation during pack')
async function inventory(directory, prefix = '') {
  const rows = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name
    if (entry.isDirectory()) rows.push(...await inventory(resolve(directory, entry.name), path + '/'))
    else {
      assert(entry.isFile(), 'Unexpected payload link or special file: ' + path)
      const bytes = await readFile(resolve(directory, entry.name))
      rows.push({ path, bytes: bytes.length, sha256: sha256(bytes) })
    }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path))
}
// Check the full packaged file set, not only the subset present in the tarball.
// This catches both omitted deliverables and files outside the source allowlist.
const sourcePayload = []
for (const path of sourceManifest.files) {
  if ((await stat(resolve(root, path))).isDirectory()) sourcePayload.push(...await inventory(resolve(root, path), path + '/'))
  else {
    const bytes = await readFile(resolve(root, path))
    sourcePayload.push({ path, bytes: bytes.length, sha256: sha256(bytes) })
  }
}
const packedPayload = archiveInfo.files.filter(entry => entry.path !== 'package.json').sort((a, b) => a.path.localeCompare(b.path))
assert.deepEqual(packedPayload, sourcePayload.sort((a, b) => a.path.localeCompare(b.path)), 'Archive file set or bytes differ from source allowlist')
// Only allowlisted payload paths may be read from the selected installation.
assert.deepEqual(JSON.parse(await readFile(resolve(installed, 'package.json'), 'utf8')), archiveInfo.manifest)
for (const entry of archiveInfo.files) {
  const bytes = await readFile(resolve(installed, entry.path))
  assert.equal(bytes.length, entry.bytes, entry.path)
  assert.equal(sha256(bytes), entry.sha256, entry.path)
}
const lib = await inventory(resolve(root, 'lib'))
assert.deepEqual(await inventory(resolve(installed, 'lib')), lib, 'Installed lib file set or bytes differ')
assert.deepEqual(await inventory(resolve(installed, 'licenses')), await inventory(resolve(root, 'licenses')))
for (const file of ['README.md', 'cordis.patch.yml', 'icon.svg', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) assert.deepEqual(await readFile(resolve(installed, file)), await readFile(resolve(root, file)))
const actualCli = await realpath(process.env.DSH_CLI_ENTRY)
const runtimeRequire = createRequire(actualCli)
const hostPeers = [], typeOnlyPeers = []
for (const [name, declared] of Object.entries(sourceManifest.peerDependencies)) {
  if (name === 'react') continue // Browser identity/version is observed by native RELEASE smoke.
  const tested = sourceManifest.devDependencies[name]
  assert(typeof tested === 'string', 'Missing tested SDK version: ' + name)
  // Slots supplies this plugin's TS declarations only. Do not require a second
  // Host copy, but fail if a future emitted module begins using it at runtime.
  if (name === '@deepseek-ai/dsh-client-ui-slots') {
    for (const entry of lib.filter(entry => entry.path.endsWith('.js'))) assert(!(await readFile(resolve(root, 'lib', entry.path), 'utf8')).includes(name), 'Type-only peer became a runtime reference: ' + name)
    const manifest = createRequire(import.meta.url).resolve(name + '/package.json')
    const actual = JSON.parse(await readFile(manifest, 'utf8')).version
    assert.equal(actual, tested, 'Build-time type dependency differs: ' + name)
    typeOnlyPeers.push({ name, declared, tested, actual, manifest })
    continue
  }
  const manifest = runtimeRequire.resolve(name + '/package.json')
  const actual = JSON.parse(await readFile(manifest, 'utf8')).version
  assert.equal(actual, tested, 'Runtime differs from the tested SDK: ' + name)
  hostPeers.push({ name, declared, tested, actual, manifest })
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
  packageArchive: await realpath(artifact), packageSha256: sha256(await readFile(artifact)),
  sourceParentCommit: (await run('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true })).stdout.trim(),
  trackedWorktreeStatus: (await run('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, windowsHide: true })).stdout.trim(),
  sourceInputs: sourceInputs.sort((a, b) => a.path.localeCompare(b.path)), lib,
  packedFiles: archiveInfo.files, packedManifest: archiveInfo.manifest,
  packOmittedDevelopmentFields: ['packageManager', 'scripts.prepack'],
  installedPackageRoot: await realpath(installed), installedAllPackageFilesMatch: true,
  actualCli, hostPeers, typeOnlyPeers, dependencies,
  browserReact: 'Not verified by this script; requires native browser verification',
  pnpmLockSha256: sha256(await readFile(resolve(root, 'pnpm-lock.yaml'))),
}
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ packageSha256: report.packageSha256, libFiles: lib.length, packedFiles: archiveInfo.files.length, hostPeers: hostPeers.length, dependencies: dependencies.length, installedAllPackageFilesMatch: true }))
