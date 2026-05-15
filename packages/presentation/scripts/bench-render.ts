/**
 * Remotion Render Performance Benchmark Script
 *
 * Measures frame render performance using multiple strategies:
 *
 * 1. **Full renderer mode** (requires @remotion/renderer + built example):
 *    Uses Remotion's headless rendering pipeline to render real frames via Puppeteer.
 *
 * 2. **React reconciliation benchmark** (default, no browser needed):
 *    Mounts the full component tree inside proper Remotion context providers and measures
 *    React reconciliation cost per frame using react-dom/server renderToString.
 *    All Remotion hooks (useCurrentFrame, useVideoConfig, spring, interpolate) execute
 *    with real frame values.
 *
 * Usage:
 *   npx tsx scripts/bench-render.ts [--frames=300] [--fps=30] [--concurrency=1] [--mode=reconcile]
 *
 * Modes:
 *   --mode=full        Use @remotion/renderer (requires Chrome + built example)
 *   --mode=reconcile   Measure React tree reconciliation cost (default, no browser)
 *
 * For Player-mode profiling (interactive), use the PerfProfiler component in browser.
 */

// --- Node polyfills required by Remotion internals ---
if (typeof globalThis.localStorage === "undefined") {
  const store: Record<string, string> = {}
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

import { performance } from "perf_hooks"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { Internals } from "remotion"
import { PresentationOverlay } from "../src/components/presentation-overlay"

interface BenchResult {
  totalFrames: number
  fps: number
  frameBudgetMs: number
  totalTimeMs: number
  avgFrameMs: number
  p50FrameMs: number
  p95FrameMs: number
  p99FrameMs: number
  maxFrameMs: number
  minFrameMs: number
  droppedFrames: number
  dropRate: number
  throughputFps: number
  mode: string
}

async function main() {
  const args = process.argv.slice(2)
  const getArg = (name: string, fallback: string) => {
    const arg = args.find((a) => a.startsWith(`--${name}=`))
    return arg ? arg.split("=")[1] : fallback
  }
  const getNumArg = (name: string, fallback: number) => {
    const val = getArg(name, String(fallback))
    return Number(val)
  }

  const totalFrames = getNumArg("frames", 300)
  const fps = getNumArg("fps", 30)
  const concurrency = getNumArg("concurrency", 1)
  const mode = getArg("mode", "reconcile")
  const frameBudgetMs = 1000 / fps

  console.log("======================================================")
  console.log("     Remotion Render Performance Benchmark")
  console.log("======================================================")
  console.log(`  Mode: ${mode}`)
  console.log(`  Frames: ${totalFrames}, FPS: ${fps}, Concurrency: ${concurrency}`)
  console.log(`  Frame budget: ${frameBudgetMs.toFixed(1)}ms`)
  console.log("------------------------------------------------------")

  if (mode === "full") {
    await runFullRenderBench(totalFrames, fps, concurrency)
  } else {
    await runReconciliationBench(totalFrames, fps)
  }
}

/**
 * Full renderer path: uses @remotion/renderer to render frames via headless Chrome.
 * This measures the complete pipeline: React render + DOM serialization + screenshot.
 */
async function runFullRenderBench(totalFrames: number, fps: number, concurrency: number) {
  let renderFrames: typeof import("@remotion/renderer").renderFrames
  try {
    const renderer = await import("@remotion/renderer")
    renderFrames = renderer.renderFrames
  } catch {
    console.error("\n  @remotion/renderer not found. Install it:")
    console.error("    pnpm add -D @remotion/renderer")
    console.error("\n  Or use --mode=reconcile for browser-free benchmarking.")
    process.exit(1)
  }

  const frameTimes: number[] = []
  let lastFrameStart = performance.now()

  const overallStart = performance.now()

  try {
    await renderFrames({
      serveUrl: new URL("../example/dist", import.meta.url).pathname,
      composition: {
        id: "PresentationOverlay",
        durationInFrames: totalFrames,
        fps,
        width: 1920,
        height: 1080,
        defaultProps: {},
        defaultCodec: "h264",
        props: {},
      },
      outputDir: "/tmp/viben-bench-frames",
      onFrameUpdate: (frame: number) => {
        const now = performance.now()
        if (frame > 0) {
          frameTimes.push(now - lastFrameStart)
        }
        lastFrameStart = now
      },
      concurrency,
      imageFormat: "none" as any,
    })
  } catch (e) {
    console.error("\n  Full renderer failed. Ensure example is built:")
    console.error("    cd example && pnpm build")
    console.error(`\n  Error: ${e instanceof Error ? e.message : String(e)}`)
    console.error("\n  Falling back to reconciliation benchmark...\n")
    await runReconciliationBench(totalFrames, fps)
    return
  }

  const overallEnd = performance.now()
  const totalTimeMs = overallEnd - overallStart

  if (frameTimes.length === 0) {
    console.log("No frame timing data collected.")
    process.exit(1)
  }

  const result = computeMetrics(frameTimes, fps, totalTimeMs, "full-renderer")
  printReport(result)
}

/**
 * Reconciliation benchmark: measures actual React component tree render cost
 * by providing Remotion's internal context providers with controlled frame values.
 *
 * This is meaningful because:
 * - It exercises the full component tree (PresentationOverlay + all overlays)
 * - All Remotion hooks execute with real values (useCurrentFrame, useVideoConfig, spring)
 * - Each "frame" triggers renderToString with a different frame number
 * - Spring calculations, interpolations, and sequence virtualization all execute
 * - String serialization cost approximates DOM creation cost
 *
 * What this does NOT measure:
 * - Browser layout/paint cost
 * - GPU compositing
 * - Real-time scheduling pressure
 * - Memory pressure from repeated GC cycles in a live player
 *
 * These are best measured via the PerfProfiler in a running Player.
 */
async function runReconciliationBench(totalFrames: number, fps: number) {
  console.log("\n  Running React reconciliation benchmark...")
  console.log(`  (Renders ${totalFrames} frames with full Remotion context)\n`)

  const testSteps = createBenchSteps()
  const durationInFrames = totalFrames
  const width = 1920
  const height = 1080
  const compositionId = "bench-comp"

  // Verify required internals are available
  if (!Internals.CanUseRemotionHooks || !Internals.TimelineContext || !Internals.SequenceContext) {
    console.log("  ERROR: Cannot access required Remotion internals.")
    process.exit(1)
  }

  // Build the render function that wraps PresentationOverlay in proper context
  function renderFrame(frame: number): string {
    const rootId = "bench"

    const timelineValue = {
      frame: { [rootId]: frame, [compositionId]: frame },
      playing: false,
      rootId,
      imperativePlaying: { current: false },
      audioAndVideoTags: { current: [] },
    }

    const sequenceValue = {
      cumulatedFrom: 0,
      relativeFrom: 0,
      parentFrom: 0,
      durationInFrames,
      id: "bench-root-seq",
      width,
      height,
      premounting: false,
      postmounting: false,
      premountDisplay: null,
      postmountDisplay: null,
    }

    const compositionManagerValue = {
      compositions: [{
        id: compositionId,
        durationInFrames,
        fps,
        width,
        height,
        defaultProps: {},
        component: PresentationOverlay,
        nonce: 0,
        folderName: null,
        parentFolderName: null,
        calculateMetadata: null,
        schema: null,
      }],
      folders: [],
      currentCompositionMetadata: { durationInFrames, fps, width, height, defaultProps: {} },
      canvasContent: { type: "composition" as const, compositionId },
    }

    const editorPropsValue = { props: {}, setProps: () => {} }

    const resolveCompositionValue = {
      [compositionId]: {
        type: "success" as const,
        result: { id: compositionId, durationInFrames, fps, width, height, defaultProps: {} },
      },
    }

    const remotionEnvValue = { isStudio: false, isRendering: false, isPlayer: true }

    // Stack providers: CanUseRemotionHooks > RemotionEnvironment > CompositionManager >
    //   EditorProps > ResolveComposition > Timeline > Sequence > Component
    const element = createElement(
      Internals.CanUseRemotionHooks.Provider,
      { value: true },
      createElement(
        Internals.RemotionEnvironmentContext.Provider,
        { value: remotionEnvValue },
        createElement(
          Internals.CompositionManager.Provider,
          { value: compositionManagerValue },
          createElement(
            Internals.EditorPropsContext.Provider,
            { value: editorPropsValue },
            createElement(
              Internals.ResolveCompositionContext.Provider,
              { value: resolveCompositionValue },
              createElement(
                Internals.TimelineContext.Provider,
                { value: timelineValue },
                createElement(
                  Internals.SequenceContext.Provider,
                  { value: sequenceValue },
                  createElement(PresentationOverlay, { steps: testSteps }),
                ),
              ),
            ),
          ),
        ),
      ),
    )

    return renderToString(element)
  }

  // Verify rendering works
  try {
    const testOutput = renderFrame(0)
    if (!testOutput) {
      throw new Error("renderToString returned empty string")
    }
    console.log(`  Context setup verified. Frame 0 output: ${testOutput.length} chars`)
  } catch (e) {
    console.log(`  Context mocking failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }

  // Warmup: let V8 JIT optimize the hot path (critical for stable measurements)
  const warmupFrames = 30
  console.log(`  Warming up JIT (${warmupFrames} frames)...`)
  for (let frame = 0; frame < warmupFrames; frame++) {
    renderFrame(frame % durationInFrames)
  }

  // Force GC before measurement if available
  if (typeof global.gc === "function") {
    global.gc()
  }

  console.log("  Measuring...\n")

  // Actual measurement: render each frame sequentially
  const frameTimes: number[] = []
  const overallStart = performance.now()

  for (let frame = 0; frame < totalFrames; frame++) {
    const start = performance.now()
    renderFrame(frame)
    const elapsed = performance.now() - start
    frameTimes.push(elapsed)
  }

  const overallEnd = performance.now()
  const totalTimeMs = overallEnd - overallStart

  if (frameTimes.length > 0) {
    const result = computeMetrics(frameTimes, fps, totalTimeMs, "reconciliation")
    printReport(result)
    printInterpretation(result)
  }
}

/**
 * Creates a representative set of presentation steps covering multiple
 * overlay types and timing patterns to simulate a real workload.
 *
 * The timeline is 10s at 30fps = 300 frames, with overlapping overlays
 * that exercise different rendering complexities.
 */
function createBenchSteps() {
  return [
    // Phase 1: Basic overlays (0-5s) — lightweight text/badge/progress
    { id: "s1", startMs: 0, endMs: 5000, command: { type: "spotlight" as const, region: { x: 100, y: 100, width: 200, height: 150 }, maskOpacity: 0.7, borderRadius: 8 } },
    { id: "s2", startMs: 500, endMs: 4000, command: { type: "text" as const, position: { x: 400, y: 200 }, content: "Benchmark Text Overlay", fontSize: 24, color: "#fff" } },
    { id: "s3", startMs: 1000, endMs: 6000, command: { type: "badge" as const, position: { x: 600, y: 100 }, text: "PERF", color: "#6366F1" } },
    { id: "s4", startMs: 1500, endMs: 5000, command: { type: "progress" as const, position: { x: 200, y: 400 }, value: 75, width: 300 } },
    { id: "s5", startMs: 2000, endMs: 7000, command: { type: "counter" as const, position: { x: 500, y: 400 }, value: 1234, fontSize: 48 } },

    // Phase 2: Data visualization (3-8s) — heavier spring/interpolation calculations
    { id: "s6", startMs: 3000, endMs: 8000, command: { type: "gauge" as const, position: { x: 100, y: 300 }, value: 78, label: "Performance", color: "#6366F1" } },
    { id: "s7", startMs: 3500, endMs: 8000, command: { type: "sparkline" as const, position: { x: 400, y: 300 }, data: [10, 25, 18, 42, 35, 60, 55, 72, 68, 80], width: 200, height: 60, color: "#10B981", fill: true, showEndDot: true } },
    { id: "s8", startMs: 4000, endMs: 9000, command: { type: "funnel" as const, position: { x: 700, y: 100 }, stages: [{ label: "Visitors", value: 10000, color: "#6366F1" }, { label: "Leads", value: 5200, color: "#8B5CF6" }, { label: "Trials", value: 2100, color: "#A855F7" }, { label: "Customers", value: 800, color: "#C084FC" }], width: 280, height: 220 } },

    // Phase 3: Complex layout (6-10s) — many child elements, staggered animations
    { id: "s9", startMs: 6000, endMs: 10000, command: { type: "flowchart" as const, position: { x: 150, y: 150 }, nodes: [{ id: "a", label: "Start", color: "#6366F1" }, { id: "b", label: "Process" }, { id: "c", label: "Decision", color: "#F59E0B" }, { id: "d", label: "End", color: "#10B981" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }], direction: "horizontal" as const, width: 600 } },
    { id: "s10", startMs: 6500, endMs: 10000, command: { type: "table" as const, position: { x: 150, y: 420 }, headers: ["Name", "Revenue", "Growth"], rows: [["NVIDIA", "$26B", "+122%"], ["AMD", "$3.5B", "+45%"], ["Intel", "$1.1B", "-8%"]], highlights: [[0, 2]], rowStagger: 4 } },

    // Phase 4: Particle effects (8-10s) — computationally heavy per-particle calculations
    { id: "s11", startMs: 8000, endMs: 10000, command: { type: "confetti" as const, position: { x: 480, y: 300 }, count: 40, spread: 200, colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"] } },

    // Clear at 10s
    { id: "s12", startMs: 10000, command: { type: "clear" as const } },
  ]
}

function computeMetrics(frameTimes: number[], fps: number, totalTimeMs: number, mode: string): BenchResult {
  const n = frameTimes.length
  const sorted = [...frameTimes].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const frameBudgetMs = 1000 / fps
  const droppedFrames = sorted.filter((t) => t > frameBudgetMs).length

  const percentile = (p: number) => sorted[Math.min(Math.floor(p * n), n - 1)]

  return {
    totalFrames: n,
    fps,
    frameBudgetMs,
    totalTimeMs: Math.round(totalTimeMs),
    avgFrameMs: Math.round((sum / n) * 100) / 100,
    p50FrameMs: Math.round(percentile(0.5) * 100) / 100,
    p95FrameMs: Math.round(percentile(0.95) * 100) / 100,
    p99FrameMs: Math.round(percentile(0.99) * 100) / 100,
    maxFrameMs: Math.round(sorted[n - 1] * 100) / 100,
    minFrameMs: Math.round(sorted[0] * 100) / 100,
    droppedFrames,
    dropRate: Math.round((droppedFrames / n) * 1000) / 10,
    throughputFps: Math.round((n / totalTimeMs) * 1000 * 10) / 10,
    mode,
  }
}

function printReport(result: BenchResult) {
  const dropIcon = result.dropRate === 0 ? "[OK]" : result.dropRate < 5 ? "[!!]" : "[XX]"

  console.log("======================================================")
  console.log("         RENDER PERFORMANCE RESULTS")
  console.log(`         Mode: ${result.mode}`)
  console.log("======================================================")
  console.log(`  Total Frames:     ${String(result.totalFrames).padStart(8)}`)
  console.log(`  Total Time:       ${String(result.totalTimeMs + "ms").padStart(10)}`)
  console.log(`  Throughput:       ${String(result.throughputFps + " fps").padStart(10)}`)
  console.log(`  Frame Budget:     ${String(result.frameBudgetMs.toFixed(1) + "ms").padStart(10)}`)
  console.log("------------------------------------------------------")
  console.log(`  Avg Frame:        ${String(result.avgFrameMs.toFixed(2) + "ms").padStart(10)}`)
  console.log(`  P50 Frame:        ${String(result.p50FrameMs.toFixed(2) + "ms").padStart(10)}`)
  console.log(`  P95 Frame:        ${String(result.p95FrameMs.toFixed(2) + "ms").padStart(10)}`)
  console.log(`  P99 Frame:        ${String(result.p99FrameMs.toFixed(2) + "ms").padStart(10)}`)
  console.log(`  Max Frame:        ${String(result.maxFrameMs.toFixed(2) + "ms").padStart(10)}`)
  console.log(`  Min Frame:        ${String(result.minFrameMs.toFixed(2) + "ms").padStart(10)}`)
  console.log("------------------------------------------------------")
  console.log(`  ${dropIcon} Dropped:      ${String(result.droppedFrames).padStart(5)} / ${result.totalFrames} (${result.dropRate}%)`)
  console.log("======================================================")

  if (result.dropRate === 0) {
    console.log("\n  [OK] EXCELLENT: Zero frame drops")
  } else if (result.dropRate < 5) {
    console.log(`\n  [!!] GOOD: ${result.dropRate}% drop rate`)
  } else if (result.dropRate < 15) {
    console.log(`\n  [!!] FAIR: ${result.dropRate}% drop rate — noticeable stutter`)
  } else {
    console.log(`\n  [XX] POOR: ${result.dropRate}% drop rate — severe frame drops`)
  }

  // Performance budget check
  console.log("\n--- Budget Analysis ---")
  if (result.p95FrameMs < result.frameBudgetMs) {
    console.log(`  P95 (${result.p95FrameMs}ms) within budget (${result.frameBudgetMs.toFixed(1)}ms) [PASS]`)
  } else {
    console.log(`  P95 (${result.p95FrameMs}ms) EXCEEDS budget (${result.frameBudgetMs.toFixed(1)}ms) [FAIL]`)
    console.log(`  Need to reduce P95 by ${(result.p95FrameMs - result.frameBudgetMs).toFixed(1)}ms`)
  }

  const headroom = result.frameBudgetMs - result.p95FrameMs
  if (headroom > 0) {
    const headroomPct = Math.round((headroom / result.frameBudgetMs) * 100)
    console.log(`  Headroom: ${headroom.toFixed(1)}ms (${headroomPct}% of budget available)`)
  }
}

function printInterpretation(result: BenchResult) {
  console.log("\n--- What This Measures ---")
  console.log("  React reconciliation cost per frame (via renderToString):")
  console.log("  - Full component tree construction with actual Remotion hook execution")
  console.log("  - spring() calculations, interpolate() calls per frame")
  console.log("  - Sequence virtualization (binary search for visible overlays)")
  console.log("  - Context propagation (useCurrentFrame, useVideoConfig)")
  console.log("  - HTML string serialization (approximates DOM node creation cost)")
  console.log("")
  console.log("  NOT measured (use PerfProfiler in browser):")
  console.log("  - Browser layout/paint/composite")
  console.log("  - GPU rasterization")
  console.log("  - requestAnimationFrame scheduling contention")
  console.log("  - GC pauses under sustained memory pressure")
  console.log("")
  console.log("  Rule of thumb: if reconciliation exceeds 50% of frame budget,")
  console.log("  the component tree itself is too expensive and needs optimization.")

  const reconcilePct = Math.round((result.p95FrameMs / result.frameBudgetMs) * 100)
  console.log(`\n  Current: P95 reconciliation uses ~${reconcilePct}% of frame budget.`)
  if (reconcilePct < 30) {
    console.log("  Verdict: FAST — ample headroom for browser rendering pipeline.")
  } else if (reconcilePct < 60) {
    console.log("  Verdict: MODERATE — acceptable, monitor as overlay count grows.")
  } else {
    console.log("  Verdict: HEAVY — reconciliation alone risks jank. Optimize component tree.")
  }
}

main().catch((err) => {
  console.error("Benchmark failed:", err)
  process.exit(1)
})
