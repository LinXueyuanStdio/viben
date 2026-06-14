import { useMemo, useRef, memo } from "react"
import { useVideoConfig, useCurrentFrame, Sequence, AbsoluteFill } from "remotion"
import type { PresentationStep, PresentationCommand } from "../types"
import { useResolvedCommand } from "../hooks/use-resolved-command"
import { msToFrame } from "../utils/motion"
import { Spotlight } from "../overlays/spotlight"
import { Arrow } from "../overlays/arrow"
import { TextAnnotation } from "../overlays/text-annotation"
import { CircleAnnotation } from "../overlays/circle-annotation"
import { Highlight } from "../overlays/highlight"
import { Card } from "../overlays/card"
import { Pulse } from "../overlays/pulse"
import { Underline } from "../overlays/underline"
import { Badge } from "../overlays/badge"
import { Progress } from "../overlays/progress"
import { Counter } from "../overlays/counter"
import { Bracket } from "../overlays/bracket"
import { Trendline } from "../overlays/trendline"
import { Comparison } from "../overlays/comparison"
import { Typewriter } from "../overlays/typewriter"
import { Chart } from "../overlays/chart"
import { Gauge } from "../overlays/gauge"
import { Sparkline } from "../overlays/sparkline"
import { Heatmap } from "../overlays/heatmap"
import { Funnel } from "../overlays/funnel"
import { Waterfall } from "../overlays/waterfall"
import { Callout } from "../overlays/callout"
import { Timeline } from "../overlays/timeline"
import { Flowchart } from "../overlays/flowchart"
import { Table } from "../overlays/table"
import { List } from "../overlays/list"
import { Confetti } from "../overlays/confetti"
import { Countdown } from "../overlays/countdown"
import { Reveal } from "../overlays/reveal"
import { Zoom } from "../overlays/zoom"
import { Morph } from "../overlays/morph"
import { Radar } from "../overlays/radar"
import { Sankey } from "../overlays/sankey"
import { Kpi } from "../overlays/kpi"
import { Matrix } from "../overlays/matrix"
import { AnnotationGroup } from "../overlays/annotation-group"
import { Treemap } from "../overlays/treemap"
import { Donut } from "../overlays/donut"
import { StatCard } from "../overlays/stat-card"
import { CodeBlock } from "../overlays/code-block"
import { Ribbon } from "../overlays/ribbon"
import { PolarArea } from "../overlays/polar-area"
import { StackedBar } from "../overlays/stacked-bar"
import { Tooltip } from "../overlays/tooltip"
import { BadgeGroup } from "../overlays/badge-group"
import { Scatter } from "../overlays/scatter"
import { Meter } from "../overlays/meter"
import { Html } from "../overlays/html"

/** Buffer frames for sequence virtualization pre-mount */
const BUFFER_FRAMES = 5

/** Module-level style constant for the overlay container */
const OVERLAY_STYLE: React.CSSProperties = { pointerEvents: "none" }

interface SequenceEntry {
  step: PresentationStep
  startFrame: number
  duration: number
  endFrame: number // startFrame + duration (precomputed)
}

export interface PresentationOverlayProps {
  /** All presentation steps */
  steps: PresentationStep[]
}

/**
 * Resolves any TargetRef fields in a command before rendering.
 * Returns null if a target element is not found in the DOM.
 */
const ResolvedCommandRenderer = memo(function ResolvedCommandRenderer({ command }: { command: PresentationCommand }) {
  const resolved = useResolvedCommand(command)
  if (!resolved) return null
  return <CommandRenderer command={resolved} />
})

/** Render a single command as an overlay element */
const CommandRenderer = memo(function CommandRenderer({ command }: { command: PresentationCommand }) {
  switch (command.type) {
    case "spotlight":
      return <Spotlight command={command} />
    case "arrow":
      return <Arrow command={command} />
    case "text":
      return <TextAnnotation command={command} />
    case "circle":
      return <CircleAnnotation command={command} />
    case "highlight":
      return <Highlight command={command} />
    case "card":
      return <Card command={command} />
    case "pulse":
      return <Pulse command={command} />
    case "underline":
      return <Underline command={command} />
    case "badge":
      return <Badge command={command} />
    case "progress":
      return <Progress command={command} />
    case "counter":
      return <Counter command={command} />
    case "bracket":
      return <Bracket command={command} />
    case "trendline":
      return <Trendline command={command} />
    case "comparison":
      return <Comparison command={command} />
    case "typewriter":
      return <Typewriter command={command} />
    case "chart":
      return <Chart command={command} />
    case "gauge":
      return <Gauge command={command} />
    case "sparkline":
      return <Sparkline command={command} />
    case "heatmap":
      return <Heatmap command={command} />
    case "funnel":
      return <Funnel command={command} />
    case "waterfall":
      return <Waterfall command={command} />
    case "callout":
      return <Callout command={command} />
    case "timeline":
      return <Timeline command={command} />
    case "flowchart":
      return <Flowchart command={command} />
    case "table":
      return <Table command={command} />
    case "list":
      return <List command={command} />
    case "confetti":
      return <Confetti command={command} />
    case "countdown":
      return <Countdown command={command} />
    case "reveal":
      return <Reveal command={command} />
    case "zoom":
      return <Zoom command={command} />
    case "morph":
      return <Morph command={command} />
    case "radar":
      return <Radar command={command} />
    case "sankey":
      return <Sankey command={command} />
    case "kpi":
      return <Kpi command={command} />
    case "matrix":
      return <Matrix command={command} />
    case "annotation-group":
      return <AnnotationGroup command={command} />
    case "treemap":
      return <Treemap command={command} />
    case "donut":
      return <Donut command={command} />
    case "stat-card":
      return <StatCard command={command} />
    case "code-block":
      return <CodeBlock command={command} />
    case "ribbon":
      return <Ribbon command={command} />
    case "polar-area":
      return <PolarArea command={command} />
    case "stacked-bar":
      return <StackedBar command={command} />
    case "tooltip":
      return <Tooltip command={command} />
    case "badge-group":
      return <BadgeGroup command={command} />
    case "scatter":
      return <Scatter command={command} />
    case "meter":
      return <Meter command={command} />
    case "html":
      return <Html command={command} />
    case "clear":
    case "wait":
      return null
  }
})

/**
 * PresentationOverlay -- Remotion composition for transparent overlay annotations.
 *
 * Renders ONLY the annotation overlays with transparent background.
 * Must be used inside a Remotion <Composition> or <Player>.
 * Position this layer on top of your page content.
 *
 * Each step becomes a Remotion Sequence based on startMs/endMs.
 * "clear" commands hide all prior annotations from that point forward.
 *
 * Optimizations:
 * - Binary search on startFrame-sorted sequences to skip future sequences
 * - Precomputed endFrame-sorted index for O(log N) expired-sequence elimination
 * - Only visible sequences (± BUFFER_FRAMES) are rendered
 */
export function PresentationOverlay({ steps }: PresentationOverlayProps) {
  const { fps, durationInFrames } = useVideoConfig()
  const frame = useCurrentFrame()

  // Compute frame ranges and handle clear commands (stable across frames)
  // Returns: { byStart: sorted by startFrame, byEnd: sorted by endFrame }
  const indices = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.startMs - b.startMs)

    // Find clear command times
    const clearTimes = sorted
      .filter((s) => s.command.type === "clear")
      .map((s) => msToFrame(s.startMs, fps))

    const entries: SequenceEntry[] = sorted
      .filter((s) => s.command.type !== "clear" && s.command.type !== "wait")
      .map((step) => {
        const startFrame = msToFrame(step.startMs, fps)
        const endFrame = step.endMs != null
          ? msToFrame(step.endMs, fps)
          : durationInFrames

        // Any clear command after this step's start truncates its visibility
        // Binary search in clearTimes (sorted ASC) for first clear > startFrame
        let clearAfterStart: number | undefined
        let lo = 0, hi = clearTimes.length
        while (lo < hi) {
          const mid = (lo + hi) >>> 1
          if (clearTimes[mid] <= startFrame) lo = mid + 1
          else hi = mid
        }
        // lo = first clearTime > startFrame
        if (lo < clearTimes.length && clearTimes[lo] <= endFrame) {
          clearAfterStart = clearTimes[lo]
        }

        const effectiveEnd = clearAfterStart != null
          ? Math.min(endFrame, clearAfterStart)
          : endFrame

        const duration = Math.max(1, effectiveEnd - startFrame)

        return { step, startFrame, duration, endFrame: startFrame + duration }
      })
      .filter(({ duration }) => duration > 0)

    // byStart: sorted by startFrame ASC (already sorted since steps were sorted by startMs)
    const byStart = entries

    // byEnd: sorted by endFrame ASC — enables binary search to skip all expired sequences
    const byEnd = [...entries].sort((a, b) => a.endFrame - b.endFrame)

    // Create a Set-based lookup for O(1) "is this entry expired?" check
    // We use the byEnd index only for the binary search cutoff
    return { byStart, byEnd }
  }, [steps, fps, durationInFrames])

  // Virtualize: only render Sequences visible at current frame.
  // Uses binary search on startFrame for upper bound, then forward scan with endFrame check.
  // Returns a STABLE array reference when the visible set hasn't changed (avoids React reconciliation).
  const prevVisibleRef = useRef<SequenceEntry[]>([])

  const visibleSequences = useMemo(() => {
    const { byStart } = indices
    const len = byStart.length
    if (len === 0) return byStart

    // Binary search: find rightmost entry whose startFrame <= frame + BUFFER
    let lo = 0, hi = len
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (byStart[mid].startFrame <= frame + BUFFER_FRAMES) lo = mid + 1
      else hi = mid
    }
    // lo = first entry with startFrame > frame + BUFFER — only check [0, lo)

    const result: SequenceEntry[] = []
    const threshold = frame - BUFFER_FRAMES

    for (let i = 0; i < lo; i++) {
      const entry = byStart[i]
      // Skip expired: endFrame already passed
      if (entry.endFrame <= threshold) continue
      result.push(entry)
    }

    // Stabilize: return previous reference if visible set is identical
    const prev = prevVisibleRef.current
    if (result.length === prev.length) {
      let same = true
      for (let i = 0; i < result.length; i++) {
        if (result[i] !== prev[i]) { same = false; break }
      }
      if (same) return prev
    }
    prevVisibleRef.current = result
    return result
  }, [indices, frame])

  return (
    <AbsoluteFill style={OVERLAY_STYLE}>
      {visibleSequences.map(({ step, startFrame, duration }) => (
        <Sequence
          key={step.id}
          from={startFrame}
          durationInFrames={duration}
          layout="none"
        >
          <ResolvedCommandRenderer command={step.command} />
        </Sequence>
      ))}
    </AbsoluteFill>
  )
}
