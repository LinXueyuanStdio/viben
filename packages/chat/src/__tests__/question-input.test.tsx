// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { QuestionInput } from "../question-input";
import type { PendingQuestion } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

const buildQuestions = (count: number): PendingQuestion => ({
  id: "q1",
  questions: Array.from({ length: count }, (_, index) => ({
    header: `Q${index + 1}`,
    question: `Question ${index + 1}?`,
    options: [
      { label: `Answer ${index + 1}A`, description: "First option" },
      { label: `Answer ${index + 1}B`, description: "Second option" },
    ],
    multiSelect: false,
  })),
});

describe("QuestionInput", () => {
  test("renders up to two questions together", () => {
    render(<QuestionInput questions={buildQuestions(2)} onSubmit={vi.fn()} />);

    expect(screen.getByText("Question 1?")).toBeInTheDocument();
    expect(screen.getByText("Question 2?")).toBeInTheDocument();
    expect(screen.queryByText("1 / 2")).not.toBeInTheDocument();
  });

  test("paginates more than two questions one per page", () => {
    render(<QuestionInput questions={buildQuestions(3)} onSubmit={vi.fn()} />);

    expect(screen.getByText("Question 1?")).toBeInTheDocument();
    expect(screen.queryByText("Question 2?")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Next question"));

    expect(screen.queryByText("Question 1?")).not.toBeInTheDocument();
    expect(screen.getByText("Question 2?")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Previous question"));

    expect(screen.getByText("Question 1?")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  test("keeps paged answers by original question index when submitting", () => {
    const onSubmit = vi.fn();
    render(<QuestionInput questions={buildQuestions(3)} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText("Answer 1A"));
    fireEvent.click(screen.getByLabelText("Next question"));
    fireEvent.click(screen.getByText("Answer 2A"));
    fireEvent.click(screen.getByLabelText("Next question"));
    fireEvent.click(screen.getByText("Answer 3A"));
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      "0": ["Answer 1A"],
      "1": ["Answer 2A"],
      "2": ["Answer 3A"],
    });
  });
});
