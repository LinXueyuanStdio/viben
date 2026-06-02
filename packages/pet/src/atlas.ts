import type { PetAnimationDef, PetAtlasLayout } from './types';
import { CODEX_ATLAS, STANDARD_ANIMATIONS } from './types';

/**
 * Checks if image dimensions match the Codex atlas aspect ratio
 * within a 6% tolerance. Handles resized variants while rejecting
 * normal screenshots and photos.
 */
export function looksLikeCodexAtlas(width: number, height: number): boolean {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return false;
  if (width <= 0 || height <= 0) return false;
  const aspect = width / height;
  return Math.abs(aspect - CODEX_ATLAS.aspect) < 0.06;
}

/**
 * Finds an animation definition by its id.
 */
export function getAnimationDef(
  animations: PetAnimationDef[],
  id: string,
): PetAnimationDef | undefined {
  return animations.find((a) => a.id === id);
}

/** Fallback order when the preferred animation is not found. */
const FALLBACK_CHAIN: readonly string[] = [
  'idle',
  'waiting',
  'waving',
  'running',
  'running-right',
];

/**
 * Picks an animation row by preferred id, falling through a sensible
 * fallback chain so playback never blanks out.
 */
export function pickAnimationRow(
  animations: PetAnimationDef[],
  preferred: string,
): PetAnimationDef | undefined {
  if (animations.length === 0) return undefined;

  const direct = animations.find((a) => a.id === preferred);
  if (direct) return direct;

  for (const id of FALLBACK_CHAIN) {
    const fallback = animations.find((a) => a.id === id);
    if (fallback) return fallback;
  }

  return animations[0];
}

/**
 * Creates the standard 8x9 Codex atlas layout with either the provided
 * animations or the built-in STANDARD_ANIMATIONS.
 */
export function createStandardAtlasLayout(
  animations?: PetAnimationDef[],
): PetAtlasLayout {
  return {
    cols: CODEX_ATLAS.cols,
    rows: CODEX_ATLAS.rows,
    cellWidth: CODEX_ATLAS.cellWidth,
    cellHeight: CODEX_ATLAS.cellHeight,
    animations: animations ?? STANDARD_ANIMATIONS,
  };
}

/**
 * Calculates the CSS background-position pixel values for a given
 * row and frame index within the atlas grid.
 */
export function getFramePosition(
  layout: PetAtlasLayout,
  row: number,
  frame: number,
): { x: number; y: number } {
  return {
    x: frame * layout.cellWidth,
    y: row * layout.cellHeight,
  };
}

/**
 * Validates that a value is a well-formed PetAtlasLayout with positive
 * dimensions and at least one animation.
 */
export function validateAtlasLayout(layout: PetAtlasLayout): boolean {
  if (!layout || typeof layout !== 'object') return false;
  if (
    typeof layout.cols !== 'number' ||
    typeof layout.rows !== 'number' ||
    typeof layout.cellWidth !== 'number' ||
    typeof layout.cellHeight !== 'number'
  ) {
    return false;
  }
  if (layout.cols <= 0 || layout.rows <= 0) return false;
  if (layout.cellWidth <= 0 || layout.cellHeight <= 0) return false;
  if (!Array.isArray(layout.animations) || layout.animations.length === 0) {
    return false;
  }
  return true;
}
