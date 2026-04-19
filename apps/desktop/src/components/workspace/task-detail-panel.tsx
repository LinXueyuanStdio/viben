"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  X,
  Circle,
  Signal,
  Tags,
  User,
  Calendar,
  Clock,
  GitBranch,
  GitPullRequest,
  ExternalLink,
  ListChecks,
  MessageSquare,
  Activity,
  Loader2,
  Bot,
  Trash2,
  HelpCircle,
  FileText,
  Terminal,
  FolderOpen,
  History,
  AlertTriangle,
  UserCircle,
  CheckCircle2,
  ClipboardList,
  Code2,
  ShieldCheck,
  Target,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Badge,
  ScrollArea,
  Input,
  Textarea,
  cn,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@viben/ui";
import {
  PriorityIcon,
  PrioritySelect,
  TagBadge,
  TagSelect,
  AssigneeAvatar,
  AssigneeSelect,
  DueDateBadge,
  DueDatePicker,
  SubtaskList,
  RelationshipList,
  RelationshipAdd,
  // Phase 4: Comment and Activity components
  CommentList,
  ActivityFeed,
  type IssuePriority,
  type Tag,
  type Assignee,
  type Subtask,
  type TaskRelationship,
  type RelationshipType,
  type Comment,
  type ActivityEvent,
} from "@viben/kanban";
import { useTranslation } from "react-i18next";
import {
  useKanbanComments,
  useAddKanbanComment,
  useUpdateKanbanComment,
  useDeleteKanbanComment,
  useToggleCommentReaction,
  useKanbanActivities,
  useAgentConversation,
  useTaskSpecsData,
} from "@/hooks";
import { DesktopChatInput, DesktopMessageList, type SlashCommand } from "@/components/chat";
import { getGatewayClient, type UIMessage } from "@/lib/gateway";
import type { AgentMessage } from "@/types";
import {
  TaskSubtasksTab,
  TaskPRDTab,
  TaskLogsTab,
  type TaskLog,
} from "./task-tabs";
import { FileBrowser } from "@/components/file-browser";
import { TaskActionButtons } from "./kanban/task-action-buttons";
import { TaskWarnings } from "./kanban/task-warnings";
import { StatusSelect } from "./kanban/components/status-select";
import { useStuckDetection } from "@/hooks/use-stuck-detection";
import { useWorktreeExists } from "@/hooks/use-worktree-exists";
import { toast } from "@/hooks/use-toast";
import type {
  TaskStatus,
  XStateValue,
  ReviewReason,
  ExecutionPhase,
  TaskEvent,
  TaskEventType,
} from "@/lib/kanban/types";

// Editable Title Component
function EditableTitle({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue.trim() && editValue !== value) {
      onChange(editValue.trim());
    } else {
      setEditValue(value);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        className={cn("font-semibold h-auto py-0.5", className)}
      />
    );
  }

  return (
    <h2
      className={cn(
        "font-semibold cursor-pointer hover:bg-muted/50 rounded px-1.5 py-0.5 -mx-1.5 transition-colors line-clamp-2",
        className
      )}
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value}
    </h2>
  );
}

// Editable Description Component
function EditableDescription({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    if (editValue !== value) {
      onChange(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
    }
    // Allow Ctrl/Cmd + Enter to save
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <Textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder={placeholder}
        className="min-h-[100px]"
      />
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 min-h-[60px] transition-colors"
      onClick={() => {
        setEditValue(value);
        setIsEditing(true);
      }}
    >
      {value ? (
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{placeholder}</p>
      )}
    </div>
  );
}

// Property Row Component - Compact layout
function PropertyRow({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1.5 w-20 text-xs text-muted-foreground shrink-0">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// Action configuration with unique icons and colors
// Note: descriptions are fetched from i18n (workspace.taskCard.actionDesc.*)
interface ActionConfig {
  Icon: LucideIcon;
  color: string;           // Tailwind color class (without bg-/text-)
  bgColor: string;         // Background color class
  textColor: string;       // Text color class
  ringColor: string;       // Ring color for active state
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
  plan: {
    Icon: ClipboardList,
    color: "blue",
    bgColor: "bg-blue-500",
    textColor: "text-blue-500",
    ringColor: "ring-blue-500/20",
  },
  implement: {
    Icon: Code2,
    color: "purple",
    bgColor: "bg-purple-500",
    textColor: "text-purple-500",
    ringColor: "ring-purple-500/20",
  },
  check: {
    Icon: ShieldCheck,
    color: "green",
    bgColor: "bg-green-500",
    textColor: "text-green-500",
    ringColor: "ring-green-500/20",
  },
  finish: {
    Icon: Target,
    color: "orange",
    bgColor: "bg-orange-500",
    textColor: "text-orange-500",
    ringColor: "ring-orange-500/20",
  },
  "create-pr": {
    Icon: GitPullRequest,
    color: "pink",
    bgColor: "bg-pink-500",
    textColor: "text-pink-500",
    ringColor: "ring-pink-500/20",
  },
};

// Default config for unknown actions
const DEFAULT_ACTION_CONFIG: ActionConfig = {
  Icon: Activity,
  color: "gray",
  bgColor: "bg-gray-500",
  textColor: "text-gray-500",
  ringColor: "ring-gray-500/20",
};

// Format duration helper
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Format time helper (short format)
function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Enhanced Execution Progress Timeline Component
interface ExecutionProgressTimelineProps {
  nextAction: Array<{ phase: number; action: string; startTime?: string; endTime?: string }>;
  currentPhase: number;
  status: string;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}

function ExecutionProgressTimeline({
  nextAction,
  currentPhase,
  status,
  t,
}: ExecutionProgressTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const toggleExpand = useCallback((index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const completedCount = Math.min(currentPhase, nextAction.length);
  const progressPercent = Math.round((completedCount / nextAction.length) * 100);

  return (
    <div className="mt-2 p-4 rounded-lg bg-background border">
      {/* Header with progress percentage */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {t("workspace.executionProgress", "Execution Progress")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("workspace.taskCard.step", "Step {{current}}/{{total}}", {
              current: Math.min(currentPhase + 1, nextAction.length),
              total: nextAction.length,
            })}
          </span>
          <Badge
            variant={status === "in_progress" ? "default" : "secondary"}
            className="text-xs tabular-nums"
          >
            {progressPercent}%
          </Badge>
        </div>
      </div>

      {/* Vertical Timeline Steps */}
      <div className="relative">
        {/* Vertical connecting line - centered on step indicators */}
        <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-muted rounded-full" />

        {/* Progress overlay on the line */}
        <div
          className="absolute left-[15px] top-4 w-0.5 bg-gradient-to-b from-primary via-primary to-primary/50 rounded-full transition-all duration-700 ease-out"
          style={{
            height: `calc(${Math.min(100, (currentPhase / Math.max(1, nextAction.length - 1)) * 100)}% - 16px)`
          }}
        />

        <div className="space-y-1">
          {nextAction.map((action, index) => {
            const isCompleted = index < currentPhase;
            const isCurrent = index === currentPhase;
            const isPending = index > currentPhase;
            const isExpanded = expandedSteps.has(index);
            const isHovered = hoveredStep === index;

            const config = ACTION_CONFIGS[action.action] || DEFAULT_ACTION_CONFIG;
            const ActionIcon = config.Icon;

            // Mock time data (in real usage, these would come from action.startTime/endTime)
            const hasTimeData = action.startTime || action.endTime;
            const startTime = action.startTime ? new Date(action.startTime) : null;
            const endTime = action.endTime ? new Date(action.endTime) : null;
            const duration = startTime && endTime
              ? endTime.getTime() - startTime.getTime()
              : null;

            return (
              <div
                key={index}
                className={cn(
                  "relative flex items-start gap-3 py-2 pl-12 pr-2 rounded-lg transition-all duration-200 cursor-pointer",
                  isHovered && !isPending && "bg-accent/50",
                  isExpanded && "bg-accent/30"
                )}
                onMouseEnter={() => setHoveredStep(index)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => toggleExpand(index)}
              >
                {/* Step indicator with unique icon - vertically centered with first line of content */}
                <div className={cn(
                  "absolute left-0 top-2 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-300 shadow-sm",
                  isCompleted && cn(config.bgColor, "text-white"),
                  isCurrent && status === "in_progress" && cn(config.bgColor, "text-white ring-4", config.ringColor, "animate-pulse"),
                  isCurrent && status !== "in_progress" && cn(config.bgColor, "text-white ring-4", config.ringColor),
                  isPending && "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent && status === "in_progress" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ActionIcon className="h-4 w-4" />
                  )}
                </div>

                {/* Step content - starts after the indicator */}
                <div className={cn(
                  "flex-1 min-w-0 pt-1 transition-opacity duration-300",
                  isPending && "opacity-50"
                )}>
                  {/* Main row: action name + status badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <ActionIcon className={cn("h-4 w-4", isPending ? "text-muted-foreground" : config.textColor)} />
                      <span className={cn(
                        "text-sm font-medium leading-none",
                        isCurrent && config.textColor,
                        isCompleted && "text-foreground"
                      )}>
                        {t(`workspace.taskCard.action.${action.action}`, action.action)}
                      </span>
                    </div>

                    {/* Status badges */}
                    {isCurrent && status === "in_progress" && (
                      <Badge className={cn("text-[10px] h-5 border-0", `bg-${config.color}-500/10`, config.textColor)}>
                        {t("workspace.inProgress", "In Progress")}
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        {t("workspace.done", "Done")}
                      </Badge>
                    )}

                    {/* Expand/collapse indicator */}
                    <div className={cn(
                      "ml-auto transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Time info row (always visible when available) */}
                  {(hasTimeData || isCompleted || isCurrent) && (
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      {startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {t("workspace.started", "Started")}: {formatTimeShort(startTime)}
                        </span>
                      )}
                      {endTime && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {t("workspace.completed", "Completed")}: {formatTimeShort(endTime)}
                        </span>
                      )}
                      {duration && (
                        <span className="flex items-center gap-1 font-medium">
                          <Activity className="h-2.5 w-2.5" />
                          {formatDuration(duration)}
                        </span>
                      )}
                      {isCurrent && status === "in_progress" && !startTime && (
                        <span className="flex items-center gap-1 animate-pulse">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          {t("workspace.running", "Running")}...
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded details */}
                  <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    isExpanded ? "max-h-32 opacity-100 mt-2" : "max-h-0 opacity-0"
                  )}>
                    <div className="p-2 rounded bg-muted/50 text-xs">
                      <p className="text-muted-foreground">
                        {t(`workspace.taskCard.actionDesc.${action.action}`, t("workspace.taskCard.actionDesc.default", "Executing action"))}
                      </p>
                      {/* Could add more details here: logs preview, files modified, etc. */}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="mt-4 pt-3 border-t">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              status === "in_progress"
                ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                : "bg-gradient-to-r from-primary to-primary/80"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>{completedCount} {t("workspace.stepsCompleted", "completed")}</span>
          <span>{nextAction.length - completedCount} {t("workspace.stepsRemaining", "remaining")}</span>
        </div>
      </div>
    </div>
  );
}


// Format date helper
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format event timestamp helper
function formatEventTime(timestamp: string, t: (key: string, fallback: string, options?: { count?: number }) => string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 1) return t("common.justNow", "Just now");
  if (diffMinutes < 60) return t("common.minutesAgo", "{{count}}m ago", { count: diffMinutes });
  if (diffHours < 24) return t("common.hoursAgo", "{{count}}h ago", { count: diffHours });
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Get badge class for event type
function getEventTypeBadgeClass(eventType: TaskEventType): string {
  const eventClasses: Partial<Record<TaskEventType, string>> = {
    START: "bg-info/10 text-info",
    QUEUE: "bg-cyan-500/10 text-cyan-500",
    DEQUEUE: "bg-muted text-muted-foreground",
    PLAN_COMPLETE: "bg-success/10 text-success",
    PLAN_FAILED: "bg-destructive/10 text-destructive",
    SUBTASK_COMPLETE: "bg-success/10 text-success",
    ALL_SUBTASKS_DONE: "bg-success/10 text-success",
    IMPLEMENT_FAILED: "bg-destructive/10 text-destructive",
    CHECK_PASSED: "bg-success/10 text-success",
    CHECK_FAILED: "bg-warning/10 text-warning",
    FIX_COMPLETE: "bg-success/10 text-success",
    FIX_FAILED: "bg-destructive/10 text-destructive",
    USER_STOPPED: "bg-warning/10 text-warning",
    APPROVED: "bg-success/10 text-success",
    REJECTED: "bg-warning/10 text-warning",
    CANCEL: "bg-muted text-muted-foreground",
    PAUSE: "bg-warning/10 text-warning",
    RESUME: "bg-info/10 text-info",
    RETRY: "bg-info/10 text-info",
    ABANDON: "bg-muted text-muted-foreground",
    ARCHIVE: "bg-muted text-muted-foreground",
  };
  return eventClasses[eventType] || "bg-muted text-muted-foreground";
}

// Convert UI message to Agent message for display
function uiMessageToAgentMessage(msg: UIMessage, unknownErrorFallback: string): AgentMessage | null {
  switch (msg.type) {
    case "user":
      return {
        id: msg.id,
        type: "user",
        content: msg.content || "",
      };
    case "text":
      return {
        id: msg.id,
        type: "text",
        content: msg.content || "",
      };
    case "tool_use":
      return {
        id: msg.id,
        type: "tool_use",
        toolUseId: msg.tool_use_id,
        name: msg.tool_name || "unknown",
        input: msg.tool_input,
      };
    case "tool_result":
      return {
        id: msg.id,
        type: "tool_result",
        toolUseId: msg.tool_use_id,
        output: msg.tool_output,
        isError: msg.is_error,
      };
    case "thinking":
      return {
        id: msg.id,
        type: "thinking",
        content: msg.content || "",
      };
    case "error":
      return {
        id: msg.id,
        type: "error",
        message: msg.content || unknownErrorFallback,
        isError: true,
      };
    case "sdk_session":
      // Skip sdk_session messages in display, but extract SDK session ID
      return null;
    default:
      return null;
  }
}

// Task interface for the panel
export interface TaskForPanel {
  id: string;
  name?: string;                    // URL-safe slug
  title: string;
  description?: string | null;
  status: string;
  priority?: IssuePriority;
  tags?: Tag[];
  tagIds?: string[];
  assigneeId?: string;
  assignee?: Assignee;
  dueDate?: string;
  created_at: string;
  updated_at: string;
  // Session for agent conversation (UUID format)
  session_id?: string | null;
  agent_id?: string | null;
  // Execution configuration (locked after queueing)
  model?: string | null;           // Model ID (locked after queueing)
  // Execution status (from vibe-kanban)
  executor?: string;
  // Phase 2: Subtasks and Relationships
  subtasks?: Subtask[];
  relationships?: TaskRelationship[];
  // Phase 5: Extended task data for new tabs
  specsPath?: string;           // Task specs directory path (.viben/tasks/<id>/)
  prdContent?: string | null;   // PRD content
  logs?: TaskLog | null;        // Execution logs
  // State machine fields
  xstateState?: XStateValue;    // XState state value
  lastEvent?: TaskEvent;        // Last applied event
  eventHistory?: TaskEvent[];   // Event history
  reviewReason?: ReviewReason;  // Review reason for review status
  executionPhase?: ExecutionPhase; // Current execution phase
  isStuck?: boolean;            // Whether task is stuck
  stuckDuration?: number;       // How long task has been stuck (ms)
  // Git integration
  branch?: string;                  // Git branch for this task
  base_branch?: string;             // Base branch to merge into
  pr_url?: string;                  // Pull request URL
  worktree_path?: string | null;    // Worktree path if task runs in worktree
  workspace_path?: string | null;   // Workspace path where task was created
  // Task metadata
  creator?: string;                 // Task creator
  current_phase?: number;           // Current execution phase index
  next_action?: Array<{ phase: number; action: string }>; // Action pipeline
  notes?: string;                   // Task notes
}

// Available task for relationships
export interface AvailableTask {
  id: string;
  title: string;
}

// Available agent for task execution
export interface AvailableAgent {
  id: string;
  name: string;
  description?: string;
  /** Path to agent directory for message persistence */
  agent_dir?: string;
  /** Path to agent config file (AGENTS.md) */
  config_path?: string;
}

// Main TaskDetailPanel Props
export interface TaskDetailPanelProps {
  task: TaskForPanel | null;
  onClose: () => void;
  onUpdate?: (updates: Record<string, unknown>) => void;
  onStartTask?: (taskId: string) => void;
  availableTags?: Tag[];
  availableUsers?: Assignee[];
  availableTasks?: AvailableTask[];
  /** Available agents for task execution */
  availableAgents?: AvailableAgent[];
  onNavigateToTask?: (taskId: string) => void;
  // Current user for comments (defaults to "current-user")
  currentUserId?: string;
  currentUserName?: string;
  // Workspace path for agent conversation
  workspacePath?: string;
  // Auto-start task when opening panel (from external "Run" action)
  autoStartOnOpen?: boolean;
  // Callback to reset autoStartOnOpen after consumed
  onAutoStartConsumed?: () => void;
}

export function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  // onStartTask is kept for backwards compatibility but TaskActionButtons now handles task state transitions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onStartTask: _onStartTask,
  availableTags = [],
  availableUsers = [],
  availableTasks = [],
  availableAgents = [],
  onNavigateToTask,
  currentUserId = "current-user",
  currentUserName = "You",
  workspacePath = "",
  autoStartOnOpen = false,
  onAutoStartConsumed,
}: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("details");
  // Track if we should auto-start when switching to agent chat
  const [shouldAutoStart, setShouldAutoStart] = useState(false);

  // Load task specs data (PRD, subtasks, logs, files) from .viben/tasks/{taskId}/
  const specsData = useTaskSpecsData(task?.id ?? null, workspacePath);

  // Stuck detection with enhanced recovery
  const {
    isStuck: detectedStuck,
    isIncomplete,
    stuckDuration,
    taskProgress,
    isRecovering,
    handleRecover,
    handleResume,
  } = useStuckDetection({
    taskId: task?.id ?? "",
    isRunning: task?.status === "in_progress",
    workspacePath,
    lastUpdated: task?.updated_at,
    subtasks: specsData.subtasks,
    hasSpec: !!specsData.prdContent,
    autoRestartOnRecovery: true, // Enable one-click recovery
    onRecovered: () => {
      console.log(`[TaskDetailPanel] Task ${task?.id} recovered`);
      onUpdate?.({ _refresh: true });
    },
    onResumed: () => {
      console.log(`[TaskDetailPanel] Task ${task?.id} resumed`);
      onUpdate?.({ _refresh: true });
    },
  });

  // Use detected stuck status or fallback to task property
  const isStuck = detectedStuck || task?.isStuck || false;

  // Check if worktree still exists (may be cleaned up after approval)
  const { exists: worktreeExists, isChecking: isCheckingWorktree } = useWorktreeExists(task?.worktree_path);

  // Handle autoStartOnOpen from parent (e.g., when clicking "Run" from card dropdown)
  // Only depend on task?.id instead of the whole task object to prevent unnecessary re-runs
  useEffect(() => {
    if (autoStartOnOpen && task?.id) {
      setShouldAutoStart(true);
      setActiveTab("agent-chat");
      onAutoStartConsumed?.();
    }
  }, [autoStartOnOpen, task?.id, onAutoStartConsumed]);

  // Persistent comments from Tauri backend
  const {
    data: persistedComments,
    isLoading: isLoadingComments,
  } = useKanbanComments(task?.id ?? null);

  // Persistent activities from Tauri backend
  const {
    data: persistedActivities,
    isLoading: isLoadingActivities,
  } = useKanbanActivities(task?.id ?? null);

  // Comment mutation hooks
  const addCommentMutation = useAddKanbanComment();
  const updateCommentMutation = useUpdateKanbanComment();
  const deleteCommentMutation = useDeleteKanbanComment();
  const toggleReactionMutation = useToggleCommentReaction();

  // Use persisted data, with fallback to task data for backwards compatibility
  const comments = useMemo<Comment[]>(() => {
    return persistedComments ?? [];
  }, [persistedComments]);

  // Combine persisted activities with fallback generated events
  const activities = useMemo<ActivityEvent[]>(() => {
    if (persistedActivities && persistedActivities.length > 0) {
      return persistedActivities;
    }

    // Generate basic activity from task timestamps if no persisted activities
    if (!task) return [];

    const events: ActivityEvent[] = [];

    // Created event
    events.push({
      id: `${task.id}-created`,
      type: "created",
      actor: {
        id: "system",
        name: t("common.system", "System"),
      },
      timestamp: task.created_at,
      data: {},
    });

    // Status change event (if different from default)
    if (task.status && task.status !== "backlog") {
      events.push({
        id: `${task.id}-status`,
        type: "status_changed",
        actor: {
          id: "system",
          name: t("common.system", "System"),
        },
        timestamp: task.updated_at,
        data: {
          oldValue: "backlog",
          newValue: task.status,
        },
      });
    }

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [task, persistedActivities]);

  // Build agent config with task context as system prompt
  const agentConfig = useMemo(() => {
    if (!task) return undefined;
    const taskContextPrompt = `## Current Task Context
- **Task ID**: ${task.id}
- **Title**: ${task.title}
- **Status**: ${task.status}
- **Description**: ${task.description || "No description provided"}
${task.tags && task.tags.length > 0 ? `- **Tags**: ${task.tags.map((t) => t.name).join(", ")}` : ""}

You are helping the user work on this task. Provide relevant suggestions, code examples, and guidance based on the task context.`;

    return {
      systemPrompt: taskContextPrompt,
    };
  }, [task]);

  // Use session_id from task metadata (UUID format)
  // If no session exists, one will be created when sending first message
  const taskSessionId = task?.session_id || undefined;
  const taskAgentId = task?.agent_id || "default";

  // Find the current agent from availableAgents to get agentDir and configPath
  const currentAgent = useMemo(() => {
    if (!task?.agent_id) return undefined;
    return availableAgents.find((a) => a.id === task.agent_id);
  }, [task?.agent_id, availableAgents]);

  // Agent conversation hook - reuses the main chat implementation
  const {
    messages: agentMessages,
    phase: agentPhase,
    isStreaming: agentIsStreaming,
    pendingPlan: agentPendingPlan,
    pendingQuestions: agentPendingQuestions,
    artifacts: agentArtifacts,
    // toolUsages available but not displayed in panel (could add later)
    error: agentError,
    sessionId: currentSessionId,
    sendMessage: agentSendMessage,
    approvePlan: agentApprovePlan,
    rejectPlan: agentRejectPlan,
    answerQuestions: agentAnswerQuestions,
    cancel: agentCancel,
    clearMessages: agentClearMessages,
    loadMessages: agentLoadMessages,
  } = useAgentConversation(workspacePath, {
    sessionId: taskSessionId,
    taskId: task?.id,
    agentConfig,
    // Pass agentDir and agentConfigPath for message persistence
    agentDir: currentAgent?.agent_dir,
    agentConfigPath: currentAgent?.config_path,
  });

  // Track previous task ID to detect task changes
  const prevTaskIdRef = useRef<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);

  // Refs to store callbacks to avoid triggering effects when callbacks change reference
  const onUpdateRef = useRef(onUpdate);
  const agentSendMessageRef = useRef(agentSendMessage);
  const agentClearMessagesRef = useRef(agentClearMessages);
  const agentLoadMessagesRef = useRef(agentLoadMessages);

  // Track if auto-start has been triggered to prevent multiple triggers
  const autoStartTriggeredRef = useRef(false);

  // Sync refs with current callback values
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { agentSendMessageRef.current = agentSendMessage; }, [agentSendMessage]);
  useEffect(() => { agentClearMessagesRef.current = agentClearMessages; }, [agentClearMessages]);
  useEffect(() => { agentLoadMessagesRef.current = agentLoadMessages; }, [agentLoadMessages]);

  // Reset state when task changes
  // Use agentClearMessagesRef to avoid re-running when callback reference changes
  useEffect(() => {
    if (task?.id !== prevTaskIdRef.current) {
      console.log(`[TaskDetailPanel] Task changed from ${prevTaskIdRef.current} to ${task?.id}`);
      prevTaskIdRef.current = task?.id ?? null;
      loadedSessionIdRef.current = null;
      // Reset auto-start trigger for new task
      autoStartTriggeredRef.current = false;

      // Clear messages when switching tasks
      if (task?.id) {
        agentClearMessagesRef.current?.();
      }
    }
  }, [task?.id]);

  // Update task's session_id when a new session is created
  // Use onUpdateRef to avoid re-running when callback reference changes
  useEffect(() => {
    if (currentSessionId && task?.id && !task.session_id) {
      // A new session was created, save it to task metadata
      console.log(`[TaskDetailPanel] Saving new session ${currentSessionId} to task ${task.id}`);
      onUpdateRef.current?.({ session_id: currentSessionId });
    }
  }, [currentSessionId, task?.id, task?.session_id]);

  // Load conversation history when task has a session
  // Use either task.session_id (from saved metadata) or currentSessionId (from hook)
  const effectiveSessionId = task?.session_id || currentSessionId;

  // Load conversation history when task has a session
  // Use agentLoadMessagesRef to avoid re-running when callback reference changes
  useEffect(() => {
    // Only load when agent-chat tab is active
    if (activeTab !== "agent-chat") {
      return;
    }

    if (!task?.id || !workspacePath) {
      return;
    }

    // No session yet, nothing to load
    if (!effectiveSessionId) {
      console.log(`[TaskDetailPanel] Task ${task.id} has no session yet`);
      return;
    }

    // Already loaded this session
    if (loadedSessionIdRef.current === effectiveSessionId) {
      return;
    }

    loadedSessionIdRef.current = effectiveSessionId;

    const loadTaskMessages = async () => {
      try {
        const client = getGatewayClient();
        console.log(`[TaskDetailPanel] Loading messages for task ${task.id}, session ${effectiveSessionId}`);

        // Load messages using session_id
        const uiMessages = await client.listSessionUIMessages(taskAgentId, effectiveSessionId, workspacePath);

        if (uiMessages.length > 0) {
          // Convert UI messages to agent messages
          const unknownErrorMsg = t("common.unknownError", "Unknown error");
          const messages = uiMessages
            .map((msg) => uiMessageToAgentMessage(msg, unknownErrorMsg))
            .filter((msg): msg is AgentMessage => msg !== null);

          // Extract SDK session ID for resume functionality
          const sdkSessionMsg = uiMessages
            .filter((msg): msg is UIMessage & { sdkSessionId: string } =>
              msg.type === "sdk_session" && typeof msg.sdkSessionId === "string"
            )
            .pop();

          console.log(`[TaskDetailPanel] Loaded ${messages.length} messages for session ${effectiveSessionId}`);
          agentLoadMessagesRef.current?.(messages, sdkSessionMsg?.sdkSessionId);
        } else {
          console.log(`[TaskDetailPanel] No messages found for session ${effectiveSessionId}`);
        }
      } catch (error) {
        console.error(`[TaskDetailPanel] Failed to load messages for session ${effectiveSessionId}:`, error);
      }
    };

    loadTaskMessages();
  }, [activeTab, task?.id, effectiveSessionId, workspacePath, taskAgentId, t]);

  // Auto-start: send message via SSE when clicking "Run"
  // Use refs to prevent multiple triggers and avoid callback dependency issues
  useEffect(() => {
    if (!shouldAutoStart || activeTab !== "agent-chat" || !task || !workspacePath) {
      return;
    }

    // Don't auto-start if already streaming
    if (agentIsStreaming) {
      console.log(`[TaskDetailPanel] Skipping auto-start - already streaming`);
      setShouldAutoStart(false);
      return;
    }

    // Don't auto-start if there are already messages (conversation exists)
    if (agentMessages.length > 0) {
      console.log(`[TaskDetailPanel] Skipping auto-start - conversation already exists with ${agentMessages.length} messages`);
      setShouldAutoStart(false);
      return;
    }

    // Prevent multiple triggers using ref
    if (autoStartTriggeredRef.current) {
      console.log(`[TaskDetailPanel] Skipping auto-start - already triggered`);
      setShouldAutoStart(false);
      return;
    }

    // Mark as triggered
    autoStartTriggeredRef.current = true;

    // Reset the flag
    setShouldAutoStart(false);

    // Build initial prompt from task context using i18n
    // Note: t function is stable from useTranslation, but we capture task values in closure
    const initialPrompt = task.description
      ? t("workspace.taskPromptWithDescription", {
          title: task.title,
          description: task.description,
        })
      : t("workspace.taskPromptWithoutDescription", { title: task.title });

    console.log(`[TaskDetailPanel] Auto-starting task ${task.id} with prompt`);

    // Use the hook's sendMessage to start the conversation via SSE
    // This ensures the SSE stream is properly handled and messages appear in real-time
    const startTask = () => {
      agentSendMessageRef.current?.(initialPrompt);
    };

    // Small delay to ensure the tab switch animation completes
    setTimeout(startTask, 100);
  }, [shouldAutoStart, activeTab, task?.id, task?.title, task?.description, workspacePath, agentIsStreaming, agentMessages.length, t]);

  // Slash commands for agent chat
  const agentSlashCommands = useMemo<SlashCommand[]>(() => [
    {
      id: "clear",
      name: t("chat.slashCommands.clear", "clear"),
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      icon: <Trash2 className="h-4 w-4" />,
    },
    {
      id: "help",
      name: t("chat.slashCommands.help", "help"),
      description: t("chat.slashCommands.helpDesc", "Show available commands"),
      icon: <HelpCircle className="h-4 w-4" />,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = useCallback((command: SlashCommand) => {
    switch (command.id) {
      case "clear":
        agentClearMessages?.();
        break;
      case "help": {
        // Inject a help message showing available commands
        const helpText = `**${t("chat.slashCommands.availableCommands", "Available Commands")}**

• \`/clear\` - ${t("chat.slashCommands.clearDesc", "Clear conversation history")}
• \`/help\` - ${t("chat.slashCommands.helpDesc", "Show available commands")}

**${t("chat.slashCommands.tips", "Tips")}**

- ${t("chat.slashCommands.tipTask", "Ask about the current task to get context-aware suggestions")}
- ${t("chat.slashCommands.tipCode", "Paste code snippets and ask for help debugging or improving them")}
- ${t("chat.slashCommands.tipPlan", "Ask the agent to help plan the implementation approach")}`;

        // Send as a user message to get a response
        agentSendMessage?.(helpText);
        break;
      }
    }
  }, [agentClearMessages, agentSendMessage, t]);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{t("workspace.selectTaskToView", "Select a task to view details")}</p>
      </div>
    );
  }

  const handleTitleChange = (newTitle: string) => {
    onUpdate?.({ title: newTitle });
  };

  const handleDescriptionChange = (newDescription: string) => {
    onUpdate?.({ description: newDescription || null });
  };

  const handlePriorityChange = (priority: IssuePriority) => {
    onUpdate?.({ priority });
  };

  const handleTagsChange = (tagIds: string[]) => {
    onUpdate?.({ tagIds });
  };

  const handleAssigneeChange = (assigneeId: string | undefined) => {
    onUpdate?.({ assigneeId });
  };

  const handleDueDateChange = (dueDate: string | undefined) => {
    onUpdate?.({ dueDate });
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    onUpdate?.({ status: newStatus });
  };

  // Comment handlers using persistent storage hooks
  const handleAddComment = useCallback((content: string) => {
    addCommentMutation.mutate({
      taskId: task.id,
      content,
      authorId: currentUserId,
      authorName: currentUserName,
    });
  }, [task.id, currentUserId, currentUserName, addCommentMutation]);

  const handleEditComment = useCallback((commentId: string, content: string) => {
    updateCommentMutation.mutate({
      taskId: task.id,
      commentId,
      content,
    });
  }, [task.id, updateCommentMutation]);

  const handleDeleteComment = useCallback((commentId: string) => {
    deleteCommentMutation.mutate({
      taskId: task.id,
      commentId,
    });
  }, [task.id, deleteCommentMutation]);

  const handleToggleReaction = useCallback((commentId: string, emoji: string) => {
    toggleReactionMutation.mutate({
      taskId: task.id,
      commentId,
      emoji,
      userId: currentUserId,
      userName: currentUserName,
    });
  }, [task.id, currentUserId, currentUserName, toggleReactionMutation]);

  // Check if any comment mutation is pending
  const isCommentPending =
    addCommentMutation.isPending ||
    updateCommentMutation.isPending ||
    deleteCommentMutation.isPending ||
    toggleReactionMutation.isPending;

  const selectedTagIds = task.tagIds || task.tags?.map((t) => t.id) || [];

  // Get status color for pill badge
  const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      todo: "bg-muted text-muted-foreground",
      "in-progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      done: "bg-green-500/10 text-green-600 dark:text-green-400",
      blocked: "bg-red-500/10 text-red-600 dark:text-red-400",
    };
    return statusColors[status.toLowerCase()] ?? statusColors.todo;
  };

  // Format status label
  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      todo: t("workspace.kanbanStatus.todo", "To Do"),
      "in-progress": t("workspace.kanbanStatus.inProgress", "In Progress"),
      review: t("workspace.kanbanStatus.review", "Review"),
      done: t("workspace.kanbanStatus.done", "Done"),
    };
    return statusLabels[status.toLowerCase()] ?? status;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Title and Close */}
      <div className="flex items-start justify-between p-4 border-b shrink-0">
        <div className="flex-1 min-w-0 pr-2">
          {/* Status + Running indicator */}
          <div className="flex items-center gap-2 mb-0.5">
            <Badge
              variant="secondary"
              className={cn(
                "h-5 px-2 text-xs font-normal rounded-full",
                getStatusColor(task.status)
              )}
            >
              {getStatusLabel(task.status)}
            </Badge>
            {task.status === "in_progress" && (
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>
          {/* Title - Editable */}
          <EditableTitle value={task.title} onChange={handleTitleChange} className="text-lg" />
          {/* Task Directory Path */}
          {task.specsPath && (
            <p className="text-xs text-muted-foreground/60 font-mono truncate mt-0.5" title={task.specsPath}>
              {task.specsPath}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs for Details / Comments / Activity */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-4 mt-2 shrink-0 flex-wrap h-auto gap-1">
          <TabsTrigger value="details" className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            {t("workspace.taskDetail", "Details")}
          </TabsTrigger>
          <TabsTrigger value="agent-chat" className="flex items-center gap-1.5">
            <Bot className="h-4 w-4" />
            {t("workspace.agentChat", "Agent Chat")}
          </TabsTrigger>
          <TabsTrigger value="subtasks" className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            {t("workspace.tabs.subtasks", "Subtasks")}
            {(() => {
              const subtasksList = specsData.subtasks.length > 0 ? specsData.subtasks : task.subtasks || [];
              const completedCount = specsData.subtasks.length > 0
                ? specsData.subtasks.filter((s) => s.status === "completed").length
                : (task.subtasks || []).filter((s) => s.completed).length;
              return subtasksList.length > 0 ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {completedCount}/{subtasksList.length}
                </Badge>
              ) : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="prd" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {t("workspace.tabs.prd", "PRD")}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5">
            <Terminal className="h-4 w-4" />
            {t("workspace.tabs.logs", "Logs")}
          </TabsTrigger>
          <TabsTrigger value="task-dir" className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4" />
            {t("workspace.tabs.taskDir", "Task Dir")}
          </TabsTrigger>
          <TabsTrigger value="working-dir" className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4" />
            {t("workspace.tabs.workingDir", "Working Dir")}
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            {t("chat.artifacts.title", "Comments")}
            {comments.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {comments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" />
            {t("workspace.activity", "Activity")}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            {t("workspace.taskEvents.title", "Events")}
            {task.eventHistory && task.eventHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {task.eventHistory.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Description - Editable */}
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                  {t("workspace.description", "Description")}
                </h3>
                <EditableDescription
                  value={task.description || ""}
                  onChange={handleDescriptionChange}
                  placeholder={t("workspace.addDescription", "Add description...")}
                />
              </div>

              {/* Properties */}
              <div className="border-t pt-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  {t("workspace.properties", "Properties")}
                </h3>

                {/* Status */}
                <PropertyRow
                  label={t("workspace.status", "Status")}
                  icon={Circle}
                >
                  {onUpdate ? (
                    <StatusSelect
                      value={task.status as TaskStatus}
                      onValueChange={handleStatusChange}
                      size="sm"
                      restrictTransitions={true}
                      labels={{
                        setStatus: t("workspace.setStatus", "Set status"),
                        backlog: t("workspace.kanbanStatus.backlog", "Backlog"),
                        queue: t("workspace.kanbanStatus.queue", "Queue"),
                        in_progress: t("workspace.kanbanStatus.inProgress", "In Progress"),
                        paused: t("workspace.kanbanStatus.paused", "Paused"),
                        review: t("workspace.kanbanStatus.review", "Review"),
                        completed: t("workspace.kanbanStatus.completed", "Completed"),
                        failed: t("workspace.kanbanStatus.failed", "Failed"),
                        cancelled: t("workspace.kanbanStatus.cancelled", "Cancelled"),
                        archived: t("workspace.kanbanStatus.archived", "Archived"),
                      }}
                    />
                  ) : (
                    <Badge variant="outline">{getStatusLabel(task.status)}</Badge>
                  )}
                </PropertyRow>

                {/* Priority */}
                <PropertyRow
                  label={t("workspace.priority.label", "Priority")}
                  icon={Signal}
                >
                  {onUpdate ? (
                    <PrioritySelect
                      value={task.priority}
                      onValueChange={handlePriorityChange}
                      size="sm"
                      showLabel
                      labels={{
                        setPriority: t("workspace.setPriority", "Set priority"),
                        urgent: t("workspace.priority.urgent", "Urgent"),
                        high: t("workspace.priority.high", "High"),
                        medium: t("workspace.priority.medium", "Medium"),
                        low: t("workspace.priority.low", "Low"),
                        none: t("workspace.priority.none", "None"),
                      }}
                    />
                  ) : task.priority ? (
                    <PriorityIcon priority={task.priority} showLabel size="sm" />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("workspace.noPriority", "No priority")}
                    </span>
                  )}
                </PropertyRow>

                {/* Tags */}
                {(availableTags.length > 0 || selectedTagIds.length > 0) && (
                  <PropertyRow
                    label={t("workspace.tags", "Tags")}
                    icon={Tags}
                  >
                    {onUpdate ? (
                      <TagSelect
                        availableTags={availableTags}
                        selectedTagIds={selectedTagIds}
                        onChange={handleTagsChange}
                      />
                    ) : task.tags && task.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <TagBadge key={tag.id} tag={tag} size="sm" />
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("workspace.noTags", "No tags")}
                      </span>
                    )}
                  </PropertyRow>
                )}

                {/* Assignee */}
                {(availableUsers.length > 0 || task.assigneeId) && (
                  <PropertyRow
                    label={t("workspace.assignee", "Assignee")}
                    icon={User}
                  >
                    {onUpdate ? (
                      <AssigneeSelect
                        availableUsers={availableUsers}
                        value={task.assigneeId}
                        onChange={handleAssigneeChange}
                      />
                    ) : task.assignee ? (
                      <AssigneeAvatar assignee={task.assignee} size="sm" showName />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t("workspace.unassigned", "Unassigned")}
                      </span>
                    )}
                  </PropertyRow>
                )}

                {/* Creator */}
                {task.creator && (
                  <PropertyRow
                    label={t("workspace.creator", "Creator")}
                    icon={UserCircle}
                  >
                    <span className="text-sm">{task.creator}</span>
                  </PropertyRow>
                )}

                {/* Agent */}
                {task.agent_id && (
                  <PropertyRow
                    label={t("workspace.agent", "Agent")}
                    icon={Bot}
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {task.agent_id}
                    </Badge>
                  </PropertyRow>
                )}

                {/* Executor */}
                {task.executor && (
                  <PropertyRow
                    label={t("workspace.executor", "Executor")}
                    icon={Activity}
                  >
                    <Badge variant="secondary" className="text-xs">
                      {task.executor}
                    </Badge>
                  </PropertyRow>
                )}

                {/* Model */}
                {task.model && (
                  <PropertyRow
                    label={t("workspace.model", "Model")}
                    icon={Bot}
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {task.model}
                    </Badge>
                  </PropertyRow>
                )}

                {/* Due Date */}
                <PropertyRow
                  label={t("workspace.dueDate", "Due Date")}
                  icon={Calendar}
                >
                  {onUpdate ? (
                    <DueDatePicker
                      value={task.dueDate}
                      onChange={handleDueDateChange}
                    />
                  ) : task.dueDate ? (
                    <DueDateBadge dueDate={task.dueDate} />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("workspace.noDueDate", "No due date")}
                    </span>
                  )}
                </PropertyRow>
              </div>

              {/* Execution Status (vibe-kanban specific) */}
              {(task.executor || task.xstateState) && (
                <div className="border-t pt-3">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    {t("workspace.execution", "Execution")}
                  </h3>

                  {/* Task Warnings - Stuck and Incomplete detection with one-click recovery */}
                  <TaskWarnings
                    isStuck={isStuck}
                    isIncomplete={isIncomplete}
                    isRecovering={isRecovering}
                    taskProgress={taskProgress}
                    stuckDuration={stuckDuration}
                    onRecover={handleRecover}
                    onResume={handleResume}
                    className="mb-2"
                  />

                  {/* Task Action Buttons with Status Context */}
                  <div className="mb-3">
                    <TaskActionButtons
                      taskId={task.id}
                      workspacePath={workspacePath}
                      status={task.status as TaskStatus}
                      xstateState={task.xstateState}
                      reviewReason={task.reviewReason}
                      isStuck={isStuck}
                      isRunning={task.status === "in_progress"}
                      executionPhase={task.executionPhase}
                      lastEventSequence={task.lastEvent?.sequence}
                      taskTitle={task.title}
                      taskDescription={task.description ?? undefined}
                      agentId={task.agent_id ?? "default"}
                      onEventSubmitted={(eventType, newState) => {
                        console.log(`[TaskDetailPanel] Event ${eventType} submitted, new state: ${newState}`);
                        onUpdate?.({ _refresh: true });
                      }}
                      onEventError={(error) => {
                        console.error(`[TaskDetailPanel] Event error: ${error}`);
                        toast.error(t("workspace.taskActions.error", "Action failed"), {
                          description: error,
                        });
                      }}
                      size="default"
                      showAllActions
                      showStatusContext
                      renderBetween={
                        task.pr_url ? (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const url = task.pr_url!;
                              console.log("[TaskDetailPanel] Opening PR URL:", url);
                              try {
                                // Use Tauri opener plugin
                                const { openUrl } = await import("@tauri-apps/plugin-opener");
                                await openUrl(url);
                              } catch (err) {
                                console.warn("[TaskDetailPanel] Tauri opener failed, trying shell:", err);
                                try {
                                  const { open } = await import("@tauri-apps/plugin-shell");
                                  await open(url);
                                } catch (err2) {
                                  console.warn("[TaskDetailPanel] Shell failed, using window.open:", err2);
                                  window.open(url, "_blank", "noopener,noreferrer");
                                }
                              }
                            }}
                            className="w-full text-left p-3 rounded-lg border-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <GitPullRequest className="h-5 w-5 text-purple-500 shrink-0" />
                                <span className="text-sm font-semibold text-purple-600 dark:text-purple-400 truncate">
                                  {(() => {
                                    const match = task.pr_url?.match(/\/pull\/(\d+)/);
                                    return match ? `Pull Request #${match[1]}` : "View PR";
                                  })()}
                                </span>
                                <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/30">
                                  Open
                                </Badge>
                              </div>
                              <ExternalLink className="h-4 w-4 text-purple-500/70 group-hover:text-purple-500 transition-colors shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 truncate font-mono">
                              {task.pr_url}
                            </p>
                          </button>
                        ) : undefined
                      }
                    />
                  </div>

                  {/* Execution Config */}
                  <div className="space-y-3 p-3 rounded-md bg-muted/30">
                    {/* Runtime Status Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {t("workspace.runtime", "Runtime")}
                      </span>
                      {isStuck ? (
                        <Badge variant="outline" className="gap-1.5 bg-warning/10 text-warning border-warning/30">
                          <AlertTriangle className="h-3 w-3" />
                          {t("workspace.taskStatus.stuck", "Stuck")}
                        </Badge>
                      ) : task.status === "in_progress" ? (
                        <Badge variant="secondary" className="gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                          {t("workspace.running", "Running")}
                        </Badge>
                      ) : task.status === "failed" ? (
                        <Badge variant="destructive">
                          {t("workspace.failed", "Failed")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t("workspace.idle", "Idle")}
                        </Badge>
                      )}
                    </div>

                    {/* Execution Progress Card - Enhanced Vertical Timeline */}
                    {task.next_action && task.next_action.length > 0 && (
                      <ExecutionProgressTimeline
                        nextAction={task.next_action}
                        currentPhase={task.current_phase ?? 0}
                        status={task.status}
                        t={t}
                      />
                    )}
                  </div>

                  {/* Review Reason */}
                  {task.reviewReason && task.status === "review" && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-sm text-muted-foreground">
                        {t("workspace.reviewReason.label", "Review Reason")}:
                      </span>
                      <Badge variant="outline" className={cn(
                        task.reviewReason === "completed" && "bg-success/10 text-success border-success/30",
                        task.reviewReason === "errors" && "bg-destructive/10 text-destructive border-destructive/30",
                        task.reviewReason === "qa_rejected" && "bg-warning/10 text-warning border-warning/30",
                        task.reviewReason === "plan_review" && "bg-info/10 text-info border-info/30",
                        task.reviewReason === "stopped" && "bg-muted text-muted-foreground"
                      )}>
                        {t(`workspace.reviewReason.${task.reviewReason}`, task.reviewReason)}
                      </Badge>
                    </div>
                  )}

                  {/* Git & Worktree Info Card */}
                  {(task.branch || task.base_branch || task.worktree_path) && (
                    <div className={cn(
                      "mt-3 p-3 rounded-lg border",
                      // Change card style if worktree is cleaned up
                      task.worktree_path && worktreeExists === false
                        ? "bg-muted/30 border-muted"
                        : "bg-info/5 border-info/20"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className={cn(
                          "h-4 w-4 shrink-0",
                          task.worktree_path && worktreeExists === false
                            ? "text-muted-foreground"
                            : "text-info"
                        )} />
                        <span className={cn(
                          "text-xs font-medium uppercase tracking-wide",
                          task.worktree_path && worktreeExists === false
                            ? "text-muted-foreground"
                            : "text-info"
                        )}>
                          {t("workspace.gitInfo", "Git Info")}
                        </span>
                        {task.worktree_path && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs ml-auto",
                              worktreeExists === false
                                ? "bg-muted text-muted-foreground border-muted-foreground/30"
                                : isCheckingWorktree
                                  ? "bg-muted/50 text-muted-foreground border-muted-foreground/20"
                                  : "bg-info/10 text-info border-info/30"
                            )}
                          >
                            {isCheckingWorktree ? (
                              <span className="flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t("common.checking", "Checking...")}
                              </span>
                            ) : worktreeExists === false ? (
                              t("workspace.worktree.cleanedUp", "Cleaned Up")
                            ) : (
                              t("workspace.worktree.isolated", "Isolated Worktree")
                            )}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {/* Branch info */}
                        {task.branch && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-14 shrink-0">
                              {t("workspace.branch", "Branch")}:
                            </span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {task.branch}
                            </Badge>
                          </div>
                        )}
                        {task.base_branch && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-14 shrink-0">
                              {t("workspace.baseBranch", "Base")}:
                            </span>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {task.base_branch}
                            </Badge>
                          </div>
                        )}
                        {/* Worktree path */}
                        {task.worktree_path && (
                          <div className={cn(
                            "flex items-center gap-2 pt-1 border-t",
                            worktreeExists === false
                              ? "border-muted-foreground/10"
                              : "border-info/10"
                          )}>
                            <span className="text-xs text-muted-foreground w-14 shrink-0">
                              {t("workspace.path", "Path")}:
                            </span>
                            <p className={cn(
                              "text-xs font-mono truncate flex-1",
                              worktreeExists === false
                                ? "text-muted-foreground/50 line-through"
                                : "text-muted-foreground"
                            )} title={task.worktree_path}>
                              {task.worktree_path}
                            </p>
                            {worktreeExists !== false && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 shrink-0"
                                disabled={isCheckingWorktree || worktreeExists === null}
                                onClick={() => {
                                  const client = getGatewayClient();
                                  client.openFile(task.worktree_path!).catch(console.error);
                                }}
                              >
                                <FolderOpen className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Subtasks Section */}
              <div className="border-t pt-3">
                <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <ListChecks className="h-3 w-3" />
                  {t("workspace.subtasks", "Subtasks")}
                </h3>
                <SubtaskList
                  subtasks={task.subtasks || []}
                  callbacks={
                    onUpdate
                      ? {
                          onToggle: (id: string, completed: boolean) =>
                            onUpdate({
                              subtasks: task.subtasks?.map((s: Subtask) =>
                                s.id === id ? { ...s, completed } : s
                              ),
                            }),
                          onCreate: (title: string) =>
                            onUpdate({
                              subtasks: [
                                ...(task.subtasks || []),
                                {
                                  id: crypto.randomUUID(),
                                  title,
                                  completed: false,
                                },
                              ],
                            }),
                          onDelete: (id: string) =>
                            onUpdate({
                              subtasks: task.subtasks?.filter((s: Subtask) => s.id !== id),
                            }),
                          onUpdate: (id: string, title: string) =>
                            onUpdate({
                              subtasks: task.subtasks?.map((s: Subtask) =>
                                s.id === id ? { ...s, title } : s
                              ),
                            }),
                        }
                      : undefined
                  }
                  disabled={!onUpdate}
                />
              </div>

              {/* Relationships Section */}
              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3" />
                    {t("workspace.relationships", "Relationships")}
                  </h3>
                  {onUpdate && availableTasks.length > 0 && (
                    <RelationshipAdd
                      availableTasks={availableTasks.filter((t) => t.id !== task.id)}
                      onAdd={(type: RelationshipType, targetTaskId: string) => {
                        const targetTask = availableTasks.find(
                          (t) => t.id === targetTaskId
                        );
                        if (targetTask) {
                          onUpdate({
                            relationships: [
                              ...(task.relationships || []),
                              {
                                id: crypto.randomUUID(),
                                type,
                                targetTaskId,
                                targetTaskTitle: targetTask.title,
                              },
                            ],
                          });
                        }
                      }}
                      disabled={!onUpdate}
                    />
                  )}
                </div>
                <RelationshipList
                  relationships={task.relationships || []}
                  onRemove={
                    onUpdate
                      ? (id: string) =>
                          onUpdate({
                            relationships: task.relationships?.filter(
                              (r: TaskRelationship) => r.id !== id
                            ),
                          })
                      : undefined
                  }
                  onNavigate={onNavigateToTask}
                />
                {(!task.relationships || task.relationships.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    {t("workspace.noRelationships", "No relationships")}
                  </p>
                )}
              </div>

              {/* Notes */}
              {task.notes && (
                <div className="border-t pt-3">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    {t("workspace.notes", "Notes")}
                  </h3>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-xs whitespace-pre-wrap">{task.notes}</p>
                  </div>
                </div>
              )}

              {/* Timestamps - Compact inline */}
              <div className="border-t pt-3">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{t("workspace.created", "Created")}: {formatDateTime(task.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{t("workspace.updated", "Updated")}: {formatDateTime(task.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Comments Tab - Persisted to SQLite */}
        <TabsContent value="comments" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <CommentList
                  comments={comments}
                  currentUserId={currentUserId}
                  onAdd={handleAddComment}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onToggleReaction={handleToggleReaction}
                  disabled={isCommentPending}
                  inputPlaceholder={t("chat.inputPlaceholder", "Add a comment...")}
                  emptyMessage={t("chat.noArtifacts", "No comments yet")}
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Activity Tab - Persisted to SQLite */}
        <TabsContent value="activity" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {isLoadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ActivityFeed
                  events={activities}
                  maxItems={50}
                />
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Events Tab - State Machine Event History */}
        <TabsContent value="events" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              {task.eventHistory && task.eventHistory.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground mb-4">
                    {t("workspace.taskEvents.history", "Event History")}
                  </h3>
                  {task.eventHistory.slice().reverse().map((event, index) => (
                    <div
                      key={event.eventId}
                      className={cn(
                        "p-3 rounded-lg border",
                        index === 0 ? "bg-accent/50 border-accent" : "bg-muted/30 border-border"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{event.sequence}
                          </Badge>
                          <Badge className={cn(
                            "text-xs",
                            getEventTypeBadgeClass(event.type)
                          )}>
                            {event.type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatEventTime(event.timestamp, t)}
                        </span>
                      </div>
                      {event.payload && Object.keys(event.payload).length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                          {JSON.stringify(event.payload, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">
                    {t("workspace.taskEvents.noEvents", "No events yet")}
                  </h3>
                  <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
                    {t(
                      "workspace.taskEvents.eventsWillAppear",
                      "State machine events will appear here as the task progresses"
                    )}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Subtasks Tab */}
        <TabsContent value="subtasks" className="flex-1 min-h-0">
          <TaskSubtasksTab
            subtasks={
              // Prefer implementation plan subtasks from specs directory
              specsData.subtasks.length > 0
                ? specsData.subtasks.map((s) => ({
                    id: s.id,
                    title: s.title,
                    completed: s.status === "completed",
                    description: s.description,
                    files: s.files,
                    status: s.status,
                  }))
                : // Fallback to basic subtasks from task data
                  (task.subtasks || []).map((s) => ({
                    id: s.id,
                    title: s.title,
                    completed: s.completed,
                    description: undefined,
                    files: undefined,
                  }))
            }
            isLoading={specsData.isLoading}
            onSubtaskClick={(subtaskId) => {
              // Find the subtask and open its first associated file if available
              const allSubtasks = specsData.subtasks.length > 0
                ? specsData.subtasks
                : task.subtasks || [];
              const subtask = allSubtasks.find((s) => s.id === subtaskId);
              if (subtask && 'files' in subtask && subtask.files && subtask.files.length > 0) {
                // Open the first associated file
                const client = getGatewayClient();
                client.openFile(subtask.files[0]).catch(console.error);
              } else {
                // No files - just log for now (could show a toast or inline details)
                console.log("Subtask clicked (no files):", subtaskId, subtask);
              }
            }}
            onFileClick={(filePath) => {
              // Open file in editor
              const client = getGatewayClient();
              client.openFile(filePath).catch(console.error);
            }}
          />
        </TabsContent>

        {/* PRD Tab */}
        <TabsContent value="prd" className="flex-1 min-h-0">
          <TaskPRDTab
            taskId={task.id}
            prdContent={specsData.prdContent ?? task.prdContent}
            prdPath={specsData.prdPath ?? (task.specsPath ? `${task.specsPath}/spec.md` : undefined)}
            isLoading={specsData.isLoading}
            error={specsData.error}
            onRefresh={specsData.refresh}
            onOpenInEditor={(path) => {
              // Open file in default editor via gateway
              const client = getGatewayClient();
              client.openFile(path).catch(console.error);
            }}
          />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="flex-1 min-h-0">
          <TaskLogsTab
            taskId={task.id}
            logs={
              specsData.logs
                ? { taskId: task.id, phases: specsData.logs.phases }
                : task.logs
            }
            isLoading={specsData.isLoading}
            error={specsData.error}
            autoScroll={true}
            onRefresh={specsData.refresh}
            isTaskRunning={task.status === "in_progress"}
            pollingInterval={3000}
          />
        </TabsContent>

        {/* Task Directory Tab - Shows task-specific files in .viben/tasks/<id>/ */}
        <TabsContent value="task-dir" className="flex-1 min-h-0">
          {specsData.taskDir ? (
            <FileBrowser
              workspacePath={workspacePath}
              initialPath={specsData.taskDir}
              hideToolbar={true}
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {t("workspace.taskDirTab.noTaskDir", "No task directory")}
              </h3>
              <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
                {t(
                  "workspace.taskDirTab.taskDirWillAppear",
                  "Task files will appear here after the task directory is created"
                )}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Working Directory Tab - Shows worktree or workspace directory */}
        <TabsContent value="working-dir" className="flex-1 min-h-0">
          {(() => {
            // Use worktree_path if available, otherwise use workspace_path
            const workingDir = task.worktree_path || task.workspace_path || workspacePath;
            return workingDir ? (
              <FileBrowser
                workspacePath={workspacePath}
                initialPath={workingDir}
                hideToolbar={true}
                className="h-full"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  {t("workspace.workingDirTab.noWorkingDir", "No working directory")}
                </h3>
                <p className="text-sm text-muted-foreground/60 text-center max-w-xs">
                  {t(
                    "workspace.workingDirTab.workingDirWillAppear",
                    "Working directory will appear here when the task is assigned to a workspace"
                  )}
                </p>
              </div>
            );
          })()}
        </TabsContent>

        {/* Agent Chat Tab */}
        <TabsContent value="agent-chat" className="flex-1 min-h-0 flex flex-col">
          {/* Messages */}
          <DesktopMessageList
            messages={agentMessages}
            isStreaming={agentIsStreaming}
            pendingPlan={agentPendingPlan}
            pendingQuestions={agentPendingQuestions}
            onApprovePlan={agentApprovePlan}
            onRejectPlan={agentRejectPlan}
            onAnswerQuestions={agentAnswerQuestions}
            className="flex-1 min-w-0 overflow-hidden"
            maxMessageWidth="100%"
            artifacts={agentArtifacts}
          />

          {/* Error display */}
          {agentError && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
              <p className="text-sm text-destructive">{agentError}</p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border">
            {/*
              Configuration lock rule:
              - backlog: Show selectors, allow user to configure agent/executor/model
              - Other states: Hide selectors, configuration is locked after queueing
            */}
            <DesktopChatInput
              onSend={agentSendMessage}
              onCancel={agentCancel}
              isLoading={agentIsStreaming}
              disabled={agentPhase === "awaiting_approval" || agentPhase === "awaiting_input"}
              placeholder={
                agentPhase === "awaiting_approval"
                  ? t("chat.waitingForApproval")
                  : agentPhase === "awaiting_input"
                    ? t("chat.waitingForInput")
                    : t("workspace.agentChatPlaceholder", "Ask about this task...")
              }
              autoFocus={false}
              showTopToolbar
              showConfigBar
              showResizeHandle
              enableWritingMode
              useGlobalConfig
              hideAgentSelector={task.status !== "backlog"}
              hideModelSelector={task.status !== "backlog"}
              hideExecutorSelector={task.status !== "backlog"}
              slashCommands={agentSlashCommands}
              onSlashCommand={handleSlashCommand}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
