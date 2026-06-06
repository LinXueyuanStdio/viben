import { describe, expect, test } from "vitest";
import { applyQueuedUiStep, createUiSession, drainSessionUiStepQueue, flushSessionStreamingText, resolveLiveSubagentMessages } from "../acp-chat-state";
import type { AcpUiStep } from "../acp-chat-adapter";

describe("acp chat state", () => {
  test("routes subagent child tool events into Task live preview updates", () => {
    const session = createUiSession("session-1", "/tmp", { sessionId: "session-1" });
    const taskStep: AcpUiStep = {
      kind: "message",
      merge: "tool_use",
      message: {
        id: "task-tool-1",
        type: "tool_use",
        name: "Task",
        toolUseId: "task-tool-1",
        subagentId: "subagent-1",
        input: {
          description: "Investigate",
          subagent_type: "debugger",
          prompt: "Inspect behavior",
        },
      },
    };
    const readStep: AcpUiStep = {
      kind: "message",
      merge: "tool_use",
      message: {
        id: "read-tool-1",
        type: "tool_use",
        name: "Read",
        toolUseId: "read-tool-1",
        subagentId: "subagent-1",
        input: { file_path: "/tmp/source.ts" },
      },
    };
    const readResultStep: AcpUiStep = {
      kind: "message",
      merge: "tool_result",
      message: {
        id: "read-result-1",
        type: "tool_result",
        toolUseId: "read-tool-1",
        output: "export const value = true;",
      },
    };

    const withTask = applyQueuedUiStep(session, taskStep, []);
    const withReadPreview = applyQueuedUiStep(withTask, readStep, []);
    const withReadResult = applyQueuedUiStep(withReadPreview, readResultStep, []);

    expect(withReadResult.uiMessages.map((message) => message.id)).toEqual(["task-tool-1"]);
    expect(withReadResult.messageUpdates["task-tool-1"].subagentPreviewMessages).toMatchObject([
      {
        id: "read-tool-1",
        type: "tool_use",
        name: "Read",
        toolUseId: "read-tool-1",
        subagentId: "subagent-1",
      },
      {
        id: "read-result-1",
        type: "tool_result",
        toolUseId: "read-tool-1",
        output: "export const value = true;",
      },
    ]);
    expect(resolveLiveSubagentMessages({ "session-1": withReadResult }, {
      title: "Investigate",
      subagentType: "debugger",
      messages: [],
      context: { toolUseId: "task-tool-1" },
    })).toMatchObject([
      { id: "read-tool-1", type: "tool_use" },
      { id: "read-result-1", type: "tool_result" },
    ]);
  });

  test("extracts artifacts from structured tool results", () => {
    const session = createUiSession("session-1", "/tmp", { sessionId: "session-1" });
    const writeStep: AcpUiStep = {
      kind: "message",
      merge: "tool_use",
      message: {
        id: "write-tool-1",
        type: "tool_use",
        name: "Write",
        toolUseId: "write-tool-1",
        input: { file_path: "/tmp/report.md" },
      },
    };
    const resultStep: AcpUiStep = {
      kind: "message",
      merge: "tool_result",
      message: {
        id: "write-result-1",
        type: "tool_result",
        toolUseId: "write-tool-1",
        output: JSON.stringify({
          artifacts: [{
            id: "artifact-1",
            name: "report.md",
            path: "/tmp/report.md",
            type: "text",
          }],
        }),
      },
    };

    const withWrite = applyQueuedUiStep(session, writeStep, []);
    const withResult = applyQueuedUiStep(withWrite, resultStep, []);

    expect(withWrite.artifacts).toEqual([
      expect.objectContaining({
        id: "artifact-write-tool-1",
        name: "report.md",
        type: "text",
        sourceMessageId: "write-tool-1",
        toolName: "Write",
      }),
    ]);
    expect(withResult.artifacts).toEqual([
      expect.objectContaining({
        id: "artifact-1",
        name: "report.md",
        type: "text",
        sourceMessageId: "write-tool-1",
        toolName: "Write",
      }),
    ]);
  });

  test("keeps pending plan while allowing later streaming steps to apply", () => {
    const session = createUiSession("session-1", "/tmp", { sessionId: "session-1" });
    const planStep: AcpUiStep = {
      kind: "plan",
      plan: {
        id: "plan-1",
        goal: "Review then execute",
        approvalStatus: "pending",
        steps: [{ id: "step-1", description: "Run tool", status: "pending" }],
      },
    };
    const toolStep: AcpUiStep = {
      kind: "message",
      merge: "tool_use",
      message: {
        id: "tool-1",
        type: "tool_use",
        name: "Read",
        toolUseId: "tool-1",
        input: { file_path: "/tmp/source.ts" },
      },
    };

    const withPlan = applyQueuedUiStep(session, planStep, []);
    const withTool = applyQueuedUiStep(withPlan, toolStep, []);

    expect(withTool.pendingPlan).toMatchObject({ id: "plan-1", approvalStatus: "pending" });
    expect(withTool.uiMessages).toMatchObject([
      { type: "plan", plan: { id: "plan-1" } },
      { type: "tool_use", id: "tool-1", name: "Read" },
    ]);
  });

  test("appends final agent text after pending plan and tool events", () => {
    const session = createUiSession("session-1", "/tmp", { sessionId: "session-1" });
    const withPlan = applyQueuedUiStep(session, {
      kind: "plan",
      plan: {
        id: "plan-1",
        goal: "Review then execute",
        approvalStatus: "pending",
        steps: [{ id: "step-1", description: "Run tool", status: "pending" }],
      },
    }, []);
    const withTool = applyQueuedUiStep(withPlan, {
      kind: "message",
      merge: "tool_use",
      message: {
        id: "tool-1",
        type: "tool_use",
        name: "Write",
        toolUseId: "tool-1",
        input: { file_path: "/tmp/report.md" },
      },
    }, []);
    const withText = applyQueuedUiStep(withTool, {
      kind: "message",
      merge: "text_chunk",
      message: {
        type: "text",
        content: "Fake chat view complete.",
      },
    }, []);

    expect(withText.pendingPlan).toMatchObject({ id: "plan-1" });
    expect(withText.uiMessages.at(-1)).toMatchObject({
      type: "text",
      content: "Fake chat view complete.",
    });
  });

  test("flushes streaming text into one final assistant message before summary", () => {
    const session = {
      ...createUiSession("session-1", "/tmp", { sessionId: "session-1" }),
      streamingText: "GUI_execute result streamed in chunks.",
    };

    const flushed = flushSessionStreamingText(session, [{
      id: "summary-1",
      type: "summary",
      summary: {
        stop_reason: "end_turn",
        total_tokens: 36,
      },
    }]);

    expect(flushed.streamingText).toBeNull();
    expect(flushed.uiMessages).toMatchObject([
      {
        type: "text",
        content: "GUI_execute result streamed in chunks.",
      },
      {
        id: "summary-1",
        type: "summary",
        summary: {
          stop_reason: "end_turn",
          total_tokens: 36,
        },
      },
    ]);
  });

  test("drains queued tool steps before final streaming text is flushed", () => {
    const session = {
      ...createUiSession("session-1", "/tmp", { sessionId: "session-1" }),
      streamingText: "Done.",
      uiStepQueue: [
        {
          kind: "message",
          merge: "tool_use",
          message: {
            id: "gui-tool-1",
            type: "tool_use",
            name: "GUI_execute",
            toolUseId: "gui-tool-1",
            input: { action: "get_action_detail" },
          },
        },
        {
          kind: "message",
          merge: "tool_result",
          message: {
            id: "gui-result-1",
            type: "tool_result",
            toolUseId: "gui-tool-1",
            output: "Settings panel opened.",
          },
        },
      ] satisfies AcpUiStep[],
    };

    const flushed = flushSessionStreamingText(drainSessionUiStepQueue(session));

    expect(flushed.uiStepQueue).toEqual([]);
    expect(flushed.uiMessages.map((message) => message.type)).toEqual(["tool_use", "tool_result", "text"]);
    expect(flushed.uiMessages.filter((message) => message.type === "tool_use" && message.toolUseId === "gui-tool-1")).toHaveLength(1);
    expect(flushed.uiMessages.filter((message) => message.type === "tool_result" && message.toolUseId === "gui-tool-1")).toHaveLength(1);
  });
});
