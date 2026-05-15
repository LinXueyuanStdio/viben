# Streaming Text Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract streaming text out of the message list into a separate sibling component so that per-frame streaming updates no longer trigger full MessageList reconciliation.

**Architecture:** Currently, streaming text updates the last message's `content` field every frame, causing the entire `groups` memo to recompute and React to reconcile every `MessageItem`. The fix separates streaming into a dedicated `StreamingTextBlock` component rendered AFTER the message list container, using a stable-prefix markdown optimization (inspired by Claude Code's `StreamingMarkdown`). The parent orchestrates an atomic transition: clear `streamingText` + append final message simultaneously so no visual flash occurs.

**Tech Stack:** React 19, `streamdown` (already in deps), `framer-motion`, Tailwind CSS

**Reference Files (Claude Code patterns):**
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/infra/claude-code/src/components/Markdown.tsx` (line ~139) — `StreamingMarkdown`: stable-prefix pattern, only re-parses suffix
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/infra/claude-code/src/components/Messages.tsx` (line ~954) — streaming text rendered as separate sibling after message list
- `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/infra/claude-code/src/screens/REPL.tsx` (line ~1764) — `streamingText` state, atomic null-to-message transition

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/chat/src/types.ts` | Modify | Add `StreamingTextState` type |
| `packages/chat/src/streaming-text-block.tsx` | Create | Standalone streaming text renderer with stable-prefix optimization |
| `packages/chat/src/message-list.tsx` | Modify | Accept `streamingText` prop, render `StreamingTextBlock` after message groups, remove streaming flag from last `MessageItem` |
| `packages/chat/src/index.ts` | Modify | Export new `StreamingTextBlock` component and types |

---

### Task 1: Add StreamingTextState type to types.ts

**Files:**
- Modify: `packages/chat/src/types.ts`

- [ ] **Step 1: Add the StreamingTextState type**

At the end of `packages/chat/src/types.ts`, before the closing `SelectorOption` section, add:

```typescript
// ============================================================================
// Streaming Text Types
// ============================================================================

/**
 * Streaming text state for the MessageList component.
 * When non-null, the streaming block is shown as a separate sibling
 * after the message list — avoiding full list reconciliation.
 *
 * Parent contract (atomic transition):
 * 1. During streaming: set `streamingText` to current accumulated text
 * 2. On stream end: in ONE setState batch, set `streamingText = null`
 *    AND append the final assistant message to the messages array
 */
export type StreamingTextState = string | null;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/types.ts
git commit -m "feat(chat): add StreamingTextState type for separated streaming"
```

---

### Task 2: Create StreamingTextBlock component

**Files:**
- Create: `packages/chat/src/streaming-text-block.tsx`

- [ ] **Step 1: Create the StreamingTextBlock component with stable-prefix optimization**

Create `packages/chat/src/streaming-text-block.tsx`:

```tsx
import * as React from "react";
import { useRef, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Streamdown } from "streamdown";
import { Bot } from "lucide-react";
import { cn } from "@viben/ui";

export interface StreamingTextBlockProps {
  /** The accumulated streaming text. When null, nothing renders. */
  text: string | null;
  /** Custom link handler for markdown links */
  onLinkClick?: (href: string) => void;
  /** Maximum width constraint (CSS value) */
  maxWidth?: string;
  /** Additional CSS class name for the outer wrapper */
  className?: string;
}

/**
 * Markdown components for streaming text rendering.
 * Identical to MessageItem's components to ensure visual consistency.
 */
const createMarkdownComponents = (onLinkClick?: (href: string) => void) => ({
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="bg-muted max-w-full overflow-x-auto rounded-lg p-4 my-2 [&>code]:block"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-muted rounded px-1.5 py-0.5 text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        if (href) {
          if (onLinkClick) {
            onLinkClick(href);
          } else {
            window.open(href, "_blank");
          }
        }
      }}
      className="text-primary cursor-pointer hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-1 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-xl font-bold mt-4 mb-2" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-lg font-semibold mt-3 mb-2" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{children}</h3>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc ml-4 my-2 space-y-1" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal ml-4 my-2 space-y-1" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.LiHTMLAttributes<HTMLLIElement>) => (
    <li className="text-sm" {...props}>{children}</li>
  ),
  blockquote: ({
    children,
    ...props
  }: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="border-l-4 border-primary/30 pl-4 my-2 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
});

/**
 * StreamingTextBlock renders streaming assistant text as a separate sibling
 * outside the message list, preventing full list reconciliation on each frame.
 *
 * Uses a stable-prefix optimization inspired by Claude Code's StreamingMarkdown:
 * - Tracks how much of the text has been "finalized" (no longer growing)
 * - Only the trailing unstable suffix gets re-parsed each frame
 * - The stable prefix is rendered in "static" mode (memoized by Streamdown)
 *
 * The `streamdown` library's "streaming" mode handles incremental parsing
 * internally, so we leverage that directly. The stable-prefix split is
 * an additional optimization layer for very long responses.
 */
export function StreamingTextBlock({
  text,
  onLinkClick,
  maxWidth,
  className,
}: StreamingTextBlockProps) {
  const prefersReducedMotion = useReducedMotion();
  const markdownComponents = useMemo(
    () => createMarkdownComponents(onLinkClick),
    [onLinkClick]
  );

  // Stable-prefix tracking: only re-parse the suffix after the last
  // paragraph/block boundary. This ref persists across re-renders and
  // resets when the component unmounts (stream ends → null → remounts).
  const stableBoundaryRef = useRef(0);

  // Reset stable boundary if text was replaced (e.g., new stream started
  // without unmounting — defensive guard)
  if (text && text.length < stableBoundaryRef.current) {
    stableBoundaryRef.current = 0;
  }

  // Find the last double-newline boundary in the text for splitting.
  // Everything before it is stable (complete paragraphs/blocks).
  if (text) {
    const lastBoundary = text.lastIndexOf("\n\n");
    if (lastBoundary > stableBoundaryRef.current) {
      stableBoundaryRef.current = lastBoundary + 2; // include the \n\n
    }
  }

  const stablePrefix = text ? text.substring(0, stableBoundaryRef.current) : "";
  const unstableSuffix = text ? text.substring(stableBoundaryRef.current) : "";

  if (!text) return null;

  const maxWidthStyle = maxWidth
    ? { maxWidth } as React.CSSProperties
    : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
      className={cn("flex gap-3 w-full min-w-0", className)}
      style={maxWidthStyle}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 overflow-hidden">
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground overflow-hidden break-words">
            {stablePrefix && (
              <Streamdown
                mode="static"
                components={markdownComponents}
              >
                {stablePrefix}
              </Streamdown>
            )}
            <Streamdown
              mode="streaming"
              components={markdownComponents}
              caret="block"
            >
              {unstableSuffix}
            </Streamdown>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/chat/src/streaming-text-block.tsx
git commit -m "feat(chat): add StreamingTextBlock with stable-prefix optimization"
```

---

### Task 3: Modify MessageList to accept streamingText prop and render StreamingTextBlock

**Files:**
- Modify: `packages/chat/src/message-list.tsx`

- [ ] **Step 1: Add streamingText prop to MessageListProps**

In `packages/chat/src/message-list.tsx`, add a new prop to the `MessageListProps` interface after the `isStreaming` prop (around line 33):

```typescript
  /**
   * Streaming text content rendered as a separate sibling AFTER the message list.
   * When non-null, this text is displayed in a dedicated StreamingTextBlock
   * that does not trigger full message list reconciliation.
   *
   * Parent contract (atomic transition):
   * 1. During streaming: set streamingText to accumulated text
   * 2. On stream end: in one setState batch, set streamingText = null
   *    AND append the final assistant message to messages array
   */
  streamingText?: string | null;
```

- [ ] **Step 2: Import StreamingTextBlock at the top of message-list.tsx**

Add after the existing imports (around line 12):

```typescript
import { StreamingTextBlock } from "./streaming-text-block";
```

- [ ] **Step 3: Destructure the new prop in the MessageList component**

In the component function signature (around line 841), add `streamingText` to the destructured props:

```typescript
export const MessageList = React.forwardRef<MessageListHandle, MessageListProps>(function MessageList({
  messages,
  isStreaming,
  streamingText,
  // ... rest of props
```

- [ ] **Step 4: Modify the isStreaming logic for the last MessageItem**

Currently (around line 1206-1211), the last message item receives `isStreaming` when it's the final text message:

```typescript
isStreaming={
  index === groups.length - 1 &&
  isStreaming &&
  message.type === "text"
}
```

Change this to only mark as streaming when there is NO `streamingText` prop (backward compatible — if the consumer passes `streamingText`, the last message is NOT marked streaming):

```typescript
isStreaming={
  index === groups.length - 1 &&
  isStreaming &&
  message.type === "text" &&
  streamingText === undefined
}
```

This ensures backward compatibility: consumers that don't pass `streamingText` get the old behavior; consumers that pass it get the new separated streaming.

- [ ] **Step 5: Render StreamingTextBlock after RunningIndicator, before the scroll anchor**

Find the section with the running indicator and scroll anchor (around lines 1226-1230):

```tsx
          {/* Running indicator */}
          {isStreaming && <RunningIndicator messages={messages} />}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
```

Add the StreamingTextBlock between the running indicator and the scroll anchor:

```tsx
          {/* Running indicator */}
          {isStreaming && !streamingText && <RunningIndicator messages={messages} />}

          {/* Streaming text - rendered as separate sibling to avoid full list reconciliation */}
          {streamingText && (
            <StreamingTextBlock
              text={streamingText}
              onLinkClick={onLinkClick}
              maxWidth={maxMessageWidth}
            />
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
```

Note: The `RunningIndicator` is now hidden when `streamingText` is present because the streaming text itself indicates activity.

- [ ] **Step 6: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/chat/src/message-list.tsx
git commit -m "feat(chat): render streaming text as separate sibling in MessageList"
```

---

### Task 4: Export StreamingTextBlock and types from index.ts

**Files:**
- Modify: `packages/chat/src/index.ts`

- [ ] **Step 1: Add exports for StreamingTextBlock**

In `packages/chat/src/index.ts`, add after the `MessageList` exports (around line 58):

```typescript
export { StreamingTextBlock } from "./streaming-text-block";
export type { StreamingTextBlockProps } from "./streaming-text-block";
```

- [ ] **Step 2: Add StreamingTextState type to existing types export**

The types are already exported via `export * from "./types"` on line 10, so `StreamingTextState` is automatically exported. No change needed here.

- [ ] **Step 3: Verify typecheck passes**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/chat/src/index.ts
git commit -m "feat(chat): export StreamingTextBlock component and types"
```

---

### Task 5: Full build verification

**Files:**
- No changes — verification only

- [ ] **Step 1: Run full typecheck across workspace**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: No type errors

- [ ] **Step 2: Verify desktop app compiles (as it consumes @viben/chat)**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/chat typecheck && pnpm --filter desktop typecheck`
Expected: No errors. The desktop app is the primary consumer of `@viben/chat`.

- [ ] **Step 3: Commit (no changes — this is verification only)**

No commit needed. If either typecheck fails, fix the issue and commit the fix.

---

## Usage Guide (for consumers)

After this implementation, consumers of `@viben/chat` can adopt the new streaming pattern:

```tsx
import { MessageList } from "@viben/chat";

function ChatView() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);

  // During streaming:
  // 1. Don't append partial text to messages array
  // 2. Instead, update streamingText directly
  const onStreamDelta = (delta: string) => {
    setStreamingText(prev => (prev ?? "") + delta);
  };

  // On stream complete — ATOMIC transition:
  const onStreamEnd = (finalText: string) => {
    // React 18+ batches these automatically in event handlers,
    // but wrap in flushSync/startTransition if needed in async contexts
    setStreamingText(null);
    setMessages(prev => [...prev, { type: "text", content: finalText, id: "..." }]);
  };

  return (
    <MessageList
      messages={messages}
      isStreaming={!!streamingText}
      streamingText={streamingText}
    />
  );
}
```

**Key invariant:** `streamingText = null` and final message append MUST happen in the same React batch. React 18+ auto-batches setState calls in event handlers and effects. For WebSocket/async callbacks, use `ReactDOM.flushSync` or `unstable_batchedUpdates` if needed to ensure atomicity.

---

## Design Decisions

1. **Backward compatible**: Consumers that don't pass `streamingText` get identical behavior to today (last message marked `isStreaming`).

2. **Stable-prefix split at paragraph boundaries**: We split at `\n\n` boundaries (paragraph breaks). The stable prefix renders in `mode="static"` (memoized), only the trailing paragraph re-parses. This is simpler than Claude Code's token-level lexer approach but effective for web markdown rendering where `streamdown` already handles incremental parsing internally.

3. **Component unmounts between streams**: When `streamingText` goes null, `StreamingTextBlock` unmounts entirely, resetting the `stableBoundaryRef`. This is the same pattern as Claude Code (line 137: "Component unmounts between turns").

4. **RunningIndicator hidden during streaming text**: When streaming text is visible, the spinning indicator is redundant — the block caret already signals activity.
