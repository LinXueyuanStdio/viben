// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { VibenPetAvatar, getPetLocalMotion, getPetStateTransitionKey } from "./VibenPetAvatar";

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

  test("defines nonlinear local motion beyond whole-avatar transform", () => {
    expect(getPetLocalMotion("waiting")).toMatchObject({
      bodyPath: { d: expect.arrayContaining(["M31 33 L40 57 L49 33"]) },
      leftBracket: { d: expect.arrayContaining(["M18 31 L7 22 L25 25"]) },
      rightBracket: { d: expect.arrayContaining(["M62 31 L73 22 L55 25"]) },
      eyes: { d: expect.arrayContaining(["M27 40 H35"]) },
      mouth: { d: expect.arrayContaining(["M32 57 Q40 53 48 57"]) },
    });

    expect(getPetLocalMotion("failed")).toMatchObject({
      leftBracket: { d: expect.arrayContaining(["M18 31 L10 18 L25 27"]) },
      rightBracket: { d: expect.arrayContaining(["M62 31 L70 18 L55 27"]) },
      status: { cx: expect.arrayContaining([59, 63, 61]) },
    });
  });
});
