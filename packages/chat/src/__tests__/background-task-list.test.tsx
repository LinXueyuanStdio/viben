// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { BackgroundTaskList } from "../background-task-list/background-task-list";
import type { AgentMessage } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; count?: number }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

describe("BackgroundTaskList", () => {
  test("renders running associated tasks with description, runtime, and usage", () => {
    render(
      <BackgroundTaskList
        tasks={[
          {
            id: "cron-1",
            kind: "cron",
            description: "Refresh provider catalog",
            status: "running",
            startedAt: 1_700_000_000_000,
            now: 1_700_000_125_000,
            usage: { inputTokens: 1200, outputTokens: 240, costUsd: 0.034 },
          },
          {
            id: "bash-1",
            kind: "bash",
            description: "pnpm test packages/chat",
            status: "running",
            elapsedMs: 3_000,
            usageLabel: "1 command",
          },
        ]}
      />
    );

    expect(screen.getByText("Background tasks")).toBeInTheDocument();
    expect(screen.getByText("Refresh provider catalog")).toBeInTheDocument();
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
    expect(screen.getByText("1.4k tokens · $0.034")).toBeInTheDocument();
    expect(screen.getByText("pnpm test packages/chat")).toBeInTheDocument();
    expect(screen.getByText("3s")).toBeInTheDocument();
    expect(screen.getByText("1 command")).toBeInTheDocument();
  });

  test("opens a right-side detail drawer when a task row is clicked", () => {
    const messages: AgentMessage[] = [
      { id: "m1", type: "text", content: "Checking chat package tests" },
    ];

    render(
      <BackgroundTaskList
        tasks={[
          {
            id: "agent-1",
            kind: "agent",
            description: "Audit chat UI components",
            status: "running",
            elapsedMs: 15_000,
            usageLabel: "2 tools",
            messages,
            details: "The agent is reviewing component contracts.",
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /audit chat ui components/i }));

    const panel = screen.getByTestId("background-task-sheet-panel");
    expect(panel).toBeInTheDocument();
    expect(within(panel).getByText("Audit chat UI components")).toBeInTheDocument();
    expect(within(panel).getByText("The agent is reviewing component contracts.")).toBeInTheDocument();
    expect(within(panel).getByText("Checking chat package tests")).toBeInTheDocument();
  });

  test("can derive running Agent, Task, Bash, and Cron tools from messages", () => {
    const messages: AgentMessage[] = [
      {
        id: "agent-tool",
        type: "tool_use",
        name: "Agent",
        toolUseId: "agent-tool-id",
        input: { description: "Explore package boundaries" },
        timestamp: 1_700_000_000_000,
      },
      {
        id: "bash-tool",
        type: "tool_use",
        name: "Bash",
        toolUseId: "bash-tool-id",
        input: { command: "pnpm --filter @viben/chat test" },
        timestamp: 1_700_000_005_000,
      },
      {
        id: "task-tool",
        type: "tool_use",
        name: "Task",
        toolUseId: "task-tool-id",
        input: { description: "Implement focused tests" },
        timestamp: 1_700_000_008_000,
      },
      {
        id: "cron-tool",
        type: "tool_use",
        name: "Cron",
        toolUseId: "cron-tool-id",
        input: { description: "Nightly cleanup" },
        timestamp: 1_700_000_010_000,
      },
      {
        id: "done-result",
        type: "tool_result",
        toolUseId: "bash-tool-id",
        output: "ok",
      },
    ];

    render(<BackgroundTaskList messages={messages} now={1_700_000_065_000} />);

    expect(screen.getByText("Explore package boundaries")).toBeInTheDocument();
    expect(screen.getByText("1m 5s")).toBeInTheDocument();
    expect(screen.getByText("Implement focused tests")).toBeInTheDocument();
    expect(screen.getByText("Nightly cleanup")).toBeInTheDocument();
    expect(screen.queryByText("pnpm --filter @viben/chat test")).not.toBeInTheDocument();
  });
});
