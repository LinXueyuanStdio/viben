// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MessageItem } from "../message-item";
import type { TaskPlan } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

function buildPlan(approvalStatus: TaskPlan["approvalStatus"]): TaskPlan {
  return {
    goal: "Ship the feature",
    approvalStatus,
    steps: [
      { id: "1", description: "Inspect current code", status: "pending" },
      { id: "2", description: "Implement change", status: "pending" },
      { id: "3", description: "Run tests", status: "pending" },
      { id: "4", description: "Verify build", status: "pending" },
    ],
  };
}

describe("PlanSummary", () => {
  test("renders approved historical plans without action buttons", () => {
    render(
      <MessageItem
        message={{ type: "plan", plan: buildPlan("approved") }}
        onApprovePlan={vi.fn()}
        onRejectPlan={vi.fn()}
        isPlanPending
      />
    );

    expect(screen.getByText("Execution Plan")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });

  test("renders rejected historical plans without action buttons", () => {
    render(<MessageItem message={{ type: "plan", plan: buildPlan("rejected") }} />);

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });
});
