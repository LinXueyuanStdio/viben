import { describe, expect, it } from "vitest";
import {
  codexApprovalDecisionFromAcp,
  codexApprovalRequestToAcpPermission,
  codexNotificationToAcpSessionUpdate,
  codexTurnToStopReason,
} from "./codex-app-server-mapper";

describe("codex-app-server mapper", () => {
  it("maps agent message deltas to ACP agent message chunks", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/agentMessage/delta",
      params: {
        itemId: "msg-1",
        delta: "hello",
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "msg-1",
        content: { type: "text", text: "hello" },
      },
    });
  });

  it("maps command approval requests with ACP toolCall shape", () => {
    expect(codexApprovalRequestToAcpPermission("outer-session", {
      id: 17,
      method: "item/commandExecution/requestApproval",
      params: {
        itemId: "cmd-1",
        reason: "needs shell",
        command: ["pnpm", "test"],
        cwd: "/tmp/project",
      },
    })).toEqual({
      sessionId: "outer-session",
      toolCall: {
        toolCallId: "cmd-1",
        title: "Run command",
        kind: "execute",
        rawInput: {
          reason: "needs shell",
          command: ["pnpm", "test"],
          cwd: "/tmp/project",
        },
      },
      options: [
        { optionId: "accept", name: "Accept", kind: "allow_once" },
        { optionId: "acceptForSession", name: "Accept for session", kind: "allow_always" },
        { optionId: "decline", name: "Decline", kind: "reject_once" },
        { optionId: "cancel", name: "Cancel", kind: "reject_always" },
      ],
    });
  });

  it("maps ACP permission outcomes back to Codex decisions", () => {
    expect(codexApprovalDecisionFromAcp({ outcome: { outcome: "selected", optionId: "acceptForSession" } }))
      .toEqual({ decision: "acceptForSession" });
    expect(codexApprovalDecisionFromAcp({ outcome: { outcome: "cancelled" } }))
      .toEqual({ decision: "cancel" });
  });

  it("maps completed tool items to ACP tool_call_update content envelopes", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "cmd-1",
          type: "commandExecution",
          command: ["echo", "ok"],
          aggregatedOutput: "ok\n",
          status: "completed",
          exitCode: 0,
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "cmd-1",
        title: "Command",
        kind: "execute",
        status: "completed",
        rawInput: { command: ["echo", "ok"] },
        rawOutput: "ok\n",
        content: [
          {
            type: "content",
            content: { type: "text", text: "ok\n" },
          },
        ],
      },
    });
  });

  it("keeps unknown Codex items visible", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "item-unknown",
          type: "futureItem",
          value: 42,
        },
      },
    })).toMatchObject({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "codex_item",
        title: "futureItem",
        itemId: "item-unknown",
      },
    });
  });

  it("does not invent an invalid ACP stop reason for failed turns", () => {
    expect(codexTurnToStopReason({ id: "turn-1", status: "completed" })).toBe("end_turn");
    expect(codexTurnToStopReason({ id: "turn-2", status: "interrupted" })).toBe("cancelled");
    expect(codexTurnToStopReason({ id: "turn-3", status: "failed" })).toBeNull();
  });
});
