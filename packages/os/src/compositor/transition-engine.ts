import type { AppSlot } from "./app-slot";
import type { CompositorMode, AppSlotState } from "./compositor-types";

export interface TransitionEngineConfig {
  screenWidth: number;
  screenHeight: number;
}

export type TransitionEndHandler = () => void;

export class TransitionEngine {
  private _screenWidth: number;
  private _screenHeight: number;
  private _animating = false;
  private _slots: AppSlot[] = [];
  private _handlers: Set<TransitionEndHandler> = new Set();

  constructor(config: TransitionEngineConfig) {
    this._screenWidth = config.screenWidth;
    this._screenHeight = config.screenHeight;
  }

  get isAnimating(): boolean {
    return this._animating;
  }

  transition(
    mode: CompositorMode,
    slots: AppSlot[],
    focusedAppId?: string,
  ): void {
    this._slots = slots;
    const layout = this._computeLayout(mode, slots, focusedAppId);

    for (let i = 0; i < slots.length; i++) {
      slots[i].setTargetState(layout[i]);
    }

    this._animating = true;
  }

  update(dt: number): void {
    if (!this._animating) return;

    for (const slot of this._slots) {
      slot.update(dt);
    }

    const allSettled = this._slots.every((s) => !s.isAnimating);
    if (allSettled) {
      this._animating = false;
      for (const handler of this._handlers) {
        handler();
      }
    }
  }

  resize(w: number, h: number): void {
    this._screenWidth = w;
    this._screenHeight = h;
  }

  onTransitionEnd(handler: TransitionEndHandler): void {
    this._handlers.add(handler);
  }

  offTransitionEnd(handler: TransitionEndHandler): void {
    this._handlers.delete(handler);
  }

  dispose(): void {
    this._handlers.clear();
    this._slots = [];
    this._animating = false;
  }

  private _computeLayout(
    mode: CompositorMode,
    slots: AppSlot[],
    focusedAppId?: string,
  ): AppSlotState[] {
    const w = this._screenWidth;
    const h = this._screenHeight;
    const result: AppSlotState[] = [];

    switch (mode) {
      case "FULLSCREEN": {
        for (const slot of slots) {
          if (slot.id === focusedAppId) {
            result.push({
              x: 0,
              y: 0,
              width: w,
              height: h,
              opacity: 1,
              radius: 0,
              zIndex: 2,
              visible: true,
            });
          } else {
            result.push({
              x: 0,
              y: 0,
              width: w,
              height: h,
              opacity: 0,
              radius: 0,
              zIndex: 1,
              visible: false,
            });
          }
        }
        break;
      }

      case "HOME": {
        for (let i = 0; i < slots.length; i++) {
          result.push({
            x: w * 0.25,
            y: h * 0.25,
            width: w * 0.5,
            height: h * 0.5,
            opacity: 0,
            radius: 12,
            zIndex: 1,
            visible: false,
          });
        }
        break;
      }

      case "SPLIT": {
        const halfW = Math.floor(w / 2);
        for (let i = 0; i < slots.length; i++) {
          if (i === 0) {
            result.push({
              x: 0,
              y: 0,
              width: halfW,
              height: h,
              opacity: 1,
              radius: 0,
              zIndex: 2,
              visible: true,
            });
          } else if (i === 1) {
            result.push({
              x: halfW,
              y: 0,
              width: halfW,
              height: h,
              opacity: 1,
              radius: 0,
              zIndex: 2,
              visible: true,
            });
          } else {
            result.push({
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              opacity: 0,
              radius: 0,
              zIndex: 0,
              visible: false,
            });
          }
        }
        break;
      }

      case "SLIDE_OVER": {
        const panelW = Math.floor(w * 0.4);
        for (let i = 0; i < slots.length; i++) {
          if (i === 0) {
            result.push({
              x: 0,
              y: 0,
              width: w,
              height: h,
              opacity: 1,
              radius: 0,
              zIndex: 2,
              visible: true,
            });
          } else if (i === 1) {
            result.push({
              x: w - panelW,
              y: 0,
              width: panelW,
              height: h,
              opacity: 1,
              radius: 12,
              zIndex: 3,
              visible: true,
            });
          } else {
            result.push({
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              opacity: 0,
              radius: 0,
              zIndex: 0,
              visible: false,
            });
          }
        }
        break;
      }

      case "MULTITASK": {
        const cardW = Math.floor(w * 0.6);
        const cardH = Math.floor(h * 0.6);
        for (let i = 0; i < slots.length; i++) {
          result.push({
            x: Math.floor(w * 0.2) + i * (cardW + 20),
            y: Math.floor(h * 0.2),
            width: cardW,
            height: cardH,
            opacity: 1,
            radius: 12,
            zIndex: 5,
            visible: true,
          });
        }
        break;
      }

      case "CONTROL_CENTER": {
        for (const slot of slots) {
          if (slot.id === focusedAppId) {
            result.push({
              x: 0,
              y: 0,
              width: w,
              height: h,
              opacity: 0.3,
              radius: 0,
              zIndex: 2,
              visible: true,
            });
          } else {
            result.push({
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              opacity: 0,
              radius: 0,
              zIndex: 0,
              visible: false,
            });
          }
        }
        break;
      }
    }

    return result;
  }
}
