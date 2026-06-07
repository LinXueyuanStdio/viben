// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";

let mockLanguage = "en";
const changeLanguageMock = vi.fn((language: string) => {
  mockLanguage = language;
});

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
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      const translations: Record<string, Record<string, string>> = {
        en: {
          "example.language.english": "English",
          "example.language.chinese": "中文",
          "example.title": "Chat component lab",
          "example.kicker": "Control surface",
          "example.subtitle": "Replay sessions, inspect component states, and switch overlay modes from one control surface.",
          "example.load.session_folder": "Session Folder",
          "example.sections.overlayMode": "Overlay Mode",
        },
        "zh-CN": {
          "example.language.english": "English",
          "example.language.chinese": "中文",
          "example.title": "聊天组件实验室",
          "example.kicker": "控制面板",
          "example.subtitle": "在同一个控制面板中回放会话、检查组件状态并切换浮层模式。",
          "example.load.session_folder": "会话文件夹",
          "example.sections.overlayMode": "浮层模式",
        },
      };
      const value = translations[mockLanguage]?.[key] ?? fallback ?? key;
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? `{{${name}}}`));
    },
    i18n: {
      get language() {
        return mockLanguage;
      },
      changeLanguage: changeLanguageMock,
    },
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("react-json-view-lite", () => ({
  JsonView: () => <div data-testid="json-view" />,
  darkStyles: {},
}));

afterEach(() => {
  mockLanguage = "en";
  changeLanguageMock.mockClear();
  cleanup();
});

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

  test("renders the controls as a full-screen dashboard surface until fullscreen uses a right rail", () => {
    render(<App />);

    expect(screen.getByTestId("chat-example-shell")).toHaveClass("bg-background");
    expect(screen.getByTestId("control-panel")).toHaveClass("flex-1");
    expect(screen.getByTestId("control-panel")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("control-panel")).not.toHaveClass("absolute");
    expect(screen.getByTestId("control-panel")).not.toHaveClass("left-1/2");
    expect(screen.getByTestId("control-panel")).not.toHaveClass("-translate-x-1/2");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("fixed");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("inset-0");

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("order-1");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("w-[calc(100dvw_-_280px)]");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("flex-none");
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("fixed");
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("pointer-events-none");
    expect(screen.getByTestId("control-panel")).toHaveClass("order-2");
    expect(screen.getByTestId("control-panel")).toHaveClass("w-[280px]");
    expect(screen.getByTestId("control-panel")).toHaveClass("border-l");
  });

  test("opens the fullscreen layout before morphing the expanded panel into fullscreen", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    expect(screen.getByTestId("expanded-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    expect(screen.getByTestId("chat-app-stage")).toHaveClass("w-[calc(100dvw_-_280px)]");
    expect(screen.getByTestId("control-panel")).toHaveClass("order-2");
    expect(screen.getByTestId("expanded-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("full-overlay")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("full-overlay")).toBeInTheDocument();
    });
  });

  test("keeps floating, compact, and expanded chat overlays out of the dashboard layout", () => {
    render(<App />);

    expect(screen.getByTestId("chat-app-stage")).toHaveClass("fixed");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("control-panel")).toHaveClass("flex-1");

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("fixed");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("control-panel")).toHaveClass("flex-1");

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("fixed");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("control-panel")).toHaveClass("flex-1");
  });

  test("does not render the fullscreen session player content before fullscreen mode", async () => {
    render(<App />);

    expect(screen.queryByText("@viben/chat Session Player")).not.toBeInTheDocument();
    expect(screen.queryByText("Press Play to replay the demo session, or load a .jsonl file.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat-input")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    await waitFor(() => {
      expect(screen.getByTestId("message-list")).toBeInTheDocument();
    });
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  test("shows all bundled Claude Code session samples in the demo controls", () => {
    render(<App />);

    expect(screen.getByText("Claude Code: breadcrumb navigation debug")).toBeInTheDocument();
    expect(screen.getByText("Claude Code: 2e83fc8b session replay")).toBeInTheDocument();
    expect(screen.getByText("Claude Code: 3bbcc4d2 session replay")).toBeInTheDocument();
  });

  test("removes the old overlay stage background from every chat mode", () => {
    render(<App />);

    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("overlay-stage-background");
  });

  test("exposes a language switcher for English and Chinese control panel copy", () => {
    render(<App />);

    const englishButton = screen.getByRole("button", { name: "English" });
    const chineseButton = screen.getByRole("button", { name: "中文" });

    expect(screen.getByText("Chat component lab")).toBeInTheDocument();
    fireEvent.click(chineseButton);
    expect(changeLanguageMock).toHaveBeenCalledWith("zh-CN");
    expect(screen.getByText("聊天组件实验室")).toBeInTheDocument();
    expect(screen.getByText("会话文件夹")).toBeInTheDocument();
    expect(screen.getByText("浮层模式")).toBeInTheDocument();

    fireEvent.click(englishButton);
    expect(changeLanguageMock).toHaveBeenCalledWith("en");
    expect(screen.getByText("Chat component lab")).toBeInTheDocument();
    expect(screen.getByText("Session Folder")).toBeInTheDocument();
    expect(chineseButton).toBeInTheDocument();
  });

  test("selected demo session title is reflected in expanded and fullscreen headers", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Claude Code: 2e83fc8b session replay/ }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Session menu" })).toHaveTextContent("Claude Code: 2e83fc8b session replay");
    });

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Session menu" })).toHaveTextContent("Claude Code: 2e83fc8b session replay");
    });
  });

  test("sidebar session selection updates expanded and fullscreen header titles", async () => {
    render(<App />);

    fireEvent.click(screen.getAllByRole("button", { name: /Claude Code: 3bbcc4d2 session replay/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Session menu" })).toHaveTextContent("Claude Code: 3bbcc4d2 session replay");
    });

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Session menu" })).toHaveTextContent("Claude Code: 3bbcc4d2 session replay");
    });
  });
});
