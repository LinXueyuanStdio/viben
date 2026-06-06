// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("../chat-input/toolbar", async () => {
  const React = await import("react");
  return {
    ChatInputToolbar: ({ endActions }: { endActions?: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "chat-input-toolbar" }, endActions),
  };
}));

describe("ChatInput layout", () => {
  test("can render compact two-row layout with editor first and toolbar actions second", async () => {
    const { ChatInput } = await import("../chat-input");

    const { container } = render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        showTopToolbar
        toolbarPosition="bottom"
        showConfigBar={false}
        defaultHeight={48}
        minHeight={48}
        maxHeight={48}
      />
    );

    const editor = container.querySelector(".viben-chat-input-editor");
    const toolbar = screen.getByTestId("chat-input-toolbar");
    const submitControl = screen.getByTestId("chat-input-submit-control");

    expect(editor).toBeInTheDocument();
    expect(editor?.compareDocumentPosition(toolbar) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(toolbar).toContainElement(submitControl);
    expect(screen.queryByTestId("chat-input-basic-actions")).not.toBeInTheDocument();
  });
});
