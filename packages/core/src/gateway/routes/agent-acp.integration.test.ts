import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { closeAllAcpSessions, registerAgentAcpRoutes } from "./agent-acp";
import { acpSessionManager } from "../../acp";

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: Record<string, unknown>;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

describe("Agent ACP WebSocket route", () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(async () => {
    server = Fastify();
    await server.register(fastifyWebsocket);
    registerAgentAcpRoutes(server);
    await server.listen({ port: 0, host: "127.0.0.1" });
    const address = server.server.address();
    port = typeof address === "object" && address ? address.port : 0;
  }, 30000);

  afterAll(async () => {
    closeAllAcpSessions();
    await server.close();
  });

  it("handles JSON-RPC envelopes for initialize, session/new, steer view, cancel, and not found errors", async () => {
    const client = await connectAcpClient(port);
    try {
      const initialize = await client.request("initialize", {
        protocolVersion: 1,
        clientCapabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      });
      expect(initialize).toMatchObject({
        protocolVersion: 1,
        agentInfo: {
          name: "viben",
        },
      });

      const newSession = await client.request("session/new", {
        cwd: "/tmp",
        mcpServers: [],
        agent_config: { name: "agent-alpha" },
      });
      expect(newSession.sessionId).toEqual(expect.any(String));
      const sessionId = String(newSession.sessionId);

      const queued = await client.request("session/prompt/steer", {
        sessionId,
        agent_id: "agent-alpha",
        user_id: "user-1",
        prompt: [{ type: "text", text: "queued steer" }],
      });
      expect(queued).toMatchObject({
        sessionId,
        agentId: "agent-alpha",
        userId: "user-1",
        status: "queued",
      });

      const listed = await client.request("session/prompt/view", {
        sessionId,
        status: "queued",
      });
      expect(listed.prompts).toEqual([
        expect.objectContaining({
          promptId: queued.promptId,
          status: "queued",
        }),
      ]);

      await expect(client.request("session/prompt/view", {
        sessionId,
        promptId: "missing-prompt",
      })).rejects.toMatchObject({
        code: -32002,
      });

      const cancelled = await client.request("session/prompt/cancel", {
        sessionId,
        promptId: queued.promptId,
      });
      expect(cancelled).toMatchObject({
        promptId: queued.promptId,
        cancelled: true,
        status: "cancelled",
      });
    } finally {
      client.close();
    }
  }, 15000);

  it("sends a real JSON-RPC session/prompt/consumed notification envelope", async () => {
    const client = await connectAcpClient(port);
    try {
      const newSession = await client.request("session/new", {
        cwd: "/tmp",
        mcpServers: [],
        agent_config: { name: "agent-alpha" },
      });
      const sessionId = String(newSession.sessionId);
      const queued = await client.request("session/prompt/steer", {
        sessionId,
        agent_id: "agent-alpha",
        user_id: "user-1",
        prompt: [{ type: "text", text: "consume notification" }],
      });

      const consumedNotification = client.waitForNotification("session/prompt/consumed");
      await acpSessionManager.consumeQueuedSteerPrompts(sessionId);

      await expect(consumedNotification).resolves.toMatchObject({
        jsonrpc: "2.0",
        method: "session/prompt/consumed",
        params: {
          sessionId,
          promptId: queued.promptId,
          status: "consumed",
          consumedAt: expect.any(String),
        },
      });
    } finally {
      client.close();
    }
  }, 15000);

  it("keeps the Gateway ACP protocol stable while using the Codex app-server backend", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-codex-app-server-test-"));
    const fakeServerPath = path.join(tempDir, "fake-codex-app-server.mjs");
    await writeFile(fakeServerPath, fakeCodexAppServerScript(), "utf-8");

    const client = await connectAcpClient(port);
    try {
      const newSession = await client.request("session/new", {
        cwd: tempDir,
        mcpServers: [],
        agent_config: {
          name: "codex-agent",
          executor_type: "CODEX",
          model: "gpt-5.4",
          executor_config: {
            command: process.execPath,
            args: [fakeServerPath],
            init_timeout_ms: 5000,
          },
        },
      });
      const sessionId = String(newSession.sessionId);

      const streamed = client.waitForNotification("session/update");
      const response = await client.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: "hello codex" }],
      });

      expect(response).toEqual({ stopReason: "end_turn" });
      await expect(streamed).resolves.toMatchObject({
        jsonrpc: "2.0",
        method: "session/update",
        params: {
          sessionId,
          _meta: {
            executor_type: "CODEX",
          },
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "codex says hello codex" },
          },
        },
      });
    } finally {
      client.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("parks on WebSocket disconnect, reloads history over a new WebSocket, and continues prompting", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-reconnect-smoke-"));
    const fakeServerPath = path.join(tempDir, "fake-codex-app-server.mjs");
    await writeFile(fakeServerPath, fakeCodexAppServerScript(), "utf-8");

    const clientA = await connectAcpClient(port);
    let sessionId = "";
    try {
      const newSession = await clientA.request("session/new", {
        cwd: tempDir,
        mcpServers: [],
        agent_config: {
          name: "codex-reconnect-agent",
          executor_type: "CODEX",
          executor_config: {
            command: process.execPath,
            args: [fakeServerPath],
            init_timeout_ms: 5000,
          },
        },
      });
      sessionId = String(newSession.sessionId);

      const firstUpdate = clientA.waitForNotification("session/update");
      const firstPrompt = await clientA.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: "first reconnect smoke" }],
      });
      expect(firstPrompt).toEqual({ stopReason: "end_turn" });
      await expect(firstUpdate).resolves.toMatchObject({
        params: {
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "codex says first reconnect smoke" },
          },
        },
      });
    } finally {
      clientA.close();
    }

    const clientB = await connectAcpClient(port);
    try {
      await expect.poll(async () => {
        const listed = await clientB.request("session/list", {});
        const sessions = listed.sessions as Array<Record<string, unknown>>;
        return sessions.find((session) => session.sessionId === sessionId)?.status;
      }).toBe("parked");

      const loaded = await clientB.request("session/load", {
        sessionId,
        cwd: tempDir,
        mcpServers: [],
        agent_config: { executor_type: "CODEX" },
      });
      expect(loaded).toMatchObject({
        sessionId,
        history: [
          expect.objectContaining({
            type: "session_update",
            data: expect.objectContaining({
              update: expect.objectContaining({
                content: { type: "text", text: "codex says first reconnect smoke" },
              }),
            }),
          }),
        ],
      });

      const secondUpdate = clientB.waitForNotification("session/update");
      const secondPrompt = await clientB.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: "second reconnect smoke" }],
      });
      expect(secondPrompt).toEqual({ stopReason: "end_turn" });
      await expect(secondUpdate).resolves.toMatchObject({
        params: {
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "codex says second reconnect smoke" },
          },
        },
      });
    } finally {
      clientB.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);

  it("does not let an old WebSocket close park a session already adopted by a new WebSocket", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-adopt-smoke-"));
    const fakeServerPath = path.join(tempDir, "fake-codex-app-server.mjs");
    await writeFile(fakeServerPath, fakeCodexAppServerScript(), "utf-8");

    const clientA = await connectAcpClient(port);
    const clientB = await connectAcpClient(port);
    try {
      const newSession = await clientA.request("session/new", {
        cwd: tempDir,
        mcpServers: [],
        agent_config: {
          name: "codex-adopt-agent",
          executor_type: "CODEX",
          executor_config: {
            command: process.execPath,
            args: [fakeServerPath],
            init_timeout_ms: 5000,
          },
        },
      });
      const sessionId = String(newSession.sessionId);

      await clientB.request("session/load", {
        sessionId,
        cwd: tempDir,
        mcpServers: [],
        agent_config: { executor_type: "CODEX" },
      });
      clientA.close();

      await expect.poll(async () => {
        const listed = await clientB.request("session/list", {});
        const sessions = listed.sessions as Array<Record<string, unknown>>;
        return sessions.find((session) => session.sessionId === sessionId)?.status;
      }).toBe("active");

      const update = clientB.waitForNotification("session/update");
      const response = await clientB.request("session/prompt", {
        sessionId,
        prompt: [{ type: "text", text: "adopted session still active" }],
      });
      expect(response).toEqual({ stopReason: "end_turn" });
      await expect(update).resolves.toMatchObject({
        params: {
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "codex says adopted session still active" },
          },
        },
      });
    } finally {
      clientA.close();
      clientB.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  }, 15000);
});

async function connectAcpClient(port: number): Promise<{
  request(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  waitForNotification(method: string): Promise<JsonRpcNotification>;
  close(): void;
}> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/agent/acp`, "acp.v1");
  await new Promise<void>((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  let nextId = 1;
  const waiters = new Map<number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();
  const notificationWaiters = new Map<string, Array<(notification: JsonRpcNotification) => void>>();

  ws.on("message", (data) => {
    for (const line of data.toString().split("\n")) {
      if (!line.trim()) continue;
      const response = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;
      if (!("id" in response) && "method" in response) {
        const waitersForMethod = notificationWaiters.get(response.method) ?? [];
        const waiter = waitersForMethod.shift();
        if (waitersForMethod.length === 0) notificationWaiters.delete(response.method);
        if (waiter) waiter(response);
        continue;
      }
      if (!("id" in response) || typeof response.id !== "number") continue;
      const waiter = waiters.get(response.id);
      if (!waiter) continue;
      waiters.delete(response.id);
      waiter.resolve(response);
    }
  });

  return {
    async request(method: string, params: Record<string, unknown> = {}) {
      const id = nextId++;
      const response = await new Promise<JsonRpcResponse>((resolve, reject) => {
        const timer = setTimeout(() => {
          waiters.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }, 5000);
        waiters.set(id, {
          resolve: (result) => {
            clearTimeout(timer);
            resolve(result);
          },
          reject,
        });
        ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
      });
      if ("error" in response) {
        return Promise.reject(response.error);
      }
      return response.result;
    },
    async waitForNotification(method: string) {
      return await new Promise<JsonRpcNotification>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timed out waiting for notification ${method}`));
        }, 5000);
        const waitersForMethod = notificationWaiters.get(method) ?? [];
        waitersForMethod.push((notification) => {
          clearTimeout(timer);
          resolve(notification);
        });
        notificationWaiters.set(method, waitersForMethod);
      });
    },
    close() {
      ws.close();
    },
  };
}

function fakeCodexAppServerScript(): string {
  const defaultThreadId = `thr_fake_${randomUUID()}`;
  return `
import readline from "node:readline";

let threadId = ${JSON.stringify(defaultThreadId)};
let turnIndex = 0;
const rl = readline.createInterface({ input: process.stdin });

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\\n");
}

function inputText(input) {
  if (!Array.isArray(input)) return "";
  return input
    .map((item) => item && item.type === "text" ? item.text : "")
    .filter(Boolean)
    .join(" ");
}

rl.on("line", (line) => {
  if (!line.trim()) return;
  const message = JSON.parse(line);
  if (message.method === "initialize") {
    send({ id: message.id, result: { userAgent: "fake-codex", platformFamily: "macos", platformOs: "darwin" } });
    return;
  }
  if (message.method === "initialized") {
    return;
  }
  if (message.method === "thread/start") {
    threadId = message.params?.threadId || message.params?.sessionId || threadId;
    send({ id: message.id, result: { thread: { id: threadId, sessionId: threadId } } });
    return;
  }
  if (message.method === "thread/resume") {
    threadId = message.params?.threadId || message.params?.sessionId || threadId;
    send({ id: message.id, result: { thread: { id: threadId, sessionId: threadId } } });
    return;
  }
  if (message.method === "turn/start") {
    turnIndex += 1;
    const turnId = "turn_fake_" + turnIndex;
    const text = inputText(message.params?.input);
    send({ id: message.id, result: { turn: { id: turnId, status: "inProgress" } } });
    send({ method: "turn/started", params: { threadId, turn: { id: turnId, status: "inProgress" } } });
    send({ method: "item/agentMessage/delta", params: { itemId: "msg_fake_" + turnIndex, delta: "codex says " + (text || "hello") } });
    send({ method: "turn/completed", params: { threadId, turn: { id: turnId, status: "completed" } } });
    return;
  }
  send({ id: message.id, result: {} });
});
`;
}
