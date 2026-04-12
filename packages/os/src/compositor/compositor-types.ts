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
