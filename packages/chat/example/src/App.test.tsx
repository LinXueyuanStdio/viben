// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { App } from "./App";

vi.mock("@viben/chat", () => ({
  CommandQueuePanel: (props: { items?: unknown[] }) => (
    <div data-testid="command-queue-panel">{props.items?.length ?? 0}</div>
  ),
  ContextDetailsPopover: () => <div data-testid="context-details-popover" />,
  EmojiPicker: () => <div data-testid="emoji-picker" />,
  ExecApproval: () => <div data-testid="exec-approval" />,
  ChatInput: () => <div data-testid="chat-input" />,
  MessageList: () => <div data-testid="message-list" />,
  PlanApproval: () => <div data-testid="plan-approval" />,
  QuestionInput: () => <div data-testid="question-input" />,
  SkillsConfigPopover: () => <div data-testid="skills-config-popover" />,
  SubagentSheet: () => null,
  ToolExecutionItem: () => <div data-testid="tool-execution-item" />,
  ToolsConfigPopover: () => <div data-testid="tools-config-popover" />,
  getModelIcon: () => <span data-testid="model-icon" />,
  useCommandQueue: () => ({
    items: [],
    isPaused: false,
    send: vi.fn(),
    recall: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }),
  useCommandQueueInputRecall: () => ({
    onRecallQueuedInput: vi.fn(),
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-json-view-lite", () => ({
  JsonView: () => <div data-testid="json-view" />,
  darkStyles: {},
}));

describe("App overlay layout", () => {
  test("orders overlay modes as float, compact, expanded, fullscreen", () => {
    render(<App />);

    const buttons = ["Float", "Compact", "Expanded", "Fullscreen"].map((name) =>
      screen.getByRole("button", { name })
    );

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Float",
      "Compact",
      "Expanded",
      "Fullscreen",
    ]);
  });

  test("keeps control panel centered until fullscreen pushes it to the right", () => {
    render(<App />);

    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");
    expect(screen.getByTestId("control-panel")).toHaveClass("left-1/2");
    expect(screen.getByTestId("control-panel")).toHaveClass("-translate-x-1/2");

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("order-1");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("flex-1");
    expect(screen.getByTestId("control-panel")).toHaveClass("order-2");
    expect(screen.getByTestId("control-panel")).toHaveClass("border-l");
  });

  test("does not render the fullscreen session player content before fullscreen mode", () => {
    render(<App />);

    expect(screen.queryByText("@viben/chat Session Player")).not.toBeInTheDocument();
    expect(screen.queryByText("Press Play to replay the demo session, or load a .jsonl file.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  test("shows all bundled Claude Code session samples in the demo controls", () => {
    render(<App />);

    expect(screen.getByText("Claude Code: breadcrumb navigation debug")).toBeInTheDocument();
    expect(screen.getByText("Claude Code: 2e83fc8b session replay")).toBeInTheDocument();
    expect(screen.getByText("Claude Code: 3bbcc4d2 session replay")).toBeInTheDocument();
  });

  test("shows the overlay stage background only behind the expanded floating panel", () => {
    render(<App />);

    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("overlay-stage-background");

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");
  });
});
