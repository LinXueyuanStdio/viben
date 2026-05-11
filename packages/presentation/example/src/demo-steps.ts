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
    maskOpacity: 0.85,
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
  }, "Opening hook text", 18000),

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
  }, "Typewriter: rhetorical question", 18000),

  // 6s: Counter counting up — NVIDIA's YoY growth percentage
  t(6000, {
    type: "counter",
    position: { targetId: "subtitle", placement: "right-of", offsetX: 24 },
    value: 265,
    suffix: "%",
    color: "#76B900",
    fontSize: 56,
    animate: true,
  }, "Counter: 265% YoY growth", 14000),

  // 7.5s: Badge labeling the counter
  t(7500, {
    type: "badge",
    position: { targetId: "subtitle", placement: "below-end", offsetY: 6 },
    text: "数据中心收入同比增长",
    color: "#FFFFFF",
    background: "rgba(118, 185, 0, 0.85)",
    size: "lg",
    animate: true,
  }, "Badge: growth label", 18000),

  // 10s: Text with total revenue figure
  t(10000, {
    type: "text",
    position: { targetId: "subtitle", placement: "below-start", offsetY: 28 },
    content: "季度收入首次突破 $26B",
    fontSize: 15,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.8)",
    animate: true,
  }, "Revenue milestone text", 18000),

  // 12s: Counter — daily earnings
  t(12000, {
    type: "counter",
    position: { targetId: "title", placement: "below-end", offsetY: 10 },
    value: 2.9,
    prefix: "$",
    suffix: "亿/天",
    color: "#F59E0B",
    fontSize: 42,
    animate: true,
  }, "Counter: daily revenue", 18000),

  // 14s: Pulse on subtitle area to draw attention to data
  t(14000, {
    type: "pulse",
    center: { targetId: "title", anchor: "bottom-right" },
    radius: 24,
    color: "#76B900",
    rings: 3,
    animate: true,
  }, "Pulse on subtitle", 18000),

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
    position: { targetId: "title", placement: "below-start", offsetY: 6 },
    content: "摩根士丹利深度报告：AI芯片三国杀",
    fontSize: 16,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.85)",
    animate: true,
  }, "Framing text", 26000),

  // 21s: Badge — OVERWEIGHT rating
  t(21000, {
    type: "badge",
    position: { targetId: "subtitle", placement: "right-of", offsetX: 10 },
    text: "OVERWEIGHT",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.9)",
    size: "md",
    animate: true,
  }, "Badge: OVERWEIGHT rating", 26000),

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
  }, "Pulse NVIDIA card", 33000),

  t(27500, {
    type: "pulse",
    center: { targetId: "card-amd", anchor: "center" },
    radius: 32,
    color: "#ED1C24",
    rings: 3,
    animate: true,
  }, "Pulse AMD card", 33000),

  t(28000, {
    type: "pulse",
    center: { targetId: "card-others", anchor: "center" },
    radius: 32,
    color: "#6366F1",
    rings: 3,
    animate: true,
  }, "Pulse Others card", 33000),

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
  }, "Three fates text", 38000),

  // 31s: Highlight each card value in sequence
  t(31000, {
    type: "highlight",
    region: { targetId: "nvidia-value", padding: 6 },
    color: "#76B900",
    opacity: 0.25,
    borderRadius: 8,
    animate: true,
  }, "Highlight 80%", 38000),

  t(32000, {
    type: "highlight",
    region: { targetId: "amd-value", padding: 6 },
    color: "#ED1C24",
    opacity: 0.25,
    borderRadius: 8,
    animate: true,
  }, "Highlight 12%", 38000),

  t(33000, {
    type: "highlight",
    region: { targetId: "others-value", padding: 6 },
    color: "#6366F1",
    opacity: 0.25,
    borderRadius: 8,
    animate: true,
  }, "Highlight 8%", 38000),

  // 34s: Badges on cards
  t(34000, {
    type: "badge",
    position: { targetId: "card-nvidia", placement: "above-end" },
    text: "统治者",
    color: "#fff",
    background: "#76B900",
    size: "sm",
    animate: true,
  }, "Badge: ruler", 38000),

  t(34500, {
    type: "badge",
    position: { targetId: "card-amd", placement: "above-end" },
    text: "挑战者",
    color: "#fff",
    background: "#ED1C24",
    size: "sm",
    animate: true,
  }, "Badge: challenger", 38000),

  t(35000, {
    type: "badge",
    position: { targetId: "card-others", placement: "above-end" },
    text: "新势力",
    color: "#fff",
    background: "#6366F1",
    size: "sm",
    animate: true,
  }, "Badge: newcomers", 38000),

  // 36s: Arrow from NVIDIA to AMD showing dominance gap
  t(36000, {
    type: "arrow",
    from: { targetId: "card-nvidia", anchor: "right" },
    to: { targetId: "card-amd", anchor: "left" },
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
    maskOpacity: 0.75,
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
  }, "Circle 80% value", 63000),

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
  }, "Card: NVIDIA dominance", 54000),

  // 46s: Counter showing market cap
  t(46000, {
    type: "counter",
    position: { targetId: "card-nvidia", placement: "above-end", offsetY: -6 },
    value: 2.2,
    prefix: "$",
    suffix: "T 市值",
    color: "#76B900",
    fontSize: 32,
    animate: true,
  }, "Counter: $2.2T market cap", 63000),

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

  // 50s: Underline NVIDIA bar (wavy)
  t(50000, {
    type: "underline",
    from: { targetId: "bar-nvidia", anchor: "bottom-left" },
    to: { targetId: "bar-nvidia", anchor: "bottom-right" },
    color: "#76B900",
    strokeWidth: 3,
    style: "wavy",
    animate: true,
  }, "Underline NVIDIA bar", 63000),

  // 52s: Text insight
  t(52000, {
    type: "text",
    position: { targetId: "card-nvidia", placement: "below-end", offsetY: 6 },
    content: "每训练5个大模型，4个用NVIDIA",
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(118, 185, 0, 0.8)",
    animate: true,
  }, "Text: 4/5 models use NVIDIA", 63000),

  // 55s: Comparison — NVIDIA vs Rest
  t(55000, {
    type: "comparison",
    position: { targetId: "card-nvidia", placement: "below-start", offsetY: 8 },
    width: 350,
    leftLabel: "NVIDIA",
    rightLabel: "所有对手之和",
    leftValue: 80,
    rightValue: 20,
    leftColor: "#76B900",
    rightColor: "#6366F1",
    unit: "%",
    animate: true,
  }, "Comparison: NVIDIA vs all others", 63000),

  // 58s: Badge with key insight
  t(58000, {
    type: "badge",
    position: { targetId: "card-nvidia", placement: "above-start", offsetY: -6 },
    text: "绝对垄断",
    color: "#000",
    background: "#76B900",
    size: "md",
    animate: true,
  }, "Badge: absolute monopoly", 63000),

  // 63s: Clear for CUDA analysis
  t(63000, { type: "clear" }, "Clear for CUDA moat"),

  // ============================================================================
  // ACT 4: CUDA MOAT (65s - 90s) — bracket, trendline, chart (line), typewriter
  // ============================================================================

  // 65s: Spotlight revenue chart area
  t(65000, {
    type: "spotlight",
    region: { targetId: "revenue-chart", padding: 12 },
    maskOpacity: 0.72,
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
  }, "Text: CUDA is the answer", 78000),

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

  // 70s: Card explaining CUDA ecosystem — left of revenue chart
  t(70000, {
    type: "card",
    position: { targetId: "revenue-chart", placement: "left-of-start", offsetX: -16 },
    width: 280,
    title: "CUDA 生态系统壁垒",
    content: "400万开发者的肌肉记忆\n所有主流框架原生支持\n15年积累的软件生态\n换芯片 = 重写所有代码",
    tag: "护城河",
    tagColor: "#76B900",
    enterFrom: "left",
    animate: true,
    borderColor: "rgba(118, 185, 0, 0.3)",
  }, "Card: CUDA moat", 88000),

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

  // 76s: Line chart — quarterly revenue (in analysis area, left side)
  t(76000, {
    type: "chart",
    position: { targetId: "analysis", placement: "right-of-start", offsetX: 16 },
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
  }, "Chart: NVIDIA revenue line", 88000),

  // 80s: Typewriter — developer ecosystem insight (above revenue chart)
  t(80000, {
    type: "typewriter",
    position: { targetId: "revenue-chart", placement: "above-start", offsetY: -8 },
    content: "400万开发者 × 15年生态 = 不可逾越的护城河",
    fontSize: 15,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(118, 185, 0, 0.8)",
    speed: "normal",
    animate: true,
  }, "Typewriter: developer moat", 88000),

  // 84s: Progress bar — CUDA adoption rate (below analysis text)
  t(84000, {
    type: "progress",
    position: { targetId: "card-nvidia", placement: "below-start", offsetY: 8 },
    width: 380,
    value: 92,
    color: "#76B900",
    showLabel: true,
    label: "CUDA 框架覆盖率: 92%",
    animate: true,
  }, "Progress: CUDA coverage", 88000),

  // 88s: Clear
  t(88000, { type: "clear" }, "Clear for AMD challenge"),

  // ============================================================================
  // ACT 5: AMD CHALLENGE (90s - 115s) — spotlight, card, comparison, chart (bar)
  // ============================================================================

  // 90s: Spotlight AMD card
  t(90000, {
    type: "spotlight",
    region: { targetId: "card-amd", padding: 10 },
    maskOpacity: 0.72,
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
  }, "Highlight AMD 12%", 100000),

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
  }, "Card: AMD overview", 97000),

  // 96s: Circle AMD value
  t(96000, {
    type: "circle",
    center: { targetId: "amd-value", anchor: "center" },
    radius: 34,
    color: "#ED1C24",
    strokeWidth: 3,
    animate: true,
  }, "Circle AMD 12%", 104000),

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
  }, "Comparison: H100 vs MI300X", 113000),

  // 101s: Another comparison — price/performance
  t(101000, {
    type: "comparison",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 68 },
    width: 380,
    leftLabel: "H100 性价比",
    rightLabel: "MI300X 性价比",
    leftValue: 70,
    rightValue: 95,
    leftColor: "#76B900",
    rightColor: "#ED1C24",
    unit: "相对值",
    animate: true,
  }, "Comparison: price/performance", 113000),

  // 104s: Bar chart — AMD revenue growth (right of analysis area)
  t(104000, {
    type: "chart",
    position: { targetId: "analysis", placement: "right-of-start", offsetX: 16 },
    width: 280,
    height: 150,
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
  }, "Chart: AMD revenue bar", 113000),

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
  }, "Badge: AMD growth", 113000),

  // 111s: Typewriter insight (below the AMD card area)
  t(111000, {
    type: "typewriter",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 8 },
    content: "ROCm 是 AMD 的胜负手 — 但差距仍有3-5年",
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(237, 28, 36, 0.8)",
    speed: "normal",
    animate: true,
  }, "Typewriter: ROCm gap", 113000),

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
    maskOpacity: 0.72,
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
  }, "Card: custom silicon", 127000),

  // 119s: Three badges appear staggered BELOW card-others (not on bar elements)
  t(119000, {
    type: "badge",
    position: { targetId: "card-others", placement: "below-start", offsetY: 8 },
    text: "Google TPU v5e",
    color: "#fff",
    background: "#4285F4",
    size: "sm",
    animate: true,
  }, "Badge: TPU v5e", 127000),

  t(119500, {
    type: "badge",
    position: { targetId: "card-others", placement: "below-start", offsetY: 32 },
    text: "华为昇腾910B",
    color: "#fff",
    background: "#CF0A2C",
    size: "sm",
    animate: true,
  }, "Badge: Ascend 910B", 127000),

  t(120000, {
    type: "badge",
    position: { targetId: "card-others", placement: "below-start", offsetY: 56 },
    text: "Intel Gaudi 3",
    color: "#fff",
    background: "#0071C5",
    size: "sm",
    animate: true,
  }, "Badge: Intel Gaudi", 127000),

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

  // 127.5s: Re-apply spotlight (after clear)
  t(127500, {
    type: "spotlight",
    region: { targetId: "revenue-chart", padding: 10 },
    maskOpacity: 0.65,
    borderRadius: 12,
    animate: true,
  }, "Spotlight revenue chart for pie", 135000),

  // 128s: Pie chart — market share, placed in the analysis area (left, has space)
  t(128000, {
    type: "chart",
    position: { targetId: "card-nvidia", placement: "below-start", offsetY: 8 },
    width: 250,
    height: 200,
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
  }, "Chart: market share pie (donut)", 135000),

  // 131s: Area chart — custom silicon growth, below title (left side, separate from pie)
  t(131000, {
    type: "chart",
    position: { targetId: "card-amd", placement: "below-start", offsetY: 8 },
    width: 260,
    height: 140,
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
  }, "Chart: custom silicon area projection", 135000),

  // 133s: Arrow connecting pie chart area to revenue chart
  t(133000, {
    type: "arrow",
    from: { targetId: "card-others", anchor: "bottom" },
    to: { targetId: "revenue-chart", anchor: "top" },
    color: "#6366F1",
    label: "增长趋势",
    strokeWidth: 2,
    animate: true,
  }, "Arrow: growth trend", 135000),

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
  }, "Pulse on Others", 138000),

  // 136s: Text summary
  t(136000, {
    type: "text",
    position: { targetId: "card-others", placement: "below-start", offsetY: 8 },
    content: "自研芯片 2027年或占 25% — 但主要蚕食推理市场",
    fontSize: 14,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.8)",
    animate: true,
  }, "Text: self-developed forecast", 138000),

  // 138s: Clear
  t(138000, { type: "clear" }, "Clear for conclusion"),

  // ============================================================================
  // ACT 7: CONCLUSION (140s - 165s) — progress bars, counter, summary card
  // ============================================================================

  // 140s: Spotlight title for conclusion
  t(140000, {
    type: "spotlight",
    region: { targetId: "title", padding: 20 },
    maskOpacity: 0.65,
    borderRadius: 16,
    animate: true,
  }, "Final spotlight on title", 163000),

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
  }, "Summary card: conclusion", 163000),

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
  }, "Progress: NVIDIA 2024", 163000),

  t(146000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 212 },
    width: 400,
    value: 65,
    color: "#76B900",
    showLabel: true,
    label: "NVIDIA 2027E: 65%",
    animate: true,
  }, "Progress: NVIDIA 2027", 163000),

  t(147000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 244 },
    width: 400,
    value: 20,
    color: "#ED1C24",
    showLabel: true,
    label: "AMD 2027E: 20%",
    animate: true,
  }, "Progress: AMD 2027", 163000),

  t(148000, {
    type: "progress",
    position: { targetId: "title", placement: "below-start", offsetY: 276 },
    width: 400,
    value: 15,
    color: "#6366F1",
    showLabel: true,
    label: "自研 2027E: 15%",
    animate: true,
  }, "Progress: Custom 2027", 163000),

  // 150s: Counter — total market size
  t(150000, {
    type: "counter",
    position: { targetId: "title", placement: "below-end", offsetY: 6 },
    value: 400,
    prefix: "$",
    suffix: "B",
    color: "#F59E0B",
    fontSize: 48,
    animate: true,
  }, "Counter: $400B market by 2027", 163000),

  // 151s: Badge labeling counter
  t(151000, {
    type: "badge",
    position: { targetId: "subtitle", placement: "below-start", offsetY: 6 },
    text: "2027年AI芯片市场规模预测",
    color: "#FFFFFF",
    background: "rgba(245, 158, 11, 0.85)",
    size: "lg",
    animate: true,
  }, "Badge: market size label", 163000),

  // 154s: Trendline showing market growth
  t(154000, {
    type: "trendline",
    points: [
      { x: 580, y: 140 },
      { x: 640, y: 128 },
      { x: 700, y: 108 },
      { x: 760, y: 82 },
      { x: 820, y: 55 },
    ],
    color: "#F59E0B",
    strokeWidth: 3,
    showDots: true,
    dotRadius: 4,
    fillBelow: "rgba(245, 158, 11, 0.1)",
    endArrow: true,
    animate: true,
  }, "Trendline: market growth", 163000),

  // 157s: Highlight analysis section for final call
  t(157000, {
    type: "highlight",
    region: { targetId: "analysis", padding: 8 },
    color: "#F59E0B",
    opacity: 0.1,
    borderRadius: 12,
    animate: true,
  }, "Highlight analysis area", 163000),

  // 159s: Circle card-nvidia to emphasize winner
  t(159000, {
    type: "circle",
    center: { targetId: "card-nvidia", anchor: "center" },
    radius: 60,
    color: "#76B900",
    strokeWidth: 3,
    animate: true,
  }, "Circle NVIDIA card — winner", 163000),

  // 163s: Clear for finale
  t(163000, { type: "clear" }, "Clear for finale"),

  // ============================================================================
  // ACT 8: END (165s - 180s) — final typewriter + text + farewell
  // ============================================================================

  // 165s: Final typewriter — investment thesis
  t(165000, {
    type: "typewriter",
    position: { targetId: "title", placement: "below-start", offsetY: 20 },
    content: "CUDA生态 = 15年的护城河，一时半会填不平。",
    fontSize: 18,
    fontWeight: 700,
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.85)",
    speed: "slow",
    animate: true,
  }, "Typewriter: final thesis", 177000),

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
  }, "Typewriter: three timeframes", 177000),

  // 171s: Badge — final recommendation
  t(171000, {
    type: "badge",
    position: { targetId: "subtitle", placement: "below-start", offsetY: 6 },
    text: "维持 OVERWEIGHT 评级",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.9)",
    size: "lg",
    animate: true,
  }, "Badge: maintain overweight", 177000),

  // 173s: Arrow from title to subtitle area — final flourish
  t(173000, {
    type: "arrow",
    from: { targetId: "title", anchor: "bottom-left" },
    to: { targetId: "subtitle", anchor: "left" },
    color: "#F59E0B",
    label: "关注",
    strokeWidth: 2,
    animate: true,
  }, "Arrow: final focus", 177000),

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
  }, "End screen: thank you"),

  // 178s: Badge below end text
  t(178000, {
    type: "badge",
    position: { targetId: "title", placement: "below", offsetY: 160 },
    text: "@viben/presentation demo",
    color: "#FFFFFF",
    background: "rgba(99, 102, 241, 0.7)",
    size: "md",
    animate: true,
  }, "Badge: credits"),
]

// Auto-compute total duration from steps
TOTAL_DURATION_MS = Math.max(
  ...demoSteps.map((s) => Math.max(s.startMs, s.endMs ?? s.startMs))
) + 2500 // +2.5s buffer after last event
