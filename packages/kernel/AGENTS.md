# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
pnpm install            # Install dependencies
pnpm build              # TypeScript compile (tsc)
pnpm build:publish      # Bundle for npm publish (tsup → dist-publish/)
pnpm start              # Run: node dist/cli.js
pnpm dev                # Watch mode (tsc --watch)
pnpm test               # Run tests (vitest)
```

## Architecture

Viben bridges AI coding agents to messaging platforms via the Agent Client Protocol (ACP). The flow:

```
User (Telegram) → ChannelAdapter → VibenCore → Session → AgentInstance (ACP subprocess)
```

### Project Layout

```
src/
  cli.ts              — CLI entry (start, install, uninstall, plugins, --version, --help)
  main.ts             — Server startup, plugin boot
  index.ts            — Public API exports
  core/               — Core modules
    config/           — Zod-validated config, migrations, editor
    agents/           — Agent instance, catalog, installer, store
    sessions/         — Session, session-manager, session-bridge, permission-gate
    plugin/           — Plugin infrastructure (LifecycleManager, ServiceRegistry, MiddlewareChain, PluginContext)
    commands/         — System chat commands (session, agents, admin, help, menu)
    adapter-primitives/ — Shared adapter framework (MessagingAdapter, StreamAdapter, SendQueue, etc.)
    utils/            — Logger, typed-emitter, file utilities
    setup/            — First-run setup wizard
  plugins/            — All plugins (adapters + services)
    telegram/         — Telegram adapter (grammY)
    speech/           — TTS/STT (Edge TTS, Groq STT)
    tunnel/           — Port forwarding (Cloudflare, ngrok, Bore, Tailscale)
    security/         — Access control, rate limiting
    usage/            — Cost tracking, budget
    api-server/       — REST API + SSE
    file-service/     — File I/O for agents
    notifications/    — Cross-session alerts
    context/          — Conversation history
  cli/
    commands/         — CLI commands (start, plugins, dev, etc.)
    plugin-template/  — Scaffold templates for `viben plugin create`
  ../kernel-sdk/      — @viben/plugin-sdk (types + testing utilities)
```

### Core Abstractions

**VibenCore** (`core.ts`) — Registers adapters, routes messages, creates sessions, wires agent events to adapters. Accesses services via ServiceRegistry.

**Session** (`session.ts`) — Wraps an AgentInstance with a prompt queue (serial processing), auto-naming, and lifecycle management.

**AgentInstance** (`agent-instance.ts`) — Spawns agent subprocess, implements full ACP Client interface. Converts ACP events to AgentEvent types.

**LifecycleManager** (`plugin/lifecycle-manager.ts`) — Boots plugins in dependency order (topo-sort), manages setup/teardown, handles version migration.

**ServiceRegistry** (`plugin/service-registry.ts`) — Central service discovery. Plugins register services, core accesses them via typed interfaces.

**CommandRegistry** (`command-registry.ts`) — Central command registry for chat commands. System and plugin commands registered here, adapters dispatch via generic handler.

**PluginContext** (`plugin/plugin-context.ts`) — Scoped API for plugins: events, services, middleware, commands, storage, logging.

### Plugin System

All features are plugins. Core only provides infrastructure (ServiceRegistry, MiddlewareChain, EventBus, LifecycleManager). Plugins register services, commands, and middleware in their `setup()` hook.

- 19 middleware hook points (message:incoming, agent:beforePrompt, permission:beforeRequest, etc.)
- 9 permission types (events:read, services:register, commands:register, etc.)
- Per-plugin settings via SettingsManager (~/.viben/plugins/<name>/settings.json)

### Adapter Patterns

- **Topics** (Telegram): Each session gets its own topic
- **Callback routing**: Permission buttons use `p:` prefix, command buttons use `c/` prefix
- **Response renderers**: Adapters render CommandResponse types (text, menu, list, confirm, error, silent) per platform

## npm Publishing

Published as `@viben/kernel` on npm. Users install with `npm install -g @viben/kernel`.

- `pnpm build:publish` bundles CLI via tsup + builds SDK via tsc
- GitHub Action auto-publishes both `@viben/kernel` and `@viben/plugin-sdk` on tag push (`v*`)
- Plugin system: `viben plugin install <name>` installs from npm to `~/.viben/plugins/`

## Documentation Sync

When changing code, **you must update corresponding docs** to keep code and documentation in sync:

- **New features**: Must update README and `docs/` (GitBook) to describe the feature, usage, and config if applicable.
- **Feature updates**: Update related docs to reflect changes.
- **Bug fixes**: Update docs if the bug relates to documented behavior. Not required if docs are still accurate.
- **General rule**: Do not merge code without updating docs for new features or changes. README is for users, `docs/` is for both users and contributors.
- **Plugin Template Sync**: When changing plugin API, architecture, PluginContext, CommandDef, middleware hooks, permissions, or anything affecting how plugins are written → **must update plugin template** at `src/cli/plugin-template/` (especially `claude-md.ts` and `plugin-guide.ts`) so templates always reflect the current API. These templates are the primary reference for both AI agents and plugin developers.

## Error Handling

- **Never silently ignore errors.** Every failed operation must surface a meaningful response — proper HTTP status code + JSON error body for API routes, thrown error for internal services. No empty `catch {}` blocks.
- API routes must return specific status codes (400 for validation, 401 for auth, 409 for conflicts, 500 for internal errors) with `{ error: "Human-readable message" }` body. Never return 200 for a failed operation.
- Validate inputs at system boundaries (API route handlers) — reject early with clear error messages. Internal service code can trust validated inputs.
- The only exception for silent handling is truly optional side-effects (e.g. non-critical logging, best-effort cleanup). When in doubt, surface the error.

## Conventions

- **English only**: All code, comments, commit messages, documentation, specs, plans, and any text in the repository must be written in English. No exceptions.
- ESM-only (`"type": "module"`), all imports use `.js` extension
- TypeScript strict mode, target ES2022, NodeNext module resolution

## Code Comments

Comment to explain **why** and **how**, not **what** — the code itself shows what.

**When to comment:**
- Complex logic, non-obvious algorithms, or tricky edge cases
- Business rules or constraints that aren't clear from the code
- Workarounds, known limitations, or intentional design decisions
- Public functions/classes/types (always use JSDoc)

**When NOT to comment:**
- Simple, self-explanatory code (e.g., `i++`, `return null`)
- Line-by-line narration of code — this creates noise, not clarity
- Things that variable/function names already express clearly

**JSDoc for all public APIs:**
```typescript
/**
 * Resolves a pending permission request and resumes the blocked prompt.
 *
 * If the request has already timed out or been resolved, this is a no-op.
 * Approval triggers the queued agent prompt; denial sends an error event.
 */
resolvePermission(requestId: string, approved: boolean): void
```

**Inline comments for non-obvious logic:**
```typescript
// Topic 0 is the General topic in Telegram — skip it, we only use named topics
if (topicId === 0) return;

// Retry with exponential backoff; max 3 attempts before surfacing error to user
const delay = Math.pow(2, attempt) * 100;
```

**Block comments for complex flows:**
```typescript
// ACP sends partial text chunks via `text_delta` events.
// We buffer them until `text_done`, then flush to the adapter as a single message.
// This avoids rate-limiting from sending too many small messages.
```

Keep comments concise. A good comment fits on 1–3 lines and removes ambiguity, not adds it.

**Language:** All comments must be written in English — no exceptions.

## Testing Conventions

### General Principles

- **Test framework**: Vitest. Test files live in `src/**/__tests__/*.test.ts` or `src/**/*.test.ts`.
- **Objective tests**: Tests must be objective — verify behavior against specifications and expected outcomes, not against current implementation details. The source code is for understanding, but tests should validate what the code *should* do.
- **Test flows, not internals**: Focus on testing user-facing flows and integration between components rather than individual private methods. Test the public API surface.
- **Edge cases matter**: Always test boundary conditions, error paths, and state machine transitions. These are where bugs hide.

### What to Test

1. **State machines**: Test ALL valid transitions AND all invalid transitions. Verify events emitted on each transition.
2. **Flow tests**: Test complete user flows end-to-end (e.g., message → session lookup → prompt → response → notification).
3. **Error recovery**: Test that errors don't leave the system in a broken state. After an error, the system should be usable again.
4. **Concurrency**: Test serial processing guarantees, queue ordering, lock behavior, and race conditions.
5. **Boundary values**: Test exact boundaries (e.g., `maxConcurrentSessions` at exactly the limit, budget at exactly the threshold).
6. **Cleanup**: Test that resources (timers, listeners, files) are cleaned up properly.
7. **Idempotency**: Test double-calls (double connect, double disconnect, double resolve) are safe.

### How to Write Tests

```typescript
// Use vi.fn() for mocks, TypedEmitter for event-based mocks
function mockAgentInstance() {
  const emitter = new TypedEmitter<{ agent_event: (event: AgentEvent) => void }>();
  return Object.assign(emitter, {
    sessionId: "agent-sess-1",
    prompt: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    onPermissionRequest: vi.fn(),
  }) as any;
}
```

- **Mock at boundaries**: Mock AgentInstance, ChannelAdapter, SessionStore — not internal classes.
- **Use `vi.waitFor()`** for async assertions on fire-and-forget operations.
- **Use `vi.useFakeTimers()`** for timeout-based tests (e.g., PermissionGate timeout).
- **Cleanup in afterEach**: Always destroy stores, clear timers, remove temp files.
- **No sleep/polling**: Use `await Promise.resolve()` for microtask timing, `vi.waitFor()` for async ops.

### Test Organization

- `src/core/__tests__/` — Core module tests (session, bridge, queue, permissions, store, etc.)
- `src/__tests__/` — Integration tests and adapter-level tests
- `src/plugins/*/` — Plugin-specific unit tests
- Name files descriptively: `session-lifecycle.test.ts`, `session-bridge-autoapprove.test.ts`

## Backward Compatibility

Users who installed and ran older versions will have config, data, and storage in the old format. When adding or changing anything related, **you must ensure backward compatibility**:

- **Config** (`~/.viben/config.json`): When adding new fields to Zod schema, always use `.default()` or `.optional()` so old configs don't fail validation. Never rename or remove fields without migration.
- **Storage / Data files** (`~/.viben/`): When changing data format (sessions, topics, state...), must handle old format — read old data and auto-migrate to new format if needed. Must not crash on data from previous versions.
- **CLI flags & commands**: Do not remove or rename existing commands/flags. If deprecating, keep them working and log a warning.
- **Plugin API**: When changing interfaces that plugins use, must maintain backward compat or bump major version.
- **General rule**: New code must work with old data/config without requiring user action. If migration is needed, run it automatically on startup.

## Local Viben Workspace

The `.viben/` directory contains a local Viben workspace with secrets (bot tokens, API keys). Do not read, commit, or reference files inside it.
