// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useStepPlayer } from "./use-step-player";
import type { DemoStep } from "./use-step-player";

describe("useStepPlayer", () => {
  test("loadSteps replaces the active playback steps and applies message updates", () => {
    const initialSteps: DemoStep[] = [
      {
        messages: [{ id: "old", type: "text", content: "old demo step" }],
      },
    ];
    const loadedSteps: DemoStep[] = [
      {
        messages: [
          {
            id: "agent-msg",
            type: "tool_use",
            name: "Agent",
            toolUseId: "agent-tool",
            input: { description: "Research" },
          },
        ],
      },
      {
        messages: [],
        messageUpdates: {
          "agent-msg": {
            subagentPreviewMessages: [
              { id: "preview", type: "text", content: "live preview" },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(() => useStepPlayer(initialSteps));

    act(() => {
      result.current.loadSteps(loadedSteps);
      result.current.play();
      result.current.next();
      result.current.next();
    });

    expect(result.current.totalSteps).toBe(2);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.id).toBe("agent-msg");
    expect(result.current.messageUpdates["agent-msg"]?.subagentPreviewMessages?.[0]?.content)
      .toBe("live preview");
  });
});
