import { describe, it, expect } from "vitest";
import type { AgentMessage } from "../types";
import { buildMessageLookups, updateMessageLookupsIncremental, EMPTY_LOOKUPS } from "../message-lookups";

describe("buildMessageLookups", () => {
  it("returns empty lookups for empty messages", () => {
    const lookups = buildMessageLookups([]);
    expect(lookups.toolResultByUseId.size).toBe(0);
    expect(lookups.resolvedIds.size).toBe(0);
    expect(lookups.errorIds.size).toBe(0);
    expect(lookups.inProgressIds.size).toBe(0);
  });

  it("maps tool_result to its tool_use by toolUseId", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: { file_path: "/foo" } },
      { id: "msg-2", type: "tool_result", toolUseId: "tu-1", output: "file contents" },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.toolResultByUseId.get("tu-1")).toEqual(messages[1]);
    expect(lookups.resolvedIds.has("tu-1")).toBe(true);
    expect(lookups.inProgressIds.size).toBe(0);
  });

  it("identifies errored tool results", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Bash", toolUseId: "tu-2", input: { command: "exit 1" } },
      { id: "msg-2", type: "tool_result", toolUseId: "tu-2", output: "error", isError: true },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.errorIds.has("tu-2")).toBe(true);
    expect(lookups.resolvedIds.has("tu-2")).toBe(true);
  });

  it("identifies in-progress tool_use (no matching tool_result)", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Bash", toolUseId: "tu-3", input: { command: "sleep 10" } },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.inProgressIds.has("tu-3")).toBe(true);
    expect(lookups.resolvedIds.has("tu-3")).toBe(false);
  });

  it("handles multiple tool_use/tool_result pairs", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-a", input: {} },
      { id: "msg-2", type: "tool_result", toolUseId: "tu-a", output: "ok" },
      { id: "msg-3", type: "tool_use", name: "Write", toolUseId: "tu-b", input: {} },
      { id: "msg-4", type: "tool_result", toolUseId: "tu-b", output: "done" },
      { id: "msg-5", type: "tool_use", name: "Grep", toolUseId: "tu-c", input: {} },
    ];
    const lookups = buildMessageLookups(messages);
    expect(lookups.resolvedIds.size).toBe(2);
    expect(lookups.inProgressIds.size).toBe(1);
    expect(lookups.inProgressIds.has("tu-c")).toBe(true);
    expect(lookups.toolResultByUseId.get("tu-a")).toEqual(messages[1]);
    expect(lookups.toolResultByUseId.get("tu-b")).toEqual(messages[3]);
  });
});

describe("EMPTY_LOOKUPS", () => {
  it("has empty collections", () => {
    expect(EMPTY_LOOKUPS.toolResultByUseId.size).toBe(0);
    expect(EMPTY_LOOKUPS.resolvedIds.size).toBe(0);
    expect(EMPTY_LOOKUPS.errorIds.size).toBe(0);
    expect(EMPTY_LOOKUPS.inProgressIds.size).toBe(0);
  });
});

describe("updateMessageLookupsIncremental", () => {
  it("returns null when messages were removed (length decreased)", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: {} },
    ];
    const lookups = buildMessageLookups(messages);
    const result = updateMessageLookupsIncremental(lookups, 2, messages);
    expect(result).toBeNull();
  });

  it("returns same lookups when no new messages", () => {
    const messages: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: {} },
    ];
    const lookups = buildMessageLookups(messages);
    const result = updateMessageLookupsIncremental(lookups, 1, messages);
    expect(result).toBe(lookups);
  });

  it("patches lookups when new tool_result appended", () => {
    const initial: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Read", toolUseId: "tu-1", input: {} },
    ];
    const lookups = buildMessageLookups(initial);
    expect(lookups.inProgressIds.has("tu-1")).toBe(true);

    const updated: AgentMessage[] = [
      ...initial,
      { id: "msg-2", type: "tool_result", toolUseId: "tu-1", output: "content" },
    ];
    const result = updateMessageLookupsIncremental(lookups, 1, updated);
    expect(result).not.toBeNull();
    expect(result!.inProgressIds.has("tu-1")).toBe(false);
    expect(result!.resolvedIds.has("tu-1")).toBe(true);
    expect(result!.toolResultByUseId.get("tu-1")).toEqual(updated[1]);
  });

  it("patches lookups when new tool_use appended (becomes in-progress)", () => {
    const initial: AgentMessage[] = [
      { id: "msg-1", type: "text", content: "Hello" },
    ];
    const lookups = buildMessageLookups(initial);

    const updated: AgentMessage[] = [
      ...initial,
      { id: "msg-2", type: "tool_use", name: "Bash", toolUseId: "tu-new", input: { command: "ls" } },
    ];
    const result = updateMessageLookupsIncremental(lookups, 1, updated);
    expect(result).not.toBeNull();
    expect(result!.inProgressIds.has("tu-new")).toBe(true);
  });

  it("patches error status correctly on incremental update", () => {
    const initial: AgentMessage[] = [
      { id: "msg-1", type: "tool_use", name: "Bash", toolUseId: "tu-err", input: {} },
    ];
    const lookups = buildMessageLookups(initial);

    const updated: AgentMessage[] = [
      ...initial,
      { id: "msg-2", type: "tool_result", toolUseId: "tu-err", output: "fail", isError: true },
    ];
    const result = updateMessageLookupsIncremental(lookups, 1, updated);
    expect(result).not.toBeNull();
    expect(result!.errorIds.has("tu-err")).toBe(true);
    expect(result!.inProgressIds.has("tu-err")).toBe(false);
  });
});

describe("streaming simulation", () => {
  it("correctly transitions tool from in-progress to resolved during streaming", () => {
    const phase1: AgentMessage[] = [
      { id: "msg-1", type: "user", content: "Do something" },
      { id: "msg-2", type: "text", content: "I'll read the file" },
      { id: "msg-3", type: "tool_use", name: "Read", toolUseId: "tu-stream", input: { file_path: "/a.ts" } },
    ];

    const lookups = buildMessageLookups(phase1);
    expect(lookups.inProgressIds.has("tu-stream")).toBe(true);
    expect(lookups.resolvedIds.has("tu-stream")).toBe(false);

    const phase2: AgentMessage[] = [
      ...phase1,
      { id: "msg-4", type: "tool_result", toolUseId: "tu-stream", output: "const x = 1;" },
      { id: "msg-5", type: "text", content: "Here is the file content" },
    ];

    const updated = updateMessageLookupsIncremental(lookups, phase1.length, phase2);
    expect(updated).not.toBeNull();
    expect(updated!.inProgressIds.has("tu-stream")).toBe(false);
    expect(updated!.resolvedIds.has("tu-stream")).toBe(true);
    expect(updated!.toolResultByUseId.get("tu-stream")?.output).toBe("const x = 1;");
  });

  it("full rebuild produces same result as incremental for append-only", () => {
    const messages: AgentMessage[] = [
      { id: "m1", type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { id: "m2", type: "tool_result", toolUseId: "t1", output: "ok" },
      { id: "m3", type: "tool_use", name: "Write", toolUseId: "t2", input: {} },
    ];

    const base = buildMessageLookups(messages.slice(0, 2));
    const incremental = updateMessageLookupsIncremental(base, 2, messages);
    const full = buildMessageLookups(messages);

    expect(incremental).not.toBeNull();
    expect(incremental!.resolvedIds).toEqual(full.resolvedIds);
    expect(incremental!.inProgressIds).toEqual(full.inProgressIds);
    expect(incremental!.errorIds).toEqual(full.errorIds);
    expect(new Set(incremental!.toolResultByUseId.keys())).toEqual(
      new Set(full.toolResultByUseId.keys())
    );
  });
});
