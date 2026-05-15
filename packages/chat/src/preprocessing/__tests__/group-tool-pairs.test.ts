import { describe, test, expect } from "vitest";
import { groupToolPairs } from "../group-tool-pairs";
import type { AgentMessage } from "../../types";

describe("groupToolPairs", () => {
  test("pairs tool_use with tool_result by toolUseId", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: { file_path: "/a.ts" } },
      { type: "tool_use", name: "Grep", toolUseId: "tu2", input: { pattern: "foo" } },
    ];
    const allMessages: AgentMessage[] = [
      ...messages,
      { type: "tool_result", toolUseId: "tu1", output: "file content" },
      { type: "tool_result", toolUseId: "tu2", output: "grep result" },
    ];
    const result = groupToolPairs(messages, allMessages);
    expect(result).toHaveLength(2);
    expect(result[0].toolUse.toolUseId).toBe("tu1");
    expect(result[0].toolResult?.output).toBe("file content");
    expect(result[1].toolUse.toolUseId).toBe("tu2");
    expect(result[1].toolResult?.output).toBe("grep result");
  });

  test("returns undefined result for unresolved tool_use", () => {
    const messages: AgentMessage[] = [
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: {} },
    ];
    const result = groupToolPairs(messages, messages);
    expect(result).toHaveLength(1);
    expect(result[0].toolResult).toBeUndefined();
  });

  test("skips non-tool_use messages", () => {
    const messages: AgentMessage[] = [
      { type: "text", content: "hello" },
      { type: "tool_use", name: "Read", toolUseId: "tu1", input: {} },
    ];
    const result = groupToolPairs(messages, messages);
    expect(result).toHaveLength(1);
    expect(result[0].toolUse.toolUseId).toBe("tu1");
  });
});
