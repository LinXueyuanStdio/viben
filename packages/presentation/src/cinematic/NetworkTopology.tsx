import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger, noiseSeed, particleTrail } from "./motion"

// ─── Types ───────────────────────────────────────────────────────────────────

interface NetworkNode {
  id: string
  label: string
  x: number
  y: number
  type?: "server" | "database" | "client" | "service" | "router"
  status?: "online" | "warning" | "offline"
}

interface NetworkConnection {
  from: string
  to: string
  throughput?: number
  animated?: boolean
}

interface ArchitectureLayer {
  label: string
  items: string[]
  color?: string
}

interface MetroLine {
  id: string
  color: string
  stations: Array<{ name: string; x: number; y: number; interchange?: boolean }>
}

interface ConnectionWebNode {
  label: string
  size?: number
  distance?: number
  angle?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status?: "online" | "warning" | "offline"): string {
  switch (status) {
    case "warning":
      return "#F6C453"
    case "offline":
      return "#FF4444"
    default:
      return "#34D399"
  }
}

function nodeIcon(type?: "server" | "database" | "client" | "service" | "router"): string {
  switch (type) {
    case "server":
      return "M4 2h8v3H4zM4 7h8v3H4zM4 12h8v3H4z"
    case "database":
      return "M3 4c0-1.7 2-3 5-3s5 1.3 5 3v8c0 1.7-2 3-5 3s-5-1.3-5-3z"
    case "client":
      return "M2 3h12v8H2zM5 13h6v1H5z"
    case "router":
      return "M8 2L2 8l6 6 6-6z"
    default:
      return "M4 4h8v8H4z"
  }
}

function hexPath(cx: number, cy: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return `M${points.join("L")}Z`
}

// ─── NetworkMap ──────────────────────────────────────────────────────────────

export function NetworkMap({
  nodes,
  connections,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 640,
  height = 400,
}: {
  nodes: NetworkNode[]
  connections: NetworkConnection[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
      }}
    >
      {/* SVG layer for connections */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="net-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {connections.map((conn, idx) => {
          const fromNode = nodeMap.get(conn.from)
          const toNode = nodeMap.get(conn.to)
          if (!fromNode || !toNode) return null

          const connDelay = delay + 20 + stagger(idx, connections.length, 30)
          const draw = clampInterpolate(frame, [connDelay, connDelay + 28], [0, 1])
          const thickness = 1.2 + (conn.throughput ?? 50) / 50
          const dashOffset = conn.animated !== false ? frame * 0.8 : 0

          const x1 = fromNode.x
          const y1 = fromNode.y
          const x2 = toNode.x
          const y2 = toNode.y
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2 - 20 * noiseSeed(idx, 7)

          return (
            <g key={`conn-${conn.from}-${conn.to}`} opacity={draw}>
              {/* Background line */}
              <path
                d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                fill="none"
                stroke={accent}
                strokeWidth={thickness}
                pathLength={100}
                strokeDasharray="4 3"
                strokeDashoffset={-dashOffset}
                filter="url(#net-glow)"
                opacity={0.6}
              />
              {/* Particle flow along connection */}
              {conn.animated !== false &&
                [0, 0.33, 0.66].map((offset, pi) => {
                  const t = ((frame * 0.02 + offset + idx * 0.1) % 1)
                  const px = x1 + (x2 - x1) * t + (midX - (x1 + x2) / 2) * 4 * t * (1 - t)
                  const py = y1 + (y2 - y1) * t + (midY - (y1 + y2) / 2) * 4 * t * (1 - t)
                  return (
                    <circle
                      key={pi}
                      cx={px}
                      cy={py}
                      r={2 + thickness * 0.5}
                      fill={accent}
                      opacity={draw > 0.5 ? 0.7 * (1 - Math.abs(t - 0.5) * 1.4) : 0}
                    />
                  )
                })}
            </g>
          )
        })}
      </svg>

      {/* Node layer */}
      {nodes.map((node, index) => {
        const nodeDelay = delay + stagger(index, nodes.length, 24)
        const enter = softSpring(frame, fps, nodeDelay)
        const sColor = statusColor(node.status)
        const glow = loopSine(frame, 80 + index * 7, index) * 0.5 + 0.5
        const drift = loopSine(frame, 140 + index * 11, index * 3) * 3
        const pulseScale = node.status === "offline" ? 1 + loopSine(frame, 30, index) * 0.08 : 1
        const nodeSize = 56

        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: node.x - nodeSize / 2,
              top: node.y - nodeSize / 2 + drift,
              width: nodeSize,
              height: nodeSize,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(0, 0, ${12 - (1 - enter) * 80}px) scale(${(0.7 + enter * 0.3) * pulseScale})`,
              borderRadius: 14,
              background: `linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), ${cinematicTheme.colors.glass}`,
              border: `1px solid ${accent}40`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.42), 0 0 ${18 + glow * 14}px ${sColor}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
              backdropFilter: "blur(18px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Node icon */}
            <svg width={20} height={20} viewBox="0 0 16 16" fill="none">
              <path d={nodeIcon(node.type)} fill={accent} opacity={0.9} />
            </svg>
            {/* Status indicator */}
            <div
              style={{
                position: "absolute",
                right: -3,
                top: -3,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: sColor,
                boxShadow: `0 0 ${8 + glow * 8}px ${sColor}`,
                border: `1.5px solid ${cinematicTheme.colors.graphite}`,
              }}
            />
          </div>
        )
      })}

      {/* Node labels */}
      {nodes.map((node, index) => {
        const nodeDelay = delay + stagger(index, nodes.length, 24)
        const enter = softSpring(frame, fps, nodeDelay + 8)
        const drift = loopSine(frame, 140 + index * 11, index * 3) * 3

        return (
          <div
            key={`label-${node.id}`}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y + 36 + drift,
              opacity: enter,
              transform: `translateX(-50%) translateY(${(1 - enter) * 8}px)`,
              fontFamily: cinematicTheme.font.zh,
              fontSize: 11,
              fontWeight: 600,
              color: cinematicTheme.colors.coldWhite,
              textAlign: "center",
              whiteSpace: "nowrap",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
            }}
          >
            {node.label}
          </div>
        )
      })}
    </div>
  )
}

// ─── ArchitectureLayers ──────────────────────────────────────────────────────

export function ArchitectureLayers({
  layers,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 600,
  height = 420,
}: {
  layers: ArchitectureLayer[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const count = layers.length
  const layerHeight = Math.min(72, (height - 40) / count - 12)
  const gap = 14

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) perspective(1200px)`,
      }}
    >
      {/* Vertical connectors between layers */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <marker id="arch-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.6" />
          </marker>
        </defs>
        {layers.map((_, idx) => {
          if (idx === 0) return null
          const connDelay = delay + stagger(idx, count, 28) + 14
          const draw = clampInterpolate(frame, [connDelay, connDelay + 20], [0, 1])
          const yTop = height - (idx * (layerHeight + gap)) - layerHeight / 2 - 6
          const yBottom = height - ((idx - 1) * (layerHeight + gap)) - layerHeight / 2 + 6
          const cx = width / 2

          return (
            <g key={`arrow-${idx}`} opacity={draw}>
              <line
                x1={cx}
                y1={yBottom}
                x2={cx}
                y2={yTop + (yBottom - yTop) * (1 - draw)}
                stroke={accent}
                strokeWidth={1.5}
                strokeDasharray="3 2"
                markerEnd="url(#arch-arrow)"
                opacity={0.5}
              />
              {/* Small triangle arrow head */}
              <polygon
                points={`${cx - 4},${yTop + 6} ${cx + 4},${yTop + 6} ${cx},${yTop}`}
                fill={accent}
                opacity={draw * 0.7}
              />
            </g>
          )
        })}
      </svg>

      {/* Layer bars */}
      {layers.map((layer, idx) => {
        const layerDelay = delay + stagger(idx, count, 30)
        const enter = softSpring(frame, fps, layerDelay)
        const layerColor = layer.color ?? accent
        const yPos = height - (idx * (layerHeight + gap)) - layerHeight
        const zOffset = idx * 18
        const drift = loopSine(frame, 180 + idx * 13, idx * 2) * 2

        return (
          <div
            key={idx}
            style={{
              position: "absolute",
              left: 60,
              top: yPos + drift,
              width: width - 80,
              height: layerHeight,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(0, ${(1 - enter) * 60}px, ${zOffset - (1 - enter) * 120}px) rotateX(${(1 - enter) * 12}deg)`,
              borderRadius: 14,
              background: `linear-gradient(90deg, ${layerColor}12, ${layerColor}08, rgba(255,255,255,0.03))`,
              border: `1px solid ${layerColor}40`,
              boxShadow: `0 14px 42px rgba(0,0,0,0.38), 0 0 24px ${layerColor}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(16px)",
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              gap: 16,
            }}
          >
            {/* Layer label */}
            <div
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 13,
                fontWeight: 700,
                color: layerColor,
                minWidth: 64,
                textShadow: `0 0 12px ${layerColor}44`,
              }}
            >
              {layer.label}
            </div>

            {/* Items as chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: 1 }}>
              {layer.items.map((item, itemIdx) => {
                const chipDelay = layerDelay + 8 + itemIdx * 4
                const chipEnter = softSpring(frame, fps, chipDelay)

                return (
                  <div
                    key={itemIdx}
                    style={{
                      opacity: chipEnter,
                      transform: `scale(${0.8 + chipEnter * 0.2}) translateY(${(1 - chipEnter) * 6}px)`,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: `${layerColor}14`,
                      border: `1px solid ${layerColor}30`,
                      fontFamily: cinematicTheme.font.zh,
                      fontSize: 11,
                      fontWeight: 500,
                      color: cinematicTheme.colors.coldWhite,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Depth gradient overlay */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: "30%",
          background: "linear-gradient(to top, rgba(11,11,15,0.4), transparent)",
          pointerEvents: "none",
          borderRadius: "0 0 14px 14px",
        }}
      />
    </div>
  )
}

// ─── MetroMap ────────────────────────────────────────────────────────────────

export function MetroMap({
  lines,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 640,
  height = 360,
}: {
  lines: MetroLine[]
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
  height?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)

  // Build metro-style path (horizontal/vertical/45deg segments)
  function metroPath(stations: Array<{ x: number; y: number }>): string {
    if (stations.length < 2) return ""
    let d = `M ${stations[0].x} ${stations[0].y}`
    for (let i = 1; i < stations.length; i++) {
      const prev = stations[i - 1]
      const curr = stations[i]
      const dx = curr.x - prev.x
      const dy = curr.y - prev.y

      // Metro style: go horizontal first, then diagonal, then vertical (or reverse)
      if (Math.abs(dx) > Math.abs(dy)) {
        const diag = Math.min(Math.abs(dy), Math.abs(dx) * 0.3)
        const diagX = dx > 0 ? diag : -diag
        const diagY = dy > 0 ? diag : -diag
        const midX = prev.x + dx - diagX
        d += ` L ${midX} ${prev.y} L ${curr.x} ${curr.y}`
      } else {
        const diag = Math.min(Math.abs(dx), Math.abs(dy) * 0.3)
        const diagX = dx > 0 ? diag : -diag
        const diagY = dy > 0 ? diag : -diag
        const midY = prev.y + dy - diagY
        d += ` L ${prev.x} ${midY} L ${curr.x} ${curr.y}`
      }
    }
    return d
  }

  // Calculate total path length for animation
  function pathLength(stations: Array<{ x: number; y: number }>): number {
    let len = 0
    for (let i = 1; i < stations.length; i++) {
      const dx = stations[i].x - stations[i - 1].x
      const dy = stations[i].y - stations[i - 1].y
      len += Math.sqrt(dx * dx + dy * dy)
    }
    return len
  }

  // Get position along path at t (0-1)
  function positionOnPath(stations: Array<{ x: number; y: number }>, t: number): { x: number; y: number } {
    if (stations.length < 2) return stations[0] ?? { x: 0, y: 0 }
    const totalLen = pathLength(stations)
    const targetLen = t * totalLen
    let accLen = 0
    for (let i = 1; i < stations.length; i++) {
      const dx = stations[i].x - stations[i - 1].x
      const dy = stations[i].y - stations[i - 1].y
      const segLen = Math.sqrt(dx * dx + dy * dy)
      if (accLen + segLen >= targetLen) {
        const segT = (targetLen - accLen) / segLen
        return {
          x: stations[i - 1].x + dx * segT,
          y: stations[i - 1].y + dy * segT,
        }
      }
      accLen += segLen
    }
    return stations[stations.length - 1]
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
      }}
    >
      {/* Background grid */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="metro-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Subtle background grid */}
        {Array.from({ length: Math.floor(width / 40) }).map((_, i) => (
          <line
            key={`vg-${i}`}
            x1={i * 40}
            y1={0}
            x2={i * 40}
            y2={height}
            stroke={accent}
            strokeWidth={0.3}
            opacity={0.08}
          />
        ))}
        {Array.from({ length: Math.floor(height / 40) }).map((_, i) => (
          <line
            key={`hg-${i}`}
            x1={0}
            y1={i * 40}
            x2={width}
            y2={i * 40}
            stroke={accent}
            strokeWidth={0.3}
            opacity={0.08}
          />
        ))}

        {/* Metro lines */}
        {lines.map((line, lineIdx) => {
          const lineDelay = delay + stagger(lineIdx, lines.length, 24)
          const draw = clampInterpolate(frame, [lineDelay, lineDelay + 36], [0, 1])
          const path = metroPath(line.stations)
          const pLen = pathLength(line.stations)

          // Animated train dot
          const trainT = ((frame * 0.012 + lineIdx * 0.3) % 1)
          const trainPos = positionOnPath(line.stations, trainT)

          return (
            <g key={line.id} opacity={draw}>
              {/* Line path */}
              <path
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={100 - draw * 100}
                filter="url(#metro-glow)"
                opacity={0.85}
              />
              {/* Train dot */}
              {draw > 0.6 && (
                <circle
                  cx={trainPos.x}
                  cy={trainPos.y}
                  r={5}
                  fill={line.color}
                  opacity={0.9}
                >
                  {/* Glow ring around train */}
                </circle>
              )}
              {draw > 0.6 && (
                <circle
                  cx={trainPos.x}
                  cy={trainPos.y}
                  r={10}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={1.5}
                  opacity={0.4 + loopSine(frame, 40, lineIdx) * 0.2}
                />
              )}
            </g>
          )
        })}

        {/* Station dots */}
        {lines.map((line, lineIdx) =>
          line.stations.map((station, stIdx) => {
            const stDelay = delay + stagger(lineIdx, lines.length, 24) + 12 + stIdx * 4
            const enter = softSpring(frame, fps, stDelay)
            const isInterchange = station.interchange === true
            const r = isInterchange ? 8 : 5

            return (
              <g key={`st-${line.id}-${stIdx}`} opacity={enter}>
                {/* Outer ring for interchange */}
                {isInterchange && (
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r={r + 3}
                    fill="none"
                    stroke={cinematicTheme.colors.coldWhite}
                    strokeWidth={2}
                    opacity={0.7}
                  />
                )}
                {/* Station circle */}
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={r * enter}
                  fill={isInterchange ? cinematicTheme.colors.coldWhite : line.color}
                  stroke={cinematicTheme.colors.graphite}
                  strokeWidth={2}
                />
              </g>
            )
          })
        )}
      </svg>

      {/* Station labels */}
      {lines.map((line, lineIdx) =>
        line.stations.map((station, stIdx) => {
          const stDelay = delay + stagger(lineIdx, lines.length, 24) + 18 + stIdx * 4
          const enter = softSpring(frame, fps, stDelay)

          return (
            <div
              key={`label-${line.id}-${stIdx}`}
              style={{
                position: "absolute",
                left: station.x,
                top: station.y + 14,
                opacity: enter,
                transform: `translateX(-50%) translateY(${(1 - enter) * 6}px)`,
                padding: "2px 6px",
                borderRadius: 4,
                background: `${cinematicTheme.colors.glass}`,
                backdropFilter: "blur(8px)",
                border: `1px solid ${line.color}30`,
                fontFamily: cinematicTheme.font.zh,
                fontSize: 9,
                fontWeight: 500,
                color: cinematicTheme.colors.coldWhite,
                whiteSpace: "nowrap",
                textShadow: "0 1px 4px rgba(0,0,0,0.6)",
              }}
            >
              {station.name}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── ConnectionWeb ───────────────────────────────────────────────────────────

export function ConnectionWeb({
  center,
  nodes,
  connections,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  radius = 200,
}: {
  center: { label: string }
  nodes: ConnectionWebNode[]
  connections?: Array<{ from: number; to: number }>
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  radius?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const cx = radius + 40
  const cy = radius + 40
  const svgSize = (radius + 40) * 2

  // Compute node positions
  const nodePositions = nodes.map((node, idx) => {
    const angle = node.angle !== undefined
      ? (node.angle * Math.PI) / 180
      : (idx / nodes.length) * Math.PI * 2 - Math.PI / 2
    const dist = node.distance ?? radius
    return {
      ...node,
      px: cx + Math.cos(angle) * dist,
      py: cy + Math.sin(angle) * dist,
      angle,
    }
  })

  // Pulse ripple
  const rippleProgress = ((frame - delay) % 90) / 90
  const rippleOpacity = Math.max(0, 1 - rippleProgress) * 0.3

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: svgSize,
        height: svgSize,
        marginLeft: -svgSize / 2,
        marginTop: -svgSize / 2,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px)`,
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="web-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="center-glow-grad">
            <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Concentric radial grid circles */}
        {[0.33, 0.66, 1].map((ratio, i) => {
          const gridEnter = clampInterpolate(frame, [delay + 4 + i * 6, delay + 20 + i * 6], [0, 1])
          return (
            <circle
              key={`grid-${i}`}
              cx={cx}
              cy={cy}
              r={radius * ratio}
              fill="none"
              stroke={accent}
              strokeWidth={0.7}
              strokeDasharray="4 6"
              opacity={gridEnter * 0.15}
            />
          )
        })}

        {/* Pulse ripple from center */}
        {frame > delay && (
          <circle
            cx={cx}
            cy={cy}
            r={rippleProgress * radius * 1.2}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            opacity={rippleOpacity}
          />
        )}

        {/* Center glow */}
        <circle
          cx={cx}
          cy={cy}
          r={36}
          fill="url(#center-glow-grad)"
          opacity={softSpring(frame, fps, delay) * 0.6}
        />

        {/* Center → node connections (bezier curves) */}
        {nodePositions.map((node, idx) => {
          const connDelay = delay + 14 + stagger(idx, nodes.length, 26)
          const draw = clampInterpolate(frame, [connDelay, connDelay + 24], [0, 1])
          const thickness = 1 + ((node.size ?? 1) / 3) * 1.5

          // Bezier control point offset perpendicular to line
          const midX = (cx + node.px) / 2
          const midY = (cy + node.py) / 2
          const perpAngle = node.angle + Math.PI / 2
          const curvature = 20 * noiseSeed(idx, 42)
          const ctrlX = midX + Math.cos(perpAngle) * curvature
          const ctrlY = midY + Math.sin(perpAngle) * curvature

          return (
            <path
              key={`conn-${idx}`}
              d={`M ${cx} ${cy} Q ${ctrlX} ${ctrlY} ${node.px} ${node.py}`}
              fill="none"
              stroke={accent}
              strokeWidth={thickness}
              pathLength={100}
              strokeDasharray={100}
              strokeDashoffset={100 - draw * 100}
              filter="url(#web-glow)"
              opacity={draw * 0.55}
            />
          )
        })}

        {/* Cross-connections between nodes */}
        {(connections ?? []).map((conn, idx) => {
          const fromNode = nodePositions[conn.from]
          const toNode = nodePositions[conn.to]
          if (!fromNode || !toNode) return null

          const connDelay = delay + 30 + idx * 5
          const draw = clampInterpolate(frame, [connDelay, connDelay + 20], [0, 1])

          return (
            <line
              key={`cross-${idx}`}
              x1={fromNode.px}
              y1={fromNode.py}
              x2={toNode.px}
              y2={toNode.py}
              stroke={accent}
              strokeWidth={0.8}
              strokeDasharray="3 4"
              opacity={draw * 0.35}
            />
          )
        })}

        {/* Center ring */}
        {(() => {
          const centerEnter = softSpring(frame, fps, delay)
          const ringGlow = loopSine(frame, 70, 0) * 0.3 + 0.7
          return (
            <g opacity={centerEnter}>
              <circle
                cx={cx}
                cy={cy}
                r={22}
                fill={cinematicTheme.colors.glass}
                stroke={accent}
                strokeWidth={2}
                opacity={ringGlow}
              />
              <circle
                cx={cx}
                cy={cy}
                r={28}
                fill="none"
                stroke={accent}
                strokeWidth={1}
                opacity={ringGlow * 0.4}
                strokeDasharray="2 3"
              />
            </g>
          )
        })()}

        {/* Satellite node circles */}
        {nodePositions.map((node, idx) => {
          const nodeDelay = delay + 10 + stagger(idx, nodes.length, 24)
          const enter = softSpring(frame, fps, nodeDelay, { damping: 18, stiffness: 100, mass: 0.8 })
          const nodeSize = 10 + (node.size ?? 1) * 4
          const glow = loopSine(frame, 90 + idx * 8, idx * 2) * 0.3 + 0.7

          return (
            <g key={`node-${idx}`} opacity={enter}>
              {/* Glow backdrop */}
              <circle
                cx={node.px}
                cy={node.py}
                r={nodeSize + 6}
                fill={accent}
                opacity={enter * glow * 0.08}
              />
              {/* Node body */}
              <circle
                cx={node.px}
                cy={node.py}
                r={nodeSize * enter}
                fill={cinematicTheme.colors.glass}
                stroke={accent}
                strokeWidth={1.5}
                opacity={0.9}
              />
            </g>
          )
        })}
      </svg>

      {/* Center label */}
      {(() => {
        const centerEnter = softSpring(frame, fps, delay + 4)
        return (
          <div
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              transform: `translate(-50%, -50%) scale(${0.8 + centerEnter * 0.2})`,
              opacity: centerEnter,
              fontFamily: cinematicTheme.font.zh,
              fontSize: 14,
              fontWeight: 800,
              color: cinematicTheme.colors.coldWhite,
              textAlign: "center",
              textShadow: `0 0 12px ${accent}66`,
              whiteSpace: "nowrap",
            }}
          >
            {center.label}
          </div>
        )
      })()}

      {/* Satellite node labels */}
      {nodePositions.map((node, idx) => {
        const nodeDelay = delay + 16 + stagger(idx, nodes.length, 24)
        const enter = softSpring(frame, fps, nodeDelay)
        // Position label outside the node
        const labelAngle = node.angle
        const labelDist = (node.distance ?? radius) + 24 + (node.size ?? 1) * 4
        const labelX = cx + Math.cos(labelAngle) * labelDist
        const labelY = cy + Math.sin(labelAngle) * labelDist

        return (
          <div
            key={`nlabel-${idx}`}
            style={{
              position: "absolute",
              left: labelX,
              top: labelY,
              transform: `translate(-50%, -50%) scale(${0.85 + enter * 0.15})`,
              opacity: enter,
              padding: "3px 8px",
              borderRadius: 6,
              background: cinematicTheme.colors.glass,
              backdropFilter: "blur(10px)",
              border: `1px solid ${accent}28`,
              fontFamily: cinematicTheme.font.zh,
              fontSize: 10,
              fontWeight: 600,
              color: cinematicTheme.colors.coldWhite,
              whiteSpace: "nowrap",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
          >
            {node.label}
          </div>
        )
      })}
    </div>
  )
}
