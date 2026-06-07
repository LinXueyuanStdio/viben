// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { VibenPetAvatar, getPetMotionPreset, getPetStateTransitionKey } from "./VibenPetAvatar";

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

  test("defines motion presets by body part instead of path-only animation", () => {
    expect(getPetMotionPreset("waiting")).toMatchObject({
      loop: true,
      duration: 0.95,
      root: { y: [0, -3, 0], scale: [1, 1.025, 1] },
      leftHand: { rotate: [4, -5, 4] },
      rightHand: { rotate: [-4, 5, -4] },
      tail: { rotate: [-3, 3, -3] },
      status: { scale: [0.9, 1.22, 0.9] },
    });

    expect(getPetMotionPreset("review")).toMatchObject({
      loop: true,
      face: { x: [-0.8, 0.8, -0.8] },
      rightHand: { rotate: [-6, 8, -3, 0] },
    });
  });

  test("failed and waving motions are not infinite body shakes", () => {
    expect(getPetMotionPreset("failed")).toMatchObject({
      loop: false,
      root: { x: [0, -3, 3, -1, 0], y: [0, 2, 1.5] },
      tail: { rotate: [0, -18, -14] },
    });

    expect(getPetMotionPreset("waving")).toMatchObject({
      loop: false,
      rightHand: { rotate: [-12, 18, -8, 14, 0] },
    });
  });

  test("dynamic avatar exposes articulated motion layers", () => {
    render(<VibenPetAvatar state="review" interaction="idle" />);

    expect(screen.getByTestId("pet-root-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-torso-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-left-hand-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-right-hand-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-left-foot-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-right-foot-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-face-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-tail-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-status-layer")).toBeInTheDocument();
  });

  test("can render a static state avatar without dynamic local motion", () => {
    render(<VibenPetAvatar kind="static" state="review" interaction="waiting" />);

    expect(screen.getByTestId("viben-pet-avatar")).toHaveAttribute("data-avatar-kind", "static");
    expect(screen.getByTestId("viben-pet-avatar")).not.toHaveAttribute("data-state-transition");
  });
});
