# Codebase Consolidation Design

**Date:** 2026-03-26
**Status:** Draft
**Depends on:** Phase 2b Plugin System, Plugin Setup Workflow

## Overview

Consolidate the codebase to fix structural issues: adapter code split between two locations, core importing from plugins (inverted dependency), hardcoded adapter registration in main.ts, and Telegram-specific logic in core. After this refactor, plugins are self-contained, core depends only on interfaces via ServiceRegistry, and main.ts is a thin bootstrap.

### Goals

1. All plugin source code lives in `src/plugins/` — no separate `src/adapters/`, `src/speech/`, `src/tunnel/`
2. Core never imports from plugins — uses ServiceRegistry with typed interfaces
3. main.ts only bootstraps infrastructure and boots plugins via LifecycleManager
4. Shared adapter framework lives in `src/core/adapter-primitives/`
5. No duplicate code between plugin wrappers and implementations
6. Legacy `plugin-manager.ts` removed

### Non-Goals

- Splitting large adapter files (1161-line adapter.ts) — separate effort
- Standardizing adapter file naming — separate effort
- Naming convention (Manager vs Service) — separate effort

---

## 1. New Folder Structure

### Before

```
src/
  adapters/
    shared/primitives/     ← framework code (MessagingAdapter, SendQueue, etc.)
    shared/rendering/      ← BaseRenderer, format utilities
    telegram/              ← 23 files, adapter implementation
    discord/               ← 15 files, adapter implementation
    slack/                 ← 8 files, adapter implementation
  plugins/
    telegram/index.ts      ← thin wrapper importing ../../adapters/telegram/
    discord/index.ts       ← thin wrapper importing ../../adapters/discord/
    slack/index.ts         ← thin wrapper importing ../../adapters/slack/
    speech/index.ts        ← thin wrapper importing ../../speech/
    tunnel/index.ts        ← thin wrapper importing ../../tunnel/
    api-server/            ← already consolidated (has source code)
    security/              ← has source code
    usage/                 ← has source code
    file-service/          ← has source code
    notifications/         ← has source code
    context/               ← has source code
  speech/                  ← source code separate from plugin
  tunnel/                  ← source code separate from plugin
  core/
    api-client.ts          ← already moved to cli/
    plugin-manager.ts      ← legacy, redundant with plugin/
    topic-manager.ts       ← Telegram-specific, doesn't belong in core
    message-transformer.ts ← imports tunnel plugin directly
    core.ts                ← imports 10+ plugin implementations
    ...
```

### After

```
src/
  plugins/
    telegram/              ← ALL telegram code consolidated
      adapter.ts           ← moved from adapters/telegram/
      commands/            ← moved from adapters/telegram/commands/
      streaming.ts         ← moved from adapters/telegram/
      formatting.ts        ← moved from adapters/telegram/
      permissions.ts       ← moved from adapters/telegram/
      activity.ts          ← moved from adapters/telegram/
      draft-manager.ts     ← moved from adapters/telegram/
      tool-call-tracker.ts ← moved from adapters/telegram/
      topic-manager.ts     ← moved from core/
      validators.ts        ← already here
      types.ts             ← moved from adapters/telegram/
      index.ts             ← plugin lifecycle (install/configure/setup/teardown)
      __tests__/

    discord/               ← ALL discord code consolidated
      adapter.ts           ← moved from adapters/discord/
      commands/            ← moved from adapters/discord/commands/
      streaming.ts         ← moved from adapters/discord/
      formatting.ts        ← moved from adapters/discord/
      permissions.ts       ← moved from adapters/discord/
      activity.ts          ← moved from adapters/discord/
      draft-manager.ts     ← moved from adapters/discord/
      tool-call-tracker.ts ← moved from adapters/discord/
      validators.ts        ← already here
      types.ts             ← moved from adapters/discord/
      index.ts
      __tests__/

    slack/                 ← ALL slack code consolidated
      adapter.ts           ← moved from adapters/slack/
      formatter.ts         ← moved from adapters/slack/
      event-router.ts      ← moved from adapters/slack/
      permission-handler.ts← moved from adapters/slack/
      send-queue.ts        ← moved from adapters/slack/
      text-buffer.ts       ← moved from adapters/slack/
      types.ts             ← moved from adapters/slack/
      index.ts
      __tests__/

    speech/                ← ALL speech code consolidated
      speech-service.ts    ← moved from src/speech/
      types.ts             ← moved from src/speech/
      providers/           ← moved from src/speech/providers/
        edge-tts.ts
        groq.ts
      index.ts
      __tests__/

    tunnel/                ← ALL tunnel code consolidated
      tunnel-service.ts    ← moved from src/tunnel/
      extract-file-info.ts ← moved from src/tunnel/
      providers/           ← moved from src/tunnel/providers/
        cloudflared.ts
        ngrok.ts
        bore.ts
        tailscale.ts
      types.ts             ← moved from src/tunnel/
      index.ts
      __tests__/

    api-server/            ← already consolidated
    security/
    usage/
    file-service/
    notifications/
    context/
    core-plugins.ts        ← list of all built-in plugins

  core/
    adapter-primitives/    ← shared framework for adapter plugins
      messaging-adapter.ts ← moved from adapters/shared/primitives/
      stream-adapter.ts    ← moved from adapters/shared/primitives/
      draft-manager.ts     ← moved from adapters/shared/primitives/ (generic base)
      send-queue.ts        ← moved from adapters/shared/primitives/
      tool-call-tracker.ts ← moved from adapters/shared/primitives/
      activity-tracker.ts  ← moved from adapters/shared/primitives/
      renderer.ts          ← moved from adapters/shared/rendering/
      message-formatter.ts ← moved from adapters/shared/rendering/
      message-dispatcher.ts← moved from adapters/shared/
      format-types.ts      ← moved from adapters/shared/rendering/
      format-utils.ts      ← moved from adapters/shared/rendering/
      index.ts             ← barrel export
      __tests__/           ← moved from adapters/shared/__tests__/

    plugin/                ← unchanged
    agents/                ← unchanged
    sessions/              ← unchanged
    config/                ← unchanged
    utils/                 ← unchanged
    setup/                 ← unchanged

    core.ts                ← decouple: ServiceRegistry only, no plugin imports
    channel.ts             ← IChannelAdapter interface (unchanged)
    types.ts               ← shared types + service interfaces (unchanged)
    message-transformer.ts ← decouple: optional tunnel via ServiceRegistry
    notification.ts        ← decouple: if needed
    security-guard.ts      ← remove (implementation in plugins/security/)

  cli/                     ← unchanged
  data/                    ← unchanged
  main.ts                  ← simplified: bootstrap + boot plugins only
  index.ts                 ← public API exports (update paths)
```

### Deleted Directories

| Directory | Reason |
|-----------|--------|
| `src/adapters/` | All content moved to `src/plugins/` or `src/core/adapter-primitives/` |
| `src/speech/` | Moved to `src/plugins/speech/` |
| `src/tunnel/` | Moved to `src/plugins/tunnel/` |

### Deleted Files

| File | Reason |
|------|--------|
| `src/core/plugin-manager.ts` | Legacy, replaced by PluginRegistry + CLI inline logic |
| `src/core/topic-manager.ts` | Moved to `src/plugins/telegram/topic-manager.ts` |
| `src/core/security-guard.ts` | If exists as separate file, now only in plugins/security/ |

---

## 2. Decouple Core from Plugin Imports

### Problem

6 core files import directly from plugin implementations:

| Core File | Plugin Imports | Count |
|-----------|---------------|-------|
| `core.ts` | SecurityGuard, FileService, SpeechService, NotificationManager, UsageStore, TunnelService, ContextManager | ~10 |
| `message-transformer.ts` | TunnelService, extractFileInfo | 2 |
| `session-bridge.ts` | SpeechService, FileService | 2 |
| `session-factory.ts` | SecurityGuard, FileService, NotificationManager, UsageStore | 4 |
| `agent-instance.ts` | FileService | 1 |
| `config-editor.ts` | validateBotToken, validateDiscordToken | 2 |

### Solution

Replace all plugin imports with ServiceRegistry lookups using typed interfaces from `src/core/plugin/types.ts`.

**Interfaces already defined:**
- `SecurityService` — checkAccess, checkSessionLimit, getUserRole
- `FileServiceInterface` — saveFile, resolveFile, readTextFileWithRange, convertOggToWav
- `NotificationService` — notify, notifyAll
- `UsageService` — trackUsage, checkBudget, getSummary
- `SpeechServiceInterface` — textToSpeech, speechToText
- `TunnelServiceInterface` — getPublicUrl, isConnected, start, stop
- `ContextService` — buildContext, registerProvider

**Pattern:**

```typescript
// BEFORE (core.ts)
import { SecurityGuard } from '../plugins/security/security-guard.js'
const guard = new SecurityGuard(config.security)
guard.checkAccess(userId)

// AFTER (core.ts)
import type { SecurityService } from './plugin/types.js'
const security = this.serviceRegistry.get<SecurityService>('security')
security?.checkAccess(userId)
```

### VibenCore Constructor Change

```typescript
// BEFORE
class VibenCore {
  constructor(opts: {
    configManager: ConfigManager
    securityGuard: SecurityGuard      // concrete class
    fileService: FileService          // concrete class
    notificationManager: NotificationManager  // concrete class
    speechService?: SpeechService     // concrete class
    tunnelService?: TunnelService     // concrete class
    // ... more concrete services
  })
}

// AFTER
class VibenCore {
  constructor(opts: {
    configManager: ConfigManager
    serviceRegistry: ServiceRegistry  // all services via registry
    lifecycleManager: LifecycleManager
    settingsManager: SettingsManager
    pluginRegistry: PluginRegistry
  })

  // Typed accessors (lazy lookup)
  get security(): SecurityService | undefined {
    return this.serviceRegistry.get<SecurityService>('security')
  }
  get fileService(): FileServiceInterface | undefined {
    return this.serviceRegistry.get<FileServiceInterface>('file-service')
  }
  // ...
}
```

### MessageTransformer Decouple

```typescript
// BEFORE
import { TunnelService } from '../plugins/tunnel/tunnel-service.js'
import { extractFileInfo } from '../plugins/tunnel/extract-file-info.js'

// AFTER — tunnel is optional, injected via constructor
class MessageTransformer {
  constructor(private serviceRegistry?: ServiceRegistry) {}

  transform(event: AgentEvent): OutgoingMessage {
    // ... normal transform ...
    const tunnel = this.serviceRegistry?.get<TunnelServiceInterface>('tunnel')
    if (tunnel) {
      this.enrichWithViewerLinks(message, tunnel)
    }
    return message
  }
}
```

### Config Editor Decouple

```typescript
// BEFORE
import { validateBotToken } from '../../plugins/telegram/validators.js'

// AFTER — validators are optional, config editor works without them
// Option 1: Lazy dynamic import (keeps file in plugin, loads on demand)
const validators = await import('../../plugins/telegram/validators.js').catch(() => null)
if (validators) await validators.validateBotToken(token)

// Option 2: Validation service via ServiceRegistry
// (overkill for this — use option 1)
```

---

## 3. Simplified main.ts Boot Flow

### Before (~300 lines)

```
startServer():
  daemon check
  config check → runSetup
  load config, init logger
  post-upgrade checks
  ───── HARDCODED SECTION (to be removed) ─────
  create SecurityGuard(config)
  create FileService(config)
  create NotificationManager(config)
  create UsageStore(config)
  create SpeechService(config)
  create TunnelService(config)
  create ContextManager(config)
  create TopicManager(config)
  create VibenCore(all services)
  create TelegramAdapter(core, config)
  core.registerAdapter('telegram', adapter)
  create DiscordAdapter(core, config) (dynamic)
  core.registerAdapter('discord', adapter)
  create SlackAdapter(core, config) (dynamic)
  core.registerAdapter('slack', adapter)
  create ApiServer(core, config)
  apiServer.start()
  ───── END HARDCODED ─────
  lifecycle.boot(corePlugins)
  signal handlers
```

### After (~150 lines)

```
startServer():
  daemon check
  config check → runSetup
  load config, init logger
  post-upgrade checks
  ───── INFRASTRUCTURE ─────
  create ServiceRegistry
  create MiddlewareChain
  create SettingsManager
  create PluginRegistry (load from plugins.json)
  create ErrorTracker
  create LifecycleManager(all infrastructure)
  create VibenCore(serviceRegistry, lifecycleManager, ...)
  ───── BOOT ─────
  import corePlugins
  lifecycle.boot(corePlugins)
  // ALL services created by plugin setup() hooks
  // ALL adapters registered by adapter plugin setup() hooks
  // ApiServer started by api-server plugin setup() hook
  ───── END ─────
  signal handlers
```

### Plugin setup() Responsibilities

Each plugin's `setup()` creates its service and registers it:

```typescript
// plugins/security/index.ts — setup()
async setup(ctx) {
  const config = ctx.pluginConfig
  const guard = new SecurityGuard(config)
  ctx.registerService('security', guard)
}

// plugins/telegram/index.ts — setup()
async setup(ctx) {
  const config = ctx.pluginConfig
  if (!config.botToken || !config.chatId) return

  const core = ctx.core as VibenCore
  const adapter = new TelegramAdapter(core, config)
  const topicManager = new TopicManager(...)
  await adapter.start()
  core.registerAdapter('telegram', adapter)
  ctx.registerService('adapter:telegram', adapter)
  ctx.registerService('topic-manager:telegram', topicManager)
}

// plugins/api-server/index.ts — setup()
async setup(ctx) {
  const core = ctx.core as VibenCore
  const apiServer = new ApiServer(core, config)
  ctx.registerService('api-server', apiServer)
  // Listen for system:ready to start
  ctx.on('system:ready', () => apiServer.start())
}
```

---

## 4. Implementation Strategy: Two Plans

### Plan A: Mechanical Moves

Pure file moves + import fixes. No logic changes. Build must pass after each step.

| Step | Action | Scope |
|------|--------|-------|
| 1 | Move `adapters/shared/` → `core/adapter-primitives/` | ~15 files, update imports in adapters |
| 2 | Move `adapters/telegram/` → `plugins/telegram/` | ~23 files, merge with existing plugin |
| 3 | Move `adapters/discord/` → `plugins/discord/` | ~15 files, merge with existing plugin |
| 4 | Move `adapters/slack/` → `plugins/slack/` | ~8 files, merge with existing plugin |
| 5 | Move `speech/` → `plugins/speech/` | ~8 files, merge with existing plugin |
| 6 | Move `tunnel/` → `plugins/tunnel/` | ~10 files, merge with existing plugin |
| 7 | Move `core/topic-manager.ts` → `plugins/telegram/` | ~3 files |
| 8 | Delete `src/adapters/` directory | cleanup |
| 9 | Delete `core/plugin-manager.ts`, inline in CLI | ~4 files |
| 10 | Update `src/index.ts` public exports | 1 file |
| 11 | Full import sweep — verify no broken references | all files |

**Safety:** Each step is independently revertable. Build verified after every step.

### Plan B: Logic Changes

Change actual behavior. Test-driven — write tests first for each decoupled module.

| Step | Action | Scope |
|------|--------|-------|
| 1 | Decouple `core.ts` — ServiceRegistry constructor, typed accessors | 1 file + tests |
| 2 | Decouple `message-transformer.ts` — optional tunnel via ServiceRegistry | 1 file + tests |
| 3 | Decouple `session-bridge.ts` — ServiceRegistry lookups | 1 file + tests |
| 4 | Decouple `session-factory.ts` — ServiceRegistry lookups | 1 file + tests |
| 5 | Decouple `config-editor.ts` — lazy dynamic imports for validators | 1 file |
| 6 | Simplify `main.ts` — remove hardcoded registrations | 1 file |
| 7 | Update adapter plugins `setup()` — self-register via core.registerAdapter() | 3 files |
| 8 | Ensure all plugins `registerService()` in setup() | 11 files |
| 9 | Boot flow integration tests | new test file |

**Safety:** Each step has tests. Existing tests must keep passing. Plan B only starts after Plan A is fully merged.

---

## 5. Risk Mitigation

### Import Path Breakage

- **Risk:** Moving ~80 files breaks import paths across the codebase
- **Mitigation:** Build verification after every move step. Use `pnpm build` as gate.

### Plugin Boot Order

- **Risk:** After decouple, core needs services that aren't registered yet
- **Mitigation:** LifecycleManager already handles dependency ordering via `pluginDependencies`. Adapter plugins declare dependency on security, file-service, etc.

### Backward Compatibility

- **Risk:** `src/index.ts` public API exports change paths
- **Mitigation:** Update barrel exports in `src/index.ts` to re-export from new locations. External consumers import from `@viben/kernel`, not deep paths.

### Test Coverage

- **Risk:** Moving files may break test imports
- **Mitigation:** Tests move WITH their source files. Run `pnpm test` after each step.

---

## 6. Testing Strategy

### Plan A (Mechanical Moves)

- No new tests needed — existing tests move with source files
- Verification: `pnpm build && pnpm test` after every step
- All 1790 tests must pass continuously

### Plan B (Logic Changes)

New tests needed for:

1. **Core ServiceRegistry integration** — core.ts uses services from registry
2. **MessageTransformer without tunnel** — graceful when tunnel service absent
3. **Boot flow** — all plugins register services, core finds them
4. **Disabled plugin** — core handles missing optional services gracefully

Existing tests updated:
- Core tests that mock services directly → mock ServiceRegistry instead
- Session tests that inject services → use ServiceRegistry pattern
