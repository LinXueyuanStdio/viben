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
