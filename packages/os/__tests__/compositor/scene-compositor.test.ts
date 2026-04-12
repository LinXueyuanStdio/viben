import { describe, it, expect, vi } from "vitest";
import { Scene, OrthographicCamera } from "three";
import { RTTPool } from "../../src/engine/rtt-pool";
import { SceneCompositor } from "../../src/compositor/scene-compositor";
import type { CompositorEvent } from "../../src/compositor/compositor-types";

function makeSceneCamera(): { scene: Scene; camera: OrthographicCamera } {
  return {
    scene: new Scene(),
    camera: new OrthographicCamera(0, 800, 0, -600, 0.1, 1000),
  };
}

describe("SceneCompositor", () => {
  it("starts in HOME mode", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    expect(compositor.mode).toBe("HOME");

    compositor.dispose();
    rttPool.dispose();
  });

  it("opens an app and transitions to FULLSCREEN", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    const { scene, camera } = makeSceneCamera();
    compositor.openApp("app1", scene, camera);

    expect(compositor.mode).toBe("FULLSCREEN");
    expect(compositor.hasApp("app1")).toBe(true);
    expect(compositor.focusedAppId).toBe("app1");

    compositor.dispose();
    rttPool.dispose();
  });

  it("closes an app and transitions to HOME if no apps remain", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    const { scene, camera } = makeSceneCamera();
    compositor.openApp("app1", scene, camera);
    compositor.closeApp("app1");

    expect(compositor.mode).toBe("HOME");
    expect(compositor.hasApp("app1")).toBe(false);
    expect(compositor.focusedAppId).toBeNull();

    compositor.dispose();
    rttPool.dispose();
  });

  it("switches to MULTITASK mode", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    const { scene, camera } = makeSceneCamera();
    compositor.openApp("app1", scene, camera);
    compositor.setMode("MULTITASK");

    expect(compositor.mode).toBe("MULTITASK");

    compositor.dispose();
    rttPool.dispose();
  });

  it("switches to SPLIT mode with two apps", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    const sc1 = makeSceneCamera();
    const sc2 = makeSceneCamera();
    compositor.openApp("app1", sc1.scene, sc1.camera);
    compositor.openApp("app2", sc2.scene, sc2.camera);

    compositor.setMode("SPLIT");

    expect(compositor.mode).toBe("SPLIT");
    expect(compositor.hasApp("app1")).toBe(true);
    expect(compositor.hasApp("app2")).toBe(true);

    compositor.dispose();
    rttPool.dispose();
  });

  it("fires mode-change event", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    const events: CompositorEvent[] = [];
    compositor.onEvent((evt) => events.push(evt));

    const { scene, camera } = makeSceneCamera();
    compositor.openApp("app1", scene, camera);

    // openApp fires mode-change from HOME -> FULLSCREEN
    const modeChangeEvent = events.find(
      (e) => e.type === "mode-change" && e.mode === "FULLSCREEN",
    );
    expect(modeChangeEvent).toBeDefined();
    expect(modeChangeEvent!.prevMode).toBe("HOME");
    expect(modeChangeEvent!.mode).toBe("FULLSCREEN");

    compositor.dispose();
    rttPool.dispose();
  });

  it("disposes all resources", () => {
    const rttPool = new RTTPool();
    const compositor = new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });

    const { scene, camera } = makeSceneCamera();
    compositor.openApp("app1", scene, camera);

    expect(compositor.hasApp("app1")).toBe(true);

    compositor.dispose();

    expect(compositor.hasApp("app1")).toBe(false);
    expect(compositor.focusedAppId).toBeNull();

    rttPool.dispose();
  });
});
