import { describe, it, expect } from 'vitest';
import {
  looksLikeCodexAtlas,
  getAnimationDef,
  pickAnimationRow,
  createStandardAtlasLayout,
  getFramePosition,
  validateAtlasLayout,
} from '../src/atlas';
import { STANDARD_ANIMATIONS, CODEX_ATLAS } from '../src/types';
import type { PetAnimationDef, PetAtlasLayout } from '../src/types';

describe('looksLikeCodexAtlas', () => {
  it('returns true for exact canonical dimensions', () => {
    expect(looksLikeCodexAtlas(1536, 1872)).toBe(true);
  });

  it('returns true for scaled atlas (same aspect ratio)', () => {
    // Half size
    expect(looksLikeCodexAtlas(768, 936)).toBe(true);
    // Double size
    expect(looksLikeCodexAtlas(3072, 3744)).toBe(true);
  });

  it('returns false for wrong aspect ratio', () => {
    expect(looksLikeCodexAtlas(1920, 1080)).toBe(false);
    expect(looksLikeCodexAtlas(500, 500)).toBe(false);
  });

  it('returns false for invalid dimensions', () => {
    expect(looksLikeCodexAtlas(0, 0)).toBe(false);
    expect(looksLikeCodexAtlas(-1, 100)).toBe(false);
    expect(looksLikeCodexAtlas(NaN, 100)).toBe(false);
    expect(looksLikeCodexAtlas(100, Infinity)).toBe(false);
  });
});

describe('getAnimationDef', () => {
  it('finds an animation by id', () => {
    const result = getAnimationDef(STANDARD_ANIMATIONS, 'waving');
    expect(result).toBeDefined();
    expect(result!.id).toBe('waving');
    expect(result!.row).toBe(3);
    expect(result!.frames).toBe(4);
  });

  it('returns undefined when id not found', () => {
    const result = getAnimationDef(STANDARD_ANIMATIONS, 'nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('pickAnimationRow', () => {
  it('returns exact match when animation exists', () => {
    const result = pickAnimationRow(STANDARD_ANIMATIONS, 'jumping');
    expect(result).toBeDefined();
    expect(result!.id).toBe('jumping');
  });

  it('falls back through chain when preferred not found', () => {
    const limited: PetAnimationDef[] = [
      { id: 'waving', row: 3, frames: 4, fps: 6 },
    ];
    const result = pickAnimationRow(limited, 'nonexistent');
    expect(result).toBeDefined();
    expect(result!.id).toBe('waving');
  });

  it('falls back to idle first', () => {
    const withIdle: PetAnimationDef[] = [
      { id: 'idle', row: 0, frames: 6, fps: 6 },
      { id: 'waving', row: 3, frames: 4, fps: 6 },
    ];
    const result = pickAnimationRow(withIdle, 'nonexistent');
    expect(result).toBeDefined();
    expect(result!.id).toBe('idle');
  });

  it('returns first animation when no fallback matches', () => {
    const custom: PetAnimationDef[] = [
      { id: 'custom-anim', row: 0, frames: 3, fps: 5 },
    ];
    const result = pickAnimationRow(custom, 'nonexistent');
    expect(result).toBeDefined();
    expect(result!.id).toBe('custom-anim');
  });

  it('returns undefined for empty array', () => {
    const result = pickAnimationRow([], 'idle');
    expect(result).toBeUndefined();
  });
});

describe('createStandardAtlasLayout', () => {
  it('creates layout with default standard animations', () => {
    const layout = createStandardAtlasLayout();
    expect(layout.cols).toBe(CODEX_ATLAS.cols);
    expect(layout.rows).toBe(CODEX_ATLAS.rows);
    expect(layout.cellWidth).toBe(CODEX_ATLAS.cellWidth);
    expect(layout.cellHeight).toBe(CODEX_ATLAS.cellHeight);
    expect(layout.animations).toEqual(STANDARD_ANIMATIONS);
  });

  it('accepts custom animations override', () => {
    const custom: PetAnimationDef[] = [
      { id: 'idle', row: 0, frames: 4, fps: 8 },
    ];
    const layout = createStandardAtlasLayout(custom);
    expect(layout.animations).toEqual(custom);
    expect(layout.cols).toBe(CODEX_ATLAS.cols);
  });
});

describe('getFramePosition', () => {
  const layout: PetAtlasLayout = {
    cols: 8,
    rows: 9,
    cellWidth: 192,
    cellHeight: 208,
    animations: STANDARD_ANIMATIONS,
  };

  it('returns correct position for first frame of first row', () => {
    const pos = getFramePosition(layout, 0, 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('returns correct position for mid-frame', () => {
    // Row 1, Frame 3 => x = 3 * 192 = 576, y = 1 * 208 = 208
    const pos = getFramePosition(layout, 1, 3);
    expect(pos.x).toBe(576);
    expect(pos.y).toBe(208);
  });

  it('returns correct position for last row', () => {
    // Row 8, Frame 0 => x = 0, y = 8 * 208 = 1664
    const pos = getFramePosition(layout, 8, 0);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(1664);
  });
});

describe('validateAtlasLayout', () => {
  it('returns true for valid layout', () => {
    const layout: PetAtlasLayout = {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    };
    expect(validateAtlasLayout(layout)).toBe(true);
  });

  it('returns false for missing cols', () => {
    const layout = {
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    } as unknown as PetAtlasLayout;
    expect(validateAtlasLayout(layout)).toBe(false);
  });

  it('returns false for zero dimensions', () => {
    const layout: PetAtlasLayout = {
      cols: 0,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    };
    expect(validateAtlasLayout(layout)).toBe(false);
  });

  it('returns false for empty animations', () => {
    const layout: PetAtlasLayout = {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: [],
    };
    expect(validateAtlasLayout(layout)).toBe(false);
  });

  it('returns false for null input', () => {
    expect(validateAtlasLayout(null as unknown as PetAtlasLayout)).toBe(false);
  });
});
