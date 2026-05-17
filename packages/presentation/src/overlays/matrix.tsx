import { useCurrentFrame, useVideoConfig, spring } from "remotion"
import type { MatrixCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"
import { useOverlayStyle } from "../hooks/use-overlay-style"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface MatrixProps {
  command: MatrixCommand
}

/**
 * Matrix overlay -- Feature comparison table with animated indicators.
 * Header slides in, then rows stagger with check marks popping.
 * Premium visual: glass container, gradient header, glowing check/cross icons, refined grid.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Matrix({ command }: MatrixProps) {
  const {
    position: _position,
    columns,
    rows,
    width = 420,
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Header animation
  const headerProgress = spring({
    frame: frame - 4,
    fps,
    config: SPRING_CONFIG,
  })
  const headerSettled = headerProgress >= 0.999
  const headerOpacity = headerSettled ? 1 : Math.max(0, headerProgress)
  const headerTranslateY = headerSettled ? 0 : (1 - headerProgress) * -10

  // Per-row entrance animations
  const rowEntrances = rows.map((_, i) => {
    const delay = staggerDelay(i, 5) + 10
    const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : Math.max(0, progress),
      translateX: settled ? 0 : (1 - progress) * -20,
      scale: settled ? 1 : 0.95 + progress * 0.05,
    }
  })

  // Per-cell indicator pop (each row's cells stagger)
  const cellPops: number[][] = rows.map((row, rowIdx) => {
    return row.values.map((_, colIdx) => {
      const delay = staggerDelay(rowIdx, 5) + staggerDelay(colIdx, 3) + 15
      const progress = spring({
        frame: frame - delay,
        fps,
        config: { damping: 12, stiffness: 180, mass: 0.5 },
      })
      return progress >= 0.999 ? 1 : Math.max(0, progress)
    })
  })

  const colWidth = Math.floor((width - 140) / columns.length)

  // Container size: content width + padding (16 * 2), estimated height
  const containerWidth = width + 32
  const containerHeight = (rows.length + 1) * 40 + 32

  const overlayStyle = useOverlayStyle({ position, width: containerWidth, height: containerHeight })

  return (
    <div
      style={{
        ...overlayStyle,
        width,
        background: "radial-gradient(ellipse at 30% 10%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 14,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header row with gradient background */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `140px repeat(${columns.length}, ${colWidth}px)`,
          gap: 0,
          padding: "10px 0",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)",
          borderRadius: "8px 8px 0 0",
          marginLeft: -8,
          marginRight: -8,
          paddingLeft: 8,
          paddingRight: 8,
          opacity: headerOpacity,
          transform: `translateY(${headerTranslateY}px)`,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255, 255, 255, 0.35)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Feature
        </div>
        {columns.map((col, i) => (
          <div
            key={i}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255, 255, 255, 0.9)",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          >
            {col}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row, rowIdx) => {
        const entrance = rowEntrances[rowIdx]
        return (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: `140px repeat(${columns.length}, ${colWidth}px)`,
              gap: 0,
              padding: "10px 0",
              borderBottom: rowIdx < rows.length - 1 ? "1px solid rgba(255, 255, 255, 0.04)" : "none",
              opacity: entrance.opacity,
              transform: `translateX(${entrance.translateX}px) scale(${entrance.scale})`,
            }}
          >
            {/* Row label */}
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "rgba(255, 255, 255, 0.75)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: 8,
              }}
            >
              {row.label}
            </div>

            {/* Cell indicators */}
            {row.values.map((val, colIdx) => {
              const pop = cellPops[rowIdx][colIdx]
              return (
                <div
                  key={colIdx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${pop})`,
                    opacity: pop,
                  }}
                >
                  <CellIndicator value={val} />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function CellIndicator({ value }: { value: "yes" | "no" | "partial" }) {
  switch (value) {
    case "yes":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id="yes-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
            </radialGradient>
            <filter id="yes-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={12} cy={12} r={10} fill="url(#yes-bg)" />
          <circle cx={12} cy={12} r={10} fill="none" stroke="#10B981" strokeWidth={0.5} strokeOpacity={0.3} />
          <polyline
            points="7 12 10 16 17 9"
            stroke="#10B981"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#yes-glow)"
          />
        </svg>
      )
    case "no":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id="no-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0.1} />
            </radialGradient>
            <filter id="no-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={12} cy={12} r={10} fill="url(#no-bg)" />
          <circle cx={12} cy={12} r={10} fill="none" stroke="#EF4444" strokeWidth={0.5} strokeOpacity={0.3} />
          <g filter="url(#no-glow)">
            <line x1={8} y1={8} x2={16} y2={16} stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={16} y1={8} x2={8} y2={16} stroke="#EF4444" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        </svg>
      )
    case "partial":
      return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <defs>
            <radialGradient id="partial-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.1} />
            </radialGradient>
            <radialGradient id="partial-dot" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FBBF24" />
              <stop offset="100%" stopColor="#F59E0B" />
            </radialGradient>
            <filter id="partial-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx={12} cy={12} r={10} fill="url(#partial-bg)" />
          <circle cx={12} cy={12} r={10} fill="none" stroke="#F59E0B" strokeWidth={0.5} strokeOpacity={0.3} />
          <circle cx={12} cy={12} r={4} fill="url(#partial-dot)" filter="url(#partial-glow)" />
        </svg>
      )
  }
}
