# ACP Chat Missing Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supplement the desktop ACP Chat with 4 missing UI interactions: Tool Inspect dialog, Artifact dialog, SubagentSheet loadSubagentDetails, and Context Approval button+popup. Also add Escape key shortcut to interrupt.

**Architecture:** Add state and handlers to `use-acp-session.ts`, pass them through `acp-chat.tsx` into existing `ChatApp` props. Render Dialog overlays **outside** mode-specific render paths (to avoid `position: fixed` breakage from floating mode's `transform` parent). Context Approval adds to the existing `bottomToolbarLeftContent`.

**Tech Stack:** React, @viben/chat (ContextApprovalButton, ContextApprovalPopup, useContextApprovalPopupProps), @viben/ui (Dialog components), TypeScript

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/desktop/src/components/acp-chat/use-acp-session.ts` | State + handlers: toolInspect, artifactDialog, loadSubagentDetails |
| `apps/desktop/src/components/acp-chat/acp-chat.tsx` | Wire handlers to ChatApp, render Dialog overlays, add ContextApproval, Escape shortcut |

No new files needed. All logic stays in existing files.

---

### Task 1: Add Tool Inspect and Artifact State to use-acp-session.ts

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/use-acp-session.ts`

- [ ] **Step 1: Add `useState` to React import**

Change line 13 from:
```typescript
import { useCallback, useEffect, useMemo, useRef } from "react";
```
To:
```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Add new types to `@viben/chat` import**

Change the type import (line ~14) to include `LoadedSubagentDetails` and `SubagentOpenContext`:

```typescript
import type {
  AgentMessage,
  Artifact,
  CommandQueueItem,
  LoadedSubagentDetails,
  PendingQuestion,
  QueuedInputRecallItem,
  SelectorOption,
  SlashCommand,
  SlashCommandSelection,
  SubagentOpenContext,
  TaskPlan,
} from "@viben/chat";
```

- [ ] **Step 3: Add new fields to `UseAcpSessionReturn` interface**

Add after the subagent sheet section (line ~187, before the closing `}`):

```typescript
  // Tool inspect dialog
  toolInspectState: { message: AgentMessage; result?: AgentMessage } | null;
  handleInspectTool: (message: AgentMessage) => void;
  closeToolInspect: () => void;

  // Artifact dialog
  artifactDialogState: { artifact: Artifact; message?: AgentMessage } | null;
  handleArtifactClick: (artifactId: string) => void;
  closeArtifactDialog: () => void;

  // Subagent details loader
  handleLoadSubagentDetails: (context: SubagentOpenContext) => Promise<LoadedSubagentDetails>;
```

- [ ] **Step 4: Add state variables in the hook body**

Add after the `subagentSheet` related variables (around line ~382):

```typescript
const [toolInspectState, setToolInspectState] = useState<{ message: AgentMessage; result?: AgentMessage } | null>(null);
const [artifactDialogState, setArtifactDialogState] = useState<{ artifact: Artifact; message?: AgentMessage } | null>(null);
```

These are ephemeral UI state — losing them on mode switch is acceptable.

- [ ] **Step 5: Implement handleInspectTool callback**

Add after `handleExpandSubagent` (around line ~1296):

```typescript
const handleInspectTool = useCallback(
  (message: AgentMessage) => {
    const result = message.toolUseId
      ? messages.find((m) => m.type === "tool_result" && m.toolUseId === message.toolUseId)
      : undefined;
    setToolInspectState({ message, result });
  },
  [messages]
);

const closeToolInspect = useCallback(() => {
  setToolInspectState(null);
}, []);
```

- [ ] **Step 6: Implement handleArtifactClick callback**

```typescript
const handleArtifactClick = useCallback(
  (artifactId: string) => {
    const artifact = artifacts.find((a) => a.id === artifactId);
    if (!artifact) return;
    const message = messages.find((m) => m.id === artifact.sourceMessageId);
    setArtifactDialogState({ artifact, message });
  },
  [artifacts, messages]
);

const closeArtifactDialog = useCallback(() => {
  setArtifactDialogState(null);
}, []);
```

- [ ] **Step 7: Implement handleLoadSubagentDetails callback**

```typescript
const handleLoadSubagentDetails = useCallback(
  async (context: SubagentOpenContext): Promise<LoadedSubagentDetails> => {
    const liveMessages = resolveLiveSubagentMessages(sessionsById, {
      title: "",
      messages: [],
      context,
    });
    if (liveMessages && liveMessages.length > 0) {
      const toolUseId = context.toolUseId;
      const subagentId = context.subagentId;
      let title: string | undefined;
      let subagentType: string | undefined;
      for (const session of Object.values(sessionsById)) {
        const parent = session.uiMessages.find((m) =>
          m.type === "tool_use" &&
          (m.name === "Task" || m.name === "Agent") &&
          (
            (toolUseId && m.toolUseId === toolUseId) ||
            (subagentId && (m.subagentId === subagentId || m.toolUseId === subagentId))
          )
        );
        if (parent) {
          const input = parent.input as { description?: string; subagent_type?: string } | undefined;
          title = input?.description ?? parent.name;
          subagentType = input?.subagent_type;
          break;
        }
      }
      return { title, subagentType, messages: liveMessages };
    }
    return { messages: [] };
  },
  [sessionsById]
);
```

- [ ] **Step 8: Add to return object**

Add to the return statement (around line ~1360):

```typescript
    // Tool inspect & artifact dialogs
    toolInspectState,
    handleInspectTool,
    closeToolInspect,
    artifactDialogState,
    handleArtifactClick,
    closeArtifactDialog,
    handleLoadSubagentDetails,
```

- [ ] **Step 9: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS (or only pre-existing errors)

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/components/acp-chat/use-acp-session.ts
git commit -m "feat(acp-chat): add toolInspect, artifactDialog, loadSubagentDetails handlers"
```

---

### Task 2: Wire Handlers and Render Dialogs in acp-chat.tsx

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-chat.tsx`

- [ ] **Step 1: Add new imports**

Add to the `@viben/ui` import (line ~63):
```typescript
import {
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Label,
} from "@viben/ui";
```

Add to the `@viben/chat` type import block:
```typescript
import type {
  // ... existing types ...
  Artifact,
} from "@viben/chat";
```

(Note: `AgentMessage` is already imported via the existing type import.)

- [ ] **Step 2: Destructure new values from useAcpSession**

Add to the destructuring of `acp` (around line ~454, after `closeSubagentSheet`):

```typescript
    toolInspectState,
    handleInspectTool,
    closeToolInspect,
    artifactDialogState,
    handleArtifactClick,
    closeArtifactDialog,
    handleLoadSubagentDetails,
```

- [ ] **Step 3: Add onInspectTool, onArtifactClick, loadSubagentDetails to chatAppProps**

In the `chatAppProps` object (around line ~1155), add:

```typescript
    onInspectTool: handleInspectTool,
    onArtifactClick: handleArtifactClick,
    loadSubagentDetails: handleLoadSubagentDetails,
```

- [ ] **Step 4: Add loadSubagentDetails to subagentSheet prop**

In the subagentSheet conditional (around line ~1180):

```typescript
    subagentSheet: subagentSheet
      ? {
          open: true,
          onClose: closeSubagentSheet,
          title: subagentSheet.title,
          subagentType: subagentSheet.subagentType,
          messages: subagentSheet.messages,
          liveMessages: liveSubagentMessages,
          context: subagentSheet.context,
          loadSubagentDetails: handleLoadSubagentDetails,
        }
      : undefined,
```

- [ ] **Step 5: Add onInspectTool and onArtifactClick to ChatAppFullscreenMessagePanel**

In the fullscreenContent JSX (around line ~1120), add these props:

```typescript
          onInspectTool={handleInspectTool}
          onArtifactClick={handleArtifactClick}
```

- [ ] **Step 6: Refactor render paths to extract a shared dialogs fragment**

**CRITICAL**: The `@viben/ui` Dialog uses `position: fixed` without a React Portal. In floating mode, the `<motion.div>` applies CSS `transform`, which breaks `fixed` positioning (children become relative to the transformed ancestor, not the viewport).

**Solution**: Refactor the 3 early-return render paths into a single return with a variable for the mode-specific content. Render dialogs **outside** the mode wrappers.

Replace the render section (starting around line ~1218) with this pattern:

```typescript
  // Determine mode-specific content
  let modeContent: React.ReactNode;

  if (windowMode) {
    modeContent = (
      <ChatDragProvider value={dragContextValue}>
        <div className={cn("flex h-full w-full flex-col overflow-hidden rounded-xl bg-background", className)}>
          {displayError && (
            <div className="absolute left-4 right-4 top-14 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
              {displayError}
            </div>
          )}
          <ChatApp contained {...chatAppProps} />
        </div>
      </ChatDragProvider>
    );
  } else if (isFloatingMode) {
    modeContent = (
      <ChatDragProvider value={dragContextValue}>
        <div
          ref={containerRef}
          className={cn("absolute inset-0 pointer-events-none z-20", className)}
          data-testid="draggable-chat-container"
        >
          {displayError && (
            <div className="pointer-events-auto absolute left-4 right-4 top-4 z-40 rounded-lg border border-destructive/35 bg-background px-3 py-2 text-sm text-destructive shadow-lg">
              {displayError}
            </div>
          )}
          <motion.div
            className="pointer-events-auto"
            style={floatingStyle ?? { position: "absolute" }}
            animate={isDragging ? undefined : positionConfig}
            transition={isDragging ? { duration: 0 } : SNAP_SPRING}
            data-testid="draggable-chat"
            data-dragging={isDragging}
            data-position={snapPosition}
          >
            <ChatApp contained {...chatAppProps} />
          </motion.div>
        </div>
      </ChatDragProvider>
    );
  } else {
    // Full mode with external resize handle
    const fullModeStyle: React.CSSProperties = enableFullResize
      ? { width: fullWidth, flexShrink: 0 }
      : {};
    const fullModeProps = { ...chatAppProps, enableFullResize: false };

    modeContent = (
      <ChatDragProvider value={dragContextValue}>
        <div
          className={cn(
            "group/resize relative h-full min-h-[560px] bg-background",
            enableFullResize ? "flex-shrink-0" : "overflow-hidden",
            className
          )}
          style={fullModeStyle}
        >
          <ChatApp contained={contained} {...fullModeProps} />
          {enableFullResize && (
            <div
              className={cn(
                "absolute right-0 top-0 bottom-0 z-50 translate-x-1/2",
                "w-3 cursor-ew-resize",
                "group/handle"
              )}
              onMouseDown={handleFullResizeStart}
              data-resize-handle="full-right"
            >
              <div
                className={cn(
                  "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 transition-all duration-150",
                  isFullResizing
                    ? "bg-primary"
                    : "bg-transparent group-hover/handle:bg-border"
                )}
              />
              <div
                className={cn(
                  "absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2",
                  "flex h-8 w-4 items-center justify-center rounded-md",
                  "transition-all duration-150",
                  isFullResizing
                    ? "bg-primary text-primary-foreground opacity-100"
                    : "bg-muted/90 border border-border text-muted-foreground opacity-0 group-hover/handle:opacity-100"
                )}
              >
                <GripVertical className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
      </ChatDragProvider>
    );
  }

  return (
    <>
      {modeContent}
      <ToolInspectDialog state={toolInspectState} onClose={closeToolInspect} />
      <ArtifactDialog state={artifactDialogState} onClose={closeArtifactDialog} />
    </>
  );
```

- [ ] **Step 7: Add ToolInspectDialog helper component**

Add at the bottom of the file (before existing helper functions like `buildAcpCompactSummary`):

```typescript
function toolOutputToDisplayValue(output: AgentMessage["output"]): string {
  if (output == null) return "No output";
  if (typeof output === "string") {
    const trimmed = output.trim();
    if (!trimmed) return "";
    // Try to parse JSON strings for pretty display
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  return JSON.stringify(output, null, 2);
}

function ToolInspectDialog({
  state,
  onClose,
}: {
  state: { message: AgentMessage; result?: AgentMessage } | null;
  onClose: () => void;
}) {
  if (!state) return null;
  const { message, result } = state;
  const output = result?.output ?? message.output;
  const isError = Boolean(result?.isError ?? message.isError);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{message.name ?? "Tool Call"}</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {message.toolUseId ?? message.id}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {result ? "completed" : "pending"}
            </span>
            {isError && (
              <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                error
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Tool</dt>
            <dd className="font-mono">{message.name ?? "unknown"}</dd>
            <dt className="text-muted-foreground">Call ID</dt>
            <dd className="font-mono break-all">{message.toolUseId ?? "none"}</dd>
            {message.subagentId && (
              <>
                <dt className="text-muted-foreground">Subagent</dt>
                <dd className="font-mono break-all">{message.subagentId}</dd>
              </>
            )}
          </dl>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Input</div>
            <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
              {typeof message.input === "string"
                ? message.input
                : JSON.stringify(message.input, null, 2) ?? "null"}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Output</div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
              {toolOutputToDisplayValue(output)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Add ArtifactDialog helper component**

```typescript
function ArtifactDialog({
  state,
  onClose,
}: {
  state: { artifact: Artifact; message?: AgentMessage } | null;
  onClose: () => void;
}) {
  if (!state) return null;
  const { artifact, message } = state;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Artifact</DialogTitle>
          <DialogDescription>{artifact.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">ID</dt>
            <dd className="break-all font-mono">{artifact.id}</dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{artifact.type}</dd>
            {artifact.toolName && (
              <>
                <dt className="text-muted-foreground">Tool</dt>
                <dd>{artifact.toolName}</dd>
              </>
            )}
            {artifact.sourceMessageId && (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="break-all font-mono">{artifact.sourceMessageId}</dd>
              </>
            )}
          </dl>
          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {message ? "Source Message" : "Artifact Data"}
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
              {JSON.stringify(message ?? artifact, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Note: When `message` is null, falls back to displaying the `artifact` object itself (matches App.tsx behavior).

- [ ] **Step 9: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/components/acp-chat/acp-chat.tsx
git commit -m "feat(acp-chat): wire onInspectTool, onArtifactClick, loadSubagentDetails with Dialog overlays"
```

---

### Task 3: Add Context Approval Button + Popup to Bottom Toolbar

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-chat.tsx`

- [ ] **Step 1: Add imports for Context Approval components**

Add to the `@viben/chat` component import block:

```typescript
import {
  // ... existing ...
  ContextApprovalButton,
  ContextApprovalPopup,
  useContextApprovalPopupProps,
} from "@viben/chat";
```

Add to the `@viben/chat` type import block:

```typescript
import type {
  // ... existing types ...
  ApprovalMode,
  ContextTokenBreakdown,
} from "@viben/chat";
```

- [ ] **Step 2: Add state for Context Approval**

Add inside the `AcpChat` component body, after the existing settings state (around line ~470):

```typescript
const [approvalMode, setApprovalMode] = useState<ApprovalMode>("rules");
const [isContextPopupOpen, setIsContextPopupOpen] = useState(false);
const [isContextPopupPinned, setIsContextPopupPinned] = useState(false);
const contextPopupHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 3: Add contextBreakdown computation**

Use already-destructured variables (not `acp.slashCommands`):

```typescript
const contextBreakdown = useMemo<ContextTokenBreakdown>(() => {
  const conversationTokens = Math.max(0, Math.ceil(JSON.stringify(messages).length / 4));
  const streamingTokens = streamingText ? Math.ceil(streamingText.length / 4) : 0;
  const skillTokens = Math.max(0, Math.ceil(JSON.stringify(slashCommands).length / 4));
  const historyTokens = Math.max(0, Math.ceil(JSON.stringify(steerQueueItems).length / 4));
  const assistantProfile = 2000;
  const total = assistantProfile + skillTokens + historyTokens + conversationTokens + streamingTokens + 4000;
  return {
    assistantProfile,
    skillSettings: skillTokens,
    historySummary: historyTokens,
    conversationMessages: conversationTokens + streamingTokens,
    totalContext: Math.max(8000, total),
  };
}, [messages, streamingText, slashCommands, steerQueueItems]);
```

Note: `slashCommands` and `steerQueueItems` are already destructured from `acp` earlier in the component. Use the local variable names directly.

- [ ] **Step 4: Add popup props and hover handlers**

```typescript
const contextPopupProps = useContextApprovalPopupProps(contextBreakdown, approvalMode, setApprovalMode);

const handleContextPopupMouseEnter = useCallback(() => {
  if (contextPopupHoverTimeoutRef.current) {
    clearTimeout(contextPopupHoverTimeoutRef.current);
    contextPopupHoverTimeoutRef.current = null;
  }
  setIsContextPopupOpen(true);
}, []);

const handleContextPopupMouseLeave = useCallback(() => {
  if (isContextPopupPinned) return;
  contextPopupHoverTimeoutRef.current = setTimeout(() => {
    setIsContextPopupOpen(false);
  }, 150);
}, [isContextPopupPinned]);

const handleContextPopupClick = useCallback(() => {
  if (isContextPopupPinned) {
    setIsContextPopupPinned(false);
    setIsContextPopupOpen(false);
  } else {
    setIsContextPopupPinned(true);
    setIsContextPopupOpen(true);
  }
}, [isContextPopupPinned]);
```

- [ ] **Step 5: Update bottomToolbarLeftContent**

Replace the existing `bottomToolbarLeftContent` useMemo (around line ~932).

**IMPORTANT**: Do NOT include `contextPopupProps` in the dependency array — `useContextApprovalPopupProps` returns a new object every render, which would defeat memoization. Instead, since `contextPopupProps` is derived purely from `contextBreakdown` and `approvalMode` (both already in deps), the popup content will be correct whenever the memo recalculates.

```typescript
const bottomToolbarLeftContent = useMemo(
  () => (
    <div className="flex items-center gap-1.5">
      {tripleSelectorNode}
      <div
        className="relative"
        onMouseEnter={handleContextPopupMouseEnter}
        onMouseLeave={handleContextPopupMouseLeave}
      >
        {isContextPopupOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-50 pb-1">
            <ContextApprovalPopup
              breakdown={contextBreakdown}
              totalUsed={
                contextBreakdown.assistantProfile +
                contextBreakdown.skillSettings +
                contextBreakdown.historySummary +
                contextBreakdown.conversationMessages
              }
              usagePercentage={Math.min(
                ((contextBreakdown.assistantProfile +
                  contextBreakdown.skillSettings +
                  contextBreakdown.historySummary +
                  contextBreakdown.conversationMessages) /
                  contextBreakdown.totalContext) * 100,
                100
              )}
              remaining={Math.max(
                0,
                contextBreakdown.totalContext -
                  contextBreakdown.assistantProfile -
                  contextBreakdown.skillSettings -
                  contextBreakdown.historySummary -
                  contextBreakdown.conversationMessages
              )}
              approvalMode={approvalMode}
              onApprovalModeChange={setApprovalMode}
            />
          </div>
        )}
        <ContextApprovalButton
          breakdown={contextBreakdown}
          approvalMode={approvalMode}
          onApprovalModeChange={setApprovalMode}
          onClick={handleContextPopupClick}
          externalPopup
        />
      </div>
      {settingsPopoverNode}
      <div className="flex-1" />
      {voiceInputNode}
    </div>
  ),
  [
    approvalMode,
    contextBreakdown,
    handleContextPopupClick,
    handleContextPopupMouseEnter,
    handleContextPopupMouseLeave,
    isContextPopupOpen,
    settingsPopoverNode,
    tripleSelectorNode,
    voiceInputNode,
  ]
);
```

Note: Inline the popup props computation rather than referencing the unstable `contextPopupProps` object. The `setApprovalMode` function from `useState` is guaranteed stable and doesn't need to be in deps.

- [ ] **Step 6: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/components/acp-chat/acp-chat.tsx
git commit -m "feat(acp-chat): add ContextApprovalButton with hover/click popup in bottom toolbar"
```

---

### Task 4: Add Escape Key Shortcut to Interrupt

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-chat.tsx`

- [ ] **Step 1: Add useEffect for Escape key handler**

Add after the existing `useEffect` hooks in the component body:

```typescript
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !sessionId || !isTurnActive) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('[role="dialog"]')) return;
    event.preventDefault();
    void interrupt();
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [interrupt, isTurnActive, sessionId]);
```

This registers a global Escape key listener that:
- Only fires when there's an active session and a turn in progress
- Skips if the user is inside a dialog (e.g., ToolInspect or Artifact dialog)
- Calls `interrupt()` to cancel the current turn

Note: `sessionId` is derived from `activeSessionId` (already declared). `isTurnActive` and `interrupt` come from the destructured `acp` return.

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/components/acp-chat/acp-chat.tsx
git commit -m "feat(acp-chat): add Escape key shortcut to interrupt active turn"
```

---

### Task 5: Integration Verification

- [ ] **Step 1: Full typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: PASS across all packages

- [ ] **Step 2: Build check**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm build --filter=viben-desktop`
Expected: Build succeeds

- [ ] **Step 3: Manual testing**

1. Start desktop app: `pnpm desktop:restart`
2. Connect ACP session, send a tool-triggering prompt
3. Click a tool call item in message list → ToolInspectDialog opens with input/output, shows status badges, metadata rows
4. Verify JSON output is pretty-printed (JSON strings are parsed and formatted)
5. Close dialog → state resets
6. If artifact exists, click it → ArtifactDialog shows metadata + source message (or artifact fallback)
7. Check bottom toolbar → ContextApprovalButton visible with ring progress
8. Hover ContextApprovalButton → popup appears with token breakdown
9. Click to pin → popup stays; click again → closes
10. Open SubagentSheet → loadSubagentDetails loads messages lazily
11. While agent is running, press Escape → turn is interrupted
12. While inside ToolInspect dialog, press Escape → dialog closes (not interrupt)
