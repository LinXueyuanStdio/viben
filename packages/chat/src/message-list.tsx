import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, ChevronDown, CheckCircle2, ArrowDown } from "lucide-react";
import { cn, ScrollArea } from "@viben/ui";
import { MessageItem } from "./message-item";
import { ToolExecutionItem } from "./tool-execution-item";
import { QuestionInput } from "./question-input";
import type { AgentMessage, PendingQuestion, TaskPlan } from "./types";

export interface MessageListProps {
  messages: AgentMessage[];
  isStreaming?: boolean;
  pendingPlan?: TaskPlan | null;
  pendingQuestions?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
  className?: string;
  /** Custom link handler for markdown links */
  onLinkClick?: (href: string) => void;
  /** Custom welcome title (translation key or string) */
  welcomeTitle?: string;
  /** Custom welcome description (translation key or string) */
  welcomeDescription?: string;
  /** Custom welcome content (replaces default welcome UI) */
  welcomeContent?: React.ReactNode;
  /** Enable auto-scroll to bottom on new messages (default: true when streaming) */
  autoScroll?: boolean;
}

// Types for message grouping
interface ToolWithResult {
  message: AgentMessage;
  globalIndex: number;
  result?: AgentMessage;
}

interface TaskMessageGroup {
  type: "task";
  title: string;
  description: string;
  tools: ToolWithResult[];
  isCompleted: boolean;
}

interface OtherMessageGroup {
  type: "other";
  message: AgentMessage;
}

type MessageGroup = TaskMessageGroup | OtherMessageGroup;

/**
 * Task Group Component - shows text description and collapsible tool list
 */
function TaskGroupComponent({
  title,
  description,
  tools,
  isCompleted,
  isRunning,
}: {
  title: string;
  description: string;
  tools: ToolWithResult[];
  isCompleted: boolean;
  isRunning: boolean;
}) {
  const { t } = useTranslation();
  // Default: collapsed when completed, expanded when running or in progress
  const [isExpanded, setIsExpanded] = React.useState(!isCompleted || isRunning);

  // Auto-collapse when task completes
  React.useEffect(() => {
    if (isCompleted && !isRunning) {
      setIsExpanded(false);
    }
  }, [isCompleted, isRunning]);

  return (
    <div className="min-w-0 space-y-3">
      {/* Task description with status icon */}
      {description && (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {isCompleted ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            ) : (
              <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                <div className="bg-primary size-2 animate-pulse rounded-full" />
              </div>
            )}
            <span className="text-foreground line-clamp-2 min-w-0 text-sm font-medium break-words">
              {title}
            </span>
          </div>
        </div>
      )}

      {/* Collapsible tool list */}
      {tools.length > 0 && (
        <div className="border-border/40 bg-accent/20 min-w-0 overflow-hidden rounded-xl border">
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/30 flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-sm transition-colors"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform",
                !isExpanded && "-rotate-90"
              )}
            />
            <span className="flex-1 text-left">
              {isExpanded
                ? t("chat.hideSteps", { defaultValue: "Hide steps" })
                : t("chat.showSteps", {
                    count: tools.length,
                    defaultValue: `Show ${tools.length} steps`,
                  }).replace("{count}", String(tools.length))}
            </span>
          </button>

          {/* Tool list */}
          {isExpanded && (
            <div className="px-2 pb-2 space-y-1">
              {tools.map(({ message, globalIndex, result }) => (
                <ToolExecutionItem
                  key={globalIndex}
                  name={message.name || "unknown"}
                  displayName={message.name}
                  input={message.input}
                  output={result?.output}
                  isError={result?.isError}
                  isExecuting={!result}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Group messages into task groups for better display
 */
function groupMessages(
  messages: AgentMessage[],
  isRunning: boolean
): MessageGroup[] {
  const groups: MessageGroup[] = [];

  // Pre-process: find the last text message index in each segment between user messages
  const lastTextIndicesInSegments = new Set<number>();

  // Find segment boundaries (user messages and result)
  const segmentBoundaries: number[] = [];
  messages.forEach((msg, idx) => {
    if (msg.type === "user" || msg.type === "result") {
      segmentBoundaries.push(idx);
    }
  });
  segmentBoundaries.push(messages.length); // End boundary

  // For each segment, find the last text message
  let segmentStart = 0;
  for (const boundary of segmentBoundaries) {
    for (let i = boundary - 1; i >= segmentStart; i--) {
      if (messages[i].type === "text" && messages[i].content) {
        lastTextIndicesInSegments.add(i);
        break;
      }
    }
    segmentStart = boundary + 1;
  }

  // Filter messages: only keep the last text message in each segment
  const mergedMessages: AgentMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "text" && msg.content) {
      // Only keep text messages that are the last in their segment
      if (lastTextIndicesInSegments.has(i)) {
        mergedMessages.push(msg);
      }
    } else {
      mergedMessages.push(msg);
    }
  }

  // Collect all tool_result messages in order for matching with tool_use
  const toolResultMessages: AgentMessage[] = [];
  mergedMessages.forEach((msg) => {
    if (msg.type === "tool_result") {
      toolResultMessages.push(msg);
    }
  });

  // Match tool_use with tool_result by index
  const getToolResult = (toolUseIndex: number): AgentMessage | undefined => {
    return toolResultMessages[toolUseIndex];
  };

  // Filter out duplicate plan messages - only keep the last one
  const lastPlanIdx = mergedMessages.reduce(
    (lastIdx, msg, idx) => (msg.type === "plan" ? idx : lastIdx),
    -1
  );
  const filteredMessages =
    lastPlanIdx >= 0
      ? mergedMessages.filter(
          (msg, idx) => msg.type !== "plan" || idx === lastPlanIdx
        )
      : mergedMessages;

  // Find the last result message index
  let lastResultIndex = -1;
  filteredMessages.forEach((msg, index) => {
    if (msg.type === "result") {
      lastResultIndex = index;
    }
  });

  // Process messages into groups
  let toolGlobalIndex = 0;
  let toolUseIndex = 0;

  const state = { currentGroup: null as TaskMessageGroup | null };

  const pushCurrentGroup = (completed: boolean) => {
    if (
      state.currentGroup &&
      (state.currentGroup.tools.length > 0 || state.currentGroup.description)
    ) {
      state.currentGroup.isCompleted = completed;
      groups.push(state.currentGroup);
      state.currentGroup = null;
    }
  };

  const ensureCurrentGroup = () => {
    if (!state.currentGroup) {
      state.currentGroup = {
        type: "task",
        title: "Executing task",
        description: "",
        tools: [],
        isCompleted: false,
      };
    }
    return state.currentGroup;
  };

  let lastTextContent = "";
  let pendingTextMessage: AgentMessage | null = null;

  filteredMessages.forEach((message, msgIndex) => {
    if (message.type === "text" && message.content) {
      // Skip duplicate consecutive text messages
      if (message.content === lastTextContent) {
        return;
      }

      // Skip text messages that contain raw plan JSON
      const trimmedContent = message.content.trim();
      if (
        trimmedContent.startsWith("{") &&
        trimmedContent.includes('"type"') &&
        trimmedContent.includes('"plan"')
      ) {
        return;
      }

      lastTextContent = message.content;

      // If there's a pending text message that had no tools, render it as standalone
      if (pendingTextMessage) {
        groups.push({ type: "other", message: pendingTextMessage });
      }

      // Push any current tool group
      pushCurrentGroup(true);

      // Store this text as pending
      pendingTextMessage = message;
      state.currentGroup = null;
    } else if (message.type === "tool_use" && message.name) {
      // Text followed by tool_use - create a task group with the text as description
      if (pendingTextMessage) {
        const title =
          (pendingTextMessage.content || "").slice(0, 80) +
          ((pendingTextMessage.content || "").length > 80 ? "..." : "");
        state.currentGroup = {
          type: "task",
          title,
          description: pendingTextMessage.content || "",
          tools: [],
          isCompleted: false,
        };
        pendingTextMessage = null;
      }
      const group = ensureCurrentGroup();
      const result = getToolResult(toolUseIndex);
      group.tools.push({ message, globalIndex: toolGlobalIndex++, result });
      toolUseIndex++;
    } else if (message.type === "tool_result") {
      // Skip tool_result messages as they're associated with tool_use
    } else if (message.type === "user") {
      if (pendingTextMessage) {
        groups.push({ type: "other", message: pendingTextMessage });
        pendingTextMessage = null;
      }
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    } else if (message.type === "result") {
      // Only show the last result message
      if (msgIndex === lastResultIndex) {
        if (pendingTextMessage) {
          groups.push({ type: "other", message: pendingTextMessage });
          pendingTextMessage = null;
        }
        pushCurrentGroup(true);
        groups.push({ type: "other", message });
      }
    } else if (message.type === "error") {
      if (pendingTextMessage) {
        groups.push({ type: "other", message: pendingTextMessage });
        pendingTextMessage = null;
      }
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    } else if (message.type === "plan") {
      if (pendingTextMessage) {
        groups.push({ type: "other", message: pendingTextMessage });
        pendingTextMessage = null;
      }
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    }
  });

  // Push any remaining pending text as standalone message
  if (pendingTextMessage) {
    groups.push({ type: "other", message: pendingTextMessage });
  }

  // Push any remaining tool group
  pushCurrentGroup(!isRunning);

  return groups;
}

/**
 * Running indicator component - shows current activity
 */
function RunningIndicator({ messages }: { messages: AgentMessage[] }) {
  const { t } = useTranslation();

  // Find the last tool_use message to show current activity
  const lastToolUse = [...messages].reverse().find((m) => m.type === "tool_use");

  // Get description of current activity
  const getActivityText = () => {
    if (!lastToolUse?.name) {
      return t("chat.thinking", { defaultValue: "Thinking..." });
    }

    const input = lastToolUse.input as Record<string, unknown> | undefined;

    switch (lastToolUse.name) {
      case "Bash":
        return "Running command...";
      case "Read": {
        const readFile = input?.file_path
          ? String(input.file_path).split("/").pop()
          : "";
        return `Reading ${readFile || "file"}...`;
      }
      case "Write": {
        const writeFile = input?.file_path
          ? String(input.file_path).split("/").pop()
          : "";
        return `Writing ${writeFile || "file"}...`;
      }
      case "Edit": {
        const editFile = input?.file_path
          ? String(input.file_path).split("/").pop()
          : "";
        return `Editing ${editFile || "file"}...`;
      }
      case "Grep":
        return "Searching...";
      case "Glob":
        return "Finding files...";
      case "WebSearch":
        return "Searching web...";
      case "WebFetch":
        return "Fetching page...";
      case "Task":
        return "Running subtask...";
      default:
        return `Running ${lastToolUse.name}...`;
    }
  };

  return (
    <div className="flex items-center gap-2 py-2">
      {/* Spinning loader */}
      <div className="relative size-4 shrink-0">
        <svg className="size-4 animate-spin" viewBox="0 0 24 24">
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            style={{ color: "#d97706" }}
          />
          <path
            className="opacity-80"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            d="M12 2a10 10 0 0 1 10 10"
            style={{ color: "#d97706" }}
          />
        </svg>
      </div>
      <span className="text-muted-foreground text-sm">{getActivityText()}</span>
    </div>
  );
}

export function MessageList({
  messages,
  isStreaming,
  pendingPlan,
  pendingQuestions,
  onApprovePlan,
  onRejectPlan,
  onAnswerQuestions,
  className,
  onLinkClick,
  welcomeTitle,
  welcomeDescription,
  welcomeContent,
  autoScroll,
}: MessageListProps) {
  const { t } = useTranslation();
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Scroll management state
  const [showScrollButton, setShowScrollButton] = React.useState(false);
  const userScrolledUpRef = React.useRef(false);
  const lastScrollTopRef = React.useRef(0);

  // Group messages for display - must be called before any conditional returns
  const groups = React.useMemo(
    () => groupMessages(messages, isStreaming || false),
    [messages, isStreaming]
  );

  // Scroll to bottom function
  const scrollToBottom = React.useCallback(() => {
    userScrolledUpRef.current = false;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Check scroll position to show/hide scroll button and detect manual scroll
  const checkScrollPosition = React.useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Detect if user scrolled up (scroll position decreased)
    if (
      isStreaming &&
      scrollTop < lastScrollTopRef.current &&
      distanceFromBottom > 100
    ) {
      userScrolledUpRef.current = true;
    }

    // If user scrolled to near bottom, re-enable auto-scroll
    if (distanceFromBottom < 50) {
      userScrolledUpRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;

    // Show button if more than 200px from bottom
    setShowScrollButton(distanceFromBottom > 200);
  }, [isStreaming]);

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  // Use autoScroll prop if provided, otherwise default to auto-scroll when streaming
  const shouldAutoScroll = autoScroll !== undefined ? autoScroll : isStreaming;
  React.useEffect(() => {
    if (shouldAutoScroll && !userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll, pendingQuestions]);

  // Reset userScrolledUp when streaming stops
  React.useEffect(() => {
    if (!isStreaming) {
      userScrolledUpRef.current = false;
    }
  }, [isStreaming]);

  // Add scroll listener to viewport
  React.useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScrollPosition);
    // Initial check
    checkScrollPosition();

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
    };
  }, [checkScrollPosition]);

  // Re-check scroll position when messages load
  React.useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        checkScrollPosition();
      });
    }
  }, [messages.length, checkScrollPosition]);

  // Empty state
  if (messages.length === 0) {
    // Use custom welcome content if provided
    if (welcomeContent) {
      return (
        <div className={cn("flex flex-1 items-center justify-center", className)}>
          {welcomeContent}
        </div>
      );
    }

    // Default welcome UI
    return (
      <div className={cn("flex flex-1 items-center justify-center", className)}>
        <div className="text-center max-w-md px-4">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
            {welcomeTitle || t("chat.welcomeTitle", "How can I help you?")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {welcomeDescription || t("chat.welcomeDescription", "Ask me anything to get started.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex-1", className)}>
      <ScrollArea className="h-full" viewportRef={viewportRef}>
        <div className="space-y-4 p-4 pb-8">
          {groups.map((group, index) => {
            if (group.type === "task") {
              return (
                <TaskGroupComponent
                  key={index}
                  title={group.title}
                  description={group.description}
                  tools={group.tools}
                  isCompleted={group.isCompleted}
                  isRunning={isStreaming || false}
                />
              );
            }

            const message = group.message;
            const isPlanMessage = message.type === "plan" && message.plan;

            return (
              <MessageItem
                key={message.id || index}
                message={message}
                isStreaming={
                  index === groups.length - 1 &&
                  isStreaming &&
                  message.type === "text"
                }
                onApprovePlan={onApprovePlan}
                onRejectPlan={onRejectPlan}
                isPlanPending={isPlanMessage && pendingPlan !== null}
                onLinkClick={onLinkClick}
              />
            );
          })}

          {/* Running indicator */}
          {isStreaming && <RunningIndicator messages={messages} />}

          {/* Pending questions */}
          {pendingQuestions && onAnswerQuestions && (
            <QuestionInput
              questions={pendingQuestions}
              onSubmit={onAnswerQuestions}
            />
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-4 left-1/2 z-10 -translate-x-1/2",
            "flex items-center justify-center p-2",
            "bg-background border border-border rounded-full shadow-lg",
            "hover:bg-accent transition-all cursor-pointer",
            "animate-in fade-in slide-in-from-bottom-2 duration-200"
          )}
          title={t("chat.scrollToBottom", { defaultValue: "Scroll to bottom" })}
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
