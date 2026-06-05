/**
 * ClientSideBash MCP Server
 *
 * Provides the ClientSideBash tool for agents to run a just-bash script in the
 * desktop client. Desktop exposes GUI actions as bash commands, so agents can
 * automate local UI operations through a single script argument.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ClientToolCancelledError, clientToolCompletionRegistry } from "../../../services/client-tool-completion";
import { registerSdkMcpServer } from "../sdk-mcp-registry";

registerSdkMcpServer("client_side_bash", (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;

  const sessionId = context?.sessionId;

  function error(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }

  async function safeWaitForClient(sid: string): Promise<CallToolResult> {
    try {
      return await clientToolCompletionRegistry.waitForClient(sid, undefined, "ClientSideBash");
    } catch (err) {
      if (err instanceof ClientToolCancelledError) {
        return { content: [{ type: "text" as const, text: "ClientSideBash cancelled by user." }], isError: true };
      }
      throw err;
    }
  }

  clientToolCompletionRegistry.registerToolOptions("ClientSideBash", { timeoutMs: 60_000 });

  return createSdkMcpServer({
    name: "client_side_bash",
    version: "1.0.0",
    tools: [
      tool(
        "ClientSideBash",
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
          return await safeWaitForClient(sessionId);
        }
      ),
    ],
  });
});
