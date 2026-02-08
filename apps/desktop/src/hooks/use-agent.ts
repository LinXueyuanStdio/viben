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

  // Streaming text buffer for accumulating delta updates
  const streamingTextRef = useRef<{ id: string; content: string } | null>(null);

  // Tool use buffer for accumulating input_json_delta updates
  const toolUseRef = useRef<{
    messageId: string;
    toolUseId: string;
    name: string;
    inputJson: string;
  } | null>(null);

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
        // Finalize any streaming text first
        if (streamingTextRef.current) {
          streamingTextRef.current = null;
        }
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

        // Handle "user" log type which may contain tool_result inside
        if (logType === "user") {
          try {
            const userData = JSON.parse(content);

            // Check if this is a tool_result wrapped in user message
            if (userData.type === "user" && userData.message?.content) {
              const messageContent = userData.message.content;
              // Content can be an array of content blocks
              if (Array.isArray(messageContent)) {
                for (const block of messageContent) {
                  if (block.type === "tool_result" && block.tool_use_id) {
                    // This is a tool result! Create the message
                    const resultMsg: AgentMessage = {
                      id: generateId(),
                      type: "tool_result",
                      toolUseId: block.tool_use_id,
                      output: typeof block.content === "string" ? block.content : JSON.stringify(block.content),
                      isError: block.is_error,
                    };
                    setMessages((prev) => [...prev, resultMsg]);

                    // Update tool usage
                    setToolUsages((prev) => prev.map((t) =>
                      t.toolUseId === block.tool_use_id
                        ? { ...t, output: resultMsg.output, completedAt: Date.now() }
                        : t
                    ));
                  }
                }
              }
            }
          } catch {
            // Ignore parse errors for user logs
          }
        }

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
            // Claude Code stream-json format uses "content" for tool result, not "output"
            const resultOutput = resultData.content || resultData.output || content;
            const resultMsg: AgentMessage = {
              id: generateId(),
              type: "tool_result",
              toolUseId: resultData.tool_use_id || "",
              output: typeof resultOutput === "string" ? resultOutput : JSON.stringify(resultOutput),
              isError: resultData.is_error,
            };
            setMessages((prev) => [...prev, resultMsg]);

            // Update tool usage to mark as completed (match by Claude's toolUseId)
            if (resultData.tool_use_id) {
              setToolUsages((prev) => prev.map((t) =>
                t.toolUseId === resultData.tool_use_id
                  ? { ...t, output: resultMsg.output, completedAt: Date.now() }
                  : t
              ));
            }
          } catch {
            const textMsg: AgentMessage = {
              id: generateId(),
              type: "text",
              content,
            };
            setMessages((prev) => [...prev, textMsg]);
          }
        } else if (logType === "stream_event") {
          // Handle streaming events from Claude Code stream-json format
          try {
            const streamData = JSON.parse(content);
            const event = streamData.event;

            if (event?.type === "content_block_start") {
              // Handle new content block start
              const contentBlock = event.content_block;
              if (contentBlock?.type === "tool_use") {
                // Start a new tool use block
                const messageId = generateId();
                toolUseRef.current = {
                  messageId,
                  toolUseId: contentBlock.id || "",
                  name: contentBlock.name || "unknown",
                  inputJson: "",
                };

                // Add tool_use message placeholder with Claude's toolUseId
                const toolMsg: AgentMessage = {
                  id: messageId,
                  type: "tool_use",
                  name: contentBlock.name || "unknown",
                  toolUseId: contentBlock.id || "",  // Store Claude's tool_use_id
                  input: {},
                };
                setMessages((prev) => [...prev, toolMsg]);

                // Add to tool usages with Claude's toolUseId for matching
                const toolUsage: ToolUsage = {
                  id: messageId,
                  toolUseId: contentBlock.id || "",  // Store Claude's tool_use_id
                  name: contentBlock.name || "unknown",
                  displayName: contentBlock.name || "Unknown Tool",
                  input: {},
                  timestamp: Date.now(),
                };
                setToolUsages((prev) => [...prev, toolUsage]);
              } else if (contentBlock?.type === "thinking") {
                // Start thinking block - finalize any previous streaming text
                if (streamingTextRef.current) {
                  streamingTextRef.current = null;
                }
                // Create a new thinking message
                const thinkingId = generateId();
                streamingTextRef.current = { id: thinkingId, content: "" };
                setMessages((prev) => [...prev, {
                  id: thinkingId,
                  type: "thinking",
                  content: "",
                }]);
              } else if (contentBlock?.type === "text") {
                // Start text block - finalize any previous streaming and start new
                if (streamingTextRef.current) {
                  streamingTextRef.current = null;
                }
                const textId = generateId();
                streamingTextRef.current = { id: textId, content: "" };
                setMessages((prev) => [...prev, {
                  id: textId,
                  type: "text",
                  content: "",
                }]);
              }
            } else if (event?.type === "content_block_delta") {
              const delta = event.delta;
              if (delta?.type === "text_delta") {
                // Handle text delta
                const deltaText = delta.text || "";
                if (deltaText) {
                  if (!streamingTextRef.current) {
                    // Start new streaming message
                    const newId = generateId();
                    streamingTextRef.current = { id: newId, content: deltaText };
                    setMessages((prev) => [...prev, {
                      id: newId,
                      type: "text",
                      content: deltaText,
                    }]);
                  } else {
                    // Append to existing streaming message
                    streamingTextRef.current.content += deltaText;
                    const currentId = streamingTextRef.current.id;
                    const currentContent = streamingTextRef.current.content;
                    setMessages((prev) => prev.map((m) =>
                      m.id === currentId ? { ...m, content: currentContent } : m
                    ));
                  }
                }
              } else if (delta?.type === "thinking_delta") {
                // Handle thinking delta
                const thinkingText = delta.thinking || "";
                if (thinkingText && streamingTextRef.current) {
                  streamingTextRef.current.content += thinkingText;
                  const currentId = streamingTextRef.current.id;
                  const currentContent = streamingTextRef.current.content;
                  setMessages((prev) => prev.map((m) =>
                    m.id === currentId ? { ...m, content: currentContent } : m
                  ));
                }
              } else if (delta?.type === "input_json_delta") {
                // Handle tool input JSON delta
                const partialJson = delta.partial_json || "";
                if (partialJson && toolUseRef.current) {
                  toolUseRef.current.inputJson += partialJson;
                }
              }
            } else if (event?.type === "content_block_stop") {
              // Content block finished
              // Finalize tool use if we have one
              if (toolUseRef.current) {
                try {
                  const parsedInput = toolUseRef.current.inputJson
                    ? JSON.parse(toolUseRef.current.inputJson)
                    : {};
                  const currentTool = toolUseRef.current;

                  // Update the tool_use message with parsed input
                  setMessages((prev) => prev.map((m) =>
                    m.id === currentTool.messageId
                      ? { ...m, input: parsedInput }
                      : m
                  ));

                  // Update tool usages
                  setToolUsages((prev) => prev.map((t) =>
                    t.id === currentTool.messageId
                      ? { ...t, input: parsedInput }
                      : t
                  ));
                } catch {
                  // JSON parse error, keep empty input
                }
                toolUseRef.current = null;
              }
              // Finalize streaming text if we have one
              if (streamingTextRef.current) {
                streamingTextRef.current = null;
              }
            } else if (event?.type === "message_stop") {
              // Message finished - clean up all refs
              streamingTextRef.current = null;
              toolUseRef.current = null;
            }
          } catch {
            // Ignore parse errors for stream events
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
          // Don't add verbose "completed" message - the streaming indicator stopping is enough
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
        // Agent started - no need to add verbose info message
        // The UI will show streaming indicator
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
