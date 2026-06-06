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
  readonly prompts: PromptRequest[] = [];
  cancelCount = 0;

  constructor(readonly backendSessionId = "backend-session") {}

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    this.prompts.push(request);
    return { stopReason: "end_turn" };
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
  }

  async close(): Promise<void> {}
}

class CapturingBackendAdapter implements AcpBackendAdapter {
  readonly id = "capturing";
  startContext?: AcpBackendStartContext;
  backendSession?: FakeBackendSession;

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.startContext = context;
    const requestedSessionId = "sessionId" in context.request ? context.request.sessionId : undefined;
    this.backendSession = new FakeBackendSession(requestedSessionId ?? "backend-session");
    return this.backendSession;
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

class InterruptibleBackendSession implements AcpBackendSession {
  readonly prompts: PromptRequest[] = [];
  cancelCount = 0;
  private cancelCurrentPrompt: (() => void) | undefined;

  constructor(readonly backendSessionId = "backend-session") {}

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    this.prompts.push(request);
    if (this.prompts.length > 1) {
      return { stopReason: "end_turn" };
    }
    await new Promise<void>((resolve) => {
      this.cancelCurrentPrompt = resolve;
    });
    return { stopReason: "cancelled" };
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
    this.cancelCurrentPrompt?.();
    this.cancelCurrentPrompt = undefined;
  }

  async close(): Promise<void> {}
}

class HangingInterruptBackendSession implements AcpBackendSession {
  readonly prompts: PromptRequest[] = [];
  cancelCount = 0;
  releaseCurrentPrompt: (() => void) | undefined;

  constructor(readonly backendSessionId = "backend-session") {}

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    this.prompts.push(request);
    if (this.prompts.length > 1) {
      return { stopReason: "end_turn" };
    }
    await new Promise<void>((resolve) => {
      this.releaseCurrentPrompt = resolve;
    });
    return { stopReason: "cancelled" };
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
  }

  async close(): Promise<void> {}
}

class InterruptibleBackendAdapter implements AcpBackendAdapter {
  readonly id = "interruptible";
  backendSession?: InterruptibleBackendSession;

  async start(_context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.backendSession = new InterruptibleBackendSession();
    return this.backendSession;
  }
}

class HangingInterruptBackendAdapter implements AcpBackendAdapter {
  readonly id = "hanging-interruptible";
  backendSession?: HangingInterruptBackendSession;

  async start(_context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.backendSession = new HangingInterruptBackendSession();
    return this.backendSession;
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

  it("mounts the ACP client-side MCP server when requested by name", async () => {
    const adapter = resolveBuiltinAcpBackend("CLAUDE_CODE").createAdapter();
    const connection = createConnection();

    const session = await adapter.start({
      outerSessionId: "acp-session-1",
      cwd: "/tmp",
      request: { cwd: "/tmp", mcpServers: ["client_side"] },
      connection,
    });

    const server = session.startRequest?.mcpServers?.find((entry) => entry.name === "client_side");
    expect(server).toBeDefined();
    expect(server?.command).toBe(process.execPath);
    expect(server?.args?.[0]).toContain("client-side-mcp-server");
    expect(server?.env).toEqual(
      expect.arrayContaining([
        { name: "VIBEN_ACP_SESSION_ID", value: "acp-session-1" },
      ])
    );

    await session.close();
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

  it("interrupts current execution and resumes with queued steer prompts as a prompt", async () => {
    const adapter = new InterruptibleBackendAdapter();
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    const runningPrompt = manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "initial prompt" }],
    });
    await waitFor(() => adapter.backendSession?.prompts.length === 1);

    const first = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "stop the current command" }],
    });
    const second = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "continue with this instead" }],
    });

    const result = await manager.interruptSession({ sessionId: session.sessionId });
    await expect(runningPrompt).resolves.toEqual({ stopReason: "cancelled" });

    expect(result).toEqual({
      interrupted: true,
      resumed: true,
      promptIds: [first.promptId, second.promptId],
    });
    expect(adapter.backendSession?.cancelCount).toBe(1);
    await waitFor(() => adapter.backendSession?.prompts.length === 2);
    expect(adapter.backendSession?.prompts.map((request) => request.prompt)).toEqual([
      [{ type: "text", text: "initial prompt" }],
      [{ type: "text", text: "stop the current command\n\ncontinue with this instead" }],
    ]);
    expect(connection.updates.map((notification) => notification.update)).toEqual([
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: first.promptId }),
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: second.promptId }),
    ]);
  });

  it("returns from interrupt without waiting for the active prompt to finish", async () => {
    const adapter = new HangingInterruptBackendAdapter();
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );

    const runningPrompt = manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "initial prompt" }],
    });
    await waitFor(() => adapter.backendSession?.prompts.length === 1);
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "resume after interrupt" }],
    });

    const result = await Promise.race([
      manager.interruptSession({ sessionId: session.sessionId }),
      wait(25).then(() => "timed-out" as const),
    ]);

    expect(result).toEqual({
      interrupted: true,
      resumed: true,
      promptIds: [queued.promptId],
    });
    expect(adapter.backendSession?.cancelCount).toBe(1);

    adapter.backendSession?.releaseCurrentPrompt?.();
    await expect(runningPrompt).resolves.toEqual({ stopReason: "cancelled" });
  });

  it("keeps interrupt steer prompts queued until the resume prompt starts", async () => {
    const adapter = new HangingInterruptBackendAdapter();
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    const runningPrompt = manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "initial prompt" }],
    });
    await waitFor(() => adapter.backendSession?.prompts.length === 1);
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "resume after active prompt exits" }],
    });

    await manager.interruptSession({ sessionId: session.sessionId });

    const beforeRelease = await manager.viewSteerPrompt({ sessionId: session.sessionId, promptId: queued.promptId });
    if (!("prompt" in beforeRelease)) {
      throw new Error("Expected single steer prompt view");
    }
    expect(beforeRelease.prompt.status).toBe("queued");
    expect(connection.updates).toEqual([]);

    adapter.backendSession?.releaseCurrentPrompt?.();
    await expect(runningPrompt).resolves.toEqual({ stopReason: "cancelled" });
    await waitFor(() => adapter.backendSession?.prompts.length === 2);

    const afterRelease = await manager.viewSteerPrompt({ sessionId: session.sessionId, promptId: queued.promptId });
    if (!("prompt" in afterRelease)) {
      throw new Error("Expected single steer prompt view");
    }
    expect(afterRelease.prompt.status).toBe("consumed");
    expect(connection.updates.map((notification) => notification.update)).toEqual([
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: queued.promptId }),
    ]);
  });

  it("runs an interrupt resume prompt before earlier queued normal prompts", async () => {
    const adapter = new InterruptibleBackendAdapter();
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );

    const runningPrompt = manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "initial prompt" }],
    });
    await waitFor(() => adapter.backendSession?.prompts.length === 1);
    const normalPrompt = manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "normal queued prompt" }],
    });
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "interrupt resume prompt" }],
    });

    await manager.interruptSession({ sessionId: session.sessionId });
    await expect(runningPrompt).resolves.toEqual({ stopReason: "cancelled" });
    await expect(normalPrompt).resolves.toEqual({ stopReason: "end_turn" });

    expect(adapter.backendSession?.prompts.map((request) => request.prompt)).toEqual([
      [{ type: "text", text: "initial prompt" }],
      [{ type: "text", text: "interrupt resume prompt" }],
      [{ type: "text", text: "normal queued prompt" }],
    ]);
    const viewed = await manager.viewSteerPrompt({ sessionId: session.sessionId, promptId: queued.promptId });
    if (!("prompt" in viewed)) {
      throw new Error("Expected single steer prompt view");
    }
    expect(viewed.prompt.status).toBe("consumed");
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("Timed out waiting for condition");
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
