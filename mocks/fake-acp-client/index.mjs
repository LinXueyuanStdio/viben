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
const testCase = args.case ?? "default";
const cwd = args.cwd ?? repoRoot;
const expectedClientTool = args.expectClientTool;
const agentConfig = parseJsonArg(args.agentConfigJson, "agent-config-json");
const requestTimeoutMs = Number(args.requestTimeoutMs ?? 30_000);
const permissionResponse = args.permissionResponse ?? "allow";

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
    this.clientRequests = [];
  }

  request(method, params = {}) {
    const id = this.nextId++;
    const frame = { jsonrpc: "2.0", id, method, params };
    log(this.name, "OUT request", frame);
    this.sendFrame(frame);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`request timed out after ${requestTimeoutMs}ms: ${method}`));
      }, requestTimeoutMs);
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
        pending.reject(new Error(formatJsonRpcError(frame.error)));
      } else {
        pending.resolve(frame.result);
      }
      return;
    }

    if (frame && typeof frame === "object" && frame.method) {
      if ("id" in frame) {
        log(this.name, "IN client-call", frame);
        this.clientRequests.push(frame);
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
      const result = executeClientTool(frame.params);
      const response = {
        jsonrpc: "2.0",
        id: frame.id,
        result,
      };
      log(this.name, "OUT client-call response", response);
      this.sendFrame(response);
      return;
    }

    if (frame.method === "session/request_permission") {
      const result = selectPermissionOutcome(frame.params);
      const response = {
        jsonrpc: "2.0",
        id: frame.id,
        result,
      };
      log(this.name, "OUT permission response", response);
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
    agent_config: agentConfig ?? undefined,
    agent_config_path: args.agentConfigPath,
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
    clientRequests: peer.clientRequests,
  };
}

async function runFakeCliControl(env = {}) {
  log("stdio", "starting fake ACP CLI", { fakeCliPath, env });
  const child = spawn(process.execPath, [fakeCliPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
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

  const result = await runProtocol(peer, cwd);
  child.kill("SIGTERM");
  log("stdio", "summary", summarizeResult(result));
  assertExpectedClientTool(result);
  return result;
}

async function runWebSocketEndpoint(section = "ws") {
  log(section, "connecting", { wsUrl });

  const ws = new WebSocket(wsUrl, ["acp.v1"]);
  const peer = new RpcPeer(section, (frame) => {
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
      log(section, "open");
      resolve();
    });
    ws.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

  try {
    const result = await runProtocol(peer, cwd);
    log(section, "summary", summarizeResult(result));
    assertExpectedClientTool(result);
    if (args.failOnPromptError && result.prompt?.error) {
      throw new Error(`Prompt failed: ${result.prompt.error}`);
    }
    return result;
  } finally {
    peer.rejectAll(new Error("websocket closed"));
    ws.close(1000, "fake client finished");
  }
}

async function runGuiExecuteCase() {
  const result = await runFakeCliControl({ FAKE_ACP_TRIGGER_GUI_EXECUTE: "1" });
  const clientCalls = result.clientRequests.filter((frame) => frame.method === "_viben/client_tool_call");
  const summary = summarizeResult(result);
  log("case", "gui-execute summary", {
    ...summary,
    clientCallCount: clientCalls.length,
  });
  if (summary.stopReason !== "end_turn") {
    throw new Error(`GUI_execute case expected end_turn, got ${summary.stopReason ?? "missing"}`);
  }
  assertExpectedClientTool(result, "GUI_execute");
  return result;
}

async function runPermissionCase() {
  const result = await runFakeCliControl({ FAKE_ACP_TRIGGER_PERMISSION: "1" });
  const summary = summarizeResult(result);
  log("case", "permission summary", summary);
  if (summary.stopReason !== "end_turn") {
    throw new Error(`permission case expected end_turn, got ${summary.stopReason ?? "missing"}`);
  }
  if (!summary.permissionRequests.length) {
    throw new Error("permission case expected at least one session/request_permission client-call");
  }
  return result;
}

async function runRealAcpCase() {
  const result = await runWebSocketEndpoint("real-acp");
  log("case", "real-acp summary", summarizeResult(result));
  return result;
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
    clientRequestCount: result.clientRequests?.length ?? 0,
    permissionRequests: (result.clientRequests ?? [])
      .filter((frame) => frame.method === "session/request_permission")
      .map((frame) => ({
        sessionId: frame.params?.sessionId,
        toolCallId: frame.params?.toolCall?.toolCallId,
        title: frame.params?.toolCall?.title,
        kind: frame.params?.toolCall?.kind,
        rawInput: frame.params?.toolCall?.rawInput,
        options: frame.params?.options,
      })),
    clientToolNames: (result.clientRequests ?? [])
      .filter((frame) => frame.method === "_viben/client_tool_call")
      .map((frame) => frame.params?.toolName),
    guiActions: (result.clientRequests ?? [])
      .filter((frame) => frame.method === "_viben/client_tool_call")
      .map((frame) => frame.params?.input?.action)
      .filter(Boolean),
    updateTypes: result.notifications
      .filter((frame) => frame.method === "session/update")
      .map((frame) => frame.params?.update?.sessionUpdate),
  };
}

function assertExpectedClientTool(result, fallbackTool) {
  const expected = expectedClientTool ?? fallbackTool;
  if (!expected) return;
  const toolNames = (result.clientRequests ?? [])
    .filter((frame) => frame.method === "_viben/client_tool_call")
    .map((frame) => frame.params?.toolName);
  if (!toolNames.some((toolName) => isExpectedToolName(toolName, expected))) {
    throw new Error(`Expected client tool ${expected}, got ${toolNames.length ? toolNames.join(", ") : "none"}`);
  }
}

function isExpectedToolName(actual, expected) {
  if (actual === expected) return true;
  if (expected === "GUI_execute" && actual === "mcp__gui_action__GUI_execute") return true;
  return false;
}

function executeClientTool(params) {
  const toolName = params?.toolName ?? "unknown tool";
  if (toolName !== "GUI_execute" && toolName !== "mcp__gui_action__GUI_execute") {
    return {
      content: [{ type: "text", text: `fake client has no handler for ${toolName}` }],
      isError: true,
    };
  }

  const input = params?.input && typeof params.input === "object" ? params.input : {};
  const action = typeof input.action === "string" ? input.action : "";
  if (action === "list_actions") {
    return {
      content: [{ type: "text", text: JSON.stringify(getFakeActions(), null, 2) }],
      _meta: { actions: getFakeActions() },
    };
  }
  if (action === "get_action_detail") {
    const requested = input.payload?.action ?? input.payload?.name;
    const detail = getFakeActions().find((item) => item.name === requested);
    if (!detail) {
      return {
        content: [{ type: "text", text: `Action not found: ${requested ?? "(missing)"}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(detail, null, 2) }],
      _meta: { action: detail },
    };
  }
  return {
    content: [{ type: "text", text: `fake client executed ${action || "missing action"}` }],
    isError: !action,
    _meta: {
      action,
      payload: input.payload ?? {},
      sessionId: params?.sessionId,
      toolUseId: params?.toolUseId,
    },
  };
}

function selectPermissionOutcome(params) {
  const options = Array.isArray(params?.options) ? params.options : [];
  log("permission", "request detail", {
    sessionId: params?.sessionId,
    toolCall: params?.toolCall,
    options,
    configuredResponse: permissionResponse,
  });

  if (permissionResponse === "cancel") {
    return { outcome: { outcome: "cancelled" } };
  }

  const matcher = permissionResponse === "reject"
    ? (option) => String(option?.kind ?? "").startsWith("reject") || /reject|deny|no/i.test(String(option?.optionId ?? option?.name ?? ""))
    : (option) => String(option?.kind ?? "").startsWith("allow") || /allow|accept|yes|default/i.test(String(option?.optionId ?? option?.name ?? ""));

  const selected = options.find(matcher) ?? options[0] ?? { optionId: permissionResponse === "reject" ? "reject" : "allow" };
  return {
    outcome: {
      outcome: "selected",
      optionId: selected.optionId,
    },
  };
}

function getFakeActions() {
  return [
    {
      name: "app.open_settings",
      description: "Open the app settings panel.",
      input_schema: {
        type: "object",
        properties: {
          section: { type: "string", enum: ["general", "models", "tools"] },
        },
      },
    },
  ];
}

function formatJsonRpcError(error) {
  if (!error) return "JSON-RPC error";
  if (error.data === undefined) return error.message ?? "JSON-RPC error";
  return `${error.message ?? "JSON-RPC error"}\n${JSON.stringify(error.data, null, 2)}`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") parsed.url = argv[++i];
    else if (arg === "--case") parsed.case = argv[++i];
    else if (arg === "--cwd") parsed.cwd = argv[++i];
    else if (arg === "--agent-config-json") parsed.agentConfigJson = argv[++i];
    else if (arg === "--agent-config-path") parsed.agentConfigPath = argv[++i];
    else if (arg === "--expect-client-tool") parsed.expectClientTool = argv[++i];
    else if (arg === "--log") parsed.log = argv[++i];
    else if (arg === "--prompt") parsed.prompt = argv[++i];
    else if (arg === "--fake-cli") parsed.fakeCli = argv[++i];
    else if (arg === "--skip-stdio") parsed.skipStdio = true;
    else if (arg === "--skip-ws") parsed.skipWs = true;
    else if (arg === "--fail-on-prompt-error") parsed.failOnPromptError = true;
    else if (arg === "--request-timeout-ms") parsed.requestTimeoutMs = argv[++i];
    else if (arg === "--permission-response") parsed.permissionResponse = argv[++i];
  }
  return parsed;
}

function parseJsonArg(value, label) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid --${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  log("main", "fake ACP client started", {
    logPath,
    wsUrl,
    fakeCliPath,
    promptText,
    testCase,
    cwd,
    expectedClientTool,
    requestTimeoutMs,
    agentConfig,
  });

  if (testCase === "gui-execute") {
    try {
      await runGuiExecuteCase();
    } catch (error) {
      log("case", "gui-execute failed", error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    }
    log("main", "fake ACP client finished");
    await new Promise((resolve) => logStream.end(resolve));
    return;
  }

  if (testCase === "permission") {
    try {
      await runPermissionCase();
    } catch (error) {
      log("case", "permission failed", error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    }
    log("main", "fake ACP client finished");
    await new Promise((resolve) => logStream.end(resolve));
    return;
  }

  if (testCase === "real-acp") {
    try {
      await runRealAcpCase();
    } catch (error) {
      log("case", "real-acp failed", error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    }
    log("main", "fake ACP client finished");
    await new Promise((resolve) => logStream.end(resolve));
    return;
  }

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
