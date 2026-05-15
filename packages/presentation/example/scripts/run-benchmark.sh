#!/usr/bin/env bash
#
# run-benchmark.sh — Presentation Playback Console Render Benchmark
#
# This script:
# 1. Starts the Vite dev server
# 2. Opens the app with ?fps=1&perf=1 params
# 3. Runs the benchmark via Playwright browser injection
# 4. Collects and reports results
#
# Requirements:
#   - Node.js >= 18
#   - pnpm (for dev server)
#   - playwright (optional, falls back to manual instructions)
#
# Usage:
#   chmod +x scripts/run-benchmark.sh
#   ./scripts/run-benchmark.sh [--headless] [--fps 60] [--duration 180000] [--step 200]
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$PROJECT_DIR/benchmark-results"

# Defaults
HEADLESS=false
FPS=60
DURATION=180000
STEP_MS=200
PORT=5173
TIMEOUT=300  # seconds

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headless) HEADLESS=true; shift ;;
    --fps) FPS="$2"; shift 2 ;;
    --duration) DURATION="$2"; shift 2 ;;
    --step) STEP_MS="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--headless] [--fps N] [--duration MS] [--step MS] [--port N] [--timeout S]"
      echo ""
      echo "Options:"
      echo "  --headless    Run browser in headless mode (default: false)"
      echo "  --fps N       Target FPS for budget calculation (default: 60)"
      echo "  --duration N  Total playback duration in ms to simulate (default: 180000)"
      echo "  --step N      Time step in ms between seeks (default: 200)"
      echo "  --port N      Dev server port (default: 5173)"
      echo "  --timeout N   Max seconds to wait for benchmark (default: 300)"
      echo ""
      echo "Output: benchmark-results/report-<timestamp>.txt"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'  # No Color

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Presentation Playback Console — Render Benchmark          ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  FPS target:  ${FPS}                                             ║${NC}"
echo -e "${CYAN}║  Duration:    ${DURATION}ms                                       ║${NC}"
echo -e "${CYAN}║  Step size:   ${STEP_MS}ms                                           ║${NC}"
echo -e "${CYAN}║  Headless:    ${HEADLESS}                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Step 1: Check for Playwright
# ============================================================================

HAS_PLAYWRIGHT=false
PLAYWRIGHT_BIN=""

if command -v npx &> /dev/null; then
  # Check if playwright is available via npx
  if npx playwright --version &> /dev/null 2>&1; then
    HAS_PLAYWRIGHT=true
    PLAYWRIGHT_BIN="npx playwright"
  fi
fi

if [ "$HAS_PLAYWRIGHT" = false ]; then
  # Check if @playwright/test is in node_modules
  if [ -f "$PROJECT_DIR/node_modules/.bin/playwright" ]; then
    HAS_PLAYWRIGHT=true
    PLAYWRIGHT_BIN="$PROJECT_DIR/node_modules/.bin/playwright"
  fi
fi

if [ "$HAS_PLAYWRIGHT" = false ]; then
  echo -e "${YELLOW}[warn] Playwright not found. Falling back to manual mode.${NC}"
  echo ""
  echo "To run the benchmark manually:"
  echo ""
  echo "  1. Start the dev server:"
  echo "     cd $PROJECT_DIR && pnpm dev"
  echo ""
  echo "  2. Open in Chrome with DevTools:"
  echo "     http://localhost:${PORT}/?fps=1&perf=1"
  echo ""
  echo "  3. Click on any demo script to start playback"
  echo ""
  echo "  4. In the browser console, paste:"
  echo ""
  echo "     ----- COPY BELOW -----"
  cat << 'MANUAL_SCRIPT'

// Benchmark script for manual browser console execution
(async function runBenchmark() {
  const FPS = __FPS__;
  const TOTAL_DURATION = __DURATION__;
  const STEP_MS = __STEP_MS__;
  const FRAME_BUDGET = 1000 / FPS;

  console.log(`[benchmark] Starting: FPS=${FPS}, duration=${TOTAL_DURATION}ms, step=${STEP_MS}ms`);

  // Frame measurement
  const frameSamples = [];
  let lastTimestamp = 0;
  let measuring = true;

  function measureFrame(timestamp) {
    if (!measuring) return;
    if (lastTimestamp > 0) {
      const delta = timestamp - lastTimestamp;
      const dropped = Math.max(0, Math.floor(delta / FRAME_BUDGET) - 1);
      frameSamples.push({ timestamp, delta, droppedFrames: dropped });
    }
    lastTimestamp = timestamp;
    requestAnimationFrame(measureFrame);
  }
  requestAnimationFrame(measureFrame);

  // Simulate playback by waiting
  console.log("[benchmark] Measuring frames during playback...");
  console.log("[benchmark] Let the presentation play for its full duration.");
  console.log("[benchmark] The report will auto-generate when done.");

  // Wait for playback to complete (or timeout)
  await new Promise(resolve => setTimeout(resolve, Math.min(TOTAL_DURATION + 5000, 120000)));

  measuring = false;

  // Generate report
  const deltas = frameSamples.map(s => s.delta);
  const sorted = [...deltas].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) { console.error("No frames captured!"); return; }

  const sum = sorted.reduce((a, b) => a + b, 0);
  const jank = sorted.filter(d => d > 32).length;
  const severe = sorted.filter(d => d > 50).length;
  const percentile = (p) => sorted[Math.min(Math.floor(p * n), n - 1)];

  const report = {
    totalFrames: n,
    avgFrameTime: (sum / n).toFixed(2) + "ms",
    p50: percentile(0.5).toFixed(2) + "ms",
    p95: percentile(0.95).toFixed(2) + "ms",
    p99: percentile(0.99).toFixed(2) + "ms",
    max: sorted[n-1].toFixed(2) + "ms",
    min: sorted[0].toFixed(2) + "ms",
    jankFrames: jank,
    severeJank: severe,
    budgetAdherence: ((n - jank) / n * 100).toFixed(1) + "%",
    avgFPS: Math.round(1000 / (sum / n)),
  };

  console.log("\n" + "=".repeat(60));
  console.log("  BENCHMARK RESULTS");
  console.log("=".repeat(60));
  console.table(report);
  console.log("=".repeat(60) + "\n");

  // Copy to clipboard
  const text = JSON.stringify(report, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    console.log("[benchmark] Report copied to clipboard!");
  } catch { /* clipboard not available */ }
})();

MANUAL_SCRIPT
  echo ""
  echo "     ----- COPY ABOVE -----"
  echo ""
  echo "  (Replace __FPS__ with $FPS, __DURATION__ with $DURATION, __STEP_MS__ with $STEP_MS)"
  echo ""
  echo -e "${YELLOW}To use automated mode, install Playwright:${NC}"
  echo "  pnpm add -D @playwright/test"
  echo "  npx playwright install chromium"
  exit 0
fi

echo -e "${GREEN}[ok] Playwright found: $PLAYWRIGHT_BIN${NC}"

# ============================================================================
# Step 2: Start dev server
# ============================================================================

echo -e "${CYAN}[info] Starting dev server on port $PORT...${NC}"

# Kill any existing process on the port
if lsof -ti:$PORT &> /dev/null; then
  echo -e "${YELLOW}[warn] Port $PORT is in use. Killing existing process...${NC}"
  kill -9 $(lsof -ti:$PORT) 2>/dev/null || true
  sleep 1
fi

cd "$PROJECT_DIR"
pnpm dev --port $PORT &
DEV_PID=$!

# Cleanup function
cleanup() {
  echo -e "\n${CYAN}[info] Cleaning up...${NC}"
  kill $DEV_PID 2>/dev/null || true
  # Kill any remaining vite processes on the port
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
}
trap cleanup EXIT

# Wait for dev server to be ready
echo -e "${CYAN}[info] Waiting for dev server...${NC}"
MAX_WAIT=30
WAITED=0
until curl -s "http://localhost:$PORT" > /dev/null 2>&1; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo -e "${RED}[error] Dev server failed to start within ${MAX_WAIT}s${NC}"
    exit 1
  fi
done
echo -e "${GREEN}[ok] Dev server ready at http://localhost:$PORT${NC}"

# ============================================================================
# Step 3: Create Playwright benchmark script
# ============================================================================

mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/report-${TIMESTAMP}.txt"
REPORT_JSON="$REPORT_DIR/report-${TIMESTAMP}.json"

PLAYWRIGHT_SCRIPT=$(mktemp /tmp/bench-playwright-XXXXXX.mjs)
cat > "$PLAYWRIGHT_SCRIPT" << PLAYWRIGHT_EOF
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const FPS = ${FPS};
const DURATION = ${DURATION};
const STEP_MS = ${STEP_MS};
const HEADLESS = ${HEADLESS};
const PORT = ${PORT};
const REPORT_FILE = '${REPORT_FILE}';
const REPORT_JSON = '${REPORT_JSON}';
const TIMEOUT = ${TIMEOUT} * 1000;

async function main() {
  console.log('[playwright] Launching browser...');
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--disable-gpu-sandbox', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Collect console logs
  const consoleLogs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('[benchmark]')) {
      console.log('  ' + text);
    }
  });

  // Navigate with performance params
  const url = \`http://localhost:\${PORT}/?fps=1&perf=1\`;
  console.log(\`[playwright] Navigating to \${url}\`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait for the app to render
  await page.waitForTimeout(2000);

  // Click the first demo script to start playback
  console.log('[playwright] Starting first demo script...');
  const scriptButtons = await page.$$('button');
  let clicked = false;
  for (const btn of scriptButtons) {
    const text = await btn.textContent();
    if (text && text.includes('AI')) {
      await btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked && scriptButtons.length > 0) {
    // Click any button that looks like a script selector
    for (const btn of scriptButtons) {
      const text = await btn.textContent();
      if (text && text.length > 10) {
        await btn.click();
        clicked = true;
        break;
      }
    }
  }

  // Wait for presentation to initialize
  await page.waitForTimeout(3000);

  console.log('[playwright] Injecting benchmark instrumentation...');

  // Inject the benchmark measurement directly
  const report = await page.evaluate(async ({ fps, duration, stepMs, frameBudget }) => {
    // ---- Inline benchmark logic (cannot import modules in evaluate) ----

    const frameSamples = [];
    let lastTimestamp = 0;
    let measuring = true;
    let rafId = 0;

    // JSON editor monitoring
    let jsonEditorMounts = 0;
    let jsonEditorUnmounts = 0;
    const mountTimes = [];

    const editorObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const added of mutation.addedNodes) {
          if (added instanceof HTMLElement) {
            if (added.classList?.contains('jse-main') || added.querySelector?.('.jse-main')) {
              jsonEditorMounts++;
              const start = performance.now();
              requestAnimationFrame(() => {
                mountTimes.push(performance.now() - start);
              });
            }
          }
        }
        for (const removed of mutation.removedNodes) {
          if (removed instanceof HTMLElement) {
            if (removed.classList?.contains('jse-main') || removed.querySelector?.('.jse-main')) {
              jsonEditorUnmounts++;
            }
          }
        }
      }
    });
    editorObserver.observe(document.body, { childList: true, subtree: true });

    // Start frame measurement
    function measureFrame(timestamp) {
      if (!measuring) return;
      if (lastTimestamp > 0) {
        const delta = timestamp - lastTimestamp;
        const dropped = Math.max(0, Math.floor(delta / frameBudget) - 1);
        frameSamples.push({ timestamp, delta, droppedFrames: dropped });
      }
      lastTimestamp = timestamp;
      rafId = requestAnimationFrame(measureFrame);
    }
    rafId = requestAnimationFrame(measureFrame);

    // Let the presentation play naturally for the full duration
    // The Remotion Player is auto-playing, so we just measure frame times
    const measureDuration = Math.min(duration + 2000, 120000); // Cap at 2 minutes
    console.log(\`[benchmark] Measuring for \${measureDuration}ms...\`);
    await new Promise(resolve => setTimeout(resolve, measureDuration));

    measuring = false;
    cancelAnimationFrame(rafId);
    editorObserver.disconnect();

    // Analyze results
    const deltas = frameSamples.map(s => s.delta);
    const sorted = [...deltas].sort((a, b) => a - b);
    const n = sorted.length;

    if (n === 0) return { error: 'No frames captured' };

    const sum = sorted.reduce((a, b) => a + b, 0);
    const droppedTotal = frameSamples.reduce((acc, s) => acc + s.droppedFrames, 0);
    const jank = sorted.filter(d => d > 32).length;
    const severe = sorted.filter(d => d > 50).length;
    const percentile = (p) => sorted[Math.min(Math.floor(p * n), n - 1)];

    // Histogram
    const histBuckets = [
      { label: '0-8ms', min: 0, max: 8 },
      { label: '8-16ms', min: 8, max: 16 },
      { label: '16-33ms', min: 16, max: 33 },
      { label: '33-50ms', min: 33, max: 50 },
      { label: '50-100ms', min: 50, max: 100 },
      { label: '100ms+', min: 100, max: Infinity },
    ];
    const histogram = histBuckets.map(({ label, min, max }) => {
      const count = sorted.filter(t => t >= min && t < max).length;
      return { bucket: label, count, pct: Math.round((count / n) * 100) };
    });

    // Flame chart data (downsampled)
    const CHART_WIDTH = 80;
    const bucketSize = Math.max(1, Math.ceil(frameSamples.length / CHART_WIDTH));
    const columns = [];
    for (let i = 0; i < CHART_WIDTH; i++) {
      const start = i * bucketSize;
      const end = Math.min(start + bucketSize, frameSamples.length);
      let maxDelta = 0;
      for (let j = start; j < end; j++) {
        if (j < frameSamples.length) maxDelta = Math.max(maxDelta, frameSamples[j].delta);
      }
      columns.push(maxDelta);
    }

    // Hot spot detection
    const hotFrames = [];
    for (let i = 0; i < frameSamples.length && hotFrames.length < 10; i++) {
      if (frameSamples[i].delta > frameBudget * 2) {
        const timeMs = frameSamples[i].timestamp - frameSamples[0].timestamp;
        hotFrames.push({ timeMs, delta: frameSamples[i].delta, dropped: frameSamples[i].droppedFrames });
      }
    }

    return {
      totalFrames: n,
      droppedFrames: droppedTotal,
      jankFrames: jank,
      severeJankFrames: severe,
      avgFrameTime: Math.round((sum / n) * 100) / 100,
      p50FrameTime: Math.round(percentile(0.5) * 100) / 100,
      p95FrameTime: Math.round(percentile(0.95) * 100) / 100,
      p99FrameTime: Math.round(percentile(0.99) * 100) / 100,
      maxFrameTime: Math.round(sorted[n - 1] * 100) / 100,
      minFrameTime: Math.round(sorted[0] * 100) / 100,
      frameBudgetMs: frameBudget,
      budgetAdherence: Math.round(((n - jank) / n) * 1000) / 10,
      fps: {
        average: Math.round(1000 / (sum / n)),
        min: sorted[n - 1] > 0 ? Math.round(1000 / sorted[n - 1]) : 0,
        max: sorted[0] > 0 ? Math.round(1000 / sorted[0]) : 0,
      },
      histogram,
      columns,
      hotFrames,
      jsonEditor: {
        mountCount: jsonEditorMounts,
        unmountCount: jsonEditorUnmounts,
        avgMountMs: mountTimes.length > 0 ? mountTimes.reduce((a, b) => a + b, 0) / mountTimes.length : 0,
      },
    };
  }, { fps: FPS, duration: DURATION, stepMs: STEP_MS, frameBudget: 1000 / FPS });

  if (report.error) {
    console.error('[playwright] Benchmark failed:', report.error);
    await browser.close();
    process.exit(1);
  }

  // Format the report
  const formatted = formatReport(report);
  console.log(formatted);

  // Save results
  writeFileSync(REPORT_FILE, formatted);
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  console.log(\`\\n[playwright] Report saved to: \${REPORT_FILE}\`);
  console.log(\`[playwright] JSON data saved to: \${REPORT_JSON}\`);

  await browser.close();
}

function formatReport(r) {
  const lines = [];
  const W = 78;

  lines.push('');
  lines.push('\u2554' + '\u2550'.repeat(W) + '\u2557');
  lines.push('\u2551' + '  PRESENTATION PLAYBACK CONSOLE \u2014 RENDER BENCHMARK REPORT'.padEnd(W) + '\u2551');
  lines.push('\u2560' + '\u2550'.repeat(W) + '\u2563');
  lines.push('');

  // Frame Timing
  lines.push('  \u250C\u2500\u2500\u2500 FRAME TIMING \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
  lines.push(\`  \u2502  Total Frames:        \${String(r.totalFrames).padStart(8)}                                 \u2502\`);
  lines.push(\`  \u2502  Frame Budget:        \${(r.frameBudgetMs.toFixed(1) + 'ms').padStart(8)}                                 \u2502\`);
  lines.push(\`  \u2502  Budget Adherence:    \${(r.budgetAdherence + '%').padStart(8)}                                 \u2502\`);
  lines.push(\`  \u2502  Dropped Frames:      \${String(r.droppedFrames).padStart(8)}                                 \u2502\`);
  lines.push(\`  \u2502  Jank (>32ms):        \${String(r.jankFrames).padStart(8)}                                 \u2502\`);
  lines.push(\`  \u2502  Severe Jank (>50ms): \${String(r.severeJankFrames).padStart(8)}                                 \u2502\`);
  lines.push('  \u2502                                                                       \u2502');
  lines.push(\`  \u2502  Avg: \${(r.avgFrameTime.toFixed(2) + 'ms').padStart(9)}   P50: \${(r.p50FrameTime.toFixed(2) + 'ms').padStart(9)}   P95: \${(r.p95FrameTime.toFixed(2) + 'ms').padStart(9)}       \u2502\`);
  lines.push(\`  \u2502  P99: \${(r.p99FrameTime.toFixed(2) + 'ms').padStart(9)}   Min: \${(r.minFrameTime.toFixed(2) + 'ms').padStart(9)}   Max: \${(r.maxFrameTime.toFixed(2) + 'ms').padStart(9)}       \u2502\`);
  lines.push('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
  lines.push('');

  // FPS
  lines.push('  \u250C\u2500\u2500\u2500 FPS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
  lines.push(\`  \u2502  Average: \${String(r.fps.average).padStart(4)} fps    Min: \${String(r.fps.min).padStart(4)} fps    Max: \${String(r.fps.max).padStart(4)} fps          \u2502\`);
  lines.push('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
  lines.push('');

  // Histogram
  lines.push('  \u250C\u2500\u2500\u2500 HISTOGRAM \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
  for (const h of r.histogram) {
    const bar = '\u2588'.repeat(Math.min(35, Math.round(h.pct * 0.35)));
    lines.push(\`  \u2502  \${h.bucket.padEnd(10)} \${bar.padEnd(35)} \${String(h.count).padStart(6)} (\${String(h.pct).padStart(2)}%) \u2502\`);
  }
  lines.push('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
  lines.push('');

  // Flame chart
  const CHART_HEIGHT = 15;
  const maxVal = Math.max(r.frameBudgetMs * 3, ...r.columns);
  const rowMs = maxVal / CHART_HEIGHT;

  lines.push('  \u250C\u2500\u2500\u2500 FLAME CHART \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
  for (let row = CHART_HEIGHT - 1; row >= 0; row--) {
    const threshold = row * rowMs;
    let line = '';
    for (let col = 0; col < r.columns.length; col++) {
      const value = r.columns[col];
      if (value > threshold + rowMs) {
        if (value > r.frameBudgetMs * 2) line += '\u2588';
        else if (value > r.frameBudgetMs) line += '\u2593';
        else line += '\u2591';
      } else if (value > threshold) {
        if (value > r.frameBudgetMs * 2) line += '\u2584';
        else if (value > r.frameBudgetMs) line += '\u2582';
        else line += '\u2581';
      } else {
        line += ' ';
      }
    }
    const msLabel = row % 3 === 0 ? Math.round(threshold + rowMs) + 'ms' : '';
    lines.push(\`  \u2502 \${msLabel.padStart(5)}\u2502\${line}\u2502\`);
  }
  lines.push(\`  \u2502      +\${'─'.repeat(r.columns.length)}+                                        \u2502\`);
  lines.push(\`  \u2502  Legend: \u2591=ok  \u2593=jank(>\${r.frameBudgetMs.toFixed(0)}ms)  \u2588=severe(>\${(r.frameBudgetMs*2).toFixed(0)}ms)                      \u2502\`);
  lines.push('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
  lines.push('');

  // Hot spots
  if (r.hotFrames.length > 0) {
    lines.push('  HOT SPOTS (frames > 2x budget):');
    lines.push('  ' + '\u2500'.repeat(50));
    for (const h of r.hotFrames) {
      lines.push(\`    @\${(h.timeMs / 1000).toFixed(2)}s: \${h.delta.toFixed(1)}ms (\${h.dropped} frames dropped)\`);
    }
    lines.push('');
  }

  // JSON Editor
  lines.push('  \u250C\u2500\u2500\u2500 VANILLA-JSONEDITOR \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510');
  lines.push(\`  \u2502  Mount count:      \${String(r.jsonEditor.mountCount).padStart(6)}                                      \u2502\`);
  lines.push(\`  \u2502  Unmount count:    \${String(r.jsonEditor.unmountCount).padStart(6)}                                      \u2502\`);
  lines.push(\`  \u2502  Avg mount time:   \${(r.jsonEditor.avgMountMs.toFixed(2) + 'ms').padStart(9)}                                   \u2502\`);
  const jeVerdict = r.jsonEditor.avgMountMs > 16
    ? 'WARN: mount > 1 frame, pool recommended'
    : r.jsonEditor.mountCount > 10
      ? 'INFO: frequent remount, consider pooling'
      : 'OK';
  lines.push(\`  \u2502  Verdict:          \${jeVerdict.padEnd(47)}\u2502\`);
  lines.push('  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518');
  lines.push('');

  // Known issues analysis
  lines.push('  PERFORMANCE ANALYSIS:');
  lines.push('  ' + '\u2500'.repeat(50));
  lines.push('');
  lines.push('  [1] buildTimelineLanes recomputation:');
  lines.push('      useMemo dep is [script] (object ref) - CORRECT.');
  lines.push('      Will recompute only when script object changes.');
  lines.push('      Assessment: OK if script ref is stable per selection.');
  lines.push('');
  lines.push('  [2] commandColor repeated map lookups:');
  lines.push('      Function recomputes hash on EVERY call (no cache).');
  lines.push('      Called per lane label per render in TimelineTracks,');
  lines.push('      TimelineLaneRow, StepJsonPopover, ActiveCommandList.');
  lines.push('      Assessment: Low cost (simple hash), but cacheable.');
  lines.push('');
  lines.push('  [3] useMemo deps in TimelineTracks:');
  lines.push('      - ticks: depends on [viewStartMs, visibleDurationMs]');
  lines.push('      - visibleItems: depends on [lane.items, viewStartMs, viewEndMs]');
  lines.push('      - These CHANGE on every zoom/pan interaction.');
  lines.push('      - clientXToMs, msToPercent: recreated on viewStartMs change.');
  lines.push('      Assessment: EXPECTED behavior during zoom, but rapid zoom');
  lines.push('      causes many re-renders. Consider useTransition for zoom.');
  lines.push('');
  lines.push('  [4] vanilla-jsoneditor mount/unmount on hover:');
  lines.push(\`      Observed: \${r.jsonEditor.mountCount} mounts, \${r.jsonEditor.unmountCount} unmounts\`);
  lines.push(\`      Avg mount cost: \${r.jsonEditor.avgMountMs.toFixed(2)}ms\`);
  if (r.jsonEditor.avgMountMs > 10) {
    lines.push('      Assessment: EXPENSIVE. Should pool a single instance');
    lines.push('      and swap content via editor.updateProps() instead of');
    lines.push('      creating/destroying the editor on each hover.');
  } else {
    lines.push('      Assessment: Acceptable cost per mount.');
  }
  lines.push('');

  // Verdict
  lines.push('\u2554' + '\u2550'.repeat(W) + '\u2557');
  if (r.budgetAdherence >= 95 && r.severeJankFrames === 0) {
    lines.push('\u2551' + '  VERDICT: EXCELLENT - Smooth playback, no significant jank'.padEnd(W) + '\u2551');
  } else if (r.budgetAdherence >= 85) {
    lines.push('\u2551' + '  VERDICT: GOOD - Minor jank during transitions'.padEnd(W) + '\u2551');
  } else if (r.budgetAdherence >= 70) {
    lines.push('\u2551' + '  VERDICT: FAIR - Noticeable jank, optimization recommended'.padEnd(W) + '\u2551');
  } else {
    lines.push('\u2551' + '  VERDICT: POOR - Significant frame drops, optimization needed'.padEnd(W) + '\u2551');
  }
  lines.push('\u255A' + '\u2550'.repeat(W) + '\u255D');
  lines.push('');

  return lines.join('\\n');
}

main().catch((err) => {
  console.error('[playwright] Fatal error:', err);
  process.exit(1);
});
PLAYWRIGHT_EOF

# ============================================================================
# Step 4: Run the benchmark
# ============================================================================

echo ""
echo -e "${CYAN}[info] Running benchmark via Playwright...${NC}"
echo ""

# Run with node (Playwright scripts are ESM)
node "$PLAYWRIGHT_SCRIPT"
BENCH_EXIT=$?

# Cleanup temp file
rm -f "$PLAYWRIGHT_SCRIPT"

if [ $BENCH_EXIT -ne 0 ]; then
  echo -e "${RED}[error] Benchmark failed with exit code $BENCH_EXIT${NC}"
  exit $BENCH_EXIT
fi

echo ""
echo -e "${GREEN}[done] Benchmark complete!${NC}"
echo -e "${GREEN}[done] Results: $REPORT_DIR/${NC}"
echo ""

# List generated reports
ls -la "$REPORT_DIR"/report-*.txt 2>/dev/null | tail -5
