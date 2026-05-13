import * as React from "react";
import { useState, useRef, useEffect, useMemo, useCallback, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bot, ChevronDown, CheckCircle2, ArrowDown } from "lucide-react";
import { cn, ScrollArea } from "@viben/ui";
import { MessageItem } from "./message-item";
import { ToolExecutionItem, type ArtifactInfo } from "./tool-execution-item";
import { CollapsedToolGroup } from "./collapsed-tool-group";
import type { PendingExecApproval } from "./exec-approval";
import { getDisplayPath } from "./utils";
import type { AgentMessage, PendingQuestion, TaskPlan } from "./types";

/** Artifact definition for linking with tool_use messages */
export interface Artifact {
  id: string;
  name: string;
  type: string;
  /** ID of the message that created this artifact */
  sourceMessageId?: string;
  /** Tool name that created this artifact (e.g., "Write", "Edit", "WebSearch") */
  toolName?: string;
}

/** Handle for imperative MessageList methods */
export interface MessageListHandle {
  /** Scroll to a message by ID */
  scrollToMessage: (messageId: string) => void;
}

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
  /**
   * Simple mode - displays messages in order without complex grouping.
   * Useful for read-only executor session viewing where messages are already structured.
   */
  simpleMode?: boolean;
  /**
   * Maximum width for message cards. Can be a CSS value like "800px", "100%", or "calc(100% - 32px)".
   * If not provided, messages will fill the available width.
   */
  maxMessageWidth?: string;
  /**
   * ID of message to highlight. When set, the message will have a highlight ring/glow effect
   * that fades out after ~2-3 seconds.
   */
  highlightedMessageId?: string | null;
  /**
   * Callback when scroll to message completes
   */
  onScrollToMessage?: (messageId: string) => void;
  /**
   * Artifacts for linking with tool_use messages.
   * When a Write/Edit tool creates/modifies a file, a badge will be shown linking to the artifact.
   */
  artifacts?: Artifact[];
  /**
   * Callback when an artifact badge is clicked in a tool_use message.
   */
  onArtifactClick?: (artifactId: string) => void;
  /**
   * When true, show full tool input/output inline in each ToolExecutionItem
   * without requiring a click-to-open modal. Useful for capsule/overlay views.
   */
  toolExpandedInline?: boolean;
  /**
   * Pending exec approval - renders inline at the bottom of the message list,
   * blocking further execution until the user makes a decision.
   */
  pendingApproval?: PendingExecApproval | null;
  /**
   * Called when the user makes an approval decision (allow_once, allow_always, reject).
   */
  onApprovalDecision?: (decision: string, feedback?: string) => void;
  /**
   * Callback to expand subagent messages in a side panel.
   */
  onExpandSubagent?: (title: string, subagentType: string | undefined, messages: AgentMessage[]) => void;
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
 * Get artifact info for a tool_use message if it created/modified a file
 */
function getArtifactInfoForMessage(
  message: AgentMessage,
  artifacts?: Artifact[]
): ArtifactInfo | undefined {
  if (!artifacts || artifacts.length === 0) return undefined;
  if (message.type !== "tool_use") return undefined;
  if (!message.id) return undefined;

  // Only show artifact badges for Write and Edit tools
  const toolName = message.name;
  if (toolName !== "Write" && toolName !== "Edit") return undefined;

  // Find artifact that was created by this message
  const artifact = artifacts.find((a) => a.sourceMessageId === message.id);
  if (!artifact) return undefined;

  return {
    id: artifact.id,
    name: artifact.name,
    type: artifact.type,
  };
}

/** Tool names that are considered "read-only" and can be auto-collapsed */
const COLLAPSIBLE_TOOL_NAMES = new Set(["Read", "Glob", "Grep"]);

/**
 * A single collapsed run of consecutive read/search tools.
 * Manages its own expanded state via useState.
 */
function CollapsedToolRun({
  tools,
  artifacts,
  onArtifactClick,
}: {
  tools: ToolWithResult[];
  artifacts?: Artifact[];
  onArtifactClick?: (artifactId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isExecuting = tools.some((t) => !t.result);

  return (
    <CollapsedToolGroup
      tools={tools.map(({ message, result }) => ({
        name: message.name || "unknown",
        input: message.input,
        output: result?.output,
        isError: result?.isError,
      }))}
      isExecuting={isExecuting}
      expanded={expanded}
      onToggle={() => setExpanded((prev) => !prev)}
    >
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
          artifactInfo={getArtifactInfoForMessage(message, artifacts)}
          onArtifactClick={onArtifactClick}
        />
      ))}
    </CollapsedToolGroup>
  );
}

/**
 * Walk through tools and group consecutive collapsible (Read/Glob/Grep) runs.
 * Returns an array of React elements mixing CollapsedToolRun and individual ToolExecutionItem.
 */
function renderToolsWithCollapsing(
  tools: ToolWithResult[],
  artifacts?: Artifact[],
  onArtifactClick?: (artifactId: string) => void
): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let collapsibleRun: ToolWithResult[] = [];

  const flushRun = () => {
    if (collapsibleRun.length >= 2) {
      elements.push(
        <CollapsedToolRun
          key={`collapsed-${collapsibleRun[0].globalIndex}`}
          tools={collapsibleRun}
          artifacts={artifacts}
          onArtifactClick={onArtifactClick}
        />
      );
    } else if (collapsibleRun.length === 1) {
      const { message, globalIndex, result } = collapsibleRun[0];
      elements.push(
        <ToolExecutionItem
          key={globalIndex}
          name={message.name || "unknown"}
          displayName={message.name}
          input={message.input}
          output={result?.output}
          isError={result?.isError}
          isExecuting={!result}
          compact
          artifactInfo={getArtifactInfoForMessage(message, artifacts)}
          onArtifactClick={onArtifactClick}
        />
      );
    }
    collapsibleRun = [];
  };

  for (const tool of tools) {
    if (COLLAPSIBLE_TOOL_NAMES.has(tool.message.name || "")) {
      collapsibleRun.push(tool);
    } else {
      flushRun();
      const { message, globalIndex, result } = tool;
      elements.push(
        <ToolExecutionItem
          key={globalIndex}
          name={message.name || "unknown"}
          displayName={message.name}
          input={message.input}
          output={result?.output}
          isError={result?.isError}
          isExecuting={!result}
          compact
          artifactInfo={getArtifactInfoForMessage(message, artifacts)}
          onArtifactClick={onArtifactClick}
        />
      );
    }
  }

  flushRun();

  return elements;
}

/**
 * Turn separator - subtle horizontal divider between conversation turns.
 * Shown before each user message (except the very first group).
 */
function TurnSeparator({ timestamp }: { timestamp?: number }) {
  const timeStr = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 border-t border-border/40" />
      {timeStr && (
        <span className="text-[10px] text-muted-foreground/50 shrink-0">{timeStr}</span>
      )}
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

/**
 * Build a collapsed summary for task group tools.
 * When completed: "Read 3 files, ran 2 commands"
 * When running: "Running... (N steps)"
 */
function useTaskGroupSummary(
  tools: ToolWithResult[],
  isCompleted: boolean,
  isRunning: boolean,
  t: ReturnType<typeof useTranslation>["t"]
): string {
  return useMemo(() => {
    if (!isCompleted && isRunning) {
      return t("chat.taskGroup.running", {
        count: tools.length,
        defaultValue: `Running... (${tools.length} steps)`,
      }).replace("{{count}}", String(tools.length));
    }

    // Build summary from tool categories
    const counts = { read: 0, search: 0, bash: 0, write: 0, edit: 0, other: 0 };
    for (const tool of tools) {
      switch (tool.message.name) {
        case "Read": counts.read++; break;
        case "Glob":
        case "Grep": counts.search++; break;
        case "Bash": counts.bash++; break;
        case "Write": counts.write++; break;
        case "Edit":
        case "MultiEdit": counts.edit++; break;
        default: counts.other++; break;
      }
    }

    const parts: string[] = [];
    if (counts.read > 0) {
      parts.push(t("chat.collapsedGroup.readFiles", {
        count: counts.read,
        defaultValue: `Read ${counts.read} files`,
      }) as string);
    }
    if (counts.search > 0) {
      parts.push(t("chat.collapsedGroup.searchedPatterns", {
        count: counts.search,
        defaultValue: `Searched ${counts.search} patterns`,
      }) as string);
    }
    if (counts.bash > 0) {
      parts.push(t("chat.collapsedGroup.ranCommands", {
        count: counts.bash,
        defaultValue: `Ran ${counts.bash} commands`,
      }) as string);
    }
    if (counts.write > 0) {
      parts.push(t("chat.collapsedGroup.wroteFiles", {
        count: counts.write,
        defaultValue: `Wrote ${counts.write} files`,
      }) as string);
    }
    if (counts.edit > 0) {
      parts.push(t("chat.collapsedGroup.editedFiles", {
        count: counts.edit,
        defaultValue: `Edited ${counts.edit} files`,
      }) as string);
    }
    if (counts.other > 0) {
      parts.push(t("chat.collapsedGroup.usedTools", {
        count: counts.other,
        defaultValue: `Used ${counts.other} tools`,
      }) as string);
    }

    if (parts.length === 0) {
      return t("chat.showSteps", {
        count: tools.length,
        defaultValue: `Show ${tools.length} steps`,
      }).replace("{{count}}", String(tools.length));
    }

    return parts.join(", ");
  }, [tools, isCompleted, isRunning, t]);
}

/**
 * Task Group Component - shows text description and collapsible tool list
 */
function TaskGroupComponent({
  title,
  description,
  tools,
  isCompleted,
  isRunning,
  artifacts,
  onArtifactClick,
}: {
  title: string;
  description: string;
  tools: ToolWithResult[];
  isCompleted: boolean;
  isRunning: boolean;
  artifacts?: Artifact[];
  onArtifactClick?: (artifactId: string) => void;
}) {
  const { t } = useTranslation();
  // Default: collapsed when completed, expanded when running or in progress
  const [isExpanded, setIsExpanded] = useState(!isCompleted || isRunning);

  // Auto-collapse when task completes
  useEffect(() => {
    if (isCompleted && !isRunning) {
      setIsExpanded(false);
    }
  }, [isCompleted, isRunning]);

  // Build summarized text for collapsed state
  const collapsedSummary = useTaskGroupSummary(tools, isCompleted, isRunning, t);

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
                : collapsedSummary}
            </span>
          </button>

          {/* Tool list */}
          {isExpanded && (
            <div className="px-2 pb-2 space-y-1">
              {renderToolsWithCollapsing(tools, artifacts, onArtifactClick)}
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
  isRunning: boolean,
  t: (key: string, defaultValue: string) => string
): MessageGroup[] {
  const groups: MessageGroup[] = [];

  // Pre-process: merge consecutive text messages (streaming pattern).
  // When multiple text messages appear in a row with no other message types between them,
  // keep only the last one (it's the final streaming update). But text messages separated
  // by tool_use/tool_result or other message types are distinct and should ALL be preserved.
  const mergedMessages: AgentMessage[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.type === "text" && msg.content) {
      // Check if the next message is also a text message (consecutive streaming pattern)
      const next = messages[i + 1];
      if (next && next.type === "text" && next.content) {
        // Skip this text message - the next one is a more complete streaming update
        continue;
      }
      mergedMessages.push(msg);
    } else {
      mergedMessages.push(msg);
    }
  }

  // Collect all tool_result messages in a Map for matching with tool_use by toolUseId
  const toolResultMap = new Map<string, AgentMessage>();
  mergedMessages.forEach((msg) => {
    if (msg.type === "tool_result" && msg.toolUseId) {
      toolResultMap.set(msg.toolUseId, msg);
    }
  });

  // Match tool_use with tool_result by toolUseId
  const getToolResult = (toolUseId: string): AgentMessage | undefined => {
    return toolResultMap.get(toolUseId);
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
        title: t("chat.activity.executingTask", "Executing task"),
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
      // Agent/Task tools are rendered standalone (full mode with subagent props)
      if (message.name === "Agent" || message.name === "Task") {
        if (pendingTextMessage) {
          groups.push({ type: "other", message: pendingTextMessage });
          pendingTextMessage = null;
        }
        pushCurrentGroup(true);
        // Merge tool_result into the tool_use message for standalone rendering
        const result = message.toolUseId ? getToolResult(message.toolUseId) : undefined;
        if (result && !message.output) {
          message.output = result.output;
          message.isError = result.isError;
        }
        groups.push({ type: "other", message });
      } else {
        // Text followed by tool_use - emit the text as a standalone message,
        // then start a fresh tool group. This ensures long text messages are
        // rendered in full rather than being truncated into a task group header.
        if (pendingTextMessage) {
          groups.push({ type: "other", message: pendingTextMessage });
          pendingTextMessage = null;
        }
        const group = ensureCurrentGroup();
        const result = message.toolUseId ? getToolResult(message.toolUseId) : undefined;
        group.tools.push({ message, globalIndex: toolGlobalIndex++, result });
      }
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
    } else if (message.type === "thinking") {
      // Thinking messages are rendered as standalone collapsible items
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
 * Extract a short path from a full file path for display.
 * Delegates to the centralized `getDisplayPath` utility.
 * e.g. "/Users/foo/project/src/components/App.tsx" -> "src/components/App.tsx"
 */
function shortPath(filePath: string): string {
  return getDisplayPath(filePath);
}

/**
 * Truncate a string to maxLen characters, appending ellipsis if truncated.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

/**
 * Running indicator component - shows current activity with elapsed time
 */
function RunningIndicator({ messages }: { messages: AgentMessage[] }) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(0);

  // Find the last tool_use message that has no matching tool_result
  const lastToolUse = useMemo(() => {
    const toolResultIds = new Set<string>();
    for (const m of messages) {
      if (m.type === "tool_result" && m.toolUseId) {
        toolResultIds.add(m.toolUseId);
      }
    }
    // Find last unresolved tool_use
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "tool_use" && m.toolUseId && !toolResultIds.has(m.toolUseId)) {
        return m;
      }
    }
    // Fallback: last tool_use regardless of result status
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "tool_use") return messages[i];
    }
    return undefined;
  }, [messages]);

  // Stable key for the current tool invocation
  const toolKey = lastToolUse?.id ?? lastToolUse?.toolUseId;

  // Reset and start timer when the active tool changes
  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [toolKey]);

  // Get description of current activity
  const activityText = useMemo(() => {
    if (!lastToolUse?.name) {
      return t("chat.thinking", { defaultValue: "Thinking..." });
    }

    const input = lastToolUse.input as Record<string, unknown> | undefined;

    switch (lastToolUse.name) {
      case "Bash": {
        const cmd = input?.command ? String(input.command).trim() : "";
        if (cmd) {
          return t("chat.activity.runningCommand", {
            defaultValue: "Running: {{command}}",
            command: truncate(cmd, 60),
          });
        }
        return t("chat.activity.runningCommand", {
          defaultValue: "Running command...",
        });
      }
      case "Read": {
        const readFile = input?.file_path
          ? shortPath(String(input.file_path))
          : "";
        return t("chat.activity.readingFile", {
          defaultValue: "Reading {{file}}...",
          file: readFile || "file",
        });
      }
      case "Write": {
        const writeFile = input?.file_path
          ? shortPath(String(input.file_path))
          : "";
        return t("chat.activity.writingFile", {
          defaultValue: "Writing {{file}}...",
          file: writeFile || "file",
        });
      }
      case "Edit": {
        const editFile = input?.file_path
          ? shortPath(String(input.file_path))
          : "";
        return t("chat.activity.editingFile", {
          defaultValue: "Editing {{file}}...",
          file: editFile || "file",
        });
      }
      case "Grep": {
        const pattern = input?.pattern ? String(input.pattern) : "";
        if (pattern) {
          return t("chat.activity.searching", {
            defaultValue: 'Searching for "{{pattern}}"...',
            pattern: truncate(pattern, 40),
          });
        }
        return t("chat.activity.searching", {
          defaultValue: "Searching...",
        });
      }
      case "Glob": {
        const globPattern = input?.pattern ? String(input.pattern) : "";
        if (globPattern) {
          return t("chat.activity.findingFiles", {
            defaultValue: "Finding files: {{pattern}}...",
            pattern: truncate(globPattern, 40),
          });
        }
        return t("chat.activity.findingFiles", {
          defaultValue: "Finding files...",
        });
      }
      case "WebSearch":
        return t("chat.activity.searchingWeb", "Searching web...");
      case "WebFetch":
        return t("chat.activity.fetchingPage", "Fetching page...");
      case "Task":
      case "Agent":
        return t("chat.activity.runningSubtask", "Running subtask...");
      default:
        return t("chat.activity.runningTool", {
          defaultValue: "Running {{name}}...",
          name: lastToolUse.name,
        });
    }
  }, [lastToolUse, t]);

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
      <div className="flex flex-col">
        <span className="text-muted-foreground text-sm">{activityText}</span>
        {elapsed >= 3 && (
          <span className="text-muted-foreground/60 text-xs">{elapsed}s</span>
        )}
      </div>
    </div>
  );
}

export const MessageList = React.forwardRef<MessageListHandle, MessageListProps>(function MessageList({
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
  simpleMode,
  maxMessageWidth,
  highlightedMessageId,
  onScrollToMessage,
  artifacts,
  onArtifactClick,
  toolExpandedInline,
  pendingApproval,
  onApprovalDecision,
  onExpandSubagent,
}, ref) {
  const { t } = useTranslation();

  const viewportRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll management state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const userScrolledUpRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  // Track count of messages that arrived while user is scrolled up
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenMessageCountRef = useRef(messages.length);
  const prefersReducedMotion = useReducedMotion();


  // Group messages for display - must be called before any conditional returns
  // In simpleMode, skip grouping and just create "other" groups for each message
  const groups = useMemo(
    () => simpleMode
      ? messages.map((msg): OtherMessageGroup => ({ type: "other", message: msg }))
      : groupMessages(messages, isStreaming || false, t),
    [messages, isStreaming, simpleMode, t]
  );

  // Track unread messages when user is scrolled up
  useEffect(() => {
    if (userScrolledUpRef.current && showScrollButton) {
      // Count new messages since last seen
      const newMessages = messages.length - lastSeenMessageCountRef.current;
      if (newMessages > 0) {
        setUnreadCount((prev) => prev + newMessages);
      }
    } else {
      setUnreadCount(0);
    }
    lastSeenMessageCountRef.current = messages.length;
  }, [messages.length, showScrollButton]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    setUnreadCount(0);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Track whether the user is actively interacting (wheel/touch/pointer)
  // This distinguishes user scrolls from programmatic scrollIntoView / overflowAnchor adjustments
  const userInteractingRef = useRef(false);

  // Check scroll position to show/hide scroll button and detect manual scroll
  const checkScrollPosition = useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Only detect scroll-up when user is actively interacting
    if (
      userInteractingRef.current &&
      scrollTop < lastScrollTopRef.current &&
      distanceFromBottom > 100
    ) {
      userScrolledUpRef.current = true;
    }

    // If user scrolled to near bottom, re-enable auto-scroll
    // Only allow re-enable during user interaction to prevent overflowAnchor false triggers
    if (userInteractingRef.current && distanceFromBottom < 150) {
      userScrolledUpRef.current = false;
    }

    lastScrollTopRef.current = scrollTop;

    // Show button if more than 200px from bottom
    setShowScrollButton(distanceFromBottom > 200);
  }, []);

  // Scroll to bottom on initial load
  const hasInitialScrolledRef = useRef(false);
  useEffect(() => {
    if (messages.length > 0 && !hasInitialScrolledRef.current) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
        hasInitialScrolledRef.current = true;
      });
    }
  }, [messages.length]);

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  // Use autoScroll prop if provided, otherwise default to auto-scroll when streaming
  const shouldAutoScroll = autoScroll !== undefined ? autoScroll : isStreaming;
  useEffect(() => {
    if (userScrolledUpRef.current) return;
    if (!shouldAutoScroll && messages.length === lastSeenMessageCountRef.current) return;

    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "instant" : "smooth",
    });
  }, [messages, shouldAutoScroll, isStreaming]);

  // Add scroll listener and user interaction detection to viewport
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    container.addEventListener("scroll", checkScrollPosition);

    // Track user interaction to distinguish manual scrolls from programmatic ones
    let interactTimeout: ReturnType<typeof setTimeout> | null = null;
    const markInteracting = () => {
      userInteractingRef.current = true;
      // Clear any pending timeout — user is still interacting
      if (interactTimeout) { clearTimeout(interactTimeout); interactTimeout = null; }
    };
    const clearInteractingDelayed = () => {
      // Delay clearing to cover momentum/inertial scrolling after gesture ends
      if (interactTimeout) clearTimeout(interactTimeout);
      interactTimeout = setTimeout(() => { userInteractingRef.current = false; }, 300);
    };
    // wheel fires continuously during trackpad scroll — mark interacting on each tick
    container.addEventListener("wheel", markInteracting);
    container.addEventListener("touchstart", markInteracting);
    container.addEventListener("pointerdown", markInteracting);
    // Clear only on gesture end (not on wheel — momentum continues after last wheel)
    container.addEventListener("pointerup", clearInteractingDelayed);
    container.addEventListener("touchend", clearInteractingDelayed);

    // Initial check
    checkScrollPosition();

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
      container.removeEventListener("wheel", markInteracting);
      container.removeEventListener("touchstart", markInteracting);
      container.removeEventListener("pointerdown", markInteracting);
      container.removeEventListener("pointerup", clearInteractingDelayed);
      container.removeEventListener("touchend", clearInteractingDelayed);
      if (interactTimeout) clearTimeout(interactTimeout);
    };
  }, [checkScrollPosition]);

  // Re-check scroll position when messages load
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        checkScrollPosition();
      });
    }
  }, [messages.length, checkScrollPosition]);

  // Track container width for content constraint
  // NOTE: These hooks must be declared before any early returns to follow React's rules of hooks
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [_containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const width = containerRef.current.getBoundingClientRect().width;
        setContainerWidth(width);
      }
    };

    // Update on mount and resize
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Message refs for scroll-to-message functionality
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Track highlight animation state
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);

  // Scroll to message function
  const scrollToMessage = useCallback((messageId: string) => {
    const element = messageRefsMap.current.get(messageId);
    if (element) {
      // Temporarily disable auto-scroll during manual scroll
      userScrolledUpRef.current = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      // Set active highlight
      setActiveHighlight(messageId);
      // Call callback after scroll completes (approximate timing)
      setTimeout(() => {
        onScrollToMessage?.(messageId);
      }, 500);
    }
  }, [onScrollToMessage]);

  // Expose scrollToMessage via ref
  useImperativeHandle(ref, () => ({
    scrollToMessage,
  }), [scrollToMessage]);

  // Handle highlightedMessageId prop changes - scroll and highlight
  useEffect(() => {
    if (highlightedMessageId) {
      scrollToMessage(highlightedMessageId);
    }
  }, [highlightedMessageId, scrollToMessage]);

  // Auto-clear highlight after animation (2.5 seconds)
  useEffect(() => {
    if (activeHighlight) {
      const timer = setTimeout(() => {
        setActiveHighlight(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeHighlight]);

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

    // Default welcome UI with fade-in animation
    return (
      <div className={cn("flex flex-1 items-center justify-center", className)}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center max-w-md px-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="flex justify-center mb-4"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 60%, var(--secondary)))",
              }}
            >
              <Bot className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="font-serif text-xl font-semibold text-foreground mb-2"
          >
            {welcomeTitle || t("chat.welcomeTitle", "How can I help you?")}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-muted-foreground text-sm"
          >
            {welcomeDescription || t("chat.welcomeDescription", "Ask me anything to get started.")}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Style object for CSS variable (used by child components for max-width constraint)
  const contentStyle = maxMessageWidth
    ? { "--message-max-width": maxMessageWidth } as React.CSSProperties
    : undefined;

  return (
    <div ref={containerRef} className={cn("relative flex-1 w-full min-h-0 min-w-0 overflow-hidden", className)}>
      <ScrollArea
        className="h-full w-full"
        viewportRef={viewportRef}
      >
        <div
          ref={contentRef}
          className="space-y-4 p-4 pb-8 min-w-0 overflow-hidden box-border w-full"
          style={contentStyle}
        >
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
                  artifacts={artifacts}
                  onArtifactClick={onArtifactClick}
                />
              );
            }

            const message = group.message;
            const isPlanMessage = message.type === "plan" && message.plan;
            const messageId = message.id;
            const isHighlighted = activeHighlight === messageId;
            const isUserMessage = message.type === "user";
            const showTurnSeparator = isUserMessage && index > 0;

            return (
              <React.Fragment key={messageId || index}>
                {showTurnSeparator && <TurnSeparator timestamp={message.timestamp} />}
                <div
                  ref={(el) => {
                    if (messageId && el) {
                      messageRefsMap.current.set(messageId, el);
                    } else if (messageId && !el) {
                      messageRefsMap.current.delete(messageId);
                    }
                  }}
                  className={cn(
                    "transition-all duration-300",
                    isHighlighted && "ring-2 ring-primary/50 bg-primary/5 rounded-2xl"
                  )}
                >
                  <MessageItem
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
                    maxWidth={maxMessageWidth}
                    toolExpandedInline={toolExpandedInline}
                    onExpandSubagent={onExpandSubagent}
                  />
                </div>
              </React.Fragment>
            );
          })}

          {/* Running indicator */}
          {isStreaming && <RunningIndicator messages={messages} />}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={scrollToBottom}
            className={cn(
              "absolute bottom-4 left-1/2 z-10 -translate-x-1/2",
              "flex items-center justify-center p-2",
              "bg-background border border-border rounded-full shadow-lg",
              "hover:bg-accent transition-colors cursor-pointer"
            )}
            title={t("chat.scrollToBottom", { defaultValue: "Scroll to bottom" })}
          >
            <ArrowDown className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
});
