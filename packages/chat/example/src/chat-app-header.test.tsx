// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import {
  DefaultExpandedHeaderMoreMenu,
  ExpandedHeaderNewSessionMenu,
  ExpandedHeaderSessionMenu,
} from "./chat-app-header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback,
  }),
}));

const sessions = [
  { id: "session-1", title: "Session one", subtitle: "session-1.jsonl" },
  { id: "session-2", title: "Session two", subtitle: "session-2.jsonl" },
];

const agents = [
  { id: "claude-code", name: "Claude Code", type: "agent & executor" },
  { id: "openai-browser", name: "OpenAI · Browser", type: "agent & executor" },
];

describe("example ChatApp header menus", () => {
  test("session menu shows search and session samples", () => {
    render(
      <ExpandedHeaderSessionMenu
        title="Viben session"
        sessions={sessions}
        assistantAvatar={<span>avatar</span>}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));

    expect(screen.getByRole("searchbox", { name: "Search sessions" })).toBeInTheDocument();
    expect(screen.getByText("Session one")).toBeInTheDocument();
    expect(screen.getByText("session-1.jsonl")).toBeInTheDocument();
    expect(screen.getByText("Session two")).toBeInTheDocument();
    expect(screen.getByText("session-2.jsonl")).toBeInTheDocument();
  });

  test("session menu calls selection callback, closes, and updates title", () => {
    const onSelectSession = vi.fn();
    render(
      <ExpandedHeaderSessionMenu
        title="Viben session"
        sessions={sessions}
        assistantAvatar={<span>avatar</span>}
        onSelectSession={onSelectSession}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Session menu" }));
    fireEvent.click(screen.getByText("Session two"));

    expect(onSelectSession).toHaveBeenCalledWith({ id: "session-2", title: "Session two", subtitle: "session-2.jsonl" });
    expect(screen.getByRole("button", { name: "Session menu" })).toHaveTextContent("Session two");
    expect(screen.queryByText("session-2.jsonl")).not.toBeInTheDocument();
  });

  test("new-session menu shows creation actions and agent samples", () => {
    render(<ExpandedHeaderNewSessionMenu agents={agents} />);

    fireEvent.click(screen.getByRole("button", { name: "Open new session menu" }));

    expect(screen.getByTestId("new-session-menu-chevron")).toHaveClass("lucide-chevron-down");
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText("New chat window")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("OpenAI · Browser")).toBeInTheDocument();
  });

  test("new-session menu uses supplied callbacks", () => {
    const onCreateSession = vi.fn();
    const onNewChat = vi.fn();
    const onSelectAgent = vi.fn();
    render(
      <ExpandedHeaderNewSessionMenu
        agents={agents}
        onCreateSession={onCreateSession}
        onNewChat={onNewChat}
        onSelectAgent={onSelectAgent}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Create new session" }));
    fireEvent.click(screen.getByRole("button", { name: "Open new session menu" }));
    fireEvent.click(screen.getByText("New chat"));
    fireEvent.click(screen.getByText("Claude Code"));

    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(onNewChat).toHaveBeenCalledTimes(1);
    expect(onSelectAgent).toHaveBeenCalledWith({ id: "claude-code", name: "Claude Code", type: "agent & executor" });
  });

  test("default more menu shows settings, navigation, and debug actions", () => {
    const onSettingsClick = vi.fn();
    render(<DefaultExpandedHeaderMoreMenu onSettingsClick={onSettingsClick} />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Previous step")).toBeInTheDocument();
    expect(screen.getByText("Next step")).toBeInTheDocument();
    expect(screen.getByText("Move chat to new window")).toBeInTheDocument();
    expect(screen.getByText("Show debug view")).toBeInTheDocument();
    expect(screen.getByText("Show debug log")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Settings"));
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });
});
