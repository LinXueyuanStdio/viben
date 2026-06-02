import { describe, it, expect } from 'vitest';
import {
  DRAG_GESTURE_MIN_PX,
  DRAG_AXIS_BIAS,
  getAnimationIdForInteraction,
  classifyDragDirection,
  resolveInteraction,
} from '../src/interaction';
import type { PetInteraction } from '../src/types';

describe('constants', () => {
  it('exports expected default thresholds', () => {
    expect(DRAG_GESTURE_MIN_PX).toBe(14);
    expect(DRAG_AXIS_BIAS).toBe(1.18);
  });
});

describe('getAnimationIdForInteraction', () => {
  it('maps idle to idle', () => {
    expect(getAnimationIdForInteraction('idle')).toBe('idle');
  });

  it('maps hover to waving', () => {
    expect(getAnimationIdForInteraction('hover')).toBe('waving');
  });

  it('maps drag-right to running-right', () => {
    expect(getAnimationIdForInteraction('drag-right')).toBe('running-right');
  });

  it('maps drag-left to running-left', () => {
    expect(getAnimationIdForInteraction('drag-left')).toBe('running-left');
  });

  it('maps drag-up to jumping', () => {
    expect(getAnimationIdForInteraction('drag-up')).toBe('jumping');
  });

  it('maps drag-down to waving', () => {
    expect(getAnimationIdForInteraction('drag-down')).toBe('waving');
  });

  it('maps waiting to waiting', () => {
    expect(getAnimationIdForInteraction('waiting')).toBe('waiting');
  });
});

describe('classifyDragDirection', () => {
  it('returns null when movement below min threshold', () => {
    expect(classifyDragDirection(5, 3)).toBeNull();
    expect(classifyDragDirection(0, 0)).toBeNull();
  });

  it('returns drag-right for rightward movement', () => {
    expect(classifyDragDirection(20, 0)).toBe('drag-right');
    expect(classifyDragDirection(30, 5)).toBe('drag-right');
  });

  it('returns drag-left for leftward movement', () => {
    expect(classifyDragDirection(-20, 0)).toBe('drag-left');
    expect(classifyDragDirection(-30, -5)).toBe('drag-left');
  });

  it('returns drag-up for upward movement', () => {
    expect(classifyDragDirection(0, -20)).toBe('drag-up');
    expect(classifyDragDirection(5, -30)).toBe('drag-up');
  });

  it('returns drag-down for downward movement', () => {
    expect(classifyDragDirection(0, 20)).toBe('drag-down');
    expect(classifyDragDirection(5, 30)).toBe('drag-down');
  });

  it('uses axis bias to prefer horizontal over vertical', () => {
    // With bias 1.18, horizontal wins when abs(dx) * 1 >= abs(dy) * 1 (dx is dominant)
    // The bias is applied: horizontal if abs(dx) >= abs(dy) * axisBias
    expect(classifyDragDirection(20, 16)).toBe('drag-right');
  });

  it('respects custom minPx parameter', () => {
    expect(classifyDragDirection(10, 0, 5)).toBe('drag-right');
    expect(classifyDragDirection(10, 0, 15)).toBeNull();
  });

  it('respects custom axisBias parameter', () => {
    // With very high bias, vertical always wins when both are similar
    expect(classifyDragDirection(15, -15, 14, 100)).toBe('drag-up');
  });
});

describe('resolveInteraction', () => {
  it('returns hover on pointerenter when not dragging', () => {
    const result = resolveInteraction('idle', 'pointerenter', false);
    expect(result).toBe('hover');
  });

  it('returns idle on pointerleave when not dragging', () => {
    const result = resolveInteraction('hover', 'pointerleave', false);
    expect(result).toBe('idle');
  });

  it('keeps current state on pointerleave when dragging', () => {
    const result = resolveInteraction('drag-right', 'pointerleave', true);
    expect(result).toBe('drag-right');
  });

  it('returns idle on dragend', () => {
    const result = resolveInteraction('drag-left', 'dragend', false);
    expect(result).toBe('idle');
  });

  it('returns waiting on waiting event', () => {
    const result = resolveInteraction('idle', 'waiting', false);
    expect(result).toBe('waiting');
  });

  it('returns idle on wake event', () => {
    const result = resolveInteraction('waiting', 'wake', false);
    expect(result).toBe('idle');
  });

  it('returns current state for unknown events', () => {
    const result = resolveInteraction('hover', 'unknown-event' as string, false);
    expect(result).toBe('hover');
  });
});
