import type { PetAnimationDef, PetAtlasLayout } from './types';

/**
 * CSS style properties for rendering a sprite animation.
 */
export interface AnimationStyle {
  width: string;
  height: string;
  backgroundSize: string;
  backgroundPositionY: string;
  animationDuration: string;
  animationTimingFunction: string;
}

/**
 * Returns a random number in [min, min + variance].
 */
export function randomInRange(range: { min: number; variance: number }): number {
  return range.min + Math.random() * range.variance;
}

/**
 * Picks a random ambient animation from the pool, avoiding repetition
 * of the last-played animation when possible.
 * Returns undefined when no valid animation can be found.
 */
export function pickAmbientAnimation(
  animations: PetAnimationDef[],
  pool: string[],
  avoidId?: string,
): PetAnimationDef | undefined {
  if (pool.length === 0) return undefined;

  // Filter to only animations that exist in both the pool and the animations list
  const available = animations.filter((a) => pool.includes(a.id));
  if (available.length === 0) return undefined;

  // Try to avoid the last-played animation
  const candidates =
    available.length > 1 && avoidId
      ? available.filter((a) => a.id !== avoidId)
      : available;

  const choices = candidates.length > 0 ? candidates : available;
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Creates CSS style properties for rendering a specific animation
 * row from the atlas spritesheet.
 */
export function createAnimationStyle(
  layout: PetAtlasLayout,
  animation: PetAnimationDef,
): AnimationStyle {
  const totalWidth = layout.cols * layout.cellWidth;
  const totalHeight = layout.rows * layout.cellHeight;
  const durationMs = Math.round((animation.frames / animation.fps) * 1000);

  return {
    width: `${layout.cellWidth}px`,
    height: `${layout.cellHeight}px`,
    backgroundSize: `${totalWidth}px ${totalHeight}px`,
    backgroundPositionY: `-${animation.row * layout.cellHeight}px`,
    animationDuration: `${durationMs}ms`,
    animationTimingFunction: `steps(${animation.frames})`,
  };
}

/**
 * Generates a CSS @keyframes string for stepping through a sprite row.
 * The animation moves background-position-x from 0 to -(frames * cellWidth).
 */
export function generateSpriteKeyframes(
  layout: PetAtlasLayout,
  animation: PetAnimationDef,
): string {
  const endX = -(animation.frames * layout.cellWidth);
  return `@keyframes sprite-${animation.id} {
  from { background-position-x: 0px; }
  to { background-position-x: ${endX}px; }
}`;
}

/**
 * Returns the frame index that should be displayed at a given time (in ms).
 * The animation loops, so times beyond the total duration wrap around.
 */
export function getFrameAtTime(animation: PetAnimationDef, timeMs: number): number {
  if (timeMs <= 0) return 0;

  const frameDurationMs = 1000 / animation.fps;
  const totalDurationMs = animation.frames * frameDurationMs;
  const wrappedTime = timeMs % totalDurationMs;
  const frame = Math.floor(wrappedTime / frameDurationMs);

  return Math.min(frame, animation.frames - 1);
}

/**
 * Calculate the total duration of an animation in milliseconds.
 */
export function getAnimationDuration(animation: PetAnimationDef): number {
  return Math.round((animation.frames / animation.fps) * 1000);
}
