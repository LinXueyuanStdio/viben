"use client"

import { useState, useCallback, useEffect, useRef } from "react"

interface UseResizableOptions {
  /** CSS 变量名，如 '--sidebar-w' */
  cssVar: string
  /** localStorage key，如 'viben-sidebar-w' */
  storageKey: string
  minWidth: number
  maxWidth: number
  defaultWidth: number
  /** 'left' 向左拖扩大，'right' 向右拖扩大 */
  direction: "left" | "right"
}

interface UseResizableReturn {
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void
    className: string
  }
  isDragging: boolean
}

export function useResizable({
  cssVar,
  storageKey,
  minWidth,
  maxWidth,
  defaultWidth,
  direction,
}: UseResizableOptions): UseResizableReturn {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const widthRef = useRef(defaultWidth)

  // Initialize: read from localStorage or use default
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const val = parseInt(stored, 10)
        if (!isNaN(val) && val >= minWidth && val <= maxWidth) {
          widthRef.current = val
        }
      }
    } catch { /* localStorage unavailable */ }
    document.documentElement.style.setProperty(cssVar, `${widthRef.current}px`)
  }, [cssVar, storageKey, minWidth, maxWidth])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = e.currentTarget as HTMLElement
      el.setPointerCapture(e.pointerId)
      startXRef.current = e.clientX
      startWidthRef.current = widthRef.current
      setIsDragging(true)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "col-resize"
    },
    []
  )

  useEffect(() => {
    if (!isDragging) return

    const onPointerMove = (e: PointerEvent) => {
      const delta = e.clientX - startXRef.current
      const newWidth =
        direction === "right"
          ? startWidthRef.current + delta
          : startWidthRef.current - delta
      const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth))
      widthRef.current = clamped
      document.documentElement.style.setProperty(cssVar, `${clamped}px`)
    }

    const onPointerUp = () => {
      setIsDragging(false)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
      try { localStorage.setItem(storageKey, String(widthRef.current)) } catch { /* */ }
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [isDragging, cssVar, storageKey, minWidth, maxWidth, direction])

  return {
    handleProps: {
      onPointerDown,
      className: isDragging
        ? "bg-primary/40 touch-none"
        : "hover:bg-primary/20",
    },
    isDragging,
  }
}
