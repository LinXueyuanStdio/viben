// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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
          "example.sidebar.title": "Example guide",
          "example.sidebar.subtitle": "Project overview",
          "example.sidebar.description": "A focused playground for the @viben/chat message list, input, session playback, and overlay modes.",
          "example.sidebar.layout_title": "Layout",
          "example.sidebar.layout_description": "Floating modes live over the demo area. Fullscreen mode docks the ChatApp between this guide and the control cards.",
          "example.sidebar.page.player": "Player",
          "example.sidebar.page.ui_showcase": "UI design showcase",
          "example.sidebar.collapse": "Collapse sidebar",
          "example.sidebar.expand": "Expand sidebar",
          "example.resize_chat_app": "Resize ChatApp width",
          "example.load.session_folder": "Session Folder",
          "example.sections.chatAppMode": "Chat App Mode",
          "example.sections.sessions": "Claude Code Sessions",
          "example.sections.components": "Components",
          "example.sections.modelIcons": "Model Icons",
          "example.sections.toolExecution": "ToolExecutionItem (4 states)",
          "example.sections.configPanels": "Config Panels",
          "example.ui_showcase.title": "UI design showcase",
          "example.ui_showcase.subtitle": "Display-only component states are grouped separately from the player.",
          "example.ui_showcase.group.interactions": "Interaction surfaces",
          "example.ui_showcase.group.feedback": "Feedback states",
          "example.ui_showcase.group.configuration": "Configuration panels",
          "example.components.plan_approval": "Plan approval",
          "example.components.question_input": "Question input",
          "example.components.emoji_picker": "Emoji picker",
          "example.components.exec_approval": "Exec approval",
          "example.components.command_queue": "Command queue",
          "example.components.dismiss": "Dismiss component demo",
        },
        "zh-CN": {
          "example.language.english": "English",
          "example.language.chinese": "中文",
          "example.title": "聊天组件实验室",
          "example.kicker": "控制面板",
          "example.subtitle": "在同一个控制面板中回放会话、检查组件状态并切换浮层模式。",
          "example.sidebar.title": "示例指南",
          "example.sidebar.subtitle": "项目概览",
          "example.sidebar.description": "@viben/chat 消息列表、输入框、会话回放和浮层模式的集中演示场。",
          "example.sidebar.layout_title": "布局",
          "example.sidebar.layout_description": "浮动模式叠在演示区域上方。全屏模式会把 ChatApp 停靠在本指南和控制卡片之间。",
          "example.sidebar.page.player": "播放器",
          "example.sidebar.page.ui_showcase": "UI 设计展示",
          "example.sidebar.collapse": "收起侧边栏",
          "example.sidebar.expand": "展开侧边栏",
          "example.resize_chat_app": "调整 ChatApp 宽度",
          "example.load.session_folder": "会话文件夹",
          "example.sections.chatAppMode": "聊天应用模式",
          "example.sections.sessions": "Claude Code 会话",
          "example.sections.components": "组件",
          "example.sections.modelIcons": "模型图标",
          "example.sections.toolExecution": "ToolExecutionItem（4 种状态）",
          "example.sections.configPanels": "配置面板",
          "example.ui_showcase.title": "UI 设计展示",
          "example.ui_showcase.subtitle": "陈列型组件状态与播放器分开管理。",
          "example.ui_showcase.group.interactions": "交互界面",
          "example.ui_showcase.group.feedback": "反馈状态",
          "example.ui_showcase.group.configuration": "配置面板",
          "example.components.plan_approval": "计划审批",
          "example.components.question_input": "问题输入",
          "example.components.emoji_picker": "表情选择器",
          "example.components.exec_approval": "执行审批",
          "example.components.command_queue": "命令队列",
          "example.components.dismiss": "关闭组件演示",
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

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1400,
  });
  window.localStorage.clear();
});

afterEach(() => {
  mockLanguage = "en";
  changeLanguageMock.mockClear();
  window.localStorage.clear();
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

  test("renders header, collapsible intro sidebar, right demo panel, and floating chat stage", () => {
    render(<App />);

    expect(screen.getByTestId("app-header")).toBeInTheDocument();
    expect(screen.getByTestId("chat-example-shell")).toHaveClass("bg-background");
    expect(screen.getByTestId("intro-sidebar")).toHaveStyle({ width: "280px" });
    expect(screen.getByTestId("right-demo-panel")).toBeInTheDocument();
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("absolute");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("inset-0");
    expect(screen.queryByTestId("fullscreen-chat-resize-handle")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    expect(screen.getByTestId("intro-sidebar")).toHaveStyle({ width: "280px" });
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("flex-none");
    expect(screen.getByTestId("chat-app-stage")).toHaveAttribute("data-transition-origin", "expanded-bottom-left");
    expect(screen.getByTestId("chat-app-stage")).toHaveStyle({ width: "720px" });
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("absolute");
    expect(screen.getByTestId("chat-app-stage")).not.toHaveClass("pointer-events-none");
    expect(screen.getByTestId("fullscreen-chat-resize-handle")).toHaveAttribute("aria-orientation", "vertical");
  });

  test("opens the fullscreen layout before morphing the expanded panel into fullscreen", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    const expandedOverlay = screen.getByTestId("expanded-overlay");
    expect(expandedOverlay).toBeInTheDocument();
    vi.spyOn(expandedOverlay, "getBoundingClientRect").mockReturnValue({
      x: 40,
      y: 360,
      left: 40,
      top: 360,
      right: 480,
      bottom: 840,
      width: 440,
      height: 480,
      toJSON: () => ({}),
    } as DOMRect);
    vi.spyOn(screen.getByTestId("chat-example-shell"), "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 56,
      left: 0,
      top: 56,
      right: 1400,
      bottom: 900,
      width: 1400,
      height: 844,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));

    expect(screen.getByTestId("chat-app-stage")).toHaveStyle({ width: "720px" });
    expect(screen.getByTestId("chat-app-stage")).toHaveAttribute("data-entry-geometry", "measured");
    expect(screen.getByTestId("right-demo-panel")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("full-overlay")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("full-overlay")).toBeInTheDocument();
    });
  });

  test("keeps floating, compact, and expanded chat overlays out of the dashboard layout", () => {
    render(<App />);

    expect(screen.getByTestId("chat-app-stage")).toHaveClass("absolute");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("right-demo-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("absolute");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("right-demo-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("absolute");
    expect(screen.getByTestId("chat-app-stage")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("right-demo-panel")).toBeInTheDocument();
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

  test("switches the left sidebar between player and UI design showcase pages", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Player" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Claude Code Sessions")).toBeInTheDocument();
    expect(screen.queryByText("Display-only component states are grouped separately from the player.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "UI design showcase" }));

    expect(screen.getByRole("button", { name: "UI design showcase" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "UI design showcase" })).toBeInTheDocument();
    expect(screen.getByText("Display-only component states are grouped separately from the player.")).toBeInTheDocument();
    expect(screen.getAllByText("Interaction surfaces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Feedback states").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Configuration panels").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plan approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Question input").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Emoji picker").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Exec approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Command queue").length).toBeGreaterThan(0);
    expect(screen.queryByText("Claude Code Sessions")).not.toBeInTheDocument();
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

  test("collapses the example intro sidebar", () => {
    render(<App />);

    expect(screen.getByTestId("intro-sidebar")).toHaveStyle({ width: "280px" });
    expect(screen.getByText("Example guide")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.getByTestId("intro-sidebar")).toHaveStyle({ width: "56px" });
    expect(screen.queryByText("Example guide")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });

  test("resizes the fullscreen ChatApp width from the right content boundary", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1400,
    });
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    const stage = screen.getByTestId("chat-app-stage");
    const handle = screen.getByTestId("fullscreen-chat-resize-handle");

    expect(stage).toHaveStyle({ width: "720px" });

    fireEvent.pointerDown(handle, { clientX: 720 });
    fireEvent.pointerMove(window, { clientX: 900 });
    expect(stage).toHaveStyle({ width: "620px" });

    fireEvent.pointerMove(window, { clientX: 100 });
    expect(stage).toHaveStyle({ width: "440px" });

    fireEvent.pointerMove(window, { clientX: 1300 });
    expect(stage).toHaveStyle({ width: "760px" });
    expect(window.localStorage.getItem("viben.chat.example.fullscreen_chat_width")).toBe("760");

    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 800 });
    expect(stage).toHaveStyle({ width: "760px" });
  });

  test("remembers the fullscreen ChatApp width before entering fullscreen again", () => {
    window.localStorage.setItem("viben.chat.example.fullscreen_chat_width", "640");

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveStyle({ width: "640px" });

    const handle = screen.getByTestId("fullscreen-chat-resize-handle");
    fireEvent.pointerDown(handle, { clientX: 920 });
    fireEvent.pointerMove(window, { clientX: 960 });
    expect(screen.getByTestId("chat-app-stage")).toHaveStyle({ width: "680px" });
    fireEvent.pointerUp(window);

    fireEvent.click(screen.getByRole("button", { name: "Expanded" }));
    expect(screen.getByTestId("expanded-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(screen.getByTestId("chat-app-stage")).toHaveStyle({ width: "680px" });
  });

  test("component demo surface can be dismissed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "UI design showcase" }));
    fireEvent.click(screen.getByRole("button", { name: /Plan approval/ }));

    expect(screen.getByTestId("component-demo-surface")).toBeInTheDocument();
    expect(screen.getByTestId("plan-approval")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss component demo" }));

    expect(screen.queryByTestId("component-demo-surface")).not.toBeInTheDocument();
  });

  test("exposes a language switcher for English and Chinese control panel copy", () => {
    render(<App />);

    const englishButton = screen.getByRole("button", { name: "English" });
    const chineseButton = screen.getByRole("button", { name: "中文" });

    expect(screen.getAllByText("Chat component lab").length).toBeGreaterThan(0);
    fireEvent.click(chineseButton);
    expect(changeLanguageMock).toHaveBeenCalledWith("zh-CN");
    expect(screen.getAllByText("聊天组件实验室").length).toBeGreaterThan(0);
    expect(screen.getByText("会话文件夹")).toBeInTheDocument();
    expect(screen.getByText("聊天应用模式")).toBeInTheDocument();

    fireEvent.click(englishButton);
    expect(changeLanguageMock).toHaveBeenCalledWith("en");
    expect(screen.getAllByText("Chat component lab").length).toBeGreaterThan(0);
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
