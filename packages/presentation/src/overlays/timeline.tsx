import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { TimelineCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"

const SPRING_CONTAINER = { damping: 16, stiffness: 100, mass: 0.9 } as const
const SPRING_NODE = { damping: 14, stiffness: 120, mass: 0.7 } as const
const SPRING_LABEL = { damping: 12, stiffness: 130, mass: 0.6 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface TimelineProps {
  command: TimelineCommand
}

/**
 * Timeline overlay -- Horizontal or vertical timeline with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Container: glass morphism entrance with blur clear
 *   2. Line: progressive draw with gradient stroke
 *   3. Nodes: elastic pop-in with stagger (scale overshoot)
 *   4. Labels: delayed fade-in with translateY
 *   5. Active node: glow pulse after settle
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
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

  // ── Container entrance ──
  const containerProgress = spring({ frame, fps, config: SPRING_CONTAINER })
  const containerSettled = containerProgress >= 0.999
  const containerOpacity = containerSettled ? 1 : interpolate(containerProgress, [0, 0.3], [0, 1], CLAMP)
  const containerScale = containerSettled
    ? 1
    : interpolate(containerProgress, [0, 0.3, 0.8, 1], [0.92, 0.95, 1.02, 1], CLAMP)
  const containerTranslateY = containerSettled ? 0 : (1 - containerProgress) * 12
  const containerBlur = containerSettled ? 0 : interpolate(containerProgress, [0, 0.5], [4, 0], CLAMP)

  const isHorizontal = direction === "horizontal"
  const nodeSpacing = isHorizontal
    ? width / Math.max(events.length - 1, 1)
    : 60
  const totalLength = isHorizontal
    ? width
    : (events.length - 1) * nodeSpacing

  // ── Line draw: spring-based progressive reveal ──
  const lineDelay = 4
  const lineFrame = Math.max(0, frame - lineDelay)
  const lineSpring = frame < lineDelay ? 0 : spring({ frame: lineFrame, fps, config: SPRING_CONTAINER })
  const lineSettled = lineSpring >= 0.999
  const drawProgress = lineSettled ? 1 : Math.max(0, lineSpring)

  // ── Node entrances: staggered elastic pop-in ──
  const nodeEntrances = events.map((_, i) => {
    const delay = staggerDelay(i, 5) + 8
    const progress = spring({ frame: frame - delay, fps, config: SPRING_NODE })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : interpolate(progress, [0, 0.3], [0, 1], CLAMP),
      scale: settled ? 1 : interpolate(progress, [0, 0.4, 0.7, 1], [0, 1.2, 0.95, 1], CLAMP),
    }
  })

  // ── Label entrances: staggered fade with translateY ──
  const labelEntrances = events.map((_, i) => {
    const delay = staggerDelay(i, 5) + 14
    const progress = spring({ frame: frame - delay, fps, config: SPRING_LABEL })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : interpolate(progress, [0, 0.4], [0, 1], CLAMP),
      translateY: settled ? 0 : (1 - Math.max(0, progress)) * 8,
    }
  })

  // ── Active node glow pulse ──
  const glowPhase = frame * 0.1

  const uid = `tl-${position.x}-${position.y}`

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        transform: `translateY(${containerTranslateY}px) scale(${containerScale})`,
        opacity: containerOpacity,
        filter: containerBlur > 0.01 ? `blur(${containerBlur}px)` : undefined,
        willChange: "transform, opacity",
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        padding: 20,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Noise texture */}
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
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="50%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={adjustColor(color, 40)} stopOpacity={0.7} />
            </linearGradient>
            <filter id={`${uid}-dot-glow`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track line (subtle background) */}
          <line
            x1={isHorizontal ? 0 : 10}
            y1={isHorizontal ? 10 : 10}
            x2={isHorizontal ? totalLength : 10}
            y2={isHorizontal ? 10 : 10 + totalLength}
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Gradient colored line -- draws progressively */}
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
          const labelEntrance = labelEntrances[i]
          const dotColor = event.color || color
          const isActive = event.active ?? false
          const dotSize = isActive ? 12 : 8
          const nodeX = isHorizontal ? i * nodeSpacing : 0
          const nodeY = isHorizontal ? 0 : i * nodeSpacing

          // Active node glow
          const activeGlow = isActive && entrance.scale >= 0.99
            ? 0.4 + 0.2 * Math.sin(glowPhase + i)
            : 0

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: nodeX,
                top: nodeY,
                display: "flex",
                flexDirection: isHorizontal ? "column" : "row",
                alignItems: isHorizontal ? "center" : "flex-start",
                gap: 6,
              }}
            >
              {/* Dot with elastic pop-in */}
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: dotColor,
                  border: isActive ? `2px solid rgba(255, 255, 255, 0.8)` : "1px solid rgba(255,255,255,0.2)",
                  boxShadow: isActive
                    ? `0 0 ${12 + activeGlow * 8}px ${dotColor}${Math.round((0.4 + activeGlow * 0.3) * 255).toString(16).padStart(2, "0")}, 0 0 4px ${dotColor}66`
                    : `0 0 6px ${dotColor}22`,
                  flexShrink: 0,
                  marginTop: isHorizontal ? 10 - dotSize / 2 : 0,
                  marginLeft: isHorizontal ? 0 : 10 - dotSize / 2,
                  opacity: entrance.opacity,
                  transform: `scale(${entrance.scale})`,
                }}
              />

              {/* Label with delayed entrance */}
              <div
                style={{
                  marginTop: isHorizontal ? 8 : 0,
                  marginLeft: isHorizontal ? 0 : 12,
                  textAlign: isHorizontal ? "center" : "left",
                  maxWidth: isHorizontal ? nodeSpacing - 10 : 180,
                  opacity: labelEntrance.opacity,
                  transform: `translateY(${labelEntrance.translateY}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.8)",
                    textShadow: isActive ? `0 1px 2px rgba(0,0,0,0.3), 0 0 8px ${dotColor}33` : "none",
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
                      fontWeight: 500,
                      color: "rgba(255, 255, 255, 0.45)",
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
