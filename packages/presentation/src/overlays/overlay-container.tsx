import { memo, useMemo } from "react"
import type { ReactNode, CSSProperties } from "react"
import type { Point } from "../types"
import { useSlideIn, type SlideDirection } from "../utils/motion"
import { useViewportClamp } from "../hooks/use-viewport-clamp"

export interface OverlayContainerProps {
  /** Resolved absolute position (top-left anchor) */
  position: Point
  /** Estimated width of the overlay content (including padding) */
  width: number
  /** Estimated height of the overlay content (including padding) */
  height: number
  /** Children to render inside the container */
  children: ReactNode
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
  /** Additional inline styles for the container */
  style?: CSSProperties
  /** Additional class name */
  className?: string
}

// Module-level base style
const BASE_STYLE: CSSProperties = {
  position: "absolute",
  transformOrigin: "top left",
}

/**
 * OverlayContainer — shared positioning wrapper for all chart/data overlays.
 *
 * Handles:
 * - Viewport-aware position clamping (shifts overlay to stay within bounds)
 * - Scale-down when overlay is larger than available space
 * - Entrance animation via Remotion useSlideIn
 * - Consistent transform-origin for scaling
 *
 * Usage:
 * ```tsx
 * <OverlayContainer position={pos} width={360} height={250}>
 *   <div style={{ ...glassStyle, width: 360, ... }}>
 *     {chart content}
 *   </div>
 * </OverlayContainer>
 * ```
 */
export const OverlayContainer = memo(function OverlayContainer({
  position,
  width,
  height,
  children,
  margin = 8,
  allowScale = true,
  minScale = 0.6,
  slideDirection = "bottom",
  slideDistance = 40,
  style: extraStyle,
}: OverlayContainerProps) {
  // Clamp position to viewport
  const clamped = useViewportClamp({
    x: position.x,
    y: position.y,
    width,
    height,
    margin,
    allowScale,
    minScale,
  })

  // Entrance animation
  const slide = useSlideIn(0, slideDirection, slideDistance)

  // Compute combined transform
  const containerStyle = useMemo<CSSProperties>(() => {
    const scaleVal = clamped.scale * slide.scale
    const translateY = slide.translateY
    const translateX = slide.translateX

    return {
      ...BASE_STYLE,
      left: clamped.x,
      top: clamped.y,
      opacity: slide.opacity,
      transform: `translate(${translateX}px, ${translateY}px) scale(${scaleVal})`,
      ...extraStyle,
    }
  }, [clamped.x, clamped.y, clamped.scale, slide.opacity, slide.scale, slide.translateX, slide.translateY, extraStyle])

  return <div style={containerStyle}>{children}</div>
})
