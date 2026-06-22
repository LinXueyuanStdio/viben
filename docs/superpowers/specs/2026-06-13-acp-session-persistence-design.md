# ACP Session 持久化设计

## 背景

`AcpSessionManager` 当前只将 session 存储在内存 Map 中。WebSocket 断开时 `closeSession()` 直接从 Map 删除 session；重连后 `listSessions()` 返回空，前端只能新建 session 而无法恢复。

目标：实现 session 持久化，支持断线重连恢复，后端进程在断开期间继续运行并缓冲输出，重连后回放历史并处理挂起的交互请求。

---

## 一、总体架构

### 核心设计原则

**Session list 使用全局数据库作为单一事实来源，session 事件缓冲继续使用文件。** ACP session 的可枚举元数据（用于 `session/list`、跨 workspace 恢复、状态清理）存入全局 SQLite 表；每个 session 的流式事件日志仍追加到 JSONL 文件，避免把高频 token/chunk 写入同步数据库路径。存储层必须通过 adapter 接口访问，后续可把 JSONL event store 替换为数据库 event store，而不改 `AcpSessionManager` 的业务逻辑。

### 新增文件

```
packages/core/src/acp/ops/
  session-storage.ts       ← AcpSessionStorageAdapter 聚合接口 + 默认组合实现
  session-index-store.ts   ← AcpSessionIndexStore 接口 + SQLite 默认实现（全局 session list）
  session-event-store.ts   ← AcpSessionEventStore 接口 + JSONL 文件默认实现（缓冲事件）
  session-event-recorder.ts ← 统一记录 active/detached 两种连接状态的事件
  detached-connection.ts   ← 断开时的连接代理（内存缓冲 + 刷盘 + 挂起管理）
  permission-handler.ts    ← 三种 permission 模式的处理逻辑
```

### 生命周期

```
WS 连接建立
    ↓
newSession / loadSession → 写入内存 Map + upsert acp_sessions（status: "active"）
    ↓
执行中：backend 流式 → sessionUpdate → AcpSessionEventRecorder.append() → SdkAcpConnection → 前端
    ↓
WS 断开 → parkSession()
    ├── 换成 DetachedConnection（继续记录事件，不向旧 WebSocket 推送）
    ├── backend 进程继续运行
    ├── SQLite `acp_sessions.status` 标记为 "parked"
    └── 后续 sessionUpdate / permission / client tool 仍追加写入 events.jsonl

WS 重连 → loadSession(request)
    ├── 内存有（正常断线重连，connection 是 DetachedConnection）：
    │     detachedConn.resume(newConnection) → 返回从 events.jsonl 读取的完整 history
    │     loadSession 响应携带 history 字段
    │     resume() 异步处理 pending permission/tool_call（不阻塞响应返回）
    └── 内存无（gateway 重启）：
          从 acp_sessions 读取 executor_type + session_id + cwd / agent 路径缓存
          重建 session，并按 executor_type 路由调用 ACP session/load { sessionId }
          回放 events.jsonl → 收集 session_update 事件放入 history
          pending 事件标为 abandoned
          loadSession 响应携带 history 字段
```

### ACP 原生能力利用

Backend（claude-code）在 `initialize` 响应中声明的能力，本设计均应充分利用，不重复造轮子：

| ACP 能力 | 本设计中的用途 |
|---------|--------------|
| `agentCapabilities.loadSession: true` | gateway 重启后按 `executor_type` 路由，并调用 `session/load { sessionId }` 恢复 backend 上下文（ACP 原生协议，不是自定义机制） |
| `sessionCapabilities.resume` | WS 重连时向 backend 发 `session/resume { sessionId }` 通知其继续流式输出（backend 可能在连接断开后暂停推送） |
| `sessionCapabilities.list` | `listSessions()` 可向活跃 backend 请求 `session/list` 刷新 SQLite index；最终返回仍以 SQLite index 为事实来源 |
| `sessionCapabilities.close` | 用户主动关闭 session 时发 `session/close { sessionId }`，backend 正确清理内部状态 |
| `_meta.claudeCode.promptQueueing: true` | backend 支持在前一 prompt 执行中接受新 prompt；断开期间若有 prompt 未完成，重连后继续消费 |
| `dangerously_skip_permissions` in agent_config | `permission_mode: "bypassPermissions"` 时 backend 进入 `bypassPermissions` 模式，彻底不发 `requestPermission` |

**协议层边界**（重要）：

```
前端 ←─── Gateway WebSocket（gateway 自定义协议，含 history 字段扩展）─────→ Gateway
Gateway ←── ACP 协议（session/new, session/load, session/resume, session/list, session/close,
              requestPermission, sessionUpdate...）───────────────────────────→ Backend（claude-code）
```

本设计的 `history` 字段、`AcpSessionStorageAdapter`、`DetachedConnection` 均在 Gateway 层，不影响 ACP 协议本身。

### 事件记录边界

所有会影响恢复的事件都通过 `AcpSessionEventRecorder` 追加到当前 `AcpSessionEventStore`，默认实现为 `events.jsonl`，包括 active WebSocket 连接期间的 `sessionUpdate`、`requestPermission`、`requestClientTool`、响应和通知。`SdkAcpConnection` 与 `DetachedConnection` 只能负责"推送给当前连接或挂起等待"，不能各自维护一套持久化语义。

**history 的来源**：`session/load` 响应中的 `history` 始终来自 `storage.events.loadEvents({ executor_type, session_id })` 的结果，而不是 `DetachedConnection` 的内存缓冲。正常断线重连时，`resume()` 先停止 detached 状态、等待当前事件写入完成，然后从 event store 读取截止点历史；gateway 重启恢复时也使用同一读取路径。这样断线超过 5 秒、已经刷盘的事件、以及恢复前最后一批事件都不会因为内存 buffer 被清空而丢失。

`DetachedConnection` 可以保留极短期的内存结构用于 pending request 的 Promise 管理，但该结构不是 history 的事实来源。pending 的 `seq` 必须来自 `appendEvent()` 返回值；超时、取消、恢复后解决都必须通过 `updateEventStatus()` patch 原事件，而不是追加第二条同类型事件。

### 数据丢失边界

**设计决策（trade-off 声明）：**

- **单事件追加窗口**：事件 append 调用返回前如果进程崩溃，该事件可能尚未落盘；append 返回后的事件必须可通过 `loadEvents()` 恢复
- **Gateway crash = Backend crash**：当前 backend 是 gateway 的子进程（`SubprocessAcpBackendAdapter`），gateway 进程终止时 backend 子进程同时收到信号退出。因此：
  - 内存中的 pending map 丢失 → backend 也已死，不存在 backend 挂起等待响应的状态不一致问题
  - gateway 重启后从 SQLite 读取 session list，从 event store 读取 JSONL，所有 `status: "pending"` 的事件统一标为 `abandoned`，不会永久挂起
- **未来兼容**：如果未来支持远程 backend（backend 独立于 gateway 运行），需要额外设计 backend 侧的 orphan timeout 机制（不在本 spec 范围内）

---

## 二、存储层 — Index DB + Event Store + Storage Adapter

### 文件布局

```
~/.viben/acp/
  sessions.sqlite              ← 全局 session list / 元数据索引
  sessions/
    <executor_type>/
      <session_id>/
      events.jsonl             ← append-only 完整事件流（事件行 + patch 行混合）
```

`sessions.sqlite` 是 `session/list` 的事实来源，`events.jsonl` 是 session history / reconnect replay 的事实来源。两者通过相同的 `executor_type + session_id` 复合身份关联。新实现不创建 `meta.json`，也不使用文件元数据作为 session list 来源。

### SQLite 表：`acp_sessions`

默认实现使用 `node:sqlite`，与现有 `SqliteAcpSteerPromptStore` 保持一致，不引入新数据库依赖。数据库路径默认 `~/.viben/acp/sessions.sqlite`。

```sql
CREATE TABLE IF NOT EXISTS acp_sessions (
  executor_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,

  cwd TEXT NOT NULL,
  workspace_path TEXT,
  agent_dir TEXT,
  agent_config_path TEXT,
  backend_id TEXT,

  title TEXT,
  permission_mode TEXT,
  acp_record_json TEXT NOT NULL DEFAULT '{}',

  persist_session_id TEXT,
  persist_task_id TEXT,
  gateway_url TEXT,

  event_store_type TEXT NOT NULL DEFAULT 'jsonl',
  event_store_uri TEXT NOT NULL,
  event_last_seq INTEGER NOT NULL DEFAULT -1,

  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  parked_at TEXT,
  finished_at TEXT,
  deleted_at TEXT,
  last_error_json TEXT,

  schema_version INTEGER NOT NULL DEFAULT 1,
  meta_json TEXT,

  PRIMARY KEY (executor_type, session_id)
);

CREATE INDEX IF NOT EXISTS idx_acp_sessions_status_last_active
  ON acp_sessions (status, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_acp_sessions_executor_status_last_active
  ON acp_sessions (executor_type, status, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_acp_sessions_cwd_last_active
  ON acp_sessions (cwd, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_acp_sessions_agent_config_path
  ON acp_sessions (agent_config_path);
CREATE INDEX IF NOT EXISTS idx_acp_sessions_persist_task
  ON acp_sessions (persist_task_id, last_active_at DESC);
```

字段语义：

| 字段 | 说明 |
|------|------|
| `executor_type` + `session_id` | 复合身份。`session_id` 是执行器/ACP 侧 session ID，只在同一 `executor_type` 下唯一；不同执行器允许出现相同 `session_id` |
| `status` | `"active" | "parked" | "finished" | "error"`；list 默认返回 active/parked，可按需包含 finished/error |
| `cwd` | session 创建时的工作目录 |
| `workspace_path` | workspace 根路径；若暂时无法可靠解析，写入 `cwd`，后续迁移可更新 |
| `agent_dir` | agent YAML 所在目录或内联 agent 的逻辑目录 |
| `agent_config_path` | agent YAML 路径；inline config 可为空 |
| `executor_type` | 执行器类型，如 `CLAUDE_CODE`、`CODEX`、`CODEX_APP_SERVER`，从 `agent_config.executor_type` 或 backend 默认值解析 |
| `backend_id` | 解析后的 ACP backend 模板 ID，如 `claude`、`codex`，用于排查和迁移 |
| `title` | UI 展示标题，优先 `agentCapabilities._meta.title`，其次 `agent_config.name` |
| `permission_mode` | 创建/恢复时使用的权限模式缓存；不是执行器完整配置 |
| `acp_record_json` | 从 ACP `session/list`、`session/new`、`session/load` 响应转换后的规范化 list/cache 记录；只作为 Gateway 缓冲，不保存执行器完整 session 记录 |
| `persist_session_id` / `persist_task_id` | 与现有 task/session persistence 关联的 ID |
| `gateway_url` | 创建 session 时使用的 gateway URL |
| `event_store_type` | 当前为 `jsonl`；预留 `sqlite` / `remote` |
| `event_store_uri` | 当前为 `~/.viben/acp/sessions/<executor_type>/<session_id>/events.jsonl`，未来 DB event store 可写逻辑 URI |
| `event_last_seq` | event store 已知最大 seq，用于 list/debug，不作为唯一 seq 分配来源 |
| `created_at` / `last_active_at` / `parked_at` / `finished_at` / `deleted_at` | 生命周期时间戳；删除默认软删除，物理删除同时清理 event store |
| `last_error_json` | 最近一次 session error 的结构化信息 |
| `schema_version` / `meta_json` | 未来迁移和扩展字段 |

重要边界：数据库不保存执行器内部 session 的完整记录，也不把 `session_id` 改造成 Gateway 全局 ID。执行器自己负责维护 `session_id` 对应的完整上下文；Gateway 只缓存 ACP 接口转换后的 list/load 所需字段，作用是全局展示、恢复路由和断线缓冲索引。

### 类型定义

```typescript
// packages/core/src/acp/ops/session-index-store.ts

export type AcpSessionRecordStatus = "active" | "parked" | "finished" | "error";
export type AcpSessionEventStoreType = "jsonl" | "sqlite" | "remote";

export interface AcpSessionRecord {
  executor_type: string;
  session_id: string;
  status: AcpSessionRecordStatus;
  cwd: string;
  workspace_path?: string;
  agent_dir?: string;
  agent_config_path?: string;
  backend_id?: string;
  title?: string;
  permission_mode?: AcpPermissionMode;
  acp_record: Record<string, unknown>;
  persist_session_id?: string;
  persist_task_id?: string;
  gateway_url?: string;
  event_store_type: AcpSessionEventStoreType;
  event_store_uri: string;
  event_last_seq: number;
  created_at: string;
  last_active_at: string;
  parked_at?: string;
  finished_at?: string;
  deleted_at?: string;
  last_error?: AcpErrorDetail;
  meta?: Record<string, unknown>;
}

export interface ListAcpSessionRecordsInput {
  executor_type?: string;
  statuses?: AcpSessionRecordStatus[];
  include_deleted?: boolean;
  cwd?: string;
  workspace_path?: string;
  agent_config_path?: string;
  persist_task_id?: string;
  limit?: number;
  cursor?: string;
}

export interface AcpSessionIndexStore {
  upsertRecord(record: AcpSessionRecord): Promise<void>;
  getRecord(executorType: string, sessionId: string): Promise<AcpSessionRecord | null>;
  findBySessionId(sessionId: string): Promise<AcpSessionRecord[]>;
  listRecords(input?: ListAcpSessionRecordsInput): Promise<AcpSessionRecord[]>;
  updateStatus(
    executorType: string,
    sessionId: string,
    status: AcpSessionRecordStatus,
    patch?: {
      last_active_at?: string;
      parked_at?: string;
      finished_at?: string;
      last_error?: AcpErrorDetail;
    }
  ): Promise<void>;
  updateEventCursor(executorType: string, sessionId: string, eventLastSeq: number): Promise<void>;
  softDeleteRecord(executorType: string, sessionId: string, deletedAt: string): Promise<void>;
  hardDeleteRecord(executorType: string, sessionId: string): Promise<void>;
}
```

```typescript
// packages/core/src/acp/ops/session-event-store.ts

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
  id?: string;
  status?: "pending" | "resolved" | "cancelled" | "abandoned";
  request_id?: string;
  data: unknown;
}

export interface AcpSessionEventPatch {
  _type: "patch";
  target_seq: number;
  patch: { status: AcpSessionEvent["status"] };
}

export interface AcpSessionEventIdentity {
  executor_type: string;
  session_id: string;
}

export interface AcpSessionEventStore {
  appendEvent(identity: AcpSessionEventIdentity, event: Omit<AcpSessionEvent, "seq">): Promise<number>;
  loadEvents(identity: AcpSessionEventIdentity): Promise<AcpSessionEvent[]>;
  getEventStoreUri(identity: AcpSessionEventIdentity): string;
  updateEventStatus(
    identity: AcpSessionEventIdentity,
    seq: number,
    status: AcpSessionEvent["status"]
  ): Promise<void>;
  deleteEvents(identity: AcpSessionEventIdentity): Promise<void>;
}
```

```typescript
// packages/core/src/acp/ops/session-storage.ts

export interface AcpSessionStorageAdapter {
  index: AcpSessionIndexStore;
  events: AcpSessionEventStore;
}

export function createDefaultAcpSessionStorage(): AcpSessionStorageAdapter {
  return {
    index: createDefaultAcpSessionIndexStore(),
    events: createDefaultAcpSessionEventStore(),
  };
}
```

### Session ID 安全约束

`session_id` 既是数据库复合主键的一部分，也是 JSONL 默认文件路径的一部分，因此必须先校验再读取数据库或拼接路径。`executor_type` 同样必须规范化为已注册执行器类型或 backend 模板支持的类型。`session_id` 允许的格式为：

```
^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
```

额外约束：

- 禁止 `/`、`\`、`.` 开头、`..`、空字符串和长度超过 128 的 ID
- `JsonlAcpSessionEventStore.sessionDir(identity)` 默认路径为 `~/.viben/acp/sessions/<executor_type>/<session_id>/`，内部使用 `path.resolve` 校验结果仍在 event store 根目录下
- `SqliteAcpSessionIndexStore` 在 `getRecord()`、`upsertRecord()`、`updateStatus()`、`softDeleteRecord()`、`hardDeleteRecord()` 前校验 `executor_type` 和 `session_id`，避免无效记录留在全局 list 中
- `createSession()` 生成或接收的 `session_id` 必须和解析后的 `executor_type` 一起写入；`loadSession(request.sessionId)` 若未携带可解析的 `executor_type` 且数据库存在多个同名 session，应返回 ambiguous error，要求调用方提供 agent/executor 上下文

测试必须覆盖 `../x`、`a/b`、`..`、空字符串、超长 ID 均被拒绝；同一 `session_id` 可在不同 `executor_type` 下共存；无 `executor_type` 的 load 遇到冲突会明确失败。

### SQLite index store 实现说明

- `SqliteAcpSessionIndexStore` 初始化时创建 `acp_sessions` 表和索引
- 所有 JSON 字段用 `JSON.stringify` 写入，读取时容错解析；损坏 JSON 字段退回默认值并记录 warning，不影响 session list
- `upsertRecord()` 使用 `INSERT ... ON CONFLICT(executor_type, session_id) DO UPDATE`，保留原 `created_at`，更新 `last_active_at` 和缓存字段
- `listRecords()` 默认过滤 `deleted_at IS NULL` 和 `status IN ("active", "parked")`，按 `last_active_at DESC` 排序
- `softDeleteRecord()` 用于 UI 删除后隐藏列表；`hardDeleteRecord()` 仅在物理删除时使用，并由 storage adapter 同时调用 `events.deleteEvents({ executor_type, session_id })`

### JSONL event store 实现说明

- `JsonlAcpSessionEventStore` 默认路径为 `~/.viben/acp/sessions/<executor_type>/<session_id>/events.jsonl`
- `appendEvent()` 内部维护 per-session 的 `nextSeq` 计数器；若计数器不存在，先读取 `events.jsonl` 的最大 seq，使用 `maxSeq + 1` 初始化
- `appendEvent()` 只负责写入 event store 并返回 seq；由 `AcpSessionEventRecorder` 或上层 storage adapter 在 append 成功后调用 `index.updateEventCursor(executorType, sessionId, seq)`，避免 JSONL event store 反向依赖 SQLite index
- `updateEventStatus(seq, status)` 追加一条 `AcpSessionEventPatch` 行，避免重写整个文件
- `loadEvents()` 逐行解析，用 `_type === "patch"` 区分 patch 行和事件行；损坏行跳过并记录 warning；同一 `target_seq` 多个 patch last-write-wins
- 未来迁移到数据库时，实现 `SqliteAcpSessionEventStore`，保持 `AcpSessionEventStore` 接口不变

### 并发写锁

`appendEvent()` 和 `updateEventStatus()` 可能并发调用。`JsonlAcpSessionEventStore` 直接复用项目已有的 `AsyncLock`（`packages/core/src/utils/async-lock.ts`），实现 per identity 写锁，锁 key 为 `${executor_type}:${session_id}`：

```typescript
import { AsyncLock } from "../../utils/async-lock";

export class JsonlAcpSessionEventStore implements AcpSessionEventStore {
  private writeLock = new AsyncLock();

  async appendEvent(identity: AcpSessionEventIdentity, event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    return this.writeLock.withLock(lockKey(identity), async () => {
      const seq = await this.getNextSeq(identity);
      const line = JSON.stringify({ ...event, seq }) + "\n";
      await fs.appendFile(this.eventsPath(identity), line, "utf8");
      return seq;
    });
  }

  async updateEventStatus(identity: AcpSessionEventIdentity, seq: number, status: AcpSessionEvent["status"]): Promise<void> {
    return this.writeLock.withLock(lockKey(identity), async () => {
      const patch: AcpSessionEventPatch = { _type: "patch", target_seq: seq, patch: { status } };
      await fs.appendFile(this.eventsPath(identity), JSON.stringify(patch) + "\n", "utf8");
    });
  }
}
```

### Seq 初始化

`appendEvent()` 内部维护 `private seqCounters = new Map<string, number>()`。调用方不直接初始化 seq，也不依赖具体 event store 实现。

当某个 `sessionId` 首次 append 时，store 执行：

```typescript
private async getNextSeq(identity: AcpSessionEventIdentity): Promise<number> {
  const key = lockKey(identity);
  const current = this.seqCounters.get(key);
  if (current !== undefined) {
    this.seqCounters.set(key, current + 1);
    return current;
  }
  const events = await this.loadEvents(identity);
  const maxSeq = events.reduce((max, event) => Math.max(max, event.seq), -1);
  const next = maxSeq + 1;
  this.seqCounters.set(key, next + 1);
  return next;
}
```

### 导出

```typescript
export function createDefaultAcpSessionStorage(): AcpSessionStorageAdapter
```

---

## 三、`AcpSessionEventRecorder`

`AcpSessionEventRecorder` 是 active 和 detached 状态共享的事件记录层。它的职责是追加事件、维护 pending 事件 seq、patch 状态，并提供 history 读取；它不负责 WebSocket 推送，也不负责 backend 生命周期。

```typescript
export class AcpSessionEventRecorder {
  constructor(
    private readonly events: AcpSessionEventStore,
    private readonly identity: AcpSessionEventIdentity,
    private readonly index?: AcpSessionIndexStore
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
- `append()` 成功后若注入了 `AcpSessionIndexStore`，调用 `index.updateEventCursor(identity.executor_type, identity.session_id, seq)` 更新 SQLite 中的 `event_last_seq`
- `loadHistory()` 返回 `events.loadEvents(identity)` 结果，按 `seq` 升序；前端只渲染 `session_update`，但保留其他事件供 pending 恢复和调试

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
permission_mode = "default"  → PermissionHandler.evaluate("default", params)
                                 auto: true  → recorder.append(permission_response)，resolve
                                 auto: false → recorder.append(permission_request{pending})，挂入 pendingPermissions
permission_mode = "auto"     → PermissionHandler.evaluate("auto", params)（异步）
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

### 内部复合身份

Gateway 对外仍遵循 ACP 协议的 `sessionId` 字段，但 `AcpSessionManager` 内部不能用裸 `session_id` 作为 Map key。所有内存状态、owned session tracking、event recorder identity 都必须使用复合身份：

```typescript
interface AcpSessionIdentity {
  executor_type: string;
  session_id: string;
}

function sessionKey(identity: AcpSessionIdentity): string {
  return `${identity.executor_type}:${identity.session_id}`;
}
```

`loadSession(request.sessionId)` 若无法从 request/context 解析出唯一 `executor_type`，必须先查 `storage.index.findBySessionId(sessionId)`：0 条则按新建/未找到逻辑处理，1 条使用该记录，多条返回 ambiguous error，要求调用方提供 agent/executor 上下文。

### 新增方法

```typescript
// 断开时：换成 DetachedConnection，backend 继续运行
async parkSession(identity: AcpSessionIdentity, closingConnection?: AcpConnection): Promise<void>

// 重连时：换回真实连接，回放历史 + 异步 resume pending
async resumeSession(
  identity: AcpSessionIdentity,
  newConnection: AcpConnection
): Promise<AcpSessionEvent[]>
```

### `parkSession()` 实现

```
1. 通过 `sessionKey(identity)` 取出 session，若不存在则 return
2. Guard：if session.connection instanceof DetachedConnection → log.warn + return（防止重复 park）
3. Guard：若传入 `closingConnection` 且 `session.connection !== closingConnection`，说明 session 已被新 WebSocket 接管，直接 return，避免旧连接 close park 掉新连接
4. 读取 permission_mode：session.agent_config?.permission_mode ?? "default"
5. 使用 session.recorder 创建 DetachedConnection（传入 recorder、identity.session_id、permission_mode）
6. session.connection = detachedConnection
7. storage.index.updateStatus(identity.executor_type, identity.session_id, "parked", { parked_at, last_active_at })
```

### `loadSession()` 改造

```
loadSession(request, newConnection: AcpConnection, context) →

  case 内存有 session，connection 是 DetachedConnection（正常断线重连）：
    // 1. 通知 backend：session 正在被 resume（ACP session/resume 协议）
    //    backend 可能在连接断开后暂停了推送，此信号让它继续
    await backend.acpClient.sessionResume({ sessionId: session.session_id })

    // 2. resume DetachedConnection：从 JSONL 返回完整 history，异步处理 pending
    history = await detachedConn.resume(newConnection)
    session.connection = newConnection
    session.last_active_at = new Date()
    storage.index.updateStatus(session.executor_type, session.session_id, "active", { last_active_at })
    return { sessionId, configOptions, history }

  case 内存有 session，connection 是普通连接（如刷新页面）：
    session.connection = newConnection
    session.last_active_at = new Date()
    return { sessionId, configOptions }

  case 内存无，数据库有（gateway 重启后恢复）→
    record = resolveRecordByExecutorContextOrFindBySessionId(request.sessionId, context)
    identity = { executor_type: record.executor_type, session_id: record.session_id }
    session = createSessionRecord(request, newConnection, context)

    // 关键：用 executor_type + session_id 恢复 backend 上下文。
    // Gateway 不保存执行器完整 session，只把 session_id 传回对应执行器。
    session.executor_type = record.executor_type
    session.backend_load_session_id = record.session_id
    sessions.set(sessionKey(identity), session)

    // 必须实际调用 ACP session/load，让执行器恢复自己的上下文。
    await ensureBackend(session) // routes by record.executor_type and sends session/load { sessionId: record.session_id }

    allEvents = storage.events.loadEvents({ executor_type: record.executor_type, session_id: record.session_id })

    // 统一用 history 字段返回（与正常重连路径一致，不逐条 sessionUpdate）
    const history = allEvents.filter(e => e.type === "session_update")

    // pending 事件标为 abandoned（backend 已不在等待，subprocess 已死）
    for (const event of allEvents) {
      if (event.status === "pending") {
        await recorder.updateStatus(event.seq, "abandoned")
      }
    }

    return { sessionId: record.session_id, configOptions: session.config_options, history }

  case 都没有 →
    createSessionRecord(...)   // 现有逻辑，status: "active"
    storage.index.upsertRecord(record)
    return { sessionId, configOptions }
```

**关于 `session/load` vs `session/resume`（ACP 协议）：**

| 场景 | ACP 调用 | 说明 |
|------|---------|------|
| gateway 重启，backend 也死了 | `session/load { sessionId }` routed by `executor_type` | backend 根据自己的 `session_id` 重新加载保存的上下文 |
| frontend WS 断开，backend 仍运行 | `session/resume { sessionId }` routed by `executor_type` | backend 继续推送流式数据 |

### `listSessions()` 改造

```
// SQLite index 是 session/list 的返回事实来源。
// 内存和 backend 只用于刷新 / 修正 SQLite cache，不能绕过 DB 直接成为返回结果。

// 1. 内存 Map（in-memory，最准确，包含 active/parked sessions）→ upsert 到 SQLite index
const memorySessions = [...this.sessions.values()]
await upsertMemorySessionsToIndex(memorySessions)

// 2. 向 backend 查询（ACP session/list 原生协议）→ 转换为 ACP list/cache record 后 upsert 到 SQLite index
//    backend 知道它当前持有哪些 session（可能因 gateway 重启而不同步）
const backendSessions = await backend.acpClient.sessionList()
//    backendSessions 包含 backend 自己知道的 session_id 列表；必须附带 executor_type 才能合并
await upsertBackendSessionsToIndex(backendSessions)

// 3. 只从 SQLite index 读取并返回
const indexedRecords = await storage.index.listRecords()
// 按 last_active_at 降序排序

parked sessions 转换为 AcpSessionSummary：
  queueDepth: 0
  promptRunning: false
  agentCapabilities: parse from record.acp_record ?? DEFAULT_AGENT_CAPABILITIES
  status: "parked"
```

### `createSession()` 改造

创建 session record（`status: "active"`）后立即 `storage.index.upsertRecord()`。record 只保存 ACP list/cache 所需字段和路径上下文，不保存执行器完整 session。

### `ensureBackend()` 改造

backend 初始化完成后，同步调用 `storage.index.upsertRecord()` 更新数据库，同时写入 `title`、`backend_id` 和 ACP record cache：

```
title = backend.agentCapabilities?._meta?.title
     ?? session.agent_config?.name
     ?? undefined
acp_record = normalized ACP session/list response + agentCapabilities snapshot
```

### `closeSession()` 改造

显式关闭（用户主动关闭，非 WebSocket 断开）时：
1. 清除 `DetachedConnection` 的定时器（若存在）并执行最终刷盘
2. 按 `executor_type` 路由，向 backend 发送 **`session/close { sessionId }`**（ACP 原生协议），让 backend 正确清理内部状态
3. `storage.index.updateStatus(executor_type, session_id, "finished")`（保留 JSONL 历史）
4. `sessions.delete(id)`

> 注：`storage.index.softDeleteRecord()` 仅用于前端"删除会话"后从全局 list 隐藏；物理删除需要 `index.hardDeleteRecord()` + `events.deleteEvents()`。

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
| `"default"` | 标准权限模式 | Backend 正常发 `requestPermission` | Gateway `PermissionHandler` 拦截，按规则自动通过或挂起 |
| `"bypassPermissions"` | 跳过所有权限 | Backend **完全不发 `requestPermission`** | 无需 permission 逻辑，`pendingPermissions` 永远为空 |
| `"auto"` | 自动/AI 模式 | Backend 正常发 `requestPermission` | Gateway `PermissionHandler` 调用 AI 判断，AI 决定或挂起 |
| `"acceptEdits"` / `"dontAsk"` / `"plan"` | 既有 backend 原生模式 | 保持现有行为，不在本迁移中删除 | Gateway 透传给 backend |

### 变更清单

| 文件 | 变更内容 |
|------|---------|
| `packages/core/src/acp/types.ts` | 新增 `AcpPermissionMode` 类型；`AgentConfigPayload.permission_mode` 从 `string` 改为 `AcpPermissionMode`；删除项目自有 `approval_mode` 字段 |
| `packages/core/src/acp/ops/backend-adapter.ts` | `normalizeClaudePermissionMode()` 的 `CLAUDE_PERMISSION_MODES` 添加 `"auto"`，继续保留 `"acceptEdits"`、`"dontAsk"`、`"plan"` |
| `packages/core/src/agents/types.ts` | `AgentConfigFile` 仅保留 `permission_mode?: AcpPermissionMode`，删除 `approval_mode` / `approvals` |
| `packages/core/src/agents/index.ts` | 读取、写入、复制模板、创建、更新均只使用 `permission_mode`；默认值为 `"default"`；保留 `planMode` 不动 |
| `packages/core/src/types/index.ts` | `Agent` / `AgentConfig` / `AgentUpdate` / `CreateAgentOptions` 中 `approvalMode` / `approval_mode` 全部重命名为 `permissionMode` / `permission_mode` |
| `packages/core/src/gateway/routes/agents.ts` | Gateway agent API payload 字段从 `approval_mode` 改为 `permission_mode` |
| `packages/core/src/gateway/routes/agent-run.ts` | 运行 agent 的请求/配置字段从 `approval_mode` 改为 `permission_mode` |
| `packages/core/src/executors/ops/types.ts` | 执行器配置字段从 `approvalMode` 改为 `permissionMode` |
| `packages/core/src/executors/engines/claude.ts` | Claude 执行器读取 `permissionMode`，不再读取 `approvalMode` |
| `apps/desktop/src/lib/gateway/types/agent.ts` | gateway 客户端类型同步 |
| `apps/desktop/src/types/unified-agent.ts` | 前端 unified agent 类型同步 |
| `apps/desktop/src/components/acp-chat/acp-client.ts` | `AgentConfigPayload.permission_mode` 类型收窄为 `AcpPermissionMode` |
| `apps/desktop/src/components/agent/*` / `apps/desktop/src/pages/agents/*` / locale | UI state、props、表单和文案从 approval 命名改为 permission 命名 |

### `permission_mode` → Backend ACP 机制

`permission_mode` 直接通过 `agent_config.permission_mode` 传给 backend（ACP `session/new` / `session/load` 请求），backend 在 `prepareClaudeConfigDir()` 中写入 `settings.json` 的 `permissions.defaultMode`：

```typescript
// packages/core/src/acp/ops/backend-adapter.ts（已有逻辑，仅修改 normalizeClaudePermissionMode）
const requestedMode = normalizeClaudePermissionMode(context.agentConfig?.permission_mode);
// "default"            → permissions.defaultMode = "default"
// "bypassPermissions"  → permissions.defaultMode = "bypassPermissions"
// "auto"               → permissions.defaultMode = "auto"（新增支持）
// "acceptEdits"        → permissions.defaultMode = "acceptEdits"
// "dontAsk"            → permissions.defaultMode = "dontAsk"
// "plan"               → permissions.defaultMode = "plan"
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

### 破坏性命名迁移

本项目自有配置、类型、Gateway payload、YAML 文件和前端状态全部使用 `permission` 命名，不保留 `approval` 字段兼容读取：

```
TypeScript / React / domain types: permissionMode
YAML / Gateway JSON payload / DB: permission_mode
ACP protocol method name: requestPermission（协议固定名称，不改）
```

`approvalMode`、`approval_mode`、`approvals` 只允许出现在历史提交或第三方协议文档中；新代码路径不读取、不写入、不在类型上暴露这些字段。缺省配置统一解释为 `permission_mode: "default"`。

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

在 gateway 初始化时（`packages/core/src/gateway/index.ts`）将 `AcpSessionStorageAdapter` 注入 `AcpSessionManager`：

```typescript
const sessionStorage = createDefaultAcpSessionStorage();
const acpSessionManager = new AcpSessionManager(
  createDefaultAcpBackendAdapter(),
  createDefaultAcpSteerPromptStore(),
  sessionStorage
);
```

### 多 WebSocket 连接同一 Session

`ownedSessionIds` 按 WebSocket 连接管理。若第二个连接 `loadSession` 了同一 session，`AcpSessionManager.loadSession()` 会把 `session.connection` 切换到第二个连接。第一个连接 close 时仍会遍历自己的 `ownedSessionIds`，因此必须把正在关闭的 connection 传入 `parkSession(sessionId, closingConnection)`。

`parkSession()` 只有在 `session.connection === closingConnection` 时才允许 park；否则说明 session 已被新连接接管，应跳过。当前版本仍不支持两个活跃连接同时操作同一 session，但旧连接关闭不能破坏新连接。

---

## 八、`permission-handler.ts`

```typescript
// packages/core/src/acp/ops/permission-handler.ts

export interface PermissionHandler {
  evaluate(
    params: AcpRequestPermissionRequest,
    permissionMode: AcpPermissionMode
  ): Promise<PermissionDecision>;
}

export type PermissionDecision =
  | { auto: true; optionId: string }   // 自动决定，直接 resolve
  | { auto: false };                    // 需要人工，挂起
```

- `"default"`：检查工具名、命令模式等规则，能自动决定则 `auto: true`，否则 `auto: false` 挂起
- `"auto"`：调用 AI 判断；AI 决定安全 → `auto: true`；AI 决定不安全或超时 → `auto: false` 挂起
- `"bypassPermissions"`：**不经过 `PermissionHandler`**——backend 配置了 `bypassPermissions` 模式（ACP 协议），根本不发 `requestPermission`，gateway 永远不会收到权限请求，`PermissionHandler.evaluate()` 不会被调用

初版 `"auto"` 实现可为 stub（直接返回 `auto: false`），待后续接入 LLM。

### PermissionHandler 在活跃连接中的集成

`PermissionHandler` **不只在 `DetachedConnection` 中使用**。当 session 处于活跃连接状态（`SdkAcpConnection`），`requestPermission` 同样应先经过 `PermissionHandler.evaluate()` 过滤（使用上述 `effective_mode` 计算逻辑），自动通过的请求无需打断用户，只有 `auto: false` 时才真正推送给前端等待用户决策。

集成位置：`SdkAcpConnection.requestPermission()` 在向 WebSocket 推送权限请求前，先调用 `PermissionHandler.evaluate()`：

```
requestPermission(params):
  // bypassPermissions 模式下 backend 配置了 bypassPermissions，不发 requestPermission，此处不会被调用
  // 以下逻辑仅在 effective_mode 为 "default" 或 "auto" 时触发
  effective_mode = dangerously_skip_permissions ? "bypassPermissions" : agent_config.permission_mode ?? "default"
  decision = permissionHandler.evaluate(params, effective_mode)
  if decision.auto → 直接 resolve(decision.optionId)，无需 UI 交互
  else             → 走原有 WebSocket push → 等待前端 permission:response
```

这样 `PermissionHandler` 在活跃和断开两种状态下保持一致，不在两处维护重复的规则判断逻辑。

---

## 九、会话清理与超时机制

### 策略

| 情形 | 处理 |
|------|------|
| 用户主动删除会话（前端 deleteSession） | `storage.index.softDeleteRecord(executor_type, session_id)`，默认保留 JSONL；物理删除时再调用 `events.deleteEvents()` |
| 用户主动关闭会话（前端 closeSession） | `storage.index.updateStatus(executor_type, session_id, "finished")`，保留 JSONL 历史 |
| Parked 超过 TTL（默认 7 天） | 后台清理任务标记为 `finished`，不删除 JSONL |
| Finished/error 超过归档 TTL（默认 30 天） | 可配置自动删除（默认关闭） |

### 实现

gateway 启动时运行一次清理扫描：

```typescript
async function cleanupStaleSessions(storage: AcpSessionStorageAdapter, parkTTLDays = 7): Promise<void> {
  const records = await storage.index.listRecords({ statuses: ["parked"] });
  const now = Date.now();
  for (const record of records) {
    const age = now - new Date(record.last_active_at).getTime();
    if (age > parkTTLDays * 24 * 60 * 60 * 1000) {
      await storage.index.updateStatus(record.executor_type, record.session_id, "finished", {
        finished_at: new Date(now).toISOString(),
      });
    }
  }
}
```

- 定期清理（每小时）可选：在 gateway 中注册定时任务
- TTL 可通过 gateway 配置文件覆盖

---

## 十、前端变更（apps/desktop）

### `acp-client.ts`

`AgentConfigPayload` 新增 `permission_mode?: AcpPermissionMode`，不再包含旧权限字段。

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

### `agent_config` 边界

**设计决策**：`AcpSessionRecord` 不保存完整 `agent_config` 快照。数据库只保存恢复路由和列表展示必需的 `cwd`、`agent_dir`、`agent_config_path`、`executor_type`、`permission_mode` 以及 `acp_record_json` 缓冲字段。重连恢复时，Gateway 按这些路径和 `executor_type + session_id` 找到对应执行器，并把原始 `session_id` 交回执行器恢复上下文；执行器自己的完整 session 记录由执行器负责保存。
