"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  Button,
  Badge,
  ScrollArea,
  Input,
  Textarea,
  Label,
  cn,
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
  type IssuePriority,
  type Tag,
  type Assignee,
  type Subtask,
  type TaskRelationship,
  type RelationshipType,
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
}

export function TaskDetailPanel({
  task,
  onClose,
  onUpdate,
  availableTags = [],
  availableUsers = [],
  availableTasks = [],
  onNavigateToTask,
}: TaskDetailPanelProps) {
  const { t } = useTranslation();

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

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Title - Editable */}
          <EditableTitle value={task.title} onChange={handleTitleChange} />

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
                      onToggle: (id, completed) =>
                        onUpdate({
                          subtasks: task.subtasks?.map((s) =>
                            s.id === id ? { ...s, completed } : s
                          ),
                        }),
                      onCreate: (title) =>
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
                      onDelete: (id) =>
                        onUpdate({
                          subtasks: task.subtasks?.filter((s) => s.id !== id),
                        }),
                      onUpdate: (id, title) =>
                        onUpdate({
                          subtasks: task.subtasks?.map((s) =>
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
                  ? (id) =>
                      onUpdate({
                        relationships: task.relationships?.filter(
                          (r) => r.id !== id
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
              {t("workspace.activity", "Activity")}
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
    </div>
  );
}
