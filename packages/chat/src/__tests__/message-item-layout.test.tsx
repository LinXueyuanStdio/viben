import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MessageItem } from "../message-item";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("MessageItem layout", () => {
  test("renders user messages with a left avatar and left-aligned content", () => {
    const { container } = render(
      <MessageItem
        message={{ type: "user", content: "hello from user" }}
        maxWidth="760px"
      />
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
    });

    const row = screen.getByText("hello from user").closest(".flex.gap-3");
    expect(row?.firstElementChild).toContainElement(
      container.querySelector("svg")
    );
    expect(container.querySelector(".justify-end")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-br-md")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-tl-md")).toBeInTheDocument();
  });

  test.each([
    ["user", { type: "user" as const, content: "hello from user" }, "hello from user"],
    ["assistant", { type: "text" as const, content: "hello from assistant" }, "hello from assistant"],
    ["error", { type: "error" as const, message: "something failed" }, "something failed"],
  ])("keeps the %s message avatar sticky within its message row", (_label, message, text) => {
    const { container } = render(<MessageItem message={message} />);

    const row = screen.getByText(text).closest(".flex.gap-3");
    const avatar = row?.firstElementChild;

    expect(avatar).toBe(container.querySelector("[data-message-avatar='true']"));
    expect(avatar).toHaveClass("sticky", "top-0", "self-start");
  });

  test("renders a custom user avatar and calls the user avatar click handler with the message", () => {
    const onUserAvatarClick = vi.fn();
    const message = { id: "user-1", type: "user" as const, content: "hello from user" };

    render(
      <MessageItem
        message={message}
        userAvatar={<span data-testid="custom-user-avatar">U</span>}
        onUserAvatarClick={onUserAvatarClick}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "User avatar" }));

    expect(screen.getByTestId("custom-user-avatar")).toBeInTheDocument();
    expect(onUserAvatarClick).toHaveBeenCalledWith(message);
  });

  test("renders a custom assistant avatar and calls the assistant avatar click handler with the message", () => {
    const onAssistantAvatarClick = vi.fn();
    const message = { id: "assistant-1", type: "text" as const, content: "hello from assistant" };

    render(
      <MessageItem
        message={message}
        assistantAvatar={<span data-testid="custom-assistant-avatar">A</span>}
        onAssistantAvatarClick={onAssistantAvatarClick}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Assistant avatar" }));

    expect(screen.getByTestId("custom-assistant-avatar")).toBeInTheDocument();
    expect(onAssistantAvatarClick).toHaveBeenCalledWith(message);
  });
});
