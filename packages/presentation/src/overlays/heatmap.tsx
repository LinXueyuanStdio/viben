import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { HeatmapCommand, Point } from "../types"
import { useEntrance, staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface HeatmapProps {
  command: HeatmapCommand
}

/**
 * Heatmap overlay -- Grid of colored cells with staggered reveal.
 * Parent computes all cell spring values in one pass to avoid N*M child subscriptions.
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

  const entrance = useEntrance(0, 12)
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

  // Pre-compute ALL cell spring values in parent (single useCurrentFrame subscription)
  // Note: no useMemo -- frame changes every render so memo never caches
  const cellSprings: number[][] = []
  for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
    const rowValues: number[] = []
    for (let colIdx = 0; colIdx < cols; colIdx++) {
      const delay = staggerDelay(rowIdx * 3 + colIdx, 2) + 8
      const val = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
      rowValues.push(val >= 0.999 ? 1 : val)
    }
    cellSprings.push(rowValues)
  }

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translateY(${entrance.translateY}px) scale(${entrance.scale})`,
        opacity: entrance.opacity,
        willChange: "transform, opacity",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Column labels */}
      {colLabels && (
        <div
          style={{
            display: "flex",
            marginLeft: labelWidth,
            marginBottom: 6,
            gap,
          }}
        >
          {colLabels.slice(0, cols).map((label, i) => (
            <div
              key={i}
              style={{
                width: cellSize,
                textAlign: "center",
                fontSize: 9,
                color: "rgba(255,255,255,0.6)",
                fontFamily: "system-ui, sans-serif",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                letterSpacing: 0.2,
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
                  fontSize: 9,
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "system-ui, sans-serif",
                  textAlign: "right",
                  paddingRight: 6,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  letterSpacing: 0.2,
                }}
              >
                {rowLabels[rowIdx] ?? ""}
              </div>
            )}

            {/* Cells */}
            {row.map((_, colIdx) => {
              const springVal = cellSprings[rowIdx]?.[colIdx] ?? 1
              const cellColor = cellColors[rowIdx]?.[colIdx] ?? colors[0]
              return (
                <div
                  key={colIdx}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 4,
                    background: cellColor,
                    opacity: springVal,
                    transform: `scale(${0.6 + springVal * 0.4})`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), 0 0 ${springVal > 0.8 ? 6 : 0}px ${cellColor}44`,
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
