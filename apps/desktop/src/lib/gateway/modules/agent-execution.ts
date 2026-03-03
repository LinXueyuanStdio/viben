/**
 * Agent Execution Module - SSE Streaming
 * 智能体执行模块 - SSE 流
 */

import { GatewayError } from "../error";
import { parseErrorMessage } from "./core";
import type {
  SpawnAgentRequest,
  ExecutorType,
  BackgroundTask,
  SSEMessageEvent,
} from "../types";

// ============================================================================
// Agent Execution
// ============================================================================

/**
 * Spawn agent and get SSE stream
 * Returns an async generator that yields SSE events
 */
export async function* spawnAgentStream(
  baseUrl: string,
  agentType: ExecutorType,
  request: SpawnAgentRequest,
  signal?: AbortSignal
): AsyncGenerator<SSEMessageEvent, void, unknown> {
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

  if (!response.body) {
    throw new GatewayError("No response body for SSE stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const event = JSON.parse(data) as SSEMessageEvent;
            yield event;
          } catch {
            // Skip invalid JSON
            console.warn("[GatewayClient] Invalid SSE data:", data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Continue session with SSE stream
 * Returns an async generator that yields SSE events
 */
export async function* continueSessionStream(
  baseUrl: string,
  agentType: ExecutorType,
  sessionId: string,
  prompt: string,
  resetToMessageId?: string,
  signal?: AbortSignal
): AsyncGenerator<SSEMessageEvent, void, unknown> {
  const response = await fetch(
    `${baseUrl}/api/agents/${encodeURIComponent(agentType)}/continue`,
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

  if (!response.body) {
    throw new GatewayError("No response body for SSE stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            return;
          }
          try {
            const event = JSON.parse(data) as SSEMessageEvent;
            yield event;
          } catch {
            console.warn("[GatewayClient] Invalid SSE data:", data);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stop a running agent
 */
export async function stopAgent(
  baseUrl: string,
  _agentType: ExecutorType,
  sessionId: string
): Promise<void> {
  const response = await fetch(
    `${baseUrl}/api/agent/stop/${encodeURIComponent(sessionId)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorMessage(response);
    throw new GatewayError(
      `Failed to stop agent: ${errorMessage}`,
      response.status
    );
  }
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
 * Subscribe to background task updates (SSE)
 * Returns an EventSource-like interface
 */
export function subscribeToBackgroundTasks(
  baseUrl: string,
  onTasks: (tasks: BackgroundTask[]) => void,
  onError?: (error: Error) => void
): { close: () => void } {
  const eventSource = new EventSource(`${baseUrl}/api/agent/tasks/subscribe`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "tasks") {
        onTasks(data.tasks);
      }
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  };

  eventSource.onerror = () => {
    onError?.(new Error("SSE connection error"));
  };

  return {
    close: () => eventSource.close(),
  };
}

/**
 * Stop background task
 */
export async function stopBackgroundTask(
  baseUrl: string,
  taskId: string
): Promise<{ success: boolean; taskId: string }> {
  const response = await fetch(
    `${baseUrl}/api/agent/tasks/${encodeURIComponent(taskId)}/stop`,
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
