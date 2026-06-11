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
| `packages/core/src/utils/crypto.ts` | Ed25519 签名/验证工具 |
| `packages/core/src/gateway/client-store.ts` | ClientState 数据结构、action CRUD、查找逻辑、签名验证 |
| `packages/core/src/gateway/client-socket-server.ts` | Socket.io Server 初始化、事件处理、速率限制、payload校验 |
| `packages/core/src/assets/viben-page-sdk.ts` | SDK TypeScript 源码（含 Ed25519 签名） |
| `packages/core/scripts/build-page-sdk.ts` | esbuild 打包脚本 |
| `apps/desktop/src/stores/client-id-store.ts` | Zustand store，持久化 client identity（含密钥对） |

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
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: 添加 packages/core 依赖**

```bash
cd packages/core && pnpm add socket.io socket.io-client @noble/ed25519
```

- [ ] **Step 2: 添加 apps/desktop 依赖**

```bash
cd apps/desktop && pnpm add @noble/ed25519
```

- [ ] **Step 3: 验证依赖安装**

```bash
cd packages/core && pnpm list socket.io socket.io-client @noble/ed25519
cd apps/desktop && pnpm list @noble/ed25519
```

Expected: 显示所有依赖版本

- [ ] **Step 4: Commit**

```bash
git add packages/core/package.json apps/desktop/package.json pnpm-lock.yaml
git commit -m "chore: add socket.io and ed25519 dependencies"
```

---

## Task 2: 实现 Crypto 工具模块

**Files:**
- Create: `packages/core/src/utils/crypto.ts`
- Create: `packages/core/src/utils/crypto.test.ts`

- [ ] **Step 1: 写测试 - Ed25519 签名验证**

```typescript
// packages/core/src/utils/crypto.test.ts
import { describe, it, expect } from "vitest";
import { generateKeyPair, sign, verify } from "./crypto";

describe("crypto", () => {
  describe("generateKeyPair", () => {
    it("should generate valid Ed25519 key pair", () => {
      const { publicKey, privateKey } = generateKeyPair();
      
      expect(publicKey).toBeDefined();
      expect(privateKey).toBeDefined();
      expect(publicKey).toHaveLength(64);  // hex encoded 32 bytes
      expect(privateKey).toHaveLength(128); // hex encoded 64 bytes
    });
  });

  describe("sign and verify", () => {
    it("should sign and verify message", async () => {
      const { publicKey, privateKey } = generateKeyPair();
      const message = "test message";
      
      const signature = await sign(message, privateKey);
      const valid = await verify(message, signature, publicKey);
      
      expect(valid).toBe(true);
    });

    it("should reject tampered message", async () => {
      const { publicKey, privateKey } = generateKeyPair();
      const message = "test message";
      
      const signature = await sign(message, privateKey);
      const valid = await verify("tampered message", signature, publicKey);
      
      expect(valid).toBe(false);
    });

    it("should reject wrong public key", async () => {
      const keyPair1 = generateKeyPair();
      const keyPair2 = generateKeyPair();
      const message = "test message";
      
      const signature = await sign(message, keyPair1.privateKey);
      const valid = await verify(message, signature, keyPair2.publicKey);
      
      expect(valid).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 实现 crypto 模块**

```typescript
// packages/core/src/utils/crypto.ts
import { createPublicKey, createPrivateKey, sign as cryptoSign, verify as cryptoVerify, generateKeyPairSync } from "node:crypto";

export interface KeyPair {
  publicKey: string;   // hex encoded
  privateKey: string;  // hex encoded
}

/**
 * 生成 Ed25519 密钥对
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  
  return {
    publicKey: publicKey.toString("hex"),
    privateKey: privateKey.toString("hex"),
  };
}

/**
 * 使用私钥签名消息
 */
export async function sign(message: string, privateKeyHex: string): Promise<string> {
  const privateKeyDer = Buffer.from(privateKeyHex, "hex");
  const privateKey = createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "pkcs8",
  });
  
  const signature = cryptoSign(null, Buffer.from(message), privateKey);
  return signature.toString("hex");
}

/**
 * 使用公钥验证签名
 */
export async function verify(message: string, signatureHex: string, publicKeyHex: string): Promise<boolean> {
  try {
    const publicKeyDer = Buffer.from(publicKeyHex, "hex");
    const publicKey = createPublicKey({
      key: publicKeyDer,
      format: "der",
      type: "spki",
    });
    
    const signature = Buffer.from(signatureHex, "hex");
    return cryptoVerify(null, Buffer.from(message), publicKey, signature);
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: 运行测试确认通过**

```bash
cd packages/core && pnpm test src/utils/crypto.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/utils/crypto.ts packages/core/src/utils/crypto.test.ts
git commit -m "feat(core): add Ed25519 crypto utilities for client authentication"
```

---

## Task 3: 实现 ClientStore

**Files:**
- Create: `packages/core/src/gateway/client-store.ts`
- Create: `packages/core/src/gateway/client-store.test.ts`

- [ ] **Step 1: 写测试 - ClientStore 基本功能**

```typescript
// packages/core/src/gateway/client-store.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ClientStore } from "./client-store";

// Mock crypto 模块
vi.mock("../utils/crypto", () => ({
  verify: vi.fn().mockResolvedValue(true),
  sign: vi.fn().mockResolvedValue("mock_signature"),
  generateKeyPair: vi.fn().mockReturnValue({
    publicKey: "mock_public_key",
    privateKey: "mock_private_key",
  }),
}));

// 测试辅助函数
function createMockRegisterOptions(socketId: string, source: "main_window" | "page_iframe" = "main_window") {
  return {
    source,
    socketId,
    publicKey: "mock_public_key",
    signature: "mock_signature",
    timestamp: Date.now(),
  };
}

describe("ClientStore", () => {
  let store: ClientStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ClientStore({ gracePeriodMs: 1000 });  // 1秒 grace period 便于测试
  });

  afterEach(() => {
    store.shutdown();
    vi.useRealTimers();
  });

  describe("client management", () => {
    it("should register a new client with signature verification", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      
      const client = store.getClient("client_abc");
      expect(client).toBeDefined();
      expect(client?.sockets.size).toBe(1);
      expect(client?.publicKey).toBe("mock_public_key");
    });

    it("should reject client with mismatched public key", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      
      await expect(
        store.registerClient("client_abc", {
          ...createMockRegisterOptions("socket_2"),
          publicKey: "different_key",
        })
      ).rejects.toThrow("Public key mismatch");
    });

    it("should add socket to existing client", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      await store.registerClient("client_abc", {
        ...createMockRegisterOptions("socket_2"),
        source: "page_iframe",
        pageSlug: "canvas",
      });
      
      const client = store.getClient("client_abc");
      expect(client?.sockets.size).toBe(2);
    });

    it("should start grace period when all sockets disconnect", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      
      store.removeSocket("client_abc", "socket_1");
      
      // Client 还在（grace period 内）
      expect(store.getClient("client_abc")).toBeDefined();
      
      // 等待 grace period 结束
      vi.advanceTimersByTime(1500);
      
      // Client 被清理
      expect(store.getClient("client_abc")).toBeUndefined();
    });

    it("should cancel grace period when new socket connects", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      store.removeSocket("client_abc", "socket_1");
      
      // Grace period 期间新 socket 连接
      vi.advanceTimersByTime(500);
      await store.registerClient("client_abc", createMockRegisterOptions("socket_2"));
      
      // 等待原 grace period 时间
      vi.advanceTimersByTime(1000);
      
      // Client 仍然存在
      expect(store.getClient("client_abc")).toBeDefined();
    });
  });

  describe("action management", () => {
    it("should register action for a socket", async () => {
      await store.registerClient("client_abc", {
        ...createMockRegisterOptions("socket_1"),
        source: "page_iframe",
        pageSlug: "canvas",
      });
      
      const result = store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });
      
      expect(result.updated).toBe(true);
      const action = store.findAction("client_abc", "canvas", "create_node");
      expect(action).toBeDefined();
      expect(action?.socketId).toBe("socket_1");
    });

    it("should support custom timeout per action", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      
      store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "slow_action",
        description: "A slow action",
        timeout: 60000,  // 60秒超时
      });
      
      const action = store.findAction("client_abc", "canvas", "slow_action");
      expect(action?.timeout).toBe(60000);
    });

    it("should enforce max actions limit", async () => {
      const limitedStore = new ClientStore({ maxActionsPerClient: 2 });
      await limitedStore.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      
      limitedStore.registerAction("client_abc", "socket_1", {
        namespace: "ns", name: "a1", description: "Action 1",
      });
      limitedStore.registerAction("client_abc", "socket_1", {
        namespace: "ns", name: "a2", description: "Action 2",
      });
      
      const result = limitedStore.registerAction("client_abc", "socket_1", {
        namespace: "ns", name: "a3", description: "Action 3",
      });
      
      expect(result.error).toBe("Max actions limit reached");
      expect(result.updated).toBe(false);
      
      limitedStore.shutdown();
    });

    it("should be idempotent - same content skips update", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      
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

    it("should preserve actions during grace period", async () => {
      await store.registerClient("client_abc", createMockRegisterOptions("socket_1"));
      store.registerAction("client_abc", "socket_1", {
        namespace: "canvas",
        name: "create_node",
        description: "Create a node",
      });
      
      store.removeSocket("client_abc", "socket_1");
      
      // Grace period 内 action 仍可查找
      expect(store.findAction("client_abc", "canvas", "create_node")).toBeDefined();
      
      // Grace period 结束后
      vi.advanceTimersByTime(1500);
      expect(store.findAction("client_abc", "canvas", "create_node")).toBeUndefined();
    });
  });

  describe("getAllActions", () => {
    it("should return all actions across clients", async () => {
      await store.registerClient("client_a", createMockRegisterOptions("s1"));
      await store.registerClient("client_b", {
        ...createMockRegisterOptions("s2"),
        publicKey: "mock_public_key_b",
      });
      
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

// === 配置常量 ===
const DEFAULT_GRACE_PERIOD_MS = 30000;  // socket 断开后保留 action 的时间
const MAX_ACTIONS_PER_CLIENT = 1000;    // 每个 client 最大 action 数
const MAX_PAYLOAD_SIZE = 1024 * 1024;   // 1MB payload 上限

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
  timeout?: number;  // action 自定义超时时间（ms）
}

export interface ClientState {
  clientId: string;
  publicKey: string;  // Ed25519 公钥，用于验证签名
  sockets: Map<string, SocketInfo>;
  actionStore: Map<string, ActionEntry>;
  metadata: {
    theme: "light" | "dark";
    workspacePath: string;
  };
  // Grace period 支持
  disconnectTimer?: NodeJS.Timeout;  // 所有 socket 断开后的清理计时器
}

export interface RegisterClientOptions {
  source: SocketSource;
  socketId: string;
  pageSlug?: string;
  theme?: "light" | "dark";
  workspacePath?: string;
  publicKey: string;      // 必须提供公钥
  signature: string;      // clientId 的签名，用于验证所有权
  timestamp: number;      // 签名时间戳，防止重放
}

export interface RegisterActionOptions {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
  timeout?: number;  // 可选的自定义超时时间（ms），默认 30000
}

export interface ActionWithClient extends ActionEntry {
  clientId: string;
}

export interface ClientStoreConfig {
  gracePeriodMs?: number;
  maxActionsPerClient?: number;
  maxPayloadSize?: number;
}

function fnv1aHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function computeActionHash(clientId: string, action: RegisterActionOptions): string {
  // 包含 clientId 避免跨 client 碰撞
  const content = clientId +
    action.namespace +
    action.name +
    action.description +
    JSON.stringify(action.inputSchema ?? null) +
    JSON.stringify(action.outputSchema ?? null);
  return fnv1aHash(content);
}

export class ClientStore {
  private clients = new Map<string, ClientState>();
  private readonly config: Required<ClientStoreConfig>;

  constructor(config: ClientStoreConfig = {}) {
    this.config = {
      gracePeriodMs: config.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS,
      maxActionsPerClient: config.maxActionsPerClient ?? MAX_ACTIONS_PER_CLIENT,
      maxPayloadSize: config.maxPayloadSize ?? MAX_PAYLOAD_SIZE,
    };
  }

  getClient(clientId: string): ClientState | undefined {
    return this.clients.get(clientId);
  }

  /**
   * 验证 clientId 的签名
   * 签名格式：sign(clientId + ":" + timestamp)
   */
  private async verifySignature(
    clientId: string,
    publicKey: string,
    signature: string,
    timestamp: number
  ): Promise<boolean> {
    // 检查时间戳是否在 5 分钟内（防止重放攻击）
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      log.warn({ clientId, timestamp, now }, "Signature timestamp expired");
      return false;
    }

    try {
      const { verify } = await import("../utils/crypto");
      const message = `${clientId}:${timestamp}`;
      return await verify(message, signature, publicKey);
    } catch (error) {
      log.error({ clientId, error }, "Signature verification failed");
      return false;
    }
  }

  async registerClient(clientId: string, options: RegisterClientOptions): Promise<ClientState> {
    let client = this.clients.get(clientId);
    
    if (!client) {
      // 新 client：验证签名
      const valid = await this.verifySignature(
        clientId,
        options.publicKey,
        options.signature,
        options.timestamp
      );
      if (!valid) {
        throw new Error("Invalid signature for clientId");
      }

      client = {
        clientId,
        publicKey: options.publicKey,
        sockets: new Map(),
        actionStore: new Map(),
        metadata: {
          theme: options.theme ?? "light",
          workspacePath: options.workspacePath ?? "",
        },
      };
      this.clients.set(clientId, client);
      log.info({ clientId }, "Client registered");
    } else {
      // 已有 client：验证公钥匹配
      if (client.publicKey !== options.publicKey) {
        throw new Error("Public key mismatch for existing client");
      }
      // 验证签名
      const valid = await this.verifySignature(
        clientId,
        options.publicKey,
        options.signature,
        options.timestamp
      );
      if (!valid) {
        throw new Error("Invalid signature for clientId");
      }

      // 取消 grace period 计时器（有新连接进来）
      if (client.disconnectTimer) {
        clearTimeout(client.disconnectTimer);
        client.disconnectTimer = undefined;
        log.info({ clientId }, "Grace period cancelled (new socket connected)");
      }
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

  removeSocket(clientId: string, socketId: string): { actionsRemoved: string[]; clientRemoved: boolean } {
    const client = this.clients.get(clientId);
    if (!client) return { actionsRemoved: [], clientRemoved: false };

    client.sockets.delete(socketId);
    log.info({ clientId, socketId }, "Socket removed from client");

    // 标记该 socket 注册的 actions（但先不删除，等 grace period）
    const actionsFromSocket: string[] = [];
    for (const [fullName, action] of client.actionStore) {
      if (action.socketId === socketId) {
        actionsFromSocket.push(fullName);
      }
    }

    // 如果还有其他 socket，立即清理该 socket 的 actions
    if (client.sockets.size > 0) {
      for (const fullName of actionsFromSocket) {
        client.actionStore.delete(fullName);
        log.info({ clientId, action: fullName }, "Action removed (socket disconnected)");
      }
      return { actionsRemoved: actionsFromSocket, clientRemoved: false };
    }

    // 所有 socket 都断开了，启动 grace period
    log.info({ clientId, gracePeriodMs: this.config.gracePeriodMs }, "All sockets disconnected, starting grace period");
    
    client.disconnectTimer = setTimeout(() => {
      // Grace period 结束，清理 client
      const removedClient = this.clients.get(clientId);
      if (removedClient && removedClient.sockets.size === 0) {
        this.clients.delete(clientId);
        log.info({ clientId, actionsRemoved: Array.from(removedClient.actionStore.keys()) }, 
          "Client removed after grace period");
      }
    }, this.config.gracePeriodMs);

    return { actionsRemoved: [], clientRemoved: false };
  }

  registerAction(
    clientId: string,
    socketId: string,
    action: RegisterActionOptions
  ): { updated: boolean; fullName: string; error?: string } {
    const client = this.clients.get(clientId);
    if (!client) {
      return { updated: false, fullName: "", error: `Client not found: ${clientId}` };
    }

    // 检查 action 数量限制
    if (client.actionStore.size >= this.config.maxActionsPerClient) {
      log.warn({ clientId, count: client.actionStore.size }, "Max actions limit reached");
      return { updated: false, fullName: "", error: "Max actions limit reached" };
    }

    const fullName = `${action.namespace}.${action.name}`;
    const hash = computeActionHash(clientId, action);
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
      timeout: action.timeout,
    };

    client.actionStore.set(fullName, entry);
    log.info({ clientId, action: fullName, socketId, timeout: action.timeout }, "Action registered");

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

  getConfig(): Required<ClientStoreConfig> {
    return { ...this.config };
  }

  /**
   * 清理所有 grace period 计时器（用于 shutdown）
   */
  shutdown(): void {
    for (const client of this.clients.values()) {
      if (client.disconnectTimer) {
        clearTimeout(client.disconnectTimer);
      }
    }
    this.clients.clear();
    log.info("ClientStore shut down");
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

## Task 4: 实现 ClientSocketServer

**Files:**
- Create: `packages/core/src/gateway/client-socket-server.ts`

- [ ] **Step 1: 实现 ClientSocketServer**

```typescript
// packages/core/src/gateway/client-socket-server.ts
import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import type { JSONSchema7 } from "json-schema";
import { jsonSchemaToZod } from "@viben/json-schema-to-zod";
import { ClientStore, type SocketSource, type ClientStoreConfig } from "./client-store";
import { logger as globalLogger } from "../telemetry";

const log = globalLogger.child({ module: "client-socket-server" });

const SOCKET_IO_PATH = "/socket.io/client";
const DEFAULT_EXECUTE_TIMEOUT_MS = 30000;
const REQUEST_ID_TTL_MS = 60000;
const MAX_PAYLOAD_SIZE = 1024 * 1024;  // 1MB
const RATE_LIMIT_WINDOW_MS = 1000;     // 1秒窗口
const RATE_LIMIT_MAX_EVENTS = 100;     // 每秒最多 100 个事件

export type ExecuteSource = SocketSource | "mcp";

interface ClientConnectData {
  clientId: string;
  source: SocketSource;
  pageSlug?: string;
  publicKey: string;
  signature: string;
  timestamp: number;
}

// 速率限制追踪
interface RateLimitInfo {
  count: number;
  windowStart: number;
}

interface ActionRegisterData {
  namespace: string;
  actions: Record<string, {
    description: string;
    inputSchema?: JSONSchema7;
    outputSchema?: JSONSchema7;
    timeout?: number;  // 可选的自定义超时
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
  private rateLimits = new Map<string, RateLimitInfo>();  // socketId -> rate limit
  private cleanupTimer: NodeJS.Timeout | null = null;
  private schemaCache = new Map<string, ReturnType<typeof jsonSchemaToZod>>();  // 缓存编译后的 schema

  constructor(httpServer: HttpServer, clientStore: ClientStore) {
    this.clientStore = clientStore;
    this.io = new SocketIOServer(httpServer, {
      path: SOCKET_IO_PATH,
      cors: { origin: "*" },
      maxHttpBufferSize: MAX_PAYLOAD_SIZE,  // 限制 payload 大小
    });

    this.setupEventHandlers();
    this.startCleanup();
    log.info({ path: SOCKET_IO_PATH }, "ClientSocketServer initialized");
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(socketId: string): boolean {
    const now = Date.now();
    let info = this.rateLimits.get(socketId);
    
    if (!info || now - info.windowStart > RATE_LIMIT_WINDOW_MS) {
      // 新窗口
      info = { count: 1, windowStart: now };
      this.rateLimits.set(socketId, info);
      return true;
    }
    
    if (info.count >= RATE_LIMIT_MAX_EVENTS) {
      log.warn({ socketId, count: info.count }, "Rate limit exceeded");
      return false;
    }
    
    info.count++;
    return true;
  }

  /**
   * 使用 zod 校验 payload
   */
  private validatePayload(payload: unknown, schema: JSONSchema7 | undefined): { valid: boolean; error?: string } {
    if (!schema) return { valid: true };
    
    // 检查 payload 大小
    const payloadStr = JSON.stringify(payload);
    if (payloadStr.length > MAX_PAYLOAD_SIZE) {
      return { valid: false, error: `Payload too large: ${payloadStr.length} bytes (max: ${MAX_PAYLOAD_SIZE})` };
    }
    
    try {
      // 使用缓存的 schema
      const cacheKey = JSON.stringify(schema);
      let zodSchema = this.schemaCache.get(cacheKey);
      if (!zodSchema) {
        zodSchema = jsonSchemaToZod(schema);
        this.schemaCache.set(cacheKey, zodSchema);
      }
      
      const result = zodSchema.safeParse(payload);
      if (!result.success) {
        return { valid: false, error: result.error.message };
      }
      return { valid: true };
    } catch (error) {
      log.warn({ error }, "Schema validation error");
      return { valid: false, error: "Schema validation failed" };
    }
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket) => {
      log.debug({ socketId: socket.id }, "Socket connected");

      socket.on("client:connect", async (data: ClientConnectData, ack) => {
        if (!this.checkRateLimit(socket.id)) {
          ack?.({ success: false, error: "Rate limit exceeded" });
          return;
        }
        await this.handleClientConnect(socket, data, ack);
      });

      socket.on("action:register", (data: ActionRegisterData) => {
        if (!this.checkRateLimit(socket.id)) return;
        this.handleActionRegister(socket, data);
      });

      socket.on("action:unregister", (data: ActionUnregisterData) => {
        if (!this.checkRateLimit(socket.id)) return;
        this.handleActionUnregister(socket, data);
      });

      socket.on("action:result", (data: ActionResultData) => {
        if (!this.checkRateLimit(socket.id)) return;
        this.handleActionResult(data);
      });

      socket.on("disconnect", () => {
        this.handleDisconnect(socket);
        // 清理速率限制记录
        this.rateLimits.delete(socket.id);
      });
    });
  }

  private async handleClientConnect(
    socket: Socket,
    data: ClientConnectData,
    ack?: (response: { success: boolean; error?: string }) => void
  ): Promise<void> {
    if (!data.clientId || typeof data.clientId !== "string") {
      ack?.({ success: false, error: "clientId is required" });
      return;
    }

    if (!data.source) {
      ack?.({ success: false, error: "source is required" });
      return;
    }

    if (!data.publicKey || !data.signature || !data.timestamp) {
      ack?.({ success: false, error: "publicKey, signature, and timestamp are required" });
      return;
    }

    try {
      // 注册 client（内部会验证签名）
      const client = await this.clientStore.registerClient(data.clientId, {
        source: data.source,
        socketId: socket.id,
        pageSlug: data.pageSlug,
        publicKey: data.publicKey,
        signature: data.signature,
        timestamp: data.timestamp,
      });

      // Store clientId on socket for later use
      (socket as Socket & { clientId?: string }).clientId = data.clientId;

      // Join client room for broadcasting
      socket.join(`client:${data.clientId}`);

      // Send init（只有 main_window 才发送 workspacePath）
      const initData: { theme: string; workspacePath?: string } = {
        theme: client.metadata.theme,
      };
      if (data.source === "main_window") {
        initData.workspacePath = client.metadata.workspacePath;
      }
      socket.emit("client:init", initData);

      ack?.({ success: true });
      log.info({ clientId: data.clientId, socketId: socket.id, source: data.source }, "Client connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.warn({ clientId: data.clientId, error: message }, "Client connect failed");
      ack?.({ success: false, error: message });
    }
  }

  private handleActionRegister(socket: Socket, data: ActionRegisterData): void {
    const clientId = (socket as Socket & { clientId?: string }).clientId;
    if (!clientId) {
      log.warn({ socketId: socket.id }, "Action register without client connect");
      socket.emit("action:register:result", {
        namespace: data.namespace,
        accepted: [],
        rejected: [{ action: "*", reason: "Not connected as client" }],
      });
      return;
    }

    if (!data.namespace || typeof data.namespace !== "string") {
      log.warn({ clientId, socketId: socket.id }, "Invalid namespace");
      return;
    }

    const accepted: string[] = [];
    const rejected: Array<{ action: string; reason: string }> = [];

    for (const [name, actionDef] of Object.entries(data.actions || {})) {
      const result = this.clientStore.registerAction(clientId, socket.id, {
        namespace: data.namespace,
        name,
        description: actionDef.description,
        inputSchema: actionDef.inputSchema,
        outputSchema: actionDef.outputSchema,
        timeout: actionDef.timeout,
      });
      
      if (result.error) {
        rejected.push({ action: name, reason: result.error });
      } else {
        accepted.push(name);
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

    // Reject pending executes for this socket（使用 resolve 返回错误而非 reject，保持一致性）
    for (const [requestId, pending] of this.pendingExecutes) {
      if (pending.socketId === socket.id) {
        clearTimeout(pending.timer);
        this.pendingExecutes.delete(requestId);
        pending.resolve({
          content: [{ type: "text", text: "Socket disconnected during execution" }],
          isError: true,
        });
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

    // 校验 payload
    const validation = this.validatePayload(payload, action.inputSchema);
    if (!validation.valid) {
      return {
        content: [{ type: "text", text: `Invalid payload: ${validation.error}` }],
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

    // 使用 action 自定义超时或默认超时
    const timeoutMs = action.timeout ?? DEFAULT_EXECUTE_TIMEOUT_MS;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingExecutes.delete(requestId);
        resolve({
          content: [{ type: "text", text: `Execution timeout after ${timeoutMs}ms` }],
          isError: true,
        });
      }, timeoutMs);

      this.pendingExecutes.set(requestId, {
        requestId,
        clientId: targetClientId,
        socketId: action.socketId,
        resolve,
        reject: () => {},  // 不再使用 reject，统一用 resolve 返回错误
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
      
      // 清理过期的 requestId
      for (const [requestId, timestamp] of this.seenRequestIds) {
        if (now - timestamp > REQUEST_ID_TTL_MS) {
          this.seenRequestIds.delete(requestId);
        }
      }
      
      // 清理过期的速率限制记录
      for (const [socketId, info] of this.rateLimits) {
        if (now - info.windowStart > RATE_LIMIT_WINDOW_MS * 10) {
          this.rateLimits.delete(socketId);
        }
      }
    }, 60000);
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 清理所有 pending executes（使用 resolve 返回错误）
    for (const pending of this.pendingExecutes.values()) {
      clearTimeout(pending.timer);
      pending.resolve({
        content: [{ type: "text", text: "Server shutdown" }],
        isError: true,
      });
    }
    this.pendingExecutes.clear();
    this.rateLimits.clear();
    this.schemaCache.clear();

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

## Task 5: 集成到 Gateway

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

## Task 6: 修改 MCP Server 使用 ClientStore

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

## Task 7: 实现 viben-page-sdk.ts

**Files:**
- Create: `packages/core/src/assets/viben-page-sdk.ts`
- Create: `packages/core/scripts/build-page-sdk.ts`
- Modify: `packages/core/package.json`

- [ ] **Step 1: 创建 SDK TypeScript 源码**

```typescript
// packages/core/src/assets/viben-page-sdk.ts
import { io, Socket } from "socket.io-client";
import * as ed from "@noble/ed25519";

type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";
type Theme = "light" | "dark";
type SocketSource = "main_window" | "page_iframe" | "chat_window" | "standalone";

interface VibenConfig {
  gatewayUrl: string;
  clientId: string;
  publicKey: string;    // Ed25519 公钥 (hex)
  privateKey: string;   // Ed25519 私钥 (hex)
  theme?: Theme;
  workspacePath?: string;
  source?: SocketSource;
  pageSlug?: string;
}

// Ed25519 签名工具
async function signMessage(message: string, privateKeyHex: string): Promise<string> {
  const privateKey = hexToBytes(privateKeyHex);
  const messageBytes = new TextEncoder().encode(message);
  const signature = await ed.signAsync(messageBytes, privateKey);
  return bytesToHex(signature);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface ActionDef {
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeout?: number;  // 自定义超时时间（ms），默认 30000
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
  timeout?: number;
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

    this.socket.on("connect", async () => {
      try {
        // 生成带时间戳的签名
        const timestamp = Date.now();
        const message = `${this.config!.clientId}:${timestamp}`;
        const signature = await signMessage(message, this.config!.privateKey);
        
        this.socket!.emit("client:connect", {
          clientId: this.config!.clientId,
          source: this.config!.source ?? this.detectSource(),
          pageSlug: this.config!.pageSlug,
          publicKey: this.config!.publicKey,
          signature,
          timestamp,
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
      } catch (error) {
        this.readyReject?.(error instanceof Error ? error : new Error("Signature failed"));
      }
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
        timeout: action.timeout,
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
          timeout: def.timeout,
          execute: def.execute,
        });
        actionsToRegister[name] = {
          description: def.description,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          timeout: def.timeout,
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

## Task 8: Desktop App 集成

**Files:**
- Create: `apps/desktop/src/stores/client-id-store.ts`
- Modify: `apps/desktop/src/pages/apps/components/static-page-preview.tsx`
- Delete: `apps/desktop/src/pages/apps/components/page-action-bridge.ts`

- [ ] **Step 1: 创建 client-id-store（带密钥对）**

```typescript
// apps/desktop/src/stores/client-id-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as ed from "@noble/ed25519";

interface ClientIdentity {
  clientId: string;
  publicKey: string;   // hex
  privateKey: string;  // hex
}

interface ClientIdState {
  identity: ClientIdentity | null;
  getOrCreateIdentity: () => Promise<ClientIdentity>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function generateIdentity(): Promise<ClientIdentity> {
  // 生成 Ed25519 密钥对
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  
  // clientId 基于公钥的前 16 字节
  const clientId = `client_${bytesToHex(publicKey).slice(0, 16)}`;
  
  return {
    clientId,
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(privateKey),
  };
}

export const useClientIdStore = create<ClientIdState>()(
  persist(
    (set, get) => ({
      identity: null,
      getOrCreateIdentity: async () => {
        let identity = get().identity;
        if (!identity) {
          identity = await generateIdentity();
          set({ identity });
        }
        return identity;
      },
    }),
    {
      name: "viben-client-identity",
    }
  )
);

// 同步获取（如果已初始化）
export function getIdentitySync(): ClientIdentity | null {
  return useClientIdStore.getState().identity;
}

// 异步获取或创建
export async function getOrCreateIdentity(): Promise<ClientIdentity> {
  return useClientIdStore.getState().getOrCreateIdentity();
}
```

- [ ] **Step 2: 修改 static-page-preview.tsx**

```typescript
// apps/desktop/src/pages/apps/components/static-page-preview.tsx
// 移除以下 import:
// import { useActionStore } from "@/stores/action-store";
// import { createPageActionBridge, type PageActionBridge } from "./page-action-bridge";

// 添加新的 import:
import { getIdentitySync, getOrCreateIdentity, type ClientIdentity } from "@/stores/client-id-store";

// 移除以下代码:
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
const [identity, setIdentity] = useState<ClientIdentity | null>(getIdentitySync);

// 初始化时获取或创建 identity
useEffect(() => {
  if (!identity) {
    getOrCreateIdentity().then(setIdentity);
  }
}, [identity]);

const injectConfig = useCallback(() => {
  const iframe = iframeRef.current;
  if (!iframe?.contentWindow || !identity) return;
  
  try {
    (iframe.contentWindow as { __VIBEN_CONFIG__?: unknown }).__VIBEN_CONFIG__ = {
      gatewayUrl: getGatewayUrl(),
      clientId: identity.clientId,
      publicKey: identity.publicKey,
      privateKey: identity.privateKey,
      theme: resolvedTheme,
      workspacePath,
      source: "page_iframe",
      pageSlug: page.slug,
    };
  } catch {
    // Cross-origin frame - 不支持，SDK 会报错
    console.error("Cannot inject config into cross-origin iframe");
  }
}, [identity, resolvedTheme, workspacePath, page.slug]);

// 在 iframe 渲染部分:
// 替换 ref={bindIframe} 为 ref={iframeRef}
// 替换 onLoad 为:
onLoad={() => injectConfig()}
```

- [ ] **Step 3: 删除 page-action-bridge 相关文件**

```bash
git rm apps/desktop/src/pages/apps/components/page-action-bridge.ts
# 如果存在测试文件也一并删除
git rm -f apps/desktop/src/pages/apps/components/page-action-bridge.test.ts 2>/dev/null || true
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

## Task 9: 端到端测试

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

完成以上 9 个 Task 后，将实现：

1. ✅ **安全认证**：Ed25519 签名验证 clientId 所有权（防冒充）
2. ✅ **Grace Period**：socket 断开后保留 30 秒，避免短暂断线丢失 action
3. ✅ **速率限制**：每 socket 100 req/s，防 DoS
4. ✅ **Payload 校验**：Gateway 层用 zod 校验 inputSchema，限制 1MB
5. ✅ **可配置超时**：action 注册时可指定自定义 timeout
6. ✅ **Action 数量限制**：每 client 最多 1000 个 action
7. ✅ Gateway 端 ClientStore 管理 client 和 action
8. ✅ Socket.io Server 处理连接和事件
9. ✅ MCP Server 通过 ClientStore 路由 action 调用
10. ✅ viben-page-sdk.ts 使用 Socket.io 连接（含签名）
11. ✅ Desktop app 注入配置（含密钥对），移除 PageActionBridge
12. ✅ 端到端验证通过

### 安全特性

| 特性 | 实现方式 |
|------|----------|
| 认证 | Ed25519 签名验证 clientId 所有权 |
| 防重放 | 签名包含时间戳，5 分钟有效期 |
| 速率限制 | 每 socket 100 req/s |
| Payload 校验 | zod 校验 + 1MB 大小限制 |
| DoS 防护 | action 数量限制 (1000/client) |
| 敏感数据保护 | workspacePath 仅发给 main_window |
