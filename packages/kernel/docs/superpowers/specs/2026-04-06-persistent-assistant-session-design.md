# Persistent Assistant Session Design

**Date:** 2026-04-06
**Status:** Approved

## Problem

Every time the bot restarts, `AssistantManager.spawn()` always creates a new session. Over time this accumulates many stale assistant session records in `SessionStore` and in the sessions list visible to users. The intended behaviour is: one assistant session per channel, reused across restarts.

## Goals

- One persistent assistant session record per channel (no accumulation of garbage records).
- On bot restart: reuse the existing assistant session ID, start a fresh AgentInstance (no history preserved — intentional).
- Assistant sessions must not appear in session listings (chat commands, REST API, UI).
- Remove the `/clear` command for the assistant (source of confusion; fresh context is already provided on every restart).

## Non-Goals

- Preserving conversation history across restarts (out of scope; fresh context is correct behaviour).
- Resuming assistant AgentInstance state (no ACP state snapshot needed).

---

## Design

### 1. `SessionRecord` — Add `isAssistant` field

**File:** `src/core/types.ts`

Add an optional field to `SessionRecord`:

```typescript
isAssistant?: boolean;
```

This flag is `true` only for assistant sessions. Absent/`false` for all regular sessions. Backward compatible — old records without this field are treated as regular sessions.

### 2. `SessionStore` — Add `findAssistant()` method

**File:** `src/core/sessions/session-store.ts`

Add to `SessionStore` interface:

```typescript
findAssistant(channelId: string): SessionRecord | undefined;
```

Implementation in `JsonFileSessionStore`: iterate records, return first where `record.isAssistant === true && record.channelId === channelId`.

### 3. `AssistantManager` — `getOrSpawn()` replaces `spawn()`

**File:** `src/core/assistant/assistant-manager.ts`

Replace `spawn()` with `getOrSpawn()`. The `AssistantManagerCore` interface gains read access to `sessionStore` (or a `findAssistantSession(channelId)` helper).

**Logic:**

```
getOrSpawn(channelId, threadId):
  existing = sessionStore.findAssistant(channelId)
  if existing:
    session = createSession({ ..., sessionId: existing.sessionId, isAssistant: true })
    // overwrite the old record with updated metadata (new agentSessionId, timestamps)
  else:
    session = createSession({ ..., isAssistant: true })
  store pendingSystemPrompt
  return session
```

The `Session` constructor must accept an optional `id` override so the existing session ID can be reused.

Remove `respawn()` — no longer needed. The Telegram adapter's welcome message on restart is sufficient; users get a fresh context automatically.

### 4. Persist `isAssistant` in `SessionRecord`

**File:** `src/core/core.ts` (or wherever `AssistantManagerCore.createSession()` is implemented)

When `isAssistant: true` is passed to `createSession()`, propagate it into the `SessionRecord` saved to `SessionStore`. The `SessionManager.createSession()` signature must accept `isAssistant?: boolean` and include it in the saved record.

### 5. Filter assistant sessions from all listings

**Files:** `src/core/sessions/session-manager.ts`, `src/plugins/api-server/routes/sessions.ts`

Filter predicate: `record.isAssistant !== true` (or `!record.isAssistant`).

Apply to:
- `SessionManager.listSessions()` — live sessions only
- `SessionManager.listAllSessions()` — live + store records
- `SessionManager.listRecords()` — raw store records

The REST `GET /sessions` route calls `listAllSessions()` and will automatically benefit from the filter there.

The `/sessions` chat command also calls `listSessions()` or `listAllSessions()` and will be filtered automatically.

### 6. Remove `/clear` command for assistant

**File:** `src/core/commands/session.ts`

Remove the `clear` command definition (currently calls `assistantManager.respawn()`).
Remove `respawn()` from `AssistantManager`.
Remove `respawn()` from `AssistantManagerCore` interface (if present).

### 7. TTL cleanup — exempt assistant sessions

**File:** `src/core/sessions/session-store.ts`

The current TTL cleanup (`cleanup()`) skips records with `status === 'active' | 'initializing'`. Since the assistant session record is written with `status: 'finished'` on shutdown (via `shutdownAll()`), it would normally be eligible for TTL deletion after `ttlDays`.

Fix: skip records where `isAssistant === true` in the `cleanup()` loop. Assistant session records must persist indefinitely (they are looked up on every restart).

---

## Affected Files Summary

| File | Change |
|------|--------|
| `src/core/types.ts` | Add `isAssistant?: boolean` to `SessionRecord` |
| `src/core/sessions/session-store.ts` | Add `findAssistant(channelId)` to interface + implementation; exempt `isAssistant` records from TTL cleanup |
| `src/core/sessions/session-manager.ts` | Pass `isAssistant` through `createSession()`; filter assistant records in `listSessions()`, `listAllSessions()`, `listRecords()` |
| `src/core/assistant/assistant-manager.ts` | Replace `spawn()` + `respawn()` with `getOrSpawn()`; update `AssistantManagerCore` interface |
| `src/core/core.ts` | Pass `isAssistant` from `createSession()` params into the session record |
| `src/core/sessions/session.ts` | Accept optional `id` override in constructor |
| `src/core/commands/session.ts` | Remove `/clear` command |
| `src/plugins/api-server/routes/sessions.ts` | No change needed (inherits filter from `listAllSessions()`) |

---

## Backward Compatibility

- Old `SessionRecord` entries without `isAssistant` field: treated as regular sessions (`isAssistant` is optional, defaults to `undefined`/falsy). No migration needed.
- If `findAssistant()` finds no existing record on first boot after upgrade: falls back to creating a new session (same as current behaviour). On the next restart, the new record is found and reused.
- Removed `/clear` command: no backward compat concern — it is a chat command, not a CLI flag or public API.

---

## Testing

- `AssistantManager.getOrSpawn()`: verify second call reuses same session ID.
- `SessionStore.findAssistant()`: verify correct lookup by channelId + isAssistant flag.
- `SessionManager.listAllSessions()`: verify assistant sessions are excluded.
- `SessionManager.listSessions()`: verify assistant sessions are excluded.
- TTL cleanup: verify assistant records are not deleted regardless of `lastActiveAt`.
- Backward compat: verify old records (no `isAssistant` field) are not excluded from listings.
