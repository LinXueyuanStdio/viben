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

    // Wire up system gestures
    this._gestureRouter.onSystemGesture((evt) => {
      switch (evt.action) {
        case "home":
          this.setMode("HOME");
          break;
        case "control-center":
          this.setMode("CONTROL_CENTER");
          break;
      }
    });

    // Wire up multitask view
    this._multitaskView.onSelectApp((appId) => {
      this._focusedAppId = appId;
      this.setMode("FULLSCREEN");
    });

    this._multitaskView.onDismissApp((appId) => {
      this.closeApp(appId);
    });
  }

  get mode(): CompositorMode {
    return this._mode;
  }

  get focusedAppId(): string | null {
    return this._focusedAppId;
  }

  hasApp(id: string): boolean {
    return this._slots.has(id);
  }

  getSlot(id: string): AppSlot | undefined {
    return this._slots.get(id);
  }

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
        x: 0,
        y: 0,
        width: this._screenWidth,
        height: this._screenHeight,
        opacity: 0,
        radius: 0,
        zIndex: 2,
        visible: true,
      },
    });
    this._slots.set(id, slot);
    this.appLayer.add(slot.mesh);
    this._focusedAppId = id;

    const prevMode = this._mode;
    this._mode = "FULLSCREEN";
    this._transitionEngine.transition(
      "FULLSCREEN",
      this._slotsArray(),
      id,
    );
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
      this._focusedAppId =
        this._slots.size > 0 ? this._slots.keys().next().value! : null;
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
      // Use material.map as the texture snapshot from each slot
      const snapshots = this._slotsArray().map((s) => ({
        id: s.id,
        texture: s.material.map!,
      }));
      this._multitaskView.setCards(snapshots);
    }

    this._transitionEngine.transition(
      mode,
      this._slotsArray(),
      this._focusedAppId ?? undefined,
    );
    this._emitEvent({ type: "mode-change", mode, prevMode });
  }

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
