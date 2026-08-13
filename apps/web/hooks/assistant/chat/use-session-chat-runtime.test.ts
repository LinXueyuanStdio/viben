import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useSessionChatRuntime } from "./use-session-chat-runtime";

const mocks = vi.hoisted(() => ({
  capturedOnData: undefined as
    | undefined
    | ((dataPart: { type: string; data?: unknown }) => void),
  emitPageContentChanged: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(() => ({
    status: "ready",
    messages: [],
    clearError: vi.fn(),
    resumeStream: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("@/lib/chat-instance-manager", () => ({
  abortChatInstanceTransport: vi.fn(),
  removeChatInstance: vi.fn(),
  getOrCreateChatInstance: vi.fn(
    (
      _chatId: string,
      options: { onData: typeof mocks.capturedOnData },
    ) => {
      mocks.capturedOnData = options.onData;
      return {
        instance: {
          id: "chat-1",
          status: "ready",
          messages: [],
          stop: vi.fn(),
        },
        alreadyExisted: false,
      };
    },
  ),
}));

vi.mock("@/lib/page-chat/page-content-events", () => ({
  emitPageContentChanged: mocks.emitPageContentChanged,
}));

describe("useSessionChatRuntime onData", () => {
  test("publishes page event from data-page-content-changed", () => {
    renderHook(() =>
      useSessionChatRuntime({
        sessionId: "session-1",
        chatId: "chat-1",
        initialMessages: [],
        initialChatActiveStreamId: null,
        contextLimit: null,
      }),
    );

    mocks.capturedOnData?.({
      type: "data-page-content-changed",
      data: { publishedPageId: "page-1", chatId: "chat-1" },
    });

    expect(mocks.emitPageContentChanged).toHaveBeenCalledWith({
      publishedPageId: "page-1",
      chatId: "chat-1",
    });
  });
});
