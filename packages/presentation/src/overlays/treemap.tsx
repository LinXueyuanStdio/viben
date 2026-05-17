import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { TreemapCommand, Point } from "../types"
import { useOverlayStyle } from "../hooks/use-overlay-style"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

// Spring configs for layered timing
const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_RECT = { damping: 12, stiffness: 140, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface TreemapProps {
  command: TreemapCommand
}

interface TreemapRect {
  x: number
  y: number
  w: number
  h: number
  label: string
  value: number
  color: string
}

/**
 * Treemap overlay -- Rectangular treemap showing hierarchical data with nested colored rectangles.
 *
 * Motion layers:
 *   1. Container: glass morphism fade + scale entrance
 *   2. Rectangles: grow from center with staggered spring
 *   3. Labels: fade in after rectangle settles
 *
 * Uses a simple squarified treemap layout algorithm.
 */
export function Treemap({ command }: TreemapProps) {
  const {
    position: _position,
    data,
    width: _width = 320,
    height: _height = 200,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
  const width = Math.max(280, cardSizeResult?.width ?? _width)
  const height = Math.max(200, cardSizeResult?.height ?? _height)
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Compute treemap layout (squarified)
  const rects = useMemo(() => {
    return computeTreemapLayout(data, width, height)
  }, [data, width, height])

  // Container size: content + padding
  const containerWidth = width + layout.padding * 2
  const containerHeight = height + layout.padding * 2

  const overlayStyle = useOverlayStyle({ position, width: containerWidth, height: containerHeight })

  return (
    <div
      style={{
        ...overlayStyle,
        minWidth: 280,
        minHeight: 200,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: layout.padding,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <div style={{ position: "relative", width, height }}>
        {rects.map((rect, i) => (
          <TreemapRectangle
            key={i}
            rect={rect}
            index={i}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>
    </div>
  )
}

function TreemapRectangle({
  rect,
  index,
  frame,
  fps,
}: {
  rect: TreemapRect
  index: number
  frame: number
  fps: number
}) {
  const staggerDelay = 6 + index * 4
  const rectFrame = Math.max(0, frame - staggerDelay)
  const rectSpring = frame < staggerDelay ? 0 : spring({ frame: rectFrame, fps, config: SPRING_RECT })
  const rectSettled = rectSpring >= 0.999

  const rectScale = rectSettled
    ? 1
    : interpolate(rectSpring, [0, 0.5, 0.8, 1], [0, 0.6, 1.04, 1], CLAMP)
  const rectOpacity = rectSettled ? 1 : interpolate(rectSpring, [0, 0.2], [0, 1], CLAMP)

  // Label fades in after rectangle settles
  const labelDelay = staggerDelay + 8
  const labelFrame = Math.max(0, frame - labelDelay)
  const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_CONTAINER })
  const labelSettled = labelSpring >= 0.999
  const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        transform: `scale(${rectScale})`,
        opacity: rectOpacity,
        transformOrigin: "center center",
        borderRadius: 6,
        background: `linear-gradient(135deg, ${rect.color}dd, ${rect.color}99)`,
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 8px ${rect.color}33`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: 4,
      }}
    >
      <div
        style={{
          opacity: labelOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
        }}
      >
        {rect.w > 50 && rect.h > 30 && (
          <span
            style={{
              fontSize: Math.min(11, rect.w / 8),
              fontWeight: 700,
              color: "rgba(255,255,255,0.95)",
              fontFamily: "system-ui, sans-serif",
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              textAlign: "center",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "90%",
            }}
          >
            {rect.label}
          </span>
        )}
        {rect.w > 40 && rect.h > 40 && (
          <span
            style={{
              fontSize: Math.min(10, rect.w / 10),
              color: "rgba(255,255,255,0.6)",
              fontFamily: "system-ui, monospace",
              fontWeight: 600,
            }}
          >
            {rect.value}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Simple slice-and-dice treemap layout.
 * Alternates horizontal/vertical slicing by sorted value.
 */
function computeTreemapLayout(
  data: Array<{ label: string; value: number; color: string }>,
  width: number,
  height: number,
): TreemapRect[] {
  if (data.length === 0) return []

  const totalValue = data.reduce((sum, d) => sum + d.value, 0)
  if (totalValue <= 0) return []

  // Sort by value descending for better layout
  const sorted = [...data].sort((a, b) => b.value - a.value)

  const rects: TreemapRect[] = []
  layoutSlice(sorted, 0, 0, width, height, totalValue, rects, true)
  return rects
}

function layoutSlice(
  items: Array<{ label: string; value: number; color: string }>,
  x: number,
  y: number,
  w: number,
  h: number,
  totalValue: number,
  rects: TreemapRect[],
  horizontal: boolean,
): void {
  if (items.length === 0) return
  if (items.length === 1) {
    rects.push({
      x: x + 1,
      y: y + 1,
      w: Math.max(0, w - 2),
      h: Math.max(0, h - 2),
      label: items[0].label,
      value: items[0].value,
      color: items[0].color,
    })
    return
  }

  // Split into two groups
  const mid = Math.ceil(items.length / 2)
  const left = items.slice(0, mid)
  const right = items.slice(mid)
  const leftValue = left.reduce((s, d) => s + d.value, 0)
  const ratio = leftValue / totalValue

  if (horizontal) {
    const splitW = w * ratio
    layoutSlice(left, x, y, splitW, h, leftValue, rects, !horizontal)
    layoutSlice(right, x + splitW, y, w - splitW, h, totalValue - leftValue, rects, !horizontal)
  } else {
    const splitH = h * ratio
    layoutSlice(left, x, y, w, splitH, leftValue, rects, !horizontal)
    layoutSlice(right, x, y + splitH, w, h - splitH, totalValue - leftValue, rects, !horizontal)
  }
}
