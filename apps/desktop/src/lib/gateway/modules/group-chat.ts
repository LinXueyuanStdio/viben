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

  const data = await response.json();
  return data.group_chats as GroupChat[];
}

/**
 * Get group chat by ID
 */
export async function getGroupChat(
  baseUrl: string,
  groupChatId: string,
  workspacePath: string
): Promise<GroupChatWithMembers | null> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}?${searchParams.toString()}`,
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
  request: CreateGroupChatRequest,
  workspacePath?: string
): Promise<GroupChatWithMembers> {
  const searchParams = new URLSearchParams();
  if (workspacePath) {
    searchParams.set("workspace_path", workspacePath);
  }

  const url = searchParams.toString()
    ? `${baseUrl}/api/group-chats?${searchParams.toString()}`
    : `${baseUrl}/api/group-chats`;

  const response = await fetch(url, {
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
  workspacePath: string,
  request: UpdateGroupChatRequest
): Promise<GroupChat> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}?${searchParams.toString()}`,
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
  groupChatId: string,
  workspacePath: string
): Promise<void> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}?${searchParams.toString()}`,
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
  workspacePath: string,
  request: AddMemberRequest
): Promise<GroupChatMember> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/members?${searchParams.toString()}`,
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
  workspacePath: string,
  memberId: string
): Promise<void> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/members/${encodeURIComponent(memberId)}?${searchParams.toString()}`,
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
  groupChatId: string,
  workspacePath: string
): Promise<GroupChatSession[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions?${searchParams.toString()}`,
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

  const data = await response.json();
  return data.sessions as GroupChatSession[];
}

/**
 * Get group chat session
 */
export async function getGroupChatSession(
  baseUrl: string,
  groupChatId: string,
  sessionId: string,
  workspacePath: string
): Promise<GroupChatSession | null> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}?${searchParams.toString()}`,
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
  workspacePath: string,
  request?: CreateGroupChatSessionRequest
): Promise<GroupChatSession> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions?${searchParams.toString()}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
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
  sessionId: string,
  workspacePath: string
): Promise<GroupChatSession> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/archive?${searchParams.toString()}`,
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
  workspacePath: string,
  params?: ListGroupChatMessagesParams
): Promise<ListGroupChatMessagesResponse | ListAgentMessagesResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);
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
  workspacePath: string,
  request: SendGroupChatMessageRequest
): Promise<SendGroupChatMessageResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/messages?${searchParams.toString()}`,
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

// ============================================================================
// Group Chat Members (additional methods)
// ============================================================================

/**
 * List members of a group chat
 */
export async function listGroupChatMembers(
  baseUrl: string,
  groupChatId: string,
  workspacePath: string
): Promise<GroupChatMember[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/members?${searchParams.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list group chat members: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.members as GroupChatMember[];
}

// ============================================================================
// Sessions (additional methods)
// ============================================================================

/**
 * Delete a group chat session
 */
export async function deleteGroupChatSession(
  baseUrl: string,
  groupChatId: string,
  sessionId: string,
  workspacePath: string
): Promise<void> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}?${searchParams.toString()}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete group chat session: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * List available agents in a session (for view switching)
 */
export async function listSessionAgents(
  baseUrl: string,
  groupChatId: string,
  sessionId: string,
  workspacePath: string
): Promise<string[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/agents?${searchParams.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list session agents: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.agents as string[];
}

// ============================================================================
// WebSocket Connection
// ============================================================================

/**
 * Connect to a group chat session WebSocket for real-time updates
 */
export function connectGroupChatWs(
  baseUrl: string,
  groupChatId: string,
  sessionId: string,
  workspacePath: string,
  memberType: string,
  memberId: string
): WebSocket {
  const wsUrl = baseUrl.replace(/^http/, "ws");
  const searchParams = new URLSearchParams();
  searchParams.set("workspace_path", workspacePath);
  searchParams.set("member_type", memberType);
  searchParams.set("member_id", memberId);
  const url = `${wsUrl}/api/group-chats/${encodeURIComponent(groupChatId)}/sessions/${encodeURIComponent(sessionId)}/ws?${searchParams.toString()}`;
  return new WebSocket(url);
}
