#!/usr/bin/env npx tsx
/**
 * DeepSeek ClaudeCode ACP WebSocket 测试脚本
 *
 * Usage:
 *   npx tsx test-claudecode-deepseek-acp.ts [options]
 *
 * Options:
 *   --url <url>                WebSocket URL
 *   --output <file>            Output file
 *   --prompt <text>            Prompt to send
 *   --timeout <ms>             Timeout in milliseconds
 *   --agent-config-path <path> Agent AGENTS.md path
 *   --agent-dir <path>         Agent directory
 */

import * as fs from "node:fs";
import WebSocket from "ws";

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
}

const DEFAULT_CWD = "/Users/lxy/Documents/GitHub/LinXueyuanStdio/viben";
const DEFAULT_AGENT_DIR = `${DEFAULT_CWD}/.viben/agents/deepseek-claudecode`;
const DEFAULT_AGENT_CONFIG_PATH = `${DEFAULT_AGENT_DIR}/AGENTS.md`;

const WS_URL = getArg("url", `ws://127.0.0.1:18790/ws/agent/acp?cwd=${encodeURIComponent(DEFAULT_CWD)}`);
const OUTPUT_FILE = getArg("output", "./claudecode-deepseek-acp-dump.jsonl");
const PROMPT = getArg("prompt", "What is 2+2? Just give me the answer.");
const TIMEOUT = parseInt(getArg("timeout", "180000"), 10);
const AGENT_CONFIG_PATH = getArg("agent-config-path", DEFAULT_AGENT_CONFIG_PATH);
const AGENT_DIR = getArg("agent-dir", DEFAULT_AGENT_DIR);

interface AcpMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

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
  console.log("=== DeepSeek ClaudeCode ACP WebSocket Test ===");
  console.log("URL:", WS_URL);
  console.log("Output:", OUTPUT_FILE);
  console.log("Prompt:", PROMPT.slice(0, 50) + (PROMPT.length > 50 ? "..." : ""));
  console.log("Agent config:", AGENT_CONFIG_PATH);
  console.log("Agent dir:", AGENT_DIR);
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
        name: "claudecode-deepseek-acp-test",
        title: "DeepSeek ClaudeCode ACP Test Script",
        version: "1.0.0",
      },
    });
  });

  ws.on("message", async (data) => {
    const message = JSON.parse(data.toString()) as AcpMessage;
    log("recv", message);

    if (message.id === 1 && message.result) {
      console.log("\n=== Initialized, creating DeepSeek ClaudeCode session ===\n");

      const urlObj = new URL(WS_URL);
      const cwd = urlObj.searchParams.get("cwd") || process.cwd();

      send("session/new", {
        cwd,
        mcpServers: [],
        agent_config_path: AGENT_CONFIG_PATH,
        agent_dir: AGENT_DIR,
      });
    }

    if (message.result && typeof message.result === "object" && "sessionId" in message.result) {
      sessionId = (message.result as { sessionId: string }).sessionId;
      console.log("\n=== DeepSeek ClaudeCode session created:", sessionId, "===\n");

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
          console.log("\n=== DeepSeek ClaudeCode ACP Test complete ===");
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
          console.log("\n=== DeepSeek ClaudeCode ACP Test complete ===");
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
      console.log("Dump saved to:", OUTPUT_FILE);
      ws.close();
      process.exit(1);
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
