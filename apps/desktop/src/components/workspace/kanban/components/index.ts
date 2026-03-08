/**
 * Kanban Components
 *
 * Extracted components from workspace-kanban.tsx for better organization
 * and reusability. Part of the kanban refactoring effort.
 *
 * @see docs/plans/2026-03-08-workspace-kanban-refactor-design.md
 */

// Column components
export { CollapsedColumn } from "./collapsed-column";
export type { CollapsedColumnProps } from "./collapsed-column";

export { ColumnHeader } from "./column-header";
export type { ColumnHeaderProps } from "./column-header";

export { KanbanColumn } from "./kanban-column";
export type {
  KanbanColumnProps,
  ColumnHeaderConfig,
  TaskCardConfig,
} from "./kanban-column";

// Toolbar component
export { KanbanToolbar } from "./kanban-toolbar";
export type { KanbanToolbarProps } from "./kanban-toolbar";

// Task card components
export { TaskCard } from "./task-card";
export type { TaskCardProps } from "./task-card";

export { TaskCardContent } from "./task-card-content";

export { TaskCardMenu } from "./task-card-menu";
export type { TaskCardMenuProps } from "./task-card-menu";

// View components
export { KanbanBoardView } from "./kanban-board-view";
export type { KanbanBoardViewProps } from "./kanban-board-view";

export { KanbanListView } from "./kanban-list-view";
export type { KanbanListViewProps } from "./kanban-list-view";

// Status selector
export { StatusSelect } from "./status-select";
export type { StatusSelectProps } from "./status-select";
