/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageTemplateDialog } from "../page-template-dialog";
import type { PageTemplate } from "@/lib/gateway/types/page";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) => opts ? (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts[k] ?? `{{${k}}}`)) : (fallback ?? key),
  }),
  initReactI18next: {
    type: "3rdParty" as const,
    init: () => {},
  },
}));

const templates: PageTemplate[] = [
  {
    id: "markdown-docs",
    name: "Markdown Documentation",
    description: "Documentation page",
    type: "markdown",
    default_config: {},
    source: "builtin",
  },
  {
    id: "custom-plan",
    name: "Project Plan",
    description: "Plan template",
    type: "markdown",
    default_config: {},
    source: "custom",
  },
];

describe("PageTemplateDialog", () => {
  it("filters and applies templates", () => {
    const onApplyTemplate = vi.fn();

    render(
      <PageTemplateDialog
        open
        templates={templates}
        onOpenChange={vi.fn()}
        onApplyTemplate={onApplyTemplate}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("搜索模板"), {
      target: { value: "plan" },
    });

    expect(screen.getByText("Project Plan")).toBeTruthy();
    expect(screen.queryByText("Markdown Documentation")).toBeNull();

    fireEvent.click(screen.getByText("Project Plan"));
    expect(onApplyTemplate).toHaveBeenCalledWith("custom-plan");
  });
});
