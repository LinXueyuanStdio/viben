/**
 * useAgentConversation Hook - SSE Conversation State Management
 *
 * Manages SSE streaming conversation with AI agents via Gateway.
 * Handles message state, tool usage, plans, and interactive questions.
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
  /** Path to agent config.yaml file (preferred, backend reads from disk) */
  agentPath?: string;
  /** Inline agent configuration (fallback if agentPath not provided) */
  agentConfig?: AgentConfig;
  /** Enable mock mode (for testing) */
  mockMode?: boolean;
}

/**
 * Agent conversation hook for workspace chat
 * Manages SSE streaming conversation with AI agents via Gateway
 */
export function useAgentConversation(workspaceId: string, options?: UseAgentConversationOptions) {
  const {
    agentPath,
    agentConfig,
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

  // Track current streaming message ID for text accumulation
  const streamingMessageIdRef = useRef<string | null>(null);

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
        // End text streaming on done
        streamingMessageIdRef.current = null;
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

      console.log("[useAgent] sendMessageReal called with:", content.slice(0, 50));

      // Reset streaming state for new message
      streamingMessageIdRef.current = null;

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
        // Prefer agentPath (backend reads config from disk), fallback to inline agentConfig
        // workspaceId is actually workspace path, use it as cwd
        const requestBody: Record<string, unknown> = {
          prompt: content,
          agentPath: agentPath || undefined,
          agentConfig: agentPath ? undefined : (agentConfig || undefined),
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

        // Stream completed successfully
        console.log("[useAgent] Stream completed successfully");
        setIsStreaming(false);
        if (phase === "running") {
          setPhase("completed");
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
    [agentPath, agentConfig, workspaceId, handleSSEMessage, phase]
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
        // Use executor type from config or default to CLAUDE_CODE
        const executorType = (agentConfig?.executorType || "CLAUDE_CODE") as import("@/types").BaseCodingAgent;
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
  }, [agentConfig, client, gatewayConnected, mockMode, sessionId]);

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

          extractedArtifacts.push({
            id: filePath,
            name: filename,
            type: getArtifactTypeFromExt(ext),
            content,
            path: filePath,
            sourceMessageId: msg.id,
            toolName: "Write",
            createdAt: Date.now(),
          });
        }
      }

      // 2. Extract from Edit tool messages (modified files)
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
