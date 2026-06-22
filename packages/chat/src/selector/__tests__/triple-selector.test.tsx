// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { TripleSelector } from "../triple-selector";

describe("TripleSelector", () => {
  test("opens compact popover above the trigger", async () => {
    render(
      <TripleSelector
        compact
        firstOptions={[{ id: "agent", label: "Agent", description: "Claude Code", badge: "workspace" }]}
        firstLabel="Agent"
        secondOptions={[{ id: "provider", label: "Provider", description: "anthropic" }]}
        secondLabel="Provider"
        thirdOptions={[{ id: "model", label: "Model" }]}
        thirdLabel="Model"
        value={{ first: "agent", second: "provider", third: "model" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /agent \/ provider \/ model/i }));

    expect(await screen.findByRole("dialog")).toHaveAttribute("data-side", "top");
    expect(screen.getByRole("button", { name: "Agent Claude Code workspace" })).toHaveAttribute(
      "title",
      "Agent Claude Code workspace"
    );
    expect(screen.getByRole("button", { name: "Provider anthropic" })).toHaveAttribute(
      "title",
      "Provider anthropic"
    );
    expect(screen.getByRole("button", { name: "Model" })).toHaveAttribute("title", "Model");

    fireEvent.mouseOver(screen.getByRole("button", { name: "Agent Claude Code workspace" }));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Agent Claude Code workspace");
    });
  });
});
