import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MessageList } from "../message-list";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === "string") return fallback;
      return fallback?.defaultValue || key;
    },
  }),
}));

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("MessageList width", () => {
  test("wraps regular messages in a centered max-width row shell", () => {
    render(
      <MessageList
        messages={[{ id: "m1", type: "text", content: "assistant message" }]}
        maxMessageWidth="760px"
      />
    );

    const rowShell = screen.getByText("assistant message").closest("[data-message-width-shell='true']");
    expect(rowShell).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });

  test("wraps task groups in the same centered max-width row shell", () => {
    render(
      <MessageList
        messages={[
          {
            id: "tool-1",
            type: "tool_use",
            name: "Read",
            toolUseId: "read-1",
            input: { file_path: "/root/viben/package.json" },
          },
          {
            id: "result-1",
            type: "tool_result",
            toolUseId: "read-1",
            output: "file output",
          },
        ]}
        maxMessageWidth="760px"
      />
    );

    const rowShell = screen.getByText("Read 1 files").closest("[data-message-width-shell='true']");
    expect(rowShell).toHaveStyle({
      width: "100%",
      maxWidth: "min(100%, 760px)",
      marginLeft: "auto",
      marginRight: "auto",
    });
  });
});
