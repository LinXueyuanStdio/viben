# Desktop Action Store → Gateway 同步设计

## 概述

Desktop app 的 Zustand action-store 当前只存在于前端内存中，gateway 的 ClientStore 无法感知这些 actions。本设计通过在 desktop 中新增 socket.io 客户端模块，将 desktop actions 同步到 gateway，使外部 MCP 客户端能够发现和调用 desktop 的 actions。

## 问题

- Desktop 注册的 actions（如 presentation.draw、navigate_to、read_window）对 gateway 不可见
- 外部 MCP 客户端（VSCode Copilot、Claude Agent 等）无法调用 desktop 侧的 actions
- 跨设备/跨客户端调用 desktop actions 不可能

## 决策记录

| 决策 | 选择 |
|------|------|
| Legacy GUI_execute 路径 | 完全替换为 socket.io 路径 |
| Builtins 注册 | 注册 `read_window`、`navigate_to`，排除 `list_actions`、`get_action_detail` |
| Builtins namespace | `desktop_main` |
| Approval 流程 | 走 socket.io 审批协议（`action:approval:request`/`action:approval:result`） |
| ClientSideBash | 保持现有 `/api/client-tools/complete` 路径不变，不注册为 action |
| 文件变更策略 | 不删除任何现有文件，纯增量 + 修改集成点 |
| 实现范围 | 全量一次完成 |

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  Desktop App (Tauri Renderer)                           │
│                                                         │
│  ┌─────────────────┐     ┌──────────────────────────┐  │
│  │ Zustand          │     │ GatewayActionSocket      │  │
│  │ action-store     │────▶│ (gateway-action-socket.ts)│  │
│  │                  │◀────│                          │  │
│  │ • providers Map  │     │ • socket.io-client conn  │  │
│  │ • register()     │     │ • subscribe(store diff)  │  │
│  │ • unregister()   │     │ • handle action:execute  │  │
│  │ • execute()      │     │ • emit action:result     │  │
│  └─────────────────┘     └──────────────────────────┘  │
│           ▲                         │ ▲                  │
│           │ useActionProvider()     │ │                  │
│  ┌────────┴────────┐               │ │                  │
│  │ React Components │               │ │                  │
│  │ (presentation,   │               │ │                  │
│  │  page providers) │               │ │                  │
│  └─────────────────┘               │ │                  │
└─────────────────────────────────────┼─┼──────────────────┘
                                      │ │ socket.io
                                      ▼ │
┌─────────────────────────────────────────────────────────┐
│  Gateway (packages/core)                                │
│                                                         │
│  ClientSocketServer ←→ ClientStore                      │
│  • action:register/unregister                           │
│  • action:execute → desktop socket                     │
│  • action:result ← desktop socket                      │
│  • action:approval:request/result                       │
│                                                         │
│  MCP Server (gui-action-mcp-server)                     │
│  • GUI_execute → ClientSocketServer.executeAction()     │
│  • list_actions → ClientStore.getAllActions()            │
└─────────────────────────────────────────────────────────┘
```

## 新增模块：GatewayActionSocket

### 文件位置

`apps/desktop/src/lib/action-system/gateway-action-socket.ts`

### 类 API

```typescript
class GatewayActionSocket {
  // 生命周期
  connect(gatewayUrl: string, identity: ClientIdentity): void
  disconnect(): void
  get state(): "connecting" | "connected" | "disconnected" | "reconnecting"

  // 内部自动处理：
  // - subscribe action-store → diff → emit action:register/unregister
  // - listen action:execute → route to action-store.execute() or builtins
  // - emit action:result
  // - handle approval protocol (action:approval:request ↔ action:approval:result)
}

// 单例导出
export const gatewayActionSocket: GatewayActionSocket
```

## 连接与认证

### 连接流程

1. 从 `client-id-store` 获取 `{ clientId, publicKey, privateKey }`
2. 从 `connection-store` 获取 `gatewayUrl`
3. 创建 socket.io 连接：`io(gatewayUrl, { path: "/socket.io/client", reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000 })`
4. transport `connect` 事件 → 签名 `${clientId}:${Date.now()}` → emit `client:connect` `{ clientId, source: "main_window", publicKey, signature, timestamp }`
5. ack success → 状态 `"connected"` → 初始全量同步
6. ack failure → 状态 `"error"`，等待自动重连

### 认证

- Ed25519 签名：`sign(encode("${clientId}:${timestamp}"), privateKey)`
- Gateway 验证：公钥验签 + 时间窗口 5 分钟
- 密钥复用 `client-id-store` 中已有的 keypair

### 重连

- socket.io 自动重连（infinite attempts, 1s~5s exponential backoff）
- 重连后重新 auth + 全量重新注册 actions
- Gateway 30s grace period 保证短暂断开不丢状态

### 断开

- Gateway 不可达时 desktop 本地 action-store 继续正常工作（React 组件不受影响）
- 仅外部 MCP 调用在断开期间无法触达 desktop actions
- App 关闭或 gateway 切换时 `socket.disconnect()`

## Action 注册同步

### 数据源

Zustand action-store 的 `registry: Map<string, ActionProviderRegistration>`

### 同步策略

```typescript
useActionStore.subscribe((state, prevState) => {
  const current = flattenActions(state.registry)   // Map<fullName, ActionMeta>
  const previous = flattenActions(prevState.registry)

  // 新增或变更 → 按 namespace 分组 emit "action:register"
  // 移除 → emit "action:unregister" { namespace }（整个 namespace 空了才 unregister）
  // hash 对比避免无意义重复注册
})
```

### 数据转换

| Desktop ActionDef 字段 | Gateway action:register 字段 |
|---|---|
| `name` | `actions[name]` key |
| `description` | `description` |
| `input_schema` (JSONSchema7) | `inputSchema` |
| `output_schema` (JSONSchema7) | `outputSchema` |
| `execute` 函数 | 不发送，本地保留 |

### Builtins 注册

`read_window` 和 `navigate_to` 注册到 gateway，namespace 为 `"desktop_main"`：

```
desktop_main.read_window  — description + inputSchema
desktop_main.navigate_to  — description + inputSchema
```

### 初始同步

连接成功后一次性将当前 store 中所有 actions + builtins 全量注册。

### 边界情况

- 多个 provider 注册同一 namespace：只注册优先级最高的（newest registeredAt）
- Provider unmount 导致 namespace 所有 actions 消失：emit `action:unregister { namespace }`
- 连接断开时的 store 变更：重连后全量重注册（覆盖）

## Action 执行接收

### 执行流程

```
Gateway emit "action:execute" { requestId, namespace, action, payload, context }
    │
    ▼
GatewayActionSocket.handleExecute()
    │
    ├─ namespace === "desktop_main" && (action === "read_window" | "navigate_to")
    │    → 调用 builtins 对应函数
    │
    └─ 其他 namespace.action
         → useActionStore.getState().execute(fullName, payload, executionContext)
    │
    ▼
emit "action:result" { requestId, result: { content, structuredContent?, isError? } }
```

### ExecutionContext 构建

```typescript
{
  sessionId: context.sessionId,
  toolUseId: context.toolUseId,
  requireApproval: (message, options) => {
    // 走 socket.io 审批协议：
    // 1. emit "action:approval:request" { requestId, executeRequestId, message, options }
    // 2. 等待 "action:approval:result" { requestId, approved }
    // 3. resolve Promise<boolean>
  }
}
```

### 超时

由 gateway 侧控制（默认 30s，action 可自定义 timeout）。Desktop 不设本地超时。

### 错误处理

- Action 未找到 → `{ content: [{type:"text", text:"Action not found: ..."}], isError: true }`
- 执行抛异常 → `{ content: [{type:"text", text: error.message}], isError: true }`
- 用户拒绝 approval → `{ content: [{type:"text", text:"User rejected"}], isError: true }`

## 与现有路径的关系

| 类型 | 路径 |
|------|------|
| **GUI_execute**（actions） | 新 socket.io 路径：gateway → socket.io → desktop 执行 → socket.io 返回 |
| **ClientSideBash**（工具） | 保持现有路径：SSE/ACP → desktop 拦截 → 本地执行 bash → POST `/api/client-tools/complete` |

ClientSideBash 特殊性：
- 它是工具（tool），不是 action
- 执行时从 gateway 查询全量 action 列表，注册为 bash 内可调用的函数
- 执行在 desktop 侧完成，复用 `/api/client-tools/complete` 链路

## 集成改造细节

### 调用关系变化

**改造前（当前状态）**：

```
路径 1: SSE 流拦截
  SSE event (tool_use, name="GUI_execute")
    → use-agent-conversation.ts (line ~599, isGUIExecuteTool 分支)
      → handleGUIExecute() [action-executor.ts]
        → createExecutionContext() [execution-context.ts, dialog-based approval]
        → executeGUIAction() [action-executor.ts 内部函数]
          → executeBuiltin() → 或 action-store.execute()
        → completeClientSideToolOnce() [HTTP POST /api/client-tools/complete]

路径 2: ACP WebSocket
  ACP JSON-RPC "_viben/client_tool_call"
    → executeClientTool() [client-tool-executor.ts]
      → executeGuiAction() [client-tool-executor.ts line ~107]
        → createExecutionContext() [同上]
        → executeGUIAction() [同上内部函数]
      → 返回 CallToolResult（ACP 框架处理投递）

路径 3: ClientSideBash (两个入口共用)
  SSE/ACP tool_use (name="ClientSideBash")
    → handleClientSideBash() [action-executor.ts]
      → createClientSideBash({ executeGUIAction })
      → runtime.execute()
      → completeClientSideToolOnce()
```

**改造后**：

```
路径 1: Socket.io 派发（新，替代 SSE/ACP 的 GUI_execute 拦截）
  Gateway socket.io emit "action:execute"
    → GatewayActionSocket.handleExecute() [gateway-action-socket.ts]
      → createSocketExecutionContext() [新函数，socket.io approval]
      → executeGUIAction() [从 action-executor.ts 导出]
        → executeBuiltin() → 或 action-store.execute()
      → socket.emit("action:result")

路径 2: ClientSideBash（不变）
  SSE tool_use (name="ClientSideBash")
    → use-agent-conversation.ts (isClientSideBashTool 分支，保留)
      → handleClientSideBash() [action-executor.ts，保留]
        → completeClientSideToolOnce() [保留]
  ACP tool_use (name="ClientSideBash")
    → executeClientTool() [client-tool-executor.ts，保留]
      → executeClientSideBash() [保留]

路径 3: ACP GUI_execute（移除）
  ACP JSON-RPC "_viben/client_tool_call" (toolName="GUI_execute")
    → 不再本地执行，gateway 已通过 socket.io 直接派发
```

### 逐文件改造说明

#### `use-agent-conversation.ts`

**位置**：`apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`

**当前代码**（line ~598-612）：
```typescript
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

**改造**：
- 删除 `isGUIExecuteTool` 分支（整个 if block）
- 保留 `isClientSideBashTool` 分支（改为独立 if）
- 移除 `handleGUIExecute`、`isGUIExecuteTool` 的 import

---

#### `client-tool-executor.ts`

**位置**：`apps/desktop/src/components/acp-chat/client-tool-executor.ts`

**当前代码**（line ~139-154）：
```typescript
export async function executeClientTool(request): Promise<CallToolResult> {
  if (isClientSideBashTool(request.toolName)) {
    return executeClientSideBash(request);
  }
  if (!isGuiExecuteTool(request.toolName)) {
    return errorResult(`Desktop client has no handler for tool: ${request.toolName}`, {...});
  }
  return executeGuiAction(request);  // ← 这里调用 GUI_execute
}
```

**改造**：
- 移除 `isGuiExecuteTool` 判断和 `executeGuiAction` 调用
- GUI_execute 不再由 ACP 路径处理（gateway 已通过 socket.io 直接派发到 desktop）
- 保留 `isClientSideBashTool` 分支
- 未知工具名仍返回 errorResult

改造后：
```typescript
export async function executeClientTool(request): Promise<CallToolResult> {
  if (isClientSideBashTool(request.toolName)) {
    return executeClientSideBash(request);
  }
  return errorResult(`Desktop client has no handler for tool: ${request.toolName}`, {...});
}
```

---

#### `action-executor.ts`

**位置**：`apps/desktop/src/lib/action-system/action-executor.ts`

**当前结构**：
- `executeGUIAction(input, ctx)` — 内部函数，核心逻辑（builtins → action-store）
- `handleGUIExecute(toolUseId, sessionId, input)` — 包装函数（创建 ctx + 执行 + HTTP POST 回传）
- `handleClientSideBash(toolUseId, sessionId, input)` — ClientSideBash 入口

**改造**：
- 导出 `executeGUIAction`（从 private 变为 export），供 GatewayActionSocket 调用
- `handleGUIExecute` 保留但标记为仅供 legacy 兼容（或直接不再调用）
- `handleClientSideBash` 保留不变

---

#### `execution-context.ts`

**位置**：`apps/desktop/src/lib/action-system/execution-context.ts`

**当前逻辑**：
```typescript
export function createExecutionContext(sessionId, toolUseId): ExecutionContext {
  return {
    sessionId,
    toolUseId,
    requireApproval: (message, options) => {
      // 调用 module-level approvalHandler（由 React ApprovalDialog 组件设置）
      // 显示本地确认弹窗，用户点击 approve/reject
    }
  }
}
```

**改造**：
- 原有 `createExecutionContext` 保留不变（ClientSideBash 路径仍需本地 dialog）
- 新增 `createSocketExecutionContext(sessionId, toolUseId, socket, executeRequestId)` 函数：

```typescript
export function createSocketExecutionContext(
  sessionId: string,
  toolUseId: string,
  emitApprovalRequest: (message: string, options?: ApprovalOptions) => Promise<boolean>
): ExecutionContext {
  return {
    sessionId,
    toolUseId,
    requireApproval: emitApprovalRequest,
  }
}
```

`emitApprovalRequest` 由 GatewayActionSocket 提供，内部实现：
1. 生成 approval requestId
2. emit `"action:approval:request"` `{ requestId, executeRequestId, message, options }`
3. 注册一次性 listener 监听 `"action:approval:result"` `{ requestId, approved }`
4. 返回 `Promise<boolean>`

---

#### `builtins.ts`

**位置**：`apps/desktop/src/lib/action-system/builtins.ts`

**当前状态**：
- `executeBuiltin(action, payload, ctx)` — 执行内置 action
- `getBuiltinActionInfos()` — 返回 `ActionInfo[]`（name + description）
- `getBuiltinActionDetail(action)` — 返回 `ActionDetail | null`（含 schema）

这些函数当前已存在但为内部使用。

**改造**：
- 新增导出函数 `getRegistrableBuiltins()`，返回需要注册到 gateway 的 builtins 元信息：

```typescript
export function getRegistrableBuiltins(): Record<string, {
  description: string
  inputSchema?: JSONSchema7
  outputSchema?: JSONSchema7
}> {
  // 只返回 read_window 和 navigate_to（排除 list_actions、get_action_detail）
  return {
    read_window: {
      description: "Capture the current window as a PNG screenshot",
      inputSchema: { type: "object", properties: {} },
    },
    navigate_to: {
      description: "Navigate to an in-app route",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string", description: "Target route" } },
        required: ["url"],
      },
    },
  }
}
```

---

#### `action-store.ts`

**位置**：`apps/desktop/src/stores/action-store.ts`

**改造**：无。GatewayActionSocket 通过以下方式与之交互：
- `useActionStore.subscribe(listener)` — 监听 registry 变更
- `useActionStore.getState().listActions()` — 获取当前全量 actions（用于初始注册）
- `useActionStore.getState().execute(fullName, payload, ctx)` — 执行 action（在 handleExecute 中调用）
- `useActionStore.getState().getActionDetail(fullName)` — 获取 schema（用于注册时提取 inputSchema/outputSchema）

---

#### `index.ts`（barrel export）

**位置**：`apps/desktop/src/lib/action-system/index.ts`

**改造**：新增导出：
- `export { executeGUIAction } from "./action-executor"`
- `export { getRegistrableBuiltins } from "./builtins"`
- `export { createSocketExecutionContext } from "./execution-context"`
- `export { gatewayActionSocket } from "./gateway-action-socket"`

## 连接触发

```typescript
// 在 App 层或 connection-store 变更时
useEffect(() => {
  const gatewayUrl = getGatewayUrl()
  const identity = getIdentitySync()
  if (gatewayUrl && identity) {
    gatewayActionSocket.connect(gatewayUrl, identity)
  }
  return () => gatewayActionSocket.disconnect()
}, [gatewayUrl])
```

可选在 `connection-store` 中增加 `actionSocketState` 字段供 UI 显示连接状态。

## 依赖

- `socket.io-client`：已通过 `@viben/core` 间接可用，需添加为 desktop 的直接依赖
- `@noble/ed25519`：已是 desktop 直接依赖
- Zustand subscribe：内置 API，无需额外依赖
