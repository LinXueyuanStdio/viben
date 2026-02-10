export { WorkspaceBreadcrumb, type BreadcrumbSegment } from "./workspace-breadcrumb";
export { WorkspaceHeader } from "./workspace-header";
export { TaskDetailPanel, type TaskDetailPanelProps, type TaskForPanel } from "./task-detail-panel";

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
