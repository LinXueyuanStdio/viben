export { WorkspaceBreadcrumb, type BreadcrumbSegment } from "./workspace-breadcrumb";
export { WorkspaceHeader } from "./workspace-header";
export { TaskDetailPanel, type TaskDetailPanelProps, type TaskForPanel } from "./task-detail-panel";

// Executor components
export {
  ExecutorList,
  getExecutorDisplayName,
  getExecutorGradient,
  type ExecutorListProps,
  type ExecutorListItemProps,
} from "./executor-list";

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
