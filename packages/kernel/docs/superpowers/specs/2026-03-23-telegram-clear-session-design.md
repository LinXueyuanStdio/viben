# /archive Command — Design Spec

## Summary

Add an `/archive` command that archives the current session topic by recreating the Telegram forum topic. The agent subprocess stays alive — only the visual chat history is wiped. Also exposed via the API (`POST /sessions/:id/archive`) so CLI and other adapters can use the same functionality.

Named `/archive` (not `/clear`) because `/clear` is already used for resetting the Assistant's conversation history. "Archive" is more user-friendly — it aligns with common UX patterns (Gmail, Slack) and reduces user anxiety about destructive actions.

## Requirements

- **Target**: Users working in session topics who want a clean chat view without losing their agent session
- **Scope**: Session topics only — if used in Assistant or other topics, reply with guidance
- **Agent continuity**: The ACP subprocess must NOT be restarted — only the Telegram topic is recreated
- **Speed**: Should complete in under 3 seconds (topic delete + create + rewire)
- **Confirmation**: Ask for confirmation before archiving (destructive, messages are permanently deleted)
- **Multi-surface**: Core archive logic accessible from Telegram, API, and CLI
- **Assistant guidance**: When user asks about archiving in Assistant topic, explain the command and guide them to the session topic

## Non-Goals

- Clearing agent conversation memory/context (out of scope — that's agent-side)
- Selective message deletion (too slow with Telegram rate limits — 3s per message)
- Chat export before archiving (could be a future feature)
- Automatically suggesting archive when topics get long (future enhancement)

## Design

### Architecture

Core archive logic lives in `VibenCore` (not in the Telegram adapter) so all surfaces can use it:

```
/archive (Telegram)  ──→  core.archiveSession(sessionId)  ←── POST /sessions/:id/archive (API)
                                    │
                          ┌─────────┴─────────┐
                          │ 1. Validate state  │
                          │ 2. Notify adapter  │
                          │ 3. Adapter recreates│
                          │    topic + rewires  │
                          └─────────────────────┘
```

### Approach: Topic Recreation

Telegram has no bulk-delete or topic-purge API. Deleting messages one-by-one is impractical (100 messages = 5+ minutes at 3s rate limit). Instead:

1. **Core validates** session state (must be active, not initializing)
2. **Core calls** `adapter.archiveSessionTopic(sessionId)` — adapter-specific topic handling
3. **Adapter deletes old topic** via `deleteForumTopic(chatId, oldTopicId)`
4. **Adapter creates new topic** via `createForumTopic(chatId, name)` — fresh empty topic
5. **Adapter rewires session** — update `session.threadId` and persist via `patchRecord()`
6. **Adapter cleans up trackers** — reset MessageDraft, ToolCallTracker, ActivityTracker
7. **Adapter sends confirmation** in the new topic

### Telegram Command Flow

```
User sends /archive in session topic
  → Bot replies: "⚠️ This will permanently delete all messages in this topic. Continue?"
  → [Yes, archive] [Cancel] inline buttons
  → User taps "Yes, archive"
  → Bot calls core.archiveSession(sessionId)
  → Core delegates to adapter.archiveSessionTopic()
  → Adapter deletes old topic, creates new one, rewires session
  → Bot sends "✅ Topic archived. Session continues." in new topic
```

### API Endpoint

```
POST /api/sessions/:id/archive
Response: { ok: true, newThreadId: string } | { ok: false, error: string }
```

> Core returns `newThreadId: string` (adapter-agnostic). Telegram-specific consumers can cast to number for `topicId`.

### Assistant Guidance

When a user runs `/archive` in the Assistant topic or asks about archiving:

```
"ℹ️ /archive works in session topics — it recreates the topic with a clean
chat view while keeping your agent session alive.

Go to the session topic you want to archive and type /archive there."
```

### Key Constraints

| Constraint | Solution |
|-----------|----------|
| `deleteForumTopic` is permanent | Confirmation prompt before executing |
| New topic gets a different `topicId` | Persist new topicId via `sessionManager.patchRecord()` |
| Deep links to old topic break | Accepted trade-off — noted in confirmation message |
| Active streaming/draft in progress | Finalize draft before archiving, abort pending edits |
| Adapter routing uses `topicId` for message delivery | Must update all in-memory routing maps |
| Agent emits events during delete→create gap | Set `session.archiving = true` flag to buffer/drop events during transition |
| Repeated archives stack 🔄 emoji prefix | Strip existing 🔄 prefix before adding new one |
| `createForumTopic` fails after delete (orphan) | Try/catch around create; on failure, notify Notifications topic with session details |
| `patchRecord` replaces entire `platform` object | Spread existing platform data: `{ ...existingPlatform, topicId: newTopicId }` |

### Error Handling

| Error | Behavior |
|-------|----------|
| `deleteForumTopic` fails (403 — no permission) | Reply "Cannot archive: bot needs admin rights to manage topics" |
| `createForumTopic` fails after delete | Critical — notify in Notifications topic: "Topic recreation failed for session X. Session is orphaned." |
| Session not found in topic | Reply "No active session in this topic" |
| Session is in `initializing` state | Reply "Please wait for session to be ready" |
| `/archive` used in non-session topic | Reply with guidance to go to a session topic |

### Callback Prefix

Use `ar:` prefix for archive confirmation callbacks to avoid conflicts with existing `p:` (permission) and `m:` (menu) prefixes.

- `ar:yes:<sessionId>` — confirm archive
- `ar:no:<sessionId>` — cancel archive

### Affected Components

**Core layer**:
- `core.ts` — add `archiveSession(sessionId)` method that validates + delegates to adapter
- `channel.ts` — add optional `archiveSessionTopic(sessionId)` to `ChannelAdapter` base
- `api-server.ts` — add `POST /sessions/:id/archive` endpoint

**Adapter layer** (Telegram-specific):
- `commands/session.ts` — add `handleArchive()` and `handleArchiveConfirm()`
- `commands/index.ts` — register `/archive` command and `ar:` callbacks
- `adapter.ts` — implement `archiveSessionTopic()` override
- `topics.ts` — add `deleteSessionTopic()` helper

**No changes needed**:
- `session.ts` — agent subprocess is untouched
- `agent-instance.ts` — completely unaware of Telegram topics
- `session-store.ts` — already has `patchRecord()` via SessionManager
