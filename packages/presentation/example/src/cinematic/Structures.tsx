import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

export interface StructureNode {
  id: string
  title: string
  subtitle?: string
  x: number
  y: number
  z?: number
  tone?: CinematicTone
}

export interface StructureEdge {
  from: string
  to: string
  delay?: number
}

export function FloatingNodeGraph({
  nodes,
  edges,
  delay = 0,
}: {
  nodes: StructureNode[]
  edges: StructureEdge[]
  delay?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible", transform: "translateZ(-30px)" }}>
        <defs>
          <filter id="structure-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {edges.map((edge, index) => {
          const from = nodeMap.get(edge.from)
          const to = nodeMap.get(edge.to)
          if (!from || !to) return null
          const d = delay + (edge.delay ?? index * 5) + 16
          const draw = clampInterpolate(frame, [d, d + 36], [0, 1])
          const accent = toneColor(to.tone ?? "gold")
          const x1 = 960 + from.x
          const y1 = 540 + from.y
          const x2 = 960 + to.x
          const y2 = 540 + to.y
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2 - 28
          return (
            <g key={`${edge.from}-${edge.to}`} opacity={draw}>
              <path
                d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
                fill="none"
                stroke={accent}
                strokeWidth={1.8}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#structure-glow)"
                opacity={0.7}
              />
              {[0, 0.25, 0.5, 0.75].map((offset) => {
                const particleT = ((draw + offset) % 1)
                const px = x1 + (x2 - x1) * particleT
                const py = y1 + (y2 - y1) * particleT - 28 * Math.sin(particleT * Math.PI)
                return (
                  <circle
                    key={offset}
                    cx={px} cy={py} r={2.5 - offset}
                    fill={accent}
                    opacity={draw > 0.3 ? 0.6 * (1 - offset * 0.6) : 0}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>
      {nodes.map((node, index) => {
        const enter = softSpring(frame, fps, delay + index * 6)
        const accent = toneColor(node.tone ?? "gold")
        const drift = loopSine(frame, 160 + index * 9, index) * 5
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 218,
              minHeight: 86,
              marginLeft: -109,
              marginTop: -43,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(${node.x}px, ${node.y + drift}px, ${(node.z ?? 0) - (1 - enter) * 260}px) rotateX(${8 - enter * 3}deg) rotateY(${(node.x / 960) * -12}deg) scale(${0.86 + enter * 0.14})`,
              borderRadius: 16,
              padding: "16px 18px",
              background: `linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035)), rgba(12,12,18,0.62)`,
              border: `1px solid ${accent}45`,
              boxShadow: `0 18px 54px rgba(0,0,0,0.42), 0 0 28px ${accent}20, inset 0 1px 0 rgba(255,255,255,0.16)`,
              backdropFilter: "blur(18px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{node.title}</div>
            {node.subtitle && <div style={{ marginTop: 5, fontSize: 11, letterSpacing: 1.2, color: "rgba(234,236,239,0.48)" }}>{node.subtitle}</div>}
            <div style={{ position: "absolute", right: 14, top: 14, width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: `0 0 16px ${accent}` }} />
          </div>
        )
      })}
    </div>
  )
}

export interface TreeNode {
  id: string
  title: string
  subtitle?: string
  tone?: CinematicTone
  children?: TreeNode[]
}

interface LayoutNode {
  node: TreeNode
  x: number
  y: number
  depth: number
}

function layoutTree(root: TreeNode, spacingX = 220, spacingY = 150): LayoutNode[] {
  const result: LayoutNode[] = []
  const maxDepth = 3
  const maxBreadth = 4

  function traverse(node: TreeNode, depth: number, offsetX: number, totalWidth: number) {
    if (depth > maxDepth) return
    const x = offsetX + totalWidth / 2
    const y = depth * spacingY
    result.push({ node, x, y, depth })

    const children = (node.children ?? []).slice(0, maxBreadth)
    if (children.length === 0) return
    const childWidth = totalWidth / children.length
    children.forEach((child, i) => {
      traverse(child, depth + 1, offsetX + i * childWidth, childWidth)
    })
  }

  const estimatedWidth = Math.pow(maxBreadth, Math.min(2, countDepth(root) - 1)) * spacingX
  traverse(root, 0, -estimatedWidth / 2, estimatedWidth)
  return result
}

function countDepth(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return 1
  return 1 + Math.max(...node.children.map(countDepth))
}

export function TreeStructure({
  root,
  delay = 0,
  tone = "gold",
  orientation = "vertical",
}: {
  root: TreeNode
  delay?: number
  tone?: CinematicTone
  orientation?: "vertical" | "horizontal"
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const nodes = layoutTree(root)
  const accent = toneColor(tone)

  const edges: Array<{ from: LayoutNode; to: LayoutNode; index: number }> = []
  let edgeIndex = 0
  function buildEdges(parentNode: TreeNode, layoutNodes: LayoutNode[]) {
    const parent = layoutNodes.find((n) => n.node.id === parentNode.id)
    if (!parent) return
    for (const child of (parentNode.children ?? []).slice(0, 4)) {
      const childLayout = layoutNodes.find((n) => n.node.id === child.id)
      if (childLayout) {
        edges.push({ from: parent, to: childLayout, index: edgeIndex++ })
        buildEdges(child, layoutNodes)
      }
    }
  }
  buildEdges(root, nodes)

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="tree-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {edges.map((edge) => {
          const d = delay + edge.index * 4 + 8
          const draw = clampInterpolate(frame, [d, d + 30], [0, 1])
          const fromX = 960 + edge.from.x
          const fromY = 340 + edge.from.y
          const toX = 960 + edge.to.x
          const toY = 340 + edge.to.y
          const midY = (fromY + toY) / 2
          const edgeAccent = toneColor(edge.to.node.tone ?? tone)

          return (
            <g key={`${edge.from.node.id}-${edge.to.node.id}`} opacity={draw}>
              <path
                d={`M ${fromX} ${fromY + 30} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY - 30}`}
                fill="none"
                stroke={edgeAccent}
                strokeWidth={1.5}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#tree-glow)"
                opacity={0.7}
              />
            </g>
          )
        })}
      </svg>
      {nodes.map((layoutNode, index) => {
        const enter = softSpring(frame, fps, delay + layoutNode.depth * 8 + index * 3)
        const nodeAccent = toneColor(layoutNode.node.tone ?? tone)
        const drift = loopSine(frame, 160 + index * 7, index) * 4

        return (
          <div
            key={layoutNode.node.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 200,
              minHeight: 72,
              marginLeft: -100,
              marginTop: -36,
              opacity: enter,
              transformStyle: "preserve-3d",
              transform: `translate3d(${layoutNode.x}px, ${layoutNode.y - 200 + drift}px, ${-(1 - enter) * 200 + layoutNode.depth * -40}px) scale(${0.88 + enter * 0.12})`,
              borderRadius: 14,
              padding: "14px 16px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.03)), rgba(12,12,18,0.64)",
              border: `1px solid ${nodeAccent}40`,
              boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 0 24px ${nodeAccent}1A, inset 0 1px 0 rgba(255,255,255,0.14)`,
              backdropFilter: "blur(16px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 18, fontWeight: 800, color: "#fff" }}>{layoutNode.node.title}</div>
            {layoutNode.node.subtitle && <div style={{ marginTop: 4, fontSize: 10, letterSpacing: 1.2, color: "rgba(234,236,239,0.46)" }}>{layoutNode.node.subtitle}</div>}
            <div style={{ position: "absolute", right: 12, top: 12, width: 7, height: 7, borderRadius: "50%", background: nodeAccent, boxShadow: `0 0 12px ${nodeAccent}` }} />
          </div>
        )
      })}
    </div>
  )
}

export function RadialStructure({
  center,
  orbits,
  delay = 0,
  tone = "gold",
}: {
  center: StructureNode
  orbits: Array<{ radius: number; nodes: StructureNode[] }>
  delay?: number
  tone?: CinematicTone
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const centerEnter = softSpring(frame, fps, delay)
  const centerAccent = toneColor(center.tone ?? tone)
  const rotateBase = (frame / 400) * 360

  const allNodes: Array<StructureNode & { px: number; py: number; orbitIdx: number; nodeIdx: number }> = []
  orbits.forEach((orbit, oi) => {
    orbit.nodes.forEach((node, ni) => {
      const angle = (ni / orbit.nodes.length) * Math.PI * 2 + (rotateBase * Math.PI) / 180 * (0.3 + oi * 0.15)
      allNodes.push({
        ...node,
        px: Math.cos(angle) * orbit.radius,
        py: Math.sin(angle) * orbit.radius * 0.55,
        orbitIdx: oi,
        nodeIdx: ni,
      })
    })
  })

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <filter id="radial-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Orbit rings */}
        {orbits.map((orbit, oi) => {
          const ringEnter = clampInterpolate(frame, [delay + 6 + oi * 8, delay + 26 + oi * 8], [0, 1])
          return (
            <ellipse
              key={oi}
              cx={960} cy={540}
              rx={orbit.radius} ry={orbit.radius * 0.55}
              fill="none"
              stroke={centerAccent}
              strokeWidth={1}
              strokeOpacity={ringEnter * 0.2}
              strokeDasharray="4 8"
            />
          )
        })}
        {/* Connection lines */}
        {allNodes.map((node, i) => {
          const lineEnter = clampInterpolate(frame, [delay + 14 + i * 3, delay + 34 + i * 3], [0, 1])
          return (
            <line
              key={`line-${node.id}`}
              x1={960} y1={540}
              x2={960 + node.px} y2={540 + node.py}
              stroke={toneColor(node.tone ?? tone)}
              strokeWidth={1.2}
              opacity={lineEnter * 0.4}
              filter="url(#radial-glow)"
            />
          )
        })}
      </svg>
      {/* Center node */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 160,
          height: 80,
          marginLeft: -80,
          marginTop: -40,
          opacity: centerEnter,
          transform: `scale(${0.8 + centerEnter * 0.2})`,
          borderRadius: 16,
          padding: "16px 18px",
          background: `linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04)), rgba(12,12,18,0.7)`,
          border: `1.5px solid ${centerAccent}60`,
          boxShadow: `0 0 40px ${centerAccent}30, 0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.18)`,
          backdropFilter: "blur(18px)",
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 20, fontWeight: 800, color: "#fff" }}>{center.title}</div>
        {center.subtitle && <div style={{ marginTop: 3, fontSize: 10, color: "rgba(234,236,239,0.5)" }}>{center.subtitle}</div>}
      </div>
      {/* Orbit nodes */}
      {allNodes.map((node, i) => {
        const nodeEnter = softSpring(frame, fps, delay + 18 + node.orbitIdx * 8 + node.nodeIdx * 4)
        const nodeAccent = toneColor(node.tone ?? tone)
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 160,
              minHeight: 60,
              marginLeft: -80,
              marginTop: -30,
              opacity: nodeEnter,
              transform: `translate(${node.px}px, ${node.py}px) scale(${0.85 + nodeEnter * 0.15})`,
              borderRadius: 12,
              padding: "12px 14px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03)), rgba(12,12,18,0.6)",
              border: `1px solid ${nodeAccent}38`,
              boxShadow: `0 12px 36px rgba(0,0,0,0.36), 0 0 18px ${nodeAccent}18, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: "blur(14px)",
            }}
          >
            <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 15, fontWeight: 700, color: "#fff" }}>{node.title}</div>
            {node.subtitle && <div style={{ marginTop: 3, fontSize: 9, letterSpacing: 1, color: "rgba(234,236,239,0.44)" }}>{node.subtitle}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function TimelineStructure({
  events,
  delay = 0,
  tone = "gold",
  direction = "horizontal",
}: {
  events: Array<{ id: string; title: string; subtitle?: string; tone?: CinematicTone }>
  delay?: number
  tone?: CinematicTone
  direction?: "horizontal" | "vertical"
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const count = events.length
  const activeIndex = Math.min(count - 1, Math.floor(clampInterpolate(frame, [delay + 20, delay + 20 + count * 20], [0, count - 0.01])))
  const followOffset = direction === "horizontal" ? -activeIndex * 200 : -activeIndex * 140

  return (
    <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: direction === "horizontal"
            ? `translateX(${followOffset * 0.3}px)`
            : `translateY(${followOffset * 0.3}px)`,
          transition: "transform 0.3s ease-out",
        }}
      >
        <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <line
            x1={direction === "horizontal" ? 200 : 960}
            y1={direction === "horizontal" ? 540 : 180}
            x2={direction === "horizontal" ? 200 + (count - 1) * 200 : 960}
            y2={direction === "horizontal" ? 540 : 180 + (count - 1) * 140}
            stroke={accent}
            strokeWidth={2}
            strokeOpacity={0.3}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - clampInterpolate(frame, [delay, delay + 40], [0, 1])}
          />
        </svg>
        {events.map((event, i) => {
          const nodeEnter = softSpring(frame, fps, delay + 10 + i * 8)
          const nodeAccent = toneColor(event.tone ?? tone)
          const isActive = i <= activeIndex
          const px = direction === "horizontal" ? -460 + i * 200 : 0
          const py = direction === "horizontal" ? 0 : -320 + i * 140
          const drift = loopSine(frame, 150 + i * 11, i) * 3

          return (
            <div
              key={event.id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 180,
                minHeight: 66,
                marginLeft: -90,
                marginTop: -33,
                opacity: nodeEnter,
                transform: `translate3d(${px}px, ${py + drift}px, ${isActive ? 20 : -30}px) scale(${isActive ? 1 : 0.9})`,
                borderRadius: 13,
                padding: "13px 15px",
                background: isActive
                  ? `linear-gradient(145deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04)), rgba(12,12,18,0.68)`
                  : "rgba(12,12,18,0.45)",
                border: `1px solid ${isActive ? `${nodeAccent}50` : "rgba(234,236,239,0.1)"}`,
                boxShadow: isActive
                  ? `0 14px 42px rgba(0,0,0,0.38), 0 0 22px ${nodeAccent}1A, inset 0 1px 0 rgba(255,255,255,0.14)`
                  : "0 8px 24px rgba(0,0,0,0.2)",
                backdropFilter: "blur(14px)",
              }}
            >
              <div style={{ fontFamily: cinematicTheme.font.zh, fontSize: 16, fontWeight: 700, color: isActive ? "#fff" : "rgba(234,236,239,0.5)" }}>{event.title}</div>
              {event.subtitle && <div style={{ marginTop: 3, fontSize: 10, color: "rgba(234,236,239,0.4)" }}>{event.subtitle}</div>}
              <div style={{ position: "absolute", left: -8, top: "50%", marginTop: -5, width: 10, height: 10, borderRadius: "50%", background: isActive ? nodeAccent : "rgba(234,236,239,0.2)", boxShadow: isActive ? `0 0 12px ${nodeAccent}` : "none" }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
