import { beforeEach, describe, expect, test, vi } from "vitest";
import type { WebAgentUIMessage } from "@/app/types";

const state = vi.hoisted(() => {
  const s = {
    upsertResult: { status: "inserted" } as {
      status: "inserted" | "updated" | "conflict";
    },
    upsertSpy: vi.fn(),
  };
  s.upsertSpy.mockImplementation(() => Promise.resolve(s.upsertResult));
  return s;
});

vi.mock("ai", () => ({
  isToolUIPart: (part: { type: string }) =>
    part.type.startsWith("tool-") || part.type === "dynamic-tool",
}));

vi.mock("@/lib/db/sessions", () => ({
  upsertChatMessageScoped: state.upsertSpy,
}));

import { persistAssistantMessagesWithToolResults } from "./persist-tool-results";

function assistantWithToolResult(
  overrides?: Partial<WebAgentUIMessage>,
): WebAgentUIMessage[] {
  return [
    {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "text", text: "Let me ask you a question." },
        {
          type: "tool-ask_user_question",
          toolCallId: "call-1",
          toolName: "ask_user_question",
          state: "output-available",
          args: { questions: [] },
          output: { answers: { "0": "Yes" } },
        },
      ],
      ...overrides,
    } as WebAgentUIMessage,
  ];
}

describe("persistAssistantMessagesWithToolResults", () => {
  beforeEach(() => {
    state.upsertResult = { status: "inserted" };
    state.upsertSpy.mockClear();
  });

  test("persists assistant message with tool results", async () => {
    await persistAssistantMessagesWithToolResults(
      "chat-1",
      assistantWithToolResult(),
    );

    expect(state.upsertSpy).toHaveBeenCalledTimes(1);
    const calls = state.upsertSpy.mock.calls as unknown[][];
    expect(calls[0]![0]).toMatchObject({
      id: "assistant-1",
      chatId: "chat-1",
      role: "assistant",
    });
  });

  test("skips when latest message is not assistant", async () => {
    await persistAssistantMessagesWithToolResults("chat-1", [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Hello" }],
      } as WebAgentUIMessage,
    ]);

    expect(state.upsertSpy).not.toHaveBeenCalled();
  });

  test("skips when assistant message has no tool results", async () => {
    await persistAssistantMessagesWithToolResults("chat-1", [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [{ type: "text", text: "Just text." }],
      } as WebAgentUIMessage,
    ]);

    expect(state.upsertSpy).not.toHaveBeenCalled();
  });

  test("skips when messages array is empty", async () => {
    await persistAssistantMessagesWithToolResults("chat-1", []);

    expect(state.upsertSpy).not.toHaveBeenCalled();
  });

  test("logs warning on conflict", async () => {
    state.upsertResult = { status: "conflict" };

    await persistAssistantMessagesWithToolResults(
      "chat-1",
      assistantWithToolResult(),
    );

    expect(state.upsertSpy).toHaveBeenCalledTimes(1);
  });

  test("does not throw on db error", async () => {
    state.upsertSpy.mockImplementationOnce(() =>
      Promise.reject(new Error("DB down")),
    );

    await persistAssistantMessagesWithToolResults(
      "chat-1",
      assistantWithToolResult(),
    );

    expect(state.upsertSpy).toHaveBeenCalledTimes(1);
  });
});
