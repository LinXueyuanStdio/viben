import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bot, ChevronDown, CheckCircle2 } from "lucide-react";
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
      {title && (
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
                ? t("chat.hideSteps")
                : t("chat.showSteps").replace("{count}", String(tools.length))}
            </span>
          </button>

          {/* Tool list */}
          {isExpanded && (
            <div className="space-y-1 px-2 pb-2">
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
function groupMessages(messages: AgentMessage[], isRunning: boolean): MessageGroup[] {
  const groups: MessageGroup[] = [];

  // Build a map of tool results by toolUseId
  const toolResultMap = new Map<string, AgentMessage>();
  messages.forEach((msg) => {
    if (msg.type === "tool_result" && msg.toolUseId) {
      toolResultMap.set(msg.toolUseId, msg);
    }
  });

  let currentGroup: TaskMessageGroup | null = null;
  let toolGlobalIndex = 0;
  let lastTextContent = "";

  const pushCurrentGroup = (completed: boolean) => {
    if (currentGroup && (currentGroup.tools.length > 0 || currentGroup.description)) {
      currentGroup.isCompleted = completed;
      groups.push(currentGroup);
      currentGroup = null;
    }
  };

  const ensureCurrentGroup = () => {
    if (!currentGroup) {
      currentGroup = {
        type: "task",
        title: "",
        description: "",
        tools: [],
        isCompleted: false,
      };
    }
    return currentGroup;
  };

  messages.forEach((message) => {
    if (message.type === "text" && message.content) {
      // Skip duplicate consecutive text messages
      if (message.content === lastTextContent) {
        return;
      }
      lastTextContent = message.content;

      // Push any current tool group
      pushCurrentGroup(true);

      // Check if this text is followed by tools - if so, start a new group
      // For now, just render it as standalone message
      groups.push({ type: "other", message });
      currentGroup = null;
    } else if (message.type === "tool_use" && message.name) {
      const group = ensureCurrentGroup();
      const result = message.id ? toolResultMap.get(message.id) : undefined;
      group.tools.push({ message, globalIndex: toolGlobalIndex++, result });
    } else if (message.type === "tool_result") {
      // Skip tool_result messages as they're associated with tool_use
    } else if (message.type === "user") {
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    } else if (message.type === "result") {
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    } else if (message.type === "error") {
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    } else if (message.type === "plan") {
      pushCurrentGroup(true);
      groups.push({ type: "other", message });
    }
  });

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
      return t("chat.thinking");
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

  // Group messages for display - must be called before any early returns
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
