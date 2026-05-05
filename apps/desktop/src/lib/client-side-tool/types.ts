import type { PresentationCommand } from "../presentation/types";

/** MCP CallToolResult 的前端等效类型（避免依赖后端 MCP SDK 包） */
export type ClientToolResultContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ClientToolResult {
  content: ClientToolResultContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface ClientToolCompletePayload {
  tool_use_id: string;
  session_id: string;
  result: ClientToolResult;
}

export interface PresentationStep {
  /** 步骤唯一 ID: `${toolUseId}-${index}` */
  id: string;
  /** 所属 tool_use */
  toolUseId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  /** 该步对应的单条 command */
  command: PresentationCommand;
  /** command 人可读描述 */
  description: string;
  /** 执行后截图 (data URL) */
  screenshot?: string;
  /** 执行状态 */
  status: "pending" | "executing" | "done";
}

export type PlayerState = "idle" | "playing" | "paused";

/** 为 PresentationCommand 生成人可读描述 */
export function describeCommand(cmd: PresentationCommand): string {
  switch (cmd.type) {
    case "highlight":
      return `高亮区域 (${cmd.region.x}, ${cmd.region.y}) ${cmd.region.width}×${cmd.region.height}`;
    case "arrow":
      return `箭头 (${cmd.from.x},${cmd.from.y}) → (${cmd.to.x},${cmd.to.y})`;
    case "circle":
      return `圆圈 (${cmd.center.x},${cmd.center.y}) r=${cmd.radius}`;
    case "text":
      return `文字 "${cmd.content.slice(0, 30)}"`;
    case "line":
      return `线条 ${cmd.points.length} 个点`;
    case "clear":
      return "清空画布";
    case "wait":
      return `等待 ${cmd.ms}ms`;
  }
}
