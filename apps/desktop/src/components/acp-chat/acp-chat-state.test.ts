import { describe, expect, it } from "vitest";
import { createUiSession, stopSessionTurn } from "./acp-chat-state";

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
});
