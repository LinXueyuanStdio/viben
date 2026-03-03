/**
 * Agent Execution Module - SSE Streaming
 * 智能体执行模块 - SSE 流
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  SpawnAgentRequest,
  SpawnAgentResponse,
  SSEMessageEvent,
  ExecutorType,
  ExecutorConfig,
  BackgroundTask,
} from "../types";

// ============================================================================
// Agent Execution
// ============================================================================

/**
 * Spawn agent and get SSE stream
 */
export async function spawnAgentStream(
  baseUrl: string,
  agentType: ExecutorType,
  request: SpawnAgentRequest,
  signal?: AbortSignal
): Promise<Response> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}/spawn`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      signal,
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to spawn agent: ${errorMessage}`,
      response.status
    );
  }

  return response;
}

/**
 * Continue session with SSE stream
 */
export async function continueSessionStream(
  baseUrl: string,
  agentType: ExecutorType,
  sessionId: string,
  prompt: string,
  resetToMessageId?: string,
  signal?: AbortSignal
): Promise<Response> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}/sessions/${encodeURIComponent(sessionId)}/continue`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        prompt,
        session_id: sessionId,
        reset_to_message_id: resetToMessageId,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to continue session: ${errorMessage}`,
      response.status
    );
  }

  return response;
}

/**
 * Stop a running agent
 */
export async function stopAgent(
  baseUrl: string,
  agentType: ExecutorType,
  sessionId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}/sessions/${encodeURIComponent(sessionId)}/stop`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop agent: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Send input to agent (for interactive questions)
 */
export async function sendAgentInput(
  baseUrl: string,
  agentType: ExecutorType,
  sessionId: string,
  questionId: string,
  answers: Record<string, string>
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}/sessions/${encodeURIComponent(sessionId)}/input`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        question_id: questionId,
        answers,
      }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to send input: ${errorMessage}`,
      response.status
    );
  }
}

// ============================================================================
// Background Task Management
// ============================================================================

/**
 * List background tasks
 */
export async function listBackgroundTasks(
  baseUrl: string
): Promise<BackgroundTask[]> {
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to list background tasks: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Get background task by ID
 */
export async function getBackgroundTask(
  baseUrl: string,
  taskId: string
): Promise<BackgroundTask | null> {
  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`,
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
      `Failed to get background task: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Stop background task
 */
export async function stopBackgroundTask(
  baseUrl: string,
  taskId: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}/stop`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop background task: ${errorMessage}`,
      response.status
    );
  }

  return response.json();
}

/**
 * Delete background task
 */
export async function deleteBackgroundTask(
  baseUrl: string,
  taskId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
      headers: { Accept: "application/json" },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to delete background task: ${errorMessage}`,
      response.status
    );
  }
}
