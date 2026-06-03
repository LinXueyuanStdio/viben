/**
 * Presentation MCP Server
 *
 * Provides whiteboard-style overlay tools for agent presentation mode.
 * The low-level drawing protocol remains `presentation_draw`, while higher-level
 * semantic tools help agents choose the right presentation pattern more
 * reliably: spotlighting a region, adding a callout, walking through a flow,
 * or comparing two regions.
 *
 * The actual rendering is done on the frontend. Tool handlers here validate
 * input and then await the client-side completion via the ClientToolCompletionRegistry.
 * The frontend intercepts tool_use SSE events and dispatches the corresponding
 * drawing commands to the overlay store, then POSTs the result back.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ClientSideToolOptions } from "../../../services/client-tool-completion";
import { z } from "zod";
import { ClientToolCancelledError, clientToolCompletionRegistry } from "../../../services/client-tool-completion";
import { registerSdkMcpServer } from "../sdk-mcp-registry";

registerSdkMcpServer("presentation", (sdk, context) => {
  const { createSdkMcpServer, tool } = sdk;

  const sessionId = context?.sessionId;

  function ok(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }] };
  }

  function error(message: string): CallToolResult {
    return { content: [{ type: "text" as const, text: message }], isError: true };
  }

  /**
   * Wrapper around waitForClient that catches ClientToolCancelledError
   * and returns a graceful error result instead of letting the exception propagate.
   */
  async function safeWaitForClient(sid: string): Promise<CallToolResult> {
    try {
      return await clientToolCompletionRegistry.waitForClient(sid);
    } catch (err) {
      if (err instanceof ClientToolCancelledError) {
        return { content: [{ type: "text" as const, text: "Presentation cancelled by user." }], isError: true };
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Register client-side tool options
  // ---------------------------------------------------------------------------

  const clientSideToolsConfig: Record<string, ClientSideToolOptions> = {
    presentation_draw:        { timeoutMs: 30_000 },
    presentation_spotlight:   { timeoutMs: 30_000 },
    presentation_callout:     { timeoutMs: 30_000 },
    presentation_compare:     { timeoutMs: 30_000 },
    presentation_walkthrough: { timeoutMs: 0 },  // uses global max
  };
  for (const [toolName, options] of Object.entries(clientSideToolsConfig)) {
    clientToolCompletionRegistry.registerToolOptions(toolName, options);
  }

  // ---------------------------------------------------------------------------
  // Schemas
  // ---------------------------------------------------------------------------

  const pointSchema = {
    x: z.number().describe("X coordinate in CSS pixels (0 = left edge)"),
    y: z.number().describe("Y coordinate in CSS pixels (0 = top edge)"),
  };

  const rectSchema = z.object({
    x: z.number().describe("Left position in CSS pixels"),
    y: z.number().describe("Top position in CSS pixels"),
    width: z.number().positive().describe("Width in CSS pixels"),
    height: z.number().positive().describe("Height in CSS pixels"),
  });

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
  const holdMsSchema = z
    .number()
    .min(0)
    .max(10000)
    .optional()
    .describe("Optional pause after the visual appears, in milliseconds (max 10s)");
  const notePositionSchema = z
    .object(pointSchema)
    .optional()
    .describe("Top-left position for explanatory text. If omitted, the frontend places it near the target.");
  const spotlightStyleEnum = z
    .enum(["highlight", "circle"])
    .optional()
    .describe("Use highlight for panels/forms and circle for compact targets like icons or buttons");

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
    region: rectSchema,
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

  const spotlightToolSchema = z.object({
    target: rectSchema.describe("The UI area to spotlight for the user"),
    title: z.string().optional().describe("Short heading to display near the target"),
    description: z.string().optional().describe("Optional one-line explanation for the target"),
    notePosition: notePositionSchema,
    style: spotlightStyleEnum,
    color: colorEnum,
    holdMs: holdMsSchema,
    clearBefore: z.boolean().optional().describe("Clear existing annotations before starting this spotlight"),
    animate: animateFlag,
  });

  const walkthroughStepSchema = z.object({
    target: rectSchema.describe("The UI area for this step"),
    title: z.string().describe("Short step title shown near the target"),
    description: z.string().optional().describe("Optional one-line explanation for the step"),
    notePosition: notePositionSchema,
    style: spotlightStyleEnum,
    color: colorEnum,
    holdMs: holdMsSchema,
    animate: animateFlag,
  });

  const calloutToolSchema = z.object({
    target: rectSchema.describe("The UI area being called out"),
    from: z.object(pointSchema).describe("Where the explanatory text and arrow should start"),
    label: z.string().describe("Short explanatory label for the callout"),
    description: z.string().optional().describe("Optional extra explanation shown under the label"),
    color: colorEnum,
    holdMs: holdMsSchema,
    clearBefore: z.boolean().optional().describe("Clear existing annotations before starting this callout"),
    animate: animateFlag,
  });

  const walkthroughToolSchema = z.object({
    steps: z
      .array(walkthroughStepSchema)
      .min(1)
      .max(8)
      .describe("Ordered walkthrough steps"),
    clearBefore: z.boolean().optional().describe("Clear existing annotations before the walkthrough starts"),
    clearBetween: z.boolean().optional().describe("Clear previous step annotations before each next step. Recommended for clean demos."),
  });

  const compareToolSchema = z.object({
    left: z.object({
      target: rectSchema.describe("Left or first region to compare"),
      label: z.string().describe("Short label for the left region"),
      color: colorEnum,
    }),
    right: z.object({
      target: rectSchema.describe("Right or second region to compare"),
      label: z.string().describe("Short label for the right region"),
      color: colorEnum,
    }),
    title: z.string().optional().describe("Optional headline above the comparison"),
    description: z.string().optional().describe("Optional supporting explanation"),
    holdMs: holdMsSchema,
    clearBefore: z.boolean().optional().describe("Clear existing annotations before starting this comparison"),
    animate: animateFlag,
  });

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------

  return createSdkMcpServer({
    name: "presentation",
    version: "1.1.0",
    tools: [
      tool(
        "presentation_draw",
        "低层绘制接口。在用户屏幕上绘制箭头、高亮框、圆圈、文字和线条。适合你已经明确知道每一步绘制细节时使用。坐标以屏幕 CSS 像素为单位，左上角为 (0,0)。使用前请先通过截图获取屏幕坐标信息。",
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
            return error("Error: commands array is empty");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
      tool(
        "presentation_spotlight",
        "高亮一个界面区域并附加简短说明。适合聚焦讲解单个按钮、卡片、输入框或面板。比手写 draw 命令更容易被稳定调用。",
        spotlightToolSchema.shape,
        async (rawArgs) => {
          const args = rawArgs as { title?: string; description?: string };
          if (!args.title && !args.description) {
            return error("Error: provide title or description so the user knows what is being spotlighted.");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
      tool(
        "presentation_callout",
        "为某个界面区域添加带箭头的说明 callout。适合从空白区域引出解释，再指向目标控件或结果区域。",
        calloutToolSchema.shape,
        async (rawArgs) => {
          const args = rawArgs as { label: string };
          if (!args.label.trim()) {
            return error("Error: label must not be empty.");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
      tool(
        "presentation_walkthrough",
        "按步骤依次讲解多个界面区域。适合 onboarding、功能流程、表单填写路径、或者让用户跟着你逐步操作。",
        walkthroughToolSchema.shape,
        async (rawArgs) => {
          const args = rawArgs as { steps: unknown[] };
          if (!args.steps.length) {
            return error("Error: steps array is empty.");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
      tool(
        "presentation_compare",
        "并排比较两个界面区域并添加标签。适合讲解 before/after、左/右面板差异、旧版/新版变化，或两个结果区域的对照。",
        compareToolSchema.shape,
        async (rawArgs) => {
          const args = rawArgs as { left: { label: string }; right: { label: string } };
          if (!args.left.label.trim() || !args.right.label.trim()) {
            return error("Error: both comparison labels must be non-empty.");
          }
          if (!sessionId) {
            return error("Error: no sessionId available for client-side tool execution");
          }
          return await safeWaitForClient(sessionId);
        }
      ),
      tool(
        "presentation_clear",
        "清空演示画布上的所有标注。",
        {},
        async () => ok("Presentation canvas cleared.")
      ),
      tool(
        "presentation_stop",
        "退出演示模式，清空画布并隐藏 overlay。",
        {},
        async () => ok("Presentation mode stopped.")
      ),
    ],
  });
});
