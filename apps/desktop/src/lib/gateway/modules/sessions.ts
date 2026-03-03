/**
 * Sessions Module - File-based Session Management
 * 会话模块 - 基于文件的会话管理
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  FileSession,
  SessionMessage,
  UIMessage,
  CreateFileSessionRequest,
  AppendMessageRequest,
  ExecutorSession,
  ExecutorUIMessage,
} from "../types";

// ============================================================================
// File-based Sessions
// ============================================================================

/**
 * List sessions for an agent
 */
export async function listSessions(
  baseUrl: string,
  agentId: string,
  workspacePath?: string
): Promise<FileSession[]> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);
  const query = params.toString();
  const url = `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list sessions: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.sessions as FileSession[];
}

/**
 * Get session by ID
 * Requires agentId for the correct API path
 */
export async function getSession(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<FileSession | null> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`,
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
      `Failed to get session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Create a new session
 */
export async function createSession(
  baseUrl: string,
  agentId: string,
  request?: CreateFileSessionRequest
): Promise<FileSession> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions`,
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
      `Failed to create session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update session metadata
 * Note: Uses agent-centric API path
 */
export async function updateSession(
  baseUrl: string,
  agentId: string,
  sessionId: string,
  updates: Partial<Pick<FileSession, "status" | "metadata">>
): Promise<FileSession> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to update session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete session
 * Note: Uses agent-centric API path
 */
export async function deleteSession(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete session: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Session Messages
// ============================================================================

/**
 * Get session messages (rollout format)
 * Note: Uses agent-centric API path
 */
export async function getSessionMessages(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<SessionMessage[]> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get session messages: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.messages as SessionMessage[];
}

/**
 * Get session UI messages (for frontend rendering)
 * Note: Uses agent-centric API path
 */
export async function getSessionUIMessages(
  baseUrl: string,
  agentId: string,
  sessionId: string,
  workspacePath?: string
): Promise<UIMessage[]> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);
  const query = params.toString();
  const url = `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/ui-messages${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get session UI messages: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.messages as UIMessage[];
}

/**
 * Append message to session
 * Note: Uses agent-centric API path
 */
export async function appendMessage(
  baseUrl: string,
  agentId: string,
  sessionId: string,
  message: AppendMessageRequest
): Promise<SessionMessage> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to append message: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Clear session messages
 * Note: Uses agent-centric API path
 */
export async function clearSessionMessages(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to clear session messages: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Executor Sessions (Claude Code sessions)
// ============================================================================

/**
 * Discover executor sessions (for compatibility with old gateway API)
 */
export async function discoverExecutorSessions(
  baseUrl: string,
  executorType: string,
  workspacePath: string
): Promise<ExecutorSession[]> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/discover-sessions?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to discover executor sessions: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.sessions as ExecutorSession[];
}

/**
 * List executor sessions
 */
export async function listExecutorSessions(
  baseUrl: string,
  executorType: string,
  workspacePath: string
): Promise<ExecutorSession[]> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/sessions?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list executor sessions: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get executor session UI messages
 */
export async function getExecutorSessionMessages(
  baseUrl: string,
  executorType: string,
  sessionId: string,
  workspacePath: string,
  limit?: number
): Promise<ExecutorUIMessage[]> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);
  if (limit !== undefined) {
    params.set("limit", String(limit));
  }

  const response = await fetch(
    `${baseUrl}/api/executors/${encodeURIComponent(executorType)}/sessions/${encodeURIComponent(sessionId)}/messages?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get executor session messages: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.messages as ExecutorUIMessage[];
}

// ============================================================================
// Backward Compatibility - Agent-Centric Methods (for old gateway API)
// ============================================================================

/**
 * List all file-based sessions for an agent (backward compatibility)
 * @param agentId - Agent ID
 * @param workspacePath - Optional workspace path to find workspace agents
 */
export async function listAgentSessions(
  baseUrl: string,
  agentId: string,
  workspacePath?: string
): Promise<FileSession[]> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);
  const query = params.toString();
  const url = `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list sessions: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.sessions as FileSession[];
}

/**
 * Create a new file-based session (backward compatibility)
 */
export async function createAgentSession(
  baseUrl: string,
  agentId: string,
  request?: CreateFileSessionRequest
): Promise<FileSession> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions`,
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
      `Failed to create session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get a file-based session by ID (backward compatibility)
 */
export async function getAgentSession(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<FileSession> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete a file-based session (backward compatibility)
 */
export async function deleteAgentSession(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete session: ${errorMessage}`,
      response.status
    );
  }
}

/**
 * List all messages in a session (rollout format) (backward compatibility)
 */
export async function listSessionMessages(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<SessionMessage[]> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list messages: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.messages as SessionMessage[];
}

/**
 * List all UI messages in a session (for frontend rendering) (backward compatibility)
 * @param agentId - Agent ID
 * @param sessionId - Session ID
 * @param workspacePath - Optional workspace path to find workspace agents
 */
export async function listSessionUIMessages(
  baseUrl: string,
  agentId: string,
  sessionId: string,
  workspacePath?: string
): Promise<UIMessage[]> {
  const params = new URLSearchParams();
  if (workspacePath) params.set("workspace_path", workspacePath);
  const query = params.toString();
  const url = `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/ui-messages${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list UI messages: ${errorMessage}`,
      response.status
    );
  }

  const data = await response.json();
  return data.messages as UIMessage[];
}

/**
 * Append a message to a session (backward compatibility)
 */
export async function appendSessionMessage(
  baseUrl: string,
  agentId: string,
  sessionId: string,
  message: AppendMessageRequest
): Promise<SessionMessage> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to append message: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}
