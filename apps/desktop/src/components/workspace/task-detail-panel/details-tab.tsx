import {
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  Circle,
  Clock,
  ExternalLink,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  ListChecks,
  Loader2,
  Signal,
  Tags,
  User,
  UserCircle,
} from "lucide-react";
import type { TFunction } from "i18next";
import {
  AssigneeAvatar,
  AssigneeSelect,
  DueDateBadge,
  DueDatePicker,
  PriorityIcon,
  PrioritySelect,
  RelationshipAdd,
  RelationshipList,
  SubtaskList,
  TagBadge,
  TagSelect,
  type Assignee,
  type IssuePriority,
  type RelationshipType,
  type Subtask,
  type Tag,
  type TaskRelationship,
} from "@viben/kanban";
import { Badge, Button, ScrollArea, cn } from "@viben/ui";
import { getGatewayClient } from "@/lib/gateway";
import type { TaskStatus } from "@/lib/kanban/types";
import { toast } from "@/hooks/use-toast";
import { TaskActionButtons } from "../kanban/task-action-buttons";
import { TaskWarnings } from "../kanban/task-warnings";
import { StatusSelect } from "../kanban/components/status-select";
import { EditableDescription } from "./editable-description";
import { ExecutionProgressTimeline } from "./execution-progress-timeline";
import { PropertyRow } from "./property-row";
import { formatDateTime } from "./utils";
import type { AvailableTask, TaskForPanel } from "./types";

export interface DetailsTabProps {
  task: TaskForPanel;
  workspacePath: string;
  availableTags: Tag[];
  availableUsers: Assignee[];
  availableTasks: AvailableTask[];
  selectedTagIds: string[];
  onUpdate?: (updates: Record<string, unknown>) => void;
  onNavigateToTask?: (taskId: string) => void;
  isStuck: boolean;
  isIncomplete: boolean;
  isRecovering: boolean;
  taskProgress: { completed: number; total: number };
  stuckDuration: number;
  onRecover: () => Promise<void>;
  onResume: () => Promise<void>;
  worktreeExists: boolean | null;
  isCheckingWorktree: boolean;
  t: TFunction;
  getStatusLabel: (status: string) => string;
}

export function DetailsTab({
  task,
  workspacePath,
  availableTags,
  availableUsers,
  availableTasks,
  selectedTagIds,
  onUpdate,
  onNavigateToTask,
  isStuck,
  isIncomplete,
  isRecovering,
  taskProgress,
  stuckDuration,
  onRecover,
  onResume,
  worktreeExists,
  isCheckingWorktree,
  t,
  getStatusLabel,
}: DetailsTabProps) {
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

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
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

        <div className="border-t pt-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            {t("workspace.properties", "Properties")}
          </h3>

          <PropertyRow label={t("workspace.status", "Status")} icon={Circle}>
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

          <PropertyRow label={t("workspace.priority.label", "Priority")} icon={Signal}>
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

          {(availableTags.length > 0 || selectedTagIds.length > 0) && (
            <PropertyRow label={t("workspace.tags", "Tags")} icon={Tags}>
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

          {(availableUsers.length > 0 || task.assigneeId) && (
            <PropertyRow label={t("workspace.assignee", "Assignee")} icon={User}>
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

          {task.creator && (
            <PropertyRow label={t("workspace.creator", "Creator")} icon={UserCircle}>
              <span className="text-sm">{task.creator}</span>
            </PropertyRow>
          )}

          {task.agent_id && (
            <PropertyRow label={t("workspace.agent", "Agent")} icon={Bot}>
              <Badge variant="outline" className="font-mono text-xs">
                {task.agent_id}
              </Badge>
            </PropertyRow>
          )}

          {task.executor && (
            <PropertyRow label={t("workspace.executor", "Executor")} icon={Activity}>
              <Badge variant="secondary" className="text-xs">
                {task.executor}
              </Badge>
            </PropertyRow>
          )}

          {task.model && (
            <PropertyRow label={t("workspace.model", "Model")} icon={Bot}>
              <Badge variant="outline" className="font-mono text-xs">
                {task.model}
              </Badge>
            </PropertyRow>
          )}

          <PropertyRow label={t("workspace.dueDate", "Due Date")} icon={Calendar}>
            {onUpdate ? (
              <DueDatePicker value={task.dueDate} onChange={handleDueDateChange} />
            ) : task.dueDate ? (
              <DueDateBadge dueDate={task.dueDate} />
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("workspace.noDueDate", "No due date")}
              </span>
            )}
          </PropertyRow>
        </div>

        {(task.executor || task.xstateState) && (
          <div className="border-t pt-3">
            <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
              {t("workspace.execution", "Execution")}
            </h3>

            <TaskWarnings
              isStuck={isStuck}
              isIncomplete={isIncomplete}
              isRecovering={isRecovering}
              taskProgress={taskProgress}
              stuckDuration={stuckDuration}
              onRecover={onRecover}
              onResume={onResume}
              className="mb-2"
            />

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
                              return match ? t("workspace.taskDetail.pullRequestNumber", "Pull Request #{{number}}", { number: match[1] }) : t("workspace.taskDetail.viewPR", "View PR");
                            })()}
                          </span>
                          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/30">
                            {t("workspace.taskDetail.open", "Open")}
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

            <div className="space-y-3 p-3 rounded-md bg-muted/30">
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
                  <Badge variant="destructive">{t("workspace.failed", "Failed")}</Badge>
                ) : (
                  <Badge variant="outline">{t("workspace.idle", "Idle")}</Badge>
                )}
              </div>

              {task.next_action && task.next_action.length > 0 && (
                <ExecutionProgressTimeline
                  nextAction={task.next_action}
                  currentPhase={task.current_phase ?? 0}
                  status={task.status}
                  t={t}
                />
              )}
            </div>

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

            {(task.branch || task.base_branch || task.worktree_path) && (
              <div className={cn(
                "mt-3 p-3 rounded-lg border",
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

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" />
              {t("workspace.relationships", "Relationships")}
            </h3>
            {onUpdate && availableTasks.length > 0 && (
              <RelationshipAdd
                availableTasks={availableTasks.filter((availableTask) => availableTask.id !== task.id)}
                onAdd={(type: RelationshipType, targetTaskId: string) => {
                  const targetTask = availableTasks.find(
                    (availableTask) => availableTask.id === targetTaskId
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
                        (relationship: TaskRelationship) => relationship.id !== id
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
  );
}
