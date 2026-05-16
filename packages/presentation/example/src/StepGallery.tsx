import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import type { PresentationStep, PresentationCommand } from "@viben/presentation"
import { describeCommand } from "@viben/presentation"

// ============================================================================
// Types & Data
// ============================================================================

type Category = "core" | "dataviz" | "narrative" | "effects" | "advanced"

interface StepTypeEntry {
  type: string
  category: Category
  description: string
  /** Factory to build a demo PresentationCommand */
  makeCommand: () => PresentationCommand
  /** Duration in ms for the demo */
  durationMs: number
}

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  core: { label: "Core", color: "#76B900" },
  dataviz: { label: "Data Viz", color: "#6366F1" },
  narrative: { label: "Narrative", color: "#F59E0B" },
  effects: { label: "Effects", color: "#EC4899" },
  advanced: { label: "Advanced", color: "#38BDF8" },
}

const ALL_CATEGORIES: Category[] = ["core", "dataviz", "narrative", "effects", "advanced"]

// ============================================================================
// Step type catalog -- every supported overlay type
// ============================================================================

const STEP_CATALOG: StepTypeEntry[] = [
  // ---- Core ----
  {
    type: "spotlight",
    category: "core",
    description: "Dark mask with a highlighted region cutout",
    durationMs: 4000,
    makeCommand: () => ({
      type: "spotlight",
      region: { x: 300, y: 200, width: 360, height: 240 },
      maskOpacity: 0.75,
      borderRadius: 12,
    }),
  },
  {
    type: "arrow",
    category: "core",
    description: "Animated arrow from one point to another",
    durationMs: 3000,
    makeCommand: () => ({
      type: "arrow",
      from: { x: 200, y: 300 },
      to: { x: 600, y: 200 },
      color: "#6366F1",
      label: "Look here",
      strokeWidth: 3,
    }),
  },
  {
    type: "text",
    category: "core",
    description: "Text annotation at a given position",
    durationMs: 3000,
    makeCommand: () => ({
      type: "text",
      position: { x: 300, y: 260 },
      content: "Important insight about the data",
      color: "#fff",
      fontSize: 22,
      background: "rgba(99,102,241,0.85)",
    }),
  },
  {
    type: "circle",
    category: "core",
    description: "Circle annotation around a focal point",
    durationMs: 3000,
    makeCommand: () => ({
      type: "circle",
      center: { x: 480, y: 300 },
      radius: 80,
      color: "#EF4444",
      strokeWidth: 3,
    }),
  },
  {
    type: "highlight",
    category: "core",
    description: "Semi-transparent color block over a region",
    durationMs: 3000,
    makeCommand: () => ({
      type: "highlight",
      region: { x: 280, y: 200, width: 400, height: 200 },
      color: "#F59E0B",
      opacity: 0.25,
      borderRadius: 8,
    }),
  },
  {
    type: "card",
    category: "core",
    description: "Info card with title and content text",
    durationMs: 4000,
    makeCommand: () => ({
      type: "card",
      position: { x: 280, y: 180 },
      width: 380,
      title: "Key Finding",
      content: "Revenue grew 42% year-over-year, exceeding all analyst expectations.",
      tag: "Insight",
      tagColor: "#6366F1",
      background: "rgba(15,20,40,0.92)",
      borderColor: "rgba(99,102,241,0.4)",
    }),
  },
  {
    type: "pulse",
    category: "core",
    description: "Pulsing concentric rings drawing attention",
    durationMs: 4000,
    makeCommand: () => ({
      type: "pulse",
      center: { x: 480, y: 300 },
      radius: 30,
      color: "#EC4899",
      rings: 3,
    }),
  },
  {
    type: "underline",
    category: "core",
    description: "Animated underline below a region of text",
    durationMs: 3000,
    makeCommand: () => ({
      type: "underline",
      from: { x: 280, y: 310 },
      to: { x: 680, y: 310 },
      color: "#F59E0B",
      strokeWidth: 3,
      style: "wavy" as const,
    }),
  },
  {
    type: "badge",
    category: "core",
    description: "Floating label pill / chip annotation",
    durationMs: 3000,
    makeCommand: () => ({
      type: "badge",
      position: { x: 420, y: 280 },
      text: "NEW",
      color: "#fff",
      background: "#6366F1",
      size: "md" as const,
    }),
  },
  {
    type: "progress",
    category: "core",
    description: "Animated horizontal progress bar",
    durationMs: 4000,
    makeCommand: () => ({
      type: "progress",
      position: { x: 280, y: 290 },
      width: 400,
      value: 73,
      color: "#10B981",
      showLabel: true,
    }),
  },
  {
    type: "counter",
    category: "core",
    description: "Animated number counting up to a value",
    durationMs: 4000,
    makeCommand: () => ({
      type: "counter",
      position: { x: 380, y: 250 },
      value: 8742,
      prefix: "$",
      suffix: "M",
      color: "#76B900",
      fontSize: 48,
    }),
  },
  {
    type: "bracket",
    category: "core",
    description: "Curly brace grouping two points together",
    durationMs: 3000,
    makeCommand: () => ({
      type: "bracket",
      from: { x: 380, y: 180 },
      to: { x: 380, y: 420 },
      direction: "right" as const,
      color: "#A855F7",
      strokeWidth: 2,
      label: "Group A",
    }),
  },
  {
    type: "trendline",
    category: "core",
    description: "SVG polyline with optional dots and area fill",
    durationMs: 4000,
    makeCommand: () => ({
      type: "trendline",
      points: [
        { x: 200, y: 400 },
        { x: 320, y: 340 },
        { x: 440, y: 360 },
        { x: 560, y: 240 },
        { x: 680, y: 200 },
      ],
      color: "#38BDF8",
      strokeWidth: 3,
      showDots: true,
      fillBelow: "rgba(56,189,248,0.15)",
    }),
  },
  {
    type: "comparison",
    category: "core",
    description: "Side-by-side bar comparison of two values",
    durationMs: 4000,
    makeCommand: () => ({
      type: "comparison",
      position: { x: 280, y: 220 },
      width: 400,
      leftLabel: "Revenue",
      rightLabel: "Expenses",
      leftValue: 84,
      rightValue: 56,
      leftColor: "#10B981",
      rightColor: "#EF4444",
      unit: "%",
    }),
  },
  {
    type: "typewriter",
    category: "core",
    description: "Text that types itself character by character",
    durationMs: 5000,
    makeCommand: () => ({
      type: "typewriter",
      position: { x: 240, y: 270 },
      content: "The future of AI is here...",
      fontSize: 28,
      color: "#fff",
      speed: "normal" as const,
    }),
  },
  {
    type: "chart",
    category: "core",
    description: "Professional animated chart (bar, line, area, pie)",
    durationMs: 5000,
    makeCommand: () => ({
      type: "chart",
      position: { x: 260, y: 160 },
      width: 420,
      height: 260,
      chartType: "bar" as const,
      data: [
        { name: "Q1", value: 42, color: "#6366F1" },
        { name: "Q2", value: 58, color: "#8B5CF6" },
        { name: "Q3", value: 71, color: "#A855F7" },
        { name: "Q4", value: 89, color: "#C084FC" },
      ],
      title: "Quarterly Revenue",
      showGrid: true,
      showAxis: true,
    }),
  },

  // ---- Data Visualization ----
  {
    type: "gauge",
    category: "dataviz",
    description: "Circular gauge meter with animated needle",
    durationMs: 4000,
    makeCommand: () => ({
      type: "gauge",
      position: { x: 370, y: 200 },
      value: 78,
      label: "Performance",
      color: "#6366F1",
    }),
  },
  {
    type: "sparkline",
    category: "dataviz",
    description: "Compact inline line chart with optional fill",
    durationMs: 4000,
    makeCommand: () => ({
      type: "sparkline",
      position: { x: 340, y: 250 },
      data: [10, 25, 18, 42, 35, 60, 55, 72, 68, 80],
      width: 280,
      height: 80,
      color: "#10B981",
      fill: true,
      showEndDot: true,
    }),
  },
  {
    type: "heatmap",
    category: "dataviz",
    description: "Grid of colored cells showing intensity values",
    durationMs: 4000,
    makeCommand: () => ({
      type: "heatmap",
      position: { x: 350, y: 200 },
      data: [
        [0.2, 0.8, 0.5],
        [0.9, 0.3, 0.7],
        [0.4, 0.6, 1.0],
      ],
      cellSize: 48,
      rowLabels: ["A", "B", "C"],
      colLabels: ["X", "Y", "Z"],
    }),
  },
  {
    type: "funnel",
    category: "dataviz",
    description: "Vertical funnel / pyramid with stage labels",
    durationMs: 4000,
    makeCommand: () => ({
      type: "funnel",
      position: { x: 320, y: 140 },
      stages: [
        { label: "Visitors", value: 10000, color: "#6366F1" },
        { label: "Leads", value: 5200, color: "#8B5CF6" },
        { label: "Trials", value: 2100, color: "#A855F7" },
        { label: "Customers", value: 800, color: "#C084FC" },
      ],
      width: 320,
      height: 280,
    }),
  },
  {
    type: "waterfall",
    category: "dataviz",
    description: "Incremental increase / decrease bar chart",
    durationMs: 4000,
    makeCommand: () => ({
      type: "waterfall",
      position: { x: 260, y: 160 },
      data: [
        { label: "Revenue", value: 100, type: "total" as const },
        { label: "Sales", value: 40, type: "increase" as const },
        { label: "Services", value: 25, type: "increase" as const },
        { label: "Costs", value: -35, type: "decrease" as const },
        { label: "Tax", value: -15, type: "decrease" as const },
        { label: "Net", value: 115, type: "total" as const },
      ],
      width: 440,
      height: 260,
    }),
  },

  // ---- Narrative / Structural ----
  {
    type: "callout",
    category: "narrative",
    description: "Speech bubble pointing to a target area",
    durationMs: 4000,
    makeCommand: () => ({
      type: "callout",
      position: { x: 360, y: 240 },
      content: "This is a critical observation!",
      arrowDirection: "bottom" as const,
      background: "rgba(99,102,241,0.95)",
    }),
  },
  {
    type: "timeline",
    category: "narrative",
    description: "Horizontal / vertical timeline with milestones",
    durationMs: 5000,
    makeCommand: () => ({
      type: "timeline",
      position: { x: 200, y: 260 },
      events: [
        { label: "Q1", description: "Launch", active: true },
        { label: "Q2", description: "Growth" },
        { label: "Q3", description: "Scale", color: "#10B981" },
        { label: "Q4", description: "Profit" },
      ],
      direction: "horizontal" as const,
      width: 560,
    }),
  },
  {
    type: "flowchart",
    category: "narrative",
    description: "Connected boxes with directional arrows",
    durationMs: 5000,
    makeCommand: () => ({
      type: "flowchart",
      position: { x: 180, y: 200 },
      nodes: [
        { id: "a", label: "Start", color: "#6366F1" },
        { id: "b", label: "Process" },
        { id: "c", label: "Decision", color: "#F59E0B" },
        { id: "d", label: "End", color: "#10B981" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "d" },
      ],
      direction: "horizontal" as const,
      width: 600,
    }),
  },
  {
    type: "table",
    category: "narrative",
    description: "Data table with row-by-row reveal animation",
    durationMs: 5000,
    makeCommand: () => ({
      type: "table",
      position: { x: 260, y: 200 },
      headers: ["Name", "Revenue", "Growth"],
      rows: [
        ["NVIDIA", "$26B", "+122%"],
        ["AMD", "$3.5B", "+45%"],
        ["Intel", "$1.1B", "-8%"],
      ],
      highlights: [[0, 2] as [number, number]],
      rowStagger: 4,
    }),
  },
  {
    type: "list",
    category: "narrative",
    description: "Animated bullet list with staggered reveal",
    durationMs: 4000,
    makeCommand: () => ({
      type: "list",
      position: { x: 320, y: 200 },
      items: [
        { text: "First item", color: "#6366F1" },
        { text: "Second item", color: "#10B981" },
        { text: "Third item", color: "#F59E0B" },
        { text: "Fourth item", color: "#EF4444" },
      ],
      listStyle: "check" as const,
      stagger: 5,
    }),
  },

  // ---- Interaction / Effects ----
  {
    type: "confetti",
    category: "effects",
    description: "Particle burst celebration effect",
    durationMs: 4000,
    makeCommand: () => ({
      type: "confetti",
      position: { x: 480, y: 300 },
      count: 60,
      spread: 250,
      colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD"],
    }),
  },
  {
    type: "countdown",
    category: "effects",
    description: "Large countdown number animation",
    durationMs: 5000,
    makeCommand: () => ({
      type: "countdown",
      position: { x: 480, y: 300 },
      from: 3,
      fontSize: 120,
      color: "#fff",
    }),
  },
  {
    type: "reveal",
    category: "effects",
    description: "Mask wipe revealing underlying content",
    durationMs: 4000,
    makeCommand: () => ({
      type: "reveal",
      region: { x: 200, y: 150, width: 560, height: 300 },
      direction: "center" as const,
      color: "#1a1a2e",
    }),
  },
  {
    type: "zoom",
    category: "effects",
    description: "Magnifying lens effect on a region",
    durationMs: 4000,
    makeCommand: () => ({
      type: "zoom",
      region: { x: 340, y: 220, width: 280, height: 180 },
      scale: 2.5,
      borderColor: "#6366F1",
    }),
  },
  {
    type: "morph",
    category: "effects",
    description: "Number / shape morph transition animation",
    durationMs: 4000,
    makeCommand: () => ({
      type: "morph",
      position: { x: 420, y: 260 },
      from: 0,
      to: 100,
      color: "#6366F1",
      fontSize: 64,
    }),
  },

  // ---- Advanced Data & Annotations ----
  {
    type: "radar",
    category: "advanced",
    description: "Spider/radar chart with multiple axes",
    durationMs: 5000,
    makeCommand: () => ({
      type: "radar",
      position: { x: 360, y: 180 },
      axes: [
        { label: "Speed", value: 85 },
        { label: "Power", value: 72 },
        { label: "Range", value: 60 },
        { label: "Defense", value: 90 },
        { label: "Accuracy", value: 78 },
        { label: "Stealth", value: 65 },
      ],
      color: "#6366F1",
      fillOpacity: 0.3,
      size: 220,
    }),
  },
  {
    type: "sankey",
    category: "advanced",
    description: "Flow diagram showing connections and quantities",
    durationMs: 5000,
    makeCommand: () => ({
      type: "sankey",
      position: { x: 200, y: 180 },
      nodes: [
        { id: "organic", label: "Organic" },
        { id: "paid", label: "Paid Ads" },
        { id: "social", label: "Social" },
        { id: "signup", label: "Sign Up" },
        { id: "convert", label: "Conversion" },
      ],
      links: [
        { source: "organic", target: "signup", value: 40 },
        { source: "paid", target: "signup", value: 30 },
        { source: "social", target: "signup", value: 20 },
        { source: "signup", target: "convert", value: 55 },
      ],
      width: 520,
      height: 280,
    }),
  },
  {
    type: "kpi",
    category: "advanced",
    description: "KPI metric card with trend indicator and sparkline",
    durationMs: 4000,
    makeCommand: () => ({
      type: "kpi",
      position: { x: 360, y: 240 },
      value: 2847000,
      label: "Monthly Revenue",
      trend: "up" as const,
      trendValue: "+12.5%",
      sparkData: [20, 35, 28, 45, 42, 58, 55, 68, 72, 85],
      color: "#10B981",
    }),
  },
  {
    type: "matrix",
    category: "advanced",
    description: "Comparison matrix with yes/no/partial indicators",
    durationMs: 5000,
    makeCommand: () => ({
      type: "matrix",
      position: { x: 280, y: 180 },
      columns: ["Free", "Pro", "Enterprise"],
      rows: [
        { label: "Unlimited projects", values: ["no" as const, "yes" as const, "yes" as const] },
        { label: "Custom domains", values: ["no" as const, "yes" as const, "yes" as const] },
        { label: "Analytics", values: ["partial" as const, "yes" as const, "yes" as const] },
        { label: "API Access", values: ["no" as const, "partial" as const, "yes" as const] },
        { label: "Priority Support", values: ["no" as const, "no" as const, "yes" as const] },
      ],
      width: 400,
    }),
  },
  {
    type: "annotation-group",
    category: "advanced",
    description: "Grouped annotations with connector lines",
    durationMs: 4000,
    makeCommand: () => ({
      type: "annotation-group",
      position: { x: 320, y: 220 },
      items: [
        { label: "Data Collection", color: "#6366F1" },
        { label: "Preprocessing", color: "#8B5CF6" },
        { label: "Model Training", color: "#A855F7" },
        { label: "Evaluation", color: "#EC4899" },
        { label: "Deployment", color: "#10B981" },
      ],
      direction: "vertical" as const,
      connector: "bracket" as const,
    }),
  },
  {
    type: "treemap",
    category: "dataviz",
    description: "Rectangular treemap showing hierarchical proportions",
    durationMs: 5000,
    makeCommand: () => ({
      type: "treemap",
      position: { x: 300, y: 180 },
      data: [
        { label: "React", value: 42, color: "#61DAFB" },
        { label: "Vue", value: 28, color: "#42B883" },
        { label: "Angular", value: 18, color: "#DD0031" },
        { label: "Svelte", value: 12, color: "#FF3E00" },
        { label: "Solid", value: 8, color: "#2C4F7C" },
      ],
      width: 360,
      height: 220,
    }),
  },
  {
    type: "donut",
    category: "dataviz",
    description: "Ring chart with animated arc drawing",
    durationMs: 5000,
    makeCommand: () => ({
      type: "donut",
      position: { x: 380, y: 200 },
      segments: [
        { label: "Desktop", value: 54, color: "#6366F1" },
        { label: "Mobile", value: 32, color: "#10B981" },
        { label: "Tablet", value: 9, color: "#F59E0B" },
        { label: "Other", value: 5, color: "#EC4899" },
      ],
      size: 180,
      innerRatio: 0.6,
    }),
  },
  {
    type: "stat-card",
    category: "advanced",
    description: "Before vs after comparison card with delta",
    durationMs: 5000,
    makeCommand: () => ({
      type: "stat-card",
      position: { x: 360, y: 240 },
      label: "Page Load Time",
      before: 3200,
      after: 890,
      unit: "ms",
      color: "#10B981",
    }),
  },
  {
    type: "code-block",
    category: "advanced",
    description: "Code snippet with syntax highlighting and line glow",
    durationMs: 5000,
    makeCommand: () => ({
      type: "code-block",
      position: { x: 280, y: 180 },
      code: `import { spring } from "remotion";\n\nconst anim = spring({\n  frame,\n  fps: 30,\n  config: { damping: 12 },\n});`,
      language: "typescript",
      highlightLines: [3, 4, 5, 6],
    }),
  },

  // ---- New Visualization Types ----
  {
    type: "ribbon",
    category: "effects",
    description: "Flowing ribbon/banner with text like an award ribbon",
    durationMs: 4000,
    makeCommand: () => ({
      type: "ribbon",
      position: { x: 340, y: 260 },
      text: "Best Performance Award",
      width: 280,
      color: "#6366F1",
      textColor: "#FFFFFF",
      variant: "award" as const,
    }),
  },
  {
    type: "polar-area",
    category: "dataviz",
    description: "Polar area (rose) chart with animated segments",
    durationMs: 5000,
    makeCommand: () => ({
      type: "polar-area",
      position: { x: 380, y: 200 },
      segments: [
        { label: "JS", value: 85, color: "#F7DF1E" },
        { label: "TS", value: 72, color: "#3178C6" },
        { label: "Python", value: 60, color: "#3776AB" },
        { label: "Rust", value: 45, color: "#CE412B" },
        { label: "Go", value: 55, color: "#00ADD8" },
      ],
      size: 220,
    }),
  },
  {
    type: "stacked-bar",
    category: "dataviz",
    description: "Horizontal stacked bar chart with labeled segments",
    durationMs: 5000,
    makeCommand: () => ({
      type: "stacked-bar",
      position: { x: 280, y: 200 },
      bars: [
        {
          label: "2023",
          segments: [
            { value: 40, color: "#6366F1", label: "Product" },
            { value: 25, color: "#10B981", label: "Service" },
            { value: 15, color: "#F59E0B", label: "Other" },
          ],
        },
        {
          label: "2024",
          segments: [
            { value: 55, color: "#6366F1", label: "Product" },
            { value: 30, color: "#10B981", label: "Service" },
            { value: 20, color: "#F59E0B", label: "Other" },
          ],
        },
      ],
      width: 400,
      barHeight: 36,
    }),
  },
  {
    type: "tooltip",
    category: "narrative",
    description: "Contextual tooltip pointing at a target",
    durationMs: 3000,
    makeCommand: () => ({
      type: "tooltip",
      position: { x: 420, y: 260 },
      content: "This metric shows a 23% increase from last quarter",
      direction: "top" as const,
      background: "rgba(15, 23, 42, 0.95)",
      color: "#E2E8F0",
      maxWidth: 220,
    }),
  },
  {
    type: "badge-group",
    category: "narrative",
    description: "Multiple animated badges in a grid/flow layout",
    durationMs: 4000,
    makeCommand: () => ({
      type: "badge-group",
      position: { x: 320, y: 220 },
      badges: [
        { text: "React", background: "#61DAFB22", color: "#61DAFB" },
        { text: "TypeScript", background: "#3178C622", color: "#3178C6" },
        { text: "Remotion", background: "#6366F122", color: "#6366F1" },
        { text: "Tailwind", background: "#38BDF822", color: "#38BDF8" },
        { text: "Vite", background: "#646CFF22", color: "#646CFF" },
        { text: "Node.js", background: "#68A06322", color: "#68A063" },
      ],
      layout: "flow" as const,
      gap: 10,
    }),
  },
  {
    type: "scatter",
    category: "dataviz",
    description: "Scatter plot with physics-based dot animation",
    durationMs: 5000,
    makeCommand: () => ({
      type: "scatter",
      position: { x: 300, y: 180 },
      points: [
        { x: 10, y: 20, label: "A", color: "#6366F1", size: 8 },
        { x: 30, y: 60, label: "B", color: "#10B981", size: 6 },
        { x: 50, y: 40, label: "C", color: "#F59E0B", size: 10 },
        { x: 70, y: 80, label: "D", color: "#EC4899", size: 7 },
        { x: 85, y: 55, label: "E", color: "#38BDF8", size: 9 },
        { x: 45, y: 70, label: "F", color: "#A855F7", size: 5 },
      ],
      width: 360,
      height: 260,
      xLabel: "Growth Rate",
      yLabel: "Market Share",
      showGrid: true,
    }),
  },
  {
    type: "meter",
    category: "dataviz",
    description: "Linear meter with gradient fill and animated needle",
    durationMs: 4000,
    makeCommand: () => ({
      type: "meter",
      position: { x: 320, y: 260 },
      value: 72,
      min: 0,
      max: 100,
      width: 320,
      label: "CPU Usage",
      color: "#10B981",
      unit: "%",
      ticks: 5,
      showNeedle: true,
    }),
  },
]

// ============================================================================
// SVG icon components for each overlay type
// ============================================================================

function TypeIcon({ type, size = 28, color }: { type: string; size?: number; color: string }) {
  const s = size
  const halfOpacity = `${color}88`

  switch (type) {
    case "gauge":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M6 22a12 12 0 0 1 20 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <line x1="16" y1="21" x2="22" y2="11" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="21" r="2" fill={color} />
        </svg>
      )
    case "sparkline":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <polyline points="4,24 9,18 14,22 19,12 24,16 28,8" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="28" cy="8" r="2" fill={color} />
        </svg>
      )
    case "heatmap":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="4" width="7" height="7" rx="1.5" fill={color} opacity="0.3" />
          <rect x="12.5" y="4" width="7" height="7" rx="1.5" fill={color} opacity="0.8" />
          <rect x="21" y="4" width="7" height="7" rx="1.5" fill={color} opacity="0.5" />
          <rect x="4" y="12.5" width="7" height="7" rx="1.5" fill={color} opacity="0.9" />
          <rect x="12.5" y="12.5" width="7" height="7" rx="1.5" fill={color} opacity="0.4" />
          <rect x="21" y="12.5" width="7" height="7" rx="1.5" fill={color} opacity="0.7" />
          <rect x="4" y="21" width="7" height="7" rx="1.5" fill={color} opacity="0.5" />
          <rect x="12.5" y="21" width="7" height="7" rx="1.5" fill={color} opacity="0.6" />
          <rect x="21" y="21" width="7" height="7" rx="1.5" fill={color} opacity="1" />
        </svg>
      )
    case "funnel":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M4 6 H28 L22 14 H10 Z" fill={color} opacity="0.8" />
          <path d="M10 15 H22 L19 22 H13 Z" fill={color} opacity="0.55" />
          <path d="M13 23 H19 L17 28 H15 Z" fill={color} opacity="0.35" />
        </svg>
      )
    case "waterfall":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="3" y="14" width="5" height="14" rx="1" fill={color} opacity="0.7" />
          <rect x="9.5" y="8" width="5" height="6" rx="1" fill="#10B981" opacity="0.8" />
          <rect x="16" y="18" width="5" height="8" rx="1" fill="#EF4444" opacity="0.8" />
          <rect x="22.5" y="10" width="5" height="18" rx="1" fill={color} opacity="0.7" />
          <line x1="3" y1="28" x2="29" y2="28" stroke={halfOpacity} strokeWidth="1" />
        </svg>
      )
    case "callout":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="4" width="24" height="16" rx="4" fill={color} opacity="0.2" stroke={color} strokeWidth="1.5" />
          <polygon points="12,20 16,26 20,20" fill={color} opacity="0.4" />
          <line x1="9" y1="10" x2="23" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="9" y1="14" x2="18" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        </svg>
      )
    case "timeline":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <line x1="4" y1="16" x2="28" y2="16" stroke={halfOpacity} strokeWidth="2" strokeLinecap="round" />
          <circle cx="8" cy="16" r="3" fill={color} />
          <circle cx="16" cy="16" r="3" fill={color} opacity="0.7" />
          <circle cx="24" cy="16" r="3" fill={color} opacity="0.4" />
        </svg>
      )
    case "flowchart":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="2" y="10" width="8" height="8" rx="2" fill={color} opacity="0.3" stroke={color} strokeWidth="1.2" />
          <rect x="22" y="4" width="8" height="8" rx="2" fill={color} opacity="0.3" stroke={color} strokeWidth="1.2" />
          <rect x="22" y="18" width="8" height="8" rx="2" fill={color} opacity="0.3" stroke={color} strokeWidth="1.2" />
          <path d="M10 14 L22 8" stroke={color} strokeWidth="1.5" markerEnd="url(#flowArrow)" />
          <path d="M10 14 L22 22" stroke={color} strokeWidth="1.5" />
          <defs>
            <marker id="flowArrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L6,3 L0,6 Z" fill={color} />
            </marker>
          </defs>
        </svg>
      )
    case "table":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="6" width="24" height="20" rx="2" stroke={color} strokeWidth="1.5" fill="none" />
          <line x1="4" y1="12" x2="28" y2="12" stroke={color} strokeWidth="1.5" />
          <line x1="4" y1="18" x2="28" y2="18" stroke={halfOpacity} strokeWidth="1" />
          <line x1="4" y1="22" x2="28" y2="22" stroke={halfOpacity} strokeWidth="1" strokeDasharray="2 2" />
          <line x1="14" y1="6" x2="14" y2="26" stroke={halfOpacity} strokeWidth="1" />
        </svg>
      )
    case "list":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <circle cx="7" cy="9" r="2" fill={color} />
          <line x1="13" y1="9" x2="27" y2="9" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <circle cx="7" cy="16" r="2" fill={color} opacity="0.6" />
          <line x1="13" y1="16" x2="24" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <circle cx="7" cy="23" r="2" fill={color} opacity="0.4" />
          <line x1="13" y1="23" x2="21" y2="23" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        </svg>
      )
    case "confetti":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="6" y="4" width="4" height="4" rx="0.5" fill="#FF6B6B" transform="rotate(15 8 6)" />
          <rect x="18" y="3" width="3.5" height="3.5" rx="0.5" fill="#4ECDC4" transform="rotate(-20 19 5)" />
          <rect x="25" y="10" width="3" height="3" rx="0.5" fill="#FFEAA7" transform="rotate(30 26 11)" />
          <rect x="3" y="15" width="3.5" height="3.5" rx="0.5" fill="#DDA0DD" transform="rotate(-10 5 17)" />
          <rect x="14" y="12" width="4" height="4" rx="0.5" fill="#45B7D1" transform="rotate(25 16 14)" />
          <rect x="22" y="20" width="3" height="3" rx="0.5" fill="#96CEB4" transform="rotate(-25 23 21)" />
          <rect x="8" y="23" width="3.5" height="3.5" rx="0.5" fill="#FF6B6B" transform="rotate(40 10 25)" />
          <rect x="16" y="22" width="3" height="3" rx="0.5" fill="#4ECDC4" transform="rotate(-15 17 23)" />
        </svg>
      )
    case "countdown":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <text x="16" y="23" textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="SF Mono, Consolas, monospace">3</text>
          <circle cx="16" cy="16" r="13" stroke={halfOpacity} strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
        </svg>
      )
    case "reveal":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="6" width="24" height="20" rx="3" fill={color} opacity="0.15" stroke={color} strokeWidth="1.2" />
          <clipPath id="revealClip">
            <rect x="4" y="6" width="14" height="20" />
          </clipPath>
          <rect x="4" y="6" width="24" height="20" rx="3" fill={color} opacity="0.45" clipPath="url(#revealClip)" />
          <line x1="18" y1="6" x2="18" y2="26" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      )
    case "zoom":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <circle cx="14" cy="14" r="9" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.08" />
          <line x1="21" y1="21" x2="28" y2="28" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <text x="14" y="17" textAnchor="middle" fill={color} fontSize="9" fontWeight="700">2x</text>
        </svg>
      )
    case "morph":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <text x="6" y="21" fill={color} fontSize="14" fontWeight="800" opacity="0.6">A</text>
          <path d="M15 16 L20 12 M20 12 L20 16 M15 16 L20 20 M20 20 L20 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <text x="22" y="21" fill={color} fontSize="14" fontWeight="800">B</text>
        </svg>
      )
    case "radar":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <polygon points="16,4 26,10 26,22 16,28 6,22 6,10" stroke={halfOpacity} strokeWidth="1" fill="none" />
          <polygon points="16,8 22,12 22,20 16,24 10,20 10,12" stroke={halfOpacity} strokeWidth="0.8" fill="none" />
          <polygon points="16,9 24,13 22,21 14,23 9,17 11,11" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.2" />
          <circle cx="16" cy="9" r="1.5" fill={color} />
          <circle cx="24" cy="13" r="1.5" fill={color} />
          <circle cx="22" cy="21" r="1.5" fill={color} />
        </svg>
      )
    case "sankey":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="2" y="4" width="4" height="10" rx="1" fill={color} opacity="0.8" />
          <rect x="2" y="18" width="4" height="10" rx="1" fill={color} opacity="0.5" />
          <rect x="26" y="8" width="4" height="16" rx="1" fill={color} opacity="0.7" />
          <path d="M6 9 C14 9 18 14 26 14" stroke={color} strokeWidth="3" fill="none" opacity="0.4" />
          <path d="M6 23 C14 23 18 18 26 18" stroke={color} strokeWidth="2.5" fill="none" opacity="0.3" />
        </svg>
      )
    case "kpi":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <text x="4" y="16" fill={color} fontSize="14" fontWeight="800">$</text>
          <text x="12" y="16" fill={color} fontSize="11" fontWeight="700">2.8M</text>
          <path d="M4 22 L8 20 L12 21 L16 19 L20 18 L24 16 L28 14" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5" strokeLinecap="round" />
          <polyline points="24,10 28,8 28,12" stroke="#10B981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="19" y="28" fill="#10B981" fontSize="7" fontWeight="700">+12%</text>
        </svg>
      )
    case "matrix":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="3" y="4" width="26" height="24" rx="2" stroke={halfOpacity} strokeWidth="1" fill="none" />
          <line x1="3" y1="10" x2="29" y2="10" stroke={halfOpacity} strokeWidth="1" />
          <line x1="12" y1="4" x2="12" y2="28" stroke={halfOpacity} strokeWidth="0.8" />
          <line x1="20" y1="4" x2="20" y2="28" stroke={halfOpacity} strokeWidth="0.8" />
          <circle cx="16" cy="16" r="2" fill="#10B981" />
          <circle cx="24" cy="16" r="2" fill="#10B981" />
          <circle cx="16" cy="22" r="2" fill={color} opacity="0.5" />
          <circle cx="24" cy="22" r="2" fill="#10B981" />
          <line x1="14" y1="16" x2="18" y2="16" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" transform="rotate(45 16 16)" />
          <line x1="14" y1="16" x2="18" y2="16" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" transform="rotate(-45 16 16)" />
        </svg>
      )
    case "annotation-group":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="5" width="10" height="6" rx="2" fill={color} opacity="0.3" stroke={color} strokeWidth="1" />
          <rect x="4" y="13" width="10" height="6" rx="2" fill={color} opacity="0.5" stroke={color} strokeWidth="1" />
          <rect x="4" y="21" width="10" height="6" rx="2" fill={color} opacity="0.7" stroke={color} strokeWidth="1" />
          <path d="M14 8 L18 8 L18 24 L14 24" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <line x1="18" y1="16" x2="28" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
        </svg>
      )
    case "treemap":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="3" y="3" width="14" height="16" rx="1.5" fill={color} opacity="0.7" />
          <rect x="19" y="3" width="10" height="9" rx="1.5" fill={color} opacity="0.5" />
          <rect x="19" y="14" width="10" height="5" rx="1.5" fill={color} opacity="0.35" />
          <rect x="3" y="21" width="8" height="8" rx="1.5" fill={color} opacity="0.45" />
          <rect x="13" y="21" width="16" height="8" rx="1.5" fill={color} opacity="0.25" />
        </svg>
      )
    case "donut":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M16 4 A12 12 0 0 1 28 16" stroke="#6366F1" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M28 16 A12 12 0 0 1 16 28" stroke="#10B981" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M16 28 A12 12 0 0 1 4 16" stroke="#F59E0B" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M4 16 A12 12 0 0 1 16 4" stroke="#EC4899" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
      )
    case "stat-card":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="3" y="6" width="26" height="20" rx="3" fill={color} opacity="0.08" stroke={color} strokeWidth="1.2" />
          <text x="7" y="15" fill={color} fontSize="7" fontWeight="600" opacity="0.6">3200</text>
          <path d="M7 18 L25 18" stroke={halfOpacity} strokeWidth="0.8" strokeDasharray="2 1" />
          <text x="7" y="24" fill={color} fontSize="8" fontWeight="800">890</text>
          <polyline points="21,22 23,19 25,21" stroke="#10B981" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case "code-block":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="3" y="4" width="26" height="24" rx="3" fill={color} opacity="0.08" stroke={color} strokeWidth="1" />
          <line x1="7" y1="11" x2="18" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <line x1="10" y1="15" x2="22" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="10" y1="19" x2="20" y2="19" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          <line x1="7" y1="23" x2="14" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          <rect x="9" y="14" width="14" height="6" rx="1" fill="#F59E0B" opacity="0.12" />
        </svg>
      )
    case "spotlight":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="2" y="2" width="28" height="28" rx="4" fill={color} opacity="0.15" />
          <circle cx="16" cy="16" r="7" fill="#0a0a0f" stroke={color} strokeWidth="1.5" />
          <circle cx="16" cy="16" r="4" fill={color} opacity="0.25" />
        </svg>
      )
    case "arrow":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <line x1="5" y1="24" x2="24" y2="8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <polyline points="18,7 25,7 25,14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )
    case "text":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <text x="5" y="22" fill={color} fontSize="18" fontWeight="800" fontFamily="serif">Aa</text>
        </svg>
      )
    case "circle":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="11" stroke={color} strokeWidth="2.5" fill="none" />
        </svg>
      )
    case "highlight":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="10" width="24" height="12" rx="3" fill={color} opacity="0.35" />
          <line x1="8" y1="16" x2="24" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      )
    case "card":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="5" width="24" height="22" rx="3" fill={color} opacity="0.1" stroke={color} strokeWidth="1.3" />
          <line x1="8" y1="12" x2="24" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="8" y1="17" x2="20" y2="17" stroke={halfOpacity} strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="21" x2="16" y2="21" stroke={halfOpacity} strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case "pulse":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="4" fill={color} />
          <circle cx="16" cy="16" r="8" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5" />
          <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="1" fill="none" opacity="0.25" />
        </svg>
      )
    case "underline":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <line x1="6" y1="14" x2="26" y2="14" stroke={halfOpacity} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M6 20 Q10 17 14 20 Q18 23 22 20 Q24 18.5 26 20" stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
      )
    case "badge":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="5" y="10" width="22" height="12" rx="6" fill={color} opacity="0.2" stroke={color} strokeWidth="1.3" />
          <text x="16" y="19" textAnchor="middle" fill={color} fontSize="8" fontWeight="700">TAG</text>
        </svg>
      )
    case "progress":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="13" width="24" height="6" rx="3" fill={color} opacity="0.15" />
          <rect x="4" y="13" width="17" height="6" rx="3" fill={color} opacity="0.7" />
        </svg>
      )
    case "counter":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <text x="4" y="22" fill={color} fontSize="11" fontWeight="600" fontFamily="SF Mono, Consolas, monospace" opacity="0.5">#</text>
          <text x="12" y="22" fill={color} fontSize="14" fontWeight="800" fontFamily="SF Mono, Consolas, monospace">123</text>
        </svg>
      )
    case "bracket":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M18 4 C12 4 12 16 12 16 C12 16 12 28 18 28" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      )
    case "trendline":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <polyline points="4,24 10,18 16,20 22,10 28,6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="10" cy="18" r="1.5" fill={color} opacity="0.6" />
          <circle cx="16" cy="20" r="1.5" fill={color} opacity="0.6" />
          <circle cx="22" cy="10" r="1.5" fill={color} opacity="0.6" />
          <circle cx="28" cy="6" r="2" fill={color} />
        </svg>
      )
    case "comparison":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="7" y="8" width="7" height="18" rx="1.5" fill="#10B981" opacity="0.7" />
          <rect x="18" y="14" width="7" height="12" rx="1.5" fill="#EF4444" opacity="0.7" />
          <line x1="4" y1="26" x2="28" y2="26" stroke={halfOpacity} strokeWidth="1" />
        </svg>
      )
    case "typewriter":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <text x="4" y="20" fill={color} fontSize="12" fontWeight="600" fontFamily="SF Mono, Consolas, monospace" opacity="0.7">Hi_</text>
          <rect x="22" y="11" width="2" height="12" rx="0.5" fill={color}>
            <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
          </rect>
        </svg>
      )
    case "chart":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="5" y="16" width="5" height="10" rx="1" fill={color} opacity="0.5" />
          <rect x="12" y="10" width="5" height="16" rx="1" fill={color} opacity="0.7" />
          <rect x="19" y="6" width="5" height="20" rx="1" fill={color} opacity="0.9" />
          <line x1="4" y1="27" x2="28" y2="27" stroke={halfOpacity} strokeWidth="1" />
        </svg>
      )
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="4" y="4" width="24" height="24" rx="4" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.08" />
          <text x="16" y="20" textAnchor="middle" fill={color} fontSize="10" fontWeight="700">?</text>
        </svg>
      )
  }
}

// ============================================================================
// Step ID factory (shared across demo generations)
// ============================================================================

let _galleryStepId = 5000
function makeDemoStep(
  command: PresentationCommand,
  startMs: number,
  endMs?: number,
): PresentationStep {
  const id = `gallery-${++_galleryStepId}`
  return {
    id,
    toolUseId: `t-${id}`,
    toolName: "gallery-demo",
    toolInput: {},
    command,
    description: describeCommand(command),
    status: "done",
    startMs,
    endMs,
  }
}

// ============================================================================
// Inject styles once
// ============================================================================

let _galleryStylesInjected = false
function injectGalleryStyles() {
  if (_galleryStylesInjected) return
  _galleryStylesInjected = true
  const style = document.createElement("style")
  style.textContent = `
    .sg-card {
      transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
      cursor: pointer;
      outline: none;
    }
    .sg-card:hover {
      transform: translateY(-3px);
    }
    .sg-card:active {
      transform: translateY(-1px) scale(0.98);
    }
    .sg-card:focus-visible {
      box-shadow: 0 0 0 2px rgba(118,185,0,0.5);
    }
    .sg-cat-btn {
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
      cursor: pointer;
      outline: none;
    }
    .sg-cat-btn:focus-visible {
      box-shadow: 0 0 0 2px rgba(118,185,0,0.5);
    }
    .sg-search {
      outline: none;
      transition: border-color 150ms ease;
    }
    .sg-search:focus {
      border-color: rgba(255,255,255,0.25) !important;
    }
    .sg-search::placeholder {
      color: rgba(255,255,255,0.25);
    }
    .sg-back-btn {
      transition: background 120ms ease, border-color 120ms ease;
      cursor: pointer;
      outline: none;
    }
    .sg-back-btn:hover {
      background: rgba(255,255,255,0.1) !important;
    }
    .sg-back-btn:active {
      transform: scale(0.96);
    }
    @keyframes sgFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sg-fade-in {
      animation: sgFadeIn 300ms ease both;
    }
  `
  document.head.appendChild(style)
}

// ============================================================================
// Gallery component
// ============================================================================

export interface StepGalleryProps {
  onPlayDemo: (steps: PresentationStep[], totalDurationMs: number) => void
  onBack: () => void
}

type SortMode = "category" | "alpha" | "duration"

export function StepGallery({ onPlayDemo, onBack }: StepGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all")
  const [search, setSearch] = useState("")
  const [sortMode, setSortMode] = useState<SortMode>("category")
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    injectGalleryStyles()
  }, [])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const cards = cardRefs.current.filter(Boolean)
      const cols = Math.max(1, Math.floor((gridRef.current?.clientWidth ?? 800) / 274))

      if (e.key === "ArrowRight") {
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, cards.length - 1))
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + cols, cards.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - cols, 0))
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Focus the card when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0) {
      cardRefs.current[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  const filtered = useMemo(() => {
    let result = STEP_CATALOG
    if (activeCategory !== "all") {
      result = result.filter((e) => e.category === activeCategory)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (e) =>
          e.type.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          CATEGORY_META[e.category].label.toLowerCase().includes(q),
      )
    }
    // Sort
    if (sortMode === "alpha") {
      result = [...result].sort((a, b) => a.type.localeCompare(b.type))
    } else if (sortMode === "duration") {
      result = [...result].sort((a, b) => b.durationMs - a.durationMs)
    }
    return result
  }, [activeCategory, search, sortMode])

  const handlePlayDemo = useCallback(
    (entry: StepTypeEntry) => {
      const command = entry.makeCommand()
      const step = makeDemoStep(command, 0, entry.durationMs)
      const clearStep = makeDemoStep({ type: "clear" }, entry.durationMs)
      const totalMs = entry.durationMs + 1000
      onPlayDemo([step, clearStep], totalMs)
    },
    [onPlayDemo],
  )

  const handlePlayAll = useCallback(() => {
    const steps: PresentationStep[] = []
    let offset = 0
    for (const entry of filtered) {
      const command = entry.makeCommand()
      steps.push(makeDemoStep(command, offset, offset + entry.durationMs))
      offset += entry.durationMs
      steps.push(makeDemoStep({ type: "clear" }, offset))
      offset += 500 // gap between demos
    }
    if (steps.length > 0) {
      onPlayDemo(steps, offset + 500)
    }
  }, [filtered, onPlayDemo])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: STEP_CATALOG.length }
    for (const cat of ALL_CATEGORIES) {
      counts[cat] = STEP_CATALOG.filter((e) => e.category === cat).length
    }
    return counts
  }, [])

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(160deg, #0f0c29 0%, #1a1545 50%, #24243e 100%)",
        overflow: "hidden",
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.06), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "24px 40px 0",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Top bar: back + title + search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <button
            className="sg-back-btn"
            type="button"
            onClick={onBack}
            aria-label="Back to scripts"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Scripts
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#fff",
                margin: 0,
                letterSpacing: -0.3,
              }}
            >
              Step Type Gallery
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.4)",
                margin: "2px 0 0",
              }}
            >
              {STEP_CATALOG.length} overlay types -- click any card to see a live demo
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Sort selector */}
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.65)",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                appearance: "none",
                paddingRight: 24,
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
              }}
            >
              <option value="category">By Category</option>
              <option value="alpha">Alphabetical</option>
              <option value="duration">By Duration</option>
            </select>

            {/* Search */}
            <div style={{ position: "relative", width: 240 }}>
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="sg-search"
                type="text"
                placeholder="Search types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  height: 36,
                  padding: "0 36px 0 32px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  backdropFilter: "blur(8px)",
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 20,
                    height: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 4,
                    border: "none",
                    background: "rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Results count */}
            {(search || activeCategory !== "all") && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(255,255,255,0.4)",
                whiteSpace: "nowrap",
              }}>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            )}

            {/* Play All button */}
            <button
              type="button"
              onClick={handlePlayAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 8,
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.3)",
                color: "#818CF8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              Play All ({filtered.length})
            </button>
          </div>
        </div>

        {/* Category filter tabs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <CategoryTab
            label="All"
            count={categoryCounts.all}
            color="rgba(255,255,255,0.5)"
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {ALL_CATEGORIES.map((cat) => (
            <CategoryTab
              key={cat}
              label={CATEGORY_META[cat].label}
              count={categoryCounts[cat]}
              color={CATEGORY_META[cat].color}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Scrollable grid */}
      <div
        ref={gridRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 40px 40px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 300,
              gap: 12,
              color: "rgba(255,255,255,0.3)",
            }}
          >
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" opacity={0.4}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>No matching types</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
              Try a different search or category
            </span>
            <button
              type="button"
              onClick={() => { setSearch(""); setActiveCategory("all") }}
              style={{
                marginTop: 8,
                padding: "6px 16px",
                borderRadius: 6,
                border: "1px solid rgba(99,102,241,0.3)",
                background: "rgba(99,102,241,0.1)",
                color: "#818CF8",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 14,
            }}
          >
            {filtered.map((entry, idx) => (
              <StepCard
                key={entry.type}
                entry={entry}
                index={idx}
                onClick={() => handlePlayDemo(entry)}
                cardRef={(el) => { cardRefs.current[idx] = el }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function CategoryTab({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      className="sg-cat-btn"
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 8,
        border: active ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.08)",
        background: active ? `${color}18` : "rgba(255,255,255,0.03)",
        color: active ? color : "rgba(255,255,255,0.5)",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? color : "rgba(255,255,255,0.2)",
          boxShadow: active ? `0 0 6px ${color}66` : "none",
          flexShrink: 0,
        }}
      />
      {label}
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: active ? `${color}aa` : "rgba(255,255,255,0.25)",
          marginLeft: 2,
        }}
      >
        {count}
      </span>
    </button>
  )
}

const StepCard = React.memo(function StepCard({
  entry,
  index,
  onClick,
  cardRef,
}: {
  entry: StepTypeEntry
  index: number
  onClick: () => void
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const [hovered, setHovered] = useState(false)
  const catMeta = CATEGORY_META[entry.category]
  const catColor = catMeta.color

  return (
    <div
      ref={cardRef}
      className="sg-card sg-fade-in"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 18px",
        borderRadius: 12,
        background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        border: hovered ? `1px solid ${catColor}55` : "1px solid rgba(255,255,255,0.07)",
        boxShadow: hovered ? `0 12px 32px rgba(0,0,0,0.3), 0 0 24px ${catColor}15, inset 0 1px 0 rgba(255,255,255,0.06)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease, background 200ms ease",
        animationDelay: `${Math.min(index * 30, 300)}ms`,
      }}
    >
      {/* Top row: icon + name + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: `${catColor}12`,
            border: `1px solid ${catColor}25`,
          }}
        >
          <TypeIcon type={entry.type} size={28} color={catColor} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
              fontFamily: "SFMono-Regular, Consolas, monospace",
            }}
          >
            {entry.type}
          </div>
        </div>

        <span
          style={{
            flexShrink: 0,
            padding: "2px 8px",
            borderRadius: 5,
            background: `${catColor}15`,
            border: `1px solid ${catColor}30`,
            fontSize: 9,
            fontWeight: 700,
            color: catColor,
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {catMeta.label}
        </span>
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.5)",
          flex: 1,
        }}
      >
        {entry.description}
      </div>

      {/* Footer: duration bar + play hint */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          paddingTop: 6,
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Duration bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (entry.durationMs / 6000) * 100)}%`, height: "100%", borderRadius: 2, background: `linear-gradient(90deg, ${catColor}55, ${catColor}aa)` }} />
          </div>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
            {(entry.durationMs / 1000).toFixed(0)}s
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.25)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Click to play demo
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 10,
            fontWeight: 600,
            color: hovered ? catColor : "rgba(255,255,255,0.25)",
            transition: "color 150ms ease",
          }}
        >
          <svg
            width={10}
            height={10}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          Play
        </div>
        </div>
      </div>
    </div>
  )
})
