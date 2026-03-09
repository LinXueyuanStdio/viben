/**
 * useAgentConversation Hook - SSE Conversation State Management
 *
 * Manages SSE streaming conversation with AI agents via Gateway.
 * Handles message state, tool usage, plans, and interactive questions.
 * Falls back to mock implementation when Gateway is unavailable.
 *
 * Features:
 * - Auto-move running tasks to background when switching tasks
 * - Restore AbortController when returning to background tasks
 * - Message polling for background tasks
 */

import { useCallback, useState, useRef, useMemo, useEffect } from "react";
import type {
  AgentMessage,
  AgentPhase,
  MessageAttachment,
  TaskPlan,
  PendingQuestion,
  Artifact,
  ToolUsage,
} from "@/types";
import type { ExecutorType } from "@viben/core/shared";
import { getGatewayClient, getGatewayUrl } from "@/lib/gateway";
import type { SandboxConfig } from "@/hooks/use-sandbox";
import {
  addBackgroundTask,
  getBackgroundTask,
  removeBackgroundTask,
  updateBackgroundTaskStatus,
} from "@/lib/background-tasks";
import i18n from "@/i18n";

/**
 * Generate a unique ID
 */
const generateId = () => crypto.randomUUID();

/**
 * Generate a task ID for message persistence
 * Format: task_${Date.now()}_${random}
 */
const generateTaskId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * File size limits for artifact preview
 */
const MAX_PREVIEW_SIZE = 50000; // 50KB max preview content
const LARGE_FILE_THRESHOLD = 100000; // 100KB - files larger than this are marked as "too large"

/**
 * Mock delay for fallback implementation
 */
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SSE message data from /api/agent/run endpoint
 */
interface SSEMessageData {
  type: "session" | "sdk_session" | "text" | "tool_use" | "tool_result" | "plan" | "question" | "result" | "error" | "done" | "pong";
  // session
  sessionId?: string;
  /** Trace ID for observability correlation (sent with session message) */
  traceId?: string;
  // sdk_session - The SDK's internal session ID for resume
  sdkSessionId?: string;
  // text
  content?: string;
  // tool_use
  id?: string;
  name?: string;
  input?: unknown;
  // tool_result
  toolUseId?: string;
  output?: string;
  isError?: boolean;
  // plan
  plan?: {
    id: string;
    goal: string;
    steps: Array<{ id: string; description: string; status: string }>;
    notes?: string;
  };
  // question
  questions?: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description?: string }>;
    multiSelect: boolean;
  }>;
  // result
  cost?: number;
  duration?: number;
  subtype?: string;
  // error
  message?: string;
}

/**
 * Agent configuration passed to the backend (inline config)
 */
export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  appendPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  executorType?: string;
  mcpServers?: string[];
  skills?: string[];
  planMode?: boolean;
  approvals?: boolean;
}

/**
 * Agent conversation hook options
 */
export interface UseAgentConversationOptions {
  /** Path to agent AGENTS.md config file (preferred, backend reads from disk) */
  agentConfigPath?: string;
  /** Inline agent configuration (fallback if agentConfigPath not provided) */
  agentConfig?: AgentConfig;
  /** Enable mock mode (for testing) */
  mockMode?: boolean;
  /** File system session ID for persistence */
  sessionId?: string;
  /** File system task ID for persistence */
  taskId?: string;
  /** Sandbox configuration (session-level) */
  sandboxConfig?: SandboxConfig;
  /** Use WebSocket mode for bidirectional communication (supports AskUserQuestion) */
  useWebSocket?: boolean;
}

/**
 * Agent conversation hook for workspace chat
 * Manages SSE streaming conversation with AI agents via Gateway
 */
export function useAgentConversation(workspaceId: string, options?: UseAgentConversationOptions) {
  const {
    agentConfigPath,
    agentConfig,
    mockMode = false,
    sessionId: persistSessionId,
    taskId: persistTaskId,
    sandboxConfig,
    useWebSocket = false,
  } = options || {};

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [toolUsages, setToolUsages] = useState<ToolUsage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // SDK session ID - The SDK's internal session ID for resume (different from gateway sessionId)
  const [sdkSessionId, setSdkSessionId] = useState<string | null>(null);
  // Trace ID for observability correlation
  const [traceId, setTraceId] = useState<string | null>(null);
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const client = useMemo(() => getGatewayClient(), []);

  // Track current streaming message ID for text accumulation
  const streamingMessageIdRef = useRef<string | null>(null);

  // Track active task ID for background task management
  const activeTaskIdRef = useRef<string | null>(persistTaskId || null);
  const isRunningRef = useRef(false);
  const initialPromptRef = useRef<string>("");

  // Polling interval for background tasks
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check Gateway connection on mount
  useEffect(() => {
    if (!mockMode) {
      checkGatewayConnection();
    }
  }, [mockMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Check Gateway connection with auto-discovery
   */
  const checkGatewayConnection = useCallback(async () => {
    try {
      // First try auto-discovery which will update the client's URL if needed
      const connected = await client.autoDiscover();
      setGatewayConnected(connected);
      if (connected) {
        console.log("[useAgent] Gateway connected at:", client.getBaseUrl());
      }
      return connected;
    } catch {
      setGatewayConnected(false);
      return false;
    }
  }, [client]);

  /**
   * Handle SSE message from /api/agent/run endpoint
   */
  const handleSSEMessage = useCallback((data: SSEMessageData) => {
    console.log("[useAgent] SSE message:", data);

    switch (data.type) {
      case "session":
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        // Capture trace ID for observability
        if (data.traceId) {
          setTraceId(data.traceId);
          console.log("[useAgent] Got trace ID:", data.traceId);
        }
        break;

      case "sdk_session":
        // SDK's internal session ID for resume functionality
        // This is different from the gateway session ID
        if (data.sdkSessionId) {
          console.log("[useAgent] Got SDK session ID:", data.sdkSessionId);
          setSdkSessionId(data.sdkSessionId);
        }
        break;

      case "text":
        // Streaming text: append to existing message or create new one
        if (data.content) {
          // Get current streaming ID before setState (for consistency)
          const currentStreamId = streamingMessageIdRef.current;

          if (currentStreamId) {
            // Append to existing streaming message
            setMessages((prev) => {
              const existingIndex = prev.findIndex(
                (m) => m.id === currentStreamId && m.type === "text"
              );
              if (existingIndex !== -1) {
                // Create new array with updated message
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  content: (updated[existingIndex].content || "") + data.content,
                };
                console.log("[useAgent] Updated text message, total messages:", updated.length);
                return updated;
              }
              // Streaming ID exists but message not found (edge case)
              // Create new message
              const newId = generateId();
              streamingMessageIdRef.current = newId;
              console.log("[useAgent] Created new text message (edge case), total:", prev.length + 1);
              return [...prev, { id: newId, type: "text", content: data.content }];
            });
          } else {
            // Create new streaming message
            const newId = generateId();
            streamingMessageIdRef.current = newId;
            setMessages((prev) => {
              console.log("[useAgent] Created new streaming message, total:", prev.length + 1);
              return [
                ...prev,
                { id: newId, type: "text", content: data.content },
              ];
            });
          }
        }
        break;

      case "tool_use": {
        // End current text streaming when tool use starts
        streamingMessageIdRef.current = null;

        const toolId = data.id || generateId();
        const toolInput = (data.input || {}) as Record<string, unknown>;
        const toolMsg: AgentMessage = {
          id: toolId,
          type: "tool_use",
          name: data.name || "unknown",
          toolUseId: data.id,
          input: toolInput,
        };
        setMessages((prev) => [...prev, toolMsg]);

        const toolUsage: ToolUsage = {
          id: toolId,
          toolUseId: data.id,
          name: data.name || "unknown",
          displayName: data.name || "Unknown Tool",
          input: toolInput,
          timestamp: Date.now(),
        };
        setToolUsages((prev) => [...prev, toolUsage]);
        break;
      }

      case "tool_result": {
        // Reset streaming ID so next text creates a new message
        streamingMessageIdRef.current = null;

        const resultMsg: AgentMessage = {
          id: generateId(),
          type: "tool_result",
          toolUseId: data.toolUseId || "",
          output: data.output || "",
          isError: data.isError,
        };
        setMessages((prev) => [...prev, resultMsg]);

        // Update tool usage to mark as completed
        if (data.toolUseId) {
          setToolUsages((prev) =>
            prev.map((t) =>
              t.toolUseId === data.toolUseId
                ? { ...t, output: resultMsg.output, completedAt: Date.now() }
                : t
            )
          );
        }
        break;
      }

      case "plan": {
        if (data.plan) {
          const planMsg: AgentMessage = {
            id: generateId(),
            type: "plan",
            plan: {
              id: data.plan.id, // Preserve plan ID for approval/rejection
              goal: data.plan.goal,
              steps: data.plan.steps.map((s) => ({
                id: s.id,
                description: s.description,
                status: s.status as "pending" | "in_progress" | "completed" | "failed" | "cancelled",
              })),
              notes: data.plan.notes,
            },
          };
          setMessages((prev) => [...prev, planMsg]);
          setPendingPlan(planMsg.plan as TaskPlan);
          setPhase("awaiting_approval");
        }
        break;
      }

      case "question": {
        if (data.questions) {
          const pendingQ: PendingQuestion = {
            id: data.id || generateId(),
            questions: data.questions,
          };
          setPendingQuestions(pendingQ);
          setPhase("awaiting_input");
          // Stop streaming - agent is waiting for user input
          // The stream will be continued via answerQuestions -> sendMessage
          setIsStreaming(false);
          streamingMessageIdRef.current = null;
          console.log("[useAgent] Question received, pausing for user input");
        }
        break;
      }

      case "result":
        // End text streaming on result
        streamingMessageIdRef.current = null;
        setPhase("completed");
        setIsStreaming(false);
        break;

      case "error": {
        // End text streaming on error
        streamingMessageIdRef.current = null;

        const errMsg: AgentMessage = {
          id: generateId(),
          type: "error",
          message: data.message || i18n.t("common.unknownError"),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setError(data.message || i18n.t("common.unknownError"));
        setPhase("error");
        setIsStreaming(false);
        break;
      }

      case "done":
        // End text streaming on done
        streamingMessageIdRef.current = null;
        setIsStreaming(false);
        // Use functional update to check current phase value (avoids stale closure)
        setPhase((currentPhase) => currentPhase === "running" ? "completed" : currentPhase);
        break;
    }
  }, []);

  // ============================================================================
  // WebSocket Mode Implementation
  // ============================================================================

  // Track WebSocket reconnection attempts
  const wsReconnectAttemptsRef = useRef(0);
  const wsReconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsHeartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_MS = 2000;
  const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

  /**
   * Start heartbeat to keep connection alive
   */
  const startHeartbeat = useCallback(() => {
    // Clear any existing heartbeat
    if (wsHeartbeatIntervalRef.current) {
      clearInterval(wsHeartbeatIntervalRef.current);
    }

    wsHeartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Send ping message (empty object as heartbeat)
        try {
          wsRef.current.send(JSON.stringify({ type: "ping" }));
        } catch {
          // Ignore heartbeat errors
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (wsHeartbeatIntervalRef.current) {
      clearInterval(wsHeartbeatIntervalRef.current);
      wsHeartbeatIntervalRef.current = null;
    }
  }, []);

  // Track pending connection promise to avoid duplicate connections
  const wsConnectPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Connect to the WebSocket agent endpoint
   * Returns a Promise that resolves when connected or rejects on error
   */
  const connectWebSocket = useCallback((): Promise<void> => {
    // Already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Connection in progress - return existing promise
    if (wsRef.current?.readyState === WebSocket.CONNECTING && wsConnectPromiseRef.current) {
      return wsConnectPromiseRef.current;
    }

    const gatewayUrl = getGatewayUrl();
    // Convert http(s) to ws(s)
    const wsUrl = gatewayUrl.replace(/^http/, "ws");

    // Build query params
    const params = new URLSearchParams();
    if (workspaceId) params.set("cwd", workspaceId);
    if (agentConfigPath) params.set("agentConfigPath", agentConfigPath);
    if (persistSessionId) params.set("sessionId", persistSessionId);
    if (persistTaskId) params.set("taskId", persistTaskId);

    const url = `${wsUrl}/ws/agent/run?${params.toString()}`;
    console.log("[useAgent] Connecting WebSocket to:", url);

    // Create connection promise
    const connectPromise = new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"));
          ws.close();
        }, 10000); // 10 second timeout

        ws.onopen = () => {
          clearTimeout(timeout);
          console.log("[useAgent] WebSocket connected");
          wsReconnectAttemptsRef.current = 0;
          setGatewayConnected(true);
          startHeartbeat();
          wsConnectPromiseRef.current = null;
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as SSEMessageData;
            // Ignore pong messages (heartbeat response)
            if (data.type === "pong") return;
            handleSSEMessage(data);
          } catch (e) {
            console.warn("[useAgent] Failed to parse WebSocket message:", e);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error("[useAgent] WebSocket error:", error);
          setError("WebSocket connection error");
          stopHeartbeat();
          wsConnectPromiseRef.current = null;
          reject(new Error("WebSocket connection error"));
        };

        ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log("[useAgent] WebSocket closed:", event.code, event.reason);
          stopHeartbeat();
          wsConnectPromiseRef.current = null;

          // Attempt to reconnect if not intentionally closed
          if (
            event.code !== 1000 &&
            wsReconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
          ) {
            wsReconnectAttemptsRef.current++;
            console.log(
              `[useAgent] Attempting reconnect (${wsReconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
            );

            wsReconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket().catch(() => {
                // Reconnect failures are logged in the function
              });
            }, RECONNECT_DELAY_MS * wsReconnectAttemptsRef.current);
          } else if (wsReconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
            setError("WebSocket connection failed after multiple attempts");
            setGatewayConnected(false);
          }
        };
      } catch (e) {
        console.error("[useAgent] Failed to create WebSocket:", e);
        setGatewayConnected(false);
        wsConnectPromiseRef.current = null;
        reject(e);
      }
    });

    wsConnectPromiseRef.current = connectPromise;
    return connectPromise;
  }, [workspaceId, agentConfigPath, persistSessionId, persistTaskId, handleSSEMessage, startHeartbeat, stopHeartbeat]);

  /**
   * Disconnect WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    if (wsReconnectTimeoutRef.current) {
      clearTimeout(wsReconnectTimeoutRef.current);
      wsReconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }
  }, []);

  /**
   * Send a message via WebSocket
   */
  const sendWebSocketMessage = useCallback(
    (message: {
      type: "start" | "answer" | "approve" | "reject" | "cancel";
      prompt?: string;
      agentConfig?: AgentConfig;
      questionId?: string;
      answers?: Record<string, string>;
      planId?: string;
    }) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("[useAgent] WebSocket not connected");
        setError("WebSocket not connected");
        return false;
      }

      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (e) {
        console.error("[useAgent] Failed to send WebSocket message:", e);
        setError(i18n.t("errors.conversation.sendMessageFailed"));
        return false;
      }
    },
    []
  );

  /**
   * Send a message to the agent via WebSocket
   */
  const sendMessageWebSocket = useCallback(
    async (content: string, _attachments?: MessageAttachment[]) => {
      if (!content.trim()) return;

      console.log("[useAgent] sendMessageWebSocket called with:", content.slice(0, 50));

      // Reset streaming state for new message
      streamingMessageIdRef.current = null;

      // Track running state
      isRunningRef.current = true;
      initialPromptRef.current = content;

      setError(null);
      setPhase("running");
      setIsStreaming(true);

      // Add user message
      const userMessage: AgentMessage = {
        id: generateId(),
        type: "user",
        content,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Ensure WebSocket is connected (connectWebSocket returns Promise and handles deduplication)
      try {
        await connectWebSocket();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed");
        setPhase("error");
        setIsStreaming(false);
        return;
      }

      // Send start message
      const success = sendWebSocketMessage({
        type: "start",
        prompt: content,
        agentConfig: agentConfigPath ? undefined : agentConfig,
      });

      if (!success) {
        const errMsg: AgentMessage = {
          id: generateId(),
          type: "error",
          message: i18n.t("errors.conversation.sendMessageFailed"),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setPhase("error");
        setIsStreaming(false);
      }
    },
    [agentConfigPath, agentConfig, connectWebSocket, sendWebSocketMessage]
  );

  /**
   * Answer questions via WebSocket
   */
  const answerQuestionsWebSocket = useCallback(
    (answers: Record<string, string[]>) => {
      if (!pendingQuestions) return;

      const questionId = pendingQuestions.id;
      setPendingQuestions(null);
      setPhase("running");
      setIsStreaming(true);

      // Convert answers from string[] to string format
      const flatAnswers: Record<string, string> = {};
      for (const [key, values] of Object.entries(answers)) {
        flatAnswers[key] = values.join(", ");
      }

      // Send answer via WebSocket
      sendWebSocketMessage({
        type: "answer",
        questionId,
        answers: flatAnswers,
      });
    },
    [pendingQuestions, sendWebSocketMessage]
  );

  /**
   * Approve plan via WebSocket
   */
  const approvePlanWebSocket = useCallback(() => {
    if (!pendingPlan) return;

    const planId = pendingPlan.id;
    if (!planId) {
      console.error("[useAgent] Cannot approve plan: missing plan ID");
      return;
    }

    setPendingPlan(null);
    setPhase("running");
    setIsStreaming(true);

    sendWebSocketMessage({
      type: "approve",
      planId,
    });
  }, [pendingPlan, sendWebSocketMessage]);

  /**
   * Reject plan via WebSocket
   */
  const rejectPlanWebSocket = useCallback(() => {
    if (!pendingPlan) return;

    const planId = pendingPlan.id;
    if (!planId) {
      console.error("[useAgent] Cannot reject plan: missing plan ID");
      return;
    }

    setPendingPlan(null);

    sendWebSocketMessage({
      type: "reject",
      planId,
    });

    // Update UI
    setMessages((prev) =>
      prev.map((m) => {
        if (m.type === "plan" && m.plan) {
          const updatedSteps = m.plan.steps.map((step) => ({
            ...step,
            status: "cancelled" as const,
          }));
          return { ...m, plan: { ...m.plan, steps: updatedSteps } };
        }
        return m;
      })
    );

    const textMessage: AgentMessage = {
      id: generateId(),
      type: "text",
      content: "Plan rejected. How would you like me to proceed?",
    };
    setMessages((prev) => [...prev, textMessage]);
    setPhase("idle");
  }, [pendingPlan, sendWebSocketMessage]);

  /**
   * Cancel via WebSocket
   */
  const cancelWebSocket = useCallback(() => {
    sendWebSocketMessage({ type: "cancel" });

    setPendingPlan(null);
    setPendingQuestions(null);
    setIsStreaming(false);
    setPhase("idle");
  }, [sendWebSocketMessage]);

  // Connect WebSocket on mount if useWebSocket is enabled
  useEffect(() => {
    if (useWebSocket && !mockMode) {
      connectWebSocket();
    }

    return () => {
      if (useWebSocket) {
        disconnectWebSocket();
      }
    };
  }, [useWebSocket, mockMode, connectWebSocket, disconnectWebSocket]);

  // ============================================================================
  // SSE Mode Implementation
  // ============================================================================

  /**
   * Send a message to the agent (real Gateway implementation using SSE)
   */
  const sendMessageReal = useCallback(
    async (content: string, _attachments?: MessageAttachment[]) => {
      if (!content.trim()) return;

      console.log("[useAgent] sendMessageReal called with:", content.slice(0, 50));

      // Reset streaming state for new message
      streamingMessageIdRef.current = null;

      // Track running state for background task management
      isRunningRef.current = true;
      initialPromptRef.current = content;

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setError(null);
      setPhase("running");
      setIsStreaming(true);

      console.log("[useAgent] State set: phase=running, isStreaming=true");

      // Add user message
      const userMessage: AgentMessage = {
        id: generateId(),
        type: "user",
        content,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        // Use the new SSE endpoint /api/agent/run
        const gatewayUrl = getGatewayUrl();
        const url = `${gatewayUrl}/api/agent/run`;

        console.log("[useAgent] Starting SSE connection to:", url);

        // Build request body
        // Prefer agentConfigPath (backend reads config from disk), fallback to inline agentConfig
        // workspaceId is actually workspace path, use it as cwd
        // Generate taskId for each conversation turn if sessionId is provided
        const currentTaskId = persistSessionId ? (persistTaskId || generateTaskId()) : undefined;
        // Track the active task ID for background task management
        if (currentTaskId) {
          activeTaskIdRef.current = currentTaskId;
        }

        const requestBody: Record<string, unknown> = {
          prompt: content,
          agent_config_path: agentConfigPath || undefined,
          agent_config: agentConfigPath ? undefined : (agentConfig || undefined),
          // Session persistence: pass session/task IDs for backend to persist messages
          session_id: persistSessionId || undefined,
          task_id: currentTaskId,
          // Resume from existing SDK session for multi-turn conversations
          // Use sdkSessionId (from sdk_session message) which is the Claude Agent SDK's internal session ID
          // This is required for multi-turn conversations to work correctly
          resume: sdkSessionId || undefined,
          // Sandbox configuration (session-level)
          sandbox_config: sandboxConfig?.enabled ? {
            enabled: true,
            provider: sandboxConfig.provider,
          } : undefined,
        };
        if (workspaceId) {
          requestBody.cwd = workspaceId;
        }

        console.log("[useAgent] Request body:", requestBody);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                handleSSEMessage(data);
              } catch (e) {
                console.warn("[useAgent] Failed to parse SSE data:", line, e);
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.startsWith("data: ")) {
          try {
            const data = JSON.parse(buffer.slice(6));
            handleSSEMessage(data);
          } catch {
            // Ignore parse errors on final buffer
          }
        }

        // Stream ended - the handleSSEMessage callback handles all state transitions
        // (error, result, done events) so we only need to ensure streaming is stopped
        console.log("[useAgent] Stream completed successfully");
        isRunningRef.current = false;

        // Update background task status if exists
        if (activeTaskIdRef.current) {
          updateBackgroundTaskStatus(activeTaskIdRef.current, false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : i18n.t("common.unknownError");
        console.error("[useAgent] Error:", errorMessage);
        setError(errorMessage);
        isRunningRef.current = false;

        const errMsg: AgentMessage = {
          id: generateId(),
          type: "error",
          message: i18n.t("errors.conversation.startAgentFailed", { error: errorMessage }),
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setPhase("error");
        setIsStreaming(false);

        // Update background task status if exists
        if (activeTaskIdRef.current) {
          updateBackgroundTaskStatus(activeTaskIdRef.current, false);
        }
      }
    },
    [agentConfigPath, agentConfig, workspaceId, handleSSEMessage, phase, persistSessionId, persistTaskId, sandboxConfig, sdkSessionId]
  );

  /**
   * Send a message (mock implementation for fallback)
   */
  const sendMessageMock = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) {
        return;
      }

      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setError(null);
      setPhase("running");
      setIsStreaming(true);

      // Add user message
      const userMessage: AgentMessage = {
        id: generateId(),
        type: "user",
        content,
        attachments,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        await mockDelay(500);

        // Simulate different responses based on content
        if (content.toLowerCase().includes("plan")) {
          const plan: TaskPlan = {
            goal: `Execute task: ${content}`,
            steps: [
              { id: "1", description: "Analyze the request", status: "pending" },
              { id: "2", description: "Search for relevant information", status: "pending" },
              { id: "3", description: "Generate response", status: "pending" },
            ],
            notes: "This is a mock plan for demonstration purposes.",
          };

          const planMessage: AgentMessage = {
            id: generateId(),
            type: "plan",
            plan,
          };
          setMessages((prev) => [...prev, planMessage]);
          setPendingPlan(plan);
          setPhase("awaiting_approval");
        } else if (content.toLowerCase().includes("question")) {
          const questions: PendingQuestion = {
            id: generateId(),
            questions: [
              {
                header: "Configuration Required",
                question: "Which option would you like to use?",
                options: [
                  { label: "Option A", description: "Use default settings" },
                  { label: "Option B", description: "Use custom settings" },
                  { label: "Option C", description: "Skip this step" },
                ],
                multiSelect: false,
              },
            ],
          };
          setPendingQuestions(questions);
          setPhase("awaiting_input");
        } else if (content.toLowerCase().includes("tool")) {
          const thinkingMessage: AgentMessage = {
            id: generateId(),
            type: "text",
            content: "I'll search for documents matching your query.",
          };
          setMessages((prev) => [...prev, thinkingMessage]);
          await mockDelay(300);

          const toolMessageId = generateId();
          const toolUseMessage: AgentMessage = {
            id: toolMessageId,
            type: "tool_use",
            name: "search_documents",
            input: { query: content, limit: 10 },
          };
          setMessages((prev) => [...prev, toolUseMessage]);

          const toolUsage: ToolUsage = {
            id: toolMessageId,
            name: "search_documents",
            displayName: "Search Documents",
            input: { query: content, limit: 10 },
            timestamp: Date.now(),
          };
          setToolUsages((prev) => [...prev, toolUsage]);

          await mockDelay(1000);

          const toolResultMessage: AgentMessage = {
            id: generateId(),
            type: "tool_result",
            toolUseId: toolUseMessage.id,
            output: JSON.stringify(
              {
                results: [
                  { title: "Document 1", snippet: "This is a sample document..." },
                  { title: "Document 2", snippet: "Another relevant document..." },
                ],
              },
              null,
              2
            ),
          };
          setMessages((prev) => [...prev, toolResultMessage]);

          setToolUsages((prev) =>
            prev.map((t) =>
              t.id === toolUseMessage.id
                ? { ...t, output: toolResultMessage.output }
                : t
            )
          );

          await mockDelay(300);

          const textMessage: AgentMessage = {
            id: generateId(),
            type: "text",
            content:
              "I found **2 relevant documents** based on your query.\n\n- Document 1: This is a sample document...\n- Document 2: Another relevant document...\n\nWould you like me to elaborate on any of them?",
          };
          setMessages((prev) => [...prev, textMessage]);
          setPhase("completed");
        } else if (content.toLowerCase().includes("error")) {
          throw new Error("This is a simulated error for testing purposes.");
        } else {
          const responseContent = `I received your message: "${content}"

This is a **mock response** (Gateway not connected). In a real implementation, this would be connected to an actual AI agent backend.

The workspace ID for this session is: \`${workspaceId}\`

> Connect to Gateway at ${getGatewayUrl()} for real agent execution.`;

          const textMessage: AgentMessage = {
            id: generateId(),
            type: "text",
            content: responseContent,
          };
          setMessages((prev) => [...prev, textMessage]);
          setPhase("completed");
        }
      } catch (err) {
        const errorMessage: AgentMessage = {
          id: generateId(),
          type: "error",
          message: err instanceof Error ? err.message : i18n.t("common.unknownError"),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setError(errorMessage.message ?? i18n.t("common.unknownError"));
        setPhase("error");
      } finally {
        setIsStreaming(false);
      }
    },
    [workspaceId]
  );

  /**
   * Send a message - decides between WebSocket, SSE, and mock implementation
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      if (mockMode) {
        return sendMessageMock(content, attachments);
      }

      // Use WebSocket if enabled
      if (useWebSocket) {
        return sendMessageWebSocket(content, attachments);
      }

      // Check Gateway connection
      const connected = gatewayConnected ?? (await checkGatewayConnection());
      if (connected) {
        return sendMessageReal(content, attachments);
      } else {
        // Fall back to mock if Gateway is not available
        console.warn("[useAgent] Gateway not connected, using mock implementation");
        return sendMessageMock(content, attachments);
      }
    },
    [mockMode, useWebSocket, gatewayConnected, checkGatewayConnection, sendMessageReal, sendMessageMock, sendMessageWebSocket]
  );

  /**
   * Approve a pending plan
   */
  const approvePlan = useCallback(async () => {
    if (!pendingPlan) return;

    // Use WebSocket if enabled
    if (useWebSocket) {
      return approvePlanWebSocket();
    }

    // Get plan ID directly from pendingPlan
    const planId = pendingPlan.id;

    setPendingPlan(null);
    setPhase("running");
    setIsStreaming(true);

    try {
      if (planId && gatewayConnected) {
        // Call real Gateway endpoint
        const gatewayUrl = getGatewayUrl();
        const response = await fetch(`${gatewayUrl}/api/agent/approve/${planId}`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Failed to approve plan: ${response.statusText}`);
        }

        console.log("[useAgent] Plan approved:", planId);
      }

      // Update UI to show plan is being executed
      setMessages((prev) =>
        prev.map((m) => {
          if (m.type === "plan" && m.plan) {
            const updatedSteps = m.plan.steps.map((step) => ({
              ...step,
              status: "in_progress" as const,
            }));
            return { ...m, plan: { ...m.plan, steps: updatedSteps } };
          }
          return m;
        })
      );

      // Note: The actual plan execution will continue via the SSE stream
      // For now, we'll mark as completed after a short delay if not using real Gateway
      if (!gatewayConnected) {
        await mockDelay(2000);
        setMessages((prev) =>
          prev.map((m) => {
            if (m.type === "plan" && m.plan) {
              const updatedSteps = m.plan.steps.map((step) => ({
                ...step,
                status: "completed" as const,
              }));
              return { ...m, plan: { ...m.plan, steps: updatedSteps } };
            }
            return m;
          })
        );
        setPhase("completed");
        setIsStreaming(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("errors.conversation.approvePlanFailed"));
      setPhase("error");
      setIsStreaming(false);
    }
  }, [pendingPlan, gatewayConnected, useWebSocket, approvePlanWebSocket]);

  /**
   * Reject a pending plan
   */
  const rejectPlan = useCallback(async () => {
    if (!pendingPlan) return;

    // Use WebSocket if enabled
    if (useWebSocket) {
      return rejectPlanWebSocket();
    }

    // Get plan ID directly from pendingPlan
    const planId = pendingPlan.id;

    try {
      if (planId && gatewayConnected) {
        // Call real Gateway endpoint
        const gatewayUrl = getGatewayUrl();
        const response = await fetch(`${gatewayUrl}/api/agent/reject/${planId}`, {
          method: "POST",
        });

        if (!response.ok) {
          throw new Error(`Failed to reject plan: ${response.statusText}`);
        }

        console.log("[useAgent] Plan rejected:", planId);
      }
    } catch (err) {
      console.error("[useAgent] Failed to reject plan:", err);
    }

    setPendingPlan(null);

    setMessages((prev) =>
      prev.map((m) => {
        if (m.type === "plan" && m.plan) {
          const updatedSteps = m.plan.steps.map((step) => ({
            ...step,
            status: "cancelled" as const,
          }));
          return { ...m, plan: { ...m.plan, steps: updatedSteps } };
        }
        return m;
      })
    );

    const textMessage: AgentMessage = {
      id: generateId(),
      type: "text",
      content: "Plan rejected. How would you like me to proceed?",
    };
    setMessages((prev) => [...prev, textMessage]);
    setPhase("idle");
  }, [pendingPlan, gatewayConnected, useWebSocket, rejectPlanWebSocket]);

  /**
   * Answer pending questions (AskUserQuestion elicitation)
   *
   * Following workany pattern:
   * 1. Format user's answers as text
   * 2. Clear pending question state
   * 3. Continue conversation with the answers as new message
   *
   * Note: Claude Agent SDK doesn't wait for answers - it terminates.
   * We continue the conversation by sending a new message with the answers.
   */
  const answerQuestions = useCallback(
    async (answers: Record<string, string[]>) => {
      if (!pendingQuestions) return;

      // Use WebSocket if enabled
      if (useWebSocket) {
        return answerQuestionsWebSocket(answers);
      }

      // Format answers as readable text (workany pattern)
      // Format: "Question header: selected options"
      const answerParts: string[] = [];
      const questions = pendingQuestions.questions;

      for (const [questionIndex, selectedValues] of Object.entries(answers)) {
        const idx = parseInt(questionIndex, 10);
        const question = questions[idx];
        if (question) {
          const header = question.header || `Question ${idx + 1}`;
          answerParts.push(`${header}: ${selectedValues.join(", ")}`);
        } else {
          answerParts.push(`Answer: ${selectedValues.join(", ")}`);
        }
      }

      const answerText = answerParts.join("\n");
      console.log("[useAgent] Answering question with:", answerText);

      // Clear pending question
      setPendingQuestions(null);

      // Continue the conversation with the answers
      // This sends a new message to the agent, which will continue execution
      await sendMessageReal(answerText);
    },
    [pendingQuestions, sendMessageReal, useWebSocket, answerQuestionsWebSocket]
  );

  /**
   * Cancel the current operation
   */
  const cancel = useCallback(async () => {
    // Use WebSocket cancel if enabled
    if (useWebSocket) {
      cancelWebSocket();
      return;
    }

    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Stop the agent through Gateway if we have a session
    if (sessionId && !mockMode && gatewayConnected) {
      try {
        // Use executor type from config or default to CLAUDE_CODE
        const executorType = (agentConfig?.executorType || "CLAUDE_CODE") as ExecutorType;
        await client.stopAgent(executorType, sessionId);
      } catch (err) {
        console.error("[useAgent] Failed to stop agent:", err);
      }
    }

    // Cancel any SSE stream
    client.cancelStream();

    setPendingPlan(null);
    setPendingQuestions(null);
    setIsStreaming(false);
    setPhase("idle");
  }, [agentConfig, client, gatewayConnected, mockMode, sessionId, useWebSocket, cancelWebSocket]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    // Cancel WebSocket if enabled
    if (useWebSocket && wsRef.current) {
      sendWebSocketMessage({ type: "cancel" });
    }

    // Cancel any ongoing stream
    client.cancelStream();

    setMessages([]);
    setArtifacts([]);
    setToolUsages([]);
    setError(null);
    setPhase("idle");
    setSessionId(null);
    setSdkSessionId(null);
    setTraceId(null);
  }, [client, useWebSocket, sendWebSocketMessage]);

  /**
   * Load messages (for restoring conversation history)
   * @param savedMessages - Array of messages to restore
   * @param savedSdkSessionId - Optional SDK session ID for resume functionality
   */
  const loadMessages = useCallback((savedMessages: AgentMessage[], savedSdkSessionId?: string) => {
    setMessages(savedMessages);
    // Extract tool usages from messages
    const tools: ToolUsage[] = savedMessages
      .filter((m): m is AgentMessage & { id: string; name: string } =>
        m.type === "tool_use" && !!m.name && !!m.id
      )
      .map((m) => ({
        id: m.id,
        toolUseId: m.toolUseId,
        name: m.name,
        displayName: m.name,
        input: m.input || {},
        timestamp: Date.now(),
      }));
    setToolUsages(tools);
    setPhase("idle");
    // Restore SDK session ID if provided
    if (savedSdkSessionId) {
      console.log("[useAgent] Restoring SDK session ID:", savedSdkSessionId);
      setSdkSessionId(savedSdkSessionId);
    }
  }, []);

  /**
   * Move current running task to background when switching to another task
   */
  const moveToBackground = useCallback(() => {
    const currentTaskId = activeTaskIdRef.current;
    const currentIsRunning = isRunningRef.current;
    const currentPrompt = initialPromptRef.current;

    if (
      abortControllerRef.current &&
      currentTaskId &&
      currentIsRunning
    ) {
      console.log("[useAgent] Moving task to background:", currentTaskId);
      addBackgroundTask({
        taskId: currentTaskId,
        sessionId: sessionId || "",
        sdkSessionId: sdkSessionId || undefined,
        abortController: abortControllerRef.current,
        isRunning: true,
        prompt: currentPrompt,
        agentConfigPath,
        workspacePath: workspaceId,
      });
      // Clear refs but don't abort - task continues in background
      abortControllerRef.current = null;

      // Clear UI state for the old task
      setMessages([]);
      setPendingPlan(null);
      setPendingQuestions(null);
      setPhase("idle");
      setIsStreaming(false);
    }

    // Stop any existing polling
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, [sessionId, sdkSessionId, agentConfigPath, workspaceId]);

  /**
   * Switch to a different task, moving current task to background if running
   * @param newTaskId - The task ID to switch to
   * @param savedMessages - Optional messages to restore
   * @returns Whether the new task is running in background
   */
  const switchTask = useCallback((newTaskId: string, savedMessages?: AgentMessage[]): boolean => {
    const currentTaskId = activeTaskIdRef.current;

    // If switching to a different task, move current to background
    if (currentTaskId && currentTaskId !== newTaskId && isRunningRef.current) {
      moveToBackground();
    }

    // Set new task as active
    activeTaskIdRef.current = newTaskId;

    // Check if the new task is running in background
    const backgroundTask = getBackgroundTask(newTaskId);
    const isRestoringFromBackground = backgroundTask && backgroundTask.isRunning;

    if (isRestoringFromBackground) {
      console.log("[useAgent] Restoring task from background:", newTaskId);
      // Restore abort controller
      abortControllerRef.current = backgroundTask.abortController;
      setSessionId(backgroundTask.sessionId);
      // Restore SDK session ID for resume functionality
      if (backgroundTask.sdkSessionId) {
        setSdkSessionId(backgroundTask.sdkSessionId);
      }

      // Check if the abort controller is still valid
      if (abortControllerRef.current.signal.aborted) {
        console.log("[useAgent] Background task was already completed/aborted");
        setIsStreaming(false);
        setPhase("idle");
        isRunningRef.current = false;
        abortControllerRef.current = null;
        removeBackgroundTask(newTaskId);
        return false;
      } else {
        setIsStreaming(true);
        setPhase("running");
        isRunningRef.current = true;

        // Remove from background tasks after brief delay
        setTimeout(() => {
          removeBackgroundTask(newTaskId);
        }, 50);

        // Start polling for messages if we have a session
        startMessagePolling(newTaskId);
        return true;
      }
    }

    // Load saved messages if provided
    if (savedMessages) {
      loadMessages(savedMessages);
    }

    return false;
  }, [moveToBackground, loadMessages]);

  /**
   * Start polling for new messages (for background task restoration)
   */
  const startMessagePolling = useCallback((taskId: string) => {
    // Clear existing polling
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    let lastMessageCount = 0;
    let stuckCount = 0;
    const MAX_STUCK_COUNT = 300; // 5 minutes of no progress

    refreshIntervalRef.current = setInterval(async () => {
      const isStillActive = activeTaskIdRef.current === taskId;

      // Check abort signal
      if (
        !abortControllerRef.current ||
        abortControllerRef.current.signal.aborted
      ) {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
        if (isStillActive) {
          setIsStreaming(false);
          setPhase("idle");
          isRunningRef.current = false;
        }
        return;
      }

      if (isStillActive) {
        // Check for stuck state
        const currentCount = messages.length;
        if (currentCount === lastMessageCount) {
          stuckCount++;
          if (stuckCount >= MAX_STUCK_COUNT) {
            console.log("[useAgent] Task appears stuck, stopping poll");
            if (refreshIntervalRef.current) {
              clearInterval(refreshIntervalRef.current);
              refreshIntervalRef.current = null;
            }
            setIsStreaming(false);
            setPhase("idle");
            isRunningRef.current = false;
            return;
          }
        } else {
          stuckCount = 0;
          lastMessageCount = currentCount;
        }
      }
    }, 1000);
  }, [messages.length]);

  /**
   * Check if there's a running background task for this workspace
   */
  const hasRunningBackgroundTask = useCallback((taskId: string): boolean => {
    const task = getBackgroundTask(taskId);
    return task?.isRunning ?? false;
  }, []);

  /**
   * Extract artifacts from messages (Write/Edit tools and WebSearch results)
   * Updates the artifacts state whenever messages change
   */
  useEffect(() => {
    const extractedArtifacts: Artifact[] = [];
    const seenPaths = new Set<string>();

    // Helper to get artifact type from file extension
    const getArtifactTypeFromExt = (ext?: string): Artifact["type"] => {
      if (!ext) return "text";
      switch (ext.toLowerCase()) {
        case "html":
        case "htm":
          return "html";
        case "jsx":
        case "tsx":
          return "jsx";
        case "css":
        case "scss":
        case "less":
          return "css";
        case "json":
          return "json";
        case "md":
        case "markdown":
          return "markdown";
        case "csv":
          return "csv";
        case "pdf":
          return "pdf";
        case "doc":
        case "docx":
          return "document";
        case "xls":
        case "xlsx":
          return "spreadsheet";
        case "ppt":
        case "pptx":
          return "presentation";
        case "png":
        case "jpg":
        case "jpeg":
        case "gif":
        case "svg":
        case "webp":
        case "bmp":
        case "ico":
          return "image";
        case "mp3":
        case "wav":
        case "ogg":
        case "m4a":
        case "aac":
        case "flac":
          return "audio";
        case "mp4":
        case "webm":
        case "mov":
        case "avi":
        case "mkv":
          return "video";
        case "ttf":
        case "otf":
        case "woff":
        case "woff2":
          return "font";
        case "js":
        case "ts":
        case "py":
        case "rb":
        case "go":
        case "rs":
        case "java":
        case "c":
        case "cpp":
        case "h":
        case "sh":
        case "yaml":
        case "yml":
        case "toml":
        case "sql":
        case "graphql":
          return "code";
        default:
          return "text";
      }
    };

    // Helper to check if WebSearch output has valid results
    const hasValidSearchResults = (output: string): boolean => {
      if (!output) return false;
      // Check for common patterns that indicate actual search results
      return (
        output.includes("http") ||
        output.includes("www.") ||
        output.includes("Source") ||
        output.includes("result") ||
        output.length > 100
      );
    };

    // 1. Extract from Write tool messages
    messages.forEach((msg) => {
      if (msg.type === "tool_use" && msg.name === "Write") {
        const input = msg.input as Record<string, unknown> | undefined;
        const filePath = input?.file_path as string | undefined;
        const content = input?.content as string | undefined;

        if (filePath && !seenPaths.has(filePath)) {
          seenPaths.add(filePath);
          const filename = filePath.split("/").pop() || filePath;
          const ext = filename.split(".").pop()?.toLowerCase();

          // Calculate file size and determine if it's too large
          const fileSize = content ? new TextEncoder().encode(content).length : 0;
          const fileTooLarge = fileSize > LARGE_FILE_THRESHOLD;

          extractedArtifacts.push({
            id: filePath,
            name: filename,
            type: getArtifactTypeFromExt(ext),
            // Truncate preview content for large files
            content: fileTooLarge ? content?.slice(0, MAX_PREVIEW_SIZE) : content,
            path: filePath,
            sourceMessageId: msg.id,
            toolName: "Write",
            createdAt: Date.now(),
            fileSize,
            fileTooLarge,
          });
        }
      }

      // 2. Extract from Edit tool messages (modified files)
      // Note: Edit tool only has old_string/new_string, not full content,
      // so fileSize remains undefined (cannot determine actual file size)
      if (msg.type === "tool_use" && msg.name === "Edit") {
        const input = msg.input as Record<string, unknown> | undefined;
        const filePath = input?.file_path as string | undefined;

        if (filePath && !seenPaths.has(filePath)) {
          seenPaths.add(filePath);
          const filename = filePath.split("/").pop() || filePath;
          const ext = filename.split(".").pop()?.toLowerCase();

          extractedArtifacts.push({
            id: filePath,
            name: filename,
            type: getArtifactTypeFromExt(ext),
            path: filePath,
            sourceMessageId: msg.id,
            toolName: "Edit",
            createdAt: Date.now(),
            // fileSize and fileTooLarge remain undefined for Edit tool
          });
        }
      }

      // 3. Extract WebSearch results as artifacts
      if (msg.type === "tool_use" && msg.name === "WebSearch") {
        const input = msg.input as Record<string, unknown> | undefined;
        const query = input?.query as string | undefined;
        const toolUseId = msg.id;

        if (query) {
          // Find the corresponding tool_result by toolUseId
          let output = "";
          if (toolUseId) {
            const resultMsg = messages.find(
              (m) => m.type === "tool_result" && m.toolUseId === toolUseId
            );
            output = resultMsg?.output || "";
          }
          // Fallback: find the next tool_result after this tool_use
          if (!output) {
            const msgIndex = messages.indexOf(msg);
            for (let i = msgIndex + 1; i < messages.length; i++) {
              if (messages[i].type === "tool_result") {
                output = messages[i].output || "";
                break;
              }
              if (messages[i].type === "tool_use") break;
            }
          }

          const artifactId = `websearch-${query}`;
          if (
            !seenPaths.has(artifactId) &&
            output &&
            hasValidSearchResults(output)
          ) {
            seenPaths.add(artifactId);
            extractedArtifacts.push({
              id: artifactId,
              name: `Search: ${query.slice(0, 50)}${query.length > 50 ? "..." : ""}`,
              type: "websearch",
              content: output,
              sourceMessageId: msg.id,
              toolName: "WebSearch",
              createdAt: Date.now(),
            });
          }
        }
      }
    });

    // 4. Extract files mentioned in tool_result and text messages
    const filePatterns = [
      // Match paths in backticks
      /`([^`]+\.(?:pptx|xlsx|docx|pdf|png|jpg|jpeg|gif|svg|mp4|mp3|csv))`/gi,
      // Match absolute paths
      /(\/[^\s"'`\n]+\.(?:pptx|xlsx|docx|pdf|png|jpg|jpeg|gif|svg|mp4|mp3|csv))/gi,
    ];

    messages.forEach((msg) => {
      const textToSearch =
        msg.type === "tool_result"
          ? msg.output
          : msg.type === "text"
            ? msg.content
            : null;

      if (textToSearch) {
        for (const pattern of filePatterns) {
          const matches = textToSearch.matchAll(pattern);
          for (const match of matches) {
            const filePath = match[1] || match[0];
            if (filePath && !seenPaths.has(filePath)) {
              seenPaths.add(filePath);
              const filename = filePath.split("/").pop() || filePath;
              const ext = filename.split(".").pop()?.toLowerCase();

              extractedArtifacts.push({
                id: filePath,
                name: filename,
                type: getArtifactTypeFromExt(ext),
                path: filePath,
                sourceMessageId: msg.id,
                createdAt: Date.now(),
              });
            }
          }
        }
      }
    });

    setArtifacts(extractedArtifacts);
  }, [messages]);

  return {
    // State
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    artifacts,
    toolUsages,
    error,
    sessionId,
    traceId,
    gatewayConnected,

    // Actions
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
    loadMessages,
    checkGatewayConnection,

    // Background task management
    switchTask,
    moveToBackground,
    hasRunningBackgroundTask,

    // WebSocket-specific (optional)
    connectWebSocket,
    disconnectWebSocket,
  };
}
