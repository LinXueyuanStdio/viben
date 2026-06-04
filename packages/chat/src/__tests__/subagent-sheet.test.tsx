import "@testing-library/jest-dom/vitest";
// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { SubagentSheet } from "../subagent-sheet";
import type { AgentMessage, LoadSubagentDetails } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, optionsOrFallback?: string | { defaultValue?: string; count?: number }) => {
      if (typeof optionsOrFallback === "string") return optionsOrFallback;
      return optionsOrFallback?.defaultValue || _key;
    },
  }),
}));

describe("SubagentSheet", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  test("loads subagent details from an external provider when opened without messages", async () => {
    const messages: AgentMessage[] = [
      { id: "m1", type: "text", content: "loaded transcript" },
    ];
    const loadSubagentDetails: LoadSubagentDetails = vi.fn(async () => ({
      title: "Loaded subagent",
      subagentType: "explorer",
      messages,
    }));

    render(
      <SubagentSheet
        open
        onClose={vi.fn()}
        title="Subagent"
        messages={[]}
        context={{ subagentId: "agent-1", toolUseId: "tool-1" }}
        loadSubagentDetails={loadSubagentDetails}
      />
    );

    expect(screen.getByText("Loading subagent…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("loaded transcript")).toBeInTheDocument();
    });

    expect(screen.getByText("Loaded subagent")).toBeInTheDocument();
    expect(screen.getByText("explorer")).toBeInTheDocument();
    expect(loadSubagentDetails).toHaveBeenCalledWith({
      subagentId: "agent-1",
      toolUseId: "tool-1",
    });
  });
});
