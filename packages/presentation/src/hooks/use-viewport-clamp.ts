import { useMemo } from "react"
import { useVideoConfig } from "remotion"

export interface ViewportClampOptions {
  /** Position x (top-left corner of overlay) */
  x: number
  /** Position y (top-left corner of overlay) */
  y: number
  /** Estimated overlay width (including padding) */
  width: number
  /** Estimated overlay height (including padding) */
  height: number
  /** Margin from viewport edges (default 8) */
  margin?: number
  /** Whether to scale down if overlay exceeds available space (default true) */
  allowScale?: boolean
  /** Minimum scale factor (default 0.6) */
  minScale?: number
}

export interface ViewportClampResult {
  /** Clamped x position */
  x: number
  /** Clamped y position */
  y: number
  /** Scale factor (1.0 = no scaling needed) */
  scale: number
  /** Whether clamping was needed */
  wasClamped: boolean
}

/**
 * Hook that clamps an overlay's position to keep it within the Remotion composition viewport.
 *
 * Strategy:
 * 1. First, try to shift the position to keep the overlay within bounds
 * 2. If the overlay is larger than available space even at position (0,0), scale it down
 *
 * Uses Remotion's useVideoConfig() to get composition dimensions.
 */
export function useViewportClamp({
  x,
  y,
  width,
  height,
  margin = 8,
  allowScale = true,
  minScale = 0.6,
}: ViewportClampOptions): ViewportClampResult {
  const { width: vpW, height: vpH } = useVideoConfig()

  return useMemo(() => {
    const availW = vpW - margin * 2
    const availH = vpH - margin * 2

    // Compute scale factor if overlay exceeds viewport entirely
    let scale = 1
    if (allowScale) {
      const scaleX = width > availW ? availW / width : 1
      const scaleY = height > availH ? availH / height : 1
      scale = Math.max(minScale, Math.min(scaleX, scaleY))
    }

    const effectiveW = width * scale
    const effectiveH = height * scale

    // Clamp position to keep overlay within viewport
    let clampedX = x
    let clampedY = y

    // Right edge: shift left if overflowing
    if (clampedX + effectiveW > vpW - margin) {
      clampedX = vpW - margin - effectiveW
    }
    // Bottom edge: shift up if overflowing
    if (clampedY + effectiveH > vpH - margin) {
      clampedY = vpH - margin - effectiveH
    }
    // Left edge: don't go below margin
    if (clampedX < margin) {
      clampedX = margin
    }
    // Top edge: don't go below margin
    if (clampedY < margin) {
      clampedY = margin
    }

    const wasClamped = clampedX !== x || clampedY !== y || scale !== 1

    return { x: clampedX, y: clampedY, scale, wasClamped }
  }, [x, y, width, height, margin, allowScale, minScale, vpW, vpH])
}
