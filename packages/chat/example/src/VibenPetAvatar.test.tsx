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
      duration: 0.9,
      root: { y: [0, -0.8, 0], rotate: [-1, -2, -1] },
      torso: { scaleY: [1, 1.03, 0.995, 1] },
      head: { y: [0, -1, 0] },
      rightFoot: { y: [0, -2, 0], rotate: [0, 5, 0] },
      tail: { rotate: [-3, 5, -5, -3] },
      status: { scale: [0.9, 1.22, 0.9] },
    });

    expect(getPetMotionPreset("review")).toMatchObject({
      loop: true,
      duration: 1.4,
      root: { x: [-0.5, 0.5, -0.5], rotate: [-1, 1, -1] },
      head: { rotate: [-3, 2, -2, -3], y: [1, 0, 1] },
      face: { x: [-0.8, 0.8, -0.8] },
      rightHand: { rotate: [6, 14, 8, 11, 6], y: [-1, -2, -1] },
    });
  });

  test("keeps idle breathing on body parts instead of visible whole-avatar floating", () => {
    expect(getPetMotionPreset("idle")).toMatchObject({
      loop: true,
      duration: 3.2,
      root: { y: [0, -0.4, 0] },
      torso: { scaleY: [1, 1.025, 1], scaleX: [1, 0.99, 1] },
      head: { y: [0, -0.5, 0] },
      tail: { rotate: [12, 17, 9, 12] },
    });
  });

  test("failed and waving motions are not infinite body shakes", () => {
    expect(getPetMotionPreset("failed")).toMatchObject({
      loop: false,
      duration: 0.5,
      root: { x: [0, -2, 2, -0.5, 0], y: [0, 2.5, 2] },
      head: { y: [0, 3, 2], rotate: [0, -5, -3] },
      tail: { rotate: [0, -24, -16], y: [0, 3, 2] },
    });

    expect(getPetMotionPreset("waving")).toMatchObject({
      loop: false,
      duration: 0.72,
      root: { x: [0, -1.2, -0.8, 0], rotate: [0, -2.5, -1, 0] },
      rightHand: { rotate: [-12, 24, -8, 20, -4, 14], y: [0, -4, -2] },
      tail: { rotate: [14, 4, 20, 10, 16] },
    });
  });

  test("dynamic avatar exposes articulated motion layers", () => {
    render(<VibenPetAvatar state="review" interaction="idle" />);

    expect(screen.getByTestId("pet-root-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-torso-layer")).toBeInTheDocument();
    expect(screen.getByTestId("pet-head-layer")).toBeInTheDocument();
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
