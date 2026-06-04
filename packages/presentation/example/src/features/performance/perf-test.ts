/**
 * Performance Test & Overlay for PresentationPlaybackConsole
 *
 * Usage:
 *   - Import and call `window.__runPerfTest()` from the browser console
 *   - Add `?perf-overlay=1` to the URL to show a persistent PerfOverlay component
 *
 * ==========================================================================
 * PERFORMANCE ANALYSIS — BOTTLENECKS IDENTIFIED
 * ==========================================================================
 *
 * 1. injectConsoleStyles() — ~150 CSS rules in a single <style> block
 *    Impact: LOW on repeated renders (guarded by _stylesInjected flag, injected only once)
 *    Issue: The style string is ~4KB of CSS. On first call, the browser must parse all rules.
 *    However, since it runs once and is guarded, runtime cost is negligible.
 *    The REAL concern: multiple CSS animations (pbc-active-pulse, pbc-clock-pulse,
 *    pbc-clock-hand, pbc-card-enter, pbc-diff-flash, pbc-waiting-pulse) run
 *    continuously and trigger compositor layer promotion. Each animated element gets
 *    its own composite layer = GPU memory pressure.
 *    Recommendation: Use `will-change: transform` only on active items, not idle ones.
 *    The `animation: pbc-active-pulse 1.8s ease-in-out infinite` on timeline items
 *    causes continuous paint if box-shadow is animated (box-shadow is NOT compositor-only).
 *
 * 2. TimelineTracks re-renders on every currentMs change (~10fps throttled)
 *    Impact: MEDIUM-HIGH — the main bottleneck.
 *    The IsolatedPlaybackConsole throttles setCurrentMs to ~100ms (10fps).
 *    Each update cascades: PresentationPlaybackConsole -> TimelineTracks.
 *    Inside TimelineTracks, the playhead position recalculates as a CSS `calc()`.
 *    The hover indicator (hoverX, hoverTimeMs state) also updates on mousemove.
 *    Worse: `handleTrackMouseMove` calls `setHoverTimeMs` + `setHoverX` = 2 state
 *    updates per mouse event (batched in React 18+ but still triggers re-render).
 *    TimelineLaneRow uses `useMemo` for visibleItems — good. But the parent
 *    still passes new `currentMs` causing each lane to re-render to update `isActive`.
 *    Recommendation: Separate playhead into its own component with `currentMs` prop;
 *    use `React.memo` on lane rows with `currentMs` excluded from comparison (only
 *    isActive state matters, not the exact ms value).
 *
 * 3. ActiveCommandList — Set-based entering ID tracking
 *    Impact: MEDIUM — GC pressure from Set creation on every step change.
 *    Every time `currentStepIds` changes (which is every 100ms during playback),
 *    a new `Set<string>` is created via `useMemo`. The `useEffect` then creates
 *    ANOTHER `new Set<string>()` for `newEntering`. After 400ms timeout, yet another
 *    `new Set()` is created (empty). That's 3 Set allocations per step transition.
 *    Additionally, `steps.map(s => s.id)` creates a new array every time.
 *    The `typeCounts` Map is also recreated on every steps change.
 *    Recommendation: Use a ref-based approach to track entering IDs (mutate in place),
 *    avoid creating new Sets on every render. Use `useMemo` with a structural equality
 *    check (compare sorted ID strings) to skip unnecessary Set recreations.
 *
 * 4. StepJsonPopover — vanilla-jsoneditor mount/unmount cost
 *    Impact: HIGH per interaction — but LOW overall (only on hover).
 *    The `JsonInspector` component creates a full `vanilla-jsoneditor` instance via
 *    `createJSONEditor()` on mount. This is an expensive operation (~5-15ms per mount)
 *    because the editor initializes its own virtual DOM, keybindings, and tree renderer.
 *    On every hover of a different timeline item, the previous editor is destroyed
 *    and a new one is created. The 150ms hover delay helps, but rapid mouse movement
 *    across items still triggers mount/destroy cycles.
 *    Recommendation: Keep a SINGLE pooled editor instance alive (hidden) and swap its
 *    `content` prop when the hovered item changes, instead of destroying/recreating.
 *    Alternatively, use a simpler JSON renderer for the popover (just syntax-highlighted
 *    pre-formatted text) and reserve the full editor for the ActiveCommandList JSON panel.
 *
 * 5. CSS Animations causing reflows
 *    Impact: MEDIUM — continuous compositor work.
 *    - `pbc-active-pulse`: animates `box-shadow` — this triggers PAINT on every frame
 *      because box-shadow is not a compositor-only property. With multiple active items,
 *      this multiplies paint work.
 *    - `pbc-clock-pulse`: animates `transform: scale()` + `opacity` — compositor-friendly.
 *    - `pbc-clock-hand`: animates `transform: rotate()` — compositor-friendly.
 *    - `transition: width 80ms linear` on ProgressStrip fill — triggers LAYOUT because
 *      `width` changes require reflow. Should use `transform: scaleX()` instead.
 *    - `transition: width 100ms linear` on ActiveCommandCard progress fill — same issue.
 *    - `backdrop-filter: blur(24px)` on the console container — forces a stacking context
 *      and requires GPU compositing of the blurred background on every repaint.
 *    Recommendation: Replace box-shadow animations with `outline` or `border-color`
 *    animations. Replace `width` transitions with `transform: scaleX()`.
 *    Consider `contain: layout paint` on the console container to limit reflow scope.
 *
 * 6. WaveformProgressBar — 40 divs re-render on every progress change
 *    Impact: LOW-MEDIUM — 40 elements with individual style transitions.
 *    Each bar recalculates `isBeforePlayhead` and applies conditional styles.
 *    The `transition: background 80ms linear, opacity 80ms linear` on each bar
 *    means the browser tracks 40 concurrent transitions during playback.
 *    Recommendation: Use a single canvas or SVG path instead of 40 divs.
 *    Alternatively, use CSS `clip-path` on a single gradient element.
 *
 * 7. Density heatmap — 120 divs in the density strip
 *    Impact: LOW — these are static once computed. The `densityBuckets` useMemo
 *    correctly prevents recomputation. However, the rendering of 120 tiny divs
 *    in the minimap is duplicated (density shown twice: in strip and in minimap).
 *    Recommendation: Merge density and minimap renders, or use canvas for density.
 *
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface PerfResult {
  name: string
  avgMs: number
  minMs: number
  maxMs: number
  samples: number
  p95Ms: number
}

interface PerfOverlayData {
  renderCounts: Map<string, number>
  lastRenderDurations: Map<string, number>
  memoryUsage: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null
  results: PerfResult[]
}

// --------------------------------------------------------------------------
// Performance measurement utilities
// --------------------------------------------------------------------------

function measureSync(name: string, fn: () => void, iterations = 100): PerfResult {
  const times: number[] = []
  // Warmup
  for (let i = 0; i < 5; i++) fn()

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    const end = performance.now()
    times.push(end - start)
  }

  times.sort((a, b) => a - b)
  const avg = times.reduce((s, t) => s + t, 0) / times.length
  const p95Index = Math.floor(times.length * 0.95)

  return {
    name,
    avgMs: avg,
    minMs: times[0],
    maxMs: times[times.length - 1],
    samples: iterations,
    p95Ms: times[p95Index],
  }
}

async function measureAsync(name: string, fn: () => Promise<void>, iterations = 20): Promise<PerfResult> {
  const times: number[] = []
  // Warmup
  for (let i = 0; i < 2; i++) await fn()

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  times.sort((a, b) => a - b)
  const avg = times.reduce((s, t) => s + t, 0) / times.length
  const p95Index = Math.floor(times.length * 0.95)

  return {
    name,
    avgMs: avg,
    minMs: times[0],
    maxMs: times[times.length - 1],
    samples: iterations,
    p95Ms: times[p95Index],
  }
}

// --------------------------------------------------------------------------
// Test: injectConsoleStyles cost
// --------------------------------------------------------------------------

function testStyleInjection(): PerfResult {
  return measureSync("injectConsoleStyles (parse)", () => {
    // Simulate injecting + removing a style block to measure parse cost
    const style = document.createElement("style")
    style.textContent = `
      .perf-test-btn { transition: background 120ms ease; }
      .perf-test-btn:hover { filter: brightness(1.25); }
      @keyframes perf-test-pulse {
        0%, 100% { box-shadow: 0 0 8px rgba(118,185,0,0.4); }
        50% { box-shadow: 0 0 14px rgba(118,185,0,0.6); }
      }
      .perf-test-active { animation: perf-test-pulse 1.8s ease-in-out infinite; }
    `.repeat(10) // Approximate full style block size
    document.head.appendChild(style)
    // Force style recalc
    void getComputedStyle(document.body).color
    document.head.removeChild(style)
  }, 50)
}

// --------------------------------------------------------------------------
// Test: Timeline re-render simulation (buildTimelineLanes + getActiveSteps)
// --------------------------------------------------------------------------

function testTimelineRerender(): PerfResult {
  // Simulate the work done on each currentMs change
  const steps = generateMockSteps(30)
  const totalDurationMs = 30000

  return measureSync("Timeline re-render (buildLanes + getActive)", () => {
    // This simulates the computation on each frame update
    const currentMs = Math.random() * totalDurationMs
    // Simulated buildTimelineLanes
    const items = steps
      .filter((step) => step.command.type !== "wait")
      .map((step) => ({
        step,
        startMs: step.startMs,
        endMs: step.endMs ?? totalDurationMs,
        lane: 0,
      }))
      .sort((a, b) => a.startMs - b.startMs)

    // Simulated getActiveSteps
    const _active = steps.filter((step) => {
      if (step.command.type === "wait") return false
      const effectiveEnd = step.endMs ?? totalDurationMs
      return currentMs >= step.startMs && currentMs < effectiveEnd
    })

    // Simulated msToPercent for playhead
    const _percent = totalDurationMs > 0 ? (currentMs / totalDurationMs) * 100 : 0

    // Suppress unused variable warnings
    void items
    void _active
    void _percent
  }, 200)
}

// --------------------------------------------------------------------------
// Test: ActiveCommandList Set operations (GC pressure)
// --------------------------------------------------------------------------

function testSetOperations(): PerfResult {
  const stepIds = Array.from({ length: 8 }, (_, i) => `step-${i}`)

  return measureSync("ActiveCommandList Set churn", () => {
    // Simulates what happens on each step transition
    const prevIds = new Set(stepIds.slice(0, 5))
    const currentIds = new Set(stepIds.slice(2, 8))
    const entering = new Set<string>()

    for (const id of currentIds) {
      if (!prevIds.has(id)) entering.add(id)
    }

    // typeCounts Map recreation
    const counts = new Map<string, number>()
    for (const id of currentIds) {
      const type = id.split("-")[0]
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }

    void entering
    void counts
  }, 500)
}

// --------------------------------------------------------------------------
// Test: JSON editor mount/unmount (simulated DOM cost)
// --------------------------------------------------------------------------

function testPopoverMountUnmount(): PerfResult {
  return measureSync("StepJsonPopover DOM mount/unmount", () => {
    // Simulate the cost of creating and destroying a complex DOM subtree
    const container = document.createElement("div")
    container.style.cssText = "position:absolute;top:-9999px;left:-9999px;width:320px;height:200px;"
    document.body.appendChild(container)

    // Simulate popover content (not actual jsoneditor, but equivalent DOM complexity)
    container.innerHTML = `
      <div style="padding:10px;border-radius:10px;background:rgba(16,18,36,0.94);">
        <div style="display:flex;gap:6px;margin-bottom:5px;">
          <span style="width:18px;height:18px;border-radius:4px;"></span>
          <div><div style="font-size:10px;font-weight:800;">TYPE</div>
          <div style="font-size:9px;">0:00.0 - 0:05.0</div></div>
        </div>
        <div style="height:200px;border-radius:9px;overflow:hidden;">
          ${Array.from({ length: 20 }, (_, i) => `<div class="json-row-${i}" style="padding:2px 4px;font-size:11px;">{"key${i}": "value${i}"}</div>`).join("")}
        </div>
      </div>
    `
    // Force layout
    void container.offsetHeight
    document.body.removeChild(container)
  }, 100)
}

// --------------------------------------------------------------------------
// Test: Timeline zoom calculation
// --------------------------------------------------------------------------

function testTimelineZoom(): PerfResult {
  const lanes = generateMockLanes(8, 25)
  const totalDurationMs = 30000
  const DENSITY_BUCKETS = 120

  return measureSync("Timeline zoom (density + visible filter)", () => {
    const zoom = 1 + Math.random() * 5
    const visibleDurationMs = totalDurationMs / zoom
    const viewStartMs = Math.random() * (totalDurationMs - visibleDurationMs)
    const viewEndMs = viewStartMs + visibleDurationMs

    // Density computation
    const buckets = new Array(DENSITY_BUCKETS).fill(0)
    const bucketMs = totalDurationMs / DENSITY_BUCKETS
    for (const lane of lanes) {
      for (const item of lane.items) {
        const startBucket = Math.max(0, Math.floor(item.startMs / bucketMs))
        const endBucket = Math.min(DENSITY_BUCKETS - 1, Math.floor(item.endMs / bucketMs))
        for (let b = startBucket; b <= endBucket; b++) buckets[b]++
      }
    }

    // Visible items filter per lane
    for (const lane of lanes) {
      const _visible = lane.items.filter((item) =>
        item.endMs > viewStartMs && item.startMs < viewEndMs
      )
      void _visible
    }

    void buckets
  }, 200)
}

// --------------------------------------------------------------------------
// Test: Command list update frequency (measures how often state would change)
// --------------------------------------------------------------------------

function testCommandListUpdateFreq(): PerfResult {
  const steps = generateMockSteps(25)
  const totalDurationMs = 30000
  let lastActiveSet = ""

  return measureSync("CommandList update detection", () => {
    const currentMs = Math.random() * totalDurationMs
    const active = steps.filter((step) => {
      if (step.command.type === "wait") return false
      const effectiveEnd = step.endMs ?? totalDurationMs
      return currentMs >= step.startMs && currentMs < effectiveEnd
    })
    const activeSet = active.map((s) => s.id).join(",")
    const _changed = activeSet !== lastActiveSet
    lastActiveSet = activeSet
    void _changed
  }, 500)
}

// --------------------------------------------------------------------------
// Mock data generators
// --------------------------------------------------------------------------

interface MockStep {
  id: string
  toolUseId: string
  toolName: string
  toolInput: Record<string, unknown>
  command: { type: string; position?: { x: number; y: number } }
  description: string
  status: string
  startMs: number
  endMs?: number
}

interface MockLane {
  id: string
  label: string
  items: { step: MockStep; startMs: number; endMs: number; lane: number }[]
}

function generateMockSteps(count: number): MockStep[] {
  const types = ["gauge", "sparkline", "highlight", "arrow", "text", "chart", "spotlight", "clear"]
  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i}`,
    toolUseId: `t-mock-${i}`,
    toolName: "demo",
    toolInput: {},
    command: {
      type: types[i % types.length],
      position: { x: 100 + i * 50, y: 100 + i * 30 },
    },
    description: `Mock step ${i}`,
    status: "done",
    startMs: i * 1000,
    endMs: i * 1000 + 3000,
  }))
}

function generateMockLanes(laneCount: number, itemsPerLane: number): MockLane[] {
  const types = ["gauge", "sparkline", "highlight", "arrow", "text", "chart", "spotlight", "table"]
  return Array.from({ length: laneCount }, (_, l) => ({
    id: types[l % types.length],
    label: types[l % types.length],
    items: Array.from({ length: itemsPerLane }, (__, i) => ({
      step: {
        id: `lane-${l}-item-${i}`,
        toolUseId: `t-${l}-${i}`,
        toolName: "demo",
        toolInput: {},
        command: { type: types[l % types.length] },
        description: "",
        status: "done",
        startMs: i * 1200,
        endMs: i * 1200 + 2500,
      },
      startMs: i * 1200,
      endMs: i * 1200 + 2500,
      lane: l,
    })),
  }))
}

// --------------------------------------------------------------------------
// Format results as table
// --------------------------------------------------------------------------

function formatResultsTable(results: PerfResult[]): string {
  const header = "| Test Name                                    | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | Samples |"
  const separator = "|----------------------------------------------|----------|----------|----------|----------|---------|"
  const rows = results.map((r) => {
    const name = r.name.padEnd(44)
    const avg = r.avgMs.toFixed(3).padStart(8)
    const min = r.minMs.toFixed(3).padStart(8)
    const max = r.maxMs.toFixed(3).padStart(8)
    const p95 = r.p95Ms.toFixed(3).padStart(8)
    const samples = String(r.samples).padStart(7)
    return `| ${name} | ${avg} | ${min} | ${max} | ${p95} | ${samples} |`
  })

  return [
    "",
    "=== PRESENTATION PLAYBACK CONSOLE — PERFORMANCE REPORT ===",
    "",
    header,
    separator,
    ...rows,
    separator,
    "",
    "Legend:",
    "  Avg: Mean execution time across all samples",
    "  P95: 95th percentile (worst 5% excluded)",
    "  Samples: Number of measurement iterations",
    "",
    "Thresholds (targeting 60fps = 16.6ms budget):",
    "  < 1ms   : Excellent — negligible cost",
    "  1-4ms   : Good — fits within frame budget",
    "  4-8ms   : Warning — consuming significant frame budget",
    "  > 8ms   : Critical — may cause frame drops",
    "",
  ].join("\n")
}

// --------------------------------------------------------------------------
// Main test runner
// --------------------------------------------------------------------------

export async function runPerfTest(): Promise<PerfResult[]> {
  console.log("%c[PerfTest] Starting performance measurements...", "color: #76B900; font-weight: bold")

  const results: PerfResult[] = []

  // Synchronous tests
  results.push(testStyleInjection())
  results.push(testTimelineRerender())
  results.push(testSetOperations())
  results.push(testPopoverMountUnmount())
  results.push(testTimelineZoom())
  results.push(testCommandListUpdateFreq())

  // Memory snapshot
  const mem = getMemoryUsage()
  if (mem) {
    console.log(
      `%c[PerfTest] Memory: ${(mem.usedJSHeapSize / 1048576).toFixed(1)}MB used / ${(mem.totalJSHeapSize / 1048576).toFixed(1)}MB total / ${(mem.jsHeapSizeLimit / 1048576).toFixed(1)}MB limit`,
      "color: #38BDF8"
    )
  }

  // Print table
  const table = formatResultsTable(results)
  console.log(table)

  // Also use performance.mark/measure for DevTools integration
  performance.mark("perf-test-complete")
  performance.measure("PerfTest Total", { start: 0, end: performance.now() })

  return results
}

// --------------------------------------------------------------------------
// Memory utility
// --------------------------------------------------------------------------

interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

function getMemoryUsage(): PerformanceMemory | null {
  const perf = performance as Performance & { memory?: PerformanceMemory }
  if (perf.memory) {
    return {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    }
  }
  return null
}

// --------------------------------------------------------------------------
// Render counter hook (for PerfOverlay)
// --------------------------------------------------------------------------

const renderCounters = new Map<string, number>()
const renderDurations = new Map<string, number>()

/**
 * Call this at the top of a component to track render counts.
 * Returns the current count for display.
 */
export function trackRender(componentName: string): number {
  const count = (renderCounters.get(componentName) ?? 0) + 1
  renderCounters.set(componentName, count)
  return count
}

/**
 * Call this to record a render duration measurement.
 */
export function recordRenderDuration(componentName: string, durationMs: number): void {
  renderDurations.set(componentName, durationMs)
}

/**
 * Get all current perf overlay data.
 */
export function getPerfOverlayData(): PerfOverlayData {
  return {
    renderCounts: new Map(renderCounters),
    lastRenderDurations: new Map(renderDurations),
    memoryUsage: getMemoryUsage(),
    results: [],
  }
}

/**
 * Reset all counters (useful between test runs).
 */
export function resetPerfCounters(): void {
  renderCounters.clear()
  renderDurations.clear()
}

// --------------------------------------------------------------------------
// PerfOverlay — React component (separate file to avoid circular deps)
// --------------------------------------------------------------------------
// Import PerfOverlay directly from "./PerfOverlay" in your app:
//   import { PerfOverlay } from "./PerfOverlay"

// --------------------------------------------------------------------------
// Global registration
// --------------------------------------------------------------------------

declare global {
  interface Window {
    __runPerfTest: typeof runPerfTest
    __getPerfData: typeof getPerfOverlayData
    __resetPerfCounters: typeof resetPerfCounters
  }
}

if (typeof window !== "undefined") {
  window.__runPerfTest = runPerfTest
  window.__getPerfData = getPerfOverlayData
  window.__resetPerfCounters = resetPerfCounters
}
