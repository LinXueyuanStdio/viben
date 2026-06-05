# Add Code Comments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSDoc and inline/block comments across the full Viben repository so maintainers can understand logic, intent, and design decisions without reading every line of code.

**Architecture:** Sequential execution from innermost to outermost — foundation types and utilities first, then config, plugin system, agents, sessions, adapter primitives, wiring layer, supporting modules, and finally plugins and CLI. Each task agent reads previously commented modules to maintain consistent terminology.

**Tech Stack:** TypeScript, Node.js ESM, vitest (no new tests — this plan only adds comments to existing code)

---

## Commenting Rules (apply to every task)

From `CLAUDE.md` — every agent must follow these exactly:

```typescript
// GOOD — explains why/how, not what
// Topic 0 is the General topic in Telegram — skip it, we only use named topics
if (topicId === 0) return;

// GOOD — JSDoc for public API
/**
 * Resolves a pending permission request and resumes the blocked prompt.
 *
 * If the request has already timed out or been resolved, this is a no-op.
 * Approval triggers the queued agent prompt; denial sends an error event.
 */
resolvePermission(requestId: string, approved: boolean): void

// BAD — restating what the code says
// Increment i
i++;

// BAD — obvious type guard
// Check if value is null
if (value === null) return;
```

**What always gets JSDoc:**
- All exported classes (class-level doc + every public method)
- All exported functions
- All exported types/interfaces with non-obvious fields

**What gets inline/block comments:**
- State machine transitions and valid/invalid paths
- Buffering strategies (why buffer, when flush)
- Retry/backoff logic
- Permission or security constraints
- Non-obvious data transformations
- Workarounds or known limitations
- Business rules not inferable from variable names

**What never gets a comment:**
- `return null`, `i++`, `if (!value) return`
- Anything the function/variable name already expresses clearly
- Line-by-line narration of sequential steps

---

## Setup

### Task 0: Create working branch

**Files:** none (git only)

- [ ] **Step 1: Sync develop from remote**

```bash
cd /path/to/Viben
git checkout develop
git pull origin develop
```

- [ ] **Step 2: Create working branch**

```bash
git checkout -b feat/add-code-comments
```

Expected: `Switched to a new branch 'feat/add-code-comments'`

---

## Core Modules (Opus)

### Task 1: core/utils + core/types + core/events

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/events.ts`
- Modify: `src/core/event-bus.ts`
- Modify: `src/core/utils/typed-emitter.ts`
- Modify: `src/core/utils/log.ts`
- Modify: `src/core/utils/debug-tracer.ts`
- Modify: `src/core/utils/streams.ts`
- Modify: `src/core/utils/stderr-capture.ts`
- Modify: `src/core/utils/read-text-file.ts`
- Modify: `src/core/utils/extract-file-info.ts`
- Modify: `src/core/utils/install-binary.ts`
- Modify: `src/core/utils/install-jq.ts`
- Modify: `src/core/utils/apply-patch-detection.ts`
- Modify: `src/core/utils/bypass-detection.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full. Do not write any comments yet — understand the complete picture first.

- [ ] **Step 2: Read cross-module context**

Read these files to understand how the types, events, and utils are actually used:
- `src/core/core.ts` — top-level event routing, how EventBus is used
- `src/core/sessions/session.ts` — how SessionEvents and TypedEmitter are used
- `src/core/agents/agent-instance.ts` — how AgentEvent types flow through the system
- `src/core/plugin/middleware-chain.ts` — how Hook enum values are used as middleware points
- `src/main.ts` — how Logger is initialized and used at startup

- [ ] **Step 3: Add comments to src/core/types.ts**

Focus on:
- JSDoc for every exported interface and type alias — especially `AgentEvent` union variants (each variant represents a different ACP protocol event, document what triggers each)
- `SessionStatus` state machine — comment valid transitions in the type itself or nearby
- `PermissionRequest` — explain the approval/denial flow this type participates in
- `ConfigOption` — explain what "config options" are in the context of ACP (agent-exposed settings surfaced to the user via chat)

- [ ] **Step 4: Add comments to src/core/events.ts**

Focus on:
- JSDoc for `Hook` enum — each value is a middleware intercept point; document what stage of the pipeline it represents and what payload it receives
- JSDoc for `SessionEv` enum — each value is a session lifecycle event; document when it fires

- [ ] **Step 5: Add comments to src/core/event-bus.ts**

Focus on:
- JSDoc for the class and all public methods
- Explain why EventBus exists as a separate abstraction (decouples plugins from direct session/core references)

- [ ] **Step 6: Add comments to src/core/utils/typed-emitter.ts**

Focus on:
- JSDoc for the class — explain that this is a type-safe wrapper over EventEmitter where the event map is enforced at compile time
- Note any non-obvious TypeScript generics

- [ ] **Step 7: Add comments to src/core/utils/log.ts**

Focus on:
- JSDoc for all exported functions (`createChildLogger`, `createSessionLogger`, `closeSessionLogger`, etc.)
- Explain the child logger pattern — why session loggers are separate from module loggers
- Comment any log level filtering or output routing logic

- [ ] **Step 8: Add comments to remaining utils files**

For each file, add JSDoc to exported functions and inline comments for any non-obvious logic:
- `debug-tracer.ts` — explain when debug tracing is active and what it captures
- `streams.ts` — explain why Node→Web stream conversion is needed (ACP SDK uses Web Streams)
- `stderr-capture.ts` — explain the buffering and why stderr is captured separately
- `read-text-file.ts` — explain the range parameter and why partial file reads are needed
- `extract-file-info.ts` — explain what "file info" means in the context of agent attachments
- `install-binary.ts` / `install-jq.ts` — explain the download/verify pattern
- `apply-patch-detection.ts` / `bypass-detection.ts` — explain what these detect and why (security: detecting if an agent is trying to apply patches or bypass restrictions without permission)

- [ ] **Step 9: Self-review**

Before committing, scan every file you modified:
- Is every exported symbol documented?
- Are there any comments that restate what the code already says? Remove them.
- Are all comments in English?
- Do comments explain *why* and *how*, not *what*?

- [ ] **Step 10: Commit**

```bash
git add src/core/types.ts src/core/events.ts src/core/event-bus.ts src/core/utils/
git commit -m "feat(comments): add JSDoc and inline comments — core/utils + core/types + core/events"
```

---

### Task 2: core/config

**Files:**
- Modify: `src/core/config/config.ts`
- Modify: `src/core/config/config-editor.ts`
- Modify: `src/core/config/config-migrations.ts`
- Modify: `src/core/config/config-registry.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/plugin/lifecycle-manager.ts` — how config is loaded at startup
- `src/core/plugin/plugin-context.ts` — how plugins access config
- `src/main.ts` — config load order and error handling on startup
- `src/core/plugin/settings-manager.ts` — difference between global config and per-plugin settings

- [ ] **Step 3: Add comments to src/core/config/config.ts**

Focus on:
- JSDoc for the exported Zod schema and the inferred TypeScript type
- Comment each top-level config section explaining what it controls
- Explain the `.default()` pattern on every field — this is required for backward compatibility with old config files (see CLAUDE.md Backward Compatibility section)
- Comment the `loadConfig` / `saveConfig` functions explaining the load-validate-migrate cycle

- [ ] **Step 4: Add comments to src/core/config/config-migrations.ts**

Focus on:
- JSDoc for the migrations array/map structure
- Comment each migration explaining what changed between versions and why automatic migration is needed
- Explain how version comparison works and how migrations are applied in order

- [ ] **Step 5: Add comments to src/core/config/config-editor.ts**

Focus on:
- JSDoc for all exported functions
- Explain the "editor" pattern — this provides typed read/write access to specific config fields without exposing the full config object

- [ ] **Step 6: Add comments to src/core/config/config-registry.ts**

Focus on:
- JSDoc for the registry class and all public methods
- Explain why a registry exists (plugins need to declare config fields they own, so the editor knows how to validate and surface them)

- [ ] **Step 7: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 8: Commit**

```bash
git add src/core/config/
git commit -m "feat(comments): add JSDoc and inline comments — core/config"
```

---

### Task 3: core/plugin

**Files:**
- Modify: `src/core/plugin/types.ts`
- Modify: `src/core/plugin/lifecycle-manager.ts`
- Modify: `src/core/plugin/service-registry.ts`
- Modify: `src/core/plugin/middleware-chain.ts`
- Modify: `src/core/plugin/plugin-context.ts`
- Modify: `src/core/plugin/plugin-registry.ts`
- Modify: `src/core/plugin/plugin-loader.ts`
- Modify: `src/core/plugin/plugin-installer.ts`
- Modify: `src/core/plugin/plugin-storage.ts`
- Modify: `src/core/plugin/plugin-field-registry.ts`
- Modify: `src/core/plugin/settings-manager.ts`
- Modify: `src/core/plugin/terminal-io.ts`
- Modify: `src/core/plugin/install-context.ts`
- Modify: `src/core/plugin/dev-loader.ts`
- Modify: `src/core/plugin/registry-client.ts`
- Modify: `src/core/plugin/error-tracker.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/plugins/telegram/index.ts` — how a real plugin implements `setup()` using PluginContext
- `src/plugins/security/index.ts` — how a simpler plugin registers services and middleware
- `src/main.ts` — how LifecycleManager is constructed and booted
- `src/core/core.ts` — how ServiceRegistry is queried for services like adapters

- [ ] **Step 3: Add comments to src/core/plugin/types.ts**

Focus on:
- JSDoc for every exported interface: `Plugin`, `PluginDefinition`, `PluginManifest`, `ServiceDefinition`, etc.
- Explain the distinction between a `Plugin` (runtime instance) and a `PluginDefinition` (static descriptor)
- Comment each permission type in the permissions enum — explain what capability each permission grants

- [ ] **Step 4: Add comments to src/core/plugin/lifecycle-manager.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the topological sort algorithm for dependency ordering — explain why plugins must boot in dependency order
- Comment the setup/teardown phases — what happens at each phase and in what order
- Explain error isolation — if one plugin fails setup, how does that affect others
- Comment the version migration trigger — when and why migrations run

- [ ] **Step 5: Add comments to src/core/plugin/service-registry.ts**

Focus on:
- JSDoc for the class and all public methods
- Explain the typed interface pattern — why services are registered and retrieved by string key with typed accessor methods
- Comment `register` vs `get` vs `require` — explain the difference (require throws if not found)

- [ ] **Step 6: Add comments to src/core/plugin/middleware-chain.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the hook execution model — explain that middleware runs in registration order, can modify the payload, and can short-circuit the chain
- Explain each Hook point in terms of what it intercepts and what the caller does with the result
- Comment any async handling and error propagation behavior

- [ ] **Step 7: Add comments to src/core/plugin/plugin-context.ts**

Focus on:
- JSDoc for the class and all public methods — this is the primary API surface for plugin authors
- Comment each method group: events, services, middleware, commands, storage, logging
- Explain why PluginContext is scoped per-plugin (isolation: storage namespacing, log prefixing, permission gating)
- Comment any methods that have non-obvious side effects

- [ ] **Step 8: Add comments to remaining plugin files**

For each file, add JSDoc to exported functions/classes and inline comments for non-obvious logic:
- `plugin-registry.ts` — plugin discovery and manifest validation
- `plugin-loader.ts` — dynamic ESM import mechanics, why `import()` is used over `require()`
- `plugin-installer.ts` — npm install flow, package isolation strategy
- `plugin-storage.ts` — per-plugin data directory, JSON read/write with schema validation
- `plugin-field-registry.ts` — how plugin-contributed config fields are tracked
- `settings-manager.ts` — per-plugin settings file location and update flow
- `terminal-io.ts` — why some plugins need direct terminal access during setup
- `install-context.ts` — what context is available during plugin install (vs runtime)
- `dev-loader.ts` — how dev mode loads plugins from local paths instead of npm
- `registry-client.ts` — communication with the Viben plugin registry API
- `error-tracker.ts` — how plugin errors are tracked and surfaced without crashing the host

- [ ] **Step 9: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 10: Commit**

```bash
git add src/core/plugin/
git commit -m "feat(comments): add JSDoc and inline comments — core/plugin"
```

---

### Task 4: core/agents

**Files:**
- Modify: `src/core/agents/agent-instance.ts`
- Modify: `src/core/agents/agent-manager.ts`
- Modify: `src/core/agents/agent-registry.ts`
- Modify: `src/core/agents/agent-catalog.ts`
- Modify: `src/core/agents/agent-installer.ts`
- Modify: `src/core/agents/agent-store.ts`
- Modify: `src/core/agents/agent-dependencies.ts`
- Modify: `src/core/agents/attachment-blocks.ts`
- Modify: `src/core/agents/auth-handler.ts`
- Modify: `src/core/agents/mcp-manager.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/sessions/session.ts` — how AgentInstance is wrapped and used by Session
- `src/core/sessions/session-factory.ts` — how AgentInstance is constructed
- `src/core/core.ts` — how AgentManager is accessed and agent switching works
- `src/core/utils/streams.ts` — Node→Web stream conversion used in agent-instance
- `@agentclientprotocol/sdk` types (referenced in imports) — understand the ACP protocol surface

- [ ] **Step 3: Add comments to src/core/agents/agent-instance.ts**

This is the most complex file in the codebase. Focus on:
- JSDoc for the class and every public method
- Comment the subprocess spawn flow — how the agent command is resolved, what environment is passed, why PATH is filtered
- Comment the ACP client handshake — what happens between spawn and first `prompt()` call
- Comment the streaming pipeline: how `text_delta` events are accumulated into `text_done`, why buffering is needed
- Comment each ACP event type handler — what each event means in terms of the agent's behavior
- Comment the `prompt()` method — what it sends, how it waits for completion, how it handles cancellation
- Comment `destroy()` — why SIGTERM then SIGKILL, why the delay exists
- Explain `TerminalManager` integration — when and why the agent gets terminal access
- Comment `McpManager` integration — what MCP servers are and how they extend agent capabilities

- [ ] **Step 4: Add comments to src/core/agents/agent-manager.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the agent switch flow — what happens to the old agent when switching, how state is preserved
- Explain why agent switching needs coordination with the session layer

- [ ] **Step 5: Add comments to remaining agent files**

For each file:
- `agent-registry.ts` — how available agents are discovered and registered (local vs npm installed)
- `agent-catalog.ts` — how agents are listed and described for the user
- `agent-installer.ts` — agent installation from npm, binary caching, version management
- `agent-store.ts` — persistent storage of agent state (which agents are configured, their settings)
- `agent-dependencies.ts` — why some agents have dependencies and how they're resolved
- `attachment-blocks.ts` — how file attachments are encoded into ACP prompt messages, which MIME types are supported and why
- `auth-handler.ts` — how agent authentication (API keys etc.) is handled and why it's separate from config
- `mcp-manager.ts` — MCP server lifecycle: why MCP servers are started as subprocesses, how they're connected to the agent

- [ ] **Step 6: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 7: Commit**

```bash
git add src/core/agents/
git commit -m "feat(comments): add JSDoc and inline comments — core/agents"
```

---

### Task 5: core/sessions

**Files:**
- Modify: `src/core/sessions/session.ts`
- Modify: `src/core/sessions/session-manager.ts`
- Modify: `src/core/sessions/session-store.ts`
- Modify: `src/core/sessions/session-factory.ts`
- Modify: `src/core/sessions/session-bridge.ts`
- Modify: `src/core/sessions/prompt-queue.ts`
- Modify: `src/core/sessions/permission-gate.ts`
- Modify: `src/core/sessions/turn-context.ts`
- Modify: `src/core/sessions/terminal-manager.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/core.ts` — how sessions are created, routed, and torn down
- `src/core/agents/agent-instance.ts` (already commented in Task 4) — what AgentInstance provides to Session
- `src/core/adapter-primitives/stream-adapter.ts` — how the bridge connects session events to the adapter output stream
- `src/plugins/telegram/permissions.ts` — how permission requests from the gate are rendered and resolved in Telegram

- [ ] **Step 3: Add comments to src/core/sessions/session.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the state machine — valid transitions, what causes each transition, what side effects occur on each transition
- Explain the `agentInstance` setter — why wiring happens on assignment (wireAgentRelay, wireCommandsBuffer)
- Comment `TTS_*` constants — explain the TTS injection pattern (prompt instruction + response extraction)
- Explain `latestCommands` buffer — why commands need to be buffered before the bridge connects
- Comment `threadIds` Map — why sessions can be attached to multiple adapters
- Comment prompt processing — how prompts go through middleware before reaching the agent

- [ ] **Step 4: Add comments to src/core/sessions/prompt-queue.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the serial processing guarantee — why prompts must be processed one at a time (agent is stateful, concurrent prompts would corrupt context)
- Comment the queue drain mechanism — how pending prompts are processed after the current one completes
- Explain what happens to queued prompts if the session is cancelled

- [ ] **Step 5: Add comments to src/core/sessions/permission-gate.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the blocking mechanism — how the gate pauses the prompt queue until permission is resolved
- Explain the timeout flow — what happens if the user doesn't respond, what event is emitted
- Comment the request deduplication — why duplicate requests for the same action are collapsed
- Explain auto-approve mode and when it's active

- [ ] **Step 6: Add comments to src/core/sessions/session-bridge.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the bridge pattern — how it subscribes to session events and forwards them to the adapter's stream interface
- Explain what events are relayed and what transformations happen (if any)
- Comment connection/disconnection lifecycle

- [ ] **Step 7: Add comments to remaining session files**

For each file:
- `session-manager.ts` — how sessions are looked up by channel+thread, how max concurrent sessions is enforced, session lifecycle coordination
- `session-store.ts` — persistence of session state (file format, load/save cycle, migration of old sessions)
- `session-factory.ts` — how a new session is constructed: agent selection, working directory, initial state
- `turn-context.ts` — what a "turn" is (one user prompt → one agent response cycle), what routing info it carries
- `terminal-manager.ts` — why the agent needs a terminal, how PTY allocation works, how output is streamed back

- [ ] **Step 8: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 9: Commit**

```bash
git add src/core/sessions/
git commit -m "feat(comments): add JSDoc and inline comments — core/sessions"
```

---

### Task 6: core/adapter-primitives

**Files:**
- Modify: `src/core/adapter-primitives/types.ts`
- Modify: `src/core/adapter-primitives/messaging-adapter.ts`
- Modify: `src/core/adapter-primitives/stream-adapter.ts`
- Modify: `src/core/adapter-primitives/stream-accumulator.ts`
- Modify: `src/core/adapter-primitives/message-formatter.ts`
- Modify: `src/core/adapter-primitives/format-types.ts`
- Modify: `src/core/adapter-primitives/format-utils.ts`
- Modify: `src/core/adapter-primitives/output-mode-resolver.ts`
- Modify: `src/core/adapter-primitives/display-spec-builder.ts`
- Modify: `src/core/adapter-primitives/primitives/send-queue.ts`
- Modify: `src/core/adapter-primitives/primitives/draft-manager.ts`
- Modify: `src/core/adapter-primitives/primitives/activity-tracker.ts`
- Modify: `src/core/adapter-primitives/primitives/tool-call-tracker.ts`
- Modify: `src/core/adapter-primitives/primitives/tool-card-state.ts`
- Modify: `src/core/adapter-primitives/rendering/renderer.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/plugins/telegram/adapter.ts` — how MessagingAdapter is subclassed for Telegram
- `src/plugins/sse-adapter/adapter.ts` — how MessagingAdapter is subclassed for SSE
- `src/core/sessions/session-bridge.ts` (already commented) — how the bridge feeds events into the stream adapter
- `src/plugins/telegram/streaming.ts` — how streaming + draft management works in practice

- [ ] **Step 3: Add comments to src/core/adapter-primitives/types.ts**

Focus on:
- JSDoc for every exported type — `CommandResponse` variants (text, menu, list, confirm, error, silent), explain when each is used
- `OutputMode` — explain what each mode means (streaming vs batch, how it affects message delivery)
- `AdapterCapabilities` — explain how adapters declare what they can do (formatting, reactions, etc.)

- [ ] **Step 4: Add comments to src/core/adapter-primitives/messaging-adapter.ts**

Focus on:
- JSDoc for the abstract class and all public/protected methods
- Explain the abstract method contract — what subclasses must implement and why
- Comment the `CommandResponse` rendering dispatch — how each response type maps to an adapter-specific render call
- Explain the event subscription pattern — how adapters subscribe to session events

- [ ] **Step 5: Add comments to src/core/adapter-primitives/stream-adapter.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the streaming model: `text_delta` events are buffered → flushed as a single message at `text_done` (explain why: avoid rate-limiting from too many small messages)
- Comment the draft update mechanism — how in-progress messages are edited in-place while streaming
- Explain the tool call display flow — how tool calls appear and update during agent execution

- [ ] **Step 6: Add comments to remaining adapter-primitives files**

For each file:
- `stream-accumulator.ts` — how partial text deltas are accumulated into a complete message
- `message-formatter.ts` — how agent output is formatted for each platform (markdown, plain text, HTML)
- `format-types.ts` / `format-utils.ts` — formatting primitives and why they exist separately
- `output-mode-resolver.ts` — how the appropriate output mode is selected based on adapter capabilities and message content
- `display-spec-builder.ts` — how display specifications are constructed for rich message rendering
- `send-queue.ts` — why outbound messages are queued (platform rate limits, ordering guarantees)
- `draft-manager.ts` — how draft (in-progress) messages are tracked and updated
- `activity-tracker.ts` — what "activity" means (typing indicators, etc.) and how it's managed
- `tool-call-tracker.ts` — how active tool calls are tracked during a streaming response
- `tool-card-state.ts` — the state machine for a tool call card (pending → running → done/error)
- `rendering/renderer.ts` — how CommandResponse types are rendered to platform-specific output

- [ ] **Step 7: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 8: Commit**

```bash
git add src/core/adapter-primitives/
git commit -m "feat(comments): add JSDoc and inline comments — core/adapter-primitives"
```

---

### Task 7: core wiring layer

**Files:**
- Modify: `src/core/core.ts`
- Modify: `src/core/channel.ts`
- Modify: `src/core/command-registry.ts`
- Modify: `src/core/menu-registry.ts`
- Modify: `src/core/message-transformer.ts`
- Modify: `src/core/agent-switch-handler.ts`
- Modify: `src/core/commands/index.ts`
- Modify: `src/core/commands/session.ts`
- Modify: `src/core/commands/agents.ts`
- Modify: `src/core/commands/admin.ts`
- Modify: `src/core/commands/help.ts`
- Modify: `src/core/commands/menu.ts`
- Modify: `src/core/commands/config.ts`
- Modify: `src/core/commands/switch.ts`
- Modify: `src/core/menu/core-items.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/main.ts` — how VibenCore is constructed and adapters/plugins are registered
- `src/core/sessions/session-manager.ts` (already commented) — how core delegates session lookup
- `src/plugins/telegram/adapter.ts` — how an adapter registers with core and dispatches commands
- `src/core/plugin/middleware-chain.ts` (already commented) — how core invokes middleware on message events

- [ ] **Step 3: Add comments to src/core/core.ts**

This is the top-level orchestrator — be thorough:
- JSDoc for the class and all public methods
- Comment adapter registration — how adapters announce themselves and what core does with them
- Comment message routing — how an incoming message finds the right session (or creates a new one)
- Comment the event wiring — which agent events are forwarded to which adapter callbacks
- Comment session lifecycle coordination — how core responds to session_end events
- Explain the `ServiceRegistry` access pattern — why core goes through the registry instead of holding direct references

- [ ] **Step 4: Add comments to src/core/channel.ts**

Focus on:
- JSDoc for the class and all public methods
- Explain what a "channel" is (the combination of adapter + thread that identifies a conversation location)
- Comment how channel IDs are constructed and why they're structured this way

- [ ] **Step 5: Add comments to src/core/command-registry.ts**

Focus on:
- JSDoc for the class and all public methods
- Explain the command dispatch model — how adapters route chat commands (e.g., `/new`) through the registry
- Comment how system commands vs plugin commands are differentiated
- Explain the `c/` prefix routing convention used by callback buttons

- [ ] **Step 6: Add comments to command handler files**

For each file in `src/core/commands/`:
- Focus on: JSDoc for each exported command handler, why each command exists, what session/agent state it reads or modifies
- `session.ts` — session list, resume, archive, rename
- `agents.ts` — list agents, switch agent, install agent
- `admin.ts` — admin-only commands, permission checks
- `help.ts` — how help text is generated from registered commands
- `menu.ts` — how the interactive menu is constructed
- `config.ts` — how config commands surface and update config fields
- `switch.ts` — agent switch flow coordination

- [ ] **Step 7: Add comments to src/core/message-transformer.ts and src/core/agent-switch-handler.ts**

Focus on:
- `message-transformer.ts` — what transformations are applied to incoming messages before routing (preprocessing, normalization)
- `agent-switch-handler.ts` — the state coordination required when switching agents mid-session

- [ ] **Step 8: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 9: Commit**

```bash
git add src/core/core.ts src/core/channel.ts src/core/command-registry.ts src/core/menu-registry.ts src/core/message-transformer.ts src/core/agent-switch-handler.ts src/core/commands/ src/core/menu/
git commit -m "feat(comments): add JSDoc and inline comments — core/wiring-layer"
```

---

### Task 8: core/assistant + core/instance

**Files:**
- Modify: `src/core/assistant/assistant-manager.ts`
- Modify: `src/core/assistant/assistant-registry.ts`
- Modify: `src/core/assistant/prompt-constants.ts`
- Modify: `src/core/assistant/sections/agents.ts`
- Modify: `src/core/assistant/sections/config.ts`
- Modify: `src/core/assistant/sections/remote.ts`
- Modify: `src/core/assistant/sections/sessions.ts`
- Modify: `src/core/assistant/sections/system.ts`
- Modify: `src/core/instance/instance-context.ts`
- Modify: `src/core/instance/instance-copy.ts`
- Modify: `src/core/instance/instance-discovery.ts`
- Modify: `src/core/instance/instance-init.ts`
- Modify: `src/core/instance/instance-registry.ts`
- Modify: `src/core/instance/migration.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/core.ts` (already commented) — how assistant is invoked (when user sends a message to the assistant session)
- `src/core/sessions/session.ts` (already commented) — the `isAssistant` flag and how assistant sessions differ
- `src/main.ts` — instance initialization at startup
- `src/cli/commands/start.ts` — how instance identity is established when starting the server

- [ ] **Step 3: Add comments to assistant files**

Focus on:
- `assistant-manager.ts` — what the assistant session is (a special Viben-managed agent session that can answer questions about the system), how it differs from user-created sessions
- `assistant-registry.ts` — how the assistant's capabilities are registered
- `prompt-constants.ts` — why these prompt fragments exist and what behavior they shape in the assistant
- Each section file in `sections/` — what information each section injects into the assistant's system prompt, why that information is needed, and how it's kept up to date

- [ ] **Step 4: Add comments to instance files**

Focus on:
- `instance-context.ts` — what an "instance" is (a single running Viben server process, identified by a unique ID), what context it carries
- `instance-copy.ts` — what copying an instance means (forking config/data to a new instance ID)
- `instance-discovery.ts` — how running instances are discovered (socket files, PID files, etc.)
- `instance-registry.ts` — how multiple instances on the same machine are tracked
- `instance-init.ts` — the initialization sequence: directory creation, lock file, PID registration
- `migration.ts` — how instance data is migrated when the data format changes between versions

- [ ] **Step 5: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 6: Commit**

```bash
git add src/core/assistant/ src/core/instance/
git commit -m "feat(comments): add JSDoc and inline comments — core/assistant + core/instance"
```

---

### Task 9: core/setup + core/doctor + core/security

**Files:**
- Modify: `src/core/setup/wizard.ts`
- Modify: `src/core/setup/setup-agents.ts`
- Modify: `src/core/setup/setup-channels.ts`
- Modify: `src/core/setup/setup-integrations.ts`
- Modify: `src/core/setup/setup-run-mode.ts`
- Modify: `src/core/setup/git-protect.ts`
- Modify: `src/core/setup/helpers.ts`
- Modify: `src/core/setup/types.ts`
- Modify: `src/core/doctor/index.ts`
- Modify: `src/core/doctor/types.ts`
- Modify: `src/core/doctor/checks/agents.ts`
- Modify: `src/core/doctor/checks/config.ts`
- Modify: `src/core/doctor/checks/daemon.ts`
- Modify: `src/core/doctor/checks/plugins.ts`
- Modify: `src/core/doctor/checks/storage.ts`
- Modify: `src/core/doctor/checks/telegram.ts`
- Modify: `src/core/doctor/checks/tunnel.ts`
- Modify: `src/core/doctor/checks/workspace.ts`
- Modify: `src/core/security/env-filter.ts`
- Modify: `src/core/security/path-guard.ts`
- Modify: `src/core/security/sanitize-html.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/cli/commands/setup.ts` — how the setup wizard is invoked from the CLI
- `src/cli/commands/doctor.ts` — how doctor results are displayed
- `src/core/agents/agent-instance.ts` (already commented) — how PathGuard and filterEnv are used when spawning agents
- `src/plugins/telegram/adapter.ts` — how sanitizeHtml is used before sending content to Telegram

- [ ] **Step 3: Add comments to setup files**

Focus on:
- `wizard.ts` — the wizard step sequencing, how state is passed between steps, how the wizard is resumable (partially completed)
- `setup-agents.ts` / `setup-channels.ts` / `setup-integrations.ts` / `setup-run-mode.ts` — each setup step: what it configures, what validations it performs, what it writes to config
- `git-protect.ts` — why git protection exists (preventing agents from committing to the user's own repos without permission)
- `helpers.ts` — shared prompt/validation utilities used across setup steps
- `types.ts` — the setup state machine types

- [ ] **Step 4: Add comments to doctor files**

Focus on:
- `index.ts` — how checks are collected and run, how results are aggregated
- `types.ts` — `DoctorCheck`, `DoctorResult` — explain severity levels and how the CLI uses them
- Each check file — what it verifies, what failure means, and why the check exists (e.g., `telegram.ts`: verifies bot token is valid and bot has required permissions; `workspace.ts`: verifies the data directory is writable and not corrupted)

- [ ] **Step 5: Add comments to security files**

Focus on:
- `env-filter.ts` — why environment variables are filtered when spawning agent subprocesses (prevent agents from reading secrets in the parent process environment that they shouldn't have access to), which variables are allowed through and why
- `path-guard.ts` — what the path guard prevents (agent writing to system directories, config files, etc.), how it constructs the allowlist
- `sanitize-html.ts` — why HTML must be sanitized (Telegram uses HTML for formatting — unsanitized agent output could break message rendering or inject formatting), what is stripped vs allowed

- [ ] **Step 6: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 7: Commit**

```bash
git add src/core/setup/ src/core/doctor/ src/core/security/
git commit -m "feat(comments): add JSDoc and inline comments — core/setup + core/doctor + core/security"
```

---

## Plugin Modules (Sonnet)

### Task 10: plugins/telegram

**Files:** All files in `src/plugins/telegram/`

- [ ] **Step 1: Read all module files**

Read every file in `src/plugins/telegram/` in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/adapter-primitives/stream-adapter.ts` (already commented) — how StreamAdapter is subclassed
- `src/core/adapter-primitives/messaging-adapter.ts` (already commented) — how MessagingAdapter is subclassed
- `src/core/sessions/permission-gate.ts` (already commented) — what permission requests look like before they reach the Telegram renderer
- `src/core/command-registry.ts` (already commented) — how commands are dispatched to Telegram's command handlers

- [ ] **Step 3: Add comments to adapter.ts**

Focus on:
- JSDoc for the class and all public methods
- Comment the topic-per-session model — each session gets its own Telegram forum topic, why topics are used instead of separate chats
- Comment callback routing: `p:` prefix = permission response, `c/` prefix = command button — why the distinction exists
- Comment the grammY bot setup and middleware chain

- [ ] **Step 4: Add comments to remaining telegram files**

For each file:
- `topic-manager.ts` / `topics.ts` — topic creation, lookup by session, why Topic 0 (General) is skipped
- `permissions.ts` — how permission requests are rendered as Telegram inline keyboard buttons, how approval/denial is routed back to the gate
- `streaming.ts` — the streaming + message-edit loop: how text deltas become Telegram message edits, throttling to avoid Telegram rate limits
- `draft-manager.ts` — Telegram-specific draft tracking (message IDs of in-progress messages)
- `formatting.ts` — Telegram HTML escaping, markdown→HTML conversion, why HTML mode is used over MarkdownV2
- `renderer.ts` — how each `CommandResponse` type maps to Telegram API calls
- `activity.ts` — typing indicator management (when sent, when cancelled)
- `skill-command-manager.ts` — how skill slash commands are registered with Telegram's command list
- `assistant.ts` — Telegram-specific assistant session handling
- `validators.ts` — input validation specific to Telegram (message length, file size limits)
- `types.ts` — Telegram-specific internal types
- Each file in `commands/` — the implementation of each Telegram slash command

- [ ] **Step 5: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 6: Commit**

```bash
git add src/plugins/telegram/
git commit -m "feat(comments): add JSDoc and inline comments — plugins/telegram"
```

---

### Task 11: plugins/api-server

**Files:** All files in `src/plugins/api-server/`

- [ ] **Step 1: Read all module files**

Read every file in `src/plugins/api-server/` in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/sessions/session-manager.ts` (already commented) — what session operations the API exposes
- `src/core/agents/agent-manager.ts` (already commented) — what agent operations the API exposes
- `src/plugins/sse-adapter/adapter.ts` — how the SSE adapter connects to the API server
- `src/core/plugin/service-registry.ts` (already commented) — how the API server registers itself as a service

- [ ] **Step 3: Add comments to server.ts and service.ts**

Focus on:
- `server.ts` — Fastify server setup, plugin registration, route mounting, CORS and security headers
- `service.ts` — how the API server plugin registers with Viben's plugin system, what services it exposes

- [ ] **Step 4: Add comments to auth files**

For each file in `src/plugins/api-server/auth/`:
- `jwt.ts` — JWT signing/verification, token expiry, why JWT is used (stateless auth for the app)
- `token-store.ts` — how tokens are persisted (for revocation support)
- `roles.ts` — role definitions and permission checks (admin vs user)
- `types.ts` — auth-related type definitions

- [ ] **Step 5: Add comments to routes, middleware, schemas**

For each route file — JSDoc for each route handler explaining: what resource it operates on, what auth is required, what side effects it has:
- `sessions.ts` — session CRUD, prompt submission
- `agents.ts` — agent management operations
- `auth.ts` — login, token refresh, logout flows
- `commands.ts` — command execution via API
- `config.ts` — config read/write
- `topics.ts` — topic management
- `tunnel.ts` — tunnel status and control
- `notify.ts` — push notification endpoint
- `workspace.ts` — workspace operations
- `health.ts` — health check endpoint
- `plugins.ts` — plugin management

For middleware:
- `auth.ts` — how auth middleware validates JWT and attaches user context to request
- `error-handler.ts` — error response normalization

- [ ] **Step 6: Add comments to sse-manager.ts and static-server.ts**

Focus on:
- `sse-manager.ts` — how SSE connections are managed: connection lifecycle, event broadcast, reconnection handling, why SSE is used over WebSockets
- `static-server.ts` — how the app's static files are served (path resolution, caching headers)

- [ ] **Step 7: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 8: Commit**

```bash
git add src/plugins/api-server/
git commit -m "feat(comments): add JSDoc and inline comments — plugins/api-server"
```

---

### Task 12: plugins/context + plugins/tunnel

**Files:** All files in `src/plugins/context/` and `src/plugins/tunnel/`

- [ ] **Step 1: Read all module files**

Read every file in `src/plugins/context/` and `src/plugins/tunnel/` in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/plugin/middleware-chain.ts` (already commented) — how context injects via `agent:beforePrompt` hook
- `src/core/agents/agent-instance.ts` (already commented) — how context is prepended to the prompt payload
- `src/core/plugin/plugin-context.ts` (already commented) — how tunnel registers its service
- `src/core/sessions/session.ts` (already commented) — how session events are used by context recording

- [ ] **Step 3: Add comments to context plugin files**

Focus on:
- `context-manager.ts` — how context is built and injected before each prompt (the middleware hook flow)
- `context-provider.ts` — the abstract provider interface: what a context provider must implement
- `context-cache.ts` — why context is cached and when the cache is invalidated
- `history/history-provider.ts` — how conversation history is selected and formatted for injection
- `history/history-recorder.ts` — how each turn is recorded to the history store
- `history/history-store.ts` — the storage format for conversation history
- `history/history-context-builder.ts` — how history is formatted into a context block
- `entire/entire-provider.ts` — the "entire conversation" context mode (vs windowed history)
- `entire/conversation-builder.ts` — how the full conversation is reconstructed from checkpoints
- `entire/checkpoint-reader.ts` — how Claude Code session checkpoints are read
- `entire/message-cleaner.ts` — why messages need cleaning before injection (removing internal markers, normalizing format)

- [ ] **Step 4: Add comments to tunnel plugin files**

Focus on:
- `tunnel-service.ts` — the tunnel service interface: what it provides to other plugins
- `provider.ts` — the abstract tunnel provider: what each provider must implement
- `tunnel-registry.ts` — how the active tunnel provider is selected from config
- `keepalive.ts` — why tunnels need keepalive pings and how the interval is managed
- Each provider file (`cloudflare.ts`, `ngrok.ts`, `bore.ts`, `tailscale.ts`, `viben.ts`) — how that provider starts, how the public URL is extracted from its output, error handling
- `install-cloudflared.ts` — why cloudflared needs a separate install step (binary download)
- `viewer-routes.ts` / `viewer-store.ts` — the file/diff viewer served through the tunnel: how viewer content is registered and served
- `templates/` — HTML templates for file-viewer, diff-viewer, output-viewer: why these exist (letting agents share file content with users via a web URL)

- [ ] **Step 5: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 6: Commit**

```bash
git add src/plugins/context/ src/plugins/tunnel/
git commit -m "feat(comments): add JSDoc and inline comments — plugins/context + plugins/tunnel"
```

---

### Task 13: remaining plugins

**Files:**
- All files in `src/plugins/security/`
- All files in `src/plugins/speech/`
- All files in `src/plugins/notifications/`
- All files in `src/plugins/sse-adapter/`
- All files in `src/plugins/file-service/`
- `src/plugins/core-plugins.ts`
- `src/plugins/index.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

- `src/core/plugin/middleware-chain.ts` (already commented) — how security middleware hooks work
- `src/core/adapter-primitives/messaging-adapter.ts` (already commented) — how SSE adapter subclasses it
- `src/core/sessions/session-bridge.ts` (already commented) — how SSE adapter connects to sessions
- `src/plugins/api-server/sse-manager.ts` (already commented) — how SSE adapter integrates with the API server

- [ ] **Step 3: Add comments to security plugin**

Focus on:
- `security-guard.ts` — rate limiting logic (per-user, per-session limits), access control checks (allowlist/denylist), why these checks exist as a plugin rather than core (pluggable security policy)

- [ ] **Step 4: Add comments to speech plugin**

Focus on:
- `speech-service.ts` — the TTS/STT service interface, how it integrates with the session TTS flow
- `speech-types.ts` — speech-related types
- `providers/groq.ts` — Groq STT API integration: audio format requirements, transcription flow

- [ ] **Step 5: Add comments to notifications plugin**

Focus on:
- `notification.ts` — how cross-session notifications work: what triggers a notification, how it's routed to the right adapter/user

- [ ] **Step 6: Add comments to sse-adapter plugin**

Focus on:
- `adapter.ts` — how SSEAdapter extends MessagingAdapter, what SSE-specific behavior differs from Telegram
- `connection-manager.ts` — how SSE client connections are tracked and managed
- `event-buffer.ts` — why events are buffered (SSE reconnection: client may miss events while disconnected)
- `event-serializer.ts` — how internal events are serialized to SSE wire format
- `routes.ts` — the SSE endpoint route registration

- [ ] **Step 7: Add comments to file-service plugin**

Focus on:
- `file-service.ts` — how agents read/write files through this service (why the indirection exists: security boundary, path normalization, access logging)

- [ ] **Step 8: Add comments to core-plugins.ts and index.ts**

Focus on:
- `core-plugins.ts` — which plugins are bundled as "core" (always loaded), why they're always present, and the load order
- `index.ts` — what is exported from the plugins package

- [ ] **Step 9: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 10: Commit**

```bash
git add src/plugins/security/ src/plugins/speech/ src/plugins/notifications/ src/plugins/sse-adapter/ src/plugins/file-service/ src/plugins/core-plugins.ts src/plugins/index.ts
git commit -m "feat(comments): add JSDoc and inline comments — plugins/remaining"
```

---

## CLI and Entry Points (Sonnet)

### Task 14: src/cli/

**Files:** All files in `src/cli/`

- [ ] **Step 1: Read all module files**

Read every file in `src/cli/` in full.

- [ ] **Step 2: Read cross-module context**

- `src/cli.ts` — how CLI commands are registered and dispatched
- `src/core/instance/instance-discovery.ts` (already commented) — how CLI finds a running daemon
- `src/plugins/api-server/service.ts` (already commented) — the REST API the CLI client talks to

- [ ] **Step 3: Add comments to daemon.ts and autostart.ts**

Focus on:
- `daemon.ts` — how the daemon is started/stopped (fork mechanics, PID file, stdout/stderr piping), why a daemon model is used (server runs independently of the terminal)
- `autostart.ts` — how autostart is configured per-platform (launchd on macOS, systemd on Linux)

- [ ] **Step 4: Add comments to api-client.ts**

Focus on:
- JSDoc for all methods
- Explain the client-to-daemon communication pattern (REST over Unix socket or TCP)
- Comment error handling for connection-refused scenarios (daemon not running)

- [ ] **Step 5: Add comments to CLI command files**

For each file in `src/cli/commands/` — JSDoc for the command handler, explain what it does, what API calls it makes, and any non-obvious UX decisions:
- `start.ts` / `stop.ts` / `restart.ts` — daemon lifecycle
- `status.ts` — how status is fetched and displayed
- `agents.ts` / `instances.ts` — agent and instance management commands
- `plugins.ts` / `plugin-create.ts` / `plugin-search.ts` — plugin management
- `config.ts` — config editing via CLI
- `logs.ts` — log streaming from daemon
- `setup.ts` / `onboard.ts` — first-run setup invocation
- `doctor.ts` — diagnostic check runner
- `adopt.ts` / `attach.ts` — session adoption and attachment
- `tunnel.ts` — tunnel management
- `remote.ts` — remote instance management
- `integrate.ts` — third-party integration setup
- `update.ts` / `install.ts` / `uninstall.ts` — package management operations
- `reset.ts` — factory reset
- `dev.ts` — development mode
- `autostart.ts` / `version.ts` / `help.ts` / `default.ts` / `api.ts` — utility commands

- [ ] **Step 6: Add comments to plugin-template files**

Focus on:
- `index.ts` — what the template scaffolds
- `plugin-guide.ts` — the guide embedded in generated plugins (this is what AI agents and developers read to learn the plugin API — comments here explain the guide's structure)
- `claude-md.ts` — the CLAUDE.md embedded in generated plugins

- [ ] **Step 7: Add comments to remaining CLI files**

- `interactive-menu.ts` — how the interactive TUI menu is built and navigated
- `output.ts` — CLI output formatting helpers (colors, tables, spinners)
- `integrate.ts` — integration wizard flow
- `instance-hint.ts` / `instance-prompt.ts` / `resolve-instance-id.ts` — instance selection UX
- `suggest.ts` — command suggestion on typos
- `post-upgrade.ts` — post-upgrade migration steps run after `viben update`
- `version.ts` — version string construction

- [ ] **Step 8: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 9: Commit**

```bash
git add src/cli/
git commit -m "feat(comments): add JSDoc and inline comments — src/cli"
```

---

### Task 15: Entry points

**Files:**
- Modify: `src/main.ts`
- Modify: `src/index.ts`
- Modify: `src/cli.ts`
- Modify: `src/testing.ts`
- Modify: `src/data/product-guide.ts`

- [ ] **Step 1: Read all module files**

Read every file listed above in full.

- [ ] **Step 2: Read cross-module context**

All prior tasks are complete at this point — review the already-commented versions of:
- `src/core/core.ts` — what main.ts is wiring together
- `src/core/plugin/lifecycle-manager.ts` — the boot sequence main.ts initiates
- `src/core/instance/instance-init.ts` — instance setup main.ts triggers

- [ ] **Step 3: Add comments to src/main.ts**

Focus on:
- Block comment at the top explaining the startup sequence in order: instance init → config load → plugin boot → adapter registration → server listen
- Comment each phase of the boot sequence with why that order matters
- Comment shutdown handling (SIGINT/SIGTERM) and why graceful shutdown is important

- [ ] **Step 4: Add comments to src/index.ts**

Focus on:
- JSDoc for every exported symbol — this is the public API surface of the `@viben/kernel` package
- Comment which exports are intended for plugin authors vs internal use

- [ ] **Step 5: Add comments to src/cli.ts**

Focus on:
- JSDoc / block comments explaining the CLI entry point flow: how commander is set up, how subcommands are registered, how the default command is handled

- [ ] **Step 6: Add comments to src/testing.ts**

Focus on:
- JSDoc for all exports — explain what testing utilities are provided and why they exist (e.g., mock adapters, test session factories)

- [ ] **Step 7: Add comments to src/data/product-guide.ts**

Focus on:
- A top-level comment explaining what this data is (the product guide injected into the assistant's system prompt) and how/where it's used

- [ ] **Step 8: Self-review** (same criteria as Task 1 Step 9)

- [ ] **Step 9: Commit**

```bash
git add src/main.ts src/index.ts src/cli.ts src/testing.ts src/data/product-guide.ts
git commit -m "feat(comments): add JSDoc and inline comments — entry points"
```

---

## Final Verification

- [ ] **Run TypeScript compile to verify no syntax errors were introduced**

```bash
pnpm build
```

Expected: no errors. Comments should never change code behavior.

- [ ] **Run tests to confirm nothing is broken**

```bash
pnpm test
```

Expected: all tests pass (comments are additive — no logic was changed).

- [ ] **Final commit if build/test clean**

If pnpm build and pnpm test both pass with no errors, the branch is ready for review.

```bash
git log --oneline feat/add-code-comments ^develop
```

Expected: 15 commits, one per module task.
