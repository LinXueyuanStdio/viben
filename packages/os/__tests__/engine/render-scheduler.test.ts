import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RenderScheduler } from "../../src/engine/render-scheduler";

describe("RenderScheduler", () => {
  let renderFn: ReturnType<typeof vi.fn>;
  let scheduler: RenderScheduler;

  beforeEach(() => {
    renderFn = vi.fn();
    scheduler = new RenderScheduler(renderFn);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => { cb(performance.now()); return 1; });
  });

  afterEach(() => { vi.restoreAllMocks(); scheduler.dispose(); });

  it("does not render until markDirty is called", () => { expect(renderFn).not.toHaveBeenCalled(); });

  it("renders once after markDirty", () => { scheduler.markDirty(); expect(renderFn).toHaveBeenCalledTimes(1); });

  it("coalesces multiple markDirty calls into one render", () => {
    scheduler.markDirty();
    scheduler.markDirty();
    scheduler.markDirty();
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it("tracks animation count for continuous rendering", () => {
    // Check initial state before starting animation
    expect(scheduler.isAnimating).toBe(false);
    // Use a flag to prevent infinite loop in the synchronous mock
    let started = false;
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => {
      // Don't call the callback to prevent recursion; just return an id
      return 2;
    });
    scheduler.startAnimation();
    expect(scheduler.isAnimating).toBe(true);
    scheduler.stopAnimation();
    expect(scheduler.isAnimating).toBe(false);
  });

  it("multiple startAnimation calls require matching stops", () => {
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 3);
    scheduler.startAnimation();
    scheduler.startAnimation();
    scheduler.stopAnimation();
    expect(scheduler.isAnimating).toBe(true);
    scheduler.stopAnimation();
    expect(scheduler.isAnimating).toBe(false);
  });
});
