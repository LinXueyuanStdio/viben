import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { PromptRequest, PromptResponse } from "@agentclientprotocol/sdk";
import { InputHistoryService } from "../../services/input-history";
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

class HangingCancelBackendSession implements AcpBackendSession {
  readonly prompts: PromptRequest[] = [];
  cancelCount = 0;

  constructor(readonly backendSessionId = "backend-session") {}

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    this.prompts.push(request);
    await new Promise<void>(() => {});
    return { stopReason: "cancelled" };
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
    await new Promise<void>(() => {});
  }

  async close(): Promise<void> {}
}

class HangingCancelBackendAdapter implements AcpBackendAdapter {
  readonly id = "hanging-cancel";
  backendSession?: HangingCancelBackendSession;

  async start(_context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.backendSession = new HangingCancelBackendSession();
    return this.backendSession;
  }
}

class ToolFinishInterruptBackendSession implements AcpBackendSession {
  readonly prompts: PromptRequest[] = [];
  cancelCount = 0;
  private releaseFirstPrompt: (() => void) | undefined;

  constructor(readonly backendSessionId = "backend-session") {}

  async prompt(request: PromptRequest): Promise<PromptResponse> {
    this.prompts.push(request);
    if (this.prompts.length > 1) {
      return { stopReason: "end_turn" };
    }
    await new Promise<void>((resolve) => {
      this.releaseFirstPrompt = resolve;
    });
    return { stopReason: "cancelled" };
  }

  async cancel(): Promise<void> {
    this.cancelCount += 1;
    this.releaseFirstPrompt?.();
    this.releaseFirstPrompt = undefined;
  }

  async close(): Promise<void> {}
}

class ToolFinishInterruptBackendAdapter implements AcpBackendAdapter {
  readonly id = "tool-finish-interrupt";
  startContext?: AcpBackendStartContext;
  backendSession?: ToolFinishInterruptBackendSession;

  async start(context: AcpBackendStartContext): Promise<AcpBackendSession> {
    this.startContext = context;
    this.backendSession = new ToolFinishInterruptBackendSession();
    return this.backendSession;
  }
}

type ClientRequestRecord = {
  method: string;
  params: unknown;
};

function readClientToolEnvelope(params: unknown) {
  const request = params as { sessionId?: string; toolCallId?: string };
  return {
    sessionId: request.sessionId ?? "unknown-session",
    toolCallId: request.toolCallId ?? "unknown-tool-call",
    result: { content: [{ type: "text" as const, text: "ok" }] },
  };
}

function createConnection(): AcpConnection {
  return {
    async sessionUpdate() {},
    async requestPermission() {
      return { outcome: { outcome: "selected", optionId: "allow_once" } };
    },
    async requestClient(_method, params) {
      return readClientToolEnvelope(params);
    },
    async notifyClient() {},
  };
}

interface CapturingConnection extends AcpConnection {
  updates: AcpSessionNotification[];
  clientRequests: ClientRequestRecord[];
  clientResponse?: unknown;
}

function createCapturingConnection(): CapturingConnection {
  const updates: AcpSessionNotification[] = [];
  const clientRequests: ClientRequestRecord[] = [];
  const connection: CapturingConnection = {
    updates,
    clientRequests,
    clientResponse: undefined,
    async sessionUpdate(notification) {
      updates.push(notification);
    },
    async requestPermission() {
      return { outcome: { outcome: "selected", optionId: "allow_once" } };
    },
    async requestClient(method, params) {
      clientRequests.push({ method, params });
      return connection.clientResponse ?? readClientToolEnvelope(params);
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
  return connection;
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

  it("stores normal user prompts in input history when ACP prompt runs", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-input-history-test-"));
    try {
      const inputHistory = new InputHistoryService(tempDir);
      const adapter = new CapturingBackendAdapter();
      const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore(), inputHistory);
      const connection = createConnection();

      const session = await manager.createSession(
        { cwd: "/tmp", mcpServers: [] },
        connection
      );
      await manager.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "remember this prompt" }],
      });

      await expect(inputHistory.listText()).resolves.toEqual(["remember this prompt"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("summarizes agent metadata and initial prompt for session lists", async () => {
    const adapter = new CapturingBackendAdapter();
    const manager = new AcpSessionManager(adapter);
    const connection = createConnection();

    const session = await manager.createSession(
      {
        cwd: "/tmp",
        mcpServers: [],
        agent_config: {
          name: "Desktop Agent",
          executor_type: "CODEX",
        },
      },
      connection
    );
    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "inspect the workspace" }],
    });

    expect(manager.listSessions()[0]).toMatchObject({
      id: session.sessionId,
      status: "finished",
      agentName: "Desktop Agent",
      agentExecutorType: "CODEX",
      initialPrompt: "inspect the workspace",
    });
  });

  it("stores steer prompts in input history when ACP steer prompt is received", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-steer-input-history-test-"));
    try {
      const inputHistory = new InputHistoryService(tempDir);
      const adapter = new CapturingBackendAdapter();
      const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore(), inputHistory);
      const connection = createConnection();

      const session = await manager.createSession(
        { cwd: "/tmp", mcpServers: [] },
        connection
      );
      await manager.steerPrompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "remember this steer" }],
      });

      await expect(inputHistory.listText()).resolves.toEqual(["remember this steer"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("passes session sandbox_config through to the ACP backend", async () => {
    const adapter = new CapturingBackendAdapter();
    const manager = new AcpSessionManager(adapter);
    const connection = createConnection();

    const session = await manager.createSession(
      {
        cwd: "/tmp",
        mcpServers: [],
        sandbox_config: { enabled: true, provider: "codex" },
      },
      connection
    );
    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "hello" }],
    });

    expect(adapter.startContext?.sandboxConfig).toEqual({ enabled: true, provider: "codex" });
    expect(adapter.startContext?.request).toMatchObject({
      sandbox_config: { enabled: true, provider: "codex" },
    });
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

  it("loads snake_case agent config frontmatter before starting the ACP backend", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-agent-config-test-"));
    try {
      const configPath = path.join(tempDir, "AGENTS.md");
      await writeFile(
        configPath,
        [
          "---",
          "name: Codex Agent",
          "model: gpt-5-codex",
          "executor_type: CODEX",
          "executor_config:",
          "  command: /usr/local/bin/codex-acp",
          "---",
          "You are a coding agent.",
          "",
        ].join("\n"),
        "utf-8"
      );
      const adapter = new CapturingBackendAdapter();
      const manager = new AcpSessionManager(adapter);
      const connection = createConnection();

      const session = await manager.createSession(
        { cwd: "/tmp", mcpServers: [], agent_config_path: configPath },
        connection
      );
      await manager.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "hello" }],
      });

      expect(adapter.startContext?.agentConfig).toMatchObject({
        executor_type: "CODEX",
        executor_config: { command: "/usr/local/bin/codex-acp" },
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("overlays inline agent config on top of file frontmatter before starting the ACP backend", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-agent-config-merge-test-"));
    try {
      const configPath = path.join(tempDir, "AGENTS.md");
      await writeFile(
        configPath,
        [
          "---",
          "name: File Codex Agent",
          "model: gpt-5-codex",
          "provider: openai",
          "executor_type: CODEX",
          "executor_config:",
          "  command: /usr/local/bin/codex",
          "  args:",
          "    - app-server",
          "  init_timeout_ms: 15000",
          "---",
          "You are a coding agent from the file.",
          "",
        ].join("\n"),
        "utf-8"
      );
      const adapter = new CapturingBackendAdapter();
      const manager = new AcpSessionManager(adapter);
      const connection = createConnection();

      const session = await manager.createSession(
        {
          cwd: "/tmp",
          mcpServers: [],
          agent_config_path: configPath,
          agent_config: {
            model: "deepseek-v4-flash",
            provider_id: "hexin",
            executor_config: {
              provider_id: "hexin",
              base_url: "http://localhost:8777/v1",
              reasoning_effort: "low",
            },
          },
        },
        connection
      );
      await manager.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "hello" }],
      });

      expect(adapter.startContext?.agentConfig).toMatchObject({
        name: "File Codex Agent",
        executor_type: "CODEX",
        model: "deepseek-v4-flash",
        provider_id: "hexin",
        executor_config: {
          command: "/usr/local/bin/codex",
          args: ["app-server"],
          init_timeout_ms: 15000,
          reasoning_effort: "low",
        },
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("removes stale Codex provider details from file frontmatter when inline config selects a provider", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "viben-acp-agent-config-stale-provider-test-"));
    try {
      const configPath = path.join(tempDir, "AGENTS.md");
      await writeFile(
        configPath,
        [
          "---",
          "name: File Codex Agent",
          "model: gpt-5-codex",
          "provider_id: old-openai",
          "executor_type: CODEX",
          "executor_config:",
          "  command: /usr/local/bin/codex",
          "  provider_id: old-openai",
          "  base_url: http://localhost:8777/v1",
          "  provider_name: Old OpenAI",
          "  wire_api: responses",
          "  env_key: OLD_OPENAI_API_KEY",
          "  reasoning_effort: high",
          "---",
          "You are a coding agent from the file.",
          "",
        ].join("\n"),
        "utf-8"
      );
      const adapter = new CapturingBackendAdapter();
      const manager = new AcpSessionManager(adapter);
      const connection = createConnection();

      const session = await manager.createSession(
        {
          cwd: "/tmp",
          mcpServers: [],
          agent_config_path: configPath,
          agent_config: {
            model: "deepseek-v4-flash",
            provider_id: "deepseek-openai",
            executor_config: {
              reasoning_effort: "low",
            },
          },
        },
        connection
      );
      await manager.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "hello" }],
      });

      expect(adapter.startContext?.agentConfig).toMatchObject({
        name: "File Codex Agent",
        executor_type: "CODEX",
        model: "deepseek-v4-flash",
        provider_id: "deepseek-openai",
        executor_config: {
          command: "/usr/local/bin/codex",
          reasoning_effort: "low",
        },
      });
      expect(adapter.startContext?.agentConfig?.executor_config).not.toMatchObject({
        provider_id: expect.anything(),
        base_url: expect.anything(),
        provider_name: expect.anything(),
        wire_api: expect.anything(),
        env_key: expect.anything(),
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("resolves OpenClaw as a built-in ACP backend", () => {
    expect(resolveBuiltinAcpBackend("OPENCLAW")).toMatchObject({
      executorType: "OPENCLAW",
      id: "openclaw",
      command: "openclaw",
      args: ["acp"],
    });
  });

  it("resolves Codex as the app-server backend while keeping Codex ACP explicit", () => {
    expect(resolveBuiltinAcpBackend("CODEX")).toMatchObject({
      executorType: "CODEX",
      id: "codex",
      registryId: "codex-app-server",
      command: "codex",
      args: ["app-server"],
    });
    expect(resolveBuiltinAcpBackend("CODEX_APP_SERVER")).toMatchObject({
      executorType: "CODEX_APP_SERVER",
      id: "codex",
      registryId: "codex-app-server",
      command: "codex",
      args: ["app-server"],
    });
    expect(resolveBuiltinAcpBackend("CODEX_ACP")).toMatchObject({
      executorType: "CODEX_ACP",
      id: "codex",
      registryId: "codex-acp",
      command: "codex-acp",
      args: [],
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

  it("injects queued steer prompts into the client tool result before resuming the agent", async () => {
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

    const result = await manager.requestClientTool(session.sessionId, "GUI_execute", { action: "test" }, "tool-1");

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
    expect(result.content).toEqual([
      { type: "text", text: "ok" },
      { type: "text", text: "consume first\n\nconsume second" },
    ]);
  });

  it("dispatches client tool calls with toolCallId and accepts the response envelope", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    const result = await manager.requestClientTool(
      session.sessionId,
      "mcp__client_side__GUI_execute",
      { action: "list_actions" },
      "tool-call-1"
    );

    expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(connection.clientRequests).toEqual([
      {
        method: "_viben/client_tool_call",
        params: {
          sessionId: session.sessionId,
          toolCallId: "tool-call-1",
          toolName: "mcp__client_side__GUI_execute",
          input: { action: "list_actions" },
        },
      },
    ]);
    expect(connection.clientRequests[0].params).not.toHaveProperty("toolUseId");
  });

  it("reuses the backend GUI toolCallId for MCP bridge client tool requests", async () => {
    const connection = createCapturingConnection();
    const adapter = new HookedBackendAdapter(async (context) => {
      await context.onSessionUpdate?.({
        sessionId: "backend-session",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "backend-gui-tool-1",
          title: "mcp__client_side__GUI_execute",
          status: "pending",
        },
      } as BackendNotification);
    });
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "run GUI tool" }],
    });
    await manager.requestClientTool(
      session.sessionId,
      "mcp__client_side__GUI_execute",
      { action: "get_action_detail" },
      "bridge-local-tool"
    );

    expect(connection.clientRequests.at(-1)?.params).toMatchObject({
      sessionId: session.sessionId,
      toolCallId: "backend-gui-tool-1",
      toolName: "mcp__client_side__GUI_execute",
    });
  });

  it("reuses the backend ClientSideBash toolCallId for MCP bridge client tool requests", async () => {
    const connection = createCapturingConnection();
    const adapter = new HookedBackendAdapter(async (context) => {
      await context.onSessionUpdate?.({
        sessionId: "backend-session",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "backend-bash-tool-1",
          title: "mcp__client_side__ClientSideBash",
          status: "pending",
        },
      } as BackendNotification);
    });
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "run bash tool" }],
    });
    await manager.requestClientTool(
      session.sessionId,
      "mcp__client_side__ClientSideBash",
      { script: "echo ok" },
      "bridge-local-bash-tool"
    );

    expect(connection.clientRequests.at(-1)?.params).toMatchObject({
      sessionId: session.sessionId,
      toolCallId: "backend-bash-tool-1",
      toolName: "mcp__client_side__ClientSideBash",
      input: { script: "echo ok" },
    });
  });

  it("matches MCP bridge client tool ids by tool name when backend tool calls arrive out of order", async () => {
    const connection = createCapturingConnection();
    const adapter = new HookedBackendAdapter(async (context) => {
      await context.onSessionUpdate?.({
        sessionId: "backend-session",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "backend-gui-tool-1",
          title: "mcp__client_side__GUI_execute",
          status: "pending",
        },
      } as BackendNotification);
      await context.onSessionUpdate?.({
        sessionId: "backend-session",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "backend-bash-tool-1",
          title: "mcp__client_side__ClientSideBash",
          status: "pending",
        },
      } as BackendNotification);
    });
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "run client tools" }],
    });
    await manager.requestClientTool(
      session.sessionId,
      "mcp__client_side__ClientSideBash",
      { script: "echo ok" },
      "bridge-local-bash-tool"
    );

    expect(connection.clientRequests.at(-1)?.params).toMatchObject({
      sessionId: session.sessionId,
      toolCallId: "backend-bash-tool-1",
      toolName: "mcp__client_side__ClientSideBash",
    });
  });

  it("returns an error when a client tool response envelope has mismatched ids", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    connection.clientResponse = {
      sessionId: "wrong-session",
      toolCallId: "wrong-tool",
      result: { content: [{ type: "text", text: "wrong" }] },
    };
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    const result = await manager.requestClientTool(session.sessionId, "GUI_execute", { action: "test" }, "tool-1");

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Client tool response mismatch"),
    });
  });

  it("returns an error for a bare client tool result without the ACP envelope", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    connection.clientResponse = { content: [{ type: "text", text: "bare" }] };
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );

    const result = await manager.requestClientTool(session.sessionId, "GUI_execute", { action: "test" }, "tool-1");

    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Invalid client tool response envelope"),
    });
  });

  it("accepts multimodal MCP CallToolResult content in client tool envelopes", async () => {
    const manager = new AcpSessionManager(new CapturingBackendAdapter(), new InMemoryAcpSteerPromptStore());
    const connection = createCapturingConnection();
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );
    connection.clientResponse = {
      sessionId: session.sessionId,
      toolCallId: "tool-1",
      result: {
        content: [
          { type: "text", text: "image follows" },
          { type: "image", data: "ZmFrZQ==", mimeType: "image/png" },
          { type: "resource_link", uri: "file:///tmp/report.md", name: "report.md" },
        ],
        structuredContent: { ok: true },
      },
    };

    const result = await manager.requestClientTool(session.sessionId, "GUI_execute", { action: "test" }, "tool-1");

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(3);
    expect(result.structuredContent).toEqual({ ok: true });
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

  it("injects queued steer prompts into the next normal agent prompt", async () => {
    const adapter = new CapturingBackendAdapter();
    const connection = createCapturingConnection();
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      connection
    );
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "also include this steer" }],
    });

    await manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "run the normal prompt" }],
    });

    expect(adapter.backendSession?.prompts.map((request) => request.prompt)).toEqual([
      [{ type: "text", text: "run the normal prompt\n\nalso include this steer" }],
    ]);
    expect(connection.updates.map((notification) => notification.update)).toContainEqual(
      expect.objectContaining({ sessionUpdate: "session/prompt/consumed", promptId: queued.promptId })
    );
  });

  it.each(["completed", "failed"])(
    "interrupts and resumes with queued steer prompts when a backend tool call finishes with %s",
    async (status) => {
      const adapter = new ToolFinishInterruptBackendAdapter();
      const connection = createCapturingConnection();
      const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
      const session = await manager.createSession(
        { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
        connection
      );
      const runningPrompt = manager.prompt({
        sessionId: session.sessionId,
        prompt: [{ type: "text", text: "run agent" }],
      });
      await waitFor(() => adapter.backendSession?.prompts.length === 1);
      const queued = await manager.steerPrompt({
        sessionId: session.sessionId,
        agentId: "agent-alpha",
        userId: "user-1",
        prompt: [{ type: "text", text: "after any tool" }],
      });

      await adapter.startContext?.onSessionUpdate?.({
        sessionId: "backend-session",
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "tool-any",
          status,
        },
      } as BackendNotification);
      await expect(runningPrompt).resolves.toEqual({ stopReason: "cancelled" });
      await waitFor(() => adapter.backendSession?.prompts.length === 2);

      const viewed = await manager.viewSteerPrompt({ sessionId: session.sessionId, promptId: queued.promptId });
      if (!("prompt" in viewed)) {
        throw new Error("Expected single steer prompt view");
      }
      expect(viewed.prompt.status).toBe("consumed");
      expect(adapter.backendSession?.cancelCount).toBe(1);
      expect(adapter.backendSession?.prompts.map((request) => request.prompt)).toEqual([
        [{ type: "text", text: "run agent" }],
        [{ type: "text", text: "after any tool" }],
      ]);
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

  it("returns from interrupt without waiting for backend cancel to finish", async () => {
    const adapter = new HangingCancelBackendAdapter();
    const manager = new AcpSessionManager(adapter, new InMemoryAcpSteerPromptStore());
    const session = await manager.createSession(
      { cwd: "/tmp", mcpServers: [], agent_config: { name: "agent-alpha" } },
      createConnection()
    );

    void manager.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "initial prompt" }],
    });
    await waitFor(() => adapter.backendSession?.prompts.length === 1);
    const queued = await manager.steerPrompt({
      sessionId: session.sessionId,
      agentId: "agent-alpha",
      userId: "user-1",
      prompt: [{ type: "text", text: "resume after stuck cancel" }],
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
