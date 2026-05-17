import { useMemo } from "react"
import type { CSSProperties } from "react"
import type { Point } from "../types"
import { useSlideIn, type SlideDirection } from "../utils/motion"
import { useViewportClamp } from "./use-viewport-clamp"

export interface UseOverlayStyleOptions {
  /** Resolved absolute position (top-left anchor) */
  position: Point
  /** Estimated width of the overlay (including padding) */
  width: number
  /** Estimated height of the overlay (including padding) */
  height: number
  /** Margin from viewport edges (default 8) */
  margin?: number
  /** Whether to allow scale-down when overlay exceeds viewport (default true) */
  allowScale?: boolean
  /** Minimum scale factor (default 0.6) */
  minScale?: number
  /** Slide-in direction for entrance animation (default "bottom") */
  slideDirection?: SlideDirection
  /** Slide-in distance in px (default 40) */
  slideDistance?: number
}

/**
 * Hook that computes the overlay positioning style — viewport clamping + entrance animation.
 *
 * Returns a CSSProperties object to spread directly onto the overlay's root element.
 * This eliminates the need for a wrapper div (OverlayContainer), reducing DOM nesting.
 *
 * Usage:
 * ```tsx
 * const overlayStyle = useOverlayStyle({ position, width: 392, height: 232 })
 * return (
 *   <div style={{ ...overlayStyle, background: "...", padding: 16 }}>
 *     {content}
 *   </div>
 * )
 * ```
 */
export function useOverlayStyle({
  position,
  width,
  height,
  margin = 8,
  allowScale = true,
  minScale = 0.6,
  slideDirection = "bottom",
  slideDistance = 40,
}: UseOverlayStyleOptions): CSSProperties {
  const clamped = useViewportClamp({
    x: position.x,
    y: position.y,
    width,
    height,
    margin,
    allowScale,
    minScale,
  })

  const slide = useSlideIn(0, slideDirection, slideDistance)

  return useMemo<CSSProperties>(() => {
    const scaleVal = clamped.scale * slide.scale
    return {
      position: "absolute",
      left: clamped.x,
      top: clamped.y,
      transformOrigin: "top left",
      opacity: slide.opacity,
      transform: `translate(${slide.translateX}px, ${slide.translateY}px) scale(${scaleVal})`,
    }
  }, [clamped.x, clamped.y, clamped.scale, slide.opacity, slide.scale, slide.translateX, slide.translateY])
}
