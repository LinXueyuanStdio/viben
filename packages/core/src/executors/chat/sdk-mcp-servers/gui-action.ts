/**
 * GUI Action MCP Server
 *
 * Provides the GUI_execute tool for agents to invoke desktop app UI actions.
 * The actual execution happens on the frontend — this handler validates input
 * and awaits the client-side completion via ClientToolCompletionRegistry.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ClientToolCancelledError, clientToolCompletionRegistry } from "../../../services/client-tool-completion";
import { registerSdkMcpServer } from "../sdk-mcp-registry";

registerSdkMcpServer("gui_action", (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require("zod");

  const sessionId = context?.sessionId;

  function error(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }

  async function safeWaitForClient(sid: string): Promise<CallToolResult> {
    try {
      return await clientToolCompletionRegistry.waitForClient(sid);
    } catch (err) {
      if (err instanceof ClientToolCancelledError) {
        return { content: [{ type: "text" as const, text: "GUI action cancelled by user." }], isError: true };
      }
      throw err;
    }
  }

  // Register as client-side tool with 60s timeout (actions may involve user interaction)
  clientToolCompletionRegistry.registerToolOptions("GUI_execute", { timeoutMs: 60_000 });

  return createSdkMcpServer({
    name: "gui_action",
    version: "1.0.0",
    tools: [
      tool(
        "GUI_execute",
        "执行桌面应用的 GUI action。使用 list_actions 查看当前可用 action，使用 get_action_detail 查看 action 详情和参数定义。内置 action：list_actions, get_action_detail, read_window, navigate_to。",
        {
          action: z.string().describe("完整 action 名称。内置 action 无需前缀，自定义 action 使用 namespace.name 格式（如 chat.send_message）"),
          payload: z.record(z.unknown()).optional().describe("action 输入参数，具体结构由 get_action_detail 返回的 input_schema 定义"),
        },
        async (args) => {
          const { action } = args as { action: string; payload?: Record<string, unknown> };
          if (!action) {
            return error("Error: action field is required");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
    ],
  });
});
