# ACP Session 持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 ACP session 持久化，支持 WebSocket 断线重连恢复，backend 进程断开期间继续运行并缓冲输出。

**Architecture:** 四层设计——`AcpSessionStore`（JSONL 磁盘持久化）+ `AcpSessionEventRecorder`（active/detached 统一事件记录）+ `DetachedConnection`（断开时 pending 请求代理）+ `AcpSessionManager` 改造（park/resume 生命周期）。前端 `loadSession` 响应扩展 `history` 字段，history 始终从 JSONL 读取，支持批量回放历史而非逐条流式推送。

**Tech Stack:** Node.js `fs/promises`（JSONL 追加写入）、`AsyncLock`（per-session 写锁）、`@agentclientprotocol/sdk`（ACP session/resume、session/load、session/close）

---

## 文件结构

| 操作 | 路径 |
|------|------|
| 新建 | `packages/core/src/acp/ops/session-store.ts` |
| 新建 | `packages/core/src/acp/ops/session-event-recorder.ts` |
| 新建 | `packages/core/src/acp/ops/detached-connection.ts` |
| 新建 | `packages/core/src/acp/ops/approval-handler.ts` |
| 新建 | `packages/core/src/acp/ops/session-store.test.ts` |
| 修改 | `packages/core/src/acp/types.ts` |
| 修改 | `packages/core/src/acp/ops/session-manager.ts` |
| 修改 | `packages/core/src/acp/ops/backend-adapter.ts` |
| 修改 | `packages/core/src/gateway/routes/agent-acp.ts` |
| 修改 | `packages/core/src/agents/types.ts` |
| 修改 | `packages/core/src/acp/index.ts` |

---

## Task 1: 类型定义 — `AcpPermissionMode` + `AcpSessionRecord` + `AcpSessionEvent`

**Files:**
- Modify: `packages/core/src/acp/types.ts`
- Modify: `packages/core/src/agents/types.ts`

- [ ] **Step 1: 在 `packages/core/src/acp/types.ts` 中新增 `AcpPermissionMode` 类型，并收窄 `AgentConfigPayload.permission_mode` 字段类型**

在文件末尾（`AcpConnection` 接口之前）找到 `AgentConfigPayload` 接口，做以下修改：

```typescript
// 在文件顶部的类型区块中新增（放在 AcpSessionStatus 附近）
export type AcpPermissionMode =
  | "default"
  | "bypassPermissions"
  | "auto"
  | "acceptEdits"
  | "dontAsk"
  | "plan";
```

然后将 `AgentConfigPayload` 中：
```typescript
// 旧：
  approval_mode?: "bypass" | "rules" | "ai";
  permission_mode?: string;

// 新：
  approval_mode?: "bypass" | "rules" | "ai"; // legacy read-only；读取时迁移，新写入不再使用
  permission_mode?: AcpPermissionMode;
```

不要在本任务中删除 `approval_mode` 类型字段。现有 YAML 和代码仍可能读取该字段，先把它保留为 legacy read-only 字段，避免旧 agent 配置在类型层直接失效。

- [ ] **Step 2: 在 `types.ts` 中扩展 `AcpSessionStatus`，定义 `AcpSessionEvent`，并扩展 `AcpLoadSessionResponse`**

为避免循环依赖（`session-store.ts` 导入 `types.ts`，若反向 import 会成环），`AcpSessionEvent` 定义在 `types.ts`，`session-store.ts` 从 `types.ts` 导入。

首先在 `types.ts` 找到 `AcpSessionStatus` 类型（当前为 `"initializing" | "active" | "cancelled" | "finished" | "error"`），添加 `"parked"`：

```typescript
// 旧：
export type AcpSessionStatus = "initializing" | "active" | "cancelled" | "finished" | "error";

// 新：
export type AcpSessionStatus = "initializing" | "active" | "cancelled" | "finished" | "error" | "parked";
```

这让 `{ ...session, status: "parked" }` 通过 TypeScript 类型检查，`persistRecord` 的 `statusMap` 也已包含 `parked: "parked"` 映射。

`AcpSessionSummary.status` 同理需更新（若该字段类型是 `AcpSessionStatus` 则自动继承；若是字面量联合则添加 `"parked"`）：

```typescript
// 找到 AcpSessionSummary.status 字段，如果是独立联合类型，添加 "parked"：
  status: AcpSessionStatus;  // 使用引用类型即可，无需单独修改
```

在 `types.ts` 末尾 `AcpConnection` 接口之前追加：

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

然后修改 `AcpLoadSessionResponse`（line 41）：

```typescript
// 修改前：
export type AcpLoadSessionResponse = LoadSessionResponse & { sessionId?: string };

// 修改后：
export type AcpLoadSessionResponse = LoadSessionResponse & {
  sessionId?: string;
  history?: AcpSessionEvent[];
};
```

- [ ] **Step 3: 在 `packages/core/src/agents/types.ts` 中更新 `AgentConfigFile`**

```typescript
// 旧（line 39 附近）：
  approval_mode?: "bypass" | "rules" | "ai";
  permission_mode?: string;

// 新：
  approval_mode?: "bypass" | "rules" | "ai"; // legacy read-only
  permission_mode?:
    | "default"
    | "bypassPermissions"
    | "auto"
    | "acceptEdits"
    | "dontAsk"
    | "plan";
```

（不引入跨包 import，直接用字面量联合类型）

- [ ] **Step 4: 在 `packages/core/src/agents/index.ts` 中添加 legacy approval 字段 → `permission_mode` 向后兼容读取**

在 `agents/index.ts` 中找到读取 YAML 配置并构造 `AgentConfigPayload` 的地方，按优先级 `permission_mode` > `approval_mode` > `approvals` > 默认值进行归一化。新写入 YAML 时只写 `permission_mode`，不再写 `approval_mode` 或 `approvals`：

```typescript
function migrateApprovalFields(config: AgentConfigFile): void {
  if (config.permission_mode) return;

  if (config.approval_mode) {
    const migratedByApprovalMode: Record<NonNullable<AgentConfigFile["approval_mode"]>, NonNullable<AgentConfigFile["permission_mode"]>> = {
      bypass: "bypassPermissions",
      rules: "default",
      ai: "auto",
    };
    config.permission_mode = migratedByApprovalMode[config.approval_mode];
    return;
  }

  const approvals = (config as Record<string, unknown>).approvals;
  if (approvals !== undefined) {
    config.permission_mode = approvals === true ? "bypassPermissions" : "default";
    return;
  }

  config.permission_mode = "default";
}
```

在 `loadAgentConfig()` 返回 config 之前调用 `migrateApprovalFields(config)`。同时补单测覆盖：

- `permission_mode: "plan"` 保持 `"plan"`
- `approval_mode: "bypass"` 迁移为 `"bypassPermissions"`
- `approval_mode: "rules"` 迁移为 `"default"`
- `approval_mode: "ai"` 迁移为 `"auto"`
- `approvals: true` 迁移为 `"bypassPermissions"`
- `approvals: false` 迁移为 `"default"`

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core typecheck 2>&1 | head -30
```

预期：只有因 `AcpSessionEvent` 尚未定义导致的 1-2 个错误（Task 2 完成后归零），其余无新增错误。

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/acp/types.ts packages/core/src/agents/types.ts packages/core/src/agents/index.ts
git commit -m "types(acp): add AcpPermissionMode, extend AcpLoadSessionResponse with history, migrate approvals field"
```

---

## Task 2: `AcpSessionStore` — 接口 + 文件系统实现

**Files:**
- Create: `packages/core/src/acp/ops/session-store.ts`
- Create: `packages/core/src/acp/ops/session-store.test.ts`

- [ ] **Step 1: 创建 `session-store.ts`**

```typescript
// packages/core/src/acp/ops/session-store.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { AsyncLock } from "../../utils/async-lock";
import { logger as globalLogger } from "../../telemetry";
import type {
  AgentConfigPayload,
  AcpAgentCapabilities,
  AcpMcpServer,
  AcpSandboxConfig,
  AcpSessionEvent,         // 定义在 types.ts，避免循环依赖
  AcpSessionEventPatch,
} from "../types";

const log = globalLogger.child({ module: "acp-session-store" });

export type { AcpSessionEvent, AcpSessionEventPatch }; // re-export 方便外部使用

export interface AcpSessionRecord {
  id: string;
  status: "active" | "parked" | "finished" | "error";
  cwd: string;
  created_at: string;
  last_active_at: string;
  title?: string;
  agent_config_path?: string;
  agent_dir?: string;
  agent_config?: AgentConfigPayload;
  sandbox_config?: AcpSandboxConfig;
  mcp_servers: AcpMcpServer[];
  sdk_session_id?: string;
  agent_capabilities?: AcpAgentCapabilities;
  persist_session_id?: string;
  persist_task_id?: string;
  gateway_url?: string;
  last_seq?: number;
}

// （AcpSessionEvent 和 AcpSessionEventPatch 定义在 types.ts，此处通过 import + re-export 透出）

export interface AcpSessionStore {
  saveRecord(record: AcpSessionRecord): Promise<void>;
  loadRecord(id: string): Promise<AcpSessionRecord | null>;
  listRecords(): Promise<AcpSessionRecord[]>;
  deleteRecord(id: string): Promise<void>;
  appendEvent(sessionId: string, event: Omit<AcpSessionEvent, "seq">): Promise<number>;
  loadEvents(sessionId: string): Promise<AcpSessionEvent[]>;
  updateEventStatus(
    sessionId: string,
    seq: number,
    status: AcpSessionEvent["status"]
  ): Promise<void>;
}

export function createDefaultAcpSessionStore(): AcpSessionStore {
  const baseDir = path.join(os.homedir(), ".viben", "acp", "sessions");
  return new FileSystemAcpSessionStore(baseDir);
}

export class FileSystemAcpSessionStore implements AcpSessionStore {
  private writeLock = new AsyncLock();
  private seqCounters = new Map<string, number>();
  private lastSeqBySession = new Map<string, number>();

  constructor(private readonly baseDir: string) {}

  private validateSessionId(id: string): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id)) {
      throw new Error(`Invalid ACP session id: ${id}`);
    }
  }

  private sessionDir(id: string): string {
    this.validateSessionId(id);
    const base = path.resolve(this.baseDir);
    const resolved = path.resolve(base, id);
    if (!resolved.startsWith(base + path.sep)) {
      throw new Error(`ACP session id escapes session root: ${id}`);
    }
    return resolved;
  }

  private metaPath(id: string): string {
    return path.join(this.sessionDir(id), "meta.json");
  }

  private eventsPath(id: string): string {
    return path.join(this.sessionDir(id), "events.jsonl");
  }

  private async getNextSeq(sessionId: string): Promise<number> {
    const existing = this.seqCounters.get(sessionId);
    if (existing !== undefined) {
      this.seqCounters.set(sessionId, existing + 1);
      return existing;
    }
    const events = await this.loadEvents(sessionId);
    const maxSeq = events.reduce((max, event) => Math.max(max, event.seq), -1);
    const next = maxSeq + 1;
    this.seqCounters.set(sessionId, next + 1);
    this.lastSeqBySession.set(sessionId, maxSeq);
    return next;
  }

  async saveRecord(record: AcpSessionRecord): Promise<void> {
    const dir = this.sessionDir(record.id);
    const metaPath = this.metaPath(record.id);
    const tmpPath = `${metaPath}.tmp`;
    const bakPath = `${metaPath}.bak`;
    const lastSeq = this.lastSeqBySession.get(record.id);
    const nextRecord = lastSeq === undefined ? record : { ...record, last_seq: lastSeq };
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.copyFile(metaPath, bakPath);
    } catch {
      // No previous meta.json yet.
    }
    await fs.writeFile(tmpPath, JSON.stringify(nextRecord, null, 2), "utf8");
    await fs.rename(tmpPath, metaPath);
  }

  async loadRecord(id: string): Promise<AcpSessionRecord | null> {
    for (const candidate of [this.metaPath(id), `${this.metaPath(id)}.bak`]) {
      try {
        const raw = await fs.readFile(candidate, "utf8");
        return JSON.parse(raw) as AcpSessionRecord;
      } catch {
        // Try backup before returning null.
      }
    }
    return null;
  }

  async listRecords(): Promise<AcpSessionRecord[]> {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      const results = await Promise.allSettled(dirs.map((id) => this.loadRecord(id)));
      return results
        .filter((r): r is PromiseFulfilledResult<AcpSessionRecord> => r.status === "fulfilled" && r.value !== null)
        .map((r) => r.value);
    } catch {
      return [];
    }
  }

  async deleteRecord(id: string): Promise<void> {
    await fs.rm(this.sessionDir(id), { recursive: true, force: true });
    this.seqCounters.delete(id);
  }

  async appendEvent(sessionId: string, event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    return this.writeLock.withLock(sessionId, async () => {
      const seq = await this.getNextSeq(sessionId);
      const line = JSON.stringify({ ...event, seq }) + "\n";
      await fs.mkdir(this.sessionDir(sessionId), { recursive: true });
      await fs.appendFile(this.eventsPath(sessionId), line, "utf8");
      this.lastSeqBySession.set(sessionId, seq);
      return seq;
    });
  }

  async loadEvents(sessionId: string): Promise<AcpSessionEvent[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.eventsPath(sessionId), "utf8");
    } catch {
      return [];
    }

    const events: AcpSessionEvent[] = [];
    const patchMap = new Map<number, AcpSessionEvent["status"]>();

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed._type === "patch") {
          const p = parsed as AcpSessionEventPatch;
          patchMap.set(p.target_seq, p.patch.status);
        } else {
          events.push(parsed as AcpSessionEvent);
        }
      } catch {
        log.warn({ sessionId, line: trimmed.slice(0, 80) }, "Skipping corrupt JSONL line");
      }
    }

    // Apply patches
    for (const event of events) {
      if (patchMap.has(event.seq)) {
        event.status = patchMap.get(event.seq);
      }
    }

    return events;
  }

  async updateEventStatus(
    sessionId: string,
    seq: number,
    status: AcpSessionEvent["status"]
  ): Promise<void> {
    return this.writeLock.withLock(sessionId, async () => {
      const patch: AcpSessionEventPatch = { _type: "patch", target_seq: seq, patch: { status } };
      await fs.mkdir(this.sessionDir(sessionId), { recursive: true });
      await fs.appendFile(this.eventsPath(sessionId), JSON.stringify(patch) + "\n", "utf8");
    });
  }
}
```

- [ ] **Step 2: 写测试 `session-store.test.ts`**

```typescript
// packages/core/src/acp/ops/session-store.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { FileSystemAcpSessionStore } from "./session-store";
import type { AcpSessionRecord, AcpSessionEvent } from "./session-store";

function makeRecord(id: string): AcpSessionRecord {
  return {
    id,
    status: "active",
    cwd: "/tmp",
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
    mcp_servers: [],
  };
}

describe("FileSystemAcpSessionStore", () => {
  let tmpDir: string;
  let store: FileSystemAcpSessionStore;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "acp-store-test-"));
    store = new FileSystemAcpSessionStore(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("saveRecord / loadRecord roundtrip", async () => {
    const record = makeRecord("sess-1");
    await store.saveRecord(record);
    const loaded = await store.loadRecord("sess-1");
    expect(loaded?.id).toBe("sess-1");
    expect(loaded?.status).toBe("active");
  });

  it("loadRecord returns null for missing id", async () => {
    expect(await store.loadRecord("nope")).toBeNull();
  });

  it("listRecords returns all saved records", async () => {
    await store.saveRecord(makeRecord("a"));
    await store.saveRecord(makeRecord("b"));
    const list = await store.listRecords();
    expect(list.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("deleteRecord removes files", async () => {
    await store.saveRecord(makeRecord("del-me"));
    await store.deleteRecord("del-me");
    expect(await store.loadRecord("del-me")).toBeNull();
  });

  it("appendEvent assigns sequential seq numbers", async () => {
    const base: Omit<AcpSessionEvent, "seq"> = {
      ts: new Date().toISOString(),
      type: "session_update",
      data: {},
    };
    const seq0 = await store.appendEvent("s1", base);
    const seq1 = await store.appendEvent("s1", base);
    expect(seq0).toBe(0);
    expect(seq1).toBe(1);
  });

  it("loadEvents returns events in order", async () => {
    await store.appendEvent("s2", { ts: "", type: "prompt", data: "hello" });
    await store.appendEvent("s2", { ts: "", type: "session_update", data: {} });
    const events = await store.loadEvents("s2");
    expect(events).toHaveLength(2);
    expect(events[0].seq).toBe(0);
    expect(events[1].seq).toBe(1);
  });

  it("updateEventStatus applies patch via last-write-wins", async () => {
    const seq = await store.appendEvent("s3", { ts: "", type: "permission_request", status: "pending", data: {} });
    await store.updateEventStatus("s3", seq, "resolved");
    const events = await store.loadEvents("s3");
    expect(events[0].status).toBe("resolved");
  });

  it("loadEvents skips corrupt lines silently", async () => {
    const eventsPath = path.join(tmpDir, "s4", "events.jsonl");
    await fs.mkdir(path.dirname(eventsPath), { recursive: true });
    await fs.writeFile(eventsPath, '{"seq":0,"ts":"","type":"prompt","data":{}}\nNOT_JSON\n{"seq":1,"ts":"","type":"notification","data":{}}\n');
    const events = await store.loadEvents("s4");
    expect(events).toHaveLength(2);
  });

  it("resumes seq from existing events without public initSeqCounter", async () => {
    await store.appendEvent("s5", { ts: "", type: "notification", data: {} });
    const freshStore = new FileSystemAcpSessionStore(tmpDir);
    const seq = await freshStore.appendEvent("s5", { ts: "", type: "notification", data: {} });
    expect(seq).toBe(1);
  });

  it("rejects path traversal session ids", async () => {
    await expect(store.appendEvent("../escape", { ts: "", type: "notification", data: {} })).rejects.toThrow(/Invalid ACP session id/);
    await expect(store.loadRecord("a/b")).rejects.toThrow(/Invalid ACP session id/);
  });

  it("loadRecord falls back to meta backup when primary is corrupt", async () => {
    await store.saveRecord(makeRecord("backup"));
    await store.saveRecord({ ...makeRecord("backup"), status: "parked" });
    await fs.writeFile(path.join(tmpDir, "backup", "meta.json"), "{bad json", "utf8");
    const loaded = await store.loadRecord("backup");
    expect(loaded?.id).toBe("backup");
  });
});
```

- [ ] **Step 3: 运行测试**

```bash
cd /Users/lxy/Documents/GitHub/LinXueyuanStdio/viben
pnpm --filter @viben/core test -- session-store 2>&1 | tail -20
```

预期：10 个测试全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/acp/ops/session-store.ts packages/core/src/acp/ops/session-store.test.ts
git commit -m "feat(acp): add AcpSessionStore interface and FileSystemAcpSessionStore implementation"
```

---

## Task 3: `ApprovalHandler` — 接口 + stub 实现

**Files:**
- Create: `packages/core/src/acp/ops/approval-handler.ts`

- [ ] **Step 1: 创建 `approval-handler.ts`**

```typescript
// packages/core/src/acp/ops/approval-handler.ts
import type { AcpPermissionMode, AcpRequestPermissionRequest } from "../types";

export type ApprovalDecision =
  | { auto: true; optionId: string }
  | { auto: false };

export interface ApprovalHandler {
  evaluate(
    params: AcpRequestPermissionRequest,
    permissionMode: AcpPermissionMode
  ): Promise<ApprovalDecision>;
}

export class DefaultApprovalHandler implements ApprovalHandler {
  async evaluate(
    _params: AcpRequestPermissionRequest,
    permissionMode: AcpPermissionMode
  ): Promise<ApprovalDecision> {
    // "bypassPermissions" 模式下 backend 不会发 requestPermission，此处不会被调用
    // "auto" 模式：stub — 待后续接入 LLM，暂时全部挂起由人工决定
    // "default" 模式：暂时全部挂起由人工决定（后续可加规则判断）
    return { auto: false };
  }
}

export function createDefaultApprovalHandler(): ApprovalHandler {
  return new DefaultApprovalHandler();
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/acp/ops/approval-handler.ts
git commit -m "feat(acp): add ApprovalHandler interface with stub DefaultApprovalHandler"
```

---

## Task 4: `AcpSessionEventRecorder` — active/detached 统一事件记录

**Files:**
- Create: `packages/core/src/acp/ops/session-event-recorder.ts`

- [ ] **Step 1: 创建 `session-event-recorder.ts`**

```typescript
// packages/core/src/acp/ops/session-event-recorder.ts
import type { AcpSessionEvent } from "../types";
import type { AcpSessionStore } from "./session-store";

export class AcpSessionEventRecorder {
  constructor(
    private readonly store: AcpSessionStore,
    private readonly sessionId: string
  ) {}

  append(event: Omit<AcpSessionEvent, "seq">): Promise<number> {
    return this.store.appendEvent(this.sessionId, event);
  }

  updateStatus(seq: number, status: AcpSessionEvent["status"]): Promise<void> {
    return this.store.updateEventStatus(this.sessionId, seq, status);
  }

  async loadHistory(): Promise<AcpSessionEvent[]> {
    return (await this.store.loadEvents(this.sessionId)).sort((a, b) => a.seq - b.seq);
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

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/acp/ops/session-event-recorder.ts
git commit -m "feat(acp): add AcpSessionEventRecorder for unified session history"
```

---

## Task 5: `DetachedConnection` — 断开时的 pending 请求代理

**Files:**
- Create: `packages/core/src/acp/ops/detached-connection.ts`

- [ ] **Step 1: 创建 `detached-connection.ts`**

```typescript
// packages/core/src/acp/ops/detached-connection.ts
import { logger as globalLogger } from "../../telemetry";
import type { AcpConnection, AcpPermissionMode, AcpRequestPermissionRequest, AcpRequestPermissionResponse, AcpSessionNotification } from "../types";
import type { AcpSessionEvent } from "./session-store";
import type { AcpSessionEventRecorder } from "./session-event-recorder";
import { createDefaultApprovalHandler, type ApprovalHandler } from "./approval-handler";

const log = globalLogger.child({ module: "detached-connection" });

const CLIENT_TOOL_TIMEOUT_MS = 60_000;

interface PendingRequest<T> {
  seq: number;
  params: unknown;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  timeoutTimer?: NodeJS.Timeout;
}

export class DetachedConnection implements AcpConnection {
  private pendingPermissions = new Map<string, PendingRequest<AcpRequestPermissionResponse>>();
  private pendingToolCalls = new Map<string, PendingRequest<unknown>>();
  private draining = false;
  private approvalHandler: ApprovalHandler;

  constructor(
    private readonly recorder: AcpSessionEventRecorder,
    private readonly sessionId: string,
    private readonly permissionMode: AcpPermissionMode,
    approvalHandler?: ApprovalHandler
  ) {
    this.approvalHandler = approvalHandler ?? createDefaultApprovalHandler();
  }

  async sessionUpdate(params: AcpSessionNotification): Promise<void> {
    await this.recorder.append({
      ts: new Date().toISOString(),
      type: "session_update",
      data: params,
    });
  }

  async requestPermission(params: AcpRequestPermissionRequest): Promise<AcpRequestPermissionResponse> {
    const decision = await this.approvalHandler.evaluate(params, this.permissionMode);
    if (decision.auto) {
      await this.recorder.append({
        ts: new Date().toISOString(),
        type: "permission_response",
        data: { optionId: decision.optionId },
      });
      const option = (params as { options?: Array<{ id: string }> }).options?.find(
        (o) => o.id === decision.optionId
      );
      return { optionId: decision.optionId, ...(option ?? {}) } as AcpRequestPermissionResponse;
    }

    const requestId = (params as { requestId?: string }).requestId ?? `perm-${Date.now()}`;
    const seq = await this.recorder.append({
      ts: new Date().toISOString(),
      type: "permission_request",
      id: requestId,
      status: "pending",
      data: params,
    });

    return new Promise<AcpRequestPermissionResponse>((resolve, reject) => {
      this.pendingPermissions.set(requestId, { seq, params, resolve, reject });
    });
  }

  async requestClient(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const toolCallId = (params?.toolCallId as string | undefined) ?? `tool-${Date.now()}`;
    const seq = await this.recorder.append({
      ts: new Date().toISOString(),
      type: "client_tool_call",
      id: toolCallId,
      status: "pending",
      data: { method, params },
    });

    return new Promise<unknown>((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        this.pendingToolCalls.delete(toolCallId);
        this.recorder.updateStatus(seq, "abandoned").catch((err) => {
          log.warn({ err, sessionId: this.sessionId, toolCallId }, "Failed to mark client tool call abandoned");
        });
        reject(new Error(`Client tool call timed out: ${toolCallId}`));
      }, CLIENT_TOOL_TIMEOUT_MS);

      this.pendingToolCalls.set(toolCallId, {
        seq,
        params: { method, params },
        resolve,
        reject,
        timeoutTimer,
      });
    });
  }

  async notifyClient(method: string, params?: Record<string, unknown>): Promise<void> {
    await this.recorder.append({
      ts: new Date().toISOString(),
      type: "notification",
      data: { method, params },
    });
  }

  /**
   * 重连时调用：从 JSONL 返回完整 history，并异步处理 pending 请求。
   */
  async resume(newConnection: AcpConnection): Promise<AcpSessionEvent[]> {
    const history = await this.recorder.loadHistory();
    this.drainPendingAsync(newConnection);
    return history;
  }

  private drainPendingAsync(newConnection: AcpConnection): void {
    if (this.draining) return;
    this.draining = true;

    const run = async () => {
      const sortedPermissions = [...this.pendingPermissions.entries()].sort(
        (a, b) => a[1].seq - b[1].seq
      );
      for (const [id, pending] of sortedPermissions) {
        try {
          const decision = await newConnection.requestPermission(
            pending.params as AcpRequestPermissionRequest
          );
          pending.resolve(decision);
          await this.recorder.updateStatus(pending.seq, "resolved");
        } catch (err) {
          pending.reject(err);
        }
        this.pendingPermissions.delete(id);
      }

      const sortedTools = [...this.pendingToolCalls.entries()].sort(
        (a, b) => a[1].seq - b[1].seq
      );
      for (const [id, pending] of sortedTools) {
        if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
        try {
          const result = await newConnection.requestClient(
            "_viben/client_tool_call",
            pending.params as Record<string, unknown>
          );
          pending.resolve(result);
          await this.recorder.updateStatus(pending.seq, "resolved");
        } catch (err) {
          pending.reject(err);
        }
        this.pendingToolCalls.delete(id);
      }

      this.draining = false;
    };

    run().catch((err) => {
      log.warn({ err, sessionId: this.sessionId }, "drainPendingAsync failed");
      this.draining = false;
    });
  }

  /**
   * 关闭时调用：拒绝 pending 请求并 patch 状态。
   */
  async close(): Promise<void> {
    for (const [, pending] of this.pendingPermissions) {
      await this.recorder.updateStatus(pending.seq, "cancelled");
      pending.reject(new Error("DetachedConnection closed"));
    }
    for (const [, pending] of this.pendingToolCalls) {
      if (pending.timeoutTimer) clearTimeout(pending.timeoutTimer);
      await this.recorder.updateStatus(pending.seq, "cancelled");
      pending.reject(new Error("DetachedConnection closed"));
    }
    this.pendingPermissions.clear();
    this.pendingToolCalls.clear();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/acp/ops/detached-connection.ts
git commit -m "feat(acp): add DetachedConnection for session buffering during WS disconnect"
```

---

## Task 6: `backend-adapter.ts` — 添加 `"auto"` 并暴露 backend session lifecycle 能力

**Files:**
- Modify: `packages/core/src/acp/ops/backend-adapter.ts`

- [ ] **Step 1: 修改 `CLAUDE_PERMISSION_MODES` 集合，添加 `"auto"`**

定位 `backend-adapter.ts` 第 49-55 行：

```typescript
// 旧：
const CLAUDE_PERMISSION_MODES = new Set([
  "default",
  "acceptEdits",
  "dontAsk",
  "plan",
  "bypassPermissions",
]);

// 新：
const CLAUDE_PERMISSION_MODES = new Set([
  "default",
  "acceptEdits",
  "dontAsk",
  "plan",
  "bypassPermissions",
  "auto",
]);
```

- [ ] **Step 2: 在 `AcpBackendSession` / adapter 层补显式方法**

在 `packages/core/src/acp/ops/backend-adapter.ts` 的 `AcpBackendSession` 接口中新增可选方法，供 `AcpSessionManager` 调用，避免 type cast 到 SDK client：

```typescript
export interface AcpBackendSession {
  backendSessionId?: string;
  agentCapabilities?: AcpAgentCapabilities;
  configOptions?: AcpConfigOption[];
  prompt(request: AcpPromptRequest): Promise<AcpPromptResponse>;
  cancel(): Promise<void>;
  close(): Promise<void>;
  resume?(sessionId: string): Promise<void>;
  closeBackendSession?(sessionId: string): Promise<void>;
}

export interface AcpBackendAdapter {
  createSession(context: AcpBackendSessionContext): Promise<AcpBackendSession>;
  listSessions?(): Promise<Array<{
    sessionId: string;
    cwd?: string;
    createdAt?: string;
    updatedAt?: string;
  }>>;
}
```

`SubprocessAcpBackendAdapter` 中若 SDK 暂无对应方法，应返回明确的 no-op fallback 并记录 debug 日志；fake backend 测试必须断言支持时 `resume()` / `closeBackendSession()` 被调用，不支持时不会抛错。

- [ ] **Step 3: 验证编译**

```bash
pnpm --filter @viben/core typecheck 2>&1 | head -20
```

预期：无新增错误。

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/acp/ops/backend-adapter.ts
git commit -m "fix(acp): add 'auto' to CLAUDE_PERMISSION_MODES set"
```

---

## Task 7: `AcpSessionManager` 改造 — recorder + park/resume + async closeSession

**Files:**
- Modify: `packages/core/src/acp/ops/session-manager.ts`

- [ ] **Step 1: 在 `session-manager.ts` 顶部添加新依赖 import**

在现有 import 块末尾追加：

```typescript
import type { AcpSessionStore, AcpSessionRecord } from "./session-store";
import { AcpSessionEventRecorder } from "./session-event-recorder";
import { DetachedConnection } from "./detached-connection";
```

- [ ] **Step 2: 修改 `AcpSessionManager` 构造函数，注入 `AcpSessionStore`**

```typescript
// 旧：
export class AcpSessionManager {
  private sessions = new Map<string, AcpSession>();
  private backendAdapter: AcpBackendAdapter;
  private steerPromptStore: AcpSteerPromptStore;

  constructor(
    backendAdapter: AcpBackendAdapter = createDefaultAcpBackendAdapter(),
    steerPromptStore: AcpSteerPromptStore = createDefaultAcpSteerPromptStore()
  ) {
    this.backendAdapter = backendAdapter;
    this.steerPromptStore = steerPromptStore;
  }

// 新：
export class AcpSessionManager {
  private sessions = new Map<string, AcpSession>();
  private backendAdapter: AcpBackendAdapter;
  private steerPromptStore: AcpSteerPromptStore;
  public readonly store: AcpSessionStore | null;

  constructor(
    backendAdapter: AcpBackendAdapter = createDefaultAcpBackendAdapter(),
    steerPromptStore: AcpSteerPromptStore = createDefaultAcpSteerPromptStore(),
    store: AcpSessionStore | null = null
  ) {
    this.backendAdapter = backendAdapter;
    this.steerPromptStore = steerPromptStore;
    this.store = store;
  }
```

- [ ] **Step 3: 给 `AcpSession` 添加 recorder，并在创建 session 时初始化**

在 `AcpSession` 接口中增加：

```typescript
  recorder?: AcpSessionEventRecorder;
```

新增 helper：

```typescript
  private createRecorder(sessionId: string): AcpSessionEventRecorder | undefined {
    return this.store ? new AcpSessionEventRecorder(this.store, sessionId) : undefined;
  }
```

在 `createSessionRecord()` 构造 session 时增加：

```typescript
      recorder: this.createRecorder(sessionId),
```

- [ ] **Step 4: 修改 `createSession()`，新增 session 创建后 `store.saveRecord()`**

在 `createSession()` 方法中，`this.sessions.set(sessionId, session)` 之后追加：

```typescript
    this.sessions.set(sessionId, session);
    // 持久化到磁盘
    await this.persistRecord(session);
    log.info({ sessionId, cwd: session.cwd, agentConfigPath: session.agent_config_path }, "ACP session created");
```

新增私有方法（放在 `requireSession` 附近）：

```typescript
  private async persistRecord(session: AcpSession): Promise<void> {
    if (!this.store) return;
    // Map AcpSession.status → AcpSessionRecord.status
    // "initializing" and "cancelled" have no direct equivalent; both map to "active"/"finished"
    const statusMap: Record<string, AcpSessionRecord["status"]> = {
      initializing: "active",
      active: "active",
      cancelled: "finished",
      finished: "finished",
      error: "error",
      parked: "parked",
    };
    const record: AcpSessionRecord = {
      id: session.id,
      status: statusMap[session.status] ?? "active",
      cwd: session.cwd,
      created_at: session.created_at.toISOString(),
      last_active_at: session.last_active_at.toISOString(),
      agent_config_path: session.agent_config_path,
      agent_dir: session.agent_dir,
      agent_config: session.agent_config,
      sandbox_config: session.sandbox_config,
      mcp_servers: session.mcp_servers,
      sdk_session_id: session.sdk_session_id,
      agent_capabilities: session.agent_capabilities,
      persist_session_id: session.persist_session_id,
      persist_task_id: session.persist_task_id,
      gateway_url: session.gateway_url,
      title: session.title,
    };
    try {
      await this.store.saveRecord(record);
    } catch (err) {
      log.warn({ err, sessionId: session.id }, "Failed to persist ACP session record");
    }
  }
```

- [ ] **Step 5: 修改 `ensureBackend()`，backend 初始化后更新磁盘记录（含 title 提取）**

在 `session.backend = backend;` 之后追加：

```typescript
    session.backend = backend;
    session.sdk_session_id = backend.backendSessionId;
    session.agent_capabilities = backend.agentCapabilities ?? DEFAULT_AGENT_CAPABILITIES;
    session.config_options = backend.configOptions;
    // 从 agentCapabilities._meta?.title 或 agent_config?.name 提取 title 存入磁盘
    // （spec 四要求：ensureBackend 后须更新 title）
    if (!session.title) {
      session.title =
        (session.agent_capabilities._meta as Record<string, unknown> | undefined)?.title as string | undefined
        ?? session.agent_config?.name
        ?? undefined;
    }
    // 更新 sdk_session_id + title + agent_capabilities 到磁盘
    await this.persistRecord(session);
    return backend;
```

注意：`persistRecord()` 中需透传 `session.title` 到 `record.title`（当前实现已包含该字段，见 Step 3 的 `record` 对象，若缺少则在 Step 3 代码块中的 `AcpSessionRecord` 构造里补上 `title: session.title`）。

- [ ] **Step 6: 新增 `parkSession()` 方法，并避免旧 WebSocket park 掉新连接**

在 `closeSession()` 方法之前插入：

```typescript
  async parkSession(sessionId: string, closingConnection?: AcpConnection): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.connection instanceof DetachedConnection) {
      log.warn({ sessionId }, "Session already parked, skipping");
      return;
    }
    if (closingConnection && session.connection !== closingConnection) {
      log.debug({ sessionId }, "Skip parking session because it has been claimed by another connection");
      return;
    }

    const permissionMode = session.agent_config?.permission_mode ?? "default";
    const detached = new DetachedConnection(
      session.recorder ?? new AcpSessionEventRecorder(createNullStore(), sessionId),
      sessionId,
      permissionMode
    );
    session.connection = detached;
    session.last_active_at = new Date();

    if (this.store) {
      await this.persistRecord({ ...session, status: "parked" } as AcpSession & { status: "parked" });
    }

    log.info({ sessionId }, "ACP session parked");
  }
```

还需要一个 null store helper（防御性，store 为 null 时 DetachedConnection 仍可运行但不落盘）：

```typescript
function createNullStore(): AcpSessionStore {
  return {
    async saveRecord() {},
    async loadRecord() { return null; },
    async listRecords() { return []; },
    async deleteRecord() {},
    async appendEvent() { return 0; },
    async loadEvents() { return []; },
    async updateEventStatus() {},
  };
}
```

- [ ] **Step 7: 修改 `loadSession()`，处理 parked session 重连**

替换现有 `loadSession()` 方法：

```typescript
  async loadSession(
    request: AcpLoadSessionRequest,
    connection: AcpConnection,
    context: AcpSessionContext = {}
  ): Promise<AcpLoadSessionResponse> {
    const existing = this.sessions.get(request.sessionId);

    // Case 1: 内存有，且 connection 是 DetachedConnection（正常断线重连）
    if (existing && existing.connection instanceof DetachedConnection) {
      const detached = existing.connection;
      // 通知 backend 继续推送（ACP session/resume）
      if (existing.backend) {
        try {
          await existing.backend.resume?.(existing.sdk_session_id ?? request.sessionId);
        } catch (err) {
          log.debug({ err, sessionId: request.sessionId }, "session/resume notification failed (non-fatal)");
        }
      }
      const history = await detached.resume(connection);
      existing.connection = connection;
      existing.last_active_at = new Date();
      await this.persistRecord(existing);
      log.info({ sessionId: request.sessionId, historyLength: history.length }, "ACP session resumed from parked state");
      return { sessionId: existing.id, configOptions: existing.config_options, history };
    }

    // Case 2: 内存有，普通连接（如浏览器刷新）
    if (existing) {
      existing.connection = connection;
      existing.last_active_at = new Date();
      if (!existing.backend) {
        existing.backend_load_session_id = request.sessionId;
      }
      return { sessionId: existing.id, configOptions: existing.config_options };
    }

    // Case 3: 内存无，磁盘有（gateway 重启后恢复）
    if (this.store) {
      const diskRecord = await this.store.loadRecord(request.sessionId);
      if (diskRecord) {
        const session = await this.createSessionRecord(
          request.sessionId,
          {
            cwd: diskRecord.cwd,
            mcpServers: diskRecord.mcp_servers,
            agent_config_path: diskRecord.agent_config_path,
            agent_dir: diskRecord.agent_dir,
            agent_config: diskRecord.agent_config,
            persist_session_id: diskRecord.persist_session_id,
            persist_task_id: diskRecord.persist_task_id,
            sandbox_config: diskRecord.sandbox_config,
          },
          connection,
          context
        );
        session.backend_load_session_id = diskRecord.sdk_session_id ?? request.sessionId;
        session.sdk_session_id = diskRecord.sdk_session_id;
        session.recorder = this.createRecorder(request.sessionId);
        this.sessions.set(request.sessionId, session);

        const allEvents = await this.store.loadEvents(request.sessionId);

        // pending 事件标为 abandoned（backend 已死）
        for (const event of allEvents) {
          if (event.status === "pending") {
            await session.recorder?.updateStatus(event.seq, "abandoned");
            event.status = "abandoned";
          }
        }

        const history = allEvents.filter((e) => e.type === "session_update");
        log.info({ sessionId: request.sessionId, historyLength: history.length }, "ACP session recovered from disk after gateway restart");
        return { sessionId: request.sessionId, configOptions: session.config_options, history };
      }
    }

    // Case 4: 都没有 → 新建
    const session = await this.createSessionRecord(
      request.sessionId,
      {
        cwd: request.cwd,
        mcpServers: request.mcpServers ?? [],
        agent_config_path: request.agent_config_path ?? context.agent_config_path,
        agent_dir: request.agent_dir ?? context.agent_dir,
        agent_config: request.agent_config ?? context.agent_config,
        persist_session_id: request.persist_session_id ?? context.session_id,
        persist_task_id: request.persist_task_id ?? context.task_id,
        sandbox_config: request.sandbox_config ?? context.sandbox_config,
      },
      connection,
      context
    );
    session.backend_load_session_id = request.sessionId;
    this.sessions.set(request.sessionId, session);
    await this.persistRecord(session);
    log.info({ sessionId: request.sessionId, cwd: session.cwd }, "ACP session loaded as new live session");
    return { sessionId: request.sessionId, configOptions: session.config_options };
  }
```

- [ ] **Step 8: 修改 `closeSession()`，改为 async 并 await final close / persist**

```typescript
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.prompt_running) {
      clientToolCompletionRegistry.cancelSession(sessionId);
    }
    if (session.connection instanceof DetachedConnection) {
      await session.connection.close();
    }
    if (session.backend?.closeBackendSession && session.sdk_session_id) {
      await session.backend.closeBackendSession(session.sdk_session_id);
    }
    await session.backend?.close();
    for (const item of session.prompt_queue.splice(0)) {
      item.resolve({ stopReason: "cancelled" });
    }
    await this.persistRecord({ ...session, status: "finished" } as AcpSession);
    this.sessions.delete(sessionId);
    log.info({ sessionId }, "ACP session closed");
  }
```

同时将 `closeAll()` 改为 async：

```typescript
  async closeAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((sessionId) => this.closeSession(sessionId)));
  }
```

- [ ] **Step 9: 修改 `listSessions()`，合并内存、backend list、磁盘 parked 记录**

```typescript
  async listSessions(): Promise<AcpSessionSummary[]> {
    const memorySessions = Array.from(this.sessions.values()).map((s) => toSummary(s));
    if (!this.store) return memorySessions;

    const backendSessions = await this.backendAdapter.listSessions?.().catch((err) => {
      log.debug({ err }, "ACP backend session/list failed");
      return [];
    }) ?? [];
    const diskRecords = await this.store.listRecords();
    const memoryIds = new Set(this.sessions.keys());
    const parkedFromDisk = diskRecords
      .filter((r) => r.status === "parked" && !memoryIds.has(r.id))
      .map((r): AcpSessionSummary => ({
        id: r.id,
        status: "parked",
        cwd: r.cwd,
        createdAt: r.created_at,
        lastActiveAt: r.last_active_at,
        queueDepth: 0,
        promptRunning: false,
        sdkSessionId: r.sdk_session_id,
        agentCapabilities: r.agent_capabilities ?? DEFAULT_AGENT_CAPABILITIES,
      }));

    const backendOnly = backendSessions
      .filter((s) => !memoryIds.has(s.sessionId))
      .map((s): AcpSessionSummary => ({
        id: s.sessionId,
        status: "active",
        cwd: s.cwd ?? "",
        createdAt: s.createdAt ?? new Date(0).toISOString(),
        lastActiveAt: s.updatedAt ?? new Date(0).toISOString(),
        queueDepth: 0,
        promptRunning: false,
        sdkSessionId: s.sessionId,
        agentCapabilities: DEFAULT_AGENT_CAPABILITIES,
      }));

    return [...memorySessions, ...backendOnly, ...parkedFromDisk].sort(
      (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );
  }
```

注意：原来的 `listSessions()` 是同步的，改为 `async`，需要更新所有调用方（`agent-acp.ts` 的 `listSessions` handler）。

- [ ] **Step 10: 运行测试确认无回归**

```bash
pnpm --filter @viben/core test -- session-manager 2>&1 | tail -20
```

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/acp/ops/session-manager.ts
git commit -m "feat(acp): add parkSession/resumeSession, persist session lifecycle to disk"
```

---

## Task 8: `agent-acp.ts` — WS 断开改为 parkSession + listSessions 改为 async

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-acp.ts`

- [ ] **Step 1: 修改 WS 断开处理，`closeSession` → `parkSession`**

```typescript
// 旧：
    const cleanup = () => {
      for (const sessionId of ownedSessionIds) {
        acpSessionManager.closeSession(sessionId);
      }
      log.info({ sessions: ownedSessionIds.size }, "ACP WebSocket disconnected");
    };

// 新：
    const cleanup = async () => {
      for (const sessionId of ownedSessionIds) {
        await acpSessionManager.parkSession(sessionId, connection);
      }
      log.info({ sessions: ownedSessionIds.size }, "ACP WebSocket disconnected, sessions parked");
    };
```

然后将 `socket.once("close", cleanup)` 改为：

```typescript
    socket.once("close", () => { cleanup().catch((err) => log.warn({ err }, "Session park cleanup failed")); });
```

- [ ] **Step 2: 修改 `listSessions` handler，改为 async**

```typescript
// 旧：
    async listSessions(_request: ListSessionsRequest): Promise<ListSessionsResponse> {
      return {
        sessions: acpSessionManager.listSessions().map((session) => ({
          sessionId: session.id,
          cwd: session.cwd,
          title: session.agentCapabilities._meta?.title as string | undefined,
          updatedAt: session.lastActiveAt,
        })),
      };
    },

// 新：
    async listSessions(_request: ListSessionsRequest): Promise<ListSessionsResponse> {
      const sessions = await acpSessionManager.listSessions();
      return {
        sessions: sessions.map((session) => ({
          sessionId: session.id,
          cwd: session.cwd,
          title: session.agentCapabilities._meta?.title as string | undefined,
          updatedAt: session.lastActiveAt,
        })),
      };
    },
```

- [ ] **Step 3: 修改 `unstable_closeSession` handler，await async closeSession**

```typescript
    async unstable_closeSession(request: CloseSessionRequest) {
      if (request.sessionId) {
        await acpSessionManager.closeSession(request.sessionId);
        ownedSessionIds.delete(request.sessionId);
      }
      return {};
    },
```

- [ ] **Step 4: 在 gateway 初始化时注入 `AcpSessionStore`**

定位 `packages/core/src/acp/ops/session-manager.ts` 末尾的单例：

```typescript
// 旧：
export const acpSessionManager = new AcpSessionManager();

// 新：
import { createDefaultAcpSessionStore } from "./session-store";
export const acpSessionManager = new AcpSessionManager(
  createDefaultAcpBackendAdapter(),
  createDefaultAcpSteerPromptStore(),
  createDefaultAcpSessionStore()
);
```

- [ ] **Step 5: 修改 `getActiveAcpSessionCount()` 以兼容 async listSessions**

```typescript
// 旧：
export function getActiveAcpSessionCount(): number {
  return acpSessionManager.listSessions().length;
}

// 新：
export async function getActiveAcpSessionCount(): Promise<number> {
  return (await acpSessionManager.listSessions()).length;
}
```

同时检查实际调用方（`routes/index.ts` 只是 re-export，不是调用方）：

```bash
grep -rn "getActiveAcpSessionCount" --include="*.ts" packages/ apps/ | grep -v "export\|function\|declare"
```

对找到的每处调用加上 `await`。

- [ ] **Step 6: TypeCheck**

```bash
pnpm --filter @viben/core typecheck 2>&1 | head -30
```

预期：无错误。

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/gateway/routes/agent-acp.ts packages/core/src/acp/ops/session-manager.ts
git commit -m "feat(acp): park sessions on WS disconnect, inject AcpSessionStore into singleton"
```

---

## Task 9: 导出新类型和函数到 `acp/index.ts`

**Files:**
- Modify: `packages/core/src/acp/index.ts`

- [ ] **Step 1: 在 `acp/index.ts` 中新增导出**

找到现有的 `export * from "./ops/..."` 行，追加：

```typescript
// 注意：AcpSessionEvent 和 AcpSessionEventPatch 已从 ./types 导出（在 Task 1 Step 2 中定义）
// session-store.ts 通过 re-export 透出它们，但 acp/index.ts 已经 export * from "./types"
// 因此这里不再重复导出 AcpSessionEvent/AcpSessionEventPatch，避免 duplicate export 错误
export type {
  AcpSessionRecord,
  AcpSessionStore,
} from "./ops/session-store";
export { createDefaultAcpSessionStore, FileSystemAcpSessionStore } from "./ops/session-store";
export { AcpSessionEventRecorder } from "./ops/session-event-recorder";
export type { ApprovalDecision, ApprovalHandler } from "./ops/approval-handler";
export { createDefaultApprovalHandler, DefaultApprovalHandler } from "./ops/approval-handler";
export { DetachedConnection } from "./ops/detached-connection";
```

**重要**：`AcpSessionEvent` 和 `AcpSessionEventPatch` 定义在 `types.ts`，`acp/index.ts` 通过 `export * from "./types"` 已经将其导出。`session-store.ts` 中 `export type { AcpSessionEvent, AcpSessionEventPatch }` 是为了方便 `session-store.ts` 的消费者直接从 `session-store` 导入，不影响 `index.ts` 的导出路径。若编译时出现 "duplicate identifier" 错误，则删除 `session-store.ts` 中的 re-export 行。

- [ ] **Step 2: Full typecheck**

```bash
pnpm --filter @viben/core typecheck 2>&1
```

预期：0 错误。

- [ ] **Step 3: 运行所有 core 测试**

```bash
pnpm --filter @viben/core test 2>&1 | tail -30
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/acp/index.ts packages/core/src/acp/types.ts packages/core/src/acp/ops/session-event-recorder.ts
git commit -m "feat(acp): export session persistence types and classes from acp/index.ts"
```

---

## Task 10: Gateway 启动时清理过期 parked sessions

**Files:**
- Modify: `packages/core/src/gateway/index.ts` 或 `routes/index.ts`

- [ ] **Step 1: 在 `session-store.ts` 末尾新增 `cleanupStaleSessions` 函数**

```typescript
// packages/core/src/acp/ops/session-store.ts（追加到文件末尾）
export async function cleanupStaleSessions(
  store: AcpSessionStore,
  parkTTLDays = 7
): Promise<void> {
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

- [ ] **Step 2: 在 gateway 启动时调用清理，复用 singleton 的 store 实例**

Task 8 Step 4 已将 `createDefaultAcpSessionStore()` 注入到 `acpSessionManager` 单例。这里**不要再创建第二个实例**（否则两个 store 共享同一磁盘目录但各有独立 `seqCounters`，造成架构混乱）。

在 `packages/core/src/gateway/index.ts` 中找到 `startGateway` 函数（约 line 80-120），在调用 `server.listen()` 之前追加：

```typescript
import { cleanupStaleSessions } from "../acp/ops/session-store";
import { acpSessionManager } from "../acp/ops/session-manager";

if (acpSessionManager.store) {
  cleanupStaleSessions(acpSessionManager.store).catch((err) => {
    log.warn({ err }, "Stale session cleanup failed (non-fatal)");
  });
}
```

为此在 `session-manager.ts` 中将 `private store` 改为 `readonly store`（仅访问权限，不影响封装）：

```typescript
// session-manager.ts 构造函数参数：
  public readonly store: AcpSessionStore | null;
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/acp/ops/session-store.ts packages/core/src/gateway/index.ts
git commit -m "feat(acp): cleanup stale parked sessions on gateway startup"
```

---

## Task 11: 前端类型同步 — `permission_mode` 字段

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/acp-client.ts`
- Modify: `apps/desktop/src/lib/gateway/types/agent.ts`（若存在）
- Modify: `apps/desktop/src/types/unified-agent.ts`（若存在）

- [ ] **Step 1: 更新前端 `AgentConfigPayload` 中的 `permission_mode` 字段类型**

在 `apps/desktop/src/components/acp-chat/acp-client.ts` 中找到 `AgentConfigPayload` 或 agent 相关类型定义，将：
```typescript
  approval_mode?: "bypass" | "rules" | "ai";
  // 或
  permission_mode?: string;
```
改为：
```typescript
  approval_mode?: "bypass" | "rules" | "ai"; // legacy read-only
  permission_mode?: "default" | "bypassPermissions" | "auto" | "acceptEdits" | "dontAsk" | "plan";
```

- [ ] **Step 2: 同步 gateway 类型文件（如存在）**

```bash
grep -n "approval_mode\|permission_mode" \
  apps/desktop/src/lib/gateway/types/agent.ts \
  apps/desktop/src/types/unified-agent.ts 2>/dev/null
```

对找到的旧 `approval_mode` 字段做同样替换。

- [ ] **Step 3: Desktop typecheck**

```bash
pnpm --filter @viben/desktop typecheck 2>&1 | head -30
```

预期：0 错误。

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/
git commit -m "types(desktop): sync permission_mode field to AcpPermissionMode values"
```

---

## Task 12: `ApprovalHandler` 集成到 `SdkAcpConnection.requestPermission()`

Spec 七要求活跃连接下的 `requestPermission` 也先经过 `ApprovalHandler.evaluate()` 过滤，自动通过的请求不打断用户。

**Files:**
- Modify: `packages/core/src/gateway/routes/agent-acp.ts`

- [ ] **Step 1: 给 `SdkAcpConnection` 注入 `ApprovalHandler` 和 session 上下文**

修改 `SdkAcpConnection` 构造函数，新增可选参数：

```typescript
import { createDefaultApprovalHandler, type ApprovalHandler } from "../../acp/ops/approval-handler";
import type { AcpPermissionMode } from "../../acp";

class SdkAcpConnection implements AcpConnection {
  private approvalHandler: ApprovalHandler;
  private permissionMode: AcpPermissionMode;
  private dangerouslySkipPermissions: boolean;

  constructor(
    private readonly sdkConnection: AgentSideConnection,
    permissionMode: AcpPermissionMode = "default",
    dangerouslySkipPermissions = false,
    approvalHandler?: ApprovalHandler
  ) {
    this.permissionMode = permissionMode;
    this.dangerouslySkipPermissions = dangerouslySkipPermissions;
    this.approvalHandler = approvalHandler ?? createDefaultApprovalHandler();
  }
```

- [ ] **Step 2: 修改 `requestPermission()` 加入 ApprovalHandler 过滤**

```typescript
  async requestPermission(params: AcpRequestPermissionRequest): Promise<AcpRequestPermissionResponse> {
    const effectiveMode: AcpPermissionMode = this.dangerouslySkipPermissions
      ? "bypassPermissions"
      : this.permissionMode;

    // bypassPermissions: backend 不发 requestPermission，此处理论上不会被调用，但防御处理
    if (effectiveMode === "bypassPermissions") {
      const firstOption = (params as { options?: Array<{ id: string }> }).options?.[0];
      return { optionId: firstOption?.id ?? "yes", ...firstOption } as AcpRequestPermissionResponse;
    }

    const decision = await this.approvalHandler.evaluate(params, effectiveMode);
    if (decision.auto) {
      return { optionId: decision.optionId } as AcpRequestPermissionResponse;
    }

    // auto: false — 推送给前端等待用户决策（原有逻辑）
    return await this.sdkConnection.requestPermission(params);
  }
```

- [ ] **Step 3: 修改 `createVibenAcpAgent` 中 `SdkAcpConnection` 的构造调用**

在 `createVibenAcpAgent` 中，`SdkAcpConnection` 构造时从 session 的 `agentConfig` 读取 `permission_mode`：

```typescript
// 新建 session 时（newSession / loadSession）还不知道 agentConfig，先用默认值
// permission_mode 在第一次 prompt 时才确定；此处在 connection 创建后通过 setPermissionMode() 更新
// 实现简化：SdkAcpConnection 暴露 setPermissionMode(mode, dangerouslySkip) 方法
// agent-acp.ts 在 newSession/loadSession 回调里调用
```

修改 `SdkAcpConnection` 新增方法：
```typescript
  setPermissionMode(mode: AcpPermissionMode, dangerouslySkip: boolean): void {
    this.permissionMode = mode;
    this.dangerouslySkipPermissions = dangerouslySkip;
  }
```

在 `newSession` 和 `loadSession` 回调里，从 `request.agent_config?.permission_mode` 更新：
```typescript
    async newSession(request: AcpNewSessionRequest) {
      const response = await acpSessionManager.createSession(request, connection, context);
      ownedSessionIds.add(response.sessionId);
      // 更新 connection 的 permission mode（agent_config 已在 request 中）
      const mode = (request.agent_config?.permission_mode ?? "default") as AcpPermissionMode;
      connection.setPermissionMode(mode, false);
      return response;
    },
```

- [ ] **Step 4: TypeCheck**

```bash
pnpm --filter @viben/core typecheck 2>&1 | head -30
```

预期：无错误。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/gateway/routes/agent-acp.ts
git commit -m "feat(acp): integrate ApprovalHandler into SdkAcpConnection.requestPermission()"
```

---

## Task 13: 前端 `use-acp-session.ts` — history 批量渲染 + parked 状态展示

**Files:**
- Modify: `apps/desktop/src/components/acp-chat/use-acp-session.ts`（或等效 hook 文件）
- Modify: session 列表 UI 组件（展示 parked badge）

- [ ] **Step 1: 定位前端 loadSession 调用处**

```bash
grep -rn "loadSession\|batchRenderHistory\|applyUiStepsImmediately" \
  apps/desktop/src/components/acp-chat/ 2>/dev/null | head -20
```

- [ ] **Step 2: 在 `loadSession` 响应处理中添加 `history` 批量渲染**

找到调用 `acpClient.loadSession()` 的代码，在响应处理后添加：

```typescript
const response = await acpClient.loadSession(request);
if (response.history && response.history.length > 0) {
  batchRenderHistory(response.history);
}
// 之后正常绑定 sessionUpdate / requestPermission 等回调（现有逻辑不变）
```

- [ ] **Step 3: 在 `acp-chat-state.ts` 中实现 `applyUiStepsImmediately()`，并实现 `batchRenderHistory()`**

首先确认 `acp-chat-state.ts` 中已有 `enqueueUiSteps` 函数。`applyUiStepsImmediately` 是其同步版本，直接调用 `setSessionsById` 而不走动画队列。

**子步骤 3a**：在 `acp-chat-state.ts` 中提取同步 apply 函数：

```typescript
// 在 enqueueUiSteps 附近添加：
export function applyUiStepsImmediately(
  setSessionsById: (updater: (prev: Map<string, AcpSession>) => Map<string, AcpSession>) => void,
  sessionId: string,
  steps: AcpUiStep[]
): void {
  if (steps.length === 0) return;
  setSessionsById((prev) => {
    const next = new Map(prev);
    const session = next.get(sessionId);
    if (!session) return prev;
    // 逐步应用，与 enqueueUiSteps 中的单步 reducer 逻辑相同
    const updated = steps.reduce(
      (s, step) => applyUiStep(s, step),
      session
    );
    next.set(sessionId, updated);
    return next;
  });
}
```

注意：`applyUiStep` 是 `enqueueUiSteps` 内部用的 reducer（若未单独导出，在此 step 中将其提取为独立函数并导出）。

**子步骤 3b**：在 `use-acp-session.ts`（或 loadSession 所在文件）中实现 `batchRenderHistory()`：

```typescript
import type { AcpSessionEvent } from "./acp-client";
import { acpSessionUpdateToUiSteps, applyUiStepsImmediately } from "./acp-chat-state";

function batchRenderHistory(events: AcpSessionEvent[]): void {
  const allSteps: AcpUiStep[] = [];
  for (const event of events) {
    if (event.type === "session_update") {
      const steps = acpSessionUpdateToUiSteps(event.data as AcpSessionUpdate);
      allSteps.push(...steps);
    }
  }
  if (allSteps.length === 0) return;
  applyUiStepsImmediately(setSessionsById, sessionId, allSteps);
}
```

（`setSessionsById` 和 `sessionId` 均为所在 hook 作用域内的现有变量）

- [ ] **Step 4: session 列表展示 `parked` 状态**

在 session 列表 UI 组件中，找到渲染 session item 的地方，添加 parked 状态的视觉标识：

```typescript
// 找到 session status 展示逻辑（通常是 badge 或 icon）
{session.status === "parked" && (
  <Badge variant="secondary" className="text-xs">
    {t("session.parked")}  {/* 已暂停 */}
  </Badge>
)}
```

并在 `en.json` / `zh-CN.json` 中添加翻译键：
```json
// en.json
"session.parked": "Paused"

// zh-CN.json
"session.parked": "已暂停"
```

- [ ] **Step 5: Desktop typecheck**

```bash
pnpm --filter @viben/desktop typecheck 2>&1 | head -30
```

预期：0 错误。

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(desktop): handle loadSession history batch rendering and parked session badge"
```

---

## Task 14: 自动化验证与端到端验证

- [ ] **Step 1: 添加关键自动化测试**

在 `packages/core/src/acp/ops/session-manager.test.ts`、`packages/core/src/acp/ops/session-store.test.ts` 和 `packages/core/src/gateway/routes/agent-acp.integration.test.ts` 中补覆盖：

- 断线超过原 5s flush interval 后重连，`history` 仍包含断线期间所有 `session_update`
- gateway restart 恢复时 pending permission/tool 事件被 patch 为 `abandoned`
- 恶意 session id（`../x`、`a/b`、空字符串、超长 ID）被拒绝且不读写 session 根目录外文件
- `meta.json` 损坏时从 `meta.json.bak` 恢复
- 并发 100 个 `appendEvent` + `updateEventStatus` 后 seq 无重复，patch last-write-wins
- 旧 YAML 迁移：`approval_mode` 和 `approvals` 都按矩阵迁移，已有 `permission_mode: "plan"` 不被覆盖
- 双 WebSocket 接管后旧 socket close 不会 park 新连接
- `closeSession()` 完成后 `meta.status === "finished"`，detached pending 被 `cancelled`，backend `closeBackendSession()` 被 await

- [ ] **Step 2: 运行核心测试**

```bash
pnpm --filter @viben/core test 2>&1 | tail -30
```

预期：新增测试和既有 core 测试全部 PASS。

- [ ] **Step 3: 启动 gateway**

```bash
pnpm gateway:restart
```

确认 `http://127.0.0.1:18790/health` 返回 200。

- [ ] **Step 4: 验证 session 目录创建**

在 desktop 中新建一个 ACP chat session，发送一条消息，然后检查：

```bash
ls ~/.viben/acp/sessions/
```

预期：出现以 UUID 命名的 session 目录，包含 `meta.json` 和 `events.jsonl`。

- [ ] **Step 5: 验证断线 park**

关闭 desktop 窗口（触发 WS disconnect），检查：

```bash
cat ~/.viben/acp/sessions/<session-id>/meta.json | grep status
```

预期：`"status": "parked"`。

- [ ] **Step 6: 验证重连 resume**

重新打开 desktop，执行 loadSession，检查响应中 `history` 字段是否包含之前的 session_update 事件。

- [ ] **Step 7: 验证 gateway 重启恢复**

```bash
pnpm gateway:restart
```

在 desktop 中对 parked session 执行 loadSession，预期：从磁盘恢复，返回 history，pending 事件被 abandoned。

- [ ] **Step 8: 全仓验证**

```bash
pnpm typecheck
pnpm build
```

预期：所有 workspace package typecheck/build 成功，包括 `apps/web`、`apps/desktop` 和 `packages/core`。
