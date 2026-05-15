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
  // ACT 9: NEW VISUALIZATION TYPES (182s - 240s) — Showcasing new overlay types
  // ============================================================================

  // 182s: Clear for new section
  t(182000, { type: "clear" }, "Clear for new visualization types"),

  // 183s: Ribbon — Award banner
  t(183000, {
    type: "ribbon",
    position: { x: 380, y: 40 },
    text: "NEW VISUALIZATION TYPES",
    width: 280,
    color: "#6366F1",
    textColor: "#FFFFFF",
    fontSize: 14,
    variant: "award",
  }, "Ribbon: section header", 192000),

  // 184s: Tooltip — Explaining something
  t(184000, {
    type: "tooltip",
    position: { x: 520, y: 100 },
    content: "Seven powerful new overlay types for data storytelling",
    direction: "bottom",
    color: "#FFFFFF",
    maxWidth: 220,
    fontSize: 12,
  }, "Tooltip: description", 192000),

  // 185s: Badge Group — Technology stack
  t(185000, {
    type: "badge-group",
    position: { x: 60, y: 140 },
    badges: [
      { text: "Ribbon", background: "#6366F1", color: "#FFFFFF" },
      { text: "Polar Area", background: "#EC4899", color: "#FFFFFF" },
      { text: "Stacked Bar", background: "#F59E0B", color: "#000000" },
      { text: "Tooltip", background: "#10B981", color: "#FFFFFF" },
      { text: "Badge Group", background: "#3B82F6", color: "#FFFFFF" },
      { text: "Scatter", background: "#EF4444", color: "#FFFFFF" },
      { text: "Meter", background: "#8B5CF6", color: "#FFFFFF" },
    ],
    layout: "flow",
    gap: 8,
  }, "BadgeGroup: new types list", 192000),

  // 192s: Clear for charts section
  t(192000, { type: "clear" }, "Clear for polar area + scatter"),

  // 193s: Polar Area Chart — Market segments
  t(193000, {
    type: "polar-area",
    position: { x: 60, y: 80 },
    segments: [
      { label: "GPU", value: 80, color: "#76B900" },
      { label: "TPU", value: 45, color: "#4285F4" },
      { label: "FPGA", value: 30, color: "#F59E0B" },
      { label: "ASIC", value: 55, color: "#EC4899" },
      { label: "NPU", value: 35, color: "#6366F1" },
    ],
    size: 220,
  }, "PolarArea: chip types market", 204000),

  // 194s: Scatter Plot — Performance vs Cost
  t(194000, {
    type: "scatter",
    position: { x: 360, y: 80 },
    points: [
      { x: 95, y: 92, label: "H100", color: "#76B900", size: 7 },
      { x: 80, y: 78, label: "A100", color: "#76B900", size: 5 },
      { x: 70, y: 85, label: "MI300X", color: "#ED1C24", size: 6 },
      { x: 55, y: 60, label: "MI250", color: "#ED1C24", size: 4 },
      { x: 45, y: 50, label: "Gaudi3", color: "#0071C5", size: 5 },
      { x: 85, y: 70, label: "TPUv5", color: "#4285F4", size: 6 },
      { x: 30, y: 40, label: "910B", color: "#CF0A2C", size: 4 },
      { x: 60, y: 55, label: "Trainium2", color: "#FF9900", size: 5 },
    ],
    width: 300,
    height: 240,
    color: "#6366F1",
    dotRadius: 5,
    xLabel: "Performance Score",
    yLabel: "Cost Efficiency",
    showGrid: true,
  }, "Scatter: performance vs cost", 204000),

  // 196s: Meter — GPU utilization
  t(196000, {
    type: "meter",
    position: { x: 360, y: 360 },
    value: 87,
    min: 0,
    max: 100,
    width: 300,
    label: "GPU Cluster Utilization",
    color: "#76B900",
    ticks: 5,
    unit: "%",
    showNeedle: true,
  }, "Meter: GPU utilization", 204000),

  // 198s: Ribbon — Performance award
  t(198000, {
    type: "ribbon",
    position: { x: 60, y: 370 },
    text: "PERFORMANCE LEADER",
    width: 200,
    color: "#76B900",
    textColor: "#FFFFFF",
    fontSize: 12,
    variant: "award",
  }, "Ribbon: performance leader award", 204000),

  // 204s: Clear for stacked bar section
  t(204000, { type: "clear" }, "Clear for stacked bar section"),

  // 205s: Stacked Bar — Revenue breakdown
  t(205000, {
    type: "stacked-bar",
    position: { x: 60, y: 80 },
    bars: [
      {
        label: "NVIDIA",
        segments: [
          { value: 18, color: "#76B900", label: "DC" },
          { value: 4, color: "#9ACD32", label: "Gaming" },
          { value: 2, color: "#B8D86F", label: "Auto" },
          { value: 2, color: "#D4E89A", label: "Other" },
        ],
      },
      {
        label: "AMD",
        segments: [
          { value: 3.5, color: "#ED1C24", label: "DC" },
          { value: 2, color: "#FF4444", label: "Gaming" },
          { value: 1.5, color: "#FF7777", label: "Embedded" },
          { value: 1, color: "#FF9999", label: "Other" },
        ],
      },
      {
        label: "Intel",
        segments: [
          { value: 1, color: "#0071C5", label: "DC AI" },
          { value: 6, color: "#3399DD", label: "Client" },
          { value: 4, color: "#66BBEE", label: "DC Gen" },
          { value: 2, color: "#99DDFF", label: "Other" },
        ],
      },
    ],
    width: 380,
    barHeight: 36,
    gap: 16,
  }, "StackedBar: revenue breakdown by segment", 216000),

  // 207s: Tooltip on stacked bar
  t(207000, {
    type: "tooltip",
    position: { x: 320, y: 80 },
    content: "NVIDIA Data Center revenue dominates at $18B/quarter, more than 2x all competitors combined.",
    direction: "right",
    maxWidth: 240,
    fontSize: 11,
  }, "Tooltip: NVIDIA DC revenue note", 216000),

  // 209s: Meter — Training throughput
  t(209000, {
    type: "meter",
    position: { x: 60, y: 300 },
    value: 3200,
    min: 0,
    max: 4000,
    width: 320,
    label: "Training Throughput (TFLOPS)",
    color: "#EC4899",
    ticks: 4,
    unit: "",
    showNeedle: true,
  }, "Meter: training throughput", 216000),

  // 211s: Meter — Inference latency
  t(211000, {
    type: "meter",
    position: { x: 60, y: 430 },
    value: 2.4,
    min: 0,
    max: 10,
    width: 320,
    label: "Inference Latency",
    color: "#10B981",
    ticks: 5,
    unit: "ms",
    showNeedle: true,
  }, "Meter: inference latency", 216000),

  // 213s: Badge group with key stats
  t(213000, {
    type: "badge-group",
    position: { x: 540, y: 300 },
    badges: [
      { text: "$26B Revenue", background: "#76B900", color: "#FFFFFF" },
      { text: "+265% YoY", background: "#F59E0B", color: "#000000" },
      { text: "80% Share", background: "#6366F1", color: "#FFFFFF" },
      { text: "#1 AI Chip", background: "#EC4899", color: "#FFFFFF" },
    ],
    layout: "grid",
    columns: 2,
    gap: 8,
  }, "BadgeGroup: key stats", 216000),

  // 216s: Clear for grand finale
  t(216000, { type: "clear" }, "Clear for visualization finale"),

  // 217s: Polar Area — Investment allocation
  t(217000, {
    type: "polar-area",
    position: { x: 60, y: 100 },
    segments: [
      { label: "R&D", value: 90, color: "#6366F1" },
      { label: "CapEx", value: 70, color: "#EC4899" },
      { label: "Talent", value: 60, color: "#F59E0B" },
      { label: "M&A", value: 40, color: "#10B981" },
      { label: "Marketing", value: 25, color: "#3B82F6" },
      { label: "Legal", value: 15, color: "#8B5CF6" },
    ],
    size: 200,
  }, "PolarArea: investment allocation", 228000),

  // 218s: Scatter — AI chip generations
  t(218000, {
    type: "scatter",
    position: { x: 340, y: 100 },
    points: [
      { x: 2020, y: 20, label: "A100", color: "#76B900", size: 5 },
      { x: 2021, y: 35, label: "H100", color: "#76B900", size: 6 },
      { x: 2022, y: 50, label: "H200", color: "#76B900", size: 7 },
      { x: 2023, y: 75, label: "B100", color: "#76B900", size: 8 },
      { x: 2024, y: 95, label: "B200", color: "#76B900", size: 9 },
      { x: 2020, y: 15, label: "MI100", color: "#ED1C24", size: 4 },
      { x: 2022, y: 40, label: "MI300X", color: "#ED1C24", size: 6 },
      { x: 2024, y: 60, label: "MI400", color: "#ED1C24", size: 7 },
    ],
    width: 320,
    height: 220,
    xLabel: "Year",
    yLabel: "Performance Index",
    showGrid: true,
  }, "Scatter: chip generation evolution", 228000),

  // 220s: Ribbon — Final verdict
  t(220000, {
    type: "ribbon",
    position: { x: 340, y: 370 },
    text: "NVIDIA REMAINS KING",
    width: 260,
    color: "#76B900",
    textColor: "#FFFFFF",
    fontSize: 15,
    variant: "award",
  }, "Ribbon: final verdict", 228000),

  // 222s: Stacked bar — Future market projection
  t(222000, {
    type: "stacked-bar",
    position: { x: 60, y: 380 },
    bars: [
      {
        label: "2024",
        segments: [
          { value: 80, color: "#76B900" },
          { value: 12, color: "#ED1C24" },
          { value: 8, color: "#6366F1" },
        ],
      },
      {
        label: "2027E",
        segments: [
          { value: 60, color: "#76B900" },
          { value: 20, color: "#ED1C24" },
          { value: 20, color: "#6366F1" },
        ],
      },
    ],
    width: 220,
    barHeight: 28,
    gap: 12,
  }, "StackedBar: market share projection", 228000),

  // 228s: Clear
  t(228000, { type: "clear" }, "Final clear for new types"),

  // 229s: Badge group - final summary
  t(229000, {
    type: "badge-group",
    position: { x: 300, y: 280 },
    badges: [
      { text: "Ribbon", background: "#6366F1" },
      { text: "Polar Area", background: "#EC4899" },
      { text: "Stacked Bar", background: "#F59E0B", color: "#000" },
      { text: "Tooltip", background: "#10B981" },
      { text: "Badge Group", background: "#3B82F6" },
      { text: "Scatter", background: "#EF4444" },
      { text: "Meter", background: "#8B5CF6" },
    ],
    layout: "flow",
    gap: 10,
  }, "BadgeGroup: final summary of all types"),

  // 230s: Ribbon — End credits
  t(230000, {
    type: "ribbon",
    position: { x: 350, y: 200 },
    text: "7 NEW OVERLAY TYPES",
    width: 260,
    color: "#EC4899",
    textColor: "#FFFFFF",
    fontSize: 16,
    variant: "flat",
  }, "Ribbon: end credits"),
]

// Auto-compute total duration from steps
TOTAL_DURATION_MS = Math.max(
  ...demoSteps.map((s) => Math.max(s.startMs, s.endMs ?? s.startMs))
) + 2500 // +2.5s buffer after last event
