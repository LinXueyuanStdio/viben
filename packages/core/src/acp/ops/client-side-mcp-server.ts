#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const CLIENT_SIDE_MCP_SERVER_NAME = "client_side";
export const GUI_EXECUTE_TOOL_NAME = "GUI_execute";
export const CLIENT_SIDE_BASH_TOOL_NAME = "ClientSideBash";

export interface ClientSideMcpServerOptions {
  sessionId?: string;
  gatewayUrl?: string;
  requestClientTool?: (request: ClientSideClientToolRequest) => Promise<CallToolResult>;
}

export interface ClientSideClientToolRequest {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: {
    action?: string;
    payload?: Record<string, unknown>;
    script?: string;
  };
}

export function createClientSideMcpServer(options: ClientSideMcpServerOptions = {}): McpServer {
  const sessionId = options.sessionId ?? process.env.VIBEN_ACP_SESSION_ID;
  const gatewayUrl = (options.gatewayUrl ?? process.env.VIBEN_GATEWAY_URL ?? "http://127.0.0.1:18790").replace(/\/+$/, "");

  const server = new McpServer({
    name: CLIENT_SIDE_MCP_SERVER_NAME,
    version: "1.0.0",
  });

  server.tool(
    GUI_EXECUTE_TOOL_NAME,
    "执行桌面应用的 GUI action。使用 list_actions 查看当前可用 action，使用 get_action_detail 查看 action 详情和参数定义。内置 action：list_actions, get_action_detail, read_window, navigate_to。",
    {
      action: z.string().describe("完整 action 名称。内置 action 无需前缀，自定义 action 使用 namespace.name 格式（如 chat.send_message）"),
      payload: z.record(z.string(), z.unknown()).optional().describe("action 输入参数，具体结构由 get_action_detail 返回的 input_schema 定义"),
    },
    async (args): Promise<CallToolResult> => {
      if (!sessionId) {
        return errorResult("Error: VIBEN_ACP_SESSION_ID is required for GUI_execute.");
      }

      const input = args as { action?: string; payload?: Record<string, unknown> };
      if (!input.action) {
        return errorResult("Error: action field is required.");
      }

      return await requestClientSideTool({
        options,
        gatewayUrl,
        sessionId,
        toolCallId: `gui-${randomUUID()}`,
        toolName: `mcp__${CLIENT_SIDE_MCP_SERVER_NAME}__${GUI_EXECUTE_TOOL_NAME}`,
        input,
        errorLabel: GUI_EXECUTE_TOOL_NAME,
      });
    }
  );

  server.tool(
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
    async (args): Promise<CallToolResult> => {
      if (!sessionId) {
        return errorResult("Error: VIBEN_ACP_SESSION_ID is required for ClientSideBash.");
      }

      const input = args as { script?: string };
      if (!input.script?.trim()) {
        return errorResult("Error: script field is required.");
      }

      return await requestClientSideTool({
        options,
        gatewayUrl,
        sessionId,
        toolCallId: `bash-${randomUUID()}`,
        toolName: `mcp__${CLIENT_SIDE_MCP_SERVER_NAME}__${CLIENT_SIDE_BASH_TOOL_NAME}`,
        input: { script: input.script },
        errorLabel: CLIENT_SIDE_BASH_TOOL_NAME,
      });
    }
  );

  return server;
}

interface RequestClientSideToolOptions {
  options: ClientSideMcpServerOptions;
  gatewayUrl: string;
  sessionId: string;
  toolCallId: string;
  toolName: string;
  input: ClientSideClientToolRequest["input"];
  errorLabel: string;
}

async function requestClientSideTool(request: RequestClientSideToolOptions): Promise<CallToolResult> {
  if (request.options.requestClientTool) {
    return await request.options.requestClientTool({
      sessionId: request.sessionId,
      toolCallId: request.toolCallId,
      toolName: request.toolName,
      input: request.input,
    });
  }

  const response = await fetch(`${request.gatewayUrl}/api/client-tools/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      session_id: request.sessionId,
      tool_call_id: request.toolCallId,
      tool_name: request.toolName,
      input: request.input,
    }),
  });

  const body = await response.json().catch(() => undefined) as { success?: boolean; result?: CallToolResult; error?: string } | undefined;
  if (!response.ok || !body?.success) {
    return errorResult(body?.error ?? `${request.errorLabel} request failed with HTTP ${response.status}.`);
  }
  return body.result ?? errorResult(`${request.errorLabel} request completed without a tool result.`);
}

function errorResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

async function main(): Promise<void> {
  const server = createClientSideMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`[client_side_mcp] ${message}\n`);
    process.exitCode = 1;
  });
}
