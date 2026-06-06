// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { OverlayDemo, getAssistantPetState } from "./overlay-demo";
import type { AgentMessage } from "@viben/chat";

vi.mock("@viben/chat", async () => {
  const React = await import("react");
  return {
    ChatInput: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "overlay-chat-input-props" },
      React.createElement("span", { "data-testid": "show-top-toolbar" }, String(props.showTopToolbar)),
      React.createElement("span", { "data-testid": "toolbar-position" }, String(props.toolbarPosition)),
      React.createElement("span", { "data-testid": "show-config-bar" }, String(props.showConfigBar)),
      React.createElement("span", { "data-testid": "hide-agent-selector" }, String(props.hideAgentSelector)),
      React.createElement("span", { "data-testid": "hide-model-selector" }, String(props.hideModelSelector)),
      React.createElement("span", { "data-testid": "slash-count" }, String((props.slashCommands as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "queued-count" }, String((props.queuedInputRecallItems as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "default-height" }, String(props.defaultHeight)),
      React.createElement("span", { "data-testid": "min-height" }, String(props.minHeight)),
      React.createElement("span", { "data-testid": "max-height" }, String(props.maxHeight)),
      React.createElement("button", { type: "button", onClick: () => (props.onSend as (content: string) => void)("mock send") }, "Mock send")
    ),
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

describe("OverlayDemo", () => {
  test("floating mode renders only the assistant avatar button", () => {
    render(
      <OverlayDemo
        mode="floating"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Open compact chat" })).toBeInTheDocument();
    expect(screen.queryByTestId("agent-popup")).not.toBeInTheDocument();
    expect(screen.queryByTestId("compact-chat-input")).not.toBeInTheDocument();
  });

  test("compact mode renders agent popup above the one-line chat input", () => {
    render(
      <OverlayDemo
        mode="compact"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    const surface = screen.getByTestId("compact-overlay");
    expect(surface.children[0]).toHaveAttribute("data-testid", "agent-popup");
    expect(surface.children[1]).toHaveAttribute("data-testid", "compact-chat-input");
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Model")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
  });

  test("full mode renders the provided full-screen demo", () => {
    render(
      <OverlayDemo
        mode="full"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        renderFullScreen={() => <div data-testid="full-screen-demo">Full screen</div>}
      />
    );

    expect(screen.getByTestId("full-screen-demo")).toBeInTheDocument();
  });

  test("allows custom pet avatars per assistant state", () => {
    render(
      <OverlayDemo
        mode="floating"
        messages={messages}
        isStreaming
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        assistantAvatars={{
          thinking: <span data-testid="custom-thinking-pet">Thinking pet</span>,
        }}
      />
    );

    expect(screen.getByTestId("custom-thinking-pet")).toBeInTheDocument();
  });

  test("floating avatar expands to compact mode when clicked", () => {
    const onModeChange = vi.fn();
    render(
      <OverlayDemo
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
      <OverlayDemo
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
      <OverlayDemo
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
    expect(screen.getByRole("button", { name: "Create new session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New session menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(screen.getByText("I am preparing the popup.")).toBeInTheDocument();
    expect(screen.getByTestId("compact-chat-input")).toBeInTheDocument();
  });

  test("expanded session title menu shows search and session samples", () => {
    render(
      <OverlayDemo
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
  });

  test("expanded new-session menu shows creation actions and agent samples", () => {
    render(
      <OverlayDemo
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "New session menu" }));

    expect(screen.getByText("新建聊天")).toBeInTheDocument();
    expect(screen.getByText("新建聊天窗口")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("OpenAI · Browser")).toBeInTheDocument();
  });

  test("expanded more menu shows sample navigation and debug actions", () => {
    render(
      <OverlayDemo
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
      <OverlayDemo
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

  test("compact and expanded inputs reuse chat input capabilities without config selectors", () => {
    const overlayInputProps = {
      slashCommands: [{ name: "plan", description: "Plan" }],
      queuedInputRecallItems: [{ content: "queued work" }],
      onQueuedInputRecall: vi.fn(),
      onOpenFile: vi.fn(),
      onPaste: vi.fn(),
    };

    const { rerender } = render(
      <OverlayDemo
        mode="compact"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        inputProps={overlayInputProps}
      />
    );

    expect(screen.getByTestId("show-top-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("toolbar-position")).toHaveTextContent("bottom");
    expect(screen.getByTestId("show-config-bar")).toHaveTextContent("false");
    expect(screen.getByTestId("hide-agent-selector")).toHaveTextContent("true");
    expect(screen.getByTestId("hide-model-selector")).toHaveTextContent("true");
    expect(screen.getByTestId("slash-count")).toHaveTextContent("1");
    expect(screen.getByTestId("queued-count")).toHaveTextContent("1");
    expect(screen.getByTestId("default-height")).toHaveTextContent("48");
    expect(screen.getByTestId("min-height")).toHaveTextContent("48");
    expect(screen.getByTestId("max-height")).toHaveTextContent("48");

    rerender(
      <OverlayDemo
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
    expect(screen.getByTestId("toolbar-position")).toHaveTextContent("bottom");
    expect(screen.getByTestId("show-config-bar")).toHaveTextContent("false");
    expect(screen.getByTestId("default-height")).toHaveTextContent("48");
    expect(screen.getByTestId("max-height")).toHaveTextContent("48");
  });
});

describe("getAssistantPetState", () => {
  test("maps playback and messages to idle, thinking, speaking, and done states", () => {
    expect(getAssistantPetState([], false, "idle")).toBe("idle");
    expect(getAssistantPetState(messages, true, "playing")).toBe("thinking");
    expect(getAssistantPetState(messages, false, "paused")).toBe("speaking");
    expect(getAssistantPetState(messages, false, "idle")).toBe("done");
  });
});
