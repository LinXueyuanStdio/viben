/**
 * useGroupChat Hook
 *
 * Manages group chat state and real-time WebSocket communication.
 * Updated to support file-based storage with sessions and view switching.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import i18n from "@/i18n";
import {
  getGatewayClient,
  type GroupChat,
  type GroupChatMember,
  type GroupChatSession,
  type GroupChatUIMessage,
  type AgentRolloutMessage,
  type GroupChatWithMembers,
  type CreateGroupChatRequest,
  type AddMemberRequest,
  type SendGroupChatMessageRequest,
  type ListGroupChatsParams,
} from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

/** WebSocket event types from server */
interface WsConnectedEvent {
  type: "connected";
  member_id: string;
}

interface WsNewMessageEvent {
  type: "new_message";
  message: GroupChatUIMessage;
}

interface WsAgentThinkingEvent {
  type: "agent_thinking";
  agent_id: string;
  agent_name: string;
}

interface WsAgentResponseEvent {
  type: "agent_response";
  agent_id: string;
  agent_name: string;
  content: string;
}

interface WsMemberJoinedEvent {
  type: "member_joined";
  member: GroupChatMember;
}

interface WsMemberLeftEvent {
  type: "member_left";
  member_id: string;
}

interface WsTypingEvent {
  type: "typing";
  member_id: string;
  is_typing: boolean;
}

interface WsViewDataEvent {
  type: "view_data";
  view: string;
  agent_id?: string;
  messages: GroupChatUIMessage[] | AgentRolloutMessage[];
}

interface WsErrorEvent {
  type: "error";
  message: string;
}

type GroupChatWsEvent =
  | WsConnectedEvent
  | WsNewMessageEvent
  | WsAgentThinkingEvent
  | WsAgentResponseEvent
  | WsMemberJoinedEvent
  | WsMemberLeftEvent
  | WsTypingEvent
  | WsViewDataEvent
  | WsErrorEvent;

/** Notification callbacks for group chat events */
export interface GroupChatNotificationCallbacks {
  /** Called when a new message is received from another user */
  onNewMessage?: (
    groupId: string,
    groupName: string,
    message: GroupChatUIMessage,
    currentUserId: string
  ) => void;
  /** Called when a member joins the group */
  onMemberJoined?: (
    groupId: string,
    groupName: string,
    member: GroupChatMember
  ) => void;
  /** Called when a member leaves the group */
  onMemberLeft?: (
    groupId: string,
    groupName: string,
    memberId: string,
    memberName?: string
  ) => void;
  /** Called when an agent starts thinking */
  onAgentThinking?: (
    groupId: string,
    groupName: string,
    agentId: string,
    agentName: string
  ) => void;
  /** Called when an agent responds */
  onAgentResponse?: (
    groupId: string,
    groupName: string,
    agentId: string,
    agentName: string,
    content: string
  ) => void;
}

/** View mode for messages */
export type GroupChatViewMode = "ui" | "agent";

/** Hook options */
export interface UseGroupChatOptions {
  /** Current user's ID */
  userId?: string;
  /** Current user's display name */
  userDisplayName?: string;
  /** Workspace path for API calls */
  workspacePath?: string;
  /** Auto-connect to WebSocket when groupChatId and sessionId are provided */
  autoConnect?: boolean;
  /** Optional notification callbacks for group chat events */
  notificationCallbacks?: GroupChatNotificationCallbacks;
}

/** Hook return type */
export interface UseGroupChatReturn {
  // Data
  groupChats: GroupChat[];
  currentGroupChat: GroupChatWithMembers | null;
  sessions: GroupChatSession[];
  currentSession: GroupChatSession | null;
  messages: GroupChatUIMessage[];
  agentMessages: AgentRolloutMessage[];
  members: GroupChatMember[];
  typingMembers: string[];
  thinkingAgents: string[];
  sessionAgents: string[];

  // View state
  viewMode: GroupChatViewMode;
  viewAgentId: string | null;

  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Group Chat CRUD
  loadGroupChats: (params?: ListGroupChatsParams) => Promise<void>;
  createGroupChat: (data: Omit<CreateGroupChatRequest, "created_by" | "workspace_path">) => Promise<GroupChatWithMembers>;
  loadGroupChat: (groupChatId: string) => Promise<void>;
  updateGroupChat: (groupChatId: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteGroupChat: (groupChatId: string) => Promise<void>;

  // Sessions
  loadSessions: (groupChatId: string) => Promise<void>;
  createSession: (groupChatId: string, title?: string) => Promise<GroupChatSession>;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => Promise<void>;

  // Members
  addMember: (member: AddMemberRequest) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;

  // Messages
  loadMessages: (limit?: number) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;

  // View switching
  switchView: (view: GroupChatViewMode, agentId?: string) => void;
  loadSessionAgents: () => Promise<void>;

  // WebSocket
  connect: (groupChatId: string, sessionId: string) => void;
  disconnect: () => void;
  sendTyping: (isTyping: boolean) => void;

  // Utilities
  clearError: () => void;
  setWorkspacePath: (path: string) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGroupChat(
  groupChatId?: string,
  sessionId?: string,
  options?: UseGroupChatOptions
): UseGroupChatReturn {
  const {
    userId = "user-1",
    userDisplayName = i18n.t("common.defaultUserName"),
    workspacePath: initialWorkspacePath,
    autoConnect = true,
    notificationCallbacks,
  } = options || {};

  // State
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [currentGroupChat, setCurrentGroupChat] = useState<GroupChatWithMembers | null>(null);
  const [sessions, setSessions] = useState<GroupChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<GroupChatSession | null>(null);
  const [messages, setMessages] = useState<GroupChatUIMessage[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentRolloutMessage[]>([]);
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [typingMembers, setTypingMembers] = useState<string[]>([]);
  const [thinkingAgents, setThinkingAgents] = useState<string[]>([]);
  const [sessionAgents, setSessionAgents] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<GroupChatViewMode>("ui");
  const [viewAgentId, setViewAgentId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>(initialWorkspacePath || "");

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const currentGroupChatIdRef = useRef<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const currentGroupChatNameRef = useRef<string>("");
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const membersMapRef = useRef<Map<string, string>>(new Map()); // member_id -> display_name

  // Get client
  const client = getGatewayClient();

  // ============================================================================
  // WebSocket Management
  // ============================================================================

  /**
   * Handle incoming WebSocket events
   */
  const handleWsEvent = useCallback((event: GroupChatWsEvent) => {
    const groupId = currentGroupChatIdRef.current;
    const groupName = currentGroupChatNameRef.current;

    switch (event.type) {
      case "connected":
        console.log("[useGroupChat] WebSocket connected, member_id:", event.member_id);
        break;

      case "new_message":
        setMessages((prev) => [...prev, event.message]);
        // Trigger notification callback for new messages (not from self)
        if (notificationCallbacks?.onNewMessage && groupId && event.message.sender_id !== userId) {
          notificationCallbacks.onNewMessage(groupId, groupName, event.message, userId);
        }
        break;

      case "agent_thinking":
        setThinkingAgents((prev) =>
          prev.includes(event.agent_id) ? prev : [...prev, event.agent_id]
        );
        if (notificationCallbacks?.onAgentThinking && groupId) {
          notificationCallbacks.onAgentThinking(groupId, groupName, event.agent_id, event.agent_name);
        }
        break;

      case "agent_response":
        // Remove from thinking agents
        setThinkingAgents((prev) => prev.filter((id) => id !== event.agent_id));
        // Add response as a message
        const responseMsg: GroupChatUIMessage = {
          id: `agent-${event.agent_id}-${Date.now()}`,
          type: "agent_response",
          timestamp: new Date().toISOString(),
          agent_id: event.agent_id,
          agent_name: event.agent_name,
          content: event.content,
        };
        setMessages((prev) => [...prev, responseMsg]);
        if (notificationCallbacks?.onAgentResponse && groupId) {
          notificationCallbacks.onAgentResponse(groupId, groupName, event.agent_id, event.agent_name, event.content);
        }
        break;

      case "member_joined":
        setMembers((prev) => [...prev, event.member]);
        // Update members map
        membersMapRef.current.set(event.member.id, event.member.display_name);
        // Trigger notification callback
        if (notificationCallbacks?.onMemberJoined && groupId) {
          notificationCallbacks.onMemberJoined(groupId, groupName, event.member);
        }
        break;

      case "member_left": {
        // Get member name before removing
        const memberName = membersMapRef.current.get(event.member_id);
        setMembers((prev) => prev.filter((m) => m.id !== event.member_id));
        // Remove from members map
        membersMapRef.current.delete(event.member_id);
        // Trigger notification callback
        if (notificationCallbacks?.onMemberLeft && groupId) {
          notificationCallbacks.onMemberLeft(groupId, groupName, event.member_id, memberName);
        }
        break;
      }

      case "typing": {
        const { member_id, is_typing } = event;
        if (is_typing) {
          setTypingMembers((prev) =>
            prev.includes(member_id) ? prev : [...prev, member_id]
          );
          // Clear typing after 3 seconds
          if (typingTimeoutRef.current[member_id]) {
            clearTimeout(typingTimeoutRef.current[member_id]);
          }
          typingTimeoutRef.current[member_id] = setTimeout(() => {
            setTypingMembers((prev) => prev.filter((id) => id !== member_id));
          }, 3000);
        } else {
          setTypingMembers((prev) => prev.filter((id) => id !== member_id));
        }
        break;
      }

      case "view_data":
        // Handle view data from server (when switching views)
        if (event.view === "agent" && event.agent_id) {
          setAgentMessages(event.messages as AgentRolloutMessage[]);
          setViewMode("agent");
          setViewAgentId(event.agent_id);
        } else {
          setMessages(event.messages as GroupChatUIMessage[]);
          setViewMode("ui");
          setViewAgentId(null);
        }
        break;

      case "error":
        console.error("[useGroupChat] WebSocket error:", event.message);
        setError(event.message);
        break;
    }
  }, [notificationCallbacks, userId]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback((chatId: string, sessId: string) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    if (!workspacePath) {
      console.warn("[useGroupChat] Cannot connect without workspacePath");
      return;
    }

    currentGroupChatIdRef.current = chatId;
    currentSessionIdRef.current = sessId;

    try {
      const ws = client.connectGroupChatWs(chatId, sessId, workspacePath, "human", userId);

      ws.onopen = () => {
        console.log("[useGroupChat] WebSocket connected");
        setIsConnected(true);
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as GroupChatWsEvent;
          handleWsEvent(event);
        } catch (err) {
          console.error("[useGroupChat] Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = (e) => {
        console.error("[useGroupChat] WebSocket error:", e);
        setError(i18n.t("errors.websocket.connectionError"));
      };

      ws.onclose = () => {
        console.log("[useGroupChat] WebSocket closed");
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[useGroupChat] Failed to connect:", err);
      setError(err instanceof Error ? err.message : i18n.t("errors.connection.failed"));
    }
  }, [client, userId, workspacePath, handleWsEvent]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    currentGroupChatIdRef.current = null;
    currentSessionIdRef.current = null;
    currentGroupChatNameRef.current = "";
    membersMapRef.current.clear();
  }, []);

  /**
   * Send typing indicator via WebSocket
   */
  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        is_typing: isTyping,
      }));
    }
  }, []);

  // ============================================================================
  // Group Chat CRUD
  // ============================================================================

  /**
   * Load all group chats
   */
  const loadGroupChats = useCallback(async (params?: ListGroupChatsParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const effectiveParams = {
        ...params,
        workspace_path: params?.workspace_path || workspacePath,
      };
      const chats = await client.listGroupChats(effectiveParams);
      setGroupChats(chats);
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.loadFailed");
      setError(message);
      console.error("[useGroupChat] Failed to load group chats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client, workspacePath]);

  /**
   * Create a new group chat
   */
  const createGroupChat = useCallback(async (data: Omit<CreateGroupChatRequest, "created_by" | "workspace_path">): Promise<GroupChatWithMembers> => {
    if (!workspacePath) {
      throw new Error(i18n.t("errors.groupChat.workspacePathRequired"));
    }

    setIsLoading(true);
    setError(null);
    try {
      // Add current user as owner if not in members
      const hasCurrentUser = data.members?.some(
        (m) => m.type === "human" && m.member_id === userId
      );
      const requestData: CreateGroupChatRequest = {
        ...data,
        workspace_path: workspacePath,
        created_by: userId,
        members: hasCurrentUser ? data.members : [
          {
            type: "human" as const,
            member_id: userId,
            display_name: userDisplayName,
            role: "owner" as const,
          },
          ...(data.members || []),
        ],
      };

      const result = await client.createGroupChat(requestData);
      setGroupChats((prev) => [result.group_chat, ...prev]);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.createFailed");
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client, userId, userDisplayName, workspacePath]);

  /**
   * Load a specific group chat with members
   */
  const loadGroupChat = useCallback(async (chatId: string) => {
    if (!workspacePath) {
      console.warn("[useGroupChat] Cannot load group chat without workspacePath");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getGroupChat(chatId, workspacePath);
      if (!result) {
        setError(i18n.t("errors.groupChat.notFound"));
        setCurrentGroupChat(null);
        setMembers([]);
        return;
      }
      setCurrentGroupChat(result);
      setMembers(result.members);
      // Store group name for notifications
      currentGroupChatNameRef.current = result.group_chat.name;
      // Build members map for looking up display names
      membersMapRef.current.clear();
      for (const member of result.members) {
        membersMapRef.current.set(member.id, member.display_name);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.loadChatFailed");
      setError(message);
      console.error("[useGroupChat] Failed to load group chat:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client, workspacePath]);

  /**
   * Update a group chat
   */
  const updateGroupChat = useCallback(async (
    chatId: string,
    data: { name?: string; description?: string }
  ) => {
    if (!workspacePath) {
      throw new Error(i18n.t("errors.groupChat.workspacePathRequiredUpdate"));
    }

    setError(null);
    try {
      const updated = await client.updateGroupChat(chatId, workspacePath, data);
      setGroupChats((prev) =>
        prev.map((c) => (c.id === chatId ? updated : c))
      );
      if (currentGroupChat?.group_chat.id === chatId) {
        setCurrentGroupChat((prev) => prev ? { ...prev, group_chat: updated } : null);
        // Update the group name ref if it changed
        if (data.name) {
          currentGroupChatNameRef.current = data.name;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.updateFailed");
      setError(message);
      throw err;
    }
  }, [client, currentGroupChat, workspacePath]);

  /**
   * Delete a group chat
   */
  const deleteGroupChat = useCallback(async (chatId: string) => {
    if (!workspacePath) {
      throw new Error(i18n.t("errors.groupChat.workspacePathRequiredDelete"));
    }

    setError(null);
    try {
      await client.deleteGroupChat(chatId, workspacePath);
      setGroupChats((prev) => prev.filter((c) => c.id !== chatId));
      if (currentGroupChat?.group_chat.id === chatId) {
        setCurrentGroupChat(null);
        setMessages([]);
        setMembers([]);
        setSessions([]);
        setCurrentSession(null);
        disconnect();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.deleteFailed");
      setError(message);
      throw err;
    }
  }, [client, currentGroupChat, disconnect, workspacePath]);

  // ============================================================================
  // Sessions
  // ============================================================================

  /**
   * Load sessions for a group chat
   */
  const loadSessions = useCallback(async (chatId: string) => {
    if (!workspacePath) {
      console.warn("[useGroupChat] Cannot load sessions without workspacePath");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const sessionList = await client.listGroupChatSessions(chatId, workspacePath);
      setSessions(sessionList);
      // Auto-select first session if none selected
      if (sessionList.length > 0 && !currentSessionIdRef.current) {
        setCurrentSession(sessionList[0]);
        currentSessionIdRef.current = sessionList[0].id;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.loadSessionsFailed");
      setError(message);
      console.error("[useGroupChat] Failed to load sessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client, workspacePath]);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (chatId: string, title?: string): Promise<GroupChatSession> => {
    if (!workspacePath) {
      throw new Error(i18n.t("errors.groupChat.workspacePathRequired"));
    }

    setIsLoading(true);
    setError(null);
    try {
      const session = await client.createGroupChatSession(chatId, workspacePath, { title });
      setSessions((prev) => [session, ...prev]);
      setCurrentSession(session);
      currentSessionIdRef.current = session.id;
      setMessages([]);
      return session;
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.createSessionFailed");
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client, workspacePath]);

  /**
   * Select a session
   */
  const selectSession = useCallback((sessId: string) => {
    const session = sessions.find((s) => s.id === sessId);
    if (session) {
      setCurrentSession(session);
      currentSessionIdRef.current = sessId;
      setMessages([]);
      setAgentMessages([]);
      setViewMode("ui");
      setViewAgentId(null);
    }
  }, [sessions]);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessId: string) => {
    if (!workspacePath || !currentGroupChatIdRef.current) {
      throw new Error(i18n.t("errors.groupChat.workspaceAndGroupRequired"));
    }

    setError(null);
    try {
      await client.deleteGroupChatSession(currentGroupChatIdRef.current, sessId, workspacePath);
      setSessions((prev) => prev.filter((s) => s.id !== sessId));
      if (currentSession?.id === sessId) {
        const remaining = sessions.filter((s) => s.id !== sessId);
        if (remaining.length > 0) {
          setCurrentSession(remaining[0]);
          currentSessionIdRef.current = remaining[0].id;
        } else {
          setCurrentSession(null);
          currentSessionIdRef.current = null;
        }
        setMessages([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.deleteSessionFailed");
      setError(message);
      throw err;
    }
  }, [client, currentSession, sessions, workspacePath]);

  // ============================================================================
  // Members
  // ============================================================================

  /**
   * Add a member to the current group chat
   */
  const addMember = useCallback(async (member: AddMemberRequest) => {
    if (!currentGroupChatIdRef.current || !workspacePath) {
      setError(i18n.t("errors.groupChat.noChatOrWorkspace"));
      return;
    }
    setError(null);
    try {
      const newMember = await client.addGroupChatMember(
        currentGroupChatIdRef.current,
        workspacePath,
        member
      );
      setMembers((prev) => [...prev, newMember]);
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.addMemberFailed");
      setError(message);
      throw err;
    }
  }, [client, workspacePath]);

  /**
   * Remove a member from the current group chat
   */
  const removeMember = useCallback(async (memberId: string) => {
    if (!currentGroupChatIdRef.current || !workspacePath) {
      setError(i18n.t("errors.groupChat.noChatOrWorkspace"));
      return;
    }
    setError(null);
    try {
      await client.removeGroupChatMember(currentGroupChatIdRef.current, workspacePath, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.removeMemberFailed");
      setError(message);
      throw err;
    }
  }, [client, workspacePath]);

  // ============================================================================
  // Messages
  // ============================================================================

  /**
   * Load messages for the current session
   */
  const loadMessages = useCallback(async (limit?: number) => {
    if (!currentGroupChatIdRef.current || !currentSessionIdRef.current || !workspacePath) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const params = viewMode === "agent" && viewAgentId
        ? { view: "agent" as const, agent_id: viewAgentId, limit }
        : { view: "ui" as const, limit };

      const result = await client.listGroupChatMessages(
        currentGroupChatIdRef.current,
        currentSessionIdRef.current,
        workspacePath,
        params
      );

      if (result.view === "agent") {
        setAgentMessages((result as { messages: AgentRolloutMessage[] }).messages);
      } else {
        setMessages((result as { messages: GroupChatUIMessage[] }).messages);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.loadMessagesFailed");
      setError(message);
      console.error("[useGroupChat] Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client, viewMode, viewAgentId, workspacePath]);

  /**
   * Send a message to the current session
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!currentGroupChatIdRef.current || !currentSessionIdRef.current || !workspacePath) {
      setError(i18n.t("errors.groupChat.noChatOrSession"));
      return;
    }
    if (!content.trim()) {
      return;
    }

    setError(null);
    try {
      const request: SendGroupChatMessageRequest = {
        content: content.trim(),
        sender_id: userId,
        sender_name: userDisplayName,
      };
      const result = await client.sendGroupChatMessage(
        currentGroupChatIdRef.current,
        currentSessionIdRef.current,
        workspacePath,
        request
      );

      // Optimistically add the message (WebSocket will also send it back)
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === result.message.id)) {
          return prev;
        }
        return [...prev, result.message];
      });

      // Mark triggered agents as thinking
      if (result.agents_triggered.length > 0) {
        setThinkingAgents((prev) => [
          ...prev,
          ...result.agents_triggered.filter((id) => !prev.includes(id)),
        ]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t("errors.groupChat.sendMessageFailed");
      setError(message);
      throw err;
    }
  }, [client, userId, userDisplayName, workspacePath]);

  // ============================================================================
  // View Switching
  // ============================================================================

  /**
   * Switch between UI view and Agent view
   */
  const switchView = useCallback((view: GroupChatViewMode, agentId?: string) => {
    if (view === "agent" && !agentId) {
      console.warn("[useGroupChat] agent_id is required for agent view");
      return;
    }

    setViewMode(view);
    setViewAgentId(view === "agent" ? agentId || null : null);

    // Send view switch command via WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "switch_view",
        view,
        agent_id: agentId,
      }));
    } else {
      // Otherwise load messages via REST API
      loadMessages();
    }
  }, [loadMessages]);

  /**
   * Load available agents for the current session
   */
  const loadSessionAgents = useCallback(async () => {
    if (!currentGroupChatIdRef.current || !currentSessionIdRef.current || !workspacePath) {
      return;
    }

    try {
      const agents = await client.listSessionAgents(
        currentGroupChatIdRef.current,
        currentSessionIdRef.current,
        workspacePath
      );
      setSessionAgents(agents);
    } catch (err) {
      console.error("[useGroupChat] Failed to load session agents:", err);
    }
  }, [client, workspacePath]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Connect to WebSocket when groupChatId and sessionId change
  useEffect(() => {
    if (groupChatId && sessionId && workspacePath && autoConnect) {
      currentGroupChatIdRef.current = groupChatId;
      currentSessionIdRef.current = sessionId;
      connect(groupChatId, sessionId);
      loadGroupChat(groupChatId);
      loadSessions(groupChatId);
      loadMessages();
      loadSessionAgents();
    }

    return () => {
      disconnect();
    };
  }, [groupChatId, sessionId, workspacePath, autoConnect, connect, disconnect, loadGroupChat, loadSessions, loadMessages, loadSessionAgents]);

  // Cleanup typing timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, []);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Data
    groupChats,
    currentGroupChat,
    sessions,
    currentSession,
    messages,
    agentMessages,
    members,
    typingMembers,
    thinkingAgents,
    sessionAgents,

    // View state
    viewMode,
    viewAgentId,

    // Connection state
    isConnected,
    isLoading,
    error,

    // Group Chat CRUD
    loadGroupChats,
    createGroupChat,
    loadGroupChat,
    updateGroupChat,
    deleteGroupChat,

    // Sessions
    loadSessions,
    createSession,
    selectSession,
    deleteSession,

    // Members
    addMember,
    removeMember,

    // Messages
    loadMessages,
    sendMessage,

    // View switching
    switchView,
    loadSessionAgents,

    // WebSocket
    connect,
    disconnect,
    sendTyping,

    // Utilities
    clearError: () => setError(null),
    setWorkspacePath,
  };
}
