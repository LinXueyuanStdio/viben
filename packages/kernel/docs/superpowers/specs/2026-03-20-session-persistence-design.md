# Session Persistence Design

## Problem

When Viben restarts, all session-to-topic mappings are lost. Telegram topics remain but Viben cannot reconnect sessions to them. Users must create new sessions even though `claude-agent-acp` stores conversation history on disk and supports session resume.

## Solution

Lazy resume with JSON file-based session store.

- Persist session metadata (including platform-specific data like `topicId`) to `~/.viben/sessions.json`
- On restart, do NOT auto-resume any sessions (avoids spawning 100 subprocesses at once)
- When user sends a message to an existing topic, lazy-resume: spawn agent, call `unstable_resumeSession(agentSessionId)`, reconnect to topic
- If transcript is missing on disk, spawn a fresh session and update the record
- Auto-cleanup records older than 30 days (configurable)

## Data Model

### SessionRecord

```typescript
interface SessionRecord<P = Record<string, unknown>> {
  sessionId: string           // Viben session ID
  agentSessionId: string      // ID from claude-agent-acp (used for resume)
  agentName: string
  workingDir: string
  channelId: string           // "telegram" | "discord" | "slack"
  status: SessionStatus       // reuse existing type: "initializing" | "active" | "cancelled" | "finished" | "error"
  createdAt: string           // ISO timestamp (converted from Date on save)
  lastActiveAt: string        // ISO timestamp, updated on each message
  name?: string               // Auto-generated session name
  platform: P                 // Platform-specific data
}
```

### Platform Metadata

Each adapter defines its own platform type:

```typescript
// Telegram
interface TelegramPlatformData {
  topicId: number
}

// Future: Discord
interface DiscordPlatformData {
  threadId: string
}

// Future: Slack
interface SlackPlatformData {
  threadTs: string
}
```

### File Format

```json
{
  "version": 1,
  "sessions": { ... }
}
```

Version field enables future schema migrations.

## SessionStore Interface

```typescript
interface SessionStore {
  save(record: SessionRecord): Promise<void>
  get(sessionId: string): SessionRecord | undefined
  findByPlatform(channelId: string, predicate: (platform: Record<string, unknown>) => boolean): SessionRecord | undefined
  list(channelId?: string): SessionRecord[]
  remove(sessionId: string): Promise<void>
}
```

Note: `save()` and `remove()` are async for forward compatibility (SQLite swap). `get()`, `findByPlatform()`, `list()` are sync since they read from in-memory Map only.

`findByPlatform` uses a predicate instead of stringly-typed key/value for type safety:
```typescript
store.findByPlatform("telegram", (p) => p.topicId === 123)
```

### JsonFileSessionStore

- Storage: `~/.viben/sessions.json`
- In-memory `Map` is source of truth
- Debounced disk write (2s after last change)
- Force flush on SIGTERM/SIGINT
- Loads file once on startup
- Auto-cleanup on startup: remove records where `lastActiveAt` > TTL (default 30 days)
- Periodic cleanup: daily interval timer for long-running instances

## Lazy Resume Flow

```
User message in topic
  → adapter receives message with topicId
  → store.findByPlatform("telegram", p => p.topicId === topicId)
  → Record found?
    → Yes: session active in memory?
      → Yes: forward message normally
      → No: acquire resume lock for topicId (prevent concurrent resume)
        → spawn agent subprocess
        → ACP handshake: connection.initialize()
        → call connection.unstable_resumeSession({ sessionId: agentSessionId, cwd: workingDir })
        → if resume fails → fallback to connection.newSession({ cwd })
        → wire events, attach to topic
        → release lock, forward message
    → No: spawn new session → create new record with topicId → forward
```

### Concurrency Guard

A per-topic resume lock prevents duplicate spawns when multiple messages arrive for the same topic before resume completes. Messages arriving during resume are queued and forwarded after resume finishes.

### Resume Method Detail

`AgentInstance.resume()` follows the same flow as `spawn()`:
1. Resolve agent command
2. Spawn subprocess with stdio pipes
3. Create ACP connection
4. **`connection.initialize()`** — full ACP handshake (required for new subprocess)
5. **`connection.unstable_resumeSession({ sessionId, cwd })`** instead of `newSession()`
6. Set up crash detection and event wiring
7. If `unstable_resumeSession` fails → fallback to `newSession({ cwd })`

Note: `unstable_resumeSession` is marked `@experimental` in the ACP SDK. If removed in a future version, fallback to `loadSession()` (stable, replays history).

### Save Timing

`SessionRecord` is saved AFTER `AgentInstance.spawn()` completes, since `agentSessionId` is only available after ACP session creation.

## Record Lifecycle

### Writes

- `save()` on new session creation (after spawn completes and `agentSessionId` is available)
- `save()` on successful resume (update `agentSessionId` if it changed)
- Update `lastActiveAt` on each message (debounced 2s)
- Update `status` when session finishes, cancels, or errors

### Auto-cleanup

- Runs on startup + daily interval timer
- Removes records where `lastActiveAt` > `sessionStore.ttlDays` (default 30)
- Skips records with status `"active"` regardless of age
- Only removes records, does NOT delete Telegram topics
- TODO: Notify user about expired topics (not implemented)

### Debounce

- In-memory Map is source of truth
- Flush to disk 2s after last change
- Force flush on process shutdown

## Integration Points

### New File

- `src/core/session-store.ts` — `SessionStore` interface + `JsonFileSessionStore`

### Core Changes

- **SessionManager** — inject `SessionStore`, call `save()`/`remove()` on create/destroy
- **Session** — add `agentSessionId` field (from `AgentInstance.sessionId` after spawn completes)

### AgentInstance Changes

- Add static `resume()` method — same as `spawn()` but uses `unstable_resumeSession({ sessionId, cwd })` instead of `newSession()`, with fallback to `newSession()` on failure

### Telegram Adapter Changes

- Message handler: when receiving message for topic without active session → acquire resume lock → trigger lazy resume → release lock
- Queue messages arriving during resume, forward after completion
- Platform metadata type: `{ topicId: number }`

### Config Changes

- Add `sessionStore.ttlDays` to config schema (default 30)

## Edge Cases

- **Permission pending on restart**: Agent may re-request permission after resume. Existing permission handling in adapter will handle this naturally.
- **Cancelled sessions**: Records with status `"cancelled"` are not resumable. User message in a cancelled session's topic spawns a fresh session.
- **Long-running instances**: Daily cleanup timer prevents stale record accumulation without requiring restart.

## Design Decisions

1. **Lazy over eager resume** — Avoids spawning N subprocesses on startup. Only resume when user actually sends a message.
2. **JSON file over SQLite** — Simpler, no extra dependency. SessionStore interface allows swapping to SQLite later if needed. Version field in file format enables future migrations.
3. **Core-level store, adapter-level platform data** — Adapters share storage logic via `SessionStore`, only define their own `platform` fields. Adding a new adapter = define platform type + use existing store API.
4. **Auto-cleanup records, not topics** — Records are internal data, safe to auto-delete. Topics are user-visible, should not be auto-deleted.
5. **Predicate-based lookup** — `findByPlatform` uses predicate for type safety instead of stringly-typed key/value.
6. **Resume lock** — Per-topic lock prevents race condition from concurrent messages during lazy resume.
