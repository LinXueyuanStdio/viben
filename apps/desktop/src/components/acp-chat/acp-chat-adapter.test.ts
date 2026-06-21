import { describe, expect, it } from "vitest";
import {
  acpSessionUpdateToUiSteps,
  applyAcpUiStep,
} from "./acp-chat-adapter";

describe("ACP chat adapter", () => {
  it("turns usage updates into summary messages for context UI", () => {
    const steps = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "usage_update",
        used: 20,
        size: 100,
      },
    });

    expect(steps).toEqual([{
      kind: "summary",
      summary: {
        sessionUpdate: "usage_update",
        used: 20,
        size: 100,
      },
    }]);
  });

  it("accumulates in-progress tool result deltas", () => {
    const firstStep = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "cmd-1",
        title: "Command output",
        kind: "execute",
        rawOutput: "hello ",
      },
    })[0];
    const secondStep = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "cmd-1",
        title: "Command output",
        kind: "execute",
        rawOutput: "world",
      },
    })[0];

    const afterFirst = applyAcpUiStep([], firstStep);
    const afterSecond = applyAcpUiStep(afterFirst, secondStep);

    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0]).toMatchObject({
      type: "tool_result",
      toolUseId: "cmd-1",
      output: "hello world",
    });
  });

  it("replaces in-progress tool output with final completed output", () => {
    const deltaStep = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "cmd-1",
        title: "Command output",
        kind: "execute",
        rawOutput: "partial",
      },
    })[0];
    const completedStep = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "cmd-1",
        title: "Command",
        kind: "execute",
        status: "completed",
        rawOutput: "final output",
      },
    })[0];

    const afterDelta = applyAcpUiStep([], deltaStep);
    const afterCompleted = applyAcpUiStep(afterDelta, completedStep);

    expect(afterCompleted).toHaveLength(1);
    expect(afterCompleted[0]).toMatchObject({
      type: "tool_result",
      toolUseId: "cmd-1",
      output: "final output",
    });
  });

  it("replaces duplicated completed message text after streamed deltas", () => {
    const deltaStep = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "msg-1",
        content: { type: "text", text: "hello" },
      },
    })[0];
    const completedStep = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "msg-1",
        content: { type: "text", text: "hello world" },
      },
    })[0];

    const afterDelta = applyAcpUiStep([], deltaStep);
    const afterCompleted = applyAcpUiStep(afterDelta, completedStep);

    expect(afterCompleted).toHaveLength(1);
    expect(afterCompleted[0]).toMatchObject({
      id: "msg-1",
      type: "text",
      content: "hello world",
    });
  });

  it("maps Codex user message items to a readable status step instead of raw JSON", () => {
    const steps = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "codex_item",
        itemId: "item-user",
        itemType: "userMessage",
        title: "userMessage",
        content: {
          type: "text",
          text: JSON.stringify({
            id: "item-user",
            type: "userMessage",
            text: "Please inspect the workspace",
          }, null, 2),
        },
        rawItem: {
          id: "item-user",
          type: "userMessage",
          text: "Please inspect the workspace",
        },
      },
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: "message",
      message: {
        type: "status_update",
        content: "User message received",
      },
    });
    expect(JSON.stringify(steps)).not.toContain("\"type\":\"userMessage\"");
    expect(JSON.stringify(steps)).not.toContain("Please inspect the workspace");
  });

  it("maps Codex event updates to readable status steps instead of raw JSON", () => {
    const steps = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "codex_event",
        method: "thread/status/changed",
        params: { status: "busy", thread: { id: "thr-1" } },
      },
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: "message",
      message: {
        type: "status_update",
        content: "Codex thread status changed",
      },
    });
    expect(JSON.stringify(steps)).not.toContain("thr-1");
    expect(JSON.stringify(steps)).not.toContain("\"params\"");
  });

  it("sanitizes Codex app-server disconnect errors without exposing stack or command JSON", () => {
    const steps = acpSessionUpdateToUiSteps({
      sessionId: "session-1",
      update: {
        sessionUpdate: "error",
        error: {
          message: "stream disconnected before completion",
          raw: {
            stack: "Error: stream disconnected before completion\n    at internal",
            command: "codex app-server",
          },
        },
      },
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: "message",
      message: {
        type: "error",
        message: "Codex connection dropped before the response completed. Start a new turn or reconnect the session.",
      },
    });
    expect(JSON.stringify(steps)).not.toContain("stack");
    expect(JSON.stringify(steps)).not.toContain("codex app-server");
  });
});
