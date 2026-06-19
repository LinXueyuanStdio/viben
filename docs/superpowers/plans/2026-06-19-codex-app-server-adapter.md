# Codex App Server Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 `executor_type: CODEX` 时由 Viben Gateway 自己启动 `codex app-server` stdio 进程，并把 Codex app-server JSON-RPC 协议适配成现有 ACP backend 接口。

**Architecture:** 保持桌面端和 Gateway `/ws/agent/acp` 对外 ACP 协议不变，在 `packages/core/src/acp/ops` 内新增 Codex app-server 专用协议客户端、事件映射器和 backend session。`AcpSessionManager` 仍只依赖 `AcpBackendAdapter`，Codex 细节全部封装在 adapter 内。

**Tech Stack:** TypeScript ESM, Node `child_process`, Node streams/readline, Vitest, existing `@agentclientprotocol/sdk` ACP types.

---

## 文件结构

- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-protocol.ts`
  - Codex app-server JSON-RPC wire types、item/turn/thread 类型、runtime guard、小工具函数。
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.ts`
  - stdio JSONL JSON-RPC client，负责 spawn、initialize、request/notification、server request dispatch、stderr diagnostics、close。
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.ts`
  - Codex notification/request 到 ACP `SessionNotification`、`RequestPermissionRequest`、`PromptResponse` 的映射。
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.ts`
  - `AcpBackendAdapter` / `AcpBackendSession` 实现，管理 threadId、turnId、prompt resolver、cancel、close。
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/backend-adapter.ts`
  - 把 `CODEX` / `CODEX_APP_SERVER` 路由到 Codex app-server adapter；保留 `CODEX_ACP` 走旧 `codex-acp`。
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/examples/acp-client/README.md`
  - 更新 Codex backend 文档说明。
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.test.ts`
  - JSON-RPC client 单元测试，用 fake process factory。
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.test.ts`
  - notification、approval、prompt completion 映射测试。
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.test.ts`
  - backend session 生命周期测试，用 fake Codex server script。
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/agent-acp.integration.test.ts`
  - 通过真实 `/ws/agent/acp` JSON-RPC WebSocket 路由验证 Codex app-server adapter 不改变外部 ACP 协议。

## Task 1: 定义 Codex app-server 协议类型和 helpers

**Files:**
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-protocol.ts`
- Test: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.test.ts`

- [ ] **Step 1: 写协议类型文件**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-protocol.ts` with these exports:

```ts
export type CodexJsonRpcId = string | number;

export interface CodexJsonRpcRequest {
  id: CodexJsonRpcId;
  method: string;
  params?: unknown;
}

export interface CodexJsonRpcNotification {
  method: string;
  params?: unknown;
}

export interface CodexJsonRpcSuccess {
  id: CodexJsonRpcId;
  result: unknown;
}

export interface CodexJsonRpcFailure {
  id: CodexJsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type CodexJsonRpcMessage =
  | CodexJsonRpcRequest
  | CodexJsonRpcNotification
  | CodexJsonRpcSuccess
  | CodexJsonRpcFailure;

export interface CodexThread {
  id: string;
  sessionId?: string;
  name?: string | null;
  preview?: string;
  ephemeral?: boolean;
  modelProvider?: string;
  createdAt?: number;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface CodexTurn {
  id: string;
  status?: "inProgress" | "completed" | "interrupted" | "failed" | string;
  error?: {
    message?: string;
    codexErrorInfo?: unknown;
    additionalDetails?: unknown;
  } | null;
  [key: string]: unknown;
}

export interface CodexThreadResult {
  thread: CodexThread;
}

export interface CodexTurnResult {
  turn: CodexTurn;
}

export interface CodexInputTextItem {
  type: "text";
  text: string;
}

export interface CodexInputImageItem {
  type: "image" | "localImage";
  url?: string;
  path?: string;
}

export type CodexInputItem = CodexInputTextItem | CodexInputImageItem;

export interface CodexNotification {
  method: string;
  params?: Record<string, unknown>;
}

export interface CodexServerRequest {
  id: CodexJsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function isCodexSuccess(message: CodexJsonRpcMessage): message is CodexJsonRpcSuccess {
  return "id" in message && "result" in message;
}

export function isCodexFailure(message: CodexJsonRpcMessage): message is CodexJsonRpcFailure {
  return "id" in message && "error" in message;
}

export function isCodexServerRequest(message: CodexJsonRpcMessage): message is CodexServerRequest {
  return "id" in message && "method" in message && typeof message.method === "string";
}

export function isCodexNotification(message: CodexJsonRpcMessage): message is CodexNotification {
  return !("id" in message) && "method" in message && typeof message.method === "string";
}

export function expectThreadResult(result: unknown): CodexThreadResult {
  const record = asRecord(result);
  const thread = asRecord(record.thread);
  const id = readString(thread.id);
  if (!id) {
    throw new Error("Codex app-server response did not include thread.id");
  }
  return { thread: { ...thread, id } };
}

export function expectTurnResult(result: unknown): CodexTurnResult {
  const record = asRecord(result);
  const turn = asRecord(record.turn);
  const id = readString(turn.id);
  if (!id) {
    throw new Error("Codex app-server response did not include turn.id");
  }
  return { turn: { ...turn, id } };
}
```

- [ ] **Step 2: 跑类型检查确认新增类型无语法错误**

Run:

```bash
pnpm --filter @viben/core typecheck
```

Expected: may fail only on pre-existing unrelated workspace issues; no errors referencing `codex-app-server-protocol.ts`.

## Task 2: 实现 stdio JSON-RPC client

**Files:**
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.ts`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.test.ts`

- [ ] **Step 1: 写失败测试：request/response 和 notification 分发**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.test.ts` with:

```ts
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { CodexAppServerJsonRpcClient, type CodexAppServerProcess } from "./codex-app-server-client";

function createProcess(): CodexAppServerProcess & { stdout: PassThrough; stdin: PassThrough } {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  return {
    stdin,
    stdout,
    stderrText: "",
    command: "codex",
    args: ["app-server"],
    cwd: "/tmp/project",
    close: vi.fn(),
  };
}

describe("CodexAppServerJsonRpcClient", () => {
  it("matches JSON-RPC responses by id and writes JSONL requests", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient(proc);
    const request = client.request("model/list", { limit: 1 });

    const written = proc.stdin.read()?.toString() ?? "";
    expect(JSON.parse(written)).toEqual({ id: 1, method: "model/list", params: { limit: 1 } });

    proc.stdout.write(JSON.stringify({ id: 1, result: { data: [] } }) + "\n");
    await expect(request).resolves.toEqual({ data: [] });
  });

  it("emits notifications", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient(proc);
    const notifications: string[] = [];
    client.onNotification((message) => notifications.push(message.method));

    proc.stdout.write(JSON.stringify({ method: "turn/started", params: { turn: { id: "turn_1" } } }) + "\n");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notifications).toEqual(["turn/started"]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-client.test.ts
```

Expected: FAIL because `codex-app-server-client.ts` does not exist.

- [ ] **Step 3: 实现 client**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.ts` with:

```ts
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type {
  CodexJsonRpcId,
  CodexJsonRpcMessage,
  CodexServerRequest,
  CodexNotification,
} from "./codex-app-server-protocol";
import {
  isCodexFailure,
  isCodexNotification,
  isCodexServerRequest,
  isCodexSuccess,
} from "./codex-app-server-protocol";

export interface CodexAppServerProcess {
  stdin: Writable;
  stdout: Readable;
  stderrText: string;
  command: string;
  args: string[];
  cwd: string;
  close(): void;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

type NotificationHandler = (message: CodexNotification) => void | Promise<void>;
type ServerRequestHandler = (message: CodexServerRequest) => Promise<unknown>;

export class CodexAppServerJsonRpcClient {
  private nextId = 1;
  private readonly pending = new Map<CodexJsonRpcId, PendingRequest>();
  private readonly notificationHandlers = new Set<NotificationHandler>();
  private serverRequestHandler: ServerRequestHandler | undefined;
  private closed = false;

  constructor(private readonly processHandle: CodexAppServerProcess) {
    const lines = createInterface({ input: processHandle.stdout });
    lines.on("line", (line) => this.handleLine(line));
    lines.once("close", () => this.rejectAll(new Error("Codex app-server stdout closed")));
  }

  static spawn(command: string, args: string[], cwd: string, env: Record<string, string | undefined>): CodexAppServerProcess {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderrText = "";
    child.stderr.setEncoding("utf-8");
    child.stderr.on("data", (chunk: string) => {
      stderrText = `${stderrText}${chunk}`.slice(-16_000);
    });
    return {
      stdin: child.stdin,
      stdout: child.stdout,
      get stderrText() {
        return stderrText;
      },
      command,
      args,
      cwd,
      close() {
        if (child.exitCode !== null || child.killed) return;
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
        }, 2_000).unref();
      },
    };
  }

  request(method: string, params?: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error("Codex app-server client is closed"));
    const id = this.nextId++;
    const message = params === undefined ? { id, method } : { id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.write(message);
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) return;
    this.write(params === undefined ? { method } : { method, params });
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: ServerRequestHandler): void {
    this.serverRequestHandler = handler;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.rejectAll(new Error("Codex app-server client closed"));
    this.processHandle.close();
  }

  private write(message: unknown): void {
    this.processHandle.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) return;
    let message: CodexJsonRpcMessage;
    try {
      message = JSON.parse(line) as CodexJsonRpcMessage;
    } catch (error) {
      this.rejectAll(new Error(`Failed to parse Codex app-server JSON line: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }
    if (isCodexSuccess(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      pending.resolve(message.result);
      return;
    }
    if (isCodexFailure(message)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      pending.reject(new Error(message.error.message));
      return;
    }
    if (isCodexServerRequest(message)) {
      this.handleServerRequest(message);
      return;
    }
    if (isCodexNotification(message)) {
      for (const handler of this.notificationHandlers) {
        void handler(message);
      }
    }
  }

  private handleServerRequest(message: CodexServerRequest): void {
    if (!this.serverRequestHandler) {
      this.write({ id: message.id, error: { code: -32601, message: `No handler for ${message.method}` } });
      return;
    }
    this.serverRequestHandler(message)
      .then((result) => this.write({ id: message.id, result: result ?? {} }))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error);
        this.write({ id: message.id, error: { code: -32000, message: text } });
      });
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function resolveCodexCommand(command: string): { command: string; args: string[] } {
  if (fs.existsSync(command)) return { command, args: [] };
  return { command, args: [] };
}
```

- [ ] **Step 4: 运行 client 测试**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-client.test.ts
```

Expected: PASS.

## Task 3: 实现 Codex 到 ACP 的事件和审批映射

**Files:**
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.test.ts`

- [ ] **Step 1: 写失败测试：delta、tool item、approval**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  codexNotificationToAcpUpdates,
  codexApprovalRequestToAcpPermission,
  acpPermissionOutcomeToCodexDecision,
  codexTurnToStopReason,
} from "./codex-app-server-mapper";

describe("codex app-server mapper", () => {
  it("maps agent message deltas to ACP message chunks", () => {
    const updates = codexNotificationToAcpUpdates("outer-session", {
      method: "item/agentMessage/delta",
      params: { itemId: "item_1", delta: "hello" },
    });

    expect(updates).toEqual([{
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "hello" },
        _meta: { codex: { itemId: "item_1", method: "item/agentMessage/delta" } },
      },
    }]);
  });

  it("maps command execution items to ACP tool updates", () => {
    const started = codexNotificationToAcpUpdates("s1", {
      method: "item/started",
      params: {
        item: {
          id: "cmd_1",
          type: "commandExecution",
          command: ["pnpm", "test"],
          cwd: "/repo",
          status: "inProgress",
        },
      },
    });
    const completed = codexNotificationToAcpUpdates("s1", {
      method: "item/completed",
      params: {
        item: {
          id: "cmd_1",
          type: "commandExecution",
          command: ["pnpm", "test"],
          cwd: "/repo",
          status: "completed",
          aggregatedOutput: "ok",
          exitCode: 0,
        },
      },
    });

    expect(started[0]?.update).toMatchObject({
      sessionUpdate: "tool_call",
      toolCallId: "cmd_1",
      title: "commandExecution",
      rawInput: { command: ["pnpm", "test"], cwd: "/repo" },
    });
    expect(completed[0]?.update).toMatchObject({
      sessionUpdate: "tool_call_update",
      toolCallId: "cmd_1",
      title: "commandExecution",
      status: "completed",
    });
  });

  it("maps approval requests through ACP permission shape", () => {
    const permission = codexApprovalRequestToAcpPermission("outer", {
      id: 9,
      method: "item/commandExecution/requestApproval",
      params: {
        itemId: "cmd_1",
        threadId: "thr_1",
        turnId: "turn_1",
        command: ["git", "status"],
        cwd: "/repo",
        availableDecisions: ["accept", "acceptForSession", "decline", "cancel"],
      },
    });

    expect(permission).toMatchObject({
      sessionId: "outer",
      toolCall: {
        toolCallId: "cmd_1",
        title: "git status",
        rawInput: expect.objectContaining({ command: ["git", "status"] }),
      },
    });
    expect(permission.options.map((option) => option.optionId)).toEqual([
      "accept",
      "acceptForSession",
      "decline",
      "cancel",
    ]);
    expect(acpPermissionOutcomeToCodexDecision({ outcome: { outcome: "selected", optionId: "accept" } })).toEqual({ decision: "accept" });
  });

  it("maps completed turns to ACP stop reasons", () => {
    expect(codexTurnToStopReason({ id: "turn_1", status: "completed" })).toBe("end_turn");
    expect(codexTurnToStopReason({ id: "turn_1", status: "interrupted" })).toBe("cancelled");
    expect(codexTurnToStopReason({ id: "turn_1", status: "failed" })).toBeNull();
  });

  it("keeps unknown Codex items visible for debugging", () => {
    const updates = codexNotificationToAcpUpdates("s1", {
      method: "item/completed",
      params: { item: { id: "unknown_1", type: "newCodexThing", value: 123 } },
    });

    expect(updates[0]?.update).toMatchObject({
      sessionUpdate: "codex_item",
      content: { type: "text" },
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-mapper.test.ts
```

Expected: FAIL because mapper does not exist.

- [ ] **Step 3: 实现 mapper**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-mapper.ts` with:

```ts
import type { PromptResponse, RequestPermissionRequest, RequestPermissionResponse, SessionNotification } from "@agentclientprotocol/sdk";
import type { CodexNotification, CodexServerRequest, CodexTurn } from "./codex-app-server-protocol";
import { asRecord, readString } from "./codex-app-server-protocol";

export function codexNotificationToAcpUpdates(outerSessionId: string, notification: CodexNotification): SessionNotification[] {
  const params = asRecord(notification.params);
  switch (notification.method) {
    case "item/agentMessage/delta": {
      const text = readString(params.delta) ?? "";
      if (!text) return [];
      return [textUpdate(outerSessionId, "agent_message_chunk", text, notification)];
    }
    case "item/reasoning/summaryTextDelta":
    case "item/reasoning/textDelta": {
      const text = readString(params.delta) ?? "";
      if (!text) return [];
      return [textUpdate(outerSessionId, "agent_thought_chunk", text, notification)];
    }
    case "turn/plan/updated":
      return [planUpdate(outerSessionId, params, notification)];
    case "thread/tokenUsage/updated":
      return [{
        sessionId: outerSessionId,
        update: {
          sessionUpdate: "usage_update",
          usage: params,
          _meta: codexMeta(notification),
        } as never,
      }];
    case "item/started":
      return itemToToolUpdate(outerSessionId, params.item, "tool_call", notification);
    case "item/completed":
      return itemToToolUpdate(outerSessionId, params.item, "tool_call_update", notification);
    default:
      return [{
        sessionId: outerSessionId,
        update: {
          sessionUpdate: "codex_event",
          content: { type: "text", text: JSON.stringify({ method: notification.method, params }) },
          _meta: codexMeta(notification),
        } as never,
      }];
  }
}

export function codexApprovalRequestToAcpPermission(
  outerSessionId: string,
  request: CodexServerRequest
): RequestPermissionRequest {
  const params = asRecord(request.params);
  const command = Array.isArray(params.command) ? params.command.map(String) : [];
  const itemId = readString(params.itemId) ?? String(request.id);
  const available = Array.isArray(params.availableDecisions)
    ? params.availableDecisions.map(String)
    : ["accept", "decline", "cancel"];
  return {
    sessionId: outerSessionId,
    toolCall: {
      toolCallId: itemId,
      title: command.length > 0 ? command.join(" ") : request.method,
      kind: request.method.includes("fileChange") ? "edit" : "execute",
      rawInput: params,
    } as never,
    options: available.map((decision) => ({
      optionId: decision,
      kind: decisionToKind(decision),
      name: decision,
    })),
  };
}

export function acpPermissionOutcomeToCodexDecision(response: RequestPermissionResponse): Record<string, unknown> {
  const outcome = response.outcome;
  if (outcome.outcome !== "selected") return { decision: "cancel" };
  return { decision: outcome.optionId };
}

export function codexTurnToStopReason(turn: CodexTurn): PromptResponse["stopReason"] | null {
  if (turn.status === "interrupted") return "cancelled";
  if (turn.status === "failed") return null;
  return "end_turn";
}

function textUpdate(
  sessionId: string,
  sessionUpdate: "agent_message_chunk" | "agent_thought_chunk",
  text: string,
  source: CodexNotification
): SessionNotification {
  return {
    sessionId,
    update: {
      sessionUpdate,
      content: { type: "text", text },
      _meta: codexMeta(source),
    } as never,
  };
}

function planUpdate(sessionId: string, params: Record<string, unknown>, source: CodexNotification): SessionNotification {
  const plan = Array.isArray(params.plan) ? params.plan : [];
  return {
    sessionId,
    update: {
      sessionUpdate: "plan",
      entries: plan.map((entry, index) => {
        const record = asRecord(entry);
        return {
          id: readString(record.id) ?? `step-${index + 1}`,
          content: readString(record.step) ?? readString(record.description) ?? "",
          status: readString(record.status) ?? "pending",
        };
      }),
      _meta: codexMeta(source),
    } as never,
  };
}

function itemToToolUpdate(
  sessionId: string,
  itemValue: unknown,
  sessionUpdate: "tool_call" | "tool_call_update",
  source: CodexNotification
): SessionNotification[] {
  const item = asRecord(itemValue);
  const id = readString(item.id);
  const type = readString(item.type);
  if (!id || !type) return [unknownItemUpdate(sessionId, item, source)];
  if (!["commandExecution", "fileChange", "mcpToolCall", "dynamicToolCall", "webSearch"].includes(type)) {
    return [unknownItemUpdate(sessionId, item, source)];
  }
  return [{
    sessionId,
    update: {
      sessionUpdate,
      toolCallId: id,
      title: type,
      status: readString(item.status),
      rawInput: toolInput(item),
      content: toolOutput(item),
      _meta: { ...codexMeta(source).codex, item },
    } as never,
  }];
}

function toolInput(item: Record<string, unknown>): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const key of ["command", "cwd", "changes", "server", "tool", "arguments", "query", "action"]) {
    if (item[key] !== undefined) input[key] = item[key];
  }
  return input;
}

function toolOutput(item: Record<string, unknown>): Array<{ type: "content"; content: { type: "text"; text: string } }> | undefined {
  const output = item.aggregatedOutput ?? item.result ?? item.error;
  if (output === undefined) return undefined;
  return [{
    type: "content",
    content: { type: "text", text: typeof output === "string" ? output : JSON.stringify(output) },
  }];
}

function unknownItemUpdate(sessionId: string, item: Record<string, unknown>, source: CodexNotification): SessionNotification {
  return {
    sessionId,
    update: {
      sessionUpdate: "codex_item",
      content: { type: "text", text: JSON.stringify(item) },
      _meta: { ...codexMeta(source).codex, item },
    } as never,
  };
}

function decisionToKind(decision: string): string {
  if (decision === "acceptForSession") return "allow_always";
  if (decision === "accept") return "allow_once";
  if (decision === "decline") return "reject_once";
  return "cancel";
}

function codexMeta(source: CodexNotification): { codex: Record<string, unknown> } {
  const params = asRecord(source.params);
  return {
    codex: {
      method: source.method,
      itemId: params.itemId,
      turnId: params.turnId,
      threadId: params.threadId,
    },
  };
}
```

- [ ] **Step 4: 运行 mapper 测试**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-mapper.test.ts
```

Expected: PASS.

## Task 4: 实现 Codex backend session 并接入 executor routing

**Files:**
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/backend-adapter.ts`
- Create: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.test.ts`

- [ ] **Step 1: 写失败测试：thread/start、turn/start、interrupt**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.test.ts` with:

```ts
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { CodexAppServerBackendAdapter } from "./codex-app-server-backend";
import type { CodexAppServerProcess } from "./codex-app-server-client";
import type { AcpConnection } from "../types";

function createProcess(): CodexAppServerProcess & { stdin: PassThrough; stdout: PassThrough; writes: unknown[] } {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const writes: unknown[] = [];
  stdin.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) writes.push(JSON.parse(line));
    }
  });
  return {
    stdin,
    stdout,
    writes,
    stderrText: "",
    command: "codex",
    args: ["app-server"],
    cwd: "/repo",
    close: vi.fn(),
  };
}

function createConnection(): AcpConnection {
  return {
    async sessionUpdate() {},
    async requestPermission() {
      return { outcome: { outcome: "selected", optionId: "accept" } };
    },
    async requestClient() {
      return {};
    },
    async notifyClient() {},
  };
}

describe("CodexAppServerBackendAdapter", () => {
  it("initializes app-server and starts a Codex thread", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({
      processFactory: () => proc,
    });
    const start = adapter.start({
      outerSessionId: "outer",
      cwd: "/repo",
      request: { cwd: "/repo" },
      connection: createConnection(),
      agentConfig: { model: "gpt-test" },
    });

    await waitForWrites(proc, 1);
    proc.stdout.write(JSON.stringify({ id: 1, result: { userAgent: "codex-test" } }) + "\n");
    await waitForWrites(proc, 3);
    proc.stdout.write(JSON.stringify({ id: 2, result: { thread: { id: "thr_1", sessionId: "thr_1" } } }) + "\n");

    const session = await start;
    expect(session.backendSessionId).toBe("thr_1");
    expect(proc.writes.map((message) => (message as { method?: string }).method)).toEqual([
      "initialize",
      "initialized",
      "thread/start",
    ]);
    expect(proc.writes[2]).toMatchObject({
      method: "thread/start",
      params: { cwd: "/repo", model: "gpt-test", serviceName: "viben" },
    });
  });

  it("starts a turn and resolves when turn completes", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({ processFactory: () => proc });
    const sessionPromise = adapter.start({
      outerSessionId: "outer",
      cwd: "/repo",
      request: { cwd: "/repo" },
      connection: createConnection(),
      agentConfig: {},
    });
    await waitForWrites(proc, 1);
    proc.stdout.write(JSON.stringify({ id: 1, result: {} }) + "\n");
    await waitForWrites(proc, 3);
    proc.stdout.write(JSON.stringify({ id: 2, result: { thread: { id: "thr_1" } } }) + "\n");
    const session = await sessionPromise;

    const prompt = session.prompt({ sessionId: "thr_1", prompt: [{ type: "text", text: "hello" }] });
    await waitForWrites(proc, 4);
    proc.stdout.write(JSON.stringify({ id: 3, result: { turn: { id: "turn_1", status: "inProgress" } } }) + "\n");
    proc.stdout.write(JSON.stringify({ method: "turn/completed", params: { threadId: "thr_1", turn: { id: "turn_1", status: "completed" } } }) + "\n");

    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
  });

  it("rejects failed turns so AcpSessionManager can use the error path", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({ processFactory: () => proc });
    const sessionPromise = adapter.start({
      outerSessionId: "outer",
      cwd: "/repo",
      request: { cwd: "/repo" },
      connection: createConnection(),
      agentConfig: {},
    });
    await waitForWrites(proc, 1);
    proc.stdout.write(JSON.stringify({ id: 1, result: {} }) + "\n");
    await waitForWrites(proc, 3);
    proc.stdout.write(JSON.stringify({ id: 2, result: { thread: { id: "thr_1" } } }) + "\n");
    const session = await sessionPromise;

    const prompt = session.prompt({ sessionId: "thr_1", prompt: [{ type: "text", text: "hello" }] });
    await waitForWrites(proc, 4);
    proc.stdout.write(JSON.stringify({ id: 3, result: { turn: { id: "turn_1", status: "inProgress" } } }) + "\n");
    proc.stdout.write(JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr_1", turn: { id: "turn_1", status: "failed", error: { message: "boom" } } },
    }) + "\n");

    await expect(prompt).rejects.toThrow("boom");
  });

  it("times out initialization", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({ processFactory: () => proc });

    const start = adapter.start({
      outerSessionId: "outer",
      cwd: "/repo",
      request: { cwd: "/repo" },
      connection: createConnection(),
      agentConfig: { executor_config: { init_timeout_ms: 5 } },
    });
    await waitForWrites(proc, 1);
    await expect(start).rejects.toThrow("timed out");
  });
});

async function waitForWrites(proc: { writes: unknown[] }, count: number): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (proc.writes.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Expected ${count} writes, got ${proc.writes.length}`);
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-backend.test.ts
```

Expected: FAIL because backend implementation does not exist.

- [ ] **Step 3: 实现 backend session**

Create `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.ts` with:

```ts
import type { PromptRequest, PromptResponse } from "@agentclientprotocol/sdk";
import type { AcpBackendAdapter, AcpBackendSession, AcpBackendStartContext } from "./backend-adapter";
import { addCodexProcessDiagnostics, CodexAppServerJsonRpcClient, type CodexAppServerProcess } from "./codex-app-server-client";
import { codexNotificationToAcpUpdates, codexTurnToStopReason, codexApprovalRequestToAcpPermission, acpPermissionOutcomeToCodexDecision } from "./codex-app-server-mapper";
import { asRecord, expectThreadResult, expectTurnResult, readString, type CodexInputItem, type CodexNotification, type CodexServerRequest, type CodexTurn } from "./codex-app-server-protocol";
import { AcpPromptError, createAcpErrorDetail } from "./errors";

interface CodexAdapterOptions {
  processFactory?: (command: string, args: string[], cwd: string, env: Record<string, string | undefined>) => CodexAppServerProcess;
}

interface PendingTurn {
  turnId?: string;
  resolve: (response: PromptResponse) => void;
  reject: (error: Error) => void;
}

export class CodexAppServerBackendAdapter implements AcpBackendAdapter {
  readonly id = "codex-app-server";

  constructor(private readonly options: CodexAdapterOptions = {}) {}

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    const config = asRecord(context.agentConfig?.executor_config);
    const command = readString(config.command) ?? "codex";
    const args = Array.isArray(config.args) ? config.args.map(String) : ["app-server"];
    const processFactory = this.options.processFactory ?? CodexAppServerJsonRpcClient.spawn;
    const processHandle = processFactory(command, args, context.cwd, envRecord(config.env));
    const client = new CodexAppServerJsonRpcClient(processHandle);
    const session = new CodexAppServerBackendSession(client, context, processHandle, initTimeoutMs(config));
    try {
      await session.initialize();
      return session;
    } catch (error) {
      client.close();
      throw addCodexProcessDiagnostics(error, processHandle);
    }
  }
}

class CodexAppServerBackendSession implements AcpBackendSession {
  readonly agentCapabilities = {
    loadSession: true,
    sessionCapabilities: { list: {} },
  };
  readonly configOptions = undefined;
  backendSessionId = "";
  private pendingTurn: PendingTurn | undefined;
  private activeTurnId: string | undefined;

  constructor(
    private readonly client: CodexAppServerJsonRpcClient,
    private readonly context: AcpBackendStartContext,
    private readonly processHandle: CodexAppServerProcess,
    private readonly initTimeoutMs: number
  ) {
    client.onNotification((notification) => this.handleNotification(notification));
    client.onServerRequest((request) => this.handleServerRequest(request));
  }

  async initialize(): Promise<void> {
    await withTimeout(this.client.request("initialize", {
      clientInfo: {
        name: "viben",
        title: "Viben",
        version: "1.0.0",
      },
      capabilities: {
        experimentalApi: true,
      },
    }), this.initTimeoutMs, "Codex app-server initialize");
    this.client.notify("initialized", {});
    const isLoad = "sessionId" in this.context.request && typeof this.context.request.sessionId === "string";
    const result = await withTimeout(
      this.client.request(isLoad ? "thread/resume" : "thread/start", this.threadParams(isLoad)),
      this.initTimeoutMs,
      isLoad ? "Codex app-server thread/resume" : "Codex app-server thread/start"
    );
    const thread = expectThreadResult(result).thread;
    this.backendSessionId = thread.id;
  }

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    if (this.pendingTurn) {
      throw new Error("Codex app-server backend already has an active turn");
    }
    const result = await this.client.request("turn/start", {
      threadId: this.backendSessionId,
      input: promptToCodexInput(request.prompt),
      cwd: this.context.cwd,
    });
    const turn = expectTurnResult(result).turn;
    this.activeTurnId = turn.id;
    return await new Promise<PromptResponse>((resolve, reject) => {
      this.pendingTurn = { turnId: turn.id, resolve, reject };
    });
  }

  async cancel(): Promise<void> {
    const turnId = this.activeTurnId;
    if (!turnId) return;
    await this.client.request("turn/interrupt", {
      threadId: this.backendSessionId,
      turnId,
    });
  }

  async close(): Promise<void> {
    try {
      if (this.backendSessionId) {
        await this.client.request("thread/unsubscribe", { threadId: this.backendSessionId });
      }
    } catch {
      // Closing should not fail the caller.
    } finally {
      this.client.close();
    }
  }

  private threadParams(isLoad: boolean): Record<string, unknown> {
    if (isLoad) {
      return {
        threadId: (this.context.request as { sessionId: string }).sessionId,
        ...this.configParams(),
      };
    }
    return this.configParams();
  }

  private configParams(): Record<string, unknown> {
    const params: Record<string, unknown> = {
      cwd: this.context.cwd,
      serviceName: "viben",
    };
    if (this.context.agentConfig?.model) params.model = this.context.agentConfig.model;
    return params;
  }

  private async handleNotification(notification: CodexNotification): Promise<void> {
    for (const update of codexNotificationToAcpUpdates(this.context.outerSessionId, notification)) {
      await this.context.connection.sessionUpdate(update as never);
      await this.context.onSessionUpdate?.(update as never);
    }
    if (notification.method !== "turn/completed") return;
    const params = asRecord(notification.params);
    const turn = asRecord(params.turn) as CodexTurn;
    const id = readString(turn.id);
    if (!this.pendingTurn || (id && this.pendingTurn.turnId && id !== this.pendingTurn.turnId)) return;
    const pending = this.pendingTurn;
    this.pendingTurn = undefined;
    this.activeTurnId = undefined;
    const stopReason = codexTurnToStopReason(turn);
    if (stopReason) {
      pending.resolve({ stopReason });
      return;
    }
    const error = asRecord(turn.error);
    pending.reject(new AcpPromptError(createAcpErrorDetail(
      readString(error.message) ?? "Codex turn failed",
      { codexTurn: turn }
    )));
  }

  private async handleServerRequest(request: CodexServerRequest): Promise<unknown> {
    if (request.method === "item/commandExecution/requestApproval" || request.method === "item/fileChange/requestApproval") {
      const permission = codexApprovalRequestToAcpPermission(this.context.outerSessionId, request);
      const response = await this.context.connection.requestPermission(permission);
      return acpPermissionOutcomeToCodexDecision(response);
    }
    throw new Error(`Unsupported Codex app-server request: ${request.method}`);
  }
}

function promptToCodexInput(prompt: PromptRequest["prompt"]): CodexInputItem[] {
  return prompt.flatMap((block): CodexInputItem[] => {
    if (block.type === "text") return [{ type: "text", text: block.text }];
    const record = block as unknown as Record<string, unknown>;
    if (typeof record.url === "string") return [{ type: "image", url: record.url }];
    if (typeof record.path === "string") return [{ type: "localImage", path: record.path }];
    return [{ type: "text", text: JSON.stringify(block) }];
  });
}

function envRecord(value: unknown): Record<string, string | undefined> {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, typeof item === "string" ? item : String(item)]));
}

function initTimeoutMs(config: Record<string, unknown>): number {
  const value = config.init_timeout_ms ?? config.initTimeoutMs;
  return typeof value === "number" && Number.isFinite(value) ? value : 120_000;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
```

- [ ] **Step 4: 修改 routing**

Modify `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/backend-adapter.ts`:

```ts
import { CodexAppServerBackendAdapter } from "./codex-app-server-backend";
```

Change builtin templates near `CODEX`:

```ts
  CODEX: {
    id: "codex",
    registryId: "codex-app-server",
    command: "codex",
    args: ["app-server"],
  },
  CODEX_APP_SERVER: {
    id: "codex",
    registryId: "codex-app-server",
    command: "codex",
    args: ["app-server"],
  },
  CODEX_ACP: {
    id: "codex",
    registryId: "codex-acp",
    command: "codex-acp",
    args: [],
  },
```

Change `SubprocessAcpBackendAdapter.start` at its beginning:

```ts
    const backend = await resolveBackendDefinition(context);
    if (backend.registryId === "codex-app-server") {
      return await new CodexAppServerBackendAdapter().start(context);
    }
```

Important: do not rewrite `context.agentConfig.executor_config` in routing. `CodexAppServerBackendAdapter.start()` must call the same `resolveBackendDefinition(context)` helper, or accept a resolved definition argument, so user override semantics stay identical to existing backends:

```ts
const backend = await resolveBackendDefinition(context);
const command = backend.command;
const args = backend.args;
const env = backend.env;
const timeoutMs = backend.initTimeoutMs;
```

- [ ] **Step 5: 运行 backend 测试**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-backend.test.ts
```

Expected: PASS.

## Task 5: 补齐错误处理、docs 和回归测试

**Files:**
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-backend.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/agent-acp.integration.test.ts`
- Modify: `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/examples/acp-client/README.md`

- [ ] **Step 1: client error diagnostics**

In `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/acp/ops/codex-app-server-client.ts`, add:

```ts
export function addCodexProcessDiagnostics(error: unknown, processHandle: CodexAppServerProcess): Error {
  const base = error instanceof Error ? error : new Error(String(error));
  const diagnostic = base as Error & Record<string, unknown>;
  diagnostic.stderr = diagnostic.stderr ?? processHandle.stderrText;
  diagnostic.command = diagnostic.command ?? processHandle.command;
  diagnostic.args = diagnostic.args ?? processHandle.args;
  diagnostic.cwd = diagnostic.cwd ?? processHandle.cwd;
  diagnostic.hint = diagnostic.hint ?? "Install Codex CLI and ensure `codex app-server` works for the Gateway process.";
  return base;
}
```

Use this in backend `initialize()`, `prompt()`, `cancel()`, and `close()` catches before throwing.

- [ ] **Step 2: Gateway ACP integration test for external protocol compatibility**

Modify `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/src/gateway/routes/agent-acp.integration.test.ts` to add a test that injects the Codex backend adapter through `acpSessionManager` or a test-only adapter setter. The test must connect over real WebSocket and assert the client-visible ACP shapes:

```ts
it("keeps ACP WebSocket permission shape when Codex app-server requests approval", async () => {
  const client = await connectAcpClient(port);
  try {
    await client.request("initialize", {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo: { name: "test", version: "0.0.0" },
    });
    const newSession = await client.request("session/new", {
      cwd: "/tmp",
      mcpServers: [],
      agent_config: { executor_type: "CODEX" },
    });
    const sessionId = String(newSession.sessionId);

    const permission = client.waitForRequest("session/request_permission");
    const prompt = client.request("session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: "run command" }],
    });

    const frame = await permission;
    expect(frame.params).toMatchObject({
      sessionId,
      toolCall: {
        toolCallId: "cmd_1",
        title: "git status",
        rawInput: expect.objectContaining({ command: ["git", "status"] }),
      },
    });
    client.respond(frame.id, { outcome: { outcome: "selected", optionId: "accept" } });
    await expect(prompt).resolves.toMatchObject({ stopReason: "end_turn" });
  } finally {
    client.close();
  }
});
```

If the current helper returned by `connectAcpClient()` only supports request/notification, extend it with:

```ts
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

waitForRequest(method: string): Promise<JsonRpcRequest>;
respond(id: string | number | null, result: Record<string, unknown>): void;
```

Expected: this test catches any regression where `toolCall.toolCallId`, `toolCall.title`, or `toolCall.rawInput` are missing on the externally visible ACP request.

- [ ] **Step 3: README update**

Modify `/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben/packages/core/examples/acp-client/README.md` backend list:

```md
- `CODEX` -> Viben starts `codex app-server` and adapts the Codex app-server protocol
- `CODEX_ACP` -> legacy `codex-acp` adapter
```

Modify Executor Config example:

```json
{
  "command": "/absolute/path/to/codex",
  "args": ["app-server"],
  "init_timeout_ms": 120000
}
```

- [ ] **Step 4: targeted test run**

Run:

```bash
pnpm --filter @viben/core exec vitest run src/acp/ops/codex-app-server-client.test.ts src/acp/ops/codex-app-server-mapper.test.ts src/acp/ops/codex-app-server-backend.test.ts src/acp/ops/session-manager.test.ts src/gateway/routes/agent-acp.integration.test.ts
```

Expected: PASS.

- [ ] **Step 5: typecheck**

Run:

```bash
pnpm --filter @viben/core typecheck
```

Expected: PASS. If this fails due unrelated pre-existing workspace state, capture the exact errors and run narrower `tsc` diagnostics until no new Codex files are implicated.

- [ ] **Step 6: full workspace verification**

Run:

```bash
pnpm typecheck
```

Expected: PASS or documented unrelated failures. Do not fix unrelated files unless they block the Codex adapter build.

## Self-Review

- Spec coverage:
  - Viben 自己启动 `codex app-server`: Task 4.
  - 对外 ACP 不变: Task 4 keeps `AcpBackendAdapter`.
  - thread/turn/item/approval 映射: Tasks 3 and 4.
  - 旧 `CODEX_ACP` 回退: Task 4 routing.
  - 测试和 typecheck: Task 5.
- Placeholder scan: no `TBD` or undefined future work remains in task steps.
- Type consistency:
  - `CodexAppServerJsonRpcClient`, `CodexAppServerBackendAdapter`, mapper function names are defined before use.
  - Imports use explicit static imports and `import type`, matching repo rules.
  - Review feedback applied: ACP permission data lives under `toolCall`, failed Codex turns reject instead of returning non-ACP `stopReason: "error"`, unknown Codex items remain visible, tool output uses ACP `ToolCallContent`, initialization has timeout coverage, and Gateway ACP integration coverage is included.
