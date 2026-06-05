import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// 1. Run tsup
console.log('Building with tsup...')
execSync('pnpm tsup --config tsup.config.ts', { cwd: root, stdio: 'inherit' })

// 2. Rename .mjs → .js and .d.mts → .d.ts, update internal imports
const distDir = path.join(root, 'dist-publish/dist')
const files = fs.readdirSync(distDir)
for (const file of files) {
  const filePath = path.join(distDir, file)
  if (file.endsWith('.mjs') || file.endsWith('.d.mts')) {
    let content = fs.readFileSync(filePath, 'utf-8')
    content = content.replace(/\.mjs/g, '.js')
    content = content.replace(/\.d\.mts/g, '.d.ts')
    const newName = file.replace('.d.mts', '.d.ts').replace('.mjs', '.js')
    fs.writeFileSync(path.join(distDir, newName), content)
    fs.unlinkSync(filePath)
  } else if (file.endsWith('.mjs.map')) {
    const newName = file.replace('.mjs.map', '.js.map')
    fs.renameSync(filePath, path.join(distDir, newName))
  }
}

// 3. Copy registry snapshot to dist-publish/dist/data/
const snapshotSrc = path.join(root, 'src/data/registry-snapshot.json')
const snapshotDataDir = path.join(distDir, 'data')
fs.mkdirSync(snapshotDataDir, { recursive: true })
fs.copyFileSync(snapshotSrc, path.join(snapshotDataDir, 'registry-snapshot.json'))
console.log('Copied registry-snapshot.json to dist-publish/dist/data/')

// 4. Add shebang to cli.js
const cliPath = path.join(distDir, 'cli.js')
const cliContent = fs.readFileSync(cliPath, 'utf-8')
if (!cliContent.startsWith('#!/usr/bin/env node')) {
  fs.writeFileSync(cliPath, '#!/usr/bin/env node\n' + cliContent)
}
fs.chmodSync(cliPath, 0o755)

// 5. Generate package.json
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))

// Packages excluded from published dependencies (none currently bundled via noExternal).
const bundledDeps = new Set<string>()
const publishDeps: Record<string, string> = {}
for (const [dep, version] of Object.entries(rootPkg.dependencies as Record<string, string>)) {
  if (!bundledDeps.has(dep)) {
    publishDeps[dep] = version
  }
}

const publishPkg = {
  name: '@viben/kernel',
  version: rootPkg.version,
  description: 'Self-hosted bridge for AI coding agents via ACP protocol',
  type: 'module',
  bin: { viben: './dist/cli.js' },
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      types: './dist/index.d.ts',
      import: './dist/index.js',
    },
  },
  files: ['dist/', 'README.md'],
  engines: { node: '>=20' },
  dependencies: publishDeps,
  repository: {
    type: 'git',
    url: 'https://github.com/LinXueyuanStdio/viben',
  },
  homepage: 'https://github.com/LinXueyuanStdio/viben',
  author: {
    name: 'Viben',
    url: 'https://x.com/viben_ai',
  },
  license: 'AGPL-3.0',
  keywords: ['acp', 'ai', 'coding-agent', 'telegram', 'claude', 'codex', 'gemini', 'cursor', 'agent-client-protocol'],
}

fs.writeFileSync(
  path.join(root, 'dist-publish/package.json'),
  JSON.stringify(publishPkg, null, 2) + '\n'
)

// 5. Copy README
fs.copyFileSync(
  path.join(root, 'README.md'),
  path.join(root, 'dist-publish/README.md')
)

// 6. Verify: every external import in the bundle must be a Node builtin or a published dependency
import { builtinModules } from 'node:module'

const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
])

// Packages that appear in template strings (scaffold generator) but are not real runtime imports
const templateOnlyDeps = new Set(['@viben/plugin-sdk', 'vitest', '@viben/plugin-sdk/testing'])

const importPattern = /(?:from\s+["']|import\s*\(\s*["'])([^./"'][^"']*)["']/g
const missingDeps: Map<string, string[]> = new Map()

const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'))
for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(distDir, file), 'utf-8')
  for (const match of content.matchAll(importPattern)) {
    const specifier = match[1]
    // Resolve package name (handle scoped packages like @foo/bar)
    const pkgName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0]

    if (builtins.has(pkgName)) continue
    if (pkgName in publishDeps) continue
    if (templateOnlyDeps.has(specifier) || templateOnlyDeps.has(pkgName)) continue

    if (!missingDeps.has(pkgName)) missingDeps.set(pkgName, [])
    missingDeps.get(pkgName)!.push(file)
  }
}

if (missingDeps.size > 0) {
  console.error('\n❌ Build verification failed!')
  console.error('These packages are imported in the bundle but not in published dependencies:\n')
  for (const [dep, files] of missingDeps) {
    console.error(`  ${dep}  (in ${[...new Set(files)].join(', ')})`)
  }
  console.error('\nFix: add them to `dependencies` in package.json, or to `noExternal` in tsup.config.ts')
  process.exit(1)
}

console.log('✅ All external imports are covered by published dependencies')

// 7. Build and prepare @viben/plugin-sdk
const sdkDir = path.resolve(root, '../kernel-sdk')
if (fs.existsSync(sdkDir)) {
  // SDK needs CLI type declarations — ensure tsc has been run on root first
  const rootDtsPath = path.join(root, 'dist/index.d.ts')
  if (!fs.existsSync(rootDtsPath)) {
    console.log('\nBuilding CLI types (required by SDK)...')
    execSync('pnpm tsc', { cwd: root, stdio: 'inherit' })
  }

  console.log('\nBuilding @viben/plugin-sdk...')
  execSync('npx tsc', { cwd: sdkDir, stdio: 'inherit' })

  // Generate SDK publish package.json (replace workspace:* with actual version)
  const sdkPkg = JSON.parse(fs.readFileSync(path.join(sdkDir, 'package.json'), 'utf-8'))
  sdkPkg.version = rootPkg.version
  // devDependencies with workspace:* are stripped for publish (not needed at runtime)
  delete sdkPkg.devDependencies
  // peerDependencies already uses @viben/kernel (not workspace protocol)

  const sdkPublishDir = path.join(root, 'dist-publish-sdk')
  fs.mkdirSync(sdkPublishDir, { recursive: true })

  // Copy dist
  execSync(`cp -r ${path.join(sdkDir, 'dist')} ${sdkPublishDir}/dist`, { stdio: 'inherit' })

  // Write package.json
  fs.writeFileSync(
    path.join(sdkPublishDir, 'package.json'),
    JSON.stringify(sdkPkg, null, 2) + '\n'
  )

  // Copy README if exists
  const sdkReadme = path.join(sdkDir, 'README.md')
  if (fs.existsSync(sdkReadme)) {
    fs.copyFileSync(sdkReadme, path.join(sdkPublishDir, 'README.md'))
  }

  console.log(`✅ SDK built: @viben/plugin-sdk@${rootPkg.version}`)
}

console.log(`\nBuild complete! Package: @viben/kernel@${rootPkg.version}`)
console.log('To publish:')
console.log('  cd dist-publish && npm publish --access=public')
if (fs.existsSync(path.join(root, 'dist-publish-sdk'))) {
  console.log('  cd dist-publish-sdk && npm publish --access=public')
}
