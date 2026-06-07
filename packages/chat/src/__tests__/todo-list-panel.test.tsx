// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TodoListPanel } from "../todo-list/todo-list-panel";
import type { AgentMessage } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string; count?: number }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

describe("TodoListPanel", () => {
  test("builds a collapsible task list from TaskCreate and TaskUpdate tool calls", () => {
    const messages: AgentMessage[] = [
      {
        id: "create-1",
        type: "tool_use",
        name: "TaskCreate",
        toolUseId: "tool-create-1",
        input: { id: "task-1", subject: "Draft workspace spec", status: "pending" },
      },
      {
        id: "update-1",
        type: "tool_use",
        name: "TaskUpdate",
        toolUseId: "tool-update-1",
        input: { id: "task-1", status: "in_progress" },
      },
      {
        id: "create-2",
        type: "tool_use",
        name: "TaskCreate",
        toolUseId: "tool-create-2",
        input: { id: "task-2", subject: "Run package tests", status: "pending" },
      },
    ];

    render(<TodoListPanel messages={messages} defaultExpanded />);

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("1 in progress")).toBeInTheDocument();
    expect(screen.getByText("Draft workspace spec")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("Run package tests")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse tasks/i }));

    expect(screen.queryByText("Draft workspace spec")).not.toBeInTheDocument();
    expect(screen.getByText("2 tasks")).toBeInTheDocument();
  });

  test("uses TodoList tool snapshots as the authoritative list", () => {
    const messages: AgentMessage[] = [
      {
        id: "create-1",
        type: "tool_use",
        name: "TaskCreate",
        input: { id: "stale-task", subject: "Stale task", status: "pending" },
      },
      {
        id: "todo-list-1",
        type: "tool_use",
        name: "TodoList",
        toolUseId: "todo-list-call",
        input: {
          todos: [
            { id: "a", content: "Implement parser", status: "completed" },
            { id: "b", content: "Review UI states", status: "in_progress" },
          ],
        },
      },
    ];

    render(<TodoListPanel messages={messages} defaultExpanded />);

    expect(screen.getByText("Implement parser")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("Review UI states")).toBeInTheDocument();
    expect(screen.queryByText("Stale task")).not.toBeInTheDocument();
  });

  test("reads TodoList snapshots from a matching tool_result when output is not merged", () => {
    const messages: AgentMessage[] = [
      {
        id: "todo-list-1",
        type: "tool_use",
        name: "TodoList",
        toolUseId: "todo-list-call",
        input: {},
      },
      {
        id: "todo-result-1",
        type: "tool_result",
        toolUseId: "todo-list-call",
        output: JSON.stringify({
          todos: [
            { id: "from-result", content: "Read result snapshot", status: "pending" },
          ],
        }),
      },
    ];

    render(<TodoListPanel messages={messages} defaultExpanded />);

    expect(screen.getByText("Read result snapshot")).toBeInTheDocument();
  });

  test("applies TaskUpdate from messageUpdates when deriving the current task list", () => {
    const messages: AgentMessage[] = [
      {
        id: "create-1",
        type: "tool_use",
        name: "TaskCreate",
        toolUseId: "tool-create-1",
        input: { id: "task-1", subject: "Wire lifted state", status: "pending" },
      },
      {
        id: "update-1",
        type: "tool_use",
        name: "TaskUpdate",
        toolUseId: "tool-update-1",
        input: { id: "task-1", status: "pending" },
      },
    ];

    render(
      <TodoListPanel
        messages={messages}
        messageUpdates={{
          "update-1": {
            input: { id: "task-1", status: "completed" },
          },
        }}
        defaultExpanded
      />
    );

    expect(screen.getByText("Wire lifted state")).toBeInTheDocument();
    expect(screen.getByText("1 completed")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });

  test("assigns sequential string ids to TaskCreate calls before applying TaskUpdate", () => {
    const messages: AgentMessage[] = [
      {
        id: "create-1",
        type: "tool_use",
        name: "TaskCreate",
        toolUseId: "tool-create-1",
        input: {
          subject: "Create 4 granular hooks from usePageTabs",
          description: "Split use-page-tabs.ts into granular hooks.",
        },
      },
      {
        id: "create-result-1",
        type: "tool_result",
        toolUseId: "tool-create-1",
        output: "Task created successfully",
      },
      {
        id: "create-2",
        type: "tool_use",
        name: "TaskCreate",
        toolUseId: "tool-create-2",
        input: {
          subject: "Update GlobalTabBar consumers",
        },
      },
      {
        id: "update-1",
        type: "tool_use",
        name: "TaskUpdate",
        toolUseId: "tool-update-1",
        input: { taskId: "1", status: "in_progress" },
      },
      {
        id: "update-2",
        type: "tool_use",
        name: "TaskUpdate",
        toolUseId: "tool-update-2",
        input: { taskId: "2", status: "completed" },
      },
      {
        id: "update-result-1",
        type: "tool_result",
        toolUseId: "tool-update-1",
        output: "Updated task #1 status",
      },
    ];

    render(<TodoListPanel messages={messages} defaultExpanded />);

    expect(screen.getByText("Create 4 granular hooks from usePageTabs")).toBeInTheDocument();
    expect(screen.getByText("1 in progress")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("Update GlobalTabBar consumers")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.queryByText("pending")).not.toBeInTheDocument();
  });
});
