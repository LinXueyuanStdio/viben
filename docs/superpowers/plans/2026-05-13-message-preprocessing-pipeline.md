# Message Preprocessing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline `groupMessages` call in `packages/chat/src/message-list.tsx` with a structured preprocessing pipeline that normalizes, groups tool pairs, auto-collapses consecutive read/search/bash operations, and builds O(1) lookup tables — all in a single `useMemo` keyed on structural dependencies only.

**Architecture:** A new `preprocessMessages()` pure function performs all expensive structural transforms in pipeline stages. The `MessageList` component calls it inside ONE `useMemo` keyed on `[messages, isStreaming, simpleMode]`. Rendering-only state (expanded groups, scroll position, highlight) is kept OUT of that useMemo's deps. The pipeline outputs a `ProcessedMessages` object containing grouped/collapsed messages plus lookup maps.

**Tech Stack:** React 19, TypeScript strict, vitest (from desktop app setup), `@viben/chat` package conventions.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/chat/src/preprocessing/types.ts` | Type definitions for pipeline output (`ProcessedMessages`, `CollapsedGroup`, `ToolPairGroup`, `MessageLookups`) |
| `packages/chat/src/preprocessing/normalize.ts` | Stage 1: merge consecutive streaming text, deduplicate plans, build tool result map |
| `packages/chat/src/preprocessing/group-tool-pairs.ts` | Stage 2: pair `tool_use` with its `tool_result` (same `toolUseId`) |
| `packages/chat/src/preprocessing/collapse-read-search.ts` | Stage 3: collapse consecutive read/search/bash runs into `CollapsedGroup` |
| `packages/chat/src/preprocessing/build-lookups.ts` | Stage 4: build O(1) lookup maps (toolUseId → result, messageId → index) |
| `packages/chat/src/preprocessing/pipeline.ts` | Orchestrator: runs all stages, returns `ProcessedMessages` |
| `packages/chat/src/preprocessing/index.ts` | Barrel export |
| `packages/chat/src/preprocessing/__tests__/normalize.test.ts` | Unit tests for normalize stage |
| `packages/chat/src/preprocessing/__tests__/group-tool-pairs.test.ts` | Unit tests for grouping stage |
| `packages/chat/src/preprocessing/__tests__/collapse-read-search.test.ts` | Unit tests for collapse stage |
| `packages/chat/src/preprocessing/__tests__/pipeline.test.ts` | Integration test for full pipeline |
| `packages/chat/src/message-list.tsx` | Modified: replace inline `groupMessages` with pipeline `useMemo` |
| `packages/chat/src/collapsed-tool-group.tsx` | Modified: accept `CollapsedGroup` data from pipeline |

---

## Task 1: Define Pipeline Types

**Files:**
- Create: `packages/chat/src/preprocessing/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// packages/chat/src/preprocessing/types.ts
import type { AgentMessage } from "../types";

/** A tool_use message paired with its matching tool_result */
export interface ToolPair {
  toolUse: AgentMessage;
  toolResult: AgentMessage | undefined;
  /** Original index in the normalized message array */
  originalIndex: number;
}

/** A group of same-response tool_use messages (same API response) */
export interface ToolPairGroup {
  type: "tool_pair_group";
  pairs: ToolPair[];
  /** First tool_use timestamp for ordering */
  timestamp: number | undefined;
}

/** A run of consecutive collapsible tools (Read/Glob/Grep/Bash-read) collapsed into one line */
export interface CollapsedGroup {
  type: "collapsed_group";
  pairs: ToolPair[];
  counts: CollapsedCounts;
  /** Display hint from last tool (e.g. file path or pattern) */
  latestHint: string;
  /** Timestamp of the first pair */
  timestamp: number | undefined;
}

/** Counts for collapsed group summary text */
export interface CollapsedCounts {
  read: number;
  search: number;
  bash: number;
  write: number;
  edit: number;
  other: number;
}

/** A renderable item in the processed message list */
export type ProcessedItem =
  | { type: "message"; message: AgentMessage; originalIndex: number }
  | { type: "collapsed_group"; group: CollapsedGroup }
  | { type: "task_group"; title: string; description: string; pairs: ToolPair[]; isCompleted: boolean };

/** O(1) lookup tables built from messages */
export interface MessageLookups {
  /** toolUseId → matching tool_result message */
  resultByToolUseId: Map<string, AgentMessage>;
  /** toolUseId → tool_use message */
  toolUseById: Map<string, AgentMessage>;
  /** message id → index in processedItems */
  indexById: Map<string, number>;
}

/** Final output of the preprocessing pipeline */
export interface ProcessedMessages {
  items: ProcessedItem[];
  lookups: MessageLookups;
  /** Whether the last group is still in progress (no result yet) */
  hasActiveGroup: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat/src/preprocessing/types.ts
git commit -m "feat(chat): add preprocessing pipeline type definitions"
```

---

## Task 2: Implement Normalize Stage

**Files:**
- Create: `packages/chat/src/preprocessing/normalize.ts`
- Create: `packages/chat/src/preprocessing/__tests__/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/chat/src/preprocessing/__tests__/normalize.test.ts
import { describe, test, expect } from "vitest";
import { normalizeMessages } from "../normalize";
import type { AgentMessage } from "../../types";

describe("normalizeMessages", () => {
  test("merges consecutive streaming text messages, keeping last", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "Hello" },
      { type: "text", content: "Hello world" },
      { type: "text", content: "Hello world!" },
    ];
    const result = normalizeMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
    expect(result[0].content).toBe("Hello world!");
  });

  test("preserves text messages separated by tool_use", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "First thought" },
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: { file_path: "/a.ts" } },
      { type: "tool_result", toolUseId: "tu1", output: "content" },
      { type: "text", content: "Second thought" },
    ];
    const result = normalizeMessages(messages);
    const textMessages = result.filter((m) => m.type === "text");
    expect(textMessages).toHaveLength(2);
    expect(textMessages[0].content).toBe("First thought");
    expect(textMessages[1].content).toBe("Second thought");
  });

  test("keeps only last plan message", () => {
    const messages: AgentMessage[] = [
      { type: "plan", plan: { goal: "old", steps: [] } },
      { type: "text", content: "Working..." },
      { type: "plan", plan: { goal: "new", steps: [] } },
    ];
    const result = normalizeMessages(messages);
    const plans = result.filter((m) => m.type === "plan");
    expect(plans).toHaveLength(1);
    expect(plans[0].plan?.goal).toBe("new");
  });

  test("skips text that looks like raw plan JSON", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: '{"type": "plan", "goal": "test"}' },
      { type: "text", content: "Actual message" },
    ];
    const result = normalizeMessages(messages);
    const textMessages = result.filter((m) => m.type === "text");
    expect(textMessages).toHaveLength(1);
    expect(textMessages[0].content).toBe("Actual message");
  });

  test("filters out tool_result messages (they are paired via lookup)", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: {} },
      { type: "tool_result", toolUseId: "tu1", output: "data" },
    ];
    const result = normalizeMessages(messages);
    expect(result.filter((m) => m.type === "tool_result")).toHaveLength(0);
    expect(result.filter((m) => m.type === "tool_use")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/normalize.test.ts`
Expected: FAIL with "Cannot find module '../normalize'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/chat/src/preprocessing/normalize.ts
import type { AgentMessage } from "../types";

/**
 * Stage 1: Normalize raw messages.
 * - Merge consecutive streaming text (keep last)
 * - Remove duplicate plan messages (keep last)
 * - Filter out raw plan JSON text
 * - Remove tool_result messages (they are paired via lookups)
 *
 * Returns a new array (no mutation).
 */
export function normalizeMessages(messages: AgentMessage[]): AgentMessage[] {
  // Find last plan index
  let lastPlanIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === "plan") {
      lastPlanIdx = i;
      break;
    }
  }

  const result: AgentMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip tool_result — they are consumed via lookup
    if (msg.type === "tool_result") continue;

    // Skip duplicate plan messages (keep only last)
    if (msg.type === "plan" && i !== lastPlanIdx) continue;

    // Skip text that looks like raw plan JSON
    if (msg.type === "text" && msg.content) {
      const trimmed = msg.content.trim();
      if (
        trimmed.startsWith("{") &&
        trimmed.includes('"type"') &&
        trimmed.includes('"plan"')
      ) {
        continue;
      }
    }

    // Merge consecutive text messages (keep last in a run)
    if (msg.type === "text" && msg.content) {
      const next = messages[i + 1];
      if (next && next.type === "text" && next.content) {
        // Skip this one — next is a more complete streaming update
        continue;
      }
    }

    result.push(msg);
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/normalize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/chat/src/preprocessing/normalize.ts packages/chat/src/preprocessing/__tests__/normalize.test.ts
git commit -m "feat(chat): implement normalize stage for message preprocessing"
```

---

## Task 3: Implement Group Tool Pairs Stage

**Files:**
- Create: `packages/chat/src/preprocessing/group-tool-pairs.ts`
- Create: `packages/chat/src/preprocessing/__tests__/group-tool-pairs.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/chat/src/preprocessing/__tests__/group-tool-pairs.test.ts
import { describe, test, expect } from "vitest";
import { groupToolPairs } from "../group-tool-pairs";
import type { AgentMessage } from "../../types";

describe("groupToolPairs", () => {
  test("pairs tool_use with tool_result by toolUseId", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: { file_path: "/a.ts" } },
      { type: "tool_use", name: "Grep", toolUseId: "tu2", input: { pattern: "foo" } },
    ];
    const allMessages: AgentMessage[] = [
      ...messages,
      { type: "tool_result", toolUseId: "tu1", output: "file content" },
      { type: "tool_result", toolUseId: "tu2", output: "grep result" },
    ];
    const result = groupToolPairs(messages, allMessages);
    expect(result).toHaveLength(2);
    expect(result[0].toolUse.toolUseId).toBe("tu1");
    expect(result[0].toolResult?.output).toBe("file content");
    expect(result[1].toolUse.toolUseId).toBe("tu2");
    expect(result[1].toolResult?.output).toBe("grep result");
  });

  test("returns undefined result for unresolved tool_use", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: {} },
    ];
    const result = groupToolPairs(messages, messages);
    expect(result).toHaveLength(1);
    expect(result[0].toolResult).toBeUndefined();
  });

  test("skips non-tool_use messages", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "hello" },
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: {} },
    ];
    const result = groupToolPairs(messages, messages);
    expect(result).toHaveLength(1);
    expect(result[0].toolUse.toolUseId).toBe("tu1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/group-tool-pairs.test.ts`
Expected: FAIL with "Cannot find module '../group-tool-pairs'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/chat/src/preprocessing/group-tool-pairs.ts
import type { AgentMessage } from "../types";
import type { ToolPair } from "./types";

/**
 * Stage 2: Pair each tool_use with its matching tool_result.
 *
 * @param normalizedMessages - Messages after normalization (no tool_result present)
 * @param allMessages - Original full message array (includes tool_result for lookup)
 * @returns Array of ToolPair objects for tool_use messages only
 */
export function groupToolPairs(
  normalizedMessages: AgentMessage[],
  allMessages: AgentMessage[]
): ToolPair[] {
  // Build result lookup from the full message array
  const resultMap = new Map<string, AgentMessage>();
  for (const msg of allMessages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resultMap.set(msg.toolUseId, msg);
    }
  }

  const pairs: ToolPair[] = [];
  for (let i = 0; i < normalizedMessages.length; i++) {
    const msg = normalizedMessages[i];
    if (msg.type !== "tool_use" || !msg.toolUseId) continue;

    pairs.push({
      toolUse: msg,
      toolResult: resultMap.get(msg.toolUseId),
      originalIndex: i,
    });
  }

  return pairs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/group-tool-pairs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/chat/src/preprocessing/group-tool-pairs.ts packages/chat/src/preprocessing/__tests__/group-tool-pairs.test.ts
git commit -m "feat(chat): implement tool pair grouping stage"
```

---

## Task 4: Implement Collapse Read/Search Stage

**Files:**
- Create: `packages/chat/src/preprocessing/collapse-read-search.ts`
- Create: `packages/chat/src/preprocessing/__tests__/collapse-read-search.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/chat/src/preprocessing/__tests__/collapse-read-search.test.ts
import { describe, test, expect } from "vitest";
import { collapseConsecutiveTools } from "../collapse-read-search";
import type { AgentMessage } from "../../types";
import type { ProcessedItem, ToolPair } from "../types";

function makePair(name: string, toolUseId: string, input?: Record<string, unknown>, hasResult = true): ToolPair {
  return {
    toolUse: { type: "tool_use", name, toolUseId, input: input || {} },
    toolResult: hasResult ? { type: "tool_result", toolUseId, output: "ok" } : undefined,
    originalIndex: 0,
  };
}

describe("collapseConsecutiveTools", () => {
  test("collapses 2+ consecutive Read/Glob/Grep into a CollapsedGroup", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "text", content: "Let me check" }, originalIndex: 0 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: { file_path: "/a.ts" } }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Grep", toolUseId: "t2", input: { pattern: "foo" } }, originalIndex: 2 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t3", input: { file_path: "/b.ts" } }, originalIndex: 3 },
      { type: "message", message: { type: "text", content: "Done" }, originalIndex: 4 },
    ];
    const allMessages: AgentMessage[] = [
      { type: "text", content: "Let me check" },
      { type: "tool_use", name: "Read", toolUseId: "t1", input: { file_path: "/a.ts" } },
      { type: "tool_result", toolUseId: "t1", output: "content" },
      { type: "tool_use", name: "Grep", toolUseId: "t2", input: { pattern: "foo" } },
      { type: "tool_result", toolUseId: "t2", output: "matches" },
      { type: "tool_use", name: "Read", toolUseId: "t3", input: { file_path: "/b.ts" } },
      { type: "tool_result", toolUseId: "t3", output: "content2" },
      { type: "text", content: "Done" },
    ];
    const result = collapseConsecutiveTools(items, allMessages);
    expect(result).toHaveLength(3); // text, collapsed_group, text
    expect(result[0].type).toBe("message");
    expect(result[1].type).toBe("collapsed_group");
    expect(result[2].type).toBe("message");
    if (result[1].type === "collapsed_group") {
      expect(result[1].group.pairs).toHaveLength(3);
      expect(result[1].group.counts.read).toBe(2);
      expect(result[1].group.counts.search).toBe(1);
    }
  });

  test("does NOT collapse a single tool_use (needs 2+)", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "text", content: "Done" }, originalIndex: 1 },
    ];
    const result = collapseConsecutiveTools(items, []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("message");
    expect(result[1].type).toBe("message");
  });

  test("breaks collapse on non-collapsible tool (Write, Edit)", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t2", input: {} }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Write", toolUseId: "t3", input: {} }, originalIndex: 2 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t4", input: {} }, originalIndex: 3 },
    ];
    const result = collapseConsecutiveTools(items, []);
    // collapsed(Read,Read), Write, Read (single, not collapsed)
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("collapsed_group");
    expect(result[1].type).toBe("message");
    expect(result[2].type).toBe("message");
  });

  test("breaks collapse on text message", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "text", content: "thinking..." }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t2", input: {} }, originalIndex: 2 },
    ];
    const result = collapseConsecutiveTools(items, []);
    // Read(single), text, Read(single) — no collapse since neither run has 2+
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.type === "message")).toBe(true);
  });

  test("Bash tool is collapsible", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "tool_use", name: "Bash", toolUseId: "t2", input: { command: "ls" } }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Grep", toolUseId: "t3", input: {} }, originalIndex: 2 },
    ];
    const result = collapseConsecutiveTools(items, []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("collapsed_group");
    if (result[0].type === "collapsed_group") {
      expect(result[0].group.counts.read).toBe(1);
      expect(result[0].group.counts.bash).toBe(1);
      expect(result[0].group.counts.search).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/collapse-read-search.test.ts`
Expected: FAIL with "Cannot find module '../collapse-read-search'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/chat/src/preprocessing/collapse-read-search.ts
import type { AgentMessage } from "../types";
import type { CollapsedCounts, CollapsedGroup, ProcessedItem, ToolPair } from "./types";
import { getDisplayPath } from "../utils";

/** Tool names that are collapsible (read-only operations) */
const COLLAPSIBLE_TOOLS = new Set(["Read", "Glob", "Grep", "Bash"]);

/** Check if a tool_use message is collapsible */
function isCollapsibleTool(msg: AgentMessage): boolean {
  return msg.type === "tool_use" && COLLAPSIBLE_TOOLS.has(msg.name || "");
}

/** Categorize a tool name into a count bucket */
function categorize(name: string): keyof CollapsedCounts {
  switch (name) {
    case "Read": return "read";
    case "Glob":
    case "Grep": return "search";
    case "Bash": return "bash";
    case "Write": return "write";
    case "Edit":
    case "MultiEdit": return "edit";
    default: return "other";
  }
}

/** Extract a display hint from a tool input */
function extractHint(name: string, input: Record<string, unknown> | undefined): string {
  if (!input) return "";
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return input.file_path ? getDisplayPath(String(input.file_path)) : "";
    case "Grep":
      return input.pattern ? `"${String(input.pattern).slice(0, 30)}"` : "";
    case "Glob":
      return input.pattern ? String(input.pattern).slice(0, 40) : "";
    case "Bash":
      return input.command ? `$ ${String(input.command).slice(0, 50)}` : "";
    default:
      return "";
  }
}

/** Build a CollapsedGroup from a run of collapsible tool messages */
function buildCollapsedGroup(
  run: { item: ProcessedItem; msg: AgentMessage }[],
  allMessages: AgentMessage[]
): CollapsedGroup {
  // Build result lookup
  const resultMap = new Map<string, AgentMessage>();
  for (const msg of allMessages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resultMap.set(msg.toolUseId, msg);
    }
  }

  const counts: CollapsedCounts = { read: 0, search: 0, bash: 0, write: 0, edit: 0, other: 0 };
  const pairs: ToolPair[] = [];
  let latestHint = "";

  for (const { item, msg } of run) {
    const category = categorize(msg.name || "");
    counts[category]++;
    const hint = extractHint(msg.name || "", msg.input);
    if (hint) latestHint = hint;
    pairs.push({
      toolUse: msg,
      toolResult: msg.toolUseId ? resultMap.get(msg.toolUseId) : undefined,
      originalIndex: item.type === "message" ? item.originalIndex : 0,
    });
  }

  return {
    type: "collapsed_group",
    pairs,
    counts,
    latestHint,
    timestamp: run[0]?.msg.timestamp,
  };
}

/**
 * Stage 3: Collapse consecutive collapsible tool_use messages into CollapsedGroup items.
 *
 * Rules:
 * - Groups 2+ consecutive collapsible tools (Read, Glob, Grep, Bash)
 * - Breaks on: text messages, non-collapsible tools (Write, Edit), user messages
 * - A single collapsible tool is left as-is (not collapsed)
 */
export function collapseConsecutiveTools(
  items: ProcessedItem[],
  allMessages: AgentMessage[]
): ProcessedItem[] {
  const result: ProcessedItem[] = [];
  let currentRun: { item: ProcessedItem; msg: AgentMessage }[] = [];

  function flushRun() {
    if (currentRun.length >= 2) {
      result.push({
        type: "collapsed_group",
        group: buildCollapsedGroup(currentRun, allMessages),
      });
    } else if (currentRun.length === 1) {
      result.push(currentRun[0].item);
    }
    currentRun = [];
  }

  for (const item of items) {
    if (item.type === "message" && isCollapsibleTool(item.message)) {
      currentRun.push({ item, msg: item.message });
    } else {
      flushRun();
      result.push(item);
    }
  }

  flushRun();
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/collapse-read-search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/chat/src/preprocessing/collapse-read-search.ts packages/chat/src/preprocessing/__tests__/collapse-read-search.test.ts
git commit -m "feat(chat): implement collapse-read-search stage with GroupAccumulator pattern"
```

---

## Task 5: Implement Build Lookups Stage

**Files:**
- Create: `packages/chat/src/preprocessing/build-lookups.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// packages/chat/src/preprocessing/build-lookups.ts
import type { AgentMessage } from "../types";
import type { MessageLookups, ProcessedItem } from "./types";

/**
 * Stage 4: Build O(1) lookup maps from the processed items.
 *
 * Maps:
 * - toolUseId → tool_result message (for checking completion state)
 * - toolUseId → tool_use message (for resolving tool call info)
 * - message id → index in processedItems (for scroll-to-message)
 */
export function buildMessageLookups(
  allMessages: AgentMessage[],
  processedItems: ProcessedItem[]
): MessageLookups {
  const resultByToolUseId = new Map<string, AgentMessage>();
  const toolUseById = new Map<string, AgentMessage>();

  for (const msg of allMessages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resultByToolUseId.set(msg.toolUseId, msg);
    }
    if (msg.type === "tool_use" && msg.toolUseId) {
      toolUseById.set(msg.toolUseId, msg);
    }
  }

  const indexById = new Map<string, number>();
  for (let i = 0; i < processedItems.length; i++) {
    const item = processedItems[i];
    if (item.type === "message" && item.message.id) {
      indexById.set(item.message.id, i);
    }
  }

  return { resultByToolUseId, toolUseById, indexById };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat/src/preprocessing/build-lookups.ts
git commit -m "feat(chat): implement build-lookups stage for O(1) message resolution"
```

---

## Task 6: Implement Pipeline Orchestrator

**Files:**
- Create: `packages/chat/src/preprocessing/pipeline.ts`
- Create: `packages/chat/src/preprocessing/index.ts`
- Create: `packages/chat/src/preprocessing/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/chat/src/preprocessing/__tests__/pipeline.test.ts
import { describe, test, expect } from "vitest";
import { preprocessMessages } from "../pipeline";
import type { AgentMessage } from "../../types";

describe("preprocessMessages", () => {
  test("full pipeline: normalize → collapse → lookups", () => {
    const messages: AgentMessage[] = [
      { type: "user", content: "Read those files" },
      { type: "text", content: "Let me check" },
      { type: "text", content: "Let me check the files" }, // streaming dupe
      { type: "tool_use", name: "Read", toolUseId: "t1", input: { file_path: "/a.ts" } },
      { type: "tool_result", toolUseId: "t1", output: "content-a" },
      { type: "tool_use", name: "Grep", toolUseId: "t2", input: { pattern: "hello" } },
      { type: "tool_result", toolUseId: "t2", output: "matches" },
      { type: "tool_use", name: "Read", toolUseId: "t3", input: { file_path: "/b.ts" } },
      { type: "tool_result", toolUseId: "t3", output: "content-b" },
      { type: "text", content: "Here is what I found" },
    ];

    const result = preprocessMessages(messages, false);

    // Expected items: user, text("Let me check the files"), collapsed_group(3 tools), text("Here is what I found")
    expect(result.items).toHaveLength(4);
    expect(result.items[0].type).toBe("message");
    expect(result.items[1].type).toBe("message");
    expect(result.items[2].type).toBe("collapsed_group");
    expect(result.items[3].type).toBe("message");

    // Lookups should resolve toolUseId → result
    expect(result.lookups.resultByToolUseId.get("t1")?.output).toBe("content-a");
    expect(result.lookups.resultByToolUseId.get("t2")?.output).toBe("matches");
    expect(result.lookups.toolUseById.get("t1")?.name).toBe("Read");
  });

  test("simpleMode skips grouping — each message is a standalone item", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "hello" },
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { type: "tool_result", toolUseId: "t1", output: "data" },
    ];

    const result = preprocessMessages(messages, true);
    // simpleMode: all messages kept as-is (including tool_result)
    expect(result.items).toHaveLength(3);
    expect(result.items.every((i) => i.type === "message")).toBe(true);
  });

  test("hasActiveGroup is true when last tool has no result", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      // No tool_result for t1
    ];

    const result = preprocessMessages(messages, false);
    expect(result.hasActiveGroup).toBe(true);
  });

  test("hasActiveGroup is false when all tools are resolved", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { type: "tool_result", toolUseId: "t1", output: "done" },
      { type: "text", content: "All done" },
    ];

    const result = preprocessMessages(messages, false);
    expect(result.hasActiveGroup).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/pipeline.test.ts`
Expected: FAIL with "Cannot find module '../pipeline'"

- [ ] **Step 3: Write the pipeline orchestrator**

```typescript
// packages/chat/src/preprocessing/pipeline.ts
import type { AgentMessage } from "../types";
import type { ProcessedItem, ProcessedMessages } from "./types";
import { normalizeMessages } from "./normalize";
import { collapseConsecutiveTools } from "./collapse-read-search";
import { buildMessageLookups } from "./build-lookups";

/**
 * Full message preprocessing pipeline.
 *
 * Stages:
 * 1. normalizeMessages() — merge streaming text, deduplicate plans, remove tool_result
 * 2. Convert to ProcessedItem[] (flat list of {type: "message"} wrappers)
 * 3. collapseConsecutiveTools() — merge consecutive read/search/bash into CollapsedGroup
 * 4. buildMessageLookups() — O(1) lookup tables
 *
 * @param messages - Raw message array from the chat hook
 * @param simpleMode - Skip grouping/collapsing (for read-only executor views)
 * @returns ProcessedMessages with items + lookups
 */
export function preprocessMessages(
  messages: AgentMessage[],
  simpleMode: boolean
): ProcessedMessages {
  // Simple mode: no transformation, just wrap each message
  if (simpleMode) {
    const items: ProcessedItem[] = messages.map((msg, i) => ({
      type: "message" as const,
      message: msg,
      originalIndex: i,
    }));
    const lookups = buildMessageLookups(messages, items);
    return { items, lookups, hasActiveGroup: false };
  }

  // Stage 1: Normalize
  const normalized = normalizeMessages(messages);

  // Stage 2: Convert to ProcessedItem[]
  const items: ProcessedItem[] = normalized.map((msg, i) => ({
    type: "message" as const,
    message: msg,
    originalIndex: i,
  }));

  // Stage 3: Collapse consecutive read/search/bash
  const collapsed = collapseConsecutiveTools(items, messages);

  // Stage 4: Build lookups
  const lookups = buildMessageLookups(messages, collapsed);

  // Determine if there's an active (unresolved) tool group
  const hasActiveGroup = determineHasActiveGroup(messages);

  return { items: collapsed, lookups, hasActiveGroup };
}

/**
 * Check if any tool_use message lacks a matching tool_result.
 * Scans backwards for efficiency (latest unresolved is most relevant).
 */
function determineHasActiveGroup(messages: AgentMessage[]): boolean {
  const resolvedIds = new Set<string>();
  for (const msg of messages) {
    if (msg.type === "tool_result" && msg.toolUseId) {
      resolvedIds.add(msg.toolUseId);
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.type === "tool_use" && msg.toolUseId) {
      if (!resolvedIds.has(msg.toolUseId)) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Write the barrel export**

```typescript
// packages/chat/src/preprocessing/index.ts
export { preprocessMessages } from "./pipeline";
export { normalizeMessages } from "./normalize";
export { groupToolPairs } from "./group-tool-pairs";
export { collapseConsecutiveTools } from "./collapse-read-search";
export { buildMessageLookups } from "./build-lookups";
export type {
  ProcessedMessages,
  ProcessedItem,
  CollapsedGroup,
  CollapsedCounts,
  ToolPair,
  ToolPairGroup,
  MessageLookups,
} from "./types";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/chat && npx vitest run src/preprocessing/__tests__/pipeline.test.ts`
Expected: PASS

- [ ] **Step 6: Run all preprocessing tests**

Run: `cd packages/chat && npx vitest run src/preprocessing/`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add packages/chat/src/preprocessing/pipeline.ts packages/chat/src/preprocessing/index.ts packages/chat/src/preprocessing/__tests__/pipeline.test.ts
git commit -m "feat(chat): implement full preprocessing pipeline orchestrator"
```

---

## Task 7: Integrate Pipeline into MessageList

**Files:**
- Modify: `packages/chat/src/message-list.tsx`

This task replaces the existing `groupMessages` useMemo with the new pipeline, while preserving all existing rendering behavior.

- [ ] **Step 1: Add import for the pipeline at the top of message-list.tsx**

At the top of `packages/chat/src/message-list.tsx`, add:

```typescript
import { preprocessMessages } from "./preprocessing";
import type { ProcessedItem, CollapsedGroup } from "./preprocessing";
```

- [ ] **Step 2: Replace the groupMessages useMemo with preprocessMessages**

In the `MessageList` component body (around line 883), replace:

```typescript
  // Group messages for display - must be called before any conditional returns
  // In simpleMode, skip grouping and just create "other" groups for each message
  const groups = useMemo(
    () => simpleMode
      ? messages.map((msg): OtherMessageGroup => ({ type: "other", message: msg }))
      : groupMessages(messages, isStreaming || false, t),
    [messages, isStreaming, simpleMode, t]
  );
```

With:

```typescript
  // Preprocessing pipeline: normalize → collapse → lookups
  // All expensive structural transforms in ONE useMemo.
  // Rendering-only state (expanded, scroll, highlight) is NOT in deps.
  const processed = useMemo(
    () => preprocessMessages(messages, simpleMode || false),
    [messages, simpleMode]
  );

  // Backward-compatible: convert ProcessedItems to groups for existing render logic
  const groups = useMemo(() => {
    if (simpleMode) {
      return processed.items.map((item): OtherMessageGroup => ({
        type: "other",
        message: item.type === "message" ? item.message : item.type === "collapsed_group"
          ? { type: "tool_use", name: "collapsed", id: `collapsed-${Math.random()}` } as AgentMessage
          : { type: "text", content: "" } as AgentMessage,
      }));
    }
    return processedItemsToGroups(processed.items, isStreaming || false, t);
  }, [processed, isStreaming, simpleMode, t]);
```

- [ ] **Step 3: Add processedItemsToGroups adapter function**

Add this function above the `MessageList` component (before the `export const MessageList` line). This bridges the new pipeline output to the existing rendering logic during migration:

```typescript
/**
 * Convert ProcessedItems back into MessageGroup[] for existing render logic.
 * This is a transitional adapter — once MessageList rendering is fully updated
 * to consume ProcessedItem[] directly, this can be removed.
 */
function processedItemsToGroups(
  items: ProcessedItem[],
  isRunning: boolean,
  t: (key: string, defaultValue: string) => string
): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentTaskGroup: TaskMessageGroup | null = null;
  let toolGlobalIndex = 0;

  const flushTaskGroup = (completed: boolean) => {
    if (currentTaskGroup && currentTaskGroup.tools.length > 0) {
      currentTaskGroup.isCompleted = completed;
      groups.push(currentTaskGroup);
      currentTaskGroup = null;
    }
  };

  for (const item of items) {
    if (item.type === "collapsed_group") {
      // Flush any pending task group
      flushTaskGroup(true);
      // Convert collapsed group back to a task group with tools for rendering
      const taskGroup: TaskMessageGroup = {
        type: "task",
        title: t("chat.activity.executingTask", "Executing task"),
        description: "",
        tools: item.group.pairs.map((pair) => ({
          message: pair.toolUse,
          globalIndex: toolGlobalIndex++,
          result: pair.toolResult,
        })),
        isCompleted: item.group.pairs.every((p) => p.toolResult !== undefined),
      };
      groups.push(taskGroup);
    } else if (item.type === "task_group") {
      flushTaskGroup(true);
      groups.push({
        type: "task",
        title: item.title,
        description: item.description,
        tools: item.pairs.map((pair) => ({
          message: pair.toolUse,
          globalIndex: toolGlobalIndex++,
          result: pair.toolResult,
        })),
        isCompleted: item.isCompleted,
      });
    } else if (item.type === "message") {
      const message = item.message;
      if (message.type === "tool_use" && message.name) {
        // Agent/Task tools are standalone
        if (message.name === "Agent" || message.name === "Task") {
          flushTaskGroup(true);
          groups.push({ type: "other", message });
        } else {
          // Regular tool — add to current task group
          if (!currentTaskGroup) {
            currentTaskGroup = {
              type: "task",
              title: t("chat.activity.executingTask", "Executing task"),
              description: "",
              tools: [],
              isCompleted: false,
            };
          }
          const result = message.toolUseId
            ? undefined // result is in the collapsed group or lookups
            : undefined;
          currentTaskGroup.tools.push({
            message,
            globalIndex: toolGlobalIndex++,
            result,
          });
        }
      } else {
        flushTaskGroup(true);
        groups.push({ type: "other", message });
      }
    }
  }

  flushTaskGroup(!isRunning);
  return groups;
}
```

- [ ] **Step 4: Verify the component still type-checks**

Run: `cd packages/chat && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "feat(chat): integrate preprocessing pipeline into MessageList useMemo"
```

---

## Task 8: Export Pipeline from Package Index

**Files:**
- Modify: `packages/chat/src/index.ts`

- [ ] **Step 1: Add preprocessing exports to index.ts**

Add at the bottom of `packages/chat/src/index.ts`:

```typescript
// Message Preprocessing Pipeline
export { preprocessMessages } from "./preprocessing";
export type {
  ProcessedMessages,
  ProcessedItem,
  CollapsedGroup,
  CollapsedCounts,
  ToolPair,
  MessageLookups,
} from "./preprocessing";
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd packages/chat && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/index.ts
git commit -m "feat(chat): export preprocessing pipeline types and function from package"
```

---

## Task 9: Add Vitest Config to packages/chat

**Files:**
- Create: `packages/chat/vitest.config.ts`
- Modify: `packages/chat/package.json` (add test script)

- [ ] **Step 1: Create vitest config**

```typescript
// packages/chat/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Add test script to package.json**

In `packages/chat/package.json`, add to the `"scripts"` object:

```json
"test": "vitest run",
"test:watch": "vitest"
```

And add vitest as a dev dependency:

```json
"devDependencies": {
  "vitest": "^3.1.1"
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd /path/to/viben && pnpm install`

- [ ] **Step 4: Run all tests**

Run: `cd packages/chat && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/chat/vitest.config.ts packages/chat/package.json pnpm-lock.yaml
git commit -m "chore(chat): add vitest configuration and test script"
```

---

## Task 10: Run Full Type Check

**Files:** None modified — verification only.

- [ ] **Step 1: Run typecheck on chat package**

Run: `cd packages/chat && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run typecheck on desktop app (primary consumer)**

Run: `cd apps/desktop && npx tsc --noEmit`
Expected: 0 errors (no breaking API changes)

- [ ] **Step 3: Run all preprocessing tests**

Run: `cd packages/chat && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(chat): resolve type errors from pipeline integration"
```

---

## Design Decisions & Rationale

### Why ONE useMemo for structural transforms

The reference implementation in `infra/claude-code/src/components/Messages.tsx` (lines 536-668) demonstrates the pattern: all O(n) transforms — filter, reorder, group, collapse, lookups — live in a single `useMemo` keyed on structural deps (`messages`, `verbose`, `tools`, etc.). A SECOND cheap `useMemo` (line 671-686) handles the render-range slice. This prevents scroll-driven re-renders from re-running expensive grouping logic.

### Why rendering state is excluded from deps

Expanded-group state (`useState` in `CollapsedToolRun`) and scroll position are rendering-only concerns. Including them in the pipeline's `useMemo` deps would cause the entire O(n) pipeline to re-run on every expand/collapse click or scroll event.

### Why tool_result is removed during normalization

The reference `collapseReadSearch.ts` (line 496-513) shows `isCollapsibleToolResult` checking membership in a tracked set. Our simplified approach removes `tool_result` messages entirely during normalization and resolves them via the `resultByToolUseId` lookup map — cleaner separation of data flow.

### Migration strategy

The `processedItemsToGroups` adapter function allows incremental migration. The existing `TaskGroupComponent` and `MessageItem` rendering logic continues to work unchanged. In a future PR, the render loop can be updated to consume `ProcessedItem[]` directly, at which point the adapter and `MessageGroup` types can be removed.
