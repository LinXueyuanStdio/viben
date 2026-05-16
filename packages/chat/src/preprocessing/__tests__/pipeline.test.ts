import { describe, test, expect } from "vitest";
import { preprocessMessages } from "../pipeline";
import type { AgentMessage } from "../../types";

describe("preprocessMessages", () => {
  test("full pipeline: normalize → collapse → lookups", () => {
    const messages: AgentMessage[] = [
      { type: "user", content: "Read those files" },
      { type: "text", content: "Let me check" },
      { type: "text", content: "Let me check the files" }, // streaming dupe
      { type: "tool_use", name: "Read", toolUseId: "t1", input: { file_path: "/a.ts" } },
      { type: "tool_result", toolUseId: "t1", output: "content-a" },
      { type: "tool_use", name: "Grep", toolUseId: "t2", input: { pattern: "hello" } },
      { type: "tool_result", toolUseId: "t2", output: "matches" },
      { type: "tool_use", name: "Read", toolUseId: "t3", input: { file_path: "/b.ts" } },
      { type: "tool_result", toolUseId: "t3", output: "content-b" },
      { type: "text", content: "Here is what I found" },
    ];

    const result = preprocessMessages(messages, false);

    // Expected items: user, text("Let me check the files"), collapsed_group(3 tools), text("Here is what I found")
    expect(result.items).toHaveLength(4);
    expect(result.items[0].type).toBe("message");
    expect(result.items[1].type).toBe("message");
    expect(result.items[2].type).toBe("collapsed_group");
    expect(result.items[3].type).toBe("message");

    // Lookups should resolve toolUseId → result
    expect(result.lookups.resultByToolUseId.get("t1")?.output).toBe("content-a");
    expect(result.lookups.resultByToolUseId.get("t2")?.output).toBe("matches");
    expect(result.lookups.toolUseById.get("t1")?.name).toBe("Read");
  });

  test("simpleMode skips grouping — each message is a standalone item", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "hello" },
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { type: "tool_result", toolUseId: "t1", output: "data" },
    ];

    const result = preprocessMessages(messages, true);
    // simpleMode: all messages kept as-is (including tool_result)
    expect(result.items).toHaveLength(3);
    expect(result.items.every((i) => i.type === "message")).toBe(true);
  });

  test("hasActiveGroup is true when last tool has no result", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      // No tool_result for t1
    ];

    const result = preprocessMessages(messages, false);
    expect(result.hasActiveGroup).toBe(true);
  });

  test("hasActiveGroup is false when all tools are resolved", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { type: "tool_result", toolUseId: "t1", output: "done" },
      { type: "text", content: "All done" },
    ];

    const result = preprocessMessages(messages, false);
    expect(result.hasActiveGroup).toBe(false);
  });

  test("Agent/Task tools are not collapsed", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "t1", input: {} },
      { type: "tool_result", toolUseId: "t1", output: "data" },
      { type: "tool_use", name: "Agent", toolUseId: "t2", input: { prompt: "research" } },
      { type: "tool_result", toolUseId: "t2", output: "agent result" },
      { type: "tool_use", name: "Read", toolUseId: "t3", input: {} },
      { type: "tool_result", toolUseId: "t3", output: "more data" },
    ];

    const result = preprocessMessages(messages, false);
    // Read(single), Agent(standalone), Read(single) — no collapsing since runs < 2
    const agentItems = result.items.filter(
      (i) => i.type === "message" && i.message.name === "Agent"
    );
    expect(agentItems).toHaveLength(1);
  });
});
