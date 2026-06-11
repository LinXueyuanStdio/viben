# Gateway Client Action Socket.io 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 action-store 从前端移到 Gateway，使用 Socket.io 实现 Page/MainWindow 与 Gateway 的双向通信，支持跨设备 action 调用。

**Architecture:** Gateway 维护 client-store（按 clientId 分组），每个 client 有独立的 action-store。Page/MainWindow 通过 Socket.io 连接 Gateway 注册 action，MCP Server 通过 client-store 查找并执行 action。

**Tech Stack:** Socket.io, TypeScript, Zustand (desktop client-id store), esbuild (SDK bundling)

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `packages/core/src/gateway/client-store.ts` | ClientState 数据结构、action CRUD、查找逻辑 |
| `packages/core/src/gateway/client-socket-server.ts` | Socket.io Server 初始化、事件处理 |
| `packages/core/src/assets/viben-page-sdk.ts` | SDK TypeScript 源码 |
| `packages/core/scripts/build-page-sdk.ts` | esbuild 打包脚本 |
| `apps/desktop/src/stores/client-id-store.ts` | Zustand store，持久化 client id |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/core/src/gateway/state.ts` | 添加 clientStore 到 AppState |
| `packages/core/src/gateway/index.ts` | 初始化 ClientSocketServer |
| `packages/core/src/acp/ops/client-side-mcp-server.ts` | 改用 clientStore 执行 action |
| `packages/core/package.json` | 添加依赖和 build 脚本 |
| `apps/desktop/src/pages/apps/components/static-page-preview.tsx` | 注入 `__VIBEN_CONFIG__`，移除 PageActionBridge |

### 删除文件

| 文件 |
|------|
| `apps/desktop/src/pages/apps/components/page-action-bridge.ts` |
| `packages/core/assets/viben-page-sdk.js` |

---

## Task 1: 安装依赖

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: 添加 socket.io 依赖**

```bash
cd packages/core && pnpm add socket.io socket.io-client
```

- [ ] **Step 2: 验证依赖安装**

```bash
cd packages/core && pnpm list socket.io socket.io-client
```

Expected: 显示 socket.io 和 socket.io-client 版本

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "chore(core): add socket.io dependencies"
```

---

## Task 2: 实现 ClientStore

**Files:**
- Create: `packages/core/src/gateway/client-store.ts`
- Create: `packages/core/src/gateway/client-store.test.ts`

- [ ] **Step 1: 写测试 - ClientStore 基本功能**

```typescript
// packages/core/src/gateway/client-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { ClientStore } from "./client-store";

describe("ClientStore", () => {
  let store: ClientStore;

  beforeEach(() => {
    store = new ClientStore();
  });

  describe("client management", () => {
    it("should register a new client", () => {
      store.registerClient("client_abc", {
        source: "main_window",
        socketId: "socket_1",
      });
      
      const client = store.getClient("client_abc");
      expect(client).toBeDefined();
      expect(client?.sockets.size).toBe(1);
    });

    it("should add socket to existing client", () => {
      store.registerClient("client_abc", {
        source: "main_window",
        socketId: "socket_1",
      });
      store.registerClient("client_abc", {
        source: "page_iframe",
        socketId: "socket_2",
        pageSlug: "canvas",
      });
      
      const client = store.getClient("client_abc");
      expect(client?.sockets.size).toBe(2);
    });

    it("should remove socket and cleanup empty client", () => {
      store.registerClient("client_abc", {
        source: "main_window",
        socketId: "socket_1",
      });
      store.removeSocket("client_abc", "socket_1");
      
      expect(store.getClient("client_abc")).toBeUndefined();
    });
  });

  describe("action management", () => {
    it("should register action for a socket", () => {
      store.registerClient("client_abc", {
        source: "page_iframe",
        socketId: "socket_1",
        pageSlug: "canvas",
      });
      
      store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });
      
      const action = store.findAction("client_abc", "canvas", "create_node");
      expect(action).toBeDefined();
      expect(action?.socketId).toBe("socket_1");
    });

    it("should be idempotent - same content skips update", () => {
      store.registerClient("client_abc", {
        source: "page_iframe",
        socketId: "socket_1",
      });
      
      const result1 = store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });
      
      const result2 = store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });
      
      expect(result1.updated).toBe(true);
      expect(result2.updated).toBe(false);
    });

    it("should cleanup actions when socket disconnects", () => {
      store.registerClient("client_abc", {
        source: "page_iframe",
        socketId: "socket_1",
      });
      store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });
      
      store.removeSocket("client_abc", "socket_1");
      
      expect(store.findAction("client_abc", "canvas", "create_node")).toBeUndefined();
    });
  });

  describe("getAllActions", () => {
    it("should return all actions across clients", () => {
      store.registerClient("client_a", { source: "main_window", socketId: "s1" });
      store.registerClient("client_b", { source: "main_window", socketId: "s2" });
      
      store.registerAction("client_a", "s1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create",
      });
      store.registerAction("client_b", "s2", {
        namespace: "editor",
        name: "save",
        description: "Save",
      });
      
      const all = store.getAllActions();
      expect(all).toHaveLength(2);
      expect(all.map(a => a.clientId)).toContain("client_a");
      expect(all.map(a => a.clientId)).toContain("client_b");
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd packages/core && pnpm test src/gateway/client-store.test.ts
```

Expected: FAIL - Cannot find module './client-store'

- [ ] **Step 3: 实现 ClientStore**

```typescript
// packages/core/src/gateway/client-store.ts
import type { JSONSchema7 } from "json-schema";
import { logger as globalLogger } from "../telemetry";

const log = globalLogger.child({ module: "client-store" });

export type SocketSource = "main_window" | "page_iframe" | "chat_window" | "standalone";

export interface SocketInfo {
  socketId: string;
  source: SocketSource;
  pageSlug?: string;
  connectedAt: number;
}

export interface ActionEntry {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
  socketId: string;
  registeredAt: number;
  hash: string;
}

export interface ClientState {
  clientId: string;
  sockets: Map<string, SocketInfo>;
  actionStore: Map<string, ActionEntry>;
  metadata: {
    theme: "light" | "dark";
    workspacePath: string;
  };
}

export interface RegisterClientOptions {
  source: SocketSource;
  socketId: string;
  pageSlug?: string;
  theme?: "light" | "dark";
  workspacePath?: string;
}

export interface RegisterActionOptions {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
}

export interface ActionWithClient extends ActionEntry {
  clientId: string;
}

function fnv1aHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function computeActionHash(action: RegisterActionOptions): string {
  const content = action.description +
    JSON.stringify(action.inputSchema ?? null) +
    JSON.stringify(action.outputSchema ?? null);
  return fnv1aHash(content);
}

export class ClientStore {
  private clients = new Map<string, ClientState>();

  getClient(clientId: string): ClientState | undefined {
    return this.clients.get(clientId);
  }

  registerClient(clientId: string, options: RegisterClientOptions): ClientState {
    let client = this.clients.get(clientId);
    
    if (!client) {
      client = {
        clientId,
        sockets: new Map(),
        actionStore: new Map(),
        metadata: {
          theme: options.theme ?? "light",
          workspacePath: options.workspacePath ?? "",
        },
      };
      this.clients.set(clientId, client);
      log.info({ clientId }, "Client registered");
    }

    if (!client.sockets.has(options.socketId)) {
      client.sockets.set(options.socketId, {
        socketId: options.socketId,
        source: options.source,
        pageSlug: options.pageSlug,
        connectedAt: Date.now(),
      });
      log.info({ clientId, socketId: options.socketId, source: options.source }, "Socket added to client");
    }

    if (options.theme) {
      client.metadata.theme = options.theme;
    }
    if (options.workspacePath) {
      client.metadata.workspacePath = options.workspacePath;
    }

    return client;
  }

  removeSocket(clientId: string, socketId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.sockets.delete(socketId);
    log.info({ clientId, socketId }, "Socket removed from client");

    // Remove actions registered by this socket
    for (const [fullName, action] of client.actionStore) {
      if (action.socketId === socketId) {
        client.actionStore.delete(fullName);
        log.info({ clientId, action: fullName }, "Action removed (socket disconnected)");
      }
    }

    // Cleanup empty client
    if (client.sockets.size === 0) {
      this.clients.delete(clientId);
      log.info({ clientId }, "Client removed (no sockets)");
    }
  }

  registerAction(
    clientId: string,
    socketId: string,
    action: RegisterActionOptions
  ): { updated: boolean; fullName: string } {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    const fullName = `${action.namespace}.${action.name}`;
    const hash = computeActionHash(action);
    const existing = client.actionStore.get(fullName);

    if (existing && existing.hash === hash) {
      return { updated: false, fullName };
    }

    const entry: ActionEntry = {
      namespace: action.namespace,
      name: action.name,
      description: action.description,
      inputSchema: action.inputSchema,
      outputSchema: action.outputSchema,
      socketId,
      registeredAt: Date.now(),
      hash,
    };

    client.actionStore.set(fullName, entry);
    log.info({ clientId, action: fullName, socketId }, "Action registered");

    return { updated: true, fullName };
  }

  unregisterAction(clientId: string, namespace?: string, socketId?: string): string[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const removed: string[] = [];

    for (const [fullName, action] of client.actionStore) {
      const matchNamespace = !namespace || action.namespace === namespace;
      const matchSocket = !socketId || action.socketId === socketId;
      
      if (matchNamespace && matchSocket) {
        client.actionStore.delete(fullName);
        removed.push(fullName);
      }
    }

    if (removed.length > 0) {
      log.info({ clientId, removed }, "Actions unregistered");
    }

    return removed;
  }

  findAction(
    clientId: string,
    namespace: string,
    name: string
  ): ActionEntry | undefined {
    const client = this.clients.get(clientId);
    if (!client) return undefined;
    return client.actionStore.get(`${namespace}.${name}`);
  }

  getAllActions(): ActionWithClient[] {
    const result: ActionWithClient[] = [];
    
    for (const [clientId, client] of this.clients) {
      for (const action of client.actionStore.values()) {
        result.push({ ...action, clientId });
      }
    }
    
    return result;
  }

  getSocketInfo(clientId: string, socketId: string): SocketInfo | undefined {
    return this.clients.get(clientId)?.sockets.get(socketId);
  }

  getAllClients(): string[] {
    return Array.from(this.clients.keys());
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd packages/core && pnpm test src/gateway/client-store.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gateway/client-store.ts packages/core/src/gateway/client-store.test.ts
git commit -m "feat(gateway): add ClientStore for action management"
```

---

## Task 3: 实现 ClientSocketServer

**Files:**
- Create: `packages/core/src/gateway/client-socket-server.ts`

- [ ] **Step 1: 实现 ClientSocketServer**

```typescript
// packages/core/src/gateway/client-socket-server.ts
import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import type { JSONSchema7 } from "json-schema";
import { ClientStore, type SocketSource } from "./client-store";
import { logger as globalLogger } from "../telemetry";

const log = globalLogger.child({ module: "client-socket-server" });

const SOCKET_IO_PATH = "/socket.io/client";
const EXECUTE_TIMEOUT_MS = 30000;
const REQUEST_ID_TTL_MS = 60000;

export type ExecuteSource = SocketSource | "mcp";

interface ClientConnectData {
  clientId: string;
  source: SocketSource;
  pageSlug?: string;
}

interface ActionRegisterData {
  namespace: string;
  actions: Record<string, {
    description: string;
    inputSchema?: JSONSchema7;
    outputSchema?: JSONSchema7;
  }>;
}

interface ActionUnregisterData {
  namespace?: string;
}

interface ActionResultData {
  requestId: string;
  result: {
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
}

interface ExecuteContext {
  sessionId: string;
  toolUseId: string;
  callerClientId?: string;
  source: ExecuteSource;
}

interface PendingExecute {
  requestId: string;
  clientId: string;
  socketId: string;
  resolve: (result: ActionResultData["result"]) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class ClientSocketServer {
  private io: SocketIOServer;
  private clientStore: ClientStore;
  private pendingExecutes = new Map<string, PendingExecute>();
  private seenRequestIds = new Map<string, number>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(httpServer: HttpServer, clientStore: ClientStore) {
    this.clientStore = clientStore;
    this.io = new SocketIOServer(httpServer, {
      path: SOCKET_IO_PATH,
      cors: { origin: "*" },
    });

    this.setupEventHandlers();
    this.startCleanup();
    log.info({ path: SOCKET_IO_PATH }, "ClientSocketServer initialized");
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      log.debug({ socketId: socket.id }, "Socket connected");

      socket.on("client:connect", (data: ClientConnectData, ack) => {
        this.handleClientConnect(socket, data, ack);
      });

      socket.on("action:register", (data: ActionRegisterData) => {
        this.handleActionRegister(socket, data);
      });

      socket.on("action:unregister", (data: ActionUnregisterData) => {
        this.handleActionUnregister(socket, data);
      });

      socket.on("action:result", (data: ActionResultData) => {
        this.handleActionResult(data);
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private handleClientConnect(
    socket: Socket,
    data: ClientConnectData,
    ack?: (response: { success: boolean; error?: string }) => void
  ): void {
    if (!data.clientId || typeof data.clientId !== "string") {
      ack?.({ success: false, error: "clientId is required" });
      return;
    }

    if (!data.source) {
      ack?.({ success: false, error: "source is required" });
      return;
    }

    // Store clientId on socket for later use
    (socket as Socket & { clientId?: string }).clientId = data.clientId;

    const client = this.clientStore.registerClient(data.clientId, {
      source: data.source,
      socketId: socket.id,
      pageSlug: data.pageSlug,
    });

    // Join client room for broadcasting
    socket.join(`client:${data.clientId}`);

    // Send init
    socket.emit("client:init", {
      theme: client.metadata.theme,
      workspacePath: client.metadata.workspacePath,
    });

    ack?.({ success: true });
    log.info({ clientId: data.clientId, socketId: socket.id, source: data.source }, "Client connected");
  }

  private handleActionRegister(socket: Socket, data: ActionRegisterData): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) {
      log.warn({ socketId: socket.id }, "Action register without client connect");
      return;
    }

    if (!data.namespace || typeof data.namespace !== "string") {
      log.warn({ clientId, socketId: socket.id }, "Invalid namespace");
      return;
    }

    const accepted: string[] = [];
    const rejected: Array<{ action: string; reason: string }> = [];

    for (const [name, actionDef] of Object.entries(data.actions || {})) {
      try {
        const result = this.clientStore.registerAction(clientId, socket.id, {
          namespace: data.namespace,
          name,
          description: actionDef.description,
          inputSchema: actionDef.inputSchema,
          outputSchema: actionDef.outputSchema,
        });
        accepted.push(name);
      } catch (error) {
        rejected.push({
          action: name,
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Send ack back
    socket.emit("action:register:result", {
      namespace: data.namespace,
      accepted,
      rejected,
    });
  }

  private handleActionUnregister(socket: Socket, data: ActionUnregisterData): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) return;

    this.clientStore.unregisterAction(clientId, data.namespace, socket.id);
  }

  private handleActionResult(data: ActionResultData): void {
    const pending = this.pendingExecutes.get(data.requestId);
    if (!pending) {
      log.debug({ requestId: data.requestId }, "Result for unknown request (possibly timed out)");
      return;
    }

    clearTimeout(pending.timer);
    this.pendingExecutes.delete(data.requestId);
    pending.resolve(data.result);
  }

  private handleDisconnect(socket: Socket): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) return;

    // Reject pending executes for this socket
    for (const [requestId, pending] of this.pendingExecutes) {
      if (pending.socketId === socket.id) {
        clearTimeout(pending.timer);
        this.pendingExecutes.delete(requestId);
        pending.reject(new Error("socket_disconnected"));
      }
    }

    this.clientStore.removeSocket(clientId, socket.id);
    log.info({ clientId, socketId: socket.id }, "Socket disconnected");
  }

  async executeAction(
    targetClientId: string,
    namespace: string,
    actionName: string,
    payload: unknown,
    context: ExecuteContext
  ): Promise<ActionResultData["result"]> {
    const action = this.clientStore.findAction(targetClientId, namespace, actionName);
    if (!action) {
      return {
        content: [{ type: "text", text: `Action not found: ${namespace}.${actionName}` }],
        isError: true,
      };
    }

    const client = this.clientStore.getClient(targetClientId);
    if (!client || client.sockets.size === 0) {
      return {
        content: [{ type: "text", text: `Client offline: ${targetClientId}` }],
        isError: true,
      };
    }

    const socketInfo = client.sockets.get(action.socketId);
    if (!socketInfo) {
      return {
        content: [{ type: "text", text: "Action socket disconnected" }],
        isError: true,
      };
    }

    const socket = this.io.sockets.sockets.get(action.socketId);
    if (!socket) {
      return {
        content: [{ type: "text", text: "Socket not found" }],
        isError: true,
      };
    }

    const requestId = randomUUID();

    // Check for duplicate request
    if (this.seenRequestIds.has(requestId)) {
      return {
        content: [{ type: "text", text: "Duplicate request" }],
        isError: true,
      };
    }
    this.seenRequestIds.set(requestId, Date.now());

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingExecutes.delete(requestId);
        resolve({
          content: [{ type: "text", text: "Execution timeout" }],
          isError: true,
        });
      }, EXECUTE_TIMEOUT_MS);

      this.pendingExecutes.set(requestId, {
        requestId,
        clientId: targetClientId,
        socketId: action.socketId,
        resolve,
        reject,
        timer,
      });

      socket.emit("action:execute", {
        requestId,
        namespace,
        action: actionName,
        payload,
        context,
      });
    });
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [requestId, timestamp] of this.seenRequestIds) {
        if (now - timestamp > REQUEST_ID_TTL_MS) {
          this.seenRequestIds.delete(requestId);
        }
      }
    }, 60000);
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    for (const pending of this.pendingExecutes.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Server shutdown"));
    }
    this.pendingExecutes.clear();

    this.io.close();
    log.info("ClientSocketServer shut down");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/gateway/client-socket-server.ts
git commit -m "feat(gateway): add ClientSocketServer for Socket.io communication"
```

---

## Task 4: 集成到 Gateway

**Files:**
- Modify: `packages/core/src/gateway/state.ts`
- Modify: `packages/core/src/gateway/index.ts`

- [ ] **Step 1: 修改 state.ts 添加 clientStore**

在 `packages/core/src/gateway/state.ts` 中添加：

```typescript
// 在 import 区域添加
import { ClientStore } from "./client-store";

// 在 AppState interface 中添加
export interface AppState {
  // ... existing fields ...
  /** Client store for Socket.io connected clients and their actions */
  clientStore: ClientStore;
}

// 在 createAppState 函数中添加
export function createAppState(config: AppStateConfig = {}): AppState {
  // ... existing code ...
  
  // Create client store
  const clientStore = new ClientStore();

  return {
    // ... existing fields ...
    clientStore,
  };
}
```

- [ ] **Step 2: 修改 index.ts 初始化 Socket.io Server**

在 `packages/core/src/gateway/index.ts` 中：

```typescript
// 在 import 区域添加
import { ClientSocketServer } from "./client-socket-server";

// 在 createGateway 函数中，在 app.listen 返回前添加
// 注意：需要获取 httpServer，在 app.ready() 之后

// 在 "// Register routes" 之后添加：
  // Create client socket server (Socket.io)
  // Note: We need the underlying http server, which is available after ready
  let clientSocketServer: ClientSocketServer | null = null;
  
  app.addHook("onReady", async () => {
    const httpServer = app.server;
    clientSocketServer = new ClientSocketServer(httpServer, state.clientStore);
    log.info("Client Socket.io server started");
  });

// 在 shutdown hook 中添加清理
  app.addHook("onClose", async () => {
    // ... existing cleanup ...
    clientSocketServer?.shutdown();
    // ...
  });
```

- [ ] **Step 3: 运行类型检查**

```bash
cd packages/core && pnpm typecheck
```

Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/state.ts packages/core/src/gateway/index.ts
git commit -m "feat(gateway): integrate ClientStore and Socket.io server"
```

---

## Task 5: 修改 MCP Server 使用 ClientStore

**Files:**
- Modify: `packages/core/src/acp/ops/client-side-mcp-server.ts`
- Modify: `packages/core/src/gateway/routes/mcp-server/gui-action-mcp-server.ts`

- [ ] **Step 1: 添加 action 解析和路由逻辑**

在 `packages/core/src/acp/ops/client-side-mcp-server.ts` 中添加：

```typescript
// 在文件顶部添加新的 interface
export interface ClientStoreExecutor {
  executeAction: (
    targetClientId: string,
    namespace: string,
    actionName: string,
    payload: unknown,
    context: { sessionId: string; toolUseId: string; callerClientId?: string; source: string }
  ) => Promise<CallToolResult>;
  getAllActions: () => Array<{
    clientId: string;
    namespace: string;
    name: string;
    description: string;
    inputSchema?: unknown;
  }>;
}

export interface ClientSideMcpServerOptions {
  sessionId?: string;
  gatewayUrl?: string;
  callerClientId?: string;  // 新增：调用方的 client id
  clientStoreExecutor?: ClientStoreExecutor;  // 新增：直接执行器
  requestClientTool?: (request: ClientSideClientToolRequest) => Promise<CallToolResult>;
}

// 修改 GUI_EXECUTE_TOOL_NAME 的 handler，支持 clientStore 路由
// 在 server.tool(GUI_EXECUTE_TOOL_NAME, ...) 的 handler 中添加：

async (args): Promise<CallToolResult> => {
  const input = args as { action?: string; payload?: Record<string, unknown> };
  if (!input.action) {
    return errorResult("Error: action field is required.");
  }

  // 如果有 clientStoreExecutor，使用新的路由逻辑
  if (options.clientStoreExecutor) {
    const parsed = parseActionName(input.action, options.callerClientId);
    return await options.clientStoreExecutor.executeAction(
      parsed.targetClientId,
      parsed.namespace,
      parsed.name,
      input.payload ?? {},
      {
        sessionId: sessionId ?? "",
        toolUseId: `gui-${randomUUID()}`,
        callerClientId: options.callerClientId,
        source: "mcp",
      }
    );
  }

  // 否则使用原有逻辑
  if (!sessionId) {
    return errorResult("Error: VIBEN_ACP_SESSION_ID is required for GUI_execute.");
  }
  // ... 原有代码 ...
}

// 添加解析函数
function parseActionName(action: string, callerClientId?: string): {
  targetClientId: string;
  namespace: string;
  name: string;
} {
  const parts = action.split(".");
  
  if (parts.length === 2) {
    if (!callerClientId) {
      throw new Error("Action must include client prefix for external agents");
    }
    return {
      targetClientId: callerClientId,
      namespace: parts[0],
      name: parts[1],
    };
  } else if (parts.length === 3) {
    return {
      targetClientId: parts[0],
      namespace: parts[1],
      name: parts[2],
    };
  }
  throw new Error(`Invalid action format: ${action}`);
}
```

- [ ] **Step 2: 修改 gui-action-mcp-server.ts 传入 clientStore**

```typescript
// 在 registerGuiActionMcpServerRoutes 函数签名中添加参数
export function registerGuiActionMcpServerRoutes(
  fastify: FastifyInstance,
  clientSocketServer: ClientSocketServer,  // 新增
  clientStore: ClientStore,  // 新增
  options: GuiActionMcpRoutesOptions = {},
): void {
  const createServer = options.createServer ?? ((sessionId: string, callerClientId?: string) =>
    createClientSideMcpServer({
      sessionId,
      callerClientId,
      clientStoreExecutor: {
        executeAction: (targetClientId, namespace, name, payload, context) =>
          clientSocketServer.executeAction(targetClientId, namespace, name, payload, context),
        getAllActions: () => clientStore.getAllActions(),
      },
      requestClientTool: ({ sessionId: sid, toolName, input, toolCallId }) =>
        acpSessionManager.requestClientTool(sid, toolName, input, toolCallId),
    }));
  
  // ... 在 POST handler 中获取 x-viben-client-id header ...
  const callerClientId = request.headers["x-viben-client-id"] as string | undefined;
  const server = createServer(acpSessionId, callerClientId);
  // ...
}
```

- [ ] **Step 3: 运行类型检查**

```bash
cd packages/core && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/acp/ops/client-side-mcp-server.ts packages/core/src/gateway/routes/mcp-server/gui-action-mcp-server.ts
git commit -m "feat(mcp): integrate ClientStore for action routing"
```

---

## Task 6: 实现 viben-page-sdk.ts

**Files:**
- Create: `packages/core/src/assets/viben-page-sdk.ts`
- Create: `packages/core/scripts/build-page-sdk.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: 创建 SDK TypeScript 源码**

```typescript
// packages/core/src/assets/viben-page-sdk.ts
import { io, Socket } from "socket.io-client";

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";
type Theme = "light" | "dark";
type SocketSource = "main_window" | "page_iframe" | "chat_window" | "standalone";

interface VibenConfig {
  gatewayUrl: string;
  clientId: string;
  theme?: Theme;
  workspacePath?: string;
  source?: SocketSource;
  pageSlug?: string;
}

interface ActionDef {
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: (payload: unknown, context: ExecuteContext) => Promise<ActionResult>;
}

interface ExecuteContext {
  sessionId: string;
  toolUseId: string;
  source: string;
  requireApproval: (message: string, options?: { timeout?: number }) => Promise<boolean>;
}

interface ActionResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface RegisteredAction {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: ActionDef["execute"];
}

class VibenPageSDK {
  private socket: Socket | null = null;
  private config: VibenConfig | null = null;
  private _state: ConnectionState = "disconnected";
  private _theme: Theme = "light";
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private themeListeners: Set<(theme: Theme) => void> = new Set();
  private registeredActions: Map<string, RegisteredAction> = new Map();
  private pendingApprovals: Map<string, { resolve: (approved: boolean) => void; reject: (err: Error) => void }> = new Map();
  private readyResolve: ((value: boolean) => void) | null = null;
  private readyReject: ((err: Error) => void) | null = null;

  readonly ready: Promise<boolean>;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.init();
  }

  private init(): void {
    const config = (window as { __VIBEN_CONFIG__?: VibenConfig }).__VIBEN_CONFIG__;
    if (!config) {
      this.readyReject?.(new Error("config_missing: window.__VIBEN_CONFIG__ not set"));
      return;
    }

    this.config = config;
    this._theme = config.theme ?? "light";
    this.connect();
  }

  private connect(): void {
    if (!this.config) return;

    this._state = "connecting";
    this.notifyStateChange();

    const url = this.config.gatewayUrl.replace(/\/$/, "");
    this.socket = io(url, {
      path: "/socket.io/client",
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on("connect", () => {
      this.socket!.emit("client:connect", {
        clientId: this.config!.clientId,
        source: this.config!.source ?? this.detectSource(),
        pageSlug: this.config!.pageSlug,
      }, (ack: { success: boolean; error?: string }) => {
        if (ack.success) {
          this._state = "connected";
          this.notifyStateChange();
          this.readyResolve?.(true);
          this.reregisterActions();
        } else {
          this.readyReject?.(new Error(ack.error ?? "Connection failed"));
        }
      });
    });

    this.socket.on("disconnect", () => {
      this._state = "disconnected";
      this.notifyStateChange();
    });

    this.socket.on("reconnecting", () => {
      this._state = "reconnecting";
      this.notifyStateChange();
    });

    this.socket.on("client:init", (data: { theme: Theme; workspacePath: string }) => {
      if (data.theme !== this._theme) {
        this._theme = data.theme;
        this.notifyThemeChange();
      }
    });

    this.socket.on("client:theme", (data: { theme: Theme }) => {
      if (data.theme !== this._theme) {
        this._theme = data.theme;
        this.notifyThemeChange();
      }
    });

    this.socket.on("action:execute", async (data: {
      requestId: string;
      namespace: string;
      action: string;
      payload: unknown;
      context: { sessionId: string; toolUseId: string; source: string };
    }) => {
      await this.handleExecute(data);
    });

    this.socket.on("action:approval:result", (data: {
      requestId: string;
      approved: boolean;
      error?: string;
    }) => {
      const pending = this.pendingApprovals.get(data.requestId);
      if (pending) {
        this.pendingApprovals.delete(data.requestId);
        if (data.error) {
          pending.reject(new Error(data.error));
        } else {
          pending.resolve(data.approved);
        }
      }
    });
  }

  private detectSource(): SocketSource {
    if (window.parent !== window) {
      return "page_iframe";
    }
    return "standalone";
  }

  private notifyStateChange(): void {
    for (const listener of this.stateListeners) {
      listener(this._state);
    }
  }

  private notifyThemeChange(): void {
    document.documentElement.classList.toggle("dark", this._theme === "dark");
    for (const listener of this.themeListeners) {
      listener(this._theme);
    }
  }

  private reregisterActions(): void {
    const byNamespace = new Map<string, Record<string, Omit<ActionDef, "execute">>>();
    
    for (const action of this.registeredActions.values()) {
      if (!byNamespace.has(action.namespace)) {
        byNamespace.set(action.namespace, {});
      }
      byNamespace.get(action.namespace)![action.name] = {
        description: action.description,
        inputSchema: action.inputSchema,
        outputSchema: action.outputSchema,
      };
    }

    for (const [namespace, actions] of byNamespace) {
      this.socket?.emit("action:register", { namespace, actions });
    }
  }

  private async handleExecute(data: {
    requestId: string;
    namespace: string;
    action: string;
    payload: unknown;
    context: { sessionId: string; toolUseId: string; source: string };
  }): Promise<void> {
    const fullName = `${data.namespace}.${data.action}`;
    const action = this.registeredActions.get(fullName);

    if (!action) {
      this.socket?.emit("action:result", {
        requestId: data.requestId,
        result: {
          content: [{ type: "text", text: `Action not found: ${fullName}` }],
          isError: true,
        },
      });
      return;
    }

    const context: ExecuteContext = {
      sessionId: data.context.sessionId,
      toolUseId: data.context.toolUseId,
      source: data.context.source,
      requireApproval: (message, options) => this.requestApproval(data.requestId, message, options),
    };

    try {
      const result = await action.execute(data.payload, context);
      this.socket?.emit("action:result", {
        requestId: data.requestId,
        result,
      });
    } catch (error) {
      this.socket?.emit("action:result", {
        requestId: data.requestId,
        result: {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
          isError: true,
        },
      });
    }
  }

  private requestApproval(executeRequestId: string, message: string, options?: { timeout?: number }): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      
      const timeout = options?.timeout ?? 30000;
      const timer = setTimeout(() => {
        this.pendingApprovals.delete(requestId);
        reject(new Error("approval_timeout"));
      }, timeout);

      this.pendingApprovals.set(requestId, {
        resolve: (approved) => {
          clearTimeout(timer);
          resolve(approved);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.socket?.emit("action:approval:request", {
        requestId,
        executeRequestId,
        message,
        options,
      });
    });
  }

  // Public API

  get state(): ConnectionState {
    return this._state;
  }

  get theme(): Theme {
    return this._theme;
  }

  get clientId(): string {
    return this.config?.clientId ?? "";
  }

  get workspacePath(): string | null {
    return this.config?.workspacePath ?? null;
  }

  get gatewayUrl(): string {
    return this.config?.gatewayUrl ?? "";
  }

  onStateChange(fn: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  onThemeChange(fn: (theme: Theme) => void): () => void {
    this.themeListeners.add(fn);
    return () => this.themeListeners.delete(fn);
  }

  actions = {
    register: (namespace: string, actions: Record<string, ActionDef>): () => void => {
      const actionsToRegister: Record<string, Omit<ActionDef, "execute">> = {};

      for (const [name, def] of Object.entries(actions)) {
        const fullName = `${namespace}.${name}`;
        this.registeredActions.set(fullName, {
          namespace,
          name,
          description: def.description,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          execute: def.execute,
        });
        actionsToRegister[name] = {
          description: def.description,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
        };
      }

      if (this._state === "connected") {
        this.socket?.emit("action:register", { namespace, actions: actionsToRegister });
      }

      return () => this.actions.unregister(namespace);
    },

    unregister: (namespace?: string): void => {
      if (namespace) {
        for (const [fullName, action] of this.registeredActions) {
          if (action.namespace === namespace) {
            this.registeredActions.delete(fullName);
          }
        }
      } else {
        this.registeredActions.clear();
      }

      if (this._state === "connected") {
        this.socket?.emit("action:unregister", { namespace });
      }
    },

    list: (): Array<{ namespace: string; name: string; description: string }> => {
      return Array.from(this.registeredActions.values()).map((a) => ({
        namespace: a.namespace,
        name: a.name,
        description: a.description,
      }));
    },

    call: async (action: string, payload: unknown): Promise<ActionResult> => {
      // TODO: Implement cross-action call via Gateway
      throw new Error("Not implemented");
    },
  };
}

// Create and export singleton
const vibenPage = new VibenPageSDK();
(window as { VibenPage?: VibenPageSDK }).VibenPage = vibenPage;

export { vibenPage as VibenPage };
export type { VibenPageSDK, ActionDef, ActionResult, ExecuteContext };
```

- [ ] **Step 2: 创建构建脚本**

```typescript
// packages/core/scripts/build-page-sdk.ts
import { build } from "esbuild";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");

await build({
  entryPoints: [resolve(rootDir, "src/assets/viben-page-sdk.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "VibenPageSDK",
  outfile: resolve(rootDir, "dist/assets/viben-page-sdk.js"),
  platform: "browser",
  target: ["es2020"],
  external: [],
});

console.log("viben-page-sdk.js built successfully");
```

- [ ] **Step 3: 更新 package.json**

在 `packages/core/package.json` 的 scripts 中添加：

```json
{
  "scripts": {
    "build:page-sdk": "tsx scripts/build-page-sdk.ts",
    "build": "tsup && pnpm build:page-sdk"
  }
}
```

- [ ] **Step 4: 构建并验证**

```bash
cd packages/core && pnpm build:page-sdk
ls -la dist/assets/viben-page-sdk.js
```

Expected: 文件存在，大小约 50-100KB

- [ ] **Step 5: 删除旧的 JS 文件**

```bash
rm packages/core/assets/viben-page-sdk.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/assets/viben-page-sdk.ts packages/core/scripts/build-page-sdk.ts packages/core/package.json
git rm packages/core/assets/viben-page-sdk.js
git commit -m "feat(sdk): rewrite viben-page-sdk in TypeScript with Socket.io"
```

---

## Task 7: Desktop App 集成

**Files:**
- Create: `apps/desktop/src/stores/client-id-store.ts`
- Modify: `apps/desktop/src/pages/apps/components/static-page-preview.tsx`
- Delete: `apps/desktop/src/pages/apps/components/page-action-bridge.ts`

- [ ] **Step 1: 创建 client-id-store**

```typescript
// apps/desktop/src/stores/client-id-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ClientIdState {
  clientId: string;
  getOrCreateClientId: () => string;
}

function generateClientId(): string {
  return `client_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export const useClientIdStore = create<ClientIdState>()(
  persist(
    (set, get) => ({
      clientId: "",
      getOrCreateClientId: () => {
        let id = get().clientId;
        if (!id) {
          id = generateClientId();
          set({ clientId: id });
        }
        return id;
      },
    }),
    {
      name: "viben-client-id",
    }
  )
);

// Helper to get client id synchronously (for injection)
export function getClientId(): string {
  return useClientIdStore.getState().getOrCreateClientId();
}
```

- [ ] **Step 2: 修改 static-page-preview.tsx**

```typescript
// apps/desktop/src/pages/apps/components/static-page-preview.tsx
// 移除以下 import:
// import { useActionStore } from "@/stores/action-store";
// import { createPageActionBridge, type PageActionBridge } from "./page-action-bridge";

// 添加新的 import:
import { getClientId } from "@/stores/client-id-store";

// 移除以下代码:
// const iframeRef = useRef<HTMLIFrameElement>(null);
// const bridgeRef = useRef<PageActionBridge | null>(null);
// const currentBridgeKeyRef = useRef<string | null>(null);
// const resolvedThemeRef = useRef(resolvedTheme);
// const registerActions = useActionStore((s) => s.register);
// const unregisterActions = useActionStore((s) => s.unregister);
// const gatewayOrigin = useMemo(() => { ... });
// const disposeBridge = useCallback(...);
// useEffect(() => { return () => disposeBridge(...) }, ...);
// useEffect(() => { resolvedThemeRef.current = ...; bridgeRef.current?.updateTheme(...) }, ...);
// const bindIframe = useCallback(...);

// 替换为新的注入逻辑:
const iframeRef = useRef<HTMLIFrameElement>(null);

const injectConfig = useCallback(() => {
  const iframe = iframeRef.current;
  if (!iframe?.contentWindow) return;
  
  try {
    (iframe.contentWindow as { __VIBEN_CONFIG__?: unknown }).__VIBEN_CONFIG__ = {
      gatewayUrl: getGatewayUrl(),
      clientId: getClientId(),
      theme: resolvedTheme,
      workspacePath,
      source: "page_iframe",
      pageSlug: page.slug,
    };
  } catch {
    // Cross-origin frame, config will be injected via URL params as fallback
  }
}, [resolvedTheme, workspacePath, page.slug]);

// 在 iframe 渲染部分:
// 替换 ref={bindIframe} 为 ref={iframeRef}
// 替换 onLoad 为:
onLoad={() => injectConfig()}
```

- [ ] **Step 3: 删除 page-action-bridge.ts**

```bash
git rm apps/desktop/src/pages/apps/components/page-action-bridge.ts
```

- [ ] **Step 4: 运行类型检查**

```bash
cd apps/desktop && pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/stores/client-id-store.ts apps/desktop/src/pages/apps/components/static-page-preview.tsx
git rm apps/desktop/src/pages/apps/components/page-action-bridge.ts
git commit -m "feat(desktop): integrate Socket.io SDK, remove PageActionBridge"
```

---

## Task 8: 端到端测试

**Files:** None (manual testing)

- [ ] **Step 1: 构建所有包**

```bash
pnpm build
```

- [ ] **Step 2: 启动 Gateway**

```bash
pnpm gateway:restart
```

验证日志显示:
```
[Gateway] Client Socket.io server started
```

- [ ] **Step 3: 启动 Desktop App**

```bash
pnpm desktop:dev
```

- [ ] **Step 4: 打开 canvas page**

1. 在 desktop app 中打开 canvas page
2. 打开 DevTools → Network → WS
3. 验证有 `/socket.io/client` 连接
4. Console 应无错误

- [ ] **Step 5: 测试 action 注册**

Gateway 日志应显示:
```
[ClientStore] Action registered: client_xxx.canvas.create_node
```

- [ ] **Step 6: 测试 action 调用（可选）**

通过 MCP Inspector 或 AcpChat 调用 `canvas.create_node`，验证节点创建成功。

- [ ] **Step 7: Commit 最终状态**

```bash
git add -A
git commit -m "test: verify Socket.io integration working"
```

---

## 总结

完成以上 8 个 Task 后，将实现：

1. ✅ Gateway 端 ClientStore 管理 client 和 action
2. ✅ Socket.io Server 处理连接和事件
3. ✅ MCP Server 通过 ClientStore 路由 action 调用
4. ✅ viben-page-sdk.ts 使用 Socket.io 连接
5. ✅ Desktop app 注入配置，移除 PageActionBridge
6. ✅ 端到端验证通过
