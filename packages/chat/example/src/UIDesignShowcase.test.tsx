// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CommandQueueItem } from "@viben/chat";
import { UIShowCasesPage } from "./pages/UIShowCasesPage";

vi.mock("@viben/chat", () => ({
  BackgroundTaskList: () => <div data-testid="background-task-list" />,
  ContextDetailsPopover: () => <div data-testid="context-details-popover" />,
  SkillsConfigPopover: () => <div data-testid="skills-config-popover" />,
  ToolExecutionItem: () => <div data-testid="tool-execution-item" />,
  ToolsConfigPopover: () => <div data-testid="tools-config-popover" />,
  TodoListPanel: () => <div data-testid="todo-list-panel" />,
  getModelIcon: () => <span data-testid="model-icon" />,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      const value = fallback ?? key;
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? `{{${name}}}`));
    },
  }),
}));

const queueItems: CommandQueueItem[] = [
  { id: "cmd-1", content: "Run test", createdAt: Date.now() },
  { id: "cmd-2", content: "Update docs", createdAt: Date.now() },
];

describe("UIShowCasesPage", () => {
  test("renders the standalone UI design showcase outside App", () => {
    render(
      <UIShowCasesPage
        isChatAppFull={false}
        activeComponentLabel={null}
        componentDemoItems={[
          {
            id: "plan",
            label: "Plan approval",
            description: "Approval flow",
            active: false,
            onClick: vi.fn(),
          },
        ]}
        standaloneQueueItems={queueItems}
        models={[{ id: "claude-opus", name: "Claude Opus" }]}
        tools={[]}
        skills={[]}
        contextBreakdown={{
          assistantProfile: 1,
          skillSettings: 1,
          historySummary: 1,
          conversationMessages: 1,
          totalContext: 4,
        }}
        showToolsPanel={false}
        showSkillsPanel={false}
        showContextPanel={false}
        onToggleToolsPanel={vi.fn()}
        onToggleSkillsPanel={vi.fn()}
        onToggleContextPanel={vi.fn()}
        onToggleTool={vi.fn()}
        onToggleSkill={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "UI design showcase" })).toBeInTheDocument();
    expect(screen.getAllByText("Interaction surfaces").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Plan approval").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Todo list").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Background tasks").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ToolExecutionItem (4 states)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Config Panels").length).toBeGreaterThan(0);
  });
});
