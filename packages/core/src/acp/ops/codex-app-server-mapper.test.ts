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

  it("maps completed agent messages to ACP agent message chunks", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "msg-1",
          type: "agentMessage",
          text: "final answer",
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "msg-1",
        content: { type: "text", text: "final answer" },
      },
    });
  });

  it("maps completed reasoning items to ACP thought chunks", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "reasoning-1",
          type: "reasoning",
          summary: [{ text: "checked files" }],
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_thought_chunk",
        messageId: "reasoning-1",
        content: { type: "text", text: "checked files" },
      },
    });
  });

  it("maps plan deltas and completed plan items to ACP thought chunks", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/plan/delta",
      params: {
        itemId: "plan-1",
        delta: "1. Inspect files",
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_thought_chunk",
        messageId: "plan-1",
        content: { type: "text", text: "1. Inspect files" },
      },
    });

    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "plan-1",
          type: "plan",
          text: "1. Inspect files\n2. Patch code",
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_thought_chunk",
        messageId: "plan-1",
        content: { type: "text", text: "1. Inspect files\n2. Patch code" },
      },
    });
  });

  it("maps completed review items to ACP agent messages", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "review-1",
          type: "exitedReviewMode",
          review: "Looks solid.",
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "agent_message_chunk",
        messageId: "review-1",
        content: { type: "text", text: "Looks solid." },
      },
    });
  });

  it("maps Codex error notifications to ACP error updates", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "error",
      params: {
        error: {
          message: "upstream failed",
          codexErrorInfo: { type: "InternalServerError" },
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "error",
        error: {
          message: "upstream failed",
          raw: {
            message: "upstream failed",
            codexErrorInfo: { type: "InternalServerError" },
          },
        },
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

  it("maps Codex file changes to ACP edit tool updates", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/completed",
      params: {
        item: {
          id: "file-1",
          type: "fileChange",
          changes: [{ path: "/tmp/a.ts", kind: "update", diff: "@@" }],
          status: "completed",
        },
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "file-1",
        title: "File changes",
        kind: "edit",
        status: "completed",
        rawInput: { changes: [{ path: "/tmp/a.ts", kind: "update", diff: "@@" }] },
        rawOutput: [{ path: "/tmp/a.ts", kind: "update", diff: "@@" }],
        content: [
          {
            type: "diff",
            path: "/tmp/a.ts",
            oldText: "",
            newText: "@@",
          },
        ],
      },
    });
  });

  it("maps deprecated file change output deltas to ACP tool updates", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "item/fileChange/outputDelta",
      params: {
        itemId: "file-1",
        delta: "applying patch",
      },
    })).toEqual({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "file-1",
        title: "File changes",
        kind: "edit",
        rawOutput: "applying patch",
        content: [
          {
            type: "content",
            content: { type: "text", text: "applying patch" },
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

  it("maps Codex token usage payloads to ACP usage updates", () => {
    expect(codexNotificationToAcpSessionUpdate("outer-session", {
      method: "thread/tokenUsage/updated",
      params: {
        tokenUsage: {
          total: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
          },
          modelContextWindow: 200000,
        },
      },
    })).toMatchObject({
      sessionId: "outer-session",
      update: {
        sessionUpdate: "usage_update",
        used: 20,
        size: 200000,
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      },
    });
  });
});
