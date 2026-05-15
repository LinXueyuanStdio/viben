import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { TimelineCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface TimelineProps {
  command: TimelineCommand
}

/**
 * Timeline overlay -- Horizontal or vertical timeline with dots connected by line.
 * Line draws progressively, events stagger in.
 * Parent computes all node entrance values to avoid per-node useCurrentFrame subscriptions.
 */
export function Timeline({ command }: TimelineProps) {
  const {
    position: _position,
    events,
    direction = "horizontal",
    width = 400,
    color = "#6366F1",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const isHorizontal = direction === "horizontal"
  const nodeSpacing = isHorizontal
    ? width / Math.max(events.length - 1, 1)
    : 60
  const totalLength = isHorizontal
    ? width
    : (events.length - 1) * nodeSpacing

  const drawProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  // Pre-compute all node entrance values in parent (no useMemo -- frame changes every render)
  const nodeEntrances = events.map((_, i) => {
    const delay = staggerDelay(i, 5)
    const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : progress,
      scale: settled ? 1 : 0.9 + progress * 0.1,
    }
  })

  const uid = `tl-${position.x}-${position.y}`

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
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          position: "relative",
          width: isHorizontal ? width : "auto",
          height: isHorizontal ? "auto" : totalLength + 40,
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          alignItems: "flex-start",
        }}
      >
        {/* Connecting line */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: isHorizontal ? width : 40,
            height: isHorizontal ? 40 : totalLength + 40,
            pointerEvents: "none",
          }}
        >
          <defs>
            <linearGradient
              id={`${uid}-line-grad`}
              x1={isHorizontal ? "0" : "0"}
              y1={isHorizontal ? "0" : "0"}
              x2={isHorizontal ? "1" : "0"}
              y2={isHorizontal ? "0" : "1"}
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="50%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={adjustColor(color, 40)} stopOpacity={0.8} />
            </linearGradient>
            <filter id={`${uid}-dot-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track line (subtle) */}
          <line
            x1={isHorizontal ? 0 : 10}
            y1={isHorizontal ? 10 : 10}
            x2={isHorizontal ? totalLength * drawProgress : 10}
            y2={isHorizontal ? 10 : 10 + totalLength * drawProgress}
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={2}
          />
          {/* Gradient colored line */}
          <line
            x1={isHorizontal ? 0 : 10}
            y1={isHorizontal ? 10 : 10}
            x2={isHorizontal ? totalLength * drawProgress : 10}
            y2={isHorizontal ? 10 : 10 + totalLength * drawProgress}
            stroke={`url(#${uid}-line-grad)`}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>

        {/* Event nodes */}
        {events.map((event, i) => {
          const entrance = nodeEntrances[i]
          const dotColor = event.color || color
          const isActive = event.active ?? false
          const dotSize = isActive ? 12 : 8
          const nodeX = isHorizontal ? i * nodeSpacing : 0
          const nodeY = isHorizontal ? 0 : i * nodeSpacing

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: nodeX,
                top: nodeY,
                opacity: entrance.opacity,
                transform: `scale(${entrance.scale})`,
                display: "flex",
                flexDirection: isHorizontal ? "column" : "row",
                alignItems: isHorizontal ? "center" : "flex-start",
                gap: 6,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: dotColor,
                  border: isActive ? `2px solid rgba(255, 255, 255, 0.8)` : "1px solid rgba(255,255,255,0.2)",
                  boxShadow: isActive
                    ? `0 0 12px ${dotColor}44, 0 0 4px ${dotColor}66`
                    : `0 0 6px ${dotColor}22`,
                  flexShrink: 0,
                  marginTop: isHorizontal ? 10 - dotSize / 2 : 0,
                  marginLeft: isHorizontal ? 0 : 10 - dotSize / 2,
                }}
              />

              {/* Label */}
              <div
                style={{
                  marginTop: isHorizontal ? 8 : 0,
                  marginLeft: isHorizontal ? 0 : 12,
                  textAlign: isHorizontal ? "center" : "left",
                  maxWidth: isHorizontal ? nodeSpacing - 10 : 180,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.8)",
                    textShadow: isActive ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    letterSpacing: 0.2,
                  }}
                >
                  {event.label}
                </div>
                {event.description && (
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255, 255, 255, 0.5)",
                      marginTop: 3,
                      lineHeight: 1.3,
                    }}
                  >
                    {event.description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Lighten/shift a hex color for gradient end stop */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16)
  const r = Math.min(255, ((num >> 16) & 0xff) + amount)
  const g = Math.min(255, ((num >> 8) & 0xff) + amount)
  const b = Math.min(255, (num & 0xff) + amount)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}
