/**
 * Client-side MCP Server
 *
 * Provides tools that execute in the desktop client instead of the backend.
 * The SDK handlers validate the agent-visible contract, then wait for the
 * desktop client to return the tool result through ClientToolCompletionRegistry.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ClientToolCancelledError, clientToolCompletionRegistry } from "../../../services/client-tool-completion";
import { registerSdkMcpServer, type McpServerFactory } from "../sdk-mcp-registry";

const CLIENT_SIDE_MCP_SERVER_NAME = "client_side";
const GUI_EXECUTE_TOOL_NAME = "GUI_execute";
const CLIENT_SIDE_BASH_TOOL_NAME = "ClientSideBash";
const CLIENT_TOOL_TIMEOUT_MS = 60_000;

function error(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function safeWaitForClient(
  sessionId: string,
  toolName: typeof GUI_EXECUTE_TOOL_NAME | typeof CLIENT_SIDE_BASH_TOOL_NAME
): Promise<CallToolResult> {
  try {
    return await clientToolCompletionRegistry.waitForClient(sessionId, undefined, toolName);
  } catch (err) {
    if (err instanceof ClientToolCancelledError) {
      const label = toolName === GUI_EXECUTE_TOOL_NAME ? "GUI action" : CLIENT_SIDE_BASH_TOOL_NAME;
      return { content: [{ type: "text" as const, text: `${label} cancelled by user.` }], isError: true };
    }
    throw err;
  }
}

const createClientSideMcpServer: McpServerFactory = (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;
  const sessionId = context?.sessionId;

  clientToolCompletionRegistry.registerToolOptions(GUI_EXECUTE_TOOL_NAME, { timeoutMs: CLIENT_TOOL_TIMEOUT_MS });
  clientToolCompletionRegistry.registerToolOptions(CLIENT_SIDE_BASH_TOOL_NAME, { timeoutMs: CLIENT_TOOL_TIMEOUT_MS });

  return createSdkMcpServer({
    name: CLIENT_SIDE_MCP_SERVER_NAME,
    version: "1.0.0",
    tools: [
      tool(
        GUI_EXECUTE_TOOL_NAME,
        "执行桌面应用的 GUI action。使用 list_actions 查看当前可用 action，使用 get_action_detail 查看 action 详情和参数定义。内置 action：list_actions, get_action_detail, read_window, navigate_to。",
        {
          action: z.string().describe("完整 action 名称。内置 action 无需前缀，自定义 action 使用 namespace.name 格式（如 chat.send_message）"),
          payload: z.record(z.string(), z.unknown()).optional().describe("action 输入参数，具体结构由 get_action_detail 返回的 input_schema 定义"),
        },
        async (args) => {
          const { action } = args as { action: string; payload?: Record<string, unknown> };
          if (!action) {
            return error("Error: action field is required");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId, GUI_EXECUTE_TOOL_NAME);
        }
      ),
      tool(
        CLIENT_SIDE_BASH_TOOL_NAME,
        [
          "Run a just-bash script inside the Viben desktop client.",
          "Use this for client-side desktop automation that must happen in the user's running app, such as invoking GUI actions, reading command output, or chaining several local UI operations.",
          "The only input is `script`; do not pass raw GUI_execute-style `action` or `payload` fields.",
          "To invoke the GUI action system from the script, call `gui execute --json '{\"action\":\"action_name\",\"payload\":{...}}'`.",
          "For discovery, call `gui execute --json '{\"action\":\"list_actions\"}'` first, then compose subsequent commands from the returned action names and schemas.",
          "Return values include stdout, stderr, and exit_code. Non-zero exit codes are treated as tool errors.",
        ].join(" "),
        {
          script: z.string().describe("Required just-bash script to execute in the desktop client. Use `gui execute --json '...'` inside this script when you need GUI actions."),
        },
        async (args) => {
          const { script } = args as { script?: string };
          if (!script?.trim()) {
            return error("Error: script field is required");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side bash execution");
          }
          return await safeWaitForClient(sessionId, CLIENT_SIDE_BASH_TOOL_NAME);
        }
      ),
    ],
  });
};

registerSdkMcpServer(CLIENT_SIDE_MCP_SERVER_NAME, createClientSideMcpServer);

// Compatibility aliases for existing configs and persisted sessions.
registerSdkMcpServer("gui_action", createClientSideMcpServer);
registerSdkMcpServer("client_side_bash", createClientSideMcpServer);
