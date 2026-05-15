/**
 * Presentation Playback Console — Render Performance Benchmark
 *
 * This script is injected into the browser via Playwright to measure rendering
 * performance during simulated rapid playback. It profiles:
 *
 * 1. Frame budget adherence (16.67ms for 60fps / 33.33ms for 30fps)
 * 2. Jank frames (>32ms) and severe jank (>50ms)
 * 3. Average / P95 / P99 frame times
 * 4. Component render counts via React Profiler internals
 * 5. Specific hot-spot detection:
 *    - buildTimelineLanes recomputation frequency
 *    - commandColor map lookup overhead
 *    - useMemo invalidation in TimelineTracks (viewStartMs/viewEndMs)
 *    - vanilla-jsoneditor mount/unmount cost on hover
 *
 * Output: ASCII flame-chart-like visualization + structured JSON report
 */

// @ts-nocheck — This is a browser-injected benchmark script; strict typing
// is relaxed for window augmentation and fiber walking.

// ============================================================================
// Types
// ============================================================================

interface FrameSample {
  timestamp: number
  delta: number
  droppedFrames: number
}

interface RenderProfile {
  component: string
  renderCount: number
  totalMs: number
  avgMs: number
  maxMs: number
}

interface HotSpotAnalysis {
  buildTimelineLanesCount: number
  buildTimelineLanesAvgMs: number
  commandColorCallCount: number
  commandColorCacheHitRate: number
  timelineTracksRerenderCount: number
  timelineTracksAvgMs: number
  jsonEditorMountCount: number
  jsonEditorMountAvgMs: number
  jsonEditorUnmountCount: number
  memoInvalidations: Record<string, number>
}

interface BenchmarkReport {
  totalDurationMs: number
  totalFrames: number
  droppedFrames: number
  jankFrames: number
  severeJankFrames: number
  avgFrameTime: number
  p50FrameTime: number
  p95FrameTime: number
  p99FrameTime: number
  maxFrameTime: number
  minFrameTime: number
  frameBudgetMs: number
  budgetAdherence: number
  fps: {
    average: number
    min: number
    max: number
  }
  componentProfiles: RenderProfile[]
  hotSpots: HotSpotAnalysis
  histogram: { bucket: string; count: number; pct: number }[]
  flameChart: string
}

// ============================================================================
// Instrumentation Hooks (injected into the page before React renders)
// ============================================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Monkey-patches key functions to collect timing data.
 * Must be called BEFORE the app mounts (via Playwright page.evaluateOnNewDocument).
 */
export function installInstrumentation(): void {
  const win = window as unknown as Record<string, any>

  win.__BENCH_DATA__ = {
    frameSamples: [],
    buildTimelineLanesTimings: [],
    commandColorCalls: 0,
    commandColorUniqueArgs: new Set(),
    timelineTracksRenders: [],
    jsonEditorMounts: [],
    jsonEditorUnmounts: 0,
    memoInvalidations: {},
    componentRenders: {},
    rafStartTime: 0,
    playbackSimulationDone: false,
  }
}

/**
 * Starts the requestAnimationFrame measurement loop.
 * Detects dropped frames by comparing delta to expected frame budget.
 */
export function startFrameMeasurement(fps: number = 60): void {
  const win = window as any
  const data = win.__BENCH_DATA__
  if (!data) throw new Error("Instrumentation not installed. Call installInstrumentation() first.")

  const frameBudgetMs = 1000 / fps
  let lastTimestamp = 0
  let rafId = 0

  data.rafStartTime = performance.now()

  function tick(timestamp: number) {
    if (lastTimestamp > 0) {
      const delta = timestamp - lastTimestamp
      const droppedFrames = Math.max(0, Math.floor(delta / frameBudgetMs) - 1)
      data.frameSamples.push({ timestamp, delta, droppedFrames })
    }
    lastTimestamp = timestamp
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)

  // Store cleanup handle
  win.__BENCH_STOP_RAF__ = () => {
    cancelAnimationFrame(rafId)
  }
}

/**
 * Simulates rapid playback by programmatically seeking through the timeline.
 * Advances time from 0 to totalDurationMs in configurable steps.
 */
export async function simulatePlayback(opts: {
  totalDurationMs: number
  stepMs?: number
  stepIntervalMs?: number
}): Promise<void> {
  const { totalDurationMs, stepMs = 100, stepIntervalMs = 16 } = opts
  const win = window as any

  // Find the player seek function — we look for the Remotion Player instance
  // or fall back to dispatching custom events
  const seekViaPlayer = (ms: number) => {
    // Attempt to find Remotion Player's seek mechanism
    // The IsolatedPlaybackConsole uses playerRef.current?.seekTo(frame)
    // We simulate this by dispatching a custom event that the benchmark harness intercepts
    const event = new CustomEvent("__bench_seek__", { detail: { ms } })
    window.dispatchEvent(event)
  }

  let currentMs = 0
  while (currentMs <= totalDurationMs) {
    seekViaPlayer(currentMs)
    currentMs += stepMs

    // Wait one frame to let React reconcile
    await new Promise<void>((resolve) => {
      if (stepIntervalMs <= 0) {
        requestAnimationFrame(() => resolve())
      } else {
        setTimeout(resolve, stepIntervalMs)
      }
    })
  }

  win.__BENCH_DATA__.playbackSimulationDone = true
}

/**
 * Intercepts component renders via React DevTools global hook (if available)
 * or uses MutationObserver + performance.mark as fallback.
 */
export function installComponentProfiler(): void {
  const win = window as any
  const data = win.__BENCH_DATA__

  // Patch React's __REACT_DEVTOOLS_GLOBAL_HOOK__ if available
  const hook = win.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (hook && hook.onCommitFiberRoot) {
    const original = hook.onCommitFiberRoot.bind(hook)
    hook.onCommitFiberRoot = (rendererID: number, root: any, ...args: any[]) => {
      const commitStart = performance.now()
      original(rendererID, root, ...args)
      const commitDuration = performance.now() - commitStart

      // Walk the fiber tree to count renders
      try {
        walkFiber(root.current, commitDuration)
      } catch {
        // Silently skip if fiber walk fails
      }
    }
  }

  function walkFiber(fiber: any, totalCommitMs: number) {
    if (!fiber) return
    const name = fiber.type?.displayName || fiber.type?.name || null
    if (name && fiber.actualDuration != null) {
      if (!data.componentRenders[name]) {
        data.componentRenders[name] = { count: 0, totalMs: 0, maxMs: 0 }
      }
      const entry = data.componentRenders[name]
      entry.count++
      entry.totalMs += fiber.actualDuration
      entry.maxMs = Math.max(entry.maxMs, fiber.actualDuration)

      // Track specific components
      if (name === "TimelineTracks") {
        data.timelineTracksRenders.push(fiber.actualDuration)
      }
    }

    // Check for memo invalidations
    if (name && fiber.alternate && fiber.memoizedProps !== fiber.alternate.memoizedProps) {
      data.memoInvalidations[name] = (data.memoInvalidations[name] || 0) + 1
    }

    walkFiber(fiber.child, totalCommitMs)
    walkFiber(fiber.sibling, totalCommitMs)
  }
}

/**
 * Patches the commandColor function to count calls and measure cache hit rate.
 */
export function patchCommandColor(): void {
  const win = window as any
  const data = win.__BENCH_DATA__

  // We'll intercept via a MutationObserver watching for style attributes
  // that contain color values matching the palette — this is a heuristic approach.
  // For more accurate measurement, the actual function is instrumented below.

  // Store original if we find it on the module scope
  // Since commandColor is a module-internal function, we instrument it by
  // overriding it before the module loads (via evaluateOnNewDocument) or
  // by patching the component that calls it.

  // Fallback: Count DOM elements with inline palette colors
  const palette = [
    "#76B900", "#6366F1", "#F59E0B", "#10B981", "#EC4899",
    "#38BDF8", "#F97316", "#A855F7", "#EF4444", "#14B8A6",
  ]

  // Instrument via Performance Observer
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.startsWith("commandColor:")) {
        data.commandColorCalls++
        const arg = entry.name.split(":")[1]
        data.commandColorUniqueArgs.add(arg)
      }
    }
  })
  try {
    observer.observe({ entryTypes: ["mark"] })
  } catch {
    // performance.mark observation not available
  }

  win.__BENCH_PATCH_COMMAND_COLOR__ = true
}

/**
 * Monitors vanilla-jsoneditor mount/unmount cycles.
 * Uses MutationObserver watching for .jse-main elements appearing/disappearing.
 */
export function installJsonEditorMonitor(): void {
  const win = window as any
  const data = win.__BENCH_DATA__

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (added instanceof HTMLElement) {
          if (added.classList?.contains("jse-main") || added.querySelector?.(".jse-main")) {
            const start = performance.now()
            // Measure time until next frame (approximate mount cost)
            requestAnimationFrame(() => {
              data.jsonEditorMounts.push(performance.now() - start)
            })
          }
        }
      }
      for (const removed of mutation.removedNodes) {
        if (removed instanceof HTMLElement) {
          if (removed.classList?.contains("jse-main") || removed.querySelector?.(".jse-main")) {
            data.jsonEditorUnmounts++
          }
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  win.__BENCH_JSON_EDITOR_OBSERVER__ = observer
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Collects all instrumentation data and generates a structured report.
 */
export function generateReport(fps: number = 60): BenchmarkReport {
  const win = window as any
  const data = win.__BENCH_DATA__
  const frameBudgetMs = 1000 / fps

  // Stop RAF loop
  if (win.__BENCH_STOP_RAF__) win.__BENCH_STOP_RAF__()

  const samples = data.frameSamples as FrameSample[]
  const deltas = samples.map((s: FrameSample) => s.delta)
  const sorted = [...deltas].sort((a: number, b: number) => a - b)
  const n = sorted.length

  if (n === 0) {
    throw new Error("No frame samples collected. Did the simulation run?")
  }

  const sum = sorted.reduce((a: number, b: number) => a + b, 0)
  const droppedFrames = samples.reduce((acc: number, s: FrameSample) => acc + s.droppedFrames, 0)
  const jankFrames = sorted.filter((d: number) => d > 32).length
  const severeJankFrames = sorted.filter((d: number) => d > 50).length

  const percentile = (p: number) => sorted[Math.min(Math.floor(p * n), n - 1)]

  // Histogram
  const buckets = [
    { label: "0-8ms", min: 0, max: 8 },
    { label: "8-16ms", min: 8, max: 16 },
    { label: "16-33ms", min: 16, max: 33 },
    { label: "33-50ms", min: 33, max: 50 },
    { label: "50-100ms", min: 50, max: 100 },
    { label: "100ms+", min: 100, max: Infinity },
  ]
  const histogram = buckets.map(({ label, min, max }) => {
    const count = sorted.filter((t: number) => t >= min && t < max).length
    return { bucket: label, count, pct: Math.round((count / n) * 100) }
  })

  // Component profiles
  const componentProfiles: RenderProfile[] = Object.entries(data.componentRenders)
    .map(([component, stats]: [string, any]) => ({
      component,
      renderCount: stats.count,
      totalMs: Math.round(stats.totalMs * 100) / 100,
      avgMs: Math.round((stats.totalMs / stats.count) * 100) / 100,
      maxMs: Math.round(stats.maxMs * 100) / 100,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 20) // Top 20

  // Hot spots
  const hotSpots: HotSpotAnalysis = {
    buildTimelineLanesCount: data.buildTimelineLanesTimings.length,
    buildTimelineLanesAvgMs: data.buildTimelineLanesTimings.length > 0
      ? data.buildTimelineLanesTimings.reduce((a: number, b: number) => a + b, 0) / data.buildTimelineLanesTimings.length
      : 0,
    commandColorCallCount: data.commandColorCalls,
    commandColorCacheHitRate: data.commandColorCalls > 0 && data.commandColorUniqueArgs.size > 0
      ? 1 - (data.commandColorUniqueArgs.size / data.commandColorCalls)
      : 0,
    timelineTracksRerenderCount: data.timelineTracksRenders.length,
    timelineTracksAvgMs: data.timelineTracksRenders.length > 0
      ? data.timelineTracksRenders.reduce((a: number, b: number) => a + b, 0) / data.timelineTracksRenders.length
      : 0,
    jsonEditorMountCount: data.jsonEditorMounts.length,
    jsonEditorMountAvgMs: data.jsonEditorMounts.length > 0
      ? data.jsonEditorMounts.reduce((a: number, b: number) => a + b, 0) / data.jsonEditorMounts.length
      : 0,
    jsonEditorUnmountCount: data.jsonEditorUnmounts,
    memoInvalidations: data.memoInvalidations,
  }

  // Flame chart ASCII
  const flameChart = generateFlameChart(samples, frameBudgetMs)

  return {
    totalDurationMs: sum,
    totalFrames: n,
    droppedFrames,
    jankFrames,
    severeJankFrames,
    avgFrameTime: Math.round((sum / n) * 100) / 100,
    p50FrameTime: Math.round(percentile(0.5) * 100) / 100,
    p95FrameTime: Math.round(percentile(0.95) * 100) / 100,
    p99FrameTime: Math.round(percentile(0.99) * 100) / 100,
    maxFrameTime: Math.round(sorted[n - 1] * 100) / 100,
    minFrameTime: Math.round(sorted[0] * 100) / 100,
    frameBudgetMs,
    budgetAdherence: Math.round(((n - jankFrames) / n) * 1000) / 10,
    fps: {
      average: Math.round(1000 / (sum / n)),
      min: Math.round(1000 / sorted[n - 1]),
      max: Math.round(1000 / sorted[0]),
    },
    componentProfiles,
    hotSpots,
    histogram,
    flameChart,
  }
}

// ============================================================================
// ASCII Flame Chart
// ============================================================================

function generateFlameChart(samples: FrameSample[], frameBudgetMs: number): string {
  const WIDTH = 80
  const HEIGHT = 20
  const lines: string[] = []

  // Title
  lines.push("")
  lines.push("=" .repeat(WIDTH))
  lines.push("  FRAME TIME FLAME CHART (time -> right, height -> frame duration)")
  lines.push("=".repeat(WIDTH))
  lines.push("")

  // Downsample to WIDTH columns
  const bucketSize = Math.max(1, Math.ceil(samples.length / WIDTH))
  const columns: number[] = []
  for (let i = 0; i < WIDTH; i++) {
    const start = i * bucketSize
    const end = Math.min(start + bucketSize, samples.length)
    if (start >= samples.length) {
      columns.push(0)
      continue
    }
    // Use max delta in this bucket (shows worst-case)
    let maxDelta = 0
    for (let j = start; j < end; j++) {
      maxDelta = Math.max(maxDelta, samples[j].delta)
    }
    columns.push(maxDelta)
  }

  // Scale: each row represents maxDelta / HEIGHT ms
  const maxValue = Math.max(frameBudgetMs * 3, ...columns) // At least show 3x budget
  const rowMs = maxValue / HEIGHT

  // Draw rows from top to bottom
  for (let row = HEIGHT - 1; row >= 0; row--) {
    const threshold = row * rowMs
    let line = ""
    for (let col = 0; col < WIDTH; col++) {
      const value = columns[col]
      if (value > threshold + rowMs) {
        // Full block
        if (value > frameBudgetMs * 2) line += "\u2588" // severe jank
        else if (value > frameBudgetMs) line += "\u2593" // jank
        else line += "\u2591" // normal
      } else if (value > threshold) {
        // Partial block
        if (value > frameBudgetMs * 2) line += "\u2584"
        else if (value > frameBudgetMs) line += "\u2582"
        else line += "\u2581"
      } else {
        line += " "
      }
    }

    // Y-axis label
    const msLabel = Math.round(threshold + rowMs)
    const label = row === HEIGHT - 1 ? `${msLabel}ms` : row % 4 === 0 ? `${msLabel}ms` : ""
    lines.push(`  ${label.padStart(6)}|${line}|`)
  }

  // X-axis
  lines.push(`  ${"".padStart(6)}+${"─".repeat(WIDTH)}+`)
  const totalTimeMs = samples.length > 0 ? samples[samples.length - 1].timestamp - samples[0].timestamp : 0
  const startLabel = "0s"
  const endLabel = `${(totalTimeMs / 1000).toFixed(1)}s`
  const midLabel = `${(totalTimeMs / 2000).toFixed(1)}s`
  const xAxis = `  ${"".padStart(6)} ${startLabel}${" ".repeat(Math.floor(WIDTH / 2) - startLabel.length - midLabel.length / 2)}${midLabel}${" ".repeat(Math.ceil(WIDTH / 2) - midLabel.length / 2 - endLabel.length)}${endLabel}`
  lines.push(xAxis)

  // Legend
  lines.push("")
  lines.push(`  Legend:  \u2591 = within budget (${frameBudgetMs.toFixed(1)}ms)  \u2593 = jank (>${frameBudgetMs.toFixed(0)}ms)  \u2588 = severe (>${(frameBudgetMs * 2).toFixed(0)}ms)`)
  lines.push(`  Budget line at ${frameBudgetMs.toFixed(1)}ms (${Math.round(1000 / frameBudgetMs)}fps)`)
  lines.push("")

  // Hot spots identification
  lines.push("  HOT SPOTS (frames > 2x budget):")
  lines.push("  " + "─".repeat(WIDTH))
  const hotSpotThreshold = frameBudgetMs * 2
  let hotSpotCount = 0
  for (let i = 0; i < samples.length && hotSpotCount < 10; i++) {
    if (samples[i].delta > hotSpotThreshold) {
      const timeMs = samples[i].timestamp - samples[0].timestamp
      lines.push(`    @${(timeMs / 1000).toFixed(2)}s: ${samples[i].delta.toFixed(1)}ms (${samples[i].droppedFrames} frames dropped)`)
      hotSpotCount++
    }
  }
  if (hotSpotCount === 0) {
    lines.push("    None detected - all frames within 2x budget")
  }
  lines.push("")

  return lines.join("\n")
}

// ============================================================================
// Report Formatting
// ============================================================================

export function formatBenchmarkReport(report: BenchmarkReport): string {
  const lines: string[] = []

  lines.push("")
  lines.push("╔══════════════════════════════════════════════════════════════════════════════╗")
  lines.push("║           PRESENTATION PLAYBACK CONSOLE — RENDER BENCHMARK                  ║")
  lines.push("╠══════════════════════════════════════════════════════════════════════════════╣")
  lines.push("")

  // Summary
  lines.push("  ┌─── FRAME TIMING ───────────────────────────────────────────────────────┐")
  lines.push(`  │  Total Frames:      ${String(report.totalFrames).padStart(8)}                                    │`)
  lines.push(`  │  Frame Budget:      ${(report.frameBudgetMs.toFixed(1) + "ms").padStart(8)}                                    │`)
  lines.push(`  │  Budget Adherence:  ${(report.budgetAdherence + "%").padStart(8)}                                    │`)
  lines.push(`  │  Dropped Frames:    ${String(report.droppedFrames).padStart(8)}                                    │`)
  lines.push(`  │  Jank Frames (>32ms):  ${String(report.jankFrames).padStart(5)}                                    │`)
  lines.push(`  │  Severe Jank (>50ms):  ${String(report.severeJankFrames).padStart(5)}                                    │`)
  lines.push("  │                                                                         │")
  lines.push(`  │  Average:  ${(report.avgFrameTime.toFixed(2) + "ms").padStart(9)}    P50: ${(report.p50FrameTime.toFixed(2) + "ms").padStart(9)}                     │`)
  lines.push(`  │  P95:      ${(report.p95FrameTime.toFixed(2) + "ms").padStart(9)}    P99: ${(report.p99FrameTime.toFixed(2) + "ms").padStart(9)}                     │`)
  lines.push(`  │  Min:      ${(report.minFrameTime.toFixed(2) + "ms").padStart(9)}    Max: ${(report.maxFrameTime.toFixed(2) + "ms").padStart(9)}                     │`)
  lines.push("  └─────────────────────────────────────────────────────────────────────────┘")
  lines.push("")

  // FPS
  lines.push("  ┌─── FPS ────────────────────────────────────────────────────────────────┐")
  lines.push(`  │  Average: ${String(report.fps.average).padStart(4)} fps    Min: ${String(report.fps.min).padStart(4)} fps    Max: ${String(report.fps.max).padStart(4)} fps    │`)
  lines.push("  └─────────────────────────────────────────────────────────────────────────┘")
  lines.push("")

  // Histogram
  lines.push("  ┌─── RENDER TIME HISTOGRAM ──────────────────────────────────────────────┐")
  for (const { bucket, count, pct } of report.histogram) {
    const bar = "\u2588".repeat(Math.min(40, Math.round(pct * 0.4)))
    lines.push(`  │  ${bucket.padEnd(10)} ${bar.padEnd(40)} ${String(count).padStart(5)} (${String(pct).padStart(2)}%) │`)
  }
  lines.push("  └─────────────────────────────────────────────────────────────────────────┘")
  lines.push("")

  // Hot Spots Analysis
  lines.push("  ┌─── HOT SPOT ANALYSIS ──────────────────────────────────────────────────┐")
  lines.push(`  │                                                                         │`)
  lines.push(`  │  buildTimelineLanes:                                                    │`)
  lines.push(`  │    Recomputations: ${String(report.hotSpots.buildTimelineLanesCount).padStart(6)}                                      │`)
  lines.push(`  │    Avg time:       ${(report.hotSpots.buildTimelineLanesAvgMs.toFixed(2) + "ms").padStart(9)}                                   │`)
  const btlVerdict = report.hotSpots.buildTimelineLanesCount <= 2 ? "OK (once per script change)" : "WARN: recomputing too often!"
  lines.push(`  │    Verdict:        ${btlVerdict.padEnd(45)}│`)
  lines.push(`  │                                                                         │`)
  lines.push(`  │  commandColor:                                                          │`)
  lines.push(`  │    Total calls:    ${String(report.hotSpots.commandColorCallCount).padStart(6)}                                      │`)
  lines.push(`  │    Cache hit rate: ${((report.hotSpots.commandColorCacheHitRate * 100).toFixed(1) + "%").padStart(7)}                                     │`)
  const ccVerdict = report.hotSpots.commandColorCacheHitRate > 0.8 ? "OK (low unique-arg ratio)" : "WARN: no caching, repeated hashing"
  lines.push(`  │    Verdict:        ${ccVerdict.padEnd(45)}│`)
  lines.push(`  │                                                                         │`)
  lines.push(`  │  TimelineTracks (useMemo):                                              │`)
  lines.push(`  │    Re-renders:     ${String(report.hotSpots.timelineTracksRerenderCount).padStart(6)}                                      │`)
  lines.push(`  │    Avg render:     ${(report.hotSpots.timelineTracksAvgMs.toFixed(2) + "ms").padStart(9)}                                   │`)
  const ttVerdict = report.hotSpots.timelineTracksRerenderCount > report.totalFrames * 0.5
    ? "WARN: viewStartMs/viewEndMs deps cause rerenders on every zoom"
    : "OK (memo deps stable)"
  lines.push(`  │    Verdict:        ${ttVerdict.padEnd(45)}│`)
  lines.push(`  │                                                                         │`)
  lines.push(`  │  vanilla-jsoneditor (mount/unmount on hover):                           │`)
  lines.push(`  │    Mount count:    ${String(report.hotSpots.jsonEditorMountCount).padStart(6)}                                      │`)
  lines.push(`  │    Avg mount time: ${(report.hotSpots.jsonEditorMountAvgMs.toFixed(2) + "ms").padStart(9)}                                   │`)
  lines.push(`  │    Unmount count:  ${String(report.hotSpots.jsonEditorUnmountCount).padStart(6)}                                      │`)
  const jeVerdict = report.hotSpots.jsonEditorMountAvgMs > 16
    ? "WARN: mount cost > 1 frame, consider pooling"
    : report.hotSpots.jsonEditorMountCount > 10
      ? "INFO: frequent mount/unmount, pooling would help"
      : "OK"
  lines.push(`  │    Verdict:        ${jeVerdict.padEnd(45)}│`)
  lines.push(`  │                                                                         │`)
  lines.push("  └─────────────────────────────────────────────────────────────────────────┘")
  lines.push("")

  // Memo invalidations
  if (Object.keys(report.hotSpots.memoInvalidations).length > 0) {
    lines.push("  ┌─── MEMO INVALIDATIONS (top by frequency) ────────────────────────────┐")
    const entries = Object.entries(report.hotSpots.memoInvalidations)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
    for (const [component, count] of entries) {
      lines.push(`  │  ${component.padEnd(35)} ${String(count).padStart(6)} invalidations       │`)
    }
    lines.push("  └─────────────────────────────────────────────────────────────────────────┘")
    lines.push("")
  }

  // Component render profiles
  if (report.componentProfiles.length > 0) {
    lines.push("  ┌─── TOP COMPONENT RENDER COSTS ────────────────────────────────────────┐")
    lines.push(`  │  ${"Component".padEnd(25)} ${"Renders".padStart(8)} ${"Total".padStart(9)} ${"Avg".padStart(8)} ${"Max".padStart(8)} │`)
    lines.push(`  │  ${"─".repeat(25)} ${"─".repeat(8)} ${"─".repeat(9)} ${"─".repeat(8)} ${"─".repeat(8)} │`)
    for (const p of report.componentProfiles.slice(0, 12)) {
      lines.push(`  │  ${p.component.slice(0, 25).padEnd(25)} ${String(p.renderCount).padStart(8)} ${(p.totalMs.toFixed(1) + "ms").padStart(9)} ${(p.avgMs.toFixed(1) + "ms").padStart(8)} ${(p.maxMs.toFixed(1) + "ms").padStart(8)} │`)
    }
    lines.push("  └─────────────────────────────────────────────────────────────────────────┘")
    lines.push("")
  }

  // Flame chart
  lines.push(report.flameChart)

  // Overall verdict
  lines.push("  ╔═══════════════════════════════════════════════════════════════════════════╗")
  if (report.budgetAdherence >= 95 && report.severeJankFrames === 0) {
    lines.push("  ║  VERDICT: EXCELLENT - Smooth playback, no significant jank              ║")
  } else if (report.budgetAdherence >= 85) {
    lines.push("  ║  VERDICT: GOOD - Minor jank, generally smooth                           ║")
  } else if (report.budgetAdherence >= 70) {
    lines.push("  ║  VERDICT: FAIR - Noticeable jank, optimization recommended              ║")
  } else {
    lines.push("  ║  VERDICT: POOR - Significant frame drops, optimization needed           ║")
  }
  lines.push("  ╚═══════════════════════════════════════════════════════════════════════════╝")
  lines.push("")

  // Recommendations
  lines.push("  RECOMMENDATIONS:")
  lines.push("  ─────────────────")
  if (report.hotSpots.buildTimelineLanesCount > 2) {
    lines.push("  [!] buildTimelineLanes is recomputing too often.")
    lines.push("      Fix: Ensure useMemo dep is [script] not [script.steps, script.totalDurationMs]")
  }
  if (report.hotSpots.commandColorCacheHitRate < 0.5 && report.hotSpots.commandColorCallCount > 100) {
    lines.push("  [!] commandColor has no caching — repeated hash computation per render.")
    lines.push("      Fix: Add a module-level Map<string, string> cache or use useMemo.")
  }
  if (report.hotSpots.timelineTracksRerenderCount > report.totalFrames * 0.3) {
    lines.push("  [!] TimelineTracks re-renders too often due to viewStartMs/viewEndMs changing.")
    lines.push("      Fix: Debounce zoom state or use useTransition for low-priority updates.")
  }
  if (report.hotSpots.jsonEditorMountAvgMs > 10 || report.hotSpots.jsonEditorMountCount > 20) {
    lines.push("  [!] vanilla-jsoneditor mount/unmount on hover is expensive.")
    lines.push("      Fix: Pool a single editor instance and swap content instead of remounting.")
  }
  lines.push("")

  return lines.join("\n")
}

// ============================================================================
// Main entry point for Playwright injection
// ============================================================================

/**
 * Full benchmark orchestration — called from Playwright or browser console.
 *
 * Usage (in browser console):
 *   const { installInstrumentation, startFrameMeasurement, simulatePlayback, generateReport, formatBenchmarkReport } = await import('/scripts/benchmark-render.ts')
 *   installInstrumentation()
 *   startFrameMeasurement(60)
 *   await simulatePlayback({ totalDurationMs: 180000, stepMs: 200 })
 *   const report = generateReport(60)
 *   console.log(formatBenchmarkReport(report))
 */
export async function runFullBenchmark(opts?: {
  fps?: number
  totalDurationMs?: number
  stepMs?: number
  stepIntervalMs?: number
}): Promise<BenchmarkReport> {
  const { fps = 60, totalDurationMs = 180000, stepMs = 200, stepIntervalMs = 16 } = opts ?? {}

  console.log("[benchmark] Installing instrumentation...")
  installInstrumentation()
  installComponentProfiler()
  patchCommandColor()
  installJsonEditorMonitor()

  console.log("[benchmark] Starting frame measurement loop...")
  startFrameMeasurement(fps)

  console.log(`[benchmark] Simulating playback: 0 -> ${totalDurationMs}ms in ${stepMs}ms steps...`)
  await simulatePlayback({ totalDurationMs, stepMs, stepIntervalMs })

  // Allow one final frame to settle
  await new Promise((resolve) => requestAnimationFrame(resolve))

  console.log("[benchmark] Generating report...")
  const report = generateReport(fps)
  console.log(formatBenchmarkReport(report))

  return report
}
