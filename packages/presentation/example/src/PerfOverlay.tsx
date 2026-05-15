/**
 * PerfOverlay — A togglable React component showing real-time performance metrics.
 *
 * Activated via URL param: ?perf-overlay=1
 *
 * Displays:
 *   - Render count per tracked component (using ref counter pattern)
 *   - Last render duration for each section
 *   - Memory usage (performance.memory if available, Chrome only)
 *   - FPS estimate
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import type { ReactNode } from "react"
import { trackRender, recordRenderDuration, getPerfOverlayData, resetPerfCounters, runPerfTest } from "./perf-test"

// --------------------------------------------------------------------------
// Hook: useRenderTracker — place inside any component to track its renders
// --------------------------------------------------------------------------

export function useRenderTracker(componentName: string): void {
  const startRef = useRef(performance.now())

  // Record start time at beginning of render
  startRef.current = performance.now()

  // Track render count
  trackRender(componentName)

  // Record duration after commit (via useEffect which fires after paint)
  useEffect(() => {
    const duration = performance.now() - startRef.current
    recordRenderDuration(componentName, duration)
  })
}

// --------------------------------------------------------------------------
// PerfOverlay Component
// --------------------------------------------------------------------------

export function PerfOverlay() {
  const [visible, setVisible] = useState(true)
  const [data, setData] = useState(() => getPerfOverlayData())
  const [fps, setFps] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const lastFrameRef = useRef(performance.now())
  const fpsBufferRef = useRef<number[]>([])
  const rafRef = useRef<number>(0)

  // Check URL param
  const enabled = useMemo(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).has("perf-overlay")
  }, [])

  // FPS tracking loop
  useEffect(() => {
    if (!enabled) return

    const tick = (now: number) => {
      const delta = now - lastFrameRef.current
      lastFrameRef.current = now

      if (delta > 0) {
        const currentFps = Math.min(120, 1000 / delta)
        const buffer = fpsBufferRef.current
        buffer.push(currentFps)
        if (buffer.length > 60) buffer.shift()

        // Update displayed FPS at ~2Hz
        if (buffer.length % 30 === 0) {
          const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length
          setFps(Math.round(avg))
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled])

  // Refresh data at ~2Hz
  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => {
      setData(getPerfOverlayData())
    }, 500)
    return () => clearInterval(interval)
  }, [enabled])

  const handleReset = useCallback(() => {
    resetPerfCounters()
    setData(getPerfOverlayData())
  }, [])

  const handleRunTest = useCallback(async () => {
    const results = await runPerfTest()
    setData((prev) => ({ ...prev, results }))
  }, [])

  if (!enabled || !visible) return null

  const mem = data.memoryUsage
  const fpsColor = fps >= 55 ? "#76B900" : fps >= 30 ? "#F59E0B" : "#EF4444"

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 99999,
        width: minimized ? 120 : 340,
        maxHeight: minimized ? 32 : "80vh",
        overflow: minimized ? "hidden" : "auto",
        borderRadius: 10,
        background: "rgba(8, 10, 22, 0.94)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        color: "#fff",
        fontFamily: "SFMono-Regular, Consolas, 'Liberation Mono', monospace",
        fontSize: 10,
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setMinimized((m) => !m)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: fpsColor, boxShadow: `0 0 4px ${fpsColor}` }} />
          <span style={{ fontWeight: 700, fontSize: 10, color: "rgba(255,255,255,0.8)" }}>
            PERF
          </span>
          <span style={{ fontWeight: 700, color: fpsColor, fontSize: 11 }}>
            {fps} FPS
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setVisible(false) }}
            style={{ width: 14, height: 14, borderRadius: 3, border: "none", background: "rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 9, cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
            title="Close overlay"
          >
            x
          </button>
        </div>
      </div>

      {!minimized && (
        <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Memory */}
          {mem && (
            <Section title="MEMORY">
              <Row label="Used" value={`${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB`} />
              <Row label="Total" value={`${(mem.totalJSHeapSize / 1048576).toFixed(1)} MB`} />
              <Row label="Limit" value={`${(mem.jsHeapSizeLimit / 1048576).toFixed(1)} MB`} />
              <MemoryBar used={mem.usedJSHeapSize} total={mem.jsHeapSizeLimit} />
            </Section>
          )}

          {/* Render counts */}
          <Section title="RENDER COUNTS">
            {data.renderCounts.size === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic", padding: "2px 0" }}>
                No tracked components yet. Use useRenderTracker() in components.
              </div>
            ) : (
              Array.from(data.renderCounts.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <Row
                    key={name}
                    label={name}
                    value={String(count)}
                    valueColor={count > 100 ? "#EF4444" : count > 30 ? "#F59E0B" : "#76B900"}
                  />
                ))
            )}
          </Section>

          {/* Render durations */}
          <Section title="LAST RENDER DURATION">
            {data.lastRenderDurations.size === 0 ? (
              <div style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic", padding: "2px 0" }}>
                No measurements yet.
              </div>
            ) : (
              Array.from(data.lastRenderDurations.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([name, duration]) => (
                  <Row
                    key={name}
                    label={name}
                    value={`${duration.toFixed(2)} ms`}
                    valueColor={duration > 8 ? "#EF4444" : duration > 4 ? "#F59E0B" : "#76B900"}
                  />
                ))
            )}
          </Section>

          {/* Test results */}
          {data.results.length > 0 && (
            <Section title="BENCHMARK RESULTS">
              {data.results.map((r) => (
                <Row
                  key={r.name}
                  label={r.name.slice(0, 30)}
                  value={`${r.avgMs.toFixed(2)}ms (p95: ${r.p95Ms.toFixed(2)}ms)`}
                  valueColor={r.p95Ms > 8 ? "#EF4444" : r.p95Ms > 4 ? "#F59E0B" : "#76B900"}
                />
              ))}
            </Section>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, paddingTop: 4 }}>
            <ActionButton label="Run Benchmark" onClick={handleRunTest} />
            <ActionButton label="Reset Counters" onClick={handleReset} />
          </div>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1px 0" }}>
      <span style={{ color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{label}</span>
      <span style={{ color: valueColor ?? "rgba(255,255,255,0.8)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  )
}

function MemoryBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100)
  const color = pct > 80 ? "#EF4444" : pct > 60 ? "#F59E0B" : "#76B900"

  return (
    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", marginTop: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: color, transition: "width 300ms ease" }} />
    </div>
  )
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "4px 8px",
        borderRadius: 5,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.7)",
        fontSize: 9,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 100ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)" }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
    >
      {label}
    </button>
  )
}
