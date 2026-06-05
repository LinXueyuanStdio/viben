# Phase 2b Part 3: Move Source Code Into Plugins

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all built-in plugin source code from scattered locations (`src/core/`, `src/speech/`, `src/tunnel/`) into `src/plugins/{name}/`, so each plugin is self-contained. Plugin wrappers (`index.ts`) import from local files, not from `../../core/`.

**Architecture:** Same pattern as Phase 2a folder restructure — `git mv` files, update ALL import paths, verify build+tests after each move. Each task moves one plugin's source files.

**Tech Stack:** TypeScript ESM. All imports use `.js` extension.

---

## Move Plan

| Plugin | From | To | Files |
|--------|------|----|-------|
| security | `src/core/security-guard.ts` | `src/plugins/security/security-guard.ts` | 1 source + tests |
| notifications | `src/core/notification.ts` | `src/plugins/notifications/notification.ts` | 1 source + tests |
| file-service | `src/core/utils/file-service.ts` | `src/plugins/file-service/file-service.ts` | 1 source + tests |
| context | `src/core/context/*` | `src/plugins/context/` | 7 source + tests |
| speech | `src/speech/*` | `src/plugins/speech/` | 5 source + tests |
| tunnel | `src/tunnel/*` | `src/plugins/tunnel/` | 14 source |
| usage | `src/core/sessions/usage-budget.ts` + `usage-store.ts` | `src/plugins/usage/` | 2 source + tests |

**IMPORTANT RULES:**
- Use `git mv` to preserve history
- After EACH task: `pnpm build && pnpm test` — all 1726 tests must pass
- Update the plugin's `index.ts` to import from local path (e.g., `./security-guard.js` instead of `../../core/security-guard.js`)
- Update ALL other files that import the moved module
- ESM: all imports use `.js` extension

---

## Task 1: Move security-guard.ts

**Move:**
```bash
git mv src/core/security-guard.ts src/plugins/security/
git mv src/core/__tests__/security-guard.test.ts src/plugins/security/__tests__/ 2>/dev/null
git mv src/core/__tests__/security-guard-comprehensive.test.ts src/plugins/security/__tests__/ 2>/dev/null
```

**Update imports:**
- `src/plugins/security/index.ts`: `from '../../core/security-guard.js'` → `from './security-guard.js'`
- `src/core/core.ts`: if still imports SecurityGuard type → update path
- `src/core/index.ts`: update re-export path
- Any test files that import SecurityGuard
- `src/plugins/security/security-guard.ts` internal imports: `./config/config.js` → `../../core/config/config.js` etc.

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move security-guard.ts into src/plugins/security/"
```

---

## Task 2: Move notification.ts

**Move:**
```bash
git mv src/core/notification.ts src/plugins/notifications/
git mv src/core/__tests__/notification.test.ts src/plugins/notifications/__tests__/ 2>/dev/null
```

**Update imports** in:
- `src/plugins/notifications/index.ts`
- `src/core/core.ts` (type import)
- `src/core/index.ts`
- `src/core/sessions/session-bridge.ts`
- Test files

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move notification.ts into src/plugins/notifications/"
```

---

## Task 3: Move file-service.ts

**Move:**
```bash
mkdir -p src/plugins/file-service/__tests__
git mv src/core/utils/file-service.ts src/plugins/file-service/
git mv src/core/utils/__tests__/file-service.test.ts src/plugins/file-service/__tests__/ 2>/dev/null
git mv src/core/utils/__tests__/file-service-lines.test.ts src/plugins/file-service/__tests__/ 2>/dev/null
```

**Update imports** in:
- `src/plugins/file-service/index.ts`
- `src/core/core.ts`
- `src/core/index.ts`
- `src/core/sessions/session-bridge.ts`
- `src/core/agents/agent-instance.ts` (static method `FileService.readTextFileWithRange`)
- Test files

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move file-service.ts into src/plugins/file-service/"
```

---

## Task 4: Move context/ directory

**Move:**
```bash
# Move all context source files
git mv src/core/context/context-manager.ts src/plugins/context/
git mv src/core/context/context-provider.ts src/plugins/context/
git mv src/core/context/context-cache.ts src/plugins/context/
git mv src/core/context/entire src/plugins/context/
# Move tests
mkdir -p src/plugins/context/__tests__
git mv src/core/context/__tests__/* src/plugins/context/__tests__/ 2>/dev/null
rmdir src/core/context/__tests__ src/core/context 2>/dev/null
```

**Update imports** in:
- `src/plugins/context/index.ts`
- `src/core/core.ts`
- `src/core/index.ts`
- Internal imports within context files (context-manager imports context-provider, etc.)
- Test files

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move context/ into src/plugins/context/"
```

---

## Task 5: Move speech/ directory

**Move:**
```bash
# Speech is already at src/speech/ — move into src/plugins/speech/
git mv src/speech/speech-service.ts src/plugins/speech/
git mv src/speech/types.ts src/plugins/speech/
git mv src/speech/index.ts src/plugins/speech/speech-index.ts  # rename to avoid conflict with plugin index.ts
git mv src/speech/providers src/plugins/speech/
# Move tests
mkdir -p src/plugins/speech/__tests__
git mv src/speech/__tests__/* src/plugins/speech/__tests__/ 2>/dev/null
rmdir src/speech/__tests__ src/speech 2>/dev/null
```

NOTE: `src/speech/index.ts` conflicts with `src/plugins/speech/index.ts` (the plugin wrapper). Options:
- Rename speech barrel to `speech-exports.ts` or merge it into the plugin index.ts
- Or: keep speech barrel as `src/plugins/speech/speech-index.ts` and update the plugin wrapper to import from `./speech-index.js`

**Update imports** in:
- `src/plugins/speech/index.ts` — update to local imports
- `src/core/core.ts` — type import path
- `src/core/index.ts` — re-export path
- `src/core/sessions/session.ts` — speech types
- Internal imports within speech files
- Test files

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move speech/ into src/plugins/speech/"
```

---

## Task 6: Move tunnel/ directory

**Move:**
```bash
# Tunnel is at src/tunnel/ — move contents into src/plugins/tunnel/
git mv src/tunnel/tunnel-service.ts src/plugins/tunnel/
git mv src/tunnel/tunnel-registry.ts src/plugins/tunnel/
git mv src/tunnel/provider.ts src/plugins/tunnel/
git mv src/tunnel/server.ts src/plugins/tunnel/
git mv src/tunnel/viewer-store.ts src/plugins/tunnel/
git mv src/tunnel/extract-file-info.ts src/plugins/tunnel/
git mv src/tunnel/index.ts src/plugins/tunnel/tunnel-index.ts  # avoid conflict
git mv src/tunnel/providers src/plugins/tunnel/
git mv src/tunnel/templates src/plugins/tunnel/
rmdir src/tunnel 2>/dev/null
```

**Update imports** in:
- `src/plugins/tunnel/index.ts` — update to local imports
- `src/core/core.ts` — TunnelService type
- `src/core/message-transformer.ts` — imports tunnel types
- `src/main.ts` — if still imports from tunnel
- Internal imports within tunnel files
- CLI commands that reference tunnel

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move tunnel/ into src/plugins/tunnel/"
```

---

## Task 7: Move usage files

**Move:**
```bash
mkdir -p src/plugins/usage/__tests__
git mv src/core/sessions/usage-budget.ts src/plugins/usage/
git mv src/core/sessions/usage-store.ts src/plugins/usage/
git mv src/core/sessions/__tests__/usage-budget-comprehensive.test.ts src/plugins/usage/__tests__/ 2>/dev/null
```

**Update imports** in:
- `src/plugins/usage/index.ts`
- `src/core/core.ts`
- `src/core/index.ts`
- `src/core/sessions/session-factory.ts`
- Internal imports (usage-budget imports usage-store)
- Test files

```bash
pnpm build && pnpm test
git add -A && git commit -m "refactor(plugins): move usage files into src/plugins/usage/"
```

---

## Task 8: Update core/index.ts + cleanup empty dirs

After all moves, update `src/core/index.ts` to re-export from new plugin paths.

Also clean up empty directories:
```bash
rmdir src/core/context 2>/dev/null
rmdir src/speech 2>/dev/null
rmdir src/tunnel 2>/dev/null
```

Verify no stale re-exports:
```bash
pnpm build && pnpm test && pnpm build:publish
```

```bash
git add -A && git commit -m "refactor: update core/index.ts exports for plugin source locations"
```

---

## Task 9: Final verification + push

```bash
pnpm build && pnpm test && pnpm build:publish && git push
```

Verify each plugin directory is self-contained:
```bash
ls src/plugins/security/     # security-guard.ts + index.ts + __tests__/
ls src/plugins/notifications/ # notification.ts + index.ts + __tests__/
ls src/plugins/file-service/  # file-service.ts + index.ts + __tests__/
ls src/plugins/context/       # context-manager.ts, context-provider.ts, entire/, index.ts, __tests__/
ls src/plugins/speech/        # speech-service.ts, providers/, types.ts, index.ts, __tests__/
ls src/plugins/tunnel/        # tunnel-service.ts, providers/, templates/, index.ts
ls src/plugins/usage/         # usage-budget.ts, usage-store.ts, index.ts, __tests__/
```

---

## Summary

| Task | Plugin | Files moved | Risk |
|------|--------|-------------|------|
| 1 | security | 1 + tests | Low |
| 2 | notifications | 1 + tests | Low |
| 3 | file-service | 1 + tests | Medium (widely imported) |
| 4 | context | 7 + tests | Medium |
| 5 | speech | 5 + tests | Medium (internal imports) |
| 6 | tunnel | 14 files | High (most files) |
| 7 | usage | 2 + tests | Low |
| 8 | index.ts update | 1 | Low |
| 9 | Verification | 0 | None |
