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

  const response = await fetch(
    `${baseUrl}/api/sessions/agent/${encodeURIComponent(agentId)}?${params.toString()}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list sessions: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get session by ID
 */
export async function getSession(
  baseUrl: string,
  sessionId: string
): Promise<FileSession | null> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`,
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
  request: CreateFileSessionRequest
): Promise<FileSession> {
  const response = await fetch(
    `${baseUrl}/api/sessions/agent/${encodeURIComponent(agentId)}`,
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
      `Failed to create session: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Update session metadata
 */
export async function updateSession(
  baseUrl: string,
  sessionId: string,
  updates: Partial<Pick<FileSession, "status" | "metadata">>
): Promise<FileSession> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`,
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
 */
export async function deleteSession(
  baseUrl: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`,
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
 */
export async function getSessionMessages(
  baseUrl: string,
  sessionId: string
): Promise<SessionMessage[]> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
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

  return response.json();
}

/**
 * Get session UI messages (for frontend rendering)
 */
export async function getSessionUIMessages(
  baseUrl: string,
  sessionId: string
): Promise<UIMessage[]> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/ui-messages`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to get session UI messages: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Append message to session
 */
export async function appendMessage(
  baseUrl: string,
  sessionId: string,
  message: AppendMessageRequest
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
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
}

/**
 * Clear session messages
 */
export async function clearSessionMessages(
  baseUrl: string,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages`,
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
  workspacePath: string
): Promise<ExecutorUIMessage[]> {
  const params = new URLSearchParams();
  params.set("workspace_path", workspacePath);

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

  return response.json();
}
