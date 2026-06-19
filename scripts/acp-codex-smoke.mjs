#!/usr/bin/env node
import WebSocket from "ws";

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? process.env.ACP_GATEWAY_URL ?? "ws://127.0.0.1:18790/ws/agent/acp";
const cwd = args.cwd ?? process.cwd();
const model = args.model ?? process.env.CODEX_SMOKE_MODEL ?? "gpt-5.4";
const provider = args.provider ?? process.env.CODEX_SMOKE_PROVIDER ?? "openai";
const prompt = args.prompt ?? "用一句中文回答：1+1等于几？";
const expected = args.expected ?? "2";
const timeoutMs = Number(args.timeoutMs ?? process.env.CODEX_SMOKE_TIMEOUT_MS ?? 300000);
const sandbox = args.sandbox ?? "read-only";

let nextId = 1;
let buffer = "";
const pending = new Map();
const updates = [];
let answer = "";
let promptError;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function splitFrames(chunk) {
  const lines = chunk.split(/\n/);
  buffer = lines.pop() ?? "";
  return lines.filter(Boolean).map((line) => JSON.parse(line));
}

function send(ws, frame) {
  if (args.verbose) console.error("->", JSON.stringify(frame));
  ws.send(`${JSON.stringify(frame)}\n`);
}

function request(ws, method, params, requestTimeoutMs = timeoutMs) {
  const id = nextId;
  nextId += 1;
  send(ws, { jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out after ${requestTimeoutMs}ms`));
    }, requestTimeoutMs);
    pending.set(id, { method, resolve, reject, timer });
  });
}

function response(ws, id, result) {
  send(ws, { jsonrpc: "2.0", id, result });
}

function handleFrame(ws, frame) {
  if (args.verbose) console.error("<-", JSON.stringify(frame));
  if (
    Object.hasOwn(frame, "id") &&
    (Object.hasOwn(frame, "result") || Object.hasOwn(frame, "error"))
  ) {
    const entry = pending.get(frame.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(frame.id);
    if (frame.error) {
      entry.reject(new Error(`${entry.method}: ${frame.error.message}`));
    } else {
      entry.resolve(frame.result);
    }
    return;
  }

  if (frame.id !== undefined && frame.method) {
    if (frame.method === "session/request_permission") {
      response(ws, frame.id, { outcome: { outcome: "selected", optionId: "allow_once" } });
      return;
    }
    if (frame.method === "_viben/client_tool_call") {
      response(ws, frame.id, {
        result: {
          content: [{ type: "text", text: "client tool unavailable in smoke test" }],
          isError: true,
        },
      });
      return;
    }
    send(ws, {
      jsonrpc: "2.0",
      id: frame.id,
      error: { code: -32601, message: `Unsupported in smoke test: ${frame.method}` },
    });
    return;
  }

  if (frame.method !== "session/update") return;
  const update = frame.params?.update;
  updates.push(update);
  if (update?.sessionUpdate === "agent_message_chunk") {
    answer += update.content?.text ?? "";
  }
  if (update?.sessionUpdate === "error") {
    promptError = update.error?.message ?? JSON.stringify(update.error);
  }
}

async function main() {
  const ws = new WebSocket(url, ["acp.v1"]);
  ws.on("message", (data) => {
    for (const frame of splitFrames(String(data))) {
      handleFrame(ws, frame);
    }
  });

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  try {
    await request(ws, "initialize", {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: false, writeTextFile: false },
        terminal: false,
        elicitation: { form: {}, url: {} },
        _vibenClientTools: { enabled: false, tools: [], actionRegistry: "none" },
      },
      clientInfo: {
        name: "viben-acp-codex-smoke",
        title: "Viben ACP Codex Smoke",
        version: "0.1.0",
      },
    });

    const session = await request(ws, "session/new", {
      cwd,
      mcpServers: [],
      agent_config: {
        name: "codex-smoke",
        executor_type: "CODEX",
        provider,
        model,
        system_prompt: "Answer briefly. Do not edit files or run commands.",
        approval_mode: "bypass",
        permission_mode: "bypass",
        mcp_servers: [],
        executor_config: {
          init_timeout_ms: 120000,
          reasoning_effort: "low",
          sandbox,
        },
      },
      sandbox_config: { enabled: false },
    });
    const sessionId = session.sessionId;
    if (!sessionId) throw new Error(`session/new did not return sessionId: ${JSON.stringify(session)}`);

    const result = await request(ws, "session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: prompt }],
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    const updateKinds = updates.map((update) => update?.sessionUpdate).filter(Boolean);
    const summary = { sessionId, result, answer, promptError, updateKinds };
    console.log(JSON.stringify(summary, null, 2));
    if (promptError) throw new Error(promptError);
    if (!answer.trim()) throw new Error(`No agent_message_chunk received; updates=${updateKinds.join(",")}`);
    if (expected && !answer.includes(expected)) {
      throw new Error(`Answer did not include expected text ${JSON.stringify(expected)}: ${answer}`);
    }
  } finally {
    ws.close(1000, "smoke done");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
