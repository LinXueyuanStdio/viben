import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createPythonMcpServer, PYTHON_MCP_SERVER_NAME, EXECUTE_CODE_TOOL_NAME, LOAD_SKILL_TOOL_NAME } from "../mcp-server";
import type { SessionManager } from "../session-manager";
import type { SkillRegistry } from "../skill-registry";
import type { JupyterClient } from "../jupyter-client";

type RegisteredTool = {
  description?: string;
  inputSchema?: unknown;
  handler: (args: unknown) => Promise<CallToolResult>;
};

type InspectableMcpServer = {
  _registeredTools?: Record<string, RegisteredTool>;
  server: { _serverInfo?: { name?: string } };
};

describe("createPythonMcpServer", () => {
  let mockSessionManager: SessionManager;
  let mockSkillRegistry: SkillRegistry;
  let mockJupyterClient: JupyterClient;

  beforeEach(() => {
    mockSessionManager = {
      getActiveKernel: vi.fn().mockResolvedValue("test-kernel-id"),
      recordCode: vi.fn().mockResolvedValue("c_001"),
      recordResult: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionManager;

    mockSkillRegistry = {
      getSkill: vi.fn().mockResolvedValue({
        name: "pandas",
        description: "Data analysis",
        code_for_agent: "import pandas as pd",
        code_for_interpreter: "import pandas as pd\nprint('init')",
      }),
    } as unknown as SkillRegistry;

    mockJupyterClient = {
      executeCode: vi.fn().mockResolvedValue({
        status: "ok",
        outputs: [{ type: "stream", stream_name: "stdout", text: "hello\n" }],
      }),
    } as unknown as JupyterClient;
  });

  it("should create server with correct name", () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    expect(inspectable.server._serverInfo?.name).toBe(PYTHON_MCP_SERVER_NAME);
  });

  it("should register execute_code and load_skill tools", () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    const tools = inspectable._registeredTools ?? {};
    expect(EXECUTE_CODE_TOOL_NAME in tools).toBe(true);
    expect(LOAD_SKILL_TOOL_NAME in tools).toBe(true);
  });

  it("execute_code should return multimodal content and structuredContent", async () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    const handler = inspectable._registeredTools?.[EXECUTE_CODE_TOOL_NAME]?.handler;
    expect(handler).toBeDefined();

    const result = await handler!({ code: "print('hello')", description: "test" });

    expect(result.content).toEqual([{ type: "text", text: "hello\n" }]);
    expect(result.structuredContent).toMatchObject({
      code_id: "c_001",
      kernel_id: "test-kernel-id",
      status: "ok",
    });
    expect(result.isError).toBeUndefined();
  });

  it("load_skill should execute code_for_interpreter and return prompt", async () => {
    const server = createPythonMcpServer({
      sessionManager: mockSessionManager,
      skillRegistry: mockSkillRegistry,
      getJupyterClient: () => mockJupyterClient,
      getAcpSessionId: () => "test-session",
    });

    const inspectable = server as unknown as InspectableMcpServer;
    const handler = inspectable._registeredTools?.[LOAD_SKILL_TOOL_NAME]?.handler;
    expect(handler).toBeDefined();

    const result = await handler!({ skill_name: "pandas" });

    expect(result.content[0]).toMatchObject({ type: "text" });
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("pandas");
    expect(text).toContain("import pandas as pd");
    expect(result.structuredContent).toMatchObject({
      skill_name: "pandas",
      status: "success",
    });
  });
});
