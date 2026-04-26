import type { ExecutorInfo } from "@/lib/gateway";
import type { UIMessage } from "@/lib/gateway";
import type { AgentMessage } from "@/types";
import type { ExecutorDisplayInfo } from "./types";

// ============================================================================
// executor-detail helpers
// ============================================================================

/** Get executor icon color based on type */
export function getExecutorColor(type: string) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    CLAUDE_CODE: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
    CODEX: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
    GEMINI_CLI: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
    AIDER: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/30" },
  };
  return colors[type] || { bg: "bg-muted", text: "text-foreground", border: "border-border" };
}

// ============================================================================
// agents (legacy) helpers
// ============================================================================

/** Convert ExecutorInfo to display format */
export function mapExecutorToDisplay(executor: ExecutorInfo): ExecutorDisplayInfo {
  const isInstalled =
    executor.availability.type === "LOGIN_DETECTED" ||
    executor.availability.type === "INSTALLATION_FOUND";

  return {
    id: executor.type.toLowerCase().replace("_", "-"),
    name: executor.name,
    installed: isInstalled,
    config_path: executor.workspace_config_path || executor.global_config_path || null,
    has_mcp_config: executor.supports_mcp && executor.has_workspace_config,
    mcp_server_count: undefined, // Not available from executors API
  };
}

// ============================================================================
// agent-detail helpers
// ============================================================================

/** Convert Gateway UIMessage to AgentMessage */
export function uiMessageToAgentMessage(msg: UIMessage): AgentMessage | null {
  switch (msg.type) {
    case "user":
      return {
        id: msg.id,
        type: "user" as const,
        content: msg.content || "",
      };
    case "text":
      return {
        id: msg.id,
        type: "text" as const,
        content: msg.content || "",
      };
    case "tool_use":
      return {
        id: msg.id,
        type: "tool_use" as const,
        name: msg.tool_name || "unknown_tool",
        input: msg.tool_input || {},
        toolUseId: msg.tool_use_id,
      };
    case "tool_result":
      return {
        id: msg.id,
        type: "tool_result" as const,
        toolUseId: msg.tool_use_id,
        output: msg.tool_output || "",
        isError: msg.is_error || false,
      };
    case "thinking":
      return {
        id: msg.id,
        type: "text" as const,
        content: msg.content || "",
      };
    case "error":
      return {
        id: msg.id,
        type: "error" as const,
        message: msg.content || "",
        isError: true,
      };
    default:
      return null;
  }
}
