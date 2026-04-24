# Sub 3: Scene Compositor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the layout state machine, RTT window compositing, transition animations, system gesture routing, blur effect, and multitask view for the @viben/os iPad-style compositor.

**Architecture:** SceneCompositor owns a finite state machine (HOME/FULLSCREEN/SPLIT/SLIDE_OVER/MULTITASK/CONTROL_CENTER) and manages AppSlot RTT quads via Spring-animated transitions. GestureRouter intercepts system-level gestures before they reach apps. BlurEffect provides frosted glass via dual-pass GLSL Gaussian blur. MultitaskView renders a 3D perspective card carousel with swipe-to-dismiss.

**Tech Stack:** Three.js (Mesh + MeshBasicMaterial for RTT quads, ShaderMaterial for blur), Spring animation (from ui/animation), RTTPool (from engine), GestureRecognizer (from engine), GLSL Gaussian blur shader

---

## File Structure

```
src/compositor/
  compositor-types.ts     types + CompositorMode enum + AppSlotState interface
  app-slot.ts             RTT quad mesh + Spring-animated properties
  blur-effect.ts          Dual-pass GLSL Gaussian blur (not TSL — WebGL/WebGPU dual compat)
  transition-engine.ts    Orchestrates Spring animations for mode transitions
  gesture-router.ts       System gesture interception + dispatch
  multitask-view.ts       3D perspective card carousel + swipe-to-dismiss
  scene-compositor.ts     State machine + scene graph owner
  index.ts                Barrel exports

src/types.ts              Add CompositorMode type (extend existing)

__tests__/compositor/
  app-slot.test.ts
  blur-effect.test.ts
  gesture-router.test.ts
  transition-engine.test.ts
  scene-compositor.test.ts
  multitask-view.test.ts
```

---

### Task 1: Compositor Types + AppSlot

**Files:**
- Create: `src/compositor/compositor-types.ts`
- Create: `src/compositor/app-slot.ts`
- Create: `src/compositor/index.ts` (initial — will grow)
- Create: `__tests__/compositor/app-slot.test.ts`

- [ ] **Step 1: Write compositor-types.ts**

```typescript
// src/compositor/compositor-types.ts
import type { WebGLRenderTarget, Scene, OrthographicCamera } from "three";

export type CompositorMode =
  | "HOME"
  | "FULLSCREEN"
  | "SPLIT"
  | "SLIDE_OVER"
  | "MULTITASK"
  | "CONTROL_CENTER";

export interface AppSlotState {
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  radius: number;
  zIndex: number;
  visible: boolean;
}

export interface AppSlotConfig {
  id: string;
  renderTarget: WebGLRenderTarget;
  scene: Scene;
  camera: OrthographicCamera;
  state: AppSlotState;
}

export type CompositorEventType =
  | "mode-change"
  | "app-focus"
  | "app-close"
  | "transition-start"
  | "transition-end";

export interface CompositorEvent {
  type: CompositorEventType;
  mode?: CompositorMode;
  prevMode?: CompositorMode;
  appId?: string;
}

export type CompositorEventHandler = (event: CompositorEvent) => void;
```

- [ ] **Step 2: Write failing test for AppSlot**

```typescript
// __tests__/compositor/app-slot.test.ts
import { describe, it, expect } from "vitest";
import { WebGLRenderTarget, Scene, OrthographicCamera, Mesh, MeshBasicMaterial } from "three";
import { AppSlot } from "../../src/compositor/app-slot";

describe("AppSlot", () => {
  function makeSlot(id = "test-app") {
    const rt = new WebGLRenderTarget(800, 600);
    return new AppSlot({
      id,
      renderTarget: rt,
      scene: new Scene(),
      camera: new OrthographicCamera(0, 800, 0, -600, 0.1, 1000),
      state: { x: 0, y: 0, width: 800, height: 600, opacity: 1, radius: 0, zIndex: 2, visible: true },
    });
  }

  it("creates a mesh textured with the RTT", () => {
    const slot = makeSlot();
    expect(slot.mesh).toBeInstanceOf(Mesh);
    expect((slot.mesh.material as MeshBasicMaterial).map).toBeDefined();
  });

  it("applies initial state to mesh transform", () => {
    const slot = makeSlot();
    expect(slot.mesh.scale.x).toBe(800);
    expect(slot.mesh.scale.y).toBe(600);
    expect(slot.mesh.position.z).toBe(2);
  });

  it("animates to a new target state via update()", () => {
    const slot = makeSlot();
    slot.setTargetState({ x: 0, y: 0, width: 400, height: 300, opacity: 0.5, radius: 12, zIndex: 2, visible: true });
    // Simulate many frames — Springs should converge
    for (let i = 0; i < 300; i++) slot.update(1 / 60);
    expect(slot.mesh.scale.x).toBeCloseTo(400, 0);
    expect(slot.mesh.scale.y).toBeCloseTo(300, 0);
    expect((slot.mesh.material as MeshBasicMaterial).opacity).toBeCloseTo(0.5, 1);
  });

  it("reports isAnimating while springs are active", () => {
    const slot = makeSlot();
    expect(slot.isAnimating).toBe(false);
    slot.setTargetState({ x: 100, y: 0, width: 800, height: 600, opacity: 1, radius: 0, zIndex: 2, visible: true });
    expect(slot.isAnimating).toBe(true);
    for (let i = 0; i < 300; i++) slot.update(1 / 60);
    expect(slot.isAnimating).toBe(false);
  });

  it("disposes mesh and material", () => {
    const slot = makeSlot();
    slot.dispose();
    // Should not throw
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/compositor/app-slot.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement AppSlot**

```typescript
// src/compositor/app-slot.ts
import { Mesh, PlaneGeometry, MeshBasicMaterial, DoubleSide } from "three";
import type { WebGLRenderTarget, Scene, OrthographicCamera } from "three";
import { Spring } from "../ui/animation/spring";
import type { AppSlotState, AppSlotConfig } from "./compositor-types";

const _unitPlane = new PlaneGeometry(1, 1);

/**
 * AppSlot manages a single RTT quad in the compositor.
 * Each slot has its own Scene + Camera for off-screen rendering,
 * and a Mesh that displays the result in the main scene.
 * All state properties (x, y, width, height, opacity, radius)
 * are Spring-animated for smooth iOS-style transitions.
 */
export class AppSlot {
  readonly id: string;
  readonly mesh: Mesh;
  readonly appScene: Scene;
  readonly appCamera: OrthographicCamera;
  readonly renderTarget: WebGLRenderTarget;

  private _material: MeshBasicMaterial;
  private _springs: {
    x: Spring;
    y: Spring;
    width: Spring;
    height: Spring;
    opacity: Spring;
    radius: Spring;
  };
  private _currentState: AppSlotState;

  constructor(config: AppSlotConfig) {
    this.id = config.id;
    this.appScene = config.scene;
    this.appCamera = config.camera;
    this.renderTarget = config.renderTarget;
    this._currentState = { ...config.state };

    this._material = new MeshBasicMaterial({
      map: config.renderTarget.texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      opacity: config.state.opacity,
    });

    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.frustumCulled = false;
    this._applyState(config.state);

    const s = config.state;
    this._springs = {
      x: new Spring({ from: s.x, to: s.x }),
      y: new Spring({ from: s.y, to: s.y }),
      width: new Spring({ from: s.width, to: s.width }),
      height: new Spring({ from: s.height, to: s.height }),
      opacity: new Spring({ from: s.opacity, to: s.opacity }),
      radius: new Spring({ from: s.radius, to: s.radius }),
    };
  }

  get isAnimating(): boolean {
    return !this._springs.x.done
      || !this._springs.y.done
      || !this._springs.width.done
      || !this._springs.height.done
      || !this._springs.opacity.done
      || !this._springs.radius.done;
  }

  get currentState(): Readonly<AppSlotState> {
    return this._currentState;
  }

  setTargetState(state: AppSlotState): void {
    this._springs.x.setTarget(state.x);
    this._springs.y.setTarget(state.y);
    this._springs.width.setTarget(state.width);
    this._springs.height.setTarget(state.height);
    this._springs.opacity.setTarget(state.opacity);
    this._springs.radius.setTarget(state.radius);
    this._currentState.zIndex = state.zIndex;
    this._currentState.visible = state.visible;
    this.mesh.visible = state.visible;
    this.mesh.position.z = state.zIndex;
  }

  /** Snap to state immediately — no animation */
  snapToState(state: AppSlotState): void {
    this._springs.x.reset(state.x, state.x);
    this._springs.y.reset(state.y, state.y);
    this._springs.width.reset(state.width, state.width);
    this._springs.height.reset(state.height, state.height);
    this._springs.opacity.reset(state.opacity, state.opacity);
    this._springs.radius.reset(state.radius, state.radius);
    this._currentState = { ...state };
    this._applyState(state);
  }

  update(dt: number): void {
    if (!this.isAnimating) return;
    this._springs.x.update(dt);
    this._springs.y.update(dt);
    this._springs.width.update(dt);
    this._springs.height.update(dt);
    this._springs.opacity.update(dt);
    this._springs.radius.update(dt);

    this._currentState.x = this._springs.x.value;
    this._currentState.y = this._springs.y.value;
    this._currentState.width = this._springs.width.value;
    this._currentState.height = this._springs.height.value;
    this._currentState.opacity = this._springs.opacity.value;
    this._currentState.radius = this._springs.radius.value;

    this._applyState(this._currentState);
  }

  private _applyState(s: AppSlotState): void {
    // Position: center of the slot. In Y-down pixel space, negate Y.
    this.mesh.position.set(
      s.x + s.width / 2,
      -(s.y + s.height / 2),
      s.zIndex,
    );
    this.mesh.scale.set(s.width, s.height, 1);
    this._material.opacity = s.opacity;
    this.mesh.visible = s.visible;
    // radius is available for the blur/overlay layer to read
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this._material.dispose();
  }
}
```

- [ ] **Step 5: Create initial barrel export**

```typescript
// src/compositor/index.ts
export type {
  CompositorMode,
  AppSlotState,
  AppSlotConfig,
  CompositorEventType,
  CompositorEvent,
  CompositorEventHandler,
} from "./compositor-types";
export { AppSlot } from "./app-slot";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run __tests__/compositor/app-slot.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/compositor/compositor-types.ts src/compositor/app-slot.ts src/compositor/index.ts __tests__/compositor/app-slot.test.ts
git commit -m "feat(os/compositor): add compositor types + AppSlot with Spring-animated RTT quad"
```

---

### Task 2: BlurEffect (GLSL Gaussian Blur)

**Files:**
- Create: `src/compositor/blur-effect.ts`
- Create: `__tests__/compositor/blur-effect.test.ts`
- Modify: `src/compositor/index.ts`

The blur effect uses a dual-pass (horizontal + vertical) Gaussian blur rendered to intermediate RTTs. Uses GLSL (not TSL) for WebGL/WebGPU dual compatibility.

- [ ] **Step 1: Write failing test for BlurEffect**

```typescript
// __tests__/compositor/blur-effect.test.ts
import { describe, it, expect } from "vitest";
import { WebGLRenderTarget, Scene, Mesh, ShaderMaterial } from "three";
import { BlurEffect } from "../../src/compositor/blur-effect";

describe("BlurEffect", () => {
  it("creates with default blur radius", () => {
    const blur = new BlurEffect();
    expect(blur.radius).toBe(8);
  });

  it("creates the fullscreen quad mesh", () => {
    const blur = new BlurEffect();
    expect(blur.mesh).toBeInstanceOf(Mesh);
    expect(blur.mesh.material).toBeInstanceOf(ShaderMaterial);
  });

  it("updates radius", () => {
    const blur = new BlurEffect({ radius: 16 });
    expect(blur.radius).toBe(16);
    blur.setRadius(24);
    expect(blur.radius).toBe(24);
  });

  it("sets input texture", () => {
    const blur = new BlurEffect();
    const rt = new WebGLRenderTarget(800, 600);
    blur.setInput(rt.texture);
    const mat = blur.mesh.material as ShaderMaterial;
    expect(mat.uniforms.uTexture.value).toBe(rt.texture);
  });

  it("disposes without error", () => {
    const blur = new BlurEffect();
    blur.dispose();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/compositor/blur-effect.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BlurEffect**

```typescript
// src/compositor/blur-effect.ts
import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  DoubleSide,
} from "three";
import type { Texture } from "three";

const blurVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const blurFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform vec2 uDirection;
  uniform vec2 uResolution;
  uniform float uRadius;

  void main() {
    vec2 texelSize = 1.0 / uResolution;
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;
    float sigma = uRadius * 0.5;
    float twoSigmaSq = 2.0 * sigma * sigma;
    int samples = int(ceil(uRadius));

    for (int i = -64; i <= 64; i++) {
      if (i > samples || i < -samples) continue;
      float fi = float(i);
      float weight = exp(-(fi * fi) / twoSigmaSq);
      vec2 offset = uDirection * texelSize * fi;
      color += texture2D(uTexture, vUv + offset) * weight;
      totalWeight += weight;
    }

    gl_FragColor = color / totalWeight;
  }
`;

export interface BlurEffectConfig {
  radius?: number;
  width?: number;
  height?: number;
}

const _unitPlane = new PlaneGeometry(1, 1);

export class BlurEffect {
  readonly mesh: Mesh;
  private _material: ShaderMaterial;
  private _radius: number;

  constructor(config: BlurEffectConfig = {}) {
    this._radius = config.radius ?? 8;

    this._material = new ShaderMaterial({
      vertexShader: blurVertexShader,
      fragmentShader: blurFragmentShader,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uTexture: { value: null },
        uDirection: { value: new Vector2(1, 0) },
        uResolution: { value: new Vector2(config.width ?? 800, config.height ?? 600) },
        uRadius: { value: this._radius },
      },
    });

    this.mesh = new Mesh(_unitPlane, this._material);
    this.mesh.frustumCulled = false;
  }

  get radius(): number { return this._radius; }

  setRadius(r: number): void {
    this._radius = r;
    this._material.uniforms.uRadius.value = r;
  }

  setInput(texture: Texture): void {
    this._material.uniforms.uTexture.value = texture;
  }

  setResolution(width: number, height: number): void {
    (this._material.uniforms.uResolution.value as Vector2).set(width, height);
  }

  /** Set blur direction: (1,0) for horizontal, (0,1) for vertical */
  setDirection(x: number, y: number): void {
    (this._material.uniforms.uDirection.value as Vector2).set(x, y);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this._material.dispose();
  }
}
```

- [ ] **Step 4: Update barrel export**

Add to `src/compositor/index.ts`:
```typescript
export { BlurEffect } from "./blur-effect";
export type { BlurEffectConfig } from "./blur-effect";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/compositor/blur-effect.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/compositor/blur-effect.ts __tests__/compositor/blur-effect.test.ts src/compositor/index.ts
git commit -m "feat(os/compositor): add BlurEffect with dual-pass GLSL Gaussian blur"
```

---

### Task 3: GestureRouter

**Files:**
- Create: `src/compositor/gesture-router.ts`
- Create: `__tests__/compositor/gesture-router.test.ts`
- Modify: `src/compositor/index.ts`

GestureRouter sits in front of GestureRecognizer. It intercepts system-level gestures in reserved screen zones (bottom 20px for home indicator, top-right corner for control center, left edge for back) and routes them as compositor events. Non-system gestures pass through to the focused app.

- [ ] **Step 1: Write failing test for GestureRouter**

```typescript
// __tests__/compositor/gesture-router.test.ts
import { describe, it, expect, vi } from "vitest";
import { Vector2 } from "three";
import { GestureRouter } from "../../src/compositor/gesture-router";
import type { GestureEvent } from "../../src/types";

function makeSwipe(startY: number, direction: "up" | "down" | "left" | "right", startX = 400): GestureEvent {
  return {
    type: "swipe",
    startPosition: new Vector2(startX, startY),
    position: new Vector2(startX, startY - 100),
    delta: new Vector2(0, -100),
    direction,
    velocity: new Vector2(0, -0.5),
    duration: 200,
    domEvent: new PointerEvent("pointerup"),
  };
}

describe("GestureRouter", () => {
  it("intercepts bottom-swipe-up as 'home' system gesture", () => {
    const handler = vi.fn();
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    router.onSystemGesture(handler);
    const gesture = makeSwipe(590, "up");
    const consumed = router.route(gesture);
    expect(consumed).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: "home" }));
  });

  it("intercepts top-right swipe-down as 'control-center'", () => {
    const handler = vi.fn();
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    router.onSystemGesture(handler);
    const gesture = makeSwipe(10, "down", 750);
    const consumed = router.route(gesture);
    expect(consumed).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: "control-center" }));
  });

  it("intercepts left-edge swipe-right as 'back'", () => {
    const handler = vi.fn();
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    router.onSystemGesture(handler);
    const gesture: GestureEvent = {
      type: "swipe",
      startPosition: new Vector2(8, 300),
      position: new Vector2(108, 300),
      delta: new Vector2(100, 0),
      direction: "right",
      velocity: new Vector2(0.5, 0),
      duration: 200,
      domEvent: new PointerEvent("pointerup"),
    };
    const consumed = router.route(gesture);
    expect(consumed).toBe(true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: "back" }));
  });

  it("passes through non-system gestures", () => {
    const handler = vi.fn();
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    router.onSystemGesture(handler);
    const gesture = makeSwipe(300, "up", 400);
    const consumed = router.route(gesture);
    expect(consumed).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes through taps", () => {
    const router = new GestureRouter({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    router.onSystemGesture(handler);
    const tap: GestureEvent = {
      type: "tap",
      startPosition: new Vector2(590, 590),
      position: new Vector2(590, 590),
      delta: new Vector2(0, 0),
      velocity: new Vector2(0, 0),
      duration: 50,
      domEvent: new PointerEvent("pointerup"),
    };
    expect(router.route(tap)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/compositor/gesture-router.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement GestureRouter**

```typescript
// src/compositor/gesture-router.ts
import type { GestureEvent } from "../types";

export type SystemGestureAction = "home" | "multitask" | "control-center" | "back";

export interface SystemGestureEvent {
  action: SystemGestureAction;
  gesture: GestureEvent;
}

type SystemGestureHandler = (event: SystemGestureEvent) => void;

export interface GestureRouterConfig {
  screenWidth: number;
  screenHeight: number;
  /** Bottom zone height for home indicator swipe (default 20) */
  bottomZone?: number;
  /** Left edge width for back swipe (default 20) */
  edgeZone?: number;
  /** Top zone height for control center swipe (default 30) */
  topZone?: number;
  /** Right fraction of screen for control center (default 0.33) */
  topRightFraction?: number;
}

export class GestureRouter {
  private _screenWidth: number;
  private _screenHeight: number;
  private _bottomZone: number;
  private _edgeZone: number;
  private _topZone: number;
  private _topRightFraction: number;
  private _handlers: SystemGestureHandler[] = [];

  constructor(config: GestureRouterConfig) {
    this._screenWidth = config.screenWidth;
    this._screenHeight = config.screenHeight;
    this._bottomZone = config.bottomZone ?? 20;
    this._edgeZone = config.edgeZone ?? 20;
    this._topZone = config.topZone ?? 30;
    this._topRightFraction = config.topRightFraction ?? 0.33;
  }

  resize(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
  }

  onSystemGesture(handler: SystemGestureHandler): void {
    this._handlers.push(handler);
  }

  offSystemGesture(handler: SystemGestureHandler): void {
    const idx = this._handlers.indexOf(handler);
    if (idx !== -1) this._handlers.splice(idx, 1);
  }

  /**
   * Route a gesture event. Returns true if the gesture was consumed
   * as a system gesture, false if it should pass through to the app.
   */
  route(gesture: GestureEvent): boolean {
    if (gesture.type !== "swipe") return false;

    const startX = gesture.startPosition.x;
    const startY = gesture.startPosition.y;
    const dir = gesture.direction;

    // Bottom zone swipe-up → home or multitask
    if (startY >= this._screenHeight - this._bottomZone && dir === "up") {
      this._emit({ action: "home", gesture });
      return true;
    }

    // Top-right zone swipe-down → control center
    if (
      startY <= this._topZone &&
      startX >= this._screenWidth * (1 - this._topRightFraction) &&
      dir === "down"
    ) {
      this._emit({ action: "control-center", gesture });
      return true;
    }

    // Left edge swipe-right → back
    if (startX <= this._edgeZone && dir === "right") {
      this._emit({ action: "back", gesture });
      return true;
    }

    return false;
  }

  private _emit(event: SystemGestureEvent): void {
    for (const h of this._handlers) h(event);
  }

  dispose(): void {
    this._handlers.length = 0;
  }
}
```

- [ ] **Step 4: Update barrel export**

Add to `src/compositor/index.ts`:
```typescript
export { GestureRouter } from "./gesture-router";
export type { SystemGestureAction, SystemGestureEvent, GestureRouterConfig } from "./gesture-router";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/compositor/gesture-router.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/compositor/gesture-router.ts __tests__/compositor/gesture-router.test.ts src/compositor/index.ts
git commit -m "feat(os/compositor): add GestureRouter with system gesture zone detection"
```

---

### Task 4: TransitionEngine

**Files:**
- Create: `src/compositor/transition-engine.ts`
- Create: `__tests__/compositor/transition-engine.test.ts`
- Modify: `src/compositor/index.ts`

TransitionEngine manages transitions between compositor modes. It takes a map of AppSlots, computes target AppSlotStates based on mode + layout, then drives all slots to their targets. It tracks overall animation completion.

- [ ] **Step 1: Write failing test for TransitionEngine**

```typescript
// __tests__/compositor/transition-engine.test.ts
import { describe, it, expect, vi } from "vitest";
import { WebGLRenderTarget, Scene, OrthographicCamera } from "three";
import { AppSlot } from "../../src/compositor/app-slot";
import { TransitionEngine } from "../../src/compositor/transition-engine";

function makeSlot(id: string) {
  const rt = new WebGLRenderTarget(800, 600);
  return new AppSlot({
    id,
    renderTarget: rt,
    scene: new Scene(),
    camera: new OrthographicCamera(0, 800, 0, -600, 0.1, 1000),
    state: { x: 0, y: 0, width: 800, height: 600, opacity: 1, radius: 0, zIndex: 2, visible: true },
  });
}

describe("TransitionEngine", () => {
  it("transitions a slot to FULLSCREEN layout", () => {
    const slot = makeSlot("app1");
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    engine.transition("FULLSCREEN", [slot], "app1");
    // Should set target state to full screen
    for (let i = 0; i < 300; i++) engine.update(1 / 60);
    expect(slot.mesh.scale.x).toBeCloseTo(800, 0);
    expect(slot.mesh.scale.y).toBeCloseTo(600, 0);
    expect(slot.isAnimating).toBe(false);
  });

  it("transitions to HOME — slots shrink to card size", () => {
    const slot = makeSlot("app1");
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    engine.transition("HOME", [slot], "app1");
    for (let i = 0; i < 300; i++) engine.update(1 / 60);
    expect(slot.currentState.visible).toBe(false);
    expect(engine.isAnimating).toBe(false);
  });

  it("transitions to SPLIT — two slots side by side", () => {
    const slot1 = makeSlot("app1");
    const slot2 = makeSlot("app2");
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    engine.transition("SPLIT", [slot1, slot2], "app1");
    for (let i = 0; i < 300; i++) engine.update(1 / 60);
    expect(slot1.mesh.scale.x).toBeCloseTo(400, 0);
    expect(slot2.mesh.scale.x).toBeCloseTo(400, 0);
  });

  it("fires onTransitionEnd callback", () => {
    const slot = makeSlot("app1");
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    const handler = vi.fn();
    engine.onTransitionEnd(handler);
    engine.transition("FULLSCREEN", [slot], "app1");
    for (let i = 0; i < 300; i++) engine.update(1 / 60);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("reports isAnimating during transition", () => {
    const slot = makeSlot("app1");
    const engine = new TransitionEngine({ screenWidth: 800, screenHeight: 600 });
    engine.transition("FULLSCREEN", [slot], "app1");
    expect(engine.isAnimating).toBe(true);
    for (let i = 0; i < 300; i++) engine.update(1 / 60);
    expect(engine.isAnimating).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/compositor/transition-engine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement TransitionEngine**

```typescript
// src/compositor/transition-engine.ts
import type { CompositorMode, AppSlotState } from "./compositor-types";
import type { AppSlot } from "./app-slot";

export interface TransitionEngineConfig {
  screenWidth: number;
  screenHeight: number;
}

type TransitionEndHandler = () => void;

export class TransitionEngine {
  private _screenWidth: number;
  private _screenHeight: number;
  private _slots: AppSlot[] = [];
  private _animating = false;
  private _endHandlers: TransitionEndHandler[] = [];

  constructor(config: TransitionEngineConfig) {
    this._screenWidth = config.screenWidth;
    this._screenHeight = config.screenHeight;
  }

  get isAnimating(): boolean { return this._animating; }

  resize(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
  }

  onTransitionEnd(handler: TransitionEndHandler): void {
    this._endHandlers.push(handler);
  }

  offTransitionEnd(handler: TransitionEndHandler): void {
    const idx = this._endHandlers.indexOf(handler);
    if (idx !== -1) this._endHandlers.splice(idx, 1);
  }

  /**
   * Begin a transition to the given mode.
   * Computes target states for all slots and sets their Spring targets.
   */
  transition(mode: CompositorMode, slots: AppSlot[], focusedAppId?: string): void {
    this._slots = slots;
    this._animating = true;
    const targets = this._computeLayout(mode, slots, focusedAppId);
    for (let i = 0; i < slots.length; i++) {
      slots[i].setTargetState(targets[i]);
    }
  }

  update(dt: number): void {
    if (!this._animating) return;
    let anyAnimating = false;
    for (const slot of this._slots) {
      slot.update(dt);
      if (slot.isAnimating) anyAnimating = true;
    }
    if (!anyAnimating) {
      this._animating = false;
      for (const h of this._endHandlers) h();
    }
  }

  private _computeLayout(mode: CompositorMode, slots: AppSlot[], focusedAppId?: string): AppSlotState[] {
    const w = this._screenWidth;
    const h = this._screenHeight;

    switch (mode) {
      case "FULLSCREEN": {
        return slots.map((slot) => ({
          x: 0, y: 0, width: w, height: h,
          opacity: slot.id === focusedAppId ? 1 : 0,
          radius: 0, zIndex: slot.id === focusedAppId ? 2 : 1,
          visible: slot.id === focusedAppId,
        }));
      }
      case "HOME": {
        return slots.map(() => ({
          x: w * 0.25, y: h * 0.25, width: w * 0.5, height: h * 0.5,
          opacity: 0, radius: 12, zIndex: 1, visible: false,
        }));
      }
      case "SPLIT": {
        const half = Math.floor(w / 2);
        return slots.map((slot, i) => ({
          x: i === 0 ? 0 : half,
          y: 0, width: half, height: h,
          opacity: 1, radius: 0, zIndex: 2,
          visible: i < 2,
        }));
      }
      case "SLIDE_OVER": {
        const slideW = Math.floor(w * 0.4);
        return slots.map((slot, i) => {
          if (i === 0) {
            return { x: 0, y: 0, width: w, height: h, opacity: 1, radius: 0, zIndex: 2, visible: true };
          }
          if (i === 1) {
            return { x: w - slideW, y: 0, width: slideW, height: h, opacity: 1, radius: 12, zIndex: 3, visible: true };
          }
          return { x: 0, y: 0, width: 0, height: 0, opacity: 0, radius: 0, zIndex: 1, visible: false };
        });
      }
      case "MULTITASK": {
        const cardW = Math.floor(w * 0.6);
        const cardH = Math.floor(h * 0.6);
        const startY = Math.floor(h * 0.2);
        return slots.map((_slot, i) => ({
          x: Math.floor(w * 0.2) + i * (cardW + 20),
          y: startY, width: cardW, height: cardH,
          opacity: 1, radius: 12, zIndex: 5,
          visible: true,
        }));
      }
      case "CONTROL_CENTER": {
        // Focused app stays fullscreen, dimmed
        return slots.map((slot) => ({
          x: 0, y: 0, width: w, height: h,
          opacity: slot.id === focusedAppId ? 0.3 : 0,
          radius: 0, zIndex: 1,
          visible: slot.id === focusedAppId,
        }));
      }
      default:
        return slots.map(() => ({
          x: 0, y: 0, width: w, height: h,
          opacity: 1, radius: 0, zIndex: 2, visible: true,
        }));
    }
  }

  dispose(): void {
    this._endHandlers.length = 0;
    this._slots = [];
    this._animating = false;
  }
}
```

- [ ] **Step 4: Update barrel export**

Add to `src/compositor/index.ts`:
```typescript
export { TransitionEngine } from "./transition-engine";
export type { TransitionEngineConfig } from "./transition-engine";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/compositor/transition-engine.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/compositor/transition-engine.ts __tests__/compositor/transition-engine.test.ts src/compositor/index.ts
git commit -m "feat(os/compositor): add TransitionEngine with mode-specific layout computation"
```

---

### Task 5: MultitaskView

**Files:**
- Create: `src/compositor/multitask-view.ts`
- Create: `__tests__/compositor/multitask-view.test.ts`
- Modify: `src/compositor/index.ts`

MultitaskView renders app cards in a horizontally scrollable 3D perspective carousel. Cards can be swiped up to dismiss. Each card is a Mesh textured with the app's RTT snapshot.

- [ ] **Step 1: Write failing test for MultitaskView**

```typescript
// __tests__/compositor/multitask-view.test.ts
import { describe, it, expect, vi } from "vitest";
import { WebGLRenderTarget, Group } from "three";
import { MultitaskView } from "../../src/compositor/multitask-view";

describe("MultitaskView", () => {
  it("creates a root Group", () => {
    const mv = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    expect(mv.root).toBeInstanceOf(Group);
  });

  it("renders cards for given app snapshots", () => {
    const mv = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = [
      { id: "app1", texture: new WebGLRenderTarget(800, 600).texture },
      { id: "app2", texture: new WebGLRenderTarget(800, 600).texture },
    ];
    mv.setCards(snapshots);
    // 2 cards as children
    expect(mv.root.children.length).toBe(2);
  });

  it("scrolls cards horizontally", () => {
    const mv = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = [
      { id: "app1", texture: new WebGLRenderTarget(800, 600).texture },
      { id: "app2", texture: new WebGLRenderTarget(800, 600).texture },
      { id: "app3", texture: new WebGLRenderTarget(800, 600).texture },
    ];
    mv.setCards(snapshots);
    mv.scrollBy(100);
    expect(mv.scrollOffset).toBe(100);
  });

  it("fires onSelectApp when a card index is tapped", () => {
    const handler = vi.fn();
    const mv = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    mv.onSelectApp(handler);
    const snapshots = [
      { id: "app1", texture: new WebGLRenderTarget(800, 600).texture },
    ];
    mv.setCards(snapshots);
    mv.selectCard(0);
    expect(handler).toHaveBeenCalledWith("app1");
  });

  it("fires onDismissApp when a card is dismissed", () => {
    const handler = vi.fn();
    const mv = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    mv.onDismissApp(handler);
    const snapshots = [
      { id: "app1", texture: new WebGLRenderTarget(800, 600).texture },
    ];
    mv.setCards(snapshots);
    mv.dismissCard(0);
    expect(handler).toHaveBeenCalledWith("app1");
    expect(mv.root.children.length).toBe(0);
  });

  it("disposes all card meshes", () => {
    const mv = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = [
      { id: "app1", texture: new WebGLRenderTarget(800, 600).texture },
    ];
    mv.setCards(snapshots);
    mv.dispose();
    expect(mv.root.children.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/compositor/multitask-view.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MultitaskView**

```typescript
// src/compositor/multitask-view.ts
import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  DoubleSide,
} from "three";
import type { Texture, Material } from "three";

export interface AppSnapshot {
  id: string;
  texture: Texture;
}

export interface MultitaskViewConfig {
  screenWidth: number;
  screenHeight: number;
  cardWidth?: number;
  cardHeight?: number;
  cardGap?: number;
}

type AppIdHandler = (appId: string) => void;

const _unitPlane = new PlaneGeometry(1, 1);

interface CardEntry {
  id: string;
  mesh: Mesh;
  material: MeshBasicMaterial;
}

export class MultitaskView {
  readonly root = new Group();
  private _cards: CardEntry[] = [];
  private _scrollOffset = 0;
  private _cardWidth: number;
  private _cardHeight: number;
  private _cardGap: number;
  private _screenWidth: number;
  private _screenHeight: number;
  private _selectHandlers: AppIdHandler[] = [];
  private _dismissHandlers: AppIdHandler[] = [];

  constructor(config: MultitaskViewConfig) {
    this._screenWidth = config.screenWidth;
    this._screenHeight = config.screenHeight;
    this._cardWidth = config.cardWidth ?? Math.floor(config.screenWidth * 0.6);
    this._cardHeight = config.cardHeight ?? Math.floor(config.screenHeight * 0.6);
    this._cardGap = config.cardGap ?? 20;
  }

  get scrollOffset(): number { return this._scrollOffset; }
  get cardCount(): number { return this._cards.length; }

  onSelectApp(handler: AppIdHandler): void { this._selectHandlers.push(handler); }
  offSelectApp(handler: AppIdHandler): void {
    const idx = this._selectHandlers.indexOf(handler);
    if (idx !== -1) this._selectHandlers.splice(idx, 1);
  }

  onDismissApp(handler: AppIdHandler): void { this._dismissHandlers.push(handler); }
  offDismissApp(handler: AppIdHandler): void {
    const idx = this._dismissHandlers.indexOf(handler);
    if (idx !== -1) this._dismissHandlers.splice(idx, 1);
  }

  setCards(snapshots: AppSnapshot[]): void {
    this._clearCards();
    const startY = Math.floor(this._screenHeight * 0.2);
    for (let i = 0; i < snapshots.length; i++) {
      const mat = new MeshBasicMaterial({
        map: snapshots[i].texture,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      });
      const mesh = new Mesh(_unitPlane, mat);
      mesh.scale.set(this._cardWidth, this._cardHeight, 1);
      mesh.position.set(
        this._cardX(i) + this._cardWidth / 2,
        -(startY + this._cardHeight / 2),
        5,
      );
      mesh.userData.interactive = true;
      this.root.add(mesh);
      this._cards.push({ id: snapshots[i].id, mesh, material: mat });
    }
  }

  scrollTo(offset: number): void {
    this._scrollOffset = Math.max(0, offset);
    this._updateCardPositions();
  }

  scrollBy(delta: number): void {
    this.scrollTo(this._scrollOffset + delta);
  }

  selectCard(index: number): void {
    if (index < 0 || index >= this._cards.length) return;
    const id = this._cards[index].id;
    for (const h of this._selectHandlers) h(id);
  }

  dismissCard(index: number): void {
    if (index < 0 || index >= this._cards.length) return;
    const entry = this._cards[index];
    entry.mesh.removeFromParent();
    entry.material.dispose();
    this._cards.splice(index, 1);
    this._updateCardPositions();
    for (const h of this._dismissHandlers) h(entry.id);
  }

  resize(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
    this._cardWidth = Math.floor(width * 0.6);
    this._cardHeight = Math.floor(height * 0.6);
    this._updateCardPositions();
  }

  dispose(): void {
    this._clearCards();
    this._selectHandlers.length = 0;
    this._dismissHandlers.length = 0;
  }

  private _cardX(index: number): number {
    const startX = Math.floor(this._screenWidth * 0.2);
    return startX + index * (this._cardWidth + this._cardGap) - this._scrollOffset;
  }

  private _updateCardPositions(): void {
    const startY = Math.floor(this._screenHeight * 0.2);
    for (let i = 0; i < this._cards.length; i++) {
      this._cards[i].mesh.position.x = this._cardX(i) + this._cardWidth / 2;
      this._cards[i].mesh.position.y = -(startY + this._cardHeight / 2);
    }
  }

  private _clearCards(): void {
    for (const c of this._cards) {
      c.mesh.removeFromParent();
      (c.mesh.material as Material).dispose();
    }
    this._cards.length = 0;
  }
}
```

- [ ] **Step 4: Update barrel export**

Add to `src/compositor/index.ts`:
```typescript
export { MultitaskView } from "./multitask-view";
export type { AppSnapshot, MultitaskViewConfig } from "./multitask-view";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/compositor/multitask-view.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/compositor/multitask-view.ts __tests__/compositor/multitask-view.test.ts src/compositor/index.ts
git commit -m "feat(os/compositor): add MultitaskView with card carousel + dismiss"
```

---

### Task 6: SceneCompositor (State Machine)

**Files:**
- Create: `src/compositor/scene-compositor.ts`
- Create: `__tests__/compositor/scene-compositor.test.ts`
- Modify: `src/compositor/index.ts`

SceneCompositor is the top-level coordinator. It owns the AppSlot registry, TransitionEngine, GestureRouter, and MultitaskView. It exposes a clean API: `openApp()`, `closeApp()`, `setMode()`, `update()`, `resize()`, `dispose()`.

- [ ] **Step 1: Write failing test for SceneCompositor**

```typescript
// __tests__/compositor/scene-compositor.test.ts
import { describe, it, expect, vi } from "vitest";
import { Scene, OrthographicCamera } from "three";
import { SceneCompositor } from "../../src/compositor/scene-compositor";
import { RTTPool } from "../../src/engine/rtt-pool";

describe("SceneCompositor", () => {
  function makeCompositor() {
    const rttPool = new RTTPool();
    return new SceneCompositor({
      screenWidth: 800,
      screenHeight: 600,
      rttPool,
    });
  }

  it("starts in HOME mode", () => {
    const comp = makeCompositor();
    expect(comp.mode).toBe("HOME");
  });

  it("opens an app and transitions to FULLSCREEN", () => {
    const comp = makeCompositor();
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene, camera);
    expect(comp.mode).toBe("FULLSCREEN");
    expect(comp.hasApp("app1")).toBe(true);
  });

  it("closes an app and transitions to HOME if no apps remain", () => {
    const comp = makeCompositor();
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene, camera);
    comp.closeApp("app1");
    expect(comp.mode).toBe("HOME");
    expect(comp.hasApp("app1")).toBe(false);
  });

  it("switches to MULTITASK mode", () => {
    const comp = makeCompositor();
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene, camera);
    comp.setMode("MULTITASK");
    expect(comp.mode).toBe("MULTITASK");
  });

  it("switches to SPLIT mode with two apps", () => {
    const comp = makeCompositor();
    const scene1 = new Scene();
    const cam1 = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    const scene2 = new Scene();
    const cam2 = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene1, cam1);
    comp.openApp("app2", scene2, cam2);
    comp.setMode("SPLIT");
    expect(comp.mode).toBe("SPLIT");
  });

  it("fires mode-change event", () => {
    const comp = makeCompositor();
    const handler = vi.fn();
    comp.onEvent(handler);
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene, camera);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mode-change", mode: "FULLSCREEN", prevMode: "HOME" }),
    );
  });

  it("update drives transition engine", () => {
    const comp = makeCompositor();
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene, camera);
    // Run enough frames for Springs to settle
    for (let i = 0; i < 300; i++) comp.update(1 / 60);
    // Should not throw
  });

  it("disposes all resources", () => {
    const comp = makeCompositor();
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 800, 0, -600, 0.1, 1000);
    comp.openApp("app1", scene, camera);
    comp.dispose();
    expect(comp.hasApp("app1")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/compositor/scene-compositor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SceneCompositor**

```typescript
// src/compositor/scene-compositor.ts
import { Group } from "three";
import type { Scene, OrthographicCamera } from "three";
import type { RTTPool } from "../engine/rtt-pool";
import type {
  CompositorMode,
  CompositorEvent,
  CompositorEventHandler,
} from "./compositor-types";
import { AppSlot } from "./app-slot";
import { TransitionEngine } from "./transition-engine";
import { GestureRouter } from "./gesture-router";
import { MultitaskView } from "./multitask-view";
import type { GestureEvent } from "../types";

export interface SceneCompositorConfig {
  screenWidth: number;
  screenHeight: number;
  rttPool: RTTPool;
}

export class SceneCompositor {
  readonly appLayer = new Group();
  readonly multitaskLayer = new Group();

  private _mode: CompositorMode = "HOME";
  private _slots = new Map<string, AppSlot>();
  private _focusedAppId: string | null = null;
  private _rttPool: RTTPool;
  private _transitionEngine: TransitionEngine;
  private _gestureRouter: GestureRouter;
  private _multitaskView: MultitaskView;
  private _eventHandlers: CompositorEventHandler[] = [];
  private _screenWidth: number;
  private _screenHeight: number;

  constructor(config: SceneCompositorConfig) {
    this._screenWidth = config.screenWidth;
    this._screenHeight = config.screenHeight;
    this._rttPool = config.rttPool;

    this._transitionEngine = new TransitionEngine({
      screenWidth: config.screenWidth,
      screenHeight: config.screenHeight,
    });

    this._gestureRouter = new GestureRouter({
      screenWidth: config.screenWidth,
      screenHeight: config.screenHeight,
    });

    this._multitaskView = new MultitaskView({
      screenWidth: config.screenWidth,
      screenHeight: config.screenHeight,
    });

    this.appLayer.position.z = 2;
    this.multitaskLayer.position.z = 5;
    this.multitaskLayer.visible = false;

    this._gestureRouter.onSystemGesture((evt) => {
      switch (evt.action) {
        case "home":
          this.setMode("HOME");
          break;
        case "multitask":
          this.setMode("MULTITASK");
          break;
        case "control-center":
          this.setMode("CONTROL_CENTER");
          break;
      }
    });

    this._multitaskView.onSelectApp((appId) => {
      this._focusedAppId = appId;
      this.setMode("FULLSCREEN");
    });

    this._multitaskView.onDismissApp((appId) => {
      this.closeApp(appId);
    });
  }

  get mode(): CompositorMode { return this._mode; }
  get focusedAppId(): string | null { return this._focusedAppId; }

  hasApp(id: string): boolean { return this._slots.has(id); }

  getSlot(id: string): AppSlot | undefined { return this._slots.get(id); }

  onEvent(handler: CompositorEventHandler): void {
    this._eventHandlers.push(handler);
  }

  offEvent(handler: CompositorEventHandler): void {
    const idx = this._eventHandlers.indexOf(handler);
    if (idx !== -1) this._eventHandlers.splice(idx, 1);
  }

  openApp(id: string, scene: Scene, camera: OrthographicCamera): void {
    if (this._slots.has(id)) return;
    const rt = this._rttPool.acquire(id, this._screenWidth, this._screenHeight);
    const slot = new AppSlot({
      id,
      renderTarget: rt,
      scene,
      camera,
      state: {
        x: 0, y: 0, width: this._screenWidth, height: this._screenHeight,
        opacity: 0, radius: 0, zIndex: 2, visible: true,
      },
    });
    this._slots.set(id, slot);
    this.appLayer.add(slot.mesh);
    this._focusedAppId = id;

    const prevMode = this._mode;
    this._mode = "FULLSCREEN";
    this._transitionEngine.transition("FULLSCREEN", this._slotsArray(), id);
    this._emitEvent({ type: "mode-change", mode: "FULLSCREEN", prevMode, appId: id });
    this._emitEvent({ type: "app-focus", appId: id });
  }

  closeApp(id: string): void {
    const slot = this._slots.get(id);
    if (!slot) return;
    slot.dispose();
    this._slots.delete(id);
    this._rttPool.release(id);
    this._emitEvent({ type: "app-close", appId: id });

    if (this._focusedAppId === id) {
      this._focusedAppId = this._slots.size > 0 ? this._slots.keys().next().value! : null;
    }

    if (this._slots.size === 0) {
      this.setMode("HOME");
    } else if (this._focusedAppId) {
      this.setMode("FULLSCREEN");
    }
  }

  setMode(mode: CompositorMode): void {
    if (mode === this._mode) return;
    const prevMode = this._mode;
    this._mode = mode;

    this.multitaskLayer.visible = mode === "MULTITASK";

    if (mode === "MULTITASK") {
      const snapshots = this._slotsArray().map((s) => ({
        id: s.id,
        texture: s.renderTarget.texture,
      }));
      this._multitaskView.setCards(snapshots);
    }

    this._transitionEngine.transition(mode, this._slotsArray(), this._focusedAppId ?? undefined);
    this._emitEvent({ type: "mode-change", mode, prevMode });
  }

  /** Route a gesture from GestureRecognizer. Returns true if consumed. */
  routeGesture(gesture: GestureEvent): boolean {
    return this._gestureRouter.route(gesture);
  }

  update(dt: number): void {
    this._transitionEngine.update(dt);
  }

  resize(width: number, height: number): void {
    this._screenWidth = width;
    this._screenHeight = height;
    this._transitionEngine.resize(width, height);
    this._gestureRouter.resize(width, height);
    this._multitaskView.resize(width, height);
    for (const slot of this._slots.values()) {
      this._rttPool.acquire(slot.id, width, height);
    }
  }

  dispose(): void {
    for (const slot of this._slots.values()) {
      slot.dispose();
      this._rttPool.release(slot.id);
    }
    this._slots.clear();
    this._focusedAppId = null;
    this._transitionEngine.dispose();
    this._gestureRouter.dispose();
    this._multitaskView.dispose();
    this._eventHandlers.length = 0;
  }

  private _slotsArray(): AppSlot[] {
    return Array.from(this._slots.values());
  }

  private _emitEvent(event: CompositorEvent): void {
    for (const h of this._eventHandlers) h(event);
  }
}
```

- [ ] **Step 4: Update barrel export**

Add to `src/compositor/index.ts`:
```typescript
export { SceneCompositor } from "./scene-compositor";
export type { SceneCompositorConfig } from "./scene-compositor";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/compositor/scene-compositor.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add src/compositor/scene-compositor.ts __tests__/compositor/scene-compositor.test.ts src/compositor/index.ts
git commit -m "feat(os/compositor): add SceneCompositor state machine with app lifecycle"
```

---

### Task 7: Package Integration + Exports

**Files:**
- Modify: `src/compositor/index.ts` (finalize)
- Modify: `src/index.ts` (add compositor export)

- [ ] **Step 1: Finalize compositor/index.ts barrel**

```typescript
// src/compositor/index.ts
export type {
  CompositorMode,
  AppSlotState,
  AppSlotConfig,
  CompositorEventType,
  CompositorEvent,
  CompositorEventHandler,
} from "./compositor-types";
export { AppSlot } from "./app-slot";
export { BlurEffect } from "./blur-effect";
export type { BlurEffectConfig } from "./blur-effect";
export { GestureRouter } from "./gesture-router";
export type { SystemGestureAction, SystemGestureEvent, GestureRouterConfig } from "./gesture-router";
export { TransitionEngine } from "./transition-engine";
export type { TransitionEngineConfig } from "./transition-engine";
export { MultitaskView } from "./multitask-view";
export type { AppSnapshot, MultitaskViewConfig } from "./multitask-view";
export { SceneCompositor } from "./scene-compositor";
export type { SceneCompositorConfig } from "./scene-compositor";
```

- [ ] **Step 2: Update src/index.ts**

```typescript
export * from "./engine";
export * from "./ui";
export * from "./compositor";
export * from "./types";
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (69 existing + ~33 new compositor tests ≈ 102 total)

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: CJS + ESM + DTS build success

- [ ] **Step 5: Verify exports**

Run: `node -e "const os = require('./dist/index.js'); const keys = Object.keys(os).sort(); console.log(keys.length, 'exports'); console.log(keys.join(', '));"`

Expected exports include (in addition to existing):
`AppSlot`, `BlurEffect`, `GestureRouter`, `MultitaskView`, `SceneCompositor`, `TransitionEngine`

- [ ] **Step 6: Commit**

```bash
git add src/compositor/index.ts src/index.ts
git commit -m "feat(os/compositor): add barrel exports and package integration"
```
