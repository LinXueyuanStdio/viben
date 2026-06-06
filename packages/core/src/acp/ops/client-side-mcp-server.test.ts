import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import {
  CLIENT_SIDE_BASH_TOOL_NAME,
  CLIENT_SIDE_MCP_SERVER_NAME,
  createClientSideMcpServer,
  GUI_EXECUTE_TOOL_NAME,
  type ClientSideClientToolRequest,
} from "./client-side-mcp-server";

type RegisteredTool = {
  title?: string;
  description?: string;
  inputSchema?: unknown;
  handler: (args: unknown) => Promise<CallToolResult>;
};

type InspectableMcpServer = ReturnType<typeof createClientSideMcpServer> & {
  _registeredTools?: Record<string, RegisteredTool>;
  server: {
    _serverInfo?: { name?: string };
  };
};

function getTool(server: InspectableMcpServer, toolName: string): RegisteredTool {
  const tool = server._registeredTools?.[toolName];
  if (!tool) {
    throw new Error(`Tool was not registered: ${toolName}`);
  }
  return tool;
}

describe("ACP client-side MCP server", () => {
  it("registers GUI_execute and ClientSideBash on the client_side server", () => {
    const server = createClientSideMcpServer() as InspectableMcpServer;

    expect(server.server._serverInfo?.name).toBe(CLIENT_SIDE_MCP_SERVER_NAME);
    expect(getTool(server, GUI_EXECUTE_TOOL_NAME).description).toContain("GUI action");
    expect(getTool(server, CLIENT_SIDE_BASH_TOOL_NAME).description).toContain("The only input is `script`");
  });

  it("forwards GUI_execute through the client_side MCP tool prefix", async () => {
    const requests: ClientSideClientToolRequest[] = [];
    const server = createClientSideMcpServer({
      sessionId: "session-1",
      requestClientTool: async (request) => {
        requests.push(request);
        return { content: [{ type: "text", text: "ok" }] };
      },
    }) as InspectableMcpServer;

    const result = await getTool(server, GUI_EXECUTE_TOOL_NAME).handler({
      action: "list_actions",
    });

    expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      sessionId: "session-1",
      toolName: "mcp__client_side__GUI_execute",
      input: {
        action: "list_actions",
      },
    });
  });

  it("forwards ClientSideBash with only script input to the client-side tool bridge", async () => {
    const requests: ClientSideClientToolRequest[] = [];
    const server = createClientSideMcpServer({
      sessionId: "session-1",
      requestClientTool: async (request) => {
        requests.push(request);
        return { content: [{ type: "text", text: "ok" }] };
      },
    }) as InspectableMcpServer;

    const result = await getTool(server, CLIENT_SIDE_BASH_TOOL_NAME).handler({
      script: "gui execute --json '{\"action\":\"list_actions\"}'",
    });

    expect(result).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      sessionId: "session-1",
      toolName: "mcp__client_side__ClientSideBash",
      input: {
        script: "gui execute --json '{\"action\":\"list_actions\"}'",
      },
    });
    expect(Object.keys(requests[0].input)).toEqual(["script"]);
  });
});
