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
