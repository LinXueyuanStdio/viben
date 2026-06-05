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

describe("ClientSideBash SDK MCP server", () => {
  it("exposes only the required script input", () => {
    const servers = resolveSdkMcpServers(createSdkStub(), ["client_side_bash"], {
      sessionId: "session-1",
    });
    const server = servers.client_side_bash as unknown as CapturedServer;
    const tool = server.tools[0];

    expect(tool.name).toBe("ClientSideBash");
    expect(Object.keys(tool.schema)).toEqual(["script"]);
    expect(tool.description).toContain("The only input is `script`");
    expect(tool.description).toContain("do not pass raw GUI_execute-style `action` or `payload` fields");
    expect(tool.description).toContain("gui execute --json");
  });
});
