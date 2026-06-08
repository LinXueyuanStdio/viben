#!/usr/bin/env npx tsx
/**
 * ACP WebSocket流测试脚本
 * 用于dump完整的ACP通信流程，自动批准权限请求
 *
 * Usage:
 *   npx tsx test-acp-dump.ts [options]
 *
 * Options:
 *   --url <url>      WebSocket URL (default: ws://127.0.0.1:18790/ws/agent/acp?cwd=/root/viben)
 *   --output <file>  Output file (default: ./acp-dump.jsonl)
 *   --prompt <text>  Prompt to send (default: "用子 agent 详细看一下本项目结构")
 *   --timeout <ms>   Timeout in milliseconds (default: 300000 = 5 minutes)
 *   --model <model>  Model to use (default: claude-sonnet-4-5-20250514)
 */

import WebSocket from "ws";

// Parse command line arguments
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const WS_URL = getArg("url", "ws://127.0.0.1:18790/ws/agent/acp?cwd=/root/viben");
const OUTPUT_FILE = getArg("output", "./acp-dump.jsonl");
const PROMPT = getArg("prompt", "用子 agent 详细看一下本项目结构，特别关注 packages/core 目录");
const TIMEOUT = parseInt(getArg("timeout", "300000"), 10);
const MODEL = getArg("model", "claude-sonnet-4-5-20250514");

interface AcpMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

const fs = await import("fs");

// 清空或创建输出文件
fs.writeFileSync(OUTPUT_FILE, "");

function log(direction: "send" | "recv", message: AcpMessage) {
  const entry = {
    timestamp: new Date().toISOString(),
    direction,
    message,
  };
  fs.appendFileSync(OUTPUT_FILE, JSON.stringify(entry) + "\n");
  console.log(`[${direction.toUpperCase()}]`, JSON.stringify(message, null, 2).slice(0, 500));
}

async function main() {
  console.log("=== ACP WebSocket Test ===");
  console.log("URL:", WS_URL);
  console.log("Output:", OUTPUT_FILE);
  console.log("Prompt:", PROMPT.slice(0, 50) + (PROMPT.length > 50 ? "..." : ""));
  console.log("Model:", MODEL);
  console.log("Timeout:", TIMEOUT / 1000, "seconds");
  console.log("");

  const ws = new WebSocket(WS_URL);
  let messageId = 0;
  let sessionId: string | null = null;

  function send(method: string, params: unknown = {}) {
    const msg: AcpMessage = {
      jsonrpc: "2.0",
      id: ++messageId,
      method,
      params,
    };
    log("send", msg);
    ws.send(JSON.stringify(msg));
    return messageId;
  }

  ws.on("open", async () => {
    console.log("WebSocket connected!");

    // 1. Initialize (matching acp-client.ts format)
    send("initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
        elicitation: { form: {}, url: {} },
        _vibenClientTools: {
          enabled: true,
          tools: ["GUI_execute", "mcp__client_side__GUI_execute"],
          actionRegistry: "editable",
        },
      },
      clientInfo: {
        name: "acp-test-dump",
        title: "ACP Test Dump Script",
        version: "1.0.0",
      },
    });
  });

  ws.on("message", async (data) => {
    const message = JSON.parse(data.toString()) as AcpMessage;
    log("recv", message);

    // Handle initialize response
    if (message.id === 1 && message.result) {
      console.log("\n=== Initialized, creating session ===\n");

      // Extract cwd from URL query params
      const urlObj = new URL(WS_URL);
      const cwd = urlObj.searchParams.get("cwd") || process.cwd();

      // 2. Create session
      send("session/new", {
        cwd,
        mcpServers: [],
        agent_config: {
          model: MODEL,
          system_prompt: "You are a helpful assistant. Use Agent tool to spawn subagents for detailed analysis when needed.",
          max_turns: 50,
        },
      });
    }

    // Handle session/new response
    if (message.result && typeof message.result === "object" && "sessionId" in message.result) {
      sessionId = (message.result as { sessionId: string }).sessionId;
      console.log("\n=== Session created:", sessionId, "===\n");

      // 3. Send prompt
      setTimeout(() => {
        send("session/prompt", {
          sessionId,
          prompt: [{ type: "text", text: PROMPT }],
        });
      }, 500);
    }

    // Handle session update notifications
    if (message.method === "session/update") {
      const update = (message.params as { update?: { sessionUpdate?: string } })?.update;
      if (update?.sessionUpdate === "turn_complete") {
        console.log("\n=== Turn complete (via session/update) ===\n");
        setTimeout(() => {
          console.log("\n=== Test complete ===");
          console.log("Dump saved to:", OUTPUT_FILE);
          ws.close();
          process.exit(0);
        }, 2000);
      }
    }

    // Handle session/prompt response (turn complete)
    if (message.id === 3 && message.result && typeof message.result === "object") {
      const result = message.result as { stopReason?: string };
      if (result.stopReason === "end_turn" || result.stopReason === "tool_use") {
        console.log(`\n=== Turn complete (stopReason: ${result.stopReason}) ===\n`);
        setTimeout(() => {
          console.log("\n=== Test complete ===");
          console.log("Dump saved to:", OUTPUT_FILE);
          ws.close();
          process.exit(0);
        }, 2000);
      }
    }

    // Handle permission requests - auto approve with "allow_always"
    if (message.method === "session/request_permission" && message.id !== undefined) {
      const params = message.params as {
        options?: Array<{ optionId: string; kind: string; name: string }>;
        toolCall?: { title?: string };
      };
      const allowOption = params.options?.find(
        (opt) => opt.kind === "allow_always" || opt.kind === "allow_once" || opt.optionId === "allow"
      );
      const optionId = allowOption?.optionId ?? "allow";
      const title = params.toolCall?.title ?? "unknown";

      console.log(`\n=== Auto-approving: "${title}" (optionId: ${optionId}) ===\n`);

      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: { outcome: { outcome: "selected", optionId } },
      };
      log("send", response as AcpMessage);
      ws.send(JSON.stringify(response));
    }

    // Handle elicitation requests - auto approve
    if (message.method === "session/elicitation" && message.id !== undefined) {
      console.log(`\n=== Auto-responding to elicitation (id: ${message.id}) ===\n`);
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: { outcome: "approved", response: {} },
      };
      log("send", response as AcpMessage);
      ws.send(JSON.stringify(response));
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("WebSocket closed");
  });

  // Timeout
  setTimeout(() => {
    console.log("\n=== Timeout reached ===");
    console.log("Dump saved to:", OUTPUT_FILE);
    ws.close();
    process.exit(1);
  }, TIMEOUT);
}

main().catch(console.error);
