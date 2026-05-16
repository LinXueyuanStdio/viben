/**
 * PerfProfiler — Wraps Remotion composition with React.Profiler to measure
 * per-frame render timing. Reports metrics via callback and optional on-screen HUD.
 *
 * Usage:
 *   <PerfProfiler fps={30} onReport={console.log} showHud>
 *     <PresentationOverlay steps={steps} />
 *   </PerfProfiler>
 */
import { Profiler, useRef, useState, useCallback, useEffect, type PropsWithChildren } from "react"
import { useCurrentFrame } from "remotion"
import { createPerfMonitor, formatPerfReport, type PerfMetrics, type PerfMonitor } from "../utils/perf-monitor"

export interface PerfProfilerProps {
  /** Frames per second for budget calculation */
  fps?: number
  /** Callback with report when profiling stops (component unmounts or reset) */
  onReport?: (metrics: PerfMetrics, formatted: string) => void
  /** Show an on-screen HUD with live metrics (default false) */
  showHud?: boolean
  /** Profiler ID (default "presentation-overlay") */
  id?: string
}

export function PerfProfiler({
  fps = 30,
  onReport,
  showHud = false,
  id = "presentation-overlay",
  children,
}: PropsWithChildren<PerfProfilerProps>) {
  const monitorRef = useRef<PerfMonitor>(createPerfMonitor({ fps }))
  const [hudMetrics, setHudMetrics] = useState<PerfMetrics | null>(null)
  const hudIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Update HUD every 500ms
  useEffect(() => {
    if (!showHud) return
    hudIntervalRef.current = setInterval(() => {
      const metrics = monitorRef.current.getReport()
      setHudMetrics(metrics)
    }, 500)
    return () => {
      if (hudIntervalRef.current) clearInterval(hudIntervalRef.current)
    }
  }, [showHud])

  // Report on unmount
  useEffect(() => {
    return () => {
      const metrics = monitorRef.current.getReport()
      if (metrics.totalFrames > 0 && onReport) {
        onReport(metrics, formatPerfReport(metrics))
      }
    }
  }, [onReport])

  const handleRender = useCallback(
    (
      _id: string,
      phase: "mount" | "update" | "nested-update",
      actualDuration: number,
    ) => {
      // Skip initial mount — it includes one-time setup cost (memo hydration,
      // ref initialization) that doesn't reflect per-frame render performance.
      // Only "update" and "nested-update" represent actual frame-to-frame renders.
      if (phase === "mount") return
      monitorRef.current.recordFrame(actualDuration)
    },
    [],
  )

  return (
    <>
      <Profiler id={id} onRender={handleRender}>
        {children}
      </Profiler>
      {showHud && hudMetrics && <PerfHud metrics={hudMetrics} />}
    </>
  )
}

/** On-screen HUD showing live render metrics */
function PerfHud({ metrics }: { metrics: PerfMetrics }) {
  const frame = useCurrentFrame()
  const dropColor = metrics.dropRate === 0
    ? "#4ADE80"
    : metrics.dropRate < 5
      ? "#FBBF24"
      : "#EF4444"

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        background: "rgba(0, 0, 0, 0.85)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: 8,
        padding: "8px 12px",
        fontFamily: "SFMono-Regular, Consolas, monospace",
        fontSize: 10,
        color: "rgba(255, 255, 255, 0.8)",
        lineHeight: 1.6,
        pointerEvents: "none",
        zIndex: 99999,
        minWidth: 160,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#fff" }}>
        PERF MONITOR
      </div>
      <div>Frame: {frame}</div>
      <div>Renders: {metrics.totalFrames}</div>
      <div style={{ color: dropColor }}>
        Drops: {metrics.droppedFrames} ({metrics.dropRate}%)
      </div>
      <div>Avg: {metrics.avgRenderMs.toFixed(1)}ms</div>
      <div>P95: {metrics.p95RenderMs.toFixed(1)}ms</div>
      <div>P99: {metrics.p99RenderMs.toFixed(1)}ms</div>
      <div>Max: {metrics.maxRenderMs.toFixed(1)}ms</div>
    </div>
  )
}
