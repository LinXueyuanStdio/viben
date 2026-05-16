import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
   1. SwimlaneProcess
   ───────────────────────────────────────────────────────────────────────────── */

export interface SwimlaneStep {
  label: string
  column: number
}

export interface SwimlaneLane {
  label: string
  steps: SwimlaneStep[]
}

export function SwimlaneProcess({
  lanes,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 720,
  height = 400,
}: {
  lanes: SwimlaneLane[]
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

  const laneCount = lanes.length
  const laneHeight = height / Math.max(1, laneCount)
  const labelWidth = 100

  // Find max column to compute column width
  const maxCol = lanes.reduce((max, lane) => {
    const laneMax = lane.steps.reduce((m, s) => Math.max(m, s.column), 0)
    return Math.max(max, laneMax)
  }, 0)
  const colWidth = (width - labelWidth) / Math.max(1, maxCol + 1)

  const containerEnter = softSpring(frame, fps, delay)

  // Flatten all steps for stagger counting
  const allSteps: Array<{ laneIdx: number; stepIdx: number; step: SwimlaneStep }> = []
  lanes.forEach((lane, li) => lane.steps.forEach((step, si) => allSteps.push({ laneIdx: li, stepIdx: si, step })))
  const totalSteps = allSteps.length

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2 + x,
        marginTop: -height / 2 + y,
        transformStyle: "preserve-3d",
        transform: `translate3d(0, 0, ${z}px)`,
        opacity: containerEnter,
      }}
    >
      {/* SVG connectors */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 1 }}
      >
        <defs>
          <filter id="swimlane-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {lanes.map((lane, li) => {
          const sortedSteps = [...lane.steps].sort((a, b) => a.column - b.column)
          return sortedSteps.slice(0, -1).map((fromStep, si) => {
            const toStep = sortedSteps[si + 1]
            const flatIdx = allSteps.findIndex(
              (s) => s.laneIdx === li && s.step === fromStep,
            )
            const lineDelay = delay + 12 + stagger(flatIdx, totalSteps, 30)
            const draw = clampInterpolate(frame, [lineDelay, lineDelay + 22], [0, 1])

            const fromX = labelWidth + fromStep.column * colWidth + colWidth / 2 + 36
            const fromY = li * laneHeight + laneHeight / 2
            const toX = labelWidth + toStep.column * colWidth + colWidth / 2 - 36
            const toY = li * laneHeight + laneHeight / 2

            // If crossing lanes, curve the path
            const midY = (fromY + toY) / 2
            const curveOffset = fromY !== toY ? -20 : 0

            return (
              <g key={`${li}-${si}`} opacity={draw}>
                <path
                  d={`M ${fromX} ${fromY} Q ${(fromX + toX) / 2} ${midY + curveOffset} ${toX} ${toY}`}
                  fill="none"
                  stroke={accent}
                  strokeWidth={1.5}
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - draw}
                  filter="url(#swimlane-glow)"
                  opacity={0.6}
                />
                {/* Arrow head */}
                <polygon
                  points={`${toX},${toY} ${toX - 7},${toY - 4} ${toX - 7},${toY + 4}`}
                  fill={accent}
                  opacity={draw * 0.8}
                />
              </g>
            )
          })
        })}
      </svg>

      {/* Lane rows */}
      {lanes.map((lane, li) => {
        const laneEnter = softSpring(frame, fps, delay + 4 + li * 6)
        return (
          <div
            key={li}
            style={{
              position: "absolute",
              left: 0,
              top: li * laneHeight,
              width,
              height: laneHeight,
              opacity: laneEnter,
            }}
          >
            {/* Lane background */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 10,
                background: li % 2 === 0
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid rgba(255,255,255,0.06)`,
              }}
            />
            {/* Lane label */}
            <div
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                width: labelWidth - 20,
                fontFamily: cinematicTheme.font.zh,
                fontSize: 12,
                fontWeight: 700,
                color: cinematicTheme.colors.muted,
                letterSpacing: 0.5,
              }}
            >
              {lane.label}
            </div>
            {/* Step nodes */}
            {lane.steps.map((step, si) => {
              const flatIdx = allSteps.findIndex(
                (s) => s.laneIdx === li && s.stepIdx === si,
              )
              const stepDelay = delay + 8 + stagger(flatIdx, totalSteps, 36)
              const stepEnter = softSpring(frame, fps, stepDelay)
              const drift = loopSine(frame, 200 + flatIdx * 11, flatIdx) * 1.5
              const nodeX = labelWidth + step.column * colWidth + colWidth / 2
              const nodeY = laneHeight / 2

              return (
                <div
                  key={si}
                  style={{
                    position: "absolute",
                    left: nodeX - 36,
                    top: nodeY - 18 + drift,
                    width: 72,
                    height: 36,
                    opacity: stepEnter,
                    transform: `scale(${0.8 + stepEnter * 0.2})`,
                    borderRadius: 8,
                    background: `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), ${accent}14`,
                    border: `1px solid ${accent}40`,
                    boxShadow: `0 8px 24px rgba(0,0,0,0.3), 0 0 14px ${accent}18`,
                    backdropFilter: "blur(12px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                  }}
                >
                  <span
                    style={{
                      fontFamily: cinematicTheme.font.zh,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                      textAlign: "center",
                      lineHeight: 1.2,
                      padding: "0 4px",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Scan line effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 14,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 3,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            width: "100%",
            height: 1,
            top: `${((frame * 0.8) % height)}px`,
            background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
          }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. GanttChart
   ───────────────────────────────────────────────────────────────────────────── */

export interface GanttTask {
  label: string
  start: number
  end: number
  color?: string
  progress?: number
}

export function GanttChart({
  tasks,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 640,
  height = 320,
}: {
  tasks: GanttTask[]
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

  const containerEnter = softSpring(frame, fps, delay)
  const labelColWidth = 120
  const chartWidth = width - labelColWidth
  const taskCount = tasks.length
  const rowHeight = Math.min(48, (height - 40) / Math.max(1, taskCount))

  // Compute timeline bounds
  const minStart = Math.min(...tasks.map((t) => t.start))
  const maxEnd = Math.max(...tasks.map((t) => t.end))
  const totalRange = maxEnd - minStart || 1

  // Today marker position (animated)
  const todayProgress = clampInterpolate(frame, [delay + 10, delay + 60], [0, 0.55])

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2 + x,
        marginTop: -height / 2 + y,
        transformStyle: "preserve-3d",
        transform: `translate3d(0, 0, ${z}px)`,
        opacity: containerEnter,
        borderRadius: 16,
        background: `linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01)), ${cinematicTheme.colors.glass}`,
        border: `1px solid ${accent}30`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), 0 0 28px ${accent}18`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "20px 0",
      }}
    >
      {/* Header grid lines */}
      <svg
        width={chartWidth}
        height={height - 40}
        style={{ position: "absolute", left: labelColWidth, top: 20, overflow: "visible" }}
      >
        {/* Vertical grid lines */}
        {Array.from({ length: 5 }, (_, i) => {
          const xPos = (i / 4) * chartWidth
          return (
            <line
              key={i}
              x1={xPos}
              y1={0}
              x2={xPos}
              y2={height - 40}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          )
        })}
        {/* Today marker */}
        <line
          x1={todayProgress * chartWidth}
          y1={0}
          x2={todayProgress * chartWidth}
          y2={height - 40}
          stroke={accent}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={containerEnter * 0.8}
        />
        <text
          x={todayProgress * chartWidth}
          y={-6}
          fill={accent}
          fontSize={9}
          fontFamily={cinematicTheme.font.mono}
          textAnchor="middle"
          opacity={containerEnter * 0.7}
        >
          TODAY
        </text>
      </svg>

      {/* Task rows */}
      {tasks.map((task, i) => {
        const taskDelay = delay + 8 + stagger(i, taskCount, 28)
        const taskEnter = softSpring(frame, fps, taskDelay)
        const barReveal = clampInterpolate(frame, [taskDelay + 4, taskDelay + 28], [0, 1])

        const barLeft = ((task.start - minStart) / totalRange) * chartWidth
        const barWidth = ((task.end - task.start) / totalRange) * chartWidth
        const barColor = task.color || accent
        const progress = task.progress ?? 0
        const drift = loopSine(frame, 240 + i * 17, i) * 0.8

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 20 + i * rowHeight + drift,
              width,
              height: rowHeight,
              opacity: taskEnter,
              display: "flex",
              alignItems: "center",
            }}
          >
            {/* Task label */}
            <div
              style={{
                width: labelColWidth,
                paddingLeft: 16,
                fontFamily: cinematicTheme.font.zh,
                fontSize: 11,
                fontWeight: 600,
                color: cinematicTheme.colors.muted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.label}
            </div>
            {/* Bar container */}
            <div style={{ position: "relative", flex: 1, height: rowHeight - 12, marginRight: 16 }}>
              {/* Background bar track */}
              <div
                style={{
                  position: "absolute",
                  left: barLeft,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: barWidth * barReveal,
                  height: 22,
                  borderRadius: 6,
                  background: `linear-gradient(90deg, ${barColor}20, ${barColor}35)`,
                  border: `1px solid ${barColor}40`,
                  boxShadow: `0 0 12px ${barColor}15, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  overflow: "hidden",
                }}
              >
                {/* Progress fill */}
                {progress > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${progress * 100}%`,
                      borderRadius: 5,
                      background: `linear-gradient(90deg, ${barColor}60, ${barColor}90)`,
                      boxShadow: `0 0 10px ${barColor}40`,
                    }}
                  />
                )}
                {/* Shimmer effect */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)`,
                    transform: `translateX(${((frame * 2 + i * 30) % 200) - 100}%)`,
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* Bottom border glow */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}40, transparent)`,
        }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. ProcessPipeline
   ───────────────────────────────────────────────────────────────────────────── */

export interface PipelineStage {
  label: string
  icon?: string
  status?: "complete" | "active" | "pending"
}

export function ProcessPipeline({
  stages,
  direction = "horizontal",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width,
}: {
  stages: PipelineStage[]
  direction?: "horizontal" | "vertical"
  x?: number
  y?: number
  z?: number
  delay?: number
  tone?: CinematicTone
  width?: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const accent = toneColor(tone)
  const count = stages.length

  const isHorizontal = direction === "horizontal"
  const defaultWidth = isHorizontal ? 640 : 200
  const containerWidth = width ?? defaultWidth
  const containerHeight = isHorizontal ? 160 : count * 100 + 40

  const nodeSize = 52
  const spacing = isHorizontal
    ? (containerWidth - nodeSize) / Math.max(1, count - 1)
    : (containerHeight - nodeSize - 40) / Math.max(1, count - 1)

  const containerEnter = softSpring(frame, fps, delay)

  function statusColor(status?: "complete" | "active" | "pending"): string {
    switch (status) {
      case "complete":
        return "#34D399"
      case "active":
        return accent
      case "pending":
      default:
        return cinematicTheme.colors.dim
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: containerWidth,
        height: containerHeight,
        marginLeft: -containerWidth / 2 + x,
        marginTop: -containerHeight / 2 + y,
        transformStyle: "preserve-3d",
        transform: `translate3d(0, 0, ${z}px)`,
        opacity: containerEnter,
      }}
    >
      {/* Connecting pipes with flowing gradient */}
      <svg
        width={containerWidth}
        height={containerHeight}
        style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 0 }}
      >
        <defs>
          <filter id="pipe-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {stages.slice(0, -1).map((_, i) => {
            const fromColor = statusColor(stages[i].status)
            const toColor = statusColor(stages[i + 1].status)
            return (
              <linearGradient
                key={i}
                id={`pipe-grad-${i}`}
                x1={isHorizontal ? "0%" : "50%"}
                y1={isHorizontal ? "50%" : "0%"}
                x2={isHorizontal ? "100%" : "50%"}
                y2={isHorizontal ? "50%" : "100%"}
              >
                <stop offset="0%" stopColor={fromColor} stopOpacity={0.5} />
                <stop offset="100%" stopColor={toColor} stopOpacity={0.5} />
              </linearGradient>
            )
          })}
        </defs>
        {stages.slice(0, -1).map((_, i) => {
          const pipeDelay = delay + 6 + stagger(i, count - 1, 20)
          const draw = clampInterpolate(frame, [pipeDelay, pipeDelay + 18], [0, 1])

          const fromX = isHorizontal ? nodeSize / 2 + i * spacing : containerWidth / 2
          const fromY = isHorizontal ? containerHeight / 2 - 20 : 20 + nodeSize / 2 + i * spacing
          const toX = isHorizontal ? nodeSize / 2 + (i + 1) * spacing : containerWidth / 2
          const toY = isHorizontal ? containerHeight / 2 - 20 : 20 + nodeSize / 2 + (i + 1) * spacing

          // Flowing particles along the pipe
          const particleCount = 3
          const particles = Array.from({ length: particleCount }, (_, pi) => {
            const t = ((frame * 0.03 + pi * 0.33) % 1) * draw
            return {
              x: fromX + (toX - fromX) * t,
              y: fromY + (toY - fromY) * t,
              opacity: Math.sin(t * Math.PI) * 0.8 * draw,
            }
          })

          return (
            <g key={i} opacity={draw}>
              {/* Pipe background */}
              <line
                x1={fromX}
                y1={fromY}
                x2={fromX + (toX - fromX) * draw}
                y2={fromY + (toY - fromY) * draw}
                stroke={`url(#pipe-grad-${i})`}
                strokeWidth={4}
                strokeLinecap="round"
                filter="url(#pipe-glow)"
                opacity={0.4}
              />
              {/* Pipe core */}
              <line
                x1={fromX}
                y1={fromY}
                x2={fromX + (toX - fromX) * draw}
                y2={fromY + (toY - fromY) * draw}
                stroke={`url(#pipe-grad-${i})`}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.7}
              />
              {/* Flow particles */}
              {particles.map((p, pi) => (
                <circle key={pi} cx={p.x} cy={p.y} r={3} fill={accent} opacity={p.opacity} />
              ))}
            </g>
          )
        })}
      </svg>

      {/* Stage nodes */}
      {stages.map((stage, i) => {
        const nodeDelay = delay + 4 + stagger(i, count, 24)
        const nodeEnter = softSpring(frame, fps, nodeDelay)
        const color = statusColor(stage.status)
        const isActive = stage.status === "active"
        const isComplete = stage.status === "complete"

        const nodeX = isHorizontal ? i * spacing : (containerWidth - nodeSize) / 2
        const nodeY = isHorizontal ? containerHeight / 2 - 20 - nodeSize / 2 : 20 + i * spacing - nodeSize / 2 + nodeSize / 2

        // Pulse ring for active
        const pulseScale = isActive ? 1 + loopSine(frame, 60, i) * 0.12 : 1
        const pulseOpacity = isActive ? 0.3 + loopSine(frame, 60, i) * 0.2 : 0

        return (
          <div key={i} style={{ position: "absolute", left: nodeX, top: nodeY, zIndex: 2 }}>
            {/* Outer pulse ring (active only) */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: -8,
                  top: -8,
                  width: nodeSize + 16,
                  height: nodeSize + 16,
                  borderRadius: "50%",
                  border: `2px solid ${color}`,
                  opacity: pulseOpacity * nodeEnter,
                  transform: `scale(${pulseScale})`,
                }}
              />
            )}
            {/* Node circle */}
            <div
              style={{
                width: nodeSize,
                height: nodeSize,
                borderRadius: "50%",
                opacity: nodeEnter,
                transform: `scale(${0.7 + nodeEnter * 0.3})`,
                background: `radial-gradient(circle at 35% 35%, ${color}30, ${cinematicTheme.colors.graphite} 80%)`,
                border: `2px solid ${color}60`,
                boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 ${isActive ? 22 : 10}px ${color}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
              }}
            >
              {isComplete ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 10.5L8.5 14L15 7"
                    stroke={color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : stage.icon ? (
                <span style={{ fontSize: 18 }}>{stage.icon}</span>
              ) : (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    opacity: isActive ? 1 : 0.5,
                    boxShadow: isActive ? `0 0 8px ${color}` : "none",
                  }}
                />
              )}
            </div>
            {/* Label */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: nodeSize + 8,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                fontFamily: cinematicTheme.font.zh,
                fontSize: 11,
                fontWeight: 600,
                color: stage.status === "pending" ? cinematicTheme.colors.dim : cinematicTheme.colors.muted,
                textAlign: "center",
                opacity: nodeEnter,
              }}
            >
              {stage.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. DecisionTree
   ───────────────────────────────────────────────────────────────────────────── */

export interface DecisionNode {
  id: string
  label: string
  yes?: string
  no?: string
  type?: "decision" | "outcome"
}

interface LayoutNode {
  node: DecisionNode
  x: number
  y: number
  depth: number
}

export function DecisionTree({
  nodes,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 600,
  height = 400,
}: {
  nodes: DecisionNode[]
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

  const containerEnter = softSpring(frame, fps, delay)

  // Build tree layout via BFS from root (first node or node with no parent)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const childIds = new Set(nodes.flatMap((n) => [n.yes, n.no].filter(Boolean)))
  const rootNode = nodes.find((n) => !childIds.has(n.id)) || nodes[0]

  // BFS layout
  const layoutNodes: LayoutNode[] = []
  const layoutMap = new Map<string, LayoutNode>()

  if (rootNode) {
    type QueueItem = { nodeId: string; depth: number; xMin: number; xMax: number }
    const queue: QueueItem[] = [{ nodeId: rootNode.id, depth: 0, xMin: 0, xMax: width }]

    while (queue.length > 0) {
      const item = queue.shift()!
      const node = nodeMap.get(item.nodeId)
      if (!node || layoutMap.has(item.nodeId)) continue

      const xCenter = (item.xMin + item.xMax) / 2
      const yPos = item.depth * (height / Math.max(3, getMaxDepth(rootNode.id, nodeMap, 0)))

      const layoutNode: LayoutNode = { node, x: xCenter, y: yPos, depth: item.depth }
      layoutNodes.push(layoutNode)
      layoutMap.set(item.nodeId, layoutNode)

      if (node.yes && nodeMap.has(node.yes)) {
        queue.push({ nodeId: node.yes, depth: item.depth + 1, xMin: item.xMin, xMax: xCenter })
      }
      if (node.no && nodeMap.has(node.no)) {
        queue.push({ nodeId: node.no, depth: item.depth + 1, xMin: xCenter, xMax: item.xMax })
      }
    }
  }

  const maxDepth = Math.max(...layoutNodes.map((ln) => ln.depth), 0)
  const totalNodes = layoutNodes.length

  // Edges
  type Edge = { from: LayoutNode; to: LayoutNode; label: string }
  const edges: Edge[] = []
  for (const ln of layoutNodes) {
    if (ln.node.yes) {
      const target = layoutMap.get(ln.node.yes)
      if (target) edges.push({ from: ln, to: target, label: "Yes" })
    }
    if (ln.node.no) {
      const target = layoutMap.get(ln.node.no)
      if (target) edges.push({ from: ln, to: target, label: "No" })
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height,
        marginLeft: -width / 2 + x,
        marginTop: -height / 2 + y,
        transformStyle: "preserve-3d",
        transform: `translate3d(0, 0, ${z}px)`,
        opacity: containerEnter,
      }}
    >
      {/* SVG edges */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 0 }}
      >
        <defs>
          <filter id="tree-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {edges.map((edge, i) => {
          const edgeDelay = delay + 10 + edge.from.depth * 10 + i * 3
          const draw = clampInterpolate(frame, [edgeDelay, edgeDelay + 20], [0, 1])

          const fromX = edge.from.x
          const fromY = edge.from.y + 28
          const toX = edge.to.x
          const toY = edge.to.y - 16

          const midY = (fromY + toY) / 2
          const isYes = edge.label === "Yes"
          const edgeColor = isYes ? "#34D399" : "#F87171"

          return (
            <g key={i} opacity={draw}>
              <path
                d={`M ${fromX} ${fromY} C ${fromX} ${midY} ${toX} ${midY} ${toX} ${toY}`}
                fill="none"
                stroke={edgeColor}
                strokeWidth={1.8}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - draw}
                filter="url(#tree-edge-glow)"
                opacity={0.65}
              />
              {/* Edge label */}
              <text
                x={(fromX + toX) / 2 + (isYes ? -14 : 14)}
                y={midY - 4}
                fill={edgeColor}
                fontSize={9}
                fontFamily={cinematicTheme.font.mono}
                fontWeight="bold"
                textAnchor="middle"
                opacity={draw * 0.85}
              >
                {edge.label}
              </text>
              {/* Arrow head */}
              <polygon
                points={`${toX},${toY} ${toX - 5},${toY - 8} ${toX + 5},${toY - 8}`}
                fill={edgeColor}
                opacity={draw * 0.7}
              />
              {/* Flow particle */}
              {(() => {
                const t = ((frame * 0.025 + i * 0.2) % 1) * draw
                const px = fromX + (toX - fromX) * t
                const py = fromY + (toY - fromY) * t
                return <circle cx={px} cy={py} r={2.5} fill={edgeColor} opacity={0.6 * draw} />
              })()}
            </g>
          )
        })}
      </svg>

      {/* Nodes */}
      {layoutNodes.map((ln, i) => {
        const nodeDelay = delay + 6 + stagger(i, totalNodes, 30) + ln.depth * 6
        const nodeEnter = softSpring(frame, fps, nodeDelay)
        const isDecision = ln.node.type !== "outcome"
        const drift = loopSine(frame, 180 + i * 13, i) * 2
        const nodeWidth = isDecision ? 90 : 100
        const nodeHeight = isDecision ? 52 : 38

        if (isDecision) {
          // Diamond shape via CSS rotation
          return (
            <div
              key={ln.node.id}
              style={{
                position: "absolute",
                left: ln.x - nodeWidth / 2,
                top: ln.y - nodeHeight / 2 + drift,
                width: nodeWidth,
                height: nodeHeight,
                opacity: nodeEnter,
                transform: `scale(${0.8 + nodeEnter * 0.2})`,
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Diamond background */}
              <div
                style={{
                  position: "absolute",
                  inset: 6,
                  transform: "rotate(45deg)",
                  borderRadius: 8,
                  background: `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), ${accent}18`,
                  border: `1.5px solid ${accent}50`,
                  boxShadow: `0 12px 36px rgba(0,0,0,0.4), 0 0 18px ${accent}22`,
                  backdropFilter: "blur(14px)",
                }}
              />
              {/* Label */}
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  fontFamily: cinematicTheme.font.zh,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  textAlign: "center",
                  lineHeight: 1.3,
                  padding: "0 6px",
                  maxWidth: nodeWidth - 16,
                }}
              >
                {ln.node.label}
              </span>
            </div>
          )
        }

        // Outcome node — rounded rect
        return (
          <div
            key={ln.node.id}
            style={{
              position: "absolute",
              left: ln.x - nodeWidth / 2,
              top: ln.y - nodeHeight / 2 + drift,
              width: nodeWidth,
              height: nodeHeight,
              opacity: nodeEnter,
              transform: `scale(${0.8 + nodeEnter * 0.2})`,
              borderRadius: 10,
              background: `linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)), rgba(52,211,153,0.12)`,
              border: `1px solid rgba(52,211,153,0.45)`,
              boxShadow: `0 10px 28px rgba(0,0,0,0.36), 0 0 14px rgba(52,211,153,0.18)`,
              backdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontFamily: cinematicTheme.font.zh,
                fontSize: 10,
                fontWeight: 600,
                color: "#34D399",
                textAlign: "center",
                lineHeight: 1.3,
                padding: "0 6px",
              }}
            >
              {ln.node.label}
            </span>
          </div>
        )
      })}

      {/* Ambient glow at root */}
      <div
        style={{
          position: "absolute",
          left: layoutNodes[0]?.x ? layoutNodes[0].x - 60 : width / 2 - 60,
          top: -20,
          width: 120,
          height: 60,
          background: `radial-gradient(ellipse, ${accent}18 0%, transparent 70%)`,
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

/* ─── Helper: compute max depth of tree ─── */
function getMaxDepth(
  nodeId: string,
  nodeMap: Map<string, DecisionNode>,
  current: number,
): number {
  const node = nodeMap.get(nodeId)
  if (!node) return current

  let maxD = current
  if (node.yes && nodeMap.has(node.yes)) {
    maxD = Math.max(maxD, getMaxDepth(node.yes, nodeMap, current + 1))
  }
  if (node.no && nodeMap.has(node.no)) {
    maxD = Math.max(maxD, getMaxDepth(node.no, nodeMap, current + 1))
  }
  return maxD
}
