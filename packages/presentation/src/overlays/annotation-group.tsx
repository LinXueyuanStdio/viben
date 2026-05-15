import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { AnnotationGroupCommand, Point } from "../types"
import { useEntrance, staggerDelay } from "../utils/motion"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface AnnotationGroupProps {
  command: AnnotationGroupCommand
}

/**
 * AnnotationGroup overlay -- Multiple small annotations connected by a line/bracket/dots.
 * Connector draws first, then items pop in with stagger.
 * Premium visual: glass container, gradient connector line, glowing dot badges, refined typography.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function AnnotationGroup({ command }: AnnotationGroupProps) {
  const {
    position: _position,
    items,
    direction = "vertical",
    connector = "line",
  } = command
  const position = _position as Point

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const containerEntrance = useEntrance(0, 12)

  const isHorizontal = direction === "horizontal"
  const itemCount = items.length

  // Layout dimensions
  const layout = useMemo(() => {
    const itemSpacing = isHorizontal ? 110 : 36
    const totalSpan = (itemCount - 1) * itemSpacing
    const connectorLength = totalSpan
    return { itemSpacing, totalSpan, connectorLength }
  }, [itemCount, isHorizontal])

  const { itemSpacing, connectorLength } = layout

  // Connector draw progress (draws first)
  const connectorProgress = interpolate(frame - 5, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  // Per-item pop-in animations (after connector)
  const itemEntrances = items.map((_, i) => {
    const delay = staggerDelay(i, 4) + 14
    const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : Math.max(0, progress),
      scale: settled ? 1 : 0.4 + progress * 0.6,
      translateY: settled ? 0 : (1 - progress) * 8,
    }
  })

  // Default colors
  const defaultColors = ["#6366F1", "#10B981", "#F59E0B", "#EC4899", "#38BDF8", "#A855F7"]

  return (
    <div
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        background: "radial-gradient(ellipse at 20% 15%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 14,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: isHorizontal ? "16px 22px" : "22px 18px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        opacity: containerEntrance.opacity,
        transform: `translateY(${containerEntrance.translateY}px) scale(${containerEntrance.scale})`,
        willChange: "transform, opacity",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          alignItems: isHorizontal ? "center" : "flex-start",
          gap: isHorizontal ? itemSpacing - 70 : itemSpacing - 20,
          position: "relative",
        }}
      >
        {/* Connector */}
        <ConnectorSvg
          direction={direction}
          connector={connector}
          itemCount={itemCount}
          itemSpacing={itemSpacing}
          connectorLength={connectorLength}
          progress={connectorProgress}
          colors={items.map((item, i) => item.color || defaultColors[i % defaultColors.length])}
        />

        {/* Items */}
        {items.map((item, i) => {
          const entrance = itemEntrances[i]
          const itemColor = item.color || defaultColors[i % defaultColors.length]

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                opacity: entrance.opacity,
                transform: `scale(${entrance.scale}) translateY(${entrance.translateY}px)`,
                zIndex: 2,
              }}
            >
              {/* Dot indicator with glow and ring */}
              <div
                style={{
                  position: "relative",
                  width: 10,
                  height: 10,
                  flexShrink: 0,
                }}
              >
                {/* Glow halo */}
                <div
                  style={{
                    position: "absolute",
                    inset: -3,
                    borderRadius: "50%",
                    background: itemColor,
                    opacity: 0.2,
                    filter: "blur(4px)",
                  }}
                />
                {/* Outer ring */}
                <div
                  style={{
                    position: "absolute",
                    inset: -1,
                    borderRadius: "50%",
                    border: `1px solid ${itemColor}66`,
                  }}
                />
                {/* Core dot */}
                <div
                  style={{
                    position: "absolute",
                    inset: 1,
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 30% 30%, ${itemColor}FF, ${itemColor}CC)`,
                  }}
                />
              </div>
              {/* Label with refined typography */}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.9)",
                  whiteSpace: "nowrap",
                  textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  letterSpacing: 0.2,
                }}
              >
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConnectorSvg({
  direction,
  connector,
  itemCount,
  itemSpacing,
  connectorLength,
  progress,
  colors,
}: {
  direction: "horizontal" | "vertical"
  connector: "line" | "bracket" | "dots"
  itemCount: number
  itemSpacing: number
  connectorLength: number
  progress: number
  colors: string[]
}) {
  const isHorizontal = direction === "horizontal"

  // SVG dimensions
  const svgWidth = isHorizontal ? connectorLength + 20 : 20
  const svgHeight = isHorizontal ? 20 : connectorLength + 20
  const offsetX = isHorizontal ? 4 : 4
  const offsetY = isHorizontal ? 10 : 10

  // Positioned absolutely behind items
  const svgStyle: React.CSSProperties = {
    position: "absolute",
    left: isHorizontal ? 0 : -4,
    top: isHorizontal ? "50%" : 0,
    transform: isHorizontal ? "translateY(-50%)" : "none",
    pointerEvents: "none",
    zIndex: 1,
    overflow: "visible",
  }

  // Unique gradient IDs
  const lineGradId = `annot-line-grad-${direction}`

  if (connector === "line") {
    const x1 = isHorizontal ? offsetX : 10
    const y1 = isHorizontal ? offsetY : offsetY
    const x2 = isHorizontal ? offsetX + connectorLength * progress : 10
    const y2 = isHorizontal ? offsetY : offsetY + connectorLength * progress

    return (
      <svg width={svgWidth} height={svgHeight} style={svgStyle}>
        <defs>
          <linearGradient
            id={lineGradId}
            x1={isHorizontal ? "0" : "0"}
            y1={isHorizontal ? "0" : "0"}
            x2={isHorizontal ? "1" : "0"}
            y2={isHorizontal ? "0" : "1"}
          >
            <stop offset="0%" stopColor={colors[0] || "#6366F1"} stopOpacity={0.5} />
            <stop offset="100%" stopColor={colors[colors.length - 1] || "#A855F7"} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        {/* Glow line */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`url(#${lineGradId})`}
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.2}
          style={{ filter: "blur(3px)" }}
        />
        {/* Main gradient line */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={`url(#${lineGradId})`}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (connector === "bracket") {
    const bracketOffset = 6
    const drawLength = connectorLength * progress
    const bracketGradId = `annot-bracket-grad-${direction}`

    if (isHorizontal) {
      const startX = offsetX
      const midY = offsetY - bracketOffset
      const d = `M ${startX} ${offsetY} L ${startX} ${midY} L ${startX + drawLength} ${midY} L ${startX + drawLength} ${offsetY}`
      return (
        <svg width={svgWidth} height={svgHeight} style={svgStyle}>
          <defs>
            <linearGradient id={bracketGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={colors[0] || "#6366F1"} stopOpacity={0.5} />
              <stop offset="100%" stopColor={colors[colors.length - 1] || "#A855F7"} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <path
            d={d}
            fill="none"
            stroke={`url(#${bracketGradId})`}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    }
    const startY = offsetY
    const midX = offsetX - bracketOffset + 10
    const d = `M ${offsetX + 10} ${startY} L ${midX} ${startY} L ${midX} ${startY + drawLength} L ${offsetX + 10} ${startY + drawLength}`
    return (
      <svg width={svgWidth} height={svgHeight} style={svgStyle}>
        <defs>
          <linearGradient id={bracketGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[0] || "#6366F1"} stopOpacity={0.5} />
            <stop offset="100%" stopColor={colors[colors.length - 1] || "#A855F7"} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={`url(#${bracketGradId})`}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // Dots connector with color per dot
  const dotCount = itemCount
  const dots = Array.from({ length: dotCount }, (_, i) => {
    const t = dotCount <= 1 ? 0 : i / (dotCount - 1)
    const visible = t <= progress
    const dotColor = colors[i] || "#6366F1"
    if (isHorizontal) {
      return { cx: offsetX + t * connectorLength, cy: offsetY, visible, color: dotColor }
    }
    return { cx: 10, cy: offsetY + t * connectorLength, visible, color: dotColor }
  })

  return (
    <svg width={svgWidth} height={svgHeight} style={svgStyle}>
      {dots.map((dot, i) => (
        <g key={i}>
          {/* Glow */}
          {dot.visible && (
            <circle
              cx={dot.cx}
              cy={dot.cy}
              r={6}
              fill={dot.color}
              opacity={0.15}
            />
          )}
          <circle
            cx={dot.cx}
            cy={dot.cy}
            r={3}
            fill={dot.visible ? dot.color : "transparent"}
            opacity={dot.visible ? 0.6 : 0}
          />
        </g>
      ))}
    </svg>
  )
}
