# Conversation History — Bug Fixes Spec

**Date:** 2026-03-30
**Branch:** `feat/conversation-history`
**Status:** Implemented
**Relates to:** `2026-03-30-conversation-history-design.md`

## Overview

Post-implementation review of the conversation history feature found five issues: one critical (EntireProvider fallback broken), one spec deviation (title format), two minor code quality issues (double I/O, type casts), and one misleading comment. This spec documents each issue and its fix.

---

## Issue 1: EntireProvider Never Used as Fallback (Critical)

### Problem

`HistoryProvider.isAvailable()` always returns `true`. `ContextManager.getProvider()` returns the first available provider and stops. Result: `EntireProvider` is **never tried**, even for query types it owns (`branch`, `commit`, `pr`, `checkpoint`) or for old sessions without history files.

### Root Cause

`ContextManager.buildContext()` and `listSessions()` both delegated to `getProvider()`, which is a first-available-wins lookup. It has no concept of "this provider has no data for this query — try the next one."

### Fix

Replace single-provider delegation with a cascade loop in both `buildContext` and `listSessions`:

```typescript
// buildContext: try each provider, return first with non-empty markdown
for (const provider of this.providers) {
  if (!(await provider.isAvailable(query.repoPath))) continue;
  const result = await provider.buildContext(query, options);
  if (result && result.markdown) {
    this.cache.set(query.repoPath, queryKey, result);
    return result;
  }
}
return null;

// listSessions: try each provider, return first with non-empty sessions
for (const provider of this.providers) {
  if (!(await provider.isAvailable(query.repoPath))) continue;
  const result = await provider.listSessions(query);
  if (result.sessions.length > 0) return result;
}
return null;
```

`getProvider()` is preserved unchanged (external callers depend on it).

### Files

- `src/plugins/context/context-manager.ts` — cascade logic
- `src/plugins/context/__tests__/context-manager.test.ts` — 4 new cascade tests

### Cascade Semantics

| Condition | Behavior |
|-----------|----------|
| Provider unavailable | Skip (continue) |
| Provider available, returns empty markdown | Skip (continue) |
| Provider available, returns non-empty result | Return immediately, cache |
| All providers exhausted | Return `null` |

---

## Issue 2: Title Format Deviation (Spec Violation)

### Problem

For `latest` query type, `buildMergedMarkdown` generated `"3 sessions"` as the header title. The spec requires `"latest 3 sessions"`:

```markdown
# Conversation History — latest 3 sessions
```

### Fix

One-line change in `HistoryProvider.buildMergedMarkdown`:

```typescript
// Before
const title = query.type === "session" ? query.value : `${sessions.length} sessions`;

// After
const title = query.type === "session" ? query.value : `latest ${sessions.length} sessions`;
```

Note: `sessions.length` (not `query.value`) is intentional — if token budget truncation reduces 5 sessions to 3, the title reads "latest 3 sessions" rather than the misleading "latest 5 sessions".

### Files

- `src/plugins/context/history/history-provider.ts`
- `src/plugins/context/history/__tests__/history-provider.test.ts` — new test

---

## Issue 3: Double I/O in listSessions (Minor)

### Problem

`listSessions` called `store.exists()` then `store.read()` in sequence — two filesystem reads per candidate session.

```typescript
if (!(await this.store.exists(record.sessionId))) continue;
const history = await this.store.read(record.sessionId);
const turnCount = history?.turns.length ?? 0;
```

### Fix

Single `read()` call with null guard:

```typescript
const history = await this.store.read(record.sessionId);
if (!history) continue;
const turnCount = history.turns.length;
```

### Files

- `src/plugins/context/history/history-provider.ts`

---

## Issue 4: Unnecessary `(step as any)` Casts (Code Quality)

### Problem

`resource_content` and `resource_link` cases in `HistoryRecorder.onAfterEvent` used `(step as any)` to set optional fields that are already declared on the specific types:

```typescript
// resource_content
const step: Step = { type: "resource", uri: event.uri, name: event.name };
if (event.text !== undefined) (step as any).text = event.text;

// resource_link
const step: Step = { type: "resource_link", uri: event.uri, name: event.name };
if (event.title !== undefined) (step as any).title = event.title;
if (event.description !== undefined) (step as any).description = event.description;
```

### Fix

Use the specific types (`ResourceStep`, `ResourceLinkStep`) from `types.ts` which declare the optional fields:

```typescript
// resource_content
const step: ResourceStep = { type: "resource", uri: event.uri, name: event.name };
if (event.text !== undefined) step.text = event.text;

// resource_link
const step: ResourceLinkStep = { type: "resource_link", uri: event.uri, name: event.name };
if (event.title !== undefined) step.title = event.title;
if (event.description !== undefined) step.description = event.description;
```

### Files

- `src/plugins/context/history/history-recorder.ts` — type annotations + import

---

## Issue 5: Misleading Comment (Minor)

### Problem

The truncation loop in `HistoryProvider.buildContext` had a misleading comment:

```typescript
// Remove the oldest session (first in list, sorted newest-first)
activeSessions = activeSessions.slice(0, activeSessions.length - 1);
```

The list is sorted newest-first, so the **last** element is the oldest. The code correctly removes the last element (`slice(0, length-1)`) but the comment said "first in list".

### Fix

```typescript
// Remove the oldest session (last in list, sorted newest-first)
activeSessions = activeSessions.slice(0, activeSessions.length - 1);
```

### Files

- `src/plugins/context/history/history-provider.ts`

---

## Test Coverage

| Fix | New tests |
|-----|-----------|
| 1 — ContextManager cascade | 4 tests: skip empty, return first non-empty, listSessions cascade, all-empty returns null |
| 2 — Title format | 1 test: `"latest N sessions"` in markdown |
| 3 — Double I/O | No new test (covered by existing "excludes sessions without history files") |
| 4 — Type casts | No new test (behavior identical, existing resource step tests still pass) |
| 5 — Comment | No test (comment-only) |
