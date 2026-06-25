/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AcpSessionListDrawer } from "./acp-session-list-drawer";
import type { AcpSessionListItem } from "./use-acp-session";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, options?: Record<string, unknown>) => {
      if (fallback?.includes("{{count}}")) return fallback.replace("{{count}}", String(options?.count ?? ""));
      return fallback ?? _key;
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

    fireEvent.click(screen.getByRole("button", { name: "Copy session id" }));

    expect(writeText).toHaveBeenCalledWith("backend-session-1234567890");
    expect(onAttach).not.toHaveBeenCalled();
  });
});
