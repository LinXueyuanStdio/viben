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
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AppState } from "../state";

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
 * UI message type
 */
export type UIMessageType = "user" | "agent_thinking" | "agent_response" | "system";

/**
 * Group chat settings
 */
export interface GroupChatSettings {
  broadcastMode: "all" | "mention_only";
  showThinking: boolean;
  historyLimit: number;
}

/**
 * Group chat member
 */
export interface GroupChatMember {
  id: string;
  type: MemberType;
  displayName: string;
  role: MemberRole;
  model?: string;
  joinedAt: string;
  lastSeenAt?: string;
}

/**
 * Group chat configuration
 */
export interface GroupChat {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: GroupChatMember[];
  settings: GroupChatSettings;
}

/**
 * Session configuration
 */
export interface Session {
  id: string;
  groupChatId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  activeAgents: string[];
  status: SessionStatus;
}

/**
 * UI message (user-facing)
 */
export interface UIMessage {
  id: string;
  type: UIMessageType;
  timestamp: string;
  senderId?: string;
  senderName?: string;
  content?: string;
  agentId?: string;
  agentName?: string;
  status?: "thinking" | "done" | "error";
  event?: "member_joined" | "member_left" | "session_created";
  data?: Record<string, unknown>;
}

/**
 * Agent rollout message (for agent view)
 */
export interface AgentRolloutMessage {
  timestamp: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCalls?: unknown;
  toolCallId?: string;
}

// ============================================================================
// In-Memory Storage
// ============================================================================

// For now, we use in-memory storage. Later this can be replaced with file-based storage.
const groupChats = new Map<string, GroupChat>();
const sessions = new Map<string, Session>();
const uiMessages = new Map<string, UIMessage[]>(); // sessionId -> messages
const agentMessages = new Map<string, AgentRolloutMessage[]>(); // sessionId:agentId -> messages

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `gc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// Request/Response Types
// ============================================================================

interface WorkspaceQuery {
  workspace_path?: string;
}

interface CreateGroupChatBody {
  name: string;
  description?: string;
  created_by: string;
  members?: Array<{
    type: MemberType;
    member_id: string;
    display_name?: string;
    role?: MemberRole;
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
  role?: MemberRole;
  model?: string;
}

interface CreateSessionBody {
  title?: string;
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
 * WebSocket server messages
 */
interface WsServerMessage {
  type:
    | "connected"
    | "new_message"
    | "agent_thinking"
    | "agent_response"
    | "member_joined"
    | "member_left"
    | "typing"
    | "view_data"
    | "error";
  member_id?: string;
  message?: UIMessage;
  agent_id?: string;
  agent_name?: string;
  content?: string;
  member?: GroupChatMember;
  is_typing?: boolean;
  view?: string;
  messages?: unknown;
  error?: string;
}

// WebSocket connections per session
// Using 'unknown' type since we don't have WebSocket types in all environments
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wsConnections = new Map<string, Set<any>>();

/**
 * Broadcast message to all WebSocket connections in a session
 */
function broadcastToSession(sessionId: string, message: WsServerMessage): void {
  const connections = wsConnections.get(sessionId);
  if (connections) {
    const data = JSON.stringify(message);
    // Use Array.from to iterate since Set iteration requires downlevelIteration
    Array.from(connections).forEach((ws) => {
      try {
        ws.send(data);
      } catch {
        // Connection may be closed
      }
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new group chat member
 */
function createMember(
  id: string,
  type: MemberType,
  displayName: string,
  role: MemberRole = "member",
  model?: string
): GroupChatMember {
  const now = new Date().toISOString();
  return {
    id,
    type,
    displayName,
    role,
    model,
    joinedAt: now,
  };
}

/**
 * Create a new UI message
 */
function createUIMessage(
  type: UIMessageType,
  options: Partial<Omit<UIMessage, "id" | "type" | "timestamp">>
): UIMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    ...options,
  };
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
  fastify.get(
    "/api/group-chats",
    async (request: FastifyRequest<{ Querystring: WorkspaceQuery }>) => {
      const chats = Array.from(groupChats.values());
      return {
        workspace_path: request.query.workspace_path,
        group_chats: chats,
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
      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }
      return {
        group_chat: groupChat,
        members: groupChat.members,
      };
    }
  );

  // Create a new group chat
  fastify.post(
    "/api/group-chats",
    async (request: FastifyRequest<{ Body: CreateGroupChatBody }>, reply: FastifyReply) => {
      const { name, description, created_by, members = [] } = request.body;

      const id = generateId();
      const now = new Date().toISOString();

      // Create initial members
      const groupChatMembers: GroupChatMember[] = members.map((m) =>
        createMember(
          m.member_id,
          m.type,
          m.display_name || m.member_id,
          m.role || "member",
          m.model
        )
      );

      const groupChat: GroupChat = {
        id,
        name,
        description,
        createdBy: created_by,
        createdAt: now,
        updatedAt: now,
        members: groupChatMembers,
        settings: {
          broadcastMode: "all",
          showThinking: false,
          historyLimit: 10,
        },
      };

      groupChats.set(id, groupChat);

      // Broadcast event
      state.events.broadcast({
        type: "group_chat_created",
        data: { groupChatId: id },
      });

      reply.code(201);
      return {
        group_chat: groupChat,
        members: groupChatMembers,
      };
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

      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      if (name !== undefined) groupChat.name = name;
      if (description !== undefined) groupChat.description = description;
      groupChat.updatedAt = new Date().toISOString();

      groupChats.set(id, groupChat);

      // Broadcast event
      state.events.broadcast({
        type: "group_chat_updated",
        data: { groupChatId: id },
      });

      return groupChat;
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

      if (!groupChats.has(id)) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      groupChats.delete(id);

      // Also delete associated sessions and messages
      // Use Array.from for iteration since Map iteration requires downlevelIteration
      Array.from(sessions.entries()).forEach(([sessionId, session]) => {
        if (session.groupChatId === id) {
          sessions.delete(sessionId);
          uiMessages.delete(sessionId);
        }
      });

      // Broadcast event
      state.events.broadcast({
        type: "group_chat_deleted",
        data: { groupChatId: id },
      });

      return { deleted: id };
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
      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }
      return { members: groupChat.members };
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
      const { type, member_id, display_name, role = "member", model } = request.body;

      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      // Check if member already exists
      if (groupChat.members.some((m) => m.id === member_id)) {
        reply.code(400);
        return { error: `Member already exists: ${member_id}` };
      }

      const member = createMember(member_id, type, display_name, role, model);
      groupChat.members.push(member);
      groupChat.updatedAt = new Date().toISOString();
      groupChats.set(id, groupChat);

      // Broadcast event
      state.events.broadcast({
        type: "group_chat_member_joined",
        data: { groupChatId: id, memberId: member_id },
      });

      reply.code(201);
      return member;
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

      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const memberIndex = groupChat.members.findIndex((m) => m.id === memberId);
      if (memberIndex === -1) {
        reply.code(404);
        return { error: `Member not found: ${memberId}` };
      }

      groupChat.members.splice(memberIndex, 1);
      groupChat.updatedAt = new Date().toISOString();
      groupChats.set(id, groupChat);

      // Broadcast event
      state.events.broadcast({
        type: "group_chat_member_left",
        data: { groupChatId: id, memberId },
      });

      return { deleted: memberId };
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

      if (!groupChats.has(id)) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const groupChatSessions = Array.from(sessions.values()).filter(
        (s) => s.groupChatId === id
      );

      return { sessions: groupChatSessions };
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

      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      const session: Session = {
        id: sessionId,
        groupChatId: id,
        title,
        createdAt: now,
        updatedAt: now,
        activeAgents: active_agents,
        status: "active",
      };

      sessions.set(sessionId, session);
      uiMessages.set(sessionId, []);

      reply.code(201);
      return session;
    }
  );

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
      const { view = "ui", agent_id, limit = 50 } = request.query;

      if (!groupChats.has(id)) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      if (!sessions.has(sessionId)) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      if (view === "agent") {
        if (!agent_id) {
          reply.code(400);
          return { error: "agent_id is required for agent view" };
        }

        const key = `${sessionId}:${agent_id}`;
        const messages = agentMessages.get(key) || [];
        const limitedMessages = messages.slice(-limit);

        return {
          messages: limitedMessages,
          view: "agent",
          agent_id,
          has_more: messages.length > limit,
        };
      }

      // UI view (default)
      const messages = uiMessages.get(sessionId) || [];
      const limitedMessages = messages.slice(-limit);

      return {
        messages: limitedMessages,
        view: "ui",
        has_more: messages.length > limit,
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

      const groupChat = groupChats.get(id);
      if (!groupChat) {
        reply.code(404);
        return { error: `Group chat not found: ${id}` };
      }

      const session = sessions.get(sessionId);
      if (!session) {
        reply.code(404);
        return { error: `Session not found: ${sessionId}` };
      }

      // Create user message
      const userMessage = createUIMessage("user", {
        senderId: sender_id,
        senderName: sender_name,
        content,
      });

      // Add to UI messages
      const sessionMessages = uiMessages.get(sessionId) || [];
      sessionMessages.push(userMessage);
      uiMessages.set(sessionId, sessionMessages);

      // Broadcast message event
      state.events.broadcast({
        type: "group_chat_message",
        data: { groupChatId: id, messageId: userMessage.id },
      });

      // Broadcast to WebSocket connections
      broadcastToSession(sessionId, {
        type: "new_message",
        message: userMessage,
      });

      // Get agent members to trigger
      const agentMembers = groupChat.members.filter((m) => m.type === "agent");
      const agentsTriggered = agentMembers.map((m) => m.id);

      // Simulate agent thinking and responses
      for (const agent of agentMembers) {
        // Broadcast agent thinking
        state.events.broadcast({
          type: "group_chat_agent_thinking",
          data: {
            groupChatId: id,
            sessionId,
            agentId: agent.id,
            agentName: agent.displayName,
          },
        });

        broadcastToSession(sessionId, {
          type: "agent_thinking",
          agent_id: agent.id,
          agent_name: agent.displayName,
        });

        // Add thinking message to UI
        const thinkingMessage = createUIMessage("agent_thinking", {
          agentId: agent.id,
          agentName: agent.displayName,
          status: "thinking",
        });
        sessionMessages.push(thinkingMessage);

        // Simulate a response (in real implementation, this would call the agent)
        setTimeout(() => {
          const responseContent = `[Simulated response from ${agent.displayName}] I received your message: "${content}"`;

          const responseMessage = createUIMessage("agent_response", {
            agentId: agent.id,
            agentName: agent.displayName,
            content: responseContent,
          });

          const msgs = uiMessages.get(sessionId) || [];
          msgs.push(responseMessage);
          uiMessages.set(sessionId, msgs);

          // Broadcast agent response
          state.events.broadcast({
            type: "group_chat_agent_response",
            data: {
              groupChatId: id,
              sessionId,
              agentId: agent.id,
              agentName: agent.displayName,
              content: responseContent,
            },
          });

          broadcastToSession(sessionId, {
            type: "agent_response",
            agent_id: agent.id,
            agent_name: agent.displayName,
            content: responseContent,
          });
        }, 1000 + Math.random() * 2000);
      }

      return {
        message: userMessage,
        agents_triggered: agentsTriggered,
      };
    }
  );

  // ========================================
  // WebSocket Endpoint
  // ========================================

  // Register WebSocket route for group chat sessions
  fastify.register(async (instance) => {
    try {
      const websocket = await import("@fastify/websocket");
      await instance.register(websocket.default);

      instance.get(
        "/ws/group-chats/:id/sessions/:sessionId",
        { websocket: true },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (socket: any, request: any) => {
          const { id, sessionId } = request.params;
          const { member_id } = request.query;

          // Verify group chat and session exist
          const groupChat = groupChats.get(id);
          if (!groupChat) {
            const errorMsg: WsServerMessage = {
              type: "error",
              error: `Group chat not found: ${id}`,
            };
            socket.send(JSON.stringify(errorMsg));
            socket.close();
            return;
          }

          if (!sessions.has(sessionId)) {
            const errorMsg: WsServerMessage = {
              type: "error",
              error: `Session not found: ${sessionId}`,
            };
            socket.send(JSON.stringify(errorMsg));
            socket.close();
            return;
          }

          // Add connection to session
          if (!wsConnections.has(sessionId)) {
            wsConnections.set(sessionId, new Set());
          }
          wsConnections.get(sessionId)!.add(socket);

          // Send connected message
          const connectedMsg: WsServerMessage = {
            type: "connected",
            member_id: member_id || "anonymous",
          };
          socket.send(JSON.stringify(connectedMsg));

          // Handle incoming messages
          socket.on("message", (data: Buffer) => {
            try {
              const cmd = JSON.parse(data.toString()) as WsClientCommand;

              switch (cmd.type) {
                case "send_message": {
                  if (cmd.content && cmd.sender_id && cmd.sender_name) {
                    // Create and store message
                    const userMessage = createUIMessage("user", {
                      senderId: cmd.sender_id,
                      senderName: cmd.sender_name,
                      content: cmd.content,
                    });

                    const msgs = uiMessages.get(sessionId) || [];
                    msgs.push(userMessage);
                    uiMessages.set(sessionId, msgs);

                    // Broadcast to all connections
                    broadcastToSession(sessionId, {
                      type: "new_message",
                      message: userMessage,
                    });

                    // Trigger agents (simplified)
                    const agentMembers = groupChat.members.filter((m) => m.type === "agent");
                    for (const agent of agentMembers) {
                      broadcastToSession(sessionId, {
                        type: "agent_thinking",
                        agent_id: agent.id,
                        agent_name: agent.displayName,
                      });
                    }
                  }
                  break;
                }

                case "typing": {
                  broadcastToSession(sessionId, {
                    type: "typing",
                    member_id: member_id || "anonymous",
                    is_typing: cmd.is_typing,
                  });
                  break;
                }

                case "switch_view": {
                  const view = cmd.view || "ui";
                  let messages: unknown[] = [];

                  if (view === "agent" && cmd.agent_id) {
                    const key = `${sessionId}:${cmd.agent_id}`;
                    messages = agentMessages.get(key) || [];
                  } else {
                    messages = uiMessages.get(sessionId) || [];
                  }

                  const viewDataMsg: WsServerMessage = {
                    type: "view_data",
                    view,
                    agent_id: cmd.agent_id,
                    messages,
                  };
                  socket.send(JSON.stringify(viewDataMsg));
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
            const connections = wsConnections.get(sessionId);
            if (connections) {
              connections.delete(socket);
              if (connections.size === 0) {
                wsConnections.delete(sessionId);
              }
            }

            // Notify others that member left
            broadcastToSession(sessionId, {
              type: "member_left",
              member_id: member_id || "anonymous",
            });
          });

          // Handle error
          socket.on("error", (err: Error) => {
            console.error("[GroupChat WebSocket] Error:", err);
            const connections = wsConnections.get(sessionId);
            if (connections) {
              connections.delete(socket);
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
