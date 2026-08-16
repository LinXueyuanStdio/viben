import { beforeEach, describe, expect, test, vi } from "vitest";
import type { LanguageModelUsage } from "ai";
import type { WebAgentUIMessage } from "@/app/types";

function makeUsage(
  partial: Partial<LanguageModelUsage> &
    Pick<LanguageModelUsage, "inputTokens" | "outputTokens" | "totalTokens">,
): LanguageModelUsage {
  return {
    cachedInputTokens: 0,
    reasoningTokens: 0,
    inputTokenDetails: undefined,
    outputTokenDetails: undefined,
    ...partial,
  } as LanguageModelUsage;
}

function makeAssistantMessage(
  overrides?: Partial<WebAgentUIMessage>,
): WebAgentUIMessage {
  return {
    id: "msg-2",
    role: "assistant",
    parts: [{ type: "text", text: "Response" }],
    ...overrides,
  } as WebAgentUIMessage;
}

const state = vi.hoisted(() => ({
  spies: {
    recordUsage: vi.fn(() => Promise.resolve()),
    recordWorkflowRun: vi.fn(() => Promise.resolve()),
    collectTaskToolUsageEvents: vi.fn(
      (_message?: unknown) =>
        [] as Array<{
          modelId?: string;
          toolCallId?: string;
          usage: LanguageModelUsage;
        }>,
    ),
    sumLanguageModelUsage: vi.fn(
      (a: LanguageModelUsage | undefined, b: LanguageModelUsage) => ({
        inputTokens: (a?.inputTokens ?? 0) + (b?.inputTokens ?? 0),
        outputTokens: (a?.outputTokens ?? 0) + (b?.outputTokens ?? 0),
      }),
    ),
  },
}));

vi.mock("@/lib/db/sessions", () => ({
  claimChatActiveStreamId: vi.fn(() => Promise.resolve(true)),
  compareAndSetChatActiveStreamId: vi.fn(() => Promise.resolve(true)),
  createChatMessageIfNotExists: vi.fn(() => Promise.resolve(undefined)),
  touchChat: vi.fn(() => Promise.resolve()),
  updateChat: vi.fn(() => Promise.resolve()),
  updateSession: vi.fn(() => Promise.resolve()),
  isFirstChatMessage: vi.fn(() => Promise.resolve(false)),
  upsertChatMessageScoped: vi.fn(() => Promise.resolve({ status: "inserted" })),
  updateChatAssistantActivity: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/sandbox/lifecycle", () => ({
  buildActiveLifecycleUpdate: vi.fn(() => ({})),
  buildLifecycleActivityUpdate: vi.fn(() => ({})),
}));

vi.mock("@/lib/db/usage", () => ({
  recordUsage: state.spies.recordUsage,
}));

vi.mock("@/lib/db/workflow-runs", () => ({
  recordWorkflowRun: state.spies.recordWorkflowRun,
}));

vi.mock("@viben/agent", () => ({
  collectTaskToolUsageEvents: state.spies.collectTaskToolUsageEvents,
  sumLanguageModelUsage: state.spies.sumLanguageModelUsage,
}));

import { recordWorkflowUsage } from "./chat-post-finish";

beforeEach(() => {
  Object.values(state.spies).forEach((spy) => spy.mockClear());
});

describe("recordWorkflowUsage", () => {
  test("records main agent usage", async () => {
    const usage = makeUsage({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cachedInputTokens: 10,
    });

    await recordWorkflowUsage("user-1", "gpt-4", usage, makeAssistantMessage());

    expect(state.spies.recordUsage).toHaveBeenCalledTimes(1);
    const calls = state.spies.recordUsage.mock.calls as unknown[][];
    expect(calls[0][0]).toBe("user-1");
    expect(calls[0][1]).toMatchObject({
      source: "web",
      agentType: "main",
      model: "gpt-4",
    });
  });

  test("records workflow run timing when provided", async () => {
    await recordWorkflowUsage(
      "user-1",
      "gpt-4",
      undefined,
      makeAssistantMessage(),
      undefined,
      {
        workflowRunId: "wrun-1",
        chatId: "chat-1",
        sessionId: "session-1",
        status: "completed",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:05.000Z",
        totalDurationMs: 5000,
        stepTimings: [
          {
            stepNumber: 1,
            startedAt: "2026-01-01T00:00:00.000Z",
            finishedAt: "2026-01-01T00:00:02.000Z",
            durationMs: 2000,
            finishReason: "tool-calls",
            rawFinishReason: "provider_tool_use",
          },
          {
            stepNumber: 2,
            startedAt: "2026-01-01T00:00:02.000Z",
            finishedAt: "2026-01-01T00:00:05.000Z",
            durationMs: 3000,
            finishReason: "stop",
            rawFinishReason: "provider_stop",
          },
        ],
      },
    );

    expect(state.spies.recordWorkflowRun).toHaveBeenCalledTimes(1);
    const calls = state.spies.recordWorkflowRun.mock.calls as unknown[][];
    expect(calls[0][0]).toMatchObject({
      id: "wrun-1",
      chatId: "chat-1",
      sessionId: "session-1",
      userId: "user-1",
      modelId: "gpt-4",
      status: "completed",
      totalDurationMs: 5000,
      stepTimings: [
        expect.objectContaining({ stepNumber: 1, durationMs: 2000 }),
        expect.objectContaining({ stepNumber: 2, durationMs: 3000 }),
      ],
    });
  });

  test("continues recording usage when workflow run persistence fails", async () => {
    state.spies.recordWorkflowRun.mockImplementationOnce(() =>
      Promise.reject(new Error("workflow runs table missing")),
    );

    const usage = makeUsage({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    await recordWorkflowUsage(
      "user-1",
      "gpt-4",
      usage,
      makeAssistantMessage(),
      undefined,
      {
        workflowRunId: "wrun-1",
        chatId: "chat-1",
        sessionId: "session-1",
        status: "completed",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:05.000Z",
        totalDurationMs: 5000,
        stepTimings: [],
      },
    );

    expect(state.spies.recordWorkflowRun).toHaveBeenCalledTimes(1);
    expect(state.spies.recordUsage).toHaveBeenCalledTimes(1);
    expect(
      (state.spies.recordUsage.mock.calls as unknown[][])[0][1],
    ).toMatchObject({
      agentType: "main",
      model: "gpt-4",
    });
  });

  test("skips main recording when totalUsage is undefined", async () => {
    await recordWorkflowUsage(
      "user-1",
      "gpt-4",
      undefined,
      makeAssistantMessage(),
    );

    expect(state.spies.recordUsage).not.toHaveBeenCalled();
  });

  test("records subagent usage grouped by model", async () => {
    const subEvents = [
      {
        modelId: "claude-3",
        toolCallId: "task-1",
        usage: makeUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
      },
      {
        modelId: "claude-3",
        toolCallId: "task-2",
        usage: makeUsage({
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30,
        }),
      },
      {
        modelId: "gpt-4",
        toolCallId: "task-3",
        usage: makeUsage({
          inputTokens: 30,
          outputTokens: 15,
          totalTokens: 45,
        }),
      },
    ];
    state.spies.collectTaskToolUsageEvents.mockReturnValueOnce(subEvents);

    const usage = makeUsage({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    await recordWorkflowUsage("user-1", "gpt-4", usage, makeAssistantMessage());

    expect(state.spies.recordUsage).toHaveBeenCalledTimes(3);

    const calls = state.spies.recordUsage.mock.calls as unknown[][];
    const subCalls = calls.filter(
      (c) => (c[1] as { agentType: string }).agentType === "subagent",
    );
    expect(subCalls).toHaveLength(2);

    const models = subCalls.map((c) => (c[1] as { model: string }).model);
    expect(models.toSorted()).toEqual(["claude-3", "gpt-4"]);

    const claudeCall = subCalls.find(
      (c) => (c[1] as { model: string }).model === "claude-3",
    );
    const gptCall = subCalls.find(
      (c) => (c[1] as { model: string }).model === "gpt-4",
    );

    expect(claudeCall?.[1]).toMatchObject({
      toolCallCount: 2,
      usage: {
        inputTokens: 30,
        outputTokens: 15,
      },
    });
    expect(gptCall?.[1]).toMatchObject({
      toolCallCount: 1,
      usage: {
        inputTokens: 30,
        outputTokens: 15,
      },
    });
  });

  test("records only new subagent usage when continuing an existing assistant message", async () => {
    const previousMessage = makeAssistantMessage({ id: "msg-prev" });
    const responseMessage = makeAssistantMessage({ id: "msg-next" });

    const existingEvent = {
      modelId: "claude-3",
      toolCallId: "task-existing",
      usage: makeUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
    };
    const newEvent = {
      modelId: "claude-3",
      toolCallId: "task-new",
      usage: makeUsage({ inputTokens: 7, outputTokens: 3, totalTokens: 10 }),
    };

    state.spies.collectTaskToolUsageEvents.mockImplementation(
      (message?: unknown) => {
        const messageId = (message as { id?: string } | undefined)?.id;

        if (messageId === "msg-prev") {
          return [existingEvent];
        }

        if (messageId === "msg-next") {
          return [existingEvent, newEvent];
        }

        return [];
      },
    );

    await recordWorkflowUsage(
      "user-1",
      "gpt-4",
      undefined,
      responseMessage,
      previousMessage,
    );

    expect(state.spies.recordUsage).toHaveBeenCalledTimes(1);
    const calls = state.spies.recordUsage.mock.calls as unknown[][];
    expect(calls[0][1]).toMatchObject({
      source: "web",
      agentType: "subagent",
      model: "claude-3",
      toolCallCount: 1,
      usage: {
        inputTokens: 7,
        outputTokens: 3,
      },
    });
  });

  test("falls back to main modelId when event has no modelId", async () => {
    state.spies.collectTaskToolUsageEvents.mockReturnValueOnce([
      {
        modelId: undefined,
        usage: makeUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
      },
    ]);

    await recordWorkflowUsage(
      "user-1",
      "gpt-4",
      undefined,
      makeAssistantMessage(),
    );

    expect(state.spies.recordUsage).toHaveBeenCalledTimes(1);
    const calls = state.spies.recordUsage.mock.calls as unknown[][];
    expect((calls[0][1] as { model: string }).model).toBe("gpt-4");
  });

  test("does not throw on error", async () => {
    state.spies.recordUsage.mockImplementationOnce(() =>
      Promise.reject(new Error("Usage DB down")),
    );

    const usage = makeUsage({
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
    });

    await recordWorkflowUsage("user-1", "gpt-4", usage, makeAssistantMessage());
  });
});
