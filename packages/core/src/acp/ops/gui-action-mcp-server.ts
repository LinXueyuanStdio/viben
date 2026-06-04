#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const sessionId = process.env.VIBEN_ACP_SESSION_ID;
const gatewayUrl = (process.env.VIBEN_GATEWAY_URL ?? "http://127.0.0.1:18790").replace(/\/+$/, "");

const server = new McpServer({
  name: "gui_action",
  version: "1.0.0",
});

server.tool(
  "GUI_execute",
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

    const response = await fetch(`${gatewayUrl}/api/client-tools/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        tool_use_id: `gui-${randomUUID()}`,
        tool_name: "mcp__gui_action__GUI_execute",
        input,
      }),
    });

    const body = await response.json().catch(() => undefined) as { success?: boolean; result?: CallToolResult; error?: string } | undefined;
    if (!response.ok || !body?.success) {
      return errorResult(body?.error ?? `GUI_execute request failed with HTTP ${response.status}.`);
    }
    return body.result ?? errorResult("GUI_execute request completed without a tool result.");
  }
);

function errorResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
    isError: true,
  };
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`[gui_action_mcp] ${message}\n`);
  process.exitCode = 1;
});
