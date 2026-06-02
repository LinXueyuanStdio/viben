import { describe, it, expect } from 'vitest';
import {
  randomInRange,
  pickAmbientAnimation,
  createAnimationStyle,
  generateSpriteKeyframes,
  getFrameAtTime,
  getAnimationDuration,
} from '../src/animation';
import type { AnimationStyle } from '../src/animation';
import { STANDARD_ANIMATIONS, CODEX_ATLAS } from '../src/types';
import type { PetAnimationDef, PetAtlasLayout } from '../src/types';

describe('randomInRange', () => {
  it('returns value within [min, min+variance]', () => {
    const range = { min: 100, variance: 50 };
    for (let i = 0; i < 100; i++) {
      const val = randomInRange(range);
      expect(val).toBeGreaterThanOrEqual(100);
      expect(val).toBeLessThanOrEqual(150);
    }
  });

  it('returns exact min when variance is 0', () => {
    const range = { min: 42, variance: 0 };
    expect(randomInRange(range)).toBe(42);
  });
});

describe('pickAmbientAnimation', () => {
  const animations = STANDARD_ANIMATIONS;
  const pool = ['waving', 'review', 'jumping'];

  it('picks an animation from the pool', () => {
    const result = pickAmbientAnimation(animations, pool);
    expect(result).toBeDefined();
    expect(pool).toContain(result!.id);
  });

  it('avoids the specified id when possible', () => {
    // With a pool of 3, should avoid the specified one
    for (let i = 0; i < 50; i++) {
      const result = pickAmbientAnimation(animations, pool, 'waving');
      if (result) {
        expect(result.id).not.toBe('waving');
      }
    }
  });

  it('returns undefined when pool is empty', () => {
    const result = pickAmbientAnimation(animations, []);
    expect(result).toBeUndefined();
  });

  it('returns undefined when no pool animations exist in the animations list', () => {
    const result = pickAmbientAnimation(animations, ['nonexistent1', 'nonexistent2']);
    expect(result).toBeUndefined();
  });

  it('can return the avoided id if it is the only option', () => {
    const singlePool = ['waving'];
    const result = pickAmbientAnimation(animations, singlePool, 'waving');
    // Should still return something (the only option)
    expect(result).toBeDefined();
    expect(result!.id).toBe('waving');
  });
});

describe('createAnimationStyle', () => {
  const layout: PetAtlasLayout = {
    cols: 8,
    rows: 9,
    cellWidth: 192,
    cellHeight: 208,
    animations: STANDARD_ANIMATIONS,
  };

  it('creates correct style for idle animation', () => {
    const idle = STANDARD_ANIMATIONS[0]; // idle: 6 frames, 6 fps
    const style = createAnimationStyle(layout, idle);

    expect(style.width).toBe('192px');
    expect(style.height).toBe('208px');
    expect(style.backgroundSize).toBe(`${8 * 192}px ${9 * 208}px`);
    expect(style.backgroundPositionY).toBe(`-${0 * 208}px`);
    expect(style.animationDuration).toBe('1000ms'); // 6 frames / 6 fps = 1s
    expect(style.animationTimingFunction).toBe('steps(6)');
  });

  it('creates correct style for running-right animation', () => {
    const running = STANDARD_ANIMATIONS[1]; // running-right: 8 frames, 8 fps, row 1
    const style = createAnimationStyle(layout, running);

    expect(style.backgroundPositionY).toBe(`-${1 * 208}px`);
    expect(style.animationDuration).toBe('1000ms'); // 8 frames / 8 fps = 1s
    expect(style.animationTimingFunction).toBe('steps(8)');
  });
});

describe('generateSpriteKeyframes', () => {
  const layout: PetAtlasLayout = {
    cols: 8,
    rows: 9,
    cellWidth: 192,
    cellHeight: 208,
    animations: STANDARD_ANIMATIONS,
  };

  it('generates valid CSS keyframes string', () => {
    const idle = STANDARD_ANIMATIONS[0]; // 6 frames
    const keyframes = generateSpriteKeyframes(layout, idle);

    expect(keyframes).toContain('@keyframes');
    expect(keyframes).toContain('background-position-x');
    expect(keyframes).toContain('from');
    expect(keyframes).toContain('to');
  });

  it('to position equals negative frame count times cell width', () => {
    const idle = STANDARD_ANIMATIONS[0]; // 6 frames, cellWidth = 192
    const keyframes = generateSpriteKeyframes(layout, idle);

    // The "to" should move to -(frames * cellWidth) to show last frame
    const expectedX = -(6 * 192);
    expect(keyframes).toContain(`${expectedX}px`);
  });
});

describe('getFrameAtTime', () => {
  it('returns frame 0 at time 0', () => {
    const idle = STANDARD_ANIMATIONS[0]; // 6 frames, 6 fps
    expect(getFrameAtTime(idle, 0)).toBe(0);
  });

  it('returns correct frame at specific time', () => {
    const idle = STANDARD_ANIMATIONS[0]; // 6 frames, 6 fps => 166.67ms per frame
    // At 200ms, should be frame 1
    expect(getFrameAtTime(idle, 200)).toBe(1);
    // At 500ms, should be frame 3
    expect(getFrameAtTime(idle, 500)).toBe(3);
  });

  it('wraps around when time exceeds total duration', () => {
    const idle = STANDARD_ANIMATIONS[0]; // 6 frames, 6 fps => 1000ms total
    // At 1200ms, wraps to 200ms => frame 1
    expect(getFrameAtTime(idle, 1200)).toBe(1);
  });

  it('handles negative time by treating as 0', () => {
    const idle = STANDARD_ANIMATIONS[0];
    expect(getFrameAtTime(idle, -100)).toBe(0);
  });
});

describe('getAnimationDuration', () => {
  it('calculates duration in milliseconds', () => {
    const animation = { id: 'idle', row: 0, frames: 6, fps: 6 };
    expect(getAnimationDuration(animation)).toBe(1000); // 6 frames / 6 fps = 1s
  });

  it('handles different fps values', () => {
    const animation = { id: 'running', row: 1, frames: 8, fps: 8 };
    expect(getAnimationDuration(animation)).toBe(1000); // 8 frames / 8 fps = 1s
  });

  it('handles fractional durations', () => {
    const animation = { id: 'waving', row: 3, frames: 4, fps: 6 };
    const duration = getAnimationDuration(animation);
    expect(duration).toBeCloseTo(667, 0); // 4 frames / 6 fps = 0.667s
  });
});
