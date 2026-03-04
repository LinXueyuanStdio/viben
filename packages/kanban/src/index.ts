export {
  KanbanProvider,
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  STATUS_INDICATOR_COLORS,
  type KanbanProviderProps,
  type KanbanBoardProps,
  type KanbanCardProps,
  type KanbanCardsProps,
  type KanbanHeaderProps,
  type Status,
  type Feature,
  type StatusIndicator,
  type DragEndEvent,
} from "./kanban";

// Primitives
export {
  // Priority
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  type IssuePriority,
  type PriorityConfig,
  PriorityIcon,
  type PriorityIconProps,
  PrioritySelect,
  type PrioritySelectProps,
  // Assignee
  type Assignee,
  AssigneeAvatar,
  getInitials,
  type AssigneeAvatarProps,
  AssigneeSelect,
  type AssigneeSelectProps,
  // Due date
  formatDueDate,
  getDueDateStatus,
  DueDateBadge,
  type DueDateBadgeProps,
  DueDatePicker,
  type DueDatePickerProps,
  // Tag
  TAG_COLORS,
  type Tag,
  type TagColor,
  TagBadge,
  type TagBadgeProps,
  TagSelect,
  type TagSelectProps,
} from "./primitives";

// Components
export {
  // Filter
  KanbanFilterBar,
  type KanbanFilterBarProps,
  type KanbanFilter,
  countActiveFilters,
  // View system
  type ViewMode,
  ViewSwitcher,
  type ViewSwitcherProps,
  ListView,
  type ListViewProps,
  ListViewItem,
  type ListViewItemProps,
  // Subtask system
  type Subtask,
  type SubtaskCallbacks,
  SubtaskProgress,
  type SubtaskProgressProps,
  SubtaskItem,
  type SubtaskItemProps,
  SubtaskList,
  type SubtaskListProps,
  // Bulk actions
  BulkActionsBar,
  type BulkActionsBarProps,
  SelectableCard,
  type SelectableCardProps,
  // Relationship system
  type RelationshipType,
  type TaskRelationship,
  type RelationshipConfig,
  RELATIONSHIP_CONFIG,
  RELATIONSHIP_TYPES,
  RelationshipBadge,
  type RelationshipBadgeProps,
  RelationshipList,
  type RelationshipListProps,
  RelationshipAdd,
  type RelationshipAddProps,
  // Quick task input
  QuickTaskInput,
  type QuickTaskInputProps,
  // Editable components
  EditableCardTitle,
  type EditableCardTitleProps,
  EditableText,
  type EditableTextProps,
  // Stats system
  type KanbanStats,
  type StatCardProps,
  StatCard,
  StatsPanel,
  type StatsPanelProps,
  // Sort system
  type SortMode,
  type SortDirection,
  type SortConfig,
  type SortOption,
  SORT_OPTIONS,
  SortModeSelect,
  type SortModeSelectProps,
  // Command palette system
  type Command,
  type CommandCategory,
  CATEGORY_LABELS,
  CommandPalette,
  type CommandPaletteProps,
  // Collapsible column
  CollapsibleColumn,
  type CollapsibleColumnProps,
  // Resizable column
  ResizableColumn,
  type ResizableColumnProps,
  // Phase progress indicator
  PhaseProgressIndicator,
  type PhaseProgressIndicatorProps,
  type IndicatorExecutionPhase,
  // Drag preview
  DragPreview,
  type DragPreviewProps,
  MultiDragOverlay,
  type MultiDragOverlayProps,
  // Activity feed system
  type ActivityType,
  type ActivityActor,
  type ActivityEvent,
  ACTIVITY_LABELS,
  ActivityItem,
  type ActivityItemProps,
  ActivityFeed,
  type ActivityFeedProps,
  // Comment system
  type Comment,
  type CommentAuthor,
  type CommentReaction,
  REACTION_EMOJIS,
  formatRelativeTime,
  CommentInput,
  type CommentInputProps,
  CommentItem,
  type CommentItemProps,
  CommentList,
  type CommentListProps,
  // Board settings
  type ColumnConfig,
  COLUMN_COLORS,
  BoardSettingsDialog,
  type BoardSettingsDialogProps,
  type BoardSettingsDialogTranslations,
} from "./components";

// Hooks
export { useFilteredItems } from "./hooks/use-filtered-items";
export { useMultiSelect, type MultiSelectState } from "./hooks/use-multi-select";
export { useSortedItems } from "./hooks/use-sorted-items";
export { useKanbanStats } from "./hooks/use-kanban-stats";
export { useCommandPalette } from "./hooks/use-command-palette";
export { useColumnCollapse } from "./hooks/use-column-collapse";
export { useKanbanKeyboard } from "./hooks/use-kanban-keyboard";
export {
  useKanbanPreferences,
  type KanbanPreferences,
  type SavedFilter,
  type UseKanbanPreferencesOptions,
  type UseKanbanPreferencesReturn,
} from "./hooks/use-kanban-preferences";
export {
  useDragPreview,
  type UseDragPreviewOptions,
  type UseDragPreviewReturn,
} from "./hooks/use-drag-preview";
export {
  useColumnResize,
  type ColumnWidths,
  type UseColumnResizeOptions,
  type UseColumnResizeReturn,
} from "./hooks/use-column-resize";

// Constants - Task metadata types and labels
export {
  // Execution phases
  type ExecutionPhase,
  EXECUTION_PHASE_LABELS,
  EXECUTION_PHASE_BADGE_COLORS,
  // Task categories
  type TaskCategory,
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_COLORS,
  TASK_CATEGORY_ICONS,
  // Task complexity
  type TaskComplexity,
  TASK_COMPLEXITY_LABELS,
  TASK_COMPLEXITY_COLORS,
  // Task impact
  type TaskImpact,
  TASK_IMPACT_LABELS,
  TASK_IMPACT_COLORS,
  // Review reasons
  type ReviewReason,
  REVIEW_REASON_LABELS,
  REVIEW_REASON_COLORS,
} from "./constants";
