// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { VibenPetAvatar, getPetStateTransitionKey } from "./VibenPetAvatar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: Record<string, unknown>) => {
      const value = fallback ?? key;
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? `{{${name}}}`));
    },
  }),
}));

describe("VibenPetAvatar", () => {
  test("renders independently with translated state aria label", () => {
    render(<VibenPetAvatar state="review" interaction="waiting" />);

    expect(screen.getByRole("img", { name: "Viben pet Review" })).toBeInTheDocument();
  });

  test("uses pair-specific animation metadata when state changes", () => {
    const { rerender } = render(<VibenPetAvatar state="idle" interaction="idle" />);

    expect(screen.getByTestId("viben-pet-avatar")).toHaveAttribute("data-state-transition", "initial-idle");

    rerender(<VibenPetAvatar state="waiting" interaction="waiting" />);

    expect(screen.getByTestId("viben-pet-avatar")).toHaveAttribute("data-state-transition", "idle-to-waiting");

    rerender(<VibenPetAvatar state="failed" interaction="idle" />);

    expect(screen.getByTestId("viben-pet-avatar")).toHaveAttribute("data-state-transition", "waiting-to-failed");
  });

  test("exposes stable transition keys for every directed state pair", () => {
    expect(getPetStateTransitionKey("idle", "review")).toBe("idle-to-review");
    expect(getPetStateTransitionKey("review", "idle")).toBe("review-to-idle");
    expect(getPetStateTransitionKey("failed", "waving")).toBe("failed-to-waving");
  });
});
