import { createContext, useContext, useLayoutEffect, useRef, useCallback, useSyncExternalStore, useMemo } from "react"
import type { ReactNode } from "react"

/**
 * A map of targetId -> DOMRect for all elements with data-presentation-id.
 * Updated reactively via ResizeObserver + MutationObserver.
 */
export type TargetRectsMap = Map<string, DOMRect>

// ---------------------------------------------------------------------------
// TargetRectsStore — supports both whole-map and per-target subscriptions
// ---------------------------------------------------------------------------

type Listener = () => void

export class TargetRectsStore {
  private rects: TargetRectsMap = new Map()
  private elements: Map<string, Element> = new Map()
  private resizeObserver: ResizeObserver | null = null
  private mutationObserver: MutationObserver | null = null
  private scanScheduled = false
  private measureScheduled = false
  /** Global version counter — increments on any change */
  private version = 0

  /** Global subscribers (notified on any change) */
  private globalListeners = new Set<Listener>()
  /** Per-target subscribers (notified only when that target changes) */
  private targetListeners = new Map<string, Set<Listener>>()
  /** Per-target version counters */
  private targetVersions = new Map<string, number>()

  // --- Subscription API ---

  subscribeAll = (cb: Listener) => {
    this.globalListeners.add(cb)
    return () => { this.globalListeners.delete(cb) }
  }

  subscribeTargets = (targetIds: string[], cb: Listener) => {
    for (const id of targetIds) {
      let set = this.targetListeners.get(id)
      if (!set) { set = new Set(); this.targetListeners.set(id, set) }
      set.add(cb)
    }
    return () => {
      for (const id of targetIds) {
        const set = this.targetListeners.get(id)
        if (set) {
          set.delete(cb)
          if (set.size === 0) this.targetListeners.delete(id)
        }
      }
    }
  }

  getSnapshot = () => this.rects

  getVersion = () => this.version

  getTargetVersion = (id: string) => this.targetVersions.get(id) ?? 0

  getTargetRect = (id: string): DOMRect | undefined => this.rects.get(id)

  // --- Internals ---

  private notify(changedIds: string[]) {
    this.version++
    // Bump per-target versions
    for (const id of changedIds) {
      this.targetVersions.set(id, (this.targetVersions.get(id) ?? 0) + 1)
    }
    // Notify global listeners
    for (const cb of this.globalListeners) cb()
    // Notify per-target listeners (deduplicated via Set)
    const notified = new Set<Listener>()
    for (const id of changedIds) {
      const set = this.targetListeners.get(id)
      if (set) {
        for (const cb of set) {
          if (!notified.has(cb)) {
            notified.add(cb)
            cb()
          }
        }
      }
    }
  }

  /** Measure all known elements, only notify if values changed */
  measure = () => {
    const newMap = new Map<string, DOMRect>()
    const changed: string[] = []

    for (const [id, el] of this.elements) {
      const rect = el.getBoundingClientRect()
      newMap.set(id, rect)

      const prev = this.rects.get(id)
      if (!prev || prev.left !== rect.left || prev.top !== rect.top ||
          prev.width !== rect.width || prev.height !== rect.height) {
        changed.push(id)
      }
    }

    // Check for removed targets
    for (const id of this.rects.keys()) {
      if (!newMap.has(id)) changed.push(id)
    }

    if (changed.length > 0) {
      this.rects = newMap
      this.notify(changed)
    }
  }

  /** Throttled measure — at most once per frame */
  throttledMeasure = () => {
    if (this.measureScheduled) return
    this.measureScheduled = true
    requestAnimationFrame(() => {
      this.measureScheduled = false
      this.measure()
    })
  }

  /** Full DOM scan for [data-presentation-id] elements */
  scan = () => {
    const nodeList = document.querySelectorAll<HTMLElement>("[data-presentation-id]")
    const newElements = new Map<string, Element>()

    nodeList.forEach((el) => {
      const id = el.dataset.presentationId
      if (id) newElements.set(id, el)
    })

    // Update ResizeObserver
    const ro = this.resizeObserver
    if (ro) {
      for (const [id, el] of this.elements) {
        if (!newElements.has(id)) ro.unobserve(el)
      }
      for (const [id, el] of newElements) {
        if (!this.elements.has(id)) ro.observe(el)
      }
    }

    this.elements = newElements
    this.measure()
  }

  /** Debounced scan — at most once per frame */
  scheduleScan = () => {
    if (this.scanScheduled) return
    this.scanScheduled = true
    requestAnimationFrame(() => {
      this.scanScheduled = false
      this.scan()
    })
  }

  /** Start observing the DOM */
  start() {
    this.scan()

    this.resizeObserver = new ResizeObserver(() => this.throttledMeasure())

    this.mutationObserver = new MutationObserver((mutations) => {
      let relevant = false
      for (const m of mutations) {
        if (m.type !== "childList") continue
        for (let i = 0; i < m.addedNodes.length; i++) {
          const node = m.addedNodes[i]
          if (node.nodeType === 1) {
            const el = node as HTMLElement
            if (el.hasAttribute("data-presentation-id") ||
                el.querySelector("[data-presentation-id]")) {
              relevant = true
              break
            }
          }
        }
        if (relevant) break
        for (let i = 0; i < m.removedNodes.length; i++) {
          const node = m.removedNodes[i]
          if (node.nodeType === 1) {
            const el = node as HTMLElement
            if (el.hasAttribute("data-presentation-id") ||
                el.querySelector("[data-presentation-id]")) {
              relevant = true
              break
            }
          }
        }
        if (relevant) break
      }
      if (relevant) this.scheduleScan()
    })

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    })

    window.addEventListener("resize", this.throttledMeasure)
    window.addEventListener("scroll", this.throttledMeasure, true)
  }

  /** Stop observing and clean up */
  destroy() {
    this.resizeObserver?.disconnect()
    this.mutationObserver?.disconnect()
    window.removeEventListener("resize", this.throttledMeasure)
    window.removeEventListener("scroll", this.throttledMeasure, true)
    this.globalListeners.clear()
    this.targetListeners.clear()
  }
}

// ---------------------------------------------------------------------------
// Context — store only (not the rects Map, avoiding provider-level re-render)
// ---------------------------------------------------------------------------

const TargetRectsStoreContext = createContext<TargetRectsStore | null>(null)

/**
 * Provider that observes all [data-presentation-id] elements in the document.
 * Uses ResizeObserver for size/position changes and MutationObserver for DOM additions/removals.
 *
 * Performance optimizations:
 * - Only provides the store reference (stable) — no provider-level re-renders on target changes
 * - Per-target subscriptions enable fine-grained re-render control
 * - MutationObserver only fires when nodes with data-presentation-id are added/removed
 * - Debounced measure to avoid thrashing during Remotion playback
 */
export function TargetRectsProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<TargetRectsStore | null>(null)
  if (!storeRef.current) {
    storeRef.current = new TargetRectsStore()
  }
  const store = storeRef.current

  useLayoutEffect(() => {
    store.start()
    return () => store.destroy()
  }, [store])

  return (
    <TargetRectsStoreContext.Provider value={store}>
      {children}
    </TargetRectsStoreContext.Provider>
  )
}

/**
 * Hook to get the current rects map. Re-renders when any target moves/resizes.
 * Uses useSyncExternalStore for concurrent-mode safety.
 */
export function useTargetRects(): TargetRectsMap {
  const store = useContext(TargetRectsStoreContext)
  const subscribe = useCallback(
    (cb: Listener) => store ? store.subscribeAll(cb) : () => {},
    [store],
  )
  const getSnapshot = useCallback(
    () => store ? store.getSnapshot() : new Map() as TargetRectsMap,
    [store],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => new Map() as TargetRectsMap)
}

/**
 * Hook to get a specific target's DOMRect. Returns undefined if not found.
 * Only re-renders when the specific target changes.
 */
export function useTargetRect(targetId: string): DOMRect | undefined {
  const store = useContext(TargetRectsStoreContext)
  const ids = useMemo(() => [targetId], [targetId])

  const subscribe = useCallback(
    (cb: Listener) => store ? store.subscribeTargets(ids, cb) : () => {},
    [store, ids],
  )
  const getSnapshot = useCallback(
    () => store ? store.getTargetRect(targetId) : undefined,
    [store, targetId],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined)
}

/**
 * Hook: subscribe only to specific target IDs.
 * Re-renders ONLY when one of the specified targets changes position/size.
 * Returns a stable TargetRectsMap containing only the requested targets.
 *
 * This is the key optimization: overlays with TargetRef only re-render
 * when their specific target element moves, not when unrelated targets change.
 *
 * Snapshot stability: uses a version counter to avoid allocating a new Map
 * on every getSnapshot call. The Map is only rebuilt when the store notifies
 * that one of our targets changed.
 */
export function useTargetRectsFor(targetIds: string[]): TargetRectsMap {
  const store = useContext(TargetRectsStoreContext)

  // Stabilize targetIds to avoid re-subscription on every render
  const idsKey = targetIds.join("\0")
  const stableIds = useMemo(() => targetIds, [idsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Version-gated snapshot: only rebuild the Map when our targets actually changed
  const cacheRef = useRef<{ map: TargetRectsMap; version: number }>({ map: new Map(), version: -1 })

  const subscribe = useCallback(
    (cb: Listener) => {
      if (!store) return () => {}
      return store.subscribeTargets(stableIds, cb)
    },
    [store, stableIds],
  )

  const getSnapshot = useCallback(() => {
    if (!store) return new Map() as TargetRectsMap

    // Check if any of our targets have a newer version
    const cache = cacheRef.current
    let maxVersion = 0
    for (const id of stableIds) {
      maxVersion += store.getTargetVersion(id)
    }

    // If combined version hasn't changed, return cached map (zero allocation)
    if (maxVersion === cache.version) return cache.map

    // Rebuild filtered map
    const result = new Map<string, DOMRect>()
    for (const id of stableIds) {
      const rect = store.getTargetRect(id)
      if (rect) result.set(id, rect)
    }

    cache.map = result
    cache.version = maxVersion
    return result
  }, [store, stableIds])

  return useSyncExternalStore(subscribe, getSnapshot, () => new Map() as TargetRectsMap)
}
