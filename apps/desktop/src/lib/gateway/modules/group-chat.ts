/**
 * Group Chat Module
 * 群聊模块
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  GroupChat,
  GroupChatWithMembers,
  GroupChatMember,
  GroupChatSession,
  CreateGroupChatRequest,
  UpdateGroupChatRequest,
  AddMemberRequest,
  CreateGroupChatSessionRequest,
  ListGroupChatsParams,
  ListGroupChatMessagesParams,
  ListGroupChatMessagesResponse,
  ListAgentMessagesResponse,
  SendGroupChatMessageResponse,
  SendGroupChatMessageRequest,
} from "../types";

// ============================================================================
// Group Chat CRUD
// ============================================================================

/**
 * List group chats
 */
export async function listGroupChats(
  baseUrl: string,
  params?: ListGroupChatsParams
): Promise<GroupChat[]> {
  const searchParams = new URLSearchParams();
  if (params?.workspace_path) searchParams.set("workspace_path", params.workspace_path);
  if (params?.include_global !== undefined) searchParams.set("include_global", String(params.include_global));
  if (params?.created_by) searchParams.set("created_by", params.created_by);

  const response = await fetch(
    `${baseUrl}/api/group-chats?${searchParams.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list group chats: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get group chat by ID
 */
export async function getGroupChat(
  baseUrl: string,
  groupChatId: string
): Promise<GroupChatWithMembers | null> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get group chat: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create group chat
 */
export async function createGroupChat(
  baseUrl: string,
  request: CreateGroupChatRequest
): Promise<GroupChatWithMembers> {
  const response = await fetch(`${baseUrl}/api/group-chats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create group chat: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update group chat
 */
export async function updateGroupChat(
  baseUrl: string,
  groupChatId: string,
  request: UpdateGroupChatRequest
): Promise<GroupChat> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update group chat: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete group chat
 */
export async function deleteGroupChat(
  baseUrl: string,
  groupChatId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete group chat: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Members
// ============================================================================

/**
 * Add member to group chat
 */
export async function addMember(
  baseUrl: string,
  groupChatId: string,
  request: AddMemberRequest
): Promise<GroupChatMember> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/members`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to add member: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Remove member from group chat
 */
export async function removeMember(
  baseUrl: string,
  groupChatId: string,
  memberId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/members/${encodeURIComponent(memberId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to remove member: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Sessions
// ============================================================================

/**
 * List sessions for group chat
 */
export async function listGroupChatSessions(
  baseUrl: string,
  groupChatId: string
): Promise<GroupChatSession[]> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list group chat sessions: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get group chat session
 */
export async function getGroupChatSession(
  baseUrl: string,
  groupChatId: string,
  sessionId: string
): Promise<GroupChatSession | null> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get group chat session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create group chat session
 */
export async function createGroupChatSession(
  baseUrl: string,
  groupChatId: string,
  request: CreateGroupChatSessionRequest
): Promise<GroupChatSession> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to create group chat session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Archive group chat session
 */
export async function archiveGroupChatSession(
  baseUrl: string,
  groupChatId: string,
  sessionId: string
): Promise<GroupChatSession> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/archive`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to archive group chat session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

// ============================================================================
// Messages
// ============================================================================

/**
 * List messages in group chat session
 */
export async function listGroupChatMessages(
  baseUrl: string,
  groupChatId: string,
  sessionId: string,
  params?: ListGroupChatMessagesParams
): Promise<ListGroupChatMessagesResponse | ListAgentMessagesResponse> {
  const searchParams = new URLSearchParams();
  if (params?.view) searchParams.set("view", params.view);
  if (params?.agent_id) searchParams.set("agent_id", params.agent_id);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.before) searchParams.set("before", params.before);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/messages?${searchParams.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list group chat messages: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Send message to group chat session
 */
export async function sendGroupChatMessage(
  baseUrl: string,
  groupChatId: string,
  sessionId: string,
  request: SendGroupChatMessageRequest
): Promise<SendGroupChatMessageResponse> {
  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to send group chat message: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
