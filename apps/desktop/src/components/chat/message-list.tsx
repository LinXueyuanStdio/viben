import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, Loader2, ChevronDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./message-item";
import { ToolExecutionItem } from "./tool-execution-item";
import { QuestionInput } from "./question-input";
import type { AgentMessage, PendingQuestion, TaskPlan } from "@/types";

interface MessageListProps {
  messages: AgentMessage[];
  isStreaming?: boolean;
  pendingPlan?: TaskPlan | null;
  pendingQuestions?: PendingQuestion | null;
  onApprovePlan?: () => void;
  onRejectPlan?: () => void;
  onAnswerQuestions?: (answers: Record<string, string[]>) => void;
  className?: string;
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
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Group messages for display - must be called before any conditional returns
  const groups = React.useMemo(
    () => groupMessages(messages, isStreaming || false),
    [messages, isStreaming]
  );

  // Auto-scroll to bottom when new messages arrive
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingQuestions]);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={cn("flex flex-1 items-center justify-center", className)}>
        <div className="text-center max-w-md px-4">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
            {t("chat.welcomeTitle")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t("chat.welcomeDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div ref={scrollRef} className="space-y-4 p-4 pb-8">
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
  );
}
