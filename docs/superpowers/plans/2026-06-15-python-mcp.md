# Python MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Python MCP Server in the Gateway that connects to remote Jupyter Server via REST + WebSocket, providing execute_code and load_skill tools to AI agents, with a Desktop management page.

**Architecture:** Gateway-internal implementation using StreamableHTTPServerTransport for MCP protocol. JupyterClient handles REST API (kernel lifecycle) and WebSocket (code execution). SessionManager persists ACP session → kernel bindings as JSONL files under `~/.viben/python-mcp/sessions/`. SkillRegistry reads/writes markdown skill files from `~/.viben/python-mcp/skills/`.

**Tech Stack:** TypeScript, Fastify, @modelcontextprotocol/sdk, ws (WebSocket client), yaml, gray-matter, zod, React, vanilla-jsoneditor

---

## File Structure

```
packages/core/src/mcp/server/python-mcp/
├── types.ts               # Zod schemas + TS interfaces (ExecutionResult, OutputItem, SkillConfig, etc.)
├── jupyter-client.ts      # JupyterClient class — REST API + WebSocket code execution
├── session-manager.ts     # SessionManager — JSONL-based session↔kernel persistence
├── skill-registry.ts      # SkillRegistry — markdown skill file CRUD
├── mcp-server.ts          # createPythonMcpServer() — registers execute_code + load_skill tools
└── __tests__/
    ├── jupyter-client.test.ts
    ├── session-manager.test.ts
    ├── skill-registry.test.ts
    └── mcp-server.test.ts

packages/core/src/gateway/routes/mcp-server/
└── python-mcp-server.ts   # registerPythonMcpServerRoutes() — MCP endpoint + management APIs

packages/core/src/gateway/routes/index.ts  (modify — add import + registration)

apps/desktop/src/pages/mcp/
├── python-mcp.tsx         # Main page component (5 sections)
└── index.ts               (modify — add export)

apps/desktop/src/App.tsx                          (modify — add route)
apps/desktop/src/navigation/route-registry.ts     (modify — add entry)
apps/desktop/src/components/layout/mcp-services-layout.tsx  (modify — add nav item)
```

---

### Task 1: Types and Schemas

**Files:**
- Create: `packages/core/src/mcp/server/python-mcp/types.ts`

- [ ] **Step 1: Create the types file with all Zod schemas and TypeScript interfaces**

```typescript
// packages/core/src/mcp/server/python-mcp/types.ts
import { z } from "zod";

// --- Zod schemas for MCP tool inputs ---

export const executeCodeInputSchema = z.object({
  code: z.string().describe("要执行的 Python 代码"),
  description: z.string().describe("描述此次执行的目的"),
});

export const loadSkillInputSchema = z.object({
  skill_name: z.string().describe("Skill 名称"),
});

// --- TypeScript interfaces ---

export interface KernelInfo {
  id: string;
  name: string;
  execution_state: string;
  last_activity: string;
}

export interface OutputItem {
  type: "stream" | "execute_result" | "display_data" | "error";
  stream_name?: "stdout" | "stderr";
  text?: string;
  data?: Record<string, unknown>;
}

export interface ExecutionResult {
  status: "ok" | "error";
  outputs: OutputItem[];
  error?: { name: string; value: string; traceback: string[] };
}

export interface SkillConfig {
  name: string;
  description: string;
  code_for_interpreter?: string;
  code_for_agent?: string;
}

export interface SkillMeta {
  name: string;
  description: string;
}

export interface CodeEntry {
  type: "code";
  code_id: string;
  timestamp: number;
  code: string;
  description: string;
}

export interface ResultEntry {
  type: "result";
  code_id: string;
  timestamp: number;
  status: "ok" | "error";
  outputs?: OutputItem[];
  error?: { name: string; value: string; traceback: string[] };
}

export type LogEntry = CodeEntry | ResultEntry;

export interface KernelHistory {
  kernel_id: string;
  created_at: number;
  entries: LogEntry[];
}

export interface SessionInfo {
  acp_session_id: string;
  current_kernel_id: string;
  kernel_count: number;
  created_at: number;
  last_used_at: number;
}

export interface PythonMcpConfig {
  jupyter_url: string;
  jupyter_token: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/src/mcp/server/python-mcp/types.ts
git commit -m "feat(python-mcp): add types and zod schemas"
```

---

### Task 2: JupyterClient

**Files:**
- Create: `packages/core/src/mcp/server/python-mcp/jupyter-client.ts`
- Create: `packages/core/src/mcp/server/python-mcp/__tests__/jupyter-client.test.ts`

- [ ] **Step 1: Write the JupyterClient test**

```typescript
// packages/core/src/mcp/server/python-mcp/__tests__/jupyter-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JupyterClient } from "../jupyter-client";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("JupyterClient", () => {
  let client: JupyterClient;

  beforeEach(() => {
    client = new JupyterClient("http://localhost:8888", "test-token");
    mockFetch.mockReset();
  });

  describe("createKernel", () => {
    it("should POST to /api/kernels and return kernel_id", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "kernel-uuid-123", name: "python3" }),
      });

      const kernelId = await client.createKernel();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/kernels",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "token test-token",
          }),
        }),
      );
      expect(kernelId).toBe("kernel-uuid-123");
    });
  });

  describe("listKernels", () => {
    it("should GET /api/kernels and return array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: "k1", name: "python3", execution_state: "idle", last_activity: "2024-01-01T00:00:00Z" },
        ],
      });

      const kernels = await client.listKernels();

      expect(kernels).toHaveLength(1);
      expect(kernels[0].id).toBe("k1");
    });
  });

  describe("getKernelStatus", () => {
    it("should return 'alive' when kernel exists", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "k1", execution_state: "idle" }),
      });

      const status = await client.getKernelStatus("k1");
      expect(status).toBe("alive");
    });

    it("should return 'dead' when kernel not found", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const status = await client.getKernelStatus("k-missing");
      expect(status).toBe("dead");
    });
  });

  describe("interruptKernel", () => {
    it("should POST to /api/kernels/{id}/interrupt", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await client.interruptKernel("k1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8888/api/kernels/k1/interrupt",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/jupyter-client.test.ts
```

Expected: FAIL — module `../jupyter-client` not found.

- [ ] **Step 3: Implement JupyterClient**

```typescript
// packages/core/src/mcp/server/python-mcp/jupyter-client.ts
import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import type { ExecutionResult, KernelInfo, OutputItem } from "./types";

export class JupyterClient {
  private baseUrl: string;
  private token: string;
  private wsConnections = new Map<string, WebSocket>();
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(baseUrl: string, token: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `token ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  async createKernel(name = "python3"): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/kernels`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create kernel: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as { id: string };
    return data.id;
  }

  async listKernels(): Promise<KernelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/kernels`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Failed to list kernels: ${res.status}`);
    }
    return (await res.json()) as KernelInfo[];
  }

  async getKernelStatus(kernelId: string): Promise<"alive" | "dead"> {
    const res = await fetch(`${this.baseUrl}/api/kernels/${kernelId}`, {
      method: "GET",
      headers: this.headers(),
    });
    return res.ok ? "alive" : "dead";
  }

  async deleteKernel(kernelId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/kernels/${kernelId}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    this.closeWs(kernelId);
  }

  async interruptKernel(kernelId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/kernels/${kernelId}/interrupt`, {
      method: "POST",
      headers: this.headers(),
    });
  }

  async executeCode(kernelId: string, code: string, timeout = 60_000): Promise<ExecutionResult> {
    const ws = await this.getOrCreateWs(kernelId);
    const msgId = randomUUID();
    const session = randomUUID();

    const executeRequest = JSON.stringify({
      header: {
        msg_id: msgId,
        msg_type: "execute_request",
        session,
        username: "",
        version: "5.3",
      },
      parent_header: {},
      metadata: {},
      content: {
        code,
        silent: false,
        store_history: true,
        allow_stdin: false,
      },
      channel: "shell",
    });

    return new Promise<ExecutionResult>((resolve, reject) => {
      const outputs: OutputItem[] = [];
      let error: ExecutionResult["error"] | undefined;
      let resolved = false;

      const timer = setTimeout(async () => {
        if (resolved) return;
        resolved = true;
        // Try to interrupt
        await this.interruptKernel(kernelId).catch(() => {});
        resolve({
          status: "error",
          outputs,
          error: { name: "TimeoutError", value: "Execution timed out", traceback: [] },
        });
      }, timeout);

      const handler = (data: WebSocket.Data) => {
        if (resolved) return;
        const msg = JSON.parse(data.toString());
        // Only process messages for our request
        if (msg.parent_header?.msg_id !== msgId) return;

        const msgType = msg.header?.msg_type ?? msg.msg_type;
        const content = msg.content;

        switch (msgType) {
          case "stream":
            outputs.push({
              type: "stream",
              stream_name: content.name,
              text: content.text,
            });
            break;
          case "execute_result":
          case "display_data":
            outputs.push({
              type: msgType,
              data: content.data,
            });
            break;
          case "error":
            error = {
              name: content.ename,
              value: content.evalue,
              traceback: content.traceback,
            };
            outputs.push({ type: "error", text: content.traceback.join("\n") });
            break;
          case "status":
            if (content.execution_state === "idle") {
              resolved = true;
              clearTimeout(timer);
              ws.off("message", handler);
              this.resetIdleTimer(kernelId);
              resolve({
                status: error ? "error" : "ok",
                outputs,
                error,
              });
            }
            break;
        }
      };

      ws.on("message", handler);
      ws.send(executeRequest);
    });
  }

  private async getOrCreateWs(kernelId: string): Promise<WebSocket> {
    const existing = this.wsConnections.get(kernelId);
    if (existing && existing.readyState === WebSocket.OPEN) {
      this.resetIdleTimer(kernelId);
      return existing;
    }

    const wsUrl = this.baseUrl.replace(/^http/, "ws");
    const url = `${wsUrl}/api/kernels/${kernelId}/channels?token=${this.token}`;

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.on("open", () => {
        this.wsConnections.set(kernelId, ws);
        this.resetIdleTimer(kernelId);
        resolve(ws);
      });
      ws.on("error", (err) => {
        this.wsConnections.delete(kernelId);
        reject(err);
      });
      ws.on("close", () => {
        this.wsConnections.delete(kernelId);
        this.clearIdleTimer(kernelId);
      });
    });
  }

  private resetIdleTimer(kernelId: string): void {
    this.clearIdleTimer(kernelId);
    const timer = setTimeout(() => {
      this.closeWs(kernelId);
    }, 60_000);
    this.idleTimers.set(kernelId, timer);
  }

  private clearIdleTimer(kernelId: string): void {
    const timer = this.idleTimers.get(kernelId);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(kernelId);
    }
  }

  private closeWs(kernelId: string): void {
    const ws = this.wsConnections.get(kernelId);
    if (ws) {
      ws.close();
      this.wsConnections.delete(kernelId);
    }
    this.clearIdleTimer(kernelId);
  }

  closeAll(): void {
    for (const kernelId of this.wsConnections.keys()) {
      this.closeWs(kernelId);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/jupyter-client.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/mcp/server/python-mcp/jupyter-client.ts packages/core/src/mcp/server/python-mcp/__tests__/jupyter-client.test.ts
git commit -m "feat(python-mcp): implement JupyterClient with REST + WebSocket"
```

---

### Task 3: SessionManager

**Files:**
- Create: `packages/core/src/mcp/server/python-mcp/session-manager.ts`
- Create: `packages/core/src/mcp/server/python-mcp/__tests__/session-manager.test.ts`

- [ ] **Step 1: Write the SessionManager test**

```typescript
// packages/core/src/mcp/server/python-mcp/__tests__/session-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionManager } from "../session-manager";
import type { JupyterClient } from "../jupyter-client";

describe("SessionManager", () => {
  let baseDir: string;
  let manager: SessionManager;
  let mockClient: JupyterClient;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "session-manager-test-"));
    manager = new SessionManager(baseDir);
    mockClient = {
      createKernel: vi.fn().mockResolvedValue("new-kernel-id"),
      getKernelStatus: vi.fn().mockResolvedValue("alive"),
    } as unknown as JupyterClient;
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  describe("getActiveKernel", () => {
    it("should create a new kernel and jsonl file when session has no history", async () => {
      const kernelId = await manager.getActiveKernel("session-1", mockClient);

      expect(kernelId).toBe("new-kernel-id");
      expect(mockClient.createKernel).toHaveBeenCalledOnce();

      // Verify file was created
      const sessionDir = join(baseDir, "session-1");
      const files = await readdir(sessionDir);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\d+-new-kernel-id\.jsonl$/);
    });

    it("should reuse existing kernel when alive", async () => {
      // First call creates
      await manager.getActiveKernel("session-1", mockClient);
      // Second call should reuse
      const kernelId = await manager.getActiveKernel("session-1", mockClient);

      expect(kernelId).toBe("new-kernel-id");
      expect(mockClient.createKernel).toHaveBeenCalledOnce(); // only called once
    });

    it("should create new kernel when existing is dead", async () => {
      // First call creates "new-kernel-id"
      await manager.getActiveKernel("session-1", mockClient);

      // Now make getKernelStatus return dead, and createKernel return different id
      (mockClient.getKernelStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce("dead");
      (mockClient.createKernel as ReturnType<typeof vi.fn>).mockResolvedValueOnce("replacement-kernel");

      // Clear cache to force re-scan
      manager.clearCache("session-1");
      const kernelId = await manager.getActiveKernel("session-1", mockClient);

      expect(kernelId).toBe("replacement-kernel");

      // Should now have 2 jsonl files
      const files = await readdir(join(baseDir, "session-1"));
      expect(files).toHaveLength(2);
    });
  });

  describe("recordCode / recordResult", () => {
    it("should append code and result entries to jsonl", async () => {
      await manager.getActiveKernel("session-1", mockClient);

      const codeId = await manager.recordCode("session-1", "new-kernel-id", {
        code: "print('hello')",
        description: "test",
      });
      expect(codeId).toBe("c_001");

      await manager.recordResult("session-1", "new-kernel-id", codeId, {
        status: "ok",
        outputs: [{ type: "stream", stream_name: "stdout", text: "hello\n" }],
      });

      // Read the file
      const files = await readdir(join(baseDir, "session-1"));
      const content = await readFile(join(baseDir, "session-1", files[0]), "utf-8");
      const lines = content.trim().split("\n").map((l) => JSON.parse(l));

      expect(lines).toHaveLength(2);
      expect(lines[0].type).toBe("code");
      expect(lines[0].code_id).toBe("c_001");
      expect(lines[1].type).toBe("result");
      expect(lines[1].code_id).toBe("c_001");
    });

    it("should increment code_id", async () => {
      await manager.getActiveKernel("session-1", mockClient);

      const id1 = await manager.recordCode("session-1", "new-kernel-id", { code: "a", description: "1" });
      const id2 = await manager.recordCode("session-1", "new-kernel-id", { code: "b", description: "2" });

      expect(id1).toBe("c_001");
      expect(id2).toBe("c_002");
    });
  });

  describe("getHistory", () => {
    it("should return all kernel histories for a session", async () => {
      await manager.getActiveKernel("session-1", mockClient);
      await manager.recordCode("session-1", "new-kernel-id", { code: "x=1", description: "init" });

      const history = await manager.getHistory("session-1");

      expect(history).toHaveLength(1);
      expect(history[0].kernel_id).toBe("new-kernel-id");
      expect(history[0].entries).toHaveLength(1);
    });
  });

  describe("getAllSessions", () => {
    it("should list all session directories", async () => {
      await manager.getActiveKernel("session-1", mockClient);
      await manager.getActiveKernel("session-2", mockClient);

      const sessions = await manager.getAllSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.acp_session_id).sort()).toEqual(["session-1", "session-2"]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/session-manager.test.ts
```

Expected: FAIL — module `../session-manager` not found.

- [ ] **Step 3: Implement SessionManager**

```typescript
// packages/core/src/mcp/server/python-mcp/session-manager.ts
import { mkdir, readdir, readFile, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { JupyterClient } from "./jupyter-client";
import type { CodeEntry, ResultEntry, KernelHistory, SessionInfo, LogEntry, OutputItem } from "./types";

export class SessionManager {
  private baseDir: string;
  // In-memory cache: acpSessionId -> { kernelId, filePath, codeCounter }
  private cache = new Map<string, { kernelId: string; filePath: string; codeCounter: number }>();

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async getActiveKernel(acpSessionId: string, client: JupyterClient): Promise<string> {
    // Check cache first
    const cached = this.cache.get(acpSessionId);
    if (cached) {
      const status = await client.getKernelStatus(cached.kernelId);
      if (status === "alive") return cached.kernelId;
      // Dead — fall through to create new
    }

    const sessionDir = join(this.baseDir, acpSessionId);
    await mkdir(sessionDir, { recursive: true });

    // Scan for existing jsonl files
    const files = await readdir(sessionDir).catch(() => [] as string[]);
    const jsonlFiles = files
      .filter((f) => f.endsWith(".jsonl"))
      .sort()
      .reverse(); // newest first by timestamp prefix

    // Try the latest kernel
    if (jsonlFiles.length > 0) {
      const latest = jsonlFiles[0];
      const kernelId = this.parseKernelIdFromFilename(latest);
      if (kernelId) {
        const status = await client.getKernelStatus(kernelId);
        if (status === "alive") {
          const filePath = join(sessionDir, latest);
          const counter = await this.getLastCodeCounter(filePath);
          this.cache.set(acpSessionId, { kernelId, filePath, codeCounter: counter });
          return kernelId;
        }
      }
    }

    // Create new kernel
    const newKernelId = await client.createKernel();
    const timestamp = Date.now();
    const fileName = `${timestamp}-${newKernelId}.jsonl`;
    const filePath = join(sessionDir, fileName);
    // Create empty file
    await appendFile(filePath, "");
    this.cache.set(acpSessionId, { kernelId: newKernelId, filePath, codeCounter: 0 });
    return newKernelId;
  }

  async recordCode(
    acpSessionId: string,
    kernelId: string,
    entry: { code: string; description: string },
  ): Promise<string> {
    const cached = this.cache.get(acpSessionId);
    if (!cached || cached.kernelId !== kernelId) {
      throw new Error(`No active session file for ${acpSessionId}/${kernelId}`);
    }

    cached.codeCounter++;
    const codeId = `c_${String(cached.codeCounter).padStart(3, "0")}`;

    const logEntry: CodeEntry = {
      type: "code",
      code_id: codeId,
      timestamp: Date.now(),
      code: entry.code,
      description: entry.description,
    };

    await appendFile(cached.filePath, JSON.stringify(logEntry) + "\n");
    return codeId;
  }

  async recordResult(
    acpSessionId: string,
    kernelId: string,
    codeId: string,
    result: { status: "ok" | "error"; outputs?: OutputItem[]; error?: { name: string; value: string; traceback: string[] } },
  ): Promise<void> {
    const cached = this.cache.get(acpSessionId);
    if (!cached || cached.kernelId !== kernelId) {
      throw new Error(`No active session file for ${acpSessionId}/${kernelId}`);
    }

    const logEntry: ResultEntry = {
      type: "result",
      code_id: codeId,
      timestamp: Date.now(),
      status: result.status,
      outputs: result.outputs,
      error: result.error,
    };

    await appendFile(cached.filePath, JSON.stringify(logEntry) + "\n");
  }

  async getHistory(acpSessionId: string): Promise<KernelHistory[]> {
    const sessionDir = join(this.baseDir, acpSessionId);
    const files = await readdir(sessionDir).catch(() => [] as string[]);
    const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort();

    const histories: KernelHistory[] = [];
    for (const file of jsonlFiles) {
      const kernelId = this.parseKernelIdFromFilename(file);
      const timestamp = this.parseTimestampFromFilename(file);
      if (!kernelId) continue;

      const content = await readFile(join(sessionDir, file), "utf-8");
      const entries: LogEntry[] = content
        .trim()
        .split("\n")
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as LogEntry);

      histories.push({
        kernel_id: kernelId,
        created_at: timestamp ?? 0,
        entries,
      });
    }
    return histories;
  }

  async getAllSessions(): Promise<SessionInfo[]> {
    const dirs = await readdir(this.baseDir).catch(() => [] as string[]);
    const sessions: SessionInfo[] = [];

    for (const dir of dirs) {
      const sessionDir = join(this.baseDir, dir);
      const files = await readdir(sessionDir).catch(() => [] as string[]);
      const jsonlFiles = files.filter((f) => f.endsWith(".jsonl")).sort();
      if (jsonlFiles.length === 0) continue;

      const latest = jsonlFiles[jsonlFiles.length - 1];
      const kernelId = this.parseKernelIdFromFilename(latest) ?? "unknown";
      const createdAt = this.parseTimestampFromFilename(jsonlFiles[0]) ?? 0;
      const lastUsed = this.parseTimestampFromFilename(latest) ?? 0;

      sessions.push({
        acp_session_id: dir,
        current_kernel_id: kernelId,
        kernel_count: jsonlFiles.length,
        created_at: createdAt,
        last_used_at: lastUsed,
      });
    }
    return sessions;
  }

  clearCache(acpSessionId: string): void {
    this.cache.delete(acpSessionId);
  }

  private parseKernelIdFromFilename(filename: string): string | undefined {
    // Format: <timestamp>-<kernel-id>.jsonl
    const match = filename.match(/^\d+-(.+)\.jsonl$/);
    return match?.[1];
  }

  private parseTimestampFromFilename(filename: string): number | undefined {
    const match = filename.match(/^(\d+)-/);
    return match ? Number(match[1]) : undefined;
  }

  private async getLastCodeCounter(filePath: string): Promise<number> {
    const content = await readFile(filePath, "utf-8").catch(() => "");
    const lines = content.trim().split("\n").filter((l) => l.length > 0);
    let maxCounter = 0;
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.type === "code" && entry.code_id) {
        const num = parseInt(entry.code_id.replace("c_", ""), 10);
        if (num > maxCounter) maxCounter = num;
      }
    }
    return maxCounter;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/session-manager.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/mcp/server/python-mcp/session-manager.ts packages/core/src/mcp/server/python-mcp/__tests__/session-manager.test.ts
git commit -m "feat(python-mcp): implement SessionManager with JSONL persistence"
```

---

### Task 4: SkillRegistry

**Files:**
- Create: `packages/core/src/mcp/server/python-mcp/skill-registry.ts`
- Create: `packages/core/src/mcp/server/python-mcp/__tests__/skill-registry.test.ts`

- [ ] **Step 1: Write the SkillRegistry test**

```typescript
// packages/core/src/mcp/server/python-mcp/__tests__/skill-registry.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SkillRegistry } from "../skill-registry";

describe("SkillRegistry", () => {
  let skillDir: string;
  let registry: SkillRegistry;

  beforeEach(async () => {
    skillDir = await mkdtemp(join(tmpdir(), "skill-registry-test-"));
    registry = new SkillRegistry(skillDir);
  });

  afterEach(async () => {
    await rm(skillDir, { recursive: true, force: true });
  });

  describe("createSkill / getSkill", () => {
    it("should create a markdown file and read it back", async () => {
      await registry.createSkill({
        name: "pandas",
        description: "Data analysis with Pandas",
        code_for_interpreter: "import pandas as pd\nprint('ready')",
        code_for_agent: "import pandas as pd\ndf = pd.read_csv('data.csv')",
      });

      const skill = await registry.getSkill("pandas");

      expect(skill.name).toBe("pandas");
      expect(skill.description).toBe("Data analysis with Pandas");
      expect(skill.code_for_interpreter).toBe("import pandas as pd\nprint('ready')");
      expect(skill.code_for_agent).toBe("import pandas as pd\ndf = pd.read_csv('data.csv')");

      // Verify file format
      const raw = await readFile(join(skillDir, "skill_pandas.md"), "utf-8");
      expect(raw).toContain("---\nname: pandas");
      expect(raw).toContain("## Code for Agent");
      expect(raw).toContain("## Code for Interpreter");
    });
  });

  describe("listSkills", () => {
    it("should list all skill files", async () => {
      await registry.createSkill({ name: "pandas", description: "Pandas" });
      await registry.createSkill({ name: "plotly", description: "Plotly" });

      const list = await registry.listSkills();

      expect(list).toHaveLength(2);
      expect(list.map((s) => s.name).sort()).toEqual(["pandas", "plotly"]);
    });

    it("should return empty array when no skills", async () => {
      const list = await registry.listSkills();
      expect(list).toEqual([]);
    });
  });

  describe("updateSkill", () => {
    it("should update specific fields", async () => {
      await registry.createSkill({ name: "pandas", description: "old" });
      await registry.updateSkill("pandas", { description: "new description" });

      const skill = await registry.getSkill("pandas");
      expect(skill.description).toBe("new description");
      expect(skill.name).toBe("pandas");
    });
  });

  describe("deleteSkill", () => {
    it("should remove the file", async () => {
      await registry.createSkill({ name: "pandas", description: "Pandas" });
      await registry.deleteSkill("pandas");

      const list = await registry.listSkills();
      expect(list).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/skill-registry.test.ts
```

Expected: FAIL — module `../skill-registry` not found.

- [ ] **Step 3: Implement SkillRegistry**

```typescript
// packages/core/src/mcp/server/python-mcp/skill-registry.ts
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { SkillConfig, SkillMeta } from "./types";

export class SkillRegistry {
  private skillDir: string;

  constructor(skillDir: string) {
    this.skillDir = skillDir;
  }

  async listSkills(): Promise<SkillMeta[]> {
    await mkdir(this.skillDir, { recursive: true });
    const files = await readdir(this.skillDir).catch(() => [] as string[]);
    const skills: SkillMeta[] = [];

    for (const file of files) {
      if (!file.startsWith("skill_") || !file.endsWith(".md")) continue;
      const content = await readFile(join(this.skillDir, file), "utf-8");
      const { data } = matter(content);
      skills.push({
        name: data.name ?? file.replace(/^skill_/, "").replace(/\.md$/, ""),
        description: data.description ?? "",
      });
    }
    return skills;
  }

  async getSkill(name: string): Promise<SkillConfig> {
    const filePath = join(this.skillDir, `skill_${name}.md`);
    const content = await readFile(filePath, "utf-8");
    return this.parseSkillMarkdown(content);
  }

  async createSkill(config: SkillConfig): Promise<void> {
    await mkdir(this.skillDir, { recursive: true });
    const filePath = join(this.skillDir, `skill_${config.name}.md`);
    const content = this.serializeSkillMarkdown(config);
    await writeFile(filePath, content, "utf-8");
  }

  async updateSkill(name: string, partial: Partial<SkillConfig>): Promise<void> {
    const existing = await this.getSkill(name);
    const updated = { ...existing, ...partial, name };
    await this.createSkill(updated);
  }

  async deleteSkill(name: string): Promise<void> {
    const filePath = join(this.skillDir, `skill_${name}.md`);
    await unlink(filePath);
  }

  private parseSkillMarkdown(raw: string): SkillConfig {
    const { data, content } = matter(raw);
    const codeForAgent = this.extractCodeBlock(content, "Code for Agent");
    const codeForInterpreter = this.extractCodeBlock(content, "Code for Interpreter");

    return {
      name: data.name ?? "",
      description: data.description ?? "",
      code_for_agent: codeForAgent || undefined,
      code_for_interpreter: codeForInterpreter || undefined,
    };
  }

  private serializeSkillMarkdown(config: SkillConfig): string {
    const frontmatter = matter.stringify("", {
      name: config.name,
      description: config.description,
    });

    let body = "";
    if (config.code_for_agent) {
      body += `\n## Code for Agent\n\`\`\`python\n${config.code_for_agent}\n\`\`\`\n`;
    }
    if (config.code_for_interpreter) {
      body += `\n## Code for Interpreter\n\`\`\`python\n${config.code_for_interpreter}\n\`\`\`\n`;
    }

    return frontmatter.trim() + "\n" + body;
  }

  private extractCodeBlock(content: string, heading: string): string | null {
    const regex = new RegExp(
      `## ${heading}\\s*\\n\`\`\`(?:python)?\\n([\\s\\S]*?)\`\`\``,
      "m",
    );
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/skill-registry.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/mcp/server/python-mcp/skill-registry.ts packages/core/src/mcp/server/python-mcp/__tests__/skill-registry.test.ts
git commit -m "feat(python-mcp): implement SkillRegistry with markdown CRUD"
```

---

### Task 5: MCP Server (createPythonMcpServer)

**Files:**
- Create: `packages/core/src/mcp/server/python-mcp/mcp-server.ts`
- Create: `packages/core/src/mcp/server/python-mcp/__tests__/mcp-server.test.ts`

- [ ] **Step 1: Write the MCP Server test**

```typescript
// packages/core/src/mcp/server/python-mcp/__tests__/mcp-server.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createPythonMcpServer, PYTHON_MCP_SERVER_NAME, EXECUTE_CODE_TOOL_NAME, LOAD_SKILL_TOOL_NAME } from "../mcp-server";
import type { SessionManager } from "../session-manager";
import type { SkillRegistry } from "../skill-registry";
import type { JupyterClient } from "../jupyter-client";

type RegisteredTool = {
  description?: string;
  inputSchema?: unknown;
  handler: (args: unknown) => Promise<CallToolResult>;
};

type InspectableMcpServer = {
  _registeredTools?: Record<string, RegisteredTool>;
  server: { _serverInfo?: { name?: string } };
};

describe("createPythonMcpServer", () => {
  let mockSessionManager: SessionManager;
  let mockSkillRegistry: SkillRegistry;
  let mockJupyterClient: JupyterClient;

  beforeEach(() => {
    mockSessionManager = {
      getActiveKernel: vi.fn().mockResolvedValue("test-kernel-id"),
      recordCode: vi.fn().mockResolvedValue("c_001"),
      recordResult: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionManager;

    mockSkillRegistry = {
      getSkill: vi.fn().mockResolvedValue({
        name: "pandas",
        description: "Data analysis",
        code_for_agent: "import pandas as pd",
        code_for_interpreter: "import pandas as pd\nprint('init')",
      }),
    } as unknown as SkillRegistry;

    mockJupyterClient = {
      executeCode: vi.fn().mockResolvedValue({
        status: "ok",
        outputs: [{ type: "stream", stream_name: "stdout", text: "hello\n" }],
      }),
    } as unknown as JupyterClient;
  });

  it("should create server with correct name", () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    expect(inspectable.server._serverInfo?.name).toBe(PYTHON_MCP_SERVER_NAME);
  });

  it("should register execute_code and load_skill tools", () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    const tools = inspectable._registeredTools ?? {};
    expect(EXECUTE_CODE_TOOL_NAME in tools).toBe(true);
    expect(LOAD_SKILL_TOOL_NAME in tools).toBe(true);
  });

  it("execute_code should return multimodal content and structuredContent", async () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    const handler = inspectable._registeredTools?.[EXECUTE_CODE_TOOL_NAME]?.handler;
    expect(handler).toBeDefined();

    const result = await handler!({ code: "print('hello')", description: "test" });

    expect(result.content).toEqual([{ type: "text", text: "hello\n" }]);
    expect(result.structuredContent).toMatchObject({
      code_id: "c_001",
      kernel_id: "test-kernel-id",
      status: "ok",
    });
    expect(result.isError).toBeUndefined();
  });

  it("load_skill should execute code_for_interpreter and return prompt", async () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    const handler = inspectable._registeredTools?.[LOAD_SKILL_TOOL_NAME]?.handler;
    expect(handler).toBeDefined();

    const result = await handler!({ skill_name: "pandas" });

    expect(result.content[0]).toMatchObject({ type: "text" });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("pandas");
    expect(text).toContain("import pandas as pd");
    expect(result.structuredContent).toMatchObject({
      skill_name: "pandas",
      status: "success",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/mcp-server.test.ts
```

Expected: FAIL — module `../mcp-server` not found.

- [ ] **Step 3: Implement createPythonMcpServer**

```typescript
// packages/core/src/mcp/server/python-mcp/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { executeCodeInputSchema, loadSkillInputSchema } from "./types";
import type { ExecutionResult, OutputItem } from "./types";
import type { SessionManager } from "./session-manager";
import type { SkillRegistry } from "./skill-registry";
import type { JupyterClient } from "./jupyter-client";

export const PYTHON_MCP_SERVER_NAME = "python_mcp";
export const EXECUTE_CODE_TOOL_NAME = "execute_code";
export const LOAD_SKILL_TOOL_NAME = "load_skill";

export interface PythonMcpServerOptions {
  sessionManager: SessionManager;
  skillRegistry: SkillRegistry;
  getJupyterClient: () => JupyterClient;
  getAcpSessionId: () => string;
}

export function createPythonMcpServer(options: PythonMcpServerOptions): McpServer {
  const { sessionManager, skillRegistry, getJupyterClient, getAcpSessionId } = options;

  const server = new McpServer({
    name: PYTHON_MCP_SERVER_NAME,
    version: "1.0.0",
  });

  server.tool(
    EXECUTE_CODE_TOOL_NAME,
    "Execute Python code in a Jupyter kernel bound to the current session.",
    {
      code: executeCodeInputSchema.shape.code,
      description: executeCodeInputSchema.shape.description,
    },
    async (args): Promise<CallToolResult> => {
      const { code, description } = args as { code: string; description: string };
      const acpSessionId = getAcpSessionId();
      const client = getJupyterClient();

      const kernelId = await sessionManager.getActiveKernel(acpSessionId, client);
      const codeId = await sessionManager.recordCode(acpSessionId, kernelId, { code, description });

      let result: ExecutionResult;
      try {
        result = await client.executeCode(kernelId, code);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        result = {
          status: "error",
          outputs: [],
          error: { name: "ExecutionError", value: errorMsg, traceback: [] },
        };
      }

      await sessionManager.recordResult(acpSessionId, kernelId, codeId, result);

      return {
        content: outputsToContentBlocks(result.outputs),
        structuredContent: {
          code_id: codeId,
          kernel_id: kernelId,
          status: result.status,
          block_list: result.outputs,
        },
        isError: result.status === "error" || undefined,
      };
    },
  );

  server.tool(
    LOAD_SKILL_TOOL_NAME,
    "Load a code skill into the current session, optionally running initialization code.",
    {
      skill_name: loadSkillInputSchema.shape.skill_name,
    },
    async (args): Promise<CallToolResult> => {
      const { skill_name } = args as { skill_name: string };
      const skill = await skillRegistry.getSkill(skill_name);

      let initResult: ExecutionResult | undefined;
      if (skill.code_for_interpreter) {
        const acpSessionId = getAcpSessionId();
        const client = getJupyterClient();
        const kernelId = await sessionManager.getActiveKernel(acpSessionId, client);
        const codeId = await sessionManager.recordCode(acpSessionId, kernelId, {
          code: skill.code_for_interpreter,
          description: `[skill:${skill_name}] initialization`,
        });
        initResult = await client.executeCode(kernelId, skill.code_for_interpreter);
        await sessionManager.recordResult(acpSessionId, kernelId, codeId, initResult);
      }

      let text = `<system-reminder>Loaded skill '${skill_name}'</system-reminder>\n\n`;
      text += `**${skill.description}**\n\n`;
      if (skill.code_for_agent) {
        text += `## Code for Agent\n\`\`\`python\n${skill.code_for_agent}\n\`\`\`\n\n`;
      }
      if (initResult) {
        const initText = initResult.outputs
          .map((o) => o.text ?? (o.data?.["text/plain"] as string) ?? "")
          .filter(Boolean)
          .join("\n");
        if (initText) {
          text += `<executed-result>\n${initText}\n</executed-result>\n`;
        }
      }

      return {
        content: [{ type: "text", text }],
        structuredContent: {
          skill_name,
          status: "success",
          initialization_result: initResult ?? null,
        },
      };
    },
  );

  return server;
}

function outputsToContentBlocks(outputs: OutputItem[]): CallToolResult["content"] {
  const blocks: CallToolResult["content"] = [];

  for (const output of outputs) {
    switch (output.type) {
      case "stream":
        if (output.text) {
          blocks.push({ type: "text", text: output.text });
        }
        break;
      case "execute_result":
      case "display_data": {
        const data = output.data;
        if (!data) break;
        // Image takes priority
        if (data["image/png"]) {
          blocks.push({ type: "image", mimeType: "image/png", data: data["image/png"] as string });
        } else if (data["image/jpeg"]) {
          blocks.push({ type: "image", mimeType: "image/jpeg", data: data["image/jpeg"] as string });
        } else if (data["text/plain"]) {
          blocks.push({ type: "text", text: data["text/plain"] as string });
        }
        break;
      }
      case "error":
        if (output.text) {
          blocks.push({ type: "text", text: output.text });
        }
        break;
    }
  }

  if (blocks.length === 0) {
    blocks.push({ type: "text", text: "(no output)" });
  }
  return blocks;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/__tests__/mcp-server.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/mcp/server/python-mcp/mcp-server.ts packages/core/src/mcp/server/python-mcp/__tests__/mcp-server.test.ts
git commit -m "feat(python-mcp): implement createPythonMcpServer with execute_code and load_skill"
```

---

### Task 6: Gateway Route (MCP endpoint + Management APIs)

**Files:**
- Create: `packages/core/src/gateway/routes/mcp-server/python-mcp-server.ts`
- Modify: `packages/core/src/gateway/routes/index.ts`

- [ ] **Step 1: Implement the route file**

```typescript
// packages/core/src/gateway/routes/mcp-server/python-mcp-server.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { createPythonMcpServer } from "../../../mcp/server/python-mcp/mcp-server";
import { JupyterClient } from "../../../mcp/server/python-mcp/jupyter-client";
import { SessionManager } from "../../../mcp/server/python-mcp/session-manager";
import { SkillRegistry } from "../../../mcp/server/python-mcp/skill-registry";
import type { PythonMcpConfig } from "../../../mcp/server/python-mcp/types";
import { logger as globalLogger } from "../../../telemetry";

const log = globalLogger.child({ module: "python-mcp-server" });
const PYTHON_MCP_PATH = "/api/mcp-server/python";
const MANAGEMENT_PREFIX = "/api/python-mcp";

const BASE_DIR = join(homedir(), ".viben", "python-mcp");
const CONFIG_PATH = join(BASE_DIR, "config.yaml");
const SESSIONS_DIR = join(BASE_DIR, "sessions");
const SKILLS_DIR = join(BASE_DIR, "skills");

interface PythonMcpTransport extends Transport {
  handleRequest(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
}

interface PythonMcpSession {
  id: string;
  server: Pick<McpServer, "connect">;
  transport: PythonMcpTransport;
  acpSessionId: string;
}

const sessions = new Map<string, PythonMcpSession>();
const sessionManager = new SessionManager(SESSIONS_DIR);
const skillRegistry = new SkillRegistry(SKILLS_DIR);

async function loadConfig(): Promise<PythonMcpConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return parseYaml(raw) as PythonMcpConfig;
  } catch {
    return { jupyter_url: "http://localhost:8888", jupyter_token: "" };
  }
}

async function saveConfig(config: PythonMcpConfig): Promise<void> {
  await mkdir(BASE_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, stringifyYaml(config), "utf-8");
}

function getJupyterClientFromRequest(request: FastifyRequest): JupyterClient {
  const headerUrl = request.headers["x-jupyter-url"] as string | undefined;
  const headerToken = request.headers["x-jupyter-token"] as string | undefined;
  // Synchronous fallback — config is read at route level and cached per-request
  // For simplicity, use headers or throw. Config fallback is handled at route level.
  return new JupyterClient(
    headerUrl || "",
    headerToken || "",
  );
}

function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin || "*";
  reply.raw.setHeader("Access-Control-Allow-Origin", origin);
  reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
  reply.raw.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-Id, mcp-protocol-version, X-Viben-Session-Id, X-Jupyter-Url, X-Jupyter-Token",
  );
  reply.raw.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, mcp-protocol-version");
  reply.raw.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

function getSessionIdFromHeader(request: FastifyRequest): string | undefined {
  const value = request.headers["mcp-session-id"];
  return Array.isArray(value) ? value.at(-1) : value;
}

function getAcpSessionIdFromRequest(request: FastifyRequest): string | undefined {
  const queryParam = (request.query as Record<string, string>)?.session_id;
  if (queryParam) return queryParam;
  const header = request.headers["x-viben-session-id"];
  return Array.isArray(header) ? header.at(-1) : header;
}

export function closeAllPythonMcpServerSessions(): void {
  for (const session of sessions.values()) {
    session.transport.close().catch((error) => {
      log.warn({ err: error, sessionId: session.id }, "Failed to close python MCP transport");
    });
  }
  sessions.clear();
}

export function getActivePythonMcpServerSessionCount(): number {
  return sessions.size;
}

export function registerPythonMcpServerRoutes(fastify: FastifyInstance): void {
  // --- MCP Protocol Endpoints ---

  fastify.get(PYTHON_MCP_PATH, async (request, reply) => {
    setCorsHeaders(request, reply);
    const mcpSessionId = getSessionIdFromHeader(request);
    if (!mcpSessionId) {
      reply.code(400);
      return { error: "Mcp-Session-Id header required" };
    }
    const session = sessions.get(mcpSessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }
    await session.transport.handleRequest(request.raw, reply.raw);
  });

  fastify.post(PYTHON_MCP_PATH, async (request, reply) => {
    setCorsHeaders(request, reply);
    const mcpSessionId = getSessionIdFromHeader(request);

    if (mcpSessionId) {
      const session = sessions.get(mcpSessionId);
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }
      await session.transport.handleRequest(request.raw, reply.raw, request.body);
      return;
    }

    // New session — require ACP session id
    const acpSessionId = getAcpSessionIdFromRequest(request);
    if (!acpSessionId) {
      reply.code(400);
      return { error: "X-Viben-Session-Id header or session_id query param required" };
    }

    // Resolve Jupyter config: headers > config.yaml
    const config = await loadConfig();
    const jupyterUrl = (request.headers["x-jupyter-url"] as string) || config.jupyter_url;
    const jupyterToken = (request.headers["x-jupyter-token"] as string) || config.jupyter_token;
    const jupyterClient = new JupyterClient(jupyterUrl, jupyterToken);

    const pendingMcpSessionId = `pending-${randomUUID()}`;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (newMcpSessionId) => {
        const pending = sessions.get(pendingMcpSessionId);
        if (!pending) return;
        sessions.delete(pendingMcpSessionId);
        sessions.set(newMcpSessionId, { ...pending, id: newMcpSessionId });
        log.info({ sessionId: newMcpSessionId, acpSessionId }, "Python MCP session initialized");
      },
      onsessionclosed: (closedId) => {
        sessions.delete(closedId);
        log.info({ sessionId: closedId }, "Python MCP session closed");
      },
    });

    const server = createPythonMcpServer({
      sessionManager,
      skillRegistry,
      getJupyterClient: () => jupyterClient,
      getAcpSessionId: () => acpSessionId,
    });

    const sessionId = transport.sessionId ?? pendingMcpSessionId;
    sessions.set(sessionId, { id: sessionId, server, transport, acpSessionId });

    transport.onclose = () => {
      sessions.delete(sessionId);
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    await server.connect(transport);
    await transport.handleRequest(request.raw, reply.raw, request.body);
  });

  fastify.delete(PYTHON_MCP_PATH, async (request, reply) => {
    setCorsHeaders(request, reply);
    const mcpSessionId = getSessionIdFromHeader(request);
    if (!mcpSessionId) {
      reply.code(400);
      return { error: "Mcp-Session-Id header required" };
    }
    const session = sessions.get(mcpSessionId);
    if (!session) {
      reply.code(404);
      return { error: "Session not found" };
    }
    await session.transport.handleRequest(request.raw, reply.raw);
    sessions.delete(mcpSessionId);
  });

  // --- Management APIs ---

  fastify.get(`${MANAGEMENT_PREFIX}/config`, async () => {
    return await loadConfig();
  });

  fastify.put(`${MANAGEMENT_PREFIX}/config`, async (request) => {
    const body = request.body as Partial<PythonMcpConfig>;
    const current = await loadConfig();
    const updated = { ...current, ...body };
    await saveConfig(updated);
    return updated;
  });

  fastify.get(`${MANAGEMENT_PREFIX}/sessions`, async () => {
    return await sessionManager.getAllSessions();
  });

  fastify.get(`${MANAGEMENT_PREFIX}/sessions/:id/history`, async (request) => {
    const { id } = request.params as { id: string };
    return await sessionManager.getHistory(id);
  });

  fastify.post(`${MANAGEMENT_PREFIX}/execute`, async (request) => {
    const { kernel_id, code, description } = request.body as {
      kernel_id: string;
      code: string;
      description?: string;
    };
    const config = await loadConfig();
    const jupyterUrl = (request.headers["x-jupyter-url"] as string) || config.jupyter_url;
    const jupyterToken = (request.headers["x-jupyter-token"] as string) || config.jupyter_token;
    const client = new JupyterClient(jupyterUrl, jupyterToken);
    const result = await client.executeCode(kernel_id, code);
    return result;
  });

  fastify.get(`${MANAGEMENT_PREFIX}/skills`, async () => {
    return await skillRegistry.listSkills();
  });

  fastify.post(`${MANAGEMENT_PREFIX}/skills`, async (request) => {
    const body = request.body as { name: string; description: string; code_for_interpreter?: string; code_for_agent?: string };
    await skillRegistry.createSkill(body);
    return { status: "created", name: body.name };
  });

  fastify.put(`${MANAGEMENT_PREFIX}/skills/:name`, async (request) => {
    const { name } = request.params as { name: string };
    const body = request.body as { description?: string; code_for_interpreter?: string; code_for_agent?: string };
    await skillRegistry.updateSkill(name, body);
    return { status: "updated", name };
  });

  fastify.delete(`${MANAGEMENT_PREFIX}/skills/:name`, async (request) => {
    const { name } = request.params as { name: string };
    await skillRegistry.deleteSkill(name);
    return { status: "deleted", name };
  });
}
```

- [ ] **Step 2: Register the route in gateway index**

Add to `packages/core/src/gateway/routes/index.ts`:

```typescript
// Add import at the top with other mcp-server imports:
import { registerPythonMcpServerRoutes } from "./mcp-server/python-mcp-server";

// Add registration in registerRoutes() function body (after registerBrowseMcpServerRoutes):
registerPythonMcpServerRoutes(fastify);

// Add re-export at the bottom:
export {
  registerPythonMcpServerRoutes,
  getActivePythonMcpServerSessionCount,
  closeAllPythonMcpServerSessions,
} from "./mcp-server/python-mcp-server";
```

- [ ] **Step 3: Verify build compiles**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/gateway/routes/mcp-server/python-mcp-server.ts packages/core/src/gateway/routes/index.ts
git commit -m "feat(python-mcp): add gateway route with MCP endpoint and management APIs"
```

---

### Task 7: Desktop Page — python-mcp.tsx

**Files:**
- Create: `apps/desktop/src/pages/mcp/python-mcp.tsx`
- Modify: `apps/desktop/src/pages/mcp/index.ts`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/navigation/route-registry.ts`
- Modify: `apps/desktop/src/components/layout/mcp-services-layout.tsx`

- [ ] **Step 1: Create the page component**

```typescript
// apps/desktop/src/pages/mcp/python-mcp.tsx
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Copy,
  Check,
  Info,
  Play,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { getGatewayUrl } from "@/lib/gateway/config";
import { useAcpSessionStore } from "@/stores/acp-session-store";
import {
  createJSONEditor,
  Mode,
  type JSONEditorPropsOptional,
  type Content,
} from "vanilla-jsoneditor";
import "vanilla-jsoneditor/themes/jse-theme-dark.css";

const PYTHON_MCP_PATH = "/api/mcp-server/python";
const API_PREFIX = "/api/python-mcp";

interface PythonMcpConfig {
  jupyter_url: string;
  jupyter_token: string;
}

interface SessionInfo {
  acp_session_id: string;
  current_kernel_id: string;
  kernel_count: number;
  created_at: number;
  last_used_at: number;
}

interface LogEntry {
  type: "code" | "result";
  code_id: string;
  timestamp: number;
  code?: string;
  description?: string;
  status?: string;
  outputs?: Array<{ type: string; stream_name?: string; text?: string; data?: Record<string, unknown> }>;
  error?: { name: string; value: string; traceback: string[] };
}

interface KernelHistory {
  kernel_id: string;
  created_at: number;
  entries: LogEntry[];
}

interface SkillMeta {
  name: string;
  description: string;
}

interface SkillConfig {
  name: string;
  description: string;
  code_for_interpreter?: string;
  code_for_agent?: string;
}

export function PythonMcpPage() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const gatewayUrl = useMemo(() => getGatewayUrl(), []);
  const activeSessionId = useAcpSessionStore((s) => s.activeSessionId);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-serif">Python MCP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            通过 Jupyter Server 为 AI Agent 提供 Python 代码执行能力
          </p>
        </div>

        <JupyterConfigSection gatewayUrl={gatewayUrl} />
        <SessionMappingSection gatewayUrl={gatewayUrl} />
        <DebugExecutorSection gatewayUrl={gatewayUrl} />
        <SkillsSection gatewayUrl={gatewayUrl} />
        <McpConfigSection
          gatewayUrl={gatewayUrl}
          activeSessionId={activeSessionId}
          copied={copied}
          copyToClipboard={copyToClipboard}
        />
      </div>
    </div>
  );
}

// --- Section 1: Jupyter Config ---
function JupyterConfigSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [config, setConfig] = useState<PythonMcpConfig>({ jupyter_url: "http://localhost:8888", jupyter_token: "" });
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${gatewayUrl}${API_PREFIX}/config`)
      .then((r) => r.json())
      .then((data) => setConfig(data))
      .catch(() => {});
  }, [gatewayUrl]);

  const saveConfig = async () => {
    setSaving(true);
    await fetch(`${gatewayUrl}${API_PREFIX}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  };

  const testConnection = async () => {
    try {
      const res = await fetch(`${config.jupyter_url}/api/kernels`, {
        headers: { Authorization: `token ${config.jupyter_token}` },
      });
      setStatus(res.ok ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Jupyter 连接配置</h2>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0">Base URL</label>
          <input
            className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
            value={config.jupyter_url}
            onChange={(e) => setConfig((c) => ({ ...c, jupyter_url: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0">Token</label>
          <input
            type="password"
            className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
            value={config.jupyter_token}
            onChange={(e) => setConfig((c) => ({ ...c, jupyter_token: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveConfig} disabled={saving}>
            <Save className="h-3 w-3 mr-1" />
            保存
          </Button>
          <Button size="sm" variant="outline" onClick={testConnection}>
            测试连接
          </Button>
          <span className="text-xs">
            {status === "connected" && <span className="text-green-500 flex items-center gap-1"><Wifi className="h-3 w-3" /> 已连接</span>}
            {status === "disconnected" && <span className="text-destructive flex items-center gap-1"><WifiOff className="h-3 w-3" /> 未连接</span>}
          </span>
        </div>
      </div>
    </section>
  );
}

// --- Section 2: Session Mapping ---
function SessionMappingSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, KernelHistory[]>>({});

  const refresh = async () => {
    const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions`);
    if (res.ok) setSessions(await res.json());
  };

  useEffect(() => { refresh(); }, [gatewayUrl]);

  const toggleExpand = async (sessionId: string) => {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!histories[sessionId]) {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/sessions/${sessionId}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistories((h) => ({ ...h, [sessionId]: data }));
      }
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Session → Kernel 映射</h2>
        <Button size="sm" variant="ghost" onClick={refresh}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无活跃 Session</p>
      ) : (
        <div className="space-y-1">
          {sessions.map((s) => (
            <div key={s.acp_session_id}>
              <div
                className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 cursor-pointer hover:bg-muted"
                onClick={() => toggleExpand(s.acp_session_id)}
              >
                {expanded === s.acp_session_id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <code className="text-xs font-mono truncate flex-1">{s.acp_session_id}</code>
                <span className="text-xs text-muted-foreground">{s.kernel_count} kernel(s)</span>
                <code className="text-xs font-mono">{s.current_kernel_id.slice(0, 8)}...</code>
              </div>
              {expanded === s.acp_session_id && histories[s.acp_session_id] && (
                <div className="ml-6 mt-1 space-y-1">
                  {histories[s.acp_session_id].map((kh) => (
                    <div key={kh.kernel_id} className="rounded border p-2 text-xs space-y-1">
                      <div className="font-mono text-muted-foreground">
                        kernel: {kh.kernel_id.slice(0, 12)}... — {kh.entries.filter((e) => e.type === "code").length} executions
                      </div>
                      {kh.entries.filter((e) => e.type === "code").slice(-5).map((entry) => (
                        <div key={entry.code_id} className="flex gap-2">
                          <span className="text-muted-foreground">{entry.code_id}</span>
                          <span className="truncate">{entry.code?.split("\n")[0]}</span>
                          {!kh.entries.find((r) => r.type === "result" && r.code_id === entry.code_id) && (
                            <span className="text-yellow-500">⏳</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// --- Section 3: Debug Executor ---
function DebugExecutorSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [kernelId, setKernelId] = useState("");
  const [code, setCode] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [mode, setMode] = useState<"rich" | "json">("rich");
  const jsonEditorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<ReturnType<typeof createJSONEditor> | null>(null);

  const execute = async () => {
    if (!kernelId || !code) return;
    setExecuting(true);
    try {
      const res = await fetch(`${gatewayUrl}${API_PREFIX}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kernel_id: kernelId, code, description: "debug" }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ status: "error", error: { name: "FetchError", value: String(err), traceback: [] } });
    }
    setExecuting(false);
  };

  useEffect(() => {
    if (mode === "json" && jsonEditorRef.current && result) {
      if (!editorInstance.current) {
        editorInstance.current = createJSONEditor({
          target: jsonEditorRef.current,
          props: {
            mode: Mode.tree,
            readOnly: true,
            content: { json: result },
          },
        });
      } else {
        editorInstance.current.set({ json: result });
      }
    }
  }, [mode, result]);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <h2 className="font-semibold">Debug 执行器</h2>
      <div className="flex items-center gap-2">
        <label className="text-xs shrink-0">Kernel ID</label>
        <input
          className="flex-1 rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-mono"
          placeholder="粘贴 kernel id..."
          value={kernelId}
          onChange={(e) => setKernelId(e.target.value)}
        />
      </div>
      <textarea
        className="w-full rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono min-h-[120px] resize-y"
        placeholder="# Python code..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={execute} disabled={executing || !kernelId || !code}>
          <Play className="h-3 w-3 mr-1" />
          {executing ? "执行中..." : "执行"}
        </Button>
        <div className="flex rounded-md border text-xs">
          <button
            className={`px-3 py-1 ${mode === "rich" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("rich")}
          >
            Rich
          </button>
          <button
            className={`px-3 py-1 ${mode === "json" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("json")}
          >
            JSON
          </button>
        </div>
      </div>
      {result && (
        <div className="rounded-lg border bg-muted/30 p-3 max-h-[400px] overflow-auto">
          {mode === "rich" ? (
            <RichOutput result={result as Record<string, unknown>} />
          ) : (
            <div ref={jsonEditorRef} className="jse-theme-dark" />
          )}
        </div>
      )}
    </section>
  );
}

function RichOutput({ result }: { result: Record<string, unknown> }) {
  const outputs = (result.outputs ?? []) as Array<{
    type: string;
    stream_name?: string;
    text?: string;
    data?: Record<string, string>;
  }>;
  const error = result.error as { name: string; value: string; traceback: string[] } | undefined;

  return (
    <div className="space-y-2 text-xs font-mono">
      {outputs.map((output, i) => {
        if (output.type === "stream") {
          return (
            <pre key={i} className={output.stream_name === "stderr" ? "text-yellow-500" : ""}>
              {output.text}
            </pre>
          );
        }
        if (output.type === "execute_result" || output.type === "display_data") {
          const data = output.data;
          if (!data) return null;
          if (data["image/png"]) {
            return <img key={i} src={`data:image/png;base64,${data["image/png"]}`} className="max-w-full" />;
          }
          if (data["image/jpeg"]) {
            return <img key={i} src={`data:image/jpeg;base64,${data["image/jpeg"]}`} className="max-w-full" />;
          }
          if (data["text/html"]) {
            return <iframe key={i} srcDoc={data["text/html"]} className="w-full min-h-[100px] border-0" sandbox="" />;
          }
          if (data["text/plain"]) {
            return <pre key={i}>{data["text/plain"]}</pre>;
          }
        }
        if (output.type === "error" && output.text) {
          return <pre key={i} className="text-destructive">{output.text}</pre>;
        }
        return null;
      })}
      {error && (
        <pre className="text-destructive">
          {error.name}: {error.value}
          {"\n"}
          {error.traceback.join("\n")}
        </pre>
      )}
    </div>
  );
}

// --- Section 4: Skills ---
function SkillsSection({ gatewayUrl }: { gatewayUrl: string }) {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [editing, setEditing] = useState<SkillConfig | null>(null);
  const [isNew, setIsNew] = useState(false);

  const refresh = async () => {
    const res = await fetch(`${gatewayUrl}${API_PREFIX}/skills`);
    if (res.ok) setSkills(await res.json());
  };

  useEffect(() => { refresh(); }, [gatewayUrl]);

  const startNew = () => {
    setEditing({ name: "", description: "", code_for_interpreter: "", code_for_agent: "" });
    setIsNew(true);
  };

  const saveSkill = async () => {
    if (!editing) return;
    const method = isNew ? "POST" : "PUT";
    const url = isNew
      ? `${gatewayUrl}${API_PREFIX}/skills`
      : `${gatewayUrl}${API_PREFIX}/skills/${editing.name}`;
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    setEditing(null);
    setIsNew(false);
    refresh();
  };

  const deleteSkill = async (name: string) => {
    await fetch(`${gatewayUrl}${API_PREFIX}/skills/${name}`, { method: "DELETE" });
    setEditing(null);
    refresh();
  };

  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Skills 管理</h2>
        <Button size="sm" variant="outline" onClick={startNew}>
          <Plus className="h-3 w-3 mr-1" /> 新建 Skill
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <Button
            key={s.name}
            size="sm"
            variant={editing?.name === s.name ? "default" : "outline"}
            onClick={async () => {
              const res = await fetch(`${gatewayUrl}${API_PREFIX}/skills/${s.name}`);
              // The API returns SkillMeta from list, need full config — just use what we have
              setEditing({ ...s, code_for_interpreter: "", code_for_agent: "" });
              setIsNew(false);
            }}
          >
            {s.name}
          </Button>
        ))}
      </div>
      {editing && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border bg-muted/50 px-2 py-1 text-sm"
              placeholder="name"
              value={editing.name}
              onChange={(e) => setEditing((s) => s && { ...s, name: e.target.value })}
              disabled={!isNew}
            />
            <input
              className="flex-[2] rounded-md border bg-muted/50 px-2 py-1 text-sm"
              placeholder="description"
              value={editing.description}
              onChange={(e) => setEditing((s) => s && { ...s, description: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Code for Interpreter</label>
            <textarea
              className="w-full rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono min-h-[60px]"
              value={editing.code_for_interpreter ?? ""}
              onChange={(e) => setEditing((s) => s && { ...s, code_for_interpreter: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Code for Agent</label>
            <textarea
              className="w-full rounded-md border bg-muted/50 px-2 py-1 text-xs font-mono min-h-[60px]"
              value={editing.code_for_agent ?? ""}
              onChange={(e) => setEditing((s) => s && { ...s, code_for_agent: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSkill}><Save className="h-3 w-3 mr-1" /> 保存</Button>
            {!isNew && (
              <Button size="sm" variant="destructive" onClick={() => deleteSkill(editing.name)}>
                <Trash2 className="h-3 w-3 mr-1" /> 删除
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// --- Section 5: MCP Config ---
function McpConfigSection({
  gatewayUrl,
  activeSessionId,
  copied,
  copyToClipboard,
}: {
  gatewayUrl: string;
  activeSessionId: string | null;
  copied: string | null;
  copyToClipboard: (text: string, key: string) => void;
}) {
  const mcpServerUrl = `${gatewayUrl}${PYTHON_MCP_PATH}`;

  const mcpConfigQueryParam = useMemo(() => {
    if (!activeSessionId) return null;
    return JSON.stringify({
      mcpServers: {
        "viben-python": {
          url: `${mcpServerUrl}?session_id=${activeSessionId}`,
          transport: "streamable-http",
        },
      },
    }, null, 2);
  }, [mcpServerUrl, activeSessionId]);

  const mcpConfigHeader = useMemo(() => {
    const headers: Record<string, string> = {};
    if (activeSessionId) headers["X-Viben-Session-Id"] = activeSessionId;
    return JSON.stringify({
      mcpServers: {
        "viben-python": {
          url: mcpServerUrl,
          transport: "streamable-http",
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
        },
      },
    }, null, 2);
  }, [mcpServerUrl, activeSessionId]);

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">MCP Server 配置</h2>
      </div>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <h3 className="text-sm font-medium">请求头说明</h3>
        <div className="text-xs space-y-1 text-muted-foreground">
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-Viben-Session-Id</code>
            <span className="ml-1 text-destructive font-medium">(必需)</span> — ACP session id
          </div>
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-Jupyter-Url</code>
            <span className="ml-1">(可选)</span> — 覆盖默认 Jupyter URL
          </div>
          <div>
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">X-Jupyter-Token</code>
            <span className="ml-1">(可选)</span> — 覆盖默认 Jupyter Token
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">方式 1 — Query Parameter</h3>
        <CodeBlock
          code={mcpConfigQueryParam ?? "// 请先开始一个 ACP 会话"}
          onCopy={() => mcpConfigQueryParam && copyToClipboard(mcpConfigQueryParam, "pyConfig1")}
          copied={copied === "pyConfig1"}
          disabled={!mcpConfigQueryParam}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">方式 2 — Header</h3>
        <CodeBlock
          code={mcpConfigHeader}
          onCopy={() => copyToClipboard(mcpConfigHeader, "pyConfig2")}
          copied={copied === "pyConfig2"}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">端点信息</h3>
        <InfoRow label="URL" value={mcpServerUrl} onCopy={() => copyToClipboard(mcpServerUrl, "pyUrl")} copied={copied === "pyUrl"} />
        <InfoRow label="Transport" value="streamable-http" onCopy={() => copyToClipboard("streamable-http", "pyTransport")} copied={copied === "pyTransport"} />
      </div>
    </section>
  );
}

// --- Shared Components ---
function InfoRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
        <code className="text-xs font-mono truncate">{value}</code>
      </div>
      {onCopy && (
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onCopy}>
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}

function CodeBlock({ code, onCopy, copied, disabled }: { code: string; onCopy?: () => void; copied?: boolean; disabled?: boolean }) {
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-muted/70 border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
      {onCopy && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onCopy}
        >
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export from pages/mcp/index.ts**

Add to `apps/desktop/src/pages/mcp/index.ts`:

```typescript
export { PythonMcpPage } from "./python-mcp";
```

- [ ] **Step 3: Add route in App.tsx**

In `apps/desktop/src/App.tsx`, add import and route:

```typescript
// Add to imports (with other MCP page imports):
import { PythonMcpPage } from "@/pages/mcp";

// Add route inside <Route path="mcp-services"> after client-mcp:
<Route path="python-mcp" element={<PythonMcpPage />} />
```

- [ ] **Step 4: Add to route-registry.ts**

Add entry in `apps/desktop/src/navigation/route-registry.ts`:

```typescript
{ pattern: "/mcp-services/python-mcp", icon: { type: "lucide", value: "terminal" }, title: "Python MCP", titleKey: "nav.pythonMcp", dropdownCategory: "mcp-section" },
```

- [ ] **Step 5: Add to mcp-services-layout.tsx sidebar**

In the appropriate section of `apps/desktop/src/components/layout/mcp-services-layout.tsx`, add:

```typescript
{ titleKey: "nav.pythonMcp", href: "/mcp-services/python-mcp", icon: Terminal },
```

And add `Terminal` to the lucide-react import.

- [ ] **Step 6: Verify desktop app compiles**

```bash
cd apps/desktop && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/pages/mcp/python-mcp.tsx apps/desktop/src/pages/mcp/index.ts apps/desktop/src/App.tsx apps/desktop/src/navigation/route-registry.ts apps/desktop/src/components/layout/mcp-services-layout.tsx
git commit -m "feat(python-mcp): add Desktop management page with 5 sections"
```

---

### Task 8: Add ws dependency to packages/core

**Files:**
- Modify: `packages/core/package.json`

The `ws` package is available at root as a transitive dependency but not declared directly in packages/core. Since JupyterClient imports it, we need it explicit.

- [ ] **Step 1: Add ws to dependencies**

```bash
cd packages/core && pnpm add ws
```

- [ ] **Step 2: Verify types are already available**

`@types/ws` is already in devDependencies. Confirm:

```bash
grep "@types/ws" packages/core/package.json
```

Expected: `"@types/ws": "^8.18.1"` present.

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json pnpm-lock.yaml
git commit -m "feat(python-mcp): add ws dependency to packages/core"
```

---

### Task 9: Integration Verification

- [ ] **Step 1: Run all python-mcp tests**

```bash
cd packages/core && npx vitest run src/mcp/server/python-mcp/
```

Expected: All tests PASS.

- [ ] **Step 2: Build packages/core**

```bash
cd packages/core && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Build apps/desktop**

```bash
cd apps/desktop && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Start gateway and verify endpoint responds**

```bash
pnpm gateway:restart
# Wait for startup, then:
curl http://127.0.0.1:18790/api/python-mcp/config
```

Expected: Returns `{"jupyter_url":"http://localhost:8888","jupyter_token":""}` or similar.

- [ ] **Step 5: Verify desktop page loads**

Start desktop dev server and navigate to `/mcp-services/python-mcp`. Verify:
- All 5 sections render
- Jupyter config section shows inputs
- MCP config section shows JSON blocks with copy buttons
- No console errors

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(python-mcp): integration fixes"
```
