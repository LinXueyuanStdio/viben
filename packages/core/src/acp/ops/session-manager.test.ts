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

describe("AcpSessionManager", () => {
  it("expands home-relative cwd before starting the ACP backend", async () => {
    const adapter = new CapturingBackendAdapter();
    const manager = new AcpSessionManager(adapter);
    const connection: AcpConnection = {
      async sessionUpdate() {},
      async requestPermission() {
        return { outcome: { outcome: "selected", optionId: "allow_once" } };
      },
      async requestClient() {
        return { content: [{ type: "text", text: "ok" }] };
      },
    };

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
    const connection: AcpConnection = {
      async sessionUpdate() {},
      async requestPermission() {
        return { outcome: { outcome: "selected", optionId: "allow_once" } };
      },
      async requestClient() {
        return { content: [{ type: "text", text: "ok" }] };
      },
    };
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
    const connection: AcpConnection = {
      async sessionUpdate() {},
      async requestPermission() {
        return { outcome: { outcome: "selected", optionId: "allow_once" } };
      },
      async requestClient() {
        return { content: [{ type: "text", text: "ok" }] };
      },
    };

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
});
