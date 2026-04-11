# @viben/os Sub 1: Render Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational render engine for @viben/os — Three.js WebGPU initialization, event system, RTT management, render scheduling, gesture recognition, and IME input handling.

**Architecture:** A pure TypeScript package (`packages/os`) that wraps Three.js WebGPURenderer with an on-demand render scheduler, Raycaster-based event system with DOM-like bubbling, gesture recognizer (tap/drag/swipe/long-press), and hidden textarea IME input. All rendering uses OrthographicCamera. Each "window" gets its own OffscreenRenderTarget managed by an RTT pool.

**Tech Stack:** Three.js r175+ (WebGPURenderer + WebGLRenderer fallback), TypeScript, tsup, vitest

**Spec:** `docs/superpowers/specs/2026-04-11-viben-os-architecture-design.md` — Section 9.2

---

## File Structure

```
packages/os/
  src/
    engine/
      renderer.ts              # WebGPU/WebGL init, resize, pixel ratio
      render-scheduler.ts      # On-demand rendering + animation loop
      rtt-pool.ts              # OffscreenRenderTarget create/release/resize
      event-system.ts          # Raycaster hit-test + bubble/capture dispatch
      gesture-recognizer.ts    # Tap/drag/swipe/long-press from pointer events
      input-manager.ts         # Hidden textarea + IME composition + keyboard routing
      resource-loader.ts       # Async texture/font/icon loading + cache
      index.ts                 # Public API barrel export
    types.ts                   # Shared type definitions
    index.ts                   # Package entry — re-exports engine/
  package.json
  tsconfig.json
  tsup.config.ts
  __tests__/
    engine/
      renderer.test.ts
      render-scheduler.test.ts
      rtt-pool.test.ts
      event-system.test.ts
      gesture-recognizer.test.ts
      input-manager.test.ts
      resource-loader.test.ts
apps/desktop/
  src/
    pages/os.tsx               # OsPage — canvas + hidden textarea + boot
    pages/index.ts             # Add OsPage export
  src/App.tsx                  # Add /os route
  package.json                 # Add @viben/os dependency
```

---

### Task 1: Package Scaffolding

**Files:**
- Create: `packages/os/package.json`
- Create: `packages/os/tsconfig.json`
- Create: `packages/os/tsup.config.ts`
- Create: `packages/os/src/types.ts`
- Create: `packages/os/src/index.ts`
- Create: `packages/os/src/engine/index.ts`

- [ ] **Step 1: Create `packages/os/package.json`**

```json
{
  "name": "@viben/os",
  "version": "1.0.0",
  "private": true,
  "description": "iPad-style OS UI powered by Three.js WebGPU",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "^0.175.0"
  },
  "devDependencies": {
    "@types/three": "^0.175.0",
    "tsup": "^8.3.5",
    "typescript": "^5.9.3",
    "vitest": "^3.2.1"
  }
}
```

- [ ] **Step 2: Create `packages/os/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 3: Create `packages/os/tsup.config.ts`**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: {
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["three"],
  treeshake: true,
});
```

- [ ] **Step 4: Create `packages/os/src/types.ts`**

```typescript
import type { Object3D, Vector2, Vector3 } from "three";

/** Pointer event data passed through the event system */
export interface PointerEventData {
  /** Screen-space position in pixels */
  screen: Vector2;
  /** Normalized device coordinates (-1 to 1) */
  ndc: Vector2;
  /** World-space intersection point (if hit) */
  worldPoint: Vector3 | null;
  /** Original DOM event */
  domEvent: PointerEvent;
}

/** UI event dispatched through the 3D event system */
export interface UIEvent {
  type: string;
  target: Object3D;
  currentTarget: Object3D;
  pointer: PointerEventData | null;
  stopped: boolean;
  stopPropagation(): void;
}

/** Recognized gesture types */
export type GestureType = "tap" | "drag" | "swipe" | "long-press";

/** Direction of a swipe gesture */
export type SwipeDirection = "up" | "down" | "left" | "right";

/** Gesture event emitted by the GestureRecognizer */
export interface GestureEvent {
  type: GestureType;
  /** Starting screen position */
  startPosition: Vector2;
  /** Current/end screen position */
  position: Vector2;
  /** Delta from start */
  delta: Vector2;
  /** Swipe direction (only for swipe gestures) */
  direction?: SwipeDirection;
  /** Velocity in px/ms (only for swipe/drag) */
  velocity: Vector2;
  /** Duration in ms */
  duration: number;
  /** Original DOM event */
  domEvent: PointerEvent;
}

/** IME composition state */
export interface IMECompositionState {
  isComposing: boolean;
  compositionText: string;
}

/** Callback for keyboard events routed by InputManager */
export type KeyboardHandler = (event: KeyboardEvent) => void;

/** Callback for text input (final committed text) */
export type TextInputHandler = (text: string) => void;

/** Callback for IME composition updates */
export type IMECompositionHandler = (state: IMECompositionState) => void;

/** Configuration for the render engine */
export interface EngineConfig {
  canvas: HTMLCanvasElement;
  textarea: HTMLTextAreaElement;
  width: number;
  height: number;
}
```

- [ ] **Step 5: Create `packages/os/src/engine/index.ts`**

```typescript
export { Renderer } from "./renderer";
export { RenderScheduler } from "./render-scheduler";
export { RTTPool } from "./rtt-pool";
export { EventSystem } from "./event-system";
export { GestureRecognizer } from "./gesture-recognizer";
export { InputManager } from "./input-manager";
export { ResourceLoader } from "./resource-loader";
```

- [ ] **Step 6: Create `packages/os/src/index.ts`**

```typescript
export * from "./engine";
export * from "./types";
```

- [ ] **Step 7: Install dependencies**

Run: `cd /root/viben && pnpm install`
Expected: Dependencies installed, `packages/os` linked into workspace.

- [ ] **Step 8: Verify typecheck**

Run: `cd /root/viben/packages/os && pnpm typecheck`
Expected: No errors (files are just types and re-exports).

- [ ] **Step 9: Commit**

```bash
git add packages/os/package.json packages/os/tsconfig.json packages/os/tsup.config.ts packages/os/src/types.ts packages/os/src/index.ts packages/os/src/engine/index.ts pnpm-lock.yaml
git commit -m "feat(os): scaffold @viben/os package with types and config"
```

---

### Task 2: Renderer — WebGPU Init + Fallback

**Files:**
- Create: `packages/os/__tests__/engine/renderer.test.ts`
- Create: `packages/os/src/engine/renderer.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/renderer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Renderer } from "../../src/engine/renderer";

// Mock Three.js — we can't run WebGPU in Node
vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: document.createElement("canvas"),
      getSize: vi.fn().mockReturnValue({ width: 800, height: 600 }),
    })),
  };
});

describe("Renderer", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
  });

  it("creates a renderer with the given canvas", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    expect(renderer.isInitialized).toBe(true);
  });

  it("handles resize", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    renderer.resize(1024, 768);
    expect(renderer.width).toBe(1024);
    expect(renderer.height).toBe(768);
  });

  it("provides an orthographic camera sized to pixels", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    renderer.resize(800, 600);
    const cam = renderer.camera;
    // Ortho camera: left=0, right=width, top=0, bottom=-height
    expect(cam.right).toBe(800);
    expect(cam.bottom).toBe(-600);
  });

  it("cleans up on dispose", async () => {
    const renderer = new Renderer(canvas);
    await renderer.init();
    renderer.dispose();
    expect(renderer.isInitialized).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/renderer.test.ts`
Expected: FAIL — `Cannot find module '../../src/engine/renderer'`

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/renderer.ts`:

```typescript
import {
  WebGLRenderer,
  OrthographicCamera,
  Scene,
} from "three";
import type { WebGPURenderer as WebGPURendererType } from "three/webgpu";

const MAX_PIXEL_RATIO = 2;

export class Renderer {
  private _renderer: WebGLRenderer | WebGPURendererType | null = null;
  private _camera: OrthographicCamera;
  private _scene: Scene;
  private _canvas: HTMLCanvasElement;
  private _width = 0;
  private _height = 0;
  private _initialized = false;
  private _useWebGPU = false;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this._camera = new OrthographicCamera(0, 1, 0, -1, 0.1, 1000);
    this._camera.position.z = 100;
    this._scene = new Scene();
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  get camera(): OrthographicCamera {
    return this._camera;
  }

  get scene(): Scene {
    return this._scene;
  }

  get threeRenderer(): WebGLRenderer | WebGPURendererType {
    if (!this._renderer) throw new Error("Renderer not initialized");
    return this._renderer;
  }

  get isWebGPU(): boolean {
    return this._useWebGPU;
  }

  async init(): Promise<void> {
    if (this._initialized) return;

    // Try WebGPU first
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      try {
        const { WebGPURenderer } = await import("three/webgpu");
        const gpuRenderer = new WebGPURenderer({
          canvas: this._canvas,
          antialias: true,
        });
        await gpuRenderer.init();
        gpuRenderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
        this._renderer = gpuRenderer;
        this._useWebGPU = true;
        this._initialized = true;
        return;
      } catch {
        // WebGPU failed, fall through to WebGL
      }
    }

    // Fallback to WebGL
    const glRenderer = new WebGLRenderer({
      canvas: this._canvas,
      antialias: true,
    });
    glRenderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, MAX_PIXEL_RATIO));
    this._renderer = glRenderer;
    this._initialized = true;
  }

  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    this._renderer?.setSize(width, height);
    // Ortho camera: origin at top-left, y-down (screen coords)
    this._camera.left = 0;
    this._camera.right = width;
    this._camera.top = 0;
    this._camera.bottom = -height;
    this._camera.updateProjectionMatrix();
  }

  render(scene?: Scene, camera?: OrthographicCamera): void {
    if (!this._renderer) return;
    this._renderer.render(scene ?? this._scene, camera ?? this._camera);
  }

  dispose(): void {
    this._renderer?.dispose();
    this._renderer = null;
    this._initialized = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/renderer.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/renderer.ts packages/os/__tests__/engine/renderer.test.ts
git commit -m "feat(os): add Renderer with WebGPU init + WebGL fallback"
```

---

### Task 3: RenderScheduler — On-Demand Rendering

**Files:**
- Create: `packages/os/__tests__/engine/render-scheduler.test.ts`
- Create: `packages/os/src/engine/render-scheduler.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/render-scheduler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RenderScheduler } from "../../src/engine/render-scheduler";

describe("RenderScheduler", () => {
  let renderFn: ReturnType<typeof vi.fn>;
  let scheduler: RenderScheduler;

  beforeEach(() => {
    renderFn = vi.fn();
    scheduler = new RenderScheduler(renderFn);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now());
      return 1;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    scheduler.dispose();
  });

  it("does not render until markDirty is called", () => {
    expect(renderFn).not.toHaveBeenCalled();
  });

  it("renders once after markDirty", () => {
    scheduler.markDirty();
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple markDirty calls into one render", () => {
    scheduler.markDirty();
    scheduler.markDirty();
    scheduler.markDirty();
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it("tracks animation count for continuous rendering", () => {
    scheduler.startAnimation();
    expect(scheduler.isAnimating).toBe(true);
    scheduler.stopAnimation();
    expect(scheduler.isAnimating).toBe(false);
  });

  it("multiple startAnimation calls require matching stops", () => {
    scheduler.startAnimation();
    scheduler.startAnimation();
    scheduler.stopAnimation();
    expect(scheduler.isAnimating).toBe(true);
    scheduler.stopAnimation();
    expect(scheduler.isAnimating).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/render-scheduler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/render-scheduler.ts`:

```typescript
export class RenderScheduler {
  private _dirty = false;
  private _animatingCount = 0;
  private _rafId: number | null = null;
  private _renderFn: (dt: number) => void;
  private _lastTime = 0;
  private _disposed = false;

  constructor(renderFn: (dt: number) => void) {
    this._renderFn = renderFn;
  }

  get isAnimating(): boolean {
    return this._animatingCount > 0;
  }

  /** Request a single re-render on the next frame */
  markDirty(): void {
    if (this._disposed) return;
    if (this._dirty || this._animatingCount > 0) return;
    this._dirty = true;
    this._scheduleFrame();
  }

  /** Start continuous rendering (for animations). Call stopAnimation() when done. */
  startAnimation(): void {
    this._animatingCount++;
    if (this._animatingCount === 1) {
      this._scheduleFrame();
    }
  }

  /** Stop one animation. Continuous rendering stops when count reaches 0. */
  stopAnimation(): void {
    this._animatingCount = Math.max(0, this._animatingCount - 1);
  }

  dispose(): void {
    this._disposed = true;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  private _scheduleFrame(): void {
    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame((time) => this._frame(time));
  }

  private _frame(time: number): void {
    this._rafId = null;
    if (this._disposed) return;

    const dt = this._lastTime === 0 ? 16 : time - this._lastTime;
    this._lastTime = time;
    this._dirty = false;

    this._renderFn(dt);

    // Continue loop if animating
    if (this._animatingCount > 0) {
      this._scheduleFrame();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/render-scheduler.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/render-scheduler.ts packages/os/__tests__/engine/render-scheduler.test.ts
git commit -m "feat(os): add RenderScheduler with on-demand + animation modes"
```

---

### Task 4: RTTPool — Render Target Management

**Files:**
- Create: `packages/os/__tests__/engine/rtt-pool.test.ts`
- Create: `packages/os/src/engine/rtt-pool.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/rtt-pool.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { RTTPool } from "../../src/engine/rtt-pool";

describe("RTTPool", () => {
  let pool: RTTPool;

  beforeEach(() => {
    pool = new RTTPool();
  });

  it("acquires a render target with given dimensions", () => {
    const rt = pool.acquire("win-1", 800, 600);
    expect(rt.width).toBe(800);
    expect(rt.height).toBe(600);
  });

  it("returns the same target for the same id", () => {
    const rt1 = pool.acquire("win-1", 800, 600);
    const rt2 = pool.acquire("win-1", 800, 600);
    expect(rt1).toBe(rt2);
  });

  it("resizes an existing target", () => {
    pool.acquire("win-1", 800, 600);
    const rt = pool.acquire("win-1", 1024, 768);
    expect(rt.width).toBe(1024);
    expect(rt.height).toBe(768);
  });

  it("releases a target", () => {
    pool.acquire("win-1", 800, 600);
    pool.release("win-1");
    expect(pool.has("win-1")).toBe(false);
  });

  it("disposes all targets", () => {
    pool.acquire("a", 100, 100);
    pool.acquire("b", 200, 200);
    pool.dispose();
    expect(pool.has("a")).toBe(false);
    expect(pool.has("b")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/rtt-pool.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/rtt-pool.ts`:

```typescript
import { WebGLRenderTarget } from "three";

export class RTTPool {
  private _targets = new Map<string, WebGLRenderTarget>();

  /** Acquire (or resize) a render target by id */
  acquire(id: string, width: number, height: number): WebGLRenderTarget {
    let rt = this._targets.get(id);
    if (rt) {
      if (rt.width !== width || rt.height !== height) {
        rt.setSize(width, height);
      }
      return rt;
    }
    rt = new WebGLRenderTarget(width, height, {
      depthBuffer: true,
      stencilBuffer: true,
    });
    this._targets.set(id, rt);
    return rt;
  }

  /** Check if a target exists */
  has(id: string): boolean {
    return this._targets.has(id);
  }

  /** Release and dispose a target */
  release(id: string): void {
    const rt = this._targets.get(id);
    if (rt) {
      rt.dispose();
      this._targets.delete(id);
    }
  }

  /** Dispose all targets */
  dispose(): void {
    for (const rt of this._targets.values()) {
      rt.dispose();
    }
    this._targets.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/rtt-pool.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/rtt-pool.ts packages/os/__tests__/engine/rtt-pool.test.ts
git commit -m "feat(os): add RTTPool for render target management"
```

---

### Task 5: EventSystem — Raycaster + Bubble/Capture

**Files:**
- Create: `packages/os/__tests__/engine/event-system.test.ts`
- Create: `packages/os/src/engine/event-system.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/event-system.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Object3D } from "three";
import { EventSystem } from "../../src/engine/event-system";

describe("EventSystem", () => {
  let eventSystem: EventSystem;

  beforeEach(() => {
    eventSystem = new EventSystem();
  });

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
    const childHandler = vi.fn((e) => e.stopPropagation());
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/event-system.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/event-system.ts`:

```typescript
import { Object3D, Raycaster, Vector2, OrthographicCamera, Scene } from "three";
import type { UIEvent, PointerEventData } from "../types";

type UIEventHandler = (event: UIEvent) => void;

export class EventSystem {
  private _handlers = new Map<Object3D, Map<string, UIEventHandler[]>>();
  private _raycaster = new Raycaster();
  private _ndc = new Vector2();

  /** Register an event handler on a 3D object */
  on(object: Object3D, eventType: string, handler: UIEventHandler): void {
    if (!this._handlers.has(object)) {
      this._handlers.set(object, new Map());
    }
    const objMap = this._handlers.get(object)!;
    if (!objMap.has(eventType)) {
      objMap.set(eventType, []);
    }
    objMap.get(eventType)!.push(handler);
  }

  /** Remove an event handler */
  off(object: Object3D, eventType: string, handler: UIEventHandler): void {
    const objMap = this._handlers.get(object);
    if (!objMap) return;
    const list = objMap.get(eventType);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  /** Dispatch an event on a target with bubbling up the parent chain */
  dispatch(target: Object3D, eventType: string, pointer: PointerEventData | null): void {
    // Build path from target to root
    const path: Object3D[] = [];
    let current: Object3D | null = target;
    while (current) {
      path.push(current);
      current = current.parent;
    }

    const event: UIEvent = {
      type: eventType,
      target,
      currentTarget: target,
      pointer,
      stopped: false,
      stopPropagation() {
        this.stopped = true;
      },
    };

    // Bubble phase: target first, then ancestors
    for (const obj of path) {
      if (event.stopped) break;
      event.currentTarget = obj;
      const handlers = this._handlers.get(obj)?.get(eventType);
      if (handlers) {
        for (const handler of handlers) {
          handler(event);
          if (event.stopped) break;
        }
      }
    }
  }

  /** Raycast from screen coords and return the first interactive hit */
  hitTest(
    screenX: number,
    screenY: number,
    canvasWidth: number,
    canvasHeight: number,
    camera: OrthographicCamera,
    scene: Scene,
  ): Object3D | null {
    this._ndc.x = (screenX / canvasWidth) * 2 - 1;
    this._ndc.y = -(screenY / canvasHeight) * 2 + 1;
    this._raycaster.setFromCamera(this._ndc, camera);
    const intersects = this._raycaster.intersectObjects(scene.children, true);
    for (const hit of intersects) {
      if (hit.object.userData.interactive) {
        return hit.object;
      }
    }
    return null;
  }

  /** Clear all handlers */
  dispose(): void {
    this._handlers.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/event-system.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/event-system.ts packages/os/__tests__/engine/event-system.test.ts
git commit -m "feat(os): add EventSystem with raycaster hit-test and event bubbling"
```

---

### Task 6: GestureRecognizer — Tap/Drag/Swipe/Long-Press

**Files:**
- Create: `packages/os/__tests__/engine/gesture-recognizer.test.ts`
- Create: `packages/os/src/engine/gesture-recognizer.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/gesture-recognizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GestureRecognizer } from "../../src/engine/gesture-recognizer";
import type { GestureEvent } from "../../src/types";

function makePointerEvent(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    bubbles: true,
  });
}

describe("GestureRecognizer", () => {
  let canvas: HTMLCanvasElement;
  let recognizer: GestureRecognizer;
  let handler: ReturnType<typeof vi.fn<[GestureEvent], void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = vi.fn(() => ({
      x: 0, y: 0, width: 800, height: 600,
      top: 0, left: 0, right: 800, bottom: 600,
      toJSON: () => {},
    }));
    recognizer = new GestureRecognizer(canvas);
    handler = vi.fn();
  });

  afterEach(() => {
    recognizer.dispose();
    vi.useRealTimers();
  });

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
    // After crossing 10px threshold
    const dragEvents = handler.mock.calls.filter((c) => c[0].type === "drag");
    expect(dragEvents.length).toBeGreaterThan(0);
  });

  it("emits swipe for fast horizontal movement", () => {
    recognizer.onGesture(handler);
    canvas.dispatchEvent(makePointerEvent("pointerdown", 100, 300));
    // Fast move to the right
    canvas.dispatchEvent(makePointerEvent("pointermove", 300, 300));
    canvas.dispatchEvent(makePointerEvent("pointerup", 300, 300));
    const swipes = handler.mock.calls.filter((c) => c[0].type === "swipe");
    expect(swipes.length).toBe(1);
    expect(swipes[0][0].direction).toBe("right");
  });

  it("emits long-press after hold duration", () => {
    recognizer.onGesture(handler);
    canvas.dispatchEvent(makePointerEvent("pointerdown", 100, 100));
    vi.advanceTimersByTime(600);
    const longPress = handler.mock.calls.filter((c) => c[0].type === "long-press");
    expect(longPress.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/gesture-recognizer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/gesture-recognizer.ts`:

```typescript
import { Vector2 } from "three";
import type { GestureEvent, GestureType, SwipeDirection } from "../types";

type GestureHandler = (event: GestureEvent) => void;

const DRAG_THRESHOLD = 10; // px
const LONG_PRESS_DURATION = 500; // ms
const SWIPE_MIN_VELOCITY = 0.3; // px/ms
const SWIPE_MIN_DISTANCE = 50; // px

export class GestureRecognizer {
  private _canvas: HTMLCanvasElement;
  private _handlers: GestureHandler[] = [];
  private _isDown = false;
  private _startPos = new Vector2();
  private _startTime = 0;
  private _isDragging = false;
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastPos = new Vector2();

  private _onPointerDown: (e: PointerEvent) => void;
  private _onPointerMove: (e: PointerEvent) => void;
  private _onPointerUp: (e: PointerEvent) => void;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;

    this._onPointerDown = this._handleDown.bind(this);
    this._onPointerMove = this._handleMove.bind(this);
    this._onPointerUp = this._handleUp.bind(this);

    canvas.addEventListener("pointerdown", this._onPointerDown);
    canvas.addEventListener("pointermove", this._onPointerMove);
    canvas.addEventListener("pointerup", this._onPointerUp);
  }

  onGesture(handler: GestureHandler): void {
    this._handlers.push(handler);
  }

  offGesture(handler: GestureHandler): void {
    const idx = this._handlers.indexOf(handler);
    if (idx !== -1) this._handlers.splice(idx, 1);
  }

  dispose(): void {
    this._canvas.removeEventListener("pointerdown", this._onPointerDown);
    this._canvas.removeEventListener("pointermove", this._onPointerMove);
    this._canvas.removeEventListener("pointerup", this._onPointerUp);
    this._clearLongPress();
    this._handlers.length = 0;
  }

  private _emit(
    type: GestureType,
    position: Vector2,
    domEvent: PointerEvent,
    direction?: SwipeDirection,
  ): void {
    const now = performance.now();
    const delta = position.clone().sub(this._startPos);
    const duration = now - this._startTime;
    const velocity = duration > 0
      ? new Vector2(delta.x / duration, delta.y / duration)
      : new Vector2();

    const event: GestureEvent = {
      type,
      startPosition: this._startPos.clone(),
      position: position.clone(),
      delta,
      direction,
      velocity,
      duration,
      domEvent,
    };
    for (const handler of this._handlers) {
      handler(event);
    }
  }

  private _handleDown(e: PointerEvent): void {
    this._isDown = true;
    this._isDragging = false;
    const rect = this._canvas.getBoundingClientRect();
    this._startPos.set(e.clientX - rect.left, e.clientY - rect.top);
    this._lastPos.copy(this._startPos);
    this._startTime = performance.now();

    this._longPressTimer = setTimeout(() => {
      if (this._isDown && !this._isDragging) {
        this._emit("long-press", this._lastPos, e);
      }
    }, LONG_PRESS_DURATION);
  }

  private _handleMove(e: PointerEvent): void {
    if (!this._isDown) return;
    const rect = this._canvas.getBoundingClientRect();
    const pos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    this._lastPos.copy(pos);

    const dist = pos.distanceTo(this._startPos);
    if (dist > DRAG_THRESHOLD) {
      this._clearLongPress();
      this._isDragging = true;
      this._emit("drag", pos, e);
    }
  }

  private _handleUp(e: PointerEvent): void {
    if (!this._isDown) return;
    this._isDown = false;
    this._clearLongPress();

    const rect = this._canvas.getBoundingClientRect();
    const pos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    const delta = pos.clone().sub(this._startPos);
    const duration = performance.now() - this._startTime;
    const distance = delta.length();

    if (this._isDragging && distance >= SWIPE_MIN_DISTANCE) {
      const velocity = duration > 0 ? distance / duration : 0;
      if (velocity >= SWIPE_MIN_VELOCITY) {
        const direction = this._getSwipeDirection(delta);
        this._emit("swipe", pos, e, direction);
        this._isDragging = false;
        return;
      }
    }

    if (!this._isDragging) {
      this._emit("tap", pos, e);
    }
    this._isDragging = false;
  }

  private _getSwipeDirection(delta: Vector2): SwipeDirection {
    if (Math.abs(delta.x) > Math.abs(delta.y)) {
      return delta.x > 0 ? "right" : "left";
    }
    return delta.y > 0 ? "down" : "up";
  }

  private _clearLongPress(): void {
    if (this._longPressTimer !== null) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/gesture-recognizer.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/gesture-recognizer.ts packages/os/__tests__/engine/gesture-recognizer.test.ts
git commit -m "feat(os): add GestureRecognizer for tap/drag/swipe/long-press"
```

---

### Task 7: InputManager — Hidden Textarea + IME

**Files:**
- Create: `packages/os/__tests__/engine/input-manager.test.ts`
- Create: `packages/os/src/engine/input-manager.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/input-manager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InputManager } from "../../src/engine/input-manager";

describe("InputManager", () => {
  let canvas: HTMLCanvasElement;
  let textarea: HTMLTextAreaElement;
  let inputManager: InputManager;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    canvas.tabIndex = 0;
    textarea = document.createElement("textarea");
    document.body.appendChild(canvas);
    document.body.appendChild(textarea);
    inputManager = new InputManager(canvas, textarea);
  });

  it("focuses textarea when activated", () => {
    const focusSpy = vi.spyOn(textarea, "focus");
    inputManager.activate();
    expect(focusSpy).toHaveBeenCalled();
  });

  it("deactivates and clears textarea", () => {
    inputManager.activate();
    textarea.value = "hello";
    inputManager.deactivate();
    expect(textarea.value).toBe("");
  });

  it("calls text handler on input event", () => {
    const handler = vi.fn();
    inputManager.onTextInput(handler);
    inputManager.activate();
    textarea.value = "a";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    expect(handler).toHaveBeenCalledWith("a");
  });

  it("calls keyboard handler on keydown", () => {
    const handler = vi.fn();
    inputManager.onKeyDown(handler);
    canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("tracks IME composition state", () => {
    const handler = vi.fn();
    inputManager.onIMEComposition(handler);
    inputManager.activate();
    textarea.dispatchEvent(new CompositionEvent("compositionstart"));
    expect(handler).toHaveBeenCalledWith({ isComposing: true, compositionText: "" });
    textarea.dispatchEvent(new CompositionEvent("compositionend", { data: "你好" }));
    expect(handler).toHaveBeenCalledWith({ isComposing: false, compositionText: "你好" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/input-manager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/input-manager.ts`:

```typescript
import type {
  KeyboardHandler,
  TextInputHandler,
  IMECompositionHandler,
  IMECompositionState,
} from "../types";

export class InputManager {
  private _canvas: HTMLCanvasElement;
  private _textarea: HTMLTextAreaElement;
  private _active = false;
  private _textHandlers: TextInputHandler[] = [];
  private _keyDownHandlers: KeyboardHandler[] = [];
  private _keyUpHandlers: KeyboardHandler[] = [];
  private _imeHandlers: IMECompositionHandler[] = [];

  private _onInput: () => void;
  private _onCompositionStart: () => void;
  private _onCompositionEnd: (e: CompositionEvent) => void;
  private _onKeyDown: (e: KeyboardEvent) => void;
  private _onKeyUp: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement, textarea: HTMLTextAreaElement) {
    this._canvas = canvas;
    this._textarea = textarea;

    this._onInput = () => {
      if (!this._active) return;
      const value = this._textarea.value;
      if (value) {
        for (const h of this._textHandlers) h(value);
        this._textarea.value = "";
      }
    };

    this._onCompositionStart = () => {
      const state: IMECompositionState = { isComposing: true, compositionText: "" };
      for (const h of this._imeHandlers) h(state);
    };

    this._onCompositionEnd = (e: CompositionEvent) => {
      const state: IMECompositionState = { isComposing: false, compositionText: e.data ?? "" };
      for (const h of this._imeHandlers) h(state);
    };

    this._onKeyDown = (e: KeyboardEvent) => {
      for (const h of this._keyDownHandlers) h(e);
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      for (const h of this._keyUpHandlers) h(e);
    };

    textarea.addEventListener("input", this._onInput);
    textarea.addEventListener("compositionstart", this._onCompositionStart);
    textarea.addEventListener("compositionend", this._onCompositionEnd as EventListener);
    canvas.addEventListener("keydown", this._onKeyDown);
    canvas.addEventListener("keyup", this._onKeyUp);
  }

  get isActive(): boolean {
    return this._active;
  }

  /** Activate text input — focus hidden textarea for IME */
  activate(): void {
    this._active = true;
    this._textarea.focus();
  }

  /** Deactivate text input — blur and clear textarea */
  deactivate(): void {
    this._active = false;
    this._textarea.value = "";
    this._textarea.blur();
  }

  onTextInput(handler: TextInputHandler): void {
    this._textHandlers.push(handler);
  }

  onKeyDown(handler: KeyboardHandler): void {
    this._keyDownHandlers.push(handler);
  }

  onKeyUp(handler: KeyboardHandler): void {
    this._keyUpHandlers.push(handler);
  }

  onIMEComposition(handler: IMECompositionHandler): void {
    this._imeHandlers.push(handler);
  }

  dispose(): void {
    this._textarea.removeEventListener("input", this._onInput);
    this._textarea.removeEventListener("compositionstart", this._onCompositionStart);
    this._textarea.removeEventListener("compositionend", this._onCompositionEnd as EventListener);
    this._canvas.removeEventListener("keydown", this._onKeyDown);
    this._canvas.removeEventListener("keyup", this._onKeyUp);
    this._textHandlers.length = 0;
    this._keyDownHandlers.length = 0;
    this._keyUpHandlers.length = 0;
    this._imeHandlers.length = 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/input-manager.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/input-manager.ts packages/os/__tests__/engine/input-manager.test.ts
git commit -m "feat(os): add InputManager with hidden textarea IME support"
```

---

### Task 8: ResourceLoader — Async Loading + Cache

**Files:**
- Create: `packages/os/__tests__/engine/resource-loader.test.ts`
- Create: `packages/os/src/engine/resource-loader.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/os/__tests__/engine/resource-loader.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Texture } from "three";
import { ResourceLoader } from "../../src/engine/resource-loader";

// Mock TextureLoader
vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  return {
    ...actual,
    TextureLoader: vi.fn().mockImplementation(() => ({
      loadAsync: vi.fn().mockResolvedValue(new actual.Texture()),
    })),
  };
});

describe("ResourceLoader", () => {
  let loader: ResourceLoader;

  beforeEach(() => {
    loader = new ResourceLoader();
  });

  it("loads a texture and caches it", async () => {
    const tex = await loader.loadTexture("/test.png");
    expect(tex).toBeInstanceOf(Texture);
    // Second load returns same instance
    const tex2 = await loader.loadTexture("/test.png");
    expect(tex2).toBe(tex);
  });

  it("reports loading state", async () => {
    expect(loader.isLoading).toBe(false);
    const promise = loader.loadTexture("/test.png");
    // After await, loading is done
    await promise;
    expect(loader.isLoading).toBe(false);
  });

  it("disposes all cached resources", async () => {
    const tex = await loader.loadTexture("/test.png");
    const disposeSpy = vi.spyOn(tex, "dispose");
    loader.dispose();
    expect(disposeSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/resource-loader.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/os/src/engine/resource-loader.ts`:

```typescript
import { TextureLoader, Texture } from "three";

export class ResourceLoader {
  private _textureLoader = new TextureLoader();
  private _textureCache = new Map<string, Texture>();
  private _pendingCount = 0;

  get isLoading(): boolean {
    return this._pendingCount > 0;
  }

  async loadTexture(url: string): Promise<Texture> {
    const cached = this._textureCache.get(url);
    if (cached) return cached;

    this._pendingCount++;
    try {
      const texture = await this._textureLoader.loadAsync(url);
      this._textureCache.set(url, texture);
      return texture;
    } finally {
      this._pendingCount--;
    }
  }

  /** Get a cached texture (returns undefined if not loaded) */
  getTexture(url: string): Texture | undefined {
    return this._textureCache.get(url);
  }

  /** Dispose all cached textures */
  dispose(): void {
    for (const tex of this._textureCache.values()) {
      tex.dispose();
    }
    this._textureCache.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /root/viben/packages/os && pnpm test -- __tests__/engine/resource-loader.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/os/src/engine/resource-loader.ts packages/os/__tests__/engine/resource-loader.test.ts
git commit -m "feat(os): add ResourceLoader with async texture loading and cache"
```

---

### Task 9: Desktop Integration — OsPage + Route

**Files:**
- Create: `apps/desktop/src/pages/os.tsx`
- Modify: `apps/desktop/src/pages/index.ts:31` — add OsPage export
- Modify: `apps/desktop/src/App.tsx:6,37,92` — add import + route
- Modify: `apps/desktop/package.json` — add @viben/os dependency

- [ ] **Step 1: Add `@viben/os` to desktop dependencies**

Add to `apps/desktop/package.json` dependencies section:

```json
"@viben/os": "workspace:*",
```

- [ ] **Step 2: Create `apps/desktop/src/pages/os.tsx`**

```typescript
import { useEffect, useRef } from "react";
import { Renderer, RenderScheduler } from "@viben/os";

export function OsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const renderer = new Renderer(canvas);

    (async () => {
      await renderer.init();
      if (disposed) {
        renderer.dispose();
        return;
      }

      renderer.resize(window.innerWidth, window.innerHeight);

      const scheduler = new RenderScheduler((dt) => {
        renderer.render();
      });
      scheduler.markDirty();

      const onResize = () => {
        renderer.resize(window.innerWidth, window.innerHeight);
        scheduler.markDirty();
      };
      window.addEventListener("resize", onResize);

      // Store for cleanup
      (canvas as any).__os_cleanup = () => {
        window.removeEventListener("resize", onResize);
        scheduler.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      (canvas as any).__os_cleanup?.();
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <textarea
        ref={textareaRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add export to `apps/desktop/src/pages/index.ts`**

Add this line after the last export (line 31, before the `// Note:` comments):

```typescript
export { OsPage } from "./os";
```

- [ ] **Step 4: Add import and route to `apps/desktop/src/App.tsx`**

Add `OsPage` to the imports from `@/pages` (line 6):

```typescript
  // Add OsPage to the existing import destructure
  OsPage,
```

Add the route inside `<Route path="/" element={<AppLayout />}>`, after line 92 (after `<Route path="inspector" ...>`):

```tsx
          {/* OS - iPad-style GPU-rendered OS */}
          <Route path="os" element={<OsPage />} />
```

- [ ] **Step 5: Install new dependencies**

Run: `cd /root/viben && pnpm install`
Expected: `@viben/os` linked into workspace.

- [ ] **Step 6: Build the os package**

Run: `cd /root/viben/packages/os && pnpm build`
Expected: Builds successfully, `dist/` created.

- [ ] **Step 7: Verify desktop typecheck**

Run: `cd /root/viben/apps/desktop && pnpm typecheck`
Expected: No type errors (or pre-existing errors only).

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/pages/os.tsx apps/desktop/src/pages/index.ts apps/desktop/src/App.tsx apps/desktop/package.json packages/os/ pnpm-lock.yaml
git commit -m "feat(os): integrate @viben/os into desktop app at /os route"
```

---

### Task 10: Smoke Test — End-to-End Verification

**Files:** None — this is a verification task.

- [ ] **Step 1: Run all unit tests**

Run: `cd /root/viben/packages/os && pnpm test`
Expected: All tests PASS (renderer, render-scheduler, rtt-pool, event-system, gesture-recognizer, input-manager, resource-loader).

- [ ] **Step 2: Build the full workspace**

Run: `cd /root/viben && pnpm build`
Expected: All packages build successfully, including `@viben/os`.

- [ ] **Step 3: Verify package exports**

Run: `cd /root/viben/packages/os && node -e "const os = require('./dist/index.js'); console.log(Object.keys(os))"`
Expected: Prints array including `Renderer`, `RenderScheduler`, `RTTPool`, `EventSystem`, `GestureRecognizer`, `InputManager`, `ResourceLoader`.

- [ ] **Step 4: Commit if any fixes were needed**

If any fixes were required in steps 1-3, commit them:

```bash
git add -A
git commit -m "fix(os): resolve smoke test issues"
```
