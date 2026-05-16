# GUI Action System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic GUI action system that allows agents to call desktop app UI capabilities through `GUI_execute` MCP tool, with page-level action providers and a centralized action store.

**Architecture:** Zustand action store aggregates actions from page-level `useActionProvider` hooks. Backend registers `GUI_execute` as a client-side MCP tool using the existing `clientToolCompletionRegistry` pipeline. Frontend intercepts the tool_use SSE event, executes the action from the store, and POSTs the `ClientToolResult` back.

**Tech Stack:** Zustand, React hooks, MCP SDK (zod schemas), existing client-tool completion pipeline

---

## File Structure

| File | Responsibility |
|------|---------------|
| `apps/desktop/src/lib/action-system/types.ts` | Core type definitions (ActionDef, ExecutionContext, etc.) |
| `apps/desktop/src/lib/action-system/errors.ts` | UserCancelledException |
| `apps/desktop/src/lib/action-system/execution-context.ts` | Factory for creating ExecutionContext with requireApproval |
| `apps/desktop/src/lib/action-system/builtins.ts` | Built-in actions: list_actions, get_action_detail, read_window, navigate_to |
| `apps/desktop/src/lib/action-system/action-executor.ts` | Handles GUI_execute tool_use events from SSE |
| `apps/desktop/src/lib/action-system/index.ts` | Re-exports |
| `apps/desktop/src/stores/action-store.ts` | Zustand store for action registry |
| `apps/desktop/src/hooks/use-action-provider.ts` | Hook for components to register actions |
| `packages/core/src/executors/chat/sdk-mcp-servers/gui-action.ts` | Backend MCP tool registration |
| Modify: `packages/core/src/executors/chat/sdk-mcp-registry.ts:122` | Add import for gui-action server |
| Modify: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts:~797` | Add GUI_execute interception in SSE handler |

---

### Task 1: Types and Errors

**Files:**
- Create: `apps/desktop/src/lib/action-system/types.ts`
- Create: `apps/desktop/src/lib/action-system/errors.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// apps/desktop/src/lib/action-system/types.ts
import type { ClientToolResult } from "../client-side-tool/types";

/** JSON Schema 7 subset for action input/output definitions */
export type JSONSchema7 = Record<string, unknown>;

/** Options for the requireApproval dialog */
export interface ApprovalOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Context passed to every action execute function */
export interface ExecutionContext {
  /** Show confirmation dialog. Resolves true if confirmed, throws UserCancelledException if cancelled. */
  requireApproval: (message: string, options?: ApprovalOptions) => Promise<boolean>;
  /** Current session ID */
  sessionId: string;
  /** Current tool_use_id for correlation */
  toolUseId: string;
}

/** Definition of a single action (without namespace prefix in name) */
export interface ActionDef {
  name: string;
  description: string;
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
  execute: (payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

/** Action info returned by list_actions (with full namespace.name) */
export interface ActionInfo {
  name: string;
  description: string;
}

/** Action detail returned by get_action_detail */
export interface ActionDetail extends ActionInfo {
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
}
```

- [ ] **Step 2: Create errors.ts**

```typescript
// apps/desktop/src/lib/action-system/errors.ts

/** Thrown when user cancels an approval dialog */
export class UserCancelledException extends Error {
  constructor(message = "User cancelled the action") {
    super(message);
    this.name = "UserCancelledException";
  }
}
```

- [ ] **Step 3: Verify files compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/action-system/types.ts apps/desktop/src/lib/action-system/errors.ts
git commit -m "feat(action-system): add core types and error definitions"
```

---

### Task 2: Action Store

**Files:**
- Create: `apps/desktop/src/stores/action-store.ts`

- [ ] **Step 1: Create action-store.ts**

```typescript
// apps/desktop/src/stores/action-store.ts
import { create } from "zustand";
import type { ClientToolResult } from "@/lib/client-side-tool/types";
import type { ActionDef, ActionInfo, ActionDetail, ExecutionContext } from "@/lib/action-system/types";

interface ActionStoreState {
  /** Registry: namespace → ActionDef[] */
  registry: Map<string, ActionDef[]>;

  /** Register actions under a namespace. Replaces any existing actions for that namespace. */
  register: (namespace: string, actions: ActionDef[]) => void;

  /** Unregister all actions for a namespace. */
  unregister: (namespace: string) => void;

  /** Get all registered actions as ActionInfo[] (with namespace.name format). */
  listActions: () => ActionInfo[];

  /** Get detail for a specific action by full name (namespace.name). */
  getActionDetail: (fullName: string) => ActionDetail | null;

  /** Execute an action by full name. Throws if action not found. */
  execute: (fullName: string, payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

export const useActionStore = create<ActionStoreState>()((set, get) => ({
  registry: new Map(),

  register: (namespace, actions) => {
    set((state) => {
      const newRegistry = new Map(state.registry);
      newRegistry.set(namespace, actions);
      return { registry: newRegistry };
    });
  },

  unregister: (namespace) => {
    set((state) => {
      const newRegistry = new Map(state.registry);
      newRegistry.delete(namespace);
      return { registry: newRegistry };
    });
  },

  listActions: () => {
    const { registry } = get();
    const actions: ActionInfo[] = [];
    for (const [namespace, defs] of registry) {
      for (const def of defs) {
        actions.push({
          name: `${namespace}.${def.name}`,
          description: def.description,
        });
      }
    }
    return actions;
  },

  getActionDetail: (fullName) => {
    const { registry } = get();
    const dotIndex = fullName.indexOf(".");
    if (dotIndex === -1) return null;

    const namespace = fullName.slice(0, dotIndex);
    const name = fullName.slice(dotIndex + 1);
    const defs = registry.get(namespace);
    if (!defs) return null;

    const def = defs.find((d) => d.name === name);
    if (!def) return null;

    return {
      name: fullName,
      description: def.description,
      input_schema: def.input_schema,
      output_schema: def.output_schema,
    };
  },

  execute: async (fullName, payload, ctx) => {
    const { registry } = get();
    const dotIndex = fullName.indexOf(".");
    if (dotIndex === -1) {
      return {
        content: [{ type: "text", text: `action_not_available: "${fullName}" has no namespace prefix` }],
        isError: true,
      };
    }

    const namespace = fullName.slice(0, dotIndex);
    const name = fullName.slice(dotIndex + 1);
    const defs = registry.get(namespace);
    if (!defs) {
      return {
        content: [{ type: "text", text: `action_not_available: namespace "${namespace}" is not registered` }],
        isError: true,
      };
    }

    const def = defs.find((d) => d.name === name);
    if (!def) {
      return {
        content: [{ type: "text", text: `action_not_available: "${fullName}" is not registered` }],
        isError: true,
      };
    }

    return def.execute(payload, ctx);
  },
}));
```

- [ ] **Step 2: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/stores/action-store.ts
git commit -m "feat(action-system): add Zustand action store with registry"
```

---

### Task 3: useActionProvider Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-action-provider.ts`

- [ ] **Step 1: Create use-action-provider.ts**

```typescript
// apps/desktop/src/hooks/use-action-provider.ts
import { useEffect } from "react";
import { useActionStore } from "@/stores/action-store";
import type { ClientToolResult } from "@/lib/client-side-tool/types";
import type { ExecutionContext, JSONSchema7 } from "@/lib/action-system/types";

/** Action definition without the 'name' field (name comes from the object key) */
export interface ActionProviderEntry {
  description: string;
  input_schema?: JSONSchema7;
  output_schema?: JSONSchema7;
  execute: (payload: unknown, ctx: ExecutionContext) => Promise<ClientToolResult>;
}

/**
 * Register actions under a namespace. Actions are automatically unregistered on unmount.
 *
 * IMPORTANT: The `actions` parameter must be referentially stable (use useMemo or module-level constant).
 * Unstable references will cause re-registration on every render.
 *
 * @param namespace - Unique namespace prefix (e.g., 'chat', 'presentation')
 * @param actions - Record of action name → definition
 */
export function useActionProvider(
  namespace: string,
  actions: Record<string, ActionProviderEntry>
): void {
  const register = useActionStore((s) => s.register);
  const unregister = useActionStore((s) => s.unregister);

  useEffect(() => {
    const defs = Object.entries(actions).map(([name, def]) => ({
      name,
      ...def,
    }));
    register(namespace, defs);
    return () => unregister(namespace);
  }, [namespace, actions, register, unregister]);
}
```

- [ ] **Step 2: Export from hooks/index.ts**

Add to `apps/desktop/src/hooks/index.ts`:
```typescript
export { useActionProvider } from "./use-action-provider";
```

- [ ] **Step 3: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/use-action-provider.ts apps/desktop/src/hooks/index.ts
git commit -m "feat(action-system): add useActionProvider hook"
```

---

### Task 4: ExecutionContext Factory

**Files:**
- Create: `apps/desktop/src/lib/action-system/execution-context.ts`

- [ ] **Step 1: Create execution-context.ts**

```typescript
// apps/desktop/src/lib/action-system/execution-context.ts
import type { ExecutionContext, ApprovalOptions } from "./types";
import { UserCancelledException } from "./errors";

/**
 * Pending approval state. The action-executor component renders a dialog
 * when this is set, and resolves/rejects the promise accordingly.
 */
export interface PendingApproval {
  message: string;
  options?: ApprovalOptions;
  resolve: (value: boolean) => void;
  reject: (reason: unknown) => void;
}

/** Module-level callback to show approval dialog. Set by the ApprovalDialog component. */
let approvalHandler: ((pending: PendingApproval) => void) | null = null;

/**
 * Register the approval dialog handler. Called once by the ApprovalDialog component on mount.
 */
export function setApprovalHandler(handler: (pending: PendingApproval) => void): void {
  approvalHandler = handler;
}

/**
 * Unregister the approval dialog handler. Called on unmount.
 */
export function clearApprovalHandler(): void {
  approvalHandler = null;
}

/**
 * Create an ExecutionContext for a given tool invocation.
 */
export function createExecutionContext(sessionId: string, toolUseId: string): ExecutionContext {
  return {
    sessionId,
    toolUseId,
    requireApproval: (message: string, options?: ApprovalOptions): Promise<boolean> => {
      if (!approvalHandler) {
        // No handler registered — reject by default for safety
        return Promise.reject(new UserCancelledException("No approval dialog available"));
      }
      return new Promise<boolean>((resolve, reject) => {
        approvalHandler!({ message, options, resolve, reject });
      });
    },
  };
}
```

- [ ] **Step 2: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/action-system/execution-context.ts
git commit -m "feat(action-system): add ExecutionContext factory with approval handler"
```

---

### Task 5: Built-in Actions

**Files:**
- Create: `apps/desktop/src/lib/action-system/builtins.ts`

- [ ] **Step 1: Create builtins.ts**

```typescript
// apps/desktop/src/lib/action-system/builtins.ts
import type { ClientToolResult } from "../client-side-tool/types";
import type { ExecutionContext } from "./types";
import { useActionStore } from "@/stores/action-store";

/**
 * Execute a built-in action. Returns null if the action name is not a built-in.
 */
export async function executeBuiltin(
  action: string,
  payload: unknown,
  _ctx: ExecutionContext
): Promise<ClientToolResult | null> {
  switch (action) {
    case "list_actions":
      return handleListActions();
    case "get_action_detail":
      return handleGetActionDetail(payload);
    case "read_window":
      return handleReadWindow();
    case "navigate_to":
      return handleNavigateTo(payload);
    default:
      return null; // Not a built-in
  }
}

function handleListActions(): ClientToolResult {
  const store = useActionStore.getState();
  const actions = store.listActions();
  return {
    content: [{ type: "text", text: JSON.stringify(actions, null, 2) }],
  };
}

function handleGetActionDetail(payload: unknown): ClientToolResult {
  const { action } = (payload as { action?: string }) || {};
  if (!action) {
    return {
      content: [{ type: "text", text: 'validation_error: missing required field "action"' }],
      isError: true,
    };
  }

  const store = useActionStore.getState();
  const detail = store.getActionDetail(action);
  if (!detail) {
    return {
      content: [{ type: "text", text: `action_not_available: "${action}" is not registered` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
  };
}

async function handleReadWindow(): Promise<ClientToolResult> {
  try {
    // Use dom-to-image-more or canvas API to capture the app viewport
    const appRoot = document.getElementById("root");
    if (!appRoot) {
      return {
        content: [{ type: "text", text: "read_window failed: no root element found" }],
        isError: true,
      };
    }

    // Dynamic import to avoid bundling if not used
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(appRoot, {
      quality: 0.8,
      pixelRatio: 1,
    });

    // Strip the data:image/png;base64, prefix
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");

    return {
      content: [{ type: "image", data: base64, mimeType: "image/png" }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `read_window failed: ${String(err)}` }],
      isError: true,
    };
  }
}

function handleNavigateTo(payload: unknown): ClientToolResult {
  const { url } = (payload as { url?: string }) || {};
  if (!url) {
    return {
      content: [{ type: "text", text: 'validation_error: missing required field "url"' }],
      isError: true,
    };
  }

  try {
    // Use window.location for internal routing (hash-based or history-based)
    // The desktop app uses react-router with hash routing
    window.location.hash = url.startsWith("#") ? url : `#${url}`;
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, url }) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `navigate_to failed: ${String(err)}` }],
      isError: true,
    };
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

Note: `html-to-image` may need to be added as a dependency. Check with:
```bash
grep "html-to-image" apps/desktop/package.json
```
If missing, install:
```bash
cd apps/desktop && pnpm add html-to-image
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/action-system/builtins.ts
git commit -m "feat(action-system): add built-in actions (list, detail, screenshot, navigate)"
```

---

### Task 6: Action Executor

**Files:**
- Create: `apps/desktop/src/lib/action-system/action-executor.ts`
- Create: `apps/desktop/src/lib/action-system/index.ts`

- [ ] **Step 1: Create action-executor.ts**

```typescript
// apps/desktop/src/lib/action-system/action-executor.ts
import type { ClientToolResult } from "../client-side-tool/types";
import { useActionStore } from "@/stores/action-store";
import { createExecutionContext } from "./execution-context";
import { executeBuiltin } from "./builtins";
import { UserCancelledException } from "./errors";

/**
 * Handle a GUI_execute tool_use event from SSE.
 * Executes the action and posts the result back to the gateway.
 */
export async function handleGUIExecute(
  toolUseId: string,
  sessionId: string,
  input: { action: string; payload?: unknown }
): Promise<void> {
  const { completeClientTool } = await import("../gateway/modules/client-tools");

  const ctx = createExecutionContext(sessionId, toolUseId);
  let result: ClientToolResult;

  try {
    // Try built-in actions first
    const builtinResult = await executeBuiltin(input.action, input.payload ?? {}, ctx);
    if (builtinResult !== null) {
      result = builtinResult;
    } else {
      // Delegate to action store
      const store = useActionStore.getState();
      result = await store.execute(input.action, input.payload ?? {}, ctx);
    }
  } catch (err) {
    if (err instanceof UserCancelledException) {
      result = { content: [{ type: "text", text: "user_cancelled" }], isError: true };
    } else {
      result = { content: [{ type: "text", text: `execution_error: ${String(err)}` }], isError: true };
    }
  }

  // Post result back to gateway
  await completeClientTool({
    tool_use_id: toolUseId,
    session_id: sessionId,
    result,
  });
}

/** Tool name constant for identification */
export const GUI_EXECUTE_TOOL_NAME = "GUI_execute";

/**
 * Check if a tool name is the GUI_execute tool.
 * Handles the mcp__<server>__ prefix stripping.
 */
export function isGUIExecuteTool(toolName: string): boolean {
  const bare = toolName.replace(/^mcp__\w+__/, "");
  return bare === GUI_EXECUTE_TOOL_NAME;
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// apps/desktop/src/lib/action-system/index.ts
export type {
  ActionDef,
  ActionInfo,
  ActionDetail,
  ExecutionContext,
  ApprovalOptions,
  JSONSchema7,
} from "./types";
export { UserCancelledException } from "./errors";
export { createExecutionContext, setApprovalHandler, clearApprovalHandler } from "./execution-context";
export type { PendingApproval } from "./execution-context";
export { executeBuiltin } from "./builtins";
export { handleGUIExecute, isGUIExecuteTool, GUI_EXECUTE_TOOL_NAME } from "./action-executor";
```

- [ ] **Step 3: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/action-system/action-executor.ts apps/desktop/src/lib/action-system/index.ts
git commit -m "feat(action-system): add action executor and module index"
```

---

### Task 7: Backend MCP Tool Registration

**Files:**
- Create: `packages/core/src/executors/chat/sdk-mcp-servers/gui-action.ts`
- Modify: `packages/core/src/executors/chat/sdk-mcp-registry.ts:122`

- [ ] **Step 1: Create gui-action.ts**

```typescript
// packages/core/src/executors/chat/sdk-mcp-servers/gui-action.ts
/**
 * GUI Action MCP Server
 *
 * Provides the GUI_execute tool for agents to invoke desktop app UI actions.
 * The actual execution happens on the frontend — this handler validates input
 * and awaits the client-side completion via ClientToolCompletionRegistry.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ClientToolCancelledError, clientToolCompletionRegistry } from "../../../services/client-tool-completion";
import { registerSdkMcpServer } from "../sdk-mcp-registry";

registerSdkMcpServer("gui_action", (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require("zod");

  const sessionId = context?.sessionId;

  function error(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }

  async function safeWaitForClient(sid: string): Promise<CallToolResult> {
    try {
      return await clientToolCompletionRegistry.waitForClient(sid);
    } catch (err) {
      if (err instanceof ClientToolCancelledError) {
        return { content: [{ type: "text" as const, text: "GUI action cancelled by user." }], isError: true };
      }
      throw err;
    }
  }

  // Register as client-side tool with 60s timeout (actions may involve user interaction)
  clientToolCompletionRegistry.registerToolOptions("GUI_execute", { timeoutMs: 60_000 });

  return createSdkMcpServer({
    name: "gui_action",
    version: "1.0.0",
    tools: [
      tool(
        "GUI_execute",
        "执行桌面应用的 GUI action。使用 list_actions 查看当前可用 action，使用 get_action_detail 查看 action 详情和参数定义。内置 action：list_actions, get_action_detail, read_window, navigate_to。",
        {
          action: z.string().describe("完整 action 名称。内置 action 无需前缀，自定义 action 使用 namespace.name 格式（如 chat.send_message）"),
          payload: z.record(z.unknown()).optional().describe("action 输入参数，具体结构由 get_action_detail 返回的 input_schema 定义"),
        },
        async (args) => {
          const { action } = args as { action: string; payload?: Record<string, unknown> };
          if (!action) {
            return error("Error: action field is required");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
    ],
  });
});
```

- [ ] **Step 2: Add import to sdk-mcp-registry.ts**

In `packages/core/src/executors/chat/sdk-mcp-registry.ts`, add after line 122 (`import "./sdk-mcp-servers/presentation";`):

```typescript
import "./sdk-mcp-servers/gui-action";
```

- [ ] **Step 3: Verify compile**

Run: `cd packages/core && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/executors/chat/sdk-mcp-servers/gui-action.ts packages/core/src/executors/chat/sdk-mcp-registry.ts
git commit -m "feat(action-system): register GUI_execute MCP tool on backend"
```

---

### Task 8: Frontend SSE Interception

**Files:**
- Modify: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts:~797`

- [ ] **Step 1: Add import at top of use-agent-conversation.ts**

Add near the other client-side tool imports (around line 10-30):

```typescript
import { isGUIExecuteTool, handleGUIExecute } from "@/lib/action-system";
```

- [ ] **Step 2: Add GUI_execute interception in the tool_use case**

In the `handleSSEMessage` function, inside the `case "tool_use":` block, after the existing presentation tool check (around line 830-869), add a new check:

```typescript
        // GUI Action system interception
        if (isGUIExecuteTool(toolName)) {
          const toolInput = msg.input as { action: string; payload?: unknown };
          // Execute asynchronously — result is posted back via completeClientTool
          handleGUIExecute(msg.id, sessionIdRef.current || "", toolInput).catch((err) => {
            console.error("[agent-conversation] GUI_execute failed:", err);
          });
        }
```

This block should be placed AFTER the presentation tool checks but BEFORE the generic `break;` of the `tool_use` case. The existing SSE message forwarding (sendMessage to the frontend) still happens for all tool_use events.

- [ ] **Step 3: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts
git commit -m "feat(action-system): intercept GUI_execute tool_use in SSE handler"
```

---

### Task 9: Approval Dialog Component

**Files:**
- Create: `apps/desktop/src/components/action-system/approval-dialog.tsx`
- Create: `apps/desktop/src/components/action-system/index.ts`

- [ ] **Step 1: Create approval-dialog.tsx**

```typescript
// apps/desktop/src/components/action-system/approval-dialog.tsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  setApprovalHandler,
  clearApprovalHandler,
  UserCancelledException,
} from "@/lib/action-system";
import type { PendingApproval } from "@/lib/action-system";

/**
 * Global approval dialog for GUI actions that require user confirmation.
 * Mount once at app root level.
 */
export function ActionApprovalDialog() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingApproval | null>(null);

  useEffect(() => {
    setApprovalHandler((p) => setPending(p));
    return () => clearApprovalHandler();
  }, []);

  const handleConfirm = useCallback(() => {
    if (pending) {
      pending.resolve(true);
      setPending(null);
    }
  }, [pending]);

  const handleCancel = useCallback(() => {
    if (pending) {
      pending.reject(new UserCancelledException());
      setPending(null);
    }
  }, [pending]);

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pending?.options?.title || t("actionSystem.approvalTitle", "Action Approval")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.message}
            {pending?.options?.description && (
              <span className="block mt-2 text-muted-foreground">
                {pending.options.description}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {pending?.options?.cancelLabel || t("common.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {pending?.options?.confirmLabel || t("common.confirm", "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Create index.ts**

```typescript
// apps/desktop/src/components/action-system/index.ts
export { ActionApprovalDialog } from "./approval-dialog";
```

- [ ] **Step 3: Mount in app root**

In the app's root layout component (where `OverlayRoot` is mounted), add:

```typescript
import { ActionApprovalDialog } from "@/components/action-system";
```

And render `<ActionApprovalDialog />` as a sibling to other global components.

- [ ] **Step 4: Add i18n keys**

In `apps/desktop/src/i18n/locales/en.json`, add in the top-level object:
```json
"actionSystem": {
  "approvalTitle": "Action Approval"
}
```

In `apps/desktop/src/i18n/locales/zh-CN.json`:
```json
"actionSystem": {
  "approvalTitle": "操作审批"
}
```

- [ ] **Step 5: Verify compile**

Run: `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/action-system/ apps/desktop/src/i18n/locales/en.json apps/desktop/src/i18n/locales/zh-CN.json
git commit -m "feat(action-system): add approval dialog component and i18n"
```

---

### Task 10: End-to-End Verification

**Files:**
- No new files — manual testing

- [ ] **Step 1: Verify the full pipeline compiles**

Run from project root:
```bash
pnpm typecheck
```
Expected: No type errors in `apps/desktop` and `packages/core`

- [ ] **Step 2: Verify the MCP tool is registered**

After starting the gateway (`pnpm gateway:restart`), check that `gui_action` appears in the SDK MCP server list by looking at logs or calling the health endpoint.

- [ ] **Step 3: Test with a simple action provider**

Create a temporary test by adding `useActionProvider` in any mounted component:

```typescript
// Temporary test in any page component
const testActions = useMemo(() => ({
  hello: {
    description: "Test action that returns a greeting",
    input_schema: { type: "object", properties: { name: { type: "string" } } },
    execute: async (payload: unknown) => {
      const { name } = payload as { name?: string };
      return {
        content: [{ type: "text" as const, text: `Hello, ${name || "world"}!` }],
      };
    },
  },
}), []);
useActionProvider("test", testActions);
```

Then have an agent call:
1. `GUI_execute(session, "list_actions", {})` — should return `[{ name: "test.hello", description: "..." }]`
2. `GUI_execute(session, "test.hello", { name: "Agent" })` — should return `Hello, Agent!`

- [ ] **Step 4: Remove test code and commit verification**

```bash
git add -A
git commit -m "feat(action-system): complete GUI action system implementation"
```

---

## Notes for Implementation

1. **html-to-image dependency**: The `read_window` built-in uses `html-to-image`. Verify it's in `apps/desktop/package.json` dependencies. If not, add it: `pnpm --filter viben-desktop add html-to-image`.

2. **Router hash format**: The `navigate_to` built-in assumes hash-based routing (`window.location.hash`). Verify this matches the desktop app's router configuration. If it uses `createBrowserRouter`, use `window.history.pushState` or the router instance instead.

3. **Session ID in SSE handler**: The `handleGUIExecute` call needs access to the current `sessionId`. Check how `sessionIdRef` is available in the `tool_use` case of `handleSSEMessage` — it should be accessible from the same closure as the presentation tool logic.

4. **Presentation migration (future)**: Task 10's Presentation Provider migration is explicitly NOT included in this plan. It's a separate effort that can be done after the core system is stable.
