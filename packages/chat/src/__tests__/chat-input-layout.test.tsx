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

vi.mock("../emoji-picker", () => ({
  EmojiPicker: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect("🙂")}>Pick emoji</button>
  ),
}));
vi.mock("../emoji-picker/index", () => ({
  EmojiPicker: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect("🙂")}>Pick emoji</button>
  ),
}));
vi.mock("/root/viben/packages/chat/src/emoji-picker/index.tsx", () => ({
  EmojiPicker: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect("🙂")}>Pick emoji</button>
  ),
}));

vi.mock("@emoji-mart/data", () => ({ default: {} }));
vi.mock("@emoji-mart/data/sets/15/native.json", () => ({ default: {} }));
vi.mock("@emoji-mart/react", () => ({
  default: ({ onEmojiSelect }: { onEmojiSelect: (emoji: { native: string }) => void }) => (
    <button type="button" onClick={() => onEmojiSelect({ native: "🙂" })}>Pick emoji</button>
  ),
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
