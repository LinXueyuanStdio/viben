import type { FileSession, UIMessage } from "@/lib/gateway";
import type { AgentMessage } from "@/types";

// ============================================================================
// Types
// ============================================================================

export interface Conversation {
  id: string;
  title: string;
  agentId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  isStarred?: boolean;
}

// ============================================================================
// LocalStorage helpers
// ============================================================================

const LAST_SESSION_KEY = "viben_workspace_last_session";
const LAST_AGENT_KEY = "viben_workspace_last_agent";

export function getLastSessionKey(workspaceId: string) {
  return `${LAST_SESSION_KEY}_${workspaceId}`;
}

export function getLastAgentKey(workspaceId: string) {
  return `${LAST_AGENT_KEY}_${workspaceId}`;
}

export function saveLastSessionId(workspaceId: string, sessionId: string) {
  localStorage.setItem(getLastSessionKey(workspaceId), sessionId);
}

export function loadLastAgentId(workspaceId: string): string | null {
  try {
    return localStorage.getItem(getLastAgentKey(workspaceId));
  } catch {
    return null;
  }
}

export function saveLastAgentId(workspaceId: string, agentId: string) {
  localStorage.setItem(getLastAgentKey(workspaceId), agentId);
}

// ============================================================================
// Data Converters
// ============================================================================

// Convert Gateway FileSession to Conversation
export function fileSessionToConversation(session: FileSession): Conversation {
  const sessionId = session.id || crypto.randomUUID();
  return {
    id: sessionId,
    title: session.prompt || `Session ${sessionId.slice(0, 8)}`,
    agentId: session.agent_id,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    messageCount: 0,
    isPinned: false,
    isStarred: false,
    isArchived: session.status === "archived",
  };
}

// Convert Gateway UIMessage to AgentMessage
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
