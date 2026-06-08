// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("../../model-icons", () => ({
  getModelIcon: () => null,
}));

describe("ChatInput layout", () => {
  test("compact layout renders single-line input with + button and submit control", async () => {
    const { ChatInput } = await import("../index");

    render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        layoutVariant="compact"
        showTopToolbar={false}
        showBottomToolbar={false}
      />
    );

    const compactRow = screen.getByTestId("compact-chat-input-row");
    const inputField = screen.getByTestId("compact-chat-input-field");
    const submitControl = screen.getByTestId("chat-input-submit-control");

    expect(compactRow).toContainElement(inputField);
    expect(compactRow).toContainElement(submitControl);
    expect(screen.queryByTestId("chat-input-toolbar")).not.toBeInTheDocument();
  });

  test("expanded layout renders top toolbar, editor, and bottom toolbar as three rows", async () => {
    const { ChatInput, ChatInputTopToolbar, ChatInputBottomToolbar } = await import("../index");

    const { container } = render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        layoutVariant="expanded"
        showTopToolbar
        showBottomToolbar
        topToolbar={
          <ChatInputTopToolbar
            onEmojiSelect={() => {}}
            onFileClick={() => {}}
          />
        }
        bottomToolbar={
          <ChatInputBottomToolbar
            leftContent={<span>Config</span>}
            onSend={() => {}}
            canSubmit={false}
          />
        }
      />
    );

    const topToolbar = screen.getByTestId("chat-input-toolbar");
    const editor = container.querySelector(".viben-chat-input-editor");
    const bottomControls = screen.getByTestId("chat-input-config-controls");

    expect(topToolbar.compareDocumentPosition(editor as HTMLElement)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(editor?.compareDocumentPosition(bottomControls) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "2");
  });

  test("top and bottom toolbars can both be hidden", async () => {
    const { ChatInput } = await import("../index");

    const { container } = render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        layoutVariant="expanded"
        showTopToolbar={false}
        showBottomToolbar={false}
      />
    );

    expect(screen.queryByTestId("chat-input-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-input-config-controls")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-input-bottom-toolbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-input-basic-actions")).not.toBeInTheDocument();
    expect(container.querySelector(".viben-chat-input-editor")).toBeInTheDocument();
  });

  test("custom toolbar content can be provided directly as ReactNode", async () => {
    const { ChatInput } = await import("../index");

    render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        showTopToolbar
        showBottomToolbar
        topToolbar={<div data-testid="custom-top">Top actions</div>}
        bottomToolbar={
          <div data-testid="custom-bottom">
            <div data-testid="custom-bottom-left">Left</div>
            <div data-testid="custom-bottom-right">Right</div>
          </div>
        }
      />
    );

    expect(screen.getByTestId("custom-top")).toBeInTheDocument();
    expect(screen.getByTestId("custom-bottom")).toBeInTheDocument();
    expect(screen.getByTestId("custom-bottom-left")).toBeInTheDocument();
    expect(screen.getByTestId("custom-bottom-right")).toBeInTheDocument();
  });

  test("writing mode parts can be composed without ChatInput state", async () => {
    const {
      WritingModeRoot,
      WritingModeHeader,
      WritingModeEditor,
      WritingModeFooter,
      WritingModeSubmitControl,
    } = await import("../index");
    const onContentChange = vi.fn();
    const onSend = vi.fn();

    render(
      <WritingModeRoot>
        <WritingModeHeader>
          <span>Custom composer</span>
        </WritingModeHeader>
        <WritingModeEditor
          content="draft"
          onContentChange={onContentChange}
          onKeyDown={() => {}}
          onCompositionStart={() => {}}
          onCompositionEnd={() => {}}
          onPaste={() => {}}
        />
        <WritingModeFooter
          submitControl={
            <WritingModeSubmitControl
              onSend={onSend}
              canSubmit
            />
          }
        />
      </WritingModeRoot>
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "updated" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByText("Custom composer")).toBeInTheDocument();
    expect(onContentChange).toHaveBeenCalledWith("updated");
    expect(onSend).toHaveBeenCalled();
  });
});
