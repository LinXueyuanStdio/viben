/**
 * useAgent Hook - Real Gateway Integration
 *
 * Connects to viben-gateway for real AI agent execution.
 * Falls back to mock implementation when Gateway is unavailable.
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
  BaseCodingAgent,
  ExecutorConfig,
} from "@/types";
import { getGatewayClient, getGatewayUrl } from "@/lib/gateway";

/**
 * Generate a unique ID
 */
const generateId = () => crypto.randomUUID();

/**
 * Mock delay for fallback implementation
 */
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gateway event data structure
 */
interface GatewayEventData {
  agent_id?: string;
  session_id?: string;
  success?: boolean;
  task_id?: string;
  old_status?: string;
  new_status?: string;
  content?: string;
  role?: string;
  log_type?: string;
  message?: string;
  code?: string;
}

/**
 * WebSocket message from server (matching Rust WsMessage with serde tag="type", content="data")
 */
interface WsServerMessage {
  type: "Event" | "Pong" | "Subscribed" | "Error";
  data?: {
    channel?: string;
    payload?: {
      type?: string;  // e.g., "SessionMessage", "ExecutionLog", "AgentCompleted"
      data?: GatewayEventData;
    };
    message?: string;
  };
}

/**
 * Get WebSocket URL from Gateway URL
 */
function getWebSocketUrl(): string {
  const gatewayUrl = getGatewayUrl();
  return gatewayUrl.replace(/^http/, "ws") + "/ws";
}

/**
 * Agent hook options
 */
interface UseAgentOptions {
  /** Agent type to use (default: CLAUDE_CODE) */
  agentType?: BaseCodingAgent;
  /** Executor configuration */
  executorConfig?: ExecutorConfig;
  /** Enable mock mode (for testing) */
  mockMode?: boolean;
}

/**
 * Agent hook for workspace chat
 * Connects to Gateway for real AI agent execution
 */
export function useAgent(workspaceId: string, options?: UseAgentOptions) {
  const {
    agentType = "CLAUDE_CODE",
    executorConfig,
    mockMode = false,
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
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const client = useMemo(() => getGatewayClient(), []);

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
   * Handle incoming WebSocket event
   */
  const handleWsEvent = useCallback((eventType: string, eventData: GatewayEventData, targetSessionId: string) => {
    if (eventData.session_id !== targetSessionId) {
      return;
    }

    console.log("[useAgent] Processing event:", eventType, eventData);

    switch (eventType) {
      case "AgentSpawned":
        console.log("[useAgent] Agent spawned confirmed for session:", targetSessionId);
        break;

      case "SessionMessage": {
        const msg: AgentMessage = {
          id: generateId(),
          type: eventData.role === "user" ? "user" : "text",
          content: eventData.content || "",
        };
        setMessages((prev) => [...prev, msg]);
        break;
      }

      case "ExecutionLog": {
        const logType = eventData.log_type;
        const content = eventData.content || "";

        if (logType === "tool_use") {
          try {
            const toolData = JSON.parse(content);
            const toolId = generateId();
            const toolMsg: AgentMessage = {
              id: toolId,
              type: "tool_use",
              name: toolData.name || "unknown",
              input: toolData.input || {},
            };
            setMessages((prev) => [...prev, toolMsg]);

            const toolUsage: ToolUsage = {
              id: toolId,
              name: toolData.name || "unknown",
              displayName: toolData.name || "Unknown Tool",
              input: toolData.input || {},
              timestamp: Date.now(),
            };
            setToolUsages((prev) => [...prev, toolUsage]);
          } catch {
            const textMsg: AgentMessage = {
              id: generateId(),
              type: "text",
              content,
            };
            setMessages((prev) => [...prev, textMsg]);
          }
        } else if (logType === "tool_result") {
          try {
            const resultData = JSON.parse(content);
            const resultMsg: AgentMessage = {
              id: generateId(),
              type: "tool_result",
              toolUseId: resultData.tool_use_id || "",
              output: resultData.output || content,
              isError: resultData.is_error,
            };
            setMessages((prev) => [...prev, resultMsg]);
          } catch {
            const textMsg: AgentMessage = {
              id: generateId(),
              type: "text",
              content,
            };
            setMessages((prev) => [...prev, textMsg]);
          }
        } else if (content.trim()) {
          const textMsg: AgentMessage = {
            id: generateId(),
            type: "text",
            content,
          };
          setMessages((prev) => [...prev, textMsg]);
        }
        break;
      }

      case "AgentCompleted":
        setIsStreaming(false);
        if (eventData.success) {
          setPhase("completed");
          const resultMsg: AgentMessage = {
            id: generateId(),
            type: "result",
            content: "Agent completed successfully.",
          };
          setMessages((prev) => [...prev, resultMsg]);
        } else {
          setPhase("error");
          const errMsg: AgentMessage = {
            id: generateId(),
            type: "error",
            message: "Agent execution failed.",
            isError: true,
          };
          setMessages((prev) => [...prev, errMsg]);
        }
        break;

      case "Error":
        setError(eventData.message || "Unknown error");
        const errMsg: AgentMessage = {
          id: generateId(),
          type: "error",
          message: eventData.message || "Unknown error",
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setPhase("error");
        setIsStreaming(false);
        break;
    }
  }, []);

  /**
   * Subscribe to WebSocket events for a session
   * Returns a promise that resolves when the connection is open
   */
  const subscribeToEvents = useCallback((targetSessionId: string): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const wsUrl = getWebSocketUrl();
      console.log("[useAgent] Connecting to WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Set a timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }
      }, 5000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("[useAgent] WebSocket connection opened for session:", targetSessionId);
        resolve(ws);
      };

      ws.onmessage = (e) => {
        try {
          const message: WsServerMessage = JSON.parse(e.data);
          console.log("[useAgent] WebSocket message:", message);

          if (message.type === "Event" && message.data?.payload) {
            const eventType = message.data.payload.type;
            const eventData = message.data.payload.data;
            if (eventType && eventData) {
              handleWsEvent(eventType, eventData, targetSessionId);
            }
          }
        } catch (err) {
          console.error("[useAgent] Failed to parse WebSocket message:", err, e.data);
        }
      };

      ws.onerror = (e) => {
        clearTimeout(connectionTimeout);
        console.error("[useAgent] WebSocket error:", e);
        reject(new Error("WebSocket connection failed"));
      };

      ws.onclose = (e) => {
        console.log("[useAgent] WebSocket closed:", e.code, e.reason);
      };
    });
  }, [handleWsEvent]);

  /**
   * Send a message to the agent (real Gateway implementation)
   */
  const sendMessageReal = useCallback(
    async (content: string, _attachments?: MessageAttachment[]) => {
      if (!content.trim()) return;

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

      // Generate session ID upfront so WebSocket can listen for it
      const newSessionId = sessionId || crypto.randomUUID();

      try {
        // CRITICAL: First establish WebSocket connection BEFORE spawning
        // This ensures we don't miss any early messages from the agent
        console.log("[useAgent] Establishing WebSocket connection first...");
        await subscribeToEvents(newSessionId);
        console.log("[useAgent] WebSocket ready, now spawning agent");

        // Spawn agent through Gateway
        const request = {
          prompt: content,
          workdir: workspaceId, // Use workspace path as workdir
          session_id: newSessionId,
          config: executorConfig?.config as Record<string, unknown>,
        };
        console.log("[useAgent] Spawning agent:", { agentType, request });
        const response = await client.spawnAgent(agentType, request);
        console.log("[useAgent] Spawn response:", response);

        // Update session ID (should match what we sent)
        setSessionId(response.session_id);

        // Add a system message indicating the agent started
        const infoMessage: AgentMessage = {
          id: generateId(),
          type: "text",
          content: `Agent ${agentType} started (session: ${response.session_id.slice(0, 8)}...)`,
        };
        setMessages((prev) => [...prev, infoMessage]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("[useAgent] Error:", errorMessage);
        setError(errorMessage);

        const errMsg: AgentMessage = {
          id: generateId(),
          type: "error",
          message: `Failed to start agent: ${errorMessage}`,
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setPhase("error");
        setIsStreaming(false);
      }
    },
    [agentType, client, executorConfig, sessionId, workspaceId, subscribeToEvents]
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
          message: err instanceof Error ? err.message : "An unknown error occurred",
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        setError(errorMessage.message ?? "Unknown error");
        setPhase("error");
      } finally {
        setIsStreaming(false);
      }
    },
    [workspaceId]
  );

  /**
   * Send a message - decides between real and mock implementation
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      if (mockMode) {
        return sendMessageMock(content, attachments);
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
    [mockMode, gatewayConnected, checkGatewayConnection, sendMessageReal, sendMessageMock]
  );

  /**
   * Approve a pending plan
   */
  const approvePlan = useCallback(async () => {
    if (!pendingPlan) return;

    setPendingPlan(null);
    setPhase("running");
    setIsStreaming(true);

    try {
      // Simulate executing the plan
      for (let i = 0; i < pendingPlan.steps.length; i++) {
        await mockDelay(1000);

        setMessages((prev) =>
          prev.map((m) => {
            if (m.type === "plan" && m.plan) {
              const updatedSteps = m.plan.steps.map((step, idx) => ({
                ...step,
                status:
                  idx < i
                    ? "completed"
                    : idx === i
                      ? "in_progress"
                      : step.status,
              })) as typeof m.plan.steps;
              return { ...m, plan: { ...m.plan, steps: updatedSteps } };
            }
            return m;
          })
        );
      }

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

      const resultMessage: AgentMessage = {
        id: generateId(),
        type: "result",
        content: "Plan executed successfully! All steps have been completed.",
      };
      setMessages((prev) => [...prev, resultMessage]);
      setPhase("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute plan");
      setPhase("error");
    } finally {
      setIsStreaming(false);
    }
  }, [pendingPlan]);

  /**
   * Reject a pending plan
   */
  const rejectPlan = useCallback(async () => {
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
  }, []);

  /**
   * Answer pending questions
   */
  const answerQuestions = useCallback(
    async (answers: Record<string, string[]>) => {
      if (!pendingQuestions) return;

      setPendingQuestions(null);
      setPhase("running");
      setIsStreaming(true);

      try {
        await mockDelay(500);

        const selectedAnswers = Object.values(answers).flat().join(", ");
        const textMessage: AgentMessage = {
          id: generateId(),
          type: "text",
          content: `Thank you for your response! You selected: ${selectedAnswers}. I will proceed with this configuration.`,
        };
        setMessages((prev) => [...prev, textMessage]);
        setPhase("completed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process answers");
        setPhase("error");
      } finally {
        setIsStreaming(false);
      }
    },
    [pendingQuestions]
  );

  /**
   * Cancel the current operation
   */
  const cancel = useCallback(async () => {
    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Stop the agent through Gateway if we have a session
    if (sessionId && !mockMode && gatewayConnected) {
      try {
        await client.stopAgent(agentType, sessionId);
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
  }, [agentType, client, gatewayConnected, mockMode, sessionId]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    // Cancel any ongoing stream
    client.cancelStream();

    setMessages([]);
    setArtifacts([]);
    setToolUsages([]);
    setError(null);
    setPhase("idle");
    setSessionId(null);
  }, []);

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
    gatewayConnected,

    // Actions
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
    checkGatewayConnection,
  };
}
