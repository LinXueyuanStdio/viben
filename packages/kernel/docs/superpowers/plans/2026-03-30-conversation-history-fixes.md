# Conversation History Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found in the conversation history implementation review.

**Architecture:** Five targeted fixes across `context-manager.ts`, `history-provider.ts`, and `history-recorder.ts`. No new files, no structural changes.

**Tech Stack:** TypeScript, Vitest

---

## Issues Being Fixed

| # | File | Issue |
|---|------|-------|
| 1 | `context-manager.ts` | `EntireProvider` never used as fallback — `HistoryProvider.isAvailable()` always true, so `ContextManager` never tries the next provider |
| 2 | `history-provider.ts` | Title for `latest` query is `"3 sessions"` but spec says `"latest 3 sessions"` |
| 3 | `history-provider.ts` | Truncation loop comment says "first in list" but removes last element |
| 4 | `history-recorder.ts` | `resource_content` and `resource_link` use `(step as any)` casts unnecessarily |
| 5 | `history-provider.ts` | `listSessions` calls `store.exists()` then `store.read()` — double I/O |

---

## File Map

| File | Change |
|------|--------|
| `src/plugins/context/context-manager.ts` | Modify `buildContext` and `listSessions` to cascade through providers |
| `src/plugins/context/history/history-provider.ts` | Fix title format, fix comment, fix double I/O |
| `src/plugins/context/history/history-recorder.ts` | Remove `(step as any)` casts |
| `src/plugins/context/__tests__/context-manager.test.ts` | Add cascade tests |
| `src/plugins/context/history/__tests__/history-provider.test.ts` | Add title format test |

---

### Task 1: Fix ContextManager provider cascade

**Files:**
- Modify: `src/plugins/context/context-manager.ts`
- Test: `src/plugins/context/__tests__/context-manager.test.ts`

The current `getProvider()` returns the first available provider and stops. Since `HistoryProvider.isAvailable()` always returns `true`, `EntireProvider` is never tried. The fix: change `buildContext` and `listSessions` to try each provider in order, using the first that returns a non-empty result.

- [ ] **Step 1: Write the failing tests**

Open `src/plugins/context/__tests__/context-manager.test.ts` and add these tests at the end of the file:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ContextManager } from "../context-manager.js";
import type { ContextProvider, ContextQuery, ContextResult, SessionListResult } from "../context-provider.js";

function makeProvider(name: string, overrides?: Partial<ContextProvider>): ContextProvider {
  return {
    name,
    isAvailable: vi.fn().mockResolvedValue(true),
    listSessions: vi.fn().mockResolvedValue({ sessions: [], estimatedTokens: 0 }),
    buildContext: vi.fn().mockResolvedValue({ markdown: "", tokenEstimate: 0, sessionCount: 0, totalTurns: 0, mode: "full", truncated: false, timeRange: { start: "", end: "" } }),
    ...overrides,
  };
}

const QUERY: ContextQuery = { repoPath: "/repo", type: "session", value: "s1" };

describe("ContextManager — provider cascade", () => {
  it("buildContext skips provider that returns empty markdown and tries next", async () => {
    const first = makeProvider("first"); // returns empty markdown
    const second = makeProvider("second", {
      buildContext: vi.fn().mockResolvedValue({
        markdown: "# History",
        tokenEstimate: 100,
        sessionCount: 1,
        totalTurns: 2,
        mode: "full" as const,
        truncated: false,
        timeRange: { start: "2026-01-01", end: "2026-01-02" },
      }),
    });

    const manager = new ContextManager();
    manager.register(first);
    manager.register(second);

    const result = await manager.buildContext(QUERY);
    expect(result?.markdown).toBe("# History");
    expect(second.buildContext).toHaveBeenCalled();
  });

  it("buildContext returns first non-empty result without calling later providers", async () => {
    const first = makeProvider("first", {
      buildContext: vi.fn().mockResolvedValue({
        markdown: "# First",
        tokenEstimate: 50,
        sessionCount: 1,
        totalTurns: 1,
        mode: "full" as const,
        truncated: false,
        timeRange: { start: "", end: "" },
      }),
    });
    const second = makeProvider("second");

    const manager = new ContextManager();
    manager.register(first);
    manager.register(second);

    const result = await manager.buildContext(QUERY);
    expect(result?.markdown).toBe("# First");
    expect(second.buildContext).not.toHaveBeenCalled();
  });

  it("listSessions skips provider that returns empty and tries next", async () => {
    const first = makeProvider("first"); // returns empty sessions
    const second = makeProvider("second", {
      listSessions: vi.fn().mockResolvedValue({
        sessions: [{ sessionId: "s1", checkpointId: "", sessionIndex: "", transcriptPath: "", createdAt: "", endedAt: "", branch: "", agent: "claude", turnCount: 3, filesTouched: [] }],
        estimatedTokens: 300,
      }),
    });

    const manager = new ContextManager();
    manager.register(first);
    manager.register(second);

    const result = await manager.listSessions(QUERY);
    expect(result?.sessions).toHaveLength(1);
    expect(second.listSessions).toHaveBeenCalled();
  });

  it("returns null when all providers return empty", async () => {
    const manager = new ContextManager();
    manager.register(makeProvider("only"));

    const result = await manager.buildContext(QUERY);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test -- src/plugins/context/__tests__/context-manager.test.ts 2>&1 | tail -30
```

Expected: FAIL — the cascade tests will fail because `ContextManager` currently stops at the first available provider.

- [ ] **Step 3: Fix ContextManager**

Replace the current `buildContext` and `listSessions` methods in `src/plugins/context/context-manager.ts`:

```typescript
async listSessions(query: ContextQuery): Promise<SessionListResult | null> {
  for (const provider of this.providers) {
    if (!(await provider.isAvailable(query.repoPath))) continue;
    const result = await provider.listSessions(query);
    if (result.sessions.length > 0) return result;
  }
  return null;
}

async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult | null> {
  const queryKey = `${query.type}:${query.value}:${options?.limit ?? ""}:${options?.maxTokens ?? ""}`;
  const cached = this.cache.get(query.repoPath, queryKey);
  if (cached) return cached;

  for (const provider of this.providers) {
    if (!(await provider.isAvailable(query.repoPath))) continue;
    const result = await provider.buildContext(query, options);
    if (result && result.markdown) {
      this.cache.set(query.repoPath, queryKey, result);
      return result;
    }
  }
  return null;
}
```

Full updated file (`src/plugins/context/context-manager.ts`):

```typescript
import * as os from "node:os";
import * as path from "node:path";
import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult } from "./context-provider.js";
import { ContextCache } from "./context-cache.js";

export class ContextManager {
  private providers: ContextProvider[] = [];
  private cache: ContextCache;

  constructor() {
    this.cache = new ContextCache(path.join(os.homedir(), ".viben", "cache", "entire"));
  }

  register(provider: ContextProvider): void {
    this.providers.push(provider);
  }

  async getProvider(repoPath: string): Promise<ContextProvider | null> {
    for (const provider of this.providers) {
      if (await provider.isAvailable(repoPath)) return provider;
    }
    return null;
  }

  async listSessions(query: ContextQuery): Promise<SessionListResult | null> {
    for (const provider of this.providers) {
      if (!(await provider.isAvailable(query.repoPath))) continue;
      const result = await provider.listSessions(query);
      if (result.sessions.length > 0) return result;
    }
    return null;
  }

  async buildContext(query: ContextQuery, options?: ContextOptions): Promise<ContextResult | null> {
    const queryKey = `${query.type}:${query.value}:${options?.limit ?? ""}:${options?.maxTokens ?? ""}`;
    const cached = this.cache.get(query.repoPath, queryKey);
    if (cached) return cached;

    for (const provider of this.providers) {
      if (!(await provider.isAvailable(query.repoPath))) continue;
      const result = await provider.buildContext(query, options);
      if (result && result.markdown) {
        this.cache.set(query.repoPath, queryKey, result);
        return result;
      }
    }
    return null;
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
pnpm test -- src/plugins/context/__tests__/context-manager.test.ts 2>&1 | tail -20
```

Expected: all cascade tests PASS.

- [ ] **Step 5: Run full context test suite to confirm no regression**

```bash
pnpm test -- src/plugins/context/ 2>&1 | tail -20
```

Expected: all tests PASS.

---

### Task 2: Fix title format + double I/O + misleading comment in HistoryProvider

**Files:**
- Modify: `src/plugins/context/history/history-provider.ts`
- Test: `src/plugins/context/history/__tests__/history-provider.test.ts`

Three small fixes in one task since they're all in the same file.

**Fix A — Title format**: `latest` query should produce `"latest N sessions"` not `"N sessions"` per spec.

**Fix B — Double I/O**: `listSessions` calls `store.exists()` then `store.read()` separately. Replace with single `store.read()` call.

**Fix C — Misleading comment**: Comment says "Remove the oldest session (first in list, sorted newest-first)" but the code removes the LAST element (which is the oldest). Fix to say "last in list".

- [ ] **Step 1: Write the failing title format test**

Add to the `buildContext — result metadata` describe block in `src/plugins/context/history/__tests__/history-provider.test.ts`:

```typescript
it("uses 'latest N sessions' title for latest query type", async () => {
  const records = [makeSessionRecord("title-1"), makeSessionRecord("title-2")];
  await store.write(makeHistory("title-1", 2));
  await store.write(makeHistory("title-2", 2));

  const provider = new HistoryProvider(store, () => records);
  const result = await provider.buildContext({ repoPath: "/repo", type: "latest", value: "2" });

  expect(result.markdown).toContain("latest 2 sessions");
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test -- src/plugins/context/history/__tests__/history-provider.test.ts 2>&1 | tail -20
```

Expected: FAIL — title shows "2 sessions" not "latest 2 sessions".

- [ ] **Step 3: Apply all three fixes to history-provider.ts**

**Fix A** in `buildMergedMarkdown` (line ~175):
```typescript
// Before:
const title = query.type === "session" ? query.value : `${sessions.length} sessions`;

// After:
const title = query.type === "session" ? query.value : `latest ${sessions.length} sessions`;
```

**Fix B** in `listSessions` — replace the `exists` + `read` pattern:
```typescript
// Before:
for (const record of candidates) {
  if (!(await this.store.exists(record.sessionId))) continue;
  const history = await this.store.read(record.sessionId);
  const turnCount = history?.turns.length ?? 0;
  sessions.push(this.toSessionInfo(record, turnCount));
  estimatedTokens += tokenEstimate;
}

// After:
for (const record of candidates) {
  const history = await this.store.read(record.sessionId);
  if (!history) continue;
  const turnCount = history.turns.length;
  const tokenEstimate = turnCount * TOKENS_PER_TURN_ESTIMATE;
  sessions.push(this.toSessionInfo(record, turnCount));
  estimatedTokens += tokenEstimate;
}
```

Note: the `tokenEstimate` variable was computed outside the loop in the original but referenced inside — this also fixes that scoping issue.

**Fix C** in `buildContext` — fix the comment on the truncation line:
```typescript
// Before:
// Remove the oldest session (first in list, sorted newest-first)
activeSessions = activeSessions.slice(0, activeSessions.length - 1);

// After:
// Remove the oldest session (last in list, sorted newest-first)
activeSessions = activeSessions.slice(0, activeSessions.length - 1);
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
pnpm test -- src/plugins/context/history/__tests__/history-provider.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

---

### Task 3: Remove (step as any) casts in HistoryRecorder

**Files:**
- Modify: `src/plugins/context/history/history-recorder.ts`

The `resource_content` and `resource_link` cases use `(step as any)` when the specific step types (`ResourceStep`, `ResourceLinkStep`) already have those optional fields defined in `types.ts`.

- [ ] **Step 1: Fix resource_content case**

```typescript
// Before:
case "resource_content": {
  const step: Step = {
    type: "resource",
    uri: event.uri,
    name: event.name,
  };
  if (event.text !== undefined) (step as any).text = event.text;
  steps.push(step);
  break;
}

// After:
case "resource_content": {
  const step: import("./types.js").ResourceStep = {
    type: "resource",
    uri: event.uri,
    name: event.name,
  };
  if (event.text !== undefined) step.text = event.text;
  steps.push(step);
  break;
}
```

- [ ] **Step 2: Fix resource_link case**

```typescript
// Before:
case "resource_link": {
  const step: Step = {
    type: "resource_link",
    uri: event.uri,
    name: event.name,
  };
  if (event.title !== undefined) (step as any).title = event.title;
  if (event.description !== undefined)
    (step as any).description = event.description;
  steps.push(step);
  break;
}

// After:
case "resource_link": {
  const step: import("./types.js").ResourceLinkStep = {
    type: "resource_link",
    uri: event.uri,
    name: event.name,
  };
  if (event.title !== undefined) step.title = event.title;
  if (event.description !== undefined) step.description = event.description;
  steps.push(step);
  break;
}
```

- [ ] **Step 3: Add ResourceStep and ResourceLinkStep to imports**

Check the import block at the top of `history-recorder.ts`. If `ResourceStep` and `ResourceLinkStep` are not already imported from `./types.js`, add them:

```typescript
import type {
  HistoryAttachment,
  ResourceLinkStep,
  ResourceStep,
  SessionHistory,
  Step,
  ToolCallStep,
  Turn,
} from "./types.js";
```

- [ ] **Step 4: Run tests to confirm still pass**

```bash
pnpm test -- src/plugins/context/history/__tests__/history-recorder.test.ts 2>&1 | tail -20
```

Expected: all tests PASS.

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test 2>&1 | tail -20
```

Expected: same failures as before (only `debug-tracer.test.ts` — 3 failures unrelated to history). No new failures.

- [ ] **Step 2: TypeScript build check**

```bash
pnpm build 2>&1 | tail -20
```

Expected: no errors.
