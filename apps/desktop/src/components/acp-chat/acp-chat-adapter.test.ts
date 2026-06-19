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
});
