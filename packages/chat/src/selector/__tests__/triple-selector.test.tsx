// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { TripleSelector } from "../triple-selector";

describe("TripleSelector", () => {
  test("opens compact popover above the trigger", async () => {
    render(
      <TripleSelector
        compact
        firstOptions={[{ id: "agent", label: "Agent" }]}
        firstLabel="Agent"
        secondOptions={[{ id: "provider", label: "Provider" }]}
        secondLabel="Provider"
        thirdOptions={[{ id: "model", label: "Model" }]}
        thirdLabel="Model"
        value={{ first: "agent", second: "provider", third: "model" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /agent \/ provider \/ model/i }));

    expect(await screen.findByRole("dialog")).toHaveAttribute("data-side", "top");
  });
});
