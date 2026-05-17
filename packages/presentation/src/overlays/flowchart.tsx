import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { FlowchartCommand, Point } from "../types"
import { useOverlayStyle } from "../hooks/use-overlay-style"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

// Spring configs for layered timing
const SPRING_NODE = { damping: 10, stiffness: 140, mass: 0.6 } as const
const SPRING_ARROW = { damping: 12, stiffness: 160, mass: 0.4 } as const
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

interface FlowchartProps {
  command: FlowchartCommand
}

interface NodePosition {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Flowchart overlay -- Auto-layout nodes in grid with cinematic layered entrance.
 *
 * Motion layers:
 *   1. Nodes: staggered elastic entrance (scale overshoot + blur)
 *   2. Edges: draw from source to target AFTER both nodes are visible
 *   3. Edge arrows: pop in after line reaches target
 *   4. Labels: fade in after edge is drawn
 *
 * Parent computes all spring values to avoid per-node useCurrentFrame subscriptions.
 */
export function Flowchart({ command }: FlowchartProps) {
  const {
    position: _position,
    nodes,
    edges,
    direction = "horizontal",
    width: _width = 500,
    height: _height = 300,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
  const width = cardSizeResult?.width ?? _width
  const height = cardSizeResult?.height ?? _height
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const isHorizontal = direction === "horizontal"

  // Calculate node positions in a grid layout (memoized)
  const nodePositions = useMemo(() => {
    const nodeWidth = 120
    const nodeHeight = 44
    const cols = isHorizontal ? nodes.length : Math.ceil(Math.sqrt(nodes.length))
    const rows = isHorizontal ? 1 : Math.ceil(nodes.length / cols)
    const gapX = (width - cols * nodeWidth) / Math.max(cols - 1, 1)
    const gapY = (height - rows * nodeHeight) / Math.max(rows - 1, 1)

    const positions: Record<string, NodePosition> = {}
    nodes.forEach((node, i) => {
      const col = isHorizontal ? i : i % cols
      const row = isHorizontal ? 0 : Math.floor(i / cols)
      positions[node.id] = {
        x: col * (nodeWidth + gapX),
        y: row * (nodeHeight + gapY),
        width: nodeWidth,
        height: nodeHeight,
      }
    })
    return positions
  }, [nodes, isHorizontal, width, height])

  // ── Node entrances: elastic with overshoot + accelerating stagger ──
  const nodeEntrances = nodes.map((_, i) => {
    // Non-linear stagger: accelerating gaps (first nodes slower, later ones faster)
    const staggerGap = Math.max(2, 5 - i * 0.5)
    const delay = i === 0 ? 4 : nodeEntranceDelays(i, staggerGap)
    const nodeFrame = Math.max(0, frame - delay)
    const progress = frame < delay ? 0 : spring({ frame: nodeFrame, fps, config: SPRING_NODE })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : interpolate(progress, [0, 0.3], [0, 1], CLAMP),
      // Elastic overshoot: 0.6 -> 1.1 -> 0.97 -> 1.0
      scale: settled
        ? 1
        : interpolate(progress, [0, 0.4, 0.7, 1], [0.6, 1.1, 0.97, 1], CLAMP),
      translateY: settled ? 0 : (1 - progress) * 15,
      blur: settled ? 0 : interpolate(progress, [0, 0.5], [4, 0], CLAMP),
      settled,
    }
  })

  // ── Edges: draw after both connected nodes are visible ──
  const edgeStartDelay = nodes.length * 4 + 6
  const edgeDrawDuration = 20

  const uid = `fc-${position.x}-${position.y}`

  // Container size: content + padding
  const containerWidth = width + layout.padding * 2
  const containerHeight = height + layout.padding * 2

  const overlayStyle = useOverlayStyle({ position, width: containerWidth, height: containerHeight })

  return (
    <div
      style={{
        ...overlayStyle,
        width,
        height,
        background: "linear-gradient(135deg, rgba(15, 15, 30, 0.88), rgba(25, 25, 50, 0.82))",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(20px) saturate(180%)",
        padding: layout.padding,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%" }}>
        {/* SVG edges */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id={`${uid}-arrow`}
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill="rgba(255, 255, 255, 0.5)"
              />
            </marker>
            <linearGradient id={`${uid}-edge-grad`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
            </linearGradient>
          </defs>

          {edges.map((edge, i) => {
            const fromPos = nodePositions[edge.from]
            const toPos = nodePositions[edge.to]
            if (!fromPos || !toPos) return null

            // Per-edge staggered delay
            const edgeDelay = edgeStartDelay + i * 4
            const edgeFrame = Math.max(0, frame - edgeDelay)
            const edgeProgress = frame < edgeDelay
              ? 0
              : interpolate(edgeFrame, [0, edgeDrawDuration], [0, 1], CLAMP)

            const startX = isHorizontal ? fromPos.x + fromPos.width : fromPos.x + fromPos.width / 2
            const startY = isHorizontal ? fromPos.y + fromPos.height / 2 : fromPos.y + fromPos.height
            const endX = isHorizontal ? toPos.x : toPos.x + toPos.width / 2
            const endY = isHorizontal ? toPos.y + toPos.height / 2 : toPos.y

            // Ease-out for draw: fast start, gentle end
            const easedProgress = 1 - Math.pow(1 - edgeProgress, 3)
            const visibleEndX = startX + (endX - startX) * easedProgress
            const visibleEndY = startY + (endY - startY) * easedProgress

            // Arrow marker: pop in after line reaches ~90%
            const arrowDelay = edgeDelay + edgeDrawDuration - 2
            const arrowFrame = Math.max(0, frame - arrowDelay)
            const arrowSpring = frame < arrowDelay
              ? 0
              : spring({ frame: arrowFrame, fps, config: SPRING_ARROW })
            const showArrow = arrowSpring > 0.3

            // Label: fade in after edge drawn
            const labelOpacity = edgeProgress < 0.7
              ? 0
              : interpolate(edgeProgress, [0.7, 1], [0, 1], CLAMP)

            return (
              <g key={i} opacity={edgeProgress > 0 ? 1 : 0}>
                <line
                  x1={startX}
                  y1={startY}
                  x2={visibleEndX}
                  y2={visibleEndY}
                  stroke={`url(#${uid}-edge-grad)`}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  markerEnd={showArrow ? `url(#${uid}-arrow)` : undefined}
                />
                {edge.label && labelOpacity > 0 && (
                  <text
                    x={(startX + endX) / 2}
                    y={(startY + endY) / 2 - 8}
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.5)"
                    fontSize={layout.fontSize.axis}
                    style={{ opacity: labelOpacity }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* Nodes — elastic entrance with overshoot */}
        {nodes.map((node, i) => {
          const pos = nodePositions[node.id]!
          const entrance = nodeEntrances[i]
          const nodeColor = node.color || "#6366F1"

          return (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: pos.width,
                height: pos.height,
                opacity: entrance.opacity,
                transform: `translateY(${entrance.translateY}px) scale(${entrance.scale})`,
                filter: entrance.blur > 0.01 ? `blur(${entrance.blur}px)` : undefined,
                willChange: "transform, opacity",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(135deg, ${nodeColor}25, ${nodeColor}15)`,
                border: `1px solid ${nodeColor}50`,
                borderRadius: 10,
                padding: "4px 8px",
                boxShadow: `0 4px 12px rgba(0,0,0,0.2), 0 0 8px ${nodeColor}15, inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
            >
              <span
                style={{
                  fontSize: layout.fontSize.label,
                  fontWeight: 500,
                  color: "#FFFFFF",
                  textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  width: "100%",
                  letterSpacing: 0.2,
                }}
              >
                {node.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Compute cumulative stagger delay for non-linear gaps */
function nodeEntranceDelays(index: number, baseGap: number): number {
  let total = 4 // initial delay
  for (let i = 0; i < index; i++) {
    total += Math.max(2, baseGap - i * 0.5)
  }
  return total
}
