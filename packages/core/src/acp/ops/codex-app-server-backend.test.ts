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
  it("passes custom Codex provider config as app-server CLI overrides", async () => {
    const proc = createProcess();
    let spawnedArgs: string[] | undefined;
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: (definition) => {
        spawnedArgs = definition.args;
        return proc;
      },
    });

    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection: createConnection(),
      agentConfig: {
        executor_type: "CODEX",
        provider_id: "hexin",
        model: "gpt-5.5",
        executor_config: {
          args: ["app-server", "--listen", "stdio://"],
          provider_id: "hexin",
          base_url: "http://localhost:8777/v1",
          env_key: "HEXIN_API_KEY",
        },
      },
    });

    await waitForWrite(proc, "initialize");
    expect(spawnedArgs).toEqual([
      "app-server",
      "--listen",
      "stdio://",
      "-c",
      'model_provider="hexin"',
      "-c",
      'model_providers.hexin.name="hexin"',
      "-c",
      'model_providers.hexin.wire_api="responses"',
      "-c",
      'model_providers.hexin.base_url="http://localhost:8777/v1"',
      "-c",
      'model_providers.hexin.env_key="HEXIN_API_KEY"',
    ]);
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });

    await expect(sessionPromise).resolves.toMatchObject({ backendSessionId: "thr-1" });
  });

  it("resolves Codex provider details from provider id", async () => {
    const proc = createProcess();
    let spawnedArgs: string[] | undefined;
    let spawnedEnv: Record<string, string> | undefined;
    const adapter = new CodexAppServerBackendAdapter({
      lookupProvider: async (providerId) => providerId === "deepseek-openai"
        ? {
            id: "deepseek-openai",
            name: "DeepSeek",
            type: "openai",
            base_url: "https://api.deepseek.com",
            api_key: "sk-deepseek",
          }
        : null,
      spawnProcess: (definition) => {
        spawnedArgs = definition.args;
        spawnedEnv = definition.env;
        return proc;
      },
    });

    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection: createConnection(),
      agentConfig: {
        executor_type: "CODEX",
        provider_id: "deepseek-openai",
        model: "deepseek-v4-flash",
      },
    });

    await waitForWrite(proc, "initialize");
    expect(spawnedArgs).toEqual([
      "app-server",
      "-c",
      'model_provider="deepseek-openai"',
      "-c",
      'model_providers.deepseek-openai.name="DeepSeek"',
      "-c",
      'model_providers.deepseek-openai.wire_api="responses"',
      "-c",
      'model_providers.deepseek-openai.base_url="https://api.deepseek.com"',
      "-c",
      'model_providers.deepseek-openai.env_key="OPENAI_API_KEY"',
    ]);
    expect(spawnedEnv).toMatchObject({ OPENAI_API_KEY: "sk-deepseek" });
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });

    await expect(sessionPromise).resolves.toMatchObject({ backendSessionId: "thr-1" });
  });

  it("passes provider ids that are not Codex dotted config keys as an inline provider table", async () => {
    const proc = createProcess();
    let spawnedArgs: string[] | undefined;
    let spawnedEnv: Record<string, string> | undefined;
    const adapter = new CodexAppServerBackendAdapter({
      lookupProvider: async (providerId) => providerId === "本地-openai"
        ? {
            id: "本地-openai",
            name: "本地 openai",
            type: "openai",
            base_url: "http://localhost:8777/v1",
            api_key: "sk-local",
          }
        : null,
      spawnProcess: (definition) => {
        spawnedArgs = definition.args;
        spawnedEnv = definition.env;
        return proc;
      },
    });

    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection: createConnection(),
      agentConfig: {
        executor_type: "CODEX",
        provider_id: "本地-openai",
        model: "deepseek-v4-flash",
      },
    });

    await waitForWrite(proc, "initialize");
    expect(spawnedArgs).toEqual([
      "app-server",
      "-c",
      'model_provider="本地-openai"',
      "-c",
      'model_providers={"本地-openai"={name="本地 openai", wire_api="responses", base_url="http://localhost:8777/v1", env_key="OPENAI_API_KEY"}}',
    ]);
    expect(spawnedEnv).toMatchObject({ OPENAI_API_KEY: "sk-local" });
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    expect(proc.writes.find((message) => message.method === "thread/start")).toMatchObject({
      method: "thread/start",
      params: {
        modelProvider: "本地-openai",
      },
    });
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
        modelProvider: "本地-openai",
      },
    });
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr-1", turn: { id: "turn-1", status: "completed" } },
    })}\n`);

    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
  });

  it("initializes app-server and starts a Codex thread", async () => {
    const proc = createProcess();
    const sandboxPolicy = { type: "workspaceWrite", networkAccess: false };
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
        provider_id: "openai",
        executor_config: {
          command: "fake-codex",
          args: ["app-server"],
          init_timeout_ms: 5000,
          approval_policy: "never",
          sandbox: "workspaceWrite",
          sandbox_policy: sandboxPolicy,
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
        modelProvider: "openai",
        cwd: "/tmp/project",
        serviceName: "viben",
        approvalPolicy: "never",
        sandbox: "workspace-write",
      },
    });
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });

    const session = await sessionPromise;
    expect(session.backendSessionId).toBe("thr-1");
  });

  it("passes agent configuration into Codex thread and turn params", async () => {
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
        provider_id: "openai",
        system_prompt: "Use the repo conventions.",
        append_prompt: "Prefer concise answers.",
        temperature: 0.2,
        max_tokens: 4096,
        permission_mode: "plan",
        executor_config: {
          reasoning_effort: "high",
          personality: "concise",
        },
      },
    });

    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    expect(proc.writes.find((message) => message.method === "thread/start")).toMatchObject({
      method: "thread/start",
      params: {
        model: "gpt-5.4",
        modelProvider: "openai",
        personality: "concise",
        settings: {
          developer_instructions: "Use the repo conventions.\n\nPrefer concise answers.",
          reasoning_effort: "high",
          temperature: 0.2,
          max_output_tokens: 4096,
        },
      },
    });
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
        model: "gpt-5.4",
        modelProvider: "openai",
        personality: "concise",
        settings: {
          developer_instructions: "Use the repo conventions.\n\nPrefer concise answers.",
          reasoning_effort: "high",
          temperature: 0.2,
          max_output_tokens: 4096,
        },
      },
    });
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr-1", turn: { id: "turn-1", status: "completed" } },
    })}\n`);

    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
  });

  it("passes request and agent config MCP servers into Codex thread params", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: () => proc,
    });

    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: {
        cwd: "/tmp/project",
        mcpServers: [
          {
            name: "request-files",
            command: "node",
            args: ["request-server.js"],
            env: [{ name: "REQUEST_TOKEN", value: "from-request" }],
          },
        ],
      },
      connection: createConnection(),
      agentConfig: {
        executor_type: "CODEX",
        mcp_servers: [
          {
            name: "agent-api",
            type: "http",
            url: "https://mcp.example.test",
            headers: { Authorization: "Bearer agent-token" },
          },
        ],
      },
    });

    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    expect(proc.writes.find((message) => message.method === "thread/start")).toMatchObject({
      method: "thread/start",
      params: {
        mcp_servers: {
          "request-files": {
            command: "node",
            args: ["request-server.js"],
            env: { REQUEST_TOKEN: "from-request" },
          },
          "agent-api": {
            url: "https://mcp.example.test",
            headers: { Authorization: "Bearer agent-token" },
          },
        },
      },
    });
    respondTo(proc, "thread/start", { thread: { id: "thr-1" } });

    await expect(sessionPromise).resolves.toMatchObject({ backendSessionId: "thr-1" });
  });

  it("starts a turn, forwards stream updates, and resolves when the turn completes", async () => {
    const proc = createProcess();
    const connection = createConnection();
    const sandboxPolicy = { type: "workspaceWrite", networkAccess: false };
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: () => proc,
    });
    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: { cwd: "/tmp/project", mcpServers: [] },
      connection,
      agentConfig: {
        executor_type: "CODEX",
        executor_config: {
          sandbox_policy: sandboxPolicy,
        },
      },
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
        sandboxPolicy: { type: "workspaceWrite", networkAccess: false },
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

  it("maps session sandbox config to Codex thread and turn params", async () => {
    const proc = createProcess();
    const adapter = new CodexAppServerBackendAdapter({
      spawnProcess: () => proc,
    });
    const sessionPromise = adapter.start({
      outerSessionId: "outer-session",
      cwd: "/tmp/project",
      request: {
        cwd: "/tmp/project",
        mcpServers: [],
        sandbox_config: { enabled: true, provider: "codex" },
      },
      connection: createConnection(),
      sandboxConfig: { enabled: true, provider: "codex" },
      agentConfig: { executor_type: "CODEX" },
    });
    await waitForWrite(proc, "initialize");
    respondTo(proc, "initialize", {});
    await waitForWrite(proc, "thread/start");
    expect(proc.writes.find((message) => message.method === "thread/start")).toMatchObject({
      method: "thread/start",
      params: {
        sandbox: "workspace-write",
      },
    });
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
        sandboxPolicy: { type: "workspaceWrite" },
      },
    });
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr-1", turn: { id: "turn-1", status: "completed" } },
    })}\n`);

    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
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

  it("rejects the active prompt when Codex app-server closes mid-turn", async () => {
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
    proc.stdout.end();

    await expect(prompt).rejects.toThrow("Codex app-server stdout closed");
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

  it("returns JSON-RPC errors for unsupported Codex server requests", async () => {
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
    await sessionPromise;

    proc.stdout.write(`${JSON.stringify({ id: 99, method: "item/tool/call", params: {} })}\n`);

    await waitForResponse(proc, 99);
    expect(proc.writes.find((message) => message.id === 99)).toEqual({
      id: 99,
      error: {
        code: -32601,
        message: "Unsupported Codex app-server request: item/tool/call",
      },
    });
  });

  it("dispatches stream updates before resolving prompt completion", async () => {
    const proc = createProcess();
    let releaseUpdate: (() => void) | undefined;
    const connection = createConnection();
    connection.sessionUpdate = async (notification) => {
      connection.updates.push(notification);
      await new Promise<void>((resolve) => {
        releaseUpdate = resolve;
      });
    };
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
    respondTo(proc, "turn/start", { turn: { id: "turn-1", status: "inProgress" } });
    proc.stdout.write(`${JSON.stringify({
      method: "item/agentMessage/delta",
      params: { itemId: "msg-1", delta: "hello" },
    })}\n`);
    await waitFor(() => connection.updates.length === 1);
    proc.stdout.write(`${JSON.stringify({
      method: "turn/completed",
      params: { threadId: "thr-1", turn: { id: "turn-1", status: "completed" } },
    })}\n`);

    let settled = false;
    prompt.then(() => {
      settled = true;
    }).catch(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    releaseUpdate?.();
    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
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

async function waitForResponse(proc: { writes: Array<Record<string, unknown>> }, id: number): Promise<void> {
  await expect.poll(() => proc.writes.some((message) => message.id === id)).toBe(true);
}

async function waitFor(predicate: () => boolean): Promise<void> {
  await expect.poll(predicate).toBe(true);
}
