import { describe, it, expect } from "vitest";
import { Mesh, WebGLRenderTarget, Scene, OrthographicCamera } from "three";
import { AppSlot } from "../../src/compositor/app-slot";
import type { AppSlotConfig, AppSlotState } from "../../src/compositor/compositor-types";

function makeConfig(state?: Partial<AppSlotState>): AppSlotConfig {
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
  return {
    id: "test-app",
    renderTarget: new WebGLRenderTarget(800, 600),
    scene: new Scene(),
    camera: new OrthographicCamera(-400, 400, 300, -300, 0.1, 100),
    state: { ...defaults, ...state },
  };
}

describe("AppSlot", () => {
  it("creates a Mesh textured with the RTT", () => {
    const config = makeConfig();
    const slot = new AppSlot(config);

    expect(slot.mesh).toBeInstanceOf(Mesh);
    expect(slot.material.map).toBeDefined();
    expect(slot.material.map).toBe(config.renderTarget.texture);
  });

  it("applies initial state to mesh transform", () => {
    const slot = new AppSlot(makeConfig({ width: 800, height: 600, zIndex: 2 }));

    expect(slot.mesh.scale.x).toBe(800);
    expect(slot.mesh.scale.y).toBe(600);
    expect(slot.mesh.position.z).toBe(2);
  });

  it("animates to new target state via update()", () => {
    const slot = new AppSlot(makeConfig({ width: 800 }));

    slot.setTargetState({ width: 400 });

    for (let i = 0; i < 300; i++) {
      slot.update(1 / 60);
    }

    expect(slot.mesh.scale.x).toBeCloseTo(400, 0);
  });

  it("reports isAnimating while springs are active", () => {
    const slot = new AppSlot(makeConfig());

    // Initially all springs are at rest (from === to)
    expect(slot.isAnimating).toBe(false);

    slot.setTargetState({ x: 500 });
    expect(slot.isAnimating).toBe(true);

    // Run enough updates for convergence
    for (let i = 0; i < 600; i++) {
      slot.update(1 / 60);
    }

    expect(slot.isAnimating).toBe(false);
  });

  it("disposes without error", () => {
    const slot = new AppSlot(makeConfig());

    expect(() => slot.dispose()).not.toThrow();
  });
});
