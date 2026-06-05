# Viben: Publish as npm Package

## Goal

Publish Viben as a single npm package `viben` so users can run it with one command:

```bash
npx viben
```

## Current State

- Monorepo with pnpm workspaces: `@viben/core` + `@viben/adapter-telegram`
- Root `package.json` is `"private": true`
- `main.ts` imports telegram adapter via relative file path
- Install requires git clone + pnpm install + pnpm build

## Design

### 1. Package Identity

- **npm name:** `viben` (confirmed available)
- **Binary:** `viben`
- **License:** AGPL-3.0

### 2. Build Pipeline

Keep monorepo structure for development. Add a publish build step that bundles everything into a single publishable package.

**Tooling:** tsup (esbuild wrapper) for bundling.

**Build commands:**
- `pnpm build` — existing per-package tsc build for development
- `pnpm build:publish` — generates `dist-publish/` directory ready for `npm publish`

**Bundle strategy:**
- Two entry points for tsup: `cli` (from `packages/core/src/cli.ts`) and `index` (from `packages/core/src/index.ts`)
- `cli.ts` imports telegram adapter via `@viben/adapter-telegram` (workspace dependency), tsup resolves and bundles it
- External dependencies stay as dependencies (not bundled): `grammy`, `zod`, `nanoid`, `@agentclientprotocol/sdk`
- Output: ESM (`"type": "module"`), `platform: 'node'`
- Generate declaration files (`.d.ts`) via tsup `dts: true` — may need `dts: { resolve: true }` for workspace deps
- Shebang `#!/usr/bin/env node` injected into `cli.js` via tsup `banner` option

**Output structure:**

```
dist-publish/
  package.json       → name: "viben"
  dist/
    cli.js           → #!/usr/bin/env node, CLI entry point
    index.js         → library exports (ChannelAdapter, types, etc.)
    index.d.ts       → type declarations
    [chunk files]    → shared code between cli and index
  README.md          → copied from root
```

### 3. Package.json (generated)

```json
{
  "name": "viben",
  "version": "0.1.0",
  "description": "Self-hosted bridge for AI coding agents via ACP protocol",
  "type": "module",
  "bin": {
    "viben": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist/", "README.md"],
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "@agentclientprotocol/sdk": "^0.16.0",
    "grammy": "^1.30.0",
    "nanoid": "^5.0.0",
    "zod": "^3.25.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/nicepkg/Viben"
  },
  "license": "AGPL-3.0",
  "keywords": ["acp", "ai", "coding-agent", "telegram", "claude", "codex"]
}
```

### 4. CLI Entry Points

**`cli.js`** handles:

```
npx viben                                      → start server
npx viben install @viben/adapter-discord     → install plugin
npx viben uninstall @viben/adapter-discord   → uninstall plugin
npx viben plugins                              → list installed plugins
npx viben --version                            → show version
npx viben --help                               → show help
```

**`index.js`** exports library API for third-party adapter developers:

```typescript
import { ChannelAdapter } from 'viben'
```

### 5. Plugin System

**Storage:** `~/.viben/plugins/`

```
~/.viben/
  config.json
  plugins/
    package.json          ← managed by `viben install`
    node_modules/
      @viben/adapter-discord/
```

**Install mechanism:**
- `viben install <pkg>` runs `npm install <pkg>` with `--prefix ~/.viben/plugins/`
- Creates `~/.viben/plugins/package.json` if it doesn't exist
- `viben uninstall <pkg>` runs `npm uninstall <pkg>` with same prefix
- `viben plugins` reads `~/.viben/plugins/package.json` dependencies

**Plugin loading:**
- Telegram adapter is built-in (bundled), loaded directly
- External adapters configured in `config.json` with explicit `adapter` field:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "..."
    },
    "discord": {
      "enabled": true,
      "adapter": "@viben/adapter-discord",
      "botToken": "..."
    }
  }
}
```

- Core loads external adapters using `createRequire` from `node:module` rooted at `~/.viben/plugins/`:

```typescript
import { createRequire } from 'node:module'
import path from 'node:path'
import os from 'node:os'

const pluginsDir = path.join(os.homedir(), '.viben', 'plugins')
const pluginRequire = createRequire(path.join(pluginsDir, 'node_modules', '.package.json'))

// To load a plugin adapter:
const adapterModule = await import(pluginRequire.resolve(packageName))
```

- Each plugin must export an `AdapterFactory` conforming to this interface:

```typescript
export interface AdapterFactory {
  name: string                                             // e.g. "discord"
  createAdapter(core: VibenCore, config: any): ChannelAdapter
}
```

**Error handling:**
- If a configured adapter package is not installed → log error with install instruction, skip that channel
- If package is installed but doesn't export a valid `AdapterFactory` → log error, skip that channel
- Server continues running with whatever channels loaded successfully

### 6. User Experience

**First time:**
```bash
npx viben
# → Downloads + runs
# → Creates ~/.viben/config.json with defaults
# → "No channels enabled. Edit ~/.viben/config.json"
```

**Normal usage:**
```bash
# Edit config, add bot token...
npx viben
# → Starts server with telegram built-in
```

**Adding a plugin:**
```bash
npx viben install @viben/adapter-discord
# → Installs to ~/.viben/plugins/
# Edit config to add discord channel
npx viben
# → Starts with telegram (built-in) + discord (plugin)
```

### 7. Version Management

- Version sourced from root `package.json` (represents the whole project)
- Build script copies version into `dist-publish/package.json`
- Publish workflow: `pnpm build:publish && cd dist-publish && npm publish`

### 8. Changes to Existing Code

**`main.ts` (now `cli.ts`):**
- Add CLI argument parsing (start, install, uninstall, plugins)
- Replace relative telegram adapter import with direct bundled import
- Add plugin loading logic for external adapters from `~/.viben/plugins/`

**`core.ts`:**
- Add method to load adapter from plugin path
- Accept adapter config with optional `adapter` package name

**`config.ts`:**
- Restructure `channels` schema from fixed `z.object({ telegram })` to `z.record(z.string(), ChannelSchema)` to support arbitrary channel names
- Base `ChannelSchema` has `enabled`, optional `adapter` (package name), and `z.passthrough()` for channel-specific config
- Telegram channel is recognized by key name `"telegram"` and uses built-in adapter (no `adapter` field needed)
- Other channels require `adapter` field pointing to installed plugin package
- Add plugins directory path constant

**New files:**
- `packages/core/src/cli.ts` — CLI command routing (start, install, uninstall, plugins)
- `packages/core/src/plugin-manager.ts` — install/uninstall/list/load plugins
- `tsup.config.ts` — build config for publish bundle
- `scripts/build-publish.ts` — generates dist-publish/ with package.json, README

### 9. What Does NOT Change

- Monorepo structure for development
- `pnpm build` for dev builds
- `@viben/core` and `@viben/adapter-telegram` internal package names
- Existing adapter interface (`ChannelAdapter` abstract class)
- Config file format (backwards compatible — existing telegram config still works, `adapter` field is optional for built-in channels)

### 10. Future Considerations

- Plugin adapters for Discord, Slack, WhatsApp etc. published as `@viben/adapter-*`
- Agent plugins could follow same pattern: `@viben/agent-*`
- `viben plugins` could show available plugins from a registry
