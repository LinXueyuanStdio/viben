# ACP Chat Missing Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supplement the desktop ACP Chat with 4 missing UI interactions: Tool Inspect dialog, Artifact dialog, SubagentSheet loadSubagentDetails, and Context Approval button+popup.

**Architecture:** Add state and handlers to `use-acp-session.ts`, pass them through `acp-chat.tsx` into existing `ChatApp` props. Render overlay components (Dialog for inspect/artifact) directly in `acp-chat.tsx`. Context Approval adds to the existing `bottomToolbarLeftContent`.

**Tech Stack:** React, @viben/chat (ContextApprovalButton, ContextApprovalPopup, useContextApprovalPopupProps), @viben/ui (Dialog components), TypeScript

---

## File Structure

| File | Responsibility |
|------|----------------|
| `apps/desktop/src/components/acp-chat/use-acp-session.ts` | State + handlers: toolInspect, artifactDialog, loadSubagentDetails |
| `apps/desktop/src/components/acp-chat/acp-chat.tsx` | Wire handlers to ChatApp, render Dialog overlays, add ContextApproval |

No new files needed. All logic stays in existing files.

---

### Task 1: Add Tool Inspect and Artifact State to use-acp-session.ts

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/use-acp-session.ts`

- [ ] **Step 1: Add types and state to the interface**

Add to the `UseAcpSessionReturn` interface (after the subagent sheet section at line ~187):

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

- [ ] **Step 2: Add import for new types**

Add to the `@viben/chat` type import at the top (line ~14):

```typescript
import type {
  AgentMessage,
  Artifact,
  CommandQueueItem,
  LoadedSubagentDetails,    // NEW
  PendingQuestion,
  QueuedInputRecallItem,
  SelectorOption,
  SlashCommand,
  SlashCommandSelection,
  SubagentOpenContext,       // NEW
  TaskPlan,
} from "@viben/chat";
```

- [ ] **Step 3: Add state variables in the hook body**

Add state refs using `useAcpSessionStore` or local `useRef`/`useState`. Since this hook uses a Zustand store (`useAcpSessionStore`), and these are transient UI state (not needed across mode switches), use local refs in the hook. However since `use-acp-session.ts` doesn't use `useState` directly (it uses Zustand store), we'll add these to the store.

Actually looking at the code, the hook uses `useAcpSessionStore` for persistence. For transient dialog state, add local state via a returned object pattern. Looking more carefully, the hook already returns computed values from the store — so we should add these state fields to the store.

Check: the store is at `@/stores/acp-session-store`. But for simplicity and since tool inspect / artifact are truly ephemeral (reset on mode switch is fine), add them as `useRef` values with force-update trigger:

```typescript
// Inside useAcpSession(), after the subagentSheet variables (around line 382):
const [toolInspectState, setToolInspectState] = useState<{ message: AgentMessage; result?: AgentMessage } | null>(null);
const [artifactDialogState, setArtifactDialogState] = useState<{ artifact: Artifact; message?: AgentMessage } | null>(null);
```

Add `useState` to the React import (line 13):

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 4: Implement handleInspectTool callback**

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

- [ ] **Step 5: Implement handleArtifactClick callback**

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

- [ ] **Step 6: Implement handleLoadSubagentDetails callback**

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

- [ ] **Step 7: Add to return object**

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

- [ ] **Step 8: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS (or only pre-existing errors)

- [ ] **Step 9: Commit**

```bash
git add apps/desktop/src/components/acp-chat/use-acp-session.ts
git commit -m "feat(acp-chat): add toolInspect, artifactDialog, loadSubagentDetails handlers"
```

---

### Task 2: Wire Handlers into acp-chat.tsx and Render Dialogs

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-chat.tsx`

- [ ] **Step 1: Add new imports from @viben/chat**

Add to the `@viben/chat` import block (line ~37):

```typescript
import type {
  // ... existing types ...
  InspectToolHandler,
  LoadSubagentDetails,
  SubagentOpenContext,
} from "@viben/chat";
```

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

- [ ] **Step 2: Destructure new values from useAcpSession**

In the component body where `acp` is destructured (around line ~454):

```typescript
    // Add after closeSubagentSheet:
    toolInspectState,
    handleInspectTool,
    closeToolInspect,
    artifactDialogState,
    handleArtifactClick,
    closeArtifactDialog,
    handleLoadSubagentDetails,
```

- [ ] **Step 3: Add onInspectTool and onArtifactClick to chatAppProps**

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
          loadSubagentDetails: handleLoadSubagentDetails,  // NEW
        }
      : undefined,
```

- [ ] **Step 5: Add onInspectTool and onArtifactClick to ChatAppFullscreenMessagePanel**

In the fullscreenContent JSX (around line ~1120):

```typescript
          onInspectTool={handleInspectTool}
          onArtifactClick={handleArtifactClick}
```

- [ ] **Step 6: Render ToolInspectDialog**

Add before the closing `</ChatDragProvider>` in the windowMode render (around line ~1231) and also in the non-floating render paths. Best approach: add a shared fragment at the end of the component, before the final return statements. Actually, since there are 3 render paths (windowMode, floatingMode, fullMode), the simplest is to render the dialogs outside the mode-specific wrappers.

Add a helper component at the bottom of the file (before the existing helper functions):

```typescript
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
            {message.subagentId && (
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                subagent: {message.subagentId}
              </span>
            )}
          </div>
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
              {output == null
                ? "No output"
                : typeof output === "string"
                  ? output
                  : JSON.stringify(output, null, 2)}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 7: Render ArtifactDialog**

Add another helper component:

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
          {message && (
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Source Message</div>
              <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(message, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Mount dialogs in all render paths**

The cleanest approach: render dialogs inside `<ChatDragProvider>` but outside `<ChatApp>`, since Dialog uses portals. Add right before `</ChatDragProvider>` in all 3 render paths (windowMode, floating, full):

For **windowMode** (line ~1220):
```tsx
      <ToolInspectDialog state={toolInspectState} onClose={closeToolInspect} />
      <ArtifactDialog state={artifactDialogState} onClose={closeArtifactDialog} />
    </ChatDragProvider>
```

For **floating mode** (line ~1261):
```tsx
      <ToolInspectDialog state={toolInspectState} onClose={closeToolInspect} />
      <ArtifactDialog state={artifactDialogState} onClose={closeArtifactDialog} />
    </ChatDragProvider>
```

For **full mode** (line ~1331):
```tsx
      <ToolInspectDialog state={toolInspectState} onClose={closeToolInspect} />
      <ArtifactDialog state={artifactDialogState} onClose={closeArtifactDialog} />
    </ChatDragProvider>
```

- [ ] **Step 9: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/components/acp-chat/acp-chat.tsx
git commit -m "feat(acp-chat): wire onInspectTool, onArtifactClick, loadSubagentDetails and render dialogs"
```

---

### Task 3: Add Context Approval Button + Popup to Bottom Toolbar

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-chat.tsx`

- [ ] **Step 1: Add imports for Context Approval components**

Add to the `@viben/chat` import block (existing component imports around line ~37):

```typescript
import {
  // ... existing ...
  ContextApprovalButton,
  ContextApprovalPopup,
  useContextApprovalPopupProps,
} from "@viben/chat";
import type {
  // ... existing types ...
  ApprovalMode,
  ContextTokenBreakdown,
} from "@viben/chat";
```

- [ ] **Step 2: Add state and computed values for Context Approval**

Add inside the `AcpChat` component body, after the existing settings state (around line ~470):

```typescript
// Context approval state
const [approvalMode, setApprovalMode] = useState<ApprovalMode>("rules");
const [isContextPopupOpen, setIsContextPopupOpen] = useState(false);
const [isContextPopupPinned, setIsContextPopupPinned] = useState(false);
const contextPopupHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 3: Add contextBreakdown computation**

Add a memoized value (after the state declarations):

```typescript
const contextBreakdown = useMemo<ContextTokenBreakdown>(() => {
  const conversationMessages = Math.max(0, Math.ceil(JSON.stringify(messages).length / 4));
  const streamingTokens = streamingText ? Math.ceil(streamingText.length / 4) : 0;
  const skillSettings = Math.max(0, Math.ceil(JSON.stringify(acp.slashCommands).length / 4));
  const historySummary = Math.max(0, Math.ceil(JSON.stringify(acp.steerQueueItems).length / 4));
  const assistantProfile = 2000; // base estimate for assistant system prompt
  const total = assistantProfile + skillSettings + historySummary + conversationMessages + streamingTokens + 4000;
  return {
    assistantProfile,
    skillSettings,
    historySummary,
    conversationMessages: conversationMessages + streamingTokens,
    totalContext: Math.max(8000, total),
  };
}, [messages, streamingText, acp.slashCommands, acp.steerQueueItems]);
```

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

- [ ] **Step 5: Update bottomToolbarLeftContent to include ContextApprovalButton**

Replace the existing `bottomToolbarLeftContent` useMemo (around line ~932):

```typescript
const bottomToolbarLeftContent = useMemo(
  () => (
    <div className="flex items-center gap-1.5">
      {tripleSelectorNode}
      {/* Context Approval with hover/click popup */}
      <div
        className="relative"
        onMouseEnter={handleContextPopupMouseEnter}
        onMouseLeave={handleContextPopupMouseLeave}
      >
        {isContextPopupOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-50 pb-1">
            <ContextApprovalPopup {...contextPopupProps} />
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
    contextPopupProps,
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

- [ ] **Step 6: Verify typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck --filter=viben-desktop`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/components/acp-chat/acp-chat.tsx
git commit -m "feat(acp-chat): add ContextApprovalButton with hover/click popup in bottom toolbar"
```

---

### Task 4: Integration Verification

- [ ] **Step 1: Full typecheck**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck`
Expected: PASS across all packages

- [ ] **Step 2: Build check**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm build --filter=viben-desktop`
Expected: Build succeeds

- [ ] **Step 3: Manual testing**

1. Start desktop app: `pnpm desktop:restart`
2. Connect ACP session, send a tool-triggering prompt
3. Click a tool call item in message list → ToolInspectDialog opens with input/output
4. Close dialog → state resets
5. Check bottom toolbar → ContextApprovalButton visible with ring progress
6. Hover ContextApprovalButton → popup appears with token breakdown
7. Click to pin → popup stays; click again → closes
8. Open SubagentSheet → loadSubagentDetails loads messages lazily
