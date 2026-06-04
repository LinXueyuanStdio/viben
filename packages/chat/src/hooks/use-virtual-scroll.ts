import { useRef, useCallback, useMemo, useDeferredValue, useEffect, useSyncExternalStore } from "react";

// --- Constants ---
const OVERSCAN_PX = 1600;
const SCROLL_QUANTUM_PX = 100;
const DEFAULT_HEIGHT = 80;
const MAX_MOUNTED_ITEMS = 500;
const SLIDE_STEP = 25;
const ITEM_GAP = 16;

export interface UseVirtualScrollOptions {
  /** Pixels of overscan above and below viewport (default: 800) */
  overscanPx?: number;
  /** Default estimated item height in px (default: 80) */
  defaultHeight?: number;
  /** Scroll quantization threshold in px (default: 100) */
  scrollQuantumPx?: number;
  /** Max mounted items (default: 200) */
  maxMountedItems?: number;
  /** Slide step for progressive range expansion (default: 25) */
  slideStep?: number;
  /** Gap between items in px (default: 16, matching space-y-4) */
  itemGap?: number;
  /** Number of items to always keep mounted at the tail when sticky (default: 0) */
  stickyTailCount?: number;
}

export interface UseVirtualScrollResult {
  /** [startIndex, endIndex) half-open slice of items to render */
  range: readonly [number, number];
  /** Top spacer height in px */
  topSpacer: number;
  /** Bottom spacer height in px */
  bottomSpacer: number;
  /** Ref callback factory - call measureRef(index) to get a ref for each item wrapper */
  measureRef: (index: number) => (el: HTMLDivElement | null) => void;
  /** Scroll to a specific index (handles unmounted items) */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  /** Whether the list is currently "stuck" to the bottom */
  isAtBottom: boolean;
}

/**
 * Virtual scrolling hook for variable-height message lists.
 *
 * Renders only items in the visible viewport + overscan, using spacer divs
 * to maintain scroll position. Heights are measured via a shared ResizeObserver
 * and cached for offset calculations.
 *
 * Key patterns from infra/claude-code:
 * - useSyncExternalStore for tearing-free scroll subscription
 * - Mounted-but-unmeasured guard before advancing start
 * - Asymmetric deferral bypass (down bypasses effEnd, up stays deferred)
 * - Height cache GC on item key set change
 *
 * Reference: infra/claude-code/src/hooks/useVirtualScroll.ts
 */
export function useVirtualScroll(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  itemCount: number,
  getItemKey: (index: number) => string,
  options?: UseVirtualScrollOptions,
): UseVirtualScrollResult {
  const overscan = options?.overscanPx ?? OVERSCAN_PX;
  const defaultHeight = options?.defaultHeight ?? DEFAULT_HEIGHT;
  const quantum = options?.scrollQuantumPx ?? SCROLL_QUANTUM_PX;
  const maxMounted = options?.maxMountedItems ?? MAX_MOUNTED_ITEMS;
  const slideStep = options?.slideStep ?? SLIDE_STEP;
  const gap = options?.itemGap ?? ITEM_GAP;
  const stickyTail = options?.stickyTailCount ?? 0;

  // --- Height cache ---
  const heightCacheRef = useRef<Map<string, number>>(new Map());
  const offsetVersionRef = useRef(0);

  // --- Offsets prefix-sum (lazy rebuild via ref version check) ---
  const offsetsMetaRef = useRef({ version: -1, n: -1 });
  const offsetsRef = useRef<Float64Array>(new Float64Array(1));

  // Rebuild offsets only when version or count changed (no useCallback overhead)
  const rebuildOffsets = () => {
    const meta = offsetsMetaRef.current;
    if (meta.version === offsetVersionRef.current && meta.n === itemCount) {
      return offsetsRef.current;
    }
    const n = itemCount;
    // Reuse buffer if large enough
    let arr = offsetsRef.current;
    if (arr.length < n + 1) {
      arr = new Float64Array(n + 1);
    }
    arr[0] = 0;
    for (let i = 0; i < n; i++) {
      const key = getItemKey(i);
      const h = heightCacheRef.current.get(key) ?? defaultHeight;
      arr[i + 1] = arr[i] + h + (i < n - 1 ? gap : 0);
    }
    offsetsRef.current = arr;
    offsetsMetaRef.current = { version: offsetVersionRef.current, n: itemCount };
    return arr;
  };

  // --- Scroll state via useSyncExternalStore ---
  // Concurrent-mode-safe, tearing-free scroll subscription.
  // Snapshot returns quantized bin to minimize re-renders.
  const scrollTopRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const scrollHeightRef = useRef(0);
  const scrollDirectionRef = useRef<"up" | "down">("down");

  const subscribeScroll = useCallback(
    (onStoreChange: () => void) => {
      const el = scrollRef.current;
      if (!el) return () => {};

      // Initialize
      scrollTopRef.current = el.scrollTop;
      viewportHeightRef.current = el.clientHeight;
      scrollHeightRef.current = el.scrollHeight;

      const handler = () => {
        const prevTop = scrollTopRef.current;
        scrollTopRef.current = el.scrollTop;
        viewportHeightRef.current = el.clientHeight;
        scrollHeightRef.current = el.scrollHeight;
        if (el.scrollTop > prevTop) scrollDirectionRef.current = "down";
        else if (el.scrollTop < prevTop) scrollDirectionRef.current = "up";
        onStoreChange();
      };

      el.addEventListener("scroll", handler, { passive: true });
      return () => el.removeEventListener("scroll", handler);
    },
    [scrollRef],
  );

  const getScrollSnapshot = useCallback(() => {
    return Math.floor(scrollTopRef.current / quantum);
  }, [quantum]);

  // Server snapshot (SSR)
  const getServerSnapshot = useCallback(() => 0, []);

  // This triggers re-render only when quantized bin changes
  useSyncExternalStore(subscribeScroll, getScrollSnapshot, getServerSnapshot);

  // Force re-render counter (for height changes)
  const renderTickRef = useRef(0);
  const renderTickCallbacksRef = useRef<Set<() => void>>(new Set());

  const subscribeRenderTick = useCallback((cb: () => void) => {
    renderTickCallbacksRef.current.add(cb);
    return () => { renderTickCallbacksRef.current.delete(cb); };
  }, []);

  const getRenderTickSnapshot = useCallback(() => renderTickRef.current, []);

  useSyncExternalStore(subscribeRenderTick, getRenderTickSnapshot, getRenderTickSnapshot);

  const recomputeScheduledRef = useRef(false);

  const scheduleRecompute = useCallback(() => {
    if (recomputeScheduledRef.current) return;
    recomputeScheduledRef.current = true;
    requestAnimationFrame(() => {
      recomputeScheduledRef.current = false;
      renderTickRef.current++;
      for (const cb of renderTickCallbacksRef.current) cb();
    });
  }, []);

  // --- Previous range (for SLIDE_STEP) ---
  const prevRangeRef = useRef<readonly [number, number]>([0, 0]);

  // --- Pending scroll target ---
  const pendingScrollTargetRef = useRef<number | null>(null);

  // --- ResizeObserver ---
  const observerRef = useRef<ResizeObserver | null>(null);
  const itemElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Initialize ResizeObserver once
  if (!observerRef.current && typeof ResizeObserver !== "undefined") {
    observerRef.current = new ResizeObserver((entries) => {
      let anyChanged = false;
      for (const entry of entries) {
        const key = entry.target.getAttribute("data-vkey");
        if (!key) continue;
        const height =
          entry.borderBoxSize?.[0]?.blockSize ??
          entry.target.getBoundingClientRect().height;
        // Skip zero-height observations (element is being unmounted or collapsed)
        if (height === 0) continue;
        const prev = heightCacheRef.current.get(key);
        if (prev !== height) {
          heightCacheRef.current.set(key, height);
          anyChanged = true;
        }
      }
      if (anyChanged) {
        offsetVersionRef.current++;
        scheduleRecompute();
      }
    });
  }

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // --- Height cache GC ---
  // Remove stale entries when item keys change (prevents memory leak in long sessions)
  const prevItemKeysRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const liveKeys = new Set<string>();
    for (let i = 0; i < itemCount; i++) {
      liveKeys.add(getItemKey(i));
    }

    const cache = heightCacheRef.current;
    if (prevItemKeysRef.current && cache.size > liveKeys.size) {
      for (const key of cache.keys()) {
        if (!liveKeys.has(key)) cache.delete(key);
      }
      offsetVersionRef.current++;
    }
    prevItemKeysRef.current = liveKeys;
  }, [itemCount, getItemKey]);

  // --- measureRef factory ---
  // Tracks mounted key per index for O(1) cleanup on unmount (avoids O(k) scan).
  const measureRefCallbacksRef = useRef<Map<number, (el: HTMLDivElement | null) => void>>(new Map());
  const mountedKeyByIndexRef = useRef<Map<number, string>>(new Map());

  const measureRef = useCallback(
    (index: number) => {
      let cached = measureRefCallbacksRef.current.get(index);
      if (!cached) {
        cached = (el: HTMLDivElement | null) => {
          if (el) {
            const key = el.getAttribute("data-vkey");
            if (key) {
              mountedKeyByIndexRef.current.set(index, key);
              itemElementsRef.current.set(key, el);
              observerRef.current?.observe(el);
            }
          } else {
            // Unmount — O(1) cleanup using stored key
            const key = mountedKeyByIndexRef.current.get(index);
            if (key) {
              const tracked = itemElementsRef.current.get(key);
              if (tracked) {
                observerRef.current?.unobserve(tracked);
                itemElementsRef.current.delete(key);
              }
              mountedKeyByIndexRef.current.delete(index);
            }
          }
        };
        measureRefCallbacksRef.current.set(index, cached);
      }
      return cached;
    },
    [],
  );

  // Clear stale callbacks when itemCount changes
  useEffect(() => {
    const callbacks = measureRefCallbacksRef.current;
    for (const [idx] of callbacks) {
      if (idx >= itemCount) callbacks.delete(idx);
    }
  }, [itemCount]);

  // --- Range computation ---
  const offsets = rebuildOffsets();
  const n = itemCount;
  const scrollTop = scrollTopRef.current;
  const viewportH = viewportHeightRef.current;
  const scrollH = scrollHeightRef.current;

  // At-bottom detection (sticky)
  const isAtBottom = viewportH > 0 && scrollH - scrollTop - viewportH < 150;

  let start: number;
  let end: number;

  if (n === 0) {
    start = 0;
    end = 0;
  } else if (n <= maxMounted) {
    start = 0;
    end = n;
  } else if (viewportH === 0) {
    // Cold start: render last N items (will pin to bottom)
    start = Math.max(0, n - 30);
    end = n;
  } else if (isAtBottom) {
    // Sticky: expand backwards from tail
    end = n;
    const budget = viewportH + overscan;
    start = n;
    for (let i = n - 1; i >= 0; i--) {
      if (offsets[n] - offsets[i] >= budget) break;
      start = i;
    }
  } else {
    // Normal scroll: binary search for start
    const targetTop = Math.max(0, scrollTop - overscan);
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (offsets[mid + 1] <= targetTop) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    start = lo;

    // Extend end until coverage >= viewport + 2*overscan
    const targetBottom = scrollTop + viewportH + overscan;
    end = start;
    for (let i = start; i < n; i++) {
      end = i + 1;
      if (offsets[end] >= targetBottom) break;
    }
  }

  // Pending scroll target: force range to include it
  if (pendingScrollTargetRef.current !== null) {
    const target = pendingScrollTargetRef.current;
    if (target >= 0 && target < n) {
      start = Math.min(start, target);
      end = Math.max(end, target + 1);
    }
  }

  // Sticky tail: force last N always mounted when at bottom
  if (stickyTail > 0 && isAtBottom) {
    end = n;
    start = Math.min(start, Math.max(0, n - stickyTail));
  }

  // MAX_MOUNTED_ITEMS cap — trim by viewport position (not scroll direction)
  // to avoid flip-flop during settle. Ref: claude-code lines 538-551
  if (end - start > maxMounted) {
    if (isAtBottom) {
      start = end - maxMounted;
    } else {
      // Trim from the side furthest from viewport center
      const viewportCenter = scrollTop + viewportH / 2;
      const rangeCenter = (offsets[start] + offsets[end]) / 2;
      if (rangeCenter < viewportCenter) {
        // Range center is above viewport → trim head
        start = end - maxMounted;
      } else {
        // Range center is below viewport → trim tail
        end = start + maxMounted;
      }
    }
  }

  // SLIDE_STEP: limit how many new items mount per frame for very long lists.
  // Small/medium lists are fully mounted above, so historical messages remain visible.
  const [prevStart, prevEnd] = prevRangeRef.current;
  if (n > maxMounted && prevEnd > 0) {
    if (pendingScrollTargetRef.current === null) {
      if (start < prevStart - slideStep) {
        start = prevStart - slideStep;
      }
      if (end > prevEnd + slideStep) {
        end = prevEnd + slideStep;
      }
    }
  }

  // Mounted-but-unmeasured guard: don't advance start past items that are
  // mounted but haven't been measured yet (prevents topSpacer jump)
  if (prevEnd > 0 && start > prevStart) {
    for (let i = prevStart; i < Math.min(start, prevEnd); i++) {
      const key = getItemKey(i);
      if (itemElementsRef.current.has(key) && !heightCacheRef.current.has(key)) {
        start = i;
        break;
      }
    }
  }

  // Clamp
  start = Math.max(0, start);
  end = Math.min(n, end);

  // useDeferredValue: defer range GROWTH only for very long lists.
  const dStart = useDeferredValue(start);
  const dEnd = useDeferredValue(end);
  let effStart = n > maxMounted && start < dStart ? dStart : start;
  let effEnd = n > maxMounted && end > dEnd ? dEnd : end;

  // Bypass deferral edge cases
  if (effStart >= effEnd) {
    effStart = start;
    effEnd = end;
  }
  if (isAtBottom) {
    // Sticky must render tail immediately
    effEnd = end;
  }
  // Bypass deferral in the user's scroll direction so real messages mount immediately.
  if (scrollDirectionRef.current === "down" && effEnd < end) {
    effEnd = end;
  }
  if (scrollDirectionRef.current === "up" && effStart > start) {
    effStart = start;
  }

  // Final clamp
  effStart = Math.max(0, effStart);
  effEnd = Math.min(n, effEnd);

  // Store for next frame's SLIDE_STEP
  const range = useMemo(
    () => [effStart, effEnd] as const,
    [effStart, effEnd],
  );
  prevRangeRef.current = range;

  // --- Spacers ---
  const topSpacer = offsets[effStart] ?? 0;
  const totalHeight = offsets[n] ?? 0;
  const bottomSpacer = Math.max(0, totalHeight - (offsets[effEnd] ?? totalHeight));

  // --- scrollToIndex ---
  const scrollToIndex = useCallback(
    (targetIndex: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      if (targetIndex < 0 || targetIndex >= itemCount) return;

      const currentOffsets = offsetsRef.current;
      const targetTop = currentOffsets[targetIndex] ?? 0;

      // Check if target is mounted
      const [curStart, curEnd] = prevRangeRef.current;
      if (targetIndex >= curStart && targetIndex < curEnd) {
        el.scrollTo({ top: targetTop, behavior });
      } else {
        // Force mount, then scroll after next measurement
        pendingScrollTargetRef.current = targetIndex;
        scheduleRecompute();
        // Two-phase: mount → measure → scroll (with retry)
        let retries = 0;
        const attemptScroll = () => {
          const key = getItemKey(targetIndex);
          const isMounted = itemElementsRef.current.has(key);
          if (isMounted || retries >= 2) {
            const updatedOffsets = offsetsRef.current;
            const finalTop = updatedOffsets[targetIndex] ?? 0;
            el.scrollTo({ top: finalTop, behavior });
            pendingScrollTargetRef.current = null;
          } else {
            retries++;
            requestAnimationFrame(attemptScroll);
          }
        };
        requestAnimationFrame(() => requestAnimationFrame(attemptScroll));
      }
    },
    [scrollRef, itemCount, scheduleRecompute, getItemKey],
  );

  return {
    range,
    topSpacer,
    bottomSpacer,
    measureRef,
    scrollToIndex,
    isAtBottom,
  };
}
