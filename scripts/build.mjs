// Build the standalone file: package used by `pnpm add file:...`.
//
// The Host half is emitted as ordinary ESM files. The Client half is wrapped
// in the ModuleLoader registration used by DSH's client packages, so the
// profile can consume the package without a Harness checkout.

import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const ROOT = resolve(import.meta.dirname, '..')
const SRC = resolve(ROOT, 'src')
const LIB = resolve(ROOT, 'lib')
const CLIENT_ENTRY = resolve(SRC, 'client', 'index.ts')
const CLIENT_ID = 'dsh-redis'

// TypeScript rewrites runtime imports. Its declarations still use source
// suffixes, so normalize emitted module specifiers before packaging.
function normalizeDeclaration(text) {
  return text.replace(/((?:\bfrom\s+|\bimport\s*(?:\(\s*)?)(['"])\.\.?\/[^'"\n]+?)\.tsx?\2/g, '$1.js$2')
}

function buildHost() {
  const diagnostics = []
  const config = ts.getParsedCommandLineOfConfigFile(resolve(ROOT, 'tsconfig.host.json'), {
    noEmit: false, composite: false, declaration: true, noEmitOnError: true,
    rewriteRelativeImportExtensions: true, rootDir: SRC, outDir: LIB,
  }, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: diagnostic => diagnostics.push(diagnostic) })
  if (config !== undefined && config.errors.length === 0 && diagnostics.length === 0) {
    const program = ts.createProgram(config.fileNames, config.options)
    const output = program.emit(undefined, (file, content, bom) => {
      ts.sys.writeFile(file, file.endsWith('.d.ts') ? normalizeDeclaration(content) : content, bom)
    })
    diagnostics.push(...output.diagnostics)
    if (!output.emitSkipped) return
  } else if (config !== undefined) diagnostics.push(...config.errors)
  throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => ROOT, getNewLine: () => '\n',
  }))
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text.split('\n').map(line => line.length === 0 ? line : pad + line).join('\n')
}

async function buildClient() {
  // Bundle official Lucide components and the client codecs, preserving DSH's
  // single React identity and its native registration/disposal contract.
  const bundle = await build({
    entryPoints: [CLIENT_ENTRY], bundle: true, write: false, platform: 'browser',
    format: 'cjs', target: 'es2022', jsx: 'automatic', treeShaking: true,
    external: ['react', 'react/jsx-runtime'],
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'inline',
  })
  const body = bundle.outputFiles[0]?.text
  if (body === undefined) throw new Error('Client bundle was not emitted')
  const output = [
    'window.__ModuleLoader__.load({',
    `  id: ${JSON.stringify(CLIENT_ID)},`,
    '  factory: (require) => {',
    '      var module = { exports: {} };',
    indent(body, 4),
    '    return module.exports;',
    '  }',
    '});',
    '',
  ].join('\n')
  const target = resolve(LIB, 'client.js')
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, output)
  const { outputText } = ts.transpileDeclaration(readFileSync(CLIENT_ENTRY, 'utf8'), {
    fileName: CLIENT_ENTRY,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, jsx: ts.JsxEmit.ReactJSX },
  })
  const dts = normalizeDeclaration(outputText)
  if (dts.length > 0) {
    const declarationPath = resolve(LIB, 'client', 'index.d.ts')
    mkdirSync(dirname(declarationPath), { recursive: true })
    writeFileSync(declarationPath, dts)
  }
}

// Deleted source modules must not survive in a newly published package.
// Verify this exact owned output directory before recursive removal.
if (relative(ROOT, LIB) !== 'lib') throw new Error('Unexpected build output directory: ' + LIB)
rmSync(LIB, { recursive: true, force: true })
mkdirSync(LIB, { recursive: true })
buildHost()
await buildClient()
console.log('[build] standalone Host and Client artifacts written to lib/')
