/**
 * Render Performance Monitor for Remotion Player.
 *
 * Tracks per-frame render timing using React Profiler API and
 * reports aggregated metrics (avg/p95/p99 render time, dropped frames).
 *
 * Usage:
 *   const monitor = createPerfMonitor({ fps: 30 })
 *   // In React Profiler onRender callback:
 *   monitor.recordFrame(actualDuration)
 *   // After playback:
 *   const report = monitor.getReport()
 */

export interface PerfMetrics {
  /** Total frames rendered */
  totalFrames: number
  /** Frames that exceeded the budget (1000/fps ms) */
  droppedFrames: number
  /** Drop rate percentage */
  dropRate: number
  /** Average render time in ms */
  avgRenderMs: number
  /** P50 render time in ms */
  p50RenderMs: number
  /** P95 render time in ms */
  p95RenderMs: number
  /** P99 render time in ms */
  p99RenderMs: number
  /** Max render time in ms */
  maxRenderMs: number
  /** Min render time in ms */
  minRenderMs: number
  /** Frame budget in ms (1000/fps) */
  frameBudgetMs: number
  /** Render times histogram (bucketed) */
  histogram: { bucket: string; count: number; pct: number }[]
}

export interface PerfMonitor {
  /** Record a single frame's render duration (actualDuration from React Profiler) */
  recordFrame(renderMs: number): void
  /** Reset all data */
  reset(): void
  /** Get aggregated metrics */
  getReport(): PerfMetrics
  /** Get raw render times array */
  getRawData(): readonly number[]
}

export function createPerfMonitor(opts: { fps: number }): PerfMonitor {
  const frameBudgetMs = 1000 / opts.fps
  let renderTimes: number[] = []

  function recordFrame(renderMs: number) {
    renderTimes.push(renderMs)
  }

  function reset() {
    renderTimes = []
  }

  function getReport(): PerfMetrics {
    const n = renderTimes.length
    if (n === 0) {
      return {
        totalFrames: 0,
        droppedFrames: 0,
        dropRate: 0,
        avgRenderMs: 0,
        p50RenderMs: 0,
        p95RenderMs: 0,
        p99RenderMs: 0,
        maxRenderMs: 0,
        minRenderMs: 0,
        frameBudgetMs,
        histogram: [],
      }
    }

    const sorted = [...renderTimes].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)
    const droppedFrames = sorted.filter((t) => t > frameBudgetMs).length

    // Percentiles
    const percentile = (p: number) => sorted[Math.min(Math.floor(p * n), n - 1)]

    // Histogram buckets
    const buckets = [
      { label: "0-8ms", max: 8 },
      { label: "8-16ms", max: 16 },
      { label: "16-33ms", max: 33 },
      { label: "33-50ms", max: 50 },
      { label: "50-100ms", max: 100 },
      { label: "100ms+", max: Infinity },
    ]
    const histogram = buckets.map(({ label, max }, i) => {
      const min = i === 0 ? 0 : buckets[i - 1].max
      const count = sorted.filter((t) => t >= min && t < max).length
      return { bucket: label, count, pct: Math.round((count / n) * 100) }
    })

    return {
      totalFrames: n,
      droppedFrames,
      dropRate: Math.round((droppedFrames / n) * 1000) / 10,
      avgRenderMs: Math.round((sum / n) * 100) / 100,
      p50RenderMs: Math.round(percentile(0.5) * 100) / 100,
      p95RenderMs: Math.round(percentile(0.95) * 100) / 100,
      p99RenderMs: Math.round(percentile(0.99) * 100) / 100,
      maxRenderMs: Math.round(sorted[n - 1] * 100) / 100,
      minRenderMs: Math.round(sorted[0] * 100) / 100,
      frameBudgetMs,
      histogram,
    }
  }

  return {
    recordFrame,
    reset,
    getReport,
    getRawData: () => renderTimes,
  }
}

/**
 * Format a PerfMetrics report as a readable string for console/file output.
 */
export function formatPerfReport(metrics: PerfMetrics): string {
  const lines: string[] = []
  lines.push("╔══════════════════════════════════════════════════╗")
  lines.push("║        Remotion Render Performance Report        ║")
  lines.push("╠══════════════════════════════════════════════════╣")
  lines.push(`║  Total Frames:    ${String(metrics.totalFrames).padStart(8)}                   ║`)
  lines.push(`║  Frame Budget:    ${String(metrics.frameBudgetMs.toFixed(1) + "ms").padStart(8)}                   ║`)
  lines.push(`║  Dropped Frames:  ${String(metrics.droppedFrames).padStart(8)} (${metrics.dropRate}%)             ║`)
  lines.push("╠══════════════════════════════════════════════════╣")
  lines.push(`║  Avg Render:      ${String(metrics.avgRenderMs.toFixed(2) + "ms").padStart(10)}                 ║`)
  lines.push(`║  P50 Render:      ${String(metrics.p50RenderMs.toFixed(2) + "ms").padStart(10)}                 ║`)
  lines.push(`║  P95 Render:      ${String(metrics.p95RenderMs.toFixed(2) + "ms").padStart(10)}                 ║`)
  lines.push(`║  P99 Render:      ${String(metrics.p99RenderMs.toFixed(2) + "ms").padStart(10)}                 ║`)
  lines.push(`║  Max Render:      ${String(metrics.maxRenderMs.toFixed(2) + "ms").padStart(10)}                 ║`)
  lines.push(`║  Min Render:      ${String(metrics.minRenderMs.toFixed(2) + "ms").padStart(10)}                 ║`)
  lines.push("╠══════════════════════════════════════════════════╣")
  lines.push("║  Histogram:                                      ║")
  for (const { bucket, count, pct } of metrics.histogram) {
    const bar = "█".repeat(Math.min(20, Math.round(pct / 5)))
    lines.push(`║    ${bucket.padEnd(10)} ${bar.padEnd(20)} ${String(count).padStart(4)} (${String(pct).padStart(2)}%) ║`)
  }
  lines.push("╚══════════════════════════════════════════════════╝")

  // Verdict
  if (metrics.dropRate === 0) {
    lines.push("\n✅ EXCELLENT: Zero frame drops!")
  } else if (metrics.dropRate < 5) {
    lines.push(`\n⚠️  GOOD: ${metrics.dropRate}% drop rate (minor jank)`)
  } else if (metrics.dropRate < 15) {
    lines.push(`\n⚠️  FAIR: ${metrics.dropRate}% drop rate (noticeable jank)`)
  } else {
    lines.push(`\n❌ POOR: ${metrics.dropRate}% drop rate (severe jank)`)
  }

  return lines.join("\n")
}
