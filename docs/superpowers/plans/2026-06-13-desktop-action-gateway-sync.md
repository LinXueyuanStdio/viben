# Desktop Action Store → Gateway 同步实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop app 通过 socket.io 将本地 action-store 同步到 gateway 的 ClientStore，使外部 MCP 客户端能发现和调用 desktop actions。

**Architecture:** 新增 `GatewayActionSocket` 单例模块，使用 socket.io-client 连接 gateway（source: "main_window"），监听 Zustand action-store 变更自动同步注册，接收 `action:execute` 事件路由到本地执行。

**Tech Stack:** socket.io-client ^4.8.3, @noble/ed25519, Zustand subscribe API, TypeScript

**Spec:** `docs/superpowers/specs/2026-06-13-desktop-action-gateway-sync-design.md`

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `apps/desktop/src/lib/action-system/gateway-action-socket.ts` | **新建** — 核心模块：socket.io 连接、action 同步、执行接收 |
| `apps/desktop/src/lib/action-system/builtins.ts` | **修改** — 导出 `getRegistrableBuiltins()` |
| `apps/desktop/src/lib/action-system/action-executor.ts` | **修改** — 导出 `executeGUIAction` |
| `apps/desktop/src/lib/action-system/execution-context.ts` | **修改** — 新增 `createSocketExecutionContext()` |
| `apps/desktop/src/lib/action-system/index.ts` | **修改** — 新增 barrel exports |
| `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts` | **修改** — 移除 GUI_execute SSE 拦截分支 |
| `apps/desktop/src/components/acp-chat/client-tool-executor.ts` | **修改** — 移除 GUI_execute ACP 处理 |
| `apps/desktop/src/hooks/use-gateway-action-socket.ts` | **新建** — React hook 管理连接生命周期 |
| `apps/desktop/package.json` | **修改** — 添加 socket.io-client 依赖 |

---

### Task 1: 添加 socket.io-client 依赖

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: 添加依赖**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm add socket.io-client@^4.8.3 --filter @viben/desktop
```

- [ ] **Step 2: 验证安装**

Run: `grep "socket.io-client" apps/desktop/package.json`
Expected: `"socket.io-client": "^4.8.3"`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "deps(desktop): add socket.io-client for gateway action sync"
```

---

### Task 2: 导出 builtins 注册元信息

**Files:**
- Modify: `apps/desktop/src/lib/action-system/builtins.ts`

- [ ] **Step 1: 在 builtins.ts 末尾添加 `getRegistrableBuiltins` 函数**

在文件末尾（line 332 之后）添加：

```typescript
export function getRegistrableBuiltins(): Record<string, {
  description: string
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
}> {
  const readWindow = getBuiltinActionDetail("read_window");
  const navigateTo = getBuiltinActionDetail("navigate_to");
  return {
    read_window: {
      description: readWindow!.description,
      inputSchema: readWindow!.input_schema as Record<string, unknown>,
      outputSchema: readWindow!.output_schema as Record<string, unknown>,
    },
    navigate_to: {
      description: navigateTo!.description,
      inputSchema: navigateTo!.input_schema as Record<string, unknown>,
      outputSchema: navigateTo!.output_schema as Record<string, unknown>,
    },
  };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/action-system/builtins.ts
git commit -m "feat(action-system): export getRegistrableBuiltins for gateway registration"
```

---

### Task 3: 导出 executeGUIAction 并新增 createSocketExecutionContext

**Files:**
- Modify: `apps/desktop/src/lib/action-system/action-executor.ts`
- Modify: `apps/desktop/src/lib/action-system/execution-context.ts`

- [ ] **Step 1: 将 executeGUIAction 从 private 改为 export**

在 `action-executor.ts` 中将 line 14 的 `async function executeGUIAction` 改为 `export async function executeGUIAction`：

```typescript
export async function executeGUIAction(
  input: GUIExecuteInput,
  ctx: ReturnType<typeof createExecutionContext>
): Promise<ClientToolResult> {
  // Try built-in actions first
  const builtinResult = await executeBuiltin(input.action, input.payload ?? {}, ctx);
  if (builtinResult !== null) {
    return builtinResult;
  }

  // Delegate to action store
  const store = useActionStore.getState();
  return await store.execute(input.action, input.payload ?? {}, ctx);
}
```

- [ ] **Step 2: 在 execution-context.ts 末尾新增 createSocketExecutionContext**

```typescript
/**
 * Create an ExecutionContext for socket.io-dispatched action execution.
 * Uses a callback for approval that goes through the socket.io protocol
 * rather than showing a local dialog.
 */
export function createSocketExecutionContext(
  sessionId: string,
  toolUseId: string,
  emitApprovalRequest: (message: string, options?: ApprovalOptions) => Promise<boolean>
): ExecutionContext {
  return {
    sessionId,
    toolUseId,
    requireApproval: emitApprovalRequest,
  };
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/lib/action-system/action-executor.ts apps/desktop/src/lib/action-system/execution-context.ts
git commit -m "feat(action-system): export executeGUIAction and add createSocketExecutionContext"
```

---

### Task 4: 更新 barrel exports

**Files:**
- Modify: `apps/desktop/src/lib/action-system/index.ts`

- [ ] **Step 1: 添加新导出**

将 `index.ts` 替换为：

```typescript
export type {
  ActionDef,
  ActionInfo,
  ActionDetail,
  ExecutionContext,
  ApprovalOptions,
  JSONSchema7,
} from "./types";
export { UserCancelledException } from "./errors";
export { createExecutionContext, createSocketExecutionContext, setApprovalHandler, clearApprovalHandler } from "./execution-context";
export type { PendingApproval } from "./execution-context";
export { executeBuiltin, getRegistrableBuiltins } from "./builtins";
export { executeGUIAction } from "./action-executor";
export {
  handleClientSideBash,
  handleGUIExecute,
  isClientSideBashTool,
  isGUIExecuteTool,
  CLIENT_SIDE_BASH_TOOL_NAME,
  GUI_EXECUTE_TOOL_NAME,
} from "./action-executor";
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/action-system/index.ts
git commit -m "feat(action-system): update barrel exports for gateway sync"
```

---

### Task 5: 实现 GatewayActionSocket 核心模块

**Files:**
- Create: `apps/desktop/src/lib/action-system/gateway-action-socket.ts`

- [ ] **Step 1: 创建 gateway-action-socket.ts**

```typescript
import { io, type Socket } from "socket.io-client";
import * as ed from "@noble/ed25519";
import { useActionStore } from "@/stores/action-store";
import { executeGUIAction } from "./action-executor";
import { executeBuiltin } from "./builtins";
import { getRegistrableBuiltins } from "./builtins";
import { createSocketExecutionContext } from "./execution-context";
import { UserCancelledException } from "./errors";
import type { ClientIdentity } from "@/stores/client-id-store";
import type { ClientToolResult } from "../client-side-tool/types";
import type { ApprovalOptions, JSONSchema7 } from "./types";

type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

interface ActionExecuteEvent {
  requestId: string;
  namespace: string;
  action: string;
  payload: unknown;
  context: {
    sessionId: string;
    toolUseId: string;
    callerClientId?: string;
    source: string;
  };
}

interface ActionMeta {
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
}

const DESKTOP_MAIN_NAMESPACE = "desktop_main";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

class GatewayActionSocket {
  private socket: Socket | null = null;
  private _state: ConnectionState = "disconnected";
  private identity: ClientIdentity | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private pendingApprovals = new Map<string, { resolve: (v: boolean) => void; reject: (e: unknown) => void }>();
  private lastRegisteredSnapshot = new Map<string, Map<string, ActionMeta>>();

  get state(): ConnectionState {
    return this._state;
  }

  connect(gatewayUrl: string, identity: ClientIdentity): void {
    if (this.socket) {
      this.disconnect();
    }

    this.identity = identity;
    this._state = "connecting";

    this.socket = io(gatewayUrl, {
      path: "/socket.io/client",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true,
    });

    this.socket.on("connect", () => this.handleConnect());
    this.socket.on("disconnect", () => this.handleDisconnect());
    this.socket.on("reconnecting", () => { this._state = "reconnecting"; });
    this.socket.on("action:execute", (data: ActionExecuteEvent) => this.handleExecute(data));
    this.socket.on("action:approval:result", (data: { requestId: string; approved: boolean; error?: string }) => {
      this.handleApprovalResult(data);
    });

    this.startStoreSubscription();
  }

  disconnect(): void {
    this.stopStoreSubscription();
    this.rejectAllPendingApprovals();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this._state = "disconnected";
    this.lastRegisteredSnapshot.clear();
  }

  private async handleConnect(): Promise<void> {
    if (!this.socket || !this.identity) return;

    const timestamp = Date.now();
    const message = `${this.identity.clientId}:${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);
    const privateKeyBytes = hexToBytes(this.identity.privateKey);
    const signatureBytes = await ed.signAsync(messageBytes, privateKeyBytes);
    const signature = bytesToHex(signatureBytes);

    this.socket.emit("client:connect", {
      clientId: this.identity.clientId,
      source: "main_window",
      publicKey: this.identity.publicKey,
      signature,
      timestamp,
    }, (ack: { success: boolean; error?: string }) => {
      if (ack.success) {
        this._state = "connected";
        console.info("[GatewayActionSocket] Connected and authenticated");
        this.syncFullRegistration();
      } else {
        console.error("[GatewayActionSocket] Auth failed:", ack.error);
        this._state = "disconnected";
      }
    });
  }

  private handleDisconnect(): void {
    this._state = "disconnected";
    this.lastRegisteredSnapshot.clear();
    this.rejectAllPendingApprovals();
    console.info("[GatewayActionSocket] Disconnected");
  }

  private async handleExecute(data: ActionExecuteEvent): Promise<void> {
    const { requestId, namespace, action, payload, context } = data;
    let result: ClientToolResult;

    try {
      const ctx = createSocketExecutionContext(
        context.sessionId,
        context.toolUseId,
        (message, options) => this.emitApprovalRequest(requestId, message, options)
      );

      if (namespace === DESKTOP_MAIN_NAMESPACE && (action === "read_window" || action === "navigate_to")) {
        const builtinResult = await executeBuiltin(action, payload ?? {}, ctx);
        result = builtinResult ?? {
          content: [{ type: "text", text: `Builtin "${action}" returned null` }],
          isError: true,
        };
      } else {
        const fullName = `${namespace}.${action}`;
        result = await executeGUIAction({ action: fullName, payload }, ctx);
      }
    } catch (err) {
      if (err instanceof UserCancelledException) {
        result = { content: [{ type: "text", text: "User rejected" }], isError: true };
      } else {
        result = { content: [{ type: "text", text: `execution_error: ${String(err)}` }], isError: true };
      }
    }

    this.socket?.emit("action:result", { requestId, result });
  }

  private emitApprovalRequest(executeRequestId: string, message: string, options?: ApprovalOptions): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      if (!this.socket) {
        reject(new UserCancelledException("Socket disconnected"));
        return;
      }

      const requestId = crypto.randomUUID();
      this.pendingApprovals.set(requestId, { resolve, reject });

      this.socket.emit("action:approval:request", {
        requestId,
        executeRequestId,
        message,
        options: options ? { timeout: 30000, ...options } : { timeout: 30000 },
      });
    });
  }

  private handleApprovalResult(data: { requestId: string; approved: boolean; error?: string }): void {
    const pending = this.pendingApprovals.get(data.requestId);
    if (!pending) return;
    this.pendingApprovals.delete(data.requestId);

    if (data.error) {
      pending.reject(new UserCancelledException(data.error));
    } else {
      pending.resolve(data.approved);
    }
  }

  private rejectAllPendingApprovals(): void {
    for (const [, pending] of this.pendingApprovals) {
      pending.reject(new UserCancelledException("Socket disconnected"));
    }
    this.pendingApprovals.clear();
  }

  // --- Store subscription and sync ---

  private startStoreSubscription(): void {
    this.unsubscribeStore = useActionStore.subscribe((state, prevState) => {
      if (this._state !== "connected") return;
      if (state.registry === prevState.registry) return;
      this.syncDiff(state.registry, prevState.registry);
    });
  }

  private stopStoreSubscription(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
  }

  private syncFullRegistration(): void {
    const state = useActionStore.getState();
    const grouped = this.buildNamespaceMap(state.registry);

    // Register builtins under desktop_main namespace
    const builtins = getRegistrableBuiltins();
    if (!grouped.has(DESKTOP_MAIN_NAMESPACE)) {
      grouped.set(DESKTOP_MAIN_NAMESPACE, new Map());
    }
    const desktopMainActions = grouped.get(DESKTOP_MAIN_NAMESPACE)!;
    for (const [name, meta] of Object.entries(builtins)) {
      desktopMainActions.set(name, meta);
    }

    // Emit registration for each namespace
    for (const [namespace, actions] of grouped) {
      this.emitRegister(namespace, actions);
    }

    this.lastRegisteredSnapshot = grouped;
  }

  private syncDiff(
    current: Map<string, { namespace: string; actions: { name: string; description: string; input_schema?: JSONSchema7; output_schema?: JSONSchema7 }[] }>,
    _previous: Map<string, { namespace: string; actions: { name: string; description: string; input_schema?: JSONSchema7; output_schema?: JSONSchema7 }[] }>
  ): void {
    const currentGrouped = this.buildNamespaceMap(current);

    // Add builtins to current snapshot for comparison
    const builtins = getRegistrableBuiltins();
    if (!currentGrouped.has(DESKTOP_MAIN_NAMESPACE)) {
      currentGrouped.set(DESKTOP_MAIN_NAMESPACE, new Map());
    }
    const desktopMainActions = currentGrouped.get(DESKTOP_MAIN_NAMESPACE)!;
    for (const [name, meta] of Object.entries(builtins)) {
      desktopMainActions.set(name, meta);
    }

    // Find namespaces that need re-registration
    for (const [namespace, actions] of currentGrouped) {
      const lastActions = this.lastRegisteredSnapshot.get(namespace);
      if (!lastActions || !this.namespaceActionsEqual(actions, lastActions)) {
        this.emitRegister(namespace, actions);
      }
    }

    // Find namespaces that were removed
    for (const namespace of this.lastRegisteredSnapshot.keys()) {
      if (!currentGrouped.has(namespace)) {
        this.socket?.emit("action:unregister", { namespace });
      }
    }

    this.lastRegisteredSnapshot = currentGrouped;
  }

  private buildNamespaceMap(
    registry: Map<string, { namespace: string; actions: { name: string; description: string; input_schema?: JSONSchema7; output_schema?: JSONSchema7 }[] }>
  ): Map<string, Map<string, ActionMeta>> {
    const grouped = new Map<string, Map<string, ActionMeta>>();

    // Priority order: newest first (same as action-store resolution)
    const providers = [...registry.values()].sort((a, b) => {
      const aReg = (a as { registeredAt?: number }).registeredAt ?? 0;
      const bReg = (b as { registeredAt?: number }).registeredAt ?? 0;
      return bReg - aReg;
    });

    for (const provider of providers) {
      if (!grouped.has(provider.namespace)) {
        grouped.set(provider.namespace, new Map());
      }
      const nsMap = grouped.get(provider.namespace)!;
      for (const action of provider.actions) {
        if (!nsMap.has(action.name)) {
          nsMap.set(action.name, {
            description: action.description,
            inputSchema: action.input_schema,
            outputSchema: action.output_schema,
          });
        }
      }
    }

    return grouped;
  }

  private namespaceActionsEqual(a: Map<string, ActionMeta>, b: Map<string, ActionMeta>): boolean {
    if (a.size !== b.size) return false;
    for (const [name, meta] of a) {
      const other = b.get(name);
      if (!other) return false;
      if (meta.description !== other.description) return false;
      if (JSON.stringify(meta.inputSchema) !== JSON.stringify(other.inputSchema)) return false;
      if (JSON.stringify(meta.outputSchema) !== JSON.stringify(other.outputSchema)) return false;
    }
    return true;
  }

  private emitRegister(namespace: string, actions: Map<string, ActionMeta>): void {
    if (!this.socket || actions.size === 0) return;

    const actionsPayload: Record<string, { description: string; inputSchema?: JSONSchema7; outputSchema?: JSONSchema7 }> = {};
    for (const [name, meta] of actions) {
      actionsPayload[name] = {
        description: meta.description,
        inputSchema: meta.inputSchema,
        outputSchema: meta.outputSchema,
      };
    }

    this.socket.emit("action:register", { namespace, actions: actionsPayload });
  }
}

export const gatewayActionSocket = new GatewayActionSocket();
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/action-system/gateway-action-socket.ts
git commit -m "feat(action-system): implement GatewayActionSocket for gateway sync"
```

---

### Task 6: 创建 React hook 管理连接生命周期

**Files:**
- Create: `apps/desktop/src/hooks/use-gateway-action-socket.ts`

- [ ] **Step 1: 创建 hook 文件**

```typescript
import { useEffect, useState } from "react";
import { gatewayActionSocket } from "@/lib/action-system/gateway-action-socket";
import { getGatewayUrl } from "@/lib/gateway/config";
import { getIdentitySync, getOrCreateIdentity } from "@/stores/client-id-store";

export function useGatewayActionSocket(): { state: string } {
  const [state, setState] = useState<string>(gatewayActionSocket.state);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const identity = getIdentitySync() ?? await getOrCreateIdentity();
      if (cancelled) return;

      const gatewayUrl = getGatewayUrl();
      gatewayActionSocket.connect(gatewayUrl, identity);
    }

    init();

    const interval = setInterval(() => {
      const current = gatewayActionSocket.state;
      setState((prev) => prev !== current ? current : prev);
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      gatewayActionSocket.disconnect();
    };
  }, []);

  return { state };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/hooks/use-gateway-action-socket.ts
git commit -m "feat(desktop): add useGatewayActionSocket hook for connection lifecycle"
```

---

### Task 7: 集成 hook 到 App 层

**Files:**
- Modify: 需要找到 App 层入口组件并集成 hook

- [ ] **Step 1: 确定集成位置**

Run: `grep -rn "ApprovalDialog\|setApprovalHandler\|useActionProvider" apps/desktop/src/App.tsx apps/desktop/src/app/ apps/desktop/src/components/app/ apps/desktop/src/layouts/ --include="*.tsx" --include="*.ts" | head -20`

找到 App 级别组件位置。hook 需要在 `setApprovalHandler` 所在的组件附近或其父级调用。

- [ ] **Step 2: 在 App 级组件中添加 hook**

在找到的 App 级组件中添加：

```typescript
import { useGatewayActionSocket } from "@/hooks/use-gateway-action-socket";

// 在组件内部：
useGatewayActionSocket();
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add <modified-file>
git commit -m "feat(desktop): integrate GatewayActionSocket in app initialization"
```

---

### Task 8: 移除 use-agent-conversation.ts 中的 GUI_execute 拦截

**Files:**
- Modify: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`

- [ ] **Step 1: 删除 GUI_execute 分支**

将 lines 598-612 的代码：

```typescript
        // GUI Action system interception
        if (isGUIExecuteTool(toolName)) {
          handleGUIExecute(data.id || toolId, sessionIdRef.current || "", {
            action: (toolInput as { action?: string }).action || "",
            payload: (toolInput as { payload?: unknown }).payload,
          }).catch((err) => {
            console.error("[GUI_execute] Failed:", err);
          });
        } else if (isClientSideBashTool(toolName)) {
          handleClientSideBash(data.id || toolId, sessionIdRef.current || "", {
            script: typeof toolInput.script === "string" ? toolInput.script : "",
          }).catch((err) => {
            console.error("[ClientSideBash] Failed:", err);
          });
        }
```

替换为（只保留 ClientSideBash）：

```typescript
        // Client-side bash interception (ClientSideBash runs locally, not via socket.io)
        if (isClientSideBashTool(toolName)) {
          handleClientSideBash(data.id || toolId, sessionIdRef.current || "", {
            script: typeof toolInput.script === "string" ? toolInput.script : "",
          }).catch((err) => {
            console.error("[ClientSideBash] Failed:", err);
          });
        }
```

- [ ] **Step 2: 清理 imports**

从 line 49-52 的 import 中移除 `handleGUIExecute` 和 `isGUIExecuteTool`：

Before:
```typescript
import {
  handleClientSideBash,
  handleGUIExecute,
  isClientSideBashTool,
  isGUIExecuteTool,
} from "@/lib/action-system";
```

After:
```typescript
import {
  handleClientSideBash,
  isClientSideBashTool,
} from "@/lib/action-system";
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts
git commit -m "refactor(desktop): remove GUI_execute SSE interception (now via socket.io)"
```

---

### Task 9: 移除 client-tool-executor.ts 中的 GUI_execute 处理

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/client-tool-executor.ts`

- [ ] **Step 1: 修改 executeClientTool 函数**

将 `executeClientTool` 函数（line 139-154）替换为：

```typescript
export async function executeClientTool(
  request: ClientToolExecutionRequest
): Promise<CallToolResult> {
  if (isClientSideBashTool(request.toolName)) {
    return executeClientSideBash(request);
  }

  return errorResult(`Desktop client has no handler for tool: ${request.toolName}`, {
    toolName: request.toolName,
    supportedTools: ["ClientSideBash", "mcp__client_side__ClientSideBash"],
  });
}
```

- [ ] **Step 2: 移除不再需要的 imports 和函数**

移除：
- `isGuiExecuteTool` 函数定义（line 32-36）
- `executeGuiAction` 函数（line 107-124）
- `executeGUIAction` 内部函数（line 75-93）
- `normalizeBuiltinPayload` 函数（line 95-101）
- 不再需要的 imports：`useActionStore`, `createExecutionContext`, `executeBuiltin`, `GUIExecuteInput`

保留：
- `isClientSideBashTool` import
- `createClientSideBash` import
- `executeClientSideBash` 函数
- `ClientToolExecutionRequest` interface
- `errorResult`, `toCallToolResult` helper 函数
- `isRecord` helper

- [ ] **Step 3: 验证编译**

Run: `cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm --filter @viben/desktop typecheck`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/components/acp-chat/client-tool-executor.ts
git commit -m "refactor(desktop): remove GUI_execute from ACP path (now via socket.io)"
```

---

### Task 10: 端到端验证

**Files:**
- None (testing only)

- [ ] **Step 1: 启动 gateway**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm gateway:restart
```

等待 gateway 在 port 18790 启动。

- [ ] **Step 2: 启动 desktop app**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm desktop:restart
```

- [ ] **Step 3: 验证 desktop socket.io 连接**

检查 desktop devtools console 中出现：
```
[GatewayActionSocket] Connected and authenticated
```

- [ ] **Step 4: 验证 actions 在 gateway 中注册**

```bash
curl http://127.0.0.1:18790/api/mcp-server/gui-action -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected: 响应中包含 `desktop_main.read_window` 和 `desktop_main.navigate_to`，以及任何已 mount 的 provider actions。

- [ ] **Step 5: 验证 E2E 页面仍然正常**

打开 `pages/0612-e2e-page/index.html`（通过 desktop 内嵌 page preview），确认：
- 页面仍然能连接 gateway
- 页面 actions 注册正常
- desktop actions 和 page actions 共存

- [ ] **Step 6: 全量编译检查**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben && pnpm typecheck
```

Expected: 所有包编译通过无错误。
