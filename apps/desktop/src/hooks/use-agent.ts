import { useCallback, useState, useRef } from "react";
import type {
  AgentMessage,
  AgentPhase,
  MessageAttachment,
  TaskPlan,
  PendingQuestion,
  Artifact,
  ToolUsage,
} from "@/types";

/**
 * Mock delay to simulate network latency
 */
const mockDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a unique ID
 */
const generateId = () => crypto.randomUUID();

/**
 * Mock agent hook for workspace chat
 * This is a mock implementation that will be replaced with real backend integration
 */
export function useAgent(workspaceId: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [toolUsages, setToolUsages] = useState<ToolUsage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Send a message to the agent
   */
  const sendMessage = useCallback(
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
        // Mock streaming response
        await mockDelay(500);

        // Simulate different responses based on content
        if (content.toLowerCase().includes("plan")) {
          // Simulate plan approval flow
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
          // Simulate question flow
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
          // Simulate tool use with task grouping
          // First add a text message describing what we're doing
          const thinkingMessage: AgentMessage = {
            id: generateId(),
            type: "text",
            content: "I'll search for documents matching your query.",
          };
          setMessages((prev) => [...prev, thinkingMessage]);
          await mockDelay(300);

          // Then add tool use
          const toolMessageId = generateId();
          const toolUseMessage: AgentMessage = {
            id: toolMessageId,
            type: "tool_use",
            name: "search_documents",
            input: { query: content, limit: 10 },
          };
          setMessages((prev) => [...prev, toolUseMessage]);

          // Add to tool usages
          const toolUsage: ToolUsage = {
            id: toolMessageId,
            name: "search_documents",
            displayName: "Search Documents",
            input: { query: content, limit: 10 },
            timestamp: Date.now(),
          };
          setToolUsages((prev) => [...prev, toolUsage]);

          await mockDelay(1000);

          // Add tool result
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

          // Update tool usage with output
          setToolUsages((prev) =>
            prev.map((t) =>
              t.id === toolUseMessage.id
                ? { ...t, output: toolResultMessage.output }
                : t
            )
          );

          await mockDelay(300);

          // Add final text response
          const textMessage: AgentMessage = {
            id: generateId(),
            type: "text",
            content:
              "I found **2 relevant documents** based on your query.\n\n- Document 1: This is a sample document...\n- Document 2: Another relevant document...\n\nWould you like me to elaborate on any of them?",
          };
          setMessages((prev) => [...prev, textMessage]);
          setPhase("completed");
        } else if (content.toLowerCase().includes("error")) {
          // Simulate error
          throw new Error("This is a simulated error for testing purposes.");
        } else {
          // Default text response with streaming simulation
          const responseContent = `I received your message: "${content}"

This is a mock response from the agent. In a real implementation, this would be connected to an actual AI agent backend that can:

1. **Process natural language** - Understand your requests
2. **Execute tools** - Search documents, run code, etc.
3. **Generate plans** - Break down complex tasks
4. **Ask clarifying questions** - When more information is needed

The workspace ID for this session is: \`${workspaceId}\`

### Code Example

\`\`\`typescript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

> Try typing "plan", "question", "tool", or "error" to see different mock responses.`;

          // Simulate streaming by adding characters progressively
          let currentContent = "";
          const textMessage: AgentMessage = {
            id: generateId(),
            type: "text",
            content: "",
          };
          setMessages((prev) => [...prev, textMessage]);

          for (let i = 0; i < responseContent.length; i += 10) {
            if (abortControllerRef.current?.signal.aborted) {
              break;
            }
            currentContent = responseContent.slice(0, i + 10);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === textMessage.id ? { ...m, content: currentContent } : m
              )
            );
            await mockDelay(20);
          }

          // Ensure full content is shown
          setMessages((prev) =>
            prev.map((m) =>
              m.id === textMessage.id ? { ...m, content: responseContent } : m
            )
          );
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

        // Update step status
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

      // Mark all steps as completed
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

      // Add result message
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

    // Mark plan as cancelled
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
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPendingPlan(null);
    setPendingQuestions(null);
    setIsStreaming(false);
    setPhase("idle");
  }, []);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setArtifacts([]);
    setToolUsages([]);
    setError(null);
    setPhase("idle");
  }, []);

  return {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    artifacts,
    toolUsages,
    error,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
  };
}
