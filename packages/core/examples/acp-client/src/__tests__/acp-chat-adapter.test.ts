import { describe, expect, test } from "vitest";
import type { AgentMessage } from "@viben/chat";
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

  test("updates the same GUI tool card when pending, input, and result share a toolCallId", () => {
    const toolCallId = "toolu_gui_1";
    const pending = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "tool_call",
      toolCallId,
      title: "mcp__client_side__GUI_execute",
      status: "pending",
      rawInput: {},
    }));
    const inputUpdate = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "tool_call_update",
      toolCallId,
      title: "mcp__client_side__GUI_execute",
      rawInput: {
        action: "get_action_detail",
        payload: { action: "app.open_settings" },
      },
    }));
    const resultUpdate = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "tool_call_update",
      toolCallId,
      status: "completed",
      rawOutput: [{ type: "text", text: "Settings panel opened." }],
    }));

    const messages = [...pending, ...inputUpdate, ...resultUpdate].reduce<AgentMessage[]>(
      (current, step) => applyAcpUiStep(current, step),
      []
    );

    expect(messages.filter((message) => message.type === "tool_use" && message.toolUseId === toolCallId)).toHaveLength(1);
    expect(messages.filter((message) => message.type === "tool_result" && message.toolUseId === toolCallId)).toHaveLength(1);
    expect(messages.find((message) => message.type === "tool_use" && message.toolUseId === toolCallId)).toMatchObject({
      input: {
        action: "get_action_detail",
        payload: { action: "app.open_settings" },
      },
    });
  });

  test("converts MCP multimodal tool output into chat content blocks", () => {
    const steps = acpSessionUpdateToUiSteps(update({
      sessionUpdate: "tool_call_update",
      toolCallId: "image-tool-1",
      status: "completed",
      rawOutput: [
        { type: "text", text: "image result" },
        { type: "image", data: "ZmFrZQ==", mimeType: "image/png" },
        { type: "resource_link", uri: "file:///tmp/report.md", name: "report.md" },
      ],
    }));

    const message = steps[0].kind === "message" ? steps[0].message : null;

    expect(message?.output).toEqual([
      { type: "text", text: "image result" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "ZmFrZQ==",
        },
      },
      { type: "text", text: expect.stringContaining("resource_link") },
    ]);
  });

  test("extracts agent message chunks for the streaming text channel", () => {
    const notification = update({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "streamed answer" },
    });

    expect(acpSessionUpdateToStreamingText(notification)).toBe("streamed answer");
  });
});
