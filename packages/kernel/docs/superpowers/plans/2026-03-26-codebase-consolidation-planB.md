# Codebase Consolidation Plan B: Decouple Core + Simplify main.ts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all runtime imports from `src/core/` to `src/plugins/`. Simplify main.ts to only bootstrap + boot plugins. Core accesses services via ServiceRegistry only.

**Architecture:** Core files use `import type` for plugin types (compile-time only, no runtime dependency). Runtime service access is via ServiceRegistry lazy getters (already partially implemented in core.ts). main.ts delegates all service creation to plugin setup() hooks.

**Tech Stack:** TypeScript strict, ESM-only (.js imports), Vitest

---

## Current State After Plan A

Core already uses lazy ServiceRegistry getters for most services. Remaining issues:

| File | Issue | Fix |
|------|-------|-----|
| `core.ts` lines 133-151 | Direct import of GroqSTT, EdgeTTS for hot-reload | Move speech re-registration to speech plugin |
| `message-transformer.ts` line 3 | Direct import `extractFileInfo` from tunnel plugin | Move function to core or access via ServiceRegistry |
| `session-bridge.ts` line 8 | Direct import `FileService` (used as type only) | Change to `import type` |
| `agent-instance.ts` line 24 | Direct import `FileService` (unused?) | Remove if unused, else `import type` |
| `config-editor.ts` lines 29-30 | Direct import validators from telegram/discord plugins | Lazy dynamic import |
| `core/index.ts` | Re-exports plugin implementations | Update to re-export from new plugin locations |
| `main.ts` | Hardcoded adapter/api/tunnel instantiation | Remove, let plugins handle in setup() |

---

## Task 1: Convert Direct Imports to `import type`

**Files:**
- Modify: `src/core/sessions/session-bridge.ts`
- Modify: `src/core/agents/agent-instance.ts`
- Modify: `src/core/sessions/session-factory.ts`
- Modify: `src/core/sessions/session.ts`

- [ ] **Step 1: Fix session-bridge.ts**

Change line 8 from:
```typescript
import { FileService } from "../../plugins/file-service/file-service.js"
```
To:
```typescript
import type { FileServiceInterface } from "../plugin/types.js"
```

Update the `BridgeDeps` interface to use `FileServiceInterface` instead of `FileService`.

- [ ] **Step 2: Fix agent-instance.ts**

Check if `FileService` import (line 24) is actually used at runtime. If only as type, change to `import type`. If unused, remove entirely.

- [ ] **Step 3: Fix session-factory.ts**

All 5 imports (lines 4, 6-9) are already `import type`. Verify they compile correctly. If any are runtime imports, convert to `import type` and use ServiceRegistry interfaces from `types.ts` instead.

- [ ] **Step 4: Fix session.ts**

Import (line 8) is already `import type`. Verify. Replace with interface from `types.ts` if possible.

- [ ] **Step 5: Verify build**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: convert plugin imports to import type in core session files

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Decouple message-transformer.ts from Tunnel

**Files:**
- Modify: `src/core/message-transformer.ts`

- [ ] **Step 1: Read current message-transformer.ts**

Understand how `extractFileInfo` and `TunnelService` are used.

- [ ] **Step 2: Remove direct import of extractFileInfo**

The `extractFileInfo` function is a utility that parses file paths from tool call arguments. Two options:

**Option A:** Move `extractFileInfo` to `src/core/utils/` (it's a pure function, no tunnel dependency)
**Option B:** Access via tunnel service: `tunnel.extractFileInfo()`

Choose Option A — it's a pure utility function.

- [ ] **Step 3: Move extractFileInfo to core/utils/**

Create `src/core/utils/extract-file-info.ts` with the function moved from `src/plugins/tunnel/extract-file-info.ts`. Keep the original in tunnel plugin for backward compat (re-export from core).

- [ ] **Step 4: Update message-transformer.ts imports**

```typescript
// BEFORE
import type { TunnelService } from "../plugins/tunnel/tunnel-service.js"
import { extractFileInfo } from "../plugins/tunnel/extract-file-info.js"

// AFTER
import type { TunnelServiceInterface } from "./plugin/types.js"
import { extractFileInfo } from "./utils/extract-file-info.js"
```

TunnelService access: already via constructor param or ServiceRegistry — just change the type import.

- [ ] **Step 5: Verify build + tests**

```bash
pnpm build && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: decouple message-transformer from tunnel plugin imports

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Decouple core.ts Speech Hot-Reload

**Files:**
- Modify: `src/core/core.ts`
- Modify: `src/plugins/speech/index.ts`

- [ ] **Step 1: Read core.ts lines 133-151**

This code directly imports `GroqSTT` and `EdgeTTS` to re-register speech providers on config change.

- [ ] **Step 2: Move hot-reload logic to speech plugin**

Instead of core.ts importing speech provider classes, the speech plugin should:
1. Listen for `config:changed` event in its setup()
2. Handle its own re-registration when speech config changes

In core.ts, replace the direct speech re-registration with an event emit:

```typescript
// BEFORE (core.ts)
import { GroqSTT } from "../plugins/speech/exports.js"
import { EdgeTTS } from "../plugins/speech/exports.js"
// ... later in handleConfigChange:
this.speechService?.registerProviders(new GroqSTT(newConfig), new EdgeTTS())

// AFTER (core.ts)
// No speech imports at all
// ... later in handleConfigChange:
this.eventBus?.emit('config:changed', { path: 'speech', value: newConfig })
// Speech plugin handles its own re-registration
```

- [ ] **Step 3: Update speech plugin to handle config changes**

In `src/plugins/speech/index.ts` setup():
```typescript
ctx.on('config:changed', (event) => {
  if (event.path?.startsWith('speech')) {
    // Re-register providers with new config
    speechService.registerProviders(new GroqSTT(newConfig), new EdgeTTS())
  }
})
```

- [ ] **Step 4: Remove all speech imports from core.ts**

After moving hot-reload to plugin, core.ts should have ZERO imports from speech plugin. Only `import type { SpeechServiceInterface }` from types.ts if needed.

- [ ] **Step 5: Verify build + tests**

```bash
pnpm build && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor: move speech hot-reload to speech plugin, decouple from core

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Decouple config-editor.ts

**Files:**
- Modify: `src/core/config/config-editor.ts`

- [ ] **Step 1: Replace direct validator imports with lazy dynamic imports**

```typescript
// BEFORE
import { validateBotToken, validateChatId } from '../../plugins/telegram/validators.js'
import { validateDiscordToken } from '../../plugins/discord/validators.js'

// AFTER — lazy dynamic import, only loads when needed
async function loadTelegramValidators() {
  try {
    return await import('../../plugins/telegram/validators.js')
  } catch {
    return null
  }
}

async function loadDiscordValidators() {
  try {
    return await import('../../plugins/discord/validators.js')
  } catch {
    return null
  }
}
```

Then in validation callbacks:
```typescript
const validators = await loadTelegramValidators()
if (validators) {
  const result = await validators.validateBotToken(token)
  // ...
}
```

This is NOT a type-only change — validators are runtime functions. But lazy dynamic import means config-editor doesn't REQUIRE plugins to be present at module load time.

- [ ] **Step 2: Verify build + tests**

```bash
pnpm build && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "refactor: lazy-load plugin validators in config-editor

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Simplify main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Read current main.ts fully**

Understand all hardcoded service/adapter instantiation.

- [ ] **Step 2: Remove hardcoded adapter registration**

Remove direct instantiation of TelegramAdapter, DiscordAdapter, SlackAdapter. These are created by their plugin setup() hooks.

Remove:
```typescript
import { TelegramAdapter } from './plugins/telegram/adapter.js'
import type { TelegramChannelConfig } from './plugins/telegram/types.js'
// ... later:
const adapter = new TelegramAdapter(core, config.channels.telegram)
core.registerAdapter('telegram', adapter)
```

Adapter plugins already do this in their `setup()`:
```typescript
// plugins/telegram/index.ts setup()
const adapter = new TelegramAdapter(ctx.core, config)
ctx.core.registerAdapter('telegram', adapter)
```

- [ ] **Step 3: Remove hardcoded ApiServer instantiation**

Remove direct `new ApiServer(...)`. This is handled by api-server plugin setup().

- [ ] **Step 4: Remove hardcoded TunnelService instantiation**

Remove direct `new TunnelService(...)`. This is handled by tunnel plugin setup().

- [ ] **Step 5: Remove hardcoded TopicManager instantiation**

Remove direct `new TopicManager(...)`. This is handled by telegram plugin setup().

- [ ] **Step 6: Ensure VibenCore receives ServiceRegistry**

Update VibenCore constructor call to pass serviceRegistry instead of individual services (if not already done).

- [ ] **Step 7: Verify boot order**

After removing hardcoded registrations, verify that plugins boot in the right order:
1. security, file-service, notifications (no deps)
2. usage, speech, context, tunnel (may depend on file-service)
3. adapters (depend on security, file-service)
4. api-server (depends on everything)

Check `pluginDependencies` in each plugin to ensure correct ordering.

- [ ] **Step 8: Verify build + ALL tests**

```bash
pnpm build && pnpm test
```

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "refactor: simplify main.ts — delegate all service creation to plugins

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Clean Up core/index.ts Re-Exports

**Files:**
- Modify: `src/core/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Update core/index.ts**

Remove re-exports of plugin implementation classes. Keep only:
- Core types and interfaces
- Core classes (VibenCore, Session, AgentInstance, etc.)
- Core utilities (log, typed-emitter, etc.)
- Plugin infrastructure (PluginContext, ServiceRegistry, etc.)

Plugin classes should be imported from `src/plugins/` directly by consumers, not through core.

- [ ] **Step 2: Update src/index.ts**

Update public API exports to reference plugins directly where needed.

- [ ] **Step 3: Verify build + publish**

```bash
pnpm build && pnpm build:publish && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor: clean up core/index.ts re-exports, remove plugin class re-exports

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Verify + Push

- [ ] **Step 1: Full verification**

```bash
pnpm build && pnpm build:publish && pnpm test
```

- [ ] **Step 2: Verify no remaining plugin imports in core**

```bash
grep -r "from.*plugins/" src/core/ --include="*.ts" | grep -v "import type" | grep -v "__tests__"
```

Should return ZERO results (only `import type` allowed).

- [ ] **Step 3: Push**

```bash
git push
```
