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
    expect(screen.getByRole("button", { name: "Agent" })).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: "Provider" })).not.toHaveAttribute("title");
    expect(screen.getByRole("button", { name: "Model" })).not.toHaveAttribute("title");

    fireEvent.mouseOver(screen.getByRole("button", { name: "Agent" }));
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Agent");
    });
  });
});
