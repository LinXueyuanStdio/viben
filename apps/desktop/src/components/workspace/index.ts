export { WorkspaceBreadcrumb, type BreadcrumbSegment } from "./workspace-breadcrumb";
export { WorkspaceHeader } from "./workspace-header";
export { TaskDetailPanel, type TaskDetailPanelProps, type TaskForPanel, type AvailableTask } from "./task-detail-panel";
export { TaskDetailDialog, type TaskDetailDialogProps } from "./task-detail-dialog";

// Executor components
export { ExecutorList, type ExecutorListProps } from "./executor-list";
// Re-export from chat for convenience
export {
  ExecutorListItem,
  getExecutorDisplayName,
  getExecutorGradient,
  type ExecutorListItemProps,
} from "@/components/chat";

// Kanban components
export {
  TasksLayout,
  useKanbanNavigation,
  CreateTaskDialog,
  type LayoutMode,
  type UseKanbanNavigationOptions,
  type UseKanbanNavigationReturn,
  type CreateTaskDialogProps,
  type CreateTaskData,
} from "./kanban";

// Add Workspace Wizard
export { AddWorkspaceModal } from "./add-workspace-modal";
