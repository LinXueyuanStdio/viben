import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { TableCommand, Point } from "../types"

// Spring configs
const SPRING_HEADER = { damping: 14, stiffness: 110, mass: 0.8 } as const
const SPRING_ROW = { damping: 16, stiffness: 120, mass: 0.7 } as const
const SPRING_HIGHLIGHT = { damping: 10, stiffness: 140, mass: 0.5 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface TableProps {
  command: TableCommand
}

/**
 * Table overlay -- Data table with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Header: clip-path wipe (left to right reveal) with blur clear
 *   2. Rows: staggered entrance with non-linear gaps (slow -> fast -> slow)
 *   3. Highlighted cells: delayed pulse glow after row appears
 *   4. Column separators: draw downward effect
 *
 * Parent computes all spring values to avoid per-row useCurrentFrame subscriptions.
 */
export function Table({ command }: TableProps) {
  const {
    position: _position,
    headers,
    rows,
    columnWidths,
    highlights = [],
    headerColor = "#6366F1",
    rowStagger = 3,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Build a set of highlighted cells for quick lookup
  const highlightSet = useMemo(
    () => new Set(highlights.map(([r, c]) => `${r}-${c}`)),
    [highlights],
  )

  // Calculate default column widths
  const defaultColWidth = 100
  const colWidths = columnWidths || headers.map(() => defaultColWidth)

  // ── Header entrance: clip-path wipe left-to-right + blur ──
  const headerProgress = spring({ frame, fps, config: SPRING_HEADER })
  const headerSettled = headerProgress >= 0.999
  const headerClipRight = headerSettled ? 0 : interpolate(headerProgress, [0, 1], [100, 0], CLAMP)
  const headerOpacity = headerSettled ? 1 : interpolate(headerProgress, [0, 0.15], [0, 1], CLAMP)
  const headerBlur = headerSettled ? 0 : interpolate(headerProgress, [0, 0.5], [3, 0], CLAMP)
  const headerTranslateY = headerSettled ? 0 : (1 - headerProgress) * 8

  // ── Row entrances: non-linear stagger (slow -> fast -> slow / bell curve) ──
  const rowCount = rows.length
  const rowEntrances = rows.map((_, rowIndex) => {
    // Bell-curve stagger: edges slower, middle faster
    const normalizedPos = rowCount <= 1 ? 0.5 : rowIndex / (rowCount - 1)
    // Parabolic stagger: gap is smallest in the middle
    const staggerMultiplier = 1 + 1.5 * Math.abs(normalizedPos - 0.5)
    const gap = rowStagger * staggerMultiplier
    const delay = computeRowDelay(rowIndex, rowStagger, rowCount) + 8 // 8 frames after header
    const rowFrame = Math.max(0, frame - delay)
    const progress = frame < delay ? 0 : spring({ frame: rowFrame, fps, config: SPRING_ROW })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : interpolate(progress, [0, 0.3], [0, 1], CLAMP),
      translateY: settled ? 0 : (1 - progress) * 16,
      blur: settled ? 0 : interpolate(progress, [0, 0.5], [2, 0], CLAMP),
      settled,
      delay,
    }
  })

  // ── Column separator draw-down ──
  const separatorDelay = 6
  const separatorDuration = 20
  const separatorElapsed = Math.max(0, frame - separatorDelay)
  const separatorProgress = separatorElapsed >= separatorDuration
    ? 1
    : interpolate(separatorElapsed, [0, separatorDuration], [0, 1], CLAMP)

  // ── Highlighted cell glow pulse (after row settles) ──
  const highlightPulsePhase = Math.max(0, frame - 25)
  const highlightGlow = 0.15 + 0.1 * Math.sin(highlightPulsePhase * 0.1)

  // Total table height for separator lines
  const headerHeight = 36
  const rowHeight = 32
  const totalHeight = headerHeight + rows.length * rowHeight

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        padding: 20,
        fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
        overflow: "hidden",
      }}
    >
      {/* Header row — clip-path wipe */}
      <div
        style={{
          display: "flex",
          opacity: headerOpacity,
          transform: `translateY(${headerTranslateY}px)`,
          filter: headerBlur > 0.01 ? `blur(${headerBlur}px)` : undefined,
          clipPath: headerSettled
            ? undefined
            : `inset(0% ${headerClipRight}% 0% 0%)`,
          background: `linear-gradient(90deg, ${headerColor}18, ${headerColor}08)`,
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px 8px 0 0",
          paddingBottom: 10,
          paddingTop: 6,
          marginBottom: 4,
        }}
      >
        {headers.map((header, colIndex) => (
          <div
            key={colIndex}
            style={{
              width: colWidths[colIndex],
              fontSize: 11,
              fontWeight: 700,
              color: headerColor,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              padding: "4px 10px",
              flexShrink: 0,
              textShadow: `0 0 8px ${headerColor}33`,
            }}
          >
            {header}
          </div>
        ))}
      </div>

      {/* Data rows — non-linear stagger */}
      <div style={{ position: "relative" }}>
        {rows.map((row, rowIndex) => {
          const entrance = rowEntrances[rowIndex]
          const isEvenRow = rowIndex % 2 === 0
          return (
            <div
              key={rowIndex}
              style={{
                display: "flex",
                opacity: entrance.opacity,
                transform: `translateY(${entrance.translateY}px)`,
                filter: entrance.blur > 0.01 ? `blur(${entrance.blur}px)` : undefined,
                borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                background: isEvenRow ? "rgba(255, 255, 255, 0.015)" : "transparent",
                borderRadius: 4,
              }}
            >
              {row.map((cell, colIndex) => {
                const isHighlighted = highlightSet.has(`${rowIndex}-${colIndex}`)
                // Highlighted cell: delayed glow pulse after row entrance
                const cellGlowActive = isHighlighted && entrance.settled
                return (
                  <div
                    key={colIndex}
                    style={{
                      width: colWidths[colIndex],
                      fontSize: 12,
                      color: isHighlighted ? "#FFFFFF" : "rgba(255, 255, 255, 0.65)",
                      textShadow: isHighlighted ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                      padding: "7px 10px",
                      flexShrink: 0,
                      background: isHighlighted ? "rgba(99, 102, 241, 0.2)" : "transparent",
                      borderRadius: isHighlighted ? 4 : 0,
                      boxShadow: cellGlowActive
                        ? `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 ${8 + highlightGlow * 20}px rgba(99, 102, 241, ${highlightGlow})`
                        : isHighlighted
                          ? "inset 0 1px 0 rgba(255,255,255,0.1)"
                          : "none",
                    }}
                  >
                    {cell}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Column separator lines — draw downward */}
        {colWidths.length > 1 && separatorProgress > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {colWidths.slice(0, -1).map((_, colIndex) => {
              const xPos = colWidths.slice(0, colIndex + 1).reduce((a, b) => a + b, 0)
              const lineHeight = totalHeight * separatorProgress
              return (
                <div
                  key={`sep-${colIndex}`}
                  style={{
                    position: "absolute",
                    left: xPos,
                    top: 0,
                    width: 1,
                    height: lineHeight,
                    background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/** Compute cumulative row delay with bell-curve stagger */
function computeRowDelay(rowIndex: number, baseStagger: number, totalRows: number): number {
  let total = 0
  for (let i = 0; i < rowIndex; i++) {
    const normalizedPos = totalRows <= 1 ? 0.5 : i / (totalRows - 1)
    const multiplier = 1 + 1.5 * Math.abs(normalizedPos - 0.5)
    total += baseStagger * multiplier
  }
  return total
}
