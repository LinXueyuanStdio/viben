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
  session-event-recorder.ts ← 统一记录 active/detached 两种连接状态的事件
  detached-connection.ts   ← 断开时的连接代理（内存缓冲 + 刷盘 + 挂起管理）
  approval-handler.ts      ← 三种 approval 模式的处理逻辑
```

### 生命周期

```
WS 连接建立
    ↓
newSession / loadSession → 写入内存 Map + 写磁盘 meta.json（status: "active"）
    ↓
执行中：backend 流式 → sessionUpdate → AcpSessionEventRecorder.append() → SdkAcpConnection → 前端
    ↓
WS 断开 → parkSession()
    ├── 换成 DetachedConnection（继续记录事件，不向旧 WebSocket 推送）
    ├── backend 进程继续运行
    ├── 磁盘 meta 标记 status: "parked"
    └── 后续 sessionUpdate / permission / client tool 仍追加写入 events.jsonl

WS 重连 → loadSession(id)
    ├── 内存有（正常断线重连，connection 是 DetachedConnection）：
    │     detachedConn.resume(newConnection) → 返回从 events.jsonl 读取的完整 history
    │     loadSession 响应携带 history 字段
    │     resume() 异步处理 pending permission/tool_call（不阻塞响应返回）
    └── 内存无（gateway 重启）：
          从 meta.json 读取 sdk_session_id
          重建 session，backend 用 sdk_session_id 恢复上下文
          回放 events.jsonl → 收集 session_update 事件放入 history
          pending 事件标为 abandoned
          loadSession 响应携带 history 字段
```

### ACP 原生能力利用

Backend（claude-code）在 `initialize` 响应中声明的能力，本设计均应充分利用，不重复造轮子：

| ACP 能力 | 本设计中的用途 |
|---------|--------------|
| `agentCapabilities.loadSession: true` | gateway 重启后调用 `session/load { sessionId: sdk_session_id }` 恢复 backend 上下文（ACP 原生协议，不是自定义机制） |
| `sessionCapabilities.resume` | WS 重连时向 backend 发 `session/resume { sessionId }` 通知其继续流式输出（backend 可能在连接断开后暂停推送） |
| `sessionCapabilities.list` | `listSessions()` 向活跃 backend 请求 `session/list`，合并磁盘 parked 记录，得到完整 session 列表 |
| `sessionCapabilities.close` | 用户主动关闭 session 时发 `session/close { sessionId }`，backend 正确清理内部状态 |
| `_meta.claudeCode.promptQueueing: true` | backend 支持在前一 prompt 执行中接受新 prompt；断开期间若有 prompt 未完成，重连后继续消费 |
| `dangerously_skip_permissions` in agent_config | `permission_mode: "bypassPermissions"` 时 backend 进入 `bypassPermissions` 模式，彻底不发 `requestPermission` |

**协议层边界**（重要）：

```
前端 ←─── Gateway WebSocket（gateway 自定义协议，含 history 字段扩展）─────→ Gateway
Gateway ←── ACP 协议（session/new, session/load, session/resume, session/list, session/close,
              requestPermission, sessionUpdate...）───────────────────────────→ Backend（claude-code）
```

本设计的 `history` 字段、`AcpSessionStore`、`DetachedConnection` 均在 Gateway 层，不影响 ACP 协议本身。

### 事件记录边界

所有会影响恢复的事件都通过 `AcpSessionEventRecorder` 追加到 `events.jsonl`，包括 active WebSocket 连接期间的 `sessionUpdate`、`requestPermission`、`requestClientTool`、响应和通知。`SdkAcpConnection` 与 `DetachedConnection` 只能负责"推送给当前连接或挂起等待"，不能各自维护一套持久化语义。

**history 的来源**：`session/load` 响应中的 `history` 始终来自 `store.loadEvents(sessionId)` 的结果，而不是 `DetachedConnection` 的内存缓冲。正常断线重连时，`resume()` 先停止 detached 状态、等待当前事件写入完成，然后从 JSONL 读取截止点历史；gateway 重启恢复时也使用同一读取路径。这样断线超过 5 秒、已经刷盘的事件、以及恢复前最后一批事件都不会因为内存 buffer 被清空而丢失。

`DetachedConnection` 可以保留极短期的内存结构用于 pending request 的 Promise 管理，但该结构不是 history 的事实来源。pending 的 `seq` 必须来自 `appendEvent()` 返回值；超时、取消、恢复后解决都必须通过 `updateEventStatus()` patch 原事件，而不是追加第二条同类型事件。

### 数据丢失边界

**设计决策（trade-off 声明）：**

- **单事件追加窗口**：事件 append 调用返回前如果进程崩溃，该事件可能尚未落盘；append 返回后的事件必须可通过 `loadEvents()` 恢复
- **Gateway crash = Backend crash**：当前 backend 是 gateway 的子进程（`SubprocessAcpBackendAdapter`），gateway 进程终止时 backend 子进程同时收到信号退出。因此：
  - 内存中的 pending map 丢失 → backend 也已死，不存在 backend 挂起等待响应的状态不一致问题
  - gateway 重启后读取 JSONL，所有 `status: "pending"` 的事件统一标为 `abandoned`，不会永久挂起
- **未来兼容**：如果未来支持远程 backend（backend 独立于 gateway 运行），需要额外设计 backend 侧的 orphan timeout 机制（不在本 spec 范围内）

---

## 二、存储层 — `AcpSessionStore`

### 文件布局

```
~/.viben/acp/sessions/
  <session-id>/
    meta.json       ← AcpSessionRecord（会话元数据）
    events.jsonl    ← append-only 完整事件流（事件行 + patch 行混合）
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
  title?: string;                // 取自 agentCapabilities._meta?.title 或 agent_config.name
  agent_config_path?: string;
  agent_dir?: string;
  agent_config?: AgentConfigPayload;
  sandbox_config?: AcpSandboxConfig;
  mcp_servers: AcpMcpServer[];
  sdk_session_id?: string;       // claude-code 内部 session ID，用于重建 backend
  agent_capabilities?: AcpAgentCapabilities;  // park 时保存，用于 listSessions 返回
  persist_session_id?: string;
  persist_task_id?: string;
  gateway_url?: string;
  last_seq?: number;             // 已知最大事件 seq，用于新 store 实例恢复 nextSeq
}

// 事件行：追加到 events.jsonl 的普通事件
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
  // 以下字段仅在需要响应的类型上存在（permission_request / client_tool_call）
  id?: string;                   // 请求 ID，用于响应关联
  status?: "pending" | "resolved" | "cancelled" | "abandoned";
  request_id?: string;           // 响应对应的请求 ID
  data: AcpSessionEventData;     // 见下方各 type 对应的 data 类型
}

// data 字段按 type 对应：
//   "session_update"      → AcpSessionUpdate（来自 backend 的流式数据）
//   "permission_request"  → AcpRequestPermissionRequest
//   "permission_response" → AcpRequestPermissionResponse
//   "client_tool_call"    → AcpClientToolCallRequest
//   "client_tool_result"  → unknown（工具执行结果）
//   "prompt"              → AcpPromptRequest
//   "notification"        → unknown
export type AcpSessionEventData = unknown;

// Patch 行：用于更新事件 status，追加到同一 events.jsonl
// 与事件行的区分标志：存在 _type: "patch" 字段
export interface AcpSessionEventPatch {
  _type: "patch";                // 必填，用于区分 patch 行和事件行
  target_seq: number;            // 目标事件的 seq（注意：用 target_seq 而非 seq）
  patch: { status: AcpSessionEvent["status"] };
}

export interface AcpSessionStore {
  saveRecord(record: AcpSessionRecord): Promise<void>;
  loadRecord(id: string): Promise<AcpSessionRecord | null>;
  listRecords(): Promise<AcpSessionRecord[]>;
  deleteRecord(id: string): Promise<void>;
  // appendEvent 内部分配并返回该事件的 seq（调用方用于后续 updateEventStatus）
  appendEvent(sessionId: string, event: Omit<AcpSessionEvent, "seq">): Promise<number>;
  loadEvents(sessionId: string): Promise<AcpSessionEvent[]>;
  // 直接按 seq 更新状态，无需全量扫描
  updateEventStatus(
    sessionId: string,
    seq: number,
    status: AcpSessionEvent["status"]
  ): Promise<void>;
}
```

### Session ID 安全约束

`sessionId` 会成为 `~/.viben/acp/sessions/<session-id>/` 的目录名，因此必须先校验再拼接路径。允许的格式为：

```
^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
```

额外约束：

- 禁止 `/`、`\`、`.` 开头、`..`、空字符串和长度超过 128 的 ID
- `sessionDir(id)` 内部使用 `path.resolve(baseDir, id)`，并校验结果以 `path.resolve(baseDir) + path.sep` 开头
- `createSession()` 生成的 UUID 天然满足约束；`loadSession(request.sessionId)` 必须在读取磁盘前校验，不合法时返回 invalid params

测试必须覆盖 `../x`、`a/b`、`..`、空字符串、超长 ID 均被拒绝，且不会创建或读取 session 根目录外的文件。

### 文件系统实现说明

- `listRecords()`：扫描目录，`Promise.allSettled` 并行读所有子目录的 `meta.json`
- `saveRecord()`：使用原子写入，先写 `meta.json.tmp`，再 `rename` 到 `meta.json`；写入前保留上一次 `meta.json` 为 `meta.json.bak`。`loadRecord()` 若 `meta.json` 损坏，尝试读取 `.bak`；仍失败时返回 null 并记录 warning
- `appendEvent()`：
  - 内部维护 per-session 的 `nextSeq` 计数器；若计数器不存在，先读取 `events.jsonl` 的最大 seq，使用 `maxSeq + 1` 初始化，不要求调用方 cast 到具体 store 实现
  - 追加一行 JSON + `\n` 到 `events.jsonl`
  - append 成功后更新内存 `lastSeq`；下一次 `saveRecord()` 将 `last_seq` 写入 `meta.json`
  - 写入中途 crash 可能导致末尾行 JSON 不完整；`loadEvents()` 解析时对每行做 `try-catch`，静默跳过损坏行并记录 warning
- `updateEventStatus(seq, status)`：追加一条 `AcpSessionEventPatch` 行，避免重写整个文件
- `loadEvents()`：
  - 逐行解析，用 `_type === "patch"` 区分 patch 行和事件行
  - 维护 `patchMap: Map<number, status>`（`target_seq` → 最新 status）
  - 最终对每个事件，若 `patchMap.has(event.seq)`，则用 patch 覆盖 `event.status`
  - **边界条件**：
    - 孤儿 patch（无对应事件行）：静默忽略，记录 debug 日志
    - 同一 `target_seq` 多个 patch：last-write-wins（用最后一个 patch 的 status）
    - 损坏行（JSON 解析失败）：try-catch 跳过，记录 warning

### 并发写锁

`appendEvent()` 和 `updateEventStatus()` 可能并发调用（定时刷盘 + `resume()` 触发的最终刷盘交叉）。直接复用项目已有的 `AsyncLock`（`packages/core/src/utils/async-lock.ts`），实现 per-session 写锁：

```typescript
import { AsyncLock } from "../../utils/async-lock";

export class FileSystemAcpSessionStore implements AcpSessionStore {
  private writeLock = new AsyncLock();

  async appendEvent(sessionId: string, event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    return this.writeLock.withLock(sessionId, async () => {
      const seq = this.getNextSeq(sessionId);
      const line = JSON.stringify({ ...event, seq }) + "\n";
      await fs.appendFile(this.eventsPath(sessionId), line, "utf8");
      return seq;
    });
  }

  async updateEventStatus(sessionId: string, seq: number, status: AcpSessionEvent["status"]): Promise<void> {
    return this.writeLock.withLock(sessionId, async () => {
      const patch: AcpSessionEventPatch = { _type: "patch", target_seq: seq, patch: { status } };
      await fs.appendFile(this.eventsPath(sessionId), JSON.stringify(patch) + "\n", "utf8");
    });
  }
}
```

### Seq 初始化

`appendEvent()` 内部维护 `private seqCounters = new Map<string, number>()`。调用方不直接初始化 seq，也不依赖 `FileSystemAcpSessionStore` 具体类型。

当某个 `sessionId` 首次 append 时，store 执行：

```typescript
private async getNextSeq(sessionId: string): Promise<number> {
  const current = this.seqCounters.get(sessionId);
  if (current !== undefined) {
    this.seqCounters.set(sessionId, current + 1);
    return current;
  }
  const events = await this.loadEvents(sessionId);
  const maxSeq = events.reduce((max, event) => Math.max(max, event.seq), -1);
  const next = maxSeq + 1;
  this.seqCounters.set(sessionId, next + 1);
  return next;
}
```

### 导出

```typescript
export function createDefaultAcpSessionStore(): AcpSessionStore
```

---

## 三、`AcpSessionEventRecorder`

`AcpSessionEventRecorder` 是 active 和 detached 状态共享的事件记录层。它的职责是追加事件、维护 pending 事件 seq、patch 状态，并提供 history 读取；它不负责 WebSocket 推送，也不负责 backend 生命周期。

```typescript
export class AcpSessionEventRecorder {
  constructor(
    private readonly store: AcpSessionStore,
    private readonly sessionId: string
  ) {}

  append(event: Omit<AcpSessionEvent, "seq">): Promise<number>
  updateStatus(seq: number, status: AcpSessionEvent["status"]): Promise<void>
  loadHistory(): Promise<AcpSessionEvent[]>
  abandonPending(events?: AcpSessionEvent[]): Promise<AcpSessionEvent[]>
}
```

使用规则：

- `SdkAcpConnection.sessionUpdate()` 在推送给前端前先 `append({ type: "session_update" })`
- `SdkAcpConnection.requestPermission()` 在需要人工审批时先追加 `permission_request(pending)`，用户响应后 patch 为 `resolved` 或 `cancelled`
- `DetachedConnection` 与活跃连接复用同一个 recorder，不再维护自己的 history buffer
- `loadHistory()` 返回 `store.loadEvents(sessionId)` 结果，按 `seq` 升序；前端只渲染 `session_update`，但保留其他事件供 pending 恢复和调试

---

## 四、`DetachedConnection`

替换 WebSocket 断开后的 `AcpConnection`，让 backend 进程继续运行并缓冲输出。

### 内部结构

```typescript
class DetachedConnection implements AcpConnection {
  private recorder: AcpSessionEventRecorder;
  private pendingPermissions: Map<string, PendingRequest<AcpRequestPermissionResponse>>;
  private pendingToolCalls: Map<string, PendingRequest<unknown>>;
  private sessionId: string;
  private permissionMode: AcpPermissionMode;
  private draining = false;      // 防止 drainPendingAsync 并发执行
}
```

### `requestPermission` 处理逻辑

> `permission_mode: "bypassPermissions"` 时 backend 配置了 `bypassPermissions` 模式（ACP 协议），backend **根本不发 `requestPermission`**，本方法永远不会被调用。以下逻辑仅适用于 `"default"` 和 `"auto"` 模式。

```
permission_mode = "default"  → ApprovalHandler.evaluate("default", params)
                                 auto: true  → recorder.append(permission_response)，resolve
                                 auto: false → recorder.append(permission_request{pending})，挂入 pendingPermissions
permission_mode = "auto"     → ApprovalHandler.evaluate("auto", params)（异步）
                                 auto: true  → recorder.append(permission_response)，resolve
                                 auto: false → recorder.append(permission_request{pending})，挂入 pendingPermissions
```

注：`appendEvent()` 返回 `seq`，存入 `pendingPermissions` 的 `PendingRequest` 结构中，供后续 `updateEventStatus(seq)` 使用。

### Backend client tool call 超时对齐

Backend 端（`clientToolCompletionRegistry.registerToolOptions`）对 client tool call 有约 60 秒超时。`DetachedConnection` 在 `pendingToolCalls` 中同样设置 60 秒超时：超时后 reject 对应 Promise，从 map 中移除，并通过 `recorder.updateStatus(seq, "abandoned")` patch 原 `client_tool_call(pending)` 事件。`resume()` 时跳过已超时的 tool call。

### `requestClient` 处理逻辑

追加 `client_tool_call` 事件（status: "pending"），记录返回的 `seq`，挂入 `pendingToolCalls` 等待重连后执行。同时启动 60 秒超时定时器。

### 写入触发时机

事件发生时立即通过 recorder 追加写入 JSONL，不再依赖 detached 状态下的 5 秒定时刷盘。`parkSession()` 只切换连接代理和更新 meta 状态，不负责补写 active 阶段历史。

### 历史回放策略

**不使用逐条 `sessionUpdate` 推送**（会导致 streaming chunk 重复拼接、UI 闪烁）。

改为：在 `session/load` 响应中通过扩展字段 `history` 携带完整历史事件列表，前端一次性批量渲染，不经过 `onSessionUpdate` 流式回调。

```typescript
// AcpLoadSessionResponse 扩展（gateway 侧填充）
interface AcpLoadSessionResponse {
  sessionId: string;
  configOptions?: AcpConfigOption[];
  history?: AcpSessionEvent[];   // 新增：历史事件列表，前端批量渲染
}
```

### History 截止点

`resume()` 被调用时先将 detached 状态切换为 draining，阻止新的 pending drain 并发启动；然后等待当前事件 append 完成，从 `recorder.loadHistory()` 读取 history。此后 backend 产生的新事件，通过 `newConnection.sessionUpdate()` 直接推送，同时仍由 active connection 的 recorder 写入 JSONL。

前端需要能够处理"history 渲染完成后立即收到流式 sessionUpdate"的情况，按 seq 顺序展示即可。

### `resume()` 方法

```typescript
async resume(newConnection: AcpConnection): Promise<AcpSessionEvent[]> {
  // 从 JSONL 读取完整历史。history 不来自内存 buffer。
  const history = await this.recorder.loadHistory();

  // 异步处理 pending 请求，不阻塞 resume() 返回
  // 这样 loadSession 响应可以立即携带 history 返回给前端
  this.drainPendingAsync(newConnection);

  return history;
}

// 异步推送 pending 请求给新连接，串行处理保证 backend 收到正确的响应顺序
private async drainPendingAsync(newConnection: AcpConnection): Promise<void> {
  if (this.draining) return;
  this.draining = true;

  const sortedPermissions = [...this.pendingPermissions.entries()]
    .sort((a, b) => a[1].seq - b[1].seq);

  for (const [id, pending] of sortedPermissions) {
    try {
      const decision = await newConnection.requestPermission(pending.params);
      pending.resolve(decision);
      await this.recorder.updateStatus(pending.seq, "resolved");
    } catch (err) {
      pending.reject(err);
    }
    this.pendingPermissions.delete(id);
  }

  const sortedTools = [...this.pendingToolCalls.entries()]
    .sort((a, b) => a[1].seq - b[1].seq);

  for (const [id, pending] of sortedTools) {
    try {
      const result = await newConnection.requestClient("_viben/client_tool_call", pending.params);
      pending.resolve(result);
      await this.recorder.updateStatus(pending.seq, "resolved");
    } catch (err) {
      pending.reject(err);
    }
    this.pendingToolCalls.delete(id);
  }

  this.draining = false;
}
```

### 生命周期

- **创建**：`parkSession()` 使用当前 session 的 recorder 创建 `DetachedConnection`
- **恢复**：`resume()` 从 JSONL 读取完整 history，并异步 drain pending 请求
- **关闭**：`close()` reject 所有 pending 请求，并 patch 仍为 pending 的事件为 `cancelled`

---

## 五、`AcpSessionManager` 改造

### 新增方法

```typescript
// 断开时：换成 DetachedConnection，backend 继续运行
async parkSession(sessionId: string, closingConnection?: AcpConnection): Promise<void>

// 重连时：换回真实连接，回放历史 + 异步 resume pending
async resumeSession(
  sessionId: string,
  newConnection: AcpConnection
): Promise<AcpSessionEvent[]>
```

### `parkSession()` 实现

```
1. 取出 session，若不存在则 return
2. Guard：if session.connection instanceof DetachedConnection → log.warn + return（防止重复 park）
3. Guard：若传入 `closingConnection` 且 `session.connection !== closingConnection`，说明 session 已被新 WebSocket 接管，直接 return，避免旧连接 close park 掉新连接
4. 读取 permission_mode：session.agent_config?.permission_mode ?? "default"
5. 使用 session.recorder 创建 DetachedConnection（传入 recorder、sessionId、permission_mode）
6. session.connection = detachedConnection
7. store.saveRecord({ ...record, status: "parked", agent_capabilities: session.agentCapabilities })
```

### `loadSession()` 改造

```
loadSession(request, newConnection: AcpConnection, context) →

  case 内存有 session，connection 是 DetachedConnection（正常断线重连）：
    // 1. 通知 backend：session 正在被 resume（ACP session/resume 协议）
    //    backend 可能在连接断开后暂停了推送，此信号让它继续
    await backend.acpClient.sessionResume({ sessionId: session.sdk_session_id })

    // 2. resume DetachedConnection：从 JSONL 返回完整 history，异步处理 pending
    history = await detachedConn.resume(newConnection)
    session.connection = newConnection
    session.last_active_at = new Date()
    store.saveRecord({ ...record, status: "active" })
    return { sessionId, configOptions, history }

  case 内存有 session，connection 是普通连接（如刷新页面）：
    session.connection = newConnection
    session.last_active_at = new Date()
    return { sessionId, configOptions }

  case 内存无，磁盘有（gateway 重启后恢复）→
    record = store.loadRecord(id)
    session = createSessionRecord(request, newConnection, context)

    // 关键：用 sdk_session_id 恢复 backend 上下文（ACP session/load 原生协议）
    // ensureBackend() 会以 backend_load_session_id 作为 ACP session/load 请求的 sessionId 字段
    session.backend_load_session_id = record.sdk_session_id
    session.sdk_session_id = record.sdk_session_id
    sessions.set(id, session)

    allEvents = store.loadEvents(id)

    // 统一用 history 字段返回（与正常重连路径一致，不逐条 sessionUpdate）
    const history = allEvents.filter(e => e.type === "session_update")

    // pending 事件标为 abandoned（backend 已不在等待，subprocess 已死）
    for (const event of allEvents) {
      if (event.status === "pending") {
        await recorder.updateStatus(event.seq, "abandoned")
      }
    }

    return { sessionId: id, configOptions: session.config_options, history }

  case 都没有 →
    createSessionRecord(...)   // 现有逻辑，status: "active"
    store.saveRecord(record)
    return { sessionId, configOptions }
```

**关于 `session/load` vs `session/resume`（ACP 协议）：**

| 场景 | ACP 调用 | 说明 |
|------|---------|------|
| gateway 重启，backend 也死了 | `session/load { sessionId: sdk_session_id }` | backend 重新加载保存的上下文 |
| frontend WS 断开，backend 仍运行 | `session/resume { sessionId: sdk_session_id }` | backend 继续推送流式数据 |

### `listSessions()` 改造

```
// 三路合并，得到完整 session 列表

// 1. 内存 Map（in-memory，最准确，包含 active/parked sessions）
const memorySessions = [...this.sessions.values()]

// 2. 向 backend 查询（ACP session/list 原生协议）
//    backend 知道它当前持有哪些 session（可能因 gateway 重启而不同步）
const backendSessions = await backend.acpClient.sessionList()
//    backendSessions 包含 backend 自己知道的 sdk_session_id 列表

// 3. 磁盘 parked records（backend 已不持有，纯磁盘记录）
const diskRecords = await store.listRecords()

// 合并规则：内存优先 > backend 补充 > 磁盘 parked
// 按 last_active_at 降序排序

parked sessions 转换为 AcpSessionSummary：
  queueDepth: 0
  promptRunning: false
  agentCapabilities: record.agent_capabilities ?? DEFAULT_AGENT_CAPABILITIES
  status: "parked"
```

### `createSession()` 改造

创建 session record（`status: "active"`）后立即 `store.saveRecord()`。

### `ensureBackend()` 改造

`session.sdk_session_id = backend.backendSessionId` 赋值后，同步调用 `store.saveRecord()` 更新磁盘，同时写入 `title` 和 `agent_capabilities`：

```
title = backend.agentCapabilities?._meta?.title
     ?? session.agent_config?.name
     ?? undefined
agent_capabilities = backend.agentCapabilities
```

### `closeSession()` 改造

显式关闭（用户主动关闭，非 WebSocket 断开）时：
1. 清除 `DetachedConnection` 的定时器（若存在）并执行最终刷盘
2. 向 backend 发送 **`session/close { sessionId: session.sdk_session_id }`**（ACP 原生协议），让 backend 正确清理内部状态
3. `store.saveRecord({ ...record, status: "finished" })`（保留 JSONL 历史）
4. `sessions.delete(id)`

> 注：`store.deleteRecord()` 仅在前端调用"删除会话"（物理删除，彻底清除磁盘文件）时使用。

---

## 六、`permission_mode` 类型变更

### 类型定义

使用 **ACP 协议原生的 permission mode 变量名**，与 `normalizeClaudePermissionMode()` 中的规范名称保持一致：

```typescript
// packages/core/src/acp/types.ts
export type AcpPermissionMode =
  | "default"
  | "bypassPermissions"
  | "auto"
  | "acceptEdits"
  | "dontAsk"
  | "plan";
```

| `permission_mode` | ACP 协议含义 | Backend 行为 | Gateway 行为 |
|-------------------|-------------|-------------|-------------|
| `"default"` | 标准权限模式 | Backend 正常发 `requestPermission` | Gateway `ApprovalHandler` 拦截，按规则自动通过或挂起 |
| `"bypassPermissions"` | 跳过所有权限 | Backend **完全不发 `requestPermission`** | 无需 approval 逻辑，`pendingPermissions` 永远为空 |
| `"auto"` | 自动/AI 模式 | Backend 正常发 `requestPermission` | Gateway `ApprovalHandler` 调用 AI 判断，AI 决定或挂起 |
| `"acceptEdits"` / `"dontAsk"` / `"plan"` | 既有 backend 原生模式 | 保持现有行为，不在本迁移中删除 | Gateway 透传给 backend，避免旧 YAML 行为变化 |

### 变更清单

| 文件 | 变更内容 |
|------|---------|
| `packages/core/src/acp/types.ts` | 新增 `AcpPermissionMode` 类型；`AgentConfigPayload.permission_mode` 从 `string` 改为包含新旧合法值的 `AcpPermissionMode`；保留 `approval_mode` 作为 legacy read-only 字段 |
| `packages/core/src/acp/ops/backend-adapter.ts` | `normalizeClaudePermissionMode()` 的 `CLAUDE_PERMISSION_MODES` 添加 `"auto"`，继续保留 `"acceptEdits"`、`"dontAsk"`、`"plan"` |
| `packages/core/src/agents/types.ts` | `AgentConfigFile`：新增 `permission_mode?: AcpPermissionMode`，保留 `approval_mode?: "bypass" | "rules" | "ai"` 作为 legacy read-only 字段 |
| `packages/core/src/agents/index.ts` | 读取 YAML 时归一化 `approval_mode` / `approvals` → `permission_mode`；新写入只写 `permission_mode`，保留 `planMode` 不动 |
| `packages/core/src/types/index.ts` | 同步相关 Agent 类型中的字段 |
| `apps/desktop/src/lib/gateway/types/agent.ts` | gateway 客户端类型同步 |
| `apps/desktop/src/types/unified-agent.ts` | 前端 unified agent 类型同步 |
| `apps/desktop/src/components/acp-chat/acp-client.ts` | `AgentConfigPayload.permission_mode` 类型收窄为 `AcpPermissionMode` |

### `permission_mode` → Backend ACP 机制

`permission_mode` 直接通过 `agent_config.permission_mode` 传给 backend（ACP `session/new` / `session/load` 请求），backend 在 `prepareClaudeConfigDir()` 中写入 `settings.json` 的 `permissions.defaultMode`：

```typescript
// packages/core/src/acp/ops/backend-adapter.ts（已有逻辑，仅修改 normalizeClaudePermissionMode）
const requestedMode = normalizeClaudePermissionMode(context.agentConfig?.permission_mode);
// "default"            → permissions.defaultMode = "default"
// "bypassPermissions"  → permissions.defaultMode = "bypassPermissions"
// "auto"               → permissions.defaultMode = "auto"（新增支持）
// "acceptEdits"        → permissions.defaultMode = "acceptEdits"（legacy 透传）
// "dontAsk"            → permissions.defaultMode = "dontAsk"（legacy 透传）
// "plan"               → permissions.defaultMode = "plan"（legacy 透传）
```

有效 permission mode 的计算（在 `DetachedConnection` 和 `SdkAcpConnection` 中均适用）：

```
effective_mode =
  global_prefs.dangerously_skip_permissions
    ? "bypassPermissions"             // 全局 bypass 优先（开发者偏好）
    : session.agent_config?.permission_mode ?? "default"
```

> `dangerously_skip_permissions` 是全局开发者偏好（`git config` 存储），与 agent 级别的 `permission_mode` 是两个独立来源，两者均保留。

### YAML 字段

```yaml
permission_mode: "default"           # 规则审批（默认）
# permission_mode: "bypassPermissions"  # 绕过审批
# permission_mode: "auto"               # AI 自动审批
```

### 向后兼容迁移

读取旧 YAML 时（`agents/index.ts` 的 YAML 读取处）：

```
permission_mode 已存在且合法 → 保持原值（包括 acceptEdits / dontAsk / plan）
approval_mode: "bypass" → permission_mode: "bypassPermissions"
approval_mode: "rules"  → permission_mode: "default"
approval_mode: "ai"     → permission_mode: "auto"
approvals: true         → permission_mode: "bypassPermissions"
approvals: false        → permission_mode: "default"
无 legacy 字段          → permission_mode: "default"（默认）
```

迁移优先级：`permission_mode` > `approval_mode` > `approvals` > 默认值。保存 YAML 时不再写 `approval_mode` 或 `approvals`。

---

## 七、`agent-acp.ts` 改造

### 断开时（原 closeSession → 改为 parkSession）

```typescript
socket.once("close", async () => {
  for (const sessionId of ownedSessionIds) {
    await acpSessionManager.parkSession(sessionId, connection);
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

### 多 WebSocket 连接同一 Session

`ownedSessionIds` 按 WebSocket 连接管理。若第二个连接 `loadSession` 了同一 session，`AcpSessionManager.loadSession()` 会把 `session.connection` 切换到第二个连接。第一个连接 close 时仍会遍历自己的 `ownedSessionIds`，因此必须把正在关闭的 connection 传入 `parkSession(sessionId, closingConnection)`。

`parkSession()` 只有在 `session.connection === closingConnection` 时才允许 park；否则说明 session 已被新连接接管，应跳过。当前版本仍不支持两个活跃连接同时操作同一 session，但旧连接关闭不能破坏新连接。

---

## 八、`approval-handler.ts`

```typescript
// packages/core/src/acp/ops/approval-handler.ts

export interface ApprovalHandler {
  evaluate(
    params: AcpRequestPermissionRequest,
    permissionMode: AcpPermissionMode
  ): Promise<ApprovalDecision>;
}

export type ApprovalDecision =
  | { auto: true; optionId: string }   // 自动决定，直接 resolve
  | { auto: false };                    // 需要人工，挂起
```

- `"default"`：检查工具名、命令模式等规则，能自动决定则 `auto: true`，否则 `auto: false` 挂起
- `"auto"`：调用 AI 判断；AI 决定安全 → `auto: true`；AI 决定不安全或超时 → `auto: false` 挂起
- `"bypassPermissions"`：**不经过 `ApprovalHandler`**——backend 配置了 `bypassPermissions` 模式（ACP 协议），根本不发 `requestPermission`，gateway 永远不会收到权限请求，`ApprovalHandler.evaluate()` 不会被调用

初版 `"auto"` 实现可为 stub（直接返回 `auto: false`），待后续接入 LLM。

### ApprovalHandler 在活跃连接中的集成

`ApprovalHandler` **不只在 `DetachedConnection` 中使用**。当 session 处于活跃连接状态（`SdkAcpConnection`），`requestPermission` 同样应先经过 `ApprovalHandler.evaluate()` 过滤（使用上述 `effective_mode` 计算逻辑），自动通过的请求无需打断用户，只有 `auto: false` 时才真正推送给前端等待用户决策。

集成位置：`SdkAcpConnection.requestPermission()` 在向 WebSocket 推送权限请求前，先调用 `ApprovalHandler.evaluate()`：

```
requestPermission(params):
  // bypassPermissions 模式下 backend 配置了 bypassPermissions，不发 requestPermission，此处不会被调用
  // 以下逻辑仅在 effective_mode 为 "default" 或 "auto" 时触发
  effective_mode = dangerously_skip_permissions ? "bypassPermissions" : agent_config.permission_mode ?? "default"
  decision = approvalHandler.evaluate(params, effective_mode)
  if decision.auto → 直接 resolve(decision.optionId)，无需 UI 交互
  else             → 走原有 WebSocket push → 等待前端 permission:response
```

这样 `ApprovalHandler` 在活跃和断开两种状态下保持一致，不在两处维护重复的规则判断逻辑。

---

## 九、会话清理与超时机制

### 策略

| 情形 | 处理 |
|------|------|
| 用户主动删除会话（前端 deleteSession） | 立即 `store.deleteRecord()` + 删除 session 目录（物理删除） |
| 用户主动关闭会话（前端 closeSession） | `store.saveRecord(status: "finished")`，保留 JSONL 历史 |
| Parked 超过 TTL（默认 7 天） | 后台清理任务标记为 `finished`，不删除 JSONL |
| Finished/error 超过归档 TTL（默认 30 天） | 可配置自动删除（默认关闭） |

### 实现

gateway 启动时运行一次清理扫描：

```typescript
async function cleanupStaleSessions(store: AcpSessionStore, parkTTLDays = 7): Promise<void> {
  const records = await store.listRecords();
  const now = Date.now();
  for (const record of records) {
    if (record.status === "parked") {
      const age = now - new Date(record.last_active_at).getTime();
      if (age > parkTTLDays * 24 * 60 * 60 * 1000) {
        await store.saveRecord({ ...record, status: "finished" });
      }
    }
  }
}
```

- 定期清理（每小时）可选：在 gateway 中注册定时任务
- TTL 可通过 gateway 配置文件覆盖

---

## 十、前端变更（apps/desktop）

### `acp-client.ts`

`AgentConfigPayload` 新增 `permission_mode?: AcpPermissionMode`（保留 `approvals?: boolean` 仅用于向后兼容读取，新写入使用 `permission_mode`）。

### `use-acp-session.ts`

**loadSession 响应处理**：当响应包含 `history?: AcpSessionEvent[]` 时，走批量渲染路径：

```typescript
const response = await acpClient.loadSession(request);
if (response.history && response.history.length > 0) {
  batchRenderHistory(response.history);
}
// 之后正常绑定 sessionUpdate / requestPermission 等回调
```

**`batchRenderHistory()` 实现路径**：

```typescript
function batchRenderHistory(events: AcpSessionEvent[]): void {
  // 收集所有 session_update 事件的 UI steps（复用现有转换函数）
  const allSteps: AcpUiStep[] = [];
  for (const event of events) {
    if (event.type === "session_update") {
      const steps = acpSessionUpdateToUiSteps(event.data as AcpSessionUpdate);
      allSteps.push(...steps);
    }
  }
  // 一次性非队列应用（不走 enqueueUiSteps 动画队列）
  applyUiStepsImmediately(setSessionsById, sessionId, allSteps);
}
```

注意事项：
- `session_update` 事件的 `data` 字段为 `AcpSessionUpdate`，通过现有 `acpSessionUpdateToUiSteps()` 转换
- history 中的 agent_message_chunk 事件通过 `applyUiStepsImmediately` 顺序拼接成完整消息，不显示流式动画
- `permission_request` 事件：`status === "pending"` 的请求由 `drainPendingAsync()` 异步推送，前端会在 history 渲染后收到正常的 `requestPermission` 回调，提示用户"恢复的权限请求"；其他状态（resolved/abandoned）仅作历史展示

**`listSessions` 响应**：服务端会返回 `parked` 状态的 session，前端 session 列表需要读取并展示 `status` 字段：
- `active`：正常展示
- `parked`：显示"已暂停"标识（如灰色背景、badge）
- `finished`：可选展示或折叠

### 相关文件

| 文件 | 变更内容 |
|------|---------|
| `apps/desktop/src/components/acp-chat/acp-client.ts` | `AgentConfigPayload` 新增 `permission_mode` |
| `apps/desktop/src/components/acp-chat/use-acp-session.ts` | `loadSession` 添加 `history` 批量渲染，`batchRenderHistory` 函数 |
| `apps/desktop/src/components/acp-chat/acp-chat-state.ts` | 新增 `applyUiStepsImmediately` 路径（如不存在） |
| `apps/desktop/src/lib/gateway/types/agent.ts` | 同步 `permission_mode` 字段 |
| `apps/desktop/src/types/unified-agent.ts` | 同步 `permission_mode` 字段 |
| session 列表 UI 组件 | 展示 session `status`，parked 状态视觉标识 |

### `agent_config` 快照语义

**设计决策**：`AcpSessionRecord.agent_config` 存储的是 session 创建时的配置快照。重连恢复的 session 使用原始配置，而不是当前 agent YAML 的最新配置。如需使用新配置，用户应创建新 session。
