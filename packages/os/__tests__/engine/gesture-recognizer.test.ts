import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GestureRecognizer } from "../../src/engine/gesture-recognizer";
import type { GestureEvent } from "../../src/types";

function makePointerEvent(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true });
}

describe("GestureRecognizer", () => {
  let canvas: HTMLCanvasElement;
  let recognizer: GestureRecognizer;
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, toJSON: () => {} }));
    recognizer = new GestureRecognizer(canvas);
    handler = vi.fn();
  });

  afterEach(() => { recognizer.dispose(); vi.useRealTimers(); });

  it("emits tap for quick press-release without movement", () => {
    recognizer.onGesture(handler);
    canvas.dispatchEvent(makePointerEvent("pointerdown", 100, 100));
    canvas.dispatchEvent(makePointerEvent("pointerup", 100, 100));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe("tap");
  });

  it("emits drag during move after threshold", () => {
    recognizer.onGesture(handler);
    canvas.dispatchEvent(makePointerEvent("pointerdown", 100, 100));
    canvas.dispatchEvent(makePointerEvent("pointermove", 120, 100));
    const dragEvents = handler.mock.calls.filter((c: any) => c[0].type === "drag");
    expect(dragEvents.length).toBeGreaterThan(0);
  });

  it("emits swipe for fast horizontal movement", () => {
    recognizer.onGesture(handler);
    canvas.dispatchEvent(makePointerEvent("pointerdown", 100, 300));
    canvas.dispatchEvent(makePointerEvent("pointermove", 300, 300));
    canvas.dispatchEvent(makePointerEvent("pointerup", 300, 300));
    const swipes = handler.mock.calls.filter((c: any) => c[0].type === "swipe");
    expect(swipes.length).toBe(1);
    expect(swipes[0][0].direction).toBe("right");
  });

  it("emits long-press after hold duration", () => {
    recognizer.onGesture(handler);
    canvas.dispatchEvent(makePointerEvent("pointerdown", 100, 100));
    vi.advanceTimersByTime(600);
    const longPress = handler.mock.calls.filter((c: any) => c[0].type === "long-press");
    expect(longPress.length).toBe(1);
  });
});
