// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { CommandQueuePanel } from "../command-queue/command-queue-panel";
import type { CommandQueueItem } from "../command-queue/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

const items: CommandQueueItem[] = [
  { id: "1", content: "First command", createdAt: 1 },
  { id: "2", content: "Second command", createdAt: 2 },
];

const props = {
  items,
  isPaused: false,
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
};

describe("CommandQueuePanel", () => {
  test("left-aligns the full queue panel and item indexes", () => {
    const { container } = render(<CommandQueuePanel {...props} />);

    expect(container.firstElementChild).toHaveClass("text-left");

    const firstIndex = screen.getByText("1");
    expect(firstIndex).toHaveClass("text-left");
    expect(firstIndex).not.toHaveClass("text-center");
    expect(screen.getByText("First command")).toHaveClass("text-left");
  });

  test("left-aligns compact queue details", () => {
    const { container } = render(<CommandQueuePanel {...props} compact />);

    expect(container.firstElementChild).toHaveClass("text-left");

    fireEvent.click(screen.getByRole("button", { name: /queued/i }));

    const firstIndex = screen.getByText("1.");
    expect(firstIndex).toHaveClass("text-left");
    expect(screen.getByText("First command")).toHaveClass("text-left");
  });
});
