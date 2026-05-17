import { useMemo } from "react"
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion"
import type { SankeyCommand, Point } from "../types"
import { staggerDelay } from "../utils/motion"
import { useOverlayStyle } from "../hooks/use-overlay-style"
import { useCardSize } from "../hooks/use-card-size"
import { getCardLayout } from "../utils/card-layout"

const SPRING_CONFIG = { damping: 18, stiffness: 120, mass: 0.8 } as const

interface SankeyProps {
  command: SankeyCommand
}

interface NodeLayout {
  id: string
  label: string
  x: number
  y: number
  height: number
  column: number
}

interface LinkLayout {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  thickness: number
  sourceId: string
  targetId: string
}

/**
 * Sankey overlay -- Flow diagram with proportional-width links connecting source to target nodes.
 * Nodes slide in, then links draw progressively.
 * Premium visual: glass container, gradient flow links, refined node styling with glow.
 *
 * Expects pre-resolved coordinates (TargetRef fields resolved to absolute pixels).
 */
export function Sankey({ command }: SankeyProps) {
  const {
    position: _position,
    nodes,
    links,
    width: _width = 500,
    height: _height = 300,
    cardSize: _cardSize,
  } = command
  const position = _position as Point

  const cardSizeResult = useCardSize({ width: _width, height: _height, cardSize: _cardSize })
  const width = Math.max(280, cardSizeResult?.width ?? _width)
  const height = Math.max(200, cardSizeResult?.height ?? _height)
  const mode = cardSizeResult?.mode ?? "md"
  const layout = useMemo(() => getCardLayout(mode, width, height), [mode, width, height])

  // Label margin: proportional space for text labels outside the node columns
  const labelMargin = Math.floor(layout.contentWidth * 0.12)
  // SVG fits within the content area
  const svgWidth = layout.contentWidth
  const svgHeight = layout.contentHeight

  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Layout computation (static, does not depend on frame)
  const sankeyLayout = useMemo(() => {
    const nodeWidth = 24
    const padding = 40

    // Determine columns: source nodes on left, target nodes on right
    const sourceIds = new Set(links.map((l) => l.source))
    const targetIds = new Set(links.map((l) => l.target))

    // Nodes that are only sources go to column 0
    // Nodes that are only targets go to column 1
    // Nodes that are both stay in the middle (column 0)
    const columns: string[][] = [[], []]
    for (const node of nodes) {
      if (targetIds.has(node.id) && !sourceIds.has(node.id)) {
        columns[1].push(node.id)
      } else {
        columns[0].push(node.id)
      }
    }

    // Calculate total value for each node for sizing
    const nodeValues: Record<string, number> = {}
    for (const node of nodes) {
      const outgoing = links.filter((l) => l.source === node.id).reduce((sum, l) => sum + l.value, 0)
      const incoming = links.filter((l) => l.target === node.id).reduce((sum, l) => sum + l.value, 0)
      nodeValues[node.id] = Math.max(outgoing, incoming, 1)
    }

    // Layout nodes in each column
    // Offset by labelMargin so labels have room on the left outside the node area
    const nodeLayouts: Record<string, NodeLayout> = {}
    const availableHeight = svgHeight - padding * 2

    for (let col = 0; col < columns.length; col++) {
      const colNodes = columns[col]
      const totalValue = colNodes.reduce((sum, id) => sum + nodeValues[id], 0)
      const gap = Math.min(16, availableHeight * 0.05)
      const usableHeight = availableHeight - gap * (colNodes.length - 1)

      let currentY = padding
      for (const nodeId of colNodes) {
        const nodeHeight = Math.max(20, (nodeValues[nodeId] / totalValue) * usableHeight)
        const node = nodes.find((n) => n.id === nodeId)!
        nodeLayouts[nodeId] = {
          id: nodeId,
          label: node.label,
          // Offset by labelMargin so left labels fit within SVG bounds
          x: col === 0 ? labelMargin + padding : svgWidth - labelMargin - padding - nodeWidth,
          y: currentY,
          height: nodeHeight,
          column: col,
        }
        currentY += nodeHeight + gap
      }
    }

    // Layout links
    const sourceOffsets: Record<string, number> = {}
    const targetOffsets: Record<string, number> = {}
    for (const node of nodes) {
      sourceOffsets[node.id] = 0
      targetOffsets[node.id] = 0
    }

    const maxLinkValue = Math.max(...links.map((l) => l.value), 1)
    const linkLayouts: LinkLayout[] = links.map((link) => {
      const source = nodeLayouts[link.source]
      const target = nodeLayouts[link.target]
      if (!source || !target) {
        return { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0, thickness: 0, sourceId: link.source, targetId: link.target }
      }

      const thickness = Math.max(4, (link.value / maxLinkValue) * 40)
      const sy = source.y + sourceOffsets[link.source] + thickness / 2
      const ty = target.y + targetOffsets[link.target] + thickness / 2

      sourceOffsets[link.source] += thickness + 2
      targetOffsets[link.target] += thickness + 2

      return {
        sourceX: source.x + nodeWidth,
        sourceY: sy,
        targetX: target.x,
        targetY: ty,
        thickness,
        sourceId: link.source,
        targetId: link.target,
      }
    })

    return { nodeLayouts, linkLayouts, nodeWidth, columns }
  }, [nodes, links, svgWidth, svgHeight, labelMargin])

  const { nodeLayouts, linkLayouts, nodeWidth, columns } = sankeyLayout

  // Node entrance animations (staggered)
  const nodeEntrances = nodes.map((_, i) => {
    const delay = staggerDelay(i, 4)
    const progress = spring({ frame: frame - delay, fps, config: SPRING_CONFIG })
    const settled = progress >= 0.999
    return {
      opacity: settled ? 1 : Math.max(0, progress),
      translateX: settled ? 0 : (1 - progress) * 30,
      scale: settled ? 1 : 0.9 + progress * 0.1,
    }
  })

  // Link draw progress (after nodes appear)
  const linkDelay = nodes.length * 4 + 8
  const linkDrawProgress = interpolate(frame - linkDelay, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  // Color palette for links (richer gradients)
  const linkColors = [
    ["#6366F1", "#818CF8"],
    ["#8B5CF6", "#A78BFA"],
    ["#EC4899", "#F472B6"],
    ["#10B981", "#34D399"],
    ["#F59E0B", "#FBBF24"],
    ["#38BDF8", "#7DD3FC"],
  ]

  const containerWidth = width
  const containerHeight = height

  const overlayStyle = useOverlayStyle({ position, width: containerWidth, height: containerHeight })

  return (
    <div
      style={{
        ...overlayStyle,
        width: svgWidth,
        height: svgHeight,
        minWidth: 280,
        minHeight: 200,
        background: "radial-gradient(ellipse at 20% 20%, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.92) 70%)",
        borderRadius: 14,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        padding: layout.padding,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <svg width={svgWidth} height={svgHeight} style={{ overflow: "visible" }}>
        <defs>
          {/* Gradient definitions for each link */}
          {linkLayouts.map((link, i) => {
            const [startColor, endColor] = linkColors[i % linkColors.length]
            return (
              <linearGradient
                key={`link-grad-${i}`}
                id={`sankey-link-${i}`}
                x1={link.sourceX}
                y1={link.sourceY}
                x2={link.targetX}
                y2={link.targetY}
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor={startColor} stopOpacity={0.6} />
                <stop offset="50%" stopColor={endColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={startColor} stopOpacity={0.6} />
              </linearGradient>
            )
          })}
          {/* Node glow filter */}
          <filter id="sankey-node-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Links (bezier curves) with gradient fill */}
        {linkLayouts.map((link, i) => {
          if (link.thickness === 0) return null
          const midX = (link.sourceX + link.targetX) / 2
          const d = `M ${link.sourceX} ${link.sourceY} C ${midX} ${link.sourceY}, ${midX} ${link.targetY}, ${link.targetX} ${link.targetY}`
          const pathLength = Math.sqrt(
            Math.pow(link.targetX - link.sourceX, 2) + Math.pow(link.targetY - link.sourceY, 2),
          ) * 1.5
          const dashOffset = pathLength * (1 - linkDrawProgress)

          return (
            <g key={i}>
              {/* Soft glow underneath */}
              <path
                d={d}
                fill="none"
                stroke={linkColors[i % linkColors.length][0]}
                strokeWidth={link.thickness + 4}
                strokeOpacity={0.1 * linkDrawProgress}
                strokeDasharray={pathLength}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ filter: "blur(4px)" }}
              />
              {/* Main gradient link */}
              <path
                d={d}
                fill="none"
                stroke={`url(#sankey-link-${i})`}
                strokeWidth={link.thickness}
                strokeDasharray={pathLength}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </g>
          )
        })}

        {/* Nodes with refined styling */}
        {nodes.map((node, i) => {
          const nl = nodeLayouts[node.id]
          if (!nl) return null
          const entrance = nodeEntrances[i]
          const isRight = nl.column === 1

          const offsetDir = isRight ? 1 : -1
          const nodeColor = linkColors[i % linkColors.length][0]

          return (
            <g
              key={node.id}
              style={{
                opacity: entrance.opacity,
                transform: `translateX(${entrance.translateX * offsetDir}px) scale(${entrance.scale})`,
                transformOrigin: `${nl.x + nodeWidth / 2}px ${nl.y + nl.height / 2}px`,
              }}
            >
              {/* Node glow */}
              <rect
                x={nl.x - 2}
                y={nl.y - 2}
                width={nodeWidth + 4}
                height={nl.height + 4}
                rx={6}
                fill={nodeColor}
                opacity={0.15}
                style={{ filter: "blur(6px)" }}
              />
              {/* Node body with gradient */}
              <defs>
                <linearGradient id={`sankey-node-${node.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={nodeColor} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={nodeColor} stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <rect
                x={nl.x}
                y={nl.y}
                width={nodeWidth}
                height={nl.height}
                rx={5}
                fill={`url(#sankey-node-${node.id})`}
              />
              {/* Highlight edge on node */}
              <rect
                x={nl.x}
                y={nl.y}
                width={nodeWidth}
                height={nl.height}
                rx={5}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={0.5}
              />
              {/* Label */}
              <text
                x={isRight ? nl.x + nodeWidth + 10 : nl.x - 10}
                y={nl.y + nl.height / 2}
                textAnchor={isRight ? "start" : "end"}
                dominantBaseline="central"
                fill="rgba(255, 255, 255, 0.9)"
                fontSize={layout.fontSize.label}
                fontWeight={600}
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
              >
                {nl.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
