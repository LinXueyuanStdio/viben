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

// Re-export presentation types from @viben/presentation
export type { PresentationStep, PlayerState } from "@viben/presentation";
export { describeCommand } from "@viben/presentation";
