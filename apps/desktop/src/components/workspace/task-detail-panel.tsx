"use client";

import { useState, useMemo } from "react";
import {
  X,
  Circle,
  Signal,
  Tags,
  User,
  Calendar,
  Clock,
  Play,
  XCircle,
  GitBranch,
  ListChecks,
  MessageSquare,
  Activity,
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
  type CommentReaction,
} from "@viben/kanban";
import { useTranslation } from "react-i18next";

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
  placeholder = "Add description...",
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

// Property Row Component
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
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-2 w-28 text-sm text-muted-foreground shrink-0">
        <Icon className="h-4 w-4" />
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
  // Execution status (from vibe-kanban)
  has_in_progress_attempt?: boolean;
  last_attempt_failed?: boolean;
  executor?: string;
  // Phase 2: Subtasks and Relationships
  subtasks?: Subtask[];
  relationships?: TaskRelationship[];
  // Phase 4: Comments and Activity
  comments?: Comment[];
  activities?: ActivityEvent[];
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
  availableTags?: Tag[];
  availableUsers?: Assignee[];
  availableTasks?: AvailableTask[];
  onNavigateToTask?: (taskId: string) => void;
  // Phase 4: Comment callbacks
  currentUserId?: string;
  onAddComment?: (taskId: string, content: string) => void;
  onEditComment?: (taskId: string, commentId: string, content: string) => void;
  onDeleteComment?: (taskId: string, commentId: string) => void;
  onToggleReaction?: (taskId: string, commentId: string, emoji: string) => void;
}

export function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  availableTags = [],
  availableUsers = [],
  availableTasks = [],
  onNavigateToTask,
  currentUserId = "current-user",
  onAddComment,
  onEditComment,
  onDeleteComment,
  onToggleReaction,
}: TaskDetailPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("details");

  // Generate mock activity from task data if not provided
  const activities = useMemo<ActivityEvent[]>(() => {
    if (task?.activities && task.activities.length > 0) {
      return task.activities;
    }

    // Generate basic activity from task timestamps
    if (!task) return [];

    const events: ActivityEvent[] = [];

    // Created event
    events.push({
      id: `${task.id}-created`,
      type: "created",
      actor: {
        id: "system",
        name: "System",
      },
      timestamp: task.created_at,
      data: {},
    });

    // Status change event (if different from default)
    if (task.status && task.status !== "todo") {
      events.push({
        id: `${task.id}-status`,
        type: "status_changed",
        actor: {
          id: "system",
          name: "System",
        },
        timestamp: task.updated_at,
        data: {
          oldValue: "todo",
          newValue: task.status,
        },
      });
    }

    return events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [task]);

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

  // Phase 4: Comment handlers
  const handleAddComment = (content: string) => {
    if (onAddComment) {
      onAddComment(task.id, content);
    } else if (onUpdate) {
      // Fallback: manage comments in task state
      const newComment: Comment = {
        id: crypto.randomUUID(),
        content,
        author: {
          id: currentUserId,
          name: "You",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reactions: [],
      };
      onUpdate({
        comments: [...(task.comments || []), newComment],
      });
    }
  };

  const handleEditComment = (commentId: string, content: string) => {
    if (onEditComment) {
      onEditComment(task.id, commentId, content);
    } else if (onUpdate) {
      onUpdate({
        comments: task.comments?.map((c) =>
          c.id === commentId
            ? { ...c, content, updatedAt: new Date().toISOString() }
            : c
        ),
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    if (onDeleteComment) {
      onDeleteComment(task.id, commentId);
    } else if (onUpdate) {
      onUpdate({
        comments: task.comments?.filter((c) => c.id !== commentId),
      });
    }
  };

  const handleToggleReaction = (commentId: string, emoji: string) => {
    if (onToggleReaction) {
      onToggleReaction(task.id, commentId, emoji);
    } else if (onUpdate) {
      onUpdate({
        comments: task.comments?.map((c: Comment) => {
          if (c.id !== commentId) return c;

          const existingReaction = c.reactions.find(
            (r: CommentReaction) => r.emoji === emoji && r.users.some((u: { id: string; name: string }) => u.id === currentUserId)
          );

          if (existingReaction) {
            // Remove user from reaction
            const updatedReactions = c.reactions
              .map((r: CommentReaction) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: r.count - 1,
                      users: r.users.filter((u: { id: string; name: string }) => u.id !== currentUserId),
                    }
                  : r
              )
              .filter((r: CommentReaction) => r.count > 0);
            return { ...c, reactions: updatedReactions };
          } else {
            // Add user to reaction
            const existingEmoji = c.reactions.find((r: CommentReaction) => r.emoji === emoji);
            if (existingEmoji) {
              return {
                ...c,
                reactions: c.reactions.map((r: CommentReaction) =>
                  r.emoji === emoji
                    ? {
                        ...r,
                        count: r.count + 1,
                        users: [...r.users, { id: currentUserId, name: "You" }],
                      }
                    : r
                ),
              };
            } else {
              return {
                ...c,
                reactions: [
                  ...c.reactions,
                  {
                    emoji,
                    count: 1,
                    users: [{ id: currentUserId, name: "You" }],
                  },
                ],
              };
            }
          }
        }),
      });
    }
  };

  const selectedTagIds = task.tagIds || task.tags?.map((t) => t.id) || [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <span className="font-mono text-sm text-muted-foreground truncate flex-1">
          {task.id.slice(0, 8)}...
        </span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <div className="px-4 pt-4">
        <EditableTitle value={task.title} onChange={handleTitleChange} />
      </div>

      {/* Tabs for Details / Comments / Activity */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-4 mt-4 shrink-0">
          <TabsTrigger value="details" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            {t("workspace.taskDetail", "Details")}
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t("chat.artifacts", "Comments")}
            {task.comments && task.comments.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {task.comments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t("workspace.activity", "Activity")}
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
                  <Badge variant="outline">{task.status}</Badge>
                </PropertyRow>

                {/* Priority */}
                <PropertyRow
                  label={t("workspace.priority", "Priority")}
                  icon={Signal}
                >
                  {onUpdate ? (
                    <PrioritySelect
                      value={task.priority}
                      onValueChange={handlePriorityChange}
                      size="sm"
                      showLabel
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
                task.executor) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {t("workspace.execution", "Execution")}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {task.has_in_progress_attempt ? (
                      <Badge variant="secondary" className="gap-1">
                        <Play className="h-3 w-3" />
                        {t("workspace.running", "Running")}
                      </Badge>
                    ) : task.last_attempt_failed ? (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        {t("workspace.lastAttemptFailed", "Last attempt failed")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        {t("workspace.idle", "Idle")}
                      </Badge>
                    )}
                    {task.executor && task.executor !== "unknown" && (
                      <Badge variant="outline">{task.executor}</Badge>
                    )}
                  </div>
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

        {/* Comments Tab - Phase 4 */}
        <TabsContent value="comments" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <CommentList
                comments={task.comments || []}
                currentUserId={currentUserId}
                onAdd={onUpdate || onAddComment ? handleAddComment : undefined}
                onEdit={onUpdate || onEditComment ? handleEditComment : undefined}
                onDelete={onUpdate || onDeleteComment ? handleDeleteComment : undefined}
                onToggleReaction={onUpdate || onToggleReaction ? handleToggleReaction : undefined}
                inputPlaceholder={t("chat.inputPlaceholder", "Add a comment...")}
                emptyMessage={t("chat.noArtifacts", "No comments yet")}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Activity Tab - Phase 4 */}
        <TabsContent value="activity" className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <ActivityFeed
                events={activities}
                maxItems={50}
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
