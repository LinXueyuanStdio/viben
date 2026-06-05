import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DebugTracer } from "../debug-tracer.js";

describe("DebugTracer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "debug-tracer-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes JSONL lines to the correct file", () => {
    const tracer = new DebugTracer("sess-1", tmpDir);
    tracer.log("acp", { dir: "recv", data: { foo: 1 } });
    tracer.log("acp", { dir: "send", data: { bar: 2 } });

    const filePath = path.join(tmpDir, ".log", "sess-1_acp.jsonl");
    expect(fs.existsSync(filePath)).toBe(true);

    const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);

    const line1 = JSON.parse(lines[0]);
    expect(line1.dir).toBe("recv");
    expect(line1.data).toEqual({ foo: 1 });
    expect(typeof line1.ts).toBe("number");
  });

  it("creates .log directory lazily on first write", () => {
    const logDir = path.join(tmpDir, ".log");
    expect(fs.existsSync(logDir)).toBe(false);

    const tracer = new DebugTracer("sess-1", tmpDir);
    expect(fs.existsSync(logDir)).toBe(false);

    tracer.log("core", { step: "test" });
    expect(fs.existsSync(logDir)).toBe(true);
  });

  it("writes to separate files per layer", () => {
    const tracer = new DebugTracer("sess-1", tmpDir);
    tracer.log("acp", { x: 1 });
    tracer.log("core", { x: 2 });
    tracer.log("telegram", { x: 3 });

    const logDir = path.join(tmpDir, ".log");
    expect(fs.existsSync(path.join(logDir, "sess-1_acp.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "sess-1_core.jsonl"))).toBe(true);
    expect(fs.existsSync(path.join(logDir, "sess-1_telegram.jsonl"))).toBe(true);
  });

  it("handles write errors gracefully (no throw)", () => {
    const tracer = new DebugTracer("sess-1", "/nonexistent/path");
    expect(() => tracer.log("acp", { x: 1 })).not.toThrow();
  });

  it("destroy() is callable without error", () => {
    const tracer = new DebugTracer("sess-1", tmpDir);
    tracer.log("acp", { x: 1 });
    expect(() => tracer.destroy()).not.toThrow();
  });
});
