# Phase 2a Part 1: Folder Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure 44 flat core files into logical subdirectories, standardize test placement, split CLI commands file, and move speech service out of core.

**Architecture:** Pure mechanical file moves + import path updates. No logic changes. Each task moves a group of related files, updates ALL imports that reference them, and verifies build+tests pass.

**Tech Stack:** TypeScript ESM, all imports use `.js` extensions.

**Spec:** `docs/superpowers/specs/2026-03-26-phase2a-restructure-acp-core.md` Section 1

---

## Important Notes

- **ESM imports use `.js` extensions** — when updating import paths, always use `.js` not `.ts`
- **Use `git mv`** to preserve git history
- **After each task: `pnpm build && pnpm test`** — all 1581+ tests must pass
- **The order matters** — Task 1 (agents/) must come before later tasks because imports cascade
- **DO NOT change any logic** — only move files and update import paths

---

## Task 1: Move agent files to `core/agents/`

**Files:**
- Move: `src/core/agent-instance.ts` → `src/core/agents/agent-instance.ts`
- Move: `src/core/agent-catalog.ts` → `src/core/agents/agent-catalog.ts`
- Move: `src/core/agent-installer.ts` → `src/core/agents/agent-installer.ts`
- Move: `src/core/agent-dependencies.ts` → `src/core/agents/agent-dependencies.ts`
- Move: `src/core/agent-manager.ts` → `src/core/agents/agent-manager.ts`
- Move: `src/core/agent-registry.ts` → `src/core/agents/agent-registry.ts`
- Move: `src/core/agent-store.ts` → `src/core/agents/agent-store.ts`
- Move tests: `src/core/__tests__/agent-*.test.ts` → `src/core/agents/__tests__/`
- Move test: `src/core/__tests__/agent-instance-emitter.test.ts` → `src/core/agents/__tests__/`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/core/agents/__tests__
git mv src/core/agent-instance.ts src/core/agents/
git mv src/core/agent-catalog.ts src/core/agents/
git mv src/core/agent-installer.ts src/core/agents/
git mv src/core/agent-dependencies.ts src/core/agents/
git mv src/core/agent-manager.ts src/core/agents/
git mv src/core/agent-registry.ts src/core/agents/
git mv src/core/agent-store.ts src/core/agents/
git mv src/core/__tests__/agent-catalog.test.ts src/core/agents/__tests__/
git mv src/core/__tests__/agent-dependencies.test.ts src/core/agents/__tests__/
git mv src/core/__tests__/agent-installer.test.ts src/core/agents/__tests__/
git mv src/core/__tests__/agent-instance-emitter.test.ts src/core/agents/__tests__/
git mv src/core/__tests__/agent-manager.test.ts src/core/agents/__tests__/
git mv src/core/__tests__/agent-store.test.ts src/core/agents/__tests__/
git mv src/core/__tests__/agent-store-extended.test.ts src/core/agents/__tests__/
```

- [ ] **Step 2: Update all import paths**

Search the entire codebase for imports referencing the old paths. Update them:

```
# Pattern to search for (in all .ts files):
from "../../core/agent-instance.js"  →  from "../../core/agents/agent-instance.js"
from "./agent-instance.js"           →  from "./agents/agent-instance.js"
from "../agent-instance.js"          →  varies by location
# etc. for all 7 moved files
```

Key files that import agent modules:
- `src/core/core.ts` — imports agent-manager, agent-catalog, agent-registry, agent-store, agent-instance
- `src/core/session-factory.ts` → now `src/core/sessions/session-factory.ts` (moved later, fix relative path)
- `src/core/index.ts` — re-exports
- `src/main.ts` — may import agent-registry
- `src/adapters/*/adapter.ts` — may import agent types
- Test files — update test imports

CRITICAL: For files WITHIN `src/core/agents/`, imports to OTHER agent files change from `./agent-X.js` to just `./agent-X.js` (stays same). Imports to core root files (like `./types.js`) change to `../types.js`.

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move agent files to core/agents/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Move config files to `core/config/`

**Files:**
- Move: `src/core/config.ts` → `src/core/config/config.ts`
- Move: `src/core/config-registry.ts` → `src/core/config/config-registry.ts`
- Move: `src/core/config-editor.ts` → `src/core/config/config-editor.ts`
- Move: `src/core/config-migrations.ts` → `src/core/config/config-migrations.ts`
- Move tests: `src/core/__tests__/config-*.test.ts` → `src/core/config/__tests__/`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/core/config/__tests__
git mv src/core/config.ts src/core/config/
git mv src/core/config-registry.ts src/core/config/
git mv src/core/config-editor.ts src/core/config/
git mv src/core/config-migrations.ts src/core/config/
git mv src/core/__tests__/config-env-overrides.test.ts src/core/config/__tests__/
git mv src/core/__tests__/config-migrations.test.ts src/core/config/__tests__/
git mv src/core/__tests__/config-registry.test.ts src/core/config/__tests__/
git mv src/core/__tests__/config-registry-extended.test.ts src/core/config/__tests__/
```

- [ ] **Step 2: Update all import paths**

Search for imports referencing old config paths. Update them. Key consumers:
- `src/core/core.ts` — imports ConfigManager
- `src/core/index.ts` — re-exports
- `src/core/agents/agent-instance.ts` — may import config
- `src/adapters/*/adapter.ts` — import config types
- `src/core/setup/*.ts` — import config
- `src/main.ts` — imports config

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move config files to core/config/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Move session files to `core/sessions/`

**Files:**
- Move: `src/core/session.ts` → `src/core/sessions/session.ts`
- Move: `src/core/session-manager.ts` → `src/core/sessions/session-manager.ts`
- Move: `src/core/session-store.ts` → `src/core/sessions/session-store.ts`
- Move: `src/core/session-factory.ts` → `src/core/sessions/session-factory.ts`
- Move: `src/core/session-bridge.ts` → `src/core/sessions/session-bridge.ts`
- Move: `src/core/permission-gate.ts` → `src/core/sessions/permission-gate.ts`
- Move: `src/core/prompt-queue.ts` → `src/core/sessions/prompt-queue.ts`
- Move: `src/core/usage-budget.ts` → `src/core/sessions/usage-budget.ts`
- Move: `src/core/usage-store.ts` → `src/core/sessions/usage-store.ts`
- Move tests: `src/core/__tests__/session-*.test.ts`, `permission-gate*.test.ts`, `prompt-queue*.test.ts`, `usage-budget*.test.ts`, `create-session.test.ts` → `src/core/sessions/__tests__/`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/core/sessions/__tests__
git mv src/core/session.ts src/core/sessions/
git mv src/core/session-manager.ts src/core/sessions/
git mv src/core/session-store.ts src/core/sessions/
git mv src/core/session-factory.ts src/core/sessions/
git mv src/core/session-bridge.ts src/core/sessions/
git mv src/core/permission-gate.ts src/core/sessions/
git mv src/core/prompt-queue.ts src/core/sessions/
git mv src/core/usage-budget.ts src/core/sessions/
git mv src/core/usage-store.ts src/core/sessions/
# Move session tests
git mv src/core/__tests__/session-bridge.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-bridge-autoapprove.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-bridge-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-events.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-factory.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-factory-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-lifecycle.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-manager.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-manager-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-speech.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-state-machine.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-store-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/session-tts.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/create-session.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/permission-gate.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/permission-gate-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/permission-gate-extended.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/prompt-queue.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/prompt-queue-comprehensive.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/prompt-queue-extended.test.ts src/core/sessions/__tests__/
git mv src/core/__tests__/usage-budget-comprehensive.test.ts src/core/sessions/__tests__/
```

- [ ] **Step 2: Update all import paths**

This is the largest move. Key consumers:
- `src/core/core.ts` — imports session-manager, session-factory, session-bridge, session-store, usage-*
- `src/core/index.ts` — re-exports Session, SessionManager, etc.
- `src/core/agents/agent-instance.ts` — may import session types
- `src/adapters/*/adapter.ts` — import Session type
- `src/main.ts`

CRITICAL: Files within `src/core/sessions/` import each other AND files in `src/core/agents/`. Update relative paths accordingly:
- `session-factory.ts` imports `agent-instance.ts` → `../agents/agent-instance.js`
- `session-bridge.ts` imports `channel.ts` → `../channel.js`

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move session files to core/sessions/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Move utility files to `core/utils/`

**Files:**
- Move: `src/core/log.ts` → `src/core/utils/log.ts`
- Move: `src/core/typed-emitter.ts` → `src/core/utils/typed-emitter.ts`
- Move: `src/core/file-service.ts` → `src/core/utils/file-service.ts`
- Move: `src/core/streams.ts` → `src/core/utils/streams.ts`
- Move: `src/core/stderr-capture.ts` → `src/core/utils/stderr-capture.ts`
- Move: `src/core/install-binary.ts` → `src/core/utils/install-binary.ts`
- Move: `src/core/install-jq.ts` → `src/core/utils/install-jq.ts`
- Move tests: related test files → `src/core/utils/__tests__/`

- [ ] **Step 1: Create directory and move files**

```bash
mkdir -p src/core/utils/__tests__
git mv src/core/log.ts src/core/utils/
git mv src/core/typed-emitter.ts src/core/utils/
git mv src/core/file-service.ts src/core/utils/
git mv src/core/streams.ts src/core/utils/
git mv src/core/stderr-capture.ts src/core/utils/
git mv src/core/install-binary.ts src/core/utils/
git mv src/core/install-jq.ts src/core/utils/
git mv src/core/__tests__/typed-emitter.test.ts src/core/utils/__tests__/
git mv src/core/__tests__/typed-emitter-comprehensive.test.ts src/core/utils/__tests__/
git mv src/core/__tests__/streams.test.ts src/core/utils/__tests__/
git mv src/core/__tests__/stderr-capture.test.ts src/core/utils/__tests__/
git mv src/core/__tests__/file-service.test.ts src/core/utils/__tests__/
git mv src/core/__tests__/event-bus.test.ts src/core/utils/__tests__/
```

NOTE: `event-bus.ts` stays at core root (it's core infrastructure, not utility), but its test moves to utils/__tests__/ since it was in the flat __tests__. Actually — keep `event-bus.test.ts` in `src/core/__tests__/` since `event-bus.ts` stays at root. Only move tests for files that actually moved.

Correction: Do NOT move `event-bus.test.ts`. Only move tests for files in the move list.

- [ ] **Step 2: Update all import paths**

`log.ts` and `typed-emitter.ts` are imported by MANY files throughout the codebase. Use grep to find all:

```bash
grep -r "from.*['\"].*core/log" src/ --include="*.ts" -l
grep -r "from.*['\"].*core/typed-emitter" src/ --include="*.ts" -l
grep -r "from.*['\"].*core/file-service" src/ --include="*.ts" -l
# etc.
```

Update each import. Common patterns:
- `from "../../core/log.js"` → `from "../../core/utils/log.js"`
- `from "./log.js"` → `from "./utils/log.js"` (from core root)
- `from "../log.js"` → `from "../utils/log.js"` (from core subdirectory like agents/)

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move utility files to core/utils/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Move API files to `core/api/`

**Files:**
- Move: `src/core/api-client.ts` → `src/core/api/api-client.ts`
- Move: `src/core/api-server.ts` → `src/core/api/api-server.ts`
- Move: `src/core/sse-manager.ts` → `src/core/api/sse-manager.ts`
- Move: `src/core/static-server.ts` → `src/core/api/static-server.ts`
- Move test: `src/core/__tests__/api-router.test.ts` → `src/core/api/__tests__/`

Note: `src/core/api/` directory already exists with `index.ts`, `router.ts`, `middleware.ts`, `routes/`. We're moving additional API files into it.

- [ ] **Step 1: Move files**

```bash
mkdir -p src/core/api/__tests__
git mv src/core/api-client.ts src/core/api/
git mv src/core/api-server.ts src/core/api/
git mv src/core/sse-manager.ts src/core/api/
git mv src/core/static-server.ts src/core/api/
git mv src/core/__tests__/api-router.test.ts src/core/api/__tests__/
```

- [ ] **Step 2: Update all import paths**

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move API files into core/api/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Move speech service to `src/speech/`

**Files:**
- Move: `src/core/speech/*` → `src/speech/`
- Move tests: `src/core/__tests__/speech-service*.test.ts`, `edge-tts-provider.test.ts`, `groq-provider.test.ts` → `src/speech/__tests__/`

- [ ] **Step 1: Move files**

```bash
mkdir -p src/speech/__tests__
# Move the speech directory contents
git mv src/core/speech/speech-service.ts src/speech/
git mv src/core/speech/types.ts src/speech/
git mv src/core/speech/index.ts src/speech/
git mv src/core/speech/providers src/speech/
# Move tests
git mv src/core/__tests__/speech-service.test.ts src/speech/__tests__/
git mv src/core/__tests__/speech-service-tts.test.ts src/speech/__tests__/
git mv src/core/__tests__/edge-tts-provider.test.ts src/speech/__tests__/
git mv src/core/__tests__/groq-provider.test.ts src/speech/__tests__/
# Remove empty directory
rmdir src/core/speech 2>/dev/null || true
```

- [ ] **Step 2: Update all import paths**

Speech is imported by:
- `src/core/core.ts` — imports SpeechService
- `src/core/index.ts` — re-exports
- `src/core/sessions/session.ts` — may import speech types
- Test files

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move speech service from core/speech/ to src/speech/

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Move CLI lifecycle files + move product-guide

**Files:**
- Move: `src/core/daemon.ts` → `src/cli/daemon.ts`
- Move: `src/core/autostart.ts` → `src/cli/autostart.ts`
- Move: `src/core/post-upgrade.ts` → `src/cli/post-upgrade.ts`
- Move: `src/product-guide.ts` → `src/data/product-guide.ts`

- [ ] **Step 1: Move files**

```bash
mkdir -p src/data
git mv src/core/daemon.ts src/cli/
git mv src/core/autostart.ts src/cli/
git mv src/core/post-upgrade.ts src/cli/
git mv src/product-guide.ts src/data/
```

- [ ] **Step 2: Update all import paths**

These files are primarily imported by CLI commands and main.ts.

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move CLI lifecycle files and product-guide to proper locations

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Standardize test file placement

Move all co-located test files into `__tests__/` subdirectories.

**Files:**
- Move: `src/adapters/slack/*.test.ts` (9 files) → `src/adapters/slack/__tests__/`
- Move: `src/adapters/telegram/formatting.test.ts`, `formatting-extended.test.ts`, `activity.test.ts` → `src/adapters/telegram/__tests__/`
- Move: `src/adapters/discord/formatting.test.ts`, `media.test.ts` → `src/adapters/discord/__tests__/`
- Move: `src/adapters/shared/message-formatter.test.ts`, `message-dispatcher.test.ts`, `format-utils.test.ts` → `src/adapters/shared/__tests__/`
- Move remaining `src/core/__tests__/` tests to appropriate subdirectories

- [ ] **Step 1: Move adapter test files**

```bash
# Slack (9 test files)
mkdir -p src/adapters/slack/__tests__
git mv src/adapters/slack/adapter-lifecycle.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/channel-manager.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/event-router.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/formatter.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/permission-handler.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/send-queue.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/slack-voice.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/slug.test.ts src/adapters/slack/__tests__/
git mv src/adapters/slack/text-buffer.test.ts src/adapters/slack/__tests__/

# Telegram (3 test files) — __tests__/ already exists from commands/__tests__/
mkdir -p src/adapters/telegram/__tests__
git mv src/adapters/telegram/formatting.test.ts src/adapters/telegram/__tests__/
git mv src/adapters/telegram/formatting-extended.test.ts src/adapters/telegram/__tests__/
git mv src/adapters/telegram/activity.test.ts src/adapters/telegram/__tests__/

# Discord (2 test files)
mkdir -p src/adapters/discord/__tests__
git mv src/adapters/discord/formatting.test.ts src/adapters/discord/__tests__/
git mv src/adapters/discord/media.test.ts src/adapters/discord/__tests__/

# Shared (3 test files) — __tests__/ already exists
git mv src/adapters/shared/message-formatter.test.ts src/adapters/shared/__tests__/
git mv src/adapters/shared/message-dispatcher.test.ts src/adapters/shared/__tests__/
git mv src/adapters/shared/format-utils.test.ts src/adapters/shared/__tests__/
```

- [ ] **Step 2: Move remaining core tests to subdirectories**

Tests still in `src/core/__tests__/` after previous tasks should be moved to the subdirectory matching the module they test:

```bash
# Core orchestrator tests stay in core/__tests__/
# (core-orchestrator.test.ts, core-orchestrator-comprehensive.test.ts)

# Message transformer tests stay in core/__tests__/
# (message-transformer.test.ts, message-transformer-extended.test.ts)

# Notification test stays in core/__tests__/
# (notification.test.ts)

# Security guard tests stay in core/__tests__/
# (security-guard.test.ts, security-guard-comprehensive.test.ts)
```

These files test modules that stayed at `src/core/` root, so they stay in `src/core/__tests__/`.

- [ ] **Step 3: Update test file imports**

Test files that moved need their import paths updated. Typically:
- `from '../foo.js'` → `from '../foo.js'` (if source also moved to same subdirectory)
- `from './foo.js'` → `from '../foo.js'` (if test moved to `__tests__/` but source stayed)

- [ ] **Step 4: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: standardize all test files into __tests__/ subdirectories

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Update `src/core/index.ts` public API exports

After all moves, the barrel export needs to be updated to re-export from new paths.

- [ ] **Step 1: Read current `src/core/index.ts`**

- [ ] **Step 2: Update all re-export paths**

```typescript
// Example changes:
export { ConfigManager } from './config/config.js'
export { Session } from './sessions/session.js'
export { SessionManager } from './sessions/session-manager.js'
export { AgentInstance } from './agents/agent-instance.js'
// etc.
```

- [ ] **Step 3: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add src/core/index.ts
git commit -m "refactor: update core/index.ts barrel exports for new file structure

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Split `cli/commands.ts` (1873 lines)

**Files:**
- Modify: `src/cli/commands.ts` → split into `src/cli/commands/` directory
- Create: `src/cli/commands/start.ts`
- Create: `src/cli/commands/install.ts`
- Create: `src/cli/commands/uninstall.ts`
- Create: `src/cli/commands/agents.ts`
- Create: `src/cli/commands/plugins.ts`
- Create: `src/cli/commands/doctor.ts`
- Create: `src/cli/commands/setup.ts`
- Create: `src/cli/commands/index.ts` (router + barrel)

- [ ] **Step 1: Read current commands.ts to understand structure**

Read the full file, identify each command handler and its boundaries.

- [ ] **Step 2: Create command files**

Extract each command's handler function into its own file. The `index.ts` barrel file should contain the main `run()` function that parses args and dispatches to the appropriate command.

- [ ] **Step 3: Update imports in cli/index.ts (or cli.ts)**

The CLI entry point should import from the new `commands/index.js`.

- [ ] **Step 4: Delete old commands.ts**

```bash
rm src/cli/commands.ts
```

- [ ] **Step 5: Build and test**

Run: `pnpm build && pnpm test`
Expected: ALL pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: split cli/commands.ts (1873 lines) into per-command files

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final verification

- [ ] **Step 1: Full build**

Run: `pnpm build`

- [ ] **Step 2: Full test suite**

Run: `pnpm test`

- [ ] **Step 3: Publish build**

Run: `pnpm build:publish`

- [ ] **Step 4: Verify no leftover files in old locations**

```bash
ls src/core/*.ts | grep -v -E "(core|channel|types|notification|security-guard|message-transformer|topic-manager|event-bus|plugin-manager|index)\.ts$"
```

Should return nothing — all non-root files should have been moved.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "refactor: folder restructure Phase 2a Part 1 complete

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files moved | Risk |
|------|-------------|-------------|------|
| 1 | agents/ | 7 source + 7 tests | Medium (many importers) |
| 2 | config/ | 4 source + 4 tests | Medium |
| 3 | sessions/ | 9 source + 22 tests | High (most imported) |
| 4 | utils/ | 7 source + 5 tests | High (log.ts used everywhere) |
| 5 | api/ | 4 source + 1 test | Low |
| 6 | speech/ | 4 source + 4 tests | Low |
| 7 | CLI lifecycle + data | 4 files | Low |
| 8 | Test standardization | ~17 test files | Low (only test imports) |
| 9 | index.ts update | 1 file | Low |
| 10 | CLI split | 1 → ~8 files | Medium |
| 11 | Final verification | 0 | None |
