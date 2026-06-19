import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  CodexAppServerJsonRpcClient,
  type CodexAppServerProcess,
} from "./codex-app-server-client";

function createProcess(): CodexAppServerProcess & {
  stdin: PassThrough;
  stdout: PassThrough;
  writes: unknown[];
} {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const writes: unknown[] = [];
  stdin.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      if (line.trim()) writes.push(JSON.parse(line) as unknown);
    }
  });
  return {
    stdin,
    stdout,
    writes,
    stderrText: "",
    command: "codex",
    args: ["app-server"],
    cwd: "/tmp/project",
    close: vi.fn(),
  };
}

describe("CodexAppServerJsonRpcClient", () => {
  it("matches JSON-RPC responses by id and writes JSONL requests", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient(proc);
    const request = client.request("model/list", { limit: 1 });

    await waitForWrites(proc, 1);
    expect(proc.writes[0]).toEqual({ id: 1, method: "model/list", params: { limit: 1 } });

    proc.stdout.write(`${JSON.stringify({ id: 1, result: { data: [] } })}\n`);
    await expect(request).resolves.toEqual({ data: [] });
  });

  it("emits notifications", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient(proc);
    const notifications: string[] = [];
    client.onNotification((message) => {
      notifications.push(message.method);
    });

    proc.stdout.write(`${JSON.stringify({ method: "turn/started", params: { turn: { id: "turn_1" } } })}\n`);

    await expect.poll(() => notifications).toEqual(["turn/started"]);
  });

  it("answers server-initiated requests with handler result", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient(proc);
    client.onServerRequest(async (message) => ({ seen: message.method }));

    proc.stdout.write(`${JSON.stringify({ id: 7, method: "item/tool/call", params: {} })}\n`);

    await waitForWrites(proc, 1);
    expect(proc.writes[0]).toEqual({ id: 7, result: { seen: "item/tool/call" } });
  });

  it("rejects pending requests when the process closes", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient(proc);
    const request = client.request("model/list");

    client.close();

    await expect(request).rejects.toThrow("closed");
    expect(proc.close).toHaveBeenCalled();
  });

  it("rejects pending requests when the spawned process fails", async () => {
    const proc = createProcess();
    const client = new CodexAppServerJsonRpcClient({
      ...proc,
      failure: Promise.reject(new Error("spawn ENOENT")),
    });
    const request = client.request("initialize");

    await expect(request).rejects.toThrow("spawn ENOENT");
  });
});

async function waitForWrites(proc: { writes: unknown[] }, count: number): Promise<void> {
  await expect.poll(() => proc.writes.length).toBeGreaterThanOrEqual(count);
}
