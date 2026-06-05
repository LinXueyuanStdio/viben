# Multi-Adapter Session Routing Design

**Date**: 2026-04-03
**Status**: Draft
**Approach**: Per-session multi-bridge fan-out (Approach 2)

## Problem

Sessions are currently bound 1:1 to a single adapter via `session.channelId`. A session created on Telegram can only be interacted with from Telegram. SSE/API cannot observe or interact with Telegram sessions, and vice versa.

Adapters are just UI layers — ways to input and receive responses. Sessions and conversation history are stored centrally in core. The 1:1 binding is an artificial limitation.

## Goals

1. Sessions are global — not owned by a single adapter
2. Any adapter can attach to any session via explicit action
3. SSE/API can observe and interact with all sessions (full history available)
4. Telegram/Discord only see sessions they're attached to
5. Response routing: source adapter receives the response
6. SSE always receives all events from all attached sessions
7. System/automation can send prompts and specify which adapter receives the response

## Non-Goals

- Cross-adapter context coherence (accepted limitation — each adapter shows only its own turns)
- Auto-attaching adapters to sessions (must be explicit action)
- Real-time sync of conversation history across adapters (Telegram stores its own, SSE reads from core store)

## Architecture

### Core Concepts

**Primary adapter (`channelId`)**: The adapter that created the session. Serves as default `responseAdapterId` for system-sent prompts. Stored in `SessionRecord`.

**Attached adapters (`attachedAdapters[]`)**: All adapters connected to a session, including the primary. Each has its own `SessionBridge` and thread/topic.

**Turn routing context (`TurnContext`)**: Metadata sealed at prompt dequeue time, carried by every event emitted during that turn. Determines where responses are routed.

```ts
interface TurnContext {
  turnId: string;                    // unique per prompt execution
  sourceAdapterId: string;           // "telegram" | "sse" | "discord" | "system"
  responseAdapterId: string | null;  // override target; null = silent (no UI render)
}
```

**Effective response target**: `turnContext.responseAdapterId ?? turnContext.sourceAdapterId`. When `null`, no adapter renders the response (silent/internal prompt).

### Session Data Model Changes

```ts
// Before
class Session {
  channelId: string;    // single adapter
  threadId: string;     // single thread
}

// After
class Session {
  channelId: string;                      // primary adapter (creator)
  attachedAdapters: string[];             // all adapters connected to this session
  threadIds: Map<string, string>;         // adapterId → threadId (per-adapter)
  activeTurnContext: TurnContext | null;   // set on prompt dequeue, cleared on turn end
}
```

### SessionRecord (Persistence) Changes

```ts
// Before
interface SessionRecord {
  channelId: string;
  platform: { topicId?: number; threadId?: string };
}

// After
interface SessionRecord {
  channelId: string;                // primary adapter (unchanged)
  attachedAdapters: string[];       // persisted adapter list
  platforms: {                      // per-adapter platform data
    telegram?: { topicId: number };
    discord?: { threadId: string };
    sse?: { threadId: string };
    // ...extensible per adapter
  };
}
```

**Migration**: Old records with `platform: { topicId: 123 }` auto-migrate on load to `platforms: { telegram: { topicId: 123 } }`. `channelId` determines which adapter key to use for migration.

### Multi-Bridge Architecture

Each session maintains multiple `SessionBridge` instances — one per attached adapter:

```
Session
  ├── bridges: Map<adapterId, SessionBridge>
  │     ├── "telegram" → SessionBridge (Telegram adapter)
  │     ├── "discord"  → SessionBridge (Discord adapter)
  │     └── "sse"      → SessionBridge (SSE adapter)
  └── activeTurnContext: TurnContext
```

**Bridge forwarding logic** (per event):

```ts
class SessionBridge {
  adapterId: string;

  shouldForward(event: AgentEvent, turnContext: TurnContext): boolean {
    // System events → all attached adapters
    if (isSystemEvent(event)) return true;

    // Silent turn → no adapter renders
    const target = turnContext.responseAdapterId;
    if (target === null) return false;

    // Turn events → only target adapter
    const effectiveTarget = target ?? turnContext.sourceAdapterId;
    return this.adapterId === effectiveTarget;
  }
}
```

**SSE bridge**: Same logic as above. SSE receives events because it's attached to the session. No special-casing — SSE is just another adapter that happens to attach to many/all sessions.

### Event Classification

**Turn events** (routed to response adapter only):
- `text`, `thought`, `tool_call`, `tool_update`, `plan`, `usage`, `error`, `attachment`, `resource`, `resource_link`, `user_replay`

**System events** (broadcast to all attached adapters):
- `session_end`, `mode_change`, `config_update`, `model_update`, `system_message`

### Message Input Flow

```
User types on Telegram
  → TelegramAdapter.handleMessage({ channelId: "telegram", threadId: "123", text: "..." })
  → core.handleMessage(message)
  → session = findByThread("telegram", "123")  // lookup via threadIds map
  → session.enqueuePrompt(text, attachments, { sourceAdapterId: "telegram" })
  → PromptQueue dequeues
  → TurnContext sealed: { turnId: "abc", sourceAdapterId: "telegram", responseAdapterId: undefined }
  → Agent processes, emits events
  → Each event tagged with TurnContext
  → Telegram bridge: shouldForward() → true (effectiveTarget == "telegram")
  → SSE bridge: shouldForward() → false (effectiveTarget != "sse")
       BUT SSE is attached and receives system events
  → Discord bridge: shouldForward() → false
```

**SSE sending to a Telegram session:**

```
SSE client sends to session X
  → POST /sessions/:id/messages { text: "..." }
  → session.enqueuePrompt(text, null, { sourceAdapterId: "sse" })
  → TurnContext: { sourceAdapterId: "sse", responseAdapterId: undefined }
  → Agent responds
  → Telegram bridge: shouldForward() → false (target is "sse")
  → SSE bridge: shouldForward() → true
```

### Silent System Prompts

For internal operations (auto-naming, health checks, etc.) where the response should not render on any UI:

```ts
session.enqueuePrompt("Name this session in 5 words", null, {
  sourceAdapterId: "system",
  responseAdapterId: null,  // silent — no adapter renders
});

// TurnContext: { sourceAdapterId: "system", responseAdapterId: null }
// All bridges: shouldForward() → false (target is null)
// SSE observer connection (if subscribed): receives event tagged silent for debug visibility
```

The response is consumed programmatically by the caller (e.g., session auto-naming extracts the name from the agent's response).

### Permission Handling

**Request flow**: Permission request is a system event → broadcast to ALL attached adapters.

```
Agent requests permission
  → Session emits permission_request
  → ALL bridges forward (system event)
  → Telegram shows inline keyboard
  → SSE shows permission UI
  → Discord shows buttons
```

**Resolution flow**: First adapter to respond wins.

```
SSE user clicks "Allow"
  → resolvePermission(requestId, "allow")
  → PermissionGate resolves (removes from pending map)
  → Core broadcasts "permission:resolved" event to all bridges
  → Telegram updates inline keyboard → "✅ Resolved by SSE"
  → Discord updates buttons → "✅ Resolved by SSE"
  → Late resolution attempts → requestId not in map → silent no-op
```

### Attach / Detach API

**Attach adapter to session:**

```
POST /sessions/:sessionId/attach
Body: { adapterId: "telegram" }

Flow:
1. Validate session exists, adapter is running
2. adapter.createSessionThread(sessionId, sessionName) → threadId
3. session.threadIds.set("telegram", threadId)
4. session.attachedAdapters.push("telegram")
5. Create new SessionBridge for Telegram
6. bridge.connect()
7. Update SessionRecord (persist attachedAdapters + platforms)
8. Send "Session attached" message to new adapter's thread
```

**Detach adapter from session:**

```
POST /sessions/:sessionId/detach
Body: { adapterId: "discord" }

Flow:
1. Send "Session detached" message to Discord thread
2. Bridge disconnect + remove from session.bridges
3. Remove from session.attachedAdapters
4. Remove session.threadIds["discord"]
5. Clean up pending permission UIs on that adapter
6. Update SessionRecord
7. Cannot detach primary adapter (channelId) — error if attempted
```

### Session Creation Flow Changes

```ts
// Before: createSession({ channelId, ... })
// After: createSession({ channelId, ... })
//   channelId becomes primary adapter
//   attachedAdapters initialized to [channelId]
//   threadIds initialized with primary adapter's thread

async createSession(params) {
  const session = await sessionFactory.create(params);
  session.attachedAdapters = [params.channelId];
  session.threadIds = new Map();

  const adapter = this.adapters.get(params.channelId);
  if (params.createThread && adapter) {
    const threadId = await adapter.createSessionThread(session.id, name);
    session.threadIds.set(params.channelId, threadId);
  }

  // Create bridge for primary adapter
  if (adapter) {
    const bridge = this.createBridge(session, adapter);
    bridge.connect();
  }

  // Persist with new format
  await this.sessionManager.patchRecord(session.id, {
    attachedAdapters: session.attachedAdapters,
    platforms: this.buildPlatforms(session),
  });

  return session;
}
```

### Agent Switch Changes

When agent switches, reconnect bridges for ALL attached adapters (not just primary):

```ts
async switchAgent(sessionId, toAgent) {
  // ... existing agent switch logic ...

  // Reconnect ALL bridges
  for (const adapterId of session.attachedAdapters) {
    const adapter = this.adapters.get(adapterId);
    if (adapter) {
      const bridge = this.createBridge(session, adapter);
      bridge.connect();
    }
  }
}
```

### Lazy Resume Changes

When a session is resumed (triggered by any attached adapter), create bridges for ALL attached adapters:

```ts
async getOrResume(channelId, threadId) {
  // ... existing resume logic ...

  if (resumedSession) {
    // Create bridges for ALL attached adapters, not just the triggering one
    for (const adapterId of resumedSession.attachedAdapters) {
      const adapter = this.adapters.get(adapterId);
      if (adapter) {
        const bridge = this.createBridge(resumedSession, adapter);
        bridge.connect();
      }
    }
  }

  return resumedSession;
}
```

### Notification Routing

**Turn-related notifications** (triggered by a specific turn):
- Route to `turnContext.responseAdapterId ?? turnContext.sourceAdapterId`

**System-wide notifications** (not tied to any turn):
- Route to `session.channelId` (primary adapter)

**SSE**: Receives all notifications if attached (same bridge logic — notifications are system events).

### PromptQueue Changes

```ts
// Before
interface QueuedPrompt {
  text: string;
  attachments?: Attachment[];
}

// After
interface QueuedPrompt {
  text: string;
  attachments?: Attachment[];
  routing: {
    sourceAdapterId: string;
    responseAdapterId?: string | null;  // null = silent, undefined = use sourceAdapterId
  };
}
```

### Conversation History Enhancement

Context plugin stores `sourceAdapterId` per message entry:

```ts
interface ConversationEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sourceAdapterId?: string;  // NEW — which adapter sent this message
}
```

SSE/API dashboard can use this to display message provenance.

## Backward Compatibility

1. **SessionRecord migration**: Old `platform: { topicId }` → new `platforms: { telegram: { topicId } }`. Auto-migrate on load using `channelId` to determine adapter.

2. **Missing `attachedAdapters`**: Old records without this field → default to `[channelId]`.

3. **Missing `platforms`**: Fall back to reading old `platform` field → migrate to new format.

4. **`session.threadId` compatibility**: Maintain a getter `get threadId()` that returns `threadIds.get(channelId)` for backward compatibility during migration. Deprecate direct access.

5. **PromptQueue routing**: Old prompts without `routing` field → default `{ sourceAdapterId: session.channelId }`.

## Summary of Changes by Component

| Component | Change |
|---|---|
| `Session` | Add `attachedAdapters`, `threadIds` Map, `activeTurnContext` |
| `SessionRecord` | Add `attachedAdapters`, rename `platform` → `platforms` (per-adapter) |
| `SessionStore` | Auto-migrate old records on load |
| `SessionBridge` | Add `adapterId`, `shouldForward(event, turnContext)` logic |
| `PromptQueue` | Add `routing` metadata to queued prompts |
| `VibenCore` | Multi-bridge creation, attach/detach API, agent switch reconnect all |
| `SessionFactory` | Resume creates bridges for all attached adapters |
| `PermissionGate` | Idempotent resolution (no-op if already resolved) |
| `API Server` | New endpoints: attach, detach, send-to-session |
| `SSE Adapter` | Per-session bridge (same as other adapters), attaches to desired sessions |
| `EventBus` | New event: `permission:resolved` |
| `Context Plugin` | Add `sourceAdapterId` to conversation entries |
