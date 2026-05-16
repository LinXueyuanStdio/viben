import { describe, test, expect } from "vitest";
import { collapseConsecutiveTools } from "../collapse-read-search";
import type { AgentMessage } from "../../types";
import type { ProcessedItem } from "../types";

describe("collapseConsecutiveTools", () => {
  test("collapses 2+ consecutive Read/Glob/Grep into a CollapsedGroup", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "text", content: "Let me check" }, originalIndex: 0 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: { file_path: "/a.ts" } }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Grep", toolUseId: "t2", input: { pattern: "foo" } }, originalIndex: 2 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t3", input: { file_path: "/b.ts" } }, originalIndex: 3 },
      { type: "message", message: { type: "text", content: "Done" }, originalIndex: 4 },
    ];
    const allMessages: AgentMessage[] = [
      { type: "text", content: "Let me check" },
      { type: "tool_use", name: "Read", toolUseId: "t1", input: { file_path: "/a.ts" } },
      { type: "tool_result", toolUseId: "t1", output: "content" },
      { type: "tool_use", name: "Grep", toolUseId: "t2", input: { pattern: "foo" } },
      { type: "tool_result", toolUseId: "t2", output: "matches" },
      { type: "tool_use", name: "Read", toolUseId: "t3", input: { file_path: "/b.ts" } },
      { type: "tool_result", toolUseId: "t3", output: "content2" },
      { type: "text", content: "Done" },
    ];
    const result = collapseConsecutiveTools(items, allMessages);
    expect(result).toHaveLength(3); // text, collapsed_group, text
    expect(result[0].type).toBe("message");
    expect(result[1].type).toBe("collapsed_group");
    expect(result[2].type).toBe("message");
    if (result[1].type === "collapsed_group") {
      expect(result[1].group.pairs).toHaveLength(3);
      expect(result[1].group.counts.read).toBe(2);
      expect(result[1].group.counts.search).toBe(1);
    }
  });

  test("does NOT collapse a single tool_use (needs 2+)", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "text", content: "Done" }, originalIndex: 1 },
    ];
    const result = collapseConsecutiveTools(items, []);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("message");
    expect(result[1].type).toBe("message");
  });

  test("breaks collapse on non-collapsible tool (Write, Edit)", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t2", input: {} }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Write", toolUseId: "t3", input: {} }, originalIndex: 2 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t4", input: {} }, originalIndex: 3 },
    ];
    const result = collapseConsecutiveTools(items, []);
    // collapsed(Read,Read), Write, Read (single, not collapsed)
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe("collapsed_group");
    expect(result[1].type).toBe("message");
    expect(result[2].type).toBe("message");
  });

  test("breaks collapse on text message", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "text", content: "thinking..." }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t2", input: {} }, originalIndex: 2 },
    ];
    const result = collapseConsecutiveTools(items, []);
    // Read(single), text, Read(single) — no collapse since neither run has 2+
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.type === "message")).toBe(true);
  });

  test("Bash tool is collapsible", () => {
    const items: ProcessedItem[] = [
      { type: "message", message: { type: "tool_use", name: "Read", toolUseId: "t1", input: {} }, originalIndex: 0 },
      { type: "message", message: { type: "tool_use", name: "Bash", toolUseId: "t2", input: { command: "ls" } }, originalIndex: 1 },
      { type: "message", message: { type: "tool_use", name: "Grep", toolUseId: "t3", input: {} }, originalIndex: 2 },
    ];
    const result = collapseConsecutiveTools(items, []);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("collapsed_group");
    if (result[0].type === "collapsed_group") {
      expect(result[0].group.counts.read).toBe(1);
      expect(result[0].group.counts.bash).toBe(1);
      expect(result[0].group.counts.search).toBe(1);
    }
  });
});
