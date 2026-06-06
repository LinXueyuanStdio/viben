import { describe, expect, test } from "vitest";
import {
  acpSessionUpdateToStreamingText,
  acpSessionUpdateToUiSteps,
  applyAcpUiStep,
} from "../acp-chat-adapter";
import type { AcpSessionUpdate } from "../acp-client";

function update(update: AcpSessionUpdate["update"]): AcpSessionUpdate {
  return {
    sessionId: "session-1",
    update,
  };
}

describe("acp chat adapter", () => {
  test("maps available ACP commands to @viben/chat slash commands", () => {
    const steps = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "available_commands_update",
      availableCommands: [
        {
          name: "debug",
          description: "Enable debug logging",
          input: { hint: "[issue]" },
        },
      ],
    }));

    expect(steps).toEqual([
      {
        kind: "slash_commands",
        commands: [
          {
            name: "debug",
            description: "Enable debug logging",
            input: { hint: "[issue]" },
          },
        ],
      },
    ]);
  });

  test("maps ACP usage updates to summary chat steps", () => {
    const usage = {
      sessionUpdate: "usage_update",
      cost: { amount: 0.13047224999999998, currency: "USD" },
      size: 200000,
      used: 31505,
    };
    const steps = acpSessionUpdateToUiSteps(update(usage));

    expect(steps).toEqual([{ kind: "summary", summary: usage }]);

    const messages = applyAcpUiStep([], steps[0]);
    expect(messages[0]).toMatchObject({
      type: "summary",
      summary: usage,
    });
  });

  test("maps ACP plan updates to pending plan chat steps", () => {
    const steps = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "plan",
      planId: "plan-1",
      goal: "Ship ACP chat",
      entries: [
        { id: "step-1", content: "Map events", priority: "high", status: "pending" },
        { id: "step-2", content: "Ask approval", priority: "medium", status: "pending" },
      ],
    }));

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      kind: "plan",
      plan: {
        id: "plan-1",
        goal: "Ship ACP chat",
        approvalStatus: "pending",
        steps: [
          { id: "step-1", description: "Map events", status: "pending" },
          { id: "step-2", description: "Ask approval", status: "pending" },
        ],
      },
    });

    const messages = applyAcpUiStep([], steps[0]);
    expect(messages[0]).toMatchObject({
      type: "plan",
      plan: {
        id: "plan-1",
        approvalStatus: "pending",
      },
    });
  });

  test("normalizes Task tool calls so @viben/chat can open subagent UI", () => {
    const steps = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "tool_call",
      toolCallId: "task-tool-1",
      title: "Task",
      rawInput: {
        title: "Investigate failing tests",
        agentType: "debugger",
        instructions: "Find the root cause",
      },
      _meta: {
        subagentId: "subagent-1",
      },
    }));

    expect(steps[0]).toMatchObject({
      kind: "message",
      merge: "tool_use",
      message: {
        type: "tool_use",
        name: "Task",
        toolUseId: "task-tool-1",
        subagentId: "subagent-1",
        input: {
          description: "Investigate failing tests",
          subagent_type: "debugger",
          prompt: "Find the root cause",
        },
      },
    });
  });

  test("preserves structured artifact payloads from tool updates", () => {
    const steps = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "tool_call_update",
      toolCallId: "write-tool-1",
      status: "completed",
      artifacts: [
        {
          id: "artifact-1",
          name: "report.md",
          path: "/tmp/report.md",
          type: "text",
        },
      ],
    }));

    const message = steps[0].kind === "message" ? steps[0].message : null;
    expect(message).toMatchObject({
      type: "tool_result",
      toolUseId: "write-tool-1",
      isError: false,
    });
    expect(message?.output).toContain("artifact-1");
    expect(message?.output).toContain("/tmp/report.md");
  });

  test("extracts agent message chunks for the streaming text channel", () => {
    const notification = update({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "streamed answer" },
    });

    expect(acpSessionUpdateToStreamingText(notification)).toBe("streamed answer");
  });
});
