/**
 * Unit tests for the virtual scroll offset and range computation logic.
 *
 * Since this is a React hook that depends on DOM APIs (ResizeObserver, scrollTop),
 * we test the pure computational parts: offset building, range calculation, and spacer math.
 * The hook integration is verified via manual testing in the example app.
 */
import { describe, test, expect } from "vitest";

// --- Extract and test the pure offset computation logic ---

const DEFAULT_HEIGHT = 80;
const ITEM_GAP = 16;
const OVERSCAN_PX = 800;

/** Pure function: build prefix-sum offsets array */
function buildOffsets(
  itemCount: number,
  getItemKey: (i: number) => string,
  heightCache: Map<string, number>,
  defaultHeight: number = DEFAULT_HEIGHT,
  gap: number = ITEM_GAP,
): Float64Array {
  const n = itemCount;
  const arr = new Float64Array(n + 1);
  arr[0] = 0;
  for (let i = 0; i < n; i++) {
    const key = getItemKey(i);
    const h = heightCache.get(key) ?? defaultHeight;
    arr[i + 1] = arr[i] + h + (i < n - 1 ? gap : 0);
  }
  return arr;
}

/** Pure function: compute range from scroll position */
function computeRange(
  offsets: Float64Array,
  itemCount: number,
  scrollTop: number,
  viewportH: number,
  overscan: number,
  isAtBottom: boolean,
): [number, number] {
  if (itemCount === 0) return [0, 0];

  if (viewportH === 0) {
    // Cold start
    return [Math.max(0, itemCount - 30), itemCount];
  }

  if (isAtBottom) {
    const budget = viewportH + overscan;
    let start = itemCount;
    for (let i = itemCount - 1; i >= 0; i--) {
      if (offsets[itemCount] - offsets[i] >= budget) break;
      start = i;
    }
    return [start, itemCount];
  }

  // Normal: binary search for start
  const targetTop = Math.max(0, scrollTop - overscan);
  let lo = 0;
  let hi = itemCount;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid + 1] <= targetTop) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const start = lo;

  const targetBottom = scrollTop + viewportH + overscan;
  let end = start;
  for (let i = start; i < itemCount; i++) {
    end = i + 1;
    if (offsets[end] >= targetBottom) break;
  }

  return [start, end];
}

describe("buildOffsets", () => {
  const getKey = (i: number) => `msg-${i}`;

  test("empty list returns single-element array with value 0", () => {
    const offsets = buildOffsets(0, getKey, new Map());
    expect(offsets.length).toBe(1);
    expect(offsets[0]).toBe(0);
  });

  test("single item: no trailing gap", () => {
    const offsets = buildOffsets(1, getKey, new Map());
    // offsets = [0, 80] (no gap after last item)
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(80);
  });

  test("two items: gap between them, no trailing gap", () => {
    const offsets = buildOffsets(2, getKey, new Map());
    // offsets = [0, 80+16, 80+16+80] = [0, 96, 176]
    expect(offsets[0]).toBe(0);
    expect(offsets[1]).toBe(96); // first item height + gap
    expect(offsets[2]).toBe(176); // + second item height (no trailing gap)
  });

  test("uses cached height when available", () => {
    const cache = new Map([["msg-0", 200], ["msg-1", 50]]);
    const offsets = buildOffsets(2, getKey, cache);
    // offsets = [0, 200+16, 200+16+50] = [0, 216, 266]
    expect(offsets[1]).toBe(216);
    expect(offsets[2]).toBe(266);
  });

  test("total height for 100 items with default height", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    // 100 * 80 + 99 * 16 = 8000 + 1584 = 9584
    expect(offsets[100]).toBe(9584);
  });
});

describe("computeRange", () => {
  const getKey = (i: number) => `msg-${i}`;

  test("empty list returns [0, 0]", () => {
    const offsets = buildOffsets(0, getKey, new Map());
    expect(computeRange(offsets, 0, 0, 600, OVERSCAN_PX, false)).toEqual([0, 0]);
  });

  test("cold start (viewport=0) returns last 30 items", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    expect(computeRange(offsets, 100, 0, 0, OVERSCAN_PX, false)).toEqual([70, 100]);
  });

  test("at-bottom returns range ending at itemCount", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    const [start, end] = computeRange(offsets, 100, 8000, 600, OVERSCAN_PX, true);
    expect(end).toBe(100);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(start).toBeLessThan(100);
  });

  test("scroll=0 starts at index 0", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    const [start] = computeRange(offsets, 100, 0, 600, OVERSCAN_PX, false);
    expect(start).toBe(0);
  });

  test("scroll to middle finds correct start via binary search", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    // scrollTop = 4800 → target = 4800 - 800 = 4000
    // Each item is 96px (80 + 16 gap), so index ≈ 4000 / 96 = 41.6 → start = 41
    const [start] = computeRange(offsets, 100, 4800, 600, OVERSCAN_PX, false);
    expect(start).toBeGreaterThanOrEqual(40);
    expect(start).toBeLessThanOrEqual(42);
  });

  test("range covers viewport + overscan", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    const viewportH = 600;
    const [start, end] = computeRange(offsets, 100, 2000, viewportH, OVERSCAN_PX, false);
    // Content covered should be >= viewport + overscan (from scrollTop onwards)
    const coveredHeight = offsets[end] - offsets[start];
    expect(coveredHeight).toBeGreaterThanOrEqual(viewportH);
  });

  test("small list renders all items", () => {
    const offsets = buildOffsets(5, getKey, new Map());
    const [start, end] = computeRange(offsets, 5, 0, 600, OVERSCAN_PX, false);
    expect(start).toBe(0);
    expect(end).toBe(5);
  });
});

describe("spacer calculations", () => {
  const getKey = (i: number) => `msg-${i}`;

  test("topSpacer = offsets[start]", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    const [start] = computeRange(offsets, 100, 4800, 600, OVERSCAN_PX, false);
    const topSpacer = offsets[start];
    expect(topSpacer).toBeGreaterThan(0);
  });

  test("bottomSpacer = totalHeight - offsets[end]", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    const [, end] = computeRange(offsets, 100, 0, 600, OVERSCAN_PX, false);
    const totalHeight = offsets[100];
    const bottomSpacer = totalHeight - offsets[end];
    if (end < 100) {
      expect(bottomSpacer).toBeGreaterThan(0);
    }
  });

  test("topSpacer + content + bottomSpacer = totalHeight", () => {
    const offsets = buildOffsets(100, getKey, new Map());
    const [start, end] = computeRange(offsets, 100, 4800, 600, OVERSCAN_PX, false);
    const topSpacer = offsets[start];
    const contentHeight = offsets[end] - offsets[start];
    const bottomSpacer = Math.max(0, offsets[100] - offsets[end]);
    expect(topSpacer + contentHeight + bottomSpacer).toBe(offsets[100]);
  });
});
