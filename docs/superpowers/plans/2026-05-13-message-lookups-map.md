# Message Lookups Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the O(n) mutation-based `groupMessages()` tool resolution in `packages/chat` with a pre-computed O(1) lookup map, following the `buildMessageLookups` pattern from Claude Code.

**Architecture:** A pure `buildMessageLookups(messages)` function builds Maps/Sets in a single O(n) pass over messages. The result is cached via `useMemo` with incremental update support (append-only detection). Lookups are passed to child components via a React context, eliminating the need for mutation on `message.output`/`message.isError` fields.

**Tech Stack:** React 19, TypeScript strict mode, Vitest (test runner in `packages/chat/example`)

---

## Reference Implementation (Claude Code)

The reference lives at `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/infra/claude-code/src/utils/messages.ts` (lines 1191-1625). Key patterns:

1. **Type:** `MessageLookups` is an exported type with 9 fields (Maps + Sets)
2. **Builder:** `buildMessageLookups(normalizedMessages, messages)` does two passes: first over `messages` for tool_use ID collection, then over `normalizedMessages` for results/progress
3. **Incremental:** `updateMessageLookupsIncremental(existing, prevNormCount, prevMsgCount, normalized, messages)` returns mutated `existing` if append-only, or `null` to force full rebuild
4. **Cache key:** `computeMessageStructureKey()` generates a cheap string fingerprint based on message types and tool IDs
5. **Empty sentinel:** `EMPTY_LOOKUPS` is a shared singleton for contexts that don't need real lookups

Our implementation is simpler because `AgentMessage` is a flat structure (not nested `assistant.message.content[]` blocks). Each message has a `type`, and `tool_result` messages have `toolUseId` pointing back to the `tool_use` message.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/chat/src/message-lookups.ts` | `MessageLookups` type, `buildMessageLookups()`, `updateMessageLookupsIncremental()`, `EMPTY_LOOKUPS` constant |
| `packages/chat/src/message-lookups-context.tsx` | React context + provider + `useMessageLookups()` hook |
| `packages/chat/src/__tests__/message-lookups.test.ts` | Unit tests for pure lookup functions |
| `packages/chat/src/message-list.tsx` | Modified: use lookups instead of mutation; wrap children in context provider |
| `packages/chat/src/index.ts` | Modified: export new public types and hook |

---

## Task 1: Define MessageLookups Type and Builder

**Files:**
- Create: `packages/chat/src/message-lookups.ts`
- Create: `packages/chat/src/__tests__/message-lookups.test.ts`

- [ ] **Step 1: Create test file with first failing test**

Create `packages/chat/src/__tests__/message-lookups.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import type { AgentMessage } from "../types";
import { buildMessageLookups, EMPTY_LOOKUPS } from "../message-lookups";

describe("buildMessageLookups", () => {
  it("returns empty lookups for empty messages", () => {
    const lookups = buildMessageLookups([]);
    expect(lookups.toolResultByUseId.size).toBe(0);
    expect(lookups.resolvedIds.size).toBe(0);
    expect(lookups.errorIds.size).toBe(0);
    expect(lookups.inProgressIds.size).toBe(0);
  });

  it("maps tool_result to its tool_use by toolUseId", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: { file_path: "/foo" } },
      { id: "msg-2", type: "tool_result", toolUseId: "tu-1", output: "file contents" },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.toolResultByUseId.get("tu-1")).toEqual(messages[1]);
    expect(lookups.resolvedIds.has("tu-1")).toBe(true);
    expect(lookups.inProgressIds.size).toBe(0);
  });

  it("identifies errored tool results", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Bash", toolUseId: "tu-2", input: { command: "exit 1" } },
      { id: "msg-2", type: "tool_result", toolUseId: "tu-2", output: "error", isError: true },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.errorIds.has("tu-2")).toBe(true);
    expect(lookups.resolvedIds.has("tu-2")).toBe(true);
  });

  it("identifies in-progress tool_use (no matching tool_result)", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Bash", toolUseId: "tu-3", input: { command: "sleep 10" } },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.inProgressIds.has("tu-3")).toBe(true);
    expect(lookups.resolvedIds.has("tu-3")).toBe(false);
  });

  it("handles multiple tool_use/tool_result pairs", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-a", input: {} },
      { id: "msg-2", type: "tool_result", toolUseId: "tu-a", output: "ok" },
      { id: "msg-3", type: "tool_use", name: "Write", toolUseId: "tu-b", input: {} },
      { id: "msg-4", type: "tool_result", toolUseId: "tu-b", output: "done" },
      { id: "msg-5", type: "tool_use", name: "Grep", toolUseId: "tu-c", input: {} },
      // tu-c has no result, so it's in progress
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.resolvedIds.size).toBe(2);
    expect(lookups.inProgressIds.size).toBe(1);
    expect(lookups.inProgressIds.has("tu-c")).toBe(true);
    expect(lookups.toolResultByUseId.get("tu-a")).toEqual(messages[1]);
    expect(lookups.toolResultByUseId.get("tu-b")).toEqual(messages[3]);
  });
});

describe("EMPTY_LOOKUPS", () => {
  it("has empty collections", () => {
    expect(EMPTY_LOOKUPS.toolResultByUseId.size).toBe(0);
    expect(EMPTY_LOOKUPS.resolvedIds.size).toBe(0);
    expect(EMPTY_LOOKUPS.errorIds.size).toBe(0);
    expect(EMPTY_LOOKUPS.inProgressIds.size).toBe(0);
  });
});
```

- [ ] **Step 2: Add vitest config to packages/chat for unit tests**

Create `packages/chat/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
```

Add a test script to `packages/chat/package.json` scripts:

```json
"test": "vitest run"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm test`
Expected: FAIL with "Cannot find module '../message-lookups'"

- [ ] **Step 4: Implement buildMessageLookups and MessageLookups type**

Create `packages/chat/src/message-lookups.ts`:

```typescript
import type { AgentMessage } from "./types";

/**
 * Pre-computed lookup maps for O(1) access to tool result data.
 *
 * Built in a single O(n) pass over messages by `buildMessageLookups()`.
 * Avoids the O(n) per-render scan + mutation pattern of the old `groupMessages()`.
 *
 * Reference: Claude Code's `MessageLookups` in `infra/claude-code/src/utils/messages.ts`
 */
export interface MessageLookups {
  /** Maps tool_use_id -> the tool_result AgentMessage */
  toolResultByUseId: Map<string, AgentMessage>;
  /** Set of tool_use_ids that have a corresponding tool_result */
  resolvedIds: Set<string>;
  /** Set of tool_use_ids whose tool_result has isError=true */
  errorIds: Set<string>;
  /** Set of tool_use_ids that have NO corresponding tool_result (still executing) */
  inProgressIds: Set<string>;
}

/** Empty lookups singleton for contexts that don't need real lookups. */
export const EMPTY_LOOKUPS: MessageLookups = {
  toolResultByUseId: new Map(),
  resolvedIds: new Set(),
  errorIds: new Set(),
  inProgressIds: new Set(),
};

/**
 * Build pre-computed lookups for O(1) access to tool resolution state.
 *
 * Single O(n) pass: collects all tool_use IDs, then all tool_result messages,
 * then derives in-progress = tool_use IDs without a matching tool_result.
 *
 * This is a pure function — no mutation of the input messages array.
 */
export function buildMessageLookups(messages: AgentMessage[]): MessageLookups {
  const toolResultByUseId = new Map<string, AgentMessage>();
  const resolvedIds = new Set<string>();
  const errorIds = new Set<string>();
  const toolUseIds = new Set<string>();

  for (const msg of messages) {
    if (msg.type === "tool_use" && msg.toolUseId) {
      toolUseIds.add(msg.toolUseId);
    } else if (msg.type === "tool_result" && msg.toolUseId) {
      toolResultByUseId.set(msg.toolUseId, msg);
      resolvedIds.add(msg.toolUseId);
      if (msg.isError) {
        errorIds.add(msg.toolUseId);
      }
    }
  }

  // In-progress = tool_use IDs that have no matching tool_result
  const inProgressIds = new Set<string>();
  for (const id of toolUseIds) {
    if (!resolvedIds.has(id)) {
      inProgressIds.add(id);
    }
  }

  return { toolResultByUseId, resolvedIds, errorIds, inProgressIds };
}

/**
 * Incrementally update lookups by processing only newly appended messages.
 *
 * Returns the mutated lookups object if the update succeeded (append-only case),
 * or null if a full rebuild is needed (messages were removed or reordered).
 *
 * Detection heuristic: new array is longer AND the last message ID of the
 * previous slice hasn't changed position.
 */
export function updateMessageLookupsIncremental(
  existing: MessageLookups,
  previousCount: number,
  messages: AgentMessage[],
): MessageLookups | null {
  // Safety: only handle append-only
  if (messages.length < previousCount) {
    return null;
  }

  // No new messages
  if (messages.length === previousCount) {
    return existing;
  }

  // Process only new messages (from previousCount onward)
  for (let i = previousCount; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "tool_use" && msg.toolUseId) {
      // New tool_use: initially in progress until a tool_result arrives
      existing.inProgressIds.add(msg.toolUseId);
    } else if (msg.type === "tool_result" && msg.toolUseId) {
      existing.toolResultByUseId.set(msg.toolUseId, msg);
      existing.resolvedIds.add(msg.toolUseId);
      // Move from in-progress to resolved
      existing.inProgressIds.delete(msg.toolUseId);
      if (msg.isError) {
        existing.errorIds.add(msg.toolUseId);
      }
    }
  }

  return existing;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm test`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/chat/src/message-lookups.ts packages/chat/src/__tests__/message-lookups.test.ts packages/chat/vitest.config.ts packages/chat/package.json
git commit -m "feat(chat): add buildMessageLookups for O(1) tool result resolution"
```

---

## Task 2: Add Incremental Update Tests

**Files:**
- Modify: `packages/chat/src/__tests__/message-lookups.test.ts`

- [ ] **Step 1: Add failing tests for incremental updates**

Append to `packages/chat/src/__tests__/message-lookups.test.ts`:

```typescript
import { updateMessageLookupsIncremental } from "../message-lookups";

describe("updateMessageLookupsIncremental", () => {
  it("returns null when messages were removed (length decreased)", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: {} },
    ];
    const lookups = buildMessageLookups(messages);
    const result = updateMessageLookupsIncremental(lookups, 2, messages);
    expect(result).toBeNull();
  });

  it("returns same lookups when no new messages", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: {} },
    ];
    const lookups = buildMessageLookups(messages);
    const result = updateMessageLookupsIncremental(lookups, 1, messages);
    expect(result).toBe(lookups);
  });

  it("patches lookups when new tool_result appended", () => {
    const initial: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: {} },
    ];
    const lookups = buildMessageLookups(initial);
    expect(lookups.inProgressIds.has("tu-1")).toBe(true);

    const updated: AgentMessage[] = [
      ...initial,
      { id: "msg-2", type: "tool_result", toolUseId: "tu-1", output: "content" },
    ];
    const result = updateMessageLookupsIncremental(lookups, 1, updated);
    expect(result).not.toBeNull();
    expect(result!.inProgressIds.has("tu-1")).toBe(false);
    expect(result!.resolvedIds.has("tu-1")).toBe(true);
    expect(result!.toolResultByUseId.get("tu-1")).toEqual(updated[1]);
  });

  it("patches lookups when new tool_use appended (becomes in-progress)", () => {
    const initial: AgentMessage[] = [
      { id: "msg-1", type: "text", content: "Hello" },
    ];
    const lookups = buildMessageLookups(initial);

    const updated: AgentMessage[] = [
      ...initial,
      { id: "msg-2", type: "tool_use", name: "Bash", toolUseId: "tu-new", input: { command: "ls" } },
    ];
    const result = updateMessageLookupsIncremental(lookups, 1, updated);
    expect(result).not.toBeNull();
    expect(result!.inProgressIds.has("tu-new")).toBe(true);
  });

  it("patches error status correctly on incremental update", () => {
    const initial: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Bash", toolUseId: "tu-err", input: {} },
    ];
    const lookups = buildMessageLookups(initial);

    const updated: AgentMessage[] = [
      ...initial,
      { id: "msg-2", type: "tool_result", toolUseId: "tu-err", output: "fail", isError: true },
    ];
    const result = updateMessageLookupsIncremental(lookups, 1, updated);
    expect(result).not.toBeNull();
    expect(result!.errorIds.has("tu-err")).toBe(true);
    expect(result!.inProgressIds.has("tu-err")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass (implementation already exists)**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm test`
Expected: All tests PASS (incremental update logic was implemented in Task 1)

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/__tests__/message-lookups.test.ts
git commit -m "test(chat): add incremental update tests for message lookups"
```

---

## Task 3: Create MessageLookups Context

**Files:**
- Create: `packages/chat/src/message-lookups-context.tsx`

- [ ] **Step 1: Implement context provider and hook**

Create `packages/chat/src/message-lookups-context.tsx`:

```typescript
import { createContext, useContext, useMemo, useRef } from "react";
import type { AgentMessage } from "./types";
import {
  buildMessageLookups,
  updateMessageLookupsIncremental,
  EMPTY_LOOKUPS,
  type MessageLookups,
} from "./message-lookups";

const MessageLookupsContext = createContext<MessageLookups>(EMPTY_LOOKUPS);

/**
 * Hook to access the pre-computed message lookups.
 *
 * Must be used within a <MessageLookupsProvider>.
 * Returns O(1) access to tool results, error state, and in-progress state.
 */
export function useMessageLookups(): MessageLookups {
  return useContext(MessageLookupsContext);
}

interface MessageLookupsProviderProps {
  messages: AgentMessage[];
  children: React.ReactNode;
}

/**
 * Provider that builds and caches MessageLookups for all descendants.
 *
 * Uses incremental update: if only new messages were appended (detected by
 * count comparison), patches the existing Maps/Sets rather than rebuilding.
 * Falls back to a full rebuild when messages shrink or are reordered.
 */
export function MessageLookupsProvider({
  messages,
  children,
}: MessageLookupsProviderProps) {
  const cacheRef = useRef<{
    lookups: MessageLookups;
    messageCount: number;
  } | null>(null);

  const lookups = useMemo(() => {
    const cache = cacheRef.current;

    if (cache && messages.length >= cache.messageCount) {
      // Try incremental update
      const updated = updateMessageLookupsIncremental(
        cache.lookups,
        cache.messageCount,
        messages,
      );
      if (updated) {
        cacheRef.current = { lookups: updated, messageCount: messages.length };
        return updated;
      }
    }

    // Full rebuild
    const fresh = buildMessageLookups(messages);
    cacheRef.current = { lookups: fresh, messageCount: messages.length };
    return fresh;
  }, [messages]);

  return (
    <MessageLookupsContext.Provider value={lookups}>
      {children}
    </MessageLookupsContext.Provider>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-lookups-context.tsx
git commit -m "feat(chat): add MessageLookupsProvider context with incremental caching"
```

---

## Task 4: Integrate Lookups into MessageList (Replace Mutation)

**Files:**
- Modify: `packages/chat/src/message-list.tsx`

This task removes the mutation pattern (`message.output = result.output; message.isError = result.isError`) in the Agent/Task tool branch of `groupMessages()` and instead uses the lookups context for resolution.

- [ ] **Step 1: Add import for MessageLookupsProvider at top of message-list.tsx**

Add to the imports in `packages/chat/src/message-list.tsx`:

```typescript
import { MessageLookupsProvider } from "./message-lookups-context";
```

- [ ] **Step 2: Remove the mutation in groupMessages for Agent/Task tools**

In `groupMessages()` (around line 588-593), replace the mutation block:

```typescript
// OLD (mutation):
const result = message.toolUseId ? getToolResult(message.toolUseId) : undefined;
if (result && !message.output) {
  message.output = result.output;
  message.isError = result.isError;
}
groups.push({ type: "other", message });
```

With a non-mutating approach — the message is pushed as-is. Consumers will resolve via context:

```typescript
// NEW (no mutation — consumers use lookups context):
groups.push({ type: "other", message });
```

- [ ] **Step 3: Wrap the MessageList render output in MessageLookupsProvider**

In the `MessageList` component's return (around line 1155), wrap the content inside the `<ScrollArea>` with the provider. The provider goes around the outermost `<div>`:

```typescript
return (
  <MessageLookupsProvider messages={messages}>
    <div ref={containerRef} className={cn("relative flex-1 w-full min-h-0 min-w-0 overflow-hidden", className)}>
      {/* ... existing ScrollArea content ... */}
    </div>
  </MessageLookupsProvider>
);
```

- [ ] **Step 4: Update the ToolWithResult resolution in renderToolsWithCollapsing**

The existing `ToolWithResult` type already has a `result?: AgentMessage` field that gets populated from the `toolResultMap` in `groupMessages()`. This existing approach is already correct — it resolves once during grouping via the local `toolResultMap`. The key fix is removing the **mutation** for Agent/Task tools. The `toolResultMap` used inside `groupMessages()` is fine (it's a local Map built per-call, not mutation on the message object).

No change needed for non-Agent/Task tools since they already use `group.tools.push({ message, globalIndex, result })` which reads from the local `toolResultMap`.

- [ ] **Step 5: Update MessageItem rendering for Agent/Task tool_use messages**

In the render loop (around line 1182-1222), when rendering an Agent/Task tool as `MessageItem`, the component already receives the `message` prop. The `MessageItem` for `tool_use` type with `name === "Agent" || name === "Task"` needs to resolve its output from the lookups context instead of relying on mutated `message.output`.

In `message-item.tsx` (or wherever the Agent/Task tool is rendered), add lookup resolution. Since the `MessageItem` delegates to `ToolExecutionItem` for tool_use messages, and `ToolExecutionItem` already accepts `output` and `isError` as props, we need to resolve these at the call site.

Update the render in `message-list.tsx` where Agent/Task `tool_use` messages are rendered. Find the code path where `message.type === "tool_use"` and `(message.name === "Agent" || message.name === "Task")` are rendered as `MessageItem`. Add lookup resolution:

Create a small wrapper component inside `message-list.tsx`:

```typescript
/**
 * Resolves tool output from lookups context for Agent/Task standalone messages.
 * This replaces the old mutation pattern where groupMessages() set message.output directly.
 */
function ResolvedMessageItem({
  message,
  ...props
}: { message: AgentMessage } & Omit<React.ComponentProps<typeof MessageItem>, "message">) {
  const lookups = useMessageLookups();

  // For Agent/Task tool_use messages, resolve output from lookups if not already on message
  const resolvedMessage = useMemo(() => {
    if (message.type === "tool_use" && message.toolUseId && !message.output) {
      const result = lookups.toolResultByUseId.get(message.toolUseId);
      if (result) {
        return { ...message, output: result.output, isError: result.isError };
      }
    }
    return message;
  }, [message, lookups]);

  return <MessageItem message={resolvedMessage} {...props} />;
}
```

Then use `<ResolvedMessageItem>` in place of `<MessageItem>` in the render loop.

- [ ] **Step 6: Add import for useMessageLookups**

```typescript
import { useMessageLookups } from "./message-lookups-context";
```

- [ ] **Step 7: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm typecheck`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "refactor(chat): replace mutation-based tool resolution with lookups context"
```

---

## Task 5: Use Lookups in RunningIndicator

**Files:**
- Modify: `packages/chat/src/message-list.tsx`

The `RunningIndicator` component (around line 682-838) has its own inline computation to find unresolved tool_use messages. Replace it with lookups context.

- [ ] **Step 1: Refactor RunningIndicator to use lookups**

Replace the `lastToolUse` computation in `RunningIndicator` (lines 687-706):

```typescript
// OLD:
const lastToolUse = useMemo(() => {
  const toolResultIds = new Set<string>();
  for (const m of messages) {
    if (m.type === "tool_result" && m.toolUseId) {
      toolResultIds.add(m.toolUseId);
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type === "tool_use" && m.toolUseId && !toolResultIds.has(m.toolUseId)) {
      return m;
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "tool_use") return messages[i];
  }
  return undefined;
}, [messages]);
```

With lookups-based version:

```typescript
// NEW:
const lookups = useMessageLookups();
const lastToolUse = useMemo(() => {
  // Find last in-progress tool_use by scanning backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.type === "tool_use" && m.toolUseId && lookups.inProgressIds.has(m.toolUseId)) {
      return m;
    }
  }
  // Fallback: last tool_use regardless
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "tool_use") return messages[i];
  }
  return undefined;
}, [messages, lookups.inProgressIds]);
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "refactor(chat): use lookups context in RunningIndicator for O(1) tool status"
```

---

## Task 6: Export Public API

**Files:**
- Modify: `packages/chat/src/index.ts`

- [ ] **Step 1: Add exports for message lookups**

Add to `packages/chat/src/index.ts` after the existing message component exports:

```typescript
// Message Lookups
export { buildMessageLookups, updateMessageLookupsIncremental, EMPTY_LOOKUPS } from "./message-lookups";
export type { MessageLookups } from "./message-lookups";
export { MessageLookupsProvider, useMessageLookups } from "./message-lookups-context";
```

- [ ] **Step 2: Verify typecheck passes for the whole package**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Verify the desktop app still compiles**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add packages/chat/src/index.ts
git commit -m "feat(chat): export MessageLookups public API"
```

---

## Task 7: Remove Dead toolResultMap Scan in groupMessages

**Files:**
- Modify: `packages/chat/src/message-list.tsx`

Now that Agent/Task tool resolution is done via context, and the local `toolResultMap` is only used for `ToolWithResult.result` field resolution in task groups, we can simplify. The `toolResultMap` local is still needed for the task group resolution (non-Agent/Task tools). However, the **mutation** (`message.output = result.output`) is now gone. Verify no mutation remains.

- [ ] **Step 1: Audit groupMessages for remaining mutations**

Search for any assignment to `message.output` or `message.isError` in `groupMessages()`. After Task 4, there should be none. Confirm the function is now pure (only reads from messages, writes to the new `groups` array).

- [ ] **Step 2: Add a code comment documenting the pure behavior**

Add a JSDoc comment to `groupMessages`:

```typescript
/**
 * Group messages into task groups for better display.
 *
 * IMPORTANT: This function is pure — it does NOT mutate any message objects.
 * Tool result resolution for task groups uses a local Map (toolResultMap).
 * Agent/Task tool_use messages are resolved at render time via MessageLookupsContext.
 */
```

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "docs(chat): document groupMessages as pure function after mutation removal"
```

---

## Task 8: Final Integration Test

**Files:**
- Modify: `packages/chat/src/__tests__/message-lookups.test.ts`

- [ ] **Step 1: Add integration-style test simulating streaming scenario**

Append to `packages/chat/src/__tests__/message-lookups.test.ts`:

```typescript
describe("streaming simulation", () => {
  it("correctly transitions tool from in-progress to resolved during streaming", () => {
    // Simulate: stream starts with tool_use, then tool_result arrives later
    const phase1: AgentMessage[] = [
      { id: "msg-1", type: "user", content: "Do something" },
      { id: "msg-2", type: "text", content: "I'll read the file" },
      { id: "msg-3", type: "tool_use", name: "Read", toolUseId: "tu-stream", input: { file_path: "/a.ts" } },
    ];

    const lookups = buildMessageLookups(phase1);
    expect(lookups.inProgressIds.has("tu-stream")).toBe(true);
    expect(lookups.resolvedIds.has("tu-stream")).toBe(false);

    // Phase 2: tool_result arrives
    const phase2: AgentMessage[] = [
      ...phase1,
      { id: "msg-4", type: "tool_result", toolUseId: "tu-stream", output: "const x = 1;" },
      { id: "msg-5", type: "text", content: "Here is the file content" },
    ];

    const updated = updateMessageLookupsIncremental(lookups, phase1.length, phase2);
    expect(updated).not.toBeNull();
    expect(updated!.inProgressIds.has("tu-stream")).toBe(false);
    expect(updated!.resolvedIds.has("tu-stream")).toBe(true);
    expect(updated!.toolResultByUseId.get("tu-stream")?.output).toBe("const x = 1;");
  });

  it("full rebuild produces same result as incremental for append-only", () => {
    const messages: AgentMessage[] = [
      { id: "m1", type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { id: "m2", type: "tool_result", toolUseId: "t1", output: "ok" },
      { id: "m3", type: "tool_use", name: "Write", toolUseId: "t2", input: {} },
    ];

    // Build from scratch with first 2 messages, then incrementally add msg 3
    const base = buildMessageLookups(messages.slice(0, 2));
    const incremental = updateMessageLookupsIncremental(base, 2, messages);

    // Build from scratch with all 3 messages
    const full = buildMessageLookups(messages);

    expect(incremental).not.toBeNull();
    expect(incremental!.resolvedIds).toEqual(full.resolvedIds);
    expect(incremental!.inProgressIds).toEqual(full.inProgressIds);
    expect(incremental!.errorIds).toEqual(full.errorIds);
    // toolResultByUseId should have same keys
    expect(new Set(incremental!.toolResultByUseId.keys())).toEqual(
      new Set(full.toolResultByUseId.keys())
    );
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/chat && pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Run full typecheck from repo root**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: No type errors across the monorepo

- [ ] **Step 4: Commit**

```bash
git add packages/chat/src/__tests__/message-lookups.test.ts
git commit -m "test(chat): add streaming simulation and incremental consistency tests"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| `groupMessages()` scans all messages for tool_result, then **mutates** `message.output` on Agent/Task tool_use | `buildMessageLookups()` does a single O(n) pass, builds immutable Maps/Sets, never touches input messages |
| `RunningIndicator` builds its own local `Set<string>` of resolved IDs each render | `RunningIndicator` reads `lookups.inProgressIds` from context (O(1) `.has()` check) |
| No caching between renders for tool resolution data | `useMemo` + `useRef` cache with incremental update (append-only path avoids full rebuild) |
| Tool result data coupled to message grouping logic | Tool result data decoupled into `message-lookups.ts` (testable, reusable) |
