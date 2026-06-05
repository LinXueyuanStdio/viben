# Code Comments — Design Spec

**Date:** 2026-04-10
**Scope:** Full Viben repository (`src/core/`, `src/plugins/`, `src/cli/`, entry points)
**Goal:** Add clear, meaningful comments to all files so maintainers can understand logic, intent, and design decisions without reading every line of code.

---

## Commenting Guidelines

Follows `CLAUDE.md` conventions exactly:

- **JSDoc for all public APIs** — classes, public methods, exported functions, exported types
- **Inline comments for non-obvious logic** — complex algorithms, tricky edge cases, business rules
- **Block comments for complex flows** — multi-step processes, state machines, buffering strategies
- **No line-by-line narration** — never restate what the code already shows
- **No comments on self-explanatory code** — `return null`, simple assignments, obvious type guards
- All comments in English

---

## Branch Strategy

- Base: `develop` (synced from remote before starting)
- Working branch: `feat/add-code-comments`
- One commit per module/task, committed in order
- Commit format: `feat(comments): add JSDoc and inline comments — <module-path>`

---

## Execution Order (Sequential)

Tasks run strictly in order (15 total) — each agent reads the previously commented modules before starting its own, ensuring consistent terminology and correct understanding of cross-module relationships.

### Task 1 — core/utils + core/types + core/events (Opus)
Files:
- `src/core/types.ts`
- `src/core/events.ts`
- `src/core/event-bus.ts`
- `src/core/utils/typed-emitter.ts`
- `src/core/utils/log.ts`
- `src/core/utils/debug-tracer.ts`
- `src/core/utils/streams.ts`
- `src/core/utils/stderr-capture.ts`
- `src/core/utils/read-text-file.ts`
- `src/core/utils/extract-file-info.ts`
- `src/core/utils/install-binary.ts`
- `src/core/utils/install-jq.ts`
- `src/core/utils/apply-patch-detection.ts`
- `src/core/utils/bypass-detection.ts`

**Why first:** These are the foundation — all other modules depend on these types, events, and utilities. Correct comments here establish the shared vocabulary for everything that follows.

### Task 2 — core/config (Opus)
Files:
- `src/core/config/config.ts`
- `src/core/config/config-editor.ts`
- `src/core/config/config-migrations.ts`
- `src/core/config/config-registry.ts`

**Why second:** Config is used at startup by nearly every module. Understanding the schema, migration strategy, and validation logic is prerequisite for understanding how plugins and core boot.

### Task 3 — core/plugin (Opus)
Files:
- `src/core/plugin/types.ts`
- `src/core/plugin/lifecycle-manager.ts`
- `src/core/plugin/service-registry.ts`
- `src/core/plugin/middleware-chain.ts`
- `src/core/plugin/plugin-context.ts`
- `src/core/plugin/plugin-registry.ts`
- `src/core/plugin/plugin-loader.ts`
- `src/core/plugin/plugin-installer.ts`
- `src/core/plugin/plugin-storage.ts`
- `src/core/plugin/plugin-field-registry.ts`
- `src/core/plugin/settings-manager.ts`
- `src/core/plugin/terminal-io.ts`
- `src/core/plugin/install-context.ts`
- `src/core/plugin/dev-loader.ts`
- `src/core/plugin/registry-client.ts`
- `src/core/plugin/error-tracker.ts`

**Why third:** The plugin system is the infrastructure backbone — lifecycle ordering, service discovery, middleware hooks, and PluginContext are referenced by every plugin. Getting these right is critical before commenting anything that uses them.

### Task 4 — core/agents (Opus)
Files:
- `src/core/agents/agent-instance.ts`
- `src/core/agents/agent-manager.ts`
- `src/core/agents/agent-registry.ts`
- `src/core/agents/agent-catalog.ts`
- `src/core/agents/agent-installer.ts`
- `src/core/agents/agent-store.ts`
- `src/core/agents/agent-dependencies.ts`
- `src/core/agents/attachment-blocks.ts`
- `src/core/agents/auth-handler.ts`
- `src/core/agents/mcp-manager.ts`

**Why fourth:** AgentInstance is the ACP subprocess client — the most complex single file in the codebase. It implements the full ACP Client interface, handles streaming, converts protocol events to internal types, and manages subprocess lifecycle. Sessions wrap AgentInstance, so agents must be understood first.

### Task 5 — core/sessions (Opus)
Files:
- `src/core/sessions/session.ts`
- `src/core/sessions/session-manager.ts`
- `src/core/sessions/session-store.ts`
- `src/core/sessions/session-factory.ts`
- `src/core/sessions/session-bridge.ts`
- `src/core/sessions/prompt-queue.ts`
- `src/core/sessions/permission-gate.ts`
- `src/core/sessions/turn-context.ts`
- `src/core/sessions/terminal-manager.ts`

**Why fifth:** Sessions are the central runtime abstraction — they wrap AgentInstance (Task 4), manage prompt queues, gate permissions, and bridge events to adapters. Must come after agents so the agent has full context about what Session wraps and orchestrates.

### Task 6 — core/adapter-primitives (Opus)
Files:
- `src/core/adapter-primitives/types.ts`
- `src/core/adapter-primitives/messaging-adapter.ts`
- `src/core/adapter-primitives/stream-adapter.ts`
- `src/core/adapter-primitives/stream-accumulator.ts`
- `src/core/adapter-primitives/message-formatter.ts`
- `src/core/adapter-primitives/format-types.ts`
- `src/core/adapter-primitives/format-utils.ts`
- `src/core/adapter-primitives/output-mode-resolver.ts`
- `src/core/adapter-primitives/display-spec-builder.ts`
- `src/core/adapter-primitives/primitives/send-queue.ts`
- `src/core/adapter-primitives/primitives/draft-manager.ts`
- `src/core/adapter-primitives/primitives/activity-tracker.ts`
- `src/core/adapter-primitives/primitives/tool-call-tracker.ts`
- `src/core/adapter-primitives/primitives/tool-card-state.ts`
- `src/core/adapter-primitives/rendering/renderer.ts`

**Why sixth:** Adapter primitives define the shared framework all messaging adapters build on — streaming, queuing, formatting, and rendering. Understanding this layer is prerequisite for commenting telegram and other adapters correctly.

### Task 7 — core wiring layer (Opus)
Files:
- `src/core/core.ts`
- `src/core/channel.ts`
- `src/core/command-registry.ts`
- `src/core/menu-registry.ts`
- `src/core/message-transformer.ts`
- `src/core/agent-switch-handler.ts`
- `src/core/commands/index.ts`
- `src/core/commands/session.ts`
- `src/core/commands/agents.ts`
- `src/core/commands/admin.ts`
- `src/core/commands/help.ts`
- `src/core/commands/menu.ts`
- `src/core/commands/config.ts`
- `src/core/commands/switch.ts`
- `src/core/menu/core-items.ts`

**Why seventh:** `core.ts` is the top-level orchestrator — it registers adapters, routes messages, creates sessions, and wires agent events to adapters. This is the "glue" that connects all previous modules.

### Task 8 — core/assistant + core/instance (Opus)
Files:
- `src/core/assistant/assistant-manager.ts`
- `src/core/assistant/assistant-registry.ts`
- `src/core/assistant/prompt-constants.ts`
- `src/core/assistant/sections/agents.ts`
- `src/core/assistant/sections/config.ts`
- `src/core/assistant/sections/remote.ts`
- `src/core/assistant/sections/sessions.ts`
- `src/core/assistant/sections/system.ts`
- `src/core/instance/instance-context.ts`
- `src/core/instance/instance-copy.ts`
- `src/core/instance/instance-discovery.ts`
- `src/core/instance/instance-init.ts`
- `src/core/instance/instance-registry.ts`
- `src/core/instance/migration.ts`

**Focus areas:** Assistant system prompt construction (how sections are composed), instance identity and discovery across multiple running instances, instance migration between versions.

### Task 9 — core/setup + core/doctor + core/security (Opus)
Files:
- `src/core/setup/wizard.ts`
- `src/core/setup/setup-agents.ts`
- `src/core/setup/setup-channels.ts`
- `src/core/setup/setup-integrations.ts`
- `src/core/setup/setup-run-mode.ts`
- `src/core/setup/git-protect.ts`
- `src/core/setup/helpers.ts`
- `src/core/setup/types.ts`
- `src/core/doctor/index.ts`
- `src/core/doctor/types.ts`
- `src/core/doctor/checks/agents.ts`
- `src/core/doctor/checks/config.ts`
- `src/core/doctor/checks/daemon.ts`
- `src/core/doctor/checks/plugins.ts`
- `src/core/doctor/checks/storage.ts`
- `src/core/doctor/checks/telegram.ts`
- `src/core/doctor/checks/tunnel.ts`
- `src/core/doctor/checks/workspace.ts`
- `src/core/security/env-filter.ts`
- `src/core/security/path-guard.ts`
- `src/core/security/sanitize-html.ts`

**Focus areas:** First-run wizard flow and step sequencing, doctor check architecture and result aggregation, path/env security constraints and why they exist.

### Task 10 — plugins/telegram (Sonnet)
Files: all files in `src/plugins/telegram/`

**Focus areas:** Topic-per-session model, callback routing (`p:` vs `c/` prefix), permission button flow, streaming + draft management, grammY middleware chain, Telegram-specific rendering.

### Task 11 — plugins/api-server (Sonnet)
Files: all files in `src/plugins/api-server/`

**Focus areas:** JWT auth flow, SSE event streaming, REST route organization, role-based access, static file serving for app.

### Task 12 — plugins/context + plugins/tunnel (Sonnet)
Files: all files in `src/plugins/context/` and `src/plugins/tunnel/`

**Focus areas (context):** Conversation history recording, context injection before prompts, checkpoint-based recovery.
**Focus areas (tunnel):** Provider abstraction, keepalive strategy, viewer routes for file/diff display.

### Task 13 — remaining plugins (Sonnet)
Files:
- `src/plugins/security/`
- `src/plugins/speech/`
- `src/plugins/notifications/`
- `src/plugins/sse-adapter/`
- `src/plugins/file-service/`
- `src/plugins/core-plugins.ts`
- `src/plugins/index.ts`

### Task 14 — src/cli/ (Sonnet)
Files: all files in `src/cli/` including commands/, plugin-template/, daemon, autostart, etc.

**Focus areas:** Daemon management, CLI command routing, interactive menu, plugin scaffolding templates.

### Task 15 — Entry points (Sonnet)
Files:
- `src/main.ts`
- `src/index.ts`
- `src/cli.ts`
- `src/testing.ts`
- `src/data/product-guide.ts`

---

## What Each Agent Must Do

1. **Read all files in the assigned module** — understand the full picture before writing any comment
2. **Read previously commented modules** — reference prior terminology and understand cross-module dependencies
3. **Follow the logic outward** — for any piece of code that's unclear, read its callers and consumers in other modules to understand how it's actually used in practice. Don't guess intent from the code alone; trace how it's called end-to-end. For example:
   - Commenting `permission-gate.ts`? Read `session-bridge.ts` and `session.ts` to see how permission requests are created and resolved
   - Commenting `middleware-chain.ts`? Read `plugin-context.ts` and an actual plugin to see what hooks are registered and why
   - Commenting `agent-instance.ts`? Read `session.ts` and `core.ts` to understand how AgentInstance is created and what events are consumed upstream
4. **Analyze each public API** — write JSDoc describing purpose, parameters, return values, and non-obvious behavior
5. **Identify complex logic** — add inline or block comments for algorithms, state machine transitions, business rules, known limitations, intentional design decisions
6. **Skip self-explanatory code** — no comments on obvious assignments, simple returns, or what function names already express
7. **Commit** — one commit for the module with message `feat(comments): add JSDoc and inline comments — <module-path>`

---

## Success Criteria

- All public classes and their public methods have JSDoc
- All exported functions and types have JSDoc
- Complex flows (streaming, permission gating, prompt queuing, middleware chains) have block/inline comments explaining the why and how
- No line-by-line narration anywhere
- Comments are accurate — they reflect the actual behavior, not a guess
- Consistent terminology across all modules (e.g., "turn", "prompt", "thread", "topic", "channel" used consistently)
