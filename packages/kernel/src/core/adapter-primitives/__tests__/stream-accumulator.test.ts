import { describe, it, expect, beforeEach } from "vitest";
import { ToolStateMap, ThoughtBuffer } from "../stream-accumulator.js";
import type { ToolCallMeta } from "../format-types.js";

const makeMeta = (overrides: Partial<ToolCallMeta> = {}): ToolCallMeta => ({
  id: "tool-1",
  name: "Read",
  status: "running",
  rawInput: {},
  ...overrides,
});

describe("ToolStateMap", () => {
  let map: ToolStateMap;
  beforeEach(() => {
    map = new ToolStateMap();
  });

  it("upsert creates a new entry with empty rawInput", () => {
    const entry = map.upsert(makeMeta({ id: "t1" }), "read", {});
    expect(entry.id).toBe("t1");
    expect(entry.rawInput).toEqual({});
    expect(entry.status).toBe("running");
  });

  it("merge updates rawInput from tool_call_update", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", {});
    const entry = map.merge("t1", "completed", { file_path: "src/foo.ts" }, "file content", undefined);
    expect(entry.rawInput).toEqual({ file_path: "src/foo.ts" });
    expect(entry.content).toBe("file content");
    expect(entry.status).toBe("completed");
  });

  it("merge buffers update when tool_call not yet received (out-of-order)", () => {
    map.merge("t1", "completed", { file_path: "x.ts" }, "output", undefined);
    const entry = map.upsert(makeMeta({ id: "t1" }), "read", {});
    expect(entry.status).toBe("completed");
    expect(entry.rawInput).toEqual({ file_path: "x.ts" });
    expect(entry.content).toBe("output");
  });

  it("get returns undefined for unknown id", () => {
    expect(map.get("nope")).toBeUndefined();
  });

  it("clear removes all entries and pending updates", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", {});
    map.clear();
    expect(map.get("t1")).toBeUndefined();
  });

  it("flow: multiple tools in sequence — each independent", () => {
    map.upsert(makeMeta({ id: "t1", name: "Read" }), "read", { file_path: "a.ts" });
    map.upsert(makeMeta({ id: "t2", name: "Bash" }), "execute", { command: "ls" });
    map.merge("t1", "completed", undefined, "file contents", undefined);
    map.merge("t2", "completed", undefined, "output", undefined);
    expect(map.get("t1")!.status).toBe("completed");
    expect(map.get("t1")!.content).toBe("file contents");
    expect(map.get("t2")!.status).toBe("completed");
  });

  it("flow: out-of-order clear removes buffered pending", () => {
    map.merge("t1", "completed", { file_path: "x.ts" }, "output", undefined);
    map.clear();
    // After clear, upsert should NOT apply the stale pending update
    const entry = map.upsert(makeMeta({ id: "t1" }), "read", {});
    expect(entry.status).toBe("running");
    expect(entry.content).toBeNull();
  });

  it("merge returns undefined when entry does not exist yet", () => {
    const result = map.merge("unknown-id", "completed", { x: 1 }, "out", undefined);
    expect(result).toBeUndefined();
  });

  it("merge returns the updated entry for known ID", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", {});
    const result = map.merge("t1", "completed", undefined, "done", undefined);
    expect(result).toBeDefined();
    expect(result!.id).toBe("t1");
    expect(result!.status).toBe("completed");
  });

  it("multiple merges before upsert: last pending update wins", () => {
    map.merge("t1", "running", { first: true }, "content-1", undefined);
    map.merge("t1", "completed", { second: true }, "content-2", undefined);
    const entry = map.upsert(makeMeta({ id: "t1" }), "read", {});
    expect(entry.status).toBe("completed");
    expect(entry.rawInput).toEqual({ second: true });
    expect(entry.content).toBe("content-2");
  });

  it("upsert on existing ID replaces entry completely", () => {
    map.upsert(makeMeta({ id: "t1", name: "Read" }), "read", { file: "a.ts" });
    const entry = map.upsert(makeMeta({ id: "t1", name: "Bash" }), "execute", { command: "ls" });
    expect(entry.name).toBe("Bash");
    expect(entry.kind).toBe("execute");
    expect(entry.rawInput).toEqual({ command: "ls" });
  });

  it("merge with undefined rawInput preserves original rawInput", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", { file_path: "original.ts" });
    map.merge("t1", "completed", undefined, "output", undefined);
    const entry = map.get("t1")!;
    expect(entry.rawInput).toEqual({ file_path: "original.ts" });
  });

  it("merge with explicit null content sets content to null", () => {
    map.upsert(makeMeta({ id: "t1" }), "read", {});
    map.merge("t1", "running", undefined, "some content", undefined);
    expect(map.get("t1")!.content).toBe("some content");
    map.merge("t1", "completed", undefined, null, undefined);
    expect(map.get("t1")!.content).toBeNull();
  });

  it("merge applies viewerLinks and diffStats when provided", () => {
    map.upsert(makeMeta({ id: "t1" }), "edit", {});
    const links = { file: "/tmp/a.ts", diff: "/tmp/a.diff" };
    const stats = { added: 10, removed: 3 };
    map.merge("t1", "completed", undefined, "done", links, stats);
    const entry = map.get("t1")!;
    expect(entry.viewerLinks).toEqual(links);
    expect(entry.diffStats).toEqual(stats);
  });

  it("out-of-order merge carries viewerLinks and diffStats through pending", () => {
    const links = { file: "/tmp/b.ts", diff: "/tmp/b.diff" };
    const stats = { added: 5, removed: 1 };
    map.merge("t1", "completed", undefined, "output", links, stats);
    const entry = map.upsert(makeMeta({ id: "t1" }), "edit", {});
    expect(entry.viewerLinks).toEqual(links);
    expect(entry.diffStats).toEqual(stats);
  });

  it("upsert defaults status to 'running' when meta.status is undefined", () => {
    const entry = map.upsert(makeMeta({ id: "t1", status: undefined }), "read", {});
    expect(entry.status).toBe("running");
  });

  it("upsert copies displaySummary, displayTitle, displayKind from meta", () => {
    const entry = map.upsert(
      makeMeta({
        id: "t1",
        displaySummary: "Reading file",
        displayTitle: "Read src/foo.ts",
        displayKind: "file-read",
      }),
      "read",
      {},
    );
    expect(entry.displaySummary).toBe("Reading file");
    expect(entry.displayTitle).toBe("Read src/foo.ts");
    expect(entry.displayKind).toBe("file-read");
  });
});

describe("ThoughtBuffer", () => {
  let buf: ThoughtBuffer;
  beforeEach(() => {
    buf = new ThoughtBuffer();
  });

  it("append + seal returns accumulated text", () => {
    buf.append("Hello ");
    buf.append("world");
    expect(buf.seal()).toBe("Hello world");
  });

  it("isSealed returns true after seal()", () => {
    expect(buf.isSealed()).toBe(false);
    buf.seal();
    expect(buf.isSealed()).toBe(true);
  });

  it("reset clears sealed state and content", () => {
    buf.append("text");
    buf.seal();
    buf.reset();
    expect(buf.isSealed()).toBe(false);
    expect(buf.seal()).toBe("");
  });

  it("append after seal is a no-op", () => {
    buf.append("before");
    buf.seal();
    buf.append("after");
    // reset and re-seal to get the content
    buf.reset();
    expect(buf.seal()).toBe("");
  });

  it("flow: multiple turns — reset between turns works correctly", () => {
    buf.append("Turn 1 thought");
    buf.seal();
    buf.reset();
    buf.append("Turn 2 thought");
    expect(buf.seal()).toBe("Turn 2 thought");
  });

  it("seal on empty buffer returns empty string", () => {
    expect(buf.seal()).toBe("");
  });

  it("append after seal does not change getText output", () => {
    buf.append("before");
    buf.seal();
    buf.append("after");
    expect(buf.getText()).toBe("before");
  });

  it("getText returns current text without sealing the buffer", () => {
    buf.append("chunk1");
    buf.append("chunk2");
    expect(buf.getText()).toBe("chunk1chunk2");
    expect(buf.isSealed()).toBe(false);
  });

  it("append with empty string is accepted", () => {
    buf.append("a");
    buf.append("");
    buf.append("b");
    expect(buf.getText()).toBe("ab");
  });

  it("double seal returns same text and remains sealed", () => {
    buf.append("content");
    const first = buf.seal();
    const second = buf.seal();
    expect(first).toBe("content");
    expect(second).toBe("content");
    expect(buf.isSealed()).toBe(true);
  });
});
