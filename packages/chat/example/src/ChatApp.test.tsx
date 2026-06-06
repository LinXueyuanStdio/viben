// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ChatApp, ChatAppFullscreenPanel, getAssistantPetState, getPetInteractionForSessionStatus } from "./ChatApp";
import type { AgentMessage } from "@viben/chat";

vi.mock("@viben/chat", async () => {
  const React = await import("react");
  return {
    ChatInput: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "overlay-chat-input-props" },
      React.createElement("span", { "data-testid": "show-top-toolbar" }, String(props.showTopToolbar)),
      React.createElement("span", { "data-testid": "layout-variant" }, String(props.layoutVariant)),
      React.createElement("span", { "data-testid": "show-config-bar" }, String(props.showConfigBar)),
      React.createElement("span", { "data-testid": "has-emoji-renderer" }, String(typeof props.renderEmojiPicker === "function")),
      React.createElement("span", { "data-testid": "hide-agent-selector" }, String(props.hideAgentSelector)),
      React.createElement("span", { "data-testid": "hide-model-selector" }, String(props.hideModelSelector)),
      React.createElement("span", { "data-testid": "slash-count" }, String((props.slashCommands as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "queued-count" }, String((props.queuedInputRecallItems as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "default-height" }, String(props.defaultHeight)),
      React.createElement("span", { "data-testid": "min-height" }, String(props.minHeight)),
      React.createElement("span", { "data-testid": "max-height" }, String(props.maxHeight)),
      React.createElement("button", { type: "button", onClick: () => (props.onSend as (content: string) => void)("mock send") }, "Mock send")
    ),
    CommandQueuePanel: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "command-queue-panel" },
      String((props.items as unknown[] | undefined)?.length ?? 0)
    ),
    ExecApproval: () => React.createElement("div", { "data-testid": "exec-approval" }, "ExecApproval"),
    EmojiPicker: () => React.createElement("div", { "data-testid": "emoji-picker" }, "EmojiPicker"),
    MessageList: React.forwardRef((props: Record<string, unknown>, _ref) => React.createElement(
      "div",
      { "data-testid": "message-list" },
      String((props.messages as unknown[] | undefined)?.length ?? 0)
    )),
    PlanApproval: () => React.createElement("div", { "data-testid": "plan-approval" }, "PlanApproval"),
    QuestionInput: () => React.createElement("div", { "data-testid": "question-input" }, "QuestionInput"),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const messages: AgentMessage[] = [
  { id: "u1", type: "user", content: "Build the overlay" },
  { id: "a1", type: "text", content: "I am preparing the popup." },
];

describe("ChatApp", () => {
  test("floating mode renders only the assistant avatar button", () => {
    render(
      <ChatApp
        contained
        mode="floating"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Open compact chat" })).toBeInTheDocument();
    expect(screen.getByTestId("floating-overlay")).toHaveClass("left-6");
    expect(screen.getByTestId("floating-overlay")).toHaveClass("bottom-6");
    expect(screen.queryByTestId("agent-popup")).not.toBeInTheDocument();
    expect(screen.queryByTestId("compact-chat-input")).not.toBeInTheDocument();
  });

  test("compact mode renders agent popup above the one-line chat input", () => {
    render(
      <ChatApp
        contained
        mode="compact"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    const surface = screen.getByTestId("compact-overlay");
    expect(surface).toHaveClass("left-5");
    expect(surface).toHaveClass("bottom-5");
    expect(surface.children[0]).toHaveAttribute("data-testid", "agent-popup");
    expect(surface.children[1]).toHaveAttribute("data-testid", "compact-chat-input");
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Model")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
  });

  test("full mode fills the overlay container with the expanded chat surface", () => {
    render(
      <ChatApp
        mode="full"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("full-overlay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Session menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to compact mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to full mode" })).toBeInTheDocument();
    expect(screen.getByText("I am preparing the popup.")).toBeInTheDocument();
    expect(screen.getByTestId("compact-chat-input")).toBeInTheDocument();
  });

  test("allows custom pet avatars per assistant state", () => {
    render(
      <ChatApp
        mode="floating"
        messages={messages}
        isStreaming
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        assistantAvatars={{
          review: <span data-testid="custom-review-pet">Review pet</span>,
        }}
      />
    );

    expect(screen.getByTestId("custom-review-pet")).toBeInTheDocument();
  });

  test("floating avatar expands to compact mode when clicked", () => {
    const onModeChange = vi.fn();
    render(
      <ChatApp
        mode="floating"
        messages={messages}
        isStreaming={false}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open compact chat" }));

    expect(onModeChange).toHaveBeenCalledWith("compact");
  });

  test("compact capsule expands to expanded mode when clicked", () => {
    const onModeChange = vi.fn();
    render(
      <ChatApp
        mode="compact"
        messages={messages}
        isStreaming={false}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByTestId("agent-popup"));

    expect(onModeChange).toHaveBeenCalledWith("expanded");
  });

  test("expanded mode renders header, message list, and chat input", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-overlay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Session menu" })).toBeInTheDocument();
    expect(screen.getByTestId("new-session-split-button")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create new session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open new session menu" })).toBeInTheDocument();
    expect(screen.getByTestId("expanded-header-drag-area")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to compact mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to full mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(screen.getByText("I am preparing the popup.")).toBeInTheDocument();
    expect(screen.getByTestId("compact-chat-input")).toBeInTheDocument();
  });

  test("expanded mode keeps the same floating width as compact mode", () => {
    render(
      <ChatApp
        contained
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-overlay")).toHaveClass("w-[min(440px,calc(100vw-2rem))]");
    expect(screen.getByTestId("expanded-overlay")).toHaveClass("bottom-5");
    expect(screen.getByTestId("expanded-overlay")).toHaveClass("left-5");
  });

  test("expanded header compact and full buttons switch overlay modes", () => {
    const onModeChange = vi.fn();
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to compact mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to full mode" }));

    expect(onModeChange).toHaveBeenCalledWith("compact");
    expect(onModeChange).toHaveBeenCalledWith("full");
  });

  test("expanded session title menu shows search and session samples", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));

    expect(screen.getByRole("searchbox", { name: "Search sessions" })).toBeInTheDocument();
    expect(screen.getByText("Claude Code: breadcrumb navigation debug")).toBeInTheDocument();
    expect(screen.getByText("2c88f85a...jsonl")).toBeInTheDocument();
    expect(screen.getByText("Claude Code: 2e83fc8b session replay")).toBeInTheDocument();
    expect(screen.getByText("2e83fc8b...jsonl")).toBeInTheDocument();
    expect(screen.getByText("Claude Code: 3bbcc4d2 session replay")).toBeInTheDocument();
    expect(screen.getByText("3bbcc4d2...jsonl")).toBeInTheDocument();
  });

  test("expanded session menu calls selection callback and closes", () => {
    const onSelectSession = vi.fn();
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        sessions={[{ id: "session-1", title: "Session one", subtitle: "session-1.jsonl" }]}
        headerActions={{ onSelectSession }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));
    fireEvent.click(screen.getByText("Session one"));

    expect(onSelectSession).toHaveBeenCalledWith({ id: "session-1", title: "Session one", subtitle: "session-1.jsonl" });
    expect(screen.queryByText("session-1.jsonl")).not.toBeInTheDocument();
  });

  test("expanded session menu shows the selected session title after selection", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        sessions={[
          { id: "session-1", title: "Session one", subtitle: "session-1.jsonl" },
          { id: "session-2", title: "Session two", subtitle: "session-2.jsonl" },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));
    fireEvent.click(screen.getByText("Session two"));

    expect(screen.getByRole("button", { name: "Session menu" })).toHaveTextContent("Session two");
  });

  test("expanded new-session menu shows creation actions and agent samples", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Open new session menu" }));

    expect(screen.getByText("新建聊天")).toBeInTheDocument();
    expect(screen.getByText("新建聊天窗口")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("OpenAI · Browser")).toBeInTheDocument();
  });

  test("expanded more menu shows sample navigation and debug actions", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.getByText("上一步")).toBeInTheDocument();
    expect(screen.getByText("下一步")).toBeInTheDocument();
    expect(screen.getByText("将聊天移动到新窗口")).toBeInTheDocument();
    expect(screen.getByText("显示调试视图")).toBeInTheDocument();
    expect(screen.getByText("显示调试日志")).toBeInTheDocument();
  });

  test("expanded header buttons use configurable callbacks", () => {
    const onCreateSession = vi.fn();
    const onSettingsClick = vi.fn();
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        headerActions={{ onCreateSession, onSettingsClick }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new session" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  test("expanded header keeps compact and fullscreen buttons after the drag area", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    const header = screen.getByTestId("expanded-header");
    expect(Array.from(header.children).map((child) => child.getAttribute("data-testid"))).toEqual([
      "session-title-menu",
      "new-session-split-button",
      "expanded-header-drag-area",
      "compact-mode-button",
      "full-mode-button",
      "settings-button",
      "more-actions-menu",
    ]);
  });

  test("compact and expanded inputs reuse chat input capabilities without config selectors", () => {
    const overlayInputProps = {
      slashCommands: [{ name: "plan", description: "Plan", input: null }],
      queuedInputRecallItems: [{ content: "queued work" }],
      onQueuedInputRecall: vi.fn(),
      onOpenFile: vi.fn(),
      onPaste: vi.fn(),
    };

    const { rerender } = render(
      <ChatApp
        mode="compact"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        inputProps={overlayInputProps}
      />
    );

    expect(screen.getByTestId("show-top-toolbar")).toHaveTextContent("false");
    expect(screen.getByTestId("layout-variant")).toHaveTextContent("compact");
    expect(screen.getByTestId("show-config-bar")).toHaveTextContent("true");
    expect(screen.getByTestId("has-emoji-renderer")).toHaveTextContent("true");
    expect(screen.getByTestId("hide-agent-selector")).toHaveTextContent("true");
    expect(screen.getByTestId("hide-model-selector")).toHaveTextContent("true");
    expect(screen.getByTestId("slash-count")).toHaveTextContent("1");
    expect(screen.getByTestId("queued-count")).toHaveTextContent("1");
    expect(screen.getByTestId("default-height")).toHaveTextContent("48");
    expect(screen.getByTestId("min-height")).toHaveTextContent("48");
    expect(screen.getByTestId("max-height")).toHaveTextContent("48");

    rerender(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        inputProps={overlayInputProps}
      />
    );

    expect(screen.getByTestId("show-top-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("layout-variant")).toHaveTextContent("expanded");
    expect(screen.getByTestId("show-config-bar")).toHaveTextContent("true");
    expect(screen.getByTestId("default-height")).toHaveTextContent("undefined");
    expect(screen.getByTestId("min-height")).toHaveTextContent("undefined");
    expect(screen.getByTestId("max-height")).toHaveTextContent("undefined");
  });

  test("full mode can render a reusable fullscreen panel under the shared expanded header", () => {
    render(
      <ChatApp
        mode="full"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        fullscreenContent={<div data-testid="custom-fullscreen-panel">Fullscreen body</div>}
      />
    );

    expect(screen.getByRole("button", { name: "Session menu" })).toBeInTheDocument();
    expect(screen.getByTestId("custom-fullscreen-panel")).toBeInTheDocument();
  });
});

describe("ChatAppFullscreenPanel", () => {
  test("renders the reusable message list and full chat input composition", () => {
    render(
      <ChatAppFullscreenPanel
        messages={messages}
        isStreaming={false}
        inputProps={{
          value: "hello",
          onValueChange: () => {},
          onSend: () => {},
          onCancel: () => {},
        }}
      />
    );

    expect(screen.getByTestId("message-list")).toHaveTextContent("2");
    expect(screen.getByTestId("layout-variant")).toHaveTextContent("expanded");
    expect(screen.getByTestId("show-top-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("show-config-bar")).toHaveTextContent("true");
  });
});

describe("getAssistantPetState", () => {
  test("maps playback and messages to pet animation states", () => {
    expect(getAssistantPetState([], false, "idle")).toBe("idle");
    expect(getAssistantPetState(messages, true, "playing")).toBe("review");
    expect(getAssistantPetState(messages, false, "playing")).toBe("waiting");
    expect(getAssistantPetState(messages, false, "paused")).toBe("waving");
    expect(getAssistantPetState(messages, false, "idle")).toBe("idle");
  });
});

describe("getPetInteractionForSessionStatus", () => {
  test("maps session playback status to @viben/pet interaction states", () => {
    expect(getPetInteractionForSessionStatus("idle", false, false)).toBe("idle");
    expect(getPetInteractionForSessionStatus("playing", false, false)).toBe("waiting");
    expect(getPetInteractionForSessionStatus("playing", true, false)).toBe("waiting");
    expect(getPetInteractionForSessionStatus("paused", false, false)).toBe("hover");
    expect(getPetInteractionForSessionStatus("idle", false, true)).toBe("waiting");
  });
});
