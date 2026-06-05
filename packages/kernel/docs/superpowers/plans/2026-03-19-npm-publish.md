# npm Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Viben as a single npm package `viben` so users can run `npx viben`.

**Architecture:** Keep monorepo for dev, use tsup to bundle core + telegram adapter into a single publishable package under `dist-publish/`. Plugin system uses `~/.viben/plugins/` with npm install --prefix. CLI entry point routes between start server, install/uninstall plugins, and list plugins.

**Tech Stack:** tsup (bundler), esbuild (underlying), existing: zod, grammy, nanoid, @agentclientprotocol/sdk

**Spec:** `docs/superpowers/specs/2026-03-19-npm-publish-design.md`

---

## File Map

**New files:**
- `packages/core/src/cli.ts` — CLI entry point with argument parsing (start, install, uninstall, plugins, --version, --help)
- `packages/core/src/plugin-manager.ts` — Plugin install/uninstall/list/load logic
- `tsup.config.ts` — tsup config at repo root, two entry points (cli + index)
- `scripts/build-publish.ts` — Script to generate `dist-publish/` with package.json and README

**Modified files:**
- `packages/core/src/config.ts` — Restructure channels schema from fixed to `z.record()`, add `adapter` field, add plugin paths constant
- `packages/core/src/main.ts` — Refactor to delegate to `cli.ts` for server start logic
- `packages/core/src/core.ts` — Add plugin adapter loading support
- `packages/core/src/index.ts` — Export new types (AdapterFactory, plugin-manager)
- `packages/core/package.json` — Add tsup dev dependency
- `package.json` (root) — Add version field, `build:publish` script, tsup dev dependency
- `.gitignore` — Add `dist-publish/`

**Not modified:**
- `packages/adapters/telegram/` — No changes needed, tsup resolves via workspace
- Existing ChannelAdapter abstract class — stays as-is

---

### Task 1: Setup tsup and build infrastructure

**Files:**
- Modify: `package.json` (root)
- Modify: `packages/core/package.json`
- Modify: `.gitignore`
- Create: `tsup.config.ts`

- [ ] **Step 1: Install tsup**

```bash
pnpm add -D tsup -w
```

- [ ] **Step 2: Add version to root package.json**

In root `package.json`, add `"version": "0.1.0"` and add `"build:publish"` script. Keep all existing fields (including `dependencies`), only add/modify:

```json
{
  "version": "0.1.0",
  "scripts": {
    "build": "pnpm -r build",
    "build:publish": "tsx scripts/build-publish.ts",
    "dev": "pnpm --filter @viben/core dev",
    "start": "node packages/core/dist/main.js"
  }
}
```

- [ ] **Step 3: Add dist-publish to .gitignore**

Append `dist-publish/` to `.gitignore`.

- [ ] **Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cli: 'packages/core/src/cli.ts',
    index: 'packages/core/src/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  splitting: true,
  sourcemap: true,
  dts: true,
  clean: true,
  outDir: 'dist-publish/dist',
  noExternal: ['@viben/adapter-telegram'],  // bundle workspace package into output
  external: [
    'grammy',
    'zod',
    'nanoid',
    '@agentclientprotocol/sdk',
  ],
})
```

- [ ] **Step 5: Verify tsup config parses correctly**

```bash
pnpm tsup --config tsup.config.ts --dry-run 2>&1 || echo "Check config"
```

- [ ] **Step 6: Commit**

```bash
git add package.json packages/core/package.json .gitignore tsup.config.ts pnpm-lock.yaml
git commit -m "chore: add tsup build infrastructure for npm publishing"
```

---

### Task 2: Create build-publish script

**Files:**
- Create: `scripts/build-publish.ts`

- [ ] **Step 1: Create scripts/build-publish.ts**

This script:
1. Runs tsup to bundle into `dist-publish/dist/`
2. Adds shebang to `dist-publish/dist/cli.js`
3. Generates `dist-publish/package.json` from template + version from root
4. Copies README.md to `dist-publish/`

```typescript
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// 1. Run tsup
console.log('Building with tsup...')
execSync('pnpm tsup --config tsup.config.ts', { cwd: root, stdio: 'inherit' })

// 2. Add shebang to cli.js
const cliPath = path.join(root, 'dist-publish/dist/cli.js')
const cliContent = fs.readFileSync(cliPath, 'utf-8')
if (!cliContent.startsWith('#!/usr/bin/env node')) {
  fs.writeFileSync(cliPath, '#!/usr/bin/env node\n' + cliContent)
}
fs.chmodSync(cliPath, 0o755)

// 3. Generate package.json
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
const corePkg = JSON.parse(fs.readFileSync(path.join(root, 'packages/core/package.json'), 'utf-8'))
const telegramPkg = JSON.parse(fs.readFileSync(path.join(root, 'packages/adapters/telegram/package.json'), 'utf-8'))

// Merge dependencies from core + telegram, excluding workspace refs
const deps: Record<string, string> = {}
for (const pkg of [corePkg, telegramPkg]) {
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    if (typeof version === 'string' && !version.startsWith('workspace:')) {
      deps[name] = version
    }
  }
}

const publishPkg = {
  name: 'viben',
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
  dependencies: deps,
  repository: {
    type: 'git',
    url: 'https://github.com/nicepkg/Viben',
  },
  license: 'AGPL-3.0',
  keywords: ['acp', 'ai', 'coding-agent', 'telegram', 'claude', 'codex'],
}

fs.writeFileSync(
  path.join(root, 'dist-publish/package.json'),
  JSON.stringify(publishPkg, null, 2) + '\n'
)

// 4. Copy README
fs.copyFileSync(
  path.join(root, 'README.md'),
  path.join(root, 'dist-publish/README.md')
)

console.log(`\nBuild complete! Package: viben@${rootPkg.version}`)
console.log('To publish: cd dist-publish && npm publish')
```

- [ ] **Step 2: Update root package.json build:publish script**

The `build:publish` script should run via tsx (since it's TypeScript):

```bash
pnpm add -D tsx -w
```

Update root `package.json`:
```json
"build:publish": "tsx scripts/build-publish.ts"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/build-publish.ts package.json pnpm-lock.yaml
git commit -m "feat: add build-publish script to generate npm package"
```

---

### Task 3: Restructure config schema for dynamic channels

**Files:**
- Modify: `packages/core/src/config.ts`

- [ ] **Step 1: Refactor ConfigSchema channels to z.record()**

In `packages/core/src/config.ts`, replace the fixed channels schema:

```typescript
// Before:
const TelegramChannelSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string(),
  chatId: z.number(),
  notificationTopicId: z.number().nullable().default(null),
  assistantTopicId: z.number().nullable().default(null),
}).optional()

export const ConfigSchema = z.object({
  channels: z.object({
    telegram: TelegramChannelSchema,
  }),
  // ...
})
```

```typescript
// After:
const BaseChannelSchema = z.object({
  enabled: z.boolean().default(false),
  adapter: z.string().optional(),  // package name for plugin adapters
}).passthrough()

export const PLUGINS_DIR = path.join(os.homedir(), '.viben', 'plugins')

export const ConfigSchema = z.object({
  channels: z.record(z.string(), BaseChannelSchema),
  agents: z.record(z.string(), AgentSchema),
  defaultAgent: z.string(),
  workspace: z.object({
    baseDir: z.string().default('~/viben-workspace'),
  }).default({}),
  security: z.object({
    allowedUserIds: z.array(z.string()).default([]),
    maxConcurrentSessions: z.number().default(5),
    sessionTimeoutMinutes: z.number().default(60),
  }).default({}),
})
```

Keep `DEFAULT_CONFIG` the same (telegram config stays compatible).

- [ ] **Step 2: Verify existing code compiles**

```bash
cd packages/core && pnpm build
```

Fix any type errors from the schema change. The main impact: `config.channels.telegram` is now accessed as `config.channels['telegram']` and its type is the generic `BaseChannelSchema` instead of the specific telegram schema. The telegram adapter already receives its config via constructor, so this should be fine.

- [ ] **Step 3: Build full project to verify telegram adapter still works**

```bash
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/config.ts
git commit -m "refactor: make channels config dynamic with z.record() for plugin support"
```

---

### Task 4: Create plugin manager

**Files:**
- Create: `packages/core/src/plugin-manager.ts`

- [ ] **Step 1: Create plugin-manager.ts**

```typescript
import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { createRequire } from 'node:module'
import { PLUGINS_DIR } from './config.js'
import { log } from './log.js'
import type { ChannelAdapter } from './channel.js'

export interface AdapterFactory {
  name: string
  createAdapter(core: any, config: any): ChannelAdapter
}

function ensurePluginsDir(): void {
  fs.mkdirSync(PLUGINS_DIR, { recursive: true })
  const pkgPath = path.join(PLUGINS_DIR, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({ name: 'viben-plugins', private: true, dependencies: {} }, null, 2))
  }
}

export function installPlugin(packageName: string): void {
  ensurePluginsDir()
  log.info(`Installing ${packageName}...`)
  execSync(`npm install ${packageName} --prefix "${PLUGINS_DIR}"`, { stdio: 'inherit' })
  log.info(`${packageName} installed successfully.`)
}

export function uninstallPlugin(packageName: string): void {
  ensurePluginsDir()
  log.info(`Uninstalling ${packageName}...`)
  execSync(`npm uninstall ${packageName} --prefix "${PLUGINS_DIR}"`, { stdio: 'inherit' })
  log.info(`${packageName} uninstalled.`)
}

export function listPlugins(): Record<string, string> {
  const pkgPath = path.join(PLUGINS_DIR, 'package.json')
  if (!fs.existsSync(pkgPath)) return {}
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  return pkg.dependencies || {}
}

export async function loadAdapterFactory(packageName: string): Promise<AdapterFactory | null> {
  try {
    const require = createRequire(path.join(PLUGINS_DIR, 'package.json'))
    const resolved = require.resolve(packageName)
    const mod = await import(resolved)

    // Plugin must export `adapterFactory` or default export conforming to AdapterFactory
    const factory: AdapterFactory | undefined = mod.adapterFactory || mod.default
    if (!factory || typeof factory.createAdapter !== 'function') {
      log.error(`Plugin ${packageName} does not export a valid AdapterFactory (needs .createAdapter())`)
      return null
    }
    return factory
  } catch (err) {
    log.error(`Failed to load plugin ${packageName}:`, err)
    log.error(`Run: npx viben install ${packageName}`)
    return null
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
cd packages/core && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/plugin-manager.ts
git commit -m "feat: add plugin manager for install/uninstall/load adapters"
```

---

### Task 5: Create CLI entry point

**Files:**
- Create: `packages/core/src/cli.ts`
- Modify: `packages/core/src/main.ts`

- [ ] **Step 1: Create cli.ts**

```typescript
#!/usr/bin/env node

import { installPlugin, uninstallPlugin, listPlugins } from './plugin-manager.js'

const args = process.argv.slice(2)
const command = args[0]

function printHelp(): void {
  console.log(`
Viben - Self-hosted bridge for AI coding agents

Usage:
  viben                              Start the server
  viben install <package>            Install a plugin adapter
  viben uninstall <package>          Uninstall a plugin adapter
  viben plugins                      List installed plugins
  viben --version                    Show version
  viben --help                       Show this help

Examples:
  npx viben
  npx viben install @viben/adapter-discord
  npx viben uninstall @viben/adapter-discord
`)
}

async function main() {
  if (command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === '--version' || command === '-v') {
    // In published build: read version from own package.json via createRequire
    // In dev: fallback to 'dev'
    try {
      const { createRequire } = await import('node:module')
      const require = createRequire(import.meta.url)
      const pkg = require('../package.json')
      console.log(`viben v${pkg.version}`)
    } catch {
      console.log('viben v0.0.0-dev')
    }
    return
  }

  if (command === 'install') {
    const pkg = args[1]
    if (!pkg) {
      console.error('Usage: viben install <package>')
      process.exit(1)
    }
    installPlugin(pkg)
    return
  }

  if (command === 'uninstall') {
    const pkg = args[1]
    if (!pkg) {
      console.error('Usage: viben uninstall <package>')
      process.exit(1)
    }
    uninstallPlugin(pkg)
    return
  }

  if (command === 'plugins') {
    const plugins = listPlugins()
    const entries = Object.entries(plugins)
    if (entries.length === 0) {
      console.log('No plugins installed.')
    } else {
      console.log('Installed plugins:')
      for (const [name, version] of entries) {
        console.log(`  ${name}@${version}`)
      }
    }
    return
  }

  // Default: start server
  if (command && !command.startsWith('-')) {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
  }

  // Import and run server start
  const { startServer } = await import('./main.js')
  await startServer()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Refactor main.ts to export startServer()**

Refactor `packages/core/src/main.ts` — extract the server logic into an exported `startServer()` function. Keep the `#!/usr/bin/env node` and direct call for backwards compatibility during dev:

```typescript
#!/usr/bin/env node

import { ConfigManager } from './config.js'
import { VibenCore } from './core.js'
import { loadAdapterFactory } from './plugin-manager.js'
import { log } from './log.js'

let shuttingDown = false

export async function startServer() {
  // 1. Load config
  const configManager = new ConfigManager()
  await configManager.load()

  const config = configManager.get()
  log.info('Config loaded from', configManager['configPath'])

  // 2. Create core
  const core = new VibenCore(configManager)

  // 3. Register adapters from config
  for (const [channelName, channelConfig] of Object.entries(config.channels)) {
    if (!channelConfig.enabled) continue

    if (channelName === 'telegram') {
      // Built-in adapter — try bundled import first, fall back to relative path for dev
      let TelegramAdapter: any
      try {
        const mod = await import('@viben/adapter-telegram')
        TelegramAdapter = mod.TelegramAdapter
      } catch {
        // Dev mode: resolve from workspace via relative path
        const adapterPath = new URL('../../adapters/telegram/dist/index.js', import.meta.url).pathname
        const mod = await import(adapterPath)
        TelegramAdapter = mod.TelegramAdapter
      }
      core.registerAdapter('telegram', new TelegramAdapter(core, channelConfig))
      log.info('Telegram adapter registered (built-in)')
    } else if (channelConfig.adapter) {
      // Plugin adapter
      const factory = await loadAdapterFactory(channelConfig.adapter)
      if (factory) {
        const adapter = factory.createAdapter(core, channelConfig)
        core.registerAdapter(channelName, adapter)
        log.info(`${channelName} adapter registered (plugin: ${channelConfig.adapter})`)
      } else {
        log.error(`Skipping channel "${channelName}" — adapter "${channelConfig.adapter}" failed to load`)
      }
    } else {
      log.error(`Channel "${channelName}" has no built-in adapter. Set "adapter" field to a plugin package.`)
    }
  }

  if (core.adapters.size === 0) {
    log.error('No channels enabled. Enable at least one channel in config.')
    process.exit(1)
  }

  // 4. Start
  await core.start()

  // 5. Log ready
  const agents = Object.keys(config.agents).join(', ')
  log.info(`Viben started. Agents: ${agents}`)
  log.info('Press Ctrl+C to stop.')

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log.info(`${signal} received. Shutting down...`)

    try {
      await core.stop()
    } catch (err) {
      log.error('Error during shutdown:', err)
    }

    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception:', err)
  })

  process.on('unhandledRejection', (err) => {
    log.error('Unhandled rejection:', err)
  })
}

// Direct execution for dev (node packages/core/dist/main.js)
const isDirectExecution = process.argv[1]?.endsWith('main.js')
if (isDirectExecution) {
  startServer().catch((err) => {
    log.error('Fatal:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 3: The import `@viben/adapter-telegram` needs to work in both dev and bundled contexts**

In dev: resolved via pnpm workspace (already works since telegram is a workspace package).
In bundle: tsup bundles it inline.

Verify dev still works:

```bash
pnpm build
node packages/core/dist/main.js --help 2>&1 || echo "Expected — main.js doesn't handle --help, that's cli.ts"
```

- [ ] **Step 4: Update index.ts exports**

Add to `packages/core/src/index.ts`:

```typescript
export { AdapterFactory, installPlugin, uninstallPlugin, listPlugins, loadAdapterFactory } from './plugin-manager.js'
export { PLUGINS_DIR } from './config.js'
```

- [ ] **Step 5: Build full project**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/cli.ts packages/core/src/main.ts packages/core/src/index.ts
git commit -m "feat: add CLI entry point with plugin commands and refactor main.ts"
```

---

### Task 6: Wire tsup build and test end-to-end

**Files:**
- Modify: `tsup.config.ts` (may need `noExternal`)
- Modify: `scripts/build-publish.ts` (if adjustments needed)

- [ ] **Step 1: Run the full publish build**

```bash
pnpm build:publish
```

Fix any errors. Common issue:
- dts generation fails on workspace refs → use `dts: { resolve: true }` or fall back to separate tsc step

- [ ] **Step 2: Verify dist-publish/ output**

```bash
ls -la dist-publish/
ls -la dist-publish/dist/
cat dist-publish/package.json
head -1 dist-publish/dist/cli.js   # should show #!/usr/bin/env node
```

- [ ] **Step 3: Test the built package locally**

```bash
cd dist-publish
npm pack                    # creates viben-0.1.0.tgz
npm install -g viben-0.1.0.tgz
viben --version           # should print version
viben --help              # should show help
viben plugins             # should show "No plugins installed"
```

- [ ] **Step 4: Clean up global install**

```bash
npm uninstall -g viben
```

- [ ] **Step 5: Commit any fixes from the build test**

Stage only the specific files that were changed, then commit.

---

### Task 7: Update README for npm install

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update Install section in README.md**

Replace the current git clone install instructions with:

```markdown
### Install

```bash
npx viben
```

Or install globally:

```bash
npm install -g viben
viben
```

On first run, Viben creates `~/.viben/config.json` with defaults.
```

Keep the git clone instructions as a "Development" section at the bottom.

- [ ] **Step 2: Add Plugins section to README**

After the Configuration section, add:

```markdown
## Plugins

Install additional adapters:

\`\`\`bash
npx viben install @viben/adapter-discord
npx viben plugins                              # list installed
npx viben uninstall @viben/adapter-discord   # remove
\`\`\`

Configure in `~/.viben/config.json`:

\`\`\`json
{
  "channels": {
    "discord": {
      "enabled": true,
      "adapter": "@viben/adapter-discord",
      "botToken": "..."
    }
  }
}
\`\`\`
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README with npm install and plugin instructions"
```

---

### Task 8: Publish to npm

- [ ] **Step 1: Final build**

```bash
pnpm build:publish
```

- [ ] **Step 2: Verify package contents**

```bash
cd dist-publish
npm pack --dry-run
```

Review the file list — should only contain `dist/` and `README.md`.

- [ ] **Step 3: Login to npm (if not already)**

```bash
npm login
```

- [ ] **Step 4: Publish**

```bash
cd dist-publish
npm publish
```

- [ ] **Step 5: Verify installation works**

```bash
npx viben --version
npx viben --help
```

- [ ] **Step 6: Commit any final adjustments**

Stage only the specific files that were changed, then commit.
