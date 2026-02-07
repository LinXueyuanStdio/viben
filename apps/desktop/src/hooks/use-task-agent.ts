import { useCallback, useState, useRef, useEffect } from "react";
import type {
  AgentMessage,
  AgentPhase,
  MessageAttachment,
  TaskPlan,
  PendingQuestion,
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
 * Task context for agent conversations
 */
export interface TaskContext {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  tags?: Array<{ id: string; name: string; color?: string }>;
}

/**
 * Format task context as a system message
 */
function formatTaskContext(task: TaskContext): string {
  const tagNames = task.tags?.map((t) => t.name).join(", ") || "None";

  return `## Current Task Context
- **Title**: ${task.title}
- **Status**: ${task.status}
- **Tags**: ${tagNames}
- **Description**: ${task.description || "No description provided"}

I'm here to help you discuss and implement this task. Feel free to ask questions about requirements, suggest implementation approaches, or discuss any challenges.`;
}

/**
 * In-memory storage for task conversations
 * Key: taskId, Value: messages array
 */
const taskConversations = new Map<string, AgentMessage[]>();

/**
 * Task-specific agent hook for kanban task detail panel
 * Extends useAgent with task context injection and per-task conversation history
 */
export function useTaskAgent(taskId: string, taskContext: TaskContext | null) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<TaskPlan | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion | null>(null);
  const [toolUsages, setToolUsages] = useState<ToolUsage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const previousTaskIdRef = useRef<string | null>(null);

  // Load conversation history when taskId changes
  useEffect(() => {
    if (taskId && taskId !== previousTaskIdRef.current) {
      // Save current conversation if there was a previous task
      if (previousTaskIdRef.current && messages.length > 0) {
        taskConversations.set(previousTaskIdRef.current, messages);
      }

      // Load conversation for new task
      const savedMessages = taskConversations.get(taskId);
      if (savedMessages && savedMessages.length > 0) {
        setMessages(savedMessages);
      } else {
        setMessages([]);
      }

      // Reset state
      setPhase("idle");
      setIsStreaming(false);
      setPendingPlan(null);
      setPendingQuestions(null);
      setError(null);

      previousTaskIdRef.current = taskId;
    }
  }, [taskId, messages]);

  // Save conversation when messages change
  useEffect(() => {
    if (taskId && messages.length > 0) {
      taskConversations.set(taskId, messages);
    }
  }, [taskId, messages]);

  /**
   * Send a message to the agent with task context
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

        // Check if this is the first message - inject task context
        const isFirstMessage = messages.length === 0;

        // Build context-aware response
        let responseContent: string;

        if (isFirstMessage && taskContext) {
          // First message - include task context in response
          const contextInfo = formatTaskContext(taskContext);
          responseContent = `${contextInfo}

---

Regarding your question: "${content}"

I understand you're working on the task "${taskContext.title}". Let me help you with that.

This is a mock response. In a real implementation, the agent would:
1. Analyze the task context and your question
2. Provide relevant suggestions or answers
3. Help break down the implementation steps

Try asking about:
- Implementation approach
- Potential challenges
- Best practices
- Code examples`;
        } else if (content.toLowerCase().includes("plan")) {
          // Simulate plan approval flow
          const plan: TaskPlan = {
            goal: taskContext
              ? `Implement task: ${taskContext.title}`
              : `Execute: ${content}`,
            steps: [
              { id: "1", description: "Analyze requirements", status: "pending" },
              { id: "2", description: "Design solution", status: "pending" },
              { id: "3", description: "Implement changes", status: "pending" },
              { id: "4", description: "Test and verify", status: "pending" },
            ],
            notes: taskContext?.description || "Implementation plan for the task.",
          };

          const planMessage: AgentMessage = {
            id: generateId(),
            type: "plan",
            plan,
          };
          setMessages((prev) => [...prev, planMessage]);
          setPendingPlan(plan);
          setPhase("awaiting_approval");
          setIsStreaming(false);
          return;
        } else if (content.toLowerCase().includes("question")) {
          // Simulate question flow
          const questions: PendingQuestion = {
            id: generateId(),
            questions: [
              {
                header: "Implementation Preference",
                question: "How would you like to approach this task?",
                options: [
                  { label: "Quick Fix", description: "Minimal changes, fast delivery" },
                  { label: "Refactor", description: "Clean up related code" },
                  { label: "Full Implementation", description: "Complete feature with tests" },
                ],
                multiSelect: false,
              },
            ],
          };
          setPendingQuestions(questions);
          setPhase("awaiting_input");
          setIsStreaming(false);
          return;
        } else {
          // Default context-aware response
          const taskInfo = taskContext
            ? `\n\nI'm helping you with the task: **${taskContext.title}** (Status: ${taskContext.status})`
            : "";

          responseContent = `I received your message: "${content}"${taskInfo}

This is a mock response from the task agent. In a real implementation, the agent would:

1. **Understand the task context** - Use the task title, description, and status
2. **Provide relevant suggestions** - Based on the task requirements
3. **Help with implementation** - Code examples, architecture decisions
4. **Track progress** - Update task status as work progresses

Try these commands:
- Type "plan" to see an execution plan
- Type "question" to see a clarification flow
- Ask anything about the task implementation`;
        }

        // Simulate streaming by adding characters progressively
        let currentContent = "";
        const textMessage: AgentMessage = {
          id: generateId(),
          type: "text",
          content: "",
        };
        setMessages((prev) => [...prev, textMessage]);

        for (let i = 0; i < responseContent.length; i += 15) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }
          currentContent = responseContent.slice(0, i + 15);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === textMessage.id ? { ...m, content: currentContent } : m
            )
          );
          await mockDelay(15);
        }

        // Ensure full content is shown
        setMessages((prev) =>
          prev.map((m) =>
            m.id === textMessage.id ? { ...m, content: responseContent } : m
          )
        );
        setPhase("completed");
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
    [taskContext, messages.length]
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
        await mockDelay(800);

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
      content: "Plan rejected. How would you like me to proceed with this task?",
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
          content: `Got it! You chose: **${selectedAnswers}**. I'll proceed with this approach for the task.`,
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
   * Clear all messages for current task
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolUsages([]);
    setError(null);
    setPhase("idle");
    // Also clear from storage
    if (taskId) {
      taskConversations.delete(taskId);
    }
  }, [taskId]);

  return {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
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
