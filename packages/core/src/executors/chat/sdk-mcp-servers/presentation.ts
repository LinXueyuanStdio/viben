/**
 * Presentation MCP Server
 *
 * Provides overlay drawing tools (arrows, highlights, circles, text, lines)
 * for agent presentation mode. The actual rendering is done on the frontend —
 * tool handlers here validate input and return success.
 * The frontend intercepts tool_use SSE events and dispatches to overlay store.
 */

import { registerSdkMcpServer } from "../sdk-mcp-registry";

registerSdkMcpServer("presentation", (sdk) => {
  const { createSdkMcpServer, tool } = sdk;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require("zod");

  const pointSchema = {
    x: z.number().describe("X coordinate in CSS pixels (0 = left edge)"),
    y: z.number().describe("Y coordinate in CSS pixels (0 = top edge)"),
  };

  const colorEnum = z
    .enum([
      "black", "grey", "light-violet", "violet", "blue",
      "light-blue", "yellow", "orange", "green", "light-green",
      "light-red", "red", "white",
    ])
    .optional()
    .describe("Shape color");

  const sizeEnum = z.enum(["s", "m", "l"]).optional().describe("Shape size");
  const animateFlag = z.boolean().optional().describe("Whether to animate entrance (fade in)");

  const arrowCommand = z.object({
    type: z.literal("arrow"),
    from: z.object(pointSchema),
    to: z.object(pointSchema),
    color: colorEnum,
    label: z.string().optional().describe("Text label on the arrow"),
    size: sizeEnum,
    animate: animateFlag,
  });

  const highlightCommand = z.object({
    type: z.literal("highlight"),
    region: z.object({
      x: z.number(), y: z.number(),
      width: z.number(), height: z.number(),
    }),
    color: colorEnum,
    animate: animateFlag,
  });

  const circleCommand = z.object({
    type: z.literal("circle"),
    center: z.object(pointSchema),
    radius: z.number().describe("Radius in pixels"),
    color: colorEnum,
    animate: animateFlag,
  });

  const textCommand = z.object({
    type: z.literal("text"),
    position: z.object(pointSchema),
    content: z.string().describe("Text content"),
    color: colorEnum,
    size: sizeEnum,
  });

  const lineCommand = z.object({
    type: z.literal("line"),
    points: z.array(z.object(pointSchema)).min(2),
    color: colorEnum,
    size: sizeEnum,
    animate: animateFlag,
  });

  const clearCommand = z.object({ type: z.literal("clear") });
  const waitCommand = z.object({
    type: z.literal("wait"),
    ms: z.number().min(0).max(10000).describe("Wait ms (max 10s)"),
  });

  return createSdkMcpServer({
    name: "presentation",
    version: "1.0.0",
    tools: [
      tool(
        "presentation_draw",
        "在用户屏幕上绘制可视化标注进行演示讲解。支持箭头、高亮框、圆圈、文字、线条。坐标以屏幕 CSS 像素为单位，左上角为 (0,0)。使用前请先通过截图获取屏幕坐标信息。",
        {
          commands: z.array(
            z.discriminatedUnion("type", [
              arrowCommand, highlightCommand, circleCommand,
              textCommand, lineCommand, clearCommand, waitCommand,
            ])
          ).describe("绘制指令序列，按顺序执行"),
        },
        async (args) => {
          const commands = args.commands;
          if (!commands || !Array.isArray(commands) || commands.length === 0) {
            return { content: [{ type: "text", text: "Error: commands array is empty" }], isError: true };
          }
          return { content: [{ type: "text", text: `Queued ${commands.length} presentation command(s).` }] };
        }
      ),
      tool(
        "presentation_clear",
        "清空演示画布上的所有标注。",
        {},
        async () => ({ content: [{ type: "text", text: "Presentation canvas cleared." }] })
      ),
      tool(
        "presentation_stop",
        "退出演示模式，清空画布并隐藏 overlay。",
        {},
        async () => ({ content: [{ type: "text", text: "Presentation mode stopped." }] })
      ),
    ],
  });
});
