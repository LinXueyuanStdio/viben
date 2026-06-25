/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AcpSessionListDrawer } from "./acp-session-list-drawer";
import type { AcpSessionListItem } from "./use-acp-session";

const translations = vi.hoisted((): Record<string, string> => ({
  "chat.acp.sessionList": "Sessions",
  "chat.acp.sessionListCount": "{{count}} sessions",
  "chat.acp.noSessions": "No sessions",
  "chat.acp.copySessionId": "Copy session ID",
  "chat.acp.copySessionIdForResume": "Copy session ID for manual resume",
  "chat.acp.unknownAgent": "Unknown agent",
  "chat.acp.current": "Current",
  "chat.acp.enterAttach": "Enter to attach",
  "chat.acp.enterResume": "Enter to resume",
  "common.close": "Close",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = translations[key] ?? key;
      if (value.includes("{{count}}")) return value.replace("{{count}}", String(options?.count ?? ""));
      return value;
    },
  }),
}));

const session: AcpSessionListItem = {
  sessionKey: "CODEX:backend-session-1234567890",
  sessionId: "backend-session-1234567890",
  executorType: "CODEX",
  title: "Legacy generated title",
  status: "finished",
  agent: "Codex",
  initialPrompt: "Implement the new ACP card layout from the first user prompt",
};

describe("AcpSessionListDrawer", () => {
  it("matches the expanded header height with a compact icon header", () => {
    render(
      <AcpSessionListDrawer
        open
        sessions={[session]}
        activeSessionId={null}
        selectedIndex={0}
        onSelectedIndexChange={vi.fn()}
        onAttach={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("acp-session-list-header").className).toContain("h-10");
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("uses the initial prompt as the card title and keeps the action hint with the agent row", () => {
    render(
      <AcpSessionListDrawer
        open
        sessions={[session]}
        activeSessionId={null}
        selectedIndex={0}
        onSelectedIndexChange={vi.fn()}
        onAttach={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Implement the new ACP card layout from the first user prompt")).toBeTruthy();
    expect(screen.queryByText("Legacy generated title")).toBeNull();

    const agentRow = screen.getByText("Codex").closest("[data-testid='acp-session-card-footer']");

    expect(agentRow).toBeTruthy();
    expect(agentRow?.textContent).toContain("Codex");
    expect(agentRow?.textContent).toContain("Enter to resume");
  });

  it("copies the backend session id without attaching the session", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onAttach = vi.fn();

    render(
      <AcpSessionListDrawer
        open
        sessions={[session]}
        activeSessionId={null}
        selectedIndex={0}
        onSelectedIndexChange={vi.fn()}
        onAttach={onAttach}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy session ID" }));

    expect(writeText).toHaveBeenCalledWith("backend-session-1234567890");
    expect(onAttach).not.toHaveBeenCalled();
  });
});
