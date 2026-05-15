import type { PresentationStep } from "@viben/presentation"

/**
 * Timeline-based presentation script -- AI Chip Market Analysis (3-minute version)
 *
 * Each step has `startMs` (when it appears) and optional `endMs` (when it disappears).
 * Multiple steps with the same `startMs` execute in parallel.
 * "clear" at a given time removes all prior annotations.
 *
 * Available targetIds (from MockBackground):
 *   title, subtitle, card-nvidia, card-amd, card-others,
 *   nvidia-value, amd-value, others-value, analysis, revenue-chart,
 *   bar-nvidia, bar-amd, bar-intel, bar-google, bar-huawei
 *
 * POSITIONING RULES (viewport 1024x768, safe Y max = 536):
 * - title (Y ~40-74): "below-start" safe, offsets 6-300
 * - subtitle (Y ~82-100): "below-start" safe up to offsetY ~30 before hitting card row
 * - Cards (Y ~120-258): use "above-start" (small items only), "right-of", "below-start"
 * - analysis/revenue-chart (Y ~296-500): use "above-start" or "left-of-start"
 * - bar-* elements (Y ~340-476): NEVER use "below-start", "above-start" for badges OK
 * - subtitle "right-of" NOT safe — exceeds viewport right (840px wide subtitle)
 * - Max simultaneous elements: 7 (avoid >7 for readability)
 * - End overlays before placing new ones at same position (prevent Z-stacking)
 */

/** Computed after steps are defined -- see bottom of file */
export let TOTAL_DURATION_MS = 180_000

let _id = 0
function t(
  startMs: number,
  command: PresentationStep["command"],
  description: string,
  endMs?: number,
  meta?: PresentationStep["meta"],
): PresentationStep {
  const id = `step-${++_id}`
  return {
    id,
    toolUseId: `t-${id}`,
    toolName: "demo",
    toolInput: {},
    command,
    description,
    status: "done",
    startMs,
    endMs,
    meta,
  }
}

export const demoSteps: PresentationStep[] = [
  // ============================================================================
  // ACT 1: HOOK (0s - 20s) — Dramatic opening with counter + spotlight + text
  // ============================================================================

  // 0s: Spotlight on title with dramatic mask
  t(0, {
    type: "spotlight",
    region: { targetId: "title", padding: 24 },
    maskOpacity: 0.5,
    borderRadius: 14,
    animate: true,
  }, "Opening spotlight on title", 18000),

  // 1s: Dramatic hook text below title
  t(1000, {
    type: "text",
    position: { targetId: "title", placement: "below-start", offsetY: 10 },
    content: "一家公司，吃掉了整个行业80%的利润",
    fontSize: 24,
    fontWeight: 800,
    color: "#FFFFFF",
    background: "rgba(0,0,0,0.88)",
    animate: true,
  }, "Opening hook text", 18000, { expect: { x: 288, y: 92 } }),

  // 3s: Typewriter follow-up question
  t(3000, {
    type: "typewriter",
    position: { targetId: "title", placement: "below-start", offsetY: 58 },
    content: "这种垄断，还能持续多久？让我们用数据说话。",
    fontSize: 16,
    fontWeight: 600,
    color: "#F59E0B",
    background: "rgba(0,0,0,0.75)",
    speed: "normal",
    animate: true,
  }, "Typewriter: rhetorical question", 9500, { expect: { x: 288, y: 140 } }),

  // 6s: Counter counting up — NVIDIA's YoY growth percentage
  t(6000, {
    type: "counter",
    position: { targetId: "title", placement: "below-start", offsetY: 10, offsetX: 700 },
    value: 265,
    suffix: "%",
    color: "#76B900",
    fontSize: 48,
    animate: true,
  }, "Counter: 265% YoY growth", 11500, { expect: { x: 988, y: 92 } }),

  // 7.5s: Badge labeling the counter (ends when first counter ends)
  t(7500, {
    type: "badge",
    position: { targetId: "title", placement: "below-start", offsetY: 70, offsetX: 700 },
    text: "数据中心收入同比增长",
    color: "#FFFFFF",
    background: "rgba(118, 185, 0, 0.85)",
    size: "md",
    animate: true,
  }, "Badge: growth label", 11500, { expect: { x: 988, y: 124 } }),

  // 10s: Text with total revenue figure — positioned near right-side counter stack for flow
  t(10000, {
    type: "text",
    position: { targetId: "title", placement: "below-start", offsetY: 70, offsetX: 700 },
    content: "季度收入首次突破 $26B",
    fontSize: 15,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.8)",
    animate: true,
  }, "Revenue milestone text", 18000, { expect: { x: 988, y: 152 } }),

  // 12s: Counter — daily earnings
  t(12000, {
    type: "counter",
    position: { targetId: "title", placement: "below-start", offsetY: 10, offsetX: 700 },
    value: 2.9,
    prefix: "$",
    suffix: "亿/天",
    color: "#F59E0B",
    fontSize: 42,
    animate: true,
  }, "Counter: daily revenue", 18000, { expect: { x: 988, y: 92 } }),

  // 14s: Pulse on title center — centered transition before clear
  t(14000, {
    type: "pulse",
    center: { targetId: "title", anchor: "center" },
    radius: 20,
    color: "#76B900",
    rings: 3,
    animate: true,
  }, "Pulse on title center", 18000, { expect: { x: 688, y: 37 } }),

  // 18s: Clear for overview
  t(18000, { type: "clear" }, "Clear for overview"),

  // ============================================================================
  // ACT 2: OVERVIEW (20s - 40s) — Reveal cards, pulse, badge, highlight
  // ============================================================================

  // 20s: Spotlight title area briefly
  t(20000, {
    type: "spotlight",
    region: { targetId: "title", padding: 14 },
    maskOpacity: 0.7,
    borderRadius: 12,
    animate: true,
  }, "Spotlight title for context", 26000),

  // 20.5s: Framing text
  t(20500, {
    type: "text",
    position: { targetId: "title", placement: "below-start", offsetY: 28 },
    content: "摩根士丹利深度报告：AI芯片三国杀",
    fontSize: 16,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.85)",
    animate: true,
  }, "Framing text", 26000, { expect: { x: 288, y: 110 } }),

  // 21s: Badge — OVERWEIGHT rating
  t(21000, {
    type: "badge",
    position: { targetId: "title", placement: "below-start", offsetY: 6, offsetX: 700 },
    text: "OVERWEIGHT",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.9)",
    size: "md",
    animate: true,
  }, "Badge: OVERWEIGHT rating", 26000, { expect: { x: 988, y: 60 } }),

  // 23s: Underline subtitle (straight style)
  t(23000, {
    type: "underline",
    from: { targetId: "subtitle", anchor: "bottom-left" },
    to: { targetId: "subtitle", anchor: "bottom-right" },
    color: "#6366F1",
    strokeWidth: 2,
    style: "straight",
    animate: true,
  }, "Underline subtitle", 26000),

  // 26s: Clear for card reveals
  t(26000, { type: "clear" }, "Clear for card reveals"),

  // 27s: Pulse on three cards staggered
  t(27000, {
    type: "pulse",
    center: { targetId: "card-nvidia", anchor: "center" },
    radius: 32,
    color: "#76B900",
    rings: 3,
    animate: true,
  }, "Pulse NVIDIA card", 33000, { expect: { x: 390, y: 161 } }),

  t(27500, {
    type: "pulse",
    center: { targetId: "card-amd", anchor: "center" },
    radius: 32,
    color: "#ED1C24",
    rings: 3,
    animate: true,
  }, "Pulse AMD card", 33000, { expect: { x: 676, y: 161 } }),

  t(28000, {
    type: "pulse",
    center: { targetId: "card-others", anchor: "center" },
    radius: 32,
    color: "#6366F1",
    rings: 3,
    animate: true,
  }, "Pulse Others card", 33000, { expect: { x: 960, y: 161 } }),

  // 29s: Text above cards
  t(29000, {
    type: "text",
    position: { targetId: "card-amd", placement: "above-start", offsetY: -6 },
    content: "三家公司，三种命运",
    fontSize: 18,
    fontWeight: 700,
    color: "#F59E0B",
    background: "rgba(0,0,0,0.75)",
    animate: true,
  }, "Three fates text", 35500, { expect: { x: 573, y: 107 } }),

  // 31s: Highlight each card value in sequence
  t(31000, {
    type: "highlight",
    region: { targetId: "nvidia-value", padding: 6 },
    color: "#76B900",
    opacity: 0.25,
    borderRadius: 8,
    animate: true,
  }, "Highlight 80%", 38000, { expect: { x: 303, y: 172 } }),

  t(32000, {
    type: "highlight",
    region: { targetId: "amd-value", padding: 6 },
    color: "#ED1C24",
    opacity: 0.25,
    borderRadius: 8,
    animate: true,
  }, "Highlight 12%", 38000, { expect: { x: 588, y: 172 } }),

  t(33000, {
    type: "highlight",
    region: { targetId: "others-value", padding: 6 },
    color: "#6366F1",
    opacity: 0.25,
    borderRadius: 8,
    animate: true,
  }, "Highlight 8%", 38000, { expect: { x: 873, y: 172 } }),

  // 34s: Badges on cards
  t(34000, {
    type: "badge",
    position: { targetId: "card-nvidia", placement: "above-end" },
    text: "统治者",
    color: "#fff",
    background: "#76B900",
    size: "sm",
    animate: true,
  }, "Badge: ruler", 38000, { expect: { x: 557, y: 91 } }),

  t(34500, {
    type: "badge",
    position: { targetId: "card-amd", placement: "above-end" },
    text: "挑战者",
    color: "#fff",
    background: "#ED1C24",
    size: "sm",
    animate: true,
  }, "Badge: challenger", 38000, { expect: { x: 842, y: 91 } }),

  t(35000, {
    type: "badge",
    position: { targetId: "card-others", placement: "above-end" },
    text: "新势力",
    color: "#fff",
    background: "#6366F1",
    size: "sm",
    animate: true,
  }, "Badge: newcomers", 38000, { expect: { x: 1127, y: 91 } }),

  // 36s: Arrow from NVIDIA value to AMD value showing dominance gap
  t(36000, {
    type: "arrow",
    from: { targetId: "nvidia-value", anchor: "right" },
    to: { targetId: "amd-value", anchor: "left" },
    color: "#F59E0B",
    label: "6.7x 差距",
    strokeWidth: 2,
    animate: true,
  }, "Arrow: dominance gap", 38000),

  // 38s: Clear for NVIDIA deep dive
  t(38000, { type: "clear" }, "Clear for NVIDIA deep dive"),

  // ============================================================================
  // ACT 3: NVIDIA DEEP DIVE (40s - 65s) — spotlight, card, arrow, underline, circle
  // ============================================================================

  // 40s: Spotlight NVIDIA card
  t(40000, {
    type: "spotlight",
    region: { targetId: "card-nvidia", padding: 10 },
    maskOpacity: 0.4,
    borderRadius: 12,
    animate: true,
  }, "Spotlight NVIDIA card", 63000),

  // 41s: Circle the 80% value
  t(41000, {
    type: "circle",
    center: { targetId: "nvidia-value", anchor: "center" },
    radius: 36,
    color: "#76B900",
    strokeWidth: 3,
    animate: true,
  }, "Circle 80% value", 63000, { expect: { x: 388, y: 158 } }),

  // 43s: Card with NVIDIA details — below title (safe zone, title.bottom=74)
  t(43000, {
    type: "card",
    position: { targetId: "card-nvidia", placement: "below-start", offsetY: 8 },
    width: 320,
    title: "NVIDIA: 绝对王者",
    content: "H100/H200: AI训练唯一选择\n季度收入 $26B (同比+265%)\n每天赚 2.9 亿美元\n市值突破 $2.2 万亿",
    tag: "统治者",
    tagColor: "#76B900",
    enterFrom: "bottom",
    animate: true,
    borderColor: "rgba(118, 185, 0, 0.3)",
  }, "Card: NVIDIA dominance", 54000, { expect: { x: 288, y: 281 } }),

  // 46s: Counter showing market cap — below-end to stay in same row as card
  t(46000, {
    type: "counter",
    position: { targetId: "card-nvidia", placement: "below-end", offsetY: 8 },
    value: 2.2,
    prefix: "$",
    suffix: "T 市值",
    color: "#76B900",
    fontSize: 32,
    animate: true,
  }, "Counter: $2.2T market cap", 63000, { expect: { x: 557, y: 281 } }),

  // 48s: Arrow from card-nvidia down to analysis section
  t(48000, {
    type: "arrow",
    from: { targetId: "card-nvidia", anchor: "bottom" },
    to: { targetId: "analysis", anchor: "top" },
    color: "#76B900",
    label: "深度分析",
    strokeWidth: 2,
    animate: true,
  }, "Arrow: to analysis", 63000),

  // 49s: Underline NVIDIA bar (wavy) — moved earlier to follow arrow to analysis
  t(49000, {
    type: "underline",
    from: { targetId: "bar-nvidia", anchor: "bottom-left" },
    to: { targetId: "bar-nvidia", anchor: "bottom-right" },
    color: "#76B900",
    strokeWidth: 3,
    style: "wavy",
    animate: true,
  }, "Underline NVIDIA bar", 63000),

  // 52s: Text insight — in analysis area, following gaze downward
  t(52000, {
    type: "text",
    position: { targetId: "analysis", placement: "above-start", offsetY: -6 },
    content: "每训练5个大模型，4个用NVIDIA",
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(118, 185, 0, 0.8)",
    animate: true,
  }, "Text: 4/5 models use NVIDIA", 63000, { expect: { x: 288, y: 370 } }),

  // 55s: Comparison — NVIDIA vs Rest — in analysis area continuing downward flow
  t(55000, {
    type: "comparison",
    position: { targetId: "analysis", placement: "above-start", offsetY: 20 },
    width: 350,
    leftLabel: "NVIDIA",
    rightLabel: "所有对手之和",
    leftValue: 80,
    rightValue: 20,
    leftColor: "#76B900",
    rightColor: "#6366F1",
    unit: "%",
    animate: true,
  }, "Comparison: NVIDIA vs all others", 63000, { expect: { x: 288, y: 396 } }),

  // 58s: Badge with key insight — transition zone below card-nvidia, bridges to next ACT
  t(58000, {
    type: "badge",
    position: { targetId: "card-nvidia", placement: "below-end", offsetY: -40 },
    text: "绝对垄断",
    color: "#000",
    background: "#76B900",
    size: "md",
    animate: true,
  }, "Badge: absolute monopoly", 63000, { expect: { x: 557, y: 205 } }),

  // 63s: Clear for CUDA analysis
  t(63000, { type: "clear" }, "Clear for CUDA moat"),

  // ============================================================================
  // ACT 4: CUDA MOAT (65s - 90s) — bracket, trendline, chart (line), typewriter
  // ============================================================================

  // 65s: Spotlight revenue chart area
  t(65000, {
    type: "spotlight",
    region: { targetId: "revenue-chart", padding: 12 },
    maskOpacity: 0.35,
    borderRadius: 12,
    animate: true,
  }, "Spotlight revenue chart", 88000),

  // 66s: Text — the answer is CUDA
  t(66000, {
    type: "text",
    position: { targetId: "revenue-chart", placement: "above-start", offsetY: -6 },
    content: "为什么没人能挑战NVIDIA？答案是三个字母：CUDA",
    fontSize: 17,
    fontWeight: 800,
    color: "#76B900",
    background: "rgba(0,0,0,0.85)",
    animate: true,
  }, "Text: CUDA is the answer", 75500, { expect: { x: 816, y: 370 } }),

  // 68s: Bracket grouping all bars (showing NVIDIA leads all)
  t(68000, {
    type: "bracket",
    from: { targetId: "bar-nvidia", anchor: "left" },
    to: { targetId: "bar-huawei", anchor: "left" },
    direction: "left",
    color: "#76B900",
    strokeWidth: 2,
    label: "CUDA 生态锁定",
    animate: true,
  }, "Bracket: CUDA lock-in", 82000),

  // 70s: Card explaining CUDA ecosystem — near revenue-chart (right side, matching spotlight focus)
  t(70000, {
    type: "card",
    position: { targetId: "analysis", placement: "above-start", offsetY: -6 },
    width: 280,
    title: "CUDA 生态系统壁垒",
    content: "400万开发者的肌肉记忆\n所有主流框架原生支持\n15年积累的软件生态\n换芯片 = 重写所有代码",
    tag: "护城河",
    tagColor: "#76B900",
    enterFrom: "right",
    animate: true,
    borderColor: "rgba(118, 185, 0, 0.3)",
  }, "Card: CUDA moat", 88000, { expect: { x: 288, y: 370 } }),

  // 73s: Trendline — NVIDIA revenue trajectory (using absolute points above chart)
  t(73000, {
    type: "trendline",
    points: [
      { x: 660, y: 420 },
      { x: 720, y: 390 },
      { x: 780, y: 350 },
      { x: 840, y: 300 },
      { x: 900, y: 260 },
    ],
    color: "#76B900",
    strokeWidth: 3,
    showDots: true,
    dotRadius: 5,
    fillBelow: "rgba(118, 185, 0, 0.15)",
    endArrow: true,
    animate: true,
  }, "Trendline: NVIDIA revenue growth", 88000),

  // 76s: Line chart — quarterly revenue (above revenue-chart, within spotlight)
  t(76000, {
    type: "chart",
    position: { targetId: "revenue-chart", placement: "above-start", offsetY: -170 },
    width: 300,
    height: 160,
    chartType: "line",
    title: "NVIDIA 季度收入趋势 ($B)",
    data: [
      { name: "Q1'23", value: 7.2 },
      { name: "Q2'23", value: 13.5 },
      { name: "Q3'23", value: 18.1 },
      { name: "Q4'23", value: 22.1 },
      { name: "Q1'24", value: 26.0 },
      { name: "Q2'24", value: 30.0 },
    ],
    colors: ["#76B900"],
    showGrid: true,
    showAxis: true,
    animate: true,
  }, "Chart: NVIDIA revenue line", 88000, { expect: { x: 816, y: 206 } }),

  // 80s: Typewriter — developer ecosystem insight (below chart)
  t(80000, {
    type: "typewriter",
    position: { targetId: "revenue-chart", placement: "above-start", offsetY: 34 },
    content: "400万开发者 × 15年生态 = 不可逾越的护城河",
    fontSize: 15,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(118, 185, 0, 0.8)",
    speed: "normal",
    animate: true,
  }, "Typewriter: developer moat", 88000, { expect: { x: 816, y: 410 } }),

  // 84s: Progress bar — CUDA adoption rate (below typewriter, within spotlight)
  t(84000, {
    type: "progress",
    position: { targetId: "revenue-chart", placement: "above-start", offsetY: 86 },
    width: 380,
    value: 92,
    color: "#76B900",
    showLabel: true,
    label: "CUDA 框架覆盖率: 92%",
    animate: true,
  }, "Progress: CUDA coverage", 88000, { expect: { x: 816, y: 462 } }),

  // 88s: Clear
  t(88000, { type: "clear" }, "Clear for AMD challenge"),

  // ============================================================================
  // ACT 5: AMD CHALLENGE (90s - 115s) — spotlight, card, comparison, chart (bar)
  // ============================================================================

  // 90s: Spotlight AMD card
  t(90000, {
    type: "spotlight",
    region: { targetId: "card-amd", padding: 10 },
    maskOpacity: 0.35,
    borderRadius: 12,
    animate: true,
  }, "Spotlight AMD card", 113000),

  // 91s: Highlight AMD value
  t(91000, {
    type: "highlight",
    region: { targetId: "amd-value", padding: 6 },
    color: "#ED1C24",
    opacity: 0.3,
    borderRadius: 8,
    animate: true,
  }, "Highlight AMD 12%", 100000, { expect: { x: 588, y: 172 } }),

  // 93s: Card for AMD — below title (safe zone)
  t(93000, {
    type: "card",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 8 },
    width: 300,
    title: "AMD: 最强挑战者",
    content: "MI300X: 性价比之王\nROCm 6.0: 兼容性大幅提升\n微软 Azure 独家大单\n年增长率 +180%",
    tag: "追赶者",
    tagColor: "#ED1C24",
    enterFrom: "bottom",
    animate: true,
    borderColor: "rgba(237, 28, 36, 0.3)",
  }, "Card: AMD overview", 97000, { expect: { x: 573, y: 281 } }),

  // 96s: Circle AMD value
  t(96000, {
    type: "circle",
    center: { targetId: "amd-value", anchor: "center" },
    radius: 34,
    color: "#ED1C24",
    strokeWidth: 3,
    animate: true,
  }, "Circle AMD 12%", 104000, { expect: { x: 674, y: 160 } }),

  // 98s: Comparison — NVIDIA vs AMD performance/$
  t(98000, {
    type: "comparison",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 8 },
    width: 380,
    leftLabel: "H100 性能",
    rightLabel: "MI300X 性能",
    leftValue: 100,
    rightValue: 85,
    leftColor: "#76B900",
    rightColor: "#ED1C24",
    unit: "相对值",
    animate: true,
  }, "Comparison: H100 vs MI300X", 113000, { expect: { x: 573, y: 281 } }),

  // 101s: Another comparison — price/performance
  t(101000, {
    type: "comparison",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 96 },
    width: 380,
    leftLabel: "H100 性价比",
    rightLabel: "MI300X 性价比",
    leftValue: 70,
    rightValue: 95,
    leftColor: "#76B900",
    rightColor: "#ED1C24",
    unit: "相对值",
    animate: true,
  }, "Comparison: price/performance", 113000, { expect: { x: 573, y: 369 } }),

  // 104s: Bar chart — AMD revenue growth (below comparisons, within spotlight area)
  t(104000, {
    type: "chart",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 148 },
    width: 260,
    height: 56,
    chartType: "bar",
    title: "AMD AI收入增速 ($B)",
    data: [
      { name: "Q1'23", value: 0.4 },
      { name: "Q2'23", value: 0.8 },
      { name: "Q3'23", value: 1.6 },
      { name: "Q4'23", value: 2.3 },
      { name: "Q1'24", value: 3.5 },
    ],
    colors: ["#ED1C24"],
    showGrid: true,
    showAxis: true,
    animate: true,
  }, "Chart: AMD revenue bar", 110500, { expect: { x: 573, y: 421 } }),

  // 107s: Underline AMD bar (straight)
  t(107000, {
    type: "underline",
    from: { targetId: "bar-amd", anchor: "bottom-left" },
    to: { targetId: "bar-amd", anchor: "bottom-right" },
    color: "#ED1C24",
    strokeWidth: 3,
    style: "straight",
    animate: true,
  }, "Underline AMD bar", 113000),

  // 109s: Badge on AMD bar
  t(109000, {
    type: "badge",
    position: { targetId: "card-amd", placement: "above-end", offsetY: -6 },
    text: "+180% YoY",
    color: "#fff",
    background: "#ED1C24",
    size: "sm",
    animate: true,
  }, "Badge: AMD growth", 113000, { expect: { x: 842, y: 85 } }),

  // 111s: Typewriter insight (below chart, avoiding overlap)
  t(111000, {
    type: "typewriter",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 168 },
    content: "ROCm 是 AMD 的胜负手 — 但差距仍有3-5年",
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(237, 28, 36, 0.8)",
    speed: "normal",
    animate: true,
  }, "Typewriter: ROCm gap", 113000, { expect: { x: 573, y: 441 } }),

  // 113s: Clear
  t(113000, { type: "clear" }, "Clear for others"),

  // ============================================================================
  // ACT 6: OTHERS (115s - 140s) — spotlight, card, chart (pie + area), badge
  // Visual flow: spotlight Others → info card beside it → badges staggered →
  //   clear badges → pie chart (left area) → area chart (replaces pie) → summary
  // ============================================================================

  // 115s: Spotlight Others card
  t(115000, {
    type: "spotlight",
    region: { targetId: "card-others", padding: 10 },
    maskOpacity: 0.4,
    borderRadius: 12,
    animate: true,
  }, "Spotlight Others card", 138000),

  // 116s: Card — custom silicon overview, placed LEFT of the spotlighted card-others
  t(116000, {
    type: "card",
    position: { targetId: "card-others", placement: "below-start", offsetY: 8 },
    width: 260,
    title: "自研芯片：暗流涌动",
    content: "Google TPU v5: 内部首选\nAmazon Trainium2: 推理优化\nMicrosoft Maia 100\n华为昇腾910B: 国产替代",
    tag: "新势力",
    tagColor: "#6366F1",
    enterFrom: "left",
    animate: true,
  }, "Card: custom silicon", 118500, { expect: { x: 858, y: 281 } }),

  // 119s: Three badges appear staggered BELOW card-others (not on bar elements)
  t(119000, {
    type: "badge",
    position: { targetId: "card-others", placement: "below-start", offsetY: 8 },
    text: "Google TPU v5e",
    color: "#fff",
    background: "#4285F4",
    size: "sm",
    animate: true,
  }, "Badge: TPU v5e", 127000, { expect: { x: 858, y: 259 } }),

  t(119500, {
    type: "badge",
    position: { targetId: "card-others", placement: "below-start", offsetY: 32 },
    text: "华为昇腾910B",
    color: "#fff",
    background: "#CF0A2C",
    size: "sm",
    animate: true,
  }, "Badge: Ascend 910B", 127000, { expect: { x: 858, y: 283 } }),

  t(120000, {
    type: "badge",
    position: { targetId: "card-others", placement: "below-start", offsetY: 56 },
    text: "Intel Gaudi 3",
    color: "#fff",
    background: "#0071C5",
    size: "sm",
    animate: true,
  }, "Badge: Intel Gaudi", 127000, { expect: { x: 858, y: 307 } }),

  // 121s: Bracket grouping all "others" badges visually
  t(121000, {
    type: "bracket",
    from: { targetId: "card-others", anchor: "bottom-left", offsetY: 8 },
    to: { targetId: "card-others", anchor: "bottom-left", offsetY: 76 },
    direction: "left",
    color: "#6366F1",
    strokeWidth: 2,
    label: "自研阵营 8%",
    animate: true,
  }, "Bracket: custom silicon group", 127000),

  // 127s: Clear card+badges, transition to charts phase
  t(127000, { type: "clear" }, "Clear for charts phase"),

  // 127.5s: Re-apply spotlight on analysis area (charts appear below cards)
  t(127500, {
    type: "spotlight",
    region: { targetId: "analysis", padding: 30 },
    maskOpacity: 0.45,
    borderRadius: 12,
    animate: true,
  }, "Spotlight analysis for charts", 135000),

  // 128s: Pie chart — market share, above-start of analysis (left-aligned)
  t(128000, {
    type: "chart",
    position: { targetId: "analysis", placement: "above-start", offsetY: -20 },
    width: 240,
    height: 130,
    chartType: "pie",
    title: "AI 芯片市场份额 2024",
    data: [
      { name: "NVIDIA", value: 80, color: "#76B900" },
      { name: "AMD", value: 12, color: "#ED1C24" },
      { name: "Intel", value: 4, color: "#0071C5" },
      { name: "Google", value: 3, color: "#4285F4" },
      { name: "Huawei", value: 1, color: "#CF0A2C" },
    ],
    innerRadius: 40,
    animate: true,
  }, "Chart: market share pie (donut)", 135000, { expect: { x: 288, y: 356 } }),

  // 131s: Area chart — custom silicon growth, right side of analysis
  t(131000, {
    type: "chart",
    position: { targetId: "analysis", placement: "above-start", offsetX: 280, offsetY: -20 },
    width: 260,
    height: 100,
    chartType: "area",
    title: "自研芯片份额预测 (%)",
    data: [
      { name: "2022", value: 3 },
      { name: "2023", value: 5 },
      { name: "2024", value: 8 },
      { name: "2025E", value: 12 },
      { name: "2026E", value: 18 },
      { name: "2027E", value: 25 },
    ],
    colors: ["#6366F1"],
    showGrid: true,
    showAxis: true,
    animate: true,
  }, "Chart: custom silicon area projection", 135000, { expect: { x: 568, y: 356 } }),

  // 133s: Pulse connecting pie chart area to revenue chart (arrow too short at 44px)
  t(133000, {
    type: "pulse",
    center: { targetId: "revenue-chart", anchor: "top" },
    radius: 24,
    color: "#6366F1",
    rings: 2,
    animate: true,
  }, "Pulse: growth trend focus", 135000, { expect: { x: 948, y: 360 } }),

  // 135s: Clear charts, show final summary text
  t(135000, { type: "clear" }, "Clear charts"),

  // 135.5s: Pulse + text summary for ACT 6 conclusion
  t(135500, {
    type: "pulse",
    center: { targetId: "card-others", anchor: "center" },
    radius: 24,
    color: "#6366F1",
    rings: 2,
    animate: true,
  }, "Pulse on Others", 138000, { expect: { x: 968, y: 169 } }),

  // 136s: Text summary
  t(136000, {
    type: "text",
    position: { targetId: "card-others", placement: "below-start", offsetY: 8, offsetX: -30 },
    content: "自研芯片 2027年或占25% — 主要蚕食推理市场",
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.8)",
    animate: true,
  }, "Text: self-developed forecast", 138000, { expect: { x: 828, y: 281 } }),

  // 138s: Clear
  t(138000, { type: "clear" }, "Clear for conclusion"),

  // ============================================================================
  // ACT 7: CONCLUSION (140s - 165s) — progress bars, counter, summary card
  // ============================================================================

  // 140s: Spotlight subtitle area (covers title + subtitle + space for content below)
  t(140000, {
    type: "spotlight",
    region: { targetId: "subtitle", padding: 200 },
    maskOpacity: 0.4,
    borderRadius: 20,
    animate: true,
  }, "Wide spotlight for conclusion content", 163000),

  // 141s: Summary card below title
  t(141000, {
    type: "card",
    position: { targetId: "title", placement: "below-start", offsetY: 16 },
    width: 440,
    title: "结论：三足鼎立，但王座稳固",
    content: "短期(1-2年): NVIDIA 霸主地位不变\n中期(3-5年): AMD + 自研蚕食边缘市场\n长期(5-10年): 生态壁垒决定最终胜负",
    tag: "投资结论",
    tagColor: "#F59E0B",
    enterFrom: "bottom",
    animate: true,
    borderColor: "rgba(245, 158, 11, 0.3)",
  }, "Summary card: conclusion", 163000, { expect: { x: 288, y: 98 } }),

  // 145s: Progress bars — market share forecasts
  t(145000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 180 },
    width: 400,
    value: 80,
    color: "#76B900",
    showLabel: true,
    label: "NVIDIA 2024: 80%",
    animate: true,
  }, "Progress: NVIDIA 2024", 153000, { expect: { x: 288, y: 262 } }),

  t(146000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 212 },
    width: 400,
    value: 65,
    color: "#76B900",
    showLabel: true,
    label: "NVIDIA 2027E: 65%",
    animate: true,
  }, "Progress: NVIDIA 2027", 153000, { expect: { x: 288, y: 294 } }),

  t(147000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 244 },
    width: 400,
    value: 20,
    color: "#ED1C24",
    showLabel: true,
    label: "AMD 2027E: 20%",
    animate: true,
  }, "Progress: AMD 2027", 153000, { expect: { x: 288, y: 326 } }),

  t(148000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 276 },
    width: 400,
    value: 15,
    color: "#6366F1",
    showLabel: true,
    label: "自研 2027E: 15%",
    animate: true,
  }, "Progress: Custom 2027", 153000, { expect: { x: 288, y: 358 } }),

  // 150s: Counter — total market size (below progress bars, right-aligned)
  t(150000, {
    type: "counter",
    position: { targetId: "title", placement: "below-start", offsetY: 310, offsetX: 660 },
    value: 400,
    prefix: "$",
    suffix: "B",
    color: "#F59E0B",
    fontSize: 48,
    animate: true,
  }, "Counter: $400B market by 2027", 163000, { expect: { x: 948, y: 392 } }),

  // 153.5s: Badge labeling counter (after progress bars end at 153s)
  t(153500, {
    type: "badge",
    position: { targetId: "title", placement: "below-start", offsetY: 196 },
    text: "2027年AI芯片市场规模预测",
    color: "#FFFFFF",
    background: "rgba(245, 158, 11, 0.85)",
    size: "lg",
    animate: true,
  }, "Badge: market size label", 156000, { expect: { x: 288, y: 244 } }),

  // 154s: Trendline showing market growth (stays below subtitle Y>110)
  t(154000, {
    type: "trendline",
    points: [
      { x: 580, y: 200 },
      { x: 640, y: 185 },
      { x: 700, y: 165 },
      { x: 760, y: 140 },
      { x: 820, y: 110 },
    ],
    color: "#F59E0B",
    strokeWidth: 3,
    showDots: true,
    dotRadius: 4,
    fillBelow: "rgba(245, 158, 11, 0.1)",
    endArrow: true,
    animate: true,
  }, "Trendline: market growth", 158000),

  // 157s: Highlight analysis section for final call (high opacity to pierce spotlight mask)
  t(157000, {
    type: "highlight",
    region: { targetId: "analysis", padding: 8 },
    color: "#F59E0B",
    opacity: 0.35,
    borderRadius: 12,
    animate: true,
  }, "Highlight analysis area", 163000, { expect: { x: 280, y: 376 } }),

  // 159s: Circle card-nvidia to emphasize winner
  t(159000, {
    type: "circle",
    center: { targetId: "card-nvidia", anchor: "center" },
    radius: 60,
    color: "#76B900",
    strokeWidth: 3,
    animate: true,
  }, "Circle NVIDIA card — winner", 163000, { expect: { x: 362, y: 133 } }),

  // 163s: Clear for finale
  t(163000, { type: "clear" }, "Clear for finale"),

  // ============================================================================
  // ACT 8: END (165s - 180s) — final typewriter + text + farewell
  // ============================================================================

  // 165s: Spotlight on title for finale weight
  t(165000, {
    type: "spotlight",
    region: { targetId: "subtitle", padding: 120 },
    maskOpacity: 0.45,
    borderRadius: 16,
    animate: true,
  }, "Final spotlight for closing", 177000),

  // 165.5s: Final typewriter — investment thesis
  t(165500, {
    type: "typewriter",
    position: { targetId: "title", placement: "below-start", offsetY: 20 },
    content: "CUDA生态 = 15年的护城河，一时半会填不平。",
    fontSize: 18,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.85)",
    speed: "slow",
    animate: true,
  }, "Typewriter: final thesis", 177000, { expect: { x: 288, y: 102 } }),

  // 168s: Second typewriter line
  t(168000, {
    type: "typewriter",
    position: { targetId: "title", placement: "below-start", offsetY: 62 },
    content: "短期看产能，中期看生态，长期看创新。",
    fontSize: 16,
    fontWeight: 600,
    color: "#F59E0B",
    background: "rgba(0, 0, 0, 0.8)",
    speed: "normal",
    animate: true,
  }, "Typewriter: three timeframes", 177000, { expect: { x: 288, y: 144 } }),

  // 171s: Badge — final recommendation (below both typewriters)
  t(171000, {
    type: "badge",
    position: { targetId: "title", placement: "below-start", offsetY: 136 },
    text: "维持 OVERWEIGHT 评级",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.9)",
    size: "lg",
    animate: true,
  }, "Badge: maintain overweight", 177000, { expect: { x: 288, y: 184 } }),

  // 173s: Pulse on subtitle — final flourish
  t(173000, {
    type: "pulse",
    center: { targetId: "subtitle", anchor: "center" },
    radius: 30,
    color: "#F59E0B",
    rings: 2,
    animate: true,
  }, "Pulse: final focus", 177000, { expect: { x: 678, y: 62 } }),

  // 177s: Clear for end card
  t(177000, { type: "clear" }, "Final clear"),

  // 177.5s: End card — centered thank you
  t(177500, {
    type: "text",
    position: { targetId: "title", placement: "below", offsetY: 100 },
    content: "感谢观看",
    fontSize: 32,
    fontWeight: 800,
    color: "#FFFFFF",
    background: "linear-gradient(135deg, #6366F1, #EC4899)",
    textAlign: "center",
    animate: true,
  }, "End screen: thank you", undefined, { expect: { x: 656, y: 182 } }),

  // 178s: Badge below end text
  t(178000, {
    type: "badge",
    position: { targetId: "title", placement: "below", offsetY: 160 },
    text: "@viben/presentation demo",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.7)",
    size: "md",
    animate: true,
  }, "Badge: credits", undefined, { expect: { x: 708, y: 214 } }),

  // ============================================================================
  // ACT 9: ENHANCED VISUALIZATIONS (182s - 240s) — Showcasing cinematic overlays
  // ============================================================================

  // 182s: Clear for new section
  t(182000, { type: "clear" }, "Clear for enhanced visualization types"),

  // 183s: Countdown — dramatic 3-2-1-GO! transition
  t(183000, {
    type: "countdown",
    position: { x: 512, y: 384 },
    from: 3,
    color: "#FFFFFF",
    fontSize: 120,
  }, "Countdown: dramatic transition", 188000),

  // 188s: Confetti burst to celebrate
  t(188000, {
    type: "confetti",
    position: { x: 512, y: 300 },
    count: 60,
    spread: 280,
    colors: ["#76B900", "#6366F1", "#F59E0B", "#EC4899", "#4ECDC4", "#FF6B6B"],
  }, "Confetti: celebration burst", 192000),

  // 188.5s: Callout — section intro
  t(188500, {
    type: "callout",
    position: { x: 380, y: 200 },
    content: "12 enhanced data overlays with cinematic spring animations",
    arrowDirection: "bottom",
    maxWidth: 280,
  }, "Callout: section intro", 192000),

  // 192s: Clear for data viz section
  t(192000, { type: "clear" }, "Clear for data viz section"),

  // 193s: KPI card — Revenue metric with sparkline
  t(193000, {
    type: "kpi",
    position: { x: 60, y: 80 },
    value: 26000,
    label: "QUARTERLY REVENUE",
    trend: "up",
    trendValue: "+265%",
    sparkData: [7200, 10500, 13500, 16200, 18100, 22100, 26000],
    color: "#76B900",
  }, "KPI: NVIDIA quarterly revenue", 202000),

  // 193.5s: Gauge — GPU utilization
  t(193500, {
    type: "gauge",
    position: { x: 340, y: 80 },
    value: 92,
    radius: 65,
    label: "GPU Utilization",
    color: "#6366F1",
  }, "Gauge: GPU cluster utilization", 202000),

  // 194s: StatCard — Before vs After optimization
  t(194000, {
    type: "stat-card",
    position: { x: 560, y: 80 },
    label: "Training Throughput",
    before: 1200,
    after: 3400,
    unit: " TFLOPS",
    color: "#EC4899",
  }, "StatCard: training throughput improvement", 202000),

  // 196s: Sparkline — Stock price trend
  t(196000, {
    type: "sparkline",
    position: { x: 60, y: 340 },
    data: [450, 480, 520, 490, 580, 620, 710, 680, 750, 820, 790, 880, 920],
    width: 200,
    height: 60,
    color: "#76B900",
    fill: true,
    showEndDot: true,
  }, "Sparkline: NVIDIA stock trend", 202000),

  // 197s: Radar — Competitive analysis
  t(197000, {
    type: "radar",
    position: { x: 320, y: 300 },
    axes: [
      { label: "Performance", value: 95 },
      { label: "Ecosystem", value: 92 },
      { label: "Power Eff.", value: 78 },
      { label: "Price/Perf", value: 70 },
      { label: "Availability", value: 65 },
      { label: "Software", value: 98 },
    ],
    color: "#76B900",
    size: 200,
  }, "Radar: NVIDIA competitive analysis", 202000),

  // 202s: Clear for waterfall + funnel section
  t(202000, { type: "clear" }, "Clear for waterfall + funnel"),

  // 203s: Waterfall — Revenue bridge
  t(203000, {
    type: "waterfall",
    position: { x: 60, y: 80 },
    data: [
      { label: "Base", value: 7200, type: "total" },
      { label: "DC", value: 14800, type: "increase" },
      { label: "Gaming", value: 2800, type: "increase" },
      { label: "Auto", value: 1600, type: "increase" },
      { label: "Costs", value: -4200, type: "decrease" },
      { label: "Net", value: 22200, type: "total" },
    ],
    width: 400,
    height: 240,
  }, "Waterfall: revenue bridge Q1 to Q4", 212000),

  // 204s: Funnel — Sales pipeline
  t(204000, {
    type: "funnel",
    position: { x: 520, y: 80 },
    stages: [
      { label: "Leads", value: 50000, color: "#6366F1" },
      { label: "Qualified", value: 28000, color: "#8B5CF6" },
      { label: "Proposals", value: 12000, color: "#A855F7" },
      { label: "Negotiation", value: 6500, color: "#D946EF" },
      { label: "Closed Won", value: 3200, color: "#EC4899" },
    ],
    width: 260,
    height: 280,
  }, "Funnel: enterprise sales pipeline", 212000),

  // 207s: Timeline — Product roadmap
  t(207000, {
    type: "timeline",
    position: { x: 60, y: 380 },
    events: [
      { label: "H100", description: "Launch", active: false, color: "#76B900" },
      { label: "H200", description: "Upgrade", active: true, color: "#76B900" },
      { label: "B100", description: "2025", color: "#F59E0B" },
      { label: "B200", description: "2026E", color: "#6366F1" },
    ],
    direction: "horizontal",
    width: 480,
    color: "#76B900",
  }, "Timeline: NVIDIA GPU roadmap", 212000),

  // 212s: Clear for heatmap section
  t(212000, { type: "clear" }, "Clear for heatmap section"),

  // 213s: Heatmap — Performance across workloads
  t(213000, {
    type: "heatmap",
    position: { x: 60, y: 100 },
    data: [
      [0.95, 0.88, 0.92, 0.78, 0.85],
      [0.70, 0.82, 0.65, 0.90, 0.75],
      [0.45, 0.55, 0.50, 0.60, 0.48],
      [0.30, 0.40, 0.35, 0.45, 0.38],
    ],
    cellSize: 36,
    rowLabels: ["H100", "MI300X", "Gaudi3", "910B"],
    colLabels: ["LLM", "Vision", "RL", "Diffusion", "MoE"],
    colors: ["#1a1a3e", "#76B900"],
  }, "Heatmap: chip performance across AI workloads", 222000),

  // 215s: Callout on heatmap insight
  t(215000, {
    type: "callout",
    position: { x: 360, y: 120 },
    content: "H100 dominates across all workloads, with >90% efficiency on LLM and RL tasks",
    arrowDirection: "left",
    maxWidth: 260,
  }, "Callout: heatmap insight", 222000),

  // 217s: KPI — Data center market
  t(217000, {
    type: "kpi",
    position: { x: 360, y: 280 },
    value: 400,
    label: "TAM 2027E ($B)",
    trend: "up",
    trendValue: "+35% CAGR",
    sparkData: [120, 150, 195, 250, 310, 400],
    color: "#F59E0B",
  }, "KPI: total addressable market", 222000),

  // 219s: Gauge — Market confidence
  t(219000, {
    type: "gauge",
    position: { x: 360, y: 420 },
    value: 85,
    radius: 55,
    label: "Analyst Confidence",
    color: "#10B981",
  }, "Gauge: analyst confidence score", 222000),

  // 222s: Clear
  t(222000, { type: "clear" }, "Clear for finale visualizations"),

  // 223s: Confetti — final celebration
  t(223000, {
    type: "confetti",
    position: { x: 512, y: 384 },
    count: 80,
    spread: 350,
    colors: ["#76B900", "#6366F1", "#EC4899", "#F59E0B", "#4ECDC4"],
  }, "Confetti: final celebration", 228000),

  // 224s: StatCard — Investment return
  t(224000, {
    type: "stat-card",
    position: { x: 300, y: 200 },
    label: "12-Month Return",
    before: 100,
    after: 365,
    unit: "%",
    color: "#76B900",
  }, "StatCard: NVIDIA 12-month return", 230000),

  // ============================================================================
  // ACT 10: FULL TYPE SHOWCASE (230s - 330s) — All remaining overlay types
  // ============================================================================

  // 230s: Clear
  t(230000, { type: "clear" }, "Clear for full type showcase"),

  // --- SECTION A: Structural & Narrative (230s - 260s) ---

  // 231s: Table — chip specs comparison
  t(231000, {
    type: "table",
    position: { x: 60, y: 80 },
    headers: ["芯片", "算力 (TFLOPS)", "显存", "功耗"],
    rows: [
      ["H100", "1979", "80GB HBM3", "700W"],
      ["MI300X", "1307", "192GB HBM3", "750W"],
      ["Gaudi3", "1835", "128GB HBM2e", "600W"],
      ["TPU v5e", "~400", "16GB HBM", "200W"],
    ],
    highlights: [[0, 1], [1, 2]],
    headerColor: "#6366F1",
    rowStagger: 6,
  }, "Table: chip specs comparison", 241000),

  // 233s: List — NVIDIA competitive advantages
  t(233000, {
    type: "list",
    position: { x: 560, y: 80 },
    items: [
      { text: "CUDA 400万开发者生态", icon: "🟢", color: "#76B900" },
      { text: "NVLink 900GB/s 互联带宽", icon: "⚡", color: "#F59E0B" },
      { text: "全栈AI推理优化 (TensorRT)", icon: "🔧", color: "#6366F1" },
      { text: "cuDNN + NCCL 深度优化", icon: "📦", color: "#EC4899" },
      { text: "Blackwell 架构2025量产", icon: "🚀", color: "#10B981" },
    ],
    listStyle: "arrow",
    fontSize: 14,
    stagger: 8,
  }, "List: NVIDIA advantages", 241000),

  // 236s: Flowchart — AI chip supply chain
  t(236000, {
    type: "flowchart",
    position: { x: 60, y: 380 },
    nodes: [
      { id: "design", label: "芯片设计", color: "#6366F1" },
      { id: "fab", label: "台积电代工", color: "#F59E0B" },
      { id: "pkg", label: "封装测试", color: "#EC4899" },
      { id: "dc", label: "数据中心", color: "#76B900" },
    ],
    edges: [
      { from: "design", to: "fab", label: "3nm" },
      { from: "fab", to: "pkg", label: "CoWoS" },
      { from: "pkg", to: "dc", label: "部署" },
    ],
    direction: "horizontal",
    width: 520,
    height: 100,
  }, "Flowchart: AI chip supply chain", 245000),

  // 241s: Clear
  t(241000, { type: "clear" }, "Clear for donut + treemap"),

  // 242s: Donut — revenue breakdown
  t(242000, {
    type: "donut",
    position: { x: 100, y: 140 },
    segments: [
      { label: "数据中心", value: 18.4, color: "#76B900" },
      { label: "游戏", value: 2.9, color: "#6366F1" },
      { label: "专业可视化", value: 1.5, color: "#F59E0B" },
      { label: "汽车", value: 0.3, color: "#EC4899" },
      { label: "OEM/其他", value: 2.9, color: "#10B981" },
    ],
    size: 200,
    innerRatio: 0.55,
  }, "Donut: NVIDIA revenue breakdown ($B)", 252000),

  // 243s: Treemap — GPU market segments
  t(243000, {
    type: "treemap",
    position: { x: 420, y: 80 },
    data: [
      { label: "训练", value: 60, color: "#76B900" },
      { label: "推理", value: 25, color: "#6366F1" },
      { label: "边缘AI", value: 8, color: "#F59E0B" },
      { label: "自动驾驶", value: 4, color: "#EC4899" },
      { label: "机器人", value: 3, color: "#10B981" },
    ],
    width: 360,
    height: 220,
  }, "Treemap: AI compute market segments", 252000),

  // 246s: Ribbon — award badge
  t(246000, {
    type: "ribbon",
    position: { x: 160, y: 400 },
    text: "2024 年度最佳AI芯片",
    width: 260,
    color: "#76B900",
    textColor: "#FFFFFF",
    fontSize: 15,
    variant: "award",
  }, "Ribbon: best AI chip award", 252000),

  // 248s: Tooltip on donut
  t(248000, {
    type: "tooltip",
    position: { x: 100, y: 90 },
    content: "数据中心业务占比 71%，同比增长 409%",
    direction: "bottom",
    background: "rgba(118, 185, 0, 0.9)",
    color: "#FFFFFF",
    maxWidth: 220,
    fontSize: 13,
  }, "Tooltip: data center dominance", 252000),

  // 252s: Clear
  t(252000, { type: "clear" }, "Clear for scatter + matrix"),

  // --- SECTION B: Advanced Data (252s - 280s) ---

  // 253s: Scatter — performance vs price
  t(253000, {
    type: "scatter",
    position: { x: 60, y: 80 },
    points: [
      { x: 95, y: 90, label: "H100", color: "#76B900", size: 10 },
      { x: 85, y: 70, label: "MI300X", color: "#ED1C24", size: 8 },
      { x: 60, y: 45, label: "Gaudi3", color: "#0071C5", size: 7 },
      { x: 40, y: 30, label: "TPU v5e", color: "#4285F4", size: 6 },
      { x: 50, y: 35, label: "昇腾910B", color: "#CF0A2C", size: 6 },
      { x: 75, y: 55, label: "B100", color: "#76B900", size: 9 },
    ],
    width: 340,
    height: 260,
    color: "#6366F1",
    dotRadius: 6,
    xLabel: "性能 (相对值)",
    yLabel: "性价比",
    showGrid: true,
  }, "Scatter: chip performance vs price", 263000),

  // 254s: Matrix — feature comparison
  t(254000, {
    type: "matrix",
    position: { x: 460, y: 80 },
    columns: ["FP8", "稀疏", "NVLink", "HBM3e", "液冷"],
    rows: [
      { label: "H100", values: ["yes", "yes", "yes", "no", "partial"] },
      { label: "H200", values: ["yes", "yes", "yes", "yes", "yes"] },
      { label: "MI300X", values: ["yes", "yes", "no", "no", "yes"] },
      { label: "Gaudi3", values: ["yes", "partial", "no", "no", "yes"] },
    ],
    width: 420,
  }, "Matrix: chip feature comparison", 263000),

  // 258s: Meter — power efficiency
  t(258000, {
    type: "meter",
    position: { x: 60, y: 420 },
    value: 78,
    min: 0,
    max: 100,
    width: 300,
    label: "能效比 (TFLOPS/W)",
    color: "#10B981",
    ticks: 5,
    unit: "%",
    showNeedle: true,
  }, "Meter: power efficiency rating", 263000),

  // 259s: BadgeGroup — ecosystem tags
  t(259000, {
    type: "badge-group",
    position: { x: 460, y: 380 },
    badges: [
      { text: "CUDA", background: "#76B900", color: "#fff" },
      { text: "PyTorch", background: "#EE4C2C", color: "#fff" },
      { text: "TensorFlow", background: "#FF6F00", color: "#fff" },
      { text: "JAX", background: "#4285F4", color: "#fff" },
      { text: "Triton", background: "#6366F1", color: "#fff" },
      { text: "ONNX", background: "#005CED", color: "#fff" },
    ],
    layout: "grid",
    gap: 10,
    columns: 3,
  }, "BadgeGroup: AI framework ecosystem", 263000),

  // 263s: Clear
  t(263000, { type: "clear" }, "Clear for polar + stacked"),

  // 264s: PolarArea — regional market share
  t(264000, {
    type: "polar-area",
    position: { x: 100, y: 180 },
    segments: [
      { label: "北美", value: 45, color: "#76B900" },
      { label: "中国", value: 25, color: "#ED1C24" },
      { label: "欧洲", value: 15, color: "#6366F1" },
      { label: "日韩", value: 10, color: "#F59E0B" },
      { label: "其他", value: 5, color: "#10B981" },
    ],
    size: 220,
  }, "PolarArea: regional AI chip market", 274000),

  // 265s: StackedBar — vendor revenue by segment
  t(265000, {
    type: "stacked-bar",
    position: { x: 400, y: 100 },
    bars: [
      { label: "NVIDIA", segments: [{ value: 60, color: "#76B900", label: "训练" }, { value: 20, color: "#6366F1", label: "推理" }] },
      { label: "AMD", segments: [{ value: 5, color: "#76B900", label: "训练" }, { value: 7, color: "#6366F1", label: "推理" }] },
      { label: "Intel", segments: [{ value: 1, color: "#76B900", label: "训练" }, { value: 3, color: "#6366F1", label: "推理" }] },
      { label: "Google", segments: [{ value: 8, color: "#76B900", label: "训练" }, { value: 5, color: "#6366F1", label: "推理" }] },
    ],
    width: 380,
    barHeight: 36,
    gap: 14,
  }, "StackedBar: revenue by training vs inference ($B)", 274000),

  // 269s: AnnotationGroup — key insights
  t(269000, {
    type: "annotation-group",
    position: { x: 400, y: 380 },
    items: [
      { label: "训练市场: NVIDIA 81%", color: "#76B900" },
      { label: "推理市场: 竞争加剧", color: "#6366F1" },
      { label: "边缘市场: 碎片化", color: "#F59E0B" },
    ],
    direction: "vertical",
    connector: "bracket",
  }, "AnnotationGroup: market insights", 274000),

  // 274s: Clear
  t(274000, { type: "clear" }, "Clear for code + effects"),

  // --- SECTION C: Code & Effects (274s - 305s) ---

  // 275s: CodeBlock — CUDA kernel example
  t(275000, {
    type: "code-block",
    position: { x: 60, y: 80 },
    code: `__global__ void matmul(float* A, float* B, float* C, int N) {
  int row = blockIdx.y * blockDim.y + threadIdx.y;
  int col = blockIdx.x * blockDim.x + threadIdx.x;
  float sum = 0.0f;
  for (int k = 0; k < N; k++)
    sum += A[row*N + k] * B[k*N + col];
  C[row*N + col] = sum;
}`,
    language: "cuda",
    highlightLines: [3, 4, 5, 6],
  }, "CodeBlock: CUDA matrix multiply kernel", 285000),

  // 277s: Morph — market cap growth
  t(277000, {
    type: "morph",
    position: { x: 560, y: 120 },
    from: "$1.2T",
    to: "$3.4T",
    color: "#76B900",
    fontSize: 64,
  }, "Morph: NVIDIA market cap growth", 283000),

  // 278s: Callout explaining morph
  t(278000, {
    type: "callout",
    position: { x: 560, y: 240 },
    content: "NVIDIA 市值在12个月内从 $1.2T 增长到 $3.4T，涨幅 183%",
    arrowDirection: "top",
    maxWidth: 260,
    background: "rgba(118, 185, 0, 0.9)",
    color: "#FFFFFF",
  }, "Callout: market cap context", 285000),

  // 281s: Reveal — unveil hidden insight
  t(281000, {
    type: "reveal",
    region: { x: 560, y: 320, width: 300, height: 120 },
    direction: "left",
    color: "#6366F1",
  }, "Reveal: hidden insight area", 285000),

  // 282s: Zoom — magnify a detail
  t(282000, {
    type: "zoom",
    region: { targetId: "nvidia-value", padding: 20 },
    scale: 2.5,
    borderColor: "#76B900",
  }, "Zoom: magnify NVIDIA value", 285000),

  // 285s: Clear
  t(285000, { type: "clear" }, "Clear for sankey"),

  // --- SECTION D: Sankey & Complex (285s - 310s) ---

  // 286s: Sankey — capital flow
  t(286000, {
    type: "sankey",
    position: { x: 80, y: 100 },
    nodes: [
      { id: "capex", label: "云厂商 CapEx" },
      { id: "nvidia", label: "NVIDIA" },
      { id: "amd", label: "AMD" },
      { id: "custom", label: "自研芯片" },
      { id: "training", label: "训练集群" },
      { id: "inference", label: "推理服务" },
    ],
    links: [
      { source: "capex", target: "nvidia", value: 65 },
      { source: "capex", target: "amd", value: 15 },
      { source: "capex", target: "custom", value: 20 },
      { source: "nvidia", target: "training", value: 50 },
      { source: "nvidia", target: "inference", value: 15 },
      { source: "amd", target: "inference", value: 12 },
      { source: "amd", target: "training", value: 3 },
      { source: "custom", target: "inference", value: 18 },
      { source: "custom", target: "training", value: 2 },
    ],
    width: 500,
    height: 320,
  }, "Sankey: AI chip capital flow", 298000),

  // 288s: KPI trio — right side
  t(288000, {
    type: "kpi",
    position: { x: 640, y: 100 },
    value: 65,
    label: "NVIDIA 2027 份额",
    trend: "down",
    trendValue: "-15pp",
    sparkData: [92, 88, 84, 80, 75, 70, 65],
    color: "#76B900",
  }, "KPI: NVIDIA 2027 forecast share", 298000),

  t(290000, {
    type: "kpi",
    position: { x: 640, y: 240 },
    value: 20,
    label: "AMD 2027 份额",
    trend: "up",
    trendValue: "+8pp",
    sparkData: [4, 7, 10, 12, 15, 18, 20],
    color: "#ED1C24",
  }, "KPI: AMD 2027 forecast share", 298000),

  t(292000, {
    type: "kpi",
    position: { x: 640, y: 380 },
    value: 15,
    label: "自研 2027 份额",
    trend: "up",
    trendValue: "+10pp",
    sparkData: [2, 4, 5, 8, 10, 12, 15],
    color: "#6366F1",
  }, "KPI: Custom silicon 2027 forecast", 298000),

  // 298s: Clear
  t(298000, { type: "clear" }, "Clear for finale showcase"),

  // --- SECTION E: Grand Finale (298s - 320s) ---

  // 299s: Countdown for finale
  t(299000, {
    type: "countdown",
    position: { x: 512, y: 384 },
    from: 3,
    color: "#F59E0B",
    fontSize: 140,
  }, "Countdown: grand finale", 304000),

  // 304s: Confetti — grand finale celebration
  t(304000, {
    type: "confetti",
    position: { x: 512, y: 300 },
    count: 100,
    spread: 400,
    colors: ["#76B900", "#6366F1", "#F59E0B", "#EC4899", "#10B981", "#4ECDC4"],
  }, "Confetti: grand finale celebration", 310000),

  // 305s: Morph — final statement
  t(305000, {
    type: "morph",
    position: { x: 512, y: 200 },
    from: "47",
    to: "47 Types",
    color: "#FFFFFF",
    fontSize: 72,
  }, "Morph: all 47 overlay types", 312000),

  // 306s: Text — subtitle
  t(306000, {
    type: "text",
    position: { x: 512, y: 320 },
    content: "@viben/presentation — 完整覆盖所有动画类型",
    fontSize: 20,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "linear-gradient(135deg, #6366F1, #76B900)",
    textAlign: "center",
    animate: true,
  }, "Text: all types covered", 315000),

  // 308s: BadgeGroup — type categories
  t(308000, {
    type: "badge-group",
    position: { x: 312, y: 400 },
    badges: [
      { text: "基础注释 ×16", background: "#76B900", color: "#fff" },
      { text: "数据可视化 ×12", background: "#6366F1", color: "#fff" },
      { text: "叙事结构 ×10", background: "#F59E0B", color: "#fff" },
      { text: "交互效果 ×9", background: "#EC4899", color: "#fff" },
    ],
    layout: "flow",
    gap: 12,
  }, "BadgeGroup: type categories summary", 315000),

  // 312s: Pulse — final focus
  t(312000, {
    type: "pulse",
    center: { x: 512, y: 200 },
    radius: 40,
    color: "#F59E0B",
    rings: 3,
    animate: true,
  }, "Pulse: final emphasis", 315000),

  // 315s: Clear
  t(315000, { type: "clear" }, "Final clear - showcase complete"),

  // 316s: End card
  t(316000, {
    type: "text",
    position: { x: 512, y: 350 },
    content: "DEMO COMPLETE",
    fontSize: 36,
    fontWeight: 900,
    color: "#FFFFFF",
    background: "linear-gradient(135deg, #76B900, #6366F1, #EC4899)",
    textAlign: "center",
    animate: true,
  }, "End card: demo complete"),

  t(317000, {
    type: "badge",
    position: { x: 512, y: 420 },
    text: "47 overlay types • Remotion-powered • 60fps",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.8)",
    size: "lg",
    animate: true,
  }, "Badge: final tagline"),
]

// Auto-compute total duration from steps
TOTAL_DURATION_MS = Math.max(
  ...demoSteps.map((s) => Math.max(s.startMs, s.endMs ?? s.startMs))
) + 2500 // +2.5s buffer after last event
