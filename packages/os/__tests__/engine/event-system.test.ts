import { describe, it, expect, vi, beforeEach } from "vitest";
import { Object3D } from "three";
import { EventSystem } from "../../src/engine/event-system";

describe("EventSystem", () => {
  let eventSystem: EventSystem;
  beforeEach(() => { eventSystem = new EventSystem(); });

  it("registers and fires a handler", () => {
    const obj = new Object3D();
    const handler = vi.fn();
    eventSystem.on(obj, "tap", handler);
    eventSystem.dispatch(obj, "tap", null);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes a UIEvent with correct target", () => {
    const obj = new Object3D();
    const handler = vi.fn();
    eventSystem.on(obj, "tap", handler);
    eventSystem.dispatch(obj, "tap", null);
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe("tap");
    expect(event.target).toBe(obj);
  });

  it("bubbles events to parent", () => {
    const parent = new Object3D();
    const child = new Object3D();
    parent.add(child);
    const handler = vi.fn();
    eventSystem.on(parent, "tap", handler);
    eventSystem.dispatch(child, "tap", null);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].target).toBe(child);
    expect(handler.mock.calls[0][0].currentTarget).toBe(parent);
  });

  it("stopPropagation prevents bubbling", () => {
    const parent = new Object3D();
    const child = new Object3D();
    parent.add(child);
    const childHandler = vi.fn((e: any) => e.stopPropagation());
    const parentHandler = vi.fn();
    eventSystem.on(child, "tap", childHandler);
    eventSystem.on(parent, "tap", parentHandler);
    eventSystem.dispatch(child, "tap", null);
    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it("removes a handler with off()", () => {
    const obj = new Object3D();
    const handler = vi.fn();
    eventSystem.on(obj, "tap", handler);
    eventSystem.off(obj, "tap", handler);
    eventSystem.dispatch(obj, "tap", null);
    expect(handler).not.toHaveBeenCalled();
  });
});
