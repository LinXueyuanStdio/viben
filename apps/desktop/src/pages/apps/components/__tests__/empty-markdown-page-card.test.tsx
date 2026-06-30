/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyMarkdownPageCard } from "../empty-markdown-page-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) => opts ? (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts[k] ?? `{{${k}}}`)) : (fallback ?? key),
  }),
  initReactI18next: {
    type: "3rdParty" as const,
    init: () => {},
  },
}));

vi.mock("@viben/chat", () => ({
  ChatInput: ({
    value,
    onValueChange,
    onSend,
    placeholder,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    onSend: (content: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(event) => onValueChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSend(value);
        }
      }}
    />
  ),
}));

describe("EmptyMarkdownPageCard", () => {
  it("renders the empty page actions", () => {
    render(<EmptyMarkdownPageCard />);

    expect(screen.getByRole("button", { name: "开始" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "从模板创建" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /导入新页面/ })).toBeTruthy();
    expect(screen.getByText("使用 AI 助手创建")).toBeTruthy();
  });

  it("calls action callbacks", () => {
    const onStartEditing = vi.fn();
    const onCreateFromTemplate = vi.fn();
    const onImportPage = vi.fn();

    render(
      <EmptyMarkdownPageCard
        onStartEditing={onStartEditing}
        onCreateFromTemplate={onCreateFromTemplate}
        onImportPage={onImportPage}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    fireEvent.click(screen.getByRole("button", { name: "从模板创建" }));
    fireEvent.click(screen.getByRole("button", { name: /导入新页面/ }));

    expect(onStartEditing).toHaveBeenCalledTimes(1);
    expect(onCreateFromTemplate).toHaveBeenCalledTimes(1);
    expect(onImportPage).toHaveBeenCalledTimes(1);
  });

  it("submits a prompt for the selected AI creation mode", () => {
    const onAiCreate = vi.fn();
    render(<EmptyMarkdownPageCard onAiCreate={onAiCreate} />);

    fireEvent.click(screen.getByRole("button", { name: "静态网页" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "做一个产品介绍页" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onAiCreate).toHaveBeenCalledWith(
      expect.stringContaining("create Static Page"),
      "static"
    );
  });
});
