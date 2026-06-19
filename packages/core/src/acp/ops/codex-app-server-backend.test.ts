import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { CodexAppServerBackendAdapter } from "./codex-app-server-backend";
import type { CodexAppServerProcess } from "./codex-app-server-client";
import type { AcpConnection, AcpSessionNotification } from "../types";

function createProcess(): CodexAppServerProcess & {
  stdin: PassThrough;
  stdout: PassThrough;
  writes: Array<Record<string, unknown>>;
} {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const writes: Array<Record<string, unknown>> = [];
  stdin.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) writes.push(JSON.parse(line) as Record<string, unknown>);
    }
  });
  return {
    stdin,
    stdout,
    writes,
    stderrText: "",
    command: "codex",
    args: ["app-server"],
    cwd: "/tmp/project",
    close: vi.fn(),
  };
}

function createConnection(): AcpConnection & { updates: AcpSessionNotification[] } {
  const updates: AcpSessionNotification[] = [];
  return {
    updates,
    async sessionUpdate(notification) {
      updates.push(notification);
    },
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
      spawnProcess: () => proc,
    });

    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection: createConnection(),
      agentConfig: {
        executor_type: "CODEX",
        model: "gpt-5.4",
        executor_config: {
          command: "fake-codex",
          args: ["app-server"],
          init_timeout_ms: 5000,
        },
      },
    });

    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {
      userAgent: "codex-test",
      platformFamily: "macos",
      platformOs: "darwin",
    });
    await waitForWrite(proc, "thread/start");
    expect(proc.writes.find((message) => message.method === "initialized")).toEqual({
      method: "initialized",
      params: {},
    });
    expect(proc.writes.find((message) => message.method === "thread/start")).toMatchObject({
      method: "thread/start",
      params: {
        model: "gpt-5.4",
        cwd: "/tmp/project",
        serviceName: "viben",
      },
    });
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });

    const session = await sessionPromise;
    expect(session.backendSessionId).toBe("thr-1");
  });

  it("starts a turn, forwards stream updates, and resolves when the turn completes", async () => {
    const proc = createProcess();
    const connection = createConnection();
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: () => proc,
    });
    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection,
      agentConfig: { executor_type: "CODEX" },
    });
    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });
    const session = await sessionPromise;

    const prompt = session.prompt({
      sessionId: "thr-1",
      prompt: [{ type: "text", text: "hello" }],
    });
    await waitForWrite(proc, "turn/start");
    expect(proc.writes.find((message) => message.method === "turn/start")).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thr-1",
        input: [{ type: "text", text: "hello" }],
      },
    });
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });
    proc.stdout.write(`${JSON.stringify({
      method: "item/agentMessage/delta",
      params: { itemId: "msg-1", delta: "hello" },
    })}\n`);
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr-1", turn: { id: "turn-1", status: "completed" } },
    })}\n`);

    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
    expect(connection.updates).toContainEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "msg-1",
        content: { type: "text", text: "hello" },
      },
    });
  });

  it("uses the existing error path for failed Codex turns", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: () => proc,
    });
    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection: createConnection(),
      agentConfig: { executor_type: "CODEX" },
    });
    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });
    const session = await sessionPromise;

    const prompt = session.prompt({
      sessionId: "thr-1",
      prompt: [{ type: "text", text: "hello" }],
    });
    await waitForWrite(proc, "turn/start");
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: {
        threadId: "thr-1",
        turn: {
          id: "turn-1",
          status: "failed",
          error: { message: "boom" },
        },
      },
    })}\n`);

    await expect(prompt).rejects.toThrow("boom");
  });

  it("interrupts a turn that is cancelled before turn/start returns", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: () => proc,
    });
    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection: createConnection(),
      agentConfig: { executor_type: "CODEX" },
    });
    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });
    const session = await sessionPromise;

    const prompt = session.prompt({
      sessionId: "thr-1",
      prompt: [{ type: "text", text: "hello" }],
    });
    await waitForWrite(proc, "turn/start");
    const cancel = session.cancel();
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });

    await waitForWrite(proc, "turn/interrupt");
    expect(proc.writes.find((message) => message.method === "turn/interrupt")).toMatchObject({
      method: "turn/interrupt",
      params: {
        threadId: "thr-1",
        turnId: "turn-1",
      },
    });
    respondTo(proc, "turn/interrupt", {});
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr-1", turn: { id: "turn-1", status: "interrupted" } },
    })}\n`);

    await expect(cancel).resolves.toBeUndefined();
    await expect(prompt).resolves.toEqual({ stopReason: "cancelled" });
  });
});

async function waitForWrite(proc: { writes: Array<Record<string, unknown>> }, method: string): Promise<void> {
  await expect.poll(() => proc.writes.some((message) => message.method === method)).toBe(true);
}

function respondTo(
  proc: { writes: Array<Record<string, unknown>>; stdout: PassThrough },
  method: string,
  result: unknown
): void {
  const request = proc.writes.find((message) => message.method === method && typeof message.id !== "undefined");
  if (!request) throw new Error(`No request found for ${method}`);
  proc.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
}
