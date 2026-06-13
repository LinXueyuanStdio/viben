# ACP Session 持久化设计

## 背景

`AcpSessionManager` 当前只将 session 存储在内存 Map 中。WebSocket 断开时 `closeSession()` 直接从 Map 删除 session；重连后 `listSessions()` 返回空，前端只能新建 session 而无法恢复。

目标：实现 session 持久化，支持断线重连恢复，后端进程在断开期间继续运行并缓冲输出，重连后回放历史并处理挂起的交互请求。

---

## 一、总体架构

### 核心设计原则

**Session JSONL 作为单一事实来源（Source of Truth）**，类比 Claude Code 的 session 文件。每个 ACP session 拥有完整的事件日志，所有 `sessionUpdate`、`requestPermission`、`requestClientTool` 均作为事件追加写入 JSONL。

### 新增文件

```
packages/core/src/acp/ops/
  session-store.ts         ← AcpSessionStore 接口 + 文件系统默认实现
  detached-connection.ts   ← 断开时的连接代理（内存缓冲 + 刷盘 + 挂起管理）
  approval-handler.ts      ← 三种 approval 模式的处理逻辑
```

### 生命周期

```
WS 连接建立
    ↓
newSession / loadSession → 写入内存 Map + 写磁盘 meta.json
    ↓
执行中：backend 流式 → sessionUpdate → SdkAcpConnection → 前端
    ↓
WS 断开 → parkSession()
    ├── 换成 DetachedConnection（内存缓冲后续 updates）
    ├── backend 进程继续运行
    ├── 磁盘 meta 标记 status: "parked"
    └── 每 5s 或 prompt 完成时 → appendEvent() → events.jsonl

WS 重连 → loadSession(id)
    ├── 内存有（正常断线重连）：
    │     swap 回真实 connection
    │     回放内存缓冲 + 磁盘 buffer 合并
    │     挂起的 permission/tool_call 推给用户交互
    └── 内存无（gateway 重启）：
          从 meta.json 读取 sdk_session_id
          重建 session，backend 用 sdk_session_id 恢复上下文
          回放 events.jsonl 作历史显示（pending 事件标为 abandoned）
```

---

## 二、存储层 — `AcpSessionStore`

### 文件布局

```
~/.viben/acp/sessions/
  <session-id>/
    meta.json       ← AcpSessionRecord（会话元数据）
    events.jsonl    ← append-only 完整事件流
```

### 类型定义

```typescript
// packages/core/src/acp/ops/session-store.ts

export interface AcpSessionRecord {
  id: string;
  status: "active" | "parked" | "finished" | "error";
  cwd: string;
  created_at: string;
  last_active_at: string;
  agent_config_path?: string;
  agent_dir?: string;
  agent_config?: AgentConfigPayload;
  sandbox_config?: AcpSandboxConfig;
  mcp_servers: AcpMcpServer[];
  sdk_session_id?: string;       // claude-code 内部 session ID，用于重建 backend
  persist_session_id?: string;
  persist_task_id?: string;
  gateway_url?: string;
}

export interface AcpSessionEvent {
  seq: number;
  ts: string;
  type:
    | "prompt"
    | "session_update"
    | "permission_request"
    | "permission_response"
    | "client_tool_call"
    | "client_tool_result"
    | "notification";
  id?: string;                    // 需要响应的请求 ID
  status?: "pending" | "resolved" | "cancelled" | "abandoned";
  request_id?: string;            // 响应对应的请求 ID
  data: unknown;
}

export interface AcpSessionStore {
  saveRecord(record: AcpSessionRecord): Promise<void>;
  loadRecord(id: string): Promise<AcpSessionRecord | null>;
  listRecords(): Promise<AcpSessionRecord[]>;
  deleteRecord(id: string): Promise<void>;
  appendEvent(sessionId: string, event: AcpSessionEvent): Promise<void>;
  loadEvents(sessionId: string): Promise<AcpSessionEvent[]>;
  updateEventStatus(
    sessionId: string,
    eventId: string,
    status: AcpSessionEvent["status"]
  ): Promise<void>;
}
```

### 文件系统实现说明

- `listRecords()`：扫描目录，读所有子目录的 `meta.json`
- `appendEvent()`：追加一行到 `events.jsonl`
- `updateEventStatus()`：追加一条 `{seq, patch: {status}}` patch 行，避免重写整个文件
- `loadEvents()`：读取所有行，合并 patch（同一 `seq` 的最新 patch 优先），返回最终状态列表

### 导出

```typescript
export function createDefaultAcpSessionStore(): AcpSessionStore
```

---

## 三、`DetachedConnection`

替换 WebSocket 断开后的 `AcpConnection`，让 backend 进程继续运行并缓冲输出。

### 内部结构

```typescript
class DetachedConnection implements AcpConnection {
  private memoryBuffer: AcpSessionEvent[];           // 内存缓冲
  private flushTimer: NodeJS.Timeout | null;         // 5s 定时刷盘
  private pendingPermissions: Map<string, PendingRequest<AcpRequestPermissionResponse>>;
  private pendingToolCalls: Map<string, PendingRequest<unknown>>;
  private seq: number;
  private store: AcpSessionStore;
  private sessionId: string;
  private approvalMode: ApprovalMode;
}
```

### `requestPermission` 处理逻辑

```
approval_mode = "bypass"  → 直接 resolve(allow_once)，追加 permission_response 事件
approval_mode = "rules"   → ApprovalHandler.evaluateRules(params)
                              通过 → resolve，追加 response 事件
                              不通过 → 追加 permission_request(pending)，挂入 pendingPermissions
approval_mode = "ai"      → ApprovalHandler.evaluateWithAI(params)（异步）
                              AI 决定通过 → resolve，追加 response 事件
                              AI 决定拒绝 / 超时 → 追加 permission_request(pending)，挂入 pendingPermissions
```

### `requestClient` 处理逻辑

追加 `client_tool_call` 事件（status: "pending"），挂入 `pendingToolCalls` 等待重连后执行。

### 刷盘触发时机

1. 定时器：每 5 秒
2. prompt 完成时（backend 一轮输出结束）
3. `parkSession()` 调用时（确保立即刷盘）

### `resume()` 方法

```typescript
async resume(newConnection: AcpConnection, allEvents: AcpSessionEvent[]): Promise<void> {
  // 1. 向新连接回放历史事件（供前端 UI 渲染）
  //    仅回放 type = "session_update" 且 status 不为 "pending" 的事件
  //    permission_request / client_tool_call 等非 session_update 事件通过步骤 2 处理
  for (const event of allEvents) {
    if (event.type === "session_update" && event.status !== "pending") {
      await newConnection.sessionUpdate(event.data as AcpSessionNotification);
    }
  }
  // 2. 把内存 pending map 中未 resolve 的请求推给新连接（让用户交互）
  for (const [id, pending] of this.pendingPermissions) {
    const decision = await newConnection.requestPermission(pending.params);
    pending.resolve(decision);
    this.pendingPermissions.delete(id);
  }
  for (const [id, pending] of this.pendingToolCalls) {
    const result = await newConnection.requestClient("_viben/client_tool_call", pending.params);
    pending.resolve(result);
    this.pendingToolCalls.delete(id);
  }
}
```

### 定时器生命周期

- **启动**：`parkSession()` 时启动 5s 定时器
- **停止**：`resume()` 调用时或 `closeSession()` 时清除定时器并执行一次最终刷盘

---

## 四、`AcpSessionManager` 改造

### 新增方法

```typescript
// 断开时：换成 DetachedConnection，backend 继续运行
async parkSession(sessionId: string): Promise<void>

// 重连时：换回真实连接，回放历史 + resume pending
async resumeSession(
  sessionId: string,
  newConnection: AcpConnection
): Promise<void>
```

### `parkSession()` 实现

```
1. 取出 session
2. 读取 approval_mode：session.agent_config?.approval_mode ?? "rules"
3. 创建 DetachedConnection（传入 store、sessionId、approval_mode）
4. session.connection = detachedConnection
5. store.saveRecord({ ...record, status: "parked" })
6. 启动 DetachedConnection 的定时刷盘
```

### `loadSession()` 改造

```
loadSession(request, newConnection, context) →
  case 内存有 session：
    if session.connection instanceof DetachedConnection →
      resumeSession(id, newConnection)
    else →
      session.connection = newConnection   // 普通重连
      session.last_active_at = new Date()
  case 内存无，磁盘有 →
    record = store.loadRecord(id)
    创建 session record，backend_load_session_id = record.sdk_session_id
    sessions.set(id, session)
    allEvents = store.loadEvents(id)
    // 只回放 session_update 类型的事件作为历史显示
    // permission_request / client_tool_call 类型标为 abandoned（backend 已不在等待）
    for event of allEvents:
      if event.type === "session_update" → newConnection.sessionUpdate(event.data)
      if event.status === "pending" → store.updateEventStatus(id, event.id, "abandoned")
  case 都没有 →
    createSessionRecord(...)   // 现有逻辑
```

### `listSessions()` 改造

```
内存 Map sessions（in-memory）
  + store.listRecords()（status = "parked"）
合并去重（内存优先），按 last_active_at 降序返回
```

### `createSession()` 改造

创建 session record 后立即 `store.saveRecord()`。

### `ensureBackend()` 改造

`session.sdk_session_id = backend.backendSessionId` 赋值后，同步调用 `store.saveRecord()` 更新磁盘。

### `closeSession()` 改造

显式关闭（用户主动关闭，非 WebSocket 断开）时额外调用 `store.deleteRecord()`。

---

## 五、`approval_mode` 类型变更

### 类型定义

```typescript
// packages/core/src/acp/types.ts
export type ApprovalMode = "rules" | "bypass" | "ai";
```

### 变更清单

| 文件 | 变更内容 |
|------|---------|
| `packages/core/src/agents/types.ts` | `AgentConfigFile`：移除 `planMode?: boolean`，新增 `approval_mode?: ApprovalMode` |
| `packages/core/src/acp/types.ts` | `AgentConfigPayload`：移除 `approvals?: boolean` 和 `dangerously_skip_permissions?: boolean`，新增 `approval_mode?: ApprovalMode` |
| `packages/core/src/agents/index.ts` | 所有 `approvals` / `planMode` 读写替换为 `approval_mode`，默认值 `"rules"` |
| `packages/core/src/types/index.ts` | 同步相关 Agent 类型中的字段 |
| `apps/desktop/src/lib/gateway/types/agent.ts` | gateway 客户端类型同步 |
| `apps/desktop/src/types/unified-agent.ts` | 前端 unified agent 类型同步 |

### YAML 字段

```yaml
approval_mode: "rules"   # 规则审批（默认）
# approval_mode: "bypass"  # 绕过审批
# approval_mode: "ai"      # AI 审批
```

### 向后兼容迁移

读取旧 YAML 时（`agents/index.ts` 的 YAML 读取处）：

```
approvals: true  → approval_mode: "bypass"
approvals: false → approval_mode: "rules"
无 approvals 字段 → approval_mode: "rules"（默认）
```

---

## 六、`agent-acp.ts` 改造

### 断开时（原 closeSession → 改为 parkSession）

```typescript
socket.once("close", async () => {
  for (const sessionId of ownedSessionIds) {
    await acpSessionManager.parkSession(sessionId);
  }
  log.info({ sessions: ownedSessionIds.size }, "ACP WebSocket disconnected, sessions parked");
});
```

### loadSession 传入新连接

```typescript
async loadSession(request: AcpLoadSessionRequest) {
  const response = await acpSessionManager.loadSession(
    request,
    connection,   // ← 新增：传入当前 WebSocket 的 SdkAcpConnection
    context
  );
  ownedSessionIds.add(response.sessionId);
  return response;
}
```

### `AcpSessionManager` 构造

在 gateway 初始化时（`packages/core/src/gateway/index.ts`）将 `AcpSessionStore` 注入 `AcpSessionManager`：

```typescript
const sessionStore = createDefaultAcpSessionStore();
const acpSessionManager = new AcpSessionManager(
  createDefaultAcpBackendAdapter(),
  createDefaultAcpSteerPromptStore(),
  sessionStore
);
```

---

## 七、`approval-handler.ts`

```typescript
// packages/core/src/acp/ops/approval-handler.ts

export interface ApprovalHandler {
  evaluate(
    params: AcpRequestPermissionRequest,
    approvalMode: ApprovalMode
  ): Promise<ApprovalDecision>;
}

export type ApprovalDecision =
  | { auto: true; optionId: string }   // 自动决定，直接 resolve
  | { auto: false };                    // 需要人工，挂起
```

- `"rules"`：检查工具名、命令模式等规则，能自动决定则 `auto: true`，否则 `auto: false` 挂起
- `"bypass"`：始终返回 `{ auto: true, optionId: "allow_once" }`
- `"ai"`：调用 AI 判断；AI 决定安全 → `auto: true`；AI 决定不安全或超时 → `auto: false` 挂起

初版 `"ai"` 实现可为 stub（直接返回 `auto: false`），待后续接入 LLM。
