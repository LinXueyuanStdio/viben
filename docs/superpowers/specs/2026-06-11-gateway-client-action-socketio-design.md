# Gateway Client Action Socket.io 中转设计

## Context

当前架构中，Page 通过 iframe 加载，使用 `postMessage` 与主窗口通信注册和执行 actions。存在以下问题：

1. **执行上下文问题**：iframe 和主窗口是不同的 JS 执行上下文，导致 `setTimeout` 等 API 的 `this` 绑定问题（"Can only call Window.setTimeout on instances of Window"）
2. **耦合性强**：PageActionBridge 必须在 desktop app 中运行，依赖 iframe 和 postMessage
3. **无法跨设备**：action-store 在前端，无法实现手机控制桌面
4. **action-store 分散**：每个 AcpChat 实例独立维护 action-store，无法共享

### 目标

使用 **Socket.io** 将 action-store 移到 Gateway，实现：
- 统一通信协议（完全移除 postMessage）
- 跨设备 action 调用（手机 agent → 桌面 page）
- 同一 client 多个连接（main window + page iframe + chat window）共享 action-store
- action 动态注册/注销，实时生效

### 决策

- **只用 Socket.io**：不保留 postMessage 双模式
- **action-store 在 Gateway**：所有 client 共享，按 clientId 分组
- **client id 是设备级别**：desktop app 启动时生成 UUID，所有 Page 共享

## 架构设计

### 整体架构

```
Gateway
  │
  ├── client-store (Map<clientId, ClientState>)
  │     │
  │     ├── client_desktop_abc (桌面设备)
  │     │     ├── sockets: Map<socketId, SocketInfo>
  │     │     ├── actionStore: Map<fullName, ActionEntry>
  │     │     └── metadata: { theme, workspacePath }
  │     │
  │     ├── client_web_xyz (网页)
  │     │     └── ...
  │     │
  │     └── client_mobile_123 (手机 - 可能只有 agent，无 page)
  │           └── ...
  │
  ├── Socket.io Server (path: /socket.io/client)
  │
  └── MCP Server (GUI_execute / list_actions)
        └── 通过 client-store 查找和调用 action
```

### 数据结构

```typescript
interface ClientState {
  clientId: string;
  sockets: Map<string, SocketInfo>;  // socketId -> SocketInfo
  actionStore: Map<string, ActionEntry>;  // fullName -> ActionEntry
  metadata: {
    theme: "light" | "dark";
    workspacePath: string;
  };
}

interface SocketInfo {
  socket: Socket;
  source: "main_window" | "page_iframe" | "chat_window" | "standalone";
  pageSlug?: string;
  connectedAt: number;
}

interface ActionEntry {
  namespace: string;
  name: string;
  description: string;
  inputSchema?: JSONSchema7;
  outputSchema?: JSONSchema7;
  socketId: string;  // 注册该 action 的 socket，用于路由和清理
  registeredAt: number;
  hash: string;  // 用于幂等性检查：hash(description + JSON.stringify(schemas))
}
```

### 调用流程

**完整调用链：**
```
AcpChat 
  → Gateway (ACP WebSocket)
  → ACP Backend (子进程)
  → MCP Server (GUI_execute tool)
  → client-store.findAction(actionName, callerClientId)
  → 找到目标 socket
  → socket.emit("action:execute", ...)
  → Page 执行 action
  → socket.emit("action:result", ...)
  → MCP Server 返回结果
  → ACP Backend 返回
  → AcpChat 显示结果
```

**action 注册流程：**
```
Page 加载
  → 读取 window.__VIBEN_CONFIG__
  → Socket.io 连接 Gateway
  → emit "client:connect"
  → Gateway 创建/更新 ClientState
  → emit "client:init" 返回配置
  → Page 调用 viben.actions.register()
  → emit "action:register"
  → Gateway diff 检查，更新 actionStore
```

### 跨设备场景

**场景 1：手机 agent 控制桌面 page**
```
手机 agent (header 无 client id 或 client id = mobile_xxx)
  → MCP list_actions
  → 返回：client_desktop_abc.canvas.create_node, client_desktop_abc.main.open_file, ...
  → MCP GUI_execute("client_desktop_abc.canvas.create_node", payload)
  → Gateway 解析 client id，路由到桌面
  → 桌面 canvas page 执行
```

**场景 2：桌面 agent 控制本机 page**
```
桌面 agent (header: x-viben-client-id: client_desktop_abc)
  → MCP list_actions
  → 返回：canvas.create_node (本机，无前缀), client_mobile_xxx.xxx (其他设备，带前缀)
  → MCP GUI_execute("canvas.create_node", payload)
  → Gateway 知道 caller 是 desktop_abc，直接在本 client 查找
```

**场景 3：外部 agent（如 VSCode Copilot）**
```
外部 agent (无 x-viben-client-id header)
  → MCP list_actions
  → 返回：client_desktop_abc.canvas.create_node, client_web_xyz.editor.save, ...（全部带前缀）
  → 必须指定完整 client 前缀才能调用
```

### client id 生命周期

- **Desktop app**：首次启动时生成 UUID，存储到 localStorage，后续启动复用
- **Web app**：每个浏览器 tab 是新的 client id（可选：用 localStorage 持久化）
- **Page iframe / chat window / main window**：共享同一个 client id（从主窗口获取）

## Socket.io 事件协议

### Client → Gateway

#### `client:connect` (带 ack callback)

连接时发送身份，Gateway 返回确认。

```typescript
socket.emit("client:connect", {
  clientId: string;
  source: "main_window" | "page_iframe" | "chat_window" | "standalone";
  pageSlug?: string;  // page_iframe 时标识是哪个 page
}, (ack: { success: boolean; error?: string }) => {
  // clientId 格式校验失败等情况会返回 error
});
```

#### `action:register`

注册 action。幂等：相同内容重复注册不会触发更新。

```typescript
socket.emit("action:register", {
  namespace: string;
  actions: Record<string, {
    description: string;
    inputSchema?: JSONSchema7;
    outputSchema?: JSONSchema7;
  }>;
});

// Gateway 处理逻辑：
// 1. 对每个 action 计算 hash = fnv1a(description + JSON.stringify(inputSchema) + JSON.stringify(outputSchema))
// 2. 如果 fullName 已存在且 hash 相同 → 跳过
// 3. 如果 fullName 已存在但 hash 不同 → 覆盖（更新 socketId、hash、registeredAt）
// 4. 如果 fullName 不存在 → 新增
// 5. 返回 ack 说明哪些被接受、哪些被拒绝
```

#### `action:unregister`

注销 action。

```typescript
socket.emit("action:unregister", {
  namespace?: string;  // 指定 namespace 则只注销该 namespace；空则注销该 socket 的所有 action
});
```

#### `action:result`

返回 action 执行结果。

```typescript
socket.emit("action:result", {
  requestId: string;
  result: {
    content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
});
```

#### `action:approval:response`

用户对 approval 请求的响应。

```typescript
socket.emit("action:approval:response", {
  requestId: string;       // approval 请求的 id
  executeRequestId: string; // 关联的 execute 请求 id
  approved: boolean;
  error?: string;  // 用户取消时的原因
});
```

### Gateway → Client

#### `client:init`

连接成功后发送初始化配置。

```typescript
socket.on("client:init", {
  theme: "light" | "dark";
  workspacePath: string;
});
```

#### `client:theme`

主题变更通知。

```typescript
socket.on("client:theme", {
  theme: "light" | "dark";
});
```

#### `action:execute`

请求执行 action。

```typescript
socket.on("action:execute", {
  requestId: string;
  namespace: string;
  action: string;
  payload: unknown;
  context: {
    sessionId: string;
    toolUseId: string;
    callerClientId?: string;  // 跨 client 调用时，调用方的 client id
    source: "main_window" | "page_iframe" | "chat_window" | "standalone" | "mcp";
  };
});
```

#### `action:approval:request`

请求用户确认（危险操作）。发送到能显示 UI 的 socket（main_window 或 chat_window）。

```typescript
socket.on("action:approval:request", {
  requestId: string;
  executeRequestId: string;
  message: string;
  options?: {
    timeout?: number;  // 默认 30000ms
    buttons?: { approve: string; reject: string };
  };
});
```

#### `action:error`

执行过程中的错误通知。

```typescript
socket.on("action:error", {
  requestId: string;
  code: "action_not_found" | "client_offline" | "execution_timeout" | "socket_disconnected";
  message: string;
});
```

### 超时和清理机制

**execute 超时：**
- 默认 30 秒
- 超时后 Gateway 向调用方返回 `action_timeout` 错误
- 同时向执行方发送 `action:cancel` 事件（可选，用于中断长时间操作）

**approval 超时：**
- 默认 30 秒（可在 options 中自定义）
- 超时后自动 reject

**socket 断开清理：**
- 移除该 socket 注册的所有 action
- 对该 socket 的 pending execute 请求返回 `socket_disconnected` 错误

**幂等窗口：**
- execute requestId 保留 60 秒用于去重
- 断线重连后重放的 execute 事件不会重复执行

## viben-page-sdk.js 新 API

### 配置注入

主窗口在加载 iframe 前设置全局配置：

```javascript
// 主窗口设置（在 iframe src 加载前）
window.__VIBEN_CONFIG__ = {
  gatewayUrl: "http://localhost:18790",
  clientId: "client_abc123",
  theme: "dark",
  workspacePath: "/Users/xxx/project"
};
```

### SDK 完整 API

```javascript
const viben = window.VibenPage;

// ========== 连接状态 ==========

viben.state;  // "connecting" | "connected" | "disconnected" | "reconnecting"

// 监听状态变化，返回取消函数
const unsubscribe = viben.onStateChange((state) => {
  console.log("Connection state:", state);
});
unsubscribe();  // 取消监听

// 连接就绪 Promise（连接成功后 resolve，连接失败 reject）
await viben.ready;

// ========== 主题 ==========

viben.theme;  // "light" | "dark"

// 监听主题变化，返回取消函数
const unsubscribe = viben.onThemeChange((theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
});

// ========== 配置 ==========

viben.clientId;       // string
viben.workspacePath;  // string | null
viben.gatewayUrl;     // string

// ========== Action 注册 ==========

// 注册 action，返回取消函数
const unregister = viben.actions.register("canvas", {
  create_node: {
    description: "在画布上创建一个新节点",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["text", "image", "shape"] },
        content: { type: "string" },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" }
          }
        }
      },
      required: ["type"]
    },
    execute: async (payload, context) => {
      // payload: 符合 inputSchema 的数据
      // context: { sessionId, toolUseId, source, requireApproval }
      
      // 危险操作需要用户确认
      if (payload.type === "dangerous") {
        const approved = await context.requireApproval("确认执行此操作？", {
          timeout: 60000
        });
        if (!approved) {
          return { content: [{ type: "text", text: "用户取消" }], isError: true };
        }
      }
      
      // 执行操作
      const node = createNode(payload);
      
      // 返回结果（MCP CallToolResult 格式）
      return {
        content: [{ type: "text", text: `Created node: ${node.id}` }],
        structuredContent: { nodeId: node.id, success: true }
      };
    }
  },
  
  delete_node: {
    description: "删除指定节点",
    inputSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" }
      },
      required: ["nodeId"]
    },
    execute: async (payload, context) => {
      // ...
    }
  }
});

// 注销整个 namespace
unregister();
// 或
viben.actions.unregister("canvas");

// 列出本 socket 注册的 actions
const myActions = viben.actions.list();
// [{ namespace: "canvas", name: "create_node", description: "..." }, ...]

// ========== 调用其他 Action ==========

// 调用同 client 的 action
const result = await viben.actions.call("editor.save", { path: "/file.txt" });

// 调用其他 client 的 action（需要知道 client id）
const result = await viben.actions.call("client_xyz.editor.save", { path: "/file.txt" });

// 错误处理
try {
  const result = await viben.actions.call("unknown.action", {});
} catch (error) {
  // error.code: "action_not_found" | "client_offline" | "execution_timeout" | "call_rejected"
  // error.message: 错误描述
}
```

### 生命周期

```javascript
// SDK 自动处理：
// 1. 页面加载时自动连接 Gateway
// 2. 断线自动重连（Socket.io 内置）
// 3. 重连后自动重新注册所有 action
// 4. 页面卸载时自动断开连接（Gateway 自动清理该 socket 的 action）
```

### 错误类型

```typescript
interface VibenError extends Error {
  code: 
    | "not_connected"       // SDK 未连接到 Gateway
    | "config_missing"      // window.__VIBEN_CONFIG__ 未设置
    | "action_not_found"    // 调用的 action 不存在
    | "client_offline"      // 目标 client 离线
    | "execution_timeout"   // 执行超时
    | "call_rejected"       // 调用被拒绝
    | "approval_timeout"    // 用户确认超时
    | "approval_rejected";  // 用户拒绝确认
}
```

## MCP Server 集成

### Header 约定

viben agent 调用 MCP Server 时在 HTTP header 中携带 client id：

```
x-viben-client-id: client_abc123
```

外部 agent（VSCode Copilot 等）不会携带此 header。

### list_actions 实现

```typescript
async function listActions(headers: Record<string, string>): Promise<ToolInfo[]> {
  const callerClientId = headers["x-viben-client-id"];
  const allActions = clientStore.getAllActions();
  
  if (callerClientId) {
    // viben agent：本 client 的 action 不带前缀，其他 client 带前缀
    const thisClient = allActions.filter(a => a.clientId === callerClientId);
    const otherClients = allActions.filter(a => a.clientId !== callerClientId);
    
    return [
      ...thisClient.map(a => ({
        name: `${a.namespace}.${a.name}`,
        description: a.description,
        inputSchema: a.inputSchema
      })),
      ...otherClients.map(a => ({
        name: `${a.clientId}.${a.namespace}.${a.name}`,
        description: `[${a.clientId}] ${a.description}`,
        inputSchema: a.inputSchema
      }))
    ];
  } else {
    // 外部 agent：全部带 client 前缀
    return allActions.map(a => ({
      name: `${a.clientId}.${a.namespace}.${a.name}`,
      description: `[${a.clientId}] ${a.description}`,
      inputSchema: a.inputSchema
    }));
  }
}
```

### GUI_execute 实现

```typescript
async function executeAction(
  action: string,
  payload: unknown,
  headers: Record<string, string>,
  context: { sessionId: string; toolUseId: string }
): Promise<CallToolResult> {
  const callerClientId = headers["x-viben-client-id"];
  
  // 解析 action 名
  const { targetClientId, namespace, name } = parseActionName(action, callerClientId);
  
  // 查找 action
  const entry = clientStore.findAction(targetClientId, namespace, name);
  if (!entry) {
    return {
      content: [{ type: "text", text: `Action not found: ${action}` }],
      isError: true
    };
  }
  
  // 检查目标 client 是否在线
  const client = clientStore.getClient(targetClientId);
  if (!client || client.sockets.size === 0) {
    return {
      content: [{ type: "text", text: `Client offline: ${targetClientId}` }],
      isError: true
    };
  }
  
  // 找到注册该 action 的 socket
  const socketInfo = client.sockets.get(entry.socketId);
  if (!socketInfo) {
    return {
      content: [{ type: "text", text: `Action socket disconnected` }],
      isError: true
    };
  }
  
  // 生成 requestId
  const requestId = generateRequestId();
  
  // 发送 execute 请求
  socketInfo.socket.emit("action:execute", {
    requestId,
    namespace,
    action: name,
    payload,
    context: {
      sessionId: context.sessionId,
      toolUseId: context.toolUseId,
      callerClientId,
      source: "mcp"
    }
  });
  
  // 等待结果（带超时）
  return waitForResult(requestId, { timeout: 30000 });
}

function parseActionName(action: string, callerClientId?: string): {
  targetClientId: string;
  namespace: string;
  name: string;
} {
  const parts = action.split(".");
  
  if (parts.length === 2) {
    // 格式: namespace.name → 使用 caller 的 client id
    if (!callerClientId) {
      throw new Error("Action must include client prefix for external agents");
    }
    return {
      targetClientId: callerClientId,
      namespace: parts[0],
      name: parts[1]
    };
  } else if (parts.length === 3) {
    // 格式: clientId.namespace.name
    return {
      targetClientId: parts[0],
      namespace: parts[1],
      name: parts[2]
    };
  } else {
    throw new Error(`Invalid action format: ${action}`);
  }
}
```

## 文件变更清单

### 新增依赖

```bash
cd packages/core
pnpm add socket.io socket.io-client
```

### socket.io-client 打包

将 socket.io-client 打包进 viben-page-sdk.js：

```typescript
// packages/core/scripts/build-page-sdk.ts
import { build } from "esbuild";

await build({
  entryPoints: ["src/assets/viben-page-sdk.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "VibenPageSDK",
  outfile: "dist/assets/viben-page-sdk.js",
  external: [],  // 不外部化任何依赖
});
```

### 新增文件

| 文件 | 描述 |
|------|------|
| `packages/core/src/gateway/client-store.ts` | ClientState 管理、action-store CRUD |
| `packages/core/src/gateway/client-socket-server.ts` | Socket.io Server 初始化和事件处理 |
| `packages/core/src/assets/viben-page-sdk.ts` | SDK TypeScript 源码（替代原 js） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `packages/core/src/gateway/index.ts` | 初始化 ClientSocketServer |
| `packages/core/src/gateway/state.ts` | 添加 `clientStore: ClientStore` |
| `packages/core/src/gateway/routes/mcp-server/gui-action-mcp-server.ts` | 改用 clientStore 查找和执行 action |
| `packages/core/package.json` | 添加 build-page-sdk 脚本 |
| `apps/desktop/src/pages/apps/components/app-frame.tsx` | 注入 `window.__VIBEN_CONFIG__` |
| `apps/desktop/src/stores/client-store.ts` | 新增：全局 client id store（zustand + persist to localStorage） |

### 删除文件

| 文件 | 原因 |
|------|------|
| `apps/desktop/src/pages/apps/components/page-action-bridge.ts` | 不再需要 postMessage bridge |
| `packages/core/assets/viben-page-sdk.js` | 改为 TypeScript 源码 |

### 删除代码

- `apps/desktop/src/` 中所有 PageActionBridge 引用
- `apps/desktop/src/` 中 postMessage 相关的监听和处理

## 验证方案

### 1. 启动 Gateway

```bash
pnpm gateway:restart
```

检查日志应显示：
```
[Gateway] Socket.io server listening on /socket.io/client
```

### 2. 检查 Socket.io 连接

1. 打开 desktop app
2. 打开任意 page（如 canvas）
3. DevTools → Network → WS
4. 应看到连接到 `/socket.io/client`
5. Console 应显示 `[VibenPage] connected`

### 3. 测试 action 注册

1. Page 加载后自动注册 action
2. Gateway 日志显示：
   ```
   [ClientStore] Action registered: client_xxx.canvas.create_node
   ```

### 4. 测试 action 调用

1. 通过 AcpChat 发送消息："在画布上创建一个文本节点"
2. Agent 调用 `GUI_execute("canvas.create_node", { type: "text", content: "hello" })`
3. 验证 canvas 上出现新节点

### 5. 测试跨设备（可选）

1. 用 MCP Inspector 连接 Gateway MCP Server
2. 调用 `list_actions` → 应返回带 client 前缀的 action 列表
3. 调用 `GUI_execute("client_xxx.canvas.create_node", ...)` → 应在桌面创建节点

### 6. 测试断线重连

1. 停止 Gateway
2. 等待 SDK 显示 `reconnecting`
3. 重启 Gateway
4. SDK 应自动重连并重新注册 action
