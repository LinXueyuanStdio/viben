// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { useStepPlayer } from "./use-step-player";
import type { DemoStep } from "./use-step-player";

afterEach(() => {
  vi.useRealTimers();
});

describe("useStepPlayer", () => {
  test("flushes queued scripted user messages before continuing after the agent becomes idle", () => {
    const steps: DemoStep[] = [
      { messages: [{ id: "user-start", type: "user", content: "start" }] },
      { messages: [{ id: "tool-use", type: "tool_use", name: "Write", toolUseId: "tool-1" }] },
      { messages: [{ id: "queued-user", type: "user", content: "queued while busy" }] },
      { messages: [{ id: "tool-result", type: "tool_result", toolUseId: "tool-1", output: "done" }] },
      { messages: [{ id: "assistant-next", type: "thinking", content: "process queued input" }] },
    ];

    const { result } = renderHook(() => useStepPlayer(steps));

    act(() => {
      result.current.next();
      result.current.next();
      result.current.next();
    });

    expect(result.current.messages.map((message) => message.id)).toEqual(["user-start", "tool-use"]);
    expect(result.current.queuedUserMessages.map((message) => message.id)).toEqual(["queued-user"]);

    act(() => {
      result.current.next();
    });

    expect(result.current.messages.map((message) => message.id)).toEqual(["user-start", "tool-use", "tool-result"]);
    expect(result.current.queuedUserMessages.map((message) => message.id)).toEqual(["queued-user"]);

    act(() => {
      result.current.next();
    });

    expect(result.current.messages.map((message) => message.id)).toEqual([
      "user-start",
      "tool-use",
      "tool-result",
      "queued-user",
    ]);
    expect(result.current.queuedUserMessages).toEqual([]);

    act(() => {
      result.current.next();
    });

    expect(result.current.messages.map((message) => message.id)).toEqual([
      "user-start",
      "tool-use",
      "tool-result",
      "queued-user",
      "assistant-next",
    ]);
  });

  test("keeps Claude Code interrupt notices in the message list instead of the command queue", () => {
    const steps: DemoStep[] = [
      { messages: [{ id: "tool-use", type: "tool_use", name: "Read", toolUseId: "tool-1" }] },
      { messages: [{ id: "interrupt", type: "user", content: "[Request interrupted by user]" }] },
    ];

    const { result } = renderHook(() => useStepPlayer(steps));

    act(() => {
      result.current.next();
      result.current.next();
    });

    expect(result.current.messages.map((message) => message.id)).toEqual(["tool-use", "interrupt"]);
    expect(result.current.queuedUserMessages).toEqual([]);
  });

  test("auto playback does not stall before the tool result that releases queued scripted users", () => {
    vi.useFakeTimers();

    const steps: DemoStep[] = [
      { messages: [{ id: "user-start", type: "user", content: "start" }], delayMs: 1 },
      { messages: [{ id: "tool-use", type: "tool_use", name: "Write", toolUseId: "tool-1" }], delayMs: 1 },
      { messages: [{ id: "queued-user", type: "user", content: "queued while busy" }], delayMs: 1 },
      { messages: [{ id: "tool-result", type: "tool_result", toolUseId: "tool-1", output: "done" }], delayMs: 1 },
      { messages: [{ id: "assistant-next", type: "thinking", content: "process queued input" }], delayMs: 1 },
    ];

    const { result } = renderHook(() => useStepPlayer(steps));

    act(() => {
      result.current.play();
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(result.current.messages.map((message) => message.id)).toEqual([
      "user-start",
      "tool-use",
      "tool-result",
      "queued-user",
      "assistant-next",
    ]);
    expect(result.current.queuedUserMessages).toEqual([]);
  });

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
            subagentMessages: [
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
    expect(result.current.messageUpdates["agent-msg"]?.subagentMessages?.[0]?.content)
      .toBe("live preview");
  });
});
