import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { HistoryRecorder } from "../history-recorder.js";
import { HistoryStore } from "../history-store.js";
import { HistoryProvider } from "../history-provider.js";
import type { AgentEvent } from "../../../../core/types.js";

describe("History Integration", () => {
  let tmpDir: string;
  let store: HistoryStore;
  let recorder: HistoryRecorder;
  let provider: HistoryProvider;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "history-integration-test-"));
    store = new HistoryStore(tmpDir);
    recorder = new HistoryRecorder(store);
    provider = new HistoryProvider(store, () => [{
      sessionId: "sess-1",
      agentSessionId: "agent-1",
      agentName: "claude-code",
      workingDir: "/test",
      channelId: "telegram",
      status: "finished" as const,
      createdAt: "2026-03-30T10:00:00Z",
      lastActiveAt: "2026-03-30T10:05:00Z",
      name: "Test Session",
      platform: {},
    }]);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records a full conversation and builds context from it", async () => {
    // Simulate a conversation turn
    recorder.onBeforePrompt("sess-1", "Fix the login bug", undefined);
    recorder.onAfterEvent("sess-1", { type: "thought", content: "Let me look at the auth code..." } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_call", id: "t1", name: "Read", kind: "read", status: "pending",
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_update", id: "t1", status: "completed",
      rawInput: { file_path: "src/auth.ts" },
      rawOutput: "file content",
      locations: [{ path: "src/auth.ts", line: 1 }],
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", { type: "text", content: "Found the bug. Fixing now." } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_call", id: "t2", name: "Edit", kind: "edit", status: "pending",
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "tool_update", id: "t2", status: "completed",
      rawInput: { file_path: "src/auth.ts", old_string: "old", new_string: "new" },
      rawOutput: "Updated",
      content: [{ type: "diff", path: "src/auth.ts", oldText: "old", newText: "new" }],
      locations: [{ path: "src/auth.ts", line: 42 }],
    } as AgentEvent);
    recorder.onAfterEvent("sess-1", { type: "text", content: "Fixed!" } as AgentEvent);
    recorder.onAfterEvent("sess-1", {
      type: "usage", tokensUsed: 5000, contextSize: 200000, cost: { amount: 0.03, currency: "USD" },
    } as AgentEvent);
    await recorder.onTurnEnd("sess-1", "end_turn");

    // Build context from the recorded history
    const result = await provider.buildContext({ repoPath: "/test", type: "session", value: "sess-1" });

    expect(result.markdown).toContain("Fix the login bug");
    expect(result.markdown).toContain("Found the bug");
    expect(result.markdown).toContain("Read");
    expect(result.markdown).toContain("Edit");
    expect(result.markdown).toContain("src/auth.ts");
    expect(result.sessionCount).toBe(1);
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  it("records multiple turns and retrieves full history", async () => {
    // Turn 1
    recorder.onBeforePrompt("sess-1", "Hello", undefined);
    recorder.onAfterEvent("sess-1", { type: "text", content: "Hi there!" } as AgentEvent);
    await recorder.onTurnEnd("sess-1", "end_turn");

    // Turn 2
    recorder.onBeforePrompt("sess-1", "What is 2+2?", undefined);
    recorder.onAfterEvent("sess-1", { type: "text", content: "4" } as AgentEvent);
    await recorder.onTurnEnd("sess-1", "end_turn");

    const result = await provider.buildContext({ repoPath: "/test", type: "session", value: "sess-1" });

    expect(result.markdown).toContain("Hello");
    expect(result.markdown).toContain("Hi there!");
    expect(result.markdown).toContain("What is 2+2?");
    expect(result.markdown).toContain("4");
    expect(result.totalTurns).toBe(4); // 2 user + 2 assistant
  });

  it("recorder finalize cleans memory but file persists", async () => {
    recorder.onBeforePrompt("sess-1", "Test", undefined);
    recorder.onAfterEvent("sess-1", { type: "text", content: "Response" } as AgentEvent);
    await recorder.onTurnEnd("sess-1", "end_turn");

    recorder.finalize("sess-1");
    expect(recorder.getState("sess-1")).toBeUndefined();

    // File still exists and provider can read it
    const result = await provider.buildContext({ repoPath: "/test", type: "session", value: "sess-1" });
    expect(result.sessionCount).toBe(1);
    expect(result.markdown).toContain("Test");
  });
});
