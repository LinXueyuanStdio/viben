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
        output="done"
        subagentMessages={subagentMessages}
        onExpandSubagent={onExpandSubagent}
      />
    );

    fireEvent.click(screen.getByTitle("Open in side panel"));

    expect(onExpandSubagent).toHaveBeenCalledWith(
      "Inspect workspace",
      "explorer",
      subagentMessages
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
});
