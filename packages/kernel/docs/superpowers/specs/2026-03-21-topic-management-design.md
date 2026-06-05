# Topic Management & Assistant Enhancement

**Date:** 2026-03-21
**Status:** Approved

## Problem

Telegram forum topics accumulate indefinitely — sessions end but topics remain. There is no way to list, delete, or clean up topics. The AI assistant cannot execute actions, only provide text guidance.

## Solution

Add a `TopicManager` core module with topic lifecycle management, expose it via API endpoints and CLI api commands, and enhance the assistant to call CLI commands directly via bash.

## Architecture

```
TopicManager (core logic)
  ← ApiServer (HTTP endpoints)
    ← CLI api (shell commands)
      ← Assistant (bash tool calls)
```

## Design Decisions

- **Deleting a topic also removes the session record.** Orphaned records without a topic serve no purpose — the topic IS the user-facing artifact. If history preservation is needed later, an "archive" action can be added separately.
- **System topics (Notifications, Assistant) are always protected.** They are excluded from list, delete, and cleanup operations.
- **Telegram deletion failures are non-blocking.** If the Telegram API call fails (topic already deleted, permissions, rate limit), the session record is still removed and the failure is logged. This prevents orphaned records when topics were manually deleted.

## 0. ChannelAdapter Extension

Add `deleteSessionThread` to `IChannelAdapter` and `ChannelAdapter`:

```typescript
// In IChannelAdapter interface:
deleteSessionThread(sessionId: string): Promise<void>

// In ChannelAdapter abstract class (default no-op):
async deleteSessionThread(_sessionId: string): Promise<void> {}
```

The Telegram adapter implements this by calling `bot.api.deleteForumTopic(chatId, topicId)`. This keeps TopicManager adapter-agnostic — it only calls `adapter.deleteSessionThread()`, never Telegram-specific APIs.

## 1. TopicManager (`src/core/topic-manager.ts`)

Core module managing topic lifecycle. Data source: session store (`sessions.json`) — each session record has `platform.topicId` (Telegram-specific, but TopicManager treats it as opaque platform data via the adapter).

### Dependencies

- `SessionManager` — access session records via new methods: `listRecords(filter?)`, `removeRecord(sessionId)`, plus existing `getSession()` for active session check and cancel. SessionManager remains the single owner of SessionStore.
- `IChannelAdapter` — call adapter's `deleteSessionThread` to remove platform-side thread
- Config — to identify system topic IDs (notification, assistant) for exclusion

### Methods

#### `listTopics(filter?: { statuses?: string[] })`

Returns list from session store, **excluding system topics** (Notifications, Assistant). Records without `platform.topicId` (headless/API sessions) are included with `topicId: null`.

```typescript
interface TopicInfo {
  sessionId: string
  topicId: number | null  // null for headless/API sessions
  name: string | null
  status: string
  agentName: string
  lastActiveAt: string
}
```

Optional filter by status array.

#### `deleteTopic(sessionId: string, options?: { confirmed?: boolean })`

1. Look up session record in store
2. **Guard:** Reject if topicId matches a system topic (Notifications, Assistant)
3. If session is `active` or `initializing` and `confirmed !== true`:
   - Return `{ needsConfirmation: true, session: { id, name, status } }`
4. If session is `active`/`initializing` and confirmed:
   - Cancel session via SessionManager
5. Delete platform thread via `adapter.deleteSessionThread(sessionId)` — **catch and log errors** (Telegram may already have deleted the topic)
6. Remove record from session store
7. Return `{ ok: true, topicId: number | null }`

#### `cleanup(statuses: string[])`

Batch delete all topics where session status matches any in the statuses array. System topics are always excluded.

```typescript
interface CleanupResult {
  deleted: string[]  // list of deleted sessionIds
  failed: { sessionId: string; error: string }[]
}
```

Default statuses if none provided: `["finished", "error", "cancelled"]`. Cleanup only operates on the explicitly provided statuses without a confirmation step — the user choosing the statuses is itself the confirmation. To clean up `active`/`initializing` sessions, pass them explicitly in the statuses list.

## 2. API Endpoints (added to `api-server.ts`)

### `GET /api/topics`

- Query param: `?status=finished,error` (optional filter)
- Response: `{ topics: TopicInfo[] }`

### `DELETE /api/topics/:sessionId`

- Deletes topic + session record
- If session `active`/`initializing`: `409 { error: "Session is active", needsConfirmation: true, session: {...} }`
- With `?force=true`: force delete (cancel session + delete)
- Success: `200 { ok: true, topicId: number }`
- System topic: `403 { error: "Cannot delete system topic" }`

### `POST /api/topics/cleanup`

- Body: `{ statuses: ["finished", "error", "cancelled"] }`
- Response: `200 { deleted: string[], failed: [{ sessionId, error }] }`

## 3. CLI Runtime Commands (added to `cli/commands.ts`)

### `viben api topics [--status finished,error]`

Lists all topics with session info. Output format:

```
Topics: 5

  abc123  claude-code  finished   "Fix login bug"      Topic #42
  def456  claude-code  active     "Refactor auth"      Topic #58
  ghi789  codex        error      "Add tests"          Topic #63
```

### `viben api delete-topic <sessionId> [--force]`

Deletes a single topic. If session is `active`/`initializing` and no `--force`, shows warning and exits. With `--force`, cancels session and deletes.

Output: `Topic #42 deleted (session abc123)`

### `viben api cleanup [--status finished,error,cancelled]`

Batch cleanup. Default statuses: `finished,error,cancelled`.

Output: `Cleaned up 3 topics: abc123, def456, ghi789 (0 failed)`

## 4. Assistant Enhancement (`assistant.ts`)

### Dynamic System Prompt

`buildAssistantSystemPrompt()` signature changes to accept additional context:

```typescript
interface AssistantContext {
  config: Config
  activeSessionCount: number
  totalSessionCount: number
  topicSummary: { status: string; count: number }[]
}

function buildAssistantSystemPrompt(ctx: AssistantContext): string
```

Prompt content:

1. **State injection at spawn time:**
   - Number of active / total sessions
   - Topic breakdown by status
   - Available agents + default

2. **Detailed command instructions:**
   - When user asks about topics → run `viben api topics`
   - When user wants to delete → run `viben api delete-topic <id>`
   - When user wants cleanup → run `viben api cleanup --status ...`
   - When session is `active`/`initializing` → warn user, add `--force` if confirmed
   - Format output nicely for Telegram (markdown)

3. **Real-time data:** Assistant calls CLI each time it needs fresh data. Prompt only provides initial context. The agent subprocess inherits the user's home directory and environment, so `~/.viben/api.port` is accessible.

4. **Context generation:** `topicSummary` in `AssistantContext` is aggregated from `SessionManager.listRecords()` in `spawnAssistant()` before building the prompt.

### Interaction Examples

```
User: "co nhung session nao dang chay?"
Assistant: *runs `viben api topics`*
         → "Ban co 3 topics: 2 finished, 1 active..."

User: "xoa het may cai finished di"
Assistant: *runs `viben api cleanup --status finished`*
         → "Da xoa 2 topics."

User: "xoa session def456"
Assistant: *runs `viben api delete-topic def456`*
         → "Session nay dang active. Ban co chac muon xoa?"
User: "uh"
Assistant: *runs `viben api delete-topic def456 --force`*
         → "Da xoa topic #58 (session def456)."
```

## Implementation Order

1. Add `deleteSessionThread` to `ChannelAdapter` interface + Telegram implementation
2. `TopicManager` core module
3. API endpoints in `api-server.ts`
4. CLI api commands in `cli/commands.ts` + update help text
5. Assistant system prompt enhancement
6. Tests: unit tests for TopicManager methods, API endpoint tests, assistant prompt builder test
