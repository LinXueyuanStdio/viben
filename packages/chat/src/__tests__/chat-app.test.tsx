// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ChatApp,
  ChatAppFullscreenCommandQueue,
  ChatAppFullscreenInputPanel,
  ChatAppFullscreenMessagePanel,
  ChatAppFullscreenPanel,
  ExpandedHeader,
  ExpandedHeaderModeControls,
} from "../chat-app";
import type { AgentMessage } from "../types";

const {
  mockBuildBackgroundTasksFromMessages,
  mockBuildTodoListItemsFromMessages,
} = vi.hoisted(() => ({
  mockBuildBackgroundTasksFromMessages: vi.fn((messages: unknown[] = []) => (
    messages.length > 0
      ? [{
          id: "bg-agent-1",
          kind: "agent",
          description: "Background agent",
          status: "running",
          messages: [{ id: "bg-sub-1", type: "text", content: "background detail" }],
          sourceMessage: {
            id: "agent-tool",
            type: "tool_use",
            name: "Agent",
            toolUseId: "tool-bg-1",
            subagentId: "sub-bg-1",
          },
        }]
      : []
  )),
  mockBuildTodoListItemsFromMessages: vi.fn((messages: unknown[] = []) => (
    messages.length > 0
      ? [{ id: "derived-todo", content: "Derived todo", status: "pending" }]
      : []
  )),
}));

vi.mock("../chat-input", async () => {
  const React = await import("react");
  return {
    useAttachments: () => ({
      attachments: [],
      addAttachment: vi.fn(),
      clearAttachments: vi.fn(),
      isAnyLoading: false,
    }),
    ChatInput: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "overlay-chat-input-props" },
      React.createElement("span", { "data-testid": "show-top-toolbar" }, String(props.showTopToolbar)),
      React.createElement("span", { "data-testid": "show-bottom-toolbar" }, String(props.showBottomToolbar)),
      React.createElement("span", { "data-testid": "layout-variant" }, String(props.layoutVariant)),
      React.createElement("span", { "data-testid": "has-top-toolbar" }, String(props.topToolbar != null)),
      React.createElement("span", { "data-testid": "has-bottom-toolbar" }, String(props.bottomToolbar != null)),
      React.createElement("span", { "data-testid": "slash-count" }, String((props.slashCommands as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "queued-count" }, String((props.queuedInputRecallItems as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "default-height" }, String(props.defaultHeight)),
      React.createElement("span", { "data-testid": "min-height" }, String(props.minHeight)),
      React.createElement("span", { "data-testid": "max-height" }, String(props.maxHeight)),
      React.createElement("span", { "data-testid": "input-class-name" }, String(props.className)),
      props.topToolbar
        ? React.createElement("div", { "data-testid": "chat-input-top-toolbar" })
        : null,
      props.bottomToolbar
        ? React.createElement("div", { "data-testid": "chat-input-bottom-toolbar" })
        : null,
      React.createElement("input", {
        "aria-label": "Mock chat value",
        value: String(props.value ?? ""),
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => (props.onValueChange as (value: string) => void)?.(event.target.value),
      }),
      React.createElement("button", { type: "button", onClick: () => (props.onSend as (content: string) => void)("mock send") }, "Mock send")
    ),
    ChatInputTopToolbar: () => React.createElement("div", { "data-testid": "chat-input-toolbar" }),
    ChatInputBottomToolbar: () => React.createElement("div", { "data-testid": "chat-input-config-controls" }),
  };
});

vi.mock("../command-queue", async () => {
  const React = await import("react");
  return {
    CommandQueuePanel: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "command-queue-panel" },
      String((props.items as unknown[] | undefined)?.length ?? 0)
    ),
  };
});

vi.mock("../background-task-list", async () => {
  const React = await import("react");
  return {
    buildBackgroundTasksFromMessages: mockBuildBackgroundTasksFromMessages,
    BackgroundTaskList: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "background-task-list" },
      React.createElement("span", null, String((props.tasks as unknown[] | undefined)?.length ?? 0)),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => (props.onTaskClick as ((task: unknown) => void) | undefined)?.((props.tasks as unknown[] | undefined)?.[0]),
        },
        "Open background task"
      )
    ),
  };
});

vi.mock("../exec-approval", async () => {
  const React = await import("react");
  return {
    ExecApproval: () => React.createElement("div", { "data-testid": "exec-approval" }, "ExecApproval"),
  };
});


vi.mock("../message-list", async () => {
  const React = await import("react");
  return {
    MessageList: React.forwardRef((props: Record<string, unknown>, _ref) => React.createElement(
      "div",
      { "data-testid": "message-list" },
      React.createElement("span", { "data-testid": "message-list-count" }, String((props.messages as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "message-list-streaming" }, String(props.isStreaming)),
      React.createElement("span", { "data-testid": "message-list-streaming-text" }, String(props.streamingText ?? "")),
      React.createElement("span", { "data-testid": "message-list-updates" }, String(Object.keys((props.messageUpdates as Record<string, unknown> | undefined) ?? {}).length)),
      React.createElement("span", { "data-testid": "message-list-width" }, String(props.maxMessageWidth)),
      React.createElement("span", { "data-testid": "message-list-has-expand-subagent" }, String(typeof props.onExpandSubagent === "function")),
      React.createElement("span", { "data-testid": "message-list-has-inspect-tool" }, String(typeof props.onInspectTool === "function")),
      React.createElement("span", { "data-testid": "message-list-artifacts" }, String((props.artifacts as unknown[] | undefined)?.length ?? 0)),
      React.createElement("span", { "data-testid": "message-list-assistant-avatar" }, props.assistantAvatar as React.ReactNode),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () => (props.onExpandSubagent as ((title: string, type: string, messages: unknown[], context: unknown) => void) | undefined)?.(
            "Demo subagent",
            "explorer",
            [{ id: "sub-1", type: "text", content: "subagent detail" }],
            { toolUseId: "tool-1" }
          ),
        },
        "Open subagent"
      )
    )),
  };
});

vi.mock("../plan-approval", async () => {
  const React = await import("react");
  return {
    PlanApproval: () => React.createElement("div", { "data-testid": "plan-approval" }, "PlanApproval"),
  };
});

vi.mock("../question-input", async () => {
  const React = await import("react");
  return {
    QuestionInput: () => React.createElement("div", { "data-testid": "question-input" }, "QuestionInput"),
  };
});

vi.mock("../subagent-sheet", async () => {
  const React = await import("react");
  return {
    SubagentSheet: (props: Record<string, unknown>) => props.open
      ? React.createElement(
        "div",
        {
          "data-testid": "subagent-sheet",
          "data-contained": String(props.contained),
          className: String(props.className ?? ""),
        },
        String(props.title)
      )
      : null,
  };
});

vi.mock("../todo-list", async () => {
  const React = await import("react");
  return {
    buildTodoListItemsFromMessages: mockBuildTodoListItemsFromMessages,
    TodoListPanel: (props: Record<string, unknown>) => React.createElement(
      "div",
      { "data-testid": "todo-list-panel" },
      String((props.items as unknown[] | undefined)?.length ?? 0)
    ),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; count?: number }, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "chat_app.header.new_chat": "New chat",
        "chat_app.header.new_chat_window": "New chat window",
        "chat_app.header.previous_step": "Previous step",
        "chat_app.header.next_step": "Next step",
        "chat_app.header.move_to_window": "Move chat to new window",
        "chat_app.header.show_debug_view": "Show debug view",
        "chat_app.header.show_debug_log": "Show debug log",
        "chat_app.header.settings": "Settings",
        "chat_app.pet.name": "Viben Sprite",
        "chat_app.pet.state.idle": "Idle",
        "chat_app.pet.state.review": "Review",
        "chat_app.greetings.0": "Ready when you are.",
        "chat_app.greetings.49": "Let’s make progress.",
      };
      const values = (typeof fallback === "object" ? fallback : options) as Record<string, unknown> | undefined;
      const value = translations[key] ?? (typeof fallback === "object" ? fallback.defaultValue : fallback) ?? key;
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? `{{${name}}}`));
    },
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children, mode, caret }: { children: React.ReactNode; mode?: string; caret?: string }) => (
    <span data-testid={`streamdown-${mode ?? "default"}`} data-caret={caret}>{children}</span>
  ),
}));

const messages: AgentMessage[] = [
  { id: "u1", type: "user", content: "Build the overlay" },
  { id: "a1", type: "text", content: "I am preparing the popup." },
];

const emptyMessages: AgentMessage[] = [];
const pendingPlan = {
  goal: "Review proposed changes",
  steps: [{ id: "step-1", description: "Inspect the diff", status: "pending" as const }],
};
const pendingApproval = {
  id: "approval-1",
  tool_call: { kind: "execute" as const, command: "pnpm test" },
  options: [{ id: "allow_once", label: "Allow" }],
};
const pendingQuestion = {
  id: "question-1",
  questions: [
    {
      header: "Direction",
      question: "Which path should the demo take?",
      options: [{ label: "Compact" }],
      multiSelect: false,
    },
  ],
};
function createHeaderContent({
  mode = "expanded",
  onModeChange = () => {},
}: {
  mode?: "floating" | "compact" | "expanded" | "full";
  onModeChange?: (mode: "floating" | "compact" | "expanded" | "full") => void;
} = {}) {
  return (
    <ExpandedHeader
      leftContent={(
        <>
          <span data-testid="expanded-header-session-slot">Session slot</span>
          <span data-testid="expanded-header-action-slot">Action slot</span>
        </>
      )}
      centerContent={<div data-testid="expanded-header-drag-area" />}
      rightContent={(
        <ExpandedHeaderModeControls
          mode={mode}
          onModeChange={onModeChange}
          moreMenuContent={<button type="button">Settings</button>}
        />
      )}
    />
  );
}

beforeEach(() => {
  mockBuildBackgroundTasksFromMessages.mockClear();
  mockBuildTodoListItemsFromMessages.mockClear();
});

describe("ChatApp", () => {
  test("floating mode renders only the assistant avatar button", () => {
    render(
      <ChatApp
        contained
        mode="floating"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Open compact chat" })).toBeInTheDocument();
    expect(screen.getByTestId("floating-overlay")).toHaveClass("left-6");
    expect(screen.getByTestId("floating-overlay")).toHaveClass("bottom-6");
    expect(screen.queryByTestId("agent-popup")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overlay-chat-input-props")).not.toBeInTheDocument();
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
    expect(surface.children[1]).toHaveAttribute("data-testid", "overlay-chat-input-props");
    expect(screen.getByTestId("agent-popup-title")).toHaveTextContent("Viben session");
    expect(screen.queryByText("Viben Sprite")).not.toBeInTheDocument();
    expect(screen.queryByText("Idle")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Minimize chat" })).not.toBeInTheDocument();
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Model")).not.toBeInTheDocument();
    expect(screen.queryByText("Skills")).not.toBeInTheDocument();
  });

  test("compact input renders pending interaction panels instead of the chat editor", () => {
    const { rerender } = render(
      <ChatApp
        contained
        mode="compact"
        messages={messages}
        isStreaming={false}
        pendingPlan={pendingPlan}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("overlay-chat-input-props")).toContainElement(screen.getByTestId("plan-approval"));
    expect(screen.queryByTestId("overlay-chat-input-props")).not.toBeInTheDocument();

    rerender(
      <ChatApp
        contained
        mode="compact"
        messages={messages}
        isStreaming={false}
        pendingApproval={pendingApproval}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("overlay-chat-input-props")).toContainElement(screen.getByTestId("exec-approval"));

    rerender(
      <ChatApp
        contained
        mode="compact"
        messages={messages}
        isStreaming={false}
        pendingQuestion={pendingQuestion}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("overlay-chat-input-props")).toContainElement(screen.getByTestId("question-input"));
  });

  test("floating and compact keep avatar stable while the surface morphs", () => {
    const { rerender } = render(
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

    expect(screen.getByTestId("agent-popup-avatar")).toHaveClass("size-14", "shrink-0");
    expect(screen.getByTestId("agent-popup-avatar")).toHaveAttribute("data-shared-element", "overlay-avatar");

    rerender(
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

    expect(screen.getByTestId("floating-overlay-surface")).toHaveClass("size-20");
    expect(screen.getByTestId("floating-overlay-surface")).not.toHaveClass("hover:scale-[1.03]");
    expect(screen.getByTestId("floating-overlay-avatar")).toHaveClass("size-14");
    expect(screen.getByTestId("floating-overlay-avatar")).not.toHaveClass("size-full");
    expect(screen.getByTestId("floating-overlay-avatar")).toHaveAttribute("data-shared-element", "overlay-avatar");
  });

  test("floating and compact do not share the outer surface morph", () => {
    const { rerender } = render(
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

    expect(screen.getByTestId("floating-overlay-surface")).toHaveAttribute("data-transition-role", "float-fade");
    expect(screen.getByTestId("floating-overlay-surface")).not.toHaveAttribute("data-shared-surface", "overlay");
    expect(screen.getByTestId("floating-overlay-avatar")).toHaveAttribute("data-transition-role", "avatar-fade");

    rerender(
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

    expect(screen.getByTestId("compact-overlay")).toHaveAttribute("data-transition-role", "panel-fade");
    expect(screen.getByTestId("compact-overlay")).toHaveAttribute("data-shared-surface", "overlay");
    expect(screen.getByTestId("agent-popup-avatar")).toHaveAttribute("data-transition-role", "avatar-fade");
  });

  test("full mode fills the overlay container with the expanded chat surface", () => {
    render(
      <ChatApp
        contained
        mode="full"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("full-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("expanded-header")).not.toBeInTheDocument();
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("overlay-chat-input-props")).toBeInTheDocument();
  });

  test("renders todo and background task summaries from the ChatApp message stream", () => {
    render(
      <ChatApp
        contained
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("todo-list-panel")).toHaveTextContent("1");
    expect(screen.getByTestId("background-task-list")).toHaveTextContent("1");
    expect(mockBuildTodoListItemsFromMessages).toHaveBeenCalledWith(messages, undefined);
    expect(mockBuildBackgroundTasksFromMessages).toHaveBeenCalledWith(messages);
  });

  test("does not recompute message-derived task summaries while typing in the expanded input", () => {
    const { rerender } = render(
      <ChatApp
        contained
        mode="expanded"
        inputValue=""
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onInputValueChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(mockBuildTodoListItemsFromMessages).toHaveBeenCalledTimes(1);
    expect(mockBuildBackgroundTasksFromMessages).toHaveBeenCalledTimes(1);

    rerender(
      <ChatApp
        contained
        mode="expanded"
        inputValue="draft"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onInputValueChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(mockBuildTodoListItemsFromMessages).toHaveBeenCalledTimes(1);
    expect(mockBuildBackgroundTasksFromMessages).toHaveBeenCalledTimes(1);
  });

  test("uses the explicit static assistant avatar for message surfaces", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        staticAssistantAvatar={<span data-testid="custom-static-avatar">Static avatar</span>}
      />
    );

    expect(screen.getByTestId("message-list-assistant-avatar")).toContainElement(screen.getByTestId("custom-static-avatar"));
  });

  test("does not render a fallback avatar when no dynamic assistant avatar is provided", () => {
    render(
      <ChatApp
        mode="floating"
        messages={messages}
        isStreaming
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.queryByTestId("viben-pet-avatar")).not.toBeInTheDocument();
    expect(screen.getByTestId("floating-overlay-avatar")).toBeEmptyDOMElement();
  });

  test("uses dynamic assistant avatars for overlay modes and static assistant avatars for the message list", () => {
    const { rerender } = render(
      <ChatApp
        mode="floating"
        messages={messages}
        isStreaming
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        dynamicAssistantAvatar={<span data-testid="custom-dynamic-avatar">Dynamic avatar</span>}
        staticAssistantAvatar={<span data-testid="custom-static-avatar">Static avatar</span>}
      />
    );

    expect(screen.getByTestId("custom-dynamic-avatar")).toBeInTheDocument();
    expect(screen.queryByTestId("custom-static-avatar")).not.toBeInTheDocument();

    rerender(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        dynamicAssistantAvatar={<span data-testid="custom-dynamic-avatar">Dynamic avatar</span>}
        staticAssistantAvatar={<span data-testid="custom-static-avatar">Static avatar</span>}
      />
    );

    expect(screen.getByTestId("message-list-assistant-avatar")).toContainElement(screen.getByTestId("custom-static-avatar"));
    expect(screen.queryByTestId("custom-dynamic-avatar")).not.toBeInTheDocument();
  });

  test("passes static pet avatars into fullscreen message lists", () => {
    render(
      <ChatAppFullscreenPanel
        messageContent={(
          <ChatAppFullscreenMessagePanel
            messages={messages}
            isStreaming={false}
            assistantAvatar={<span data-testid="fullscreen-static-pet">Fullscreen static pet</span>}
          />
        )}
        inputContent={(
          <ChatAppFullscreenInputPanel
            inputProps={{
              value: "",
              onValueChange: () => {},
              onSend: () => {},
              onCancel: () => {},
            }}
          />
        )}
      />
    );

    expect(screen.getByTestId("message-list-assistant-avatar")).toContainElement(screen.getByTestId("fullscreen-static-pet"));
  });

  test("renders the pending queued user message badge with externally supplied avatars", () => {
    render(
      <ChatApp
        mode="floating"
        messages={messages}
        isStreaming={false}
        pendingUserMessageCount={2}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        dynamicAssistantAvatar={<span data-testid="dynamic-avatar" data-avatar-kind="dynamic" />}
        staticAssistantAvatar={<span data-testid="static-avatar" data-avatar-kind="static" />}
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByTestId("floating-overlay-avatar")).toContainElement(screen.getByTestId("dynamic-avatar"));
    expect(screen.queryByTestId("static-avatar")).not.toBeInTheDocument();
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

  test("floating avatar expands to compact mode on hover", () => {
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

    fireEvent.mouseEnter(screen.getByTestId("floating-overlay-surface"));

    expect(onModeChange).toHaveBeenCalledWith("compact");
  });

  test("compact returns to floating on mouse leave only when input is empty", () => {
    const onModeChange = vi.fn();
    const { rerender } = render(
      <ChatApp
        mode="compact"
        messages={messages}
        isStreaming={false}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.mouseLeave(screen.getByTestId("compact-overlay"));
    expect(onModeChange).toHaveBeenCalledWith("floating");

    onModeChange.mockClear();
    rerender(
      <ChatApp
        mode="compact"
        inputValue="draft"
        messages={messages}
        isStreaming={false}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Minimize chat" })).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByTestId("compact-overlay"));
    expect(onModeChange).not.toHaveBeenCalledWith("floating");
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
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-overlay")).toHaveClass("pointer-events-auto");
    expect(screen.getByTestId("expanded-header-session-slot")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-header-action-slot")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-header-drag-area")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to compact mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to fullscreen mode" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByTestId("overlay-chat-input-props")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-overlay").querySelector("[data-shared-element='overlay-header']")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-message-panel")).toHaveAttribute("data-shared-element", "overlay-message-panel");
    expect(screen.getByTestId("expanded-chat-input-container")).toHaveAttribute("data-shared-element", "overlay-input-panel");
  });

  test("expanded body renders status content and pending input panels", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        statusContent={<div data-testid="expanded-status-content">Queued command</div>}
        pendingApproval={pendingApproval}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-message-panel")).toContainElement(screen.getByTestId("expanded-status-content"));
    expect(screen.getByTestId("overlay-chat-input-props")).toContainElement(screen.getByTestId("exec-approval"));
    expect(screen.queryByTestId("overlay-chat-input-props")).not.toBeInTheDocument();
  });

  test("expanded message list uses the same reusable message panel as fullscreen", () => {
    const onExpandSubagent = vi.fn();
    render(
      <ChatApp
        mode="expanded"
        messages={[
          {
            id: "read-1",
            type: "tool_use",
            name: "Read",
            toolUseId: "tool-read-1",
            input: { file_path: "/root/viben/packages/chat/example/src/ChatApp.tsx" },
          },
        ]}
        messageUpdates={{ "read-1": { content: "updated" } }}
        isStreaming
        streamingText="partial assistant response"
        artifacts={[{ id: "artifact-1", name: "settings.json", type: "json" }]}
        onExpandSubagent={onExpandSubagent}
        onInspectTool={() => {}}
        onArtifactClick={() => {}}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("message-list-count")).toHaveTextContent("1");
    expect(screen.getByTestId("message-list-streaming")).toHaveTextContent("true");
    expect(screen.getByTestId("message-list-streaming-text")).toHaveTextContent("partial assistant response");
    expect(screen.getByTestId("message-list-updates")).toHaveTextContent("1");
    expect(screen.getByTestId("message-list-has-expand-subagent")).toHaveTextContent("true");
    expect(screen.getByTestId("message-list-has-inspect-tool")).toHaveTextContent("true");
    expect(screen.getByTestId("message-list-artifacts")).toHaveTextContent("1");
    expect(screen.getByTestId("expanded-message-panel")).toHaveClass("flex");
    expect(screen.getByTestId("expanded-message-panel")).toHaveClass("flex-col");
    expect(screen.getByTestId("expanded-message-panel")).toHaveClass("min-h-0");
    expect(screen.getByTestId("expanded-message-panel")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("expanded-message-panel")).toHaveClass("overscroll-contain");
    expect(screen.queryByText("Read is running...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open subagent" }));

    expect(onExpandSubagent).toHaveBeenCalledWith(
      "Demo subagent",
      "explorer",
      [{ id: "sub-1", type: "text", content: "subagent detail" }],
      { toolUseId: "tool-1" }
    );

    fireEvent.click(screen.getByRole("button", { name: "Open background task" }));

    expect(onExpandSubagent).toHaveBeenCalledWith(
      "Background agent",
      "agent",
      [{ id: "bg-sub-1", type: "text", content: "background detail" }],
      {
        subagentId: "sub-bg-1",
        toolUseId: "tool-bg-1",
        parentMessage: expect.objectContaining({ id: "agent-tool" }),
        messages: [{ id: "bg-sub-1", type: "text", content: "background detail" }],
      }
    );
  });

  test("compact idle summary shows a single-line greeting", () => {
    render(
      <ChatApp
        mode="compact"
        title="Demo session title"
        messages={emptyMessages}
        isStreaming={false}
        compactSummaryContent="Let’s make progress."
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("agent-popup-title")).toHaveTextContent("Demo session title");
    expect(screen.getByTestId("agent-popup-summary")).toHaveTextContent("Let’s make progress.");
    expect(screen.getByTestId("agent-popup-summary")).toHaveClass("truncate", "whitespace-nowrap", "overflow-hidden");
  });

  test("compact summary is driven by the compactSummaryContent prop", () => {
    render(
      <ChatApp
        mode="compact"
        messages={[
          {
            id: "read-1",
            type: "tool_use",
            name: "Read",
            toolUseId: "tool-read-1",
            input: { file_path: "/root/viben/packages/chat/example/src/ChatApp.tsx" },
          },
        ]}
        isStreaming
        compactSummaryContent="Host controlled status"
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("agent-popup-summary")).toHaveTextContent("Host controlled status");
    expect(screen.getByTestId("agent-popup-summary")).toHaveClass("truncate", "whitespace-nowrap", "overflow-hidden");
    expect(screen.queryByText("Read is working...")).not.toBeInTheDocument();
  });

  test("compact thinking summary renders with streaming markdown on one line", () => {
    render(
      <ChatApp
        mode="compact"
        messages={[{ id: "think-1", type: "thinking", content: "I am checking the active session." }]}
        isStreaming
        compactSummaryContent={(
          <span data-testid="streamdown-streaming" data-caret="block">I am checking the active session.</span>
        )}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("agent-popup-summary")).toContainElement(screen.getByTestId("streamdown-streaming"));
    expect(screen.getByTestId("agent-popup-summary")).toHaveClass("truncate", "whitespace-nowrap", "overflow-hidden");
    expect(screen.getByTestId("streamdown-streaming")).toHaveAttribute("data-caret", "block");
  });

  test("expanded mode keeps the same floating width as compact mode and uses viewport height when contained", () => {
    render(
      <ChatApp
        contained
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    const overlay = screen.getByTestId("expanded-overlay");
    expect(overlay).toHaveClass("w-[min(440px,calc(100dvw_-_2rem))]");
    expect(overlay).toHaveClass("h-[75dvh]");
    expect(overlay).toHaveClass("absolute");
    expect(overlay).toHaveClass("bottom-5");
    expect(overlay).toHaveClass("left-5");
    expect(overlay).toHaveClass("z-20");
    expect(overlay).toHaveClass("overlay-shared-surface");
    expect(overlay).not.toHaveClass("relative");
    expect(overlay).not.toHaveClass("h-full");
    expect(overlay).not.toHaveClass("w-full");
  });

  test("renders surface overlays inside expanded and full chat surfaces", () => {
    const { rerender } = render(
      <ChatApp
        contained
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        surfaceOverlay={<div data-testid="surface-overlay">Tool detail</div>}
      />
    );

    expect(screen.getByTestId("expanded-overlay")).toContainElement(screen.getByTestId("surface-overlay"));

    rerender(
      <ChatApp
        contained
        mode="full"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent({ mode: "full" })}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        surfaceOverlay={<div data-testid="surface-overlay">Tool detail</div>}
      />
    );

    expect(screen.getByTestId("full-overlay")).toContainElement(screen.getByTestId("surface-overlay"));
  });

  test("expanded to fullscreen lets the parent container own the fullscreen width target", () => {
    const { rerender } = render(
      <ChatApp
        contained
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-overlay")).toHaveAttribute("data-transition-role", "expand-to-full");
    expect(screen.getByTestId("expanded-overlay")).toHaveClass("w-[min(440px,calc(100dvw_-_2rem))]");

    rerender(
      <ChatApp
        contained
        mode="full"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent({ mode: "full" })}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        fullscreenContent={(
          <ChatAppFullscreenPanel
            messageContent={<ChatAppFullscreenMessagePanel messages={messages} isStreaming={false} />}
            inputContent={(
              <ChatAppFullscreenInputPanel
                inputProps={{
                  value: "",
                  onValueChange: () => {},
                  onSend: () => {},
                  onCancel: () => {},
                }}
              />
            )}
          />
        )}
      />
    );

    expect(screen.getByTestId("full-overlay")).toHaveAttribute("data-transition-role", "expand-to-full");
    expect(screen.getByTestId("full-overlay")).toHaveClass("w-full");
    expect(screen.getByTestId("full-overlay")).not.toHaveClass("w-[calc(100dvw_-_280px)]");
  });

  test("expanded and full modes expose shared elements for internal layout animation", () => {
    const { rerender } = render(
      <ChatApp
        contained
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent()}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-overlay").querySelector("[data-shared-element='overlay-header']")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-message-panel")).toHaveAttribute("data-shared-element", "overlay-message-panel");
    expect(screen.getByTestId("expanded-chat-input-container")).toHaveAttribute("data-shared-element", "overlay-input-panel");

    rerender(
      <ChatApp
        contained
        mode="full"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent({ mode: "full" })}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        fullscreenContent={(
          <ChatAppFullscreenPanel
            messageContent={<ChatAppFullscreenMessagePanel messages={messages} isStreaming={false} />}
            inputContent={(
              <ChatAppFullscreenInputPanel
                inputProps={{
                  value: "",
                  onValueChange: () => {},
                  onSend: () => {},
                  onCancel: () => {},
                }}
              />
            )}
          />
        )}
      />
    );

    expect(screen.getByTestId("full-overlay").querySelector("[data-shared-element='overlay-header']")).toBeInTheDocument();
    expect(screen.getByTestId("fullscreen-message-panel")).toHaveAttribute("data-shared-element", "overlay-message-panel");
    expect(screen.getByTestId("fullscreen-chat-input-shell")).toHaveAttribute("data-shared-element", "overlay-input-panel");
  });

  test("expanded mode is a viewport anchored floating panel when not contained", () => {
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

    const overlay = screen.getByTestId("expanded-overlay");
    expect(overlay).toHaveClass("fixed");
    expect(overlay).toHaveClass("bottom-5");
    expect(overlay).toHaveClass("left-5");
    expect(overlay).toHaveClass("z-50");
    expect(overlay).not.toHaveClass("relative");
    expect(overlay).toHaveClass("w-[min(440px,calc(100dvw_-_2rem))]");
    expect(overlay).toHaveClass("h-[75dvh]");
    expect(overlay).not.toHaveClass("h-full");
    expect(overlay).not.toHaveClass("w-full");
  });

  test("expanded header compact and full buttons switch overlay modes", () => {
    const onModeChange = vi.fn();
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent({ onModeChange })}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch to compact mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to fullscreen mode" }));

    expect(onModeChange).toHaveBeenCalledWith("compact");
    expect(onModeChange).toHaveBeenCalledWith("full");
  });

  test("compact fullscreen button opens fullscreen without bubbling to expanded", () => {
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

    expect(screen.queryByRole("button", { name: "Open fullscreen chat" })).not.toBeInTheDocument();
  });

  test("expanded header mode controls render supplied more menu content", () => {
    const onSettingsClick = vi.fn();
    const onModeChange = vi.fn();
    render(
      <ExpandedHeader
        centerContent={<div data-testid="expanded-header-drag-area" />}
        rightContent={(
          <ExpandedHeaderModeControls
            mode="expanded"
            onModeChange={onModeChange}
            moreMenuContent={<button type="button" onClick={onSettingsClick}>Settings</button>}
          />
        )}
      />
    );

    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(onSettingsClick).toHaveBeenCalledTimes(1);
    expect(onModeChange).not.toHaveBeenCalled();
  });

  test("expanded header exposes left center and right content slots", () => {
    render(
      <ExpandedHeader
        leftContent={<span data-testid="custom-left">Left</span>}
        centerContent={<span data-testid="custom-center">Center</span>}
        rightContent={<span data-testid="custom-right">Right</span>}
      />
    );

    expect(screen.getByTestId("expanded-header-left")).toContainElement(screen.getByTestId("custom-left"));
    expect(screen.getByTestId("expanded-header-center")).toContainElement(screen.getByTestId("custom-center"));
    expect(screen.getByTestId("expanded-header-right")).toContainElement(screen.getByTestId("custom-right"));
  });

  test("expanded header keeps controls grouped into slots", () => {
    render(
      <ExpandedHeader
        leftContent={(
          <>
            <span data-testid="session-title-menu">Session slot</span>
            <span data-testid="new-session-split-button">Action slot</span>
          </>
        )}
        centerContent={<div data-testid="expanded-header-drag-area" />}
        rightContent={(
          <ExpandedHeaderModeControls
            mode="expanded"
            onModeChange={() => {}}
            moreMenuContent={<button type="button">Settings</button>}
          />
        )}
      />
    );

    expect(Array.from(screen.getByTestId("expanded-header-left").children).map((child) => child.getAttribute("data-testid"))).toEqual([
      "session-title-menu",
      "new-session-split-button",
    ]);
    expect(Array.from(screen.getByTestId("expanded-header-center").children).map((child) => child.getAttribute("data-testid"))).toEqual([
      "expanded-header-drag-area",
    ]);
    expect(Array.from(screen.getByTestId("expanded-header-right").children).map((child) => child.getAttribute("data-testid"))).toEqual([
      "compact-mode-button",
      "full-mode-button",
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
    expect(screen.getByTestId("show-bottom-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("has-bottom-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("slash-count")).toHaveTextContent("1");
    expect(screen.getByTestId("queued-count")).toHaveTextContent("1");
    expect(screen.getByTestId("default-height")).toHaveTextContent("48");
    expect(screen.getByTestId("min-height")).toHaveTextContent("48");
    expect(screen.getByTestId("max-height")).toHaveTextContent("48");
    expect(screen.queryByTestId("chat-input-config-controls")).not.toBeInTheDocument();

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
    expect(screen.getByTestId("show-bottom-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("chat-input-config-controls")).toBeInTheDocument();
    expect(screen.getByTestId("default-height")).toHaveTextContent("undefined");
    expect(screen.getByTestId("min-height")).toHaveTextContent("undefined");
    expect(screen.getByTestId("max-height")).toHaveTextContent("undefined");
  });

  test("expanded input is embedded without the compact rounded rectangle frame", () => {
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

    const input = screen.getByTestId("overlay-chat-input-props");
    expect(input).toHaveAttribute("data-variant", "expanded");
    expect(input).not.toHaveClass("rounded-xl");
    expect(input).not.toHaveClass("border");
    expect(input).not.toHaveClass("shadow-2xl");
  });

  test("expanded input spans the panel without outer padding", () => {
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

    const inputContainer = screen.getByTestId("expanded-chat-input-container");
    const input = screen.getByTestId("overlay-chat-input-props");
    expect(inputContainer).toHaveClass("w-full");
    expect(inputContainer).not.toHaveClass("p-3");
    expect(input).toHaveClass("w-full");
  });

  test("full mode can render a reusable fullscreen panel under the shared expanded header", () => {
    render(
      <ChatApp
        contained
        mode="full"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent({ mode: "full" })}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        fullscreenContent={<div data-testid="custom-fullscreen-panel">Fullscreen body</div>}
      />
    );

    expect(screen.getByTestId("expanded-header-session-slot")).toBeInTheDocument();
    expect(screen.getByTestId("full-overlay")).toHaveClass("overlay-shared-surface");
    expect(screen.getByTestId("full-overlay")).toHaveClass("flex");
    expect(screen.getByTestId("full-overlay")).toHaveClass("min-h-0");
    expect(screen.getByTestId("full-overlay")).toHaveClass("flex-col");
    expect(screen.getByTestId("full-overlay")).toHaveClass("absolute");
    expect(screen.getByTestId("full-overlay")).toHaveClass("inset-y-0");
    expect(screen.getByTestId("full-overlay")).toHaveClass("right-0");
    expect(screen.getByTestId("full-overlay")).toHaveClass("w-full");
    expect(screen.getByTestId("full-overlay")).not.toHaveClass("w-[calc(100dvw_-_280px)]");
    expect(screen.getByTestId("full-overlay")).toHaveClass("shadow-none");
    expect(screen.getByTestId("custom-fullscreen-panel")).toBeInTheDocument();
  });

  test("expanded mode renders subagent sheet inside the floating panel", () => {
    render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        subagentSheet={{
          open: true,
          title: "Demo subagent",
          subagentType: "explorer",
          messages: [{ id: "sub-1", type: "text", content: "subagent detail" }],
          onClose: () => {},
        }}
      />
    );

    expect(screen.getByTestId("subagent-sheet")).toHaveAttribute("data-contained", "true");
    expect(screen.getByTestId("expanded-overlay")).toContainElement(screen.getByTestId("subagent-sheet"));
  });

  test("full mode renders subagent sheet inside the fullscreen panel", () => {
    render(
      <ChatApp
        mode="full"
        messages={messages}
        isStreaming={false}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
        subagentSheet={{
          open: true,
          title: "Demo subagent",
          messages: [{ id: "sub-1", type: "text", content: "subagent detail" }],
          onClose: () => {},
        }}
      />
    );

    expect(screen.getByTestId("subagent-sheet")).toHaveAttribute("data-contained", "true");
    expect(screen.getByTestId("full-overlay")).toContainElement(screen.getByTestId("subagent-sheet"));
  });

  test("fullscreen mode reuses the expanded header controls", () => {
    render(
      <ChatApp
        mode="full"
        messages={messages}
        isStreaming={false}
        headerContent={createHeaderContent({ mode: "full" })}
        onModeChange={() => {}}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("expanded-header")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-header-session-slot")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-header-action-slot")).toBeInTheDocument();
    expect(screen.getByTestId("expanded-header-drag-area")).toBeInTheDocument();
    expect(screen.getByTestId("compact-mode-button")).toBeInTheDocument();
    expect(screen.queryByTestId("full-mode-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("more-actions-menu")).toBeInTheDocument();
  });

  test("allows expanded and full headers to be provided as direct slot content", () => {
    const onModeChange = vi.fn();
    const expandedHeader = (
      <div data-testid="custom-overlay-header">
        <span>Custom session</span>
        <span>expanded</span>
        <button type="button" onClick={() => onModeChange("compact")}>Custom compact</button>
      </div>
    );

    const { rerender } = render(
      <ChatApp
        mode="expanded"
        messages={messages}
        isStreaming={false}
        headerContent={expandedHeader}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("custom-overlay-header")).toHaveTextContent("Custom session");
    expect(screen.getByTestId("custom-overlay-header")).toHaveTextContent("expanded");
    expect(screen.queryByTestId("expanded-header")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Custom compact" }));
    expect(onModeChange).toHaveBeenCalledWith("compact");

    rerender(
      <ChatApp
        mode="full"
        messages={messages}
        isStreaming={false}
        headerContent={(
          <div data-testid="custom-overlay-header">
            <span>Custom session</span>
            <span>full</span>
          </div>
        )}
        onModeChange={onModeChange}
        onSend={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByTestId("custom-overlay-header")).toHaveTextContent("full");
  });

  test("composes expanded header slots with mode controls", () => {
    const onSettingsClick = vi.fn();
    const onModeChange = vi.fn();

    render(
      <ExpandedHeader
        leftContent={(
          <>
            <button type="button">Session slot</button>
            <button type="button">Action slot</button>
          </>
        )}
        centerContent={<div data-testid="expanded-header-drag-area" />}
        rightContent={(
          <ExpandedHeaderModeControls
            mode="expanded"
            onModeChange={onModeChange}
            moreMenuContent={<button type="button" onClick={onSettingsClick}>Settings</button>}
          />
        )}
      />
    );

    expect(screen.getByRole("button", { name: "Session slot" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action slot" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Switch to compact mode" }));
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(onModeChange).toHaveBeenCalledWith("compact");
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });
});

describe("ChatAppFullscreenPanel", () => {
  test("renders the reusable message list and full chat input composition", () => {
    render(
      <ChatAppFullscreenPanel
        messageContent={<ChatAppFullscreenMessagePanel messages={messages} isStreaming={false} />}
        inputContent={(
          <ChatAppFullscreenInputPanel
            inputProps={{
              value: "hello",
              onValueChange: () => {},
              onSend: () => {},
              onCancel: () => {},
            }}
          />
        )}
      />
    );

    expect(screen.getByTestId("message-list-count")).toHaveTextContent("2");
    expect(screen.getByTestId("layout-variant")).toHaveTextContent("expanded");
    expect(screen.getByTestId("show-top-toolbar")).toHaveTextContent("true");
    expect(screen.getByTestId("show-bottom-toolbar")).toHaveTextContent("true");
  });

  test("uses the same expanded chat input configuration and full width container", () => {
    const sharedInputProps = {
      value: "hello",
      onValueChange: () => {},
      onSend: () => {},
      onCancel: () => {},
      slashCommands: [{ name: "plan", description: "Plan", input: null }],
      queuedInputRecallItems: [{ content: "queued work" }],
      className: "shared-expanded-input",
    };

    render(
      <ChatAppFullscreenPanel
        messageContent={<ChatAppFullscreenMessagePanel messages={messages} isStreaming={false} />}
        inputContent={<ChatAppFullscreenInputPanel inputProps={sharedInputProps} />}
      />
    );

    expect(screen.getByTestId("fullscreen-chat-input-shell")).toHaveClass("w-full");
    expect(screen.getByTestId("fullscreen-chat-input-shell")).not.toHaveClass("px-4");
    expect(screen.getByTestId("fullscreen-chat-input-shell")).not.toHaveClass("py-2");
    expect(screen.getByTestId("fullscreen-chat-input-container")).toHaveClass("w-full");
    expect(screen.getByTestId("fullscreen-chat-input-container")).not.toHaveClass("max-w-[760px]");
    expect(screen.getByTestId("slash-count")).toHaveTextContent("1");
    expect(screen.getByTestId("queued-count")).toHaveTextContent("1");
    expect(screen.getByTestId("input-class-name")).toHaveTextContent("shared-expanded-input");
  });
});
