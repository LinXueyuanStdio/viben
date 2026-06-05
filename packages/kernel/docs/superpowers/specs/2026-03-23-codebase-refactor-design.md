# Viben Codebase Refactor — Design Spec

**Date:** 2026-03-23
**Approach:** Layered by dependency (bottom-up)
**Method:** TDD — write tests before each change, verify all existing tests pass after

## Problem Summary

The codebase has grown organically across 5 phases of features. While individual subsystems (agents, tunnel, speech, file service, session store) are well-designed, four areas have accumulated technical debt:

1. **AgentInstance callbacks** — `onSessionUpdate` is monkey-patched in `Session.autoName()`, fragile and race-prone
2. **VibenCore god object** — 686 lines, 3 separate session creation flows, inline security checks, side-effect wiring
3. **Adapter duplication** — Permission auto-approve logic copy-pasted across Telegram and Discord (and upcoming Slack PR #42); text buffering, tool tracking patterns duplicated. Adding WhatsApp (Phase 5) would further multiply this.
4. **API server monolith** — 1115 lines, all routes in one file

### Subsystems NOT being refactored (already well-designed)

- Agent flow (AgentManager, AgentCatalog, AgentStore, agent-dependencies)
- Tunnel (TunnelService, TunnelRegistry, ViewerStore)
- Speech (SpeechService, GroqSTT, provider pattern)
- File service (FileService — small, focused)
- Session store (JsonFileSessionStore — debounced writes, TTL cleanup)
- Config (ConfigManager, config-migrations — Zod validation, env overrides)

---

## Section 1: AgentInstance Callback Removal

### Problem

`AgentInstance` uses two callback properties assigned externally:

```typescript
// agent-instance.ts — current
onSessionUpdate: (event: AgentEvent) => void = () => {};
onPermissionRequest: (request: PermissionRequest) => Promise<string> = async () => "";
```

`SessionBridge.wireAgentToSession()` assigns `onSessionUpdate` directly. Worse, `Session.autoName()` temporarily replaces the handler:

```typescript
// session.ts:223-227 — monkey-patching
const originalHandler = this.agentInstance.onSessionUpdate;
this.agentInstance.onSessionUpdate = (event) => {
  if (event.type === "text") title += event.content;
};
// ... later restores originalHandler
```

If any code sets `onSessionUpdate` during autoName, events are silently lost.

### Design

**AgentInstance extends TypedEmitter** for session updates:

```typescript
interface AgentInstanceEvents {
  agent_event: (event: AgentEvent) => void;  // renamed from onSessionUpdate
}

class AgentInstance extends TypedEmitter<AgentInstanceEvents> {
  // Remove: onSessionUpdate callback property
  // Keep: onPermissionRequest as callback property (1:1 relationship, needs return value)
  //       This is an intentional exception — permission is request/response, not broadcast.
  onPermissionRequest: (request: PermissionRequest) => Promise<string> = async () => "";
}
```

**Internal callsites to update in AgentInstance:**
- `createClient().sessionUpdate()` (line 311-376): change `self.onSessionUpdate(event)` → `self.emit('agent_event', event)`
- `setupCrashDetection()` (line 220-221): change `this.onSessionUpdate({type: "error", ...})` → `this.emit('agent_event', {type: "error", ...})`

**SessionBridge** subscribes via `.on()`:

```typescript
private wireAgentToSession(): void {
  this.agentUpdateHandler = (event: AgentEvent) => {
    this.session.emit('agent_event', event);
  };
  this.session.agentInstance.on('agent_event', this.agentUpdateHandler);
}

// disconnect() removes listener via .off()
// Reset permission callback to no-op
```

**autoName** — listens directly on AgentInstance (before Session emitter) + uses Session pause to suppress adapter delivery:

The key insight: `TypedEmitter.pause()` buffers events and does NOT deliver them to listeners. So we cannot use `this.on("agent_event", titleCollector)` while paused — the collector would never fire. Instead, attach the collector directly to AgentInstance's emitter (which is NOT paused), and use Session's pause to prevent SessionBridge from forwarding autoName output to the adapter.

```typescript
private async autoName(): Promise<void> {
  let title = "";

  // Listen on AgentInstance directly — this emitter is NOT paused,
  // so titleCollector receives events even while Session is paused.
  const titleCollector = (event: AgentEvent) => {
    if (event.type === "text") title += event.content;
  };
  this.agentInstance.on("agent_event", titleCollector);

  // Pause Session emitter — SessionBridge's listener won't receive events,
  // so adapter never sees autoName output.
  this.pause();

  try {
    await this.agentInstance.prompt("Summarize this conversation...");
    this.name = title.trim().slice(0, 50) || `Session ${this.id.slice(0, 6)}`;
    this.emit("named", this.name);
  } catch {
    this.name = `Session ${this.id.slice(0, 6)}`;
  } finally {
    this.agentInstance.off("agent_event", titleCollector);
    this.clearBuffer();  // Discard buffered autoName events
    this.resume();
  }
}
```

**Event naming**: Both AgentInstance and Session use `agent_event` as the event name. This is intentional — the event represents the same concept (an event from the agent) at different layers. SessionBridge bridges them: `agentInstance.on("agent_event") → session.emit("agent_event")`.

### Files changed

- `src/core/agent-instance.ts` — extend TypedEmitter, emit `agent_event` instead of calling `onSessionUpdate` callback. Update `createClient().sessionUpdate()` and `setupCrashDetection()` internal callsites.
- `src/core/session.ts` — rewrite autoName to listen on AgentInstance + pause Session
- `src/core/session-bridge.ts` — subscribe via `.on()`, disconnect via `.off()`

### Tests (write BEFORE implementation)

1. AgentInstance emits `agent_event` when ACP sends events
2. Multiple listeners on `agent_event` all receive events
3. autoName: events during autoName are NOT forwarded to adapter
4. autoName: events AFTER autoName resume normal delivery
5. Permission: SessionBridge handler resolves PermissionGate correctly
6. Disconnect: after bridge disconnect, events stop flowing

---

## Section 2: Core Decomposition

### Problem

`VibenCore` (686 lines) does too much: security, session creation (3 flows), side-effect wiring, archive, message routing.

### Design

#### a) SecurityGuard — extract security checks

```typescript
// src/core/security-guard.ts
export class SecurityGuard {
  constructor(
    private configManager: ConfigManager,
    private sessionManager: SessionManager,
  ) {}

  checkAccess(message: IncomingMessage):
    | { allowed: true }
    | { allowed: false; reason: string }
  {
    const config = this.configManager.get();

    // Check allowed user IDs
    if (config.security.allowedUserIds.length > 0) {
      const userId = String(message.userId);
      if (!config.security.allowedUserIds.includes(userId)) {
        return { allowed: false, reason: "Unauthorized user" };
      }
    }

    // Check concurrent session limit
    const active = this.sessionManager.listSessions()
      .filter(s => s.status === "active" || s.status === "initializing");
    if (active.length >= config.security.maxConcurrentSessions) {
      return { allowed: false, reason: `Session limit reached (${config.security.maxConcurrentSessions})` };
    }

    return { allowed: true };
  }
}
```

Currently `handleMessage()` has 30 lines of inline security checks. Extracting enables:
- Independent testing without mocking adapters
- Reuse in API server (currently no `allowedUserIds` check there)

#### b) SessionFactory — unify 3 creation flows

```typescript
// src/core/session-factory.ts
export class SessionFactory {
  constructor(
    private agentManager: AgentManager,
    private sessionManager: SessionManager,
    private speechService: SpeechService,
  ) {}

  async create(params: {
    channelId: string;
    agentName: string;
    workingDirectory: string;
    resumeAgentSessionId?: string;
    existingSessionId?: string;
    initialName?: string;
  }): Promise<Session> {
    // 1. Spawn or resume agent
    // 2. Create Session object
    // 3. Register in SessionManager
    // 4. Persist initial record
    // Returns session (no side-effects wired yet)
  }

  wireSideEffects(session: Session, deps: {
    usageStore?: UsageStore;
    usageBudget?: UsageBudget;
    notificationManager: NotificationManager;
    tunnelService?: TunnelService;
  }): void {
    // Wire usage tracking (currently inline in core.createSession, 20 lines)
    // Wire tunnel cleanup on session end (currently inline, 15 lines)
  }
}
```

Currently `createSession()` is 110 lines mixing creation + side-effects. The factory separates:
- **Creation** (spawn agent, create Session, register) — pure, testable
- **Side-effects** (usage tracking, tunnel cleanup) — wired separately

#### c) Move permission auto-approve to SessionBridge

Currently copy-pasted in Telegram and Discord adapters (and upcoming Slack PR #42):

```typescript
// telegram/adapter.ts, discord/adapter.ts — same logic
if (request.description.includes("viben")) {
  const allowOption = request.options.find(o => o.isAllow);
  if (allowOption && session.permissionGate.requestId === request.id) {
    session.permissionGate.resolve(allowOption.id);
  }
  return;
}
if (session.dangerousMode) {
  // same pattern...
}
```

Move to SessionBridge. Note: `onPermissionRequest` stays as a callback property (not emitter) because it's a 1:1 request/response pattern that needs a return value. This is consistent with Section 1's decision.

```typescript
// session-bridge.ts — wirePermissions()
this.session.agentInstance.onPermissionRequest = async (request) => {
  // Auto-approve viben commands
  if (request.description.includes("viben")) {
    const allow = request.options.find(o => o.isAllow);
    if (allow) return allow.id;
  }

  // Auto-approve in dangerous mode
  if (this.session.dangerousMode) {
    const allow = request.options.find(o => o.isAllow);
    if (allow) return allow.id;
  }

  // Otherwise: send to adapter for user response
  const promise = this.session.permissionGate.setPending(request);
  this.session.emit("permission_request", request);
  await this.adapter.sendPermissionRequest(this.session.id, request);
  return promise;
};
```

Adapters only need to display the permission UI — no more auto-approve logic.

#### d) archiveSession stays in Core

Initially considered moving to SessionManager, but `archiveSession()` calls `adapter.archiveSessionTopic()` which requires access to the adapters map. SessionManager has no reference to adapters and adding one would be a leaky abstraction. Keep in Core — it's orchestration that coordinates session + adapter.

#### e) Core after refactor (~350 lines)

```typescript
class VibenCore {
  // Managers
  configManager, agentCatalog, agentManager, sessionManager
  notificationManager, messageTransformer, fileService, speechService
  eventBus, usageStore, usageBudget

  // New
  securityGuard: SecurityGuard
  sessionFactory: SessionFactory

  // Simplified
  async handleMessage(message)     // guard.checkAccess → route → session.enqueuePrompt
  async createSession(params)      // factory.create → factory.wireSideEffects → bridge.connect
  async handleNewSession(...)      // resolve agent/workspace → createSession
  async adoptSession(...)          // validate → createSession

  // Kept: archiveSession (needs adapter access)
  // Moved out: security checks → SecurityGuard
  // Moved out: session creation → SessionFactory
  // Moved out: auto-approve → SessionBridge
}
```

### Files changed

- NEW: `src/core/security-guard.ts` (~50 lines)
- NEW: `src/core/session-factory.ts` (~120 lines)
- `src/core/core.ts` — shrink from ~686 to ~300 lines
- `src/core/session-bridge.ts` — add auto-approve logic

### Tests (write BEFORE implementation)

1. SecurityGuard: reject unauthorized userId
2. SecurityGuard: reject when session limit reached
3. SecurityGuard: allow when no restrictions configured
4. SessionFactory: create session with spawn
5. SessionFactory: create session with resume (fallback to new if resume fails)
6. SessionFactory.wireSideEffects: usage tracking hooks work
7. SessionBridge: auto-approve viben commands
8. SessionBridge: auto-approve in dangerous mode
9. SessionBridge: non-viben requests go to adapter

---

## Section 3: Shared Adapter Layer

### Problem

Telegram and Discord adapters duplicate patterns. Slack adapter (PR #42, pending merge) adds a third. Adding WhatsApp (Phase 5) would further multiply the duplication.

### Design Principle

**Interface-first, not inheritance.** The adapters differ too much in implementation details for base classes to work:
- SendQueue: Telegram/Discord=interval-based, Slack (PR #42)=per-method RPM via p-queue
- Text buffering: Telegram/Discord=edit existing message, Slack=post new message after idle
- Formatting: Telegram=HTML, Discord=Markdown, Slack=Block Kit mrkdwn

Share **pure logic** and **routing patterns**, not platform bindings.

### Components

#### a) MessageDispatcher — routing pattern

All 3 adapters have a switch on `content.type` in `sendMessage()`. Extract the pattern:

```typescript
// src/adapters/shared/message-dispatcher.ts
export interface MessageHandlers<TCtx = unknown> {
  onText(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onThought(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onToolCall(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onToolUpdate(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onPlan(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onUsage(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onSessionEnd(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onError(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onAttachment(ctx: TCtx, content: OutgoingMessage): Promise<void>;
  onSystemMessage(ctx: TCtx, content: OutgoingMessage): Promise<void>;
}

export async function dispatchMessage<TCtx>(
  handlers: MessageHandlers<TCtx>,
  ctx: TCtx,
  content: OutgoingMessage,
): Promise<void> {
  switch (content.type) {
    case "text": return handlers.onText(ctx, content);
    case "thought": return handlers.onThought(ctx, content);
    case "tool_call": return handlers.onToolCall(ctx, content);
    case "tool_update": return handlers.onToolUpdate(ctx, content);
    case "plan": return handlers.onPlan(ctx, content);
    case "usage": return handlers.onUsage(ctx, content);
    case "session_end": return handlers.onSessionEnd(ctx, content);
    case "error": return handlers.onError(ctx, content);
    case "attachment": return handlers.onAttachment(ctx, content);
    case "system_message": return handlers.onSystemMessage(ctx, content);
    default: return; // Forward-compat: ignore unknown types without crashing
  }
}
```

Each adapter implements `MessageHandlers` with its platform-specific logic. `TCtx` is adapter-specific context (e.g., `{ sessionId: string, threadId: number }` for Telegram).

#### b) Interfaces for cross-adapter patterns

```typescript
// src/adapters/shared/types.ts
export interface ITextBuffer {
  append(text: string): void;
  flush(): Promise<void>;
  destroy(): void;
}

export interface ISendQueue<T = unknown> {
  enqueue<R>(fn: () => Promise<R>): Promise<R>;
}
```

These are type contracts only — no shared implementation (because each platform's rate limiting is fundamentally different).

### File structure

```
src/adapters/
  shared/
    message-dispatcher.ts    — dispatchMessage() + MessageHandlers interface
    types.ts                 — ITextBuffer, ISendQueue interfaces
  telegram/  (existing, adopt MessageHandlers)
  discord/   (existing, adopt MessageHandlers)
  slack/     (existing, adopt MessageHandlers)
```

### Impact on each adapter

- **Telegram** `sendMessage()`: 220-line switch → `dispatchMessage(this, ctx, content)` + 10 handler methods (~15 lines each)
- **Discord** `sendMessage()`: 140-line switch → same pattern
- **Slack** `sendMessage()`: already small, but benefits from consistent pattern

### Tests

1. dispatchMessage: routes each content.type to correct handler
2. dispatchMessage: unknown type is no-op (no crash)

---

## Section 4: API Server Split

### Problem

`api-server.ts` is 1115 lines with all routes, auth, parsing, and static serving in one file.

### Design

```
src/core/api/
  index.ts            — ApiServer class (setup, auth, listen, stop) ~150 lines
  middleware.ts        — auth check, body parsing, readBody helper
  router.ts            — lightweight path matching (no express dependency)
  routes/
    health.ts          — GET /health, /version, /adapters
    sessions.ts        — GET/POST/DELETE /api/sessions/*
    config.ts          — GET/PUT /api/config/*
    topics.ts          — GET/DELETE /api/topics/*, cleanup
    tunnel.ts          — GET/POST/DELETE /api/tunnels/*
    usage.ts           — GET /api/usage/*
    agents.ts          — GET /api/agents/*
    notify.ts          — POST /api/notify
```

#### Router (no external dependency)

```typescript
// src/core/api/router.ts
type Handler = (req: http.IncomingMessage, res: http.ServerResponse, params: Record<string, string>) => Promise<void>;

export class Router {
  private routes: Array<{ method: string; pattern: RegExp; keys: string[]; handler: Handler }> = [];

  get(path: string, handler: Handler): void { this.add("GET", path, handler); }
  post(path: string, handler: Handler): void { this.add("POST", path, handler); }
  put(path: string, handler: Handler): void { this.add("PUT", path, handler); }
  delete(path: string, handler: Handler): void { this.add("DELETE", path, handler); }

  match(method: string, url: string): { handler: Handler; params: Record<string, string> } | null

  private add(method: string, path: string, handler: Handler): void
}
```

#### Route module pattern

```typescript
// src/core/api/routes/sessions.ts
export function registerSessionRoutes(router: Router, core: VibenCore): void {
  router.get("/api/sessions", async (req, res, params) => {
    // list sessions
  });
  router.get("/api/sessions/:id", async (req, res, params) => {
    // get session by params.id
  });
  router.post("/api/sessions", async (req, res, params) => {
    // create session
  });
  // ...
}
```

### Backward compatibility

- All API endpoints unchanged
- Auth behavior unchanged
- SSE endpoint unchanged
- Static file serving unchanged

### Files changed

- `src/core/api-server.ts` → keep as thin re-export file: `export { ApiServer, type ApiConfig } from "./api/index.js"` (backward compat for existing imports in `src/main.ts`, `src/core/index.ts`, tests)
- NEW: `src/core/api/index.ts` — ApiServer class (~150 lines)
- NEW: `src/core/api/router.ts`
- NEW: `src/core/api/middleware.ts`
- NEW: `src/core/api/routes/*.ts` (7 files)
- No changes needed to `src/main.ts` or `src/core/index.ts` (they import from `api-server.js` which re-exports)

### Tests

1. Router: path matching with `:id` params
2. Router: method matching (GET vs POST to same path)
3. Auth middleware: reject without token, allow with valid token
4. Existing API tests continue passing (only import paths change)

---

## Section 5: Adapter sendMessage Cleanup

### Problem

After Section 3 provides `MessageDispatcher`, each adapter's `sendMessage()` switch can be replaced.

### Design

Each adapter implements `MessageHandlers`:

```typescript
// Example: Telegram
class TelegramAdapter extends ChannelAdapter<VibenCore> implements MessageHandlers<TelegramMessageCtx> {

  async sendMessage(sessionId: string, content: OutgoingMessage): Promise<void> {
    // Guard checks (session exists, not archiving, valid threadId)
    const session = this.core.sessionManager.getSession(sessionId);
    if (!session || session.archiving) return;
    const threadId = Number(session.threadId);
    if (!threadId || isNaN(threadId)) return;

    // Suppress assistant during init
    if (this.assistantInitializing && sessionId === this.assistantSession?.id) return;

    const ctx: TelegramMessageCtx = { sessionId, threadId };
    await dispatchMessage(this, ctx, content);
  }

  // Each handler: ~10-20 lines of Telegram-specific code
  async onText(ctx: TelegramMessageCtx, content: OutgoingMessage) { ... }
  async onToolCall(ctx: TelegramMessageCtx, content: OutgoingMessage) { ... }
  // ...
}
```

Additionally, `TelegramAdapter.start()` (250 lines) splits into:
- `setupBot()` — bot config, rate limiting, error handler, middleware
- `setupSystemTopics()` — ensure notification + assistant topics
- `setupRoutes()` — already exists
- Assistant spawn — already extracted to `assistant.ts`

### Files changed

- `src/adapters/telegram/adapter.ts` — implement MessageHandlers, split start()
- `src/adapters/discord/adapter.ts` — implement MessageHandlers
- `src/adapters/slack/adapter.ts` — implement MessageHandlers after PR #42 merges (mostly already clean)

### Tests

- Existing adapter tests continue passing
- New: mock MessageHandlers to verify dispatch routes correctly

---

## Execution Order

```
Section 1: AgentInstance callbacks     ← foundation fix, no dependencies
    ↓
Section 2: Core decomposition         ← depends on clean event flow from S1
    ↓
Section 3: Shared adapter layer       ← independent of S1/S2, can overlap with S2
    ↓
Section 4: API server split           ← independent, can overlap with S3
    ↓
Section 5: Adapter sendMessage        ← depends on S3 (MessageDispatcher)
```

Each section: **write tests → implement → verify all tests pass → new branch**.

## Backward Compatibility

- **Config**: No schema changes
- **SessionStore**: No format changes
- **CLI**: No command changes
- **Plugin API**: `ChannelAdapter` base class unchanged
- **API endpoints**: All paths, methods, responses unchanged
- **Adapters**: External behavior preserved (message format, threading, permissions)

## Risk Mitigation

- TDD for all sections: tests first, then refactor
- Each section independently deployable and revertable
- All existing tests must pass after each section
- Branch per section for clean git history
