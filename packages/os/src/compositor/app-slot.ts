import {
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh,
  DoubleSide,
} from "three";
import type { WebGLRenderTarget, Scene, OrthographicCamera } from "three";
import { Spring } from "../ui/animation/spring";
import type { AppSlotConfig, AppSlotState } from "./compositor-types";

const _unitPlane = new PlaneGeometry(1, 1);

export class AppSlot {
  readonly id: string;
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  readonly appScene: Scene;
  readonly appCamera: OrthographicCamera;
  readonly renderTarget: WebGLRenderTarget;

  private _springX: Spring;
  private _springY: Spring;
  private _springWidth: Spring;
  private _springHeight: Spring;
  private _springOpacity: Spring;
  private _springRadius: Spring;

  private _currentState: AppSlotState;

  constructor(config: AppSlotConfig) {
    this.id = config.id;
    this.appScene = config.scene;
    this.appCamera = config.camera;
    this.renderTarget = config.renderTarget;

    this.material = new MeshBasicMaterial({
      map: config.renderTarget.texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });

    this.mesh = new Mesh(_unitPlane, this.material);
    this.mesh.frustumCulled = false;

    const s = config.state;
    this._currentState = { ...s };

    this._springX = new Spring({ from: s.x, to: s.x });
    this._springY = new Spring({ from: s.y, to: s.y });
    this._springWidth = new Spring({ from: s.width, to: s.width });
    this._springHeight = new Spring({ from: s.height, to: s.height });
    this._springOpacity = new Spring({ from: s.opacity, to: s.opacity });
    this._springRadius = new Spring({ from: s.radius, to: s.radius });

    // Tick once so springs at rest (from === to) immediately report done
    this._springX.update(0);
    this._springY.update(0);
    this._springWidth.update(0);
    this._springHeight.update(0);
    this._springOpacity.update(0);
    this._springRadius.update(0);

    this._applyState(s);
  }

  get currentState(): Readonly<AppSlotState> { return this._currentState; }

  get isAnimating(): boolean {
    return (
      !this._springX.done ||
      !this._springY.done ||
      !this._springWidth.done ||
      !this._springHeight.done ||
      !this._springOpacity.done ||
      !this._springRadius.done
    );
  }

  setTargetState(state: Partial<AppSlotState>): void {
    if (state.x !== undefined) this._springX.setTarget(state.x);
    if (state.y !== undefined) this._springY.setTarget(state.y);
    if (state.width !== undefined) this._springWidth.setTarget(state.width);
    if (state.height !== undefined) this._springHeight.setTarget(state.height);
    if (state.opacity !== undefined) this._springOpacity.setTarget(state.opacity);
    if (state.radius !== undefined) this._springRadius.setTarget(state.radius);
    if (state.zIndex !== undefined) this._currentState.zIndex = state.zIndex;
    if (state.visible !== undefined) this._currentState.visible = state.visible;
  }

  snapToState(state: Partial<AppSlotState>): void {
    if (state.x !== undefined) this._springX.reset(state.x, state.x);
    if (state.y !== undefined) this._springY.reset(state.y, state.y);
    if (state.width !== undefined) this._springWidth.reset(state.width, state.width);
    if (state.height !== undefined) this._springHeight.reset(state.height, state.height);
    if (state.opacity !== undefined) this._springOpacity.reset(state.opacity, state.opacity);
    if (state.radius !== undefined) this._springRadius.reset(state.radius, state.radius);
    if (state.zIndex !== undefined) this._currentState.zIndex = state.zIndex;
    if (state.visible !== undefined) this._currentState.visible = state.visible;

    this._currentState.x = this._springX.value;
    this._currentState.y = this._springY.value;
    this._currentState.width = this._springWidth.value;
    this._currentState.height = this._springHeight.value;
    this._currentState.opacity = this._springOpacity.value;
    this._currentState.radius = this._springRadius.value;

    this._applyState(this._currentState);
  }

  update(dt: number): void {
    this._springX.update(dt);
    this._springY.update(dt);
    this._springWidth.update(dt);
    this._springHeight.update(dt);
    this._springOpacity.update(dt);
    this._springRadius.update(dt);

    this._currentState.x = this._springX.value;
    this._currentState.y = this._springY.value;
    this._currentState.width = this._springWidth.value;
    this._currentState.height = this._springHeight.value;
    this._currentState.opacity = this._springOpacity.value;
    this._currentState.radius = this._springRadius.value;

    this._applyState(this._currentState);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.material.dispose();
  }

  private _applyState(s: AppSlotState): void {
    this.mesh.position.set(s.x + s.width / 2, -(s.y + s.height / 2), s.zIndex);
    this.mesh.scale.set(s.width, s.height, 1);
    this.material.opacity = s.opacity;
    this.mesh.visible = s.visible;
  }
}
