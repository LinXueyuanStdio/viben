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
} from "lucide-react";
import {
  Button,
  Badge,
  ScrollArea,
  Input,
  Textarea,
  Label,
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
import { useStuckDetection } from "@/hooks/use-stuck-detection";
import type {
  TaskStatus,
  XStateValue,
  ReviewReason,
  ExecutionPhase,
  TaskEvent,
  TaskEventType,
} from "@/lib/vibe-kanban/types";

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
        className={cn("text-xl font-semibold h-auto py-1", className)}
      />
    );
  }

  return (
    <h2
      className={cn(
        "text-xl font-semibold cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors",
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
    <div className="flex items-center gap-2 py-1.5">
      <div className="flex items-center gap-1.5 w-24 text-xs text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
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
    PLANNING_COMPLETE: "bg-success/10 text-success",
    PLANNING_FAILED: "bg-destructive/10 text-destructive",
    SUBTASK_COMPLETE: "bg-success/10 text-success",
    ALL_SUBTASKS_DONE: "bg-success/10 text-success",
    CODING_FAILED: "bg-destructive/10 text-destructive",
    QA_PASSED: "bg-success/10 text-success",
    QA_FAILED: "bg-warning/10 text-warning",
    QA_FIXING_COMPLETE: "bg-success/10 text-success",
    QA_FIXING_FAILED: "bg-destructive/10 text-destructive",
    USER_STOPPED: "bg-warning/10 text-warning",
    APPROVED: "bg-success/10 text-success",
    REJECTED: "bg-warning/10 text-warning",
    CREATE_PR: "bg-info/10 text-info",
    RETRY: "bg-info/10 text-info",
    ABANDON: "bg-muted text-muted-foreground",
  };
  return eventClasses[eventType] || "bg-muted text-muted-foreground";
}

// Convert UI message to Agent message for display
function uiMessageToAgentMessage(msg: UIMessage): AgentMessage | null {
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
        message: msg.content || "Unknown error",
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
  // Execution status (from vibe-kanban)
  has_in_progress_attempt?: boolean;
  last_attempt_failed?: boolean;
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
  reviewReason?: ReviewReason;  // Review reason for human_review status
  executionPhase?: ExecutionPhase; // Current execution phase
  isStuck?: boolean;            // Whether task is stuck
  stuckDuration?: number;       // How long task has been stuck (ms)
  // Git worktree/workspace paths
  worktree_path?: string | null;  // Worktree path if task runs in worktree
  workspace_path?: string | null; // Workspace path where task was created
}

// Available task for relationships
export interface AvailableTask {
  id: string;
  title: string;
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
    isRunning: task?.has_in_progress_attempt ?? false,
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

  // Handle autoStartOnOpen from parent (e.g., when clicking "Run" from card dropdown)
  useEffect(() => {
    if (autoStartOnOpen && task) {
      setShouldAutoStart(true);
      setActiveTab("agent-chat");
      onAutoStartConsumed?.();
    }
  }, [autoStartOnOpen, task, onAutoStartConsumed]);

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
  });

  // Track previous task ID to detect task changes
  const prevTaskIdRef = useRef<string | null>(null);
  const loadedSessionIdRef = useRef<string | null>(null);

  // Reset state when task changes
  useEffect(() => {
    if (task?.id !== prevTaskIdRef.current) {
      console.log(`[TaskDetailPanel] Task changed from ${prevTaskIdRef.current} to ${task?.id}`);
      prevTaskIdRef.current = task?.id ?? null;
      loadedSessionIdRef.current = null;

      // Clear messages when switching tasks
      if (task?.id) {
        agentClearMessages();
      }
    }
  }, [task?.id, agentClearMessages]);

  // Update task's session_id when a new session is created
  useEffect(() => {
    if (currentSessionId && task?.id && !task.session_id && onUpdate) {
      // A new session was created, save it to task metadata
      console.log(`[TaskDetailPanel] Saving new session ${currentSessionId} to task ${task.id}`);
      onUpdate({ session_id: currentSessionId });
    }
  }, [currentSessionId, task?.id, task?.session_id, onUpdate]);

  // Load conversation history when task has a session
  // Use either task.session_id (from saved metadata) or currentSessionId (from hook)
  const effectiveSessionId = task?.session_id || currentSessionId;

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
          const messages = uiMessages
            .map(uiMessageToAgentMessage)
            .filter((msg): msg is AgentMessage => msg !== null);

          // Extract SDK session ID for resume functionality
          const sdkSessionMsg = uiMessages
            .filter((msg): msg is UIMessage & { sdkSessionId: string } =>
              msg.type === "sdk_session" && typeof msg.sdkSessionId === "string"
            )
            .pop();

          console.log(`[TaskDetailPanel] Loaded ${messages.length} messages for session ${effectiveSessionId}`);
          agentLoadMessages(messages, sdkSessionMsg?.sdkSessionId);
        } else {
          console.log(`[TaskDetailPanel] No messages found for session ${effectiveSessionId}`);
        }
      } catch (error) {
        console.error(`[TaskDetailPanel] Failed to load messages for session ${effectiveSessionId}:`, error);
      }
    };

    loadTaskMessages();
  }, [activeTab, task?.id, effectiveSessionId, workspacePath, taskAgentId, agentLoadMessages]);

  // Auto-start: send message via SSE when clicking "Run"
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

    // Reset the flag
    setShouldAutoStart(false);

    // Build initial prompt from task context using i18n
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
      agentSendMessage(initialPrompt);
    };

    // Small delay to ensure the tab switch animation completes
    setTimeout(startTask, 100);
  }, [shouldAutoStart, activeTab, task, workspacePath, agentIsStreaming, agentMessages.length, agentSendMessage, t]);

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
      case "help":
        // Could show a help modal or inject a help message
        break;
    }
  }, [agentClearMessages]);

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
          {/* Title - Editable */}
          <EditableTitle value={task.title} onChange={handleTitleChange} />
          {/* ID + Status on second line */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono text-xs text-muted-foreground">
              #{task.id.slice(0, 7)}
            </span>
            <span className="text-muted-foreground/30">•</span>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs font-normal px-2 py-0.5 rounded-full",
                getStatusColor(task.status)
              )}
            >
              {getStatusLabel(task.status)}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
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
          <TabsTrigger value="details" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            {t("workspace.taskDetail", "Details")}
          </TabsTrigger>
          <TabsTrigger value="agent-chat" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            {t("workspace.agentChat", "Agent Chat")}
          </TabsTrigger>
          <TabsTrigger value="subtasks" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            {t("workspace.tabs.subtasks", "Subtasks")}
            {(() => {
              // Use implementation plan subtasks if available, otherwise fall back to task.subtasks
              const subtasksList = specsData.subtasks.length > 0
                ? specsData.subtasks
                : task.subtasks || [];
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
          <TabsTrigger value="prd" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("workspace.tabs.prd", "PRD")}
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {t("workspace.tabs.logs", "Logs")}
          </TabsTrigger>
          <TabsTrigger value="task-dir" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {t("workspace.tabs.taskDir", "Task Directory")}
          </TabsTrigger>
          <TabsTrigger value="working-dir" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            {t("workspace.tabs.workingDir", "Working Directory")}
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("chat.artifacts.title", "Comments")}
            {comments.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {comments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t("workspace.activity", "Activity")}
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
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
            <div className="p-4 space-y-6">
              {/* Description - Editable */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {t("workspace.description", "Description")}
                </h3>
                <EditableDescription
                  value={task.description || ""}
                  onChange={handleDescriptionChange}
                  placeholder={t("workspace.addDescription", "Add description...")}
                />
              </div>

              {/* Properties */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t("workspace.properties", "Properties")}
                </h3>

                {/* Status (read-only, change via drag) */}
                <PropertyRow
                  label={t("workspace.status", "Status")}
                  icon={Circle}
                >
                  <Badge variant="outline">{getStatusLabel(task.status)}</Badge>
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
              {(task.has_in_progress_attempt !== undefined ||
                task.last_attempt_failed !== undefined ||
                task.executor ||
                task.xstateState) && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {t("workspace.execution", "Execution")}
                    </h3>
                  </div>

                  {/* Task Warnings - Stuck and Incomplete detection with one-click recovery */}
                  <TaskWarnings
                    isStuck={isStuck}
                    isIncomplete={isIncomplete}
                    isRecovering={isRecovering}
                    taskProgress={taskProgress}
                    stuckDuration={stuckDuration}
                    onRecover={handleRecover}
                    onResume={handleResume}
                    className="mb-3"
                  />

                  {/* Task Action Buttons */}
                  <div className="mb-3">
                    <TaskActionButtons
                      taskId={task.id}
                      workspacePath={workspacePath}
                      status={task.status as TaskStatus}
                      xstateState={task.xstateState}
                      reviewReason={task.reviewReason}
                      isStuck={isStuck}
                      isRunning={task.has_in_progress_attempt}
                      lastAttemptFailed={task.last_attempt_failed}
                      executionPhase={task.executionPhase}
                      lastEventSequence={task.lastEvent?.sequence}
                      taskTitle={task.title}
                      taskDescription={task.description ?? undefined}
                      agentId={task.agent_id ?? "default"}
                      onEventSubmitted={(eventType, newState) => {
                        console.log(`[TaskDetailPanel] Event ${eventType} submitted, new state: ${newState}`);
                        // Trigger refresh of task data
                        onUpdate?.({ _refresh: true });
                      }}
                      onEventError={(error) => {
                        console.error(`[TaskDetailPanel] Event error: ${error}`);
                      }}
                      size="default"
                      showAllActions
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status indicator with colored dot */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {t("workspace.status", "Status")}:
                      </span>
                      {isStuck ? (
                        <Badge variant="outline" className="gap-1.5 pl-1.5 bg-warning/10 text-warning border-warning/30">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {t("workspace.taskStatus.stuck", "Stuck")}
                        </Badge>
                      ) : task.has_in_progress_attempt ? (
                        <Badge variant="secondary" className="gap-1.5 pl-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                          {t("workspace.running", "Running")}
                        </Badge>
                      ) : task.last_attempt_failed ? (
                        <Badge variant="destructive" className="gap-1.5 pl-1.5">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          {t("workspace.failed", "Failed")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1.5 pl-1.5">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          {t("workspace.idle", "Idle")}
                        </Badge>
                      )}
                    </div>
                    {/* Executor/Agent info */}
                    {task.executor && task.executor !== "unknown" && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {t("workspace.agent", "Agent")}:
                        </span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {task.executor}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Review Reason */}
                  {task.reviewReason && task.status === "human_review" && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">
                        {t("workspace.reviewReason.label", "Review Reason")}:
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-xs",
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
                </div>
              )}

              {/* Subtasks Section */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium text-muted-foreground">
                    {t("workspace.subtasks", "Subtasks")}
                  </Label>
                </div>
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
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t("workspace.relationships", "Relationships")}
                    </Label>
                  </div>
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

              {/* Timestamps */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t("workspace.timestamps", "Timestamps")}
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {t("workspace.created", "Created")}: {formatDateTime(task.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {t("workspace.updated", "Updated")}: {formatDateTime(task.updated_at)}
                    </span>
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
              // Could navigate to subtask or show details
              console.log("Subtask clicked:", subtaskId);
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
              hideAgentSelector
              hideModelSelector
              slashCommands={agentSlashCommands}
              onSlashCommand={handleSlashCommand}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
