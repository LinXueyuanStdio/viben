# Phase 2b Part 2: Built-in Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 11 hard-wired core modules into `src/plugins/` as `VibenPlugin` implementations, so every feature is a plugin with explicit dependencies, lifecycle, and replaceable via `overrides`.

**Architecture:** Each extraction creates a `src/plugins/{name}/index.ts` that wraps the existing module in `VibenPlugin` format. The existing module code stays where it is (no file moves) — the plugin is a thin wrapper that imports, initializes, and registers the module as a service. Core.ts progressively removes hard-wired instantiation as each module is extracted.

**Tech Stack:** TypeScript ESM, Vitest. All imports use `.js` extension.

**Spec:** `docs/superpowers/specs/2026-03-26-phase2b-plugin-system.md` Section 14 Plan 2

**Depends on:** Phase 2b Part 1 (plugin infrastructure) completed.

---

## Key Design Decisions

### Wrapper Pattern
Instead of moving existing source files into `src/plugins/`, each plugin is a **thin wrapper** that:
1. Imports the existing module from its current location
2. Instantiates it in `setup()` using config from `ctx.pluginConfig`
3. Registers it as a service via `ctx.registerService()`
4. Optionally registers middleware/events

This avoids moving files (which would break 200+ imports again) while achieving all plugin goals.

### Core Reference for Adapter Plugins
Adapter plugins (Telegram, Discord, Slack) need `VibenCore` — not just `PluginContext`. Solution: expose `core` on PluginContext behind `kernel:access` permission. Plugins that declare `kernel:access` get `ctx.core: VibenCore`. This is a controlled escape hatch for built-in adapters.

### Config Resolution
`LifecycleManager.boot()` must resolve per-plugin config from ConfigManager. Plugin config comes from `config.plugins.builtin['@viben/speech'].config` or falls back to legacy config sections (`config.speech`).

### NotificationManager Adapter Map
NotificationManager needs the live `core.adapters` Map. Solution: pass it via `ctx.core.adapters` (kernel:access). The notifications plugin creates NotificationManager with the real adapters reference.

---

## File Structure

### New files to create

```
src/plugins/
  context/index.ts              — wraps ContextManager
  speech/index.ts               — wraps SpeechService + providers
  usage/index.ts                — wraps UsageStore + UsageBudget
  tunnel/index.ts               — wraps TunnelService
  security/index.ts             — wraps SecurityGuard + middleware
  notifications/index.ts        — wraps NotificationManager
  file-service/index.ts         — wraps FileService
  api-server/index.ts           — wraps ApiServer
  telegram/index.ts             — wraps TelegramAdapter
  discord/index.ts              — wraps DiscordAdapter
  slack/index.ts                — wraps SlackAdapter
  index.ts                      — exports all built-in plugins array
```

### Files to modify

```
src/core/core.ts                — remove hard-wired instantiation, load built-in plugins via LifecycleManager
src/main.ts                     — load built-in + community plugins
src/core/plugin/lifecycle-manager.ts — resolve per-plugin config, expose core reference
src/core/plugin/plugin-context.ts    — add core field behind kernel:access
src/core/plugin/types.ts             — add core to PluginContext interface
```

### Test files to create

```
src/plugins/__tests__/plugin-wrappers.test.ts   — unit test each plugin wrapper
src/plugins/__tests__/builtin-boot.test.ts      — integration: boot all plugins, verify services
```

---

## Task 0: Prerequisites — Fix Infrastructure for Plugin Config + Core Access

Before any plugin extraction, fix 3 blockers in the plugin infrastructure:

**Files:**
- Modify: `src/core/plugin/types.ts` — add `core?: unknown` to PluginContext (behind kernel:access)
- Modify: `src/core/plugin/plugin-context.ts` — expose `core` field with kernel:access check
- Modify: `src/core/plugin/lifecycle-manager.ts` — resolve per-plugin config from ConfigManager
- Test: `src/core/plugin/__tests__/lifecycle-manager.test.ts` — add test for config resolution

- [ ] **Step 1: Add `core` to PluginContext types**

In `src/core/plugin/types.ts`, add to PluginContext interface:
```typescript
/** Direct access to VibenCore. Requires 'kernel:access'. Use sparingly. */
core: unknown
```

- [ ] **Step 2: Expose `core` in plugin-context.ts**

In `createPluginContext()`, add `core` property with permission check (same pattern as `sessions`, `config`, `eventBus`). The actual core instance is passed via opts.

- [ ] **Step 3: Update LifecycleManager to resolve per-plugin config**

In `lifecycle-manager.ts`, in `boot()`, before calling `plugin.setup(ctx)`:
```typescript
// Resolve plugin config from ConfigManager
const allConfig = this.opts?.config?.get?.() as Record<string, unknown> ?? {}
const pluginsConfig = (allConfig as any).plugins?.builtin ?? {}
const legacyConfigMap: Record<string, string> = {
  '@viben/security': 'security',
  '@viben/speech': 'speech',
  '@viben/tunnel': 'tunnel',
  '@viben/usage': 'usage',
  '@viben/telegram': 'channels.telegram',
  '@viben/discord': 'channels.discord',
  '@viben/slack': 'channels.slack',
  '@viben/api-server': 'api',
}
const pluginEntry = pluginsConfig[plugin.name]
let pluginConfig = pluginEntry?.config ?? {}
// Fallback to legacy config section
if (Object.keys(pluginConfig).length === 0) {
  const legacyKey = legacyConfigMap[plugin.name]
  if (legacyKey) {
    const parts = legacyKey.split('.')
    let legacy: any = allConfig
    for (const part of parts) { legacy = legacy?.[part] }
    if (legacy && typeof legacy === 'object') pluginConfig = legacy
  }
}
```

Pass this `pluginConfig` to `createPluginContext()`.

- [ ] **Step 4: Add `core` to LifecycleManager opts**

The LifecycleManager needs the real VibenCore to pass to PluginContext. Add `core?: unknown` to `LifecycleManagerOpts`.

- [ ] **Step 5: Build + test + commit**

```bash
pnpm build && pnpm test
git add src/core/plugin/
git commit -m "fix(plugin): add core access to PluginContext and resolve per-plugin config

Fixes: pluginConfig was always {}, adapter plugins couldn't access core.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Context Plugin (easiest)

**Files:**
- Create: `src/plugins/context/index.ts`
- Test: verify build + existing context tests pass

- [ ] **Step 1: Create plugin wrapper**

```typescript
// src/plugins/context/index.ts
import type { VibenPlugin } from '../../core/plugin/types.js'
import { ContextManager } from '../../core/context/context-manager.js'
import { EntireProvider } from '../../core/context/entire/entire-provider.js'

const contextPlugin: VibenPlugin = {
  name: '@viben/context',
  version: '1.0.0',
  description: 'Conversation context management with pluggable providers',
  permissions: ['services:register'],

  async setup(ctx) {
    const manager = new ContextManager()
    manager.register(new EntireProvider())
    ctx.registerService('context', manager)
    ctx.log.info('Context service ready')
  },
}

export default contextPlugin
```

- [ ] **Step 2: Create plugins barrel**

```typescript
// src/plugins/index.ts
import contextPlugin from './context/index.js'

export const builtInPlugins = [
  contextPlugin,
]
```

- [ ] **Step 3: Build + test**

Run: `pnpm build && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add src/plugins/
git commit -m "feat(plugins): extract ContextManager as @viben/context plugin"
```

---

## Task 2: Speech Plugin

**Files:**
- Create: `src/plugins/speech/index.ts`

- [ ] **Step 1: Create plugin wrapper**

Speech plugin creates SpeechService, registers built-in providers (GroqSTT, EdgeTTS) based on config, and registers the service.

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'
import { SpeechService, GroqSTT, EdgeTTS } from '../../speech/index.js'

const speechPlugin: VibenPlugin = {
  name: '@viben/speech',
  version: '1.0.0',
  description: 'Text-to-speech and speech-to-text with pluggable providers',
  optionalPluginDependencies: { '@viben/file-service': '^1.0.0' },
  permissions: ['services:register', 'events:read'],

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    const service = new SpeechService(config)

    // Register built-in providers based on config
    if (config.groqApiKey) {
      service.registerSTTProvider('groq', new GroqSTT(String(config.groqApiKey)))
    }
    const ttsVoice = config.ttsVoice as string | undefined
    service.registerTTSProvider('edge-tts', new EdgeTTS(ttsVoice))

    ctx.registerService('speech', service)
    ctx.log.info('Speech service ready')
  },
}

export default speechPlugin
```

- [ ] **Step 2: Add to plugins barrel**
- [ ] **Step 3: Build + test + commit**

```bash
git commit -m "feat(plugins): extract SpeechService as @viben/speech plugin"
```

---

## Task 3: Usage Plugin

**Files:**
- Create: `src/plugins/usage/index.ts`

- [ ] **Step 1: Create plugin wrapper**

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'
import { UsageStore } from '../../core/sessions/usage-store.js'
import { UsageBudget } from '../../core/sessions/usage-budget.js'
import path from 'node:path'
import os from 'node:os'

const usagePlugin: VibenPlugin = {
  name: '@viben/usage',
  version: '1.0.0',
  description: 'Token usage tracking and budget enforcement',
  permissions: ['services:register', 'events:read'],

  _store: null as UsageStore | null,

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    const usagePath = path.join(os.homedir(), '.viben', 'usage.json')
    const retentionDays = (config.retentionDays as number) ?? 30
    const store = new UsageStore(usagePath, retentionDays)
    const budget = new UsageBudget(store, config as any)
    this._store = store

    ctx.registerService('usage', { store, budget })
    ctx.log.info('Usage tracking ready')
  },

  async teardown() {
    this._store?.destroy()
  },
}

export default usagePlugin
```

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract UsageStore/UsageBudget as @viben/usage plugin"
```

---

## Task 4: Tunnel Plugin

**Files:**
- Create: `src/plugins/tunnel/index.ts`

- [ ] **Step 1: Create plugin wrapper**

Tunnel is already optional and initialized in main.ts. The plugin wraps this.

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'

const tunnelPlugin: VibenPlugin = {
  name: '@viben/tunnel',
  version: '1.0.0',
  description: 'Expose local services to internet via tunnel providers',
  permissions: ['services:register', 'events:emit', 'kernel:access'],

  _service: null as any,

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    if (!config.provider) {
      ctx.log.info('Tunnel disabled (no provider configured)')
      return
    }

    const { TunnelService } = await import('../../tunnel/tunnel-service.js')
    const service = new TunnelService(config as any)
    const publicUrl = await service.start()
    this._service = service

    ctx.registerService('tunnel', service)
    ctx.log.info({ publicUrl }, 'Tunnel ready')
  },

  async teardown() {
    if (this._service) {
      await this._service.stop()
    }
  },
}

export default tunnelPlugin
```

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract TunnelService as @viben/tunnel plugin"
```

---

## Task 5: Security Plugin

**Files:**
- Create: `src/plugins/security/index.ts`

This one registers BOTH a service AND middleware.

- [ ] **Step 1: Create plugin wrapper**

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'
import { SecurityGuard } from '../../core/security-guard.js'

const securityPlugin: VibenPlugin = {
  name: '@viben/security',
  version: '1.0.0',
  description: 'User access control and session limits',
  permissions: ['services:register', 'middleware:register', 'kernel:access'],

  async setup(ctx) {
    const guard = new SecurityGuard(ctx.config as any, ctx.sessions as any)

    // Register middleware for message:incoming
    ctx.registerMiddleware('message:incoming', {
      handler: async (payload, next) => {
        const access = guard.checkAccess(payload as any)
        if (!access.allowed) {
          ctx.log.info({ userId: (payload as any).userId, reason: access.reason }, 'Access denied')
          return null  // block
        }
        return next()
      }
    })

    // Register the SecurityGuard directly as the service
    // Consumers call guard.checkAccess(message) — same API as before
    ctx.registerService('security', guard)

    ctx.log.info('Security service ready')
  },
}

export default securityPlugin
```

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract SecurityGuard as @viben/security plugin with middleware"
```

---

## Task 6: Notifications Plugin

**Files:**
- Create: `src/plugins/notifications/index.ts`

- [ ] **Step 1: Create plugin wrapper**

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'
import { NotificationManager } from '../../core/notification.js'

const notificationsPlugin: VibenPlugin = {
  name: '@viben/notifications',
  version: '1.0.0',
  description: 'Cross-session notification routing',
  pluginDependencies: { '@viben/security': '^1.0.0' },
  permissions: ['services:register', 'kernel:access'],

  async setup(ctx) {
    // NotificationManager needs the live adapters Map from core
    // Access via ctx.core (kernel:access permission)
    const core = ctx.core as { adapters: Map<string, unknown> }
    const manager = new NotificationManager(core.adapters as any)
    ctx.registerService('notifications', manager)
    ctx.log.info('Notifications service ready')
  },
}

export default notificationsPlugin
```

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract NotificationManager as @viben/notifications plugin"
```

---

## Task 7: FileService Plugin

**Files:**
- Create: `src/plugins/file-service/index.ts`

- [ ] **Step 1: Create plugin wrapper**

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'
import { FileService } from '../../core/utils/file-service.js'
import path from 'node:path'
import os from 'node:os'

const fileServicePlugin: VibenPlugin = {
  name: '@viben/file-service',
  version: '1.0.0',
  description: 'File storage and management for session attachments',
  permissions: ['services:register'],

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    const baseDir = (config.baseDir as string) ?? path.join(os.homedir(), '.viben', 'files')
    const service = new FileService(baseDir)
    ctx.registerService('file-service', service)
    ctx.log.info('File service ready')
  },
}

export default fileServicePlugin
```

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract FileService as @viben/file-service plugin"
```

---

## Task 8: API Server Plugin

**Files:**
- Create: `src/plugins/api-server/index.ts`

API Server is already initialized in main.ts, not core.ts.

- [ ] **Step 1: Create plugin wrapper**

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'

const apiServerPlugin: VibenPlugin = {
  name: '@viben/api-server',
  version: '1.0.0',
  description: 'REST API + SSE streaming server',
  permissions: ['services:register', 'events:read', 'kernel:access'],

  _server: null as any,

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    if (!config.port) {
      ctx.log.info('API server disabled (no port configured)')
      return
    }

    // Lazy import to avoid loading hono/http unless needed
    const { ApiServer } = await import('../../core/api/index.js')
    const server = new ApiServer(ctx as any, config as any)
    this._server = server

    ctx.on('system:ready', async () => {
      await server.start()
      ctx.log.info({ port: config.port }, 'API server listening')
    })

    ctx.registerService('api-server', server)
  },

  async teardown() {
    if (this._server) {
      await this._server.stop()
    }
  },
}

export default apiServerPlugin
```

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract ApiServer as @viben/api-server plugin"
```

---

## Task 9: Telegram Adapter Plugin

**Files:**
- Create: `src/plugins/telegram/index.ts`

This is the hardest extraction — TelegramAdapter has deep coupling with core.

- [ ] **Step 1: Create plugin wrapper**

```typescript
import type { VibenPlugin } from '../../core/plugin/types.js'
import { TelegramAdapter } from '../../adapters/telegram/adapter.js'

const telegramPlugin: VibenPlugin = {
  name: '@viben/telegram',
  version: '1.0.0',
  description: 'Telegram adapter with forum topics',
  pluginDependencies: {
    '@viben/security': '^1.0.0',
    '@viben/notifications': '^1.0.0',
  },
  optionalPluginDependencies: {
    '@viben/speech': '^1.0.0',
  },
  permissions: ['services:register', 'services:use', 'events:read', 'kernel:access', 'commands:register'],

  _adapter: null as TelegramAdapter | null,

  async setup(ctx) {
    const config = ctx.pluginConfig as Record<string, unknown>
    if (!config.botToken || !config.chatId) {
      ctx.log.warn('Telegram disabled (missing botToken or chatId)')
      return
    }

    // TelegramAdapter needs VibenCore — access via ctx.core (kernel:access)
    const core = ctx.core as any  // VibenCore
    const adapter = new TelegramAdapter(
      core,  // VibenCore — adapter uses core.sessionManager, core.configManager, etc.
      { ...config, enabled: true, maxMessageLength: 4096 } as any,
    )
    this._adapter = adapter

    ctx.registerService('adapter:telegram', adapter)
    ctx.log.info('Telegram adapter registered')
  },

  async teardown() {
    if (this._adapter) {
      await this._adapter.stop()
    }
  },
}

export default telegramPlugin
```

NOTE: TelegramAdapter constructor takes `(core: AdapterContext, config: MessagingAdapterConfig)`. The PluginContext is NOT directly compatible — the adapter needs `configManager`, `sessionManager`, etc. For Part 2, we create the adapter with the real core reference (passed via kernel access). A cleaner adapter-plugin API is a future improvement.

- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract TelegramAdapter as @viben/telegram plugin"
```

---

## Task 10: Discord + Slack Adapter Plugins

**Files:**
- Create: `src/plugins/discord/index.ts`
- Create: `src/plugins/slack/index.ts`

Same pattern as Telegram. Each wraps the adapter.

- [ ] **Step 1: Create both plugins** (same wrapper pattern as Task 9)
- [ ] **Step 2: Add to barrel + build + test + commit**

```bash
git commit -m "feat(plugins): extract Discord and Slack adapters as plugins"
```

---

## Task 11: Plugin Wrapper Tests + Boot Integration Test

**Files:**
- Create: `src/plugins/__tests__/plugin-wrappers.test.ts`
- Create: `src/plugins/__tests__/builtin-boot.test.ts`

- [ ] **Step 1: Write plugin wrapper unit tests**

For each plugin, test that:
- `setup()` registers the expected service name
- `teardown()` completes without error
- Dependencies are declared correctly

- [ ] **Step 2: Write boot integration test**

Boot all built-in plugins via LifecycleManager with mock config. Verify:
- All 11 plugins loaded
- All services registered (security, file-service, notifications, usage, speech, context, tunnel, api-server, adapter:telegram, adapter:discord, adapter:slack)
- Load order respects dependencies

- [ ] **Step 3: Build + test + commit**

```bash
git commit -m "test(plugins): add plugin wrapper and boot integration tests"
```

---

## Task 12: Load built-in plugins via LifecycleManager — Remove hard-wired code

Remove hard-wired instantiation from core.ts and load via plugin system instead.

**Files:**
- Modify: `src/core/core.ts` — remove direct module instantiation, use LifecycleManager
- Modify: `src/main.ts` — load built-in + community plugins

- [ ] **Step 1: Update main.ts to load built-in plugins**

```typescript
import { builtInPlugins } from './plugins/index.js'

// In startup, after core creation:
// Load built-in plugins first, then community plugins
const allPlugins = [...builtInPlugins, ...communityPlugins]
await core.lifecycleManager.boot(allPlugins)
```

- [ ] **Step 2: Remove hard-wired module creation from core.ts**

Progressively remove from constructor:
- Remove `this.contextManager = new ContextManager()` — now created by context plugin
- Remove `this.speechService = new SpeechService(...)` — now created by speech plugin
- Remove `this.securityGuard = new SecurityGuard(...)` — now created by security plugin
- Remove `this.notificationManager = new NotificationManager(...)` — now created by notifications plugin
- Remove `this.fileService = new FileService(...)` — now created by file-service plugin
- Remove usage instantiation — now created by usage plugin
- Remove service auto-registration calls (plugins register themselves)

Keep: ConfigManager, AgentManager, SessionManager, MessageTransformer, EventBus, LifecycleManager (these stay in core).

For modules that core.ts still references (e.g., `this.securityGuard.checkAccess()` in handleMessage), replace with service lookup:
```typescript
const security = this.lifecycleManager.serviceRegistry.get<SecurityService>('security')
if (security) { ... }
```

**CRITICAL:** Do this incrementally. After each removal, `pnpm build && pnpm test` must pass. If a test breaks because it expects a direct property (like `core.securityGuard`), update the test to use serviceRegistry.

- [ ] **Step 3: Build + test after each change**
- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(core): remove hard-wired modules, load via plugin lifecycle

Core now only contains: ConfigManager, AgentManager, SessionManager,
MessageTransformer, EventBus, LifecycleManager. All other modules
are loaded as plugins.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Final Verification

- [ ] **Step 1: Full build**

Run: `pnpm build`

- [ ] **Step 2: Full test suite**

Run: `pnpm test`

- [ ] **Step 3: Publish build**

Run: `pnpm build:publish`

- [ ] **Step 4: Verify core.ts is minimal**

Count direct dependencies in core.ts constructor — should be ~5 (ConfigManager, AgentManager, SessionManager, MessageTransformer, EventBus, LifecycleManager).

- [ ] **Step 5: Push**

```bash
git push
```

---

## Summary

| Task | Description | Difficulty |
|------|-------------|-----------|
| 0 | Prerequisites: fix pluginConfig + core access + config resolution | Medium |
| 1 | @viben/context plugin | Easy |
| 2 | @viben/speech plugin | Easy |
| 3 | @viben/usage plugin | Easy |
| 4 | @viben/tunnel plugin | Easy |
| 5 | @viben/security plugin + middleware | Medium |
| 6 | @viben/notifications plugin (uses ctx.core.adapters) | Medium |
| 7 | @viben/file-service plugin | Easy |
| 8 | @viben/api-server plugin | Easy |
| 9 | @viben/telegram adapter plugin (uses ctx.core) | Hard |
| 10 | @viben/discord + slack adapter plugins | Hard |
| 11 | Plugin wrapper tests + boot integration test | Medium |
| 12 | Remove hard-wired code from core.ts | Hard |
| 13 | Final verification + push | — |

**After completion:** core.ts will have ~5 direct dependencies (from 15+). All modules loaded as plugins via LifecycleManager. Any built-in can be overridden by community plugins.
