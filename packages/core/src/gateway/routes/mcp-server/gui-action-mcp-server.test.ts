import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeAllGuiActionMcpServerSessions,
  registerGuiActionMcpServerRoutes,
} from "./gui-action-mcp-server";

describe("GUI Action MCP Server Routes", () => {
  afterEach(() => {
    closeAllGuiActionMcpServerSessions();
  });

  it("registers Streamable HTTP endpoints at /api/mcp-server/gui-action", async () => {
    const app = Fastify();
    registerGuiActionMcpServerRoutes(app);
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/mcp-server/gui-action",
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "session_id query parameter is required",
    });

    await app.close();
  });

  it("creates an MCP session when initialized with session_id", async () => {
    const app = Fastify();
    const createServer = vi.fn(() => ({
      connect: vi.fn(async () => undefined),
    }));
    registerGuiActionMcpServerRoutes(app, {
      createTransport: () => ({
        sessionId: undefined,
        onclose: undefined,
        handleRequest: vi.fn(async () => undefined),
        start: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
      }),
      createServer,
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/api/mcp-server/gui-action?session_id=acp-1",
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      },
    });

    expect(response.statusCode).toBe(200);
    expect(createServer).toHaveBeenCalledWith("acp-1");

    await app.close();
  });
});
