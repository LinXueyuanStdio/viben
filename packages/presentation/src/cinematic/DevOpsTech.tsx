import { useCurrentFrame, useVideoConfig } from "remotion"
import { cinematicTheme, type CinematicTone, toneColor } from "./theme"
import { clampInterpolate, loopSine, softSpring, stagger } from "./motion"

/* ─────────────────────────────────────────────────────────────────────────────
   1. GitBranchGraph
   ───────────────────────────────────────────────────────────────────────────── */

export interface GitCommit {
  hash: string
  message: string
  isMerge?: boolean
}

export interface GitBranch {
  name: string
  color?: string
  commits: GitCommit[]
}

export interface GitMerge {
  from: string
  to: string
  atCommit: number
}

export function GitBranchGraph({
  branches,
  merges = [],
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 560,
  height = 320,
}: {
  branches: GitBranch[]
  merges?: GitMerge[]
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

  const branchCount = branches.length
  const laneHeight = (height - 80) / Math.max(1, branchCount)
  const maxCommits = Math.max(...branches.map((b) => b.commits.length), 1)
  const labelWidth = 90
  const graphWidth = width - labelWidth - 40
  const commitSpacing = graphWidth / Math.max(1, maxCommits)

  const defaultColors = [accent, cinematicTheme.colors.purple, cinematicTheme.colors.magenta, cinematicTheme.colors.amber, cinematicTheme.colors.coldWhite]

  function getBranchColor(index: number, branch: GitBranch): string {
    return branch.color ?? defaultColors[index % defaultColors.length]
  }

  function getBranchY(index: number): number {
    return 50 + index * laneHeight + laneHeight / 2
  }

  function getCommitX(commitIndex: number): number {
    return labelWidth + 20 + commitIndex * commitSpacing
  }

  // Total commit count for stagger
  const totalCommits = branches.reduce((acc, b) => acc + b.commits.length, 0)

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
        borderRadius: 18,
        background: "linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${accent}35`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.14)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
      }}
    >
      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay) % 120, [0, 120], [-4, height + 4]),
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${accent}50 30%, ${accent} 50%, ${accent}50 70%, transparent 95%)`,
          opacity: 0.4,
          filter: "blur(0.5px)",
        }}
      />

      {/* SVG Graph */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, overflow: "visible", zIndex: 1 }}
      >
        <defs>
          <filter id="git-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Branch lines */}
        {branches.map((branch, bi) => {
          const branchColor = getBranchColor(bi, branch)
          const by = getBranchY(bi)
          const lineDelay = delay + 6 + bi * 5
          const lineDraw = clampInterpolate(frame, [lineDelay, lineDelay + 30], [0, 1])
          const lineEnd = getCommitX(branch.commits.length - 1)
          const lineStart = getCommitX(0)
          const totalLen = lineEnd - lineStart

          return (
            <line
              key={`line-${bi}`}
              x1={lineStart}
              y1={by}
              x2={lineStart + totalLen * lineDraw}
              y2={by}
              stroke={branchColor}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.7}
              filter="url(#git-glow)"
            />
          )
        })}

        {/* Merge curves */}
        {merges.map((merge, mi) => {
          const fromIdx = branches.findIndex((b) => b.name === merge.from)
          const toIdx = branches.findIndex((b) => b.name === merge.to)
          if (fromIdx < 0 || toIdx < 0) return null
          const fromY = getBranchY(fromIdx)
          const toY = getBranchY(toIdx)
          const cx = getCommitX(merge.atCommit)
          const mergeDelay = delay + 20 + mi * 8
          const mergeDraw = clampInterpolate(frame, [mergeDelay, mergeDelay + 18], [0, 1])

          const midX = cx - commitSpacing * 0.5
          const path = `M ${midX} ${fromY} C ${cx - 10} ${fromY}, ${cx - 10} ${toY}, ${cx} ${toY}`

          return (
            <path
              key={`merge-${mi}`}
              d={path}
              fill="none"
              stroke={getBranchColor(fromIdx, branches[fromIdx])}
              strokeWidth={1.5}
              strokeDasharray={`${mergeDraw * 100} 200`}
              opacity={mergeDraw * 0.8}
              strokeLinecap="round"
            />
          )
        })}

        {/* Commit circles */}
        {branches.map((branch, bi) => {
          const branchColor = getBranchColor(bi, branch)
          const by = getBranchY(bi)

          return branch.commits.map((commit, ci) => {
            const globalIdx = branches.slice(0, bi).reduce((acc, b) => acc + b.commits.length, 0) + ci
            const commitDelay = delay + 10 + stagger(globalIdx, totalCommits, 30)
            const scale = softSpring(frame, fps, commitDelay)
            const cx = getCommitX(ci)
            const isHead = bi === 0 && ci === branch.commits.length - 1
            const headPulse = isHead ? 0.5 + loopSine(frame, 40) * 0.5 : 0

            return (
              <g key={`commit-${bi}-${ci}`}>
                {/* Head glow */}
                {isHead && (
                  <circle
                    cx={cx}
                    cy={by}
                    r={12 + headPulse * 4}
                    fill="none"
                    stroke={branchColor}
                    strokeWidth={1}
                    opacity={headPulse * 0.6}
                  />
                )}
                {/* Merge diamond vs normal circle */}
                {commit.isMerge ? (
                  <rect
                    x={cx - 6 * scale}
                    y={by - 6 * scale}
                    width={12 * scale}
                    height={12 * scale}
                    fill={cinematicTheme.colors.graphite2}
                    stroke={branchColor}
                    strokeWidth={1.5}
                    transform={`rotate(45, ${cx}, ${by})`}
                    opacity={scale}
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={by}
                    r={5 * scale}
                    fill={cinematicTheme.colors.graphite2}
                    stroke={branchColor}
                    strokeWidth={2}
                    opacity={scale}
                  />
                )}
                {/* Hash label */}
                <text
                  x={cx}
                  y={by + 18}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily={cinematicTheme.font.mono}
                  fill="rgba(234,236,239,0.4)"
                  opacity={scale}
                >
                  {commit.hash.slice(0, 7)}
                </text>
              </g>
            )
          })
        })}
      </svg>

      {/* Branch name labels */}
      {branches.map((branch, bi) => {
        const branchColor = getBranchColor(bi, branch)
        const by = getBranchY(bi)
        const labelEnter = softSpring(frame, fps, delay + 4 + bi * 4)

        return (
          <div
            key={`label-${bi}`}
            style={{
              position: "absolute",
              left: 12,
              top: by - 11,
              opacity: labelEnter,
              transform: `translateX(${(1 - labelEnter) * -20}px)`,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                background: `${branchColor}20`,
                border: `1px solid ${branchColor}50`,
                fontFamily: cinematicTheme.font.mono,
                fontSize: 10,
                color: branchColor,
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              {branch.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. APIEndpointCard
   ───────────────────────────────────────────────────────────────────────────── */

const METHOD_COLORS: Record<string, string> = {
  GET: "#22C55E",
  POST: "#3B82F6",
  PUT: "#F6C453",
  DELETE: "#EF4444",
  PATCH: "#7A5AF8",
}

function getStatusColor(code: number): string {
  if (code >= 200 && code < 300) return "#22C55E"
  if (code >= 400 && code < 500) return "#F6C453"
  return "#EF4444"
}

export function APIEndpointCard({
  method,
  path,
  description,
  params,
  responseCode,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 460,
}: {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  path: string
  description?: string
  params?: Array<{ name: string; type: string; required?: boolean }>
  responseCode?: number
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
  const containerEnter = softSpring(frame, fps, delay)
  const methodColor = METHOD_COLORS[method] ?? accent

  // Method badge slides in
  const badgeEnter = softSpring(frame, fps, delay + 4)
  // Path types out
  const pathProgress = clampInterpolate(frame, [delay + 8, delay + 30], [0, 1])
  const visiblePathLen = Math.floor(path.length * pathProgress)

  // Highlight path params :id segments
  function renderPath(text: string, visLen: number) {
    const visible = text.slice(0, visLen)
    const segments = visible.split(/(:[a-zA-Z_]+)/)
    return segments.map((seg, i) =>
      seg.startsWith(":") ? (
        <span key={i} style={{ color: accent, textShadow: `0 0 8px ${accent}44` }}>
          {seg}
        </span>
      ) : (
        <span key={i}>{seg}</span>
      ),
    )
  }

  const cardHeight = 80 + (description ? 30 : 0) + (params && params.length > 0 ? 30 + params.length * 28 : 0) + (responseCode ? 36 : 0)

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        marginLeft: -width / 2 + x,
        marginTop: -cardHeight / 2 + y,
        transformStyle: "preserve-3d",
        transform: `translate3d(0, 0, ${z}px)`,
        opacity: containerEnter,
        borderRadius: 16,
        background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), rgba(10,10,15,0.65)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 24px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "20px 22px",
      }}
    >
      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay) % 100, [0, 100], [-4, cardHeight + 4]),
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${accent}40 30%, ${accent}80 50%, ${accent}40 70%, transparent 95%)`,
          opacity: 0.35,
          filter: "blur(0.5px)",
        }}
      />

      {/* Method badge + path */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            background: `${methodColor}20`,
            border: `1px solid ${methodColor}60`,
            fontFamily: cinematicTheme.font.mono,
            fontSize: 12,
            fontWeight: 800,
            color: methodColor,
            letterSpacing: 1,
            opacity: badgeEnter,
            transform: `translateX(${(1 - badgeEnter) * -20}px)`,
          }}
        >
          {method}
        </div>
        <div
          style={{
            fontFamily: cinematicTheme.font.mono,
            fontSize: 15,
            color: cinematicTheme.colors.coldWhite,
            letterSpacing: 0.3,
          }}
        >
          {renderPath(path, visiblePathLen)}
          <span style={{ opacity: pathProgress < 1 ? 0.6 + loopSine(frame, 20) * 0.4 : 0, color: accent }}>|</span>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div
          style={{
            marginTop: 10,
            fontFamily: cinematicTheme.font.en,
            fontSize: 13,
            color: cinematicTheme.colors.muted,
            opacity: clampInterpolate(frame, [delay + 14, delay + 24], [0, 1]),
          }}
        >
          {description}
        </div>
      )}

      {/* Parameters table */}
      {params && params.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 0.6fr",
              padding: "6px 0",
              fontFamily: cinematicTheme.font.mono,
              fontSize: 10,
              letterSpacing: 1.2,
              color: "rgba(234,236,239,0.4)",
              borderBottom: "1px solid rgba(234,236,239,0.08)",
            }}
          >
            <div>PARAM</div>
            <div>TYPE</div>
            <div>REQ</div>
          </div>
          {params.map((param, pi) => {
            const paramEnter = softSpring(frame, fps, delay + 18 + pi * 4)
            return (
              <div
                key={param.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 0.6fr",
                  padding: "7px 0",
                  alignItems: "center",
                  opacity: paramEnter,
                  transform: `translateX(${(1 - paramEnter) * -12}px)`,
                  borderBottom: pi === params.length - 1 ? "none" : "1px solid rgba(234,236,239,0.05)",
                }}
              >
                <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 12, color: cinematicTheme.colors.coldWhite }}>
                  {param.name}
                </div>
                <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 11, color: cinematicTheme.colors.dim }}>
                  {param.type}
                </div>
                <div>
                  {param.required && (
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: `${accent}18`,
                        border: `1px solid ${accent}40`,
                        fontSize: 9,
                        color: accent,
                        fontWeight: 700,
                      }}
                    >
                      REQ
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Response code badge */}
      {responseCode && (
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: cinematicTheme.font.mono, fontSize: 10, color: "rgba(234,236,239,0.4)", letterSpacing: 1 }}>
            RESPONSE
          </span>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 5,
              background: `${getStatusColor(responseCode)}18`,
              border: `1px solid ${getStatusColor(responseCode)}50`,
              fontFamily: cinematicTheme.font.mono,
              fontSize: 11,
              fontWeight: 700,
              color: getStatusColor(responseCode),
            }}
          >
            {responseCode}
          </span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. DeployPipeline
   ───────────────────────────────────────────────────────────────────────────── */

export interface PipelineStage {
  name: string
  status: "success" | "running" | "failed" | "pending" | "skipped"
  duration?: string
  jobs?: string[]
}

const STAGE_STATUS_COLORS: Record<string, string> = {
  success: "#22C55E",
  running: "#3B82F6",
  failed: "#EF4444",
  pending: "rgba(234,236,239,0.35)",
  skipped: "rgba(234,236,239,0.2)",
}

export function DeployPipeline({
  stages,
  branch,
  commit,
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 600,
}: {
  stages: PipelineStage[]
  branch?: string
  commit?: string
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
  const containerEnter = softSpring(frame, fps, delay)

  const stageCount = stages.length
  const stageWidth = (width - 60) / Math.max(1, stageCount)
  const cardHeight = 200

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width,
        height: cardHeight,
        marginLeft: -width / 2 + x,
        marginTop: -cardHeight / 2 + y,
        transformStyle: "preserve-3d",
        transform: `translate3d(0, 0, ${z}px)`,
        opacity: containerEnter,
        borderRadius: 18,
        background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "18px 24px",
      }}
    >
      {/* Branch/commit info */}
      {(branch || commit) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          {branch && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: cinematicTheme.font.mono,
                fontSize: 11,
                color: accent,
              }}
            >
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                <path d="M5 3v4a2 2 0 002 2h2a2 2 0 002-2V3M5 3a2 2 0 11-4 0 2 2 0 014 0zM11 3a2 2 0 104 0 2 2 0 00-4 0zM8 9v4M8 13a2 2 0 104 0 2 2 0 00-4 0z" stroke={accent} strokeWidth={1.2} strokeLinecap="round" />
              </svg>
              {branch}
            </div>
          )}
          {commit && (
            <div
              style={{
                fontFamily: cinematicTheme.font.mono,
                fontSize: 10,
                color: "rgba(234,236,239,0.4)",
                letterSpacing: 0.5,
              }}
            >
              {commit.slice(0, 7)}
            </div>
          )}
        </div>
      )}

      {/* Pipeline stages */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
        {stages.map((stage, si) => {
          const stageDelay = delay + 8 + si * 6
          const stageEnter = softSpring(frame, fps, stageDelay)
          const statusColor = STAGE_STATUS_COLORS[stage.status]
          const isRunning = stage.status === "running"
          const isFailed = stage.status === "failed"
          const runPulse = isRunning ? 0.5 + loopSine(frame, 30) * 0.5 : 0
          const failGlow = isFailed ? 0.4 + loopSine(frame, 25) * 0.3 : 0

          return (
            <div key={stage.name} style={{ display: "flex", alignItems: "center" }}>
              {/* Stage card */}
              <div
                style={{
                  width: stageWidth - 20,
                  opacity: stageEnter,
                  transform: `translateY(${(1 - stageEnter) * 16}px)`,
                  borderRadius: 12,
                  background: isFailed
                    ? `linear-gradient(145deg, rgba(239,68,68,0.08), rgba(10,10,15,0.55))`
                    : "rgba(12,12,18,0.5)",
                  border: `1px solid ${statusColor}${isFailed ? "60" : "30"}`,
                  boxShadow: isFailed
                    ? `0 0 ${20 + failGlow * 12}px rgba(239,68,68,0.25)`
                    : isRunning
                      ? `0 0 ${12 + runPulse * 8}px ${statusColor}30`
                      : "0 8px 24px rgba(0,0,0,0.2)",
                  padding: "12px 10px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Running pulse ring */}
                {isRunning && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -2,
                      borderRadius: 14,
                      border: `2px solid ${statusColor}`,
                      opacity: runPulse * 0.4,
                      transform: `scale(${1 + runPulse * 0.03})`,
                    }}
                  />
                )}

                {/* Status icon */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ position: "relative" }}>
                    {stage.status === "success" && (
                      <svg width={14} height={14} viewBox="0 0 16 16">
                        <circle cx={8} cy={8} r={7} fill={`${statusColor}20`} stroke={statusColor} strokeWidth={1.5} />
                        <path d="M5 8l2 2 4-4" stroke={statusColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                    {stage.status === "running" && (
                      <svg width={14} height={14} viewBox="0 0 16 16" style={{ transform: `rotate(${frame * 6}deg)` }}>
                        <circle cx={8} cy={8} r={6} fill="none" stroke="rgba(234,236,239,0.15)" strokeWidth={2} />
                        <path d="M8 2a6 6 0 014.24 10.24" fill="none" stroke={statusColor} strokeWidth={2} strokeLinecap="round" />
                      </svg>
                    )}
                    {stage.status === "failed" && (
                      <svg width={14} height={14} viewBox="0 0 16 16">
                        <circle cx={8} cy={8} r={7} fill={`${statusColor}20`} stroke={statusColor} strokeWidth={1.5} />
                        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={statusColor} strokeWidth={1.5} strokeLinecap="round" />
                      </svg>
                    )}
                    {stage.status === "pending" && (
                      <svg width={14} height={14} viewBox="0 0 16 16">
                        <circle cx={8} cy={8} r={5} fill={statusColor} opacity={0.6} />
                      </svg>
                    )}
                    {stage.status === "skipped" && (
                      <svg width={14} height={14} viewBox="0 0 16 16">
                        <circle cx={8} cy={8} r={6} fill="none" stroke={statusColor} strokeWidth={1.5} strokeDasharray="3 2" />
                        <path d="M5 8h6" stroke={statusColor} strokeWidth={1.5} strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    style={{
                      fontFamily: cinematicTheme.font.mono,
                      fontSize: 11,
                      fontWeight: 700,
                      color: cinematicTheme.colors.coldWhite,
                      textDecoration: stage.status === "skipped" ? "line-through" : "none",
                      textDecorationColor: "rgba(234,236,239,0.3)",
                    }}
                  >
                    {stage.name}
                  </span>
                </div>

                {/* Duration */}
                {stage.duration && (
                  <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, color: "rgba(234,236,239,0.4)", marginBottom: 4 }}>
                    {stage.duration}
                  </div>
                )}

                {/* Jobs */}
                {stage.jobs && stage.jobs.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {stage.jobs.map((job, ji) => (
                      <div
                        key={ji}
                        style={{
                          fontFamily: cinematicTheme.font.mono,
                          fontSize: 9,
                          color: "rgba(234,236,239,0.32)",
                          paddingLeft: 8,
                          borderLeft: `1px solid ${statusColor}30`,
                        }}
                      >
                        {job}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Arrow connector */}
              {si < stageCount - 1 && (
                <svg width={20} height={20} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
                  {(() => {
                    const nextStatus = stages[si + 1].status
                    const isComplete = stage.status === "success"
                    const arrowColor = isComplete ? statusColor : "rgba(234,236,239,0.2)"
                    const dashAnim = !isComplete ? `${(frame * 0.5) % 12}` : undefined

                    return (
                      <>
                        <line
                          x1={2}
                          y1={10}
                          x2={14}
                          y2={10}
                          stroke={arrowColor}
                          strokeWidth={1.5}
                          strokeDasharray={isComplete ? undefined : "4 3"}
                          strokeDashoffset={dashAnim}
                          opacity={0.7}
                        />
                        <path
                          d="M12 7l4 3-4 3"
                          fill="none"
                          stroke={arrowColor}
                          strokeWidth={1.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.7}
                        />
                      </>
                    )
                  })()}
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. SystemMetricsPanel
   ───────────────────────────────────────────────────────────────────────────── */

export function SystemMetricsPanel({
  metrics,
  systemName = "System",
  status = "healthy",
  x = 0,
  y = 0,
  z = 0,
  delay = 0,
  tone = "gold",
  width = 520,
  height = 340,
}: {
  metrics: Array<{
    label: string
    value: number
    max: number
    unit: string
    threshold?: number
    history?: number[]
  }>
  systemName?: string
  status?: "healthy" | "warning" | "critical"
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

  const statusColors: Record<string, string> = {
    healthy: "#22C55E",
    warning: "#F6C453",
    critical: "#EF4444",
  }
  const statusColor = statusColors[status]
  const statusPulse = 0.5 + loopSine(frame, status === "critical" ? 20 : 40) * 0.5
  const isCritical = status === "critical"

  const colCount = 2
  const metricCardWidth = (width - 80) / colCount
  const metricCardHeight = 120

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
        borderRadius: 18,
        background: "linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02)), rgba(10,10,15,0.62)",
        border: `1px solid ${isCritical ? `${statusColor}50` : `${accent}30`}`,
        boxShadow: isCritical
          ? `0 28px 80px rgba(0,0,0,0.45), 0 0 ${24 + statusPulse * 12}px rgba(239,68,68,0.2), inset 0 1px 0 rgba(255,255,255,0.1)`
          : `0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)`,
        backdropFilter: "blur(18px)",
        overflow: "hidden",
        padding: "20px 24px",
      }}
    >
      {/* Critical vignette border glow */}
      {isCritical && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 18,
            boxShadow: `inset 0 0 ${30 + statusPulse * 15}px rgba(239,68,68,${0.1 + statusPulse * 0.08})`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: clampInterpolate((frame - delay) % 110, [0, 110], [-4, height + 4]),
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, ${accent}50 30%, ${accent} 50%, ${accent}50 70%, transparent 95%)`,
          opacity: 0.35,
          filter: "blur(0.5px)",
        }}
      />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 14, fontWeight: 700, color: cinematicTheme.colors.coldWhite, letterSpacing: 0.5 }}>
          {systemName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 ${8 + statusPulse * 6}px ${statusColor}`,
              opacity: 0.6 + statusPulse * 0.4,
            }}
          />
          <span
            style={{
              fontFamily: cinematicTheme.font.mono,
              fontSize: 10,
              letterSpacing: 1,
              color: statusColor,
              textTransform: "uppercase",
            }}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${colCount}, 1fr)`,
          gap: 14,
        }}
      >
        {metrics.map((metric, mi) => {
          const metricDelay = delay + 10 + mi * 5
          const metricEnter = softSpring(frame, fps, metricDelay)
          // Oscillate value for live feel
          const oscillation = loopSine(frame, 60 + mi * 7, mi * 2.3) * 0.02
          const liveValue = metric.value * (1 + oscillation)
          const ratio = Math.min(1, liveValue / Math.max(1, metric.max))
          const isOverThreshold = metric.threshold != null && liveValue >= metric.threshold
          const thresholdRatio = metric.threshold != null ? metric.threshold / Math.max(1, metric.max) : 1

          // Gauge arc params
          const gaugeR = 28
          const gaugeCircumference = 2 * Math.PI * gaugeR
          const arcLen = gaugeCircumference * 0.75
          const filledLen = arcLen * ratio * metricEnter
          const thresholdAngle = 135 + thresholdRatio * 270

          // Sparkline
          const history = metric.history ?? []
          const sparkW = metricCardWidth - 30
          const sparkH = 28

          return (
            <div
              key={metric.label}
              style={{
                opacity: metricEnter,
                transform: `translateY(${(1 - metricEnter) * 14}px)`,
                borderRadius: 12,
                background: "rgba(12,12,18,0.45)",
                border: `1px solid ${isOverThreshold ? "rgba(239,68,68,0.4)" : "rgba(234,236,239,0.08)"}`,
                boxShadow: isOverThreshold
                  ? `0 0 16px rgba(239,68,68,0.15)`
                  : "0 4px 16px rgba(0,0,0,0.15)",
                padding: "12px 14px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Label */}
              <div style={{ fontFamily: cinematicTheme.font.mono, fontSize: 9, letterSpacing: 1.4, color: "rgba(234,236,239,0.42)", marginBottom: 8 }}>
                {metric.label}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Circular gauge */}
                <svg width={66} height={66} viewBox="0 0 66 66" style={{ flexShrink: 0 }}>
                  {/* Background arc */}
                  <circle
                    cx={33}
                    cy={33}
                    r={gaugeR}
                    fill="none"
                    stroke="rgba(234,236,239,0.08)"
                    strokeWidth={4}
                    strokeDasharray={`${arcLen} ${gaugeCircumference}`}
                    strokeDashoffset={-gaugeCircumference * 0.375}
                    strokeLinecap="round"
                    transform="rotate(0, 33, 33)"
                  />
                  {/* Filled arc */}
                  <circle
                    cx={33}
                    cy={33}
                    r={gaugeR}
                    fill="none"
                    stroke={isOverThreshold ? "#EF4444" : accent}
                    strokeWidth={4}
                    strokeDasharray={`${filledLen} ${gaugeCircumference}`}
                    strokeDashoffset={-gaugeCircumference * 0.375}
                    strokeLinecap="round"
                    style={{ filter: isOverThreshold ? "drop-shadow(0 0 6px rgba(239,68,68,0.5))" : `drop-shadow(0 0 4px ${accent}44)` }}
                  />
                  {/* Threshold marker */}
                  {metric.threshold != null && (
                    <line
                      x1={33 + Math.cos((thresholdAngle * Math.PI) / 180) * (gaugeR - 6)}
                      y1={33 + Math.sin((thresholdAngle * Math.PI) / 180) * (gaugeR - 6)}
                      x2={33 + Math.cos((thresholdAngle * Math.PI) / 180) * (gaugeR + 6)}
                      y2={33 + Math.sin((thresholdAngle * Math.PI) / 180) * (gaugeR + 6)}
                      stroke="#EF4444"
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.7}
                    />
                  )}
                  {/* Center value */}
                  <text
                    x={33}
                    y={35}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={800}
                    fontFamily={cinematicTheme.font.mono}
                    fill={isOverThreshold ? "#EF4444" : "#fff"}
                  >
                    {Math.round(liveValue)}
                  </text>
                  <text
                    x={33}
                    y={46}
                    textAnchor="middle"
                    fontSize={8}
                    fontFamily={cinematicTheme.font.mono}
                    fill="rgba(234,236,239,0.4)"
                  >
                    {metric.unit}
                  </text>
                </svg>

                {/* Sparkline */}
                {history.length > 1 && (
                  <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} style={{ overflow: "visible" }}>
                    {(() => {
                      const maxH = Math.max(...history, 1)
                      const step = sparkW / (history.length - 1)
                      const points = history.map((v, i) => `${i * step},${sparkH - (v / maxH) * sparkH}`)
                      const sparkDraw = clampInterpolate(frame, [metricDelay + 6, metricDelay + 28], [0, 1])

                      return (
                        <>
                          {/* Area fill */}
                          <polygon
                            points={`0,${sparkH} ${points.join(" ")} ${sparkW},${sparkH}`}
                            fill={`${accent}10`}
                            opacity={sparkDraw}
                          />
                          {/* Line */}
                          <polyline
                            points={points.join(" ")}
                            fill="none"
                            stroke={accent}
                            strokeWidth={1.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={`${sparkDraw * sparkW * 2} ${sparkW * 2}`}
                            opacity={0.7}
                          />
                          {/* Threshold line */}
                          {metric.threshold != null && (
                            <line
                              x1={0}
                              y1={sparkH - (metric.threshold / maxH) * sparkH}
                              x2={sparkW}
                              y2={sparkH - (metric.threshold / maxH) * sparkH}
                              stroke="#EF4444"
                              strokeWidth={0.8}
                              strokeDasharray="3 2"
                              opacity={0.5}
                            />
                          )}
                        </>
                      )
                    })()}
                  </svg>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
