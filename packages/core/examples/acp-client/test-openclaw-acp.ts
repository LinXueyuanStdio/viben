#!/usr/bin/env npx tsx
/**
 * OpenClaw ACP WebSocket 测试脚本
 * 用于测试 OpenClaw ACP 后端通信流程
 *
 * Usage:
 *   npx tsx test-openclaw-acp.ts [options]
 *
 * Options:
 *   --url <url>      WebSocket URL (default: ws://127.0.0.1:18790/ws/agent/acp?cwd=/root/viben)
 *   --output <file>  Output file (default: ./openclaw-acp-dump.jsonl)
 *   --prompt <text>  Prompt to send (default: "What is 2+2? Just give me the answer.")
 *   --timeout <ms>   Timeout in milliseconds (default: 120000 = 2 minutes)
 */

import WebSocket from "ws";

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const WS_URL = getArg("url", "ws://127.0.0.1:18790/ws/agent/acp?cwd=/root/viben");
const OUTPUT_FILE = getArg("output", "./openclaw-acp-dump.jsonl");
const PROMPT = getArg("prompt", "What is 2+2? Just give me the answer.");
const TIMEOUT = parseInt(getArg("timeout", "120000"), 10);

interface AcpMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

const fs = await import("fs");

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
  console.log("=== OpenClaw ACP WebSocket Test ===");
  console.log("URL:", WS_URL);
  console.log("Output:", OUTPUT_FILE);
  console.log("Prompt:", PROMPT.slice(0, 50) + (PROMPT.length > 50 ? "..." : ""));
  console.log("Executor Type: OPENCLAW");
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
        name: "openclaw-acp-test",
        title: "OpenClaw ACP Test Script",
        version: "1.0.0",
      },
    });
  });

  ws.on("message", async (data) => {
    const message = JSON.parse(data.toString()) as AcpMessage;
    log("recv", message);

    if (message.id === 1 && message.result) {
      console.log("\n=== Initialized, creating OpenClaw session ===\n");

      const urlObj = new URL(WS_URL);
      const cwd = urlObj.searchParams.get("cwd") || process.cwd();

      send("session/new", {
        cwd,
        mcpServers: [],
        agent_config: {
          executor_type: "OPENCLAW",
          max_turns: 10,
        },
      });
    }

    if (message.result && typeof message.result === "object" && "sessionId" in message.result) {
      sessionId = (message.result as { sessionId: string }).sessionId;
      console.log("\n=== OpenClaw session created:", sessionId, "===\n");

      setTimeout(() => {
        send("session/prompt", {
          sessionId,
          prompt: [{ type: "text", text: PROMPT }],
        });
      }, 500);
    }

    if (message.method === "session/update") {
      const update = (message.params as { update?: { sessionUpdate?: string } })?.update;
      if (update?.sessionUpdate === "turn_complete") {
        console.log("\n=== Turn complete (via session/update) ===\n");
        setTimeout(() => {
          console.log("\n=== OpenClaw ACP Test complete ===");
          console.log("Dump saved to:", OUTPUT_FILE);
          ws.close();
          process.exit(0);
        }, 2000);
      }
    }

    if (message.id === 3 && message.result && typeof message.result === "object") {
      const result = message.result as { stopReason?: string };
      if (result.stopReason === "end_turn" || result.stopReason === "tool_use") {
        console.log(`\n=== Turn complete (stopReason: ${result.stopReason}) ===\n`);
        setTimeout(() => {
          console.log("\n=== OpenClaw ACP Test complete ===");
          console.log("Dump saved to:", OUTPUT_FILE);
          ws.close();
          process.exit(0);
        }, 2000);
      }
    }

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

    if (message.error) {
      console.error("\n=== Error received ===");
      console.error(JSON.stringify(message.error, null, 2));
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", () => {
    console.log("WebSocket closed");
  });

  setTimeout(() => {
    console.log("\n=== Timeout reached ===");
    console.log("Dump saved to:", OUTPUT_FILE);
    ws.close();
    process.exit(1);
  }, TIMEOUT);
}

main().catch(console.error);
