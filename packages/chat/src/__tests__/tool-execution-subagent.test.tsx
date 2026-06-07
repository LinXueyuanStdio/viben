import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ToolExecutionItem } from "../tool-execution-item";
import type { AgentMessage } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

describe("ToolExecutionItem subagent cards", () => {
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
    expect(screen.getByText("Found the width constant usage")).toBeInTheDocument();
  });
});
