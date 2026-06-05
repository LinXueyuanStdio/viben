"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  X,
  ListChecks,
  MessageSquare,
  Activity,
  Bot,
  FileText,
  Terminal,
  FolderOpen,
  History,
} from "lucide-react";
import {
  Button,
  Badge,
  cn,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@viben/ui";
import {
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
  useTaskSpecsData,
} from "@/hooks";
import { useAgentConversation } from "@/pages/conversation/hooks/use-agent-conversation";
import type { SlashCommand, SlashCommandHandler } from "@viben/chat";
import { getGatewayClient, type UIMessage } from "@/lib/gateway";
import type { AgentMessage } from "@/types";
import { useStuckDetection } from "@/hooks/use-stuck-detection";
import { useWorktreeExists } from "@/hooks/use-worktree-exists";
import { EditableTitle } from "./editable-title";
import { ActivityTab } from "./activity-tab";
import { AgentChatTab } from "./agent-chat-tab";
import { CommentsTab } from "./comments-tab";
import { DetailsTab } from "./details-tab";
import {
  TaskDirectoryTab,
  WorkingDirectoryTab,
} from "./directory-tabs";
import { EventsTab } from "./events-tab";
import {
  SpecsLogsTab,
  SpecsPrdTab,
  SpecsSubtasksTab,
} from "./specs-tabs";
import { uiMessageToAgentMessage } from "./utils";
import type { TaskDetailPanelProps } from "./types";

export type { TaskForPanel, AvailableTask, AvailableAgent, TaskDetailPanelProps } from "./types";

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
  currentUserName: currentUserNameProp,
  workspacePath = "",
  autoStartOnOpen = false,
  onAutoStartConsumed,
}: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const currentUserName = currentUserNameProp ?? t("workspace.taskDetail.you", "You");
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
- **Description**: ${task.description || t("workspace.noDescription", "No description provided")}
${task.tags && task.tags.length > 0 ? `- **Tags**: ${task.tags.map((t) => t.name).join(", ")}` : ""}

You are helping the user work on this task. Provide relevant suggestions, code examples, and guidance based on the task context.`;

    return {
      system_prompt: taskContextPrompt,
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
        // Use worktree_path if available (task may run in a git worktree),
        // otherwise fall back to the main workspace path
        const effectiveWorkspace = task.worktree_path || workspacePath;
        console.log(`[TaskDetailPanel] Loading messages for task ${task.id}, session ${effectiveSessionId}, workspace ${effectiveWorkspace}`);

        // Load messages using session_id
        const uiMessages = await client.listSessionUIMessages(taskAgentId, effectiveSessionId, effectiveWorkspace);

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
      name: "clear",
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      input: null,
    },
    {
      name: "help",
      description: t("chat.slashCommands.helpDesc", "Show available commands"),
      input: null,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = useCallback<SlashCommandHandler>((command) => {
    switch (command.name) {
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
            {t("workspace.taskDetail.label", "Details")}
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
          <DetailsTab
            task={task}
            workspacePath={workspacePath}
            availableTags={availableTags}
            availableUsers={availableUsers}
            availableTasks={availableTasks}
            selectedTagIds={selectedTagIds}
            onUpdate={onUpdate}
            onNavigateToTask={onNavigateToTask}
            isStuck={isStuck}
            isIncomplete={isIncomplete}
            isRecovering={isRecovering}
            taskProgress={taskProgress}
            stuckDuration={stuckDuration}
            onRecover={handleRecover}
            onResume={handleResume}
            worktreeExists={worktreeExists}
            isCheckingWorktree={isCheckingWorktree}
            t={t}
            getStatusLabel={getStatusLabel}
          />
        </TabsContent>

        {/* Comments Tab - Persisted to SQLite */}
        <TabsContent value="comments" className="flex-1 min-h-0">
          <CommentsTab
            comments={comments}
            currentUserId={currentUserId}
            isLoading={isLoadingComments}
            disabled={isCommentPending}
            inputPlaceholder={t("chat.inputPlaceholder", "Add a comment...")}
            emptyMessage={t("chat.noArtifacts", "No comments yet")}
            onAdd={handleAddComment}
            onEdit={handleEditComment}
            onDelete={handleDeleteComment}
            onToggleReaction={handleToggleReaction}
          />
        </TabsContent>

        {/* Activity Tab - Persisted to SQLite */}
        <TabsContent value="activity" className="flex-1 min-h-0">
          <ActivityTab activities={activities} isLoading={isLoadingActivities} />
        </TabsContent>

        {/* Events Tab - State Machine Event History */}
        <TabsContent value="events" className="flex-1 min-h-0">
          <EventsTab task={task} t={t} />
        </TabsContent>

        {/* Subtasks Tab */}
        <TabsContent value="subtasks" className="flex-1 min-h-0">
          <SpecsSubtasksTab task={task} specsData={specsData} />
        </TabsContent>

        {/* PRD Tab */}
        <TabsContent value="prd" className="flex-1 min-h-0">
          <SpecsPrdTab task={task} specsData={specsData} />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="flex-1 min-h-0">
          <SpecsLogsTab task={task} specsData={specsData} />
        </TabsContent>

        {/* Task Directory Tab - Shows task-specific files in .viben/tasks/<id>/ */}
        <TabsContent value="task-dir" className="flex-1 min-h-0">
          <TaskDirectoryTab
            taskDir={specsData.taskDir}
            workspacePath={workspacePath}
            t={t}
          />
        </TabsContent>

        {/* Working Directory Tab - Shows worktree or workspace directory */}
        <TabsContent value="working-dir" className="flex-1 min-h-0">
          <WorkingDirectoryTab task={task} workspacePath={workspacePath} t={t} />
        </TabsContent>

        {/* Agent Chat Tab */}
        <TabsContent value="agent-chat" className="flex-1 min-h-0 flex flex-col">
          <AgentChatTab
            messages={agentMessages}
            isStreaming={agentIsStreaming}
            pendingPlan={agentPendingPlan}
            pendingQuestions={agentPendingQuestions}
            artifacts={agentArtifacts}
            error={agentError}
            phase={agentPhase}
            taskStatus={task.status}
            slashCommands={agentSlashCommands}
            placeholder={t("workspace.agentChatPlaceholder", "Ask about this task...")}
            waitingForApprovalText={t("chat.waitingForApproval")}
            waitingForInputText={t("chat.waitingForInput")}
            onSend={agentSendMessage}
            onCancel={agentCancel}
            onApprovePlan={agentApprovePlan}
            onRejectPlan={agentRejectPlan}
            onAnswerQuestions={agentAnswerQuestions}
            onSlashCommand={handleSlashCommand}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
