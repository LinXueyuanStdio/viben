/**
 * Group Chat routes
 *
 * Provides HTTP API for group chat management:
 * - Group chat CRUD
 * - Member management
 * - Session management
 * - Message handling
 * - WebSocket real-time streaming
 *
 * Group chats are stored in the workspace directory under `.viben/group-chats/`.
 * This implementation uses file-based storage via GroupChatService.
 */
import { join } from "node:path";
import { homedir } from "node:os";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";
import { GroupChatService } from "../../group-chat/service";
import { createOrchestrator, type OrchestratorEvent } from "../../group-chat/orchestrator";
import type {
  GroupChatConfig,
  MemberConfig,
  GroupChatSessionConfig,
  GroupChatUIMessage,
  AgentResponse,
  AgentRolloutMessage,
  FileInfo,
} from "../../group-chat/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Group chat member type
 */
export type MemberType = "human" | "agent";

/**
 * Member role
 */
export type MemberRole = "owner" | "admin" | "member";

/**
 * Session status
 */
export type SessionStatus = "active" | "archived";

/**
 * UI message type for routes
 */
export type UIMessageType = "user" | "agent_thinking" | "agent_response" | "system";

/**
 * Group chat settings response (snake_case for API)
 */
interface GroupChatSettingsResponse {
  broadcast_mode: string;
  show_thinking: boolean;
  history_limit: number;
}

/**
 * Group chat member response (snake_case for API)
 */
interface GroupChatMemberResponse {
  id: string;
  member_type: string;
  member_id: string;
  display_name: string;
  role: string;
  model?: string;
  joined_at: string;
  last_seen_at?: string;
}

/**
 * Group chat response (snake_case for API)
 */
interface GroupChatResponse {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  settings: GroupChatSettingsResponse;
  /** The workspace path where this group chat is stored */
  workspace_path: string;
  /** Whether this is a global group chat (from ~/.viben/) */
  is_global: boolean;
}

/**
 * Session response (snake_case for API)
 */
interface SessionResponse {
  id: string;
  group_chat_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  active_agents: string[];
  status: string;
}

/**
 * UI message response (snake_case for API)
 */
interface UIMessageResponse {
  id: string;
  type: string;
  timestamp: string;
  sender_id?: string;
  sender_name?: string;
  content?: string;
  agent_id?: string;
  agent_name?: string;
  status?: string;
  event?: string;
  data?: Record<string, unknown>;
}

/**
 * Agent rollout message response (snake_case for API)
 */
interface AgentRolloutMessageResponse {
  timestamp: string;
  role: string;
  content: string;
  name?: string;
  tool_calls?: unknown;
  tool_call_id?: string;
}

/**
 * File info response (snake_case for API)
 */
interface FileInfoResponse {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  path: string;
  uploaded_at: string;
  uploaded_by: string;
}

/**
 * Session agent info response (snake_case for API)
 */
interface SessionAgentResponse {
  id: string;
  name: string;
  is_active: boolean;
  has_messages: boolean;
  role: string;
  joined_at: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

interface WorkspaceQuery {
  workspace_path?: string;
}

interface ListGroupChatsQuery extends WorkspaceQuery {
  include_global?: boolean;
  created_by?: string;
}

interface CreateGroupChatBody {
  workspace_path?: string;
  name: string;
  description?: string;
  created_by: string;
  members?: Array<{
    type: MemberType;
    member_id: string;
    display_name?: string;
    role?: string;
    model?: string;
  }>;
}

interface UpdateGroupChatBody {
  name?: string;
  description?: string;
}

interface AddMemberBody {
  type: MemberType;
  member_id: string;
  display_name: string;
  role?: string;
  model?: string;
}

interface CreateSessionBody {
  title?: string;
  active_agents?: string[];
}

interface UpdateSessionBody {
  title?: string;
  status?: string;
  active_agents?: string[];
}

interface SendMessageBody {
  content: string;
  sender_id: string;
  sender_name: string;
}

interface MessagesQuery extends WorkspaceQuery {
  view?: "ui" | "agent";
  agent_id?: string;
  limit?: number;
  before?: string;
}

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket client commands
 */
interface WsClientCommand {
  type: "send_message" | "typing" | "switch_view";
  content?: string;
  sender_id?: string;
  sender_name?: string;
  is_typing?: boolean;
  view?: "ui" | "agent";
  agent_id?: string;
}

/**
 * WebSocket server message types
 */
type WsServerMessageType =
  | "connected"
  | "new_message"
  | "agent_thinking"
  | "agent_progress"
  | "agent_response"
  | "agent_error"
  | "complete"
  | "member_joined"
  | "member_left"
  | "typing"
  | "view_data"
  | "messages"
  | "error";

/**
 * WebSocket server messages
 */
interface WsServerMessage {
  type: WsServerMessageType;
  member_id?: string;
  message?: UIMessageResponse;
  agent_id?: string;
  agent_name?: string;
  content?: string;
  delta?: string;
  duration?: number;
  member?: GroupChatMemberResponse;
  is_typing?: boolean;
  view?: string;
  messages?: unknown;
  error?: string;
  success_count?: number;
  error_count?: number;
}

/**
 * WebSocket connection state
 * Tracks per-connection state like current view
 */
interface WsConnectionState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socket: any;
  memberId: string;
  memberType: string;
  /** Current view: 'ui' (default) or 'agent' */
  view: "ui" | "agent";
  /** Agent ID when in agent view */
  agentId?: string;
}

// WebSocket connections per session with state
const wsConnections = new Map<string, Map<string, WsConnectionState>>();

/**
 * Generate a unique connection ID
 */
function generateConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get or create connections map for a session
 */
function getSessionConnections(sessionId: string): Map<string, WsConnectionState> {
  let connections = wsConnections.get(sessionId);
  if (!connections) {
    connections = new Map();
    wsConnections.set(sessionId, connections);
  }
  return connections;
}

/**
 * Send message to a specific connection
 */
function sendToConnection(state: WsConnectionState, message: WsServerMessage): void {
  try {
    state.socket.send(JSON.stringify(message));
  } catch {
    // Connection may be closed
  }
}

/**
 * Broadcast message to all WebSocket connections in a session
 * Optionally filter by view type
 */
function broadcastToSession(
  sessionId: string,
  message: WsServerMessage,
  options?: { viewFilter?: "ui" | "agent"; excludeConnectionId?: string }
): void {
  const connections = wsConnections.get(sessionId);
  if (connections) {
    const data = JSON.stringify(message);
    connections.forEach((state, connId) => {
      // Skip excluded connection
      if (options?.excludeConnectionId && connId === options.excludeConnectionId) {
        return;
      }
      // Filter by view if specified
      if (options?.viewFilter && state.view !== options.viewFilter) {
        return;
      }
      try {
        state.socket.send(data);
      } catch {
        // Connection may be closed
      }
    });
  }
}

/**
 * Broadcast agent events to connections based on their view
 * - UI view: receives thinking, response, error, complete events
 * - Agent view: receives progress events for the specific agent
 */
function broadcastAgentEvent(
  sessionId: string,
  event: OrchestratorEvent
): void {
  const connections = wsConnections.get(sessionId);
  if (!connections) return;

  connections.forEach((state) => {
    let message: WsServerMessage | null = null;

    switch (event.type) {
      case "thinking":
        // Send to all connections (both UI and agent view)
        message = {
          type: "agent_thinking",
          agent_id: event.agentId,
          agent_name: event.agentName,
        };
        break;

      case "progress":
        // For agent view, only send if viewing this specific agent
        if (state.view === "agent" && state.agentId === event.agentId) {
          message = {
            type: "agent_progress",
            agent_id: event.agentId,
            agent_name: event.agentName,
            delta: event.delta,
          };
        }
        // For UI view, we could accumulate and send less frequently
        // For now, skip progress events in UI view to reduce noise
        break;

      case "response":
        // Send to all connections
        message = {
          type: "agent_response",
          agent_id: event.agentId,
          agent_name: event.agentName,
          content: event.content,
          duration: event.duration,
        };
        break;

      case "error":
        // Send to all connections
        message = {
          type: "agent_error",
          agent_id: event.agentId,
          agent_name: event.agentName,
          error: event.error,
        };
        break;

      case "complete":
        // Send to all connections
        message = {
          type: "complete",
          success_count: event.successCount,
          error_count: event.errorCount,
          duration: event.duration,
        };
        break;
    }

    if (message) {
      sendToConnection(state, message);
    }
  });
}

// ============================================================================
// Service Helpers
// ============================================================================

import { existsSync, statSync } from "node:fs";

/**
 * Get the global group chats path (~/.viben/group-chats)
 */
function getGlobalGroupChatsPath(): string {
  return join(homedir(), ".viben", "group-chats");
}

/**
 * Get the global .viben path (~/.viben)
 */
function getGlobalVibenPath(): string {
  return join(homedir(), ".viben");
}

/**
 * Validate workspace path exists and is a directory
 *
 * @param workspacePath - Path to validate
 * @returns The validated path
 * @throws Error if path does not exist or is not a directory
 */
function validateWorkspacePath(workspacePath: string): string {
  if (!existsSync(workspacePath)) {
    throw new Error(`Workspace path does not exist: ${workspacePath}`);
  }
  const stats = statSync(workspacePath);
  if (!stats.isDirectory()) {
    throw new Error(`Workspace path is not a directory: ${workspacePath}`);
  }
  return workspacePath;
}

/**
 * Check if a workspace path is the global path
 */
function isGlobalWorkspace(workspacePath: string): boolean {
  const globalVibenPath = getGlobalVibenPath();
  return workspacePath === globalVibenPath || workspacePath === homedir();
}

/**
 * Get the service for a workspace path
 *
 * @param workspacePath - Optional workspace path. If not provided, uses global ~/.viben
 * @param validate - Whether to validate the workspace path exists (default: false for backwards compatibility)
 * @returns GroupChatService instance
 */
function getService(workspacePath?: string, validate = false): GroupChatService {
  if (workspacePath && validate) {
    validateWorkspacePath(workspacePath);
  }
  const baseDir = workspacePath
    ? join(workspacePath, ".viben", "group-chats")
    : getGlobalGroupChatsPath();
  return new GroupChatService(baseDir);
}

/**
 * Get global service (for ~/.viben/group-chats)
 */
function getGlobalService(): GroupChatService {
  return new GroupChatService(getGlobalGroupChatsPath());
}

/**
 * Get workspace path string for response
 * Returns the workspace_path that should be included in API responses
 */
function getWorkspacePathForResponse(workspacePath?: string): string {
  return workspacePath || getGlobalVibenPath();
}

// ============================================================================
// Transformers (service types to API responses)
// ============================================================================

/**
 * Transform group chat config to API response
 *
 * @param gc - Group chat config from service
 * @param workspacePath - The workspace path where this group chat is stored
 * @param isGlobal - Whether this is a global group chat (from ~/.viben/)
 */
function toGroupChatResponse(
  gc: GroupChatConfig,
  workspacePath: string,
  isGlobal: boolean
): GroupChatResponse {
  return {
    id: gc.id,
    name: gc.name,
    description: gc.description,
    created_by: gc.createdBy,
    created_at: gc.createdAt,
    updated_at: gc.updatedAt,
    settings: {
      broadcast_mode: gc.settings?.broadcastMode || "all",
      show_thinking: gc.settings?.showThinking || false,
      history_limit: gc.settings?.maxConcurrentAgents || 10,
    },
    workspace_path: workspacePath,
    is_global: isGlobal,
  };
}

/**
 * Transform member config to API response
 */
function toMemberResponse(m: MemberConfig): GroupChatMemberResponse {
  return {
    id: m.id,
    member_type: m.type,
    member_id: m.refId,
    display_name: m.displayName,
    role: m.role,
    joined_at: m.joinedAt,
    last_seen_at: m.lastSeenAt,
  };
}

/**
 * Transform session config to API response
 */
function toSessionResponse(s: GroupChatSessionConfig): SessionResponse {
  return {
    id: s.id,
    group_chat_id: s.groupChatId,
    title: s.name,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
    active_agents: s.activeAgents || [],
    status: s.status,
  };
}

/**
 * Transform UI message to API response
 */
function toUIMessageResponse(m: GroupChatUIMessage): UIMessageResponse {
  return {
    id: m.id,
    type: m.type,
    timestamp: m.timestamp,
    sender_id: m.senderId,
    sender_name: m.senderName,
    content: m.content,
  };
}

/**
 * Transform agent rollout message to API response
 */
function toAgentMessageResponse(m: AgentRolloutMessage): AgentRolloutMessageResponse {
  return {
    timestamp: m.timestamp,
    role: m.role,
    content: m.content,
    name: m.name,
    tool_calls: m.toolCalls,
    tool_call_id: m.toolCallId,
  };
}

/**
 * Transform file info to API response
 */
function toFileInfoResponse(f: FileInfo): FileInfoResponse {
  return {
    id: f.id,
    name: f.name,
    mime_type: f.mimeType,
    size: f.size,
    path: f.path,
    uploaded_at: f.uploadedAt,
    uploaded_by: f.uploadedBy,
  };
}

// ============================================================================
// Agent Orchestration
// ============================================================================

import type { AgentOrchestrator } from "../../group-chat/orchestrator";

/**
 * Execute agents in background using the orchestrator
 *
 * This function runs the agent orchestrator asynchronously, streaming events
 * to WebSocket connections and broadcasting to the event system.
 */
async function executeAgentsInBackground(
  orchestrator: AgentOrchestrator,
  userMessage: string,
  senderName: string,
  agentMembers: MemberConfig[],
  state: AppState,
  groupChatId: string,
  sessionId: string
): Promise<void> {
  try {
    // Execute agents using orchestrator async generator
    for await (const event of orchestrator.execute(userMessage, senderName, agentMembers)) {
      handleOrchestratorEvent(event, state, groupChatId, sessionId);
    }
  } catch (err) {
    console.error("[GroupChat] Agent orchestration error:", err);
    // Broadcast error to clients
    state.events.broadcast({
      type: "group_chat_error",
      data: {
        groupChatId,
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

/**
 * Handle orchestrator events - broadcast to WebSocket and event system
 */
function handleOrchestratorEvent(
  event: OrchestratorEvent,
  state: AppState,
  groupChatId: string,
  sessionId: string
): void {
  // Broadcast to WebSocket connections with view-aware routing
  broadcastAgentEvent(sessionId, event);

  // Also broadcast to SSE event system for non-WebSocket clients
  switch (event.type) {
    case "thinking":
      state.events.broadcast({
        type: "group_chat_agent_thinking",
        data: {
          groupChatId,
          sessionId,
          agentId: event.agentId,
          agentName: event.agentName,
        },
      });
      break;

    case "progress":
      state.events.broadcast({
        type: "group_chat_agent_progress",
        data: {
          groupChatId,
          sessionId,
          agentId: event.agentId,
          delta: event.delta,
        },
      });
      break;

    case "response":
      state.events.broadcast({
        type: "group_chat_agent_response",
        data: {
          groupChatId,
          sessionId,
          agentId: event.agentId,
          agentName: event.agentName,
          content: event.content,
          duration: event.duration,
        },
      });
      break;

    case "error":
      state.events.broadcast({
        type: "group_chat_agent_error",
        data: {
          groupChatId,
          sessionId,
          agentId: event.agentId,
          agentName: event.agentName,
          error: event.error,
        },
      });
      break;

    case "complete":
      state.events.broadcast({
        type: "group_chat_round_complete",
        data: {
          groupChatId,
          sessionId,
          successCount: event.successCount,
          errorCount: event.errorCount,
          duration: event.duration,
        },
      });
      break;
  }
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * Register group chat routes
 */
export function registerGroupChatRoutes(fastify: FastifyInstance, state: AppState): void {
  // ========================================
  // Group Chat CRUD
  // ========================================

  // List all group chats
  //
  // Query parameters:
  // - workspace_path (optional): The workspace path to list group chats from
  // - include_global (optional, default true): Also include global group chats from ~/.viben/group-chats/
  // - created_by (optional): Filter by creator
  //
  // Response includes group chats from:
  // 1. Global ~/.viben/group-chats/ (if include_global=true)
  // 2. Workspace {workspace_path}/.viben/group-chats/ (if workspace_path provided and different from global)
  fastify.get(
    "/api/group-chats",
    async (request: FastifyRequest<{ Querystring: ListGroupChatsQuery }>, reply: FastifyReply) => {
      const { workspace_path, include_global = true, created_by } = request.query;
      const responses: GroupChatResponse[] = [];
      const globalVibenPath = getGlobalVibenPath();

      // Get global group chats first (from ~/.viben/group-chats/)
      if (include_global) {
        const globalService = getGlobalService();
        try {
          const globalChats = await globalService.listGroupChats();
          for (const gc of globalChats) {
            if (!created_by || gc.createdBy === created_by) {
              responses.push(toGroupChatResponse(gc, globalVibenPath, true));
            }
          }
        } catch {
          // Global directory may not exist, continue silently
        }
      }

      // Get workspace group chats if path provided and different from global
      if (workspace_path) {
        // Validate workspace path
        try {
          validateWorkspacePath(workspace_path);
        } catch (err) {
          reply.code(400);
          return { error: err instanceof Error ? err.message : "Invalid workspace path" };
        }

        // Check if workspace path is not the global path
        const isGlobalPath = isGlobalWorkspace(workspace_path);

        if (!isGlobalPath) {
          const service = getService(workspace_path);
          try {
            const workspaceChats = await service.listGroupChats();
            for (const gc of workspaceChats) {
              // Avoid duplicates (by id)
              if (!responses.some((existing) => existing.id === gc.id)) {
                if (!created_by || gc.createdBy === created_by) {
                  responses.push(toGroupChatResponse(gc, workspace_path, false));
                }
              }
            }
          } catch {
            // Workspace group chats directory may not exist, continue silently
          }
        }
      }

      return {
        workspace_path: workspace_path || null,
        group_chats: responses,
      };
    }
  );

  // Get a specific group chat
  fastify.get(
    "/api/group-chats/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);
      // Determine if this is a global group chat (no workspace_path = global)
      const isGlobal = !workspace_path;
      const responseWorkspacePath = getWorkspacePathForResponse(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const members = await service.getMembers(id);

      return {
        group_chat: toGroupChatResponse(groupChat, responseWorkspacePath, isGlobal),
        members: members.map(toMemberResponse),
      };
    }
  );

  // Create a new group chat
  fastify.post(
    "/api/group-chats",
    async (request: FastifyRequest<{ Body: CreateGroupChatBody }>, reply: FastifyReply) => {
      const { workspace_path, name, description, created_by, members = [] } = request.body;

      // Validate workspace path if provided
      if (workspace_path) {
        try {
          validateWorkspacePath(workspace_path);
        } catch (err) {
          reply.code(400);
          return { error: err instanceof Error ? err.message : "Invalid workspace path" };
        }
      }

      const service = getService(workspace_path);
      // Determine if this is a global group chat (no workspace_path = global)
      const isGlobal = !workspace_path;
      const responseWorkspacePath = getWorkspacePathForResponse(workspace_path);

      try {
        const groupChat = await service.createGroupChat(created_by, {
          name,
          description,
          members: members.map((m) => ({
            type: m.type,
            refId: m.member_id,
            displayName: m.display_name || m.member_id,
            role: (m.role as "admin" | "member" | "observer") || "member",
          })),
        });

        const createdMembers = await service.getMembers(groupChat.id);

        // Broadcast event
        state.events.broadcast({
          type: "group_chat_created",
          data: { groupChatId: groupChat.id },
        });

        reply.code(201);
        return {
          group_chat: toGroupChatResponse(groupChat, responseWorkspacePath, isGlobal),
          members: createdMembers.map(toMemberResponse),
        };
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to create group chat" };
      }
    }
  );

  // Update a group chat
  fastify.patch(
    "/api/group-chats/:id",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateGroupChatBody;
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { name, description } = request.body;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);
      // Determine if this is a global group chat (no workspace_path = global)
      const isGlobal = !workspace_path;
      const responseWorkspacePath = getWorkspacePathForResponse(workspace_path);

      try {
        const updated = await service.updateGroupChat(id, { name, description });

        // Broadcast event
        state.events.broadcast({
          type: "group_chat_updated",
          data: { groupChatId: id },
        });

        return toGroupChatResponse(updated, responseWorkspacePath, isGlobal);
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Group chat not found: ${id}` };
        }
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to update group chat" };
      }
    }
  );

  // Delete a group chat
  fastify.delete(
    "/api/group-chats/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      try {
        await service.deleteGroupChat(id);

        // Broadcast event
        state.events.broadcast({
          type: "group_chat_deleted",
          data: { groupChatId: id },
        });

        return { deleted: id };
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Group chat not found: ${id}` };
        }
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to delete group chat" };
      }
    }
  );

  // ========================================
  // Member Management
  // ========================================

  // List members
  fastify.get(
    "/api/group-chats/:id/members",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const members = await service.getMembers(id);
      return { members: members.map(toMemberResponse) };
    }
  );

  // Add a member
  fastify.post(
    "/api/group-chats/:id/members",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: AddMemberBody;
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { type, member_id, display_name, role = "member" } = request.body;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      // Check if member already exists
      const existingMembers = await service.getMembers(id);
      if (existingMembers.some((m) => m.refId === member_id)) {
        reply.code(400);
        return { error: `Member already exists: ${member_id}` };
      }

      try {
        const member = await service.addMember(
          id,
          type,
          member_id,
          display_name,
          role as "admin" | "member" | "observer"
        );

        // Broadcast event
        state.events.broadcast({
          type: "group_chat_member_joined",
          data: { groupChatId: id, memberId: member_id },
        });

        reply.code(201);
        return toMemberResponse(member);
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to add member" };
      }
    }
  );

  // Remove a member
  fastify.delete(
    "/api/group-chats/:id/members/:memberId",
    async (
      request: FastifyRequest<{
        Params: { id: string; memberId: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, memberId } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        await service.removeMember(id, memberId);

        // Broadcast event
        state.events.broadcast({
          type: "group_chat_member_left",
          data: { groupChatId: id, memberId },
        });

        return { deleted: memberId };
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Member not found: ${memberId}` };
        }
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to remove member" };
      }
    }
  );

  // ========================================
  // Session Management
  // ========================================

  // List sessions
  fastify.get(
    "/api/group-chats/:id/sessions",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: WorkspaceQuery }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const sessions = await service.listSessions(id);
      return { sessions: sessions.map(toSessionResponse) };
    }
  );

  // Create a session
  fastify.post(
    "/api/group-chats/:id/sessions",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: CreateSessionBody;
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { title, active_agents = [] } = request.body;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        const session = await service.createSession(id, {
          name: title,
          activeAgents: active_agents,
        });

        reply.code(201);
        return toSessionResponse(session);
      } catch (err) {
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to create session" };
      }
    }
  );

  // Get a session
  fastify.get(
    "/api/group-chats/:id/sessions/:sessionId",
    async (
      request: FastifyRequest<{
        Params: { id: string; sessionId: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, sessionId } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const session = await service.getSession(id, sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      return toSessionResponse(session);
    }
  );

  // Update a session
  fastify.patch(
    "/api/group-chats/:id/sessions/:sessionId",
    async (
      request: FastifyRequest<{
        Params: { id: string; sessionId: string };
        Body: UpdateSessionBody;
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, sessionId } = request.params;
      const { title, status, active_agents } = request.body;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        const updated = await service.updateSession(id, sessionId, {
          name: title,
          status: status as "active" | "paused" | "completed" | "archived" | undefined,
          activeAgents: active_agents,
        });

        return toSessionResponse(updated);
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Session not found: ${sessionId}` };
        }
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to update session" };
      }
    }
  );

  // Delete a session
  fastify.delete(
    "/api/group-chats/:id/sessions/:sessionId",
    async (
      request: FastifyRequest<{
        Params: { id: string; sessionId: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, sessionId } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        await service.deleteSession(id, sessionId);
        return { deleted: sessionId };
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Session not found: ${sessionId}` };
        }
        reply.code(400);
        return { error: err instanceof Error ? err.message : "Failed to delete session" };
      }
    }
  );

  // List session agents (agents with rollout messages + agent members)
  // Returns all agent members from the group chat with their activity status
  fastify.get(
    "/api/group-chats/:id/sessions/:sessionId/agents",
    async (
      request: FastifyRequest<{
        Params: { id: string; sessionId: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, sessionId } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const session = await service.getSession(id, sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      // Get agent IDs that have rollout messages in this session
      const agentsWithMessages = await service.listSessionAgents(id, sessionId);

      // Get all agent members from the group chat
      const members = await service.getMembers(id);
      const agentMembers = members.filter((m) => m.type === "agent");

      // Build response with agent details
      const agents = agentMembers.map((member) => ({
        id: member.refId,
        name: member.displayName,
        // Agent is active if it's in the session's activeAgents list
        is_active: session.activeAgents?.includes(member.refId) ?? false,
        // Agent has messages if it's in the agentsWithMessages list
        has_messages: agentsWithMessages.includes(member.refId),
        role: member.role,
        joined_at: member.joinedAt,
      }));

      return { agents };
    }
  );

  // ========================================
  // File Management
  // ========================================

  // Upload a file
  fastify.post(
    "/api/group-chats/:id/files",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      // Handle multipart form data
      // Note: Requires @fastify/multipart plugin to be registered
      try {
        // Check if request is multipart by checking content-type header
        const contentType = request.headers["content-type"] || "";
        if (!contentType.includes("multipart/form-data")) {
          reply.code(400);
          return { error: "Expected multipart/form-data" };
        }

        // Type assertion for multipart-enabled request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const multipartRequest = request as any;
        if (typeof multipartRequest.parts !== "function") {
          reply.code(400);
          return {
            error: "Multipart upload not configured. Please ensure @fastify/multipart is registered.",
          };
        }

        const parts = multipartRequest.parts();
        let fileData: Buffer | null = null;
        let filename = "unnamed";
        let mimeType = "application/octet-stream";
        let uploadedBy: string | undefined;

        for await (const part of parts) {
          if (part.type === "file" && part.fieldname === "file") {
            filename = part.filename || "unnamed";
            mimeType = part.mimetype || "application/octet-stream";
            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            fileData = Buffer.concat(chunks);
          } else if (part.type === "field" && part.fieldname === "uploaded_by") {
            uploadedBy = part.value as string;
          }
        }

        if (!fileData) {
          reply.code(400);
          return { error: "No file provided in multipart form" };
        }

        const fileInfo = await service.saveFile(
          id,
          filename,
          fileData,
          uploadedBy,
          mimeType
        );

        reply.code(201);
        return toFileInfoResponse(fileInfo);
      } catch (err) {
        reply.code(500);
        return { error: err instanceof Error ? err.message : "Failed to upload file" };
      }
    }
  );

  // List files
  fastify.get(
    "/api/group-chats/:id/files",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const files = await service.listFiles(id);
      return {
        files: files.map(toFileInfoResponse),
        total: files.length,
      };
    }
  );

  // Download a file
  fastify.get(
    "/api/group-chats/:id/files/:filename",
    async (
      request: FastifyRequest<{
        Params: { id: string; filename: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, filename } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        const content = await service.getFileContent(id, filename);
        const fileInfo = await service.getFileInfo(id, filename);

        const mimeType = fileInfo?.mimeType || "application/octet-stream";

        reply.header("Content-Type", mimeType);
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);

        return reply.send(content);
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `File not found: ${filename}` };
        }
        reply.code(500);
        return { error: err instanceof Error ? err.message : "Failed to download file" };
      }
    }
  );

  // Delete a file
  fastify.delete(
    "/api/group-chats/:id/files/:filename",
    async (
      request: FastifyRequest<{
        Params: { id: string; filename: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, filename } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        await service.deleteFile(id, filename);
        return { deleted: filename };
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `File not found: ${filename}` };
        }
        reply.code(500);
        return { error: err instanceof Error ? err.message : "Failed to delete file" };
      }
    }
  );

  // ========================================
  // Picture Management
  // ========================================

  // Upload a picture
  fastify.post(
    "/api/group-chats/:id/pictures",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      // Handle multipart form data
      try {
        // Check if request is multipart by checking content-type header
        const contentType = request.headers["content-type"] || "";
        if (!contentType.includes("multipart/form-data")) {
          reply.code(400);
          return { error: "Expected multipart/form-data" };
        }

        // Type assertion for multipart-enabled request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const multipartRequest = request as any;
        if (typeof multipartRequest.parts !== "function") {
          reply.code(400);
          return {
            error: "Multipart upload not configured. Please ensure @fastify/multipart is registered.",
          };
        }

        const parts = multipartRequest.parts();
        let fileData: Buffer | null = null;
        let filename = "unnamed";
        let mimeType = "image/jpeg";
        let uploadedBy: string | undefined;

        for await (const part of parts) {
          if (part.type === "file" && part.fieldname === "file") {
            filename = part.filename || "unnamed";
            mimeType = part.mimetype || "image/jpeg";

            // Validate image type
            if (!mimeType.startsWith("image/") && mimeType !== "application/octet-stream") {
              reply.code(400);
              return { error: `Invalid image type: ${mimeType}. Only image/* types are allowed.` };
            }

            const chunks: Buffer[] = [];
            for await (const chunk of part.file) {
              chunks.push(chunk);
            }
            fileData = Buffer.concat(chunks);
          } else if (part.type === "field" && part.fieldname === "uploaded_by") {
            uploadedBy = part.value as string;
          }
        }

        if (!fileData) {
          reply.code(400);
          return { error: "No file provided in multipart form" };
        }

        const fileInfo = await service.savePicture(
          id,
          filename,
          fileData,
          uploadedBy,
          mimeType
        );

        reply.code(201);
        return toFileInfoResponse(fileInfo);
      } catch (err) {
        if (err instanceof Error && err.message.includes("Invalid image")) {
          reply.code(400);
          return { error: err.message };
        }
        reply.code(500);
        return { error: err instanceof Error ? err.message : "Failed to upload picture" };
      }
    }
  );

  // List pictures
  fastify.get(
    "/api/group-chats/:id/pictures",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const pictures = await service.listPictures(id);
      return {
        pictures: pictures.map(toFileInfoResponse),
        total: pictures.length,
      };
    }
  );

  // Download a picture
  fastify.get(
    "/api/group-chats/:id/pictures/:filename",
    async (
      request: FastifyRequest<{
        Params: { id: string; filename: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, filename } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        const content = await service.getPictureContent(id, filename);
        const pictureInfo = await service.getPictureInfo(id, filename);

        const mimeType = pictureInfo?.mimeType || "image/jpeg";

        reply.header("Content-Type", mimeType);
        reply.header("Cache-Control", "public, max-age=86400"); // Cache for 1 day

        return reply.send(content);
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Picture not found: ${filename}` };
        }
        reply.code(500);
        return { error: err instanceof Error ? err.message : "Failed to download picture" };
      }
    }
  );

  // Delete a picture
  fastify.delete(
    "/api/group-chats/:id/pictures/:filename",
    async (
      request: FastifyRequest<{
        Params: { id: string; filename: string };
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, filename } = request.params;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      try {
        await service.deletePicture(id, filename);
        return { deleted: filename };
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          reply.code(404);
          return { error: `Picture not found: ${filename}` };
        }
        reply.code(500);
        return { error: err instanceof Error ? err.message : "Failed to delete picture" };
      }
    }
  );

  // ========================================
  // Messages
  // ========================================

  // Get session messages
  fastify.get(
    "/api/group-chats/:id/sessions/:sessionId/messages",
    async (
      request: FastifyRequest<{
        Params: { id: string; sessionId: string };
        Querystring: MessagesQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, sessionId } = request.params;
      const { workspace_path, view = "ui", agent_id, limit = 50 } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const session = await service.getSession(id, sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      if (view === "agent") {
        if (!agent_id) {
          reply.code(400);
          return { error: "agent_id is required for agent view" };
        }

        const messages = await service.getAgentRolloutMessagesLast(id, sessionId, agent_id, limit);

        return {
          messages: messages.map(toAgentMessageResponse),
          view: "agent",
          agent_id,
          has_more: messages.length >= limit,
        };
      }

      // UI view (default)
      const messages = await service.getMessages(id, sessionId, { limit });

      return {
        messages: messages.map(toUIMessageResponse),
        view: "ui",
        has_more: messages.length >= limit,
      };
    }
  );

  // Send a message
  fastify.post(
    "/api/group-chats/:id/sessions/:sessionId/messages",
    async (
      request: FastifyRequest<{
        Params: { id: string; sessionId: string };
        Body: SendMessageBody;
        Querystring: WorkspaceQuery;
      }>,
      reply: FastifyReply
    ) => {
      const { id, sessionId } = request.params;
      const { content, sender_id, sender_name } = request.body;
      const { workspace_path } = request.query;
      const service = getService(workspace_path);

      const groupChat = await service.getGroupChat(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const session = await service.getSession(id, sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      // Clear agent responses for new round
      await service.clearAgentResponses(id, sessionId);

      // Send the user message
      const userMessage = await service.sendMessage(
        id,
        sessionId,
        sender_id,
        "human",
        sender_name,
        { content }
      );

      // Update member last seen
      try {
        const members = await service.getMembers(id);
        const member = members.find((m) => m.refId === sender_id);
        if (member) {
          await service.updateMemberLastSeen(id, member.id);
        }
      } catch {
        // Ignore errors updating last seen
      }

      // Broadcast message event
      state.events.broadcast({
        type: "group_chat_message",
        data: { groupChatId: id, messageId: userMessage.id },
      });

      // Broadcast to WebSocket connections
      broadcastToSession(sessionId, {
        type: "new_message",
        message: toUIMessageResponse(userMessage),
      });

      // Get agent members to trigger
      const agentMembers = await service.getAgentMembers(id);
      const agentsTriggered = agentMembers.map((m) => m.refId);

      // Create orchestrator for agent execution
      const orchestrator = createOrchestrator(service, id, sessionId, {
        timeoutMs: 120000, // 2 minutes timeout
        continueOnError: true,
      });

      // Execute agents in background (non-blocking)
      // The orchestrator handles all agent coordination, context building, and storage
      executeAgentsInBackground(
        orchestrator,
        content,
        sender_name,
        agentMembers,
        state,
        id,
        sessionId
      );

      return {
        message: toUIMessageResponse(userMessage),
        agents_triggered: agentsTriggered,
      };
    }
  );

  // ========================================
  // WebSocket Endpoint
  // ========================================

  // Register WebSocket route for group chat sessions
  // Supports query parameters:
  // - workspace_path: Workspace path
  // - member_type: Member type (human/agent)
  // - member_id: Member ID
  // - view: Initial view (ui/agent), default: ui
  // - agent_id: Agent ID for agent view
  fastify.register(async (instance) => {
    try {
      const websocket = await import("@fastify/websocket");
      await instance.register(websocket.default);

      instance.get(
        "/ws/group-chats/:id/sessions/:sessionId",
        { websocket: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (socket: any, request: any) => {
          const { id, sessionId } = request.params;
          const {
            workspace_path,
            member_type = "human",
            member_id,
            view: initialView = "ui",
            agent_id: initialAgentId,
          } = request.query;
          const service = getService(workspace_path);

          // Verify group chat and session exist
          const groupChat = await service.getGroupChat(id);
          if (!groupChat) {
            const errorMsg: WsServerMessage = {
              type: "error",
              error: `Group chat not found: ${id}`,
            };
            socket.send(JSON.stringify(errorMsg));
            socket.close();
            return;
          }

          const session = await service.getSession(id, sessionId);
          if (!session) {
            const errorMsg: WsServerMessage = {
              type: "error",
              error: `Session not found: ${sessionId}`,
            };
            socket.send(JSON.stringify(errorMsg));
            socket.close();
            return;
          }

          // Generate connection ID and create connection state
          const connectionId = generateConnectionId();
          const memberId = member_id || "anonymous";

          // Validate initial view
          const view: "ui" | "agent" = initialView === "agent" ? "agent" : "ui";
          const agentId = view === "agent" ? initialAgentId : undefined;

          // Validate agent_id is provided for agent view
          if (view === "agent" && !agentId) {
            const errorMsg: WsServerMessage = {
              type: "error",
              error: "agent_id is required for agent view",
            };
            socket.send(JSON.stringify(errorMsg));
            socket.close();
            return;
          }

          // Create connection state
          const connectionState: WsConnectionState = {
            socket,
            memberId,
            memberType: member_type,
            view,
            agentId,
          };

          // Add connection to session
          const connections = getSessionConnections(sessionId);
          connections.set(connectionId, connectionState);

          // Send connected message
          const connectedMsg: WsServerMessage = {
            type: "connected",
            member_id: memberId,
            view,
            agent_id: agentId,
          };
          socket.send(JSON.stringify(connectedMsg));

          // Notify others that member joined
          broadcastToSession(
            sessionId,
            {
              type: "member_joined",
              member_id: memberId,
            },
            { excludeConnectionId: connectionId }
          );

          // Send initial messages based on view
          try {
            let initialMessages: unknown[] = [];

            if (view === "agent" && agentId) {
              const agentMsgs = await service.getAgentRolloutMessagesLast(
                id,
                sessionId,
                agentId,
                50
              );
              initialMessages = agentMsgs.map(toAgentMessageResponse);
            } else {
              const uiMsgs = await service.getMessages(id, sessionId, { limit: 50 });
              initialMessages = uiMsgs.map(toUIMessageResponse);
            }

            const messagesMsg: WsServerMessage = {
              type: "messages",
              view,
              agent_id: agentId,
              messages: initialMessages,
            };
            socket.send(JSON.stringify(messagesMsg));
          } catch (err) {
            console.error("[GroupChat WebSocket] Failed to load initial messages:", err);
          }

          // Handle incoming messages
          socket.on("message", async (data: Buffer) => {
            try {
              const cmd = JSON.parse(data.toString()) as WsClientCommand;

              switch (cmd.type) {
                case "send_message": {
                  // Only allow sending messages in UI view
                  if (connectionState.view === "agent") {
                    const errorMsg: WsServerMessage = {
                      type: "error",
                      error: "Cannot send messages in agent view (read-only)",
                    };
                    socket.send(JSON.stringify(errorMsg));
                    break;
                  }

                  if (cmd.content && cmd.sender_id && cmd.sender_name) {
                    // Clear responses for new round
                    await service.clearAgentResponses(id, sessionId);

                    // Create and store message
                    const userMessage = await service.sendMessage(
                      id,
                      sessionId,
                      cmd.sender_id,
                      "human",
                      cmd.sender_name,
                      { content: cmd.content }
                    );

                    // Update member last seen
                    try {
                      const members = await service.getMembers(id);
                      const member = members.find((m) => m.refId === cmd.sender_id);
                      if (member) {
                        await service.updateMemberLastSeen(id, member.id);
                      }
                    } catch {
                      // Ignore errors updating last seen
                    }

                    // Broadcast to all connections (UI view will see it)
                    broadcastToSession(sessionId, {
                      type: "new_message",
                      message: toUIMessageResponse(userMessage),
                    });

                    // Trigger agents using orchestrator
                    const agentMembers = await service.getAgentMembers(id);

                    // Create orchestrator for agent execution
                    const orchestrator = createOrchestrator(service, id, sessionId, {
                      timeoutMs: 120000, // 2 minutes timeout
                      continueOnError: true,
                    });

                    // Execute agents in background (non-blocking)
                    executeAgentsInBackground(
                      orchestrator,
                      cmd.content,
                      cmd.sender_name,
                      agentMembers,
                      state,
                      id,
                      sessionId
                    );
                  }
                  break;
                }

                case "typing": {
                  broadcastToSession(
                    sessionId,
                    {
                      type: "typing",
                      member_id: memberId,
                      is_typing: cmd.is_typing,
                    },
                    { excludeConnectionId: connectionId }
                  );
                  break;
                }

                case "switch_view": {
                  const newView = cmd.view || "ui";
                  const newAgentId = cmd.agent_id;

                  // Validate agent_id for agent view
                  if (newView === "agent" && !newAgentId) {
                    const errorMsg: WsServerMessage = {
                      type: "error",
                      error: "agent_id is required for agent view",
                    };
                    socket.send(JSON.stringify(errorMsg));
                    break;
                  }

                  // Update connection state
                  connectionState.view = newView === "agent" ? "agent" : "ui";
                  connectionState.agentId = newView === "agent" ? newAgentId : undefined;

                  // Fetch messages for the new view
                  let messages: unknown[] = [];

                  try {
                    if (newView === "agent" && newAgentId) {
                      const agentMsgs = await service.getAgentRolloutMessagesLast(
                        id,
                        sessionId,
                        newAgentId,
                        50
                      );
                      messages = agentMsgs.map(toAgentMessageResponse);
                    } else {
                      const uiMsgs = await service.getMessages(id, sessionId, { limit: 50 });
                      messages = uiMsgs.map(toUIMessageResponse);
                    }

                    // Send view data directly to this connection only
                    const viewDataMsg: WsServerMessage = {
                      type: "view_data",
                      view: newView,
                      agent_id: newAgentId,
                      messages,
                    };
                    socket.send(JSON.stringify(viewDataMsg));
                  } catch (err) {
                    const errorMsg: WsServerMessage = {
                      type: "error",
                      error: `Failed to load messages: ${err instanceof Error ? err.message : String(err)}`,
                    };
                    socket.send(JSON.stringify(errorMsg));
                  }
                  break;
                }
              }
            } catch {
              const errorMsg: WsServerMessage = {
                type: "error",
                error: "Failed to parse message",
              };
              socket.send(JSON.stringify(errorMsg));
            }
          });

          // Handle close
          socket.on("close", () => {
            const conns = wsConnections.get(sessionId);
            if (conns) {
              conns.delete(connectionId);
              if (conns.size === 0) {
                wsConnections.delete(sessionId);
              }
            }

            // Notify others that member left
            broadcastToSession(sessionId, {
              type: "member_left",
              member_id: memberId,
            });
          });

          // Handle error
          socket.on("error", (err: Error) => {
            console.error("[GroupChat WebSocket] Error:", err);
            const conns = wsConnections.get(sessionId);
            if (conns) {
              conns.delete(connectionId);
            }
          });
        }
      );
    } catch {
      // WebSocket plugin not available
      console.warn(
        "[Gateway] @fastify/websocket not available, group chat WebSocket routes disabled"
      );
    }
  });
}
