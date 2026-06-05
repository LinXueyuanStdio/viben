# Phase 2a: Folder Restructure + Full ACP Core — Design Spec

**Date:** 2026-03-26
**Scope:** Comprehensive folder restructure, full ACP protocol compliance, terminal management, auth, MCP passthrough
**Depends on:** Phase 1 adapter layer refactor (branch `refactor/adapter-layer-phase1`)
**Phase 2b (separate spec):** Plugin system with full lifecycle hooks

---

## Goals

1. **Clean folder structure** — group 44 flat core files into logical subdirectories, standardize test placement, split 63KB CLI file
2. **Full ACP protocol compliance** — implement ALL missing ACP features (17 items across 3 tiers)
3. **Flexible core** — design for plugin hooks in Phase 2b (event bus pattern, no hardcoded logic)
4. **TDD** — write tests before implementation code for every new feature

## Non-Goals

- Plugin system implementation (Phase 2b)
- New adapter implementations (WebSocket/API)
- UI/dashboard changes
- Breaking config format changes

---

## Section 1: Folder Restructure

### New Structure

```
src/
  cli/
    index.ts                        ← renamed from cli.ts
    commands/
      start.ts                      ← extracted from commands.ts
      install.ts
      uninstall.ts
      agents.ts
      plugins.ts
      doctor.ts
      setup.ts
      version.ts
      index.ts                      ← barrel + command router
    daemon.ts                        ← moved from core/
    autostart.ts                     ← moved from core/
    post-upgrade.ts                  ← moved from core/
    __tests__/

  core/
    agents/
      agent-instance.ts              ← moved from core/
      agent-catalog.ts
      agent-installer.ts
      agent-dependencies.ts
      agent-manager.ts
      agent-registry.ts
      agent-store.ts
      mcp-manager.ts                 ← NEW: MCP server config passthrough
      auth-handler.ts                ← NEW: authenticate method handling
      __tests__/

    config/
      config.ts                      ← moved from core/
      config-registry.ts
      config-editor.ts
      config-migrations.ts
      __tests__/

    sessions/
      session.ts                     ← moved from core/
      session-manager.ts
      session-store.ts
      session-factory.ts
      session-bridge.ts
      permission-gate.ts
      prompt-queue.ts
      terminal-manager.ts            ← NEW: manage terminal subprocesses
      __tests__/

    api/                             ← unchanged
    context/                         ← unchanged
    doctor/                          ← unchanged
    setup/                           ← unchanged

    # Root-level (orchestration + shared interfaces)
    core.ts                          — VibenCore orchestrator
    channel.ts                       — IChannelAdapter interface
    types.ts                         — shared types
    notification.ts
    security-guard.ts
    message-transformer.ts
    topic-manager.ts
    event-bus.ts
    plugin-manager.ts
    index.ts
    __tests__/                       ← core orchestration tests only

    utils/
      log.ts                         ← moved from core/
      typed-emitter.ts
      file-service.ts
      streams.ts
      stderr-capture.ts
      install-binary.ts
      install-jq.ts
      __tests__/

  speech/                            ← moved from core/speech/
    speech-service.ts
    types.ts
    providers/
      edge-tts.ts
      groq.ts
    index.ts
    __tests__/

  tunnel/                            ← unchanged

  adapters/                          ← unchanged from Phase 1
    shared/
    telegram/
    discord/
    slack/

  data/
    registry-snapshot.json
    product-guide.ts                 ← moved from src/ root

  __tests__/                         ← integration tests (unchanged)
  index.ts                           — public API
  main.ts                            — server startup
```

### Files moved

| From | To | Reason |
|------|----|--------|
| `core/agent-instance.ts` | `core/agents/agent-instance.ts` | Group by domain |
| `core/agent-catalog.ts` | `core/agents/agent-catalog.ts` | Group by domain |
| `core/agent-installer.ts` | `core/agents/agent-installer.ts` | Group by domain |
| `core/agent-dependencies.ts` | `core/agents/agent-dependencies.ts` | Group by domain |
| `core/agent-manager.ts` | `core/agents/agent-manager.ts` | Group by domain |
| `core/agent-registry.ts` | `core/agents/agent-registry.ts` | Group by domain |
| `core/agent-store.ts` | `core/agents/agent-store.ts` | Group by domain |
| `core/api-client.ts` | `core/api/api-client.ts` | API concern |
| `core/api-server.ts` | `core/api/api-server.ts` | API concern |
| `core/sse-manager.ts` | `core/api/sse-manager.ts` | API concern |
| `core/static-server.ts` | `core/api/static-server.ts` | API concern |
| `core/usage-budget.ts` | `core/sessions/usage-budget.ts` | Session concern (per-session budget) |
| `core/usage-store.ts` | `core/sessions/usage-store.ts` | Session concern (per-session usage) |
| `core/config.ts` | `core/config/config.ts` | Group by domain |
| `core/config-registry.ts` | `core/config/config-registry.ts` | Group by domain |
| `core/config-editor.ts` | `core/config/config-editor.ts` | Group by domain |
| `core/config-migrations.ts` | `core/config/config-migrations.ts` | Group by domain |
| `core/session.ts` | `core/sessions/session.ts` | Group by domain |
| `core/session-manager.ts` | `core/sessions/session-manager.ts` | Group by domain |
| `core/session-store.ts` | `core/sessions/session-store.ts` | Group by domain |
| `core/session-factory.ts` | `core/sessions/session-factory.ts` | Group by domain |
| `core/session-bridge.ts` | `core/sessions/session-bridge.ts` | Group by domain |
| `core/permission-gate.ts` | `core/sessions/permission-gate.ts` | Session concern |
| `core/prompt-queue.ts` | `core/sessions/prompt-queue.ts` | Session concern |
| `core/log.ts` | `core/utils/log.ts` | Utility |
| `core/typed-emitter.ts` | `core/utils/typed-emitter.ts` | Utility |
| `core/file-service.ts` | `core/utils/file-service.ts` | Utility |
| `core/streams.ts` | `core/utils/streams.ts` | Utility |
| `core/stderr-capture.ts` | `core/utils/stderr-capture.ts` | Utility |
| `core/install-binary.ts` | `core/utils/install-binary.ts` | Utility |
| `core/install-jq.ts` | `core/utils/install-jq.ts` | Utility |
| `core/daemon.ts` | `cli/daemon.ts` | CLI lifecycle |
| `core/autostart.ts` | `cli/autostart.ts` | CLI lifecycle |
| `core/post-upgrade.ts` | `cli/post-upgrade.ts` | CLI lifecycle |
| `core/speech/*` | `speech/*` | Independent service |
| `src/product-guide.ts` | `src/data/product-guide.ts` | Static data |
| `src/cli.ts` | `cli/index.ts` | CLI entry |

### CLI commands split

`cli/commands.ts` (63KB single file) → split into individual command files:

| New file | Content |
|----------|---------|
| `cli/commands/start.ts` | `start` command (daemon start, inline mode) |
| `cli/commands/install.ts` | `install` command (agent/plugin install) |
| `cli/commands/uninstall.ts` | `uninstall` command |
| `cli/commands/agents.ts` | `agents` command (list, info) |
| `cli/commands/plugins.ts` | `plugins` command |
| `cli/commands/doctor.ts` | `doctor` command |
| `cli/commands/setup.ts` | `setup` command |
| `cli/commands/version.ts` | `--version` handler |
| `cli/commands/index.ts` | Command router + barrel export |

### Test standardization

**All tests → `__tests__/` subdirectories.** Move co-located tests:

| From | To |
|------|----|
| `adapters/slack/*.test.ts` (9 files) | `adapters/slack/__tests__/*.test.ts` |
| `adapters/telegram/*.test.ts` (3 files) | `adapters/telegram/__tests__/*.test.ts` |
| `adapters/discord/*.test.ts` (2 files) | `adapters/discord/__tests__/*.test.ts` |
| `adapters/shared/*.test.ts` (3 files) | `adapters/shared/__tests__/*.test.ts` |
| `core/__tests__/*` (51 files) | Redistribute to `core/agents/__tests__/`, `core/config/__tests__/`, `core/sessions/__tests__/`, etc. based on what they test |

### Import path updates

Breaking change accepted. All internal imports updated. `src/index.ts` public API re-exports adjusted to new paths.

### Backward compatibility

- `ChannelAdapter` class still exported (deprecated from Phase 1)
- Config format unchanged
- CLI commands unchanged
- No data migration needed

---

## Section 2: ACP Types Expansion

### New types added to `core/types.ts`

```typescript
// --- Session Modes ---

export interface SessionMode {
  id: string
  name: string
  description?: string
}

export interface SessionModeState {
  currentModeId: string
  availableModes: SessionMode[]
}

// --- Config Options (matches ACP SDK SessionConfigOption) ---

export interface ConfigSelectChoice {
  value: string
  label: string
  description?: string
}

export interface ConfigSelectGroup {
  group: string
  name: string
  options: ConfigSelectChoice[]
}

export type ConfigOption =
  | {
      id: string
      name: string
      description?: string
      category?: string  // 'mode' | 'model' | 'thought_level' | custom '_*'
      type: 'select'
      currentValue: string
      options: (ConfigSelectChoice | ConfigSelectGroup)[]
      _meta?: Record<string, unknown>
    }
  | {
      id: string
      name: string
      description?: string
      category?: string
      type: 'boolean'
      currentValue: boolean
      _meta?: Record<string, unknown>
    }

// Value sent when setting a config option
export type SetConfigOptionValue =
  | { type: 'select'; value: string }
  | { type: 'boolean'; value: boolean }

// --- Terminal ---

export interface TerminalRequest {
  sessionId: string
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  outputByteLimit?: number
}

export interface TerminalOutput {
  output: string
  exitCode?: number
  isRunning: boolean
}

// --- Auth (matches ACP auth model) ---

export type AuthMethod =
  | { type: 'agent' }          // agent handles internally, no client action
  | { type: 'env_var'; name: string; description?: string }  // client sets env var before spawn
  | { type: 'terminal' }       // client runs interactive terminal for auth

export interface AuthenticateRequest {
  methodId: string
}

// --- MCP Server Config ---

export type McpServerConfig =
  | { type?: 'stdio'; name: string; command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'http'; name: string; url: string; headers?: Record<string, string> }
  | { type: 'sse'; name: string; url: string; headers?: Record<string, string> }

// --- Agent Capabilities (from initialize response) ---

export interface AgentCapabilities {
  name: string
  title?: string
  version?: string
  loadSession?: boolean
  promptCapabilities?: {
    image?: boolean
    audio?: boolean
    embeddedContext?: boolean
  }
  sessionCapabilities?: {
    list?: boolean
    fork?: boolean     // unstable_forkSession
    close?: boolean    // unstable_closeSession
  }
  mcp?: { http?: boolean; sse?: boolean }
  authMethods?: AuthMethod[]
}

// --- Session Response (modes, configOptions, models come from session/new response, NOT init) ---

export interface ModelInfo {
  id: string
  name: string
  description?: string
}

export interface SessionModelState {
  currentModelId: string
  availableModels: ModelInfo[]
}

export interface NewSessionResponse {
  sessionId: string
  modes?: SessionModeState
  configOptions?: ConfigOption[]
  models?: SessionModelState
}

// --- Prompt Response ---

export type StopReason = 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled'

export interface PromptResponse {
  stopReason: StopReason
  _meta?: Record<string, unknown>
}

// --- Content Blocks (for prompt input) ---

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string; uri?: string }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; text?: string; blob?: string; mimeType?: string } }
  | { type: 'resource_link'; uri: string; name: string; mimeType?: string; title?: string; description?: string; size?: number }

// --- Session List ---

export interface SessionListItem {
  sessionId: string
  title?: string
  createdAt: string
  updatedAt?: string
  _meta?: Record<string, unknown>
}

export interface SessionListResponse {
  sessions: SessionListItem[]
  nextCursor?: string
}
```

### Expanded AgentEvent union

```typescript
export type AgentEvent =
  // Existing (unchanged)
  | { type: "text"; content: string }
  | { type: "thought"; content: string }
  | { type: "tool_call"; id: string; name: string; kind?: string; status: string; content?: unknown; locations?: unknown; rawInput?: unknown; rawOutput?: unknown; meta?: unknown }
  | { type: "tool_update"; id: string; name?: string; kind?: string; status: string; content?: unknown; locations?: unknown; rawInput?: unknown; rawOutput?: unknown; meta?: unknown }
  | { type: "plan"; entries: PlanEntry[] }
  | { type: "usage"; tokensUsed?: number; contextSize?: number; cost?: { amount: number; currency: string } }
  | { type: "commands_update"; commands: AgentCommand[] }
  | { type: "image_content"; data: string; mimeType: string }
  | { type: "audio_content"; data: string; mimeType: string }
  | { type: "session_end"; reason: string }
  | { type: "error"; message: string }
  | { type: "system_message"; message: string }
  // NEW
  | { type: "session_info_update"; title?: string; updatedAt?: string; _meta?: Record<string, unknown> }
  | { type: "current_mode_update"; modeId: string }
  | { type: "config_option_update"; options: ConfigOption[] }
  | { type: "user_message_chunk"; content: string }
  | { type: "resource_content"; uri: string; name: string; text?: string; blob?: string; mimeType?: string }
  | { type: "resource_link"; uri: string; name: string; mimeType?: string; title?: string; description?: string; size?: number }
  // Model selection
  | { type: "model_update"; modelId: string }
```

### Expanded OutgoingMessage.type

```typescript
export interface OutgoingMessage {
  type:
    | "text" | "thought" | "tool_call" | "tool_update" | "plan" | "usage"
    | "session_end" | "error" | "attachment" | "system_message"
    // NEW
    | "mode_change" | "config_update" | "model_update" | "user_replay" | "resource" | "resource_link"
  text: string
  metadata?: Record<string, unknown>
  attachment?: Attachment
}
```

---

## Section 3: AgentInstance — Full ACP Client

### New client → agent methods

```typescript
class AgentInstance {
  // NEW methods
  async authenticate(request: AuthenticateRequest): Promise<void>
  async loadSession(sessionId: string, cwd: string, mcpServers?: McpServerConfig[]): Promise<void>
  async listSessions(cwd?: string, cursor?: string): Promise<SessionListResponse>
  async setMode(sessionId: string, modeId: string): Promise<void>
  async setConfigOption(sessionId: string, configId: string, value: SetConfigOptionValue): Promise<void>
  async setModel(sessionId: string, modelId: string): Promise<void>
  async forkSession(sessionId: string): Promise<string>  // returns new sessionId (unstable)
  async closeSession(sessionId: string): Promise<void>   // graceful close (unstable)
}
```

### New agent → client callbacks

```typescript
// Terminal management
onTerminalCreate?: (req: TerminalRequest) => Promise<{ terminalId: string }>
onTerminalOutput?: (sessionId: string, terminalId: string) => Promise<TerminalOutput>
onTerminalWaitForExit?: (sessionId: string, terminalId: string) => Promise<{ exitCode: number }>
onTerminalKill?: (sessionId: string, terminalId: string) => Promise<void>
onTerminalRelease?: (sessionId: string, terminalId: string) => Promise<void>
```

### session/update handling expansion

New cases in the sessionUpdate switch:

| Update type | Action |
|-------------|--------|
| `session_info_update` | Emit `{ type: 'session_info_update', title, updatedAt, _meta }` |
| `current_mode_update` | Emit `{ type: 'current_mode_update', modeId }` |
| `config_option_update` | Emit `{ type: 'config_option_update', options }` |
| `user_message_chunk` | Emit `{ type: 'user_message_chunk', content }` |

### Capability negotiation expansion

```typescript
// Client capabilities sent in initialize:
capabilities: {
  fs: { readTextFile: true, writeTextFile: true },
  terminal: true,
}

// Agent capabilities stored from response:
interface AgentCapabilities {
  // ... all fields from Section 2
}
```

### Protocol version negotiation

```typescript
// After initialize response:
if (response.protocolVersion !== 1) {
  log.warn({ expected: 1, got: response.protocolVersion }, 'Protocol version mismatch — continuing with degraded compatibility')
}
```

### tool_call rawOutput forwarding

Currently `rawOutput` is not captured from tool_call/tool_call_update events. Add it to the event emission so adapters can display it.

---

## Section 4: SessionBridge Updates

### New event wiring

```typescript
// In wireSessionToAdapter():

case 'session_info_update':
  if (event.title) {
    this.session.setName(event.title)
    // setName triggers 'named' event → renameSessionThread
  }
  // Forward full event for adapter to handle metadata
  this.adapter.sendMessage(this.session.id,
    this.deps.messageTransformer.transform(event))
  break

case 'current_mode_update':
  this.session.currentMode = event.modeId
  this.adapter.sendMessage(this.session.id,
    this.deps.messageTransformer.transform(event))
  break

case 'config_option_update':
  this.session.configOptions = event.options
  this.adapter.sendMessage(this.session.id,
    this.deps.messageTransformer.transform(event))
  break

case 'user_message_chunk':
  this.adapter.sendMessage(this.session.id,
    this.deps.messageTransformer.transform(event))
  break

case 'resource_content':
case 'resource_link':
  this.adapter.sendMessage(this.session.id,
    this.deps.messageTransformer.transform(event))
  break
```

---

## Section 5: MessageTransformer Updates

New transform cases:

```typescript
case 'session_info_update':
  return { type: 'system_message', text: `Session updated: ${event.title ?? ''}`.trim(), metadata: { title: event.title, updatedAt: event.updatedAt } }

case 'current_mode_update':
  return { type: 'mode_change', text: `Mode: ${event.modeId}`, metadata: { modeId: event.modeId } }

case 'config_option_update':
  return { type: 'config_update', text: 'Config updated', metadata: { options: event.options } }

case 'user_message_chunk':
  return { type: 'user_replay', text: event.content }

case 'resource_content':
  return { type: 'resource', text: event.name, metadata: { uri: event.uri, text: event.text, blob: event.blob, mimeType: event.mimeType } }

case 'resource_link':
  return { type: 'resource_link', text: event.name, metadata: { uri: event.uri, mimeType: event.mimeType, title: event.title, description: event.description, size: event.size } }
```

---

## Section 6: Session Model Updates

```typescript
class Session {
  // NEW properties
  currentMode?: string
  availableModes: SessionMode[] = []
  configOptions: ConfigOption[] = []
  agentCapabilities?: AgentCapabilities

  // NEW methods
  async setMode(modeId: string): Promise<void> {
    await this.agentInstance.setMode(this.agentSessionId, modeId)
    this.currentMode = modeId
    this.emit('mode_changed', modeId)
  }

  async setConfigOption(configId: string, value: string): Promise<void> {
    await this.agentInstance.setConfigOption(this.agentSessionId, configId, value)
    this.emit('config_changed', { configId, value })
  }
}
```

---

## Section 7: New Modules

### TerminalManager (`core/sessions/terminal-manager.ts`)

```typescript
class TerminalManager {
  private terminals = new Map<string, Map<string, TerminalProcess>>()

  async create(sessionId: string, req: TerminalRequest): Promise<string>
  async getOutput(sessionId: string, terminalId: string): Promise<TerminalOutput>
  async waitForExit(sessionId: string, terminalId: string): Promise<number>
  async kill(sessionId: string, terminalId: string): Promise<void>
  async release(sessionId: string, terminalId: string): Promise<void>
  destroyAll(sessionId: string): void
}
```

Manages child processes per session. Each terminal has:
- Spawned `ChildProcess`
- Output buffer (capped at `outputByteLimit`)
- Exit code tracking
- Cleanup on session end

### McpManager (`core/agents/mcp-manager.ts`)

```typescript
class McpManager {
  // Resolve MCP server configs from user config + session overrides
  resolve(sessionConfig?: McpServerConfig[]): McpServerConfig[]
}
```

Reads MCP server configs from `config.json` and merges with per-session overrides. Passes to `agent-instance.createSession()`.

### AuthHandler (`core/agents/auth-handler.ts`)

```typescript
class AuthHandler {
  // Check if agent requires auth, handle per auth method type
  async handleIfNeeded(agentInstance: AgentInstance, agentCaps: AgentCapabilities): Promise<void>
}
```

Checks `agentCaps.authMethods` and handles each type:
- `agent`: No client action needed — agent handles auth internally
- `env_var`: Set required environment variables before agent spawn (read from config or prompt user)
- `terminal`: Spawn interactive terminal for user to authenticate (e.g., OAuth flow)

---

## Section 8: FileService Updates

```typescript
// core/utils/file-service.ts

// UPDATE existing readTextFile to support line/limit:
async readTextFile(path: string, options?: { line?: number; limit?: number }): Promise<string> {
  const content = await fs.readFile(path, 'utf-8')
  if (!options?.line && !options?.limit) return content

  const lines = content.split('\n')
  const start = (options.line ?? 1) - 1  // 1-indexed
  const end = options.limit ? start + options.limit : lines.length
  return lines.slice(start, end).join('\n')
}
```

---

## Section 9: Adapter Updates for New Events

All 3 adapters need to handle new `OutgoingMessage` types in their `dispatchMessage` flow:

### MessagingAdapter base class

Add handler stubs:

```typescript
protected async handleModeChange(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleConfigUpdate(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleUserReplay(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleResource(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
protected async handleResourceLink(_sessionId: string, _content: OutgoingMessage): Promise<void> {}
```

Update `dispatchMessage` switch to include new types.

### BaseRenderer

Add render methods:

```typescript
renderModeChange(content: OutgoingMessage): RenderedMessage
renderConfigUpdate(content: OutgoingMessage): RenderedMessage
renderResource(content: OutgoingMessage): RenderedMessage
renderResourceLink(content: OutgoingMessage): RenderedMessage
```

### Platform adapters

Each adapter overrides new handlers as needed:
- **Telegram**: render mode/config as HTML messages, resource_link as clickable links
- **Discord**: render as embeds
- **Slack**: render as Block Kit

---

## Section 10: Migration Strategy & Execution Order

### Step 1: Folder restructure (pure mechanical, no logic changes)
- Move all files to new locations
- Update ALL import paths (~200+ files affected)
- Update `tsconfig.json` paths if needed
- Update `src/index.ts` public API exports
- Run `pnpm build && pnpm test` — must pass
- Single commit: `refactor: restructure project folders`

### Step 2: Expand types (additive only)
- Add all new types to `core/types.ts`
- Expand `AgentEvent` union
- Expand `OutgoingMessage.type` union
- Run build — must pass (existing code unaffected)
- Commit: `feat(types): add ACP protocol types for modes, config, terminal, auth`

### Step 3: Update AgentInstance (core ACP client)
- TDD: write tests for new methods first
- Add `authenticate`, `loadSession`, `listSessions`, `setMode`, `setConfigOption`
- Handle new `session/update` types
- Add terminal callbacks
- Capability negotiation expansion
- Protocol version check
- `rawOutput` forwarding
- Commit: `feat(agent): implement full ACP client with modes, config, terminal, auth`

### Step 4: Add TerminalManager
- TDD: write tests first
- Implement terminal subprocess management
- Wire into AgentInstance callbacks
- Commit: `feat(terminal): add TerminalManager for agent-controlled terminals`

### Step 5: Update Session model
- TDD: test mode/config/model state management
- Add new properties: `currentMode`, `availableModes`, `configOptions`, `agentCapabilities`, `models`
- Add new methods: `setMode()`, `setConfigOption()`, `setModel()`
- Commit: `feat(session): add mode, config, and model state management`

### Step 6: Update SessionBridge + MessageTransformer
- TDD: write tests for new event wiring
- Wire new events through bridge (depends on Session having new properties from Step 5)
- Transform new event types
- Commit: `feat(bridge): wire ACP mode, config, resource events to adapters`

### Step 7: Add McpManager + AuthHandler
- TDD: tests first
- Implement MCP config resolution
- Implement auth flow
- Commit: `feat(agents): add MCP server passthrough and auth handling`

### Step 8: Update FileService
- TDD: test line/limit support
- Update readTextFile
- Commit: `feat(fs): add line/limit support to readTextFile`

### Step 9: Update adapters for new events
- Add handler stubs to MessagingAdapter
- Add render methods to BaseRenderer
- Update Telegram/Discord/Slack handlers
- Commit: `feat(adapters): handle mode, config, resource message types`

### Step 10: Integration tests
- End-to-end tests for full ACP flow
- Mode switching flow
- Config option flow
- Terminal flow
- Session load/list flow
- Commit: `test: add integration tests for full ACP protocol coverage`

---

## Testing Strategy

**TDD for ALL new code.** Write tests before implementation.

### Unit tests per module

| Module | Test file | Key tests |
|--------|-----------|-----------|
| TerminalManager | `sessions/__tests__/terminal-manager.test.ts` | create, output buffering, kill, cleanup on session end, outputByteLimit |
| McpManager | `agents/__tests__/mcp-manager.test.ts` | resolve from config, merge overrides, empty config |
| AuthHandler | `agents/__tests__/auth-handler.test.ts` | skip if no auth needed, handle token auth |
| AgentInstance (new methods) | `agents/__tests__/agent-instance-acp.test.ts` | setMode, setConfigOption, listSessions, loadSession, authenticate, terminal callbacks, new session/update types |
| SessionBridge (new events) | `sessions/__tests__/session-bridge-acp.test.ts` | mode_update wired, config_update wired, session_info_update triggers rename, resource events forwarded |
| MessageTransformer (new types) | `core/__tests__/message-transformer-acp.test.ts` | transform each new event type |
| Session (new state) | `sessions/__tests__/session-modes.test.ts` | setMode, setConfigOption, state tracking |
| FileService (line/limit) | `utils/__tests__/file-service-lines.test.ts` | readTextFile with line, limit, both, neither |

### Integration tests

| Test | File | Flow |
|------|------|------|
| Mode switching | `__tests__/acp-modes.test.ts` | user → setMode → agent → current_mode_update → adapter |
| Config options | `__tests__/acp-config.test.ts` | user → setConfigOption → agent → config_option_update → adapter |
| Terminal | `__tests__/acp-terminal.test.ts` | agent requests terminal → create → output → kill → release |
| Session load | `__tests__/acp-session-load.test.ts` | loadSession → user_message_chunk replay → prompt |
| Session list | `__tests__/acp-session-list.test.ts` | listSessions with pagination |

---

## Expected Outcomes

| Metric | Before | After |
|--------|--------|-------|
| Core root files | 44 flat | 8 root + grouped subdirs |
| cli/commands.ts | 63KB 1 file | ~8 files, ~8KB each |
| ACP features missing | 17 | 0 |
| Test organization | 3 patterns | 1 pattern (`__tests__/`) |
| AgentInstance ACP methods | 4 | 12 (+ authenticate, loadSession, listSessions, setMode, setConfigOption, setModel, forkSession, closeSession) |
| OutgoingMessage types | 10 | 16 |
| AgentEvent types | 12 | 19 |
