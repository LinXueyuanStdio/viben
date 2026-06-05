import { describe, expect, it } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import type { PromptRequest, PromptResponse } from "@agentclientprotocol/sdk";
import { resolveBuiltinAcpBackend } from "./backend-adapter";
import { AcpSessionManager } from "./session-manager";
import type {
  AcpBackendAdapter,
  AcpBackendSession,
  AcpBackendStartContext,
} from "./backend-adapter";
import type { AcpConnection } from "../types";

class FakeBackendSession implements AcpBackendSession {
  constructor(readonly backendSessionId = "backend-session") {}

  async prompt(_request: PromptRequest): Promise<PromptResponse> {
    return { stopReason: "end_turn" };
  }

  async cancel(): Promise<void> {}

  async close(): Promise<void> {}
}

class CapturingBackendAdapter implements AcpBackendAdapter {
  readonly id = "capturing";
  startContext?: AcpBackendStartContext;

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.startContext = context;
    const requestedSessionId = "sessionId" in context.request ? context.request.sessionId : undefined;
    return new FakeBackendSession(requestedSessionId ?? "backend-session");
  }
}

function createConnection(): AcpConnection {
  return {
    async sessionUpdate() {},
    async requestPermission() {
      return { outcome: { outcome: "selected", optionId: "allow_once" } };
    },
    async requestClient() {
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
}

describe("AcpSessionManager", () => {
  it("expands home-relative cwd before starting the ACP backend", async () => {
    const adapter = new CapturingBackendAdapter();
    const manager = new AcpSessionManager(adapter);
    const connection = createConnection();

    const session = await manager.createSession(
      { cwd: "~/Documents/GitHub/LinXueyuanStdio/viben", mcpServers: [] },
      connection
    );
    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "hello" }],
    });

    expect(adapter.startContext?.cwd).toBe(
      path.join(os.homedir(), "Documents", "GitHub", "LinXueyuanStdio", "viben")
    );
    expect(manager.getSession(session.sessionId)?.cwd).toBe(adapter.startContext?.cwd);
  });

  it("passes session mcpServers through to the ACP backend", async () => {
    const adapter = new CapturingBackendAdapter();
    const manager = new AcpSessionManager(adapter);
    const connection = createConnection();
    const mcpServers = [
      {
        name: "example",
        command: "node",
        args: ["server.js"],
        env: [],
      },
    ];

    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers },
      connection
    );
    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "hello" }],
    });

    expect(adapter.startContext?.request.mcpServers).toEqual(mcpServers);
  });

  it("loads the matching backend ACP session when session/load is used", async () => {
    const adapter = new CapturingBackendAdapter();
    const manager = new AcpSessionManager(adapter);
    const connection = createConnection();

    await manager.loadSession(
      { sessionId: "persisted-backend-session", cwd: "/tmp", mcpServers: [] },
      connection
    );
    await manager.prompt({
      sessionId: "persisted-backend-session",
      prompt: [{ type: "text", text: "hello" }],
    });

    expect(adapter.startContext?.request).toMatchObject({
      sessionId: "persisted-backend-session",
    });
    expect(manager.getSession("persisted-backend-session")?.sdkSessionId).toBe("persisted-backend-session");
  });

  it("resolves OpenClaw as a built-in ACP backend", () => {
    expect(resolveBuiltinAcpBackend("OPENCLAW")).toMatchObject({
      executorType: "OPENCLAW",
      id: "openclaw",
      command: "openclaw",
      args: ["acp"],
    });
  });

  it("queues a steer prompt with session, agent, user, and prompt payload", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );

    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "keep this in mind" }],
      meta: { source: "example" },
    });

    expect(queued).toMatchObject({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      status: "queued",
    });
    expect(queued.promptId).toEqual(expect.any(String));

    const viewed = await manager.viewSteerPrompt({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    });
    if (!("prompt" in viewed)) {
      throw new Error("Expected single steer prompt view");
    }
    expect(viewed.prompt.prompt).toEqual([{ type: "text", text: "keep this in mind" }]);
    expect(viewed.prompt.meta).toEqual({ source: "example" });
  });

  it("lists queued steer prompts for a session", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );
    const first = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "first" }],
    });
    const second = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "second" }],
    });

    const viewed = await manager.viewSteerPrompt({ sessionId: session.sessionId });

    if (!("prompts" in viewed)) {
      throw new Error("Expected steer prompt list view");
    }
    expect(viewed.prompts.map((item) => item.promptId)).toEqual([first.promptId, second.promptId]);
    expect(viewed.nextCursor).toBeNull();
  });

  it("cancels queued steer prompts and reports consumed status", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "cancel this" }],
    });

    expect(await manager.isSteerPromptConsumed({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toEqual({ promptId: queued.promptId, consumed: false, status: "queued" });

    expect(await manager.cancelSteerPrompt({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toMatchObject({
      promptId: queued.promptId,
      cancelled: true,
      status: "cancelled",
      cancelledAt: expect.any(String),
    });

    expect(await manager.isSteerPromptConsumed({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toEqual({ promptId: queued.promptId, consumed: false, status: "cancelled" });
  });

  it("marks steer prompts consumed once dequeued and does not cancel consumed prompts", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "consume this" }],
    });

    const consumed = await manager.consumeNextSteerPrompt(session.sessionId);

    expect(consumed?.promptId).toBe(queued.promptId);
    expect(await manager.isSteerPromptConsumed({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toMatchObject({
      promptId: queued.promptId,
      consumed: true,
      status: "consumed",
      consumedAt: expect.any(String),
    });
    expect(await manager.cancelSteerPrompt({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toMatchObject({
      promptId: queued.promptId,
      cancelled: false,
      status: "consumed",
      consumedAt: expect.any(String),
    });
  });
});
