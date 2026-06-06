// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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
  test("compact layout renders the editor inline inside the bottom toolbar", async () => {
    const { ChatInput } = await import("../index");

    const { container } = render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        layoutVariant="compact"
        showTopToolbar={false}
        showConfigBar
        agents={[{ id: "agent", name: "Agent" }]}
        selectedAgentId="agent"
        models={[{ id: "model", name: "Model" }]}
        selectedModelId="model"
      />
    );

    const compactToolbar = screen.getByTestId("chat-input-compact-toolbar");
    const editor = container.querySelector(".viben-chat-input-editor");
    const configControls = screen.getByTestId("chat-input-config-controls");
    const submitControl = screen.getByTestId("chat-input-submit-control");

    expect(compactToolbar).toContainElement(configControls);
    expect(compactToolbar).toContainElement(editor as HTMLElement);
    expect(compactToolbar).toContainElement(submitControl);
    expect(screen.queryByTestId("chat-input-toolbar")).not.toBeInTheDocument();
  });

  test("expanded layout renders top toolbar, editor, and bottom toolbar as three rows", async () => {
    const { ChatInput } = await import("../index");

    const { container } = render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        layoutVariant="expanded"
        showTopToolbar
        showConfigBar
      />
    );

    const topToolbar = screen.getByTestId("chat-input-toolbar");
    const editor = container.querySelector(".viben-chat-input-editor");
    const bottomControls = screen.getByTestId("chat-input-config-controls");

    expect(topToolbar.compareDocumentPosition(editor as HTMLElement)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(editor?.compareDocumentPosition(bottomControls) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  test("custom toolbar renderers can replace default toolbar content", async () => {
    const { ChatInput } = await import("../index");

    render(
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        showTopToolbar
        showConfigBar
        renderTopToolbar={() => <div data-testid="custom-top">Top actions</div>}
        renderBottomToolbar={({ leftContent, submitControl }) => (
          <>
            <div data-testid="custom-bottom-left">{leftContent}</div>
            <div data-testid="custom-bottom-right">{submitControl}</div>
          </>
        )}
      />
    );

    expect(screen.getByTestId("custom-top")).toBeInTheDocument();
    expect(screen.getByTestId("custom-bottom-left")).toContainElement(screen.getByTestId("chat-input-config-controls"));
    expect(screen.getByTestId("custom-bottom-right")).toContainElement(screen.getByTestId("chat-input-submit-control"));
  });
});
