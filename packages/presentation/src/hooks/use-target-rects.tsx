import { createContext, useContext, useLayoutEffect, useRef, useCallback, useSyncExternalStore } from "react"
import type { ReactNode } from "react"

/**
 * A map of targetId -> DOMRect for all elements with data-presentation-id.
 * Updated reactively via ResizeObserver + MutationObserver.
 */
export type TargetRectsMap = Map<string, DOMRect>

const TargetRectsContext = createContext<TargetRectsMap>(new Map())

/**
 * Compares two TargetRectsMap for value equality (avoids unnecessary re-renders).
 */
function rectsEqual(a: TargetRectsMap, b: TargetRectsMap): boolean {
  if (a.size !== b.size) return false
  for (const [id, rectA] of a) {
    const rectB = b.get(id)
    if (!rectB) return false
    if (rectA.left !== rectB.left || rectA.top !== rectB.top ||
        rectA.width !== rectB.width || rectA.height !== rectB.height) return false
  }
  return true
}

/**
 * Provider that observes all [data-presentation-id] elements in the document.
 * Uses ResizeObserver for size/position changes and MutationObserver for DOM additions/removals.
 *
 * Performance optimizations:
 * - Only updates React state when rects ACTUALLY change (value comparison)
 * - MutationObserver only fires when nodes with data-presentation-id are added/removed
 * - Debounced to avoid thrashing during Remotion playback
 */
export function TargetRectsProvider({ children }: { children: ReactNode }) {
  const rectsRef = useRef<TargetRectsMap>(new Map())
  const elementsRef = useRef<Map<string, Element>>(new Map())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const scanScheduledRef = useRef(false)
  const versionRef = useRef(0)
  const subscribersRef = useRef<Set<() => void>>(new Set())

  // Use useSyncExternalStore for optimal re-render control
  const subscribe = useCallback((cb: () => void) => {
    subscribersRef.current.add(cb)
    return () => { subscribersRef.current.delete(cb) }
  }, [])

  const getSnapshot = useCallback(() => rectsRef.current, [])

  const notify = useCallback(() => {
    versionRef.current++
    for (const cb of subscribersRef.current) cb()
  }, [])

  /** Measure all known elements, only notify if values changed */
  const measure = useCallback(() => {
    const newMap = new Map<string, DOMRect>()
    for (const [id, el] of elementsRef.current) {
      newMap.set(id, el.getBoundingClientRect())
    }
    if (!rectsEqual(rectsRef.current, newMap)) {
      rectsRef.current = newMap
      notify()
    }
  }, [notify])

  /** Full DOM scan for [data-presentation-id] elements */
  const scan = useCallback(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-presentation-id]")
    const newElements = new Map<string, Element>()

    elements.forEach((el) => {
      const id = el.dataset.presentationId
      if (id) newElements.set(id, el)
    })

    // Update ResizeObserver
    const ro = resizeObserverRef.current
    if (ro) {
      for (const [id, el] of elementsRef.current) {
        if (!newElements.has(id)) ro.unobserve(el)
      }
      for (const [id, el] of newElements) {
        if (!elementsRef.current.has(id)) ro.observe(el)
      }
    }

    elementsRef.current = newElements
    measure()
  }, [measure])

  /** Debounced scan — at most once per frame */
  const scheduleScan = useCallback(() => {
    if (scanScheduledRef.current) return
    scanScheduledRef.current = true
    requestAnimationFrame(() => {
      scanScheduledRef.current = false
      scan()
    })
  }, [scan])

  /** Throttled measure — at most once per frame for scroll/resize events */
  const measureScheduledRef = useRef(false)
  const throttledMeasure = useCallback(() => {
    if (measureScheduledRef.current) return
    measureScheduledRef.current = true
    requestAnimationFrame(() => {
      measureScheduledRef.current = false
      measure()
    })
  }, [measure])

  useLayoutEffect(() => {
    scan()

    // ResizeObserver: fires when observed elements change size/position
    resizeObserverRef.current = new ResizeObserver(() => throttledMeasure())

    // MutationObserver: only re-scan when nodes are added/removed
    // Filter: check if any mutation involves data-presentation-id elements
    mutationObserverRef.current = new MutationObserver((mutations) => {
      let relevant = false
      for (const m of mutations) {
        if (m.type !== "childList") continue
        // Check added nodes
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
        // Check removed nodes
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
      if (relevant) scheduleScan()
    })

    mutationObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    })

    window.addEventListener("resize", throttledMeasure)
    window.addEventListener("scroll", throttledMeasure, true)

    return () => {
      resizeObserverRef.current?.disconnect()
      mutationObserverRef.current?.disconnect()
      window.removeEventListener("resize", throttledMeasure)
      window.removeEventListener("scroll", throttledMeasure, true)
    }
  }, [scan, throttledMeasure, scheduleScan])

  // useSyncExternalStore ensures minimal re-renders
  const rects = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return (
    <TargetRectsContext.Provider value={rects}>
      {children}
    </TargetRectsContext.Provider>
  )
}

/**
 * Hook to get the current rects map. Re-renders when any target moves/resizes.
 */
export function useTargetRects(): TargetRectsMap {
  return useContext(TargetRectsContext)
}

/**
 * Hook to get a specific target's DOMRect. Returns undefined if not found.
 */
export function useTargetRect(targetId: string): DOMRect | undefined {
  const rects = useContext(TargetRectsContext)
  return rects.get(targetId)
}
