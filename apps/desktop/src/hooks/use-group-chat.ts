/**
 * useGroupChat Hook
 *
 * Manages group chat state and real-time WebSocket communication.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getGatewayClient,
  type GroupChat,
  type GroupChatMember,
  type GroupChatMessage,
  type GroupChatWithMembers,
  type CreateGroupChatRequest,
  type AddMemberRequest,
  type SendGroupChatMessageRequest,
  type MessageContentType,
} from "@/lib/gateway";

// ============================================================================
// Types
// ============================================================================

/** WebSocket event types from server */
interface WsNewMessageEvent {
  type: "new_message";
  message: GroupChatMessage;
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

interface WsMessageReadEvent {
  type: "message_read";
  member_id: string;
  message_id: string;
}

type GroupChatWsEvent =
  | WsNewMessageEvent
  | WsMemberJoinedEvent
  | WsMemberLeftEvent
  | WsTypingEvent
  | WsMessageReadEvent;

/** Notification callbacks for group chat events */
export interface GroupChatNotificationCallbacks {
  /** Called when a new message is received from another user */
  onNewMessage?: (
    groupId: string,
    groupName: string,
    message: GroupChatMessage,
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
}

/** Hook options */
export interface UseGroupChatOptions {
  /** Current user's ID */
  userId?: string;
  /** Current user's display name */
  userDisplayName?: string;
  /** Auto-connect to WebSocket when groupChatId is provided */
  autoConnect?: boolean;
  /** Optional notification callbacks for group chat events */
  notificationCallbacks?: GroupChatNotificationCallbacks;
}

/** Hook return type */
export interface UseGroupChatReturn {
  // Data
  groupChats: GroupChat[];
  currentGroupChat: GroupChatWithMembers | null;
  messages: GroupChatMessage[];
  members: GroupChatMember[];
  typingMembers: string[];

  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Group Chat CRUD
  loadGroupChats: () => Promise<void>;
  createGroupChat: (data: Omit<CreateGroupChatRequest, "created_by">) => Promise<GroupChatWithMembers>;
  loadGroupChat: (groupChatId: string) => Promise<void>;
  updateGroupChat: (groupChatId: string, data: { name?: string; description?: string }) => Promise<void>;
  deleteGroupChat: (groupChatId: string) => Promise<void>;

  // Members
  addMember: (member: AddMemberRequest) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  leaveGroupChat: () => Promise<void>;

  // Messages
  loadMessages: (limit?: number) => Promise<void>;
  sendMessage: (content: string, options?: {
    contentType?: MessageContentType;
    mentions?: string[];
    replyTo?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;

  // WebSocket
  connect: (groupChatId: string) => void;
  disconnect: () => void;
  sendTyping: (isTyping: boolean) => void;

  // Utilities
  clearError: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGroupChat(
  groupChatId?: string,
  options?: UseGroupChatOptions
): UseGroupChatReturn {
  const {
    userId = "user-1",
    userDisplayName = "User",
    autoConnect = true,
    notificationCallbacks,
  } = options || {};

  // State
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [currentGroupChat, setCurrentGroupChat] = useState<GroupChatWithMembers | null>(null);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [typingMembers, setTypingMembers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const currentGroupChatIdRef = useRef<string | null>(null);
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
      case "new_message":
        setMessages((prev) => [...prev, event.message]);
        // Trigger notification callback for new messages (not from self)
        if (notificationCallbacks?.onNewMessage && groupId && event.message.sender_id !== userId) {
          notificationCallbacks.onNewMessage(groupId, groupName, event.message, userId);
        }
        break;

      case "member_joined":
        setMembers((prev) => [...prev, event.member]);
        // Update members map
        membersMapRef.current.set(event.member.member_id, event.member.display_name);
        // Trigger notification callback
        if (notificationCallbacks?.onMemberJoined && groupId) {
          notificationCallbacks.onMemberJoined(groupId, groupName, event.member);
        }
        break;

      case "member_left": {
        // Get member name before removing
        const memberName = membersMapRef.current.get(event.member_id);
        setMembers((prev) => prev.filter((m) => m.member_id !== event.member_id));
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

      case "message_read":
        // Could track read receipts here
        break;
    }
  }, [notificationCallbacks, userId]);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback((chatId: string) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    currentGroupChatIdRef.current = chatId;

    try {
      const ws = client.connectGroupChatWs(chatId, "human", userId);

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
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        console.log("[useGroupChat] WebSocket closed");
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[useGroupChat] Failed to connect:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [client, userId, handleWsEvent]);

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
  const loadGroupChats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const chats = await client.listGroupChats();
      setGroupChats(chats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load group chats";
      setError(message);
      console.error("[useGroupChat] Failed to load group chats:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Create a new group chat
   */
  const createGroupChat = useCallback(async (data: Omit<CreateGroupChatRequest, "created_by">): Promise<GroupChatWithMembers> => {
    setIsLoading(true);
    setError(null);
    try {
      // Add current user as owner if not in initial_members
      const hasCurrentUser = data.initial_members?.some(
        (m) => m.member_type === "human" && m.member_id === userId
      );
      const requestData: CreateGroupChatRequest = {
        ...data,
        created_by: userId,
        initial_members: hasCurrentUser ? data.initial_members : [
          {
            member_type: "human" as const,
            member_id: userId,
            display_name: userDisplayName,
            role: "owner" as const,
          },
          ...(data.initial_members || []),
        ],
      };

      const result = await client.createGroupChat(requestData);
      setGroupChats((prev) => [result.group_chat, ...prev]);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create group chat";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [client, userId, userDisplayName]);

  /**
   * Load a specific group chat with members
   */
  const loadGroupChat = useCallback(async (chatId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.getGroupChat(chatId);
      setCurrentGroupChat(result);
      setMembers(result.members);
      // Store group name for notifications
      currentGroupChatNameRef.current = result.group_chat.name;
      // Build members map for looking up display names
      membersMapRef.current.clear();
      for (const member of result.members) {
        membersMapRef.current.set(member.member_id, member.display_name);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load group chat";
      setError(message);
      console.error("[useGroupChat] Failed to load group chat:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Update a group chat
   */
  const updateGroupChat = useCallback(async (
    chatId: string,
    data: { name?: string; description?: string }
  ) => {
    setError(null);
    try {
      const updated = await client.updateGroupChat(chatId, data);
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
      const message = err instanceof Error ? err.message : "Failed to update group chat";
      setError(message);
      throw err;
    }
  }, [client, currentGroupChat]);

  /**
   * Delete a group chat
   */
  const deleteGroupChat = useCallback(async (chatId: string) => {
    setError(null);
    try {
      await client.deleteGroupChat(chatId);
      setGroupChats((prev) => prev.filter((c) => c.id !== chatId));
      if (currentGroupChat?.group_chat.id === chatId) {
        setCurrentGroupChat(null);
        setMessages([]);
        setMembers([]);
        disconnect();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete group chat";
      setError(message);
      throw err;
    }
  }, [client, currentGroupChat, disconnect]);

  // ============================================================================
  // Members
  // ============================================================================

  /**
   * Add a member to the current group chat
   */
  const addMember = useCallback(async (member: AddMemberRequest) => {
    if (!currentGroupChatIdRef.current) {
      setError("No group chat selected");
      return;
    }
    setError(null);
    try {
      const newMember = await client.addGroupChatMember(
        currentGroupChatIdRef.current,
        member
      );
      setMembers((prev) => [...prev, newMember]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add member";
      setError(message);
      throw err;
    }
  }, [client]);

  /**
   * Remove a member from the current group chat
   */
  const removeMember = useCallback(async (memberId: string) => {
    if (!currentGroupChatIdRef.current) {
      setError("No group chat selected");
      return;
    }
    setError(null);
    try {
      await client.removeGroupChatMember(currentGroupChatIdRef.current, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      setError(message);
      throw err;
    }
  }, [client]);

  /**
   * Leave the current group chat
   */
  const leaveGroupChat = useCallback(async () => {
    if (!currentGroupChatIdRef.current) {
      setError("No group chat selected");
      return;
    }
    setError(null);
    try {
      await client.leaveGroupChat(currentGroupChatIdRef.current);
      disconnect();
      setCurrentGroupChat(null);
      setMessages([]);
      setMembers([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave group chat";
      setError(message);
      throw err;
    }
  }, [client, disconnect]);

  // ============================================================================
  // Messages
  // ============================================================================

  /**
   * Load messages for the current group chat
   */
  const loadMessages = useCallback(async (limit?: number) => {
    if (!currentGroupChatIdRef.current) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const msgs = await client.listGroupChatMessages(
        currentGroupChatIdRef.current,
        limit ? { limit } : undefined
      );
      setMessages(msgs);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load messages";
      setError(message);
      console.error("[useGroupChat] Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Send a message to the current group chat
   */
  const sendMessage = useCallback(async (
    content: string,
    options?: {
      contentType?: MessageContentType;
      mentions?: string[];
      replyTo?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    if (!currentGroupChatIdRef.current) {
      setError("No group chat selected");
      return;
    }
    if (!content.trim()) {
      return;
    }

    setError(null);
    try {
      const request: SendGroupChatMessageRequest = {
        content: content.trim(),
        content_type: options?.contentType,
        mentions: options?.mentions,
        reply_to: options?.replyTo,
        metadata: options?.metadata,
      };
      const newMessage = await client.sendGroupChatMessage(
        currentGroupChatIdRef.current,
        request
      );
      // Optimistically add the message (WebSocket will also send it back)
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((m) => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setError(message);
      throw err;
    }
  }, [client]);

  /**
   * Delete a message
   */
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!currentGroupChatIdRef.current) {
      setError("No group chat selected");
      return;
    }
    setError(null);
    try {
      await client.deleteGroupChatMessage(currentGroupChatIdRef.current, messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete message";
      setError(message);
      throw err;
    }
  }, [client]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Connect to WebSocket when groupChatId changes
  useEffect(() => {
    if (groupChatId && autoConnect) {
      currentGroupChatIdRef.current = groupChatId;
      connect(groupChatId);
      loadGroupChat(groupChatId);
      loadMessages();
    }

    return () => {
      disconnect();
    };
  }, [groupChatId, autoConnect, connect, disconnect, loadGroupChat, loadMessages]);

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
    messages,
    members,
    typingMembers,

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

    // Members
    addMember,
    removeMember,
    leaveGroupChat,

    // Messages
    loadMessages,
    sendMessage,
    deleteMessage,

    // WebSocket
    connect,
    disconnect,
    sendTyping,

    // Utilities
    clearError: () => setError(null),
  };
}
