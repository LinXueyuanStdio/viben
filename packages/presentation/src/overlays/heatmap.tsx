import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { HeatmapCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"
import { useOverlayStyle } from "../hooks/use-overlay-style"

const SPRING_CELL = { damping: 18, stiffness: 120, mass: 0.8 } as const
const SPRING_LABEL = { damping: 16, stiffness: 100, mass: 0.9 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface HeatmapProps {
  command: HeatmapCommand
}

/**
 * Heatmap overlay -- Grid of colored cells with cinematic staggered reveal.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with blur clear
 *   2. Cells: diagonal wave stagger (top-left to bottom-right)
 *   3. Cell glow: pulsing intensity after settle
 *   4. Labels: fade in with subtle translateY
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Heatmap({ command }: HeatmapProps) {
  const {
    position: _position,
    data,
    cellSize = 24,
    rowLabels,
    colLabels,
    colors = ["#1E3A5F", "#EF4444"],
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (data.length === 0) return null

  const rows = data.length
  const cols = data[0].length

  const labelWidth = rowLabels ? 48 : 0
  const gap = 3

  // Pre-compute all cell colors (only depends on data + colors, not frame)
  const cellColors = useMemo(() => {
    const low = hexToRgb(colors[0])
    const high = hexToRgb(colors[1])
    if (!low || !high) return data.map(row => row.map(() => colors[0]))
    return data.map(row => row.map(val => {
      const t = Math.min(1, Math.max(0, val))
      const r = Math.round(low.r + (high.r - low.r) * t)
      const g = Math.round(low.g + (high.g - low.g) * t)
      const b = Math.round(low.b + (high.b - low.b) * t)
      return `rgb(${r},${g},${b})`
    }))
  }, [data, colors])

  // Pre-compute ALL cell spring values in parent (diagonal wave pattern)
  const cellSprings: number[][] = []
  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const rowValues: number[] = []
    for (let colIdx = 0; colIdx < cols; colIdx++) {
      // Diagonal wave: delay = (row + col) * gap
      const delay = staggerDelay(rowIdx + colIdx, 3) + 8
      const val = spring({ frame: frame - delay, fps, config: SPRING_CELL })
      rowValues.push(val >= 0.999 ? 1 : Math.max(0, val))
    }
    cellSprings.push(rowValues)
  }

  // Subtle glow pulse on high-value cells after all settled
  const allSettled = frame > 8 + (rows + cols) * 3 + 20
  const glowPhase = allSettled ? (frame - 30) * 0.08 : 0

  // Label entrance
  const labelDelay = 4
  const labelFrame = Math.max(0, frame - labelDelay)
  const labelSpring = frame < labelDelay ? 0 : spring({ frame: labelFrame, fps, config: SPRING_LABEL })
  const labelSettled = labelSpring >= 0.999
  const labelOpacity = labelSettled ? 1 : interpolate(labelSpring, [0, 0.4], [0, 1], CLAMP)

  const uid = `heatmap-${position.x}-${position.y}`

  const containerWidth = Math.max(280, labelWidth + cols * (cellSize + gap)) + 40   // 20px padding * 2
  const containerHeight = Math.max(200, rows * (cellSize + gap) + 40) + 40

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
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Noise texture overlay for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 16,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          pointerEvents: "none",
        }}
      />

      {/* Gradient border glow */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 16,
          right: 16,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${colors[1]}40, transparent)`,
          borderRadius: 1,
          pointerEvents: "none",
        }}
      />

      {/* Column labels */}
      {colLabels && (
        <div
          style={{
            display: "flex",
            marginLeft: labelWidth,
            marginBottom: 6,
            gap,
            opacity: labelOpacity,
          }}
        >
          {colLabels.slice(0, cols).map((label, i) => (
            <div
              key={i}
              style={{
                width: cellSize,
                textAlign: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.6)",
                fontFamily: "system-ui, sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Grid rows */}
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {data.map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: "flex", alignItems: "center", gap }}>
            {/* Row label */}
            {rowLabels && (
              <div
                style={{
                  width: labelWidth - 4,
                  fontSize: 10,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "system-ui, sans-serif",
                  textAlign: "right",
                  paddingRight: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  opacity: labelOpacity,
                }}
              >
                {rowLabels[rowIdx] ?? ""}
              </div>
            )}

            {/* Cells */}
            {row.map((cellVal, colIdx) => {
              const springVal = cellSprings[rowIdx]?.[colIdx] ?? 1
              const cellColor = cellColors[rowIdx]?.[colIdx] ?? colors[0]
              // Glow intensity proportional to value for high-value cells
              const glowIntensity = allSettled && cellVal > 0.6
                ? 0.3 + 0.3 * Math.sin(glowPhase + rowIdx * 0.5 + colIdx * 0.7)
                : 0
              return (
                <div
                  key={colIdx}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 4,
                    background: cellColor,
                    opacity: springVal,
                    transform: `scale(${0.5 + springVal * 0.5})`,
                    boxShadow: [
                      "inset 0 1px 0 rgba(255,255,255,0.15)",
                      springVal > 0.8 ? `0 0 ${6 + glowIntensity * 4}px ${cellColor}${Math.round((0.3 + glowIntensity) * 255).toString(16).padStart(2, "0")}` : "",
                    ].filter(Boolean).join(", "),
                    transition: "none",
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper: hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  }
}
