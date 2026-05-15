import { describe, test, expect } from "vitest";
import { normalizeMessages } from "../normalize";
import type { AgentMessage } from "../../types";

describe("normalizeMessages", () => {
  test("merges consecutive streaming text messages, keeping last", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "Hello" },
      { type: "text", content: "Hello world" },
      { type: "text", content: "Hello world!" },
    ];
    const result = normalizeMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("text");
    expect(result[0].content).toBe("Hello world!");
  });

  test("preserves text messages separated by tool_use", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "First thought" },
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: { file_path: "/a.ts" } },
      { type: "tool_result", toolUseId: "tu1", output: "content" },
      { type: "text", content: "Second thought" },
    ];
    const result = normalizeMessages(messages);
    const textMessages = result.filter((m) => m.type === "text");
    expect(textMessages).toHaveLength(2);
    expect(textMessages[0].content).toBe("First thought");
    expect(textMessages[1].content).toBe("Second thought");
  });

  test("keeps only last plan message", () => {
    const messages: AgentMessage[] = [
      { type: "plan", plan: { goal: "old", steps: [] } },
      { type: "text", content: "Working..." },
      { type: "plan", plan: { goal: "new", steps: [] } },
    ];
    const result = normalizeMessages(messages);
    const plans = result.filter((m) => m.type === "plan");
    expect(plans).toHaveLength(1);
    expect(plans[0].plan?.goal).toBe("new");
  });

  test("skips text that looks like raw plan JSON", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: '{"type": "plan", "goal": "test"}' },
      { type: "text", content: "Actual message" },
    ];
    const result = normalizeMessages(messages);
    const textMessages = result.filter((m) => m.type === "text");
    expect(textMessages).toHaveLength(1);
    expect(textMessages[0].content).toBe("Actual message");
  });

  test("filters out tool_result messages (they are paired via lookup)", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: {} },
      { type: "tool_result", toolUseId: "tu1", output: "data" },
    ];
    const result = normalizeMessages(messages);
    expect(result.filter((m) => m.type === "tool_result")).toHaveLength(0);
    expect(result.filter((m) => m.type === "tool_use")).toHaveLength(1);
  });
});
