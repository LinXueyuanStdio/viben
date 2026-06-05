# Plugin Developer Tooling Design

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Plugin System (phase2b), Plugin Setup Workflow, Command System

## Overview

Developer tooling for plugin authors: dev mode with hot-reload, scaffold generator, testing utilities, and type exports. Target audience: both internal team and community developers.

### Goals

1. `viben dev <path>` — load local plugin with file watcher + hot-reload
2. `viben plugin create` — scaffold a new plugin project
3. `@viben/plugin-sdk` — types, base classes, testing utilities
4. Version-synced SDK published alongside CLI

### Non-Goals

- Plugin marketplace / registry
- GUI-based plugin builder
- Plugin debugging tools (IDE integration)

---

## 1. `viben dev <plugin-path>` — Dev Mode

### Purpose

Load a plugin from a local directory during development. Watch for file changes and auto-reload the plugin without restarting the entire system.

### CLI Interface

```
viben dev <path>                    # load + watch + hot-reload
viben dev <path> --no-watch         # load once, no hot-reload
viben dev <path> --verbose          # extra debug logging for plugin
```

### Dev Mode Flow

```
$ viben dev ./my-plugin/

1. Validate plugin path
   → Check <path>/dist/index.js OR <path>/src/index.ts exists
   → If TypeScript: check tsconfig.json, run initial compile

2. Compile TypeScript (if applicable)
   → Spawn `tsc --watch` in background (writes to dist/)
   → Wait for initial compilation to complete

3. Start Viben normally
   → Load config, boot all core + built-in plugins via LifecycleManager

4. Load dev plugin
   → Dynamic import from <path>/dist/index.js
   → Validate: check VibenPlugin interface (name, version, setup)
   → Create PluginContext
   → Call plugin.setup(ctx)
   → Log: "✓ Dev plugin loaded: @name/plugin (version)"

5. Watch for changes (unless --no-watch)
   → Watch <path>/dist/ for .js file changes
   → On change detected:

6. Hot-reload cycle
   a. Log: "↻ Reloading plugin..."
   b. Call plugin.teardown() (if exists)
   c. PluginContext.cleanup() — unregister services, commands, middleware, event listeners
   d. Clear Node.js module cache for all files under plugin path
   e. Dynamic import with cache-bust: import(`${path}/dist/index.js?t=${Date.now()}`)
   f. Validate new module
   g. Create fresh PluginContext
   h. Call plugin.setup(ctx)
   i. Log: "✓ Plugin reloaded (42ms)"

7. Error handling
   → If setup() throws: log error, keep system running, retry on next file change
   → If teardown() throws: log warning, continue with reload
   → If import fails: log error, keep old plugin loaded
```

### Prerequisite: Fix PluginContext.cleanup()

Current `cleanup()` removes event listeners and middleware but does NOT unregister services from `ServiceRegistry` or commands from `CommandRegistry`. For hot-reload to work, `cleanup()` must:

1. Track registered service names during plugin lifetime
2. Call `serviceRegistry.unregister(name)` for each on cleanup
3. Call `commandRegistry.unregisterByPlugin(pluginName)` on cleanup
4. Add `ServiceRegistry.unregisterByPlugin(pluginName)` method

This is a code fix required BEFORE dev mode implementation.

### Module Cache Clearing

ESM modules are cached by Node.js. To reload:

```typescript
// For ESM: use dynamic import with cache-busting query parameter
// Node.js treats different query strings as different modules
const modulePath = new URL(`file://${absolutePath}/dist/index.js?t=${Date.now()}`).href
const mod = await import(modulePath)
const plugin = mod.default as VibenPlugin
```

### ESM Cache-Busting Limitations

The query-string approach (`?t=timestamp`) has known limitations:

1. **Only entry file reloads** — plugin's `index.js` gets a new URL, but its internal imports (`./helper.js`) resolve to cached versions.
2. **Memory leak** — each reload creates a new module entry never garbage collected. Acceptable for dev sessions.
3. **Dependency changes require full restart** — new imports in helper files not picked up by hot-reload.

**Mitigation:** Recommend plugin authors keep `index.ts` as the main logic file. For complex plugins with many files, use `--no-watch` + manual restart.

**Future improvement:** Worker thread per dev plugin reload (clean module cache per worker, all files refreshed).

### Dev Plugin Isolation

- Dev plugin has same PluginContext as any other plugin — no special permissions
- If dev plugin crashes, only it is affected (error isolation via try/catch)
- Dev plugin's services are unregistered on reload — consumers get fresh instances
- Active sessions that reference old services may get disrupted — acceptable for dev mode

### Implementation Location

```
src/cli/commands/dev.ts              ← CLI command handler
src/core/plugin/dev-loader.ts        ← DevPluginLoader class (watch + reload logic)
```

---

## 2. `viben plugin create` — Scaffold Generator

### Purpose

Generate a complete plugin project template with all lifecycle hooks commented and explained.

### CLI Interface

```
$ viben plugin create

? Plugin name: my-translator
? Description: Auto-translate messages between languages
? Author: yourname
? License: (MIT)

Creating plugin: @yourname/viben-plugin-my-translator

  my-translator/
    ├── src/
    │   └── index.ts
    ├── src/__tests__/
    │   └── index.test.ts
    ├── package.json
    ├── tsconfig.json
    ├── .gitignore
    ├── .npmignore
    ├── .editorconfig
    └── README.md

✓ Done! Next steps:
  cd my-translator
  npm install
  npm run dev
```

### Template: Single Comprehensive Template

One template with all hooks included and commented. Developer removes what they don't need.

### Generated Files

#### `src/index.ts`

```typescript
import type { VibenPlugin, InstallContext, MigrateContext } from '@viben/plugin-sdk'
import { z } from 'zod'

// ─── Settings Schema ───
// Define what settings your plugin stores in settings.json
// Users configure these during `viben plugin install` or `viben plugin configure`
const settingsSchema = z.object({
  apiKey: z.string().optional(),
  enabled: z.boolean().default(true),
})

const plugin: VibenPlugin = {
  name: '{{packageName}}',
  version: '1.0.0',
  description: '{{description}}',
  essential: false,

  // Permissions your plugin needs — remove any you don't use
  // See: https://viben.dev/architecture/plugin-system#permissions
  permissions: [
    'services:register',    // Register services for other plugins to use
    'events:read',          // Listen to system events
    'commands:register',    // Add chat commands (/your-command)
    // 'middleware:register',  // Intercept message/agent/permission flow
    // 'storage:read',        // Read persistent key-value storage
    // 'storage:write',       // Write persistent key-value storage
    // 'kernel:access',       // Access core internals (advanced)
  ],

  settingsSchema,

  // ─── Install ───
  // Runs once when user installs your plugin.
  // Use ctx.terminal for interactive prompts, ctx.settings to save config.
  async install(ctx: InstallContext) {
    // If upgrading from old config format, migrate silently
    if (ctx.legacyConfig) {
      await ctx.settings.setAll(ctx.legacyConfig as Record<string, unknown>)
      ctx.terminal.log.success('Settings migrated')
      return
    }

    // Interactive setup
    const apiKey = await ctx.terminal.password({
      message: 'Enter API key (optional, press Enter to skip):',
    })

    await ctx.settings.setAll({
      apiKey: apiKey || undefined,
      enabled: true,
    })

    ctx.terminal.log.success('Plugin installed!')
  },

  // ─── Configure ───
  // Runs when user wants to change settings after install.
  // Falls back to install() if not defined.
  async configure(ctx: InstallContext) {
    const current = await ctx.settings.getAll()

    const action = await ctx.terminal.select({
      message: 'What to configure?',
      options: [
        { value: 'apiKey', label: 'API Key', hint: current.apiKey ? 'Set' : 'Not set' },
        { value: 'enabled', label: 'Enabled', hint: String(current.enabled ?? true) },
      ],
    })

    switch (action) {
      case 'apiKey': {
        const key = await ctx.terminal.password({ message: 'New API key:' })
        await ctx.settings.set('apiKey', key)
        break
      }
      case 'enabled': {
        const enabled = await ctx.terminal.confirm({ message: 'Enable plugin?' })
        await ctx.settings.set('enabled', enabled)
        break
      }
    }

    ctx.terminal.log.success('Settings updated! Restart to apply.')
  },

  // ─── Migrate ───
  // Runs at boot when plugin version changes.
  // Transform old settings to new format.
  async migrate(ctx: MigrateContext, oldSettings: unknown, oldVersion: string) {
    // Example: rename a field in v2
    // if (oldVersion === '1.0.0') {
    //   const old = oldSettings as Record<string, unknown>
    //   return { ...old, newFieldName: old.oldFieldName }
    // }
    return oldSettings
  },

  // ─── Setup ───
  // Runs every boot. Register services, commands, middleware here.
  // This is where your plugin's main logic lives.
  async setup(ctx) {
    const config = ctx.pluginConfig as z.infer<typeof settingsSchema>
    if (!config.enabled) {
      ctx.log.info('Plugin disabled')
      return
    }

    // ── Register a service (other plugins can use it) ──
    // const myService = new MyService(config)
    // ctx.registerService('my-service', myService)

    // ── Register a chat command ──
    ctx.registerCommand({
      name: 'example',
      description: 'Example command',
      usage: '<arg>',
      category: 'plugin',
      handler: async (args) => {
        if (!args.raw.trim()) {
          return {
            type: 'menu',
            title: 'Example Plugin',
            options: [
              { label: 'Option A', command: '/example a' },
              { label: 'Option B', command: '/example b' },
            ],
          }
        }
        return { type: 'text', text: `You said: ${args.raw}` }
      },
    })

    // ── Register middleware (intercept flow) ──
    // ctx.registerMiddleware('message:outgoing', {
    //   handler: async (msg, next) => {
    //     // Modify outgoing messages before they reach the user
    //     return next()
    //   },
    // })

    // ── Listen to events ──
    // ctx.on('session:afterDestroy', (event) => {
    //   ctx.log.info({ sessionId: event.sessionId }, 'Session ended')
    // })

    ctx.log.info('Plugin loaded')
  },

  // ─── Teardown ───
  // Runs on shutdown. Clean up resources.
  async teardown() {
    // Close connections, clear timers, etc.
  },

  // ─── Uninstall ───
  // Runs when user removes your plugin.
  async uninstall(ctx: InstallContext, { purge }) {
    // Clean up external resources (webhooks, downloaded files, etc.)
    if (purge) {
      await ctx.settings.clear()
      ctx.terminal.log.info('Settings purged')
    }
    ctx.terminal.log.success('Plugin uninstalled')
  },
}

export default plugin
```

#### `src/__tests__/index.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { createTestContext } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

describe('{{pluginName}}', () => {
  it('loads successfully', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })

    await plugin.setup(ctx)
    expect(ctx.registeredCommands).toContainEqual(
      expect.objectContaining({ name: 'example' })
    )
  })

  it('skips when disabled', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: false },
    })

    await plugin.setup(ctx)
    expect(ctx.registeredCommands).toHaveLength(0)
  })

  it('/example command returns menu when no args', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })

    await plugin.setup(ctx)
    const response = await ctx.executeCommand('/example')
    expect(response.type).toBe('menu')
  })

  it('/example command echoes args', async () => {
    const ctx = createTestContext({
      pluginConfig: { enabled: true },
      permissions: plugin.permissions,
    })

    await plugin.setup(ctx)
    const response = await ctx.executeCommand('/example hello world')
    expect(response).toEqual({ type: 'text', text: 'You said: hello world' })
  })
})
```

#### `package.json`

```json
{
  "name": "{{packageName}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist/"],
  "scripts": {
    "build": "tsc",
    "dev": "viben dev .",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["viben", "viben-plugin"],
  "author": "{{author}}",
  "license": "{{license}}",
  "peerDependencies": {
    "@viben/kernel": ">=2026.0326.0"
  },
  "devDependencies": {
    "@viben/plugin-sdk": "2026.0326.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "zod": "^3.24.0"
  }
}
```

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/__tests__/**"]
}
```

#### `.gitignore`

```
node_modules/
dist/
*.tsbuildinfo
.DS_Store
.env
.env.*
*.log
```

#### `.npmignore`

```
src/
__tests__/
tsconfig.json
.gitignore
.editorconfig
.DS_Store
*.tsbuildinfo
.env
.env.*
```

#### `.editorconfig`

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

#### `README.md`

```markdown
# {{packageName}}

{{description}}

## Installation

\`\`\`bash
viben plugin install {{packageName}}
\`\`\`

## Configuration

\`\`\`bash
viben plugin configure {{packageName}}
\`\`\`

## Commands

- `/example <arg>` — Example command

## Development

\`\`\`bash
npm install
npm run dev          # Start Viben with this plugin in dev mode
npm test             # Run tests
npm run build        # Build for publishing
\`\`\`

## License

{{license}}
```

### Implementation Location

```
src/cli/commands/plugin-create.ts    ← Scaffold logic + prompts
src/cli/templates/plugin/            ← Template files (or inline strings)
```

---

## 3. `@viben/plugin-sdk` — Types + Testing

### Package Purpose

Single dev dependency for plugin authors. Provides:
1. **Type exports** — all interfaces plugin code needs
2. **Base classes** — for adapter plugins
3. **Testing utilities** — mock contexts, helpers

### Package Structure

```
packages/plugin-sdk/
  ├── src/
  │   ├── index.ts             ← types + base class re-exports
  │   ├── testing.ts           ← test utilities
  │   └── testing/
  │       ├── test-context.ts  ← createTestContext
  │       ├── test-install.ts  ← createTestInstallContext
  │       └── mock-services.ts ← pre-built service mocks
  ├── package.json
  ├── tsconfig.json
  └── README.md
```

### Exports: `@viben/plugin-sdk`

```typescript
// ─── Plugin interfaces ───
export type {
  VibenPlugin,
  PluginContext,
  PluginPermission,
  PluginStorage,
  InstallContext,
  MigrateContext,
  TerminalIO,
  SettingsAPI,
} from '@viben/kernel'

// ─── Command types ───
export type {
  CommandDef,
  CommandArgs,
  CommandResponse,
  MenuOption,
  ListItem,
} from '@viben/kernel'

// ─── Service interfaces (for getService<T>() calls) ───
export type {
  SecurityService,
  FileServiceInterface,
  NotificationService,
  UsageService,
  SpeechServiceInterface,
  TunnelServiceInterface,
  ContextService,
} from '@viben/kernel'

// ─── Adapter types (for adapter plugins) ───
export type {
  IChannelAdapter,
  OutgoingMessage,
  PermissionRequest,
  PermissionOption,
  NotificationMessage,
  AgentCommand,
} from '@viben/kernel'

// ─── Adapter base classes (for adapter plugins) ───
export {
  MessagingAdapter,
  StreamAdapter,
  BaseRenderer,
} from '@viben/kernel'

// ─── Adapter primitives (for advanced adapter plugins) ───
export {
  SendQueue,
  DraftManager,
  ToolCallTracker,
  ActivityTracker,
} from '@viben/kernel'
```

### Exports: `@viben/plugin-sdk/testing`

```typescript
export { createTestContext } from './testing/test-context.js'
export { createTestInstallContext } from './testing/test-install.js'
export { mockServices } from './testing/mock-services.js'
export type { TestPluginContext, TestInstallContext } from './testing/test-context.js'
```

### `createTestContext(opts)` — Test Plugin setup()

```typescript
interface TestContextOpts {
  pluginName?: string
  pluginConfig?: Record<string, unknown>
  permissions?: string[]
  services?: Record<string, unknown>   // pre-registered services
}

interface TestPluginContext extends PluginContext {
  // Test inspection helpers (not in real PluginContext)
  registeredServices: Map<string, unknown>
  registeredCommands: CommandDef[]
  registeredMiddleware: Array<{ hook: string; handler: Function }>
  emittedEvents: Array<{ event: string; payload: unknown }>
  executeCommand(commandString: string): Promise<CommandResponse>
}
```

Features:
- In-memory storage (no file I/O)
- Silent logger (no output during tests)
- Tracks all registrations for assertions
- `executeCommand()` helper dispatches to registered commands
- Services from `opts.services` available via `getService()`

### `createTestInstallContext(opts)` — Test Plugin install/configure

```typescript
interface TestInstallContextOpts {
  pluginName?: string
  legacyConfig?: Record<string, unknown>
  terminalResponses?: {
    text?: string | string[]        // auto-answer text() prompts
    password?: string | string[]
    select?: unknown | unknown[]
    confirm?: boolean | boolean[]
    multiselect?: unknown[] | unknown[][]
  }
}

interface TestInstallContext extends InstallContext {
  // Inspection
  savedSettings: Record<string, unknown>
  terminalCalls: Array<{ method: string; opts: unknown }>
}
```

Features:
- Auto-answers terminal prompts (no interactive I/O in tests)
- Sequential answers: first call gets first value, second call gets second value
- In-memory settings (no file I/O)
- Tracks terminal method calls for assertions

### `mockServices` — Pre-built Service Mocks

```typescript
const mockServices = {
  security(opts?: { allowAll?: boolean }): SecurityService
  fileService(): FileServiceInterface
  speech(): SpeechServiceInterface
  tunnel(opts?: { publicUrl?: string }): TunnelServiceInterface
  usage(opts?: { budget?: number }): UsageService
  notifications(): NotificationService
  context(): ContextService
}
```

Each returns a vi.fn()-based mock with sensible defaults. Plugin devs don't need to build mocks from scratch.

### package.json

```json
{
  "name": "@viben/plugin-sdk",
  "version": "2026.0326.0",
  "description": "SDK for building Viben plugins — types, base classes, and testing utilities",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing.d.ts",
      "import": "./dist/testing.js"
    }
  },
  "files": ["dist/"],
  "peerDependencies": {
    "@viben/kernel": ">=2026.0326.0"
  },
  "devDependencies": {
    "@viben/kernel": "workspace:*",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "keywords": ["viben", "plugin", "sdk", "testing"],
  "license": "MIT"
}
```

### Monorepo Setup

SDK lives in the same repo as CLI:

```
viben/
  package.json               ← root workspace config
  pnpm-workspace.yaml        ← workspace definition
  packages/
    plugin-sdk/
      src/
      package.json
      tsconfig.json
  src/                        ← CLI source (existing)
  package.json                ← CLI package.json (existing)
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

Published together: when CLI publishes new version, SDK publishes same version.

**Note:** Root `package.json` has `"name": "viben"` (private), but publishes as `@viben/kernel`. For `workspace:*` resolution, the SDK should reference the root package by its actual name: `"viben": "workspace:*"` as devDependency. The publish script handles the name mapping to `@viben/kernel`.

**CI/CD update needed:** GitHub Actions workflow must be updated to build SDK package and publish both `@viben/kernel` and `@viben/plugin-sdk` on tag push.

---

## 4. Version Strategy

SDK version MUST match CLI version. Same `YYYY.MMDD.patch` scheme.

```
@viben/kernel@2026.0326.1      ← main package
@viben/plugin-sdk@2026.0326.1  ← published same time, same version
```

**Why same version:** Plugin SDK re-exports types from CLI. If types change in CLI but SDK version is different, consumers get confusing type mismatches.

**CI/CD:** GitHub Action publishes both packages on tag push (`v*`). SDK build depends on CLI build (types must be generated first).

---

## 5. Testing Strategy

### SDK Package Tests

- `createTestContext` — verify all PluginContext methods work, track registrations correctly
- `createTestInstallContext` — verify auto-answer prompts, settings persistence
- `mockServices` — verify each mock returns sensible defaults
- `executeCommand` helper — verify command dispatch and response

### Scaffold Tests

- `viben plugin create` — verify all files generated with correct content
- Template substitution — verify `{{packageName}}`, `{{description}}` replaced correctly
- Generated project builds — `tsc` succeeds on generated tsconfig
- Generated tests pass — `vitest run` on generated test file

### Dev Mode Tests

- Plugin loads from local path
- File change triggers reload
- Teardown called before reload
- Error in setup() doesn't crash system
- Module cache properly cleared

---

## 6. Implementation Order

| Phase | What | Depends on |
|-------|------|-----------|
| 1 | `@viben/plugin-sdk` — types + testing | Plugin system (done) |
| 2 | `viben plugin create` — scaffold | SDK package (phase 1) |
| 3 | `viben dev` — dev mode | Plugin system (done) |

Phase 1 first because scaffold generates projects that import from SDK, and scaffold tests need SDK testing utilities.
