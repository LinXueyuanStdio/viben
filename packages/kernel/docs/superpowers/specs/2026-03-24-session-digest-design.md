# Session Summary — Design Spec

## Summary

Add an on-demand `/summary` command that asks the agent to summarize the current session's work. User-initiated, not automatic — avoids context pollution, wasted tokens, and edge cases with crashed/cancelled sessions. Summary appears directly in the session topic as a regular message.

## Problem

Users running multiple sessions lose track of what each agent did. There's no quick way to get a recap without scrolling through long conversation history. Teams need visibility into agent work for standups and handoffs.

## Requirements

- **User-initiated**: Summary only runs when user explicitly requests it — no auto-generation on session end
- **Works mid-session**: Can request summary while session is still active (progress check)
- **Works in session topic**: `/summary` in a session topic → agent summarizes → result displayed in that topic
- **Completion notification with summary button**: When session ends, notification includes a `[📋 Summary]` inline button that triggers summarization
- **No persistent store needed**: Summary is just another message in the conversation — no `digests.json`, no retention logic, no API endpoint
- **CLI support**: `viben session summary [id]` as a subcommand

## Non-Goals

- Auto-summary on every session end (rejected — context pollution, cost, edge cases)
- Persistent digest storage (unnecessary — summary is displayed in topic)
- Summary for sessions that never had any prompts
- AI-powered search across summaries

## Design

### Architecture

```
User triggers summary (button or /summary command)
  ↓
  ├── Active session? → prompt current agent → display response in topic
  └── Ended session?  → respawn agent with conversation history → prompt → display → destroy temp agent
```

No new store. No new persistence. Summary is a regular agent response displayed in the session topic.

For ended sessions, the agent is temporarily respawned using `resumeAgentSessionId` from the session record. After generating the summary, the temp agent is destroyed. This only works for agents that support resume (e.g., Claude ACP).

### `/summary` Command (Telegram)

```
User in session topic types: /summary
  → Bot sends "📋 Generating summary..." (typing indicator)
  → Injects summary prompt into agent (pause/capture/resume pattern)
  → Agent responds with summary
  → Bot displays formatted summary in the session topic
```

**If session is not active:**
```
/summary in non-session topic → "ℹ️ Use /summary in a session topic"
/summary in ended session     → "⚠️ Session has ended. Summary is only available for active sessions."
```

### Summary Prompt

```
Summarize what you've accomplished so far in this session in 2-3 sentences.
Include: key files changed, decisions made, and current status.
Reply ONLY with the summary, nothing else.
```

### Completion Notification with Summary Button

When a session ends, the existing notification is enhanced:

```
📋 Notifications topic
┌──────────────────────────────────────┐
│ ✅ Fix login bug — completed         │
│ ⏱ 12 min · 💬 5 prompts             │
│                                      │
│ [📋 Summary]                         │
└──────────────────────────────────────┘
```

Tapping `[📋 Summary]` button:
- **If session still alive** (agent not yet disconnected): prompt agent, display in session topic
- **If session already disconnected**: display "Session has ended, summary not available"

Callback prefix: `sm:` (e.g., `sm:summary:<sessionId>`)

### Session.generateSummary()

Follows the `autoName()` pattern but is called on-demand, not automatically:

```typescript
async generateSummary(timeoutMs = 15000): Promise<string> {
  // 1. Pause session emitter
  // 2. Inject summary prompt into agent
  // 3. Capture text response (max 500 chars)
  // 4. Resume normal delivery
  // 5. Timeout → return empty string
}
```

Key differences from autoName():
- Longer timeout (15s vs ~5s) since summaries are longer
- Called explicitly by user, not automatically
- Result is displayed to user, not used internally

### CLI Support

```bash
viben session summary          # summary for most recent active session
viben session summary <id>     # summary for specific session
```

Calls the API: `POST /api/sessions/:id/summary`
Response: `{ ok: true, summary: string }` or `{ ok: false, error: string }`

### Prompt Count Tracking

Add `promptCount` to Session for the notification stats:

```typescript
// In Session class
promptCount: number = 0;
// Incremented in enqueuePrompt()
```

### Error Handling

| Scenario | Behavior |
|----------|----------|
| Agent fails to summarize | Reply "Could not generate summary" in topic |
| Agent times out (>15s) | Reply "Summary timed out" in topic |
| Session not active | Reply "Session has ended, summary not available" |
| /summary in non-session topic | Reply with guidance |
| Agent crashed mid-summary | Catch error, reply with failure message |

### Affected Components

**Core layer** (modify):
- `src/core/session.ts` — add `generateSummary()` method + `promptCount` property
- `src/core/core.ts` — add `summarizeSession(sessionId)` method
- `src/core/api/routes/sessions.ts` — add `POST /sessions/:id/summary` endpoint

**Adapter layer** (modify):
- `src/adapters/telegram/commands/session.ts` — add `handleSummary()` + `handleSummaryCallback()`
- `src/adapters/telegram/commands/index.ts` — register `/summary` command, `sm:` callbacks, STATIC_COMMANDS
- `src/adapters/telegram/formatting.ts` — add `formatSummary()` helper

**Adapter layer** (modify — notification enhancement):
- `src/core/session-bridge.ts` — include `[📋 Summary]` button in session_end notification (pass metadata with sessionId for callback)

**No new files needed**:
- No DigestStore
- No digest-store.ts
- No config changes (no DigestSchema)
- No persistent storage
