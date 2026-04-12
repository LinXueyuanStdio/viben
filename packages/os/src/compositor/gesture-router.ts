import type { GestureEvent } from "../types";

/** System-level gesture actions recognized by the compositor */
export type SystemGestureAction = "home" | "multitask" | "control-center" | "back";

/** Event emitted when a system gesture is detected */
export interface SystemGestureEvent {
  action: SystemGestureAction;
  gesture: GestureEvent;
}

/** Configuration for the GestureRouter screen zones */
export interface GestureRouterConfig {
  screenWidth: number;
  screenHeight: number;
  /** Height of the bottom zone in pixels (default 20) */
  bottomZone?: number;
  /** Width of the left/right edge zone in pixels (default 20) */
  edgeZone?: number;
  /** Height of the top zone in pixels (default 30) */
  topZone?: number;
  /** Fraction of screen width for the top-right control-center zone (default 0.33) */
  topRightFraction?: number;
}

export type SystemGestureHandler = (event: SystemGestureEvent) => void;

/**
 * GestureRouter intercepts system-level gestures in reserved screen zones
 * and routes them as compositor events. Non-system gestures pass through.
 */
export class GestureRouter {
  private screenWidth: number;
  private screenHeight: number;
  private bottomZone: number;
  private edgeZone: number;
  private topZone: number;
  private topRightFraction: number;
  private handlers: Set<SystemGestureHandler> = new Set();

  constructor(config: GestureRouterConfig) {
    this.screenWidth = config.screenWidth;
    this.screenHeight = config.screenHeight;
    this.bottomZone = config.bottomZone ?? 20;
    this.edgeZone = config.edgeZone ?? 20;
    this.topZone = config.topZone ?? 30;
    this.topRightFraction = config.topRightFraction ?? 0.33;
  }

  /**
   * Route a gesture event. Returns true if the gesture was consumed
   * as a system gesture, false if it should pass through.
   */
  route(gesture: GestureEvent): boolean {
    // Only swipe gestures can be system gestures
    if (gesture.type !== "swipe") {
      return false;
    }

    const startX = gesture.startPosition.x;
    const startY = gesture.startPosition.y;

    // Bottom zone swipe-up -> "home"
    if (
      startY >= this.screenHeight - this.bottomZone &&
      gesture.direction === "up"
    ) {
      this.emit({ action: "home", gesture });
      return true;
    }

    // Top-right zone swipe-down -> "control-center"
    if (
      startY <= this.topZone &&
      startX >= this.screenWidth * (1 - this.topRightFraction) &&
      gesture.direction === "down"
    ) {
      this.emit({ action: "control-center", gesture });
      return true;
    }

    // Left edge swipe-right -> "back"
    if (startX <= this.edgeZone && gesture.direction === "right") {
      this.emit({ action: "back", gesture });
      return true;
    }

    return false;
  }

  /** Register a handler for system gesture events */
  onSystemGesture(handler: SystemGestureHandler): void {
    this.handlers.add(handler);
  }

  /** Unregister a handler for system gesture events */
  offSystemGesture(handler: SystemGestureHandler): void {
    this.handlers.delete(handler);
  }

  /** Update screen dimensions (e.g. on window resize) */
  resize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /** Dispose the router and clear all handlers */
  dispose(): void {
    this.handlers.clear();
  }

  private emit(event: SystemGestureEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
