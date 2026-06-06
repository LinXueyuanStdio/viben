import type * as ClaudeAgentSdk from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { resolveSdkMcpServers } from "../sdk-mcp-registry";

interface CapturedTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: unknown) => unknown;
}

interface CapturedServer {
  name: string;
  version: string;
  tools: CapturedTool[];
}

function createSdkStub(): typeof ClaudeAgentSdk {
  return {
    createSdkMcpServer: (config: CapturedServer) => config,
    tool: (
      name: string,
      description: string,
      schema: Record<string, unknown>,
      handler: (args: unknown) => unknown
    ) => ({ name, description, schema, handler }),
  } as unknown as typeof ClaudeAgentSdk;
}

describe("client-side SDK MCP server", () => {
  it("exposes GUI_execute and ClientSideBash from the unified client_side server", () => {
    const servers = resolveSdkMcpServers(createSdkStub(), ["client_side"], {
      sessionId: "session-1",
    });
    const server = servers.client_side as unknown as CapturedServer;

    expect(server.name).toBe("client_side");
    expect(server.tools.map((tool) => tool.name)).toEqual(["GUI_execute", "ClientSideBash"]);
  });

  it("keeps ClientSideBash limited to the required script input", () => {
    const servers = resolveSdkMcpServers(createSdkStub(), ["client_side"], {
      sessionId: "session-1",
    });
    const server = servers.client_side as unknown as CapturedServer;
    const tool = server.tools.find((item) => item.name === "ClientSideBash");

    expect(tool).toBeDefined();
    expect(Object.keys(tool?.schema ?? {})).toEqual(["script"]);
    expect(tool?.description).toContain("The only input is `script`");
    expect(tool?.description).toContain("do not pass raw GUI_execute-style `action` or `payload` fields");
    expect(tool?.description).toContain("gui execute --json");
  });

  it("does not register old split server names", () => {
    const servers = resolveSdkMcpServers(createSdkStub(), ["gui_action", "client_side_bash"], {
      sessionId: "session-1",
    });

    expect(servers).toEqual({});
  });
});
