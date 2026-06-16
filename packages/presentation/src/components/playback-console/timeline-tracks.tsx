import React, { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react"
import type { PresentationStep } from "../../types"
import { formatTime, commandColor } from "../../utils/timeline"
import type { TimelineItem, TimelineLane } from "../../utils/timeline"
import { msToFrame } from "../../utils/motion"
import { DEFAULT_FPS } from "./styles"
import type { JsonInspectorRenderProps, BashEditorRenderProps } from "./types"

// ---------------------------------------------------------------------------
// Track grouping helpers
// ---------------------------------------------------------------------------
export const TRACK_GROUPS: Record<string, string[]> = {
  "Text": ["text", "title", "subtitle", "caption", "label", "annotation", "callout", "list"],
  "Shape": ["rect", "circle", "arrow", "line", "polygon", "highlight", "underline"],
  "Data": ["gauge", "sparkline", "heatmap", "funnel", "waterfall", "table", "chart"],
  "Narrative": ["timeline", "flowchart", "countdown", "morph", "reveal"],
  "Effect": ["confetti", "spotlight", "zoom", "clear"],
}

export function getTrackGroup(type: string): string {
  for (const [group, types] of Object.entries(TRACK_GROUPS)) {
    if (types.includes(type)) return group
  }
  return "Other"
}

export function computeDensityBuckets(lanes: TimelineLane[], totalDurationMs: number, bucketCount: number): number[] {
  const buckets = new Array(bucketCount).fill(0)
  if (totalDurationMs <= 0 || bucketCount <= 0) return buckets
  const bucketMs = totalDurationMs / bucketCount
  for (const lane of lanes) {
    for (const item of lane.items) {
      const startBucket = Math.max(0, Math.floor(item.startMs / bucketMs))
      const endBucket = Math.min(bucketCount - 1, Math.floor(item.endMs / bucketMs))
      for (let b = startBucket; b <= endBucket; b++) buckets[b]++
    }
  }
  return buckets
}

// ---------------------------------------------------------------------------
// TimelineTracks  (enhanced: zoom, minimap, density, playhead drag, grouping)
// ---------------------------------------------------------------------------
export function TimelineTracks({
  lanes,
  currentMs,
  totalDurationMs,
  onSeek,
  steps,
  onStepsChange,
  fps = DEFAULT_FPS,
  renderJsonInspector,
  renderBashEditor,
  stepsToScript,
  onEditorRun,
}: {
  lanes: TimelineLane[]
  currentMs: number
  totalDurationMs: number
  onSeek: (ms: number) => void
  steps: PresentationStep[]
  onStepsChange: (steps: PresentationStep[], totalMs: number) => void
  fps?: number
  renderJsonInspector?: (props: JsonInspectorRenderProps) => ReactNode
  renderBashEditor?: (props: BashEditorRenderProps) => ReactNode
  stepsToScript?: (steps: PresentationStep[]) => string
  onEditorRun?: (text: string) => Promise<{ steps: PresentationStep[]; totalMs: number; errors: Map<number, string> } | null>
}) {
  const LABEL_WIDTH = 100
  const DENSITY_BUCKETS = 120
  const MIN_ZOOM = 1
  const MAX_ZOOM = 10
  // --- zoom state ---
  const [zoom, setZoom] = useState(1)
  const [viewCenterMs, setViewCenterMs] = useState(totalDurationMs / 2)
  const visibleDurationMs = totalDurationMs / zoom
  const viewStartMs = Math.max(0, Math.min(totalDurationMs - visibleDurationMs, viewCenterMs - visibleDurationMs / 2))
  const viewEndMs = Math.min(totalDurationMs, viewStartMs + visibleDurationMs)

  const FRAME_MS = 1000 / fps

  // --- editor mode state ---
  const [timelineMode, setTimelineMode] = useState<"timeline" | "editor">("timeline")
  const [editorText, setEditorText] = useState("")
  const [editorError, setEditorError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [errorLines, setErrorLines] = useState<Map<number, string>>(new Map())

  // Memoize line↔step mapping (simplified: line N → step N)
  const lineMapping = useMemo(() => {
    if (timelineMode !== "editor" || !editorText) return null
    const lines = editorText.split("\n")
    const lineToStep = new Map<number, number>()
    const stepToLine = new Map<number, number>()
    let stepIdx = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === "" || line.startsWith("#")) continue
      lineToStep.set(i + 1, stepIdx)
      stepToLine.set(stepIdx, i + 1)
      stepIdx++
    }
    return { lineToStep, stepToLine }
  }, [timelineMode, editorText])

  // Compute active lines per frame (cheap: just iterates steps, no string parsing)
  const activeLines = useMemo(() => {
    if (!lineMapping || lineMapping.stepToLine.size !== steps.length) return []
    const result: number[] = []
    for (let i = 0; i < steps.length; i++) {
      const { startMs, endMs } = steps[i]
      if (currentMs >= startMs && (endMs === undefined || currentMs < endMs)) {
        const line = lineMapping.stepToLine.get(i)
        if (line !== undefined) result.push(line)
      }
    }
    return result
  }, [lineMapping, steps, currentMs])

  const switchToEditor = useCallback(() => {
    setEditorText(stepsToScript ? stepsToScript(steps) : JSON.stringify(steps, null, 2))
    setEditorError(null)
    setErrorLines(new Map())
    setTimelineMode("editor")
  }, [steps, stepsToScript])

  // Clear per-line errors when editor text changes
  useEffect(() => {
    if (errorLines.size > 0) setErrorLines(new Map())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorText])

  const handleLineClick = useCallback((lineNumber: number) => {
    if (!lineMapping) return
    const stepIdx = lineMapping.lineToStep.get(lineNumber)
    if (stepIdx === undefined || stepIdx >= steps.length) return
    const step = steps[stepIdx]
    onSeek(step.startMs)
  }, [lineMapping, steps, onSeek])

  const handleEditorRun = useCallback(async () => {
    if (!onEditorRun) return
    setIsRunning(true)
    setEditorError(null)
    setErrorLines(new Map())
    try {
      const result = await onEditorRun(editorText)
      if (result) {
        setErrorLines(result.errors)
        if (result.steps.length > 0) {
          onStepsChange(result.steps, result.totalMs)
        } else if (result.errors.size === 0) {
          setEditorError("No steps produced. Check your script.")
        }
      }
    } catch (err: unknown) {
      setEditorError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRunning(false)
    }
  }, [editorText, onStepsChange, onEditorRun])


  // --- drag / hover state ---
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<TimelineItem | null>(null)
  const [pinnedItem, setPinnedItem] = useState<TimelineItem | null>(null)
  const [hoverTimeMs, setHoverTimeMs] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const trackAreaRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const minimapDragRef = useRef<{ dragging: boolean; startX: number; startCenterMs: number }>({ dragging: false, startX: 0, startCenterMs: 0 })
  const lastManualPanRef = useRef<number>(0)

  // --- scrub preview state ---
  const [scrubPreviewMs, setScrubPreviewMs] = useState<number | null>(null)
  const [scrubSnapped, setScrubSnapped] = useState(false)
  const [scrubTooltipX, setScrubTooltipX] = useState<number | null>(null)

  // --- momentum state ---
  const momentumRef = useRef<{ velocity: number; lastTime: number; rafId: number | null }>({ velocity: 0, lastTime: 0, rafId: null })
  const scrubHistoryRef = useRef<Array<{ ms: number; time: number }>>([])

  // --- keyboard focus / selection ---
  const [focusedBlockIndex, setFocusedBlockIndex] = useState<number>(-1)
  const [selectedBlockItem, setSelectedBlockItem] = useState<TimelineItem | null>(null)

  // --- range selection ---
  const [rangeStartItem, setRangeStartItem] = useState<TimelineItem | null>(null)
  const [rangeEndItem, setRangeEndItem] = useState<TimelineItem | null>(null)

  // --- context menu ---
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: Array<{ label: string; action: () => void }> } | null>(null)

  // --- panning state (middle-mouse, trackpad) ---
  const panRef = useRef<{ isPanning: boolean; startX: number; startCenterMs: number }>({ isPanning: false, startX: 0, startCenterMs: 0 })
  const panMomentumRef = useRef<{ velocity: number; rafId: number | null }>({ velocity: 0, rafId: null })

  // --- auto-pan: keep playhead visible when playing ---
  useEffect(() => {
    if (zoom <= 1) return
    if (Date.now() - lastManualPanRef.current < 1500) return
    if (currentMs < viewStartMs || currentMs > viewEndMs) {
      setViewCenterMs(currentMs)
    }
  }, [currentMs, zoom, viewStartMs, viewEndMs])

  // reset center when total changes
  useEffect(() => { setViewCenterMs(totalDurationMs / 2) }, [totalDurationMs])

  // --- grouped lanes ---
  const groupedLanes = useMemo(() => {
    const groups: Record<string, TimelineLane[]> = {}
    for (const lane of lanes) {
      const g = getTrackGroup(lane.label)
      ;(groups[g] ??= []).push(lane)
    }
    return groups
  }, [lanes])

  // --- collapsed groups state ---
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroupCollapse = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }, [])

  // --- density ---
  const densityBuckets = useMemo(() => computeDensityBuckets(lanes, totalDurationMs, DENSITY_BUCKETS), [lanes, totalDurationMs])
  const maxDensity = useMemo(() => Math.max(1, ...densityBuckets), [densityBuckets])

  // --- density color buckets (predominant lane color at each bucket position) ---
  const densityColors = useMemo(() => {
    if (totalDurationMs <= 0) return new Array(DENSITY_BUCKETS).fill("#76B900")
    const bucketMs = totalDurationMs / DENSITY_BUCKETS
    return Array.from({ length: DENSITY_BUCKETS }, (_, i) => {
      const bucketStart = i * bucketMs
      const bucketEnd = (i + 1) * bucketMs
      const counts = new Map<string, number>()
      for (const lane of lanes) {
        for (const item of lane.items) {
          if (item.endMs > bucketStart && item.startMs < bucketEnd) {
            counts.set(lane.label, (counts.get(lane.label) ?? 0) + 1)
          }
        }
      }
      let maxLabel = ""
      let maxCount = 0
      for (const [label, count] of counts) {
        if (count > maxCount) { maxLabel = label; maxCount = count }
      }
      return maxLabel ? commandColor(maxLabel) : "#76B900"
    })
  }, [lanes, totalDurationMs])

  // --- playhead trail positions (for motion blur effect) ---
  const prevPlayheadRef = useRef<number>(currentMs)
  const [playheadTrails, setPlayheadTrails] = useState<Array<{ id: number; percent: number }>>([])
  const trailIdRef = useRef(0)
  useEffect(() => {
    const prevMs = prevPlayheadRef.current
    const diff = Math.abs(currentMs - prevMs)
    if (diff > 50 && diff < visibleDurationMs * 0.3) {
      const trailPercent = visibleDurationMs > 0 ? ((prevMs - viewStartMs) / visibleDurationMs) * 100 : 0
      if (trailPercent >= 0 && trailPercent <= 100) {
        const id = ++trailIdRef.current
        setPlayheadTrails((prev) => [...prev.slice(-3), { id, percent: trailPercent }])
        setTimeout(() => setPlayheadTrails((prev) => prev.filter((t) => t.id !== id)), 400)
      }
    }
    prevPlayheadRef.current = currentMs
  }, [currentMs, viewStartMs, visibleDurationMs])

  // --- helpers ---
  const clientXToMs = useCallback((clientX: number): number | null => {
    const el = trackAreaRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const trackLeft = LABEL_WIDTH
    const trackWidth = rect.width - trackLeft - 10
    if (x < trackLeft || trackWidth <= 0) return null
    const ratio = (x - trackLeft) / trackWidth
    return viewStartMs + ratio * visibleDurationMs
  }, [viewStartMs, visibleDurationMs])

  const msToPercent = useCallback((ms: number): number => {
    return visibleDurationMs > 0 ? ((ms - viewStartMs) / visibleDurationMs) * 100 : 0
  }, [viewStartMs, visibleDurationMs])

  const msToTrackX = useCallback((ms: number): number | null => {
    const el = trackAreaRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const trackLeft = LABEL_WIDTH
    const trackWidth = rect.width - trackLeft - 10
    if (trackWidth <= 0) return null
    const ratio = (ms - viewStartMs) / visibleDurationMs
    return trackLeft + ratio * trackWidth
  }, [viewStartMs, visibleDurationMs])

  // --- all blocks flattened for keyboard navigation ---
  const allBlocks = useMemo(() => {
    const result: TimelineItem[] = []
    for (const lane of lanes) {
      for (const item of lane.items) {
        result.push(item)
      }
    }
    result.sort((a, b) => a.startMs - b.startMs)
    return result
  }, [lanes])

  // --- range computation ---
  const rangeMs = useMemo<{ start: number; end: number } | null>(() => {
    if (!rangeStartItem || !rangeEndItem) return null
    const startMs = Math.min(rangeStartItem.startMs, rangeEndItem.startMs)
    const endMs = Math.max(rangeStartItem.endMs, rangeEndItem.endMs)
    return { start: startMs, end: endMs }
  }, [rangeStartItem, rangeEndItem])

  // --- hover popover ---
  const showStepPopover = useCallback((item: TimelineItem) => {
    if (hoverTimerRef.current != null) window.clearTimeout(hoverTimerRef.current)
    // "Warm hover" — if popover already showing, switch instantly
    const delay = hoveredItem ? 0 : 150
    hoverTimerRef.current = window.setTimeout(() => setHoveredItem(item), delay)
  }, [hoveredItem])

  const hideStepPopover = useCallback(() => {
    if (hoverTimerRef.current != null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverTimerRef.current = window.setTimeout(() => setHoveredItem(null), 300)
  }, [])

  // Called when mouse enters the popover — cancel pending hide
  const handlePopoverEnter = useCallback(() => {
    if (hoverTimerRef.current != null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
  }, [])

  // Called when mouse leaves the popover — schedule hide
  const handlePopoverLeave = useCallback(() => {
    if (hoverTimerRef.current != null) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null }
    hoverTimerRef.current = window.setTimeout(() => setHoveredItem(null), 300)
  }, [])

  useEffect(() => () => { if (hoverTimerRef.current != null) window.clearTimeout(hoverTimerRef.current) }, [])

  // --- mouse interactions ---
  const handleTrackMouseMove = useCallback((e: React.MouseEvent) => {
    const el = trackAreaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const trackLeft = LABEL_WIDTH
    const trackWidth = rect.width - trackLeft - 10
    if (x >= trackLeft && trackWidth > 0) {
      const ratio = (x - trackLeft) / trackWidth
      setHoverTimeMs(Math.round(viewStartMs + ratio * visibleDurationMs))
      setHoverX(x)
    } else {
      setHoverTimeMs(null); setHoverX(null)
    }
  }, [viewStartMs, visibleDurationMs])

  // --- snap threshold: fraction of visible duration that equals ~100ms in time ---
  const snapThresholdMs = Math.min(200, visibleDurationMs * 0.015)

  const snapToNearestStep = useCallback((ms: number): { snapped: number; didSnap: boolean } => {
    let closest = ms
    let closestDist = snapThresholdMs
    let didSnap = false
    for (const lane of lanes) {
      for (const item of lane.items) {
        const distToStart = Math.abs(item.startMs - ms)
        const distToEnd = Math.abs(item.endMs - ms)
        if (distToStart < closestDist) { closest = item.startMs; closestDist = distToStart; didSnap = true }
        if (distToEnd < closestDist) { closest = item.endMs; closestDist = distToEnd; didSnap = true }
      }
    }
    return { snapped: closest, didSnap }
  }, [lanes, snapThresholdMs])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (isDraggingPlayhead) return
    if (contextMenu) { setContextMenu(null); return }
    const ms = clientXToMs(e.clientX)
    if (ms != null) {
      const { snapped } = snapToNearestStep(ms)
      onSeek(Math.round(Math.max(0, Math.min(totalDurationMs, snapped))))
    }
  }, [clientXToMs, onSeek, totalDurationMs, isDraggingPlayhead, snapToNearestStep, contextMenu])

  // --- momentum helper ---
  const applyMomentum = useCallback((velocity: number) => {
    if (momentumRef.current.rafId != null) cancelAnimationFrame(momentumRef.current.rafId)
    const FRICTION = 0.92
    const MIN_VELOCITY = 0.5
    let currentVel = velocity
    const tick = () => {
      if (Math.abs(currentVel) < MIN_VELOCITY) { momentumRef.current.rafId = null; return }
      const delta = currentVel * FRAME_MS
      onSeek(Math.round(Math.max(0, Math.min(totalDurationMs, currentMs + delta))))
      currentVel *= FRICTION
      momentumRef.current.rafId = requestAnimationFrame(tick)
    }
    momentumRef.current.rafId = requestAnimationFrame(tick)
  }, [totalDurationMs, onSeek, FRAME_MS, currentMs])

  // --- playhead drag (with preview, snap feedback, momentum) ---
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setIsDraggingPlayhead(true)
    setScrubPreviewMs(currentMs)
    scrubHistoryRef.current = [{ ms: currentMs, time: Date.now() }]
    if (momentumRef.current.rafId != null) { cancelAnimationFrame(momentumRef.current.rafId); momentumRef.current.rafId = null }

    const onMove = (ev: MouseEvent) => {
      const ms = clientXToMs(ev.clientX)
      if (ms != null) {
        const clamped = Math.max(0, Math.min(totalDurationMs, ms))
        const { snapped, didSnap } = snapToNearestStep(clamped)
        setScrubSnapped(didSnap)
        setScrubPreviewMs(snapped)
        const trackX = msToTrackX(snapped)
        setScrubTooltipX(trackX)
        onSeek(Math.round(snapped))
        const now = Date.now()
        scrubHistoryRef.current.push({ ms: snapped, time: now })
        if (scrubHistoryRef.current.length > 5) scrubHistoryRef.current.shift()
      }
    }
    const onUp = () => {
      setIsDraggingPlayhead(false)
      setScrubPreviewMs(null)
      setScrubSnapped(false)
      setScrubTooltipX(null)
      const history = scrubHistoryRef.current
      if (history.length >= 2) {
        const last = history[history.length - 1]
        const prev = history[history.length - 2]
        const dt = last.time - prev.time
        if (dt > 0 && dt < 100) {
          const velocity = (last.ms - prev.ms) / dt
          if (Math.abs(velocity) > 0.3) {
            applyMomentum(velocity)
          }
        }
      }
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [clientXToMs, onSeek, totalDurationMs, snapToNearestStep, msToTrackX, currentMs, applyMomentum])

  // --- Ctrl+wheel zoom + trackpad horizontal pan ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/Meta + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.3 : 0.3
      setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
      lastManualPanRef.current = Date.now()
      const ms = clientXToMs(e.clientX)
      if (ms != null) setViewCenterMs((prev) => prev + (ms - prev) * 0.15)
      return
    }
    // Horizontal scroll (trackpad two-finger) = pan when zoomed
    if (zoom > 1 && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault()
      const panAmount = (e.deltaX / 400) * visibleDurationMs
      setViewCenterMs((prev) => {
        const next = prev + panAmount
        return Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, next))
      })
      lastManualPanRef.current = Date.now()
    }
  }, [clientXToMs, zoom, visibleDurationMs, totalDurationMs])

  // --- middle-mouse drag for panning ---
  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return
    e.preventDefault()
    panRef.current = { isPanning: true, startX: e.clientX, startCenterMs: viewCenterMs }
    let lastX = e.clientX
    let lastTime = Date.now()
    let panVelocity = 0

    const onMove = (ev: MouseEvent) => {
      if (!panRef.current.isPanning) return
      const el = trackAreaRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const trackWidth = rect.width - LABEL_WIDTH - 10
      if (trackWidth <= 0) return
      const dx = ev.clientX - panRef.current.startX
      const msPerPx = visibleDurationMs / trackWidth
      const newCenter = panRef.current.startCenterMs - dx * msPerPx
      setViewCenterMs(Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, newCenter)))
      lastManualPanRef.current = Date.now()
      const now = Date.now()
      const dt = now - lastTime
      if (dt > 0) { panVelocity = (ev.clientX - lastX) / dt }
      lastX = ev.clientX
      lastTime = now
    }
    const onUp = () => {
      panRef.current.isPanning = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
      // Momentum panning deceleration
      if (Math.abs(panVelocity) > 0.2) {
        const el = trackAreaRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const trackWidth = rect.width - LABEL_WIDTH - 10
        if (trackWidth <= 0) return
        const msPerPx = visibleDurationMs / trackWidth
        if (panMomentumRef.current.rafId != null) cancelAnimationFrame(panMomentumRef.current.rafId)
        panMomentumRef.current.velocity = panVelocity
        const FRICTION = 0.94
        const MIN_V = 0.01
        const tick = () => {
          const v = panMomentumRef.current.velocity
          if (Math.abs(v) < MIN_V) { panMomentumRef.current.rafId = null; return }
          setViewCenterMs((prev) => {
            const next = prev - v * 16 * msPerPx
            return Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, next))
          })
          panMomentumRef.current.velocity *= FRICTION
          lastManualPanRef.current = Date.now()
          panMomentumRef.current.rafId = requestAnimationFrame(tick)
        }
        panMomentumRef.current.rafId = requestAnimationFrame(tick)
      }
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [viewCenterMs, visibleDurationMs, totalDurationMs])

  // --- minimap drag ---
  const handleMinimapMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    minimapDragRef.current = { dragging: true, startX: e.clientX, startCenterMs: viewCenterMs }
    const onMove = (ev: MouseEvent) => {
      if (!minimapDragRef.current.dragging) return
      const el = (e.target as HTMLElement).closest("[data-minimap]") as HTMLElement | null
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dx = ev.clientX - minimapDragRef.current.startX
      const ratio = dx / rect.width
      const newCenter = minimapDragRef.current.startCenterMs + ratio * totalDurationMs
      setViewCenterMs(Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, newCenter)))
      lastManualPanRef.current = Date.now()
    }
    const onUp = () => {
      minimapDragRef.current.dragging = false
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
  }, [viewCenterMs, totalDurationMs, visibleDurationMs])

  // --- keyboard navigation (zoom, arrow scrub, tab, enter, escape) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        setZoom((prev) => Math.min(MAX_ZOOM, prev + 0.5))
        lastManualPanRef.current = Date.now()
      } else if (e.key === "-") {
        e.preventDefault()
        setZoom((prev) => Math.max(MIN_ZOOM, prev - 0.5))
        lastManualPanRef.current = Date.now()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        const step = e.shiftKey ? FRAME_MS * 10 : FRAME_MS
        onSeek(Math.round(Math.max(0, currentMs - step)))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        const step = e.shiftKey ? FRAME_MS * 10 : FRAME_MS
        onSeek(Math.round(Math.min(totalDurationMs, currentMs + step)))
      } else if (e.key === "Tab") {
        e.preventDefault()
        if (allBlocks.length === 0) return
        const dir = e.shiftKey ? -1 : 1
        const next = focusedBlockIndex < 0 ? 0 : (focusedBlockIndex + dir + allBlocks.length) % allBlocks.length
        setFocusedBlockIndex(next)
        setSelectedBlockItem(allBlocks[next])
      } else if (e.key === "Enter") {
        if (focusedBlockIndex >= 0 && focusedBlockIndex < allBlocks.length) {
          e.preventDefault()
          onSeek(allBlocks[focusedBlockIndex].startMs)
        }
      } else if (e.key === "Escape") {
        setFocusedBlockIndex(-1)
        setSelectedBlockItem(null)
        setRangeStartItem(null)
        setRangeEndItem(null)
        setPinnedItem(null)
        setContextMenu(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [allBlocks, focusedBlockIndex, currentMs, totalDurationMs, onSeek, FRAME_MS])

  // --- close context menu on outside click ---
  useEffect(() => {
    if (!contextMenu) return
    const onClick = () => setContextMenu(null)
    window.addEventListener("click", onClick)
    return () => window.removeEventListener("click", onClick)
  }, [contextMenu])

  // --- block interaction callbacks ---
  const handleBlockClick = useCallback((item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey) {
      if (!rangeStartItem) {
        setRangeStartItem(item)
      } else {
        setRangeEndItem(item)
      }
      return
    }
    onSeek(item.startMs)
    setSelectedBlockItem(item)
    const idx = allBlocks.findIndex((b) => b.step.id === item.step.id)
    setFocusedBlockIndex(idx)
  }, [onSeek, rangeStartItem, allBlocks])

  const handleBlockDoubleClick = useCallback((item: TimelineItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setPinnedItem((prev) => prev?.step.id === item.step.id ? null : item)
  }, [])

  const handleBlockContextMenu = useCallback((item: TimelineItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const menuItems = [
      { label: "Go to start", action: () => { onSeek(item.startMs); setContextMenu(null) } },
      { label: "Go to end", action: () => { onSeek(item.endMs); setContextMenu(null) } },
      { label: "Copy JSON", action: () => { navigator.clipboard.writeText(JSON.stringify(item.step.command, null, 2)).catch(() => {}); setContextMenu(null) } },
      { label: "Select range from here", action: () => { setRangeStartItem(item); setRangeEndItem(null); setContextMenu(null) } },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems })
  }, [onSeek])

  // --- minimap double-click: fit to all ---
  const handleMinimapDoubleClick = useCallback(() => {
    setZoom(1)
    setViewCenterMs(totalDurationMs / 2)
  }, [totalDurationMs])

  // --- ticks adapted to zoom window ---
  const tickCount = 6
  const ticks = useMemo(() => {
    const result: number[] = []
    for (let i = 0; i <= tickCount; i++) {
      result.push(viewStartMs + (i / tickCount) * visibleDurationMs)
    }
    return result
  }, [viewStartMs, visibleDurationMs])

  const playheadPercent = msToPercent(currentMs)
  const playheadVisible = currentMs >= viewStartMs && currentMs <= viewEndMs

  return (
    <section
      aria-label="Multi-track timeline"
      style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}
    >
      {/* Header with mode toggle and zoom controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mode toggle buttons — only show editor toggle when renderBashEditor is provided */}
          {renderBashEditor ? (
            <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
              <button
                type="button"
                onClick={() => setTimelineMode("timeline")}
                style={{
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: timelineMode === "timeline" ? "rgba(118,185,0,0.2)" : "rgba(255,255,255,0.03)",
                  color: timelineMode === "timeline" ? "#76B900" : "rgba(255,255,255,0.45)",
                  borderRight: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={switchToEditor}
                style={{
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  background: timelineMode === "editor" ? "rgba(118,185,0,0.2)" : "rgba(255,255,255,0.03)",
                  color: timelineMode === "editor" ? "#76B900" : "rgba(255,255,255,0.45)",
                }}
              >
                Editor
              </button>
            </div>
          ) : null}
          {timelineMode === "timeline" && (
            <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>
              {lanes.length} tracks
            </span>
          )}
          {timelineMode === "editor" && (
            <>
              <span style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(118,185,0,0.06)", fontSize: 10, fontWeight: 600, color: "rgba(118,185,0,0.6)" }}>
                {steps.length} steps • {formatTime(totalDurationMs)}
              </span>
              {errorLines.size > 0 && (
                <span style={{ fontSize: 9, background: "rgba(239,68,68,0.2)", color: "#ef4444", padding: "1px 5px", borderRadius: 8, fontWeight: 600 }}>
                  {errorLines.size} error{errorLines.size > 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </div>
        {timelineMode === "timeline" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
              {formatTime(currentMs)}
            </div>
            {/* Zoom level indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 5, background: zoom > 1 ? "rgba(118,185,0,0.1)" : "rgba(255,255,255,0.03)", border: zoom > 1 ? "1px solid rgba(118,185,0,0.25)" : "1px solid rgba(255,255,255,0.06)" }}>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.6 }}>
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 9, fontWeight: 700, color: zoom > 1 ? "#76B900" : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
                {zoom.toFixed(1)}x
              </span>
            </div>
            {/* Zoom buttons */}
            <button className="pbc-zoom-btn" type="button" aria-label="Zoom out" onClick={() => { setZoom((z) => Math.max(MIN_ZOOM, z - 0.5)); lastManualPanRef.current = Date.now() }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <button className="pbc-zoom-btn" type="button" aria-label="Zoom in" onClick={() => { setZoom((z) => Math.min(MAX_ZOOM, z + 0.5)); lastManualPanRef.current = Date.now() }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
            <button className="pbc-zoom-btn" type="button" aria-label="Fit all" title="Fit timeline to view" onClick={() => { setZoom(1); setViewCenterMs(totalDurationMs / 2) }} style={{ width: 32, fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
              FIT
            </button>
          </div>
        )}
      </div>

      {/* Editor mode */}
      {timelineMode === "editor" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minHeight: 0 }}>
          {renderBashEditor ? renderBashEditor({
            value: editorText,
            onChange: setEditorText,
            activeLines,
            errorLines,
            onLineClick: handleLineClick,
            steps,
            onRun: handleEditorRun,
            style: { flex: 1, minHeight: 180, maxHeight: 260 },
          }) : (
            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              style={{ flex: 1, minHeight: 180, maxHeight: 260, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#fff", padding: 8, fontSize: 11, fontFamily: "monospace", resize: "vertical" }}
            />
          )}
          {activeLines.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "3px 8px", borderRadius: 4,
              background: "rgba(118,185,0,0.06)",
              border: "1px solid rgba(118,185,0,0.15)",
              fontSize: 10, color: "rgba(118,185,0,0.8)",
              fontFamily: "SFMono-Regular, Consolas, monospace"
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#76B900", animation: "pulse 1.5s infinite" }} />
              Playing line {activeLines[0]}{activeLines.length > 1 ? `\u2013${activeLines[activeLines.length - 1]}` : ""} ({activeLines.length} active)
            </div>
          )}
          {editorError && (
            <div style={{ fontSize: 10, color: "#f87171", padding: "4px 8px", borderRadius: 4, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
              {editorError}
            </div>
          )}
          {errorLines.size > 0 && (
            <div style={{
              padding: "4px 8px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 4,
              fontSize: 10,
              color: "#ef4444",
              maxHeight: 60,
              overflow: "auto",
              fontFamily: "SFMono-Regular, Consolas, monospace",
            }}>
              {Array.from(errorLines.entries()).map(([line, msg]) => (
                <div key={line}>Line {line}: {msg.trim()}</div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleEditorRun}
              disabled={isRunning || !editorText.trim() || !onEditorRun}
              style={{
                padding: "5px 14px",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                border: "1px solid rgba(118,185,0,0.5)",
                background: "rgba(118,185,0,0.15)",
                color: "#76B900",
                cursor: isRunning || !editorText.trim() ? "not-allowed" : "pointer",
                opacity: isRunning || !editorText.trim() ? 0.5 : 1,
              }}
            >
              {isRunning ? "Running..." : "\u25B6 Run"}
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Density minimap - SVG smooth curve with color coding */}
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, paddingRight: 10 }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", paddingLeft: 8 }}>density</div>
        <div style={{ position: "relative", height: 24, borderRadius: 5, overflow: "hidden", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${DENSITY_BUCKETS} 24`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
            <defs>
              <linearGradient id="density-grad-stroke" x1="0" y1="0" x2="1" y2="0">
                {densityColors.filter((_, i) => i % 4 === 0).map((col, i, arr) => (
                  <stop key={i} offset={`${(i / Math.max(1, arr.length - 1)) * 100}%`} stopColor={col} stopOpacity="0.8" />
                ))}
              </linearGradient>
              <linearGradient id="density-grad-fill" x1="0" y1="0" x2="1" y2="0">
                {densityColors.filter((_, i) => i % 4 === 0).map((col, i, arr) => (
                  <stop key={i} offset={`${(i / Math.max(1, arr.length - 1)) * 100}%`} stopColor={col} stopOpacity="0.3" />
                ))}
              </linearGradient>
            </defs>
            {/* Filled area under curve */}
            <path
              d={(() => {
                const pts = densityBuckets.map((count, i) => ({ x: i, y: 24 - (count / maxDensity) * 20 }))
                if (pts.length < 2) return ""
                let d = `M 0 24 L 0 ${pts[0].y}`
                for (let i = 0; i < pts.length - 1; i++) {
                  const cp1x = pts[i].x + 0.4
                  const cp2x = pts[i + 1].x - 0.4
                  d += ` C ${cp1x} ${pts[i].y} ${cp2x} ${pts[i + 1].y} ${pts[i + 1].x} ${pts[i + 1].y}`
                }
                d += ` L ${DENSITY_BUCKETS - 1} 24 Z`
                return d
              })()}
              fill="url(#density-grad-fill)"
            />
            {/* Stroke line on top */}
            <path
              className="pbc-density-curve"
              d={(() => {
                const pts = densityBuckets.map((count, i) => ({ x: i, y: 24 - (count / maxDensity) * 20 }))
                if (pts.length < 2) return ""
                let d = `M ${pts[0].x} ${pts[0].y}`
                for (let i = 0; i < pts.length - 1; i++) {
                  const cp1x = pts[i].x + 0.4
                  const cp2x = pts[i + 1].x - 0.4
                  d += ` C ${cp1x} ${pts[i].y} ${cp2x} ${pts[i + 1].y} ${pts[i + 1].x} ${pts[i + 1].y}`
                }
                return d
              })()}
              stroke="url(#density-grad-stroke)"
              strokeWidth="1.2"
            />
          </svg>
          {/* Shine overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 50%)", pointerEvents: "none" }} />
          {/* Current viewport window indicator */}
          {zoom > 1 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(viewStartMs / totalDurationMs) * 100}%`, width: `${(visibleDurationMs / totalDurationMs) * 100}%`, background: "rgba(255,255,255,0.04)", borderLeft: "1px solid rgba(255,255,255,0.15)", borderRight: "1px solid rgba(255,255,255,0.15)", pointerEvents: "none", borderRadius: 2 }} />
          )}
          {/* Playhead position on density */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`, width: 1.5, background: "#76B900", boxShadow: "0 0 4px rgba(118,185,0,0.6)", pointerEvents: "none" }} />
        </div>
      </div>

      {/* Minimap (only when zoomed) */}
      {zoom > 1 && (
        <div data-minimap style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, paddingRight: 10 }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", paddingLeft: 8 }}>overview</div>
          <div
            style={{ position: "relative", height: 18, borderRadius: 5, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", overflow: "hidden" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const ratio = (e.clientX - rect.left) / rect.width
              const newCenter = ratio * totalDurationMs
              setViewCenterMs(Math.max(visibleDurationMs / 2, Math.min(totalDurationMs - visibleDurationMs / 2, newCenter)))
              lastManualPanRef.current = Date.now()
            }}
            onDoubleClick={handleMinimapDoubleClick}
          >
            {/* Density gradient background in minimap */}
            <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.4 }}>
              {densityBuckets.map((count, i) => {
                const alpha = count / maxDensity
                return <div key={`mm-d-${i}`} style={{ flex: 1, background: alpha > 0 ? `rgba(118,185,0,${alpha * 0.35})` : "transparent" }} />
              })}
            </div>
            {lanes.map((lane) => lane.items.map((item) => {
              const l = totalDurationMs > 0 ? (item.startMs / totalDurationMs) * 100 : 0
              const w = totalDurationMs > 0 ? Math.max(0.3, ((item.endMs - item.startMs) / totalDurationMs) * 100) : 0
              return <div key={item.step.id} style={{ position: "absolute", top: 3, bottom: 3, left: `${l}%`, width: `${w}%`, borderRadius: 2, background: `${commandColor(lane.label)}66` }} />
            }))}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0}%`, width: 1.5, background: "#76B900", boxShadow: "0 0 4px rgba(118,185,0,0.6)", zIndex: 3 }} />
            <div className="pbc-minimap-viewport" onMouseDown={handleMinimapMouseDown} style={{ position: "absolute", top: 0, bottom: 0, left: `${totalDurationMs > 0 ? (viewStartMs / totalDurationMs) * 100 : 0}%`, width: `${totalDurationMs > 0 ? (visibleDurationMs / totalDurationMs) * 100 : 100}%`, borderRadius: 4, border: "1.5px solid rgba(118,185,0,0.45)", background: "rgba(118,185,0,0.06)", zIndex: 2 }} />
          </div>
        </div>
      )}

      {/* Enhanced Time Ruler */}
      <div style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, paddingRight: 10 }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.15)", display: "flex", alignItems: "flex-end", paddingLeft: 8, paddingBottom: 2 }}>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.4 }}>
            <rect x="1" y="3" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
            <line x1="4" y1="1" x2="4" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="12" y1="1" x2="12" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="pbc-time-ruler">
          {/* Highlighted viewport range background */}
          {zoom > 1 && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(118,185,0,0.02)", borderRadius: 3 }} />
          )}
          {ticks.map((t, i) => {
            const leftPct = (i / tickCount) * 100
            return (
              <React.Fragment key={i}>
                {/* Major tick mark */}
                <span className="pbc-ruler-tick-major" style={{ left: `${leftPct}%` }} />
                {/* Time label */}
                <span className="pbc-ruler-label" style={{ left: `${leftPct}%` }}>
                  {formatTime(t)}
                </span>
              </React.Fragment>
            )
          })}
          {/* Minor ticks between major ticks */}
          {ticks.slice(0, -1).map((_, i) => {
            const subTickCount = zoom > 4 ? 5 : zoom > 2 ? 3 : 1
            return Array.from({ length: subTickCount }, (__, j) => {
              const subPos = ((i + (j + 1) / (subTickCount + 1)) / tickCount) * 100
              return <span key={`sub-${i}-${j}`} className="pbc-ruler-tick-minor" style={{ left: `${subPos}%` }} />
            })
          })}
          {/* Playhead marker on ruler */}
          {playheadVisible && (
            <div style={{ position: "absolute", bottom: 0, left: `${playheadPercent}%`, width: 2, height: 12, background: "#76B900", borderRadius: "1px 1px 0 0", boxShadow: "0 0 6px rgba(118,185,0,0.5)", transform: "translateX(-1px)" }} />
          )}
        </div>
      </div>

      {/* Track area */}
      <div
        ref={trackAreaRef}
        onClick={handleTrackClick}
        onMouseDown={handleTrackMouseDown}
        onMouseMove={handleTrackMouseMove}
        onMouseLeave={() => { setHoverTimeMs(null); setHoverX(null) }}
        onWheel={handleWheel}
        onContextMenu={(e) => { e.preventDefault() }}
        style={{ position: "relative", borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", cursor: isDraggingPlayhead ? "ew-resize" : panRef.current.isPanning ? "grabbing" : "crosshair" }}
      >
        {/* Vertical grid lines from ticks */}
        {ticks.map((_, i) => {
          const leftPercent = (i / tickCount) * 100
          return (
            <div key={`grid-${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${leftPercent / 100})`, width: 1, background: "rgba(255,255,255,0.03)", borderLeft: "1px dotted rgba(255,255,255,0.04)", zIndex: 0, pointerEvents: "none" }} />
          )
        })}

        {/* Range selection highlight */}
        {rangeMs && visibleDurationMs > 0 && (() => {
          const rangeStartPct = Math.max(0, msToPercent(rangeMs.start))
          const rangeEndPct = Math.min(100, msToPercent(rangeMs.end))
          if (rangeEndPct <= 0 || rangeStartPct >= 100) return null
          return (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${rangeStartPct / 100})`, width: `calc((100% - ${LABEL_WIDTH}px - 10px) * ${(rangeEndPct - rangeStartPct) / 100})`, background: "rgba(118,185,0,0.06)", borderLeft: "2px solid rgba(118,185,0,0.4)", borderRight: "2px solid rgba(118,185,0,0.4)", zIndex: 1, pointerEvents: "none" }}>
              <div style={{ position: "absolute", top: 0, left: -1, width: 2, height: 8, background: "#76B900", borderRadius: "0 0 2px 2px" }} />
              <div style={{ position: "absolute", top: 0, right: -1, width: 2, height: 8, background: "#76B900", borderRadius: "0 0 2px 2px" }} />
            </div>
          )
        })()}

        <div ref={scrollContainerRef} className="pbc-track-scroll" style={{ maxHeight: 220, overflowY: "auto", overflowX: "hidden", padding: "4px 0 2px", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_WIDTH, width: 1, background: "rgba(255,255,255,0.06)", zIndex: 1 }} />
          {lanes.length === 0 ? (
            <div style={{ height: 186, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>No tracks</div>
          ) : (
            Object.entries(groupedLanes).map(([group, groupLanes], groupIdx) => {
              const isCollapsed = collapsedGroups.has(group)
              const groupItemCount = groupLanes.reduce((sum, lane) => sum + lane.items.length, 0)
              return (
              <div key={group}>
                {Object.keys(groupedLanes).length > 1 && (
                  <div
                    className="pbc-group-header"
                    onClick={() => toggleGroupCollapse(group)}
                    style={{ display: "grid", gridTemplateColumns: `${LABEL_WIDTH}px 1fr`, minHeight: 22, alignItems: "center", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)", borderTop: groupIdx > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined, marginTop: groupIdx > 0 ? 2 : 0 }}
                  >
                    <div style={{ padding: "0 8px", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 0.6, display: "flex", alignItems: "center", gap: 5 }}>
                      {/* Collapse/expand chevron */}
                      <span className={`pbc-group-chevron${isCollapsed ? " pbc-group-chevron-collapsed" : ""}`}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2.5 3.5L5 6L7.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>{group}</span>
                      {/* Item count badge */}
                      <span className="pbc-badge-pop" style={{ padding: "0 4px", borderRadius: 3, background: "rgba(255,255,255,0.06)", fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.3)", lineHeight: "14px" }}>
                        {groupItemCount}
                      </span>
                    </div>
                    <div style={{ height: 1, background: isCollapsed ? "transparent" : "rgba(255,255,255,0.03)" }} />
                  </div>
                )}
                {!isCollapsed && groupLanes.map((lane, laneIndex) => (
                  <TimelineLaneRow key={lane.id} lane={lane} viewStartMs={viewStartMs} visibleDurationMs={visibleDurationMs} labelWidth={LABEL_WIDTH} even={laneIndex % 2 === 0} currentMs={currentMs} onSeek={onSeek} onStepHoverStart={showStepPopover} onStepHoverEnd={hideStepPopover} selectedBlockId={selectedBlockItem?.step.id ?? null} focusedBlockId={focusedBlockIndex >= 0 && focusedBlockIndex < allBlocks.length ? allBlocks[focusedBlockIndex].step.id : null} rangeMs={rangeMs} onBlockClick={handleBlockClick} onBlockDoubleClick={handleBlockDoubleClick} onBlockContextMenu={handleBlockContextMenu} />
                ))}
              </div>
              )
            })
          )}
        </div>

        {/* Motion blur trails */}
        {playheadTrails.map((trail) => (
          <div
            key={trail.id}
            className="pbc-playhead-trail"
            style={{ left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${trail.percent / 100})`, background: "rgba(118,185,0,0.3)", zIndex: 4 }}
          />
        ))}

        {/* Playhead with gradient fade, time display, and glow */}
        {playheadVisible && (
          <div className="pbc-playhead-line" style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px - 10px) * ${playheadPercent / 100})`, width: 2, background: "linear-gradient(180deg, transparent 0%, #9FE030 8%, #76B900 50%, #9FE030 92%, transparent 100%)", boxShadow: "0 0 12px rgba(118,185,0,0.7), 0 0 4px rgba(118,185,0,0.9), 0 0 24px rgba(118,185,0,0.3)", zIndex: 5, pointerEvents: "none", borderRadius: 1 }}>
            {/* Time display following playhead */}
            <div className="pbc-playhead-time">{formatTime(currentMs)}</div>
            {/* Top triangle handle */}
            <div className="pbc-playhead-handle" onMouseDown={handlePlayheadMouseDown} style={{ position: "absolute", top: -3, left: -7, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "9px solid #9FE030", filter: "drop-shadow(0 0 4px rgba(118,185,0,0.8))", pointerEvents: "auto", cursor: "ew-resize" }} />
            {/* Bottom triangle handle */}
            <div className="pbc-playhead-handle" onMouseDown={handlePlayheadMouseDown} style={{ position: "absolute", bottom: -3, left: -7, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "9px solid #9FE030", filter: "drop-shadow(0 0 4px rgba(118,185,0,0.8))", pointerEvents: "auto", cursor: "ew-resize" }} />
          </div>
        )}

        {/* Hover time indicator */}
        {hoverX !== null && hoverTimeMs !== null && (
          <>
            <div style={{ position: "absolute", top: 0, bottom: 0, left: hoverX, width: 1, background: "rgba(118,185,0,0.25)", borderLeft: "1px dashed rgba(118,185,0,0.3)", zIndex: 3, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 2, left: hoverX, transform: "translateX(-50%)", padding: "2px 6px", borderRadius: 4, background: "rgba(118,185,0,0.9)", fontSize: 9, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums", pointerEvents: "none", zIndex: 6, whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>{formatTime(hoverTimeMs)}</div>
          </>
        )}

        {hoveredItem && (
          <StepJsonPopover item={hoveredItem} viewStartMs={viewStartMs} visibleDurationMs={visibleDurationMs} labelWidth={LABEL_WIDTH} onMouseEnter={handlePopoverEnter} onMouseLeave={handlePopoverLeave} renderJsonInspector={renderJsonInspector} />
        )}
      </div>

      {/* Zoom hint footer */}
      {zoom <= 1 && (
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", textAlign: "right", paddingRight: 4 }}>Ctrl+wheel or +/- to zoom</div>
      )}
      </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// TimelineLaneRow  (zoom-aware, block labels, visual polish)
// ---------------------------------------------------------------------------
export function TimelineLaneRow({
  lane,
  viewStartMs,
  visibleDurationMs,
  labelWidth,
  even,
  currentMs,
  onSeek,
  onStepHoverStart,
  onStepHoverEnd,
  selectedBlockId: _selectedBlockId,
  focusedBlockId: _focusedBlockId,
  rangeMs: _rangeMs,
  onBlockClick: _onBlockClick,
  onBlockDoubleClick: _onBlockDoubleClick,
  onBlockContextMenu: _onBlockContextMenu,
}: {
  lane: TimelineLane
  viewStartMs: number
  visibleDurationMs: number
  labelWidth: number
  even: boolean
  currentMs: number
  onSeek: (ms: number) => void
  onStepHoverStart: (item: TimelineItem) => void
  onStepHoverEnd: () => void
  selectedBlockId?: string | null
  focusedBlockId?: string | null
  rangeMs?: { start: number; end: number } | null
  onBlockClick?: (item: TimelineItem, e: React.MouseEvent) => void
  onBlockDoubleClick?: (item: TimelineItem, e: React.MouseEvent) => void
  onBlockContextMenu?: (item: TimelineItem, e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const color = commandColor(lane.label)
  const viewEndMs = viewStartMs + visibleDurationMs

  const visibleItems = useMemo(() =>
    lane.items.filter((item) => item.endMs > viewStartMs && item.startMs < viewEndMs),
    [lane.items, viewStartMs, viewEndMs]
  )

  // Compute waveform-like border-radius variation based on duration
  const getBlockRadius = (durationMs: number): string => {
    // Short clips: pill-shaped; medium: slightly rounded; long: more rectangular
    if (durationMs < 500) return "9px"
    if (durationMs < 1500) return "6px"
    if (durationMs < 3000) return "5px 7px 7px 5px"
    return "4px 6px 6px 4px"
  }

  return (
    <div className="pbc-lane-row" style={{ display: "grid", gridTemplateColumns: `${labelWidth}px 1fr`, minHeight: 32, alignItems: "center", position: "relative", background: even ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.008) 30%, rgba(255,255,255,0.012) 70%, transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.018) 30%, rgba(255,255,255,0.022) 70%, transparent)", borderBottom: "1px solid rgba(255,255,255,0.02)" }}>
      {/* Track label with color indicator and item count */}
      <div style={{ padding: "0 8px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
        {/* Color-coded lane indicator with gradient */}
        <span style={{ flexShrink: 0, width: 3, height: 18, borderRadius: 2, background: `linear-gradient(180deg, ${color}ee, ${color}88)`, boxShadow: `0 0 5px ${color}44, inset 0 0 2px rgba(255,255,255,0.2)` }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={lane.label}>{lane.label}</span>
        {/* Item count badge */}
        <span className="pbc-badge-pop" style={{ flexShrink: 0, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", borderRadius: 4, background: `${color}18`, border: `1px solid ${color}33`, fontSize: 8, fontWeight: 700, color: `${color}cc`, lineHeight: 1 }}>
          {lane.items.length}
        </span>
      </div>
      {/* Track content area */}
      <div style={{ position: "relative", height: 26, marginRight: 10, borderRadius: 5, background: "rgba(255,255,255,0.015)" }}>
        {visibleItems.map((item) => {
          const left = visibleDurationMs > 0 ? ((item.startMs - viewStartMs) / visibleDurationMs) * 100 : 0
          const width = visibleDurationMs > 0 ? Math.max(0.4, ((item.endMs - item.startMs) / visibleDurationMs) * 100) : 0
          const clampedLeft = Math.max(0, left)
          const clampedWidth = Math.min(width, 100 - clampedLeft)
          const isActive = currentMs >= item.startMs && currentMs < item.endMs
          const approxPxWidth = (clampedWidth / 100) * 600
          const durationMs = item.endMs - item.startMs
          const blockRadius = getBlockRadius(durationMs)

          return (
            <button
              className={`pbc-timeline-item${isActive ? " pbc-block-active-glow" : ""}`}
              key={item.step.id}
              type="button"
              title={`${item.step.command.type}  |  ${formatTime(item.startMs)} - ${formatTime(item.endMs)}  (${(durationMs / 1000).toFixed(1)}s)`}
              aria-label={`${item.step.command.type} at ${formatTime(item.startMs)}`}
              onClick={(e) => { e.stopPropagation(); onSeek(item.startMs) }}
              onMouseEnter={() => onStepHoverStart(item)}
              onMouseLeave={onStepHoverEnd}
              onFocus={() => onStepHoverStart(item)}
              onBlur={onStepHoverEnd}
              style={{
                ["--glow-color" as string]: `${color}88`,
                ["--pulse-color" as string]: `${color}66`,
                position: "absolute",
                top: 3,
                left: `${clampedLeft}%`,
                width: `${clampedWidth}%`,
                minWidth: 4,
                height: 20,
                border: isActive ? `1px solid ${color}cc` : `1px solid ${color}33`,
                borderRadius: blockRadius,
                // 3D bevel effect: lighter top, darker bottom, with subtle mid-shine
                background: isActive
                  ? `linear-gradient(180deg, ${color}ff 0%, ${color}cc 30%, ${color}aa 70%, ${color}77 100%)`
                  : `linear-gradient(180deg, ${color}99 0%, ${color}77 35%, ${color}55 65%, ${color}44 100%)`,
                boxShadow: isActive
                  ? `0 0 14px ${color}66, 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.2)`
                  : `0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.15)`,
                opacity: isActive ? 1 : 0.82,
                cursor: "pointer",
                padding: 0,
                zIndex: isActive ? 2 : 1,
                overflow: "visible",
              }}
            >
              {/* Top bevel highlight */}
              <span style={{ position: "absolute", top: 0, left: "8%", right: "8%", height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", pointerEvents: "none", borderRadius: "1px" }} />
              {/* Inner waveform-like texture for longer blocks */}
              {approxPxWidth > 40 && durationMs > 800 && (
                <span style={{ position: "absolute", top: "40%", left: 4, right: 4, height: 2, background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 20%, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.06) 60%, rgba(255,255,255,0.1) 80%, transparent 100%)`, pointerEvents: "none", borderRadius: 1 }} />
              )}
              {/* Block label with tooltip for truncated text */}
              {approxPxWidth > 50 && (
                <span className="pbc-block-label" style={{ position: "relative", display: "block", padding: "0 6px", fontSize: 8.5, fontWeight: 700, color: "rgba(255,255,255,0.95)", lineHeight: "20px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 2px rgba(0,0,0,0.6)", letterSpacing: 0.2 }}>
                  {item.step.command.type}
                  {/* Tooltip shown on hover for potentially-truncated labels */}
                  {approxPxWidth < 120 && (
                    <span className="pbc-block-tooltip">{item.step.command.type}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepJsonPopover  (zoom-aware positioning, shown below track area)
// ---------------------------------------------------------------------------
export function StepJsonPopover({
  item,
  viewStartMs,
  visibleDurationMs,
  labelWidth,
  onMouseEnter,
  onMouseLeave,
  renderJsonInspector,
}: {
  item: TimelineItem
  viewStartMs: number
  visibleDurationMs: number
  labelWidth: number
  onMouseEnter: () => void
  onMouseLeave: () => void
  renderJsonInspector?: (props: JsonInspectorRenderProps) => ReactNode
}) {
  const color = commandColor(item.step.command.type)
  const itemMidpoint = item.startMs + (item.endMs - item.startMs) / 2
  const left = visibleDurationMs > 0 ? Math.min(75, Math.max(15, ((itemMidpoint - viewStartMs) / visibleDurationMs) * 100)) : 50
  const durationMs = item.endMs - item.startMs

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "absolute", left: `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${left / 100})`, bottom: "calc(100% + 10px)", width: 320, transform: "translateX(-50%)", zIndex: 50, padding: 10, borderRadius: 10, background: "rgba(16, 18, 36, 0.94)", border: `1px solid ${color}44`, boxShadow: `0 -6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", animation: "stepPopoverIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
    >
      {/* Connector arrow pointing down */}
      <div style={{ position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: `7px solid ${color}55` }} />
      <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid rgba(16, 18, 36, 0.96)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 4, background: `${color}33`, border: `1px solid ${color}66` }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: color }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.step.command.type}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", fontVariantNumeric: "tabular-nums", fontFamily: "SFMono-Regular, Consolas, monospace" }}>
            {formatTime(item.startMs)} – {formatTime(item.endMs)} ({(durationMs / 1000).toFixed(1)}s)
          </div>
        </div>
      </div>
      {renderJsonInspector ? renderJsonInspector({ value: item.step.command, height: 200, initialMode: "tree", focusPath: ["type"], compact: true }) : (
        <pre style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.5)", overflow: "auto", margin: 0, maxHeight: 200 }}>
          {JSON.stringify(item.step.command, null, 2)}
        </pre>
      )}
    </div>
  )
}
