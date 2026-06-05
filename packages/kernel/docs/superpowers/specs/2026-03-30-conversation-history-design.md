# Conversation History Design Spec

**Date:** 2026-03-30
**Branch:** `feat/conversation-history`
**Status:** Implemented

## Overview

Records full conversation history per session and serves it as condensed context for new sessions. This enables an agent in a new session to understand everything that happened in previous sessions — what the user asked, what the AI did, which files were read/edited, tool calls, permissions, and outcomes.

**Design philosophy:** The history system is a **ContextProvider** (name: `"local"`) integrated into the existing context plugin. It has two sides — a **write side** (HistoryRecorder) that captures events via middleware hooks, and a **read side** (HistoryProvider) that loads history files and renders them as markdown context at configurable verbosity levels.

## Problem

When a session ends in Viben, all conversation data is lost. The existing context plugin only supports Entire (git-based checkpoint data from external tools). There is no built-in way to:
1. Persist what happened in a conversation
2. Give a new agent session context about prior conversations
3. Let another agent understand what was discussed, decided, and changed

## Design Decisions

### Per-session storage (not per-thread)

Each session gets its own history file. There is no thread concept in the history system. Sessions are the atomic unit — when context is needed, you query by session ID or request the N most recent sessions.

### Structured JSON (not JSONL)

History files are structured JSON with explicit ordering, not append-only JSONL. This was chosen because:
- **Order and structure matter** more than streaming append performance
- **Turns have nested steps** that must maintain exact sequential order
- **Data at each step is aggregated** (chunks merged, tool updates consolidated)
- Sessions have tens of turns, not millions of events — file size is manageable

### Steps within assistant turns preserve exact ordering

A single assistant turn contains an **ordered array of steps**. The sequence `thinking → tool_call → thinking → text → tool_call → text` is preserved exactly as it occurred. This captures the interleaved nature of agent reasoning — thinking happens between tool calls, text responses happen between actions.

### Write after each turn (not at session end)

History is written to disk after each turn completes (when `stopReason` is received). This ensures no data is lost if the process crashes mid-session. Since sessions typically have only a few dozen turns, the overhead of rewriting the full file per turn is negligible.

### Middleware-based capture (no core changes)

All event capture happens through existing middleware hooks. No changes to core modules (Session, SessionBridge, AgentInstance). The context plugin registers middleware on:
- `agent:beforePrompt` — capture user message
- `agent:afterEvent` — capture each agent event
- `turn:end` — finalize turn and write to disk
- `permission:afterResolve` — attach permission decisions to tool calls
- `session:afterDestroy` — clean up in-memory state

### Provider priority: local > entire

The HistoryProvider is registered before EntireProvider in ContextManager. Since `getProvider()` returns the first available provider, local history takes priority. EntireProvider serves as fallback for sessions that don't have local history (e.g., sessions from before this feature was added).

## Data Model

### Storage location

```
~/.viben/history/<sessionId>.json
```

Session metadata (agentName, createdAt, status, etc.) lives in the existing `~/.viben/sessions.json` — no duplication.

### SessionHistory

```typescript
interface SessionHistory {
  version: 1;
  sessionId: string;
  turns: Turn[];
}
```

### Turn

Each prompt-response cycle produces two turns: one `user`, one `assistant`.

```typescript
interface Turn {
  index: number;                    // Sequential index within the session
  role: "user" | "assistant";
  timestamp: string;                // ISO 8601
  // User turn fields
  content?: string;                 // User's message text
  attachments?: HistoryAttachment[];
  // Assistant turn fields
  steps?: Step[];                   // Ordered sequence of actions
  usage?: HistoryUsage;             // Token/cost for this turn
  stopReason?: string;              // "end_turn", "cancelled", etc.
}
```

### Step types (10 types)

Steps are the atomic units within an assistant turn. Their order in the array matches the exact chronological order they occurred.

| Type | Description | Key fields |
|------|-------------|------------|
| `thinking` | Agent's internal reasoning | `content` |
| `text` | Agent's visible response text | `content` |
| `tool_call` | Tool invocation (consolidated) | `id`, `name`, `kind`, `status`, `input`, `output`, `diff`, `locations`, `permission` |
| `plan` | Execution plan | `entries[]` with content/priority/status |
| `image` | Agent-generated image | `mimeType`, `filePath` |
| `audio` | Agent-generated audio | `mimeType`, `filePath` |
| `resource` | Embedded resource content | `uri`, `name`, `text` |
| `resource_link` | Resource link reference | `uri`, `name`, `title`, `description` |
| `mode_change` | Session mode change | `modeId` |
| `config_change` | Config option change | `configId`, `value` |

### Chunk accumulation rule

Consecutive events of the same streaming type are merged into a single step:

```
thought "Let me"     → steps: [{ type: "thinking", content: "Let me" }]
thought " analyze"   → steps: [{ type: "thinking", content: "Let me analyze" }]
tool_call (Read)     → steps: [..., { type: "tool_call", name: "Read" }]
thought "Now I see"  → steps: [..., { type: "thinking", content: "Now I see" }]  ← NEW step
text "Found"         → steps: [..., { type: "text", content: "Found" }]
text " the bug"      → steps: [..., { type: "text", content: "Found the bug" }]
```

Rule: If the last step in the array is the same type (`thinking`/`text`), append to its content. Otherwise create a new step.

### Tool call consolidation

`tool_call` and `tool_update` ACP events are merged into a single `ToolCallStep`:
- `tool_call` creates the step with `id`, `name`, `kind`, `status`
- Subsequent `tool_update` events with matching `id` update: `status`, `input` (rawInput), `output` (rawOutput), `diff` (extracted from content array), `locations`
- Permission decisions are attached via `onPermissionResolved()` matching by tool call ID

### Ignored event types

These ACP events are not recorded (they are transient or handled elsewhere):
- `session_end`, `error`, `system_message` — session lifecycle, not conversation content
- `commands_update` — slash command advertisements
- `session_info_update`, `model_update` — metadata changes
- `user_message_chunk` — replay during session/load
- `tts_strip` — TTS UI cleanup

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Context Plugin                        │
│                                                         │
│  ┌──────────────────┐    ┌───────────────────────────┐  │
│  │  ContextManager   │───▶│  HistoryProvider          │  │
│  │   (existing)      │    │  (name: "local")          │  │
│  │                   │    │  - listSessions()         │  │
│  │                   │    │  - buildContext()          │  │
│  │                   │    └──��─────────┬──────────────┘  │
│  │                   │                 │ reads           │
│  │                   │    ┌────────────▼──────────────┐  │
│  │                   │    │      HistoryStore          │  │
│  │                   │    │  ~/.viben/history/*.json │  │
│  │                   │    └────────────▲──────────────┘  │
│  │                   │                 │ writes          │
│  │                   │    ┌────────────┴──────────────┐  │
│  │                   │    │    HistoryRecorder         │  │
│  │                   │    │  middleware hooks capture  │  │
│  │                   │    │  accumulates turns in RAM  │  │
│  └──────────────────┘    └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Event capture flow

```
User sends message
       │
  agent:beforePrompt (middleware)
  HistoryRecorder captures: text, attachments
  Push Turn { role: "user" }
  Pre-create Turn { role: "assistant", steps: [] }
       │
  Agent processes prompt...
  agent:afterEvent fires for each event:
       │
       ├─ thought → accumulate into "thinking" step
       ├─ text → accumulate into "text" step
       ├─ tool_call → create "tool_call" step
       ├─ tool_update → update existing "tool_call" step
       ├─ plan → push "plan" step
       ├─ image/audio → push media step
       ├─ resource/resource_link → push resource step
       ├─ mode_change → push "mode_change" step
       ├─ config_change → push "config_change" step
       └─ usage → set turn.usage
       │
  permission:afterResolve (middleware)
  Attach outcome to matching tool_call step
       │
  turn:end (middleware)
  Set turn.stopReason
  Write full SessionHistory to disk
       │
  session:afterDestroy (middleware)
  Remove in-memory state
```

## Context Builder (Read Side)

### Rendering levels

The context builder renders Turn[] into markdown at 3 verbosity levels, selected automatically based on total turn count:

| Turn count | Level | Description |
|-----------|-------|-------------|
| ≤ 10 | `full` | Complete history — thinking, full text, tool calls with diffs, permissions, usage |
| 11–25 | `balanced` | No thinking, tool calls summarized, text preserved |
| > 25 | `compact` | One-liner per turn pair: `User: ... → Assistant: tool names | text snippet` |

### Token budget enforcement

Default budget: 30,000 tokens (same as EntireProvider). Strategy:
1. Render at auto-selected level
2. If over budget → downgrade to compact
3. If still over budget → truncate oldest sessions (keep most recent)

### Full mode example

```markdown
**User [1]:**
Fix the login bug in auth.ts

**Assistant:**
> **Thinking**: Let me analyze the auth code...

Found the bug — token validation is missing.

**[Read]** `src/auth.ts:1`

**[Edit]** `src/auth.ts:42`
```diff
- if (user) {
+ if (user && user.token) {
```
*Permission: allow_always*

Fixed! Added the missing token validation.

**Usage**: 5,000 tokens, $0.0300

---
```

### Balanced mode example

```markdown
**User [1]:**
Fix the login bug in auth.ts

**Assistant:**
Found the bug — token validation is missing.
- Read `src/auth.ts:1`
- Edit `src/auth.ts:42` (-1/+1 lines)
Fixed! Added the missing token validation.

---
```

### Compact mode example

```
User: Fix the login bug in auth.ts → Assistant: Read, Edit | Found the bug — token validation is missing.
```

### Merged output format

When multiple sessions are combined:

```markdown
# Conversation History — latest 3 sessions
3 sessions | 12 turns | mode: full

## Session 1 — claude-code · abc123 (4 turns)

{session markdown}

## Session 2 — claude-code · def456 (8 turns)

{session markdown}

> **Note:** This conversation history may contain outdated information. Verify current state before acting on past context.
```

## File Structure

```
src/plugins/context/
  context-manager.ts              # Existing — unchanged
  context-provider.ts             # Existing — unchanged
  index.ts                        # Modified — registers recorder + provider
  entire/                         # Existing — EntireProvider (kept as fallback)
  history/                        # NEW
    types.ts                      # SessionHistory, Turn, Step types
    history-store.ts              # File I/O: read/write/delete/list JSON files
    history-recorder.ts           # Middleware event capture + step accumulation
    history-context-builder.ts    # Render turns → markdown (full/balanced/compact)
    history-provider.ts           # ContextProvider implementation (name: "local")
    __tests__/
      history-store.test.ts       # 14 tests — file I/O
      history-recorder.test.ts    # 32 tests — event capture + accumulation
      history-context-builder.test.ts  # 37 tests — rendering
      history-provider.test.ts    # 27 tests — provider logic
      integration.test.ts         # 3 tests — end-to-end record + build
```

## Plugin Integration

The context plugin (`src/plugins/context/index.ts`) is modified to:

1. **Add permissions**: `middleware:register` and `kernel:access` (in addition to existing `services:register`)
2. **Create infrastructure**: HistoryStore (pointing to `~/.viben/history/`), HistoryRecorder, HistoryProvider
3. **Register HistoryProvider first** in ContextManager (priority over EntireProvider)
4. **Register 5 middleware hooks** at priority 200 (late execution — after other middleware):
   - `agent:beforePrompt` → capture user input
   - `agent:afterEvent` → capture agent events
   - `turn:end` → finalize and write
   - `permission:afterResolve` → attach permission decisions
   - `session:afterDestroy` → cleanup memory

## Backward Compatibility

- **EntireProvider kept**: Not removed, registered after HistoryProvider as fallback
- **No core changes**: All integration via middleware — no changes to Session, SessionBridge, or AgentInstance
- **Old sessions**: Sessions created before this feature have no history file. They fall through to EntireProvider (if available) or return empty context
- **sessions.json unchanged**: No new fields added to SessionRecord
- **Config unchanged**: No new config fields required. History recording is always on when context plugin is active

## Query Types

The HistoryProvider supports 2 query types:

| Query type | Behavior |
|-----------|---------|
| `session` | Load single session by sessionId |
| `latest` | Load N most recent sessions (sorted by lastActiveAt) |

Other query types (`branch`, `commit`, `pr`, `checkpoint`) return empty results — they are Entire-specific.

## Future Work (Phase 2)

- Extract history system into a standalone plugin (`@viben/history`)
- Add history cleanup tied to SessionStore TTL
- Add `branch` query type (group sessions by working directory / git branch)
- History search/filtering by content
- Configurable recording (opt-out per session, max history size)
