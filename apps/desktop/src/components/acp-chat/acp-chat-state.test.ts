import { describe, expect, it } from "vitest";
import { applyQueuedUiStep, createUiSession, stopSessionTurn } from "./acp-chat-state";

describe("ACP chat session state", () => {
  it("marks an interrupted turn as stopped immediately", () => {
    const session = {
      ...createUiSession("session-1", "/tmp/workspace", { sessionId: "session-1" }),
      promptInFlight: true,
      streamingText: "partial output",
      pendingPlan: {
        goal: "Plan",
        steps: [],
        approvalStatus: "pending" as const,
      },
    };

    const stopped = stopSessionTurn(session);

    expect(stopped.promptInFlight).toBe(false);
    expect(stopped.pendingPlan).toBeNull();
    expect(stopped.streamingText).toBeNull();
    expect(stopped.uiMessages.at(-1)).toMatchObject({
      type: "text",
      content: "partial output",
    });
  });

  it("deduplicates adjacent reconnect and disconnect notices", () => {
    const session = createUiSession("session-1", "/tmp/workspace", { sessionId: "session-1" });
    const reconnectStep = {
      kind: "message" as const,
      message: {
        id: "status-1",
        type: "status_update" as const,
        content: "Codex is reconnecting...",
        timestamp: 1,
      },
    };
    const disconnectStep = {
      kind: "message" as const,
      message: {
        id: "error-1",
        type: "error" as const,
        message: "Codex connection dropped before the response completed. Start a new turn or reconnect the session.",
        isError: true,
        timestamp: 2,
      },
    };

    const withReconnect = applyQueuedUiStep(session, reconnectStep, []);
    const withoutDuplicateReconnect = applyQueuedUiStep(withReconnect, {
      ...reconnectStep,
      message: { ...reconnectStep.message, id: "status-2", timestamp: 3 },
    }, []);
    const withDisconnect = applyQueuedUiStep(withoutDuplicateReconnect, disconnectStep, []);
    const withoutDuplicateDisconnect = applyQueuedUiStep(withDisconnect, {
      ...disconnectStep,
      message: { ...disconnectStep.message, id: "error-2", timestamp: 4 },
    }, []);

    expect(withoutDuplicateDisconnect.uiMessages).toEqual([
      expect.objectContaining({ type: "status_update", content: "Codex is reconnecting..." }),
      expect.objectContaining({
        type: "error",
        message: "Codex connection dropped before the response completed. Start a new turn or reconnect the session.",
      }),
    ]);
  });
});
