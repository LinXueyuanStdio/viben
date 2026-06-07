import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ToolExecutionItem } from "../tool-execution-item";
import type { AgentMessage } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

describe("ToolExecutionItem subagent cards", () => {
  test("renders the subagent header as friendly type with description parameter", () => {
    render(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Explore sidebar navigation chain",
          subagent_type: "Explore",
        }}
        toolUseId="tool-header"
        output="done"
        onExpandSubagent={vi.fn()}
      />
    );

    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("(Explore sidebar navigation chain)")).toBeInTheDocument();
  });

  test("opens the side panel from the subagent card header", () => {
    const subagentMessages: AgentMessage[] = [
      { id: "m1", type: "text", content: "subagent details" },
    ];
    const onExpandSubagent = vi.fn();

    render(
      <ToolExecutionItem
        name="Task"
        input={{
          description: "Inspect workspace",
          subagent_type: "explorer",
        }}
        toolUseId="tool-1"
        subagentId="agent-1"
        output="done"
        subagentMessages={subagentMessages}
        onExpandSubagent={onExpandSubagent}
      />
    );

    fireEvent.click(screen.getByTitle("Open in side panel"));

    expect(onExpandSubagent).toHaveBeenCalledWith(
      "Inspect workspace",
      "explorer",
      subagentMessages,
      {
        messages: subagentMessages,
        subagentId: "agent-1",
        toolUseId: "tool-1",
      }
    );
  });

  test("does not render full subagent messages inline when side panel is available", () => {
    const subagentMessages: AgentMessage[] = [
      { id: "m1", type: "text", content: "nested subagent transcript" },
    ];

    render(
      <ToolExecutionItem
        name="Task"
        input={{
          description: "Inspect workspace",
          subagent_type: "explorer",
        }}
        output="done"
        subagentMessages={subagentMessages}
        renderMessage={(message) => <div>{message.content}</div>}
        onExpandSubagent={vi.fn()}
      />
    );

    expect(screen.queryByText("nested subagent transcript")).not.toBeInTheDocument();
  });

  test("opens the side panel with only toolUseId so the host can load details lazily", () => {
    const onExpandSubagent = vi.fn();

    render(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Research message width",
          subagent_type: "explorer",
        }}
        toolUseId="tool-2"
        output="done"
        onExpandSubagent={onExpandSubagent}
      />
    );

    fireEvent.click(screen.getByTitle("Open in side panel"));

    expect(onExpandSubagent).toHaveBeenCalledWith(
      "Research message width",
      "explorer",
      [],
      {
        messages: undefined,
        subagentId: undefined,
        toolUseId: "tool-2",
      }
    );
  });

  test("renders running subagent preview rows inside the Agent card without a definition label", () => {
    render(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Research message width",
          subagent_type: "explorer",
        }}
        toolUseId="tool-3"
        isExecuting
        subagentPreviewMessages={[
          {
            id: "preview-1",
            type: "tool_use",
            name: "Grep",
            input: { pattern: "MESSAGE_COLUMN_MAX_WIDTH" },
          },
          {
            id: "preview-2",
            type: "text",
            content: "Found the width constant usage",
          },
        ]}
        onExpandSubagent={vi.fn()}
      />
    );

    expect(screen.queryByText("Subagent activity")).not.toBeInTheDocument();
    expect(screen.getByText("Grep")).toBeInTheDocument();
    expect(screen.getAllByText("Found the width constant usage").length).toBeGreaterThan(0);
  });

  test("shows only the latest five running preview rows", async () => {
    const { rerender } = render(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Research message width",
          subagent_type: "Explore",
        }}
        toolUseId="tool-preview-window"
        isExecuting
        subagentPreviewMessages={Array.from({ length: 7 }, (_, index) => ({
          id: `preview-${index + 1}`,
          type: "text",
          content: `preview event ${index + 1}`,
        }))}
        onExpandSubagent={vi.fn()}
      />
    );

    const preview = screen.getByTestId("subagent-preview");
    expect(preview).toHaveClass("overflow-hidden");
    expect(preview).not.toHaveClass("overflow-y-auto");
    expect(preview).not.toHaveClass("overflow-y-scroll");
    expect(screen.getAllByTestId("subagent-preview-slot")).toHaveLength(5);
    expect(screen.queryByText("preview event 1")).not.toBeInTheDocument();
    expect(screen.queryByText("preview event 2")).not.toBeInTheDocument();
    expect(screen.getByText("preview event 3")).toBeInTheDocument();
    expect(screen.getAllByText("preview event 7").length).toBeGreaterThan(0);

    rerender(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Research message width",
          subagent_type: "Explore",
        }}
        toolUseId="tool-preview-window"
        isExecuting
        subagentPreviewMessages={Array.from({ length: 8 }, (_, index) => ({
          id: `preview-${index + 1}`,
          type: "text",
          content: `preview event ${index + 1}`,
        }))}
        onExpandSubagent={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText("preview event 3")).not.toBeInTheDocument();
    });
    expect(screen.getAllByTestId("subagent-preview-slot")).toHaveLength(5);
    expect(screen.getByText("preview event 4")).toBeInTheDocument();
    expect(screen.getAllByText("preview event 8").length).toBeGreaterThan(0);
  });

  test("places the running preview below the task prompt inside collapsible details", () => {
    render(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Inspect prompt placement",
          subagent_type: "Explore",
          prompt: "Use the repository structure to inspect navigation.",
        }}
        isExecuting
        subagentPreviewMessages={[
          {
            id: "preview-1",
            type: "text",
            content: "Reading route files",
          },
        ]}
      />
    );

    expect(screen.getByText("Task Prompt")).toBeInTheDocument();
    expect(screen.getAllByText("Reading route files").length).toBeGreaterThan(0);

    const promptSection = screen.getByText("Task Prompt").closest("details");
    const preview = screen.getByTestId("subagent-preview");
    expect(promptSection?.compareDocumentPosition(preview)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(screen.getByTitle("Hide details"));

    expect(screen.getByTitle("Show details")).toBeInTheDocument();
  });

  test("running header shows latest subagent activity and removes it after completion", () => {
    const { rerender } = render(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Research message width",
          subagent_type: "Explore",
        }}
        isExecuting
        subagentPreviewMessages={[
          {
            id: "preview-1",
            type: "tool_use",
            name: "Grep",
            input: { pattern: "MESSAGE_COLUMN_MAX_WIDTH" },
          },
          {
            id: "preview-2",
            type: "text",
            content: "Found the width constant usage",
          },
        ]}
      />
    );

    expect(screen.getByTestId("subagent-status-loading")).toBeInTheDocument();
    expect(screen.getByTestId("subagent-status-activity")).toHaveTextContent("Found the width constant usage");
    expect(screen.getAllByText("Found the width constant usage").length).toBeGreaterThan(0);
    expect(screen.queryByText("Running…")).not.toBeInTheDocument();

    rerender(
      <ToolExecutionItem
        name="Agent"
        input={{
          description: "Research message width",
          subagent_type: "Explore",
        }}
        output="done"
        subagentPreviewMessages={[
          {
            id: "preview-2",
            type: "text",
            content: "Found the width constant usage",
          },
        ]}
      />
    );

    expect(screen.queryByTestId("subagent-status-loading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("subagent-status-activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Found the width constant usage")).not.toBeInTheDocument();
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });
});
