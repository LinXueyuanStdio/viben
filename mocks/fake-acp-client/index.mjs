#!/usr/bin/env node
/**
 * Fake ACP client for exercising ACP JSON-RPC flows.
 *
 * It runs two checks by default:
 * 1. stdio control run against mocks/fake-acp-cli
 * 2. WebSocket run against Viben's /ws/agent/acp endpoint
 *
 * The transcript is written to test-acp-client.log in this directory.
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const defaultLogPath = resolve(__dirname, "test-acp-client.log");
const defaultFakeCli = resolve(repoRoot, "mocks/fake-acp-cli/index.js");

const args = parseArgs(process.argv.slice(2));
const logPath = resolve(args.log ?? defaultLogPath);
const wsUrl = args.url ?? "ws://127.0.0.1:18790/ws/agent/acp";
const promptText = args.prompt ?? "Hello from fake ACP client";
const fakeCliPath = resolve(args.fakeCli ?? defaultFakeCli);

mkdirSync(dirname(logPath), { recursive: true });
const logStream = createWriteStream(logPath, { flags: "w" });

function log(section, message, payload) {
  const ts = new Date().toISOString();
  const line = payload === undefined
    ? `[${ts}] [${section}] ${message}`
    : `[${ts}] [${section}] ${message} ${JSON.stringify(payload)}`;
  logStream.write(`${line}\n`);
  console.log(line);
}

class RpcPeer {
  constructor(name, sendFrame) {
    this.name = name;
    this.sendFrame = sendFrame;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const frame = { jsonrpc: "2.0", id, method, params };
    log(this.name, "OUT request", frame);
    this.sendFrame(frame);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request timed out: ${method}`));
      }, 30_000);
      this.pending.set(id, { method, resolve, reject, timer });
    });
  }

  notify(method, params = {}) {
    const frame = { jsonrpc: "2.0", method, params };
    log(this.name, "OUT notification", frame);
    this.sendFrame(frame);
  }

  handle(frame) {
    if (frame && typeof frame === "object" && "id" in frame && !("method" in frame)) {
      const pending = this.pending.get(frame.id);
      log(this.name, "IN response", frame);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(frame.id);
      if (frame.error) {
        pending.reject(new Error(frame.error.message ?? "JSON-RPC error"));
      } else {
        pending.resolve(frame.result);
      }
      return;
    }

    if (frame && typeof frame === "object" && frame.method) {
      if ("id" in frame) {
        log(this.name, "IN client-call", frame);
        this.respondToServerRequest(frame);
      } else {
        log(this.name, "IN notification", frame);
        this.notifications.push(frame);
      }
      return;
    }

    log(this.name, "IN unknown", frame);
  }

  respondToServerRequest(frame) {
    if (frame.method === "_viben/client_tool_call") {
      const response = {
        jsonrpc: "2.0",
        id: frame.id,
        result: {
          content: [{
            type: "text",
            text: `fake client completed ${frame.params?.toolName ?? "unknown tool"}`,
          }],
        },
      };
      log(this.name, "OUT client-call response", response);
      this.sendFrame(response);
      return;
    }

    const response = {
      jsonrpc: "2.0",
      id: frame.id,
      error: { code: -32601, message: `Method not found: ${frame.method}` },
    };
    log(this.name, "OUT client-call error", response);
    this.sendFrame(response);
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

async function runProtocol(peer, cwd) {
  const initialize = await peer.request("initialize", {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
    },
    clientInfo: {
      name: "fake-acp-client",
      title: "Fake ACP Client",
      version: "1.0.0",
    },
  });

  const session = await peer.request("session/new", {
    cwd,
    mcpServers: [],
  });

  let prompt;
  try {
    prompt = await peer.request("session/prompt", {
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: promptText }],
    });
  } catch (error) {
    prompt = { error: error instanceof Error ? error.message : String(error) };
  }

  return {
    initialize,
    session,
    prompt,
    notifications: peer.notifications,
  };
}

async function runFakeCliControl() {
  log("stdio", "starting fake ACP CLI", { fakeCliPath });
  const child = spawn(process.execPath, [fakeCliPath], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  const peer = new RpcPeer("stdio", (frame) => {
    child.stdin.write(`${JSON.stringify(frame)}\n`);
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer = splitFrames(buffer + chunk, (frame) => peer.handle(frame));
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    for (const line of chunk.split("\n")) {
      if (line.trim()) log("stdio", "STDERR", line.trim());
    }
  });

  const result = await runProtocol(peer, repoRoot);
  child.kill("SIGTERM");
  log("stdio", "summary", summarizeResult(result));
  return result;
}

async function runWebSocketEndpoint() {
  log("ws", "connecting", { wsUrl });

  const ws = new WebSocket(wsUrl, ["acp.v1"]);
  const peer = new RpcPeer("ws", (frame) => {
    ws.send(`${JSON.stringify(frame)}\n`);
  });
  let buffer = "";

  ws.on("message", (data) => {
    buffer = splitFrames(buffer + data.toString("utf8"), (frame) => peer.handle(frame));
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`websocket connect timeout: ${wsUrl}`)), 10_000);
    ws.once("open", () => {
      clearTimeout(timer);
      log("ws", "open");
      resolve();
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  try {
    const result = await runProtocol(peer, repoRoot);
    log("ws", "summary", summarizeResult(result));
    return result;
  } finally {
    peer.rejectAll(new Error("websocket closed"));
    ws.close(1000, "fake client finished");
  }
}

function splitFrames(buffer, onFrame) {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      onFrame(JSON.parse(trimmed));
    } catch (error) {
      log("parse", "failed", {
        line: trimmed,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return rest;
}

function summarizeResult(result) {
  return {
    agentInfo: result.initialize?.agentInfo ?? result.initialize?.serverInfo,
    capabilities: result.initialize?.agentCapabilities ?? result.initialize?.serverCapabilities,
    sessionId: result.session?.sessionId,
    stopReason: result.prompt?.stopReason,
    promptError: result.prompt?.error,
    notificationCount: result.notifications.length,
    updateTypes: result.notifications
      .filter((frame) => frame.method === "session/update")
      .map((frame) => frame.params?.update?.sessionUpdate),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") parsed.url = argv[++i];
    else if (arg === "--log") parsed.log = argv[++i];
    else if (arg === "--prompt") parsed.prompt = argv[++i];
    else if (arg === "--fake-cli") parsed.fakeCli = argv[++i];
    else if (arg === "--skip-stdio") parsed.skipStdio = true;
    else if (arg === "--skip-ws") parsed.skipWs = true;
  }
  return parsed;
}

async function main() {
  log("main", "fake ACP client started", {
    logPath,
    wsUrl,
    fakeCliPath,
    promptText,
  });

  if (!args.skipStdio) {
    try {
      await runFakeCliControl();
    } catch (error) {
      log("stdio", "failed", error instanceof Error ? error.stack ?? error.message : String(error));
    }
  }

  if (!args.skipWs) {
    try {
      await runWebSocketEndpoint();
    } catch (error) {
      log("ws", "failed", error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    }
  }

  log("main", "fake ACP client finished");
  await new Promise((resolve) => logStream.end(resolve));
}

main().catch(async (error) => {
  log("main", "fatal", error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
  await new Promise((resolve) => logStream.end(resolve));
});
