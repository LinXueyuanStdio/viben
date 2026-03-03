/**
 * Sessions Module - File-based Session Management
 * 会话模块 - 基于文件的会话管理
 */

import { GatewayError } from "../error";
import { parseErrorMessage, buildUrl } from "./core";
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
  const url = buildUrl(
    baseUrl,
    `/api/agents/${encodeURIComponent(agentId)}/sessions`,
    { workspacePath }
  );

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
  const url = buildUrl(
    baseUrl,
    `/api/agents/${encodeURIComponent(agentId)}/sessions/${encodeURIComponent(sessionId)}/ui-messages`,
    { workspacePath }
  );

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
  const url = buildUrl(
    baseUrl,
    `/api/executors/${encodeURIComponent(executorType)}/discover-sessions`,
    { workspacePath }
  );

  const response = await fetch(url,
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
  const url = buildUrl(
    baseUrl,
    `/api/executors/${encodeURIComponent(executorType)}/sessions`,
    { workspacePath }
  );

  const response = await fetch(url,
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
  const url = buildUrl(
    baseUrl,
    `/api/executors/${encodeURIComponent(executorType)}/sessions/${encodeURIComponent(sessionId)}/messages`,
    { workspacePath, params: { limit } }
  );

  const response = await fetch(url,
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
// These methods delegate to the primary implementations above.
// ============================================================================

/**
 * List all file-based sessions for an agent
 * @deprecated Use {@link listSessions} instead. This is an alias for backward compatibility.
 * @param baseUrl - Gateway base URL
 * @param agentId - Agent ID
 * @param workspacePath - Optional workspace path to find workspace agents
 */
export async function listAgentSessions(
  baseUrl: string,
  agentId: string,
  workspacePath?: string
): Promise<FileSession[]> {
  return listSessions(baseUrl, agentId, workspacePath);
}

/**
 * Create a new file-based session
 * @deprecated Use {@link createSession} instead. This is an alias for backward compatibility.
 * @param baseUrl - Gateway base URL
 * @param agentId - Agent ID
 * @param request - Optional session creation request
 */
export async function createAgentSession(
  baseUrl: string,
  agentId: string,
  request?: CreateFileSessionRequest
): Promise<FileSession> {
  return createSession(baseUrl, agentId, request);
}

/**
 * Get a file-based session by ID
 * @deprecated Use {@link getSession} instead. This is an alias for backward compatibility.
 * Note: Unlike getSession which returns null for 404, this throws an error.
 * @param baseUrl - Gateway base URL
 * @param agentId - Agent ID
 * @param sessionId - Session ID
 */
export async function getAgentSession(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<FileSession> {
  const session = await getSession(baseUrl, agentId, sessionId);
  if (!session) {
    throw new GatewayError(`Session not found: ${sessionId}`, 404);
  }
  return session;
}

/**
 * Delete a file-based session
 * @deprecated Use {@link deleteSession} instead. This is an alias for backward compatibility.
 * @param baseUrl - Gateway base URL
 * @param agentId - Agent ID
 * @param sessionId - Session ID
 */
export async function deleteAgentSession(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<void> {
  return deleteSession(baseUrl, agentId, sessionId);
}

/**
 * List all messages in a session (rollout format)
 * @deprecated Use {@link getSessionMessages} instead. This is an alias for backward compatibility.
 * @param baseUrl - Gateway base URL
 * @param agentId - Agent ID
 * @param sessionId - Session ID
 */
export async function listSessionMessages(
  baseUrl: string,
  agentId: string,
  sessionId: string
): Promise<SessionMessage[]> {
  return getSessionMessages(baseUrl, agentId, sessionId);
}

/**
 * List all UI messages in a session (for frontend rendering)
 * @deprecated Use {@link getSessionUIMessages} instead. This is an alias for backward compatibility.
 * @param baseUrl - Gateway base URL
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
  return getSessionUIMessages(baseUrl, agentId, sessionId, workspacePath);
}

/**
 * Append a message to a session
 * @deprecated Use {@link appendMessage} instead. This is an alias for backward compatibility.
 * @param baseUrl - Gateway base URL
 * @param agentId - Agent ID
 * @param sessionId - Session ID
 * @param message - Message to append
 */
export async function appendSessionMessage(
  baseUrl: string,
  agentId: string,
  sessionId: string,
  message: AppendMessageRequest
): Promise<SessionMessage> {
  return appendMessage(baseUrl, agentId, sessionId, message);
}
