import type { PresentationStep } from "@viben/presentation"
import { describeCommand } from "@viben/presentation"

/**
 * 15-step educational presentation script -- AI Chip Market Analysis
 *
 * Designed like a "XiaoLin Says" (小Lin说) style walkthrough:
 * Build understanding step-by-step, telling a story from the big picture
 * down to details, comparisons, and finally a conclusion.
 *
 * Coordinates are absolute pixels matching the MockBackground layout (1024x768 viewport, 40px padding).
 */
export const demoSteps: PresentationStep[] = [
  // Step 1: Spotlight on the title area
  {
    id: "step-01",
    toolUseId: "tool-01",
    toolName: "presentation_spotlight",
    toolInput: {},
    command: {
      type: "spotlight",
      region: { x: 60, y: 30, width: 700, height: 80 },
      maskOpacity: 0.72,
      borderRadius: 12,
      animate: true,
    },
    description: describeCommand({
      type: "spotlight",
      region: { x: 60, y: 30, width: 700, height: 80 },
      maskOpacity: 0.72,
      borderRadius: 12,
      animate: true,
    }),
    status: "pending",
  },

  // Step 2: Text annotation near the title
  {
    id: "step-02",
    toolUseId: "tool-02",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "text",
      position: { x: 60, y: 115 },
      content: "2024年，AI芯片是全球最火的赛道",
      fontSize: 15,
      fontWeight: 700,
      color: "#FFFFFF",
      background: "rgba(139, 92, 246, 0.88)",
      animate: true,
    },
    description: describeCommand({
      type: "text",
      position: { x: 60, y: 115 },
      content: "2024年，AI芯片是全球最火的赛道",
    }),
    status: "pending",
  },

  // Step 3: Spotlight moves to NVIDIA data box
  {
    id: "step-03",
    toolUseId: "tool-03",
    toolName: "presentation_spotlight",
    toolInput: {},
    command: {
      type: "spotlight",
      region: { x: 40, y: 148, width: 280, height: 120 },
      maskOpacity: 0.68,
      borderRadius: 12,
      animate: true,
    },
    description: describeCommand({
      type: "spotlight",
      region: { x: 40, y: 148, width: 280, height: 120 },
      maskOpacity: 0.68,
      borderRadius: 12,
      animate: true,
    }),
    status: "pending",
  },

  // Step 4: Card from right -- NVIDIA deep dive
  {
    id: "step-04",
    toolUseId: "tool-04",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "card",
      position: { x: 680, y: 100 },
      width: 310,
      title: "NVIDIA: 绝对王者",
      content:
        "H100/H200 统治训练市场\nCUDA 生态锁定开发者\n数据中心收入 $26B (YoY +265%)\n客户包括所有头部云厂商",
      tag: "🟢 领导者",
      tagColor: "#76B900",
      enterFrom: "right",
      animate: true,
    },
    description: describeCommand({
      type: "card",
      position: { x: 680, y: 100 },
      title: "NVIDIA: 绝对王者",
    }),
    status: "pending",
  },

  // Step 5: Arrow from card pointing to NVIDIA box
  {
    id: "step-05",
    toolUseId: "tool-05",
    toolName: "presentation_callout",
    toolInput: {},
    command: {
      type: "arrow",
      from: { x: 680, y: 180 },
      to: { x: 320, y: 200 },
      color: "#76B900",
      label: "80% 份额",
      strokeWidth: 2.5,
      animate: true,
    },
    description: describeCommand({
      type: "arrow",
      from: { x: 680, y: 180 },
      to: { x: 320, y: 200 },
      color: "#76B900",
      label: "80% 份额",
    }),
    status: "pending",
  },

  // Step 6: Circle around "80%" number in NVIDIA box
  {
    id: "step-06",
    toolUseId: "tool-06",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "circle",
      center: { x: 130, y: 215 },
      radius: 28,
      color: "#EF4444",
      strokeWidth: 3,
      animate: true,
    },
    description: describeCommand({
      type: "circle",
      center: { x: 130, y: 215 },
      radius: 28,
    }),
    status: "pending",
  },

  // Step 7: Spotlight moves to AMD data box
  {
    id: "step-07",
    toolUseId: "tool-07",
    toolName: "presentation_spotlight",
    toolInput: {},
    command: {
      type: "spotlight",
      region: { x: 340, y: 148, width: 280, height: 120 },
      maskOpacity: 0.65,
      borderRadius: 12,
      animate: true,
    },
    description: describeCommand({
      type: "spotlight",
      region: { x: 340, y: 148, width: 280, height: 120 },
      maskOpacity: 0.65,
      borderRadius: 12,
      animate: true,
    }),
    status: "pending",
  },

  // Step 8: Card from left -- AMD analysis
  {
    id: "step-08",
    toolUseId: "tool-08",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "card",
      position: { x: 30, y: 300 },
      width: 310,
      title: "AMD: 最强挑战者",
      content:
        "MI300X 性价比出色\nROCm 生态逐步成熟\n推理场景竞争力强\n获得微软/Meta 大单",
      tag: "🔴 挑战者",
      tagColor: "#ED1C24",
      enterFrom: "left",
      animate: true,
    },
    description: describeCommand({
      type: "card",
      position: { x: 30, y: 300 },
      title: "AMD: 最强挑战者",
    }),
    status: "pending",
  },

  // Step 9: Arrow from AMD card to AMD data
  {
    id: "step-09",
    toolUseId: "tool-09",
    toolName: "presentation_callout",
    toolInput: {},
    command: {
      type: "arrow",
      from: { x: 340, y: 340 },
      to: { x: 480, y: 215 },
      color: "#ED1C24",
      label: "快速追赶",
      strokeWidth: 2.5,
      animate: true,
    },
    description: describeCommand({
      type: "arrow",
      from: { x: 340, y: 340 },
      to: { x: 480, y: 215 },
      color: "#ED1C24",
      label: "快速追赶",
    }),
    status: "pending",
  },

  // Step 10: Highlight over the analysis paragraph area
  {
    id: "step-10",
    toolUseId: "tool-10",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "highlight",
      region: { x: 40, y: 320, width: 520, height: 100 },
      color: "rgba(96, 165, 250, 0.25)",
      opacity: 0.3,
      borderRadius: 8,
      animate: true,
    },
    description: describeCommand({
      type: "highlight",
      region: { x: 40, y: 320, width: 520, height: 100 },
    }),
    status: "pending",
  },

  // Step 11: Text annotation -- key turning point
  {
    id: "step-11",
    toolUseId: "tool-11",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "text",
      position: { x: 60, y: 430 },
      content: "关键转折点：开源生态的崛起",
      fontSize: 16,
      fontWeight: 700,
      color: "#FFFFFF",
      background: "rgba(245, 158, 11, 0.88)",
      animate: true,
    },
    description: describeCommand({
      type: "text",
      position: { x: 60, y: 430 },
      content: "关键转折点：开源生态的崛起",
    }),
    status: "pending",
  },

  // Step 12: Spotlight expands to show ALL three data boxes
  {
    id: "step-12",
    toolUseId: "tool-12",
    toolName: "presentation_spotlight",
    toolInput: {},
    command: {
      type: "spotlight",
      region: { x: 30, y: 140, width: 930, height: 140 },
      maskOpacity: 0.6,
      borderRadius: 14,
      animate: true,
    },
    description: describeCommand({
      type: "spotlight",
      region: { x: 30, y: 140, width: 930, height: 140 },
      maskOpacity: 0.6,
      borderRadius: 14,
      animate: true,
    }),
    status: "pending",
  },

  // Step 13: Card from bottom -- comparison summary
  {
    id: "step-13",
    toolUseId: "tool-13",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "card",
      position: { x: 300, y: 400 },
      width: 420,
      title: "三方格局",
      content:
        "NVIDIA 统治但溢价过高\nAMD 性价比吸引中小客户\nGoogle TPU 主攻自用场景",
      tag: "📊 格局",
      tagColor: "#6366F1",
      enterFrom: "bottom",
      animate: true,
      borderColor: "rgba(99, 102, 241, 0.3)",
    },
    description: describeCommand({
      type: "card",
      position: { x: 300, y: 400 },
      title: "三方格局",
    }),
    status: "pending",
  },

  // Step 14: Clear all annotations
  {
    id: "step-14",
    toolUseId: "tool-14",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "clear",
    },
    description: describeCommand({ type: "clear" }),
    status: "pending",
  },

  // Step 15: Final conclusion text
  {
    id: "step-15",
    toolUseId: "tool-15",
    toolName: "presentation_draw",
    toolInput: {},
    command: {
      type: "text",
      position: { x: 150, y: 280 },
      content: "结论：AI芯片从垄断走向竞争，这对每个开发者都是好消息",
      fontSize: 24,
      fontWeight: 800,
      color: "#FFFFFF",
      background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
      animate: true,
    },
    description: describeCommand({
      type: "text",
      position: { x: 150, y: 280 },
      content: "结论：AI芯片从垄断走向竞争，这对每个开发者都是好消息",
    }),
    status: "pending",
  },
]
