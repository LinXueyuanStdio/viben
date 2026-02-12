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
 * SSE message data from /api/agent/run endpoint
 */
interface SSEMessageData {
  type: "session" | "text" | "tool_use" | "tool_result" | "plan" | "question" | "result" | "error" | "done";
  // session
  sessionId?: string;
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
   * Handle SSE message from /api/agent/run endpoint
   */
  const handleSSEMessage = useCallback((data: SSEMessageData) => {
    console.log("[useAgent] SSE message:", data);

    switch (data.type) {
      case "session":
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        break;

      case "text":
        // Append to existing text message or create new one
        if (data.content) {
          const textMsg: AgentMessage = {
            id: generateId(),
            type: "text",
            content: data.content,
          };
          setMessages((prev) => [...prev, textMsg]);
        }
        break;

      case "tool_use": {
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
        }
        break;
      }

      case "result":
        setPhase("completed");
        setIsStreaming(false);
        break;

      case "error": {
        const errMsg: AgentMessage = {
          id: generateId(),
          type: "error",
          message: data.message || "Unknown error",
          isError: true,
        };
        setMessages((prev) => [...prev, errMsg]);
        setError(data.message || "Unknown error");
        setPhase("error");
        setIsStreaming(false);
        break;
      }

      case "done":
        setIsStreaming(false);
        if (phase === "running") {
          setPhase("completed");
        }
        break;
    }
  }, [phase]);

  /**
   * Send a message to the agent (real Gateway implementation using SSE)
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

      try {
        // Use the new SSE endpoint /api/agent/run
        const gatewayUrl = getGatewayUrl();
        const url = `${gatewayUrl}/api/agent/run`;

        console.log("[useAgent] Starting SSE connection to:", url);

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            agentId: agentType,
            prompt: content,
            cwd: workspaceId,
            // Model is passed through the agent configuration, not here
          }),
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
    [agentType, executorConfig, workspaceId, handleSSEMessage]
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

    // Find the plan ID from messages
    const planMessage = messages.find((m) => m.type === "plan" && m.plan);
    const planId = (planMessage?.plan as { id?: string } | undefined)?.id;

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
      setError(err instanceof Error ? err.message : "Failed to approve plan");
      setPhase("error");
      setIsStreaming(false);
    }
  }, [pendingPlan, messages, gatewayConnected]);

  /**
   * Reject a pending plan
   */
  const rejectPlan = useCallback(async () => {
    if (!pendingPlan) return;

    // Find the plan ID from messages
    const planMessage = messages.find((m) => m.type === "plan" && m.plan);
    const planId = (planMessage?.plan as { id?: string } | undefined)?.id;

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
  }, [pendingPlan, messages, gatewayConnected]);

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
  }, [client]);

  /**
   * Load messages (for restoring conversation history)
   */
  const loadMessages = useCallback((savedMessages: AgentMessage[]) => {
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
    loadMessages,
    checkGatewayConnection,
  };
}
