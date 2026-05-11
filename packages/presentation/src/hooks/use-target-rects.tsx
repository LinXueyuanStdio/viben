import { createContext, useContext, useLayoutEffect, useState, useRef, useCallback } from "react"
import type { ReactNode } from "react"

/**
 * A map of targetId -> DOMRect for all elements with data-presentation-id.
 * Updated reactively via ResizeObserver + MutationObserver.
 */
export type TargetRectsMap = Map<string, DOMRect>

const TargetRectsContext = createContext<TargetRectsMap>(new Map())

/**
 * Provider that observes all [data-presentation-id] elements in the document.
 * Uses ResizeObserver for size/position changes and MutationObserver for DOM additions/removals.
 * Provides a reactive Map<targetId, DOMRect> via context.
 */
export function TargetRectsProvider({ children }: { children: ReactNode }) {
  const [rects, setRects] = useState<TargetRectsMap>(new Map())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const mutationObserverRef = useRef<MutationObserver | null>(null)
  const elementsRef = useRef<Map<string, Element>>(new Map())

  const scan = useCallback(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-presentation-id]")
    const newMap = new Map<string, DOMRect>()
    const newElements = new Map<string, Element>()

    console.group(`[TargetRects] scan() — found ${elements.length} elements`)

    elements.forEach((el) => {
      const id = el.dataset.presentationId
      if (!id) return
      newElements.set(id, el)
      const rect = el.getBoundingClientRect()
      newMap.set(id, rect)

      // Detailed info for debugging container positions
      const cs = getComputedStyle(el)
      const parent = el.parentElement
      const parentRect = parent?.getBoundingClientRect()
      console.log(
        `  [${id}]`,
        `rect={left:${rect.left.toFixed(0)}, top:${rect.top.toFixed(0)}, w:${rect.width.toFixed(0)}, h:${rect.height.toFixed(0)}}`,
        `| position:${cs.position} display:${cs.display}`,
        `| parent="${parent?.dataset?.presentationId || parent?.tagName}"`,
        parentRect ? `parentRect={left:${parentRect.left.toFixed(0)}, top:${parentRect.top.toFixed(0)}, w:${parentRect.width.toFixed(0)}, h:${parentRect.height.toFixed(0)}}` : '',
        `| offsetLeft:${el.offsetLeft} offsetTop:${el.offsetTop}`,
      )
      // 如果 rect 全是 0，标记为异常
      if (rect.width === 0 && rect.height === 0) {
        console.warn(`  ⚠️ [${id}] has ZERO size! Element may not be laid out. hidden=${el.hidden} style.display=${cs.display}`)
      }
    })
    console.groupEnd()

    // Update ResizeObserver: unobserve removed, observe added
    const ro = resizeObserverRef.current
    if (ro) {
      // Unobserve elements no longer present
      for (const [id, el] of elementsRef.current) {
        if (!newElements.has(id)) {
          ro.unobserve(el)
        }
      }
      // Observe newly added elements
      for (const [id, el] of newElements) {
        if (!elementsRef.current.has(id)) {
          ro.observe(el)
        }
      }
    }

    elementsRef.current = newElements
    setRects(newMap)
  }, [])

  // useLayoutEffect fires synchronously after DOM mutations, before browser paint.
  // This ensures we measure elements at the correct time — no flicker, no stale coords.
  useLayoutEffect(() => {
    console.log("[TargetRects] useLayoutEffect fired — performing initial scan")
    // Initial synchronous scan — DOM is committed, elements are measurable
    scan()

    // ResizeObserver: fires when any observed element changes size/position
    resizeObserverRef.current = new ResizeObserver((entries) => {
      console.log(`[TargetRects] ResizeObserver fired for ${entries.length} entries`)
      const newMap = new Map<string, DOMRect>()
      for (const [id, el] of elementsRef.current) {
        newMap.set(id, el.getBoundingClientRect())
      }
      setRects(newMap)
    })

    // MutationObserver: detect DOM additions/removals of target elements
    mutationObserverRef.current = new MutationObserver((mutations) => {
      console.log(`[TargetRects] MutationObserver fired (${mutations.length} mutations) — re-scanning`)
      scan()
    })

    // Observe the whole document for subtree changes
    mutationObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Also update on scroll and resize
    const handleUpdate = () => {
      const newMap = new Map<string, DOMRect>()
      for (const [id, el] of elementsRef.current) {
        newMap.set(id, el.getBoundingClientRect())
      }
      setRects(newMap)
    }

    window.addEventListener("resize", handleUpdate)
    window.addEventListener("scroll", handleUpdate, true)

    return () => {
      resizeObserverRef.current?.disconnect()
      mutationObserverRef.current?.disconnect()
      window.removeEventListener("resize", handleUpdate)
      window.removeEventListener("scroll", handleUpdate, true)
    }
  }, [scan])

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
