import { describe, expect, it } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import type { PromptRequest, PromptResponse } from "@agentclientprotocol/sdk";
import { resolveBuiltinAcpBackend } from "./backend-adapter";
import { AcpSessionManager } from "./session-manager";
import { InMemoryAcpSteerPromptStore } from "./steer-prompt-store";
import type {
  AcpBackendAdapter,
  AcpBackendSession,
  AcpBackendStartContext,
} from "./backend-adapter";
import type { AcpConnection, AcpSessionNotification } from "../types";

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

class HookedBackendSession implements AcpBackendSession {
  constructor(
    readonly backendSessionId: string,
    private readonly onPrompt: () => Promise<void> | void
  ) {}

  async prompt(_request: PromptRequest): Promise<PromptResponse> {
    await this.onPrompt();
    return { stopReason: "end_turn" };
  }

  async cancel(): Promise<void> {}

  async close(): Promise<void> {}
}

type BackendNotification = Parameters<NonNullable<AcpBackendStartContext["onSessionUpdate"]>>[0];

class HookedBackendAdapter implements AcpBackendAdapter {
  readonly id = "hooked";
  startContext?: AcpBackendStartContext;

  constructor(private readonly onPrompt: (context: AcpBackendStartContext) => Promise<void> | void) {}

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.startContext = context;
    return new HookedBackendSession("backend-session", () => this.onPrompt(context));
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
    async notifyClient() {},
  };
}

function createCapturingConnection(): AcpConnection & { updates: AcpSessionNotification[] } {
  const updates: AcpSessionNotification[] = [];
  return {
    updates,
    async sessionUpdate(notification) {
      updates.push(notification);
    },
    async requestPermission() {
      return { outcome: { outcome: "selected", optionId: "allow_once" } };
    },
    async requestClient() {
      return { content: [{ type: "text", text: "ok" }] };
    },
    async notifyClient(method, params) {
      updates.push({
        sessionId: typeof params?.sessionId === "string" ? params.sessionId : "unknown",
        update: {
          sessionUpdate: method,
          ...params,
        },
      } as AcpSessionNotification);
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
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
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
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
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

  it("cancels queued steer prompts and preserves cancelled status in view", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
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

    expect(await manager.cancelSteerPrompt({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toMatchObject({
      promptId: queued.promptId,
      cancelled: true,
      status: "cancelled",
      cancelledAt: expect.any(String),
    });

    const viewed = await manager.viewSteerPrompt({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    });
    if (!("prompt" in viewed)) {
      throw new Error("Expected single steer prompt view");
    }
    expect(viewed.prompt.status).toBe("cancelled");
  });

  it("consumes all queued steer prompts before resuming the agent after a client tool result", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );
    const first = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "consume first" }],
    });
    const second = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "consume second" }],
    });

    await manager.requestClientTool(session.sessionId, "GUI_execute", { action: "test" }, "tool-1");

    const viewed = await manager.viewSteerPrompt({
      sessionId: session.sessionId,
    });

    if (!("prompts" in viewed)) {
      throw new Error("Expected steer prompt list view");
    }
    expect(viewed.prompts.map((item) => item.status)).toEqual(["consumed", "consumed"]);
    expect(connection.updates.map((notification) => notification.update)).toEqual([
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: first.promptId }),
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: second.promptId }),
    ]);
  });

  it("does not cancel steer prompts after they were consumed before agent execution resumes", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
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
    await manager.requestClientTool(session.sessionId, "GUI_execute", { action: "test" }, "tool-1");

    expect(await manager.cancelSteerPrompt({
      sessionId: session.sessionId,
      promptId: queued.promptId,
    })).toMatchObject({ promptId: queued.promptId, cancelled: false, status: "consumed" });
  });

  it("consumes queued steer prompts before running the agent prompt", async () => {
    let statusBeforePrompt: string | undefined;
    const connection = createCapturingConnection();
    const manager = new AcpSessionManager(
      new HookedBackendAdapter(async () => {
        const viewed = await manager.viewSteerPrompt({ sessionId: session.sessionId });
        if (!("prompts" in viewed)) {
          throw new Error("Expected steer prompt list view");
        }
        statusBeforePrompt = viewed.prompts[0]?.status;
      }),
      new InMemoryAcpSteerPromptStore()
    );
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "before agent runs" }],
    });

    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "run agent" }],
    });

    expect(statusBeforePrompt).toBe("consumed");
    expect(connection.updates.map((notification) => notification.update)).toContainEqual(
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: queued.promptId })
    );
  });

  it.each(["completed", "failed"])(
    "consumes queued steer prompts when any tool call finishes with %s",
    async (status) => {
      const connection = createCapturingConnection();
      const adapter = new HookedBackendAdapter(async (context) => {
        await context.onSessionUpdate?.({
          sessionId: "backend-session",
          update: {
            sessionUpdate: "tool_call_update",
            toolCallId: "tool-any",
            status,
          },
        } as BackendNotification);
      });
      const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
      const session = await manager.createSession(
        { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
        connection
      );
      const queued = await manager.steerPrompt({
        sessionId: session.sessionId,
        agentId: "agent-alpha",
        userId: "user-1",
        prompt: [{ type: "text", text: "after any tool" }],
      });

      await manager.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "run agent" }],
      });

      const viewed = await manager.viewSteerPrompt({ sessionId: session.sessionId, promptId: queued.promptId });
      if (!("prompt" in viewed)) {
        throw new Error("Expected single steer prompt view");
      }
      expect(viewed.prompt.status).toBe("consumed");
      expect(connection.updates.map((notification) => notification.update)).toContainEqual(
        expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: queued.promptId })
      );
    }
  );
});
