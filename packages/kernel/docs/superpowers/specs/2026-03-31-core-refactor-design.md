# Core Module Refactor Design

**Date**: 2026-03-31
**Scope**: `src/core/` — 3-phase incremental refactor
**Goal**: Break up god objects (`core.ts`, `session.ts`), decouple plugin service dependencies from core, improve testability and maintainability.

## Problem Statement

Three structural issues in the core module:

1. **`core.ts` (929 lines)** — God object. Handles message routing, session creation (5 variants), agent switching (200 lines with rollback), lazy resume, bridge management, adapter lifecycle, and config hot-reload.
2. **`session.ts` (569 lines)** — Session class owns TTS/STT logic (~100 lines) that belongs in the speech plugin, not core.
3. **Tight coupling to plugin services** — `VibenCore` directly accesses `speechService`, `securityGuard`, `tunnelService` via lazy getters. `MessageTransformer` has direct dependency on `TunnelService` for viewer link generation.

## Approach

**Incremental — 3 phases**, each independently testable and deployable. Each phase is a separate commit/PR scope.

---

## Phase 1: Split `core.ts` (~929 → ~400 lines) + organize loose files

### 1d. Group `instance-*` files into `core/instance/`

Four instance-related files sit loose at the root of `core/`:
- `instance-context.ts` (90 lines) — path definitions, resolve instance root
- `instance-registry.ts` (64 lines) — registry CRUD (JSON file)
- `instance-discovery.ts` (63 lines) — find running instances via health check
- `instance-copy.ts` (112 lines) — clone instance config/plugins/agents

All belong to the same domain: **multi-instance management**. Move into `core/instance/` with an `index.ts` re-exporting public API. Update all import paths. No logic changes.

### 1a. Extract `AgentSwitchHandler`

**New file**: `src/core/agent-switch-handler.ts` (~200 lines)

Extract from `core.ts`:
- `switchSessionAgent()` (lock guard)
- `_doSwitchSessionAgent()` (full switch flow with rollback)
- `switchingLocks` set

**Dependencies injected via constructor**:
```typescript
interface AgentSwitchDeps {
  sessionManager: SessionManager;
  agentManager: AgentManager;
  configManager: ConfigManager;
  middlewareChain: MiddlewareChain;
  eventBus: EventBus;
  adapters: Map<string, IChannelAdapter>;
  bridges: Map<string, SessionBridge>;
  createBridge: (session: Session, adapter: IChannelAdapter) => SessionBridge;
  getService: <T>(name: string) => T | undefined;
}
```

**`VibenCore` becomes**:
```typescript
async switchSessionAgent(sessionId: string, toAgent: string) {
  return this.agentSwitchHandler.switch(sessionId, toAgent);
}
```

### 1b. Move lazy resume into `SessionFactory`

Move from `core.ts` into `SessionFactory`:
- `lazyResume()` method
- `getOrResumeSession()` method
- `resumeLocks` map

**Rationale**: `lazyResume()` calls `this.createSession()` on Core, which is a full pipeline (spawn agent, create thread, connect bridge, persist). Moving into `SessionManager` would require injecting this entire pipeline as a callback — awkward and creates implicit circular dependency. `SessionFactory` already owns session creation and has `agentManager` + `sessionManager`. It needs one additional callback `onSessionCreated(session, params)` for Core to handle thread creation + bridge wiring + persistence.

**SessionFactory gains**:
```typescript
// Callback for Core to wire thread + bridge + persist after factory creates the session
onSessionCreated?: (session: Session, params: SessionCreateParams & { threadId?: string }) => Promise<void>;

async getOrResume(channelId: string, threadId: string): Promise<Session | null>
private async lazyResume(channelId: string, threadId: string): Promise<Session | null>
```

**SessionFactory needs**: Access to `SessionStore` (for `findByPlatform` lookup) and `adapters` map (for error feedback). These are injected via constructor.

### 1c. Move convenience session creation methods into `SessionFactory`

Move from `core.ts` into `SessionFactory`:
- `handleNewSession()` (~20 lines) — resolves default agent + workspace, calls create
- `handleNewChat()` (~30 lines) — finds current session's agent, creates new session
- `createSessionWithContext()` (~30 lines) — creates session with context injection

**Keep in `core.ts`**:
- `adoptSession()` (~130 lines) — This is an API endpoint handler that does validation (agent caps, cwd exists, session limit check, adapter lookup) before calling `createSession()`. It's orchestration logic, not factory logic.
- `createSession()` — remains as the primary orchestration entry point

### Phase 1 Result

`core.ts` retains:
- Constructor + service getters (~80 lines)
- `registerAdapter()`, `start()`, `stop()` (~50 lines)
- `handleMessage()` — delegates to SessionFactory for lookup/resume (~30 lines)
- `createSession()` — thin orchestration: factory.create() + thread + bridge + persist (~70 lines)
- `adoptSession()` — validation + orchestration (~130 lines)
- `archiveSession()` (~30 lines)
- `createBridge()` (~15 lines)

**Estimated: ~400 lines**

---

## Phase 2: Clean up `session.ts` (569 → ~400 lines)

### 2a. Extract TTS/Voice logic into speech plugin

**Remove from `session.ts`**:
- `TTS_PROMPT_INSTRUCTION` constant
- `TTS_BLOCK_REGEX`, `TTS_MAX_LENGTH`, `TTS_TIMEOUT_MS`
- `maybeTranscribeAudio()` method (~55 lines)
- `processTTSResponse()` method (~40 lines)
- TTS accumulator logic in `processPrompt()` (~20 lines)

**Challenge**: TTS is **stateful across the prompt lifecycle**:
1. Before prompt: check voiceMode, inject `TTS_PROMPT_INSTRUCTION` into prompt text
2. During prompt: accumulate text from `agent_event` emissions
3. After prompt: extract `[TTS]` block from accumulated text, synthesize audio

A single middleware hook cannot handle this because accumulation happens during prompt execution.

**Solution — event-driven approach**:

1. **STT (before prompt)**: Speech plugin registers `agent:beforePrompt` middleware. Middleware checks session voiceMode, transcribes audio attachments, injects `TTS_PROMPT_INSTRUCTION`. Session no longer knows about STT.

2. **TTS (during + after prompt)**: Speech plugin listens on `EventBus` for `turn:start` (already emitted). On `turn:start`, plugin attaches a temporary `agent_event` listener on the session to accumulate text. On `turn:end` (already emitted), plugin detaches listener, extracts `[TTS]` block, synthesizes audio, and emits `audio_content` event back on the session.

   The `turn:end` event payload already includes `sessionId`. Speech plugin looks up the session via SessionManager to emit back.

**Session changes**:
- `voiceMode` property stays on Session (it's session state)
- `speechService` property removed from Session constructor and SessionFactory
- `processPrompt()` becomes simpler — no TTS/STT branching, just: context injection → middleware → prompt → emit turn:end

### 2b. Keep auto-name in Session

Auto-name uses `agentInstance.prompt()` + `pause()/resume()` emitter. Tightly coupled to Session internals. Not worth extracting.

### Phase 2 Result

`session.ts` retains:
- State machine (~40 lines)
- PromptQueue + processPrompt (simplified, ~60 lines)
- PermissionGate integration (~10 lines)
- Context injection (~15 lines)
- ACP state management (modes/config/model, ~60 lines)
- Agent switch (in-place, ~50 lines)
- Auto-name (~35 lines)
- destroy/warmup (~40 lines)

**Estimated: ~400 lines**

---

## Phase 3: Decouple plugin services

### 3a. Remove tunnel awareness from `MessageTransformer`

**Current**: `MessageTransformer` has `tunnelService` property and `enrichWithViewerLinks()` (110 lines) that directly calls tunnel service APIs.

**Change**: Extract viewer link enrichment into a post-transform middleware hook.

**New middleware hook**: `message:afterTransform` — fired in `SessionBridge.handleAgentEvent()` after `messageTransformer.transform()` returns.

```typescript
// Hook payload
{
  event: AgentEvent;
  message: OutgoingMessage;
  sessionContext: { id: string; workingDirectory: string };
}
```

**Tunnel plugin** registers middleware on `message:afterTransform` that:
1. Calls `extractFileInfo()` on the event
2. Stores diffs/files via tunnel store
3. Enriches `message.metadata` with `viewerLinks` and `diffStats`

**`MessageTransformer` becomes**: Pure `AgentEvent → OutgoingMessage` mapper. No service dependencies. ~200 lines.

**Note**: `computeLineDiff()` and diff stats computation for rawInput stay in `MessageTransformer` — they're pure transform logic, not tunnel-dependent.

### 3b. Graceful service access in Core

**Current**:
```typescript
private getService<T>(name: string): T {
  const svc = this.lifecycleManager.serviceRegistry.get<T>(name);
  if (!svc) throw new Error(`Service '${name}' not registered`);
  return svc;
}
```

**Change**: Return `undefined` instead of throwing. Core handles missing services gracefully:
```typescript
private getService<T>(name: string): T | undefined {
  return this.lifecycleManager.serviceRegistry.get<T>(name);
}
```

**Impact on callers**:
- `securityGuard` — if undefined, **deny all requests** and log error. Security must fail closed, not open. A missing security plugin means misconfiguration, not "allow everyone".
- `notificationManager` — if undefined, skip notifications silently.
- `fileService` — if undefined, skip file operations (images/audio won't be saved).
- `speechService` — if undefined, voice features disabled (already handled).
- `contextManager` — if undefined, skip context injection.

### 3c. Remove `tunnelService` property from Core

**Current**: `VibenCore` has `tunnelService` getter/setter that propagates to `MessageTransformer`.

**Change**: Remove `tunnelService` property and `_tunnelService` field from Core. Tunnel plugin registers itself via ServiceRegistry. Tunnel middleware (from 3a) accesses tunnel service via ServiceRegistry directly.

**Impact on `SessionFactory.wireSideEffects()`**: Currently receives `tunnelService` from Core for tunnel cleanup on session end. Change to: tunnel plugin registers `session:afterDestroy` middleware (already supported) to clean up its own tunnels. `wireSideEffects` no longer needs tunnel dependency — remove `tunnelService` from `SideEffectDeps` interface.

### Phase 3 Result

- `MessageTransformer`: pure transform, no service deps (~200 lines)
- `VibenCore`: no direct tunnel coupling, graceful service degradation
- `SessionFactory`: no tunnel dependency
- Plugin services fully decoupled — core never throws on missing optional service

---

## New Middleware Hooks

| Hook | Phase | Type | Fired from | Purpose |
|------|-------|------|-----------|---------|
| `message:afterTransform` | 3 | Modifiable | `SessionBridge.handleAgentEvent()` | Enrich outgoing messages post-transform (viewer links, etc.) |

**No new hooks needed for Phase 2** — speech plugin uses existing `agent:beforePrompt` middleware + existing `turn:start`/`turn:end` events on EventBus.

---

## Migration & Backward Compatibility

- **No public API changes**: `VibenCore` method signatures stay the same. Only internal delegation changes.
- **No config changes**: No new config fields.
- **Plugin API**: New middleware hooks are additive. Existing hooks unchanged.
- **Import paths**: New files are internal to core. No external consumers affected.
- **Speech plugin**: Existing `speechService` import in Session/SessionFactory removed. Speech plugin must register middleware during `setup()`. If speech plugin is not loaded, voice features are silently disabled (same as today).
- **Tunnel plugin**: Must register `message:afterTransform` middleware and `session:afterDestroy` middleware during `setup()`. If tunnel plugin is not loaded, no viewer links generated (same as today).

## Testing Strategy

Each phase includes:
1. **Move existing tests** — tests that cover extracted logic follow to new file's test suite
2. **Add integration test** — verify the delegation chain (Core → Handler → result) works
3. **Run full test suite** — `pnpm test` must pass after each phase

## File Changes Summary

| Phase | New Files | Modified Files |
|-------|-----------|---------------|
| 1 | `core/agent-switch-handler.ts`, `core/instance/` (4 files moved + index.ts) | `core/core.ts`, `core/sessions/session-factory.ts`, all files importing `instance-*` |
| 2 | None | `core/sessions/session.ts`, `core/sessions/session-factory.ts`, `plugins/speech/` (middleware registration) |
| 3 | None | `core/message-transformer.ts`, `core/core.ts`, `core/sessions/session-bridge.ts`, `core/sessions/session-factory.ts`, `plugins/tunnel/` (middleware registration) |
