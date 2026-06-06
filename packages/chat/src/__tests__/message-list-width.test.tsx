import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { MessageList } from "../message-list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("MessageList width", () => {
  test("wraps regular messages in a centered max-width row shell", () => {
    render(
      <MessageList
        messages={[{ id: "m1", type: "text", content: "assistant message" }]}
        maxMessageWidth="760px"
      />
    );

    const rowShell = screen.getByText("assistant message").closest("[data-message-width-shell='true']");
    expect(rowShell).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });

  test("wraps task groups in the same centered max-width row shell", () => {
    render(
      <MessageList
        messages={[
          {
            id: "tool-1",
            type: "tool_use",
            name: "Read",
            toolUseId: "read-1",
            input: { file_path: "/root/viben/package.json" },
          },
          {
            id: "result-1",
            type: "tool_result",
            toolUseId: "read-1",
            output: "file output",
          },
        ]}
        maxMessageWidth="760px"
      />
    );

    const rowShell = screen.getByText("Read 1 files").closest("[data-message-width-shell='true']");
    expect(rowShell).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });

  test("wraps the thinking loading indicator in the same centered max-width row shell", () => {
    render(
      <MessageList
        messages={[{ id: "m1", type: "user", content: "start" }]}
        isStreaming
        maxMessageWidth="760px"
      />
    );

    const rowShell = screen.getByText("Thinking...").closest("[data-message-width-shell='true']");
    expect(rowShell).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });

  test("does not clip sticky message avatars inside the scroll content", () => {
    const { container } = render(
      <MessageList
        messages={[{ id: "m1", type: "text", content: "assistant message" }]}
      />
    );

    const content = container.querySelector("[data-message-list-content='true']");

    expect(content).toBeInTheDocument();
    expect(content).not.toHaveClass("overflow-hidden");
  });

  test("passes custom user and assistant avatars through to rendered messages", () => {
    const onUserAvatarClick = vi.fn();
    const onAssistantAvatarClick = vi.fn();
    const userMessage = { id: "user-1", type: "user" as const, content: "from user" };
    const assistantMessage = { id: "assistant-1", type: "text" as const, content: "from assistant" };

    render(
      <MessageList
        messages={[userMessage, assistantMessage]}
        userAvatar={<span data-testid="list-user-avatar">U</span>}
        assistantAvatar={<span data-testid="list-assistant-avatar">A</span>}
        onUserAvatarClick={onUserAvatarClick}
        onAssistantAvatarClick={onAssistantAvatarClick}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "User avatar" }));
    fireEvent.click(screen.getByRole("button", { name: "Assistant avatar" }));

    expect(screen.getByTestId("list-user-avatar")).toBeInTheDocument();
    expect(screen.getByTestId("list-assistant-avatar")).toBeInTheDocument();
    expect(onUserAvatarClick).toHaveBeenCalledWith(userMessage);
    expect(onAssistantAvatarClick).toHaveBeenCalledWith(assistantMessage);
  });
});
