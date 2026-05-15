# React.memo Static Freeze for MessageItem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent unnecessary re-renders of static (completed) messages when the messages array changes during streaming, by wrapping `MessageItem` in `React.memo` with a custom comparator that bails early for "frozen" messages.

**Architecture:** A message is considered "static" when it is NOT actively streaming AND all its `tool_use` blocks have corresponding `tool_result` blocks (identified by `toolUseId` matching). Static messages skip re-render when their message object reference is unchanged. Non-static messages use standard shallow comparison. The parent `MessageList` passes an `isStatic` flag computed from the messages array.

**Tech Stack:** React 19, TypeScript, Vitest (for unit tests)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/chat/src/message-item.tsx` | Add `React.memo` wrapper with custom `areMessageItemPropsEqual` comparator |
| `packages/chat/src/message-list.tsx` | Compute and pass `isStatic` prop to each `MessageItem` |
| `packages/chat/src/utils/is-message-static.ts` | **New** - Pure function to determine if a message is static (all tool_use resolved) |
| `packages/chat/src/__tests__/is-message-static.test.ts` | **New** - Unit tests for static determination logic |
| `packages/chat/src/__tests__/are-message-item-props-equal.test.ts` | **New** - Unit tests for the custom memo comparator |

---

## Reference: Claude Code's Pattern

The approach mirrors Claude Code's implementation:

1. **`Messages.tsx` (line 1054-1114)** exports `shouldRenderStatically()` which checks:
   - If the message's `toolUseID` is NOT in `streamingToolUseIDs` (not streaming)
   - If the message's `toolUseID` is NOT in `inProgressToolUseIDs` (not executing)
   - If all sibling tool uses are in `resolvedToolUseIDs` (all tool calls complete)

2. **`MessageRow.tsx` (line 290-334)** exports `areMessageRowPropsEqual()` which:
   - Returns `false` immediately if `prev.message !== next.message` (reference check)
   - Returns `false` for screen/verbose/columns/layout changes
   - Checks `isMessageStreaming()` and `allToolsResolved()` — if streaming or unresolved, returns `false`
   - Otherwise returns `true` (skip re-render)

3. **`Message.tsx` (line 484-510)** exports `areMessagePropsEqual()` which:
   - Bails if `prev.message.uuid !== next.message.uuid`
   - Checks special props (verbose, thinking, latestBashOutput)
   - If both `prev.isStatic && next.isStatic`, returns `true` (skip re-render)

Our adaptation simplifies this for the web UI context (no terminal-specific concerns like columns, OffscreenFreeze, etc.).

---

### Task 1: Create `isMessageStatic` utility

**Files:**
- Create: `packages/chat/src/utils/is-message-static.ts`

- [ ] **Step 1: Create the utility file with the `isMessageStatic` function**

```typescript
import type { AgentMessage } from "../types";

/**
 * Determines whether a message is "static" — i.e., its content will not change.
 *
 * A message is static when:
 * 1. It is NOT the currently streaming message
 * 2. If it is a `tool_use` message, it has a matching `tool_result` (output is defined)
 * 3. All other message types (user, text, result, error, thinking, plan) are always static
 *    once they exist in the array
 *
 * Reference: Claude Code's `shouldRenderStatically` in Messages.tsx (lines 1054-1114)
 * checks streaming/inProgress/resolved status. Our simplified version checks:
 * - tool_use with no output = not static (still executing)
 * - everything else = static
 */
export function isMessageStatic(
  message: AgentMessage,
  isStreamingMessage: boolean,
): boolean {
  // A message that is actively being streamed is never static
  if (isStreamingMessage) {
    return false;
  }

  // tool_use without output means the tool is still executing (no tool_result received yet)
  if (message.type === "tool_use" && message.output === undefined) {
    return false;
  }

  // All other messages are static once they exist
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/chat/src/utils/is-message-static.ts
git commit -m "feat(chat): add isMessageStatic utility for render optimization"
```

---

### Task 2: Create unit tests for `isMessageStatic`

**Files:**
- Create: `packages/chat/src/__tests__/is-message-static.test.ts`

- [ ] **Step 1: Write tests covering all message types and edge cases**

```typescript
import { describe, test, expect } from "vitest";
import { isMessageStatic } from "../utils/is-message-static";
import type { AgentMessage } from "../types";

describe("isMessageStatic", () => {
  test("user message is always static", () => {
    const msg: AgentMessage = { type: "user", content: "Hello" };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("text message is static when not streaming", () => {
    const msg: AgentMessage = { type: "text", content: "Response" };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("text message is NOT static when it is the streaming message", () => {
    const msg: AgentMessage = { type: "text", content: "Partial..." };
    expect(isMessageStatic(msg, true)).toBe(false);
  });

  test("thinking message is static when not streaming", () => {
    const msg: AgentMessage = { type: "thinking", content: "Let me think..." };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("thinking message is NOT static when streaming", () => {
    const msg: AgentMessage = { type: "thinking", content: "Let me..." };
    expect(isMessageStatic(msg, true)).toBe(false);
  });

  test("tool_use with output (resolved) is static", () => {
    const msg: AgentMessage = {
      type: "tool_use",
      name: "Read",
      toolUseId: "tu_123",
      input: { file_path: "/test.ts" },
      output: "file contents here",
    };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("tool_use without output (still executing) is NOT static", () => {
    const msg: AgentMessage = {
      type: "tool_use",
      name: "Read",
      toolUseId: "tu_123",
      input: { file_path: "/test.ts" },
    };
    expect(isMessageStatic(msg, false)).toBe(false);
  });

  test("tool_use with empty string output is static (tool returned empty)", () => {
    const msg: AgentMessage = {
      type: "tool_use",
      name: "Bash",
      toolUseId: "tu_456",
      input: { command: "echo" },
      output: "",
    };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("error message is always static", () => {
    const msg: AgentMessage = { type: "error", message: "Something failed" };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("result message is always static", () => {
    const msg: AgentMessage = { type: "result", content: "Final answer" };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("plan message is always static", () => {
    const msg: AgentMessage = {
      type: "plan",
      plan: { goal: "Do something", steps: [] },
    };
    expect(isMessageStatic(msg, false)).toBe(true);
  });

  test("streaming flag overrides even static-looking messages", () => {
    const msg: AgentMessage = {
      type: "tool_use",
      name: "Read",
      toolUseId: "tu_789",
      input: { file_path: "/test.ts" },
      output: "contents",
    };
    // Even with output, if marked as streaming, it is not static
    expect(isMessageStatic(msg, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat exec vitest run src/__tests__/is-message-static.test.ts`

If vitest is not configured yet for this package, use:
```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && npx vitest run packages/chat/src/__tests__/is-message-static.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/__tests__/is-message-static.test.ts
git commit -m "test(chat): add unit tests for isMessageStatic"
```

---

### Task 3: Add `React.memo` with custom comparator to `MessageItem`

**Files:**
- Modify: `packages/chat/src/message-item.tsx:13-31` (MessageItemProps interface)
- Modify: `packages/chat/src/message-item.tsx:443-572` (MessageItem component export)

- [ ] **Step 1: Add `isStatic` prop to `MessageItemProps`**

In `packages/chat/src/message-item.tsx`, add the `isStatic` prop to the interface at line 13:

```typescript
export interface MessageItemProps {
  message: AgentMessage;
  isStreaming?: boolean;
  /** Whether this message is "static" (content won't change). Static messages skip re-render. */
  isStatic?: boolean;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  isPlanPending?: boolean;
  /** Custom link handler - if not provided, links open with window.open */
  onLinkClick?: (href: string) => void;
  /** Additional CSS class name */
  className?: string;
  /** Maximum width for the message card */
  maxWidth?: string;
  /** When true, show full tool input/output inline without requiring a click-to-open modal */
  toolExpandedInline?: boolean;
  /** Callback to expand subagent messages in a side panel */
  onExpandSubagent?: (title: string, subagentType: string | undefined, messages: AgentMessage[]) => void;
  /** Whether this is the latest thinking message (starts expanded) */
  isLatestThinking?: boolean;
}
```

- [ ] **Step 2: Rename the component function to `MessageItemImpl` and add memo wrapper**

Rename the existing `export function MessageItem(...)` to a non-exported `function MessageItemImpl(...)`, then add the custom comparator and export the memoized version.

At the end of the file (after the closing brace of `MessageItemImpl`), add:

```typescript
/**
 * Custom memo comparator for MessageItem.
 *
 * Reference: Claude Code's `areMessageRowPropsEqual` (MessageRow.tsx lines 290-332)
 * and `areMessagePropsEqual` (Message.tsx lines 484-508).
 *
 * Strategy:
 * - If the message reference changed, always re-render (content may differ)
 * - If both prev and next are static, skip re-render (content is frozen)
 * - For non-static messages, always re-render (streaming/in-progress)
 * - Also re-render on prop changes that affect display (className, maxWidth, isLatestThinking)
 */
export function areMessageItemPropsEqual(
  prev: MessageItemProps,
  next: MessageItemProps,
): boolean {
  // Different message reference = content may have changed, must re-render
  if (prev.message !== next.message) return false;

  // Layout/style prop changes require re-render
  if (prev.className !== next.className) return false;
  if (prev.maxWidth !== next.maxWidth) return false;

  // isLatestThinking toggles expansion state of thinking messages
  if (prev.isLatestThinking !== next.isLatestThinking) return false;

  // toolExpandedInline changes display mode
  if (prev.toolExpandedInline !== next.toolExpandedInline) return false;

  // If both are static, safe to skip re-render — content is frozen
  if (prev.isStatic && next.isStatic) return true;

  // Non-static messages: check remaining props that affect rendering
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.isPlanPending !== next.isPlanPending) return false;

  // For non-static messages with same reference and same props, skip re-render
  return true;
}

export const MessageItem = React.memo(MessageItemImpl, areMessageItemPropsEqual);
```

- [ ] **Step 3: Update the function signature**

Change:
```typescript
export function MessageItem({
```

To:
```typescript
function MessageItemImpl({
```

And add `isStatic` to the destructured props (it's not used inside the component, only in the comparator):

```typescript
function MessageItemImpl({
  message,
  isStreaming,
  isStatic,
  onApprovePlan,
  onRejectPlan,
  isPlanPending,
  onLinkClick,
  className,
  maxWidth,
  toolExpandedInline,
  onExpandSubagent,
  isLatestThinking,
}: MessageItemProps) {
```

Note: `isStatic` is intentionally unused inside the component body — it's only consumed by the memo comparator. Add a comment or prefix with underscore if lint complains:

```typescript
  isStatic: _isStatic,
```

- [ ] **Step 4: Commit**

```bash
git add packages/chat/src/message-item.tsx
git commit -m "feat(chat): add React.memo with custom comparator to MessageItem"
```

---

### Task 4: Compute and pass `isStatic` from `MessageList`

**Files:**
- Modify: `packages/chat/src/message-list.tsx:1205-1221` (where MessageItem is rendered)

- [ ] **Step 1: Import the `isMessageStatic` utility**

At the top of `packages/chat/src/message-list.tsx`, add:

```typescript
import { isMessageStatic } from "./utils/is-message-static";
```

- [ ] **Step 2: Pass `isStatic` prop to MessageItem in the grouped render loop**

In the `groups.map(...)` render at approximately line 1205, where `<MessageItem>` is rendered, compute `isStatic` inline:

```typescript
<MessageItem
  message={message}
  isStreaming={
    index === groups.length - 1 &&
    isStreaming &&
    message.type === "text"
  }
  isStatic={isMessageStatic(
    message,
    // A message is "streaming" if it's the last group, stream is active, and it's a text message
    !!(index === groups.length - 1 && isStreaming && message.type === "text")
  )}
  onApprovePlan={onApprovePlan}
  onRejectPlan={onRejectPlan}
  isPlanPending={isPlanMessage && pendingPlan !== null}
  onLinkClick={onLinkClick}
  maxWidth={maxMessageWidth}
  toolExpandedInline={toolExpandedInline}
  onExpandSubagent={onExpandSubagent}
  isLatestThinking={index === lastThinkingIdx}
/>
```

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "feat(chat): pass isStatic prop from MessageList to MessageItem"
```

---

### Task 5: Create unit tests for `areMessageItemPropsEqual`

**Files:**
- Create: `packages/chat/src/__tests__/are-message-item-props-equal.test.ts`

- [ ] **Step 1: Write tests for the custom comparator**

```typescript
import { describe, test, expect } from "vitest";
import { areMessageItemPropsEqual } from "../message-item";
import type { MessageItemProps } from "../message-item";
import type { AgentMessage } from "../types";

function makeProps(overrides: Partial<MessageItemProps> = {}): MessageItemProps {
  const defaultMessage: AgentMessage = {
    type: "text",
    content: "Hello world",
  };
  return {
    message: defaultMessage,
    isStreaming: false,
    isStatic: true,
    ...overrides,
  };
}

describe("areMessageItemPropsEqual", () => {
  test("returns false when message reference changes", () => {
    const msg1: AgentMessage = { type: "text", content: "A" };
    const msg2: AgentMessage = { type: "text", content: "A" };
    const prev = makeProps({ message: msg1, isStatic: true });
    const next = makeProps({ message: msg2, isStatic: true });
    expect(areMessageItemPropsEqual(prev, next)).toBe(false);
  });

  test("returns true when both static and same message reference", () => {
    const msg: AgentMessage = { type: "text", content: "Hello" };
    const prev = makeProps({ message: msg, isStatic: true });
    const next = makeProps({ message: msg, isStatic: true });
    expect(areMessageItemPropsEqual(prev, next)).toBe(true);
  });

  test("returns false when className changes even if static", () => {
    const msg: AgentMessage = { type: "text", content: "Hello" };
    const prev = makeProps({ message: msg, isStatic: true, className: "a" });
    const next = makeProps({ message: msg, isStatic: true, className: "b" });
    expect(areMessageItemPropsEqual(prev, next)).toBe(false);
  });

  test("returns false when maxWidth changes even if static", () => {
    const msg: AgentMessage = { type: "text", content: "Hello" };
    const prev = makeProps({ message: msg, isStatic: true, maxWidth: "800px" });
    const next = makeProps({ message: msg, isStatic: true, maxWidth: "600px" });
    expect(areMessageItemPropsEqual(prev, next)).toBe(false);
  });

  test("returns false when isLatestThinking changes", () => {
    const msg: AgentMessage = { type: "thinking", content: "..." };
    const prev = makeProps({ message: msg, isStatic: true, isLatestThinking: true });
    const next = makeProps({ message: msg, isStatic: true, isLatestThinking: false });
    expect(areMessageItemPropsEqual(prev, next)).toBe(false);
  });

  test("returns false when toolExpandedInline changes", () => {
    const msg: AgentMessage = { type: "tool_use", name: "Read", output: "..." };
    const prev = makeProps({ message: msg, isStatic: true, toolExpandedInline: false });
    const next = makeProps({ message: msg, isStatic: true, toolExpandedInline: true });
    expect(areMessageItemPropsEqual(prev, next)).toBe(false);
  });

  test("returns false when non-static and isStreaming changes", () => {
    const msg: AgentMessage = { type: "text", content: "..." };
    const prev = makeProps({ message: msg, isStatic: false, isStreaming: true });
    const next = makeProps({ message: msg, isStatic: false, isStreaming: false });
    expect(areMessageItemPropsEqual(prev, next)).toBe(false);
  });

  test("returns true when non-static but all relevant props same", () => {
    const msg: AgentMessage = { type: "text", content: "..." };
    const prev = makeProps({ message: msg, isStatic: false, isStreaming: true });
    const next = makeProps({ message: msg, isStatic: false, isStreaming: true });
    expect(areMessageItemPropsEqual(prev, next)).toBe(true);
  });

  test("returns false when prev is static but next is not (message went from frozen to active)", () => {
    const msg: AgentMessage = { type: "tool_use", name: "Bash" };
    const prev = makeProps({ message: msg, isStatic: true });
    const next = makeProps({ message: msg, isStatic: false });
    // Not both static, so falls through to non-static comparison
    // isStreaming is same (both false by default), isPlanPending same => true
    expect(areMessageItemPropsEqual(prev, next)).toBe(true);
  });

  test("callback prop changes are ignored (stable behavior)", () => {
    const msg: AgentMessage = { type: "text", content: "Hello" };
    const prev = makeProps({ message: msg, isStatic: true, onLinkClick: () => {} });
    const next = makeProps({ message: msg, isStatic: true, onLinkClick: () => {} });
    // Both static with same message ref - callbacks don't affect render output
    expect(areMessageItemPropsEqual(prev, next)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && npx vitest run packages/chat/src/__tests__/are-message-item-props-equal.test.ts`

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/__tests__/are-message-item-props-equal.test.ts
git commit -m "test(chat): add unit tests for areMessageItemPropsEqual memo comparator"
```

---

### Task 6: Verify TypeScript compilation

**Files:**
- No new files, verification only

- [ ] **Step 1: Run typecheck for the chat package**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck
```

Expected: Zero errors.

- [ ] **Step 2: Run full project typecheck to ensure no downstream breakage**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck
```

Expected: Zero errors related to `@viben/chat`.

- [ ] **Step 3: Fix any issues and commit**

If there are type errors (e.g., unused `_isStatic` variable warning), fix them and commit:

```bash
git add -u
git commit -m "fix(chat): resolve typecheck issues from memo optimization"
```

---

### Task 7: Create `utils/index.ts` barrel export (if needed)

**Files:**
- Modify or create: `packages/chat/src/utils/index.ts` (if the utils directory is new)

- [ ] **Step 1: Check if `packages/chat/src/utils/` directory already exists**

```bash
ls packages/chat/src/utils/
```

- [ ] **Step 2: If the directory is new, ensure the import path works**

The import `from "./utils/is-message-static"` used in `message-list.tsx` should resolve directly. If there's an existing barrel file that needs updating, add the export:

```typescript
export { isMessageStatic } from "./is-message-static";
```

If there's no barrel file and the direct import works, no action needed.

- [ ] **Step 3: Verify the import works by running typecheck**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck
```

- [ ] **Step 4: Commit if changes were made**

```bash
git add packages/chat/src/utils/
git commit -m "chore(chat): add utils directory for message-static utility"
```

---

## Summary of Changes

| Pattern from Claude Code | Our Adaptation |
|--------------------------|----------------|
| `shouldRenderStatically()` in `Messages.tsx` | `isMessageStatic()` in `utils/is-message-static.ts` |
| `areMessageRowPropsEqual()` in `MessageRow.tsx` | `areMessageItemPropsEqual()` in `message-item.tsx` |
| Checks `streamingToolUseIDs` + `inProgressToolUseIDs` + `resolvedToolUseIDs` | Checks `message.output === undefined` for tool_use + `isStreamingMessage` flag |
| `OffscreenFreeze` wrapping | Not applicable (web DOM has no terminal scrollback issue) |
| `isStatic` prop plumbed to `Message.tsx` | `isStatic` prop plumbed to `MessageItem` |

The key performance win: when a new streaming delta arrives, the `messages` array reference changes, causing `MessageList` to re-render. But all historical `MessageItem` components whose message object reference is unchanged AND are marked static will bail out of re-render via the custom comparator — avoiding expensive markdown re-parsing and DOM diffing for potentially hundreds of messages.
