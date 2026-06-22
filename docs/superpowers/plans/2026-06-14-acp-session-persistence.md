# ACP Session 持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ACP session 全局列表持久化、WebSocket 断线重连恢复、backend 断开期间继续运行并缓冲输出。

**Architecture:** 存储拆成三层：`AcpSessionIndexStore` 使用全局 SQLite 保存 `session/list` 需要的 ACP 转换后记录；`AcpSessionEventStore` 继续用 JSONL 文件保存高频事件缓冲；`AcpSessionStorageAdapter` 聚合二者，为未来把事件缓冲迁移到数据库预留 adapter 边界。数据库主键必须是 `executor_type + session_id`，不保存执行器内部完整 session 记录。

**Tech Stack:** Node.js `node:sqlite`（通过 `createRequire` 加载，参考 `SqliteAcpSteerPromptStore`）、`fs/promises` JSONL、`AsyncLock`、`@agentclientprotocol/sdk`。

---

## 文件结构

| 操作 | 路径 |
|------|------|
| 新建 | `packages/core/src/acp/ops/session-index-store.ts` |
| 新建 | `packages/core/src/acp/ops/session-index-store.test.ts` |
| 新建 | `packages/core/src/acp/ops/session-event-store.ts` |
| 新建 | `packages/core/src/acp/ops/session-event-store.test.ts` |
| 新建 | `packages/core/src/acp/ops/session-storage.ts` |
| 新建 | `packages/core/src/acp/ops/session-event-recorder.ts` |
| 新建 | `packages/core/src/acp/ops/detached-connection.ts` |
| 新建 | `packages/core/src/acp/ops/permission-handler.ts` |
| 修改 | `packages/core/src/acp/types.ts` |
| 修改 | `packages/core/src/agents/types.ts` |
| 修改 | `packages/core/src/agents/index.ts` |
| 修改 | `packages/core/src/types/index.ts` |
| 修改 | `packages/core/src/gateway/routes/agents.ts` |
| 修改 | `packages/core/src/gateway/routes/agent-run.ts` |
| 修改 | `packages/core/src/gateway/routes/agent-ws.ts` |
| 修改 | `packages/core/src/executors/ops/types.ts` |
| 修改 | `packages/core/src/executors/engines/claude.ts` |
| 修改 | `packages/core/src/acp/ops/session-manager.ts` |
| 修改 | `packages/core/src/acp/ops/backend-adapter.ts` |
| 修改 | `packages/core/src/acp/ops/codex-app-server-backend.ts` |
| 修改 | `packages/core/src/gateway/routes/agent-acp.ts` |
| 修改 | `packages/core/src/gateway/index.ts` |
| 修改 | `packages/core/src/acp/index.ts` |
| 修改 | `apps/desktop/src/components/acp-chat/acp-client.ts` |
| 修改 | `apps/desktop/src/components/acp-chat/use-acp-session.ts` |
| 修改 | `apps/desktop/src/components/acp-chat/acp-chat-state.ts` |
| 修改 | `apps/desktop/src/lib/gateway/types/agent.ts` |
| 修改 | `apps/desktop/src/lib/gateway/types/session.ts` |
| 修改 | `apps/desktop/src/types/agent.ts` |
| 修改 | `apps/desktop/src/types/unified-agent.ts` |
| 修改 | `apps/desktop/src/components/agent/*` |
| 修改 | `apps/desktop/src/pages/agents/*` |
| 修改 | `apps/desktop/src/pages/conversation/hooks/*` |
| 修改 | `apps/desktop/src/i18n/locales/en.json` |
| 修改 | `apps/desktop/src/i18n/locales/zh-CN.json` |

---

## 基建先行范围

在接入 session persistence 之前，必须先完成这些基础设施变更，避免后续任务建立在旧字段上：

1. **权限字段命名基建**：项目自有类型、YAML、Gateway payload、前端状态、executor config 全部从 `approvalMode` / `approval_mode` / `approvals` 迁移为 `permissionMode` / `permission_mode`；不做兼容读取。
2. **ACP session 基础类型**：新增 `AcpPermissionMode`、`AcpSessionEvent`、`AcpSessionEventPatch`、`AcpLoadSessionResponse.history`、`AcpSessionStatus.parked`。
3. **存储 adapter 基建**：先落 `AcpSessionIndexStore`、`AcpSessionEventStore`、`AcpSessionStorageAdapter`，再改 manager 生命周期。
4. **权限处理抽象基建**：项目自有抽象命名为 `PermissionHandler`；只保留 ACP 协议固定方法名 `requestPermission`。
5. **Gateway/desktop 类型同步**：Gateway 路由和 desktop gateway client 必须与 core 类型同步后，再接入 list/load/history UI。

## Task 1: 权限字段全量迁移和 ACP session 基础类型

**Files:**
- Modify: `packages/core/src/acp/types.ts`
- Modify: `packages/core/src/agents/types.ts`
- Modify: `packages/core/src/agents/index.ts`
- Modify: `packages/core/src/types/index.ts`
- Modify: `packages/core/src/gateway/routes/agents.ts`
- Modify: `packages/core/src/gateway/routes/agent-run.ts`
- Modify: `packages/core/src/gateway/routes/agent-ws.ts`
- Modify: `packages/core/src/executors/ops/types.ts`
- Modify: `packages/core/src/executors/engines/claude.ts`
- Modify: `packages/core/src/acp/ops/session-manager.ts`
- Modify: `packages/core/src/acp/ops/codex-app-server-backend.ts`
- Modify: `apps/desktop/src/lib/gateway/types/agent.ts`
- Modify: `apps/desktop/src/lib/gateway/types/session.ts`
- Modify: `apps/desktop/src/types/agent.ts`
- Modify: `apps/desktop/src/types/unified-agent.ts`
- Modify: `apps/desktop/src/types/chat.ts`
- Modify: `apps/desktop/src/components/acp-chat/acp-client.ts`
- Modify: `apps/desktop/src/components/acp-chat/acp-agent-config.ts`
- Modify: `apps/desktop/src/components/acp-chat/acp-chat.tsx`
- Modify: `apps/desktop/src/components/acp-chat/context-settings-popup.tsx`
- Modify: `apps/desktop/src/components/agent/agent-config-panel.tsx`
- Modify: `apps/desktop/src/components/agent/agent-settings-tab.tsx`
- Modify: `apps/desktop/src/components/agent/claude-code-config-section.tsx`
- Modify: `apps/desktop/src/pages/agents/agent-detail.tsx`
- Modify: `apps/desktop/src/pages/agents/executor-detail.tsx`
- Modify: `apps/desktop/src/pages/conversation/hooks/use-agent-conversation.ts`
- Modify: `apps/desktop/src/pages/conversation/hooks/use-conversation.ts`
- Modify: `apps/desktop/src/pages/conversation/hooks/use-workspace-chat.ts`
- Modify: `apps/desktop/src/i18n/locales/en.json`
- Modify: `apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: 在 `packages/core/src/acp/types.ts` 中新增 `AcpPermissionMode`**

在 ACP session 类型附近新增：

```typescript
export type AcpPermissionMode =
  | "default"
  | "bypassPermissions"
  | "auto"
  | "acceptEdits"
  | "dontAsk"
  | "plan";
```

将 `AgentConfigPayload.permission_mode?: string` 改为：

```typescript
permission_mode?: AcpPermissionMode;
```

删除 `AgentConfigPayload` 中的旧权限字段；新代码不读取旧 YAML 字段，也不在类型中暴露旧字段。

- [ ] **Step 2: 扩展 session 状态和 loadSession 响应**

将 `AcpSessionStatus` 增加 `"parked"`：

```typescript
export type AcpSessionStatus =
  | "initializing"
  | "active"
  | "cancelled"
  | "finished"
  | "error"
  | "parked";
```

新增事件类型：

```typescript
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
```

修改 `AcpLoadSessionResponse`：

```typescript
export type AcpLoadSessionResponse = LoadSessionResponse & {
  sessionId?: string;
  history?: AcpSessionEvent[];
};
```

- [ ] **Step 3: 同步 agent 配置类型**

在 `packages/core/src/agents/types.ts` 和 `packages/core/src/types/index.ts` 中只保留 permission 命名：

```typescript
permission_mode?: "default" | "bypassPermissions" | "auto" | "acceptEdits" | "dontAsk" | "plan";
```

```typescript
export interface Agent {
  permissionMode: AcpPermissionMode;
}

export interface AgentConfig {
  permissionMode?: AcpPermissionMode;
}

export interface AgentUpdate {
  permissionMode?: AcpPermissionMode;
}

export interface CreateAgentOptions {
  permission_mode?: AcpPermissionMode;
}
```

- [ ] **Step 4: 改造 YAML 读取和写入路径**

在 `packages/core/src/agents/index.ts` 中使用单一归一化函数，不读取旧字段：

```typescript
function normalizePermissionMode(mode?: AcpPermissionMode): AcpPermissionMode {
  return mode ?? "default";
}
```

`agentConfigFileToAgent()` 写入 `permissionMode`：

```typescript
const permissionMode = normalizePermissionMode(config.permission_mode);

return {
  id,
  name: config.name,
  permissionMode,
  // existing fields unchanged
};
```

`agentToConfigFile()`、`createAgent()`、`createAgentFromTemplate()`、`saveAsTemplate()` 只写 `permission_mode`：

```typescript
permission_mode: overrides.permissionMode ?? agent.permissionMode ?? "default",
```

- [ ] **Step 5: 改造 Gateway agent API**

在 `packages/core/src/gateway/routes/agents.ts` 和 `packages/core/src/gateway/routes/agent-run.ts` 中：

```typescript
permission_mode?: AcpPermissionMode;
```

响应 payload 使用：

```typescript
permission_mode: agent.permissionMode,
```

更新 payload 使用：

```typescript
permissionMode: body.permission_mode,
```

不再接受或返回旧权限字段。

- [ ] **Step 6: 改造 executor config**

在 `packages/core/src/executors/ops/types.ts` 和 `packages/core/src/executors/engines/claude.ts` 中把执行器配置改为：

```typescript
permissionMode?: AcpPermissionMode;
```

Claude 执行器映射：

```typescript
if (this.config.permissionMode === "bypassPermissions") {
  args.push("--dangerously-skip-permissions");
} else if (this.config.permissionMode === "auto") {
  args.push("--permission-mode", "auto");
}
```

- [ ] **Step 7: 改造 ACP session config 传递**

`packages/core/src/acp/ops/session-manager.ts` 和 `packages/core/src/acp/ops/codex-app-server-backend.ts` 中只从 `permission_mode` 读取权限模式：

```typescript
permissionMode: config.permission_mode,
```

```typescript
if (agentConfig?.dangerously_skip_permissions === true) {
  return "bypassPermissions";
}
return agentConfig?.permission_mode ?? "default";
```

- [ ] **Step 8: 改造 desktop 类型和 UI 命名**

Desktop gateway client、agent 类型、表单 state、props 和 locale key 全部改成：

```typescript
type PermissionMode = "default" | "bypassPermissions" | "auto" | "acceptEdits" | "dontAsk" | "plan";
permission_mode?: PermissionMode;
permissionMode: PermissionMode;
```

UI 文案 key 使用 `permissionMode` / `permissions`，不再使用旧权限命名。

- [ ] **Step 9: 增加/调整测试**

单测覆盖：
- `permission_mode: "plan"` 读取后 `Agent.permissionMode === "plan"`，保存后 YAML 仍为 `permission_mode: plan`
- 新建 agent 默认写入 `permission_mode: default`
- Gateway agent create/update/list 使用 `permission_mode`
- Claude executor 使用 `permissionMode`
- ACP request payload 使用 `agent_config.permission_mode`
- 新代码路径不再读取旧权限字段

执行检查：

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
rg -n "approvalMode|approval_mode|approvals" packages/core/src apps/desktop/src | head -80
```

预期：仅允许第三方协议固定文本、用户可见历史聊天内容、或非权限语义的自然语言文本；项目自有权限配置类型、字段、路由、YAML、UI state 中无匹配。

- [ ] **Step 10: 运行类型检查**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core typecheck 2>&1 | head -30
pnpm --filter @viben/desktop typecheck 2>&1 | head -30
```

预期：无新增类型错误。

- [ ] **Step 11: Commit**

```bash
git add packages/core/src apps/desktop/src
git commit -m "refactor: migrate approval naming to permission mode"
```

---

## Task 2: `AcpSessionIndexStore` — SQLite 全局 session list

**Files:**
- Create: `packages/core/src/acp/ops/session-index-store.ts`
- Create: `packages/core/src/acp/ops/session-index-store.test.ts`

- [ ] **Step 1: 创建 `session-index-store.ts` 的接口和类型**

```typescript
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { logger as globalLogger } from "../../telemetry";
import type { AcpErrorDetail, AcpPermissionMode } from "../types";

const require = createRequire(import.meta.url);
const log = globalLogger.child({ module: "acp-session-index-store" });
const DEFAULT_ACP_SESSION_DB_PATH = join(getStateDir(), "acp", "sessions.sqlite");

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

- [ ] **Step 2: 实现 SQLite schema**

在 `SqliteAcpSessionIndexStore` 构造函数中创建表和索引：

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

使用 `node:sqlite` 的加载方式和 `SqliteAcpSteerPromptStore` 一致：

```typescript
interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

interface DatabaseSyncConstructor {
  new(path: string): SqliteDatabase;
}

function loadDatabaseSync(): DatabaseSyncConstructor {
  return require("node:sqlite").DatabaseSync as DatabaseSyncConstructor;
}
```

- [ ] **Step 3: 实现复合身份校验**

```typescript
const VALID_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const VALID_EXECUTOR_TYPE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function validateAcpSessionIdentity(executorType: string, sessionId: string): void {
  if (!VALID_EXECUTOR_TYPE.test(executorType)) {
    throw new Error(`Invalid ACP executor_type: ${executorType}`);
  }
  if (!VALID_SESSION_ID.test(sessionId)) {
    throw new Error(`Invalid ACP session_id: ${sessionId}`);
  }
}
```

所有 public 方法在读写前调用校验。禁止把 `session_id` 提升成 Gateway 全局 ID；同名 `session_id` 必须允许存在于不同 `executor_type` 下。

- [ ] **Step 4: 实现 `upsertRecord()`**

使用 `INSERT ... ON CONFLICT(executor_type, session_id) DO UPDATE`，并保留原 `created_at`：

```typescript
this.db.prepare(`
  INSERT INTO acp_sessions (
    executor_type, session_id, status, cwd, workspace_path, agent_dir, agent_config_path,
    backend_id, title, permission_mode, acp_record_json, persist_session_id,
    persist_task_id, gateway_url, event_store_type, event_store_uri, event_last_seq,
    created_at, last_active_at, parked_at, finished_at, deleted_at, last_error_json,
    schema_version, meta_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(executor_type, session_id) DO UPDATE SET
    status = excluded.status,
    cwd = excluded.cwd,
    workspace_path = excluded.workspace_path,
    agent_dir = excluded.agent_dir,
    agent_config_path = excluded.agent_config_path,
    backend_id = excluded.backend_id,
    title = excluded.title,
    permission_mode = excluded.permission_mode,
    acp_record_json = excluded.acp_record_json,
    persist_session_id = excluded.persist_session_id,
    persist_task_id = excluded.persist_task_id,
    gateway_url = excluded.gateway_url,
    event_store_type = excluded.event_store_type,
    event_store_uri = excluded.event_store_uri,
    event_last_seq = excluded.event_last_seq,
    last_active_at = excluded.last_active_at,
    parked_at = excluded.parked_at,
    finished_at = excluded.finished_at,
    deleted_at = excluded.deleted_at,
    last_error_json = excluded.last_error_json,
    meta_json = excluded.meta_json
`).run(/* fields */);
```

`acp_record_json` 只保存 ACP `session/list`、`session/new`、`session/load` 响应转换后的 list/cache 记录，不保存执行器内部完整 session 记录。

- [ ] **Step 5: 实现查询、状态更新和删除**

实现以下行为：
- `getRecord(executorType, sessionId)` 使用复合主键读取
- `findBySessionId(sessionId)` 返回所有 executor 下同名记录，用于 ambiguous 检查
- `listRecords()` 默认 `deleted_at IS NULL` 且 `status IN ("active", "parked")`
- `listRecords()` 支持 `executor_type`、`statuses`、`cwd`、`workspace_path`、`agent_config_path`、`persist_task_id`
- `softDeleteRecord()` 只写 `deleted_at`
- `hardDeleteRecord()` 删除数据库记录，不删除事件文件；物理事件删除由 storage adapter 编排
- JSON 字段解析失败时返回默认值并 `log.warn`

- [ ] **Step 6: 编写 `session-index-store.test.ts`**

测试用临时 SQLite 文件实例化 `SqliteAcpSessionIndexStore`，覆盖：

```typescript
it("allows same session_id under different executor_type", async () => {
  await store.upsertRecord(makeRecord({ executor_type: "CLAUDE_CODE", session_id: "same" }));
  await store.upsertRecord(makeRecord({ executor_type: "CODEX", session_id: "same" }));
  expect(await store.getRecord("CLAUDE_CODE", "same")).toMatchObject({ executor_type: "CLAUDE_CODE" });
  expect(await store.getRecord("CODEX", "same")).toMatchObject({ executor_type: "CODEX" });
  expect(await store.findBySessionId("same")).toHaveLength(2);
});

it("lists active and parked records by default and excludes deleted records", async () => {
  await store.upsertRecord(makeRecord({ session_id: "active", status: "active" }));
  await store.upsertRecord(makeRecord({ session_id: "parked", status: "parked" }));
  await store.upsertRecord(makeRecord({ session_id: "finished", status: "finished" }));
  await store.softDeleteRecord("CLAUDE_CODE", "parked", new Date().toISOString());
  expect((await store.listRecords()).map((r) => r.session_id)).toEqual(["active"]);
});

it("filters by executor_type cwd agent_config_path and persist_task_id", async () => {
  await store.upsertRecord(makeRecord({
    executor_type: "CODEX",
    session_id: "s1",
    cwd: "/repo",
    agent_config_path: "/repo/agent.yaml",
    persist_task_id: "task-1",
  }));
  const list = await store.listRecords({
    executor_type: "CODEX",
    cwd: "/repo",
    agent_config_path: "/repo/agent.yaml",
    persist_task_id: "task-1",
  });
  expect(list).toHaveLength(1);
});

it("falls back when acp_record_json is corrupt", async () => {
  await store.upsertRecord(makeRecord({ session_id: "bad-json", acp_record: { title: "ok" } }));
  db.prepare("UPDATE acp_sessions SET acp_record_json = ? WHERE session_id = ?").run("{bad", "bad-json");
  const record = await store.getRecord("CLAUDE_CODE", "bad-json");
  expect(record?.acp_record).toEqual({});
});

it.each(["", "../x", "a/b", "..", ".".repeat(129)])("rejects invalid session_id %s", async (sessionId) => {
  await expect(store.getRecord("CLAUDE_CODE", sessionId)).rejects.toThrow(/Invalid ACP session_id/);
});
```

- [ ] **Step 7: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- session-index-store 2>&1 | tail -30
```

预期：新增测试全部 PASS。

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/acp/ops/session-index-store.ts packages/core/src/acp/ops/session-index-store.test.ts
git commit -m "feat(acp): add sqlite session index store"
```

---

## Task 3: `AcpSessionEventStore` — JSONL 事件缓冲

**Files:**
- Create: `packages/core/src/acp/ops/session-event-store.ts`
- Create: `packages/core/src/acp/ops/session-event-store.test.ts`

- [ ] **Step 1: 创建 event store 接口**

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { join } from "node:path";
import { getStateDir } from "../../config/paths";
import { logger as globalLogger } from "../../telemetry";
import { AsyncLock } from "../../utils/async-lock";
import type { AcpSessionEvent, AcpSessionEventPatch } from "../types";
import { validateAcpSessionIdentity } from "./session-index-store";

const log = globalLogger.child({ module: "acp-session-event-store" });

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

- [ ] **Step 2: 实现 `JsonlAcpSessionEventStore`**

默认路径必须带 `executor_type`：

```typescript
const DEFAULT_EVENT_ROOT = join(getStateDir(), "acp", "sessions");

function lockKey(identity: AcpSessionEventIdentity): string {
  return `${identity.executor_type}:${identity.session_id}`;
}

export class JsonlAcpSessionEventStore implements AcpSessionEventStore {
  private writeLock = new AsyncLock();
  private seqCounters = new Map<string, number>();

  constructor(private readonly baseDir: string = DEFAULT_EVENT_ROOT) {}

  private sessionDir(identity: AcpSessionEventIdentity): string {
    validateAcpSessionIdentity(identity.executor_type, identity.session_id);
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, identity.executor_type, identity.session_id);
    if (!resolved.startsWith(base + path.sep)) {
      throw new Error(`ACP session event path escapes root: ${identity.executor_type}/${identity.session_id}`);
    }
    return resolved;
  }

  getEventStoreUri(identity: AcpSessionEventIdentity): string {
    return path.join(this.sessionDir(identity), "events.jsonl");
  }

  private eventsPath(identity: AcpSessionEventIdentity): string {
    return this.getEventStoreUri(identity);
  }
}
```

- [ ] **Step 3: 实现 seq、append、patch 和读取**

`appendEvent()` 和 `updateEventStatus()` 都必须使用 `${executor_type}:${session_id}` 写锁：

```typescript
async appendEvent(identity: AcpSessionEventIdentity, event: Omit<AcpSessionEvent, "seq">): Promise<number> {
  return this.writeLock.withLock(lockKey(identity), async () => {
    const seq = await this.getNextSeq(identity);
    await fs.mkdir(this.sessionDir(identity), { recursive: true });
    await fs.appendFile(this.eventsPath(identity), JSON.stringify({ ...event, seq }) + "\n", "utf8");
    return seq;
  });
}

async updateEventStatus(
  identity: AcpSessionEventIdentity,
  seq: number,
  status: AcpSessionEvent["status"]
): Promise<void> {
  return this.writeLock.withLock(lockKey(identity), async () => {
    const patch: AcpSessionEventPatch = { _type: "patch", target_seq: seq, patch: { status } };
    await fs.mkdir(this.sessionDir(identity), { recursive: true });
    await fs.appendFile(this.eventsPath(identity), JSON.stringify(patch) + "\n", "utf8");
  });
}
```

`loadEvents()` 逐行解析 JSONL，跳过坏行并记录 warning；patch 行 last-write-wins；返回按 `seq` 升序排序的事件。`deleteEvents()` 只删除 `~/.viben/acp/sessions/<executor_type>/<session_id>/` 目录。

- [ ] **Step 4: 编写 event store 测试**

覆盖：
- 同一 identity 下 seq 从 0 递增
- 新 store 实例可从已有 JSONL 恢复 `maxSeq + 1`
- `updateEventStatus()` patch 后 `loadEvents()` 返回 resolved/cancelled/abandoned 状态
- 同一 `session_id` 在不同 `executor_type` 下写入不同目录，seq 互不影响
- `../x`、`a/b`、`..`、空字符串、超长 ID 被拒绝
- 损坏 JSONL 行被跳过，不影响其他事件
- 并发 100 个 append 不产生重复 seq

- [ ] **Step 5: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- session-event-store 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/acp/ops/session-event-store.ts packages/core/src/acp/ops/session-event-store.test.ts
git commit -m "feat(acp): add jsonl session event store"
```

---

## Task 4: `AcpSessionStorageAdapter`

**Files:**
- Create: `packages/core/src/acp/ops/session-storage.ts`
- Modify: `packages/core/src/acp/ops/session-index-store.ts`
- Modify: `packages/core/src/acp/ops/session-event-store.ts`

- [ ] **Step 1: 创建 storage adapter**

```typescript
import type { AcpSessionIndexStore } from "./session-index-store";
import { createDefaultAcpSessionIndexStore } from "./session-index-store";
import type { AcpSessionEventIdentity, AcpSessionEventStore } from "./session-event-store";
import { createDefaultAcpSessionEventStore } from "./session-event-store";

export interface AcpSessionStorageAdapter {
  index: AcpSessionIndexStore;
  events: AcpSessionEventStore;
  hardDeleteSession(identity: AcpSessionEventIdentity): Promise<void>;
}

export class DefaultAcpSessionStorageAdapter implements AcpSessionStorageAdapter {
  constructor(
    readonly index: AcpSessionIndexStore,
    readonly events: AcpSessionEventStore
  ) {}

  async hardDeleteSession(identity: AcpSessionEventIdentity): Promise<void> {
    await this.index.hardDeleteRecord(identity.executor_type, identity.session_id);
    await this.events.deleteEvents(identity);
  }
}

export function createDefaultAcpSessionStorage(): AcpSessionStorageAdapter {
  return new DefaultAcpSessionStorageAdapter(
    createDefaultAcpSessionIndexStore(),
    createDefaultAcpSessionEventStore()
  );
}
```

- [ ] **Step 2: 增加默认工厂**

`session-index-store.ts`：

```typescript
export function createDefaultAcpSessionIndexStore(): AcpSessionIndexStore {
  if (process.env.VIBEN_ACP_SESSION_INDEX_STORE === "memory") {
    return new InMemoryAcpSessionIndexStore();
  }
  return new SqliteAcpSessionIndexStore(
    process.env.VIBEN_ACP_SESSION_DB_PATH || DEFAULT_ACP_SESSION_DB_PATH
  );
}
```

`session-event-store.ts`：

```typescript
export function createDefaultAcpSessionEventStore(): AcpSessionEventStore {
  return new JsonlAcpSessionEventStore(process.env.VIBEN_ACP_SESSION_EVENT_ROOT || DEFAULT_EVENT_ROOT);
}
```

`InMemoryAcpSessionIndexStore` 只用于测试和 SQLite 不可用时的降级，必须保持复合 key 语义。

- [ ] **Step 3: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- session-index-store session-event-store 2>&1 | tail -30
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/acp/ops/session-storage.ts packages/core/src/acp/ops/session-index-store.ts packages/core/src/acp/ops/session-event-store.ts
git commit -m "feat(acp): add session storage adapter"
```

---

## Task 5: `AcpSessionEventRecorder` 和 `DetachedConnection`

**Files:**
- Create: `packages/core/src/acp/ops/session-event-recorder.ts`
- Create: `packages/core/src/acp/ops/detached-connection.ts`
- Create: `packages/core/src/acp/ops/permission-handler.ts`

- [ ] **Step 1: 创建 `permission-handler.ts`**

```typescript
import type { AcpPermissionMode, AcpRequestPermissionRequest } from "../types";

export type PermissionDecision =
  | { auto: true; optionId: string }
  | { auto: false };

export interface PermissionHandler {
  evaluate(
    params: AcpRequestPermissionRequest,
    permissionMode: AcpPermissionMode
  ): Promise<PermissionDecision>;
}

export class DefaultPermissionHandler implements PermissionHandler {
  async evaluate(
    _params: AcpRequestPermissionRequest,
    _permissionMode: AcpPermissionMode
  ): Promise<PermissionDecision> {
    return { auto: false };
  }
}

export function createDefaultPermissionHandler(): PermissionHandler {
  return new DefaultPermissionHandler();
}
```

- [ ] **Step 2: 创建 `session-event-recorder.ts`**

```typescript
import type { AcpSessionEvent } from "../types";
import type { AcpSessionEventIdentity, AcpSessionEventStore } from "./session-event-store";
import type { AcpSessionIndexStore } from "./session-index-store";

export class AcpSessionEventRecorder {
  constructor(
    private readonly events: AcpSessionEventStore,
    private readonly identity: AcpSessionEventIdentity,
    private readonly index?: AcpSessionIndexStore
  ) {}

  async append(event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    const seq = await this.events.appendEvent(this.identity, event);
    await this.index?.updateEventCursor(this.identity.executor_type, this.identity.session_id, seq);
    return seq;
  }

  updateStatus(seq: number, status: AcpSessionEvent["status"]): Promise<void> {
    return this.events.updateEventStatus(this.identity, seq, status);
  }

  async loadHistory(): Promise<AcpSessionEvent[]> {
    return (await this.events.loadEvents(this.identity)).sort((a, b) => a.seq - b.seq);
  }

  async abandonPending(events?: AcpSessionEvent[]): Promise<AcpSessionEvent[]> {
    const history = events ?? await this.loadHistory();
    for (const event of history) {
      if (event.status === "pending") {
        await this.updateStatus(event.seq, "abandoned");
        event.status = "abandoned";
      }
    }
    return history;
  }
}
```

- [ ] **Step 3: 创建 `detached-connection.ts`**

实现 `AcpConnection`，核心规则：
- `sessionUpdate()` 只通过 recorder 追加 `session_update`，不推送旧 WebSocket
- `requestPermission()` 先走 `PermissionHandler.evaluate()`；自动通过则追加 `permission_response` 并 resolve；否则追加 `permission_request(pending)` 并挂起
- `requestClient()` 追加 `client_tool_call(pending)`，60 秒超时后 patch 为 `abandoned`
- `resume(newConnection)` 从 `recorder.loadHistory()` 返回完整 history，并异步 drain pending
- `close()` reject 所有 pending 并 patch 为 `cancelled`

`PendingRequest` 必须保存 append 返回的 `seq`：

```typescript
interface PendingRequest<T> {
  seq: number;
  params: unknown;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}
```

- [ ] **Step 4: 增加 detached connection 测试**

覆盖：
- detached 状态下 `sessionUpdate()` 写入 event store
- pending permission 记录 `seq`，resume 后 resolved patch 原事件
- close 后 pending patch 为 `cancelled`
- client tool 60 秒超时 patch 为 `abandoned`（使用 fake timers）

- [ ] **Step 5: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- detached-connection session-event-recorder 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/acp/ops/permission-handler.ts packages/core/src/acp/ops/session-event-recorder.ts packages/core/src/acp/ops/detached-connection.ts
git commit -m "feat(acp): add detached connection event recording"
```

---

## Task 6: `AcpSessionManager` 接入 storage adapter

**Files:**
- Modify: `packages/core/src/acp/ops/session-manager.ts`

- [ ] **Step 1: 扩展内部 session 结构**

为 `AcpSession` 增加：

```typescript
interface AcpSessionIdentity {
  executor_type: string;
  session_id: string;
}

function sessionKey(identity: AcpSessionIdentity): string {
  return `${identity.executor_type}:${identity.session_id}`;
}

executor_type: string;
session_id: string;
backend_id?: string;
recorder: AcpSessionEventRecorder;
```

`this.sessions` 的 key 必须从裸 `sessionId` 改为 `sessionKey({ executor_type, session_id })`。若现有代码里仍有执行器侧 session id 的运行期兼容字段，只能作为内存兼容状态使用，不写入 SQLite；数据库 `session_id` 始终使用 ACP/执行器侧可恢复的 `session_id`，并和 `executor_type` 组成复合身份。

- [ ] **Step 2: 构造函数注入 storage**

```typescript
constructor(
  backendAdapter: AcpBackendAdapter = createDefaultAcpBackendAdapter(),
  steerPromptStore: AcpSteerPromptStore = createDefaultAcpSteerPromptStore(),
  inputHistory: InputHistoryService = inputHistoryService,
  public readonly storage: AcpSessionStorageAdapter = createDefaultAcpSessionStorage()
) {}
```

- [ ] **Step 3: 新建 session 时写入 SQLite index**

在 `createSessionRecord()` 解析 `agent_config.executor_type` 或 backend 默认值后创建 identity：

```typescript
const executorType = resolveExecutorType(agentConfig);
const identity = { executor_type: executorType, session_id: sessionId };
const recorder = new AcpSessionEventRecorder(this.storage.events, identity, this.storage.index);
```

创建 session 后立即 upsert：

```typescript
const identity = getStorageIdentity(session);
await this.storage.index.upsertRecord({
  executor_type: identity.executor_type,
  session_id: identity.session_id,
  status: "active",
  cwd: session.cwd,
  workspace_path: session.cwd,
  agent_dir: session.agent_dir,
  agent_config_path: session.agent_config_path,
  backend_id: session.backend_id,
  title: session.agent_config?.name,
  permission_mode: session.agent_config?.permission_mode ?? "default",
  acp_record: normalizeAcpListRecord(session),
  persist_session_id: session.persist_session_id,
  persist_task_id: session.persist_task_id,
  gateway_url: session.gateway_url,
  event_store_type: "jsonl",
  event_store_uri: this.storage.events.getEventStoreUri(identity),
  event_last_seq: -1,
  created_at: session.created_at.toISOString(),
  last_active_at: session.last_active_at.toISOString(),
});
```

`getStorageIdentity(session)` 是唯一允许把运行期 session 转为存储 identity 的 helper；storage 调用禁止裸用 `session.id`。

- [ ] **Step 4: backend 初始化后更新 ACP cache**

`ensureBackend()` 得到 backend capabilities 后，调用 `storage.index.upsertRecord()` 更新：
- `backend_id`
- `title`
- `acp_record`：从 ACP `session/new`、`session/load` 或 `session/list` 响应转换出的 Gateway list/cache 记录
- `last_active_at`

不要写执行器内部完整 session 记录，不要写完整 `agent_config`、`mcp_servers`、`agent_capabilities` JSON。

- [ ] **Step 5: 实现 `parkSession()`**

```typescript
async parkSession(identity: AcpSessionIdentity, closingConnection?: AcpConnection): Promise<void> {
  const session = this.sessions.get(sessionKey(identity));
  if (!session) return;
  if (session.connection instanceof DetachedConnection) return;
  if (closingConnection && session.connection !== closingConnection) return;

  const detached = new DetachedConnection(
    session.recorder,
    identity.session_id,
    session.agent_config?.permission_mode ?? "default"
  );
  session.connection = detached;
  session.status = "parked";
  session.last_active_at = new Date();
  await this.storage.index.updateStatus(identity.executor_type, identity.session_id, "parked", {
    parked_at: session.last_active_at.toISOString(),
    last_active_at: session.last_active_at.toISOString(),
  });
}
```

- [ ] **Step 6: 改造 `loadSession()`**

三种路径：
- 内存有 + detached：按 `executor_type + session_id` 调用 backend `session/resume`，`detached.resume(newConnection)` 返回 history，index 状态改 active
- 内存有 + active：替换 connection，index 更新 active
- 内存无 + SQLite 有：必须先确定 `executor_type`；如果 request 只给 `sessionId` 且 `findBySessionId()` 返回多条，返回 ambiguous error；否则创建 session 后必须调用 `ensureBackend(session)`，由 backend adapter 按 `executor_type` 路由并发送 ACP `session/load { sessionId: record.session_id }`，把原始 `session_id` 交回对应执行器恢复上下文；然后 `storage.events.loadEvents(identity)` 作为 history，pending 事件 patch 为 `abandoned`

无 `executor_type` 且 ambiguous 的错误信息必须包含：

```text
ACP session_id is ambiguous across executor_type; provide executor context
```

- [ ] **Step 7: 改造 `listSessions()`**

将 `listSessions()` 改为 async。SQLite index 是返回事实来源；内存 Map 和 backend 原生 `session/list` 只负责刷新 DB cache，不能绕过 DB 直接成为返回结果：

1. 将内存 Map 中的 active/parked session 转换为 `AcpSessionRecord`，按复合 key upsert 到 `storage.index`
2. 向 backend 查询 ACP `session/list`，把响应转换为 `acp_record` 并按 `executor_type + session_id` upsert 到 `storage.index`
3. 调用 `storage.index.listRecords()` 读取最终返回列表
4. 默认返回 active/parked，按 `last_active_at` 降序

实现中所有合并、去重和 Map key 都必须使用 `${executor_type}:${session_id}`。

- [ ] **Step 8: active connection 也通过 recorder 写事件**

`SdkAcpConnection` 或 manager 分发层在活跃 WebSocket 状态下也必须复用同一个 `AcpSessionEventRecorder`：

- `sessionUpdate(params)`：先 `recorder.append({ type: "session_update", ts, data: params })`，append 成功后再推送给前端；append 失败时记录 error 并继续推送，避免持久化短暂失败阻断 UI
- `requestPermission(params)`：需要人工时先 append `permission_request(pending)`，用户响应后 patch 为 `resolved`；用户取消或连接关闭时 patch 为 `cancelled`
- `requestClient(...)`：先 append `client_tool_call(pending)`，前端返回后 patch 为 `resolved`，超时/关闭 patch 为 `abandoned`
- 自动审批通过时 append `permission_response`，不生成 pending request

补测试：active session 产生 `session_update` 后断开重连，`loadSession.history` 能从 JSONL 读到该 active 阶段事件。

- [ ] **Step 9: 改造 `closeSession()` 和删除逻辑**

用户主动 close：
- 调 backend `session/close { sessionId }`
- `storage.index.updateStatus(executor_type, session_id, "finished")`
- 保留 JSONL history

用户删除：
- `storage.index.softDeleteRecord(executor_type, session_id, deletedAt)`
- 不删除 JSONL

物理删除：
- `storage.hardDeleteSession({ executor_type, session_id })`

- [ ] **Step 10: session manager 测试**

覆盖：
- create 后 SQLite 有 active 记录
- park 后 status 为 parked，事件仍写 JSONL
- load detached 返回 JSONL history，不使用内存 buffer
- gateway restart 路径从 SQLite + JSONL 恢复
- gateway restart 路径会实际调用 ACP `session/load { sessionId }`
- 同一 `session_id` 多 executor 时，无 executor context 的 load 返回 ambiguous error
- 内存 Map 中同一 `session_id` 不同 executor 不冲突
- `listSessions()` 返回值来自 SQLite index；内存/backend 只刷新 index
- storage 调用只使用 `getStorageIdentity(session)`，不会把 Gateway 内部 id 写入 SQLite 或 JSONL
- close 后 status 为 finished，JSONL 未删除
- 旧 socket close 不会 park 已被新 socket 接管的 session

- [ ] **Step 11: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- session-manager 2>&1 | tail -30
```

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/acp/ops/session-manager.ts
git commit -m "feat(acp): persist session index and park detached sessions"
```

---

## Task 7: Gateway 路由接入 park/load/list

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-acp.ts`
- Modify: `packages/core/src/gateway/index.ts`

- [ ] **Step 1: WebSocket close 改为 park**

```typescript
const cleanup = async () => {
  for (const identity of ownedSessionIdentities.values()) {
    await acpSessionManager.parkSession(identity, connection);
  }
  log.info({ sessions: ownedSessionIdentities.size }, "ACP WebSocket disconnected, sessions parked");
};

socket.once("close", () => {
  cleanup().catch((err) => log.warn({ err }, "Session park cleanup failed"));
});
```

- [ ] **Step 2: `loadSession` 传入新连接和上下文**

```typescript
async loadSession(request: AcpLoadSessionRequest) {
  const response = await acpSessionManager.loadSession(request, connection, context);
  if (response.sessionId) {
    const identity = await acpSessionManager.resolveSessionIdentity(response.sessionId, context);
    ownedSessionIdentities.set(sessionKey(identity), identity);
  }
  return response;
}
```

- [ ] **Step 3: `listSessions` await manager**

```typescript
async listSessions(_request: ListSessionsRequest): Promise<ListSessionsResponse> {
  const sessions = await acpSessionManager.listSessions();
  return {
    sessions: sessions.map((session) => ({
      sessionId: session.session_id,
      cwd: session.cwd,
      title: session.agentCapabilities._meta?.title as string | undefined,
      updatedAt: session.lastActiveAt,
      status: session.status,
    })),
  };
}
```

- [ ] **Step 4: `unstable_closeSession` await close**

```typescript
async unstable_closeSession(request: CloseSessionRequest) {
  if (request.sessionId) {
    const identity = await acpSessionManager.resolveSessionIdentity(request.sessionId, context);
    await acpSessionManager.closeSession(identity);
    ownedSessionIdentities.delete(sessionKey(identity));
  }
  return {};
}
```

- [ ] **Step 5: Gateway 启动时运行清理**

在 `packages/core/src/gateway/index.ts` 启动 listen 前调用：

```typescript
cleanupStaleAcpSessions(acpSessionManager.storage).catch((err) => {
  log.warn({ err }, "Stale ACP session cleanup failed");
});
```

- [ ] **Step 6: 运行 typecheck**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core typecheck 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/gateway/routes/agent-acp.ts packages/core/src/gateway/index.ts
git commit -m "feat(acp): park sessions on websocket disconnect"
```

---

## Task 8: PermissionHandler 集成到 active connection

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-acp.ts`

- [ ] **Step 1: 给 `SdkAcpConnection` 注入 PermissionHandler**

```typescript
import {
  createDefaultPermissionHandler,
  type PermissionHandler,
} from "../../acp/ops/permission-handler";
import type { AcpPermissionMode } from "../../acp";

class SdkAcpConnection implements AcpConnection {
  private permissionHandler: PermissionHandler;
  private permissionMode: AcpPermissionMode = "default";
  private dangerouslySkipPermissions = false;

  constructor(
    private readonly sdkConnection: AgentSideConnection,
    permissionHandler: PermissionHandler = createDefaultPermissionHandler()
  ) {
    this.permissionHandler = permissionHandler;
  }

  setPermissionMode(mode: AcpPermissionMode, dangerouslySkip: boolean): void {
    this.permissionMode = mode;
    this.dangerouslySkipPermissions = dangerouslySkip;
  }
}
```

- [ ] **Step 2: 在 `requestPermission()` 前置过滤**

```typescript
async requestPermission(params: AcpRequestPermissionRequest): Promise<AcpRequestPermissionResponse> {
  const effectiveMode: AcpPermissionMode = this.dangerouslySkipPermissions
    ? "bypassPermissions"
    : this.permissionMode;

  if (effectiveMode === "bypassPermissions") {
    const firstOption = (params as { options?: Array<{ id: string }> }).options?.[0];
    return { optionId: firstOption?.id ?? "yes" } as AcpRequestPermissionResponse;
  }

  const decision = await this.permissionHandler.evaluate(params, effectiveMode);
  if (decision.auto) {
    return { optionId: decision.optionId } as AcpRequestPermissionResponse;
  }

  return await this.sdkConnection.requestPermission(params);
}
```

- [ ] **Step 3: new/load session 后更新 permission mode**

在 `newSession` 和 `loadSession` handler 中，从 request/context 解析：

```typescript
const mode = (request.agent_config?.permission_mode ?? context.agent_config?.permission_mode ?? "default") as AcpPermissionMode;
connection.setPermissionMode(mode, false);
```

若已有全局 `dangerously_skip_permissions` 偏好，传入第二个参数。

- [ ] **Step 4: 测试 active permission 过滤**

覆盖：
- `DefaultPermissionHandler` 返回 `auto: false` 时仍走 WebSocket requestPermission
- 自定义 handler 返回 `auto: true` 时不推送 UI，直接 resolve option
- `bypassPermissions` 防御路径不推送 UI

- [ ] **Step 5: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- agent-acp 2>&1 | tail -30
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/gateway/routes/agent-acp.ts
git commit -m "feat(acp): apply permission handler to active sessions"
```

---

## Task 9: 前端 history 批量渲染和 parked 状态

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-client.ts`
- Modify: `apps/desktop/src/components/acp-chat/use-acp-session.ts`
- Modify: `apps/desktop/src/components/acp-chat/acp-chat-state.ts`
- Modify: session 列表 UI 组件和 locale 文件

- [ ] **Step 1: 同步前端 ACP 类型**

在 `acp-client.ts` 中新增：

```typescript
export type AcpPermissionMode =
  | "default"
  | "bypassPermissions"
  | "auto"
  | "acceptEdits"
  | "dontAsk"
  | "plan";

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
```

`loadSession()` 响应类型增加 `history?: AcpSessionEvent[]`。

- [ ] **Step 2: 提取同步 UI step apply 函数**

在 `acp-chat-state.ts` 中从现有队列应用逻辑提取 `applyUiStep()`，并新增：

```typescript
export function applyUiStepsImmediately(
  setSessionsById: (updater: (prev: Map<string, AcpSession>) => Map<string, AcpSession>) => void,
  sessionId: string,
  steps: AcpUiStep[]
): void {
  if (steps.length === 0) return;
  setSessionsById((prev) => {
    const current = prev.get(sessionId);
    if (!current) return prev;
    const next = new Map(prev);
    next.set(sessionId, steps.reduce((session, step) => applyUiStep(session, step), current));
    return next;
  });
}
```

- [ ] **Step 3: `use-acp-session.ts` 处理 history**

```typescript
const response = await acpClient.loadSession(request);
if (response.history && response.history.length > 0) {
  const allSteps: AcpUiStep[] = [];
  for (const event of response.history) {
    if (event.type !== "session_update") continue;
    allSteps.push(...acpSessionUpdateToUiSteps(event.data as AcpSessionUpdate));
  }
  applyUiStepsImmediately(setSessionsById, response.sessionId, allSteps);
}
```

history 批量渲染不走 streaming 动画队列，避免 chunk 重复拼接和 UI 闪烁。

- [ ] **Step 4: session list 展示 parked**

session item 中展示：

```tsx
{session.status === "parked" && (
  <Badge variant="secondary" className="text-xs">
    {t("session.parked")}
  </Badge>
)}
```

locale：

```json
{
  "session.parked": "已暂停"
}
```

英文：

```json
{
  "session.parked": "Paused"
}
```

- [ ] **Step 5: 运行 desktop typecheck**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/desktop typecheck 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop): render restored ACP session history"
```

---

## Task 10: 导出、清理任务和最终验证

**Files:**
- Modify: `packages/core/src/acp/index.ts`
- Modify: `packages/core/src/acp/ops/session-storage.ts`
- Modify: `packages/core/src/gateway/index.ts`

- [ ] **Step 1: 导出新模块**

在 `packages/core/src/acp/index.ts` 中追加：

```typescript
export type {
  AcpSessionRecord,
  AcpSessionRecordStatus,
  AcpSessionIndexStore,
} from "./ops/session-index-store";
export {
  SqliteAcpSessionIndexStore,
  InMemoryAcpSessionIndexStore,
  createDefaultAcpSessionIndexStore,
  validateAcpSessionIdentity,
} from "./ops/session-index-store";
export type {
  AcpSessionEventIdentity,
  AcpSessionEventStore,
} from "./ops/session-event-store";
export {
  JsonlAcpSessionEventStore,
  createDefaultAcpSessionEventStore,
} from "./ops/session-event-store";
export type { AcpSessionStorageAdapter } from "./ops/session-storage";
export {
  DefaultAcpSessionStorageAdapter,
  createDefaultAcpSessionStorage,
  cleanupStaleAcpSessions,
} from "./ops/session-storage";
export { AcpSessionEventRecorder } from "./ops/session-event-recorder";
export type { PermissionDecision, PermissionHandler } from "./ops/permission-handler";
export { createDefaultPermissionHandler, DefaultPermissionHandler } from "./ops/permission-handler";
export { DetachedConnection } from "./ops/detached-connection";
```

- [ ] **Step 2: 实现 stale cleanup**

在 `session-storage.ts` 增加：

```typescript
export async function cleanupStaleAcpSessions(
  storage: AcpSessionStorageAdapter,
  parkTTLDays = 7
): Promise<void> {
  const records = await storage.index.listRecords({ statuses: ["parked"] });
  const now = Date.now();
  for (const record of records) {
    const age = now - new Date(record.last_active_at).getTime();
    if (age > parkTTLDays * 24 * 60 * 60 * 1000) {
      await storage.index.updateStatus(record.executor_type, record.session_id, "finished", {
        finished_at: new Date(now).toISOString(),
        last_active_at: new Date(now).toISOString(),
      });
    }
  }
}
```

- [ ] **Step 3: 自动化测试补齐**

确保至少覆盖：
- SQLite `PRIMARY KEY (executor_type, session_id)` 可保存同名 session
- 无 executor context 的 ambiguous load 明确失败
- `listRecords()` 按 status/executor/cwd/agent_config_path/persist_task_id 过滤
- `acp_record_json` 损坏时 fallback
- JSONL event buffer 仍保存在文件
- `event_store_uri` 为 `<executor_type>/<session_id>/events.jsonl`
- gateway restart 恢复时 pending 事件 patch 为 `abandoned`
- active 和 detached 都通过同一个 recorder 写事件

- [ ] **Step 4: Core typecheck**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core typecheck 2>&1 | head -50
```

预期：0 错误。

- [ ] **Step 5: Core tests**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test 2>&1 | tail -50
```

预期：新增测试和既有测试全部 PASS。

- [ ] **Step 6: Workspace verification**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm typecheck 2>&1 | head -80
```

如项目没有顶层 `typecheck`，运行：

```bash
pnpm build 2>&1 | head -80
```

- [ ] **Step 7: 手动 smoke test**

启动 gateway：

```bash
pnpm gateway:restart
```

新建 ACP chat session，发送消息，关闭 WebSocket/desktop 后检查：

```bash
sqlite3 ~/.viben/acp/sessions.sqlite "select executor_type, session_id, status, cwd, agent_dir, agent_config_path, event_store_uri from acp_sessions order by last_active_at desc limit 5;"
ls ~/.viben/acp/sessions/<executor_type>/<session_id>/
```

预期：
- SQLite 中有 `active` 或 `parked` 记录
- `session_id` 和 `executor_type` 成对出现
- `event_store_uri` 指向 `<executor_type>/<session_id>/events.jsonl`
- 目录中只有事件缓冲文件，不创建 `meta.json`

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/acp/index.ts packages/core/src/acp/ops/session-storage.ts packages/core/src/gateway/index.ts
git commit -m "feat(acp): export session persistence storage and cleanup"
```
