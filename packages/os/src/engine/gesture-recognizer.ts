import { Vector2 } from "three";
import type { GestureEvent, GestureType, SwipeDirection } from "../types";

type GestureHandler = (event: GestureEvent) => void;

const DRAG_THRESHOLD = 10;
const LONG_PRESS_DURATION = 500;
const SWIPE_MIN_VELOCITY = 0.3;
const SWIPE_MIN_DISTANCE = 50;

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

  onGesture(handler: GestureHandler): void { this._handlers.push(handler); }

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

  private _emit(type: GestureType, position: Vector2, domEvent: PointerEvent, direction?: SwipeDirection): void {
    const now = performance.now();
    const delta = position.clone().sub(this._startPos);
    const duration = now - this._startTime;
    const velocity = duration > 0 ? new Vector2(delta.x / duration, delta.y / duration) : new Vector2();
    const event: GestureEvent = { type, startPosition: this._startPos.clone(), position: position.clone(), delta, direction, velocity, duration, domEvent };
    for (const handler of this._handlers) handler(event);
  }

  private _handleDown(e: PointerEvent): void {
    this._isDown = true;
    this._isDragging = false;
    const rect = this._canvas.getBoundingClientRect();
    this._startPos.set(e.clientX - rect.left, e.clientY - rect.top);
    this._lastPos.copy(this._startPos);
    this._startTime = performance.now();
    this._longPressTimer = setTimeout(() => {
      if (this._isDown && !this._isDragging) this._emit("long-press", this._lastPos, e);
    }, LONG_PRESS_DURATION);
  }

  private _handleMove(e: PointerEvent): void {
    if (!this._isDown) return;
    const rect = this._canvas.getBoundingClientRect();
    const pos = new Vector2(e.clientX - rect.left, e.clientY - rect.top);
    this._lastPos.copy(pos);
    if (pos.distanceTo(this._startPos) > DRAG_THRESHOLD) {
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
      const velocity = duration > 0 ? distance / duration : Infinity;
      if (velocity >= SWIPE_MIN_VELOCITY) {
        const direction = this._getSwipeDirection(delta);
        this._emit("swipe", pos, e, direction);
        this._isDragging = false;
        return;
      }
    }
    if (!this._isDragging) this._emit("tap", pos, e);
    this._isDragging = false;
  }

  private _getSwipeDirection(delta: Vector2): SwipeDirection {
    return Math.abs(delta.x) > Math.abs(delta.y)
      ? (delta.x > 0 ? "right" : "left")
      : (delta.y > 0 ? "down" : "up");
  }

  private _clearLongPress(): void {
    if (this._longPressTimer !== null) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
  }
}
