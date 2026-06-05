# Session List History — Design

**Date:** 2026-04-03
**Status:** Approved

## Problem

`GET /sessions` API only returns sessions currently live in memory. Sessions that have been
cancelled, finished, or archived are removed from memory and become invisible to the API consumer.
This means the Viben App cannot show the user a full session history for browsing or resuming.

## Goal

`GET /sessions` returns all sessions — live and historical — in a single unified response shape.
Historical sessions (from the store) get `null`/`0`/`false` for runtime-only fields.

## Design

### New method: `SessionManager.listAllSessions(channelId?: string): SessionSummary[]`

Single method that merges the store records (all statuses) with live in-memory session data.

```typescript
export interface SessionSummary {
  id: string;  // maps from SessionRecord.sessionId
  agent: string;
  status: SessionStatus;
  name: string | null;
  workspace: string;
  channelId: string;
  createdAt: string;
  lastActiveAt: string | null;
  dangerousMode: boolean;
  // Runtime fields — populated from live session; null/0/false for historical
  queueDepth: number;
  promptRunning: boolean;
  configOptions?: ConfigOption[];
  capabilities: AgentCapabilities | null;
  isLive: boolean;
}
```

**Logic:**

1. If store is available: query `listRecords()` as source of truth (all statuses)
2. For each record: look up `getSession(record.sessionId)` to check if live
3. If live: overlay runtime fields (`queueDepth`, `promptRunning`, `configOptions`, `capabilities`,
   current `status`)
4. If not live: use record fields, runtime fields default to `0`/`false`/`null`/`undefined`
5. If no store: fallback to `listSessions()` mapped to `SessionSummary` (live-only, no history)
6. Filter by `channelId` if provided

The `isLive` flag lets consumers distinguish sessions that can be interacted with right now vs.
historical records only.

### Route change: `GET /sessions`

```typescript
// Before
const sessions = deps.core.sessionManager.listSessions();
return { sessions: sessions.map(s => ({ ... })) };

// After
const summaries = deps.core.sessionManager.listAllSessions();
return { sessions: summaries.map(s => ({ ... })) };
```

Response shape is the same as today for live sessions. Historical sessions fill runtime fields with
`0`/`false`/`null`. The `isLive` field is added to the response.

### Response shape (unified)

```json
{
  "sessions": [
    {
      "id": "abc123",
      "agent": "claude",
      "status": "active",
      "name": "My Session",
      "workspace": "/home/user/project",
      "channelId": "telegram",
      "createdAt": "2026-04-01T10:00:00Z",
      "lastActiveAt": "2026-04-01T11:00:00Z",
      "dangerousMode": false,
      "queueDepth": 0,
      "promptRunning": false,
      "configOptions": [],
      "capabilities": null,
      "isLive": true
    },
    {
      "id": "def456",
      "agent": "claude",
      "status": "cancelled",
      "name": "Old Session",
      "workspace": "/home/user/project",
      "channelId": "telegram",
      "createdAt": "2026-03-30T09:00:00Z",
      "lastActiveAt": "2026-03-30T10:00:00Z",
      "dangerousMode": false,
      "queueDepth": 0,
      "promptRunning": false,
      "configOptions": undefined,
      "capabilities": null,
      "isLive": false
    }
  ]
}
```

## Files Changed

- `src/core/sessions/session-manager.ts` — add `SessionSummary` interface + `listAllSessions()` method
- `src/plugins/api-server/routes/sessions.ts` — update `GET /` handler to use `listAllSessions()`
- `src/plugins/api-server/__tests__/routes-sessions.test.ts` — update existing tests + add new cases

## Tests

- Live session → runtime fields populated, `isLive: true`
- Historical session (store only, not in memory) → runtime fields null/0/false, `isLive: false`
- Mixed (some live, some historical) → correct merge, no duplicates
- No store → fallback to live-only, behaves like current behavior
- `channelId` filter applies to both live and historical

## Out of Scope

- No changes to chat commands (`/sessions` in Telegram already uses `listRecords()`)
- No pagination (existing behavior)
- No sort order changes
