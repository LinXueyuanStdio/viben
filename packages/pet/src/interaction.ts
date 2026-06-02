import type { PetInteraction } from './types';

/** Minimum pixel distance before a drag gesture is classified. */
export const DRAG_GESTURE_MIN_PX = 14;

/** Axis bias multiplier - horizontal wins over vertical at this ratio. */
export const DRAG_AXIS_BIAS = 1.18;

/** Maps each interaction state to its preferred animation id. */
const INTERACTION_TO_ANIMATION: Record<PetInteraction, string> = {
  idle: 'idle',
  hover: 'waving',
  'drag-right': 'running-right',
  'drag-left': 'running-left',
  'drag-up': 'jumping',
  'drag-down': 'waving',
  waiting: 'waiting',
};

/**
 * Returns the animation id that should play for the given interaction state.
 */
export function getAnimationIdForInteraction(interaction: PetInteraction): string {
  return INTERACTION_TO_ANIMATION[interaction];
}

/**
 * Classifies a drag delta (dx, dy) into a directional PetInteraction.
 * Returns null when the movement is below the minimum threshold.
 */
export function classifyDragDirection(
  dx: number,
  dy: number,
  minPx: number = DRAG_GESTURE_MIN_PX,
  axisBias: number = DRAG_AXIS_BIAS,
): PetInteraction | null {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < minPx) return null;

  // Determine if the gesture is primarily horizontal or vertical.
  // The axis bias makes horizontal gestures slightly easier to trigger.
  const isHorizontal = absDx >= absDy * axisBias;

  if (isHorizontal) {
    return dx > 0 ? 'drag-right' : 'drag-left';
  }
  return dy < 0 ? 'drag-up' : 'drag-down';
}

/**
 * Resolves the next interaction state based on the current state,
 * an incoming event, and whether the user is currently dragging.
 */
export function resolveInteraction(
  current: PetInteraction,
  event: string,
  isDragging: boolean,
): PetInteraction {
  switch (event) {
    case 'pointerenter':
      return 'hover';
    case 'pointerleave':
      if (isDragging) return current;
      return 'idle';
    case 'dragend':
      return 'idle';
    case 'waiting':
      return 'waiting';
    case 'wake':
      return 'idle';
    default:
      return current;
  }
}
