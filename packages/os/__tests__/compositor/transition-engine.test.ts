import { describe, it, expect, vi } from "vitest";
import { WebGLRenderTarget, Scene, OrthographicCamera } from "three";
import { AppSlot } from "../../src/compositor/app-slot";
import { TransitionEngine } from "../../src/compositor/transition-engine";
import type { AppSlotConfig, AppSlotState } from "../../src/compositor/compositor-types";

function makeSlot(id: string, state?: Partial<AppSlotState>): AppSlot {
  const defaults: AppSlotState = {
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    opacity: 1,
    radius: 0,
    zIndex: 2,
    visible: true,
  };
  const config: AppSlotConfig = {
    id,
    renderTarget: new WebGLRenderTarget(800, 600),
    scene: new Scene(),
    camera: new OrthographicCamera(0, 800, 0, -600, 0.1, 1000),
    state: { ...defaults, ...state },
  };
  return new AppSlot(config);
}

function converge(engine: TransitionEngine, frames: number): void {
  const dt = 1 / 60;
  for (let i = 0; i < frames; i++) {
    engine.update(dt);
  }
}

describe("TransitionEngine", () => {
  it("transitions a slot to FULLSCREEN layout", () => {
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    const slot = makeSlot("app-1", { x: 100, y: 100, width: 400, height: 300 });

    engine.transition("FULLSCREEN", [slot], "app-1");

    converge(engine, 300);

    expect(slot.mesh.scale.x).toBeCloseTo(800, 0);
    expect(slot.mesh.scale.y).toBeCloseTo(600, 0);
    expect(engine.isAnimating).toBe(false);
  });

  it("transitions to HOME making slots invisible", () => {
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    const slot = makeSlot("app-1");

    engine.transition("HOME", [slot]);

    converge(engine, 300);

    expect(slot.mesh.visible).toBe(false);
    expect(engine.isAnimating).toBe(false);
  });

  it("transitions to SPLIT with two slots", () => {
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    const slot1 = makeSlot("app-1");
    const slot2 = makeSlot("app-2");

    engine.transition("SPLIT", [slot1, slot2]);

    converge(engine, 300);

    expect(slot1.mesh.scale.x).toBeCloseTo(400, 0);
    expect(slot2.mesh.scale.x).toBeCloseTo(400, 0);
  });

  it("fires onTransitionEnd callback after convergence", () => {
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    const slot = makeSlot("app-1", { x: 100, y: 100, width: 400, height: 300 });
    const handler = vi.fn();

    engine.onTransitionEnd(handler);
    engine.transition("FULLSCREEN", [slot], "app-1");

    converge(engine, 300);

    expect(handler).toHaveBeenCalled();
  });

  it("reports isAnimating during transition", () => {
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    const slot = makeSlot("app-1", { x: 100, y: 100, width: 400, height: 300 });

    engine.transition("FULLSCREEN", [slot], "app-1");

    expect(engine.isAnimating).toBe(true);

    converge(engine, 300);

    expect(engine.isAnimating).toBe(false);
  });
});
