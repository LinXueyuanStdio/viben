/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageAiCreateCompact } from "../page-ai-create-compact";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@viben/chat", () => ({
  ChatInput: ({
    value,
    onCancel,
  }: {
    value: string;
    onCancel?: () => void;
  }) => (
    <div>
      <input value={value} readOnly aria-label="compact input" />
      <button type="button" onClick={onCancel}>停止</button>
    </div>
  ),
}));

describe("PageAiCreateCompact", () => {
  it("renders creation status and handles actions", () => {
    const onStop = vi.fn();
    const onDismiss = vi.fn();

    render(
      <PageAiCreateCompact
        mode="document"
        input="写一份说明"
        onStop={onStop}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText("使用 AI 助手创建 文档 中...")).toBeTruthy();
    expect(screen.getByDisplayValue("写一份说明")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
