import { describe, it, expect, vi } from "vitest";
import { Vector2 } from "three";
import { GestureRouter } from "../../src/compositor/gesture-router";
import type { GestureEvent } from "../../src/types";
import type { SystemGestureEvent } from "../../src/compositor/gesture-router";

function makeGesture(overrides: Partial<GestureEvent>): GestureEvent {
  return {
    type: "swipe",
    startPosition: new Vector2(0, 0),
    position: new Vector2(0, 0),
    delta: new Vector2(0, 0),
    velocity: new Vector2(0, 0),
    duration: 100,
    domEvent: new PointerEvent("pointerup"),
    ...overrides,
  };
}

describe("GestureRouter", () => {
  it("intercepts bottom-swipe-up as 'home'", () => {
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    router.onSystemGesture(handler);

    const gesture = makeGesture({
      startPosition: new Vector2(400, 590),
      position: new Vector2(400, 500),
      delta: new Vector2(0, -90),
      direction: "up",
    });

    const consumed = router.route(gesture);

    expect(consumed).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const event: SystemGestureEvent = handler.mock.calls[0][0];
    expect(event.action).toBe("home");
    expect(event.gesture).toBe(gesture);

    router.dispose();
  });

  it("intercepts top-right swipe-down as 'control-center'", () => {
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    router.onSystemGesture(handler);

    const gesture = makeGesture({
      startPosition: new Vector2(750, 10),
      position: new Vector2(750, 100),
      delta: new Vector2(0, 90),
      direction: "down",
    });

    const consumed = router.route(gesture);

    expect(consumed).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const event: SystemGestureEvent = handler.mock.calls[0][0];
    expect(event.action).toBe("control-center");
    expect(event.gesture).toBe(gesture);

    router.dispose();
  });

  it("intercepts left-edge swipe-right as 'back'", () => {
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    router.onSystemGesture(handler);

    const gesture = makeGesture({
      startPosition: new Vector2(8, 300),
      position: new Vector2(200, 300),
      delta: new Vector2(192, 0),
      direction: "right",
    });

    const consumed = router.route(gesture);

    expect(consumed).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    const event: SystemGestureEvent = handler.mock.calls[0][0];
    expect(event.action).toBe("back");
    expect(event.gesture).toBe(gesture);

    router.dispose();
  });

  it("passes through non-system gestures (swipe in center of screen)", () => {
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    router.onSystemGesture(handler);

    const gesture = makeGesture({
      startPosition: new Vector2(400, 300),
      position: new Vector2(400, 200),
      delta: new Vector2(0, -100),
      direction: "up",
    });

    const consumed = router.route(gesture);

    expect(consumed).toBe(false);
    expect(handler).not.toHaveBeenCalled();

    router.dispose();
  });

  it("passes through taps even in system gesture zones", () => {
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    router.onSystemGesture(handler);

    const gesture = makeGesture({
      type: "tap",
      startPosition: new Vector2(400, 590),
      position: new Vector2(400, 590),
      delta: new Vector2(0, 0),
      direction: undefined,
    });

    const consumed = router.route(gesture);

    expect(consumed).toBe(false);
    expect(handler).not.toHaveBeenCalled();

    router.dispose();
  });
});
