import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { SubagentSheet } from "../subagent-sheet";
import type { AgentMessage, LoadSubagentDetails } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, optionsOrFallback?: string | { defaultValue?: string; count?: number }) => {
      if (typeof optionsOrFallback === "string") return optionsOrFallback;
      return optionsOrFallback?.defaultValue || _key;
    },
  }),
}));

describe("SubagentSheet", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("loads subagent details from an external provider when opened without messages", async () => {
    const messages: AgentMessage[] = [
      { id: "m1", type: "text", content: "loaded transcript" },
    ];
    const loadSubagentDetails: LoadSubagentDetails = vi.fn(async () => ({
      title: "Loaded subagent",
      subagentType: "explorer",
      messages,
    }));

    render(
      <SubagentSheet
        open
        onClose={vi.fn()}
        title="Subagent"
        messages={[]}
        context={{ subagentId: "agent-1", toolUseId: "tool-1" }}
        loadSubagentDetails={loadSubagentDetails}
      />
    );

    expect(screen.getByText("Loading subagent…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("loaded transcript")).toBeInTheDocument();
    });

    expect(screen.getByText("Loaded subagent")).toBeInTheDocument();
    expect(screen.getByText("explorer")).toBeInTheDocument();
    expect(loadSubagentDetails).toHaveBeenCalledWith({
      subagentId: "agent-1",
      toolUseId: "tool-1",
    });
  });

  test("shows live playback messages while lazy details are still loading", async () => {
    const loadedMessages: AgentMessage[] = [
      { id: "loaded-1", type: "text", content: "loaded transcript" },
    ];
    let resolveDetails: ((messages: AgentMessage[]) => void) | undefined;
    const loadSubagentDetails: LoadSubagentDetails = vi.fn(
      () =>
        new Promise<{ messages: AgentMessage[] }>((resolve) => {
          resolveDetails = (messages) => resolve({ messages });
        })
    );

    render(
      <SubagentSheet
        open
        onClose={vi.fn()}
        title="Subagent"
        messages={[]}
        liveMessages={[
          { id: "live-1", type: "text", content: "live progress card" },
        ]}
        context={{ subagentId: "agent-1", toolUseId: "tool-1" }}
        loadSubagentDetails={loadSubagentDetails}
      />
    );

    expect(screen.getByText("live progress card")).toBeInTheDocument();
    expect(screen.getByText("Loading subagent…")).toBeInTheDocument();

    resolveDetails?.(loadedMessages);

    await waitFor(() => {
      expect(loadSubagentDetails).toHaveBeenCalled();
    });

    expect(screen.queryByText("loaded transcript")).not.toBeInTheDocument();
  });

  test("can render as a contained sliding sheet inside an overlay panel", () => {
    render(
      <div data-testid="overlay-panel" className="relative">
        <SubagentSheet
          contained
          open
          onClose={vi.fn()}
          title="Contained subagent"
          messages={[
            { id: "m1", type: "text", content: "contained transcript" },
          ]}
        />
      </div>
    );

    expect(screen.getByTestId("subagent-sheet-backdrop")).toHaveClass("absolute");
    expect(screen.getByTestId("subagent-sheet-backdrop")).not.toHaveClass("fixed");
    expect(screen.getByTestId("subagent-sheet-panel")).toHaveClass("absolute");
    expect(screen.getByTestId("subagent-sheet-panel")).not.toHaveClass("fixed");
    expect(screen.getByTestId("overlay-panel")).toContainElement(screen.getByTestId("subagent-sheet-panel"));
  });

  test("resizes from a drag handle on the left edge", () => {
    render(
      <SubagentSheet
        open
        onClose={vi.fn()}
        title="Resizable subagent"
        messages={[
          { id: "m1", type: "text", content: "contained transcript" },
        ]}
      />
    );

    const panel = screen.getByTestId("subagent-sheet-panel");
    const handle = screen.getByTestId("subagent-sheet-resize-handle");

    expect(panel).toHaveStyle({ width: "480px" });

    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(window, { clientX: 420 });
    fireEvent.mouseUp(window);

    expect(panel).toHaveStyle({ width: "560px" });
  });

  test("merges tool calls and matching tool results into one card", () => {
    render(
      <SubagentSheet
        open
        onClose={vi.fn()}
        title="Tool transcript"
        messages={[
          {
            id: "tool-use-1",
            type: "tool_use",
            name: "Read",
            toolUseId: "tool-1",
            input: { file_path: "/root/viben/packages/chat/src/subagent-sheet.tsx" },
          },
          {
            id: "tool-result-1",
            type: "tool_result",
            toolUseId: "tool-1",
            output: "merged file content",
          },
        ]}
      />
    );

    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(screen.getByText("merged file content")).toBeInTheDocument();
    expect(screen.queryByText("Tool Result")).not.toBeInTheDocument();
  });
});
