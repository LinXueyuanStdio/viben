import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MessageItem } from "../message-item";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("MessageItem layout", () => {
  test("renders user messages with a left avatar and left-aligned content", () => {
    const { container } = render(
      <MessageItem
        message={{ type: "user", content: "hello from user" }}
        maxWidth="760px"
      />
    );

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
    });

    const row = screen.getByText("hello from user").closest(".flex.gap-3");
    expect(row?.firstElementChild).toContainElement(
      container.querySelector("svg")
    );
    expect(container.querySelector(".justify-end")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-br-md")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-tl-md")).toBeInTheDocument();
  });
});
