import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { WebAgentUIMessage } from "@/app/types";
import { ChatTranscript } from "./chat-transcript";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

vi.mock("@/components/assistant/lazy-streamdown", () => ({
  LazyStreamdown: ({ children }: { children: string }) => (
    <div data-testid="assistant-text">{children}</div>
  ),
}));

vi.mock("@/components/assistant/thinking-block", () => ({
  ThinkingBlock: ({ text }: { text: string }) => (
    <div data-testid="reasoning">{text}</div>
  ),
}));

vi.mock("@/components/assistant/tool-call", () => ({
  ToolCall: ({ part }: { part: { type: string; toolName?: string } }) => (
    <div data-testid="tool-call">{part.toolName ?? part.type}</div>
  ),
}));

vi.mock("@/components/assistant/assistant-message-groups", () => ({
  AssistantMessageGroups: ({ children }: { children: (open: boolean) => React.ReactNode }) => (
    <div data-testid="assistant-message">{children(true)}</div>
  ),
}));

vi.mock("@/components/assistant/message-model-pill", () => ({
  MessageModelPill: () => <span data-testid="model-pill" />,
}));

const baseProps = {
  status: "ready" as const,
  error: undefined,
  onCopyMessage: vi.fn(),
  onRetryMessage: vi.fn(),
  messageDurationMap: {},
  messageStartedAtMap: {},
  lastUserMessageSentAt: null,
};

function textMessage(
  id: string,
  role: "user" | "assistant",
  text: string,
): WebAgentUIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  } as WebAgentUIMessage;
}

describe("ChatTranscript", () => {
  test("renders user, reasoning, tool and assistant parts in order", () => {
    const messages = [
      textMessage("user-1", "user", "User prompt"),
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "Thinking", state: "done" },
          {
            type: "tool-get_page",
            toolCallId: "tool-1",
            toolName: "get_page",
            state: "output-available",
            input: {},
            output: { ok: true },
          },
          { type: "text", text: "Assistant answer" },
        ],
      } as WebAgentUIMessage,
    ];

    render(<ChatTranscript {...baseProps} messages={messages} />);

    const ordered = [
      screen.getByText("User prompt"),
      screen.getByTestId("reasoning"),
      screen.getByTestId("tool-call"),
      screen.getByTestId("assistant-text"),
    ];

    expect(ordered.map((node) => node.textContent)).toEqual([
      "User prompt",
      "Thinking",
      "get_page",
      "Assistant answer",
    ]);
    expect(
      ordered[0].compareDocumentPosition(ordered[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      ordered[1].compareDocumentPosition(ordered[2]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      ordered[2].compareDocumentPosition(ordered[3]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  test("omits work-only actions when callbacks are absent", () => {
    render(
      <ChatTranscript
        {...baseProps}
        messages={[textMessage("assistant-1", "assistant", "Answer")]}
        onForkMessage={undefined}
        onOpenFile={undefined}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /fork/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open file/i }),
    ).not.toBeInTheDocument();
  });

  test("reports a successful update_page result once", () => {
    const onPageContentChanged = vi.fn();
    const messages = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-update_page",
            toolCallId: "tool-update-1",
            toolName: "update_page",
            state: "output-available",
            input: {},
            output: {
              success: true,
              published_page_id: "page-1",
              chat_id: "chat-1",
            },
          },
          { type: "text", text: "Updated." },
        ],
      } as WebAgentUIMessage,
    ];

    const { rerender } = render(
      <ChatTranscript
        {...baseProps}
        messages={messages}
        onPageContentChanged={onPageContentChanged}
      />,
    );
    rerender(
      <ChatTranscript
        {...baseProps}
        messages={messages}
        onPageContentChanged={onPageContentChanged}
      />,
    );

    expect(onPageContentChanged).toHaveBeenCalledOnce();
    expect(onPageContentChanged).toHaveBeenCalledWith({
      publishedPageId: "page-1",
      chatId: "chat-1",
    });
  });
});
